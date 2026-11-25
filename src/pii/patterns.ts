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

export const PHONE_KEY_NAMES =
  /^(?:ep\.|epn\.|up\.|user_|customer_)?(?:mobile|mobileno|mobilenumber|mobile_number|phone|phone_number|mobile_no|phone_no|contact_no|contact_number|telephone|tel)$/i;

export const TEN_DIGIT_PHONE_VAL =
  /^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
