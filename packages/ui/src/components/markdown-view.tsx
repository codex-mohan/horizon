import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { languages } from "@codemirror/language-data";
import { EditorView, lineNumbers } from "@codemirror/view";
import { langs, loadLanguage } from "@uiw/codemirror-extensions-langs";
import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { ExtraProps } from "react-markdown";
import type { Components } from "react-markdown";
import { cn } from "../utils.js";
import { createCodeMirrorTheme } from "../lib/codemirror-theme.js";
import { useTheme } from "../theme.jsx";
import { SmartLink } from "./smart-link.js";
import { ZoomableImageWithLoader } from "./image-with-loader.js";
import { MermaidDiagram } from "./mermaid-diagram.js";

const CodeMirror = lazy(() => import("@uiw/react-codemirror"));

interface CodeBlockProps {
  code: string;
  langHint?: string;
}

const languageExtensions: Record<string, string> = {
  python: "py", py: "py", js: "js", javascript: "js", ts: "ts", typescript: "ts",
  html: "html", htm: "html", css: "css", json: "json", jsonc: "jsonc", json5: "json5",
  cpp: "cpp", c: "c", csharp: "cs", c_harp: "cs", java: "java",
  go: "go", golang: "go", rust: "rs", rs: "rs",
  bash: "sh", sh: "sh", shell: "sh", zsh: "sh", powershell: "ps1", ps1: "ps1",
  yaml: "yaml", yml: "yaml", toml: "toml", ini: "ini", dotenv: "env", env: "env",
  sql: "sql", pgsql: "pgsql", mysql: "mysql", sqlite: "sqlite",
  markdown: "md", md: "md", rmd: "rmd", mdx: "mdx",
  php: "php", ruby: "rb", rb: "rb", swift: "swift", kotlin: "kt", kt: "kt",
  scala: "scala", scala3: "scala",
  dart: "dart", elixir: "ex", exs: "exs", erlang: "erl", hrl: "hrl",
  clojure: "clj", cljs: "cljs", edn: "edn",
  groovy: "groovy", gvy: "gvy", gradle: "gradle",
  perl: "pl", pl: "pl", pm: "pm", raku: "raku",
  haskell: "hs", lhs: "lhs", lua: "lua",
  xml: "xml", xsd: "xsd", xsl: "xsl", svg: "svg",
  vue: "vue", svelte: "svelte", angular: "angular",
  graphql: "graphql", gql: "gql",
  dockerfile: "dockerfile", docker: "dockerfile", makefile: "makefile", make: "makefile",
  diff: "diff", patch: "diff",
  git: "git", gitignore: "gitignore", gitattributes: "gitattributes",
  solidity: "sol", sol: "sol", vyper: "vy",
  scss: "scss", sass: "sass", less: "less", stylus: "styl", styl: "styl",
  pug: "pug", jade: "pug", haml: "haml", slim: "slim",
  razor: "cshtml", cshtml: "cshtml",
  vb: "vb", vba: "vba", vbscript: "vbs",
  zig: "zig", zion: "zig",
  nix: "nix", wast: "wast", wasm: "wast",
  julia: "jl", jl: "jl", r: "r", rscript: "r",
  fortran: "f90", f90: "f90", f95: "f95",
  coq: "coq", agda: "agda", idris: "idris",
  terraform: "tf", tf: "tf", hcl: "hcl",
  promql: "promql",
  protobuf: "proto", proto: "proto",
  csv: "csv", tsv: "tsv",
};

const langMap = langs as Record<string, (() => any) | undefined>;

