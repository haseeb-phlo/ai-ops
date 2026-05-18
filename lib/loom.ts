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

// Loom's public oEmbed endpoint. Returns the authoritative thumbnail URL
// for a share link (the CDN-pattern guess does not work reliably for newer
// uploads, so we ask Loom directly). Returns null on any failure so the
// UI can fall back to a gradient placeholder; we never block the user
// over a missing thumbnail.
export async function fetchLoomOembed(
  shareUrl: string,
): Promise<{ thumbnailUrl: string | null }> {
  try {
    const oembed = `https://www.loom.com/v1/oembed?format=json&url=${encodeURIComponent(shareUrl)}`;
    const res = await fetch(oembed, {
      // Cache aggressively - oEmbed responses are stable per video.
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) return { thumbnailUrl: null };
    const data = (await res.json()) as { thumbnail_url?: string };
    return { thumbnailUrl: data.thumbnail_url ?? null };
  } catch {
    return { thumbnailUrl: null };
  }
}
