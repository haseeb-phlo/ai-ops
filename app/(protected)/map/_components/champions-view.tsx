import Link from "next/link";
import { loadChampions } from "@/lib/champions";
import { resolveAvatar } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const DOT = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  none: "bg-muted-foreground/60",
} as const;

export async function ChampionsView() {
  const champions = await loadChampions();

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

  if (champions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background px-6 py-16 text-center text-sm text-muted-foreground">
        No champions registered yet. A super-admin can assign one from /admin.
      </div>
    );
  }

  // Server render = single request, fine to read the wall clock once here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  function status(lastCheckIn: string | null) {
    if (!lastCheckIn) {
      return { tone: "none" as const, days: null };
    }
    const days = Math.floor(
      (now - new Date(lastCheckIn).getTime()) / 86_400_000,
    );
    const tone =
      days < 14 ? ("green" as const) : days < 30 ? ("amber" as const) : ("red" as const);
    return { tone, days };
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {champions.map((c) => {
        const s = status(c.last_check_in);
        const seed = c.user_id ?? c.display_name;
        const avatarSrc = resolveAvatar(
          c.user_id ? avatarByUserId.get(c.user_id) ?? null : null,
          seed,
        );
        return (
          <Link
            key={c.id}
            href={`/champions/${encodeURIComponent(c.team)}`}
            className="group flex min-h-44 flex-col gap-5 rounded-lg border border-border bg-background p-6 hover:border-input"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <span
                  className="relative inline-block shrink-0"
                  style={{ width: 44, height: 44 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt={c.display_name}
                    className="h-full w-full rounded-full bg-muted/40 object-cover ring-1 ring-border"
                  />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="truncate text-sm font-semibold text-foreground group-hover:underline">
                    {c.display_name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    AI Champion of {c.team}
                  </div>
                </div>
              </div>

              <span
                className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
                title={
                  c.last_check_in
                    ? `Last check-in ${new Date(c.last_check_in).toLocaleDateString()}`
                    : "No check-ins recorded yet"
                }
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${DOT[s.tone]}`}
                />
                {s.days == null ? "-" : `${s.days}d`}
              </span>
            </div>

            {(c.blurb || c.chewing_on) && (
              <div className="space-y-3">
                {c.blurb && (
                  <p className="line-clamp-3 text-sm text-foreground">
                    {c.blurb}
                  </p>
                )}
                {c.chewing_on && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Chewing on:
                    </span>{" "}
                    {c.chewing_on}
                  </p>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
