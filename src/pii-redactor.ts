import type { PiiRedactionOptions } from './types.js';

/**
 * Standard Email Regex: matches plain text and URL-encoded (@ or %40) email addresses,
 * while excluding common image asset extensions (.png, .jpg, .jpeg, .svg, .webp, .gif).
 */
export const DEFAULT_EMAIL_REGEX =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,63})[A-Za-z0-9](?:@|%40)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?){0,8}\.(?!png\b|jpg\b|jpeg\b|svg\b|webp\b|gif\b)[A-Za-z]{2,24}\b/i;

/**
 * Standard Phone Regex: matches mobile/phone keys followed by 10-digit numbers.
 */
export const DEFAULT_PHONE_REGEX =
  /\b(?:mobile|mobileno|mobilenumber|mobile_number|phone|phone_number|mobile_no|phone_no)\b\s*[:=]\s*['"]?\d{10}['"]?/i;

const PHONE_KEY_NAMES =
  /^(?:ep\.|epn\.|up\.|user_)?(?:mobile|mobileno|mobilenumber|mobile_number|phone|phone_number|mobile_no|phone_no)$/i;

const TEN_DIGIT_PHONE_VAL = /^(\+?\d{1,3}[- ]?)?['"]?\d{10}['"]?$/;

/**
 * PiiRedactor
 *
 * Scans incoming request query parameters and body payloads for Personally Identifiable Information (PII)
 * such as email addresses and phone numbers. If any parameter contains PII, its value is replaced with "NA"
 * for that specific parameter only, allowing the clean request to pass through.
 */
export class PiiRedactor {
  private enabled: boolean;
  private replacement: string;
  private emailRegex: RegExp;
  private phoneRegex: RegExp;

  constructor(options?: boolean | PiiRedactionOptions) {
    if (typeof options === 'boolean') {
      this.enabled = options;
      this.replacement = 'NA';
      this.emailRegex = DEFAULT_EMAIL_REGEX;
      this.phoneRegex = DEFAULT_PHONE_REGEX;
    } else {
      this.enabled = options?.enabled !== false;
      this.replacement = options?.replacement ?? 'NA';
      this.emailRegex = options?.emailRegex ?? DEFAULT_EMAIL_REGEX;
      this.phoneRegex = options?.phoneRegex ?? DEFAULT_PHONE_REGEX;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getReplacement(): string {
    return this.replacement;
  }

  private testRegex(regex: RegExp, str: string): boolean {
    regex.lastIndex = 0;
    return regex.test(str);
  }

  /**
   * Checks whether a specific key-value pair contains email or phone PII.
   */
  public hasPii(key: string, value: unknown): boolean {
    if (!this.enabled || value === null || value === undefined) {
      return false;
    }

    const strValue = String(value);

    // 1. Check for email PII in value
    if (this.testRegex(this.emailRegex, strValue)) {
      return true;
    }
    try {
      const decoded = decodeURIComponent(strValue);
      if (decoded !== strValue && this.testRegex(this.emailRegex, decoded)) {
        return true;
      }
    } catch {}

    // 2. Check for phone PII
    // Case A: Value contains full pattern (e.g. "mobile:9876543210" or "phone=9876543210")
    if (this.testRegex(this.phoneRegex, strValue)) {
      return true;
    }
    // Case B: Combined key and value matches (e.g. key="phone", value="9876543210" -> "phone=9876543210")
    if (
      this.testRegex(this.phoneRegex, `${key}=${strValue}`) ||
      this.testRegex(this.phoneRegex, `${key}:${strValue}`)
    ) {
      return true;
    }
    const cleanKey = key.replace(/^(ep\.|epn\.|up\.|user_)/i, '');
    if (
      this.testRegex(this.phoneRegex, `${cleanKey}=${strValue}`) ||
      this.testRegex(this.phoneRegex, `${cleanKey}:${strValue}`)
    ) {
      return true;
    }

    // Case C: Parameter key is a designated phone/mobile name and value is a 10-digit number
    if (PHONE_KEY_NAMES.test(key) && TEN_DIGIT_PHONE_VAL.test(strValue.trim())) {
      return true;
    }

    return false;
  }

  /**
   * Redacts query parameters in a URL string.
   */
  public redactUrl(urlStr: string): string {
    if (!this.enabled || !urlStr) return urlStr;

    try {
      const isRelative = urlStr.startsWith('/');
      const parsed = new URL(urlStr, 'http://localhost');
      let changed = false;

      parsed.searchParams.forEach((val, key) => {
        if (this.hasPii(key, val)) {
          parsed.searchParams.set(key, this.replacement);
          changed = true;
        }
      });

      if (!changed) return urlStr;

      if (isRelative) {
        return `${parsed.pathname}${parsed.search}`;
      }
      return parsed.toString();
    } catch {
      return urlStr;
    }
  }

  /**
   * Redacts query parameters in a mutable URLSearchParams object.
   */
  public redactSearchParams(searchParams: URLSearchParams): boolean {
    if (!this.enabled) return false;

    let modified = false;
    const entries: [string, string][] = [];
    searchParams.forEach((val, key) => {
      entries.push([key, val]);
    });

    for (const [key, val] of entries) {
      if (this.hasPii(key, val)) {
        searchParams.set(key, this.replacement);
        modified = true;
      }
    }

    return modified;
  }

  /**
   * Redacts request body (supports URL-encoded, GA4 multiline text/plain, and JSON).
   */
  public redactBody(body: string, contentType: string = ''): string {
    if (!this.enabled || !body) return body;

    const trimmed = body.trim();

    // 1. JSON Body
    if (
      contentType.includes('application/json') ||
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(body);
        const redacted = this.redactJsonObject(parsed);
        return JSON.stringify(redacted);
      } catch {
        // Fall back to text/url-encoded
      }
    }

    // 2. URL-encoded or GA4 collect multiline text/plain body
    // GA4 beacons frequently send multiline events:
    // en=page_view&ep.email=test@example.com\nen=view_item&phone=9876543210
    const lines = body.split('\n');
    let modified = false;

    const redactedLines = lines.map((line) => {
      if (!line.includes('=')) {
        return line;
      }

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

        if (this.hasPii(decodedKey, decodedVal)) {
          modified = true;
          return `${key}=${encodeURIComponent(this.replacement)}`;
        }
        return pair;
      });

      return newPairs.join('&');
    });

    return modified ? redactedLines.join('\n') : body;
  }

  private redactJsonObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactJsonObject(item));
    }
    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object' && v !== null) {
          result[k] = this.redactJsonObject(v);
        } else if (this.hasPii(k, v)) {
          result[k] = this.replacement;
        } else {
          result[k] = v;
        }
      }
      return result;
    }
    return obj;
  }
}
