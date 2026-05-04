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
  { value: "criticality", label: "Criticality" },
  { value: "time", label: "Time saved (lower = better)" },
  { value: "cost", label: "Cost saved (lower = better)" },
  { value: "errors", label: "Error rate" },
  { value: "revenue", label: "Revenue (higher = better)" },
  { value: "interventions", label: "Active AI interventions" },
] as const;
type Heat = (typeof HEAT_OPTIONS)[number]["value"];

// =============================================================================
// Component
// =============================================================================
export function Galaxy({ data }: { data: GalaxyData }) {
  // --- Filters / mode state ------------------------------------------------
  const [heat, setHeat] = useState<Heat>("criticality");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- History indexing for scrubber --------------------------------------
  const dateList = useMemo(() => {
    const set = new Set<string>();
    for (const h of data.history) set.add(h.date);
    return Array.from(set).sort();
  }, [data.history]);

  const [dateIdx, setDateIdx] = useState(() =>
    dateList.length > 0 ? dateList.length - 1 : 0,
  );

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
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
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

      const { x: tx, y: ty, k } = transformRef.current;

      // Background gradient
      const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
      bg.addColorStop(0, "#0b1020");
      bg.addColorStop(1, "#05060d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Faint star field — cheap decoration, deterministic per draw
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 80; i++) {
        const seed = (i * 9301 + 49297) % 233280;
        const sx = (seed / 233280) * w;
        const sy = ((i * 7919) % 233280 / 233280) * h;
        ctx.fillRect(sx, sy, 1, 1);
      }

      ctx.translate(w / 2 + tx, h / 2 + ty);
      ctx.scale(k, k);

      const heatScales = computeHeatScales(heat, dateList[dateIdx], heatRange);
      const subgraph = getHighlightedIds(selectedId ?? hoveredId, nodes, links);
      const isFiltered = teamFilter !== "all";

      // Per-frame: value of the active heat metric, per workflow, at the
      // currently scrubbed date. Drives workflow node colour.
      const heatValues = new Map<string, number | null>();
      for (const n of nodes) {
        if (n.kind !== "workflow") continue;
        heatValues.set(
          n.id,
          heatValueForWorkflow(
            heat,
            n.id,
            dateList[dateIdx],
            n.meta,
            historyIndex,
          ),
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

        ctx.strokeStyle = dim ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.18)";
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
        ctx.fillStyle = "#e5e7eb";
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
    dateIdx,
    dateList,
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
          <span className="text-zinc-500">Heat</span>
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

        {dateList.length > 1 && (
          <label className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[400px]">
            <span className="text-zinc-500 whitespace-nowrap">
              {dateList[dateIdx]?.slice(0, 10) ?? ""}
            </span>
            <input
              type="range"
              min={0}
              max={dateList.length - 1}
              value={dateIdx}
              onChange={(e) => setDateIdx(parseInt(e.target.value, 10))}
              className="flex-1 accent-zinc-700"
            />
          </label>
        )}

        <span className="ml-auto text-zinc-400">
          Drag to pan · Scroll to zoom · Click a node to focus
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{
            width: size.w,
            height: size.h,
            cursor: hoveredId ? "pointer" : "grab",
          }}
        />

        {/* Detail card */}
        {focusNode && (
          <DetailCard node={focusNode} data={data} onClose={() => setSelectedId(null)} />
        )}

        {/* Empty state */}
        {data.workflows.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-lg bg-black/60 p-6 text-center text-sm text-zinc-200 max-w-sm">
              <p className="font-medium">The galaxy is empty.</p>
              <p className="mt-1 text-zinc-400">
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
      meta: { name: p.name, title: p.title, avatarUrl: p.avatarUrl, kind: p.kind },
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

function lerpColor(a: [number, number, number], b: [number, number, number], t: number) {
  const tt = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * tt),
    Math.round(a[1] + (b[1] - a[1]) * tt),
    Math.round(a[2] + (b[2] - a[2]) * tt),
  ];
}

const COLOR_COOL: [number, number, number] = [59, 130, 246]; // blue-500
const COLOR_HOT: [number, number, number] = [239, 68, 68]; // red-500
const COLOR_OK: [number, number, number] = [16, 185, 129]; // emerald-500

function workflowColor(
  value: number | null,
  scales: HeatScales,
): string {
  if (value === null) return `rgb(120,120,140)`;
  const t = scales.max === scales.min ? 0.5 : (value - scales.min) / (scales.max - scales.min);
  const adjusted = scales.better === "high" ? 1 - t : t;
  // 0 = good (green) → 0.5 = warning (blue) → 1 = bad (red)
  const c = adjusted < 0.5
    ? lerpColor(COLOR_OK, COLOR_COOL, adjusted * 2)
    : lerpColor(COLOR_COOL, COLOR_HOT, (adjusted - 0.5) * 2);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// =============================================================================
// Drawing
// =============================================================================
type DrawOpts = {
  heat: Heat;
  heatScales: HeatScales;
  heatValue: number | null;
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

  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  grad.addColorStop(0, "rgba(255,235,180,1)");
  grad.addColorStop(0.6, "rgba(255,170,80,0.6)");
  grad.addColorStop(1, "rgba(255,170,80,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTeam(ctx: CanvasRenderingContext2D, n: Node) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;

  ctx.fillStyle = "rgba(150,180,220,0.18)";
  ctx.beginPath();
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.strokeStyle = "#cbd5e1";
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

  // Avatar ring
  ctx.strokeStyle = isGhost ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)";
  ctx.lineWidth = opts.isHover ? 2.5 : 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r + 1, 0, Math.PI * 2);
  ctx.stroke();

  // Avatar image (clipped to circle)
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
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWorkflow(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;

  const color = workflowColor(opts.heatValue, opts.heatScales);

  // Comet trail for active interventions
  if (opts.activeInterventions > 0) {
    const trail = ctx.createRadialGradient(x, y, r, x, y, r * 4);
    trail.addColorStop(0, "rgba(250, 204, 21, 0.45)");
    trail.addColorStop(1, "rgba(250, 204, 21, 0)");
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer glow scaled by criticality
  const crit = (n.meta.criticality as number) ?? 3;
  const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * (1 + crit * 0.3));
  glow.addColorStop(0, color);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * (1 + crit * 0.3), 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  if (n.meta.regulatory) {
    ctx.strokeStyle = "#fca5a5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (opts.isHover) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
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
    <div className="absolute bottom-4 left-4 max-w-xs rounded-lg bg-black/70 p-4 text-sm text-zinc-100 backdrop-blur shadow-xl ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            {node.kind}
          </p>
          <p className="mt-0.5 font-semibold">{node.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-400 hover:text-white"
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
        <p className="text-zinc-300">{node.meta.title}</p>
      )}
      <p className="text-zinc-400">
        {node.team ? `Team: ${node.team}` : "No team"}
      </p>
      <p>{ownedWorkflows.length} workflows owned</p>
      {ownedWorkflows.slice(0, 5).map((w) => (
        <p key={w.id} className="truncate text-zinc-300">
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
      <p className="text-zinc-400">
        Team: {(m.team as string | null) ?? "—"}
      </p>
      <p>Frequency / wk: {(m.frequencyPerWeek as number) ?? 0}</p>
      <p>Criticality: {(m.criticality as number) ?? 3}/5</p>
      <p>
        Active interventions: {(m.activeInterventions as number) ?? 0}
      </p>
      {(m.regulatory as boolean) && (
        <p className="text-rose-300">⚠ Regulatory</p>
      )}
    </div>
  );
}
