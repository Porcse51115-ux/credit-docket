// creditApi.js — browser client for the monitoring API.
// Set VITE_API_BASE (or window.__API_BASE__) to point at your backend.

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "http://localhost:8787";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  return data;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Trigger a tri-bureau pull. Returns { partial, diagnostics, profile }. */
export function pullReport(consumerId, consentToken, bureaus) {
  return post("/api/pull", { consumerId, consentToken, bureaus });
}

/** Fetch a previously stored, normalized profile. Returns { profile }. */
export function getProfile(consumerId) {
  return get(`/api/profile/${encodeURIComponent(consumerId)}`);
}

/**
 * Generate dispute letters. `disputes` is an array of:
 *   { itemId, reason, assertion?, bureaus? }
 * Returns { letters: [...], skipped: [...] }.
 */
export function generateLetters(consumerId, sender, disputes) {
  return post("/api/letters", { consumerId, sender, disputes });
}

export const apiBase = BASE;
