const SENSITIVE_KEY_PATTERN = /(password|passwd|token|authorization|secret|cookie|api[_-]?key|access[_-]?key)/i;
const REDACTED = '[REDACTED]';

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 12) {
    return '[TRUNCATED_DEPTH]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const redacted: Record<string, unknown> = {};
    for (const [key, nested] of entries) {
      redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactSensitive(nested, depth + 1);
    }
    return redacted;
  }

  return value;
}

export function isExecutableText(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return /\b(import|export|require|eval|Function|process|child_process|exec|spawn|test\(|describe\(|curl|bash|powershell)\b/.test(
    value,
  );
}
