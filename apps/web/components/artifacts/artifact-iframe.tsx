"use client";

/**
 * ArtifactIframe — Sandboxed iframe renderer for artifact previews.
 *
 * Renders HTML, SVG, Mermaid, and markdown artifacts in a secure sandbox.
 * The iframe uses `srcdoc` with `sandbox="allow-scripts"` to prevent
 * artifacts from accessing the parent page's DOM, cookies, or network.
 */

import { cn } from "@horizon/ui/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArtifactType } from "@/lib/types/artifact";

interface ArtifactIframeProps {
  content: string;
  type: ArtifactType;
  language?: string;
  className?: string;
}

/** Build a full HTML document wrapping the artifact content */
function buildSrcdoc(content: string, type: ArtifactType): string {
  const baseStyles = `
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e2e8f0;
        background: #0f172a;
        line-height: 1.6;
      }
      img { max-width: 100%; height: auto; }
      a { color: #60a5fa; }
      pre { background: #1e293b; padding: 12px; border-radius: 8px; overflow-x: auto; }
      code { font-family: 'Source Code Pro', monospace; font-size: 14px; }
    </style>
  `;

  switch (type) {
    case "html": {
      // If it's a full HTML document, use it directly
      if (content.includes("<html") || content.includes("<!DOCTYPE")) {
        return content;
      }
      // Otherwise wrap it
      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${baseStyles}</head>
<body>${content}</body>
</html>`;
    }

    case "svg": {
      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8">${baseStyles}
<style>
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  svg { max-width: 100%; height: auto; }
</style>
</head>
<body>${content}</body>
</html>`;
    }

    case "mermaid": {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  ${baseStyles}
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#6366f1',
        primaryBorderColor: '#818cf8',
        primaryTextColor: '#e2e8f0',
        lineColor: '#94a3b8',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
      }
    });
  </script>
</head>
<body>
  <div class="mermaid">${content}</div>
</body>
</html>`;
    }

    case "react": {
      // Basic React rendering via CDN (single-file components only in MVP)
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${baseStyles}
  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    ${content}

    // Auto-render: look for default export or App component
    const Component = typeof App !== 'undefined' ? App
      : typeof Default !== 'undefined' ? Default
      : null;
    if (Component) {
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
    }
  </script>
</body>
</html>`;
    }

    case "markdown": {
      // Render markdown as pre-formatted text (proper MD rendering needs a lib)
      const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8">${baseStyles}
<style>body { padding: 24px; max-width: 800px; margin: 0 auto; }</style>
</head>
<body><pre style="white-space: pre-wrap; word-wrap: break-word;">${escaped}</pre></body>
</html>`;
    }
    default: {
      const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8">${baseStyles}</head>
<body><pre><code>${escaped}</code></pre></body>
</html>`;
    }
  }
}

export function ArtifactIframe({ content, type, language, className }: ArtifactIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const srcdoc = buildSrcdoc(content, type);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Reset loading state when content changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, []);

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border", className)}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/90">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="text-muted-foreground text-sm">Failed to render artifact</p>
        </div>
      )}

      <iframe
        className="h-full w-full border-0 bg-[#0f172a]"
        onError={handleError}
        onLoad={handleLoad}
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        title="Artifact Preview"
      />
    </div>
  );
}
