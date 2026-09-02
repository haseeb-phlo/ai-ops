/**
 * Where a Learn video lives, and how to embed and illustrate it.
 *
 * This replaces `lib/loom.ts`. The library was Loom-only because every Phlo
 * recording was a Loom recording; day 3's arrived on Streamable, so the rule
 * is now: a host we recognise gets a real embed and a real poster frame,
 * anything else is stored and linked out. Nothing is rejected for being on the
 * wrong site.
 *
 * ADDING A PROVIDER is a `PROVIDERS` entry - a hostname test, an id pattern,
 * an embed URL and optionally an oEmbed endpoint. It is deliberately only Loom
 * and Streamable today: an embed path nobody has opened is not support, it is
 * a guess, and each one of these was checked against a real video before it
 * was written down. YouTube's oEmbed and Vimeo's both work the same way when
 * someone actually needs them.
 *
 * THUMBNAILS ARE RESOLVED AT WRITE TIME, never at render, which is why this
 * module does the fetching rather than the card. See `fetchVideoPoster` for
 * the part that is easy to get wrong.
 */

/** Hosts we can embed, plus the fallback for everything else. */
export type VideoProvider = "loom" | "streamable" | "link";

export type VideoSource = {
  provider: VideoProvider;
  /** The URL to store and to link out to. Always set. */
  shareUrl: string;
  /**
   * The provider's own id for the video, or null for `link` - an unrecognised
   * host has no id to extract and the URL is the only handle on it. Mirrors
   * `learn_videos.loom_embed_id`, which is nullable for exactly this case.
   */
  embedId: string | null;
};

type ProviderSpec = {
  provider: Exclude<VideoProvider, "link">;
  /** Matches the URL's hostname, apex and subdomains alike. */
  host: RegExp;
  /** Shape of a valid id for this host, used to reject junk path segments. */
  id: RegExp;
  /**
   * Path segments that precede the id. Loom writes /share/{id} and
   * /embed/{id}; Streamable puts the id first, so an empty list means "the
   * first segment is the id".
   */
  prefixes: readonly string[];
  embedUrl: (id: string, opts?: { autoplay?: boolean }) => string;
  shareUrl: (id: string) => string;
  /** oEmbed endpoint for a share URL, where the host publishes one. */
  oembed?: (shareUrl: string) => string;
  /**
   * A host-specific JSON endpoint to fill in what its oEmbed leaves out, and
   * the shape to read it with. Only Streamable needs one.
   */
  probe?: {
    url: (id: string) => string;
    read: (data: unknown) => VideoPoster;
  };
};

const PROVIDERS: readonly ProviderSpec[] = [
  {
    provider: "loom",
    host: /(^|\.)loom\.com$/i,
    id: /^[a-f0-9]{20,}$/i,
    prefixes: ["share", "embed"],
    embedUrl: (id, opts) =>
      `https://www.loom.com/embed/${id}${opts?.autoplay ? "?autoplay=1" : ""}`,
    shareUrl: (id) => `https://www.loom.com/share/${id}`,
    // The CDN-pattern guess does not work for newer uploads, so ask Loom.
    oembed: (url) =>
      `https://www.loom.com/v1/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    provider: "streamable",
    host: /(^|\.)streamable\.com$/i,
    // Short alphanumeric codes: streamable.com/h1clxr.
    id: /^[a-z0-9]{4,12}$/i,
    // Also accepts /e/{id} and /o/{id}, the two embed forms Streamable's own
    // oEmbed hands back, so pasting an embed URL works like pasting a share.
    prefixes: ["e", "o"],
    embedUrl: (id, opts) =>
      `https://streamable.com/e/${id}${opts?.autoplay ? "?autoplay=1" : ""}`,
    shareUrl: (id) => `https://streamable.com/${id}`,
    // Returns the title and the embed HTML but `thumbnail_url: null`, so the
    // poster for a Streamable video comes from the og:image fallback instead.
    oembed: (url) =>
      `https://api.streamable.com/oembed.json?url=${encodeURIComponent(url)}`,
    // ...and neither oEmbed nor the og: tags carry a duration, so the little
    // time chip every other day's card shows would be missing. Streamable's
    // own API has it, under the transcoded files rather than at the top level.
    probe: {
      url: (id) => `https://api.streamable.com/videos/${id}`,
      read: (data) => {
        const files = (data as { files?: Record<string, { duration?: number }> })
          .files;
        const durations = Object.values(files ?? {})
          .map((f) => asSeconds(f?.duration))
          .filter((d): d is number => d !== null);
        return {
          thumbnailUrl: null,
          durationSeconds: durations.length ? Math.max(...durations) : null,
        };
      },
    },
  },
];

