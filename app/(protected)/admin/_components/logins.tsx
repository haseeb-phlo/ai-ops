import { format, formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function freshnessDot(lastSignIn: string | null, now: number): string {
  if (!lastSignIn) return "bg-muted-foreground/60";
  const age = (now - new Date(lastSignIn).getTime()) / DAY;
  if (age < 7) return "bg-emerald-500";
  if (age < 30) return "bg-amber-500";
  return "bg-muted-foreground";
}

/**
 * Recent logins section inside the Audit tab. Pulled from auth.users via
 * the recent_logins RPC (super-admin gated at the function level). Joined
 * with public.people on email to show display name + team. Sorted newest
 * first; nulls (people who haven't signed in yet) drop to the end.
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Person</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead className="text-right">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {all.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-xs text-muted-foreground"
              >
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            all.map((r) => {
              const person = peopleByEmail.get(r.email.toLowerCase());
              return (
                <TableRow key={r.email}>
                  <TableCell>
                    <span
                      className={`inline-block size-2 rounded-full ${freshnessDot(r.last_sign_in_at, now)}`}
                      aria-hidden
                    />
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    {person?.display_name ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-xs text-foreground">
                    {person?.team ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.email}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground tabular-nums"
                    title={
                      r.last_sign_in_at
                        ? new Date(r.last_sign_in_at).toLocaleString()
                        : ""
                    }
                  >
                    {r.last_sign_in_at
                      ? formatDistanceToNow(new Date(r.last_sign_in_at), {
                          addSuffix: true,
                        })
                      : "never"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {r.created_at
                      ? format(new Date(r.created_at), "d MMM yyyy")
                      : "-"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
