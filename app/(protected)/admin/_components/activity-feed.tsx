"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "./format";

type Source =
  | "ai_interventions"
  | "intervention_metrics"
  | "step_revisions"
  | "regulatory_events";

type Item = {
  key: string;
  source: Source;
  when: string;
  title: string;
  detail: string;
};

const SOURCES: Source[] = [
  "ai_interventions",
  "intervention_metrics",
  "step_revisions",
  "regulatory_events",
];

const PAGE = 50;

const SOURCE_LABEL: Record<Source, string> = {
  ai_interventions: "intervention",
  intervention_metrics: "metric",
  step_revisions: "step revision",
  regulatory_events: "regulatory",
};

const SOURCE_BADGE: Record<Source, string> = {
  ai_interventions: "bg-blue-50 text-blue-800 ring-blue-200",
  intervention_metrics: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  step_revisions: "bg-amber-50 text-amber-800 ring-amber-200",
  regulatory_events: "bg-red-50 text-red-800 ring-red-200",
};

type AnyRow = Record<string, unknown>;

function rowToItem(source: Source, row: AnyRow): Item | null {
  switch (source) {
    case "ai_interventions": {
      const id = String(row.id ?? "");
      const when = String(row.created_at ?? "");
      if (!id || !when) return null;
      return {
        key: `${source}:${id}`,
        source,
        when,
        title: String(row.name ?? "(unnamed)"),
        detail: `${row.type ?? "-"} · ${row.status ?? "-"}${
          row.owner ? ` · ${row.owner}` : ""
        }`,
      };
    }
    case "intervention_metrics": {
      const id = String(row.id ?? "");
      const when = String(row.created_at ?? row.snapshot_date ?? "");
      if (!id || !when) return null;
      const parts: string[] = [];
      if (row.time_value != null) parts.push(`time=${row.time_value}`);
      if (row.cost_value != null) parts.push(`cost=${row.cost_value}`);
      if (row.errors_value != null) parts.push(`errors=${row.errors_value}`);
      return {
        key: `${source}:${id}`,
        source,
        when,
        title: `Snapshot for ${String(row.intervention_id ?? "").slice(0, 8)}…`,
        detail: parts.join(" · ") || "(no values)",
      };
    }
    case "step_revisions": {
      const id = String(row.id ?? "");
      const when = String(row.changed_at ?? "");
      if (!id || !when) return null;
      return {
        key: `${source}:${id}`,
        source,
        when,
        title: `${row.field}: ${trimVal(row.old_value)} → ${trimVal(row.new_value)}`,
        detail: `step ${String(row.step_id ?? "").slice(0, 8)}… · ${
          row.changed_by_email ?? "(unknown)"
        }`,
      };
    }
    case "regulatory_events": {
      const id = String(row.id ?? "");
      const when = String(row.created_at ?? "");
      if (!id || !when) return null;
      return {
        key: `${source}:${id}`,
        source,
        when,
        title: String(row.summary ?? "(no summary)"),
        detail: `${row.severity ?? "-"} · ${
          row.resolved_at ? "resolved" : "open"
        }`,
      };
    }
  }
}

function trimVal(v: unknown): string {
  if (v == null) return "∅";
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

export function ActivityFeed() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLLIElement | null>(null);
  const oldestRef = useRef<Record<Source, string | null>>({
    ai_interventions: null,
    intervention_metrics: null,
    step_revisions: null,
    regulatory_events: null,
  });

  // Initial load + realtime subscription.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const all = await fetchPage(supabase, oldestRef.current);
      if (cancelled) return;
      setItems(merge([], all.items));
      oldestRef.current = all.oldest;
      setHasMore(all.items.length > 0);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("admin-activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_interventions" },
        (payload) => prepend("ai_interventions", payload.new as AnyRow),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "intervention_metrics" },
        (payload) => prepend("intervention_metrics", payload.new as AnyRow),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "step_revisions" },
        (payload) => prepend("step_revisions", payload.new as AnyRow),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "regulatory_events" },
        (payload) => prepend("regulatory_events", payload.new as AnyRow),
      )
      .subscribe();

    function prepend(source: Source, row: AnyRow) {
      const item = rowToItem(source, row);
      if (!item) return;
      setItems((prev) => {
        if (prev.some((p) => p.key === item.key)) return prev;
        return [item, ...prev];
      });
    }

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Infinite scroll.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const supabase = createClient();
    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || loading || !hasMore) return;
        setLoading(true);
        const next = await fetchPage(supabase, oldestRef.current);
        if (next.items.length === 0) {
          setHasMore(false);
        } else {
          setItems((prev) => merge(prev, next.items));
          oldestRef.current = next.oldest;
        }
        setLoading(false);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMore]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Live activity
        </p>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          realtime
        </span>
      </div>
      <ol className="max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto">
        {items.length === 0 && !loading && (
          <li className="px-3 py-8 text-center text-xs text-zinc-400">
            No activity yet.
          </li>
        )}
        {items.map((item) => (
          <li
            key={item.key}
            className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-3 py-2 text-xs"
          >
            <span
              className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${SOURCE_BADGE[item.source]}`}
            >
              {SOURCE_LABEL[item.source]}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-zinc-900">{item.title}</p>
              <p className="truncate text-zinc-500">{item.detail}</p>
            </div>
            <time
              className="shrink-0 tabular-nums text-zinc-400"
              dateTime={item.when}
              title={new Date(item.when).toLocaleString()}
            >
              {relativeTime(item.when)}
            </time>
          </li>
        ))}
        <li ref={sentinelRef} className="py-2 text-center text-[10px] text-zinc-400">
          {loading ? "Loading…" : hasMore ? "Scroll for more" : "End of feed"}
        </li>
      </ol>
    </div>
  );
}

function merge(prev: Item[], add: Item[]): Item[] {
  const seen = new Set(prev.map((p) => p.key));
  const combined = [...prev];
  for (const a of add) {
    if (!seen.has(a.key)) {
      combined.push(a);
      seen.add(a.key);
    }
  }
  combined.sort((a, b) => b.when.localeCompare(a.when));
  return combined;
}

type SupabaseClient = ReturnType<typeof createClient>;

async function fetchPage(
  supabase: SupabaseClient,
  oldest: Record<Source, string | null>,
): Promise<{
  items: Item[];
  oldest: Record<Source, string | null>;
}> {
  const queries = await Promise.all(
    SOURCES.map(async (source) => {
      const tsCol =
        source === "step_revisions" ? "changed_at" : "created_at";
      let q = supabase
        .from(source)
        .select("*")
        .order(tsCol, { ascending: false })
        .limit(PAGE);
      const cursor = oldest[source];
      if (cursor) {
        q = q.lt(tsCol, cursor);
      }
      const { data } = await q;
      return { source, rows: (data ?? []) as AnyRow[], tsCol };
    }),
  );

  const items: Item[] = [];
  const newOldest: Record<Source, string | null> = { ...oldest };
  for (const { source, rows, tsCol } of queries) {
    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      const lastTs = last[tsCol];
      if (typeof lastTs === "string") newOldest[source] = lastTs;
    }
    for (const row of rows) {
      const item = rowToItem(source, row);
      if (item) items.push(item);
    }
  }
  // Keep newest 50 from across sources for this page.
  items.sort((a, b) => b.when.localeCompare(a.when));
  return { items: items.slice(0, PAGE), oldest: newOldest };
}