function specFor(provider: VideoProvider): ProviderSpec | null {
  return PROVIDERS.find((p) => p.provider === provider) ?? null;
}

/**
 * Reads a pasted string into a storable source.
 *
 * Returns null only for something that is not a usable URL at all - a bare
 * word, or a scheme we will not put in an iframe or an anchor. That is the
 * whole of the validation now: "is this a link", not "is this a Loom link".
 *
 * A bare Loom id still parses, because that used to be accepted and somebody
 * has the habit. A bare Streamable code deliberately does NOT - "h1clxr" is
 * indistinguishable from a typo, and unlike a 32-character hex string it
 * carries no evidence of which host it belongs to.
 */
export function parseVideoUrl(input: string): VideoSource | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const loom = specFor("loom")!;
  if (loom.id.test(trimmed)) {
    const id = trimmed.toLowerCase();
    return { provider: "loom", shareUrl: loom.shareUrl(id), embedId: id };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // http/https only. `javascript:` and `data:` would go straight into an
  // anchor href, and nothing else is a video anyone can open.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const segments = url.pathname.split("/").filter(Boolean);

  for (const spec of PROVIDERS) {
    if (!spec.host.test(url.hostname)) continue;
    const id = extractId(segments, spec);
    if (!id) break; // Right host, unusable path - fall through to `link`.
    return {
      provider: spec.provider,
      // Canonical share URL rather than the pasted one: a Loom link arrives
      // with a ?sid= tracking param and an embed URL is not a share URL.
      shareUrl: spec.shareUrl(id),
      embedId: id,
    };
  }

  return { provider: "link", shareUrl: url.toString(), embedId: null };
}

function extractId(
  segments: readonly string[],
  spec: ProviderSpec,
): string | null {
  const idx = segments.findIndex((s) => spec.prefixes.includes(s));
  const candidate = idx === -1 ? segments[0] : segments[idx + 1];
  if (!candidate) return null;
  return spec.id.test(candidate) ? candidate.toLowerCase() : null;
}

/**
 * The URL to put in an iframe, or null when the provider cannot be embedded.
 *
 * Callers MUST branch on null rather than assuming a string: a `link` row has
 * no embed, and rendering `loom.com/embed/null` is what happens if you reach
 * for the id instead.
 */
export function videoEmbedUrl(
  source: { provider: string; embedId: string | null },
  opts?: { autoplay?: boolean },
): string | null {
  if (!source.embedId) return null;
  const spec = PROVIDERS.find((p) => p.provider === source.provider);
  return spec ? spec.embedUrl(source.embedId, opts) : null;
}

/** True when this row can play in place rather than only linking out. */
export function isEmbeddable(source: {
  provider: string;
  embedId: string | null;
}): boolean {
  return videoEmbedUrl(source) !== null;
}

/**
 * CloudFront signing parameters, which have to come off a poster URL before it
 * is stored.
 *
 * Streamable's og:image is signed and short-lived - the one on day 3's video
 * carried an `Expires` about an hour out. Store it as given and the thumbnail
 * works for the rest of the morning and then 403s forever, which is the worst
 * shape of bug here: nobody sees it break, they just see a grey card.
 *
 * The unsigned URL underneath serves the same JPEG with no auth, so dropping
 * these three is both safe and the difference between a poster frame that
 * lasts and one that rots.
 */
const SIGNING_PARAMS = ["Expires", "Key-Pair-Id", "Signature"] as const;

/**
 * Absolutises a poster URL and strips the signature off it.
 *
 * The absolutising is not decoration. Streamable serves its og:image
 * PROTOCOL-RELATIVE ("//cdn-cf-east.streamable.com/image/...") to a non-browser
 * agent, and `new URL` throws on that - so a first cut of this function caught
 * the error, returned the string untouched, and stored a URL that was both
 * unloadable as an `img` src and still carrying an hour-long expiry. It looked
 * like it worked. Resolve against the page it came from first, then strip.
 */
function cleanPosterUrl(rawUrl: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl, base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  for (const p of SIGNING_PARAMS) url.searchParams.delete(p);
  return url.toString();
}

export type VideoPoster = {
  thumbnailUrl: string | null;
  durationSeconds: number | null;
};

const NO_POSTER: VideoPoster = { thumbnailUrl: null, durationSeconds: null };

