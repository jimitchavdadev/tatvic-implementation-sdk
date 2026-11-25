import type { PiiRedactionOptions } from '../types.js';
import {
  DEFAULT_EMAIL_REGEX,
  DEFAULT_PHONE_REGEX,
  PHONE_KEY_NAMES,
  TEN_DIGIT_PHONE_VAL,
} from './patterns.js';
import { redactBodyPayload, redactJsonObject } from './body-redactor.js';

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
    if (this.testRegex(this.phoneRegex, strValue)) {
      return true;
    }
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
      return isRelative ? `${parsed.pathname}${parsed.search}` : parsed.toString();
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
    return redactBodyPayload(body, contentType, this.replacement, (k, v) => this.hasPii(k, v));
  }

  public redactJsonObject(obj: any): any {
    if (!this.enabled) return obj;
    return redactJsonObject(obj, this.replacement, (k, v) => this.hasPii(k, v));
  }
}
