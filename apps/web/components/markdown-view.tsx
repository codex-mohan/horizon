"use client";

import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { LanguageDescription } from "@codemirror/language";
import { EditorView, lineNumbers } from "@codemirror/view";
import { langs } from "@uiw/codemirror-extensions-langs";
import { mermaid as mermaidLanguage } from "codemirror-lang-mermaid";
import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiCopy, FiDownload } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import SmartLink from "@/components/smart-link";
import { useTheme } from "@/components/theme/theme-provider";
import { createCodeMirrorTheme } from "@/lib/codemirror-theme";
import ZoomableImageWithLoader from "./image-with-loader";
import MermaidDiagram from "./mermaid-diagram";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

// We add KaTeX CSS at runtime to make preview work in this environment.
const ensureKatexCSS = () => {
  const id = "katex-css-link";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
};

// FIXED: Use direct language extensions instead of langs object
const getLanguageExtension = (lang: string) => {
  if (!lang) {
    return null;
  }

  const langKey = lang.toLowerCase();

  console.log("Language key:", langKey);
  // console.log("Found langNames:", langNames);

  try {
    switch (langKey) {
      case "cpp":
        return cpp();
      case "python":
      case "py":
        return python();
      case "javascript":
      case "js":
        return javascript({ jsx: true });
      case "typescript":
      case "ts":
        return langs.ts?.();
      case "tsx":
        return langs.tsx?.();
      case "html":
        return html();
      case "css":
        return javascript(); // CSS uses JavaScript extension as fallback
      case "json":
        return json();
      case "lua":
        return langs.lua?.();
      case "markdown":
      case "md":
        return markdown({
          base: markdownLanguage,
          codeLanguages: (info) => {
            switch (info) {
              case "javascript":
              case "js":
                return LanguageDescription.of({
                  name: "JavaScript",
                  support: javascript(),
                });
              case "python":
              case "py":
                return LanguageDescription.of({
                  name: "Python",
                  support: python(),
                });
              case "cpp":
                return LanguageDescription.of({
                  name: "C++",
                  support: cpp(),
                });
              case "html":
                return LanguageDescription.of({
                  name: "HTML",
                  support: html(),
                });
              case "css":
                return LanguageDescription.of({
                  name: "CSS",
                  support: javascript(),
                });
              case "json":
                return LanguageDescription.of({
                  name: "JSON",
                  support: json(),
                });
              case "mermaid":
                return LanguageDescription.of({
                  name: "Mermaid",
                  support: mermaidLanguage(),
                });
              case "sql":
                return LanguageDescription.of({
                  name: "SQL",
                  support: sql(),
                });
              default:
                return null;
            }
          },
        });
      case "sql":
        return sql();
      case "bash":
        return langs.bash?.();
      case "shell":
      case "sh":
        return langs.sh?.();
      case "zsh":
        return langs.sh?.(); // Zsh extension as fallback
      case "rust":
        return rust();
      case "go":
        return langs.go?.();
      case "yaml":
        return langs.yaml?.();
      case "text":
        return langs.markdown?.();
      default:
        return null;
    }
  } catch (error) {
    console.warn(`Failed to load language extension for ${langKey}:`, error);
    return null;
  }
};

