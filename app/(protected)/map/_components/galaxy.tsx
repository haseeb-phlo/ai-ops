"use client";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================
export type GalaxyData = {
  viewerId: string;
  teams: { id: string; name: string }[];
  people: {
    id: string;
    name: string;
    title: string | null;
    avatarUrl: string;
    team: string | null;
    kind: "user" | "ghost";
    isChampion?: boolean;
    championTeam?: string | null;
  }[];
  workflows: {
    id: string;
    rawId: string;
    name: string;
    team: string | null;
    regulatory: boolean;
    frequencyPerWeek: number;
    criticality: number;
    activeInterventions: number;
    ownerIds: string[];
  }[];
  history: {
    workflowId: string;
    date: string;
    metric: string;
    value: number;
  }[];
};

type NodeKind = "company" | "team" | "person" | "workflow";

type Node = SimulationNodeDatum & {
  id: string;
  kind: NodeKind;
  label: string;
  radius: number;
  team: string | null;
  meta: Record<string, unknown>;
};

type Link = SimulationLinkDatum<Node> & {
  kind: "company-team" | "team-person" | "person-workflow" | "team-workflow";
};

const COMPANY_ID = "company:phlo";

const HEAT_OPTIONS = [
  {
    value: "criticality",
    label: "Criticality",
    unit: "/ 5",
    direction: "lower",
  },
  { value: "time", label: "Time per run", unit: "min", direction: "lower" },
  { value: "cost", label: "Cost per run", unit: "£", direction: "lower" },
  { value: "errors", label: "Error rate", unit: "%", direction: "lower" },
  { value: "revenue", label: "Revenue per run", unit: "£", direction: "higher" },
  {
    value: "interventions",
    label: "Active AI interventions",
    unit: "",
    direction: "higher",
  },
] as const;
type Heat = (typeof HEAT_OPTIONS)[number]["value"];

const FRESH_DAYS = 14;
const STALE_DAYS = 60;

