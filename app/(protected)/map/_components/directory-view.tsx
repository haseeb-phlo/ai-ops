import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { championsByDisplayName } from "@/lib/champions";
import { resolveAvatar } from "@/lib/profile";
import { PersonName } from "@/components/people/champion-mark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DirectorySearch } from "./directory-search";

type PersonRow = {
  id: string;
  email: string;
  display_name: string;
  title: string;
  team: string;
  start_date: string | null;
};

function escapeIlike(s: string): string {
  // Postgres ilike treats % and _ as wildcards; escape them so user input is
  // taken literally.
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Tabular directory view of `public.people`. Lives inside the People tab as
 * the "Directory" toggle.
 *
 * Rows whose email hasn't been used to sign in yet render dimmed with a
 * small "Not signed in" tag, so it's obvious at a glance who's actually
 * been onboarded into the platform.
 */
export async function DirectoryView({
  team,
  q,
}: {
  team: string | null;
  q: string | null;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("people")
    .select("id, email, display_name, title, team, start_date")
    .order("team", { ascending: true })
    .order("display_name", { ascending: true });

  if (team) {
    query = query.eq("team", team);
  }
  if (q && q.trim()) {
    const needle = `%${escapeIlike(q.trim())}%`;
    query = query.or(
      `display_name.ilike.${needle},email.ilike.${needle},title.ilike.${needle},team.ilike.${needle}`,
    );
  }

  const [
    { data: people },
    { count: totalCount },
    signedInRpc,
    userEmailsRpc,
    { data: profileRows },
  ] = await Promise.all([
    query.returns<PersonRow[]>(),
    supabase.from("people").select("*", { count: "exact", head: true }),
    supabase.rpc("signed_in_emails"),
    supabase.rpc("user_emails"),
    supabase
      .from("profiles")
      .select("user_id, avatar_url")
      .returns<{ user_id: string; avatar_url: string | null }[]>(),
  ]);

  const rows = people ?? [];
  const champByName = await championsByDisplayName();
  const signedInEmails = new Set<string>(
    Array.isArray(signedInRpc.data)
      ? (signedInRpc.data as string[]).map((e) => e.toLowerCase())
      : [],
  );

  // email → uploaded avatar_url, joining auth.users (via user_emails RPC)
  // to public.profiles. Without this the directory always showed the
  // generated Dicebear placeholder, even after someone had uploaded a
  // photo on their profile page.
  const avatarByEmail = new Map<string, string>();
  {
    const userIdToEmail = new Map<string, string>();
    for (const row of (userEmailsRpc.data ?? []) as Array<{
      user_id: string;
      email: string | null;
    }>) {
      if (row.email) userIdToEmail.set(row.user_id, row.email.toLowerCase());
    }
    for (const p of profileRows ?? []) {
      const email = userIdToEmail.get(p.user_id);
      if (email && p.avatar_url) avatarByEmail.set(email, p.avatar_url);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DirectorySearch defaultValue={q ?? ""} />
        <p className="text-xs text-zinc-500">
          {team
            ? `${rows.length} of ${totalCount ?? 0} people in ${team}.`
            : q
            ? `${rows.length} matching "${q}".`
            : `${totalCount ?? 0} people across the company.`}{" "}
          People who haven&apos;t signed in yet are dimmed.
        </p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No people{team ? ` for team "${team}"` : ""}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const champion =
                  champByName.get(row.display_name.trim().toLowerCase()) ??
                  null;
                const hasSignedIn = signedInEmails.has(
                  row.email.trim().toLowerCase(),
                );
                return (
                  <TableRow
                    key={row.id}
                    className={hasSignedIn ? undefined : "opacity-50"}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* Avatar - desaturated for un-signed-in entries. */}
                        <span className="relative inline-block shrink-0 size-7">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveAvatar(
                              avatarByEmail.get(row.email.trim().toLowerCase()) ?? null,
                              row.email,
                            )}
                            alt={row.display_name}
                            className={`h-full w-full rounded-full bg-zinc-50 object-cover ring-1 ${
                              champion
                                ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white"
                                : "ring-zinc-200"
                            } ${hasSignedIn ? "" : "grayscale"}`}
                          />
                          {champion && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 items-center rounded-full bg-amber-400 px-1 font-mono text-[7px] font-semibold leading-none tracking-tight text-white shadow-sm ring-1 ring-white"
                            >
                              AI
                            </span>
                          )}
                        </span>
                        {/* The avatar's corner badge already marks
                            champions; passing `champion={null}` suppresses
                            the inline badge so we don't render two AI
                            chips for the same person. */}
                        <PersonName
                          name={row.display_name}
                          champion={null}
                          muted={!hasSignedIn}
                        />
                        {!hasSignedIn && (
                          <span
                            className="text-[10px] font-medium uppercase tracking-wider text-zinc-400"
                            title="This person hasn't signed in to Phlo AI Ops yet"
                          >
                            Not signed in
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-700">
                      {row.title}
                    </TableCell>
                    <TableCell className="text-zinc-700">{row.team}</TableCell>
                    <TableCell className="text-zinc-500">{row.email}</TableCell>
                    <TableCell className="text-zinc-500">
                      {row.start_date
                        ? format(new Date(row.start_date), "d MMM yyyy")
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
