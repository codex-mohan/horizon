import { detectPII } from "../../lib/pii.js";

export function checkPII(content: string): string[] {
  return detectPII(content);
}
