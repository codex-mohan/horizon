import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import mermaid from "mermaid";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "../utils.js";
import { createCodeMirrorTheme } from "../lib/codemirror-theme.js";
import { useTheme } from "../theme.jsx";

const CodeMirror = lazy(() => import("@uiw/react-codemirror"));

const mermaidKeywords = [
  "graph", "flowchart", "sequencediagram", "classdiagram",
  "statediagram", "erdiagram", "pie", "gantt", "gitgraph",
  "journey", "mindmap", "requirement", "zenuml", "C4Context",
];

const isValidMermaidContent = (code: string): boolean => {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return false;

  const hasKeyword = mermaidKeywords.some(
    (kw) => trimmed.startsWith(kw) || trimmed.includes(`${kw} `)
  );
  if (!hasKeyword) return false;

  const hasArrowOrColon = trimmed.includes("-->") || trimmed.includes("---") || trimmed.includes("==>");
  return hasArrowOrColon || /^\w+[[(]/.test(trimmed) || /^\s*[[(]/.test(trimmed);
};

interface MermaidDiagramProps {
  code: string;
  isStreaming?: boolean;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = React.memo(({ code, isStreaming: isStreamingProp = false }) => {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRenderedCodeRef = useRef<string>("");
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    if (isStreamingProp) {
      setSvg(null);
      setRenderError(null);
      setIsRendering(false);
      setIsStreaming(false);
      lastRenderedCodeRef.current = "";
      return;
    }

    const currentCode = code;

    if (!currentCode.trim()) {
      setSvg(null);
      setRenderError(null);
      setIsStreaming(false);
      return;
    }

    if (currentCode.length < 10) {
      setIsStreaming(true);
      setRenderError(null);
      setSvg(null);
      return;
    }

    if (!isValidMermaidContent(currentCode)) {
      setIsStreaming(true);
      setRenderError(null);
      setSvg(null);
      return;
    }

    if (currentCode === lastRenderedCodeRef.current && !renderError) {
      return;
    }

    setIsStreaming(false);
    setIsRendering(true);
    setRenderError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          suppressErrorRendering: true,
          theme: theme === "dark" ? "dark" : "default",
          fontFamily: "inherit",
        });

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-graph-${Date.now()}`,
          currentCode
        );
        lastRenderedCodeRef.current = currentCode;
        setSvg(renderedSvg);
      } catch (e) {
        if (codeRef.current !== currentCode) {
          setIsRendering(false);
          return;
        }

        const isIncompleteSyntax =
          e instanceof Error &&
          (e.message.includes("Unexpected token") ||
            e.message.includes("Parse error") ||
            e.message.includes("Syntax error") ||
            e.message.includes("mismatched") ||
            e.message.includes("expected"));

        if (isIncompleteSyntax) {
          setIsStreaming(true);
          setRenderError(null);
        } else {
          const message = e instanceof Error
            ? e.message.replace(/[\r\n]+/g, " ").replace(/(.{80})/g, "$1\n")
            : "An unknown error occurred.";
          setRenderError(message);
        }
        setSvg(null);
      } finally {
        setIsRendering(false);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [code, theme, renderError, isStreamingProp]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [code]);

  const handleDownloadSVG = useCallback(() => {
    if (svg) {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "diagram.svg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [svg]);

  const handleReRender = () => {
    lastRenderedCodeRef.current = "";
    setRenderError(null);
    setSvg(null);
    setIsRendering(true);

    setTimeout(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          suppressErrorRendering: true,
          theme: theme === "dark" ? "dark" : "default",
          fontFamily: "inherit",
        });

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-graph-${Date.now()}`,
          code
        );
        lastRenderedCodeRef.current = code;
        setSvg(renderedSvg);
      } catch (e) {
        const message = e instanceof Error
          ? e.message.replace(/[\r\n]+/g, " ").replace(/(.{80})/g, "$1\n")
          : "An unknown error occurred.";
        setRenderError(message);
      } finally {
        setIsRendering(false);
      }
    }, 100);
  };

  const hasContent = code.trim().length > 0;

  if (isStreamingProp) {
    return (
      <div className="my-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="relative flex w-full items-center justify-center p-4" style={{ minHeight: 150 }}>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span className="animate-pulse font-mono text-sm">Generating diagram...</span>
            </div>
            <div className="h-2 w-48 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-2 w-32 animate-pulse bg-[var(--bg-elevated)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="relative flex w-full justify-center p-4">
        <TransformWrapper>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute top-2 right-2 z-10 flex items-center gap-0 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-lg">
                <button className="rounded-none p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" onClick={() => zoomIn()}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>
                </button>
                <button className="rounded-none p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" onClick={() => zoomOut()}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6" /></svg>
                </button>
                <button className="rounded-none p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" onClick={() => resetTransform()}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9" /><path d="M12 3v6h6" /></svg>
                </button>
                <div className="mx-1 h-5 w-px bg-[var(--border-subtle)]" />
                <button className="rounded-none p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" disabled={!svg} onClick={handleDownloadSVG}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                </button>
                <div className="mx-1 h-5 w-px bg-[var(--border-subtle)]" />
                <button className="rounded-none p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" disabled={isRendering} onClick={handleReRender}>
                  <svg className={cn("h-4 w-4", isRendering && "animate-spin")} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                </button>
                <div className="mx-1 h-5 w-px bg-[var(--border-subtle)]" />
                <button className="rounded-none p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" onClick={handleCopyCode}>
                  {isCopied
                    ? <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    : <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
                </button>
                <button className="rounded-none p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" onClick={() => setShowCode(!showCode)}>
                  {showCode
                    ? <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" x2="23" y1="1" y2="23" /></svg>
                    : <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>}
                </button>
              </div>

              <TransformComponent
                contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}
                wrapperStyle={{ width: "100%", height: "100%", minHeight: 150 }}
              >
                <div className="flex flex-col items-center justify-center p-4">
                  {isRendering && (
                    <div className="animate-pulse text-[var(--text-muted)]">Rendering diagram...</div>
                  )}
                  {renderError && !isRendering && (
                    <div className="p-4 text-center text-red-500">
                      <div className="mb-2 font-semibold">Rendering Error</div>
                      <div className="font-mono text-sm" style={{ wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap", maxWidth: "100%" }}>{renderError}</div>
                      <button className="mt-2 bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600" onClick={handleReRender}>Try Again</button>
                    </div>
                  )}
                  {!(isRendering || renderError) && svg && (
                    <div className="mermaid-svg-container" style={{ maxWidth: "100%" }} dangerouslySetInnerHTML={{ __html: svg }} />
                  )}
                  {isStreaming && hasContent && !svg && !renderError && (
                    <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                      <div className="animate-pulse">Waiting for complete diagram...</div>
                    </div>
                  )}
                  {!isStreaming && !(isRendering || renderError || svg) && hasContent && (
                    <div className="text-[var(--text-muted)]">Preparing diagram...</div>
                  )}
                  {!hasContent && (
                    <div className="text-[var(--text-muted)]/70 text-sm">No diagram code provided.</div>
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      {showCode && (
        <div className="border-t border-[var(--border-subtle)]">
          <Suspense fallback={<div className="p-4 text-[var(--text-muted)]">Loading editor...</div>}>
            <CodeMirror
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, dropCursor: false }}
              editable={false}
              height="auto"
              theme={createCodeMirrorTheme(theme === "dark")}
              value={code.replace(/\n$/, "")}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
});

MermaidDiagram.displayName = "MermaidDiagram";