// =============================================================================
// Component
// =============================================================================
export function Galaxy({ data }: { data: GalaxyData }) {
  // --- Filters / mode state ------------------------------------------------
  const [heat, setHeat] = useState<Heat>("criticality");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Latest history snapshot date drives heat colour. The galaxy now always
  // reflects the most recent state - the date scrubber was removed because
  // it added a dense control without a clear "what changed?" payoff for
  // users with limited history.
  const latestDate = useMemo(() => {
    let max: string | null = null;
    for (const h of data.history) {
      if (!max || h.date > max) max = h.date;
    }
    return max;
  }, [data.history]);

  // history[metric][workflowId][date] = value
  const historyIndex = useMemo(() => {
    const idx: Record<string, Record<string, Record<string, number>>> = {};
    for (const h of data.history) {
      if (!idx[h.metric]) idx[h.metric] = {};
      if (!idx[h.metric][h.workflowId]) idx[h.metric][h.workflowId] = {};
      idx[h.metric][h.workflowId][h.date] = h.value;
    }
    return idx;
  }, [data.history]);

  // Per-metric min/max at each date, precomputed for fast colour scaling.
  const heatRange = useMemo(() => {
    const out: Record<string, Record<string, { min: number; max: number }>> = {};
    for (const h of data.history) {
      if (!out[h.metric]) out[h.metric] = {};
      const slot = out[h.metric][h.date];
      if (!slot) {
        out[h.metric][h.date] = { min: h.value, max: h.value };
      } else {
        if (h.value < slot.min) slot.min = h.value;
        if (h.value > slot.max) slot.max = h.value;
      }
    }
    return out;
  }, [data.history]);

  // --- Build graph (nodes + links) ----------------------------------------
  const { nodes, links } = useMemo(() => buildGraph(data), [data]);

  // --- Avatar image preloading --------------------------------------------
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    for (const p of data.people) {
      if (imagesRef.current.has(p.id)) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = p.avatarUrl;
      imagesRef.current.set(p.id, img);
    }
  }, [data.people]);

  // --- Canvas setup -------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Initial zoom is intentionally < 1 so the whole galaxy fits on screen on
  // first paint. Once the simulation settles, the draw loop refines this with
  // a one-shot fit-to-bbox so the map is framed regardless of size.
  const transformRef = useRef({ x: 0, y: 0, k: 0.65 });
  const hasAutoFitRef = useRef(false);
  // Tracks whether the user has manually panned/zoomed since the last
  // auto-fit attempt. The fit-to-bbox in the draw loop is gated on this so
  // we never yank the camera away from a viewport the user is actively
  // exploring.
  const userInteractedRef = useRef(false);
  const simRef = useRef<Simulation<Node, Link> | null>(null);

  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Simulation lifecycle ------------------------------------------------
  useEffect(() => {
    // Stop previous sim if any
    simRef.current?.stop();

    const sim = forceSimulation<Node>(nodes)
      .force(
        "link",
        forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance((l) => {
            switch (l.kind) {
              case "company-team":
                return 320;
              case "team-person":
                return 110;
              case "person-workflow":
                return 70;
              case "team-workflow":
                return 140;
            }
          })
          .strength(0.6),
      )
      .force("charge", forceManyBody<Node>().strength((n) => {
        if (n.kind === "company") return -1200;
        if (n.kind === "team") return -600;
        if (n.kind === "person") return -180;
        return -90;
      }))
      .force("center", forceCenter(0, 0).strength(0.05))
      .force("collide", forceCollide<Node>().radius((n) => n.radius + 6).iterations(2))
      .alpha(1)
      .alphaDecay(0.03);

    // Pin the company at the origin
    const company = nodes.find((n) => n.id === COMPANY_ID);
    if (company) {
      company.fx = 0;
      company.fy = 0;
    }

    simRef.current = sim;
    // New nodes/links → re-trigger the one-shot auto-fit on the next settle.
    hasAutoFitRef.current = false;
    userInteractedRef.current = false;
    return () => {
      sim.stop();
    };
  }, [nodes, links]);

  // --- Draw loop ----------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = size.w;
      const h = size.h;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Once the simulation has cooled, fit the bounding box of all nodes to
      // the viewport (with padding) so the whole map is visible on first
      // glance. Runs once per nodes/links change, and skipped entirely if
      // the user has already panned/zoomed - otherwise the fit would yank
      // the camera away from the viewport they're exploring.
      if (
        !hasAutoFitRef.current &&
        !userInteractedRef.current &&
        simRef.current &&
        simRef.current.alpha() < 0.05
      ) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of nodes) {
          if (typeof n.x !== "number" || typeof n.y !== "number") continue;
          minX = Math.min(minX, n.x - n.radius);
          minY = Math.min(minY, n.y - n.radius);
          maxX = Math.max(maxX, n.x + n.radius);
          maxY = Math.max(maxY, n.y + n.radius);
        }
        const bboxW = maxX - minX;
        const bboxH = maxY - minY;
        if (bboxW > 0 && bboxH > 0 && w > 0 && h > 0) {
          const padding = 0.85;
          const fitK = Math.min(w / bboxW, h / bboxH) * padding;
          const clampedK = Math.max(0.3, Math.min(3, fitK));
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          transformRef.current.k = clampedK;
          transformRef.current.x = -cx * clampedK;
          transformRef.current.y = -cy * clampedK;
          hasAutoFitRef.current = true;
        }
      }

      const { x: tx, y: ty, k } = transformRef.current;

      // White background to match the rest of the platform.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      ctx.translate(w / 2 + tx, h / 2 + ty);
      ctx.scale(k, k);

      const scrubDate = latestDate ?? undefined;
      const heatScales = computeHeatScales(heat, scrubDate, heatRange);
      const subgraph = getHighlightedIds(selectedId ?? hoveredId, nodes, links);
      const isFiltered = teamFilter !== "all";

      // Per-frame: value of the active heat metric, per workflow, at the
      // most-recent snapshot date. Drives workflow node colour.
      const heatValues = new Map<string, number | null>();
      const freshness = new Map<string, "fresh" | "stale" | "none">();
      for (const n of nodes) {
        if (n.kind !== "workflow") continue;
        heatValues.set(
          n.id,
          heatValueForWorkflow(heat, n.id, scrubDate, n.meta, historyIndex),
        );
        freshness.set(
          n.id,
          freshnessFor(heat, n.id, scrubDate, historyIndex),
        );
      }

      // 1. Edges
      for (const link of links) {
        const s = link.source as Node;
        const t = link.target as Node;
        if (typeof s.x !== "number" || typeof t.x !== "number") continue;

        const inSub = subgraph
          ? subgraph.has(s.id) && subgraph.has(t.id)
          : true;
        const inTeam = !isFiltered
          ? true
          : touchesTeam(s, teamFilter) && touchesTeam(t, teamFilter);
        const dim = !inSub || !inTeam;

        ctx.strokeStyle = dim ? "rgba(24,24,27,0.06)" : "rgba(24,24,27,0.22)";
        ctx.lineWidth = dim ? 0.6 : 1;
        ctx.beginPath();
        ctx.moveTo(s.x!, s.y!);
        ctx.lineTo(t.x!, t.y!);
        ctx.stroke();
      }

      // 2. Nodes
      for (const n of nodes) {
        if (typeof n.x !== "number" || typeof n.y !== "number") continue;

        const inSub = subgraph ? subgraph.has(n.id) : true;
        const inTeam = !isFiltered
          ? true
          : touchesTeam(n, teamFilter);
        const dim = !inSub || !inTeam;
        const isHover = n.id === hoveredId || n.id === selectedId;

        ctx.globalAlpha = dim ? 0.18 : 1;
        drawNode(ctx, n, {
          heat,
          heatScales,
          heatValue: heatValues.get(n.id) ?? null,
          freshness: freshness.get(n.id) ?? "none",
          activeInterventions:
            (n.meta.activeInterventions as number | undefined) ?? 0,
          imageMap: imagesRef.current,
          isHover,
        });
        ctx.globalAlpha = 1;
      }

      // 3. Labels for hovered/selected/teams
      ctx.font = "12px ui-sans-serif, system-ui, -apple-system";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const n of nodes) {
        const showLabel =
          n.kind === "company" ||
          n.kind === "team" ||
          n.id === hoveredId ||
          n.id === selectedId;
        if (!showLabel) continue;
        if (typeof n.x !== "number") continue;

        const inSub = subgraph ? subgraph.has(n.id) : true;
        const inTeam = !isFiltered ? true : touchesTeam(n, teamFilter);
        ctx.globalAlpha = !inSub || !inTeam ? 0.3 : 1;
        ctx.fillStyle = "#18181b";
        ctx.fillText(n.label, n.x!, n.y! + n.radius + 6);
        ctx.globalAlpha = 1;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [
    nodes,
    links,
    size,
    heat,
    heatRange,
    historyIndex,
    teamFilter,
    hoveredId,
    selectedId,
    data,
    latestDate,
  ]);

  // --- Pan / zoom / hover / click -----------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function screenToWorld(sx: number, sy: number) {
      const { x: tx, y: ty, k } = transformRef.current;
      const wx = (sx - size.w / 2 - tx) / k;
      const wy = (sy - size.h / 2 - ty) / k;
      return { x: wx, y: wy };
    }

    function pickNode(sx: number, sy: number): Node | null {
      const { x, y } = screenToWorld(sx, sy);
      let best: Node | null = null;
      let bestD = Infinity;
      for (const n of nodes) {
        if (typeof n.x !== "number") continue;
        const dx = n.x - x;
        const dy = n.y! - y;
        const d2 = dx * dx + dy * dy;
        const r2 = (n.radius + 4) * (n.radius + 4);
        if (d2 < r2 && d2 < bestD) {
          bestD = d2;
          best = n;
        }
      }
      return best;
    }

    function onMouseDown(e: MouseEvent) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      userInteractedRef.current = true;
    }
    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (dragging) {
        transformRef.current.x += e.clientX - lastX;
        transformRef.current.y += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        const node = pickNode(sx, sy);
        const next = node?.id ?? null;
        setHoveredId((prev) => (prev === next ? prev : next));
      }
    }
    function onMouseUp() {
      dragging = false;
    }
    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const node = pickNode(e.clientX - rect.left, e.clientY - rect.top);
      setSelectedId((prev) => {
        if (!node) return null;
        return prev === node.id ? null : node.id;
      });
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const t = transformRef.current;
      const newK = Math.max(0.3, Math.min(3, t.k * (1 + delta)));
      // Zoom toward cursor
      const rect = canvas!.getBoundingClientRect();
      const cx = e.clientX - rect.left - size.w / 2;
      const cy = e.clientY - rect.top - size.h / 2;
      const ratio = newK / t.k;
      t.x = cx - (cx - t.x) * ratio;
      t.y = cy - (cy - t.y) * ratio;
      t.k = newK;
      userInteractedRef.current = true;
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, size]);

  // --- Detail card content -------------------------------------------------
  const focusId = selectedId ?? hoveredId;
  const focusNode = focusId ? nodes.find((n) => n.id === focusId) ?? null : null;

  return (
    <div className="flex flex-col flex-1">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-zinc-50 px-6 py-2 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-zinc-500">Colour by</span>
          <select
            value={heat}
            onChange={(e) => setHeat(e.target.value as Heat)}
            className="h-7 rounded-md border border-zinc-300 bg-white px-2"
          >
            {HEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-zinc-500">Team</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-7 rounded-md border border-zinc-300 bg-white px-2"
          >
            <option value="all">All teams</option>
            {data.teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-zinc-400">
          Drag to pan · Click a node to focus
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          style={{
            width: size.w,
            height: size.h,
            cursor: hoveredId ? "pointer" : "grab",
          }}
        />

        {/* Floating zoom controls. Bottom-right is the canonical place for
            map-canvas controls (Google Maps / Mapbox / Figma) - frees the
            top toolbar for filter widgets. */}
        <div
          role="group"
          aria-label="Zoom"
          className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white/95 shadow-sm backdrop-blur"
        >
          <ZoomButton
            label="Zoom in"
            onClick={() => {
              zoomBy(transformRef, 1.3);
              userInteractedRef.current = true;
            }}
          >
            +
          </ZoomButton>
          <span aria-hidden className="h-px bg-zinc-200" />
          <ZoomButton
            label="Zoom out"
            onClick={() => {
              zoomBy(transformRef, 1 / 1.3);
              userInteractedRef.current = true;
            }}
          >
            −
          </ZoomButton>
          <span aria-hidden className="h-px bg-zinc-200" />
          <ZoomButton
            label="Fit to screen"
            onClick={() => {
              resetZoom(transformRef);
              hasAutoFitRef.current = false;
              userInteractedRef.current = false;
            }}
          >
            ⌖
          </ZoomButton>
        </div>

        <Legend
          heat={heat}
          range={
            (heat === "criticality"
              ? { min: 1, max: 5 }
              : heat === "interventions"
                ? { min: 0, max: 1 }
                : latestDate
                  ? heatRange[heat]?.[latestDate]
                  : null) ?? null
          }
        />

        {/* Detail card */}
        {focusNode && (
          <DetailCard node={focusNode} data={data} onClose={() => setSelectedId(null)} />
        )}

        {/* Empty state */}
        {data.workflows.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-700 shadow-sm max-w-sm">
              <p className="font-medium">The galaxy is empty.</p>
              <p className="mt-1 text-zinc-500">
                Apply <code>supabase/seed.sql</code> in the Supabase SQL Editor
                or add a workflow at <code>/workflows</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Legend
// =============================================================================
function Legend({
  heat,
  range,
}: {
  heat: Heat;
  range: { min: number; max: number } | null;
}) {
  const opt = HEAT_OPTIONS.find((o) => o.value === heat);
  const heatLabel = opt?.label ?? heat;
  const direction = opt?.direction ?? "lower";
  const unit = opt?.unit ?? "";

  // Direction = "lower" means lower-is-better, so the green end labels the
  // minimum and the red end labels the maximum. Reverse for "higher".
  const lo = range
    ? formatRange(range.min, unit)
    : direction === "lower"
      ? "Good"
      : "Bad";
  const hi = range
    ? formatRange(range.max, unit)
    : direction === "lower"
      ? "Bad"
      : "Good";
  const goodLabel = direction === "lower" ? lo : hi;
  const badLabel = direction === "lower" ? hi : lo;
  const gradient =
    direction === "lower"
      ? "linear-gradient(to right, rgb(22,163,74), rgb(217,119,6), rgb(220,38,38))"
      : "linear-gradient(to right, rgb(220,38,38), rgb(217,119,6), rgb(22,163,74))";

  return (
    <div className="absolute right-4 top-4 w-[240px] rounded-lg border border-zinc-200 bg-white/90 text-xs text-zinc-700 shadow-sm backdrop-blur">
      <LegendSection title={heatLabel}>
        <div
          className="h-1.5 w-full rounded-full"
          style={{ background: gradient }}
        />
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-zinc-500">
          <span>{goodLabel}</span>
          <span>{badLabel}</span>
        </div>
      </LegendSection>

      <LegendSection title="Freshness">
        <ul className="space-y-1">
          <LegendRow
            swatch={
              <span className="inline-block size-2 rounded-full ring-1 ring-zinc-700/70" />
            }
            label={`Fresh (≤${FRESH_DAYS}d)`}
          />
          <LegendRow
            swatch={
              <span
                className="inline-block size-2 rounded-full"
                style={{ border: "1px dashed rgba(24,24,27,0.55)" }}
              />
            }
            label={`Stale (${FRESH_DAYS}-${STALE_DAYS}d)`}
          />
          <LegendRow
            swatch={<span className="inline-block size-2 rounded-full bg-zinc-300" />}
            label="No measurement"
          />
        </ul>
      </LegendSection>

      <LegendSection title="Nodes">
        <ul className="space-y-1">
          <LegendRow
            swatch={<Swatch fill="#18181b" size={10} />}
            label="Phlo"
          />
          <LegendRow
            swatch={<Swatch fill="#e4e4e7" stroke="#52525b" size={10} />}
            label="Team"
          />
          <LegendRow
            swatch={<Swatch fill="#a1a1aa" stroke="#71717a" size={9} />}
            label="Person"
          />
          <LegendRow
            swatch={
              <Swatch fill="#16a34a" stroke="rgba(24,24,27,0.4)" size={9} />
            }
            label="Workflow"
          />
        </ul>
      </LegendSection>

      <LegendSection title="Markers" last>
        <ul className="space-y-1">
          <LegendRow
            swatch={<Swatch fill="#16a34a" ring="#9333ea" size={9} />}
            label="Has active intervention"
          />
          <LegendRow
            swatch={
              <Swatch fill="#16a34a" ring="#dc2626" ringDashed size={9} />
            }
            label="Regulatory"
          />
        </ul>
      </LegendSection>
    </div>
  );
}

function LegendSection({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        last
          ? "px-3 py-2.5"
          : "border-b border-zinc-100 px-3 py-2.5"
      }
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {swatch}
      </span>
      <span>{label}</span>
    </li>
  );
}

function Swatch({
  fill,
  stroke,
  ring,
  ringDashed,
  size,
}: {
  fill: string;
  stroke?: string;
  ring?: string;
  ringDashed?: boolean;
  size: number;
}) {
  const ringSize = size + 6;
  return (
    <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
      {ring && (
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={(size + 3) / 2}
          fill="none"
          stroke={ring}
          strokeWidth={1}
          strokeDasharray={ringDashed ? "2 2" : undefined}
        />
      )}
      <circle
        cx={ringSize / 2}
        cy={ringSize / 2}
        r={size / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 1 : 0}
      />
    </svg>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function buildGraph(data: GalaxyData): { nodes: Node[]; links: Link[] } {
  const nodes: Node[] = [];
  const links: Link[] = [];

  nodes.push({
    id: COMPANY_ID,
    kind: "company",
    label: "Phlo",
    radius: 28,
    team: null,
    meta: {},
  });

  for (const t of data.teams) {
    nodes.push({
      id: t.id,
      kind: "team",
      label: t.name,
      radius: 18,
      team: t.name,
      meta: { name: t.name },
    });
    links.push({
      source: COMPANY_ID,
      target: t.id,
      kind: "company-team",
    });
  }

  for (const p of data.people) {
    nodes.push({
      id: p.id,
      kind: "person",
      label: p.name,
      radius: 14,
      team: p.team,
      meta: {
        name: p.name,
        title: p.title,
        avatarUrl: p.avatarUrl,
        kind: p.kind,
        isChampion: !!p.isChampion,
        championTeam: p.championTeam ?? null,
      },
    });
    if (p.team) {
      links.push({
        source: `team:${p.team}`,
        target: p.id,
        kind: "team-person",
      });
    }
  }

  const personIds = new Set(nodes.filter((n) => n.kind === "person").map((n) => n.id));
  const teamIds = new Set(nodes.filter((n) => n.kind === "team").map((n) => n.id));

  for (const w of data.workflows) {
    const radius = 6 + Math.min(14, Math.sqrt(w.frequencyPerWeek + 1) * 4);
    nodes.push({
      id: w.id,
      kind: "workflow",
      label: w.name,
      radius,
      team: w.team,
      meta: {
        rawId: w.rawId,
        regulatory: w.regulatory,
        frequencyPerWeek: w.frequencyPerWeek,
        criticality: w.criticality,
        activeInterventions: w.activeInterventions,
        team: w.team,
      },
    });

    const validOwners = w.ownerIds.filter((id) => personIds.has(id));
    if (validOwners.length > 0) {
      for (const ownerId of validOwners) {
        links.push({ source: ownerId, target: w.id, kind: "person-workflow" });
      }
    } else if (w.team && teamIds.has(`team:${w.team}`)) {
      links.push({ source: `team:${w.team}`, target: w.id, kind: "team-workflow" });
    }
  }

  return { nodes, links };
}

function touchesTeam(n: Node, team: string): boolean {
  if (n.kind === "company") return true;
  if (n.kind === "team") return n.label === team;
  return n.team === team;
}

function getHighlightedIds(
  focusId: string | null,
  nodes: Node[],
  links: Link[],
): Set<string> | null {
  if (!focusId) return null;
  const ids = new Set<string>([focusId]);
  // 1-hop neighbours
  for (const l of links) {
    const s = (l.source as Node).id ?? (l.source as unknown as string);
    const t = (l.target as Node).id ?? (l.target as unknown as string);
    if (s === focusId) ids.add(t);
    if (t === focusId) ids.add(s);
  }
  // If focus is a team, include all workflows whose person-owner sits on the team
  const focus = nodes.find((n) => n.id === focusId);
  if (focus?.kind === "team") {
    for (const n of nodes) {
      if (n.team === focus.label) ids.add(n.id);
    }
  }
  return ids;
}

type HeatScales = {
  min: number;
  max: number;
  better: "low" | "high" | "n/a";
};

function computeHeatScales(
  heat: Heat,
  date: string | undefined,
  heatRange: Record<string, Record<string, { min: number; max: number }>>,
): HeatScales {
  if (heat === "criticality") return { min: 1, max: 5, better: "low" };
  if (heat === "interventions") return { min: 0, max: 1, better: "high" };
  if (!date) return { min: 0, max: 1, better: "low" };
  const r = heatRange[heat]?.[date];
  if (!r) return { min: 0, max: 1, better: "low" };
  return {
    min: r.min,
    max: r.max,
    better: heat === "revenue" ? "high" : "low",
  };
}

function heatValueForWorkflow(
  heat: Heat,
  workflowId: string,
  date: string | undefined,
  meta: Record<string, unknown>,
  historyIndex: Record<string, Record<string, Record<string, number>>>,
): number | null {
  if (heat === "criticality") return (meta.criticality as number) ?? null;
  if (heat === "interventions")
    return (meta.activeInterventions as number) > 0 ? 1 : 0;
  if (!date) return null;
  return historyIndex[heat]?.[workflowId]?.[date] ?? null;
}

// "fresh" = a measurement exists within FRESH_DAYS of the scrubbed date,
// "stale" = within STALE_DAYS, "none" = older than that or never measured.
// criticality + interventions are static, so always treat them as fresh.
function freshnessFor(
  heat: Heat,
  workflowId: string,
  scrubDate: string | undefined,
  historyIndex: Record<string, Record<string, Record<string, number>>>,
): "fresh" | "stale" | "none" {
  if (heat === "criticality" || heat === "interventions") return "fresh";
  if (!scrubDate) return "none";
  const byDate = historyIndex[heat]?.[workflowId];
  if (!byDate) return "none";
  let bestDate: string | null = null;
  for (const d of Object.keys(byDate)) {
    if (d > scrubDate) continue;
    if (bestDate === null || d > bestDate) bestDate = d;
  }
  if (!bestDate) return "none";
  const ageMs = Date.parse(scrubDate) - Date.parse(bestDate);
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= FRESH_DAYS) return "fresh";
  if (ageDays <= STALE_DAYS) return "stale";
  return "none";
}

// Programmatic zoom helpers driven by the toolbar buttons. Mutating the ref
// alone is enough - the requestAnimationFrame loop reads it every frame.
type TransformRef = { current: { x: number; y: number; k: number } };
function zoomBy(ref: TransformRef, factor: number) {
  const t = ref.current;
  const newK = Math.max(0.3, Math.min(3, t.k * factor));
  // Zoom toward the centre (i.e. the current viewport origin in world space).
  const ratio = newK / t.k;
  t.x = -(0 - t.x) * ratio;
  t.y = -(0 - t.y) * ratio;
  t.k = newK;
}
function resetZoom(ref: TransformRef) {
  // Reset to the same starting state as first paint; the draw loop's
  // one-shot auto-fit (gated on hasAutoFitRef) will re-frame the map.
  ref.current.x = 0;
  ref.current.y = 0;
  ref.current.k = 0.65;
}

function formatRange(value: number, unit: string): string {
  const n =
    Math.abs(value) >= 1000
      ? `${(value / 1000).toFixed(1)}k`
      : value % 1 === 0
        ? `${value}`
        : value.toFixed(1);
  if (unit === "£") return `£${n}`;
  if (unit === "/ 5") return `${n} / 5`;
  if (!unit) return n;
  return `${n} ${unit}`;
}

function ZoomButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center text-base leading-none text-zinc-700 hover:bg-zinc-100"
    >
      {children}
    </button>
  );
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number) {
  const tt = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * tt),
    Math.round(a[1] + (b[1] - a[1]) * tt),
    Math.round(a[2] + (b[2] - a[2]) * tt),
  ];
}

