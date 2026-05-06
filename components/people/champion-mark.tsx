import Link from "next/link";
import { resolveAvatar } from "@/lib/profile";
import type { Champion } from "@/lib/champions";
import { renderTeamMentions } from "@/lib/champions";
import { cn } from "@/lib/utils";

/**
 * Avatar with an optional "AI Champion" ring + lightning glyph.
 *
 * The ring is amber on rgba so it composites well on light surfaces. When the
 * person is a champion, the whole element becomes a link to that team's
 * champion profile so users can drill in from any owner chip.
 */
export function PersonAvatar({
  seed,
  avatarUrl,
  name,
  champion,
  size = 28,
  className,
}: {
  seed: string;
  avatarUrl?: string | null;
  name: string;
  champion?: Champion | null;
  size?: number;
  className?: string;
}) {
  const src = resolveAvatar(avatarUrl ?? null, seed);
  const dim = `${size}px`;

  const inner = (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-visible",
        className,
      )}
      style={{ width: dim, height: dim }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className={cn(
          "h-full w-full rounded-full bg-zinc-50 object-cover ring-1",
          champion
            ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
            : "ring-zinc-200",
        )}
      />
      {champion && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-0.5 -right-0.5 inline-flex h-4 items-center justify-center rounded-full bg-amber-400 px-1 font-mono text-[8px] font-semibold leading-none tracking-tight text-white shadow-sm ring-1 ring-white"
          title={`AI Champion · ${champion.team}`}
        >
          AI
        </span>
      )}
    </span>
  );

  if (champion) {
    return (
      <Link
        href={`/champions/${encodeURIComponent(champion.team)}`}
        title={`AI Champion · ${champion.team}`}
        className="inline-flex"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

/**
 * Inline name with an optional AI Champion mark suffix and link to the
 * champion profile. Use in dense rows (activity feed, owners list) where
 * the avatar is too heavy.
 */
export function PersonName({
  name,
  champion,
  className,
  muted,
}: {
  name: string;
  champion?: Champion | null;
  className?: string;
  muted?: boolean;
}) {
  if (champion) {
    return (
      <Link
        href={`/champions/${encodeURIComponent(champion.team)}`}
        title={`AI Champion · ${champion.team}`}
        className={cn(
          "inline-flex items-center gap-1",
          muted ? "text-zinc-700" : "font-medium text-zinc-900",
          "hover:underline",
          className,
        )}
      >
        <span>{name}</span>
        <span
          aria-hidden
          className="inline-flex h-4 items-center rounded-full bg-amber-400 px-1 font-mono text-[8px] font-semibold leading-none tracking-tight text-white"
        >
          AI
        </span>
      </Link>
    );
  }
  return <span className={className}>{name}</span>;
}

/**
 * Renders a free-text body and turns "@Team" tokens into champion-profile
 * links. Async server component so the team→champion lookup uses the
 * cached `championsByTeam()` map.
 */
export async function TextWithMentions({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const segments = await renderTeamMentions(text);
  if (segments.length === 0) return null;
  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <span key={i}>{seg.value}</span>;
        }
        return (
          <Link
            key={i}
            href={seg.href}
            className="rounded bg-amber-50 px-1 text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
            title={
              seg.champion
                ? `${seg.champion.display_name} - AI Champion of ${seg.team}`
                : `AI Champion of ${seg.team}`
            }
          >
            @{seg.team}
          </Link>
        );
      })}
    </span>
  );
}
