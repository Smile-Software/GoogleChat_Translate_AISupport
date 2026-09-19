const REDACTED = "[REDACTED]";

export function redactSensitive(input) {
  let text = String(input ?? "");
  let redacted = false;
  const replace = (pattern, replacement) => {
    const next = text.replace(pattern, replacement);
    redacted ||= next !== text;
    text = next;
  };
  replace(/(password|passwd|pwd)\s*[:=]\s*[^\s,;]+/gi, "$1: " + REDACTED);
  replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, "$1" + REDACTED);
  replace(/(api[_-]?key|access[_-]?token|secret|credential)\s*[:=]\s*[^\s,;]+/gi, "$1=" + REDACTED);
  return { text, redacted };
}

export { REDACTED };
