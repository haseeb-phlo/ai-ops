import Link from "next/link";
import { loadChampions, type Champion } from "@/lib/champions";
import { resolveAvatar } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { ForwardLink } from "@/components/ui/nav-link";

/**
 * Compact horizontal strip showing every team's champion. Each ring is
 * tinted by check-in freshness so the row reads as an at-a-glance health
 * monitor for stewardship across the company.
 */
export async function ChampionsRibbon() {
  const champions: Champion[] = await loadChampions();
  if (champions.length === 0) return null;

  const userIds = champions
    .map((c) => c.user_id)
    .filter((u): u is string => !!u);

  let avatarByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("user_id, avatar_url")
      .in("user_id", userIds)
      .returns<{ user_id: string; avatar_url: string | null }[]>();
    avatarByUserId = new Map(
      (data ?? []).map((p) => [p.user_id, p.avatar_url]),
    );
  }

  // Server-render time is one moment per request; reading the wall clock here
  // is fine despite React 19's purity rule.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  function ringClass(lastCheckIn: string | null): string {
    if (!lastCheckIn) return "ring-zinc-300";
    const age = (now - new Date(lastCheckIn).getTime()) / 86_400_000;
    if (age < 14) return "ring-emerald-400";
    if (age < 30) return "ring-amber-400";
    return "ring-red-400";
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          AI Champions
        </h2>
        <ForwardLink href="/map?view=champions" className="text-xs">
          View all
        </ForwardLink>
      </div>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {champions.map((c) => {
          const seed = c.user_id ?? c.display_name;
          const src = resolveAvatar(
            c.user_id ? avatarByUserId.get(c.user_id) ?? null : null,
            seed,
          );
          const ring = ringClass(c.last_check_in);
          return (
            <li key={c.id}>
              <Link
                href={`/champions/${encodeURIComponent(c.team)}`}
                title={`${c.display_name} - ${c.team}${
                  c.last_check_in
                    ? ` - last check-in ${new Date(c.last_check_in).toLocaleDateString()}`
                    : " - no check-in yet"
                }`}
                className="group flex items-center gap-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={c.display_name}
                  className={`size-8 rounded-full bg-zinc-50 object-cover ring-2 ring-offset-1 ring-offset-white ${ring}`}
                />
                <span className="text-sm text-zinc-600 group-hover:text-zinc-900 group-hover:underline">
                  {c.team}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
