"use client";

import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, lineNumbers } from "@codemirror/view";
import { tokyoNight } from "@uiw/codemirror-themes-all";
import { mermaid as mermaidLanguage } from "codemirror-lang-mermaid";
import {
  Check,
  Code2,
  Copy,
  Download,
  EyeOff,
  RefreshCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import mermaid from "mermaid";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

const useCodeMirrorExtensions = () => {
  return useMemo(
    () => [
      lineNumbers(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      mermaidLanguage(),
    ],
    []
  );
};

const MERMAID_KEYWORDS = [
  "graph",
  "flowchart",
  "sequencediagram",
  "classdiagram",
  "statediagram",
  "erdiagram",
  "pie",
  "gantt",
  "gitgraph",
  "journey",
  "mindmap",
  "requirement",
  "zenuml",
  "C4Context",
];

const isValidMermaidContent = (code: string): boolean => {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return false;

  const hasKeyword = MERMAID_KEYWORDS.some(
    (kw) => trimmed.startsWith(kw) || trimmed.includes(`${kw} `)
  );
  if (!hasKeyword) return false;

  const hasArrowOrColon =
    trimmed.includes("-->") || trimmed.includes("---") || trimmed.includes("==>");
  const hasNodeDefinition = /^\w+[[(]/.test(trimmed) || /^\s*[[(]/.test(trimmed);

  return hasArrowOrColon || hasNodeDefinition;
};

const DEBOUNCE_DELAY = 400;
const MIN_LENGTH_FOR_VALIDATION = 10;

const MermaidDiagram: React.FC<{ code: string }> = React.memo(({ code }) => {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [_retryId, setRetryId] = useState(0);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRenderedCodeRef = useRef<string>("");
  const codeRef = useRef(code);
  codeRef.current = code;

  const codeMirrorExtensions = useCodeMirrorExtensions();

  useEffect(() => {
    // We intentionally don't include 'code' in the dependency array because we use
    // lastRenderedCodeRef to skip re-rendering the same content. The effect still
    // runs when code changes because it's passed as a parameter to this effect.
    const currentCode = code;

    if (!currentCode.trim()) {
      setSvg(null);
      setRenderError(null);
      setIsStreaming(false);
      return;
    }

    if (currentCode.length < MIN_LENGTH_FOR_VALIDATION) {
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
          `mermaid-graph-${Date.now()}`.toString(),
          currentCode
        );
        lastRenderedCodeRef.current = currentCode;
        setSvg(renderedSvg);
      } catch (e) {
        const currentLatestCode = codeRef.current;
        if (currentLatestCode !== currentCode) {
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
          console.error("Mermaid rendering failed:", e);
          let message = e instanceof Error ? e.message : "An unknown error occurred.";
          message = message.replace(/[\r\n]+/g, " ").replace(/(.{80})/g, "$1\n");
          setRenderError(message);
        }
        setSvg(null);
      } finally {
        setIsRendering(false);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [code, theme, renderError]);

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
    setRetryId((prev) => prev + 1);
  };

  const hasContent = code.trim().length > 0;

  return (
    <div className="mermaid-container my-4 rounded-lg border bg-muted/30">
      <style global jsx>{`
        .mermaid-svg-container svg {
          max-width: 100%; /* Ensure SVG respects parent width */
          height: auto;
        }
        /* Specific styles for error messages to ensure they wrap */
        .mermaid-error-message {
          word-break: break-word; /* Allows breaking within words */
          overflow-wrap: break-word; /* Better for long strings */
          white-space: pre-wrap; /* Preserves newlines from processing */
          max-width: 100%; /* Explicitly set max-width */
        }
      `}</style>

      <div className="relative flex w-full justify-center p-4">
        <TransformWrapper>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Controls Toolbar (unchanged) */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-lg border bg-background/80 p-1.5 shadow-md">
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  onClick={() => zoomIn()}
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  onClick={() => zoomOut()}
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  onClick={() => resetTransform()}
                  title="Reset Zoom"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  disabled={!svg}
                  onClick={handleDownloadSVG}
                  title="Download as SVG"
                >
                  <Download size={16} />
                </button>
                <div className="mx-1 h-5 w-px bg-border" />
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  disabled={isRendering}
                  onClick={handleReRender}
                  title="Re-render Diagram"
                >
                  <RefreshCw className={isRendering ? "animate-spin" : ""} size={16} />
                </button>
                <div className="mx-1 h-5 w-px bg-border" />
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  onClick={handleCopyCode}
                  title="Copy Mermaid Code"
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  onClick={() => setShowCode(!showCode)}
                  title={showCode ? "Hide Code" : "Show Code"}
                >
                  {showCode ? <EyeOff size={16} /> : <Code2 size={16} />}
                </button>
              </div>

              <TransformComponent
                contentStyle={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                }}
                wrapperStyle={{ width: "100%", height: "100%", minHeight: 150 }}
              >
                <div className="flex flex-col items-center justify-center p-4">
                  {isRendering && (
                    <div className="animate-pulse text-muted-foreground">Rendering diagram...</div>
                  )}
                  {renderError && !isRendering && (
                    <div className="p-4 text-center text-red-500">
                      <div className="mb-2 font-semibold">Rendering Error</div>
                      <div className="mermaid-error-message font-mono text-sm">{renderError}</div>{" "}
                      {/* Added mermaid-error-message class */}
                      <button
                        className="mt-2 rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                        onClick={handleReRender}
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                  {!(isRendering || renderError) && svg && (
                    <div
                      className="mermaid-svg-container"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  )}
                  {isStreaming && hasContent && !svg && !renderError && (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="animate-pulse">Waiting for complete diagram...</div>
                    </div>
                  )}
                  {!isStreaming && !(isRendering || renderError || svg) && hasContent && (
                    <div className="text-muted-foreground">Preparing diagram...</div>
                  )}
                  {!hasContent && (
                    <div className="text-muted-foreground/70 text-sm">
                      No diagram code provided.
                    </div>
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      {showCode && (
        <div className="border-t">
          <CodeMirror
            editable={false}
            extensions={codeMirrorExtensions}
            height="auto"
            theme={[
              tokyoNight,
              EditorView.theme(
                {
                  "&": {
                    fontSize: "0.875rem",
                    backgroundColor: "hsl(var(--muted)/0.5)",
                  },
                  ".cm-editor": { borderRadius: "0" },
                  ".cm-scroller": {
                    padding: "0.5rem 0",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                  },
                  ".cm-gutters": {
                    backgroundColor: "hsl(var(--muted))",
                    borderRight: "1px solid hsl(var(--border))",
                  },
                },
                { dark: theme === "dark" }
              ),
            ]}
            value={code.replace(/\n$/, "")}
          />
        </div>
      )}
    </div>
  );
});

MermaidDiagram.displayName = "MermaidDiagram";

export default MermaidDiagram;
