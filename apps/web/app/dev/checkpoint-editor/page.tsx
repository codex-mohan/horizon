"use client";

import { json } from "@codemirror/lang-json";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@horizon/ui/components/alert-dialog";
import { Badge } from "@horizon/ui/components/badge";
import { Button } from "@horizon/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@horizon/ui/components/dialog";
import { Input } from "@horizon/ui/components/input";
import { ScrollArea } from "@horizon/ui/components/scroll-area";
import { Separator } from "@horizon/ui/components/separator";
import CodeMirror from "@uiw/react-codemirror";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  FileJson,
  Hash,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createCodeMirrorTheme } from "@/lib/codemirror-theme";

interface ThreadInfo {
  id: string;
  checkpointCount: number;
  lastUpdated: string | null;
  firstCheckpointId: string | null;
  lastCheckpointId: string | null;
}

interface CheckpointEntry {
  checkpoint: {
    v: number;
    id: string;
    ts: string;
    channel_values: Record<string, unknown>;
    channel_versions: Record<string, number>;
    versions_seen: Record<string, Record<string, number>>;
    pending_sends: unknown[];
  };
  metadata: {
    source: string;
    writes: unknown;
    step: number;
    parents: Record<string, unknown>;
  };
  parentConfig: {
    tags: string[];
    metadata: Record<string, unknown>;
    recursionLimit: number;
    configurable: Record<string, unknown>;
    signal: Record<string, unknown>;
  };
}

interface ThreadData {
  threadId: string;
  checkpoints: CheckpointEntry[];
  count: number;
}

