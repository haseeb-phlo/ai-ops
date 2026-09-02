import { describe, expect, it, vi, afterEach } from "vitest";
import {
  fetchVideoPoster,
  isEmbeddable,
  parseVideoUrl,
  videoEmbedUrl,
} from "@/lib/video";

/**
 * The Learn library stopped being Loom-only when day 3's video arrived on
 * Streamable. Two things here are worth more than the parsing table:
 *
 *   - a host we do not recognise must still be storable, because the rule is
 *     now "embed what we can, link out the rest" rather than "reject it";
 *   - a poster URL must be absolute and unsigned before it is stored, because
 *     Streamable publishes its og:image protocol-relative and behind an
 *     expiry of about an hour. Store it as given and the thumbnail works for
 *     the morning and then 403s, which nobody notices until a member sees a
 *     grey card.
 */

const LOOM_ID = "85034dc2eaed4ec0ba85cd8a6d489224";

describe("parseVideoUrl - recognised hosts", () => {
  it("reads a Loom share link and drops its tracking param", () => {
    expect(parseVideoUrl(`https://www.loom.com/share/${LOOM_ID}?sid=abc`)).toEqual(
      {
        provider: "loom",
        shareUrl: `https://www.loom.com/share/${LOOM_ID}`,
        embedId: LOOM_ID,
      },
    );
  });

  it("still accepts a bare Loom id, which used to be the only input", () => {
    expect(parseVideoUrl(LOOM_ID)?.provider).toBe("loom");
  });

  it("reads a Streamable share link", () => {
    expect(parseVideoUrl("https://streamable.com/h1clxr")).toEqual({
      provider: "streamable",
      shareUrl: "https://streamable.com/h1clxr",
      embedId: "h1clxr",
    });
  });

  it("canonicalises a Streamable embed link back to its share form", () => {
    // Streamable's own oEmbed hands back /o/{id}, so somebody will paste one.
    for (const url of [
      "https://streamable.com/e/h1clxr",
      "https://streamable.com/o/h1clxr",
    ]) {
      expect(parseVideoUrl(url)).toEqual({
        provider: "streamable",
        shareUrl: "https://streamable.com/h1clxr",
        embedId: "h1clxr",
      });
    }
  });

  it("does not accept a bare Streamable code", () => {
    // A 32-char hex string is evidence of which host it came from. "h1clxr"
    // is indistinguishable from a typo, so it is treated as one.
    expect(parseVideoUrl("h1clxr")).toBeNull();
  });
});

describe("parseVideoUrl - everything else is a link, not an error", () => {
  it("stores an unrecognised host with no embed id", () => {
    expect(parseVideoUrl("https://drive.google.com/file/d/abc123/view")).toEqual(
      {
        provider: "link",
        shareUrl: "https://drive.google.com/file/d/abc123/view",
        embedId: null,
      },
    );
  });

  it("falls back to a link for a known host with an unusable path", () => {
    // Right domain, nothing that looks like a video id. Better a link that
    // opens than a rejection that tells the admin their own URL is wrong.
    expect(parseVideoUrl("https://www.loom.com/looks/nothing-like-an-id")
      ?.provider).toBe("link");
  });

  it("rejects what is not a link at all", () => {
    for (const input of ["", "   ", "some words", "loom.com/share/abc"]) {
      expect(parseVideoUrl(input), input).toBeNull();
    }
  });

  it("rejects schemes that would be unsafe in an href", () => {
    // These would go straight into an anchor on the link-out card.
    for (const input of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ]) {
      expect(parseVideoUrl(input), input).toBeNull();
    }
  });
});