// OPTIMIZATION: Memoize the CodeBlock component to prevent re-renders
const CodeBlock: React.FC<{ code: string; langHint?: string }> = React.memo(
  ({ code, langHint }) => {
    const [isCopied, setIsCopied] = useState(false);
    const { themeMode } = useTheme();

    const languageExtensions: { [key: string]: string } = {
      python: "py",
      js: "js",
      javascript: "js",
      ts: "ts",
      typescript: "ts",
      html: "html",
      css: "css",
      json: "json",
      cpp: "cpp",
      c: "c",
      java: "java",
      go: "go",
      rust: "rs",
      bash: "sh",
      shell: "sh",
      yaml: "yaml",
      sql: "sql",
      markdown: "md",
      php: "php",
      ruby: "rb",
      swift: "swift",
      kotlin: "kt",
      xml: "xml",
      jsonc: "jsonc",
      jsx: "jsx",
      tsx: "tsx",
      vue: "vue",
      svelte: "svelte",
      graphql: "graphql",
      dockerfile: "dockerfile",
      diff: "diff",
      git: "git",
      ini: "ini",
      perl: "pl",
      r: "r",
      scss: "scss",
      less: "less",
      lua: "lua",
      makefile: "makefile",
      powershell: "ps1",
      pug: "pug",
      razor: "cshtml",
      sass: "sass",
      solidity: "sol",
      stylus: "styl",
      toml: "toml",
      vb: "vb",
      zig: "zig",
    };

    const languageExt = useMemo(() => {
      const ext = getLanguageExtension(langHint || "");
      if (langHint && !ext) {
        console.warn(`Language extension not found for: ${langHint}`);
      }
      return ext;
    }, [langHint]);

    const cmTheme = useMemo(
      () => createCodeMirrorTheme(themeMode === "dark", false),
      [themeMode]
    );

    const extensions = useMemo(() => {
      const base = [
        lineNumbers(),
        EditorView.editable.of(false),
        EditorView.lineWrapping,
      ];

      if (languageExt) {
        return [...base, languageExt];
      }
      return base;
    }, [languageExt]);

    const handleCopy = () => {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    };

    const handleDownload = () => {
      const extension =
        languageExtensions[langHint?.toLowerCase() || ""] || "txt";
      const filename = `code.${extension}`;
      const blob = new Blob([code], {
        type: `text/${extension};charset=utf-8;`,
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    };

    return (
      <div className="mt-1 overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between bg-muted/50 px-4 py-1.5 text-xs">
          <span className="font-semibold text-muted-foreground uppercase">
            {langHint || "code"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted"
              onClick={handleDownload}
              title="Download code"
            >
              <FiDownload size={14} />
              Download
            </button>
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted"
              onClick={handleCopy}
              title="Copy code"
            >
              {isCopied ? (
                <>
                  <FiCheck size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <FiCopy size={14} />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        <div
          className="font-mono"
          style={{
            fontFamily:
              "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace",
          }}
        >
          <CodeMirror
            basicSetup={{
              foldGutter: true,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              dropCursor: false,
            }}
            className="font-mono"
            editable={false}
            extensions={extensions}
            height="auto"
            style={{
              fontFamily:
                "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace",
            }}
            theme={cmTheme}
            value={code.replace(/\n$/, "")}
          />
        </div>
      </div>
    );
  }
);
CodeBlock.displayName = "CodeBlock";

export { CodeBlock };

// Helper function to extract a YouTube video ID from various URL formats
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) {
    return null;
  }
  const regex =
    /(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match: any = url.match(regex);
  return match ? match[1] : null;
};

// MAIN FIX: Wrap MarkdownView in React.memo to prevent re-renders when parent state changes.
const MarkdownView: React.FC<{ text: string }> = React.memo(({ text }) => {
  useEffect(() => ensureKatexCSS(), []);

  // OPTIMIZATION: Memoize the components object so it's not recreated on every render.
  const components = useMemo(
    () => ({
      // ✅ THIS IS THE CORRECTED LOGIC
      code({ inline, className, children, ...props }: any) {
        const raw = String(children);
        const match = /language-([\w-]+)/.exec(className || "");
        const lang = match?.[1];

        // Distinguish between inline and block code
        const isBlock = raw.includes("\n") || lang;

        if (isBlock) {
          // Handle special languages like Mermaid
          if (lang === "mermaid") {
            return <MermaidDiagram code={raw} />;
          }
          // Render all other blocks (with or without a language) using CodeBlock.
          return <CodeBlock code={raw} langHint={lang} />;
        }

        // Handle inline code
        return (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
            {children}
          </code>
        );
      },
      p: ({ children }: any) => (
        <span className="mt-3 mb-3 block wrap-break-word font-body text-[1.0625rem] text-foreground/90 leading-relaxed last:mb-0">
          {children}
        </span>
      ),
      h1: ({ children }: any) => (
        <h1 className="mt-4 mb-2 font-bold font-display text-foreground/90 text-xl tracking-tight">
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="mt-4 mb-2 font-bold font-display text-foreground/90 text-lg tracking-tight">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="mt-3 mb-2 font-bold font-display text-foreground/90 text-base tracking-tight">
          {children}
        </h3>
      ),
      ul: (props: any) => (
        <ul
          className="[&_span]:m-0! [&_span]:inline! my-3 list-disc pl-5 text-[1.0625rem] [&>li]:mt-1.5"
          {...props}
        />
      ),
      ol: (props: any) => (
        <ol
          className="[&_span]:m-0! [&_span]:inline! my-3 list-decimal pl-5 text-[1.0625rem] [&>li]:mt-1.5"
          {...props}
        />
      ),
      li: (props: any) => <li className="pl-1 leading-relaxed" {...props} />,
      blockquote: (props: any) => (
        <blockquote
          className="mt-3 border-primary/30 border-l-2 pl-3 font-accent text-foreground/80 text-sm italic"
          {...props}
        />
      ),
      table: ({ children, ...props }: any) => {
        const [showDownload, setShowDownload] = useState(false);
        const tableRef = React.useRef<HTMLTableElement>(null);

        const downloadCSV = () => {
          try {
            if (!tableRef.current) {
              return;
            }

            const rows = Array.from(tableRef.current.querySelectorAll("tr"));
            const tableData = rows.map((row) =>
              Array.from(row.querySelectorAll("th, td")).map((cell) =>
                (cell.textContent || "").trim().replace(/"/g, '""')
              )
            );

            if (tableData.length === 0) {
              return;
            }

            const csvContent = tableData
              .map((row) => row.map((cell) => `"${cell}"`).join(","))
              .join("\n");

            const blob = new Blob([csvContent], {
              type: "text/csv;charset=utf-8;",
            });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "table-data.csv");
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } catch (error) {
            console.error("Error downloading CSV:", error);
          }
        };

        return (
          <div
            className="my-2 w-full rounded-lg border"
            onMouseEnter={() => setShowDownload(true)}
            onMouseLeave={() => setShowDownload(false)}
          >
            <div className="relative">
              {showDownload && (
                <button
                  className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                  onClick={downloadCSV}
                  title="Download as CSV"
                >
                  <FiDownload size={12} />
                  CSV
                </button>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-base" ref={tableRef} {...props}>
                  {children}
                </table>
              </div>
            </div>
          </div>
        );
      },
      thead: (props: any) => <thead className="bg-muted" {...props} />,
      tr: (props: any) => (
        <tr className="m-0 p-0 odd:bg-muted/30 even:bg-muted/60" {...props} />
      ),
      th: (props: any) => (
        <th className="px-4 py-2 text-left font-bold" {...props} />
      ),
      td: (props: any) => <td className="px-4 py-2 text-left" {...props} />,
      a: ({ node, href, children, ...props }: any) => {
        const videoId = href ? getYouTubeVideoId(href) : null;

        // If it's a YouTube link, render an embed
        if (videoId) {
          return (
            <div className="my-4 aspect-video overflow-hidden rounded-lg border border-border bg-black">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                frameBorder="0"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
              />
            </div>
          );
        }

        // Otherwise, render a standard link with an icon and tooltip
        return <SmartLink href={href || ""}>{children}</SmartLink>;
      },

      // UPDATED: Custom renderer for images now uses the zoomable component
      img: ({ node, src, alt, ...props }: any) => {
        const videoId = src ? getYouTubeVideoId(src) : null;

        // Also check if an image tag is being used to embed a YouTube video
        if (videoId) {
          return (
            <div className="my-2 aspect-video overflow-hidden rounded-lg border border-border bg-black">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                frameBorder="0"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
              />
            </div>
          );
        }

        return (
          <ZoomableImageWithLoader
            alt={alt}
            className="my-2 aspect-video w-full max-w-xl rounded-lg"
            // Add sizing and margin classes for the thumbnail display and align center
            src={src}
            {...props}
          />
        );
      },
    }),
    []
  ); // Empty dependency array means this object is created only once

  return (
    <ReactMarkdown
      components={components}
      rehypePlugins={[rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkMath]}
    >
      {text}
    </ReactMarkdown>
  );
});
MarkdownView.displayName = "MarkdownView"; // Good practice for debugging

export default MarkdownView;
