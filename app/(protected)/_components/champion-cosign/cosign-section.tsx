import Link from "next/link";
import { format } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { championsByTeam } from "@/lib/champions";
import { createClient } from "@/lib/supabase/server";
import { CosignButton } from "./cosign-button";

type CosignRow = {
  intervention_id: string;
  team: string;
  signed_by_name: string | null;
  signed_at: string;
};

/**
 * Strip of co-sign stamps + per-team toggle buttons rendered on the
 * intervention detail page. `relevantTeams` should be the linked-workflow
 * teams (champions of those teams can co-sign).
 */
export async function CosignSection({
  interventionId,
  relevantTeams,
}: {
  interventionId: string;
  relevantTeams: string[];
}) {
  const user = await getSessionUser();
  const supabase = await createClient();
  const byTeam = await championsByTeam();

  const { data: cosigns } = await supabase
    .from("intervention_cosigns")
    .select("intervention_id, team, signed_by_name, signed_at")
    .eq("intervention_id", interventionId)
    .order("signed_at", { ascending: true })
    .returns<CosignRow[]>();

  const signedByTeam = new Map((cosigns ?? []).map((c) => [c.team, c]));
  const isSuper = user.role === "super_admin";
  const teamsUserCanSign = relevantTeams.filter((t) => {
    if (isSuper) return true;
    const c = byTeam.get(t);
    return c?.user_id === user.id;
  });

  if ((cosigns ?? []).length === 0 && teamsUserCanSign.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Champion co-signs
        </h2>
        <p className="text-xs text-zinc-400">
          A vouch from each affected team&apos;s champion.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        {(cosigns ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">
            Not yet co-signed by any team&apos;s champion.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {(cosigns ?? []).map((c) => {
              const champ = byTeam.get(c.team);
              const signer = c.signed_by_name ?? champ?.display_name ?? "Champion";
              return (
                <li key={c.team}>
                  <Link
                    href={`/champions/${encodeURIComponent(c.team)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-900 hover:bg-amber-100"
                    title={`Co-signed by ${signer} on ${format(new Date(c.signed_at), "d MMM yyyy")}`}
                  >
                    <span aria-hidden>⚡</span>
                    <span className="font-medium">{c.team}</span>
                    <span className="text-amber-700/80">· {signer}</span>
                    <span className="tabular-nums text-amber-700/70">
                      {format(new Date(c.signed_at), "d MMM")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {teamsUserCanSign.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
            {teamsUserCanSign.map((t) => (
              <CosignButton
                key={t}
                interventionId={interventionId}
                team={t}
                alreadySigned={signedByTeam.has(t)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