describe("videoEmbedUrl", () => {
  it("builds the embed for each host we can play in place", () => {
    expect(videoEmbedUrl({ provider: "loom", embedId: LOOM_ID })).toBe(
      `https://www.loom.com/embed/${LOOM_ID}`,
    );
    expect(
      videoEmbedUrl({ provider: "streamable", embedId: "h1clxr" }),
    ).toBe("https://streamable.com/e/h1clxr");
  });

  it("adds autoplay only when asked", () => {
    expect(
      videoEmbedUrl({ provider: "streamable", embedId: "h1clxr" }, { autoplay: true }),
    ).toBe("https://streamable.com/e/h1clxr?autoplay=1");
  });

  it("is null for a link, so no caller can build an embed from nothing", () => {
    // The bug this guards: reaching for the id instead and rendering an
    // iframe pointed at a URL with the string "null" in it.
    expect(videoEmbedUrl({ provider: "link", embedId: null })).toBeNull();
    expect(isEmbeddable({ provider: "link", embedId: null })).toBe(false);
    expect(isEmbeddable({ provider: "streamable", embedId: "h1clxr" })).toBe(
      true,
    );
  });

  it("is null for a provider that is no longer in the registry", () => {
    // A row written before a provider was removed must not crash the card.
    expect(videoEmbedUrl({ provider: "vimeo", embedId: "123" })).toBeNull();
  });
});

describe("fetchVideoPoster", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Answers each URL from a map; anything unlisted 404s. */
  function stubFetch(routes: Record<string, unknown>) {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        const hit = Object.entries(routes).find(([key]) => url.includes(key));
        if (!hit) return { ok: false, status: 404 };
        const body = hit[1];
        return {
          ok: true,
          json: async () => body,
          text: async () => String(body),
        };
      }),
    );
    return calls;
  }

  it("takes the thumbnail and duration from oEmbed when both are there", async () => {
    stubFetch({
      "loom.com/v1/oembed": {
        thumbnail_url: "https://cdn.loom.com/sessions/thumbnails/x.gif",
        duration: 293.4,
      },
    });
    expect(
      await fetchVideoPoster({
        provider: "loom",
        shareUrl: `https://www.loom.com/share/${LOOM_ID}`,
        embedId: LOOM_ID,
      }),
    ).toEqual({
      thumbnailUrl: "https://cdn.loom.com/sessions/thumbnails/x.gif",
      durationSeconds: 293,
    });
  });

  it("strips the CloudFront signature off a poster before storing it", async () => {
    // Streamable's real og:image, shortened: protocol-relative, HTML-escaped
    // and signed with an Expires about an hour out. All three have to be
    // undone or the stored URL is unloadable, or dies the same day, or both.
    stubFetch({
      "api.streamable.com/oembed": { thumbnail_url: null },
      "streamable.com/h1clxr":
        '<meta property="og:image" content="//cdn-cf-east.streamable.com/image/h1clxr.jpg?Expires=1788343376&amp;Key-Pair-Id=APKAI&amp;Signature=abc~def" />',
      "api.streamable.com/videos": {
        files: { "mp4-mobile": { duration: 566.93 }, original: { duration: 566.86 } },
      },
    });

    expect(
      await fetchVideoPoster({
        provider: "streamable",
        shareUrl: "https://streamable.com/h1clxr",
        embedId: "h1clxr",
      }),
    ).toEqual({
      thumbnailUrl: "https://cdn-cf-east.streamable.com/image/h1clxr.jpg",
      durationSeconds: 567,
    });
  });

  it("reads the OpenGraph tags of a host with no oEmbed at all", async () => {
    stubFetch({
      "example.com/video":
        '<meta content="https://example.com/poster.jpg" property="og:image">',
    });
    const poster = await fetchVideoPoster({
      provider: "link",
      shareUrl: "https://example.com/video",
      embedId: null,
    });
    expect(poster.thumbnailUrl).toBe("https://example.com/poster.jpg");
  });

  it("does not probe the host when oEmbed already answered in full", async () => {
    const calls = stubFetch({
      "loom.com/v1/oembed": { thumbnail_url: "https://x/y.gif", duration: 10 },
    });
    await fetchVideoPoster({
      provider: "loom",
      shareUrl: `https://www.loom.com/share/${LOOM_ID}`,
      embedId: LOOM_ID,
    });
    expect(calls).toHaveLength(1);
  });

  it("returns nulls rather than throwing when every source fails", async () => {
    // A missing poster costs a gradient placeholder. Refusing to save the
    // video because its host was down would cost the day.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(
      await fetchVideoPoster({
        provider: "streamable",
        shareUrl: "https://streamable.com/h1clxr",
        embedId: "h1clxr",
      }),
    ).toEqual({ thumbnailUrl: null, durationSeconds: null });
  });
});
