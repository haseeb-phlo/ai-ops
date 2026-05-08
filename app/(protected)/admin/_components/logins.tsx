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
  if (!lastSignIn) return "bg-zinc-300";
  const age = (now - new Date(lastSignIn).getTime()) / DAY;
  if (age < 7) return "bg-emerald-500";
  if (age < 30) return "bg-amber-500";
  return "bg-zinc-400";
}

/**
 * Recent logins table for the admin panel. Pulled from auth.users via the
 * recent_logins RPC. Joined with public.people on email so we can show
 * each user's display name + team alongside their last sign-in. Sorted
 * newest first; nulls (people who haven't signed in yet) drop to the end.
 *
 * Temporary surface until analytics are wired up - so it lives in its
 * own admin tab rather than being threaded into a richer dashboard.
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
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Total signed in" value={`${everSignedIn} / ${all.length}`} />
        <Stat label="Active in 7 days" value={last7d.toString()} />
        <Stat label="Never signed in" value={(all.length - everSignedIn).toString()} />
      </section>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-3 py-2">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
            Recent logins
          </h2>
          <p className="text-xs text-zinc-500">
            Pulled from auth.users.last_sign_in_at. Temporary view until
            analytics are attached.
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
                  className="text-center text-xs text-zinc-400"
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
                    <TableCell className="text-xs font-medium text-zinc-900">
                      {person?.display_name ?? <span className="text-zinc-400">-</span>}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-700">
                      {person?.team ?? <span className="text-zinc-400">-</span>}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      {r.email}
                    </TableCell>
                    <TableCell
                      className="text-xs text-zinc-500 tabular-nums"
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
                    <TableCell className="text-right text-xs text-zinc-500 tabular-nums">
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
        {value}
      </p>
    </div>
  );
}
