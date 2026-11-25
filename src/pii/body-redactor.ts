/**
 * Redacts JSON objects recursively replacing any values identified as PII with replacement.
 * Defensively isolates GTM sandbox environment, DOM nodes, callbacks, and frozen objects.
 */
export function redactJsonObject(
  obj: any,
  replacement: string,
  hasPiiFn: (key: string, val: unknown) => boolean,
  seen: WeakSet<object> = new WeakSet()
): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && hasPiiFn('value', obj)) {
      return replacement;
    }
    return obj;
  }

  // Prevent circular reference infinite loops
  if (seen.has(obj)) return obj;
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => redactJsonObject(item, replacement, hasPiiFn, seen));
  }

  const isArguments =
    Object.prototype.toString.call(obj) === '[object Arguments]' ||
    (typeof obj.length === 'number' && typeof obj.callee === 'function');
  if (isArguments) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = redactJsonObject(obj[i], replacement, hasPiiFn, seen);
    }
    return obj;
  }

  // Skip DOM elements, Window, and non-plain objects to protect GTM sandbox
  if ((obj as any).nodeType || (typeof window !== 'undefined' && obj === window)) {
    return obj;
  }
  const proto = Object.getPrototypeOf(obj);
  if (proto !== null && proto !== Object.prototype) {
    return obj;
  }

  // If object is frozen, do not mutate in place
  if (Object.isFrozen(obj)) {
    return obj;
  }

  for (const [k, v] of Object.entries(obj)) {
    // Preserve GTM sandbox internal properties, events, and callbacks untouched
    if (
      k.startsWith('gtm.') ||
      k.startsWith('_gtm') ||
      k === 'eventCallback' ||
      k === 'eventTimeout' ||
      k.startsWith('google_tag_')
    ) {
      continue;
    }
    if (typeof v === 'object' && v !== null) {
      obj[k] = redactJsonObject(v, replacement, hasPiiFn, seen);
    } else if (hasPiiFn(k, v)) {
      obj[k] = replacement;
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
