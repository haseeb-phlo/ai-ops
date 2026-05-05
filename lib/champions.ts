import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Champion = {
  id: string;
  team: string;
  user_id: string | null;
  display_name: string;
  last_check_in: string | null;
  blurb: string | null;
  chewing_on: string | null;
};

/**
 * Loads every champion row. Cached for the duration of a single render so
 * the header, owner chips, and activity rows on the same page share one
 * round-trip.
 */
export const loadChampions = cache(async (): Promise<Champion[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("champions")
    .select("id, team, user_id, display_name, last_check_in, blurb, chewing_on")
    .order("team", { ascending: true })
    .returns<Champion[]>();
  return data ?? [];
});

/**
 * Index of champions keyed by team for cheap lookup during render.
 */
export const championsByTeam = cache(
  async (): Promise<Map<string, Champion>> => {
    const list = await loadChampions();
    return new Map(list.map((c) => [c.team, c]));
  },
);

/**
 * Index of champions keyed by user_id, for "is this person a champion?"
 * lookups when rendering owner chips, activity rows, etc.
 */
export const championsByUserId = cache(
  async (): Promise<Map<string, Champion>> => {
    const list = await loadChampions();
    const map = new Map<string, Champion>();
    for (const c of list) {
      if (c.user_id) map.set(c.user_id, c);
    }
    return map;
  },
);

/**
 * Index of champions keyed by lower-cased display_name. Useful when the only
 * identifier we have for a person is the free-text owner string on a
 * workflow/intervention.
 */
export const championsByDisplayName = cache(
  async (): Promise<Map<string, Champion>> => {
    const list = await loadChampions();
    const map = new Map<string, Champion>();
    for (const c of list) {
      map.set(c.display_name.trim().toLowerCase(), c);
    }
    return map;
  },
);

/**
 * Resolves a person identifier (user_id and/or free-text name) to the
 * matching champion record, if any. Pass whichever fields the caller has.
 */
export async function findChampionForPerson(opts: {
  userId?: string | null;
  displayName?: string | null;
}): Promise<Champion | null> {
  if (!opts.userId && !opts.displayName) return null;
  if (opts.userId) {
    const byUser = await championsByUserId();
    const hit = byUser.get(opts.userId);
    if (hit) return hit;
  }
  if (opts.displayName) {
    const byName = await championsByDisplayName();
    const hit = byName.get(opts.displayName.trim().toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/**
 * Whether the given user_id is the registered champion of the given team.
 */
export async function isChampionOfTeam(
  userId: string,
  team: string,
): Promise<boolean> {
  const byTeam = await championsByTeam();
  const c = byTeam.get(team);
  return !!c && c.user_id === userId;
}

/**
 * Whether the given user_id is a champion of *any* team in the supplied set.
 * Handy for intervention pages where a champion can act if they own any one
 * of the linked workflows' teams.
 */
export async function isChampionOfAnyTeam(
  userId: string,
  teams: Iterable<string>,
): Promise<boolean> {
  const byTeam = await championsByTeam();
  for (const t of teams) {
    const c = byTeam.get(t);
    if (c && c.user_id === userId) return true;
  }
  return false;
}

/**
 * Replaces "@TeamName" tokens with markdown-style links to the team's
 * champion profile. The output is segments suitable for React rendering;
 * we don't dangerouslySetInnerHTML on user-supplied text.
 */
export type RenderedSegment =
  | { kind: "text"; value: string }
  | { kind: "mention"; team: string; href: string; champion: Champion | null };

export async function renderTeamMentions(
  text: string | null | undefined,
): Promise<RenderedSegment[]> {
  if (!text) return [];
  const byTeam = await championsByTeam();
  // Collect known team names sorted by length desc so "@Customer Ops" beats
  // "@Customer". Match team names case-insensitively, and only at a token
  // boundary so we don't match inside a longer word.
  const teamNames = [...byTeam.keys()].sort((a, b) => b.length - a.length);
  if (teamNames.length === 0) return [{ kind: "text", value: text }];

  const segments: RenderedSegment[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "@") {
      // Find next @ or end of string
      const next = text.indexOf("@", i);
      if (next === -1) {
        segments.push({ kind: "text", value: text.slice(i) });
        break;
      }
      segments.push({ kind: "text", value: text.slice(i, next) });
      i = next;
      continue;
    }

    // Try to match longest team starting at i+1.
    let matched: string | null = null;
    const after = text.slice(i + 1);
    for (const name of teamNames) {
      if (after.toLowerCase().startsWith(name.toLowerCase())) {
        const trailing = after.charAt(name.length);
        // Token boundary: end of string, whitespace, or punctuation
        if (!trailing || /[\s.,;:!?)\]\}]/.test(trailing)) {
          matched = name;
          break;
        }
      }
    }

    if (matched) {
      const champion = byTeam.get(matched) ?? null;
      segments.push({
        kind: "mention",
        team: matched,
        href: `/champions/${encodeURIComponent(matched)}`,
        champion,
      });
      i += 1 + matched.length;
    } else {
      segments.push({ kind: "text", value: "@" });
      i += 1;
    }
  }
  return segments;
}
