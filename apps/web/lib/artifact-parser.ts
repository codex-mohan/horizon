/**
 * Artifact Parser — Extracts artifact blocks from AI messages
 *
 * Detects artifact content in assistant messages using two formats:
 *
 * 1. Explicit artifact fences:
 *    :::artifact{title="My Page" type="html"}
 *    <html>...</html>
 *    :::
 *
 * 2. Auto-detection from standard code blocks:
 *    - ```html with full HTML documents → type="html"
 *    - ```svg or <svg> blocks → type="svg"
 *    - ```mermaid blocks → type="mermaid"
 *    - ```jsx/```tsx with React components → type="react"
 */

import type { ArtifactType, ParsedArtifact } from "@/lib/types/artifact";

/**
 * Regex for explicit artifact fences:
 * :::artifact{title="..." type="..."}
 * ...content...
 * :::
 */
const ARTIFACT_FENCE_REGEX = /:::artifact\{([^}]+)\}\s*\n([\s\S]*?)\n:::/g;

/**
 * Regex for standard fenced code blocks with language hints:
 * ```language
 * ...content...
 * ```
 */
const CODE_BLOCK_REGEX = /```(\w+)?\s*\n([\s\S]*?)\n```/g;

/** Extract key="value" pairs from fence attributes */
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

/** Determine if a code block qualifies as an auto-detected artifact */
function detectArtifactType(
  language: string,
  content: string
): { type: ArtifactType; title: string; language?: string } | null {
  const lang = language.toLowerCase();

  // HTML: full documents or substantial HTML
  if (lang === "html" || lang === "htm") {
    if (
      content.includes("<!DOCTYPE") ||
      content.includes("<html") ||
      (content.includes("<head") && content.includes("<body"))
    ) {
      return { type: "html", title: extractHtmlTitle(content) || "HTML Document" };
    }
    // Substantial HTML fragment (> 5 lines with structural tags)
    if (
      content.split("\n").length > 5 &&
      (content.includes("<div") || content.includes("<section") || content.includes("<main"))
    ) {
      return { type: "html", title: "HTML Fragment" };
    }
  }

  // SVG
  if (lang === "svg" || (lang === "xml" && content.trimStart().startsWith("<svg"))) {
    return { type: "svg", title: "SVG Graphic" };
  }

  // Mermaid diagrams
  if (lang === "mermaid") {
    return { type: "mermaid", title: extractMermaidTitle(content) || "Diagram" };
  }

  // React/JSX/TSX — only if it contains a default export or component definition
  if (lang === "jsx" || lang === "tsx") {
    if (
      content.includes("export default") ||
      content.includes("export function") ||
      content.includes("const App")
    ) {
      return {
        type: "react",
        title: extractReactComponentName(content) || "React Component",
        language: lang,
      };
    }
  }

  // Markdown — only if substantial (> 10 lines)
  if (lang === "markdown" || lang === "md") {
    if (content.split("\n").length > 10) {
      return { type: "markdown", title: extractMarkdownTitle(content) || "Markdown Document" };
    }
  }

  return null;
}

/** Extract <title> from HTML content */
function extractHtmlTitle(content: string): string | undefined {
  const match = content.match(/<title>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

/** Extract title from first mermaid node label or graph definition */
function extractMermaidTitle(content: string): string | undefined {
  // Try extracting from graph title (e.g., "graph TD" → use first node label)
  const firstLabel = content.match(/\[["']?([^\]"']+)["']?\]/);
  return firstLabel?.[1]?.trim();
}

/** Extract component name from React/JSX content */
function extractReactComponentName(content: string): string | undefined {
  const exportMatch = content.match(/export\s+(?:default\s+)?function\s+(\w+)/);
  if (exportMatch) return exportMatch[1];

  const constMatch = content.match(/const\s+(\w+)\s*=\s*(?:\(\)|:?\s*React\.FC)/);
  return constMatch?.[1];
}

/** Extract first heading from markdown */
function extractMarkdownTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

/**
 * Parse a message string and extract all artifact blocks.
 *
 * Returns parsed artifacts with their position in the original string,
 * allowing the renderer to replace fence blocks with artifact cards.
 */
export function parseArtifacts(messageContent: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = [];
  const processedRanges: Array<{ start: number; end: number }> = [];

  // Pass 1: Explicit :::artifact{...} fences (highest priority)
  let match: RegExpExecArray | null;
  const fenceRegex = new RegExp(ARTIFACT_FENCE_REGEX.source, "g");

  while ((match = fenceRegex.exec(messageContent)) !== null) {
    const attrs = parseAttributes(match[1]);
    const content = match[2].trim();
    const type = (attrs.type as ArtifactType) || inferTypeFromContent(content);

    artifacts.push({
      title: attrs.title || "Untitled Artifact",
      type,
      language: attrs.language,
      content,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });

    processedRanges.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Pass 2: Auto-detect from standard code blocks
  const codeRegex = new RegExp(CODE_BLOCK_REGEX.source, "g");

  while ((match = codeRegex.exec(messageContent)) !== null) {
    const blockStart = match.index;
    const blockEnd = match.index + match[0].length;

    // Skip if this range overlaps with an explicit fence
    if (processedRanges.some((r) => blockStart >= r.start && blockEnd <= r.end)) {
      continue;
    }

    const language = match[1] || "";
    const content = match[2].trim();

    if (!language) continue;

    const detected = detectArtifactType(language, content);
    if (detected) {
      artifacts.push({
        title: detected.title,
        type: detected.type,
        language: detected.language || language,
        content,
        startIndex: blockStart,
        endIndex: blockEnd,
      });
    }
  }

  // Sort by position in message
  artifacts.sort((a, b) => a.startIndex - b.startIndex);

  return artifacts;
}

/** Infer artifact type from raw content when no type is specified */
function inferTypeFromContent(content: string): ArtifactType {
  const trimmed = content.trimStart();

  if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
    return "svg";
  }
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    (trimmed.includes("<head") && trimmed.includes("<body"))
  ) {
    return "html";
  }
  if (
    trimmed.startsWith("graph ") ||
    trimmed.startsWith("flowchart ") ||
    trimmed.startsWith("sequenceDiagram") ||
    trimmed.startsWith("classDiagram") ||
    trimmed.startsWith("erDiagram") ||
    trimmed.startsWith("gantt") ||
    trimmed.startsWith("pie")
  ) {
    return "mermaid";
  }
  if (trimmed.startsWith("#") || trimmed.startsWith("---\n")) {
    return "markdown";
  }

  return "code";
}

/**
 * Replace artifact blocks in a message with placeholder tokens.
 * Returns the cleaned message and the extracted artifacts.
 *
 * The placeholder format is: `[ARTIFACT:index]`
 * The renderer can then replace these with ArtifactCard components.
 */
export function replaceArtifactBlocks(messageContent: string): {
  cleanedContent: string;
  artifacts: ParsedArtifact[];
} {
  const artifacts = parseArtifacts(messageContent);

  if (artifacts.length === 0) {
    return { cleanedContent: messageContent, artifacts: [] };
  }

  // Build the cleaned content by replacing artifact ranges with placeholders
  let cleanedContent = "";
  let lastEnd = 0;

  for (let i = 0; i < artifacts.length; i++) {
    const artifact = artifacts[i];
    cleanedContent += messageContent.slice(lastEnd, artifact.startIndex);
    cleanedContent += `\n\n[ARTIFACT:${i}]\n\n`;
    lastEnd = artifact.endIndex;
  }

  cleanedContent += messageContent.slice(lastEnd);

  return { cleanedContent, artifacts };
}