export default function CheckpointEditorPage() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "dark";
  const isDark = currentTheme === "dark";

  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number>(0);
  const [editorContent, setEditorContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isJsonValid, setIsJsonValid] = useState(true);

  const [showDeleteThreadDialog, setShowDeleteThreadDialog] = useState(false);
  const [showDeleteCheckpointDialog, setShowDeleteCheckpointDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const extensions = [json(), createCodeMirrorTheme(isDark)];

  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/checkpoints");
      if (!response.ok) throw new Error("Failed to load threads");
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error("[CheckpointEditor] Error loading threads:", error);
      toast.error("Failed to load checkpoint threads");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadThreadData = useCallback(async (threadId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/checkpoints?threadId=${encodeURIComponent(threadId)}`);
      if (!response.ok) throw new Error("Failed to load thread data");
      const data = await response.json();
      setThreadData(data);
      if (data.checkpoints.length > 0) {
        setSelectedCheckpointIndex(0);
        const content = JSON.stringify(data.checkpoints[0], null, 2);
        setEditorContent(content);
        setOriginalContent(content);
        setHasChanges(false);
      }
    } catch (error) {
      console.error("[CheckpointEditor] Error loading thread data:", error);
      toast.error("Failed to load thread data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleThreadSelect = (threadId: string) => {
    if (hasChanges) {
      setPendingAction(() => () => {
        setSelectedThreadId(threadId);
        loadThreadData(threadId);
      });
      setShowUnsavedChangesDialog(true);
    } else {
      setSelectedThreadId(threadId);
      loadThreadData(threadId);
    }
  };

  const handleCheckpointSelect = (index: number) => {
    if (hasChanges) {
      setPendingAction(() => () => {
        setSelectedCheckpointIndex(index);
        if (threadData?.checkpoints[index]) {
          const content = JSON.stringify(threadData.checkpoints[index], null, 2);
          setEditorContent(content);
          setOriginalContent(content);
          setHasChanges(false);
        }
      });
      setShowUnsavedChangesDialog(true);
    } else {
      setSelectedCheckpointIndex(index);
      if (threadData?.checkpoints[index]) {
        const content = JSON.stringify(threadData.checkpoints[index], null, 2);
        setEditorContent(content);
        setOriginalContent(content);
        setHasChanges(false);
      }
    }
  };

  const handleEditorChange = useCallback(
    (value: string) => {
      setEditorContent(value);
      setHasChanges(value !== originalContent);
      try {
        JSON.parse(value);
        setIsJsonValid(true);
      } catch {
        setIsJsonValid(false);
      }
    },
    [originalContent]
  );

  const handleSave = async () => {
    if (!selectedThreadId || !threadData) return;

    let parsedData: CheckpointEntry;
    try {
      parsedData = JSON.parse(editorContent);
    } catch {
      toast.error("Invalid JSON format");
      return;
    }

    setIsSaving(true);
    try {
      const checkpointId = threadData.checkpoints[selectedCheckpointIndex]?.checkpoint.id;
      const response = await fetch(
        `/api/checkpoints?threadId=${encodeURIComponent(selectedThreadId)}&checkpointId=${encodeURIComponent(checkpointId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkpoint: parsedData.checkpoint,
            metadata: parsedData.metadata,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to save checkpoint");

      toast.success("Checkpoint saved successfully");
      setOriginalContent(editorContent);
      setHasChanges(false);
      await loadThreadData(selectedThreadId);
    } catch (error) {
      console.error("[CheckpointEditor] Error saving checkpoint:", error);
      toast.error("Failed to save checkpoint");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!selectedThreadId) return;

    try {
      const response = await fetch(
        `/api/checkpoints?threadId=${encodeURIComponent(selectedThreadId)}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete thread");

      toast.success("Thread deleted successfully");
      setSelectedThreadId(null);
      setThreadData(null);
      setEditorContent("");
      setOriginalContent("");
      setHasChanges(false);
      await loadThreads();
    } catch (error) {
      console.error("[CheckpointEditor] Error deleting thread:", error);
      toast.error("Failed to delete thread");
    }
    setShowDeleteThreadDialog(false);
  };

  const handleDeleteCheckpoint = async () => {
    if (!selectedThreadId || !threadData) return;

    const checkpointId = threadData.checkpoints[selectedCheckpointIndex]?.checkpoint.id;

    try {
      const response = await fetch(
        `/api/checkpoints?threadId=${encodeURIComponent(selectedThreadId)}&checkpointId=${encodeURIComponent(checkpointId)}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete checkpoint");

      toast.success("Checkpoint deleted successfully");
      await loadThreadData(selectedThreadId);

      if (selectedCheckpointIndex >= threadData.checkpoints.length - 1) {
        setSelectedCheckpointIndex(Math.max(0, threadData.checkpoints.length - 2));
      }
    } catch (error) {
      console.error("[CheckpointEditor] Error deleting checkpoint:", error);
      toast.error("Failed to delete checkpoint");
    }
    setShowDeleteCheckpointDialog(false);
  };

  const navigateCheckpoint = (direction: "prev" | "next") => {
    if (!threadData) return;
    const newIndex =
      direction === "prev"
        ? Math.max(0, selectedCheckpointIndex - 1)
        : Math.min(threadData.checkpoints.length - 1, selectedCheckpointIndex + 1);
    handleCheckpointSelect(newIndex);
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return "N/A";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const filteredThreads = threads.filter((thread) =>
    thread.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentCheckpoint = threadData?.checkpoints[selectedCheckpointIndex];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center gap-4 border-b bg-card px-4 shrink-0">
        <Database className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg">Checkpoint Editor</h1>
        <Badge variant="secondary" className="ml-2">
          {threads.length} Thread{threads.length !== 1 ? "s" : ""}
        </Badge>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={loadThreads} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Thread List */}
        <div className="w-80 flex flex-col border-r bg-card shrink-0">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => handleThreadSelect(thread.id)}
                className={`w-full rounded-lg p-3 text-left transition-colors mb-1 ${
                  selectedThreadId === thread.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate font-medium text-sm">{thread.id}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3 shrink-0" />
                    {thread.checkpointCount} checkpoints
                  </span>
                  {thread.lastUpdated && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatTimestamp(thread.lastUpdated)}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {filteredThreads.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Database className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No threads found</p>
              </div>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedThreadId && threadData ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-4 border-b bg-card p-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateCheckpoint("prev")}
                    disabled={selectedCheckpointIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[120px] text-center text-sm">
                    Checkpoint {selectedCheckpointIndex + 1} of {threadData.count}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateCheckpoint("next")}
                    disabled={selectedCheckpointIndex >= threadData.count - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {currentCheckpoint && (
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant="outline">
                      ID: {currentCheckpoint.checkpoint.id.slice(0, 8)}...
                    </Badge>
                    <span className="text-muted-foreground">
                      Step {currentCheckpoint.metadata.step}
                    </span>
                    <span className="text-muted-foreground">
                      {formatTimestamp(currentCheckpoint.checkpoint.ts)}
                    </span>
                  </div>
                )}

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                  {!isJsonValid && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Invalid JSON
                    </Badge>
                  )}

                  {hasChanges && (
                    <Badge variant="secondary" className="gap-1">
                      <FileJson className="h-3 w-3" />
                      Unsaved Changes
                    </Badge>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteCheckpointDialog(true)}
                    disabled={threadData.count <= 1}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteThreadDialog(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Thread
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || !isJsonValid || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              {/* Checkpoint Selector Tabs */}
              <div className="border-b bg-muted/50 px-4 py-2 shrink-0 overflow-x-auto">
                <div className="flex gap-1">
                  {threadData.checkpoints.map((cp, index) => (
                    <button
                      key={cp.checkpoint.id}
                      onClick={() => handleCheckpointSelect(index)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        selectedCheckpointIndex === index
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      #{index + 1}
                      <span className="ml-1 opacity-70">({cp.metadata.step})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-auto">
                <CodeMirror
                  value={editorContent}
                  height="100%"
                  extensions={extensions}
                  onChange={handleEditorChange}
                  theme={isDark ? "dark" : "light"}
                  className="h-full text-sm"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    defaultKeymap: true,
                    searchKeymap: true,
                    historyKeymap: true,
                    foldKeymap: true,
                    completionKeymap: true,
                    lintKeymap: true,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Database className="mb-4 h-16 w-16 opacity-20" />
              <p className="text-lg font-medium">Select a thread to view checkpoints</p>
              <p className="text-sm">Choose a thread from the sidebar to start editing</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Thread Dialog */}
      <AlertDialog open={showDeleteThreadDialog} onOpenChange={setShowDeleteThreadDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Thread
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the thread "{selectedThreadId}"? This will permanently
              delete all {threadData?.count || 0} checkpoints. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteThread}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Thread
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Checkpoint Dialog */}
      <AlertDialog open={showDeleteCheckpointDialog} onOpenChange={setShowDeleteCheckpointDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Checkpoint
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete checkpoint #{selectedCheckpointIndex + 1}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCheckpoint}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Checkpoint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes. Do you want to save them before continuing?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowUnsavedChangesDialog(false);
                setHasChanges(false);
                pendingAction?.();
                setPendingAction(null);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Discard
            </Button>
            <Button
              onClick={() => {
                setShowUnsavedChangesDialog(false);
                handleSave().then(() => {
                  pendingAction?.();
                  setPendingAction(null);
                });
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Save & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