const getLanguageExtension = (lang: string) => {
  if (!lang) return null;

  const langKey = lang.toLowerCase();

  try {
    switch (langKey) {
      case "cpp": return cpp();
      case "python":
      case "py": return python();
      case "javascript":
      case "js": return javascript({ jsx: true });
      case "typescript":
      case "ts": return langMap.ts?.();
      case "tsx": return langMap.tsx?.();
      case "jsx": return langMap.jsx?.();
      case "html":
      case "htm": return html();
      case "css": return javascript();
      case "json": return json();
      case "jsonc":
      case "json5": return langMap.jsonc?.() ?? json();
      case "markdown":
      case "md":
      case "rmd":
      case "mdx": return markdown({ base: markdownLanguage, codeLanguages: languages });
      case "sql":
      case "pgsql":
      case "mysql":
      case "sqlite": return sql();
      case "bash":
      case "sh":
      case "shell":
      case "zsh": return langMap.sh?.();
      case "powershell":
      case "ps1": return langMap.powershell?.();
      case "rust":
      case "rs": return rust();
      case "go":
      case "golang": return langMap.go?.();
      case "yaml":
      case "yml": return langMap.yaml?.();
      case "toml": return langMap.toml?.();
      case "lua": return langMap.lua?.();
      case "svg": return html();
      case "text": return null;
      case "php": return langMap.php?.();
      case "ruby":
      case "rb": return langMap.ruby?.();
      case "swift": return langMap.swift?.();
      case "kotlin":
      case "kt": return langMap.kotlin?.();
      case "scala": return langMap.scala?.();
      case "dart": return langMap.dart?.();
      case "elixir":
      case "ex":
      case "exs": return langMap.elixir?.();
      case "erlang":
      case "erl":
      case "hrl": return langMap.erlang?.();
      case "clojure":
      case "clj":
      case "cljs":
      case "edn": return langMap.clojure?.();
      case "groovy":
      case "gvy":
      case "gradle": return langMap.groovy?.();
      case "perl":
      case "pl":
      case "pm": return langMap.perl?.();
      case "haskell":
      case "hs":
      case "lhs": return langMap.haskell?.();
      case "vue": return langMap.vue?.();
      case "svelte": return langMap.svelte?.();
      case "graphql":
      case "gql": return langMap.graphql?.();
      case "dockerfile":
      case "docker": return langMap.dockerfile?.();
      case "makefile":
      case "make": return (loadLanguage as any)("makefile");
      case "diff":
      case "patch": return langMap.diff?.();
      case "solidity":
      case "sol": return langMap.solidity?.();
      case "scss": return langMap.scss?.();
      case "sass": return langMap.sass?.();
      case "less": return langMap.less?.();
      case "stylus":
      case "styl": return langMap.stylus?.();
      case "pug": return langMap.pug?.();
      case "razor":
      case "cshtml": return langMap.razor?.();
      case "vb": return langMap.vb?.();
      case "zig": return langMap.zig?.();
      case "nix": return langMap.nix?.();
      case "wast":
      case "wasm": return langMap.wast?.();
      case "julia":
      case "jl": return langMap.julia?.();
      case "r":
      case "rscript": return langMap.r?.();
      case "fortran":
      case "f90":
      case "f95": return langMap.fortran?.();
      case "coq": return langMap.coq?.();
      case "terraform":
      case "tf":
      case "hcl": return langMap.terraform?.();
      case "protobuf":
      case "proto": return langMap.protobuf?.();
      case "csharp":
      case "c#":
      case "cs": return langMap.csharp?.();
      case "java": return langMap.java?.();
      default: {
        const loaded = (loadLanguage as any)(langKey);
        if (loaded) return loaded;
        return null;
      }
    }
  } catch {
    return null;
  }
};

const CodeBlock: React.FC<CodeBlockProps> = React.memo(({ code, langHint }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { theme } = useTheme();

  const languageExt = useMemo(() => getLanguageExtension(langHint || ""), [langHint]);

  const cmTheme = useMemo(() => createCodeMirrorTheme(theme === "dark"), [theme]);

  const extensions = useMemo(() => {
    const base = [lineNumbers(), EditorView.editable.of(false), EditorView.lineWrapping];
    return languageExt ? [...base, languageExt] : base;
  }, [languageExt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const extension = languageExtensions[langHint?.toLowerCase() || ""] || "txt";
    const filename = `code.${extension}`;
    const blob = new Blob([code], { type: `text/${extension}; charset=utf-8` });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mt-1 overflow-hidden border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs">
        <span className="font-semibold text-[var(--text-muted)] uppercase font-sora">{langHint || "code"}</span>
        <div className="flex items-center gap-1.5">
          <button
            className="flex items-center gap-1.5 px-2 py-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
            onClick={handleDownload}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Download
          </button>
          <button
            className="flex items-center gap-1.5 px-2 py-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
            onClick={handleCopy}
          >
            {isCopied ? (
              <><svg className="h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>Copied!</>
            ) : (
              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy</>
            )}
          </button>
        </div>
      </div>
      <div className="font-mono">
        <Suspense fallback={<div className="p-4 text-[var(--text-muted)] text-sm">Loading editor...</div>}>
          <CodeMirror
            basicSetup={{ foldGutter: true, highlightActiveLine: false, highlightActiveLineGutter: false, dropCursor: false }}
            editable={false}
            extensions={extensions}
            height="auto"
            theme={cmTheme}
            value={code.replace(/\n$/, "")}
          />
        </Suspense>
      </div>
    </div>
  );
});
CodeBlock.displayName = "CodeBlock";

export { CodeBlock };

const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match?.[1] ?? null;
};

