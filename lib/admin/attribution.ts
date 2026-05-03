// lib/admin/attribution.ts
//
// Browser-side attribution helper. Two responsibilities:
//   1. captureAttribution() — call once on first page load. Reads ?utm_*,
//      document.referrer, and the landing path; stashes them in
//      sessionStorage so they survive nav until signup.
//   2. readAttribution() — call inside your signup handler. Returns the
//      stashed payload (plus a guess at device class from the user agent)
//      so the server action can write it to the new profile row.

const KEY = "matchmind_attribution_v1";

export type Attribution = {
  signup_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  signup_ref: string | null;
  device_class: string | null;
};

const EMPTY: Attribution = {
  signup_source: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  landing_page: null,
  signup_ref: null,
  device_class: null,
};

function inferChannel(utmSource: string | null, referrer: string): string {
  if (utmSource) return utmSource.toLowerCase();
  const r = referrer.toLowerCase();
  if (r.includes("tiktok")) return "tiktok";
  if (r.includes("instagram") || r.includes("ig.me")) return "instagram";
  if (r.includes("reddit")) return "reddit";
  if (r.includes("twitter") || r.includes("t.co") || r.includes("x.com")) return "x";
  if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
  if (r.includes("youtube")) return "youtube";
  if (r.includes("google")) return "google";
  if (!r) return "direct";
  return "other";
}

function inferDevice(ua: string): string {
  const u = ua.toLowerCase();
  if (/ipad|tablet|kindle/.test(u)) return "tablet";
  if (/mobile|iphone|android|ipod/.test(u)) return "mobile";
  return "desktop";
}

/** Call once on first page load. Idempotent. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");

    const attr: Attribution = {
      signup_source: inferChannel(utmSource, document.referrer || ""),
      utm_source: utmSource,
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
      landing_page: window.location.pathname || "/",
      signup_ref: params.get("ref"),
      device_class: inferDevice(navigator.userAgent || ""),
    };
    sessionStorage.setItem(KEY, JSON.stringify(attr));
  } catch {
    /* sessionStorage unavailable — silently noop */
  }
}

/** Read whatever captureAttribution() stashed. Empty fields if missing. */
export function readAttribution(): Attribution {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, device_class: inferDevice(navigator.userAgent || "") };
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}
