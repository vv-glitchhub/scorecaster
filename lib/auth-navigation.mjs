const INTERNAL_ORIGIN = "https://scorecaster.invalid";

export function safeNextPath(value, fallback = "/profile") {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const target = new URL(value, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN) return fallback;
    let decoded = target.pathname;
    for (let depth = 0; depth < 6; depth += 1) {
      if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
      if (/^\/(?:api|auth|login)(?:\/|$)/.test(decoded)) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) return target.pathname + target.search + target.hash;
      decoded = next;
    }
    return fallback;
  } catch { return fallback; }
}

export function loginHref(next) {
  return "/login?" + new URLSearchParams({ next: safeNextPath(next) });
}
