import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { toTitle } from "@/lib/utils";
import { loadToolSuggestions } from "@/lib/tools";
import { Filters } from "./_components/filters";
import { LogInterventionButton } from "./_components/log-intervention-button";

const INTERVENTION_TYPES = [
  "tool",
  "training",
  "prompt",
  "agent",
  "automation",
  "process_change",
] as const;

const STATUSES = ["active", "paused", "retired"] as const;

type InterventionType = (typeof INTERVENTION_TYPES)[number];
type Status = (typeof STATUSES)[number];

type InterventionRow = {
  id: string;
  name: string;
  types: InterventionType[] | null;
  status: Status | null;
  owner: string | null;
  created_by: string | null;
  created_at: string;
  intervention_workflows: { workflows: { id: string; name: string } | null }[];
};

type WorkflowOption = { id: string; name: string };

type ProfileLite = { user_id: string; display_name: string | null };

const STATUS_DOT: Record<Status, string> = {
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  retired: "bg-muted-foreground/60",
};

export default async function InterventionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  await getSessionUser();
  const params = await searchParams;

  const typeFilter =
    params.type && (INTERVENTION_TYPES as readonly string[]).includes(params.type)
      ? (params.type as InterventionType)
      : null;
  const statusFilter =
    params.status && (STATUSES as readonly string[]).includes(params.status)
      ? (params.status as Status)
      : null;

  const supabase = await createClient();

  let interventionsQuery = supabase
    .from("ai_interventions")
    .select(
      "id, name, types, status, owner, created_by, created_at, intervention_workflows(workflows(id, name))",
    )
    .order("created_at", { ascending: false });

  if (typeFilter)
    interventionsQuery = interventionsQuery.contains("types", [typeFilter]);
  if (statusFilter) interventionsQuery = interventionsQuery.eq("status", statusFilter);

  const [
    { data: interventions },
    { data: workflows },
    { data: profiles },
    { data: directoryPeople },
  ] = await Promise.all([
    interventionsQuery.returns<InterventionRow[]>(),
    supabase
      .from("workflows")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<WorkflowOption[]>(),
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .returns<ProfileLite[]>(),
    supabase
      .from("people")
      .select("email, display_name, title, team")
      .order("display_name", { ascending: true })
      .returns<
        {
          email: string;
          display_name: string;
          title: string | null;
          team: string | null;
        }[]
      >(),
  ]);

  const rows = interventions ?? [];
  const displayNameByUserId = new Map<string, string>();
  for (const p of profiles ?? []) {
    const dn = p.display_name?.trim();
    if (dn) displayNameByUserId.set(p.user_id, dn);
  }

  const pickerPeople = (directoryPeople ?? []).map((p) => ({
    email: p.email,
    displayName: p.display_name,
    title: p.title,
    team: p.team,
  }));

  const toolSuggestions = await loadToolSuggestions(supabase);

  return (
    <PageContainer>
      <PageHeader
        title="AI Initiatives"
        description="Tools, prompts, training, automations, and process changes shipped against workflows."
        actions={
          <LogInterventionButton
            workflows={workflows ?? []}
            people={pickerPeople}
            toolSuggestions={toolSuggestions}
          />
        }
      />

      <Filters
        type={typeFilter}
        status={statusFilter}
        types={[...INTERVENTION_TYPES]}
        statuses={[...STATUSES]}
      />

      <div className="rounded-lg border border-border bg-background">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No AI initiatives{typeFilter || statusFilter ? " for this filter" : " logged yet"}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workflows</TableHead>
                <TableHead>Logged by</TableHead>
                <TableHead>Logged on</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const linkedCount = row.intervention_workflows.filter(
                  (l) => l.workflows !== null,
                ).length;
                const ownerName =
                  (row.created_by && displayNameByUserId.get(row.created_by)) ||
                  row.owner;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/interventions/${row.id}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.types && row.types.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.types.map((t) => (
                            <Badge key={t} variant="secondary">
                              {toTitle(t)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.status ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                          <span
                            aria-hidden
                            className={`size-1.5 rounded-full ${STATUS_DOT[row.status]}`}
                          />
                          {toTitle(row.status)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground">
                      {linkedCount}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {ownerName ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(row.created_at), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </PageContainer>
  );
}
