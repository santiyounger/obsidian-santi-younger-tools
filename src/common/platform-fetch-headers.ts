/**
 * Match server auth for platform API: cookie + optional Bearer, plus Referer/Origin.
 * Used by main `platformRequest` and private plugin release-asset fetches.
 */
export function authorizationBearerFromAuthCookie(authCookie: string): string | null {
  const match = /(?:^|;\s*)auth-token=([^;]+)/iu.exec(authCookie.trim());
  if (!match) {
    return null;
  }
  let value = (match[1] ?? '').trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // leave as-is
  }
  if (!value) {
    return null;
  }
  return /^Bearer\s+/iu.test(value) ? value.replace(/^Bearer\s+/iu, "").trim() : value;
}

export function buildPlatformApiHeaders(baseUrl: string, authCookie: string): Record<string, string> {
  const base = baseUrl.trim().replace(/\/+$/u, "");
  const bearer = authorizationBearerFromAuthCookie(authCookie);
  return {
    "Content-Type": "application/json",
    Referer: `${base}/`,
    Origin: base,
    Cookie: authCookie,
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
  };
}