/**
 * The poster frame and duration for a video, best effort.
 *
 * Two sources, in order: the provider's oEmbed endpoint, then the share page's
 * OpenGraph tags. Loom answers on the first, Streamable publishes a
 * `thumbnail_url: null` there and a real image in its og:image, and an
 * unrecognised host has only the second - so both are tried for every provider
 * rather than being wired per host.
 *
 * Never throws and never blocks a write. A missing poster costs a gradient
 * placeholder and a missing duration costs the little time chip; refusing to
 * save the video because its host was slow would cost the day.
 */
export async function fetchVideoPoster(
  source: VideoSource,
): Promise<VideoPoster> {
  const spec = specFor(source.provider as VideoProvider);
  const found = spec?.oembed
    ? await readOembed(spec.oembed(source.shareUrl), source.shareUrl)
    : NO_POSTER;

  if (found.thumbnailUrl && found.durationSeconds !== null) return found;

  const openGraph = await readOpenGraph(source.shareUrl);
  const merged: VideoPoster = {
    thumbnailUrl: found.thumbnailUrl ?? openGraph.thumbnailUrl,
    durationSeconds: found.durationSeconds ?? openGraph.durationSeconds,
  };

  if (merged.thumbnailUrl && merged.durationSeconds !== null) return merged;

  // Last, because it is the only source that costs a host-specific request.
  if (spec?.probe && source.embedId) {
    const probed = await readProbe(spec.probe, source.embedId, source.shareUrl);
    return {
      thumbnailUrl: merged.thumbnailUrl ?? probed.thumbnailUrl,
      durationSeconds: merged.durationSeconds ?? probed.durationSeconds,
    };
  }

  return merged;
}

async function readProbe(
  probe: NonNullable<ProviderSpec["probe"]>,
  embedId: string,
  base: string,
): Promise<VideoPoster> {
  try {
    const res = await fetch(probe.url(embedId), {
      next: { revalidate: POSTER_TTL_SECONDS },
    });
    if (!res.ok) return NO_POSTER;
    const read = probe.read(await res.json());
    return {
      thumbnailUrl: read.thumbnailUrl
        ? cleanPosterUrl(read.thumbnailUrl, base)
        : null,
      durationSeconds: read.durationSeconds,
    };
  } catch {
    return NO_POSTER;
  }
}

/** A week: oEmbed and OpenGraph responses are stable per video. */
const POSTER_TTL_SECONDS = 60 * 60 * 24 * 7;

async function readOembed(
  endpoint: string,
  base: string,
): Promise<VideoPoster> {
  try {
    const res = await fetch(endpoint, {
      next: { revalidate: POSTER_TTL_SECONDS },
    });
    if (!res.ok) return NO_POSTER;
    const data = (await res.json()) as {
      thumbnail_url?: string | null;
      duration?: number | null;
    };
    return {
      thumbnailUrl: data.thumbnail_url
        ? cleanPosterUrl(data.thumbnail_url, base)
        : null,
      durationSeconds: asSeconds(data.duration),
    };
  } catch {
    return NO_POSTER;
  }
}

// Attribute order varies by host, so match the tag and then pull `content`
// out of it rather than assuming property-then-content.
const META_TAG = /<meta\s+[^>]*>/gi;
const META_PROPERTY = /(?:property|name)\s*=\s*["']([^"']+)["']/i;
const META_CONTENT = /content\s*=\s*["']([^"']*)["']/i;

async function readOpenGraph(shareUrl: string): Promise<VideoPoster> {
  try {
    const res = await fetch(shareUrl, {
      next: { revalidate: POSTER_TTL_SECONDS },
      // Some hosts serve a stripped page to unknown agents.
      headers: { "user-agent": "Mozilla/5.0 (compatible; PhloAIOps/1.0)" },
    });
    if (!res.ok) return NO_POSTER;
    // Only the head is needed and a video page can be megabytes of player JS.
    const html = (await res.text()).slice(0, 200_000);
    const meta = new Map<string, string>();
    for (const tag of html.match(META_TAG) ?? []) {
      const key = tag.match(META_PROPERTY)?.[1]?.toLowerCase();
      const value = tag.match(META_CONTENT)?.[1];
      if (key && value && !meta.has(key)) meta.set(key, decodeEntities(value));
    }
    const image =
      meta.get("og:image") ??
      meta.get("og:image:secure_url") ??
      meta.get("twitter:image") ??
      null;
    return {
      thumbnailUrl: image ? cleanPosterUrl(image, shareUrl) : null,
      durationSeconds: asSeconds(Number(meta.get("og:video:duration"))),
    };
  } catch {
    return NO_POSTER;
  }
}

// og:image URLs are HTML-escaped in the markup, and Streamable's signature is
// full of &amp;. Left unescaped, the query breaks and the image 403s.
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function asSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}
