/**
 * Options for configuring automatic PII (Personally Identifiable Information) Redaction.
 * When enabled, parameters in the request containing email addresses or phone numbers
 * have their value replaced with "NA" for that specific parameter only.
 */
export interface PiiRedactionOptions {
  /**
   * Whether PII redaction is enabled.
   * Default: true
   */
  enabled?: boolean;

  /**
   * Replacement string for parameters containing PII.
   * Default: "NA"
   */
  replacement?: string;

  /**
   * Custom regex to detect email addresses (optional override).
   */
  emailRegex?: RegExp;

  /**
   * Custom regex to detect phone numbers (optional override).
   */
  phoneRegex?: RegExp;
}