// Conventional traffic-light scale: green = good, amber = warning, red = bad.
const COLOR_GOOD: [number, number, number] = [22, 163, 74]; // green-600
const COLOR_WARN: [number, number, number] = [217, 119, 6]; // amber-600
const COLOR_BAD: [number, number, number] = [220, 38, 38]; // red-600
const COLOR_UNKNOWN = "#a1a1aa"; // zinc-400

function workflowColor(value: number | null, scales: HeatScales): string {
  if (value === null) return COLOR_UNKNOWN;
  const t = scales.max === scales.min ? 0.5 : (value - scales.min) / (scales.max - scales.min);
  const adjusted = scales.better === "high" ? 1 - t : t;
  const c = adjusted < 0.5
    ? lerpColor(COLOR_GOOD, COLOR_WARN, adjusted * 2)
    : lerpColor(COLOR_WARN, COLOR_BAD, (adjusted - 0.5) * 2);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// =============================================================================
// Drawing
// =============================================================================
type DrawOpts = {
  heat: Heat;
  heatScales: HeatScales;
  heatValue: number | null;
  freshness: "fresh" | "stale" | "none";
  activeInterventions: number;
  imageMap: Map<string, HTMLImageElement>;
  isHover: boolean;
};

function drawNode(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  if (n.kind === "company") return drawCompany(ctx, n);
  if (n.kind === "team") return drawTeam(ctx, n);
  if (n.kind === "person") return drawPerson(ctx, n, opts);
  return drawWorkflow(ctx, n, opts);
}

function drawCompany(ctx: CanvasRenderingContext2D, n: Node) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;

  ctx.fillStyle = "#18181b";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTeam(ctx: CanvasRenderingContext2D, n: Node) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;

  ctx.fillStyle = "#e4e4e7";
  ctx.strokeStyle = "#52525b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawPerson(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;
  const img = opts.imageMap.get(n.id);
  const isGhost = n.meta.kind === "ghost";
  const isChampion = n.meta.isChampion === true;

  // Champions get a soft outer halo so they pop on a dense map.
  if (isChampion) {
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Avatar ring - amber + thicker for champions, default zinc otherwise.
  if (isChampion) {
    ctx.strokeStyle = "#f59e0b"; // amber-500
    ctx.lineWidth = opts.isHover ? 4 : 3;
  } else {
    ctx.strokeStyle = isGhost ? "rgba(82,82,91,0.5)" : "#71717a";
    ctx.lineWidth = opts.isHover ? 2.5 : 1.2;
  }
  ctx.beginPath();
  ctx.arc(x, y, r + 1, 0, Math.PI * 2);
  ctx.stroke();

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    try {
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    } catch {
      /* ignore taint errors */
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#a1a1aa";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // AI Champion mark in the bottom-right corner of the avatar: a small amber
  // pill stamped "AI" so the badge tells you what role it represents instead
  // of relying on a generic lightning bolt.
  if (isChampion) {
    const glyphR = Math.max(5, r * 0.36);
    const pillH = glyphR * 2;
    const pillW = pillH * 1.55;
    const cx = x + r * 0.65;
    const cy = y + r * 0.65;
    // White halo so the pill reads against the avatar.
    ctx.fillStyle = "#ffffff";
    roundRect(
      ctx,
      cx - pillW / 2 - 1,
      cy - pillH / 2 - 1,
      pillW + 2,
      pillH + 2,
      pillH / 2 + 1,
    );
    ctx.fill();
    ctx.fillStyle = "#f59e0b";
    roundRect(
      ctx,
      cx - pillW / 2,
      cy - pillH / 2,
      pillW,
      pillH,
      pillH / 2,
    );
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(glyphR * 1.05)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AI", cx, cy + 0.5);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawWorkflow(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;

  const color = workflowColor(opts.heatValue, opts.heatScales);

  // Halo around workflows with an active intervention.
  if (opts.activeInterventions > 0) {
    ctx.strokeStyle = "#9333ea"; // purple-600
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  // Stroke style encodes data freshness:
  //   fresh = solid dark ring, stale = dashed ring, none = no ring at all.
  if (opts.freshness === "fresh") {
    ctx.strokeStyle = "rgba(24,24,27,0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
  } else if (opts.freshness === "stale") {
    ctx.strokeStyle = "rgba(24,24,27,0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
  } else {
    ctx.strokeStyle = "rgba(24,24,27,0)";
    ctx.lineWidth = 0;
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (opts.freshness !== "none") ctx.stroke();
  ctx.setLineDash([]);

  if (n.meta.regulatory) {
    ctx.strokeStyle = "#dc2626";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + (opts.activeInterventions > 0 ? 8 : 4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (opts.isHover) {
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + (n.meta.regulatory ? 10 : 6), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// =============================================================================
// Detail card
// =============================================================================
function DetailCard({
  node,
  data,
  onClose,
}: {
  node: Node;
  data: GalaxyData;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 max-w-xs rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-900 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {node.kind}
          </p>
          <p className="mt-0.5 font-semibold">{node.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-900"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {node.kind === "team" && <TeamDetail teamName={node.label} data={data} />}
      {node.kind === "person" && <PersonDetail node={node} data={data} />}
      {node.kind === "workflow" && <WorkflowDetail node={node} />}
    </div>
  );
}

function TeamDetail({ teamName, data }: { teamName: string; data: GalaxyData }) {
  const people = data.people.filter((p) => p.team === teamName);
  const workflows = data.workflows.filter((w) => w.team === teamName);
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p>{people.length} people</p>
      <p>{workflows.length} workflows</p>
      <p>
        {workflows.reduce((acc, w) => acc + w.activeInterventions, 0)} active
        interventions
      </p>
    </div>
  );
}

function PersonDetail({ node, data }: { node: Node; data: GalaxyData }) {
  const ownedWorkflows = data.workflows.filter((w) => w.ownerIds.includes(node.id));
  return (
    <div className="mt-2 space-y-1 text-xs">
      {typeof node.meta.title === "string" && node.meta.title && (
        <p className="text-zinc-700">{node.meta.title}</p>
      )}
      <p className="text-zinc-500">
        {node.team ? `Team: ${node.team}` : "No team"}
      </p>
      <p>{ownedWorkflows.length} workflows owned</p>
      {ownedWorkflows.slice(0, 5).map((w) => (
        <p key={w.id} className="truncate text-zinc-700">
          · {w.name}
        </p>
      ))}
    </div>
  );
}

function WorkflowDetail({ node }: { node: Node }) {
  const m = node.meta;
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p className="text-zinc-500">
        Team: {(m.team as string | null) ?? "-"}
      </p>
      <p>Frequency / wk: {(m.frequencyPerWeek as number) ?? 0}</p>
      <p>Criticality: {(m.criticality as number) ?? 3}/5</p>
      <p>
        Active interventions: {(m.activeInterventions as number) ?? 0}
      </p>
      {(m.regulatory as boolean) && (
        <p className="text-red-600">⚠ Regulatory</p>
      )}
    </div>
  );
}
