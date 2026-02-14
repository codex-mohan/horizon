/**
 * Generate a conversation title from the first user message.
 * Truncates to a reasonable length and adds ellipsis if needed.
 */
export function generateConversationTitle(
  message: string,
  maxLength = 50
): string {
  // Remove extra whitespace and normalize
  const cleaned = message.trim().replace(/\s+/g, " ");

  // If short enough, return as-is
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Try to cut at a word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.6) {
    // Cut at word boundary if it's not too far back
    return `${truncated.substring(0, lastSpace)}...`;
  }

  // Otherwise just truncate
  return `${truncated}...`;
}
