/**
 * Validates whether a target hostname matches an allowlist of domains and RegExp patterns.
 */
export function matchesAllowlist(hostname: string, allowlist: (string | RegExp)[]): boolean {
  const cleanHost = hostname.toLowerCase();
  for (const rule of allowlist) {
    if (rule instanceof RegExp) {
      if (rule.test(cleanHost)) return true;
    } else {
      const cleanRule = rule.toLowerCase().trim();
      if (cleanHost === cleanRule || cleanHost.endsWith(`.${cleanRule}`)) {
        return true;
      }
    }
  }
  return false;
}
