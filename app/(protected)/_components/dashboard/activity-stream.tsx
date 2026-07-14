import Link from "next/link";
import {
  Lightbulb,
  MessageSquare,
  Play,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Time } from "@/components/ui/time";

export type StreamItem =
  | {
      kind: "intervention";
      id: string;
      name: string;
      status: string | null;
      at: string;
      createdBy: string | null;
    }
  | {
      kind: "regulatory";
      id: string;
      summary: string;
      severity: "red" | "amber" | "green";
      at: string;
      workflowId: string | null;
      createdBy: string | null;
    }
  | {
      kind: "workflow";
      id: string;
      name: string;
      team: string | null;
      at: string;
      createdBy: string | null;
    }
  | {
      kind: "suggestion";
      id: string;
      title: string;
      body: string;
      team: string | null;
      submittedBy: string | null;
      at: string;
    }
  | {
      kind: "suggestion-comment";
      id: string;
      suggestionId: string;
      suggestionTitle: string;
      body: string;
      commenter: string | null;
      at: string;
    }
  | {
      kind: "learn-video";
      id: string;
      title: string;
      addedBy: string | null;
      at: string;
    };

export function ActivityStream({ items }: { items: StreamItem[] }) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted-foreground">
        Quiet week. Nothing new logged.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((it) => (
        <li key={`${it.kind}:${it.id}`} className="px-4 py-3 text-sm">
          {it.kind === "intervention" && (
            <Row
              icon={<Glyph kind="intervention" />}
              title={
                <Link
                  href={`/interventions/${it.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {it.name}
                </Link>
              }
              meta={[
                "New AI initiative",
                it.createdBy ? `by ${it.createdBy}` : null,
                it.status ? `status: ${it.status}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              at={it.at}
            />
          )}
          {it.kind === "regulatory" && (
            <Row
              icon={<RegDot severity={it.severity} />}
              title={
                it.workflowId ? (
                  <Link
                    href={`/workflows/${it.workflowId}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {it.summary}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    {it.summary}
                  </span>
                )
              }
              meta={[
                "Regulatory event",
                SEVERITY_LABEL[it.severity],
                it.createdBy ? `by ${it.createdBy}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              at={it.at}
            />
          )}
          {it.kind === "workflow" && (
            <Row
              icon={<Glyph kind="workflow" />}
              title={
                <Link
                  href={`/workflows/${it.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {it.name}
                </Link>
              }
              meta={[
                "New workflow",
                it.createdBy ? `by ${it.createdBy}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              at={it.at}
            />
          )}
          {it.kind === "suggestion" && (
            <Row
              icon={<Glyph kind="suggestion" />}
              title={
                <Link
                  href={`/suggestions/${it.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {it.title}
                </Link>
              }
              meta={[
                "New suggestion",
                it.submittedBy ? `by ${it.submittedBy}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              at={it.at}
            />
          )}
          {it.kind === "suggestion-comment" && (
            <Row
              icon={<Glyph kind="suggestion-comment" />}
              title={
                <Link
                  href={`/suggestions/${it.suggestionId}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {it.suggestionTitle}
                </Link>
              }
              meta={[
                it.commenter
                  ? `Comment by ${it.commenter}`
                  : "New comment",
                truncate(it.body, 120),
              ]
                .filter(Boolean)
                .join(" · ")}
              at={it.at}
            />
          )}
          {it.kind === "learn-video" && (
            <Row
              icon={<Glyph kind="learn-video" />}
              title={
                <Link
                  href="/learn"
                  className="font-medium text-foreground hover:underline"
                >
                  {it.title}
                </Link>
              }
              meta={[
                "New training video",
                it.addedBy ? `by ${it.addedBy}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              at={it.at}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({
  icon,
  title,
  meta,
  at,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  meta: string;
  at: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title}
          <Time
            iso={at}
            relative
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          />
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

type GlyphKind =
  | "intervention"
  | "workflow"
  | "suggestion"
  | "suggestion-comment"
  | "learn-video";

// Decorative entity icons - each row's meta text already names the entity
// ("New workflow", "New suggestion", …), so the chips stay aria-hidden.
// One brand hue for every kind: identity is carried by the icon's shape,
// not a per-kind colour, so the stream reads calm instead of confetti.
const GLYPHS: Record<GlyphKind, LucideIcon> = {
  intervention: Sparkles,
  workflow: Workflow,
  suggestion: Lightbulb,
  "suggestion-comment": MessageSquare,
  "learn-video": Play,
};

function Glyph({ kind }: { kind: GlyphKind }) {
  const Icon = GLYPHS[kind];
  return (
    <span
      aria-hidden
      className="flex size-5 items-center justify-center rounded-full bg-secondary/60 text-primary"
    >
      <Icon className="size-3" />
    </span>
  );
}

// Text severity accompanies the colour dot so the signal survives
// colour-blindness and screen readers.
const SEVERITY_LABEL: Record<"red" | "amber" | "green", string> = {
  red: "High severity",
  amber: "Medium severity",
  green: "Low severity",
};

function RegDot({ severity }: { severity: "red" | "amber" | "green" }) {
  const cls =
    severity === "red"
      ? "bg-rose-500"
      : severity === "amber"
      ? "bg-amber-500"
      : "bg-emerald-500";
  return (
    <span className="mt-1.5 inline-block size-2.5 rounded-full" aria-hidden>
      <span className={`block h-full w-full rounded-full ${cls}`} />
    </span>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
