// Loom share URLs look like:
//   https://www.loom.com/share/{32-char hex id}?sid=...
//   https://loom.com/share/{id}
//   https://www.loom.com/embed/{id}
// We accept any of these and return the raw id, which is what we need to
// build the embed iframe ourselves. Returns null for anything we can't parse
// so the action can return a friendly error instead of storing junk.

const LOOM_ID = /^[a-f0-9]{20,}$/i;

export function parseLoomId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Allow pasting a bare id.
  if (LOOM_ID.test(trimmed)) return trimmed.toLowerCase();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!/(^|\.)loom\.com$/i.test(url.hostname)) return null;

  // /share/{id} or /embed/{id} - the id is the segment after the prefix.
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "share" || p === "embed");
  if (idx === -1 || idx + 1 >= parts.length) return null;
  const id = parts[idx + 1];
  return LOOM_ID.test(id) ? id.toLowerCase() : null;
}

export function loomEmbedUrl(id: string, opts?: { autoplay?: boolean }): string {
  const params = new URLSearchParams();
  if (opts?.autoplay) params.set("autoplay", "1");
  const qs = params.toString();
  return `https://www.loom.com/embed/${id}${qs ? `?${qs}` : ""}`;
}

export function loomShareUrl(id: string): string {
  return `https://www.loom.com/share/${id}`;
}

// Loom serves a static frame-1 thumbnail at this CDN path for every share.
// It's not part of the official API but has been stable for years and is
// what the standard Loom embed itself uses. If the image ever 404s we fall
// back to a gradient placeholder in the UI - the play button still works.
export function loomThumbnailUrl(id: string): string {
  return `https://cdn.loom.com/sessions/thumbnails/${id}-00001.jpg`;
}
