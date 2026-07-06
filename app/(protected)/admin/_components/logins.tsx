import { createClient } from "@/lib/supabase/server";
import { LoginsTable, type LoginTableRow } from "./logins-table";

type LoginRow = {
  email: string;
  last_sign_in_at: string | null;
  created_at: string | null;
};

type PersonRow = {
  email: string;
  display_name: string;
  team: string;
};

const DAY = 86_400_000;

/**
 * Recent logins section inside the Audit tab. Pulled from auth.users via
 * the recent_logins RPC (super-admin gated at the function level). Joined
 * with public.people on email to show display name + team. Sorted newest
 * first; nulls (people who haven't signed in yet) drop to the end.
 * Rendering + client-side filtering live in LoginsTable.
 */
export async function Logins() {
  const supabase = await createClient();
  const [loginsRes, peopleRes] = await Promise.all([
    supabase.rpc("recent_logins"),
    supabase
      .from("people")
      .select("email, display_name, team")
      .returns<PersonRow[]>(),
  ]);

  // Supabase's typed client returns a union with an `Error` shape for RPCs
  // it can't introspect; cast through the source-of-truth shape we know
  // the security-definer function returns.
  const all: LoginRow[] = Array.isArray(loginsRes.data)
    ? (loginsRes.data as LoginRow[])
    : [];
  const people = peopleRes.data ?? [];

  const peopleByEmail = new Map<string, PersonRow>();
  for (const p of people) {
    peopleByEmail.set(p.email.trim().toLowerCase(), p);
  }

  // Single render = single request; one wall-clock read is fine here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const everSignedIn = all.filter((r) => r.last_sign_in_at != null).length;
  const last7d = all.filter((r) => {
    if (!r.last_sign_in_at) return false;
    return now - new Date(r.last_sign_in_at).getTime() < 7 * DAY;
  }).length;

  const rows: LoginTableRow[] = all.map((r) => {
    const person = peopleByEmail.get(r.email.toLowerCase());
    return {
      email: r.email,
      displayName: person?.display_name ?? null,
      team: person?.team ?? null,
      lastSignInAt: r.last_sign_in_at,
      createdAt: r.created_at,
    };
  });

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Sign-ins
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {everSignedIn} of {all.length} have signed in. {last7d} active in the
          last 7 days.
        </p>
      </div>
      <LoginsTable rows={rows} />
    </div>
  );
}
