const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
};

export function detectPII(content: string): string[] {
  const detectedTypes: string[] = [];
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(content)) {
      detectedTypes.push(type);
      pattern.lastIndex = 0;
    }
  }
  return detectedTypes;
}
