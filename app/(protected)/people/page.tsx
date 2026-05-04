import { format } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatar } from "@/lib/profile";
import { PageContainer, PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamFilter } from "./_components/team-filter";

const ALL_TEAMS = "all";

type PersonRow = {
  id: string;
  email: string;
  display_name: string;
  title: string;
  team: string;
  start_date: string | null;
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  await getSessionUser();
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("people")
    .select("id, email, display_name, title, team, start_date")
    .order("team", { ascending: true })
    .order("display_name", { ascending: true });

  if (teamParam && teamParam !== ALL_TEAMS) {
    query = query.eq("team", teamParam);
  }

  const [{ data: people }, { data: allTeamRows }, { count: totalCount }] =
    await Promise.all([
      query.returns<PersonRow[]>(),
      supabase.from("people").select("team"),
      supabase.from("people").select("*", { count: "exact", head: true }),
    ]);

  const rows = people ?? [];
  const teamOptions = Array.from(
    new Set((allTeamRows ?? []).map((r) => r.team).filter(Boolean) as string[]),
  ).sort();

  return (
    <PageContainer>
      <PageHeader
        title="People"
        description={
          teamParam && teamParam !== ALL_TEAMS
            ? `${rows.length} of ${totalCount ?? 0} people in ${teamParam}.`
            : `${totalCount ?? 0} people across the company.`
        }
        actions={
          <TeamFilter teams={teamOptions} value={teamParam ?? ALL_TEAMS} />
        }
      />

      <div className="rounded-lg border border-zinc-200 bg-white">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No people
            {teamParam && teamParam !== ALL_TEAMS
              ? ` for team "${teamParam}"`
              : ""}
            .
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
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveAvatar(null, row.email)}
                        alt={row.display_name}
                        className="size-7 rounded-full bg-zinc-50 object-cover ring-1 ring-zinc-200"
                      />
                      <span className="font-medium text-zinc-900">
                        {row.display_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-700">{row.title}</TableCell>
                  <TableCell className="text-zinc-700">{row.team}</TableCell>
                  <TableCell className="text-zinc-500">{row.email}</TableCell>
                  <TableCell className="text-zinc-500">
                    {row.start_date
                      ? format(new Date(row.start_date), "d MMM yyyy")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </PageContainer>
  );
}
