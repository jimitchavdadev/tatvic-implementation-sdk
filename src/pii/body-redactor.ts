/**
 * Redacts JSON objects recursively replacing any values identified as PII with replacement.
 */
export function redactJsonObject(
  obj: any,
  replacement: string,
  hasPiiFn: (key: string, val: unknown) => boolean
): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => redactJsonObject(item, replacement, hasPiiFn));
  }
  const isArguments =
    typeof obj === 'object' &&
    (Object.prototype.toString.call(obj) === '[object Arguments]' ||
      (typeof obj.length === 'number' && typeof obj.callee === 'function'));
  if (isArguments) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = redactJsonObject(obj[i], replacement, hasPiiFn);
    }
    return obj;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'object' && v !== null) {
        obj[k] = redactJsonObject(v, replacement, hasPiiFn);
      } else if (hasPiiFn(k, v)) {
        obj[k] = replacement;
      }
    }
    return obj;
  }
  if (typeof obj === 'string') {
    if (hasPiiFn('value', obj)) {
      return replacement;
    }
  }
  return obj;
}

/**
 * Redacts request body (supports URL-encoded, GA4 multiline text/plain, and JSON).
 */
export function redactBodyPayload(
  body: string,
  contentType: string = '',
  replacement: string,
  hasPiiFn: (key: string, val: unknown) => boolean
): string {
  if (!body) return body;

  const trimmed = body.trim();

  // 1. JSON Body
  if (
    contentType.includes('application/json') ||
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(body);
      const redacted = redactJsonObject(parsed, replacement, hasPiiFn);
      return JSON.stringify(redacted);
    } catch {}
  }

  // 2. URL-encoded or GA4 collect multiline text/plain body
  const lines = body.split('\n');
  let modified = false;

  const redactedLines = lines.map((line) => {
    if (!line.includes('=')) return line;

    const pairs = line.split('&');
    const newPairs = pairs.map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return pair;
      const key = pair.substring(0, eqIdx);
      const val = pair.substring(eqIdx + 1);

      let decodedKey = key;
      let decodedVal = val;
      try {
        decodedKey = decodeURIComponent(key);
        decodedVal = decodeURIComponent(val);
      } catch {}

      if (hasPiiFn(decodedKey, decodedVal)) {
        modified = true;
        return `${key}=${encodeURIComponent(replacement)}`;
      }
      return pair;
    });

    return newPairs.join('&');
  });

  return modified ? redactedLines.join('\n') : body;
}
