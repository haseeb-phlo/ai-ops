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
  type: InterventionType | null;
  status: Status | null;
  owner: string | null;
  created_at: string;
  intervention_workflows: { workflows: { id: string; name: string } | null }[];
};

type WorkflowOption = { id: string; name: string };

const TYPE_VARIANT: Record<InterventionType, "default" | "secondary" | "outline"> = {
  tool: "default",
  training: "secondary",
  prompt: "secondary",
  agent: "default",
  automation: "default",
  process_change: "outline",
};

const STATUS_STYLES: Record<Status, string> = {
  active: "bg-green-50 text-green-800 ring-green-200",
  paused: "bg-amber-50 text-amber-800 ring-amber-200",
  retired: "bg-zinc-100 text-zinc-600 ring-zinc-200",
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
      "id, name, type, status, owner, created_at, intervention_workflows(workflows(id, name))",
    )
    .order("created_at", { ascending: false });

  if (typeFilter) interventionsQuery = interventionsQuery.eq("type", typeFilter);
  if (statusFilter) interventionsQuery = interventionsQuery.eq("status", statusFilter);

  const [{ data: interventions }, { data: workflows }] = await Promise.all([
    interventionsQuery.returns<InterventionRow[]>(),
    supabase
      .from("workflows")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<WorkflowOption[]>(),
  ]);

  const rows = interventions ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            AI interventions
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tools, prompts, training, automations and process changes you&apos;ve
            shipped against workflows.
          </p>
        </div>
        <LogInterventionButton workflows={workflows ?? []} />
      </div>

      <Filters
        type={typeFilter}
        status={statusFilter}
        types={[...INTERVENTION_TYPES]}
        statuses={[...STATUSES]}
      />

      <div className="rounded-lg border border-zinc-200 bg-white">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">
            No interventions logged{typeFilter || statusFilter ? " for this filter" : " yet"}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workflows</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const linkedCount = row.intervention_workflows.filter(
                  (l) => l.workflows !== null,
                ).length;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-zinc-900">
                      <Link
                        href={`/interventions/${row.id}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.type ? (
                        <Badge variant={TYPE_VARIANT[row.type]}>
                          {row.type.replace("_", " ")}
                        </Badge>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.status ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-zinc-700">
                      {linkedCount}
                    </TableCell>
                    <TableCell className="text-zinc-700">
                      {row.owner ?? <span className="text-zinc-400">—</span>}
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {format(new Date(row.created_at), "d MMM yyyy")}
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