const MarkdownTable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showDownload, setShowDownload] = useState(false);
  const tableRef = React.useRef<HTMLTableElement>(null);

  const downloadCSV = () => {
    try {
      if (!tableRef.current) return;

      const rows = Array.from(tableRef.current.querySelectorAll("tr"));
      const tableData = rows.map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) =>
          (cell.textContent || "").trim().replace(/"/g, '""')
        )
      );

      if (tableData.length === 0) return;

      const csvContent = tableData
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
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
      className="my-2 w-full border border-[var(--border-subtle)]"
      onMouseEnter={() => setShowDownload(true)}
      onMouseLeave={() => setShowDownload(false)}
    >
      <div className="relative">
        {showDownload && (
          <button
            className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-white/[0.12] px-2 py-1 text-white text-sm transition-colors hover:bg-white/[0.18]"
            onClick={downloadCSV}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            CSV
          </button>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" ref={tableRef}>
            {children}
          </table>
        </div>
      </div>
    </div>
  );
};

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

  const styleId = "katex-layout-fixes";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    .katex-display { display: block !important; text-align: center !important; margin: 1.5em auto !important; overflow-x: auto; overflow-y: visible; }
    .katex-display > .katex { display: inline-block; white-space: nowrap; }
    p:has(> .katex-display), p:has(> span > .katex-display) { text-align: center; }
    .katex { line-height: 1.2; font-size: 1.0em; }
    .katex:not(.katex-display > .katex) { display: inline-block !important; vertical-align: baseline; }
    p:has(.katex):not(:has(.katex-display)) { margin-top: 1.2em !important; margin-bottom: 0.5em !important; line-height: 2 !important; }
    li:has(.katex) { margin-top: 1.2em !important; margin-bottom: 0.4em !important; line-height: 2 !important; }
  `;
};

type HeadingProps = React.ComponentPropsWithoutRef<"h1"> & ExtraProps;
type ParagraphProps = React.ComponentPropsWithoutRef<"p"> & ExtraProps;
type ListProps = React.ComponentPropsWithoutRef<"ul"> & ExtraProps;
type ListItemProps = React.ComponentPropsWithoutRef<"li"> & ExtraProps;
type BlockquoteProps = React.ComponentPropsWithoutRef<"blockquote"> & ExtraProps;
type InlineCodeProps = React.ComponentPropsWithoutRef<"code"> & ExtraProps;
type TableProps = React.ComponentPropsWithoutRef<"table"> & ExtraProps;
type TheadProps = React.ComponentPropsWithoutRef<"thead"> & ExtraProps;
type TrProps = React.ComponentPropsWithoutRef<"tr"> & ExtraProps;
type TableCellProps = React.ComponentPropsWithoutRef<"th"> & ExtraProps;
type AnchorProps = React.ComponentPropsWithoutRef<"a"> & ExtraProps;
type ImageProps = React.ComponentPropsWithoutRef<"img"> & ExtraProps;

const MarkdownView: React.FC<{ text: string; isStreaming?: boolean }> = React.memo(({ text, isStreaming = false }) => {
  useEffect(() => ensureKatexCSS(), []);

  const components = useMemo<Components>(() => ({
    code({ className, children, ...props }: InlineCodeProps) {
      const raw = String(children);
      const match = /language-([\w-]+)/.exec(className || "");
      const lang = match?.[1];
      const isBlock = raw.includes("\n") || lang;

      if (isBlock) {
        if (lang === "mermaid") {
          return <MermaidDiagram code={raw} isStreaming={isStreaming} />;
        }
        return <CodeBlock code={raw} langHint={lang} />;
      }

      return (
        <code className="bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--text-secondary)]" {...props}>{children}</code>
      );
    },
    p({ children }: ParagraphProps) {
      return <p className="my-3 font-satoshi text-base text-[var(--text-secondary)] leading-relaxed last:mb-0">{children}</p>;
    },
    h1({ children }: HeadingProps) {
      return <h1 className="mt-4 mb-2 font-sora font-bold text-[var(--text-primary)] text-xl tracking-tight">{children}</h1>;
    },
    h2({ children }: HeadingProps) {
      return <h2 className="mt-4 mb-2 font-sora font-bold text-[var(--text-primary)] text-lg tracking-tight">{children}</h2>;
    },
    h3({ children }: HeadingProps) {
      return <h3 className="mt-3 mb-2 font-sora font-bold text-[var(--text-primary)] text-base tracking-tight">{children}</h3>;
    },
    ul({ children, ...props }: ListProps) {
      return <ul className="my-3 list-disc pl-5 text-base [&>li]:mt-1.5 text-[var(--text-secondary)]" {...props}>{children}</ul>;
    },
    ol({ children, ...props }: ListProps) {
      return <ol className="my-3 list-decimal pl-5 text-base [&>li]:mt-1.5 text-[var(--text-secondary)]" {...props}>{children}</ol>;
    },
    li({ children, ...props }: ListItemProps) {
      return <li className="pl-1 leading-relaxed" {...props}>{children}</li>;
    },
    blockquote({ children, ...props }: BlockquoteProps) {
      return (
        <blockquote className="mt-3 border-l-2 border-[var(--text-muted)]/30 pl-3 text-[var(--text-muted)] text-sm italic" {...props}>
          {children}
        </blockquote>
      );
    },
    table({ children }: TableProps) {
      return <MarkdownTable>{children}</MarkdownTable>;
    },
    thead({ children, ...props }: TheadProps) {
      return <thead className="bg-[var(--bg-surface)]" {...props}>{children}</thead>;
    },
    tr({ children, ...props }: TrProps) {
      return <tr className="m-0 p-0 odd:bg-[var(--bg-surface)]/30 even:bg-[var(--bg-surface)]/60" {...props}>{children}</tr>;
    },
    th({ children, ...props }: TableCellProps) {
      return <th className="px-2 py-1 text-left font-bold text-[var(--text-primary)]" {...props}>{children}</th>;
    },
    td({ children, ...props }: TableCellProps) {
      return <td className="px-2 py-1 text-left text-[var(--text-secondary)]" {...props}>{children}</td>;
    },
    a({ href, children }: AnchorProps) {
      const videoId = href ? getYouTubeVideoId(href) : null;

      if (videoId) {
        return (
          <div className="my-4 mx-auto aspect-video w-full min-w-[280px] sm:min-w-[400px] md:min-w-[500px] max-w-3xl overflow-hidden border border-[var(--border-subtle)] bg-black shadow-md">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
            />
          </div>
        );
      }

      return <SmartLink href={href || ""}>{children}</SmartLink>;
    },
    img({ src, alt }: ImageProps) {
      const videoId = src ? getYouTubeVideoId(src) : null;

      if (videoId) {
        return (
          <div className="my-4 mx-auto aspect-video w-full min-w-[280px] sm:min-w-[400px] md:min-w-[500px] max-w-3xl overflow-hidden border border-[var(--border-subtle)] bg-black shadow-md">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
            />
          </div>
        );
      }

      return (
        <ZoomableImageWithLoader
          alt={alt || ""}
          className="my-4 mx-auto min-w-[280px] sm:min-w-[400px] md:min-w-[500px] max-w-3xl shadow-md border border-[var(--border-subtle)]"
          src={src || ""}
        />
      );
    },
  }), [isStreaming]);

  return (
    <ReactMarkdown
      components={components}
      rehypePlugins={[[rehypeKatex, { output: "htmlAndMathml", throwOnError: false }]]}
      remarkPlugins={[remarkGfm, remarkMath]}
    >
      {text}
    </ReactMarkdown>
  );
});
MarkdownView.displayName = "MarkdownView";

export default MarkdownView;
