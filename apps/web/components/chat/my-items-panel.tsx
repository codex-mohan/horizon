"use client";

import { Button } from "@horizon/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@horizon/ui/components/dropdown-menu";
import { ScrollArea } from "@horizon/ui/components/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@horizon/ui/components/tabs";
import { cn } from "@horizon/ui/lib/utils";
import {
  Code,
  Component,
  FileText,
  GitBranch,
  Globe,
  Grid3x3,
  Image,
  Inbox,
  List,
  SortAsc,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useArtifactsStore } from "@/lib/stores/artifacts";
import { useConversationStore } from "@/lib/stores/conversation";
import type { ArtifactType } from "@/lib/types/artifact";
import { ARTIFACT_TYPE_META } from "@/lib/types/artifact";

/**
 * MyItemsPanel - Panel for managing user's uploaded and generated items
 *
 * Features:
 * - Toggle between grid and list view
 * - Sort by name or date
 * - Separate tabs for uploaded and generated items
 * - Generated tab now shows real artifacts from the Zustand store
 */

const TYPE_ICONS: Record<ArtifactType, typeof Globe> = {
  html: Globe,
  svg: Image,
  mermaid: GitBranch,
  code: Code,
  react: Component,
  markdown: FileText,
};

export function MyItemsPanel() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "date">("date");

  const { artifactsByThread, setActiveArtifact, openPanel } = useArtifactsStore();
  const { currentThreadId } = useConversationStore();

  // Get all artifacts — optionally filter by current thread
  const allArtifacts = useMemo(() => {
    const artifacts = Object.values(artifactsByThread).flat();
    return artifacts.sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [artifactsByThread, sortBy]);

  // Artifacts for the current thread only
  const threadArtifacts = useMemo(() => {
    if (!currentThreadId) return [];
    const artifacts = artifactsByThread[currentThreadId] || [];
    return artifacts.sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [artifactsByThread, currentThreadId, sortBy]);

  const handleArtifactClick = (artifactId: string) => {
    setActiveArtifact(artifactId);
    openPanel(artifactId);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-border border-b p-4">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="transition-transform duration-200 hover:scale-110"
                size="icon-sm"
                variant="ghost"
              >
                {viewMode === "grid" ? <Grid3x3 className="size-4" /> : <List className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="animate-scale-in">
              <DropdownMenuItem onClick={() => setViewMode("grid")}>
                <Grid3x3 className="mr-2 size-4" />
                Grid View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode("list")}>
                <List className="mr-2 size-4" />
                List View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="transition-transform duration-200 hover:scale-110"
                size="icon-sm"
                variant="ghost"
              >
                <SortAsc className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="animate-scale-in">
              <DropdownMenuItem onClick={() => setSortBy("name")}>Sort by Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("date")}>Sort by Date</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs className="flex flex-1 flex-col" defaultValue="current">
        <TabsList className="w-full justify-start rounded-none border-border border-b bg-transparent px-4">
          <TabsTrigger value="current">This Chat</TabsTrigger>
          <TabsTrigger value="all">All Artifacts</TabsTrigger>
        </TabsList>

        {/* Current thread artifacts */}
        <TabsContent className="mt-0 flex-1" value="current">
          <ScrollArea className="h-full">
            {threadArtifacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <Inbox className="size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No artifacts yet</p>
                <p className="text-muted-foreground/70 text-xs">
                  Ask the AI to create code, diagrams, or pages
                </p>
              </div>
            ) : (
              <div
                className={cn("p-4", viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2")}
              >
                {threadArtifacts.map((artifact) => {
                  const meta = ARTIFACT_TYPE_META[artifact.type];
                  const Icon = TYPE_ICONS[artifact.type];

                  return (
                    <button
                      className={cn(
                        "glass hover-lift stagger-item cursor-pointer overflow-hidden rounded-lg text-left transition-all duration-200 hover:bg-primary/20",
                        viewMode === "grid"
                          ? "hover-glow flex aspect-square flex-col items-center justify-center gap-2 p-3"
                          : "flex items-center gap-3 p-3 w-full"
                      )}
                      key={artifact.id}
                      onClick={() => handleArtifactClick(artifact.id)}
                      type="button"
                    >
                      {viewMode === "grid" ? (
                        <>
                          <Icon className={cn("size-8", meta.color)} />
                          <div className="w-full truncate text-center font-medium text-xs">
                            {artifact.title}
                          </div>
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]">
                            {meta.label}
                          </span>
                        </>
                      ) : (
                        <>
                          <Icon className={cn("size-5 shrink-0", meta.color)} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-sm">{artifact.title}</div>
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <span>{meta.label}</span>
                              {artifact.version > 1 && <span>• v{artifact.version}</span>}
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* All artifacts across threads */}
        <TabsContent className="mt-0 flex-1" value="all">
          <ScrollArea className="h-full">
            {allArtifacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <Inbox className="size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No artifacts yet</p>
                <p className="text-muted-foreground/70 text-xs">
                  Artifacts from all conversations will appear here
                </p>
              </div>
            ) : (
              <div
                className={cn("p-4", viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2")}
              >
                {allArtifacts.map((artifact) => {
                  const meta = ARTIFACT_TYPE_META[artifact.type];
                  const Icon = TYPE_ICONS[artifact.type];

                  return (
                    <button
                      className={cn(
                        "glass hover-lift stagger-item cursor-pointer overflow-hidden rounded-lg text-left transition-all duration-200 hover:bg-primary/20",
                        viewMode === "grid"
                          ? "hover-glow flex aspect-square flex-col items-center justify-center gap-2 p-3"
                          : "flex items-center gap-3 p-3 w-full"
                      )}
                      key={artifact.id}
                      onClick={() => handleArtifactClick(artifact.id)}
                      type="button"
                    >
                      {viewMode === "grid" ? (
                        <>
                          <Icon className={cn("size-8", meta.color)} />
                          <div className="w-full truncate text-center font-medium text-xs">
                            {artifact.title}
                          </div>
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]">
                            {meta.label}
                          </span>
                        </>
                      ) : (
                        <>
                          <Icon className={cn("size-5 shrink-0", meta.color)} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-sm">{artifact.title}</div>
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <span>{meta.label}</span>
                              {artifact.version > 1 && <span>• v{artifact.version}</span>}
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
