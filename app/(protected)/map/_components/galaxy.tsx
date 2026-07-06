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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Maximize,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
    frequencyLabel: string | null;
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

type Link_ = SimulationLinkDatum<Node> & {
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
    label: "Active AI initiatives",
    unit: "",
    direction: "higher",
  },
] as const;
type Heat = (typeof HEAT_OPTIONS)[number]["value"];

const FRESH_DAYS = 14;
const STALE_DAYS = 60;

// Canvas colours resolved from the CSS token system at draw time, so the
// galaxy follows globals.css instead of hardcoding hexes.
type Theme = {
  background: string;
  foreground: string;
  border: string;
  mutedForeground: string;
};

function readTheme(): Theme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => {
    const v = styles.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    background: token("--background", "#ffffff"),
    foreground: token("--foreground", "#18181b"),
    border: token("--border", "#e4e4e7"),
    mutedForeground: token("--muted-foreground", "#71717a"),
  };
}

// =============================================================================
// Component
// =============================================================================
export function Galaxy({ data }: { data: GalaxyData }) {
  // --- Filters / mode state ------------------------------------------------
  const [heat, setHeat] = useState<Heat>("criticality");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Latest history snapshot date anchors the heat freshness window. The
  // galaxy always reflects the most recent state - the date scrubber was
  // removed because it added a dense control without a clear "what
  // changed?" payoff for users with limited history.
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

  // Per-workflow heat value + freshness, precomputed once per heat/data
  // change (NOT per animation frame). Heat reads each workflow's *own*
  // latest measurement within the staleness window - the same window the
  // freshness ring uses - so a workflow's fill and ring can't contradict
  // each other, and workflows measured on different days all show colour.
  const heatComputed = useMemo(() => {
    const values = new Map<string, number | null>();
    const freshness = new Map<string, "fresh" | "stale" | "none">();
    let min = Infinity;
    let max = -Infinity;
    for (const w of data.workflows) {
      let value: number | null = null;
      let fresh: "fresh" | "stale" | "none" = "none";
      if (heat === "criticality") {
        value = w.criticality;
        fresh = "fresh"; // static attribute - always current
      } else if (heat === "interventions") {
        value = w.activeInterventions > 0 ? 1 : 0;
        fresh = "fresh"; // static attribute - always current
      } else if (latestDate) {
        const byDate = historyIndex[heat]?.[w.id];
        let bestDate: string | null = null;
        for (const d of Object.keys(byDate ?? {})) {
          if (d > latestDate) continue;
          if (bestDate === null || d > bestDate) bestDate = d;
        }
        if (bestDate) {
          const ageDays =
            (Date.parse(latestDate) - Date.parse(bestDate)) / 86_400_000;
          if (ageDays <= FRESH_DAYS) fresh = "fresh";
          else if (ageDays <= STALE_DAYS) fresh = "stale";
          if (ageDays <= STALE_DAYS) value = byDate![bestDate];
        }
      }
      values.set(w.id, value);
      freshness.set(w.id, fresh);
      if (value != null) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }

    const scales: HeatScales =
      heat === "criticality"
        ? { min: 1, max: 5, better: "low" }
        : heat === "interventions"
          ? { min: 0, max: 1, better: "high" }
          : min <= max
            ? { min, max, better: heat === "revenue" ? "high" : "low" }
            : { min: 0, max: 1, better: heat === "revenue" ? "high" : "low" };

    const legendRange: { min: number; max: number } | null =
      heat === "criticality"
        ? { min: 1, max: 5 }
        : heat === "interventions"
          ? { min: 0, max: 1 }
          : min <= max
            ? { min, max }
            : null;

    return { values, freshness, scales, legendRange };
  }, [heat, data.workflows, historyIndex, latestDate]);

  // --- Build graph (nodes + links) ----------------------------------------
  const { nodes, links } = useMemo(() => buildGraph(data), [data]);

  // Highlighted subgraph for the current hover/selection - id-based, so it
  // only needs recomputing when focus changes, never per frame.
  const subgraph = useMemo(
    () => getHighlightedIds(selectedId ?? hoveredId, nodes, links),
    [selectedId, hoveredId, nodes, links],
  );

  // --- Canvas / interaction refs -------------------------------------------
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
  const simRef = useRef<Simulation<Node, Link_> | null>(null);
  // Set by anything that mutates draw inputs outside React state (pan/zoom,
  // avatar loads). The draw loop parks itself once the simulation cools;
  // requestFrameRef.current() wakes it for exactly as long as needed.
  const needsFrameRef = useRef(true);
  const requestFrameRef = useRef<() => void>(() => {});

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

  // --- Avatar image preloading --------------------------------------------
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    for (const p of data.people) {
      if (imagesRef.current.has(p.id)) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      // Wake the (possibly parked) draw loop when the avatar arrives.
      img.onload = () => requestFrameRef.current();
      img.src = p.avatarUrl;
      imagesRef.current.set(p.id, img);
    }
  }, [data.people]);

  // --- Simulation lifecycle ------------------------------------------------
  useEffect(() => {
    // Stop previous sim if any
    simRef.current?.stop();

    const sim = forceSimulation<Node>(nodes)
      .force(
        "link",
        forceLink<Node, Link_>(links)
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
    requestFrameRef.current();
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

    // Resolve the token palette once per effect run (the app is light-mode
    // only, so tokens can't change underneath a mounted canvas).
    const theme = readTheme();

    let running = true;
    let raf = 0;
    // Every effect re-run means some draw input changed (hover, filter,
    // heat, size, …) - always paint at least one frame before parking.
    needsFrameRef.current = true;

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

      // Token background to match the rest of the platform.
      ctx.fillStyle = theme.background;
      ctx.fillRect(0, 0, w, h);

      ctx.translate(w / 2 + tx, h / 2 + ty);
      ctx.scale(k, k);

      const isFiltered = teamFilter !== "all";

      // 1. Edges
      ctx.lineWidth = 1;
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

        ctx.strokeStyle = theme.foreground;
        ctx.globalAlpha = dim ? 0.06 : 0.22;
        ctx.lineWidth = dim ? 0.6 : 1;
        ctx.beginPath();
        ctx.moveTo(s.x!, s.y!);
        ctx.lineTo(t.x!, t.y!);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

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
          heatScales: heatComputed.scales,
          heatValue: heatComputed.values.get(n.id) ?? null,
          freshness: heatComputed.freshness.get(n.id) ?? "none",
          activeInterventions:
            (n.meta.activeInterventions as number | undefined) ?? 0,
          imageMap: imagesRef.current,
          isHover,
          theme,
        });
        ctx.globalAlpha = 1;
      }

      // 3. Labels for hovered/selected/teams. Counter-scale the font so
      // labels never render below ~11px on screen no matter how far the
      // camera is zoomed out (12px world × 0.65 default zoom ≈ 8px was
      // unreadable).
      const labelSize = Math.max(12, 11 / k);
      ctx.font = `${labelSize}px ui-sans-serif, system-ui, -apple-system`;
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
        ctx.fillStyle = theme.foreground;
        ctx.fillText(n.label, n.x!, n.y! + n.radius + 6);
        ctx.globalAlpha = 1;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    const loop = () => {
      if (!running) return;
      const simHot = (simRef.current?.alpha() ?? 0) > 0.02;
      const awaitingAutoFit =
        !hasAutoFitRef.current && !userInteractedRef.current;
      if (needsFrameRef.current || simHot || awaitingAutoFit) {
        needsFrameRef.current = false;
        draw();
        raf = requestAnimationFrame(loop);
      } else {
        // Simulation cooled and nothing changed - park the loop. Any
        // interaction calls requestFrameRef.current() to resume.
        raf = 0;
      }
    };

    requestFrameRef.current = () => {
      needsFrameRef.current = true;
      if (running && raf === 0) raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [nodes, links, size, teamFilter, hoveredId, selectedId, heatComputed, subgraph]);

  // --- Pan / zoom / hover / tap --------------------------------------------
  // Pointer Events instead of mouse events: a single pointer (mouse drag OR
  // touch drag) pans, a tap/click selects, two pointers pinch-zoom, and the
  // wheel still zooms. touch-action: none on the canvas keeps the browser
  // from hijacking the gestures.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let panPointerId: number | null = null;
    let moved = false;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;
    let pinchDist = 0;

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

    function zoomAt(cx: number, cy: number, factor: number) {
      const t = transformRef.current;
      const newK = Math.max(0.3, Math.min(3, t.k * factor));
      const ratio = newK / t.k;
      t.x = cx - (cx - t.x) * ratio;
      t.y = cy - (cy - t.y) * ratio;
      t.k = newK;
      userInteractedRef.current = true;
      requestFrameRef.current();
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      canvas!.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        panPointerId = e.pointerId;
        moved = false;
        downX = lastX = e.clientX;
        downY = lastY = e.clientY;
      } else if (pointers.size === 2) {
        // Second finger down → switch from pan to pinch.
        panPointerId = null;
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (pointers.has(e.pointerId)) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0 && dist > 0) {
          const rect = canvas!.getBoundingClientRect();
          const midX = (a.x + b.x) / 2 - rect.left - size.w / 2;
          const midY = (a.y + b.y) / 2 - rect.top - size.h / 2;
          zoomAt(midX, midY, dist / pinchDist);
          moved = true;
        }
        pinchDist = dist;
        return;
      }

      if (panPointerId === e.pointerId) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (
          Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5 &&
          !moved
        ) {
          moved = true;
          userInteractedRef.current = true;
        }
        transformRef.current.x += dx;
        transformRef.current.y += dy;
        requestFrameRef.current();
        return;
      }

      // Hover preview only makes sense for a real cursor.
      if (e.pointerType === "mouse" && pointers.size === 0) {
        const rect = canvas!.getBoundingClientRect();
        const node = pickNode(e.clientX - rect.left, e.clientY - rect.top);
        const next = node?.id ?? null;
        setHoveredId((prev) => (prev === next ? prev : next));
      }
    }

    function onPointerEnd(e: PointerEvent) {
      const wasPan = panPointerId === e.pointerId;
      pointers.delete(e.pointerId);

      if (wasPan) {
        panPointerId = null;
        if (!moved && e.type === "pointerup") {
          // Tap / click without dragging → toggle selection.
          const rect = canvas!.getBoundingClientRect();
          const node = pickNode(e.clientX - rect.left, e.clientY - rect.top);
          setSelectedId((prev) => {
            if (!node) return null;
            return prev === node.id ? null : node.id;
          });
        }
      }

      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 1) {
        // One finger left after a pinch → resume panning with it, but don't
        // let the release read as a tap.
        const [remainingId] = pointers.keys();
        const p = pointers.get(remainingId)!;
        panPointerId = remainingId;
        downX = lastX = p.x;
        downY = lastY = p.y;
        moved = true;
      }
    }

    function onPointerLeave() {
      if (pointers.size === 0) setHoveredId(null);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const rect = canvas!.getBoundingClientRect();
      const cx = e.clientX - rect.left - size.w / 2;
      const cy = e.clientY - rect.top - size.h / 2;
      zoomAt(cx, cy, 1 + delta);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, size]);

  // --- Detail card content -------------------------------------------------
  // Hover previews debounce ~150ms so skating across the galaxy doesn't
  // strobe the card (clearing gets a shorter fuse so the card doesn't
  // linger); a click pins immediately.
  const [debouncedHoverId, setDebouncedHoverId] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedHoverId(hoveredId),
      hoveredId ? 150 : 75,
    );
    return () => clearTimeout(t);
  }, [hoveredId]);

  const isPinned = selectedId != null;
  const focusId = selectedId ?? debouncedHoverId;
  const focusNode = focusId ? nodes.find((n) => n.id === focusId) ?? null : null;

  return (
    <div className="flex flex-col flex-1">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-6 py-2 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Colour by</span>
          <Select
            value={heat}
            onValueChange={(v: string | null) => {
              if (v) setHeat(v as Heat);
            }}
          >
            <SelectTrigger size="sm" aria-label="Colour workflows by">
              <SelectValue>
                {(v: string | null) =>
                  HEAT_OPTIONS.find((o) => o.value === v)?.label ?? ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HEAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Team</span>
          <Select
            value={teamFilter}
            onValueChange={(v: string | null) => {
              if (v) setTeamFilter(v);
            }}
          >
            <SelectTrigger size="sm" aria-label="Filter by team">
              <SelectValue>
                {(v: string | null) => (!v || v === "all" ? "All teams" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {data.teams.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <span className="ml-auto text-right text-muted-foreground">
          Drag to pan · Scroll, pinch or the buttons to zoom · Click a node to
          focus ·{" "}
          <Link
            href="/map?view=directory"
            className="text-foreground underline-offset-2 hover:underline"
          >
            Prefer a list? Use the Directory view
          </Link>
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-background">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Interactive network map of ${data.teams.length} teams, ${data.people.length} people and ${data.workflows.length} workflows at Phlo. This visualisation is canvas-based; the Directory view on this page presents the same people as an accessible list.`}
          style={{
            width: size.w,
            height: size.h,
            cursor: hoveredId ? "pointer" : "grab",
            touchAction: "none",
          }}
        />

        {/* Floating zoom controls. Bottom-right is the canonical place for
            map-canvas controls (Google Maps / Mapbox / Figma) - frees the
            top toolbar for filter widgets. */}
        <div
          role="group"
          aria-label="Zoom"
          className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-sm backdrop-blur"
        >
          <ZoomButton
            label="Zoom in"
            onClick={() => {
              zoomBy(transformRef, 1.3);
              userInteractedRef.current = true;
              requestFrameRef.current();
            }}
          >
            <Plus aria-hidden className="size-4" />
          </ZoomButton>
          <span aria-hidden className="h-px bg-muted" />
          <ZoomButton
            label="Zoom out"
            onClick={() => {
              zoomBy(transformRef, 1 / 1.3);
              userInteractedRef.current = true;
              requestFrameRef.current();
            }}
          >
            <Minus aria-hidden className="size-4" />
          </ZoomButton>
          <span aria-hidden className="h-px bg-muted" />
          <ZoomButton
            label="Fit to screen"
            onClick={() => {
              resetZoom(transformRef);
              hasAutoFitRef.current = false;
              userInteractedRef.current = false;
              requestFrameRef.current();
            }}
          >
            <Maximize aria-hidden className="size-4" />
          </ZoomButton>
        </div>

        <Legend heat={heat} range={heatComputed.legendRange} />

        {/* Detail card */}
        {focusNode && (
          <DetailCard
            node={focusNode}
            data={data}
            pinned={isPinned}
            onClose={() => setSelectedId(null)}
          />
        )}

        {/* Empty state. (For developers: usually means supabase/seed.sql
            hasn't been applied to this environment, or no workflows have
            been created yet.) */}
        {data.workflows.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <EmptyState
              className="max-w-sm bg-background shadow-sm"
              title="Nothing on the map yet"
              description="The map draws itself from workflows and their owners. Add a workflow, or ask an admin to set up the map data."
            />
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Legend
// =============================================================================
const LG_QUERY = "(min-width: 1024px)";
function subscribeToLg(cb: () => void) {
  const mql = window.matchMedia(LG_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function Legend({
  heat,
  range,
}: {
  heat: Heat;
  range: { min: number; max: number } | null;
}) {
  // Collapsed by default on small screens - the 240px panel covers most of
  // a phone-sized canvas - and open on lg+. An explicit user toggle wins
  // over the breakpoint default.
  const isLg = useSyncExternalStore(
    subscribeToLg,
    () => window.matchMedia(LG_QUERY).matches,
    () => false,
  );
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? isLg;
  const setOpen = (v: boolean) => setUserOpen(v);

  const opt = HEAT_OPTIONS.find((o) => o.value === heat);
  const heatLabel = opt?.label ?? heat;
  const direction = opt?.direction ?? "lower";
  const unit = opt?.unit ?? "";

  // Both gradients run min-value on the left to max-value on the right;
  // direction only decides which end is green. So the left label is always
  // the min and the right label always the max - for "higher" metrics that
  // correctly puts the best (max) value on the green end.
  const leftLabel = range
    ? formatRange(range.min, unit)
    : direction === "lower"
      ? "Good"
      : "Bad";
  const rightLabel = range
    ? formatRange(range.max, unit)
    : direction === "lower"
      ? "Bad"
      : "Good";
  const gradient =
    direction === "lower"
      ? "linear-gradient(to right, rgb(22,163,74), rgb(217,119,6), rgb(220,38,38))"
      : "linear-gradient(to right, rgb(220,38,38), rgb(217,119,6), rgb(22,163,74))";

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-border bg-background/90 px-3 py-1.5 text-xs text-foreground shadow-sm backdrop-blur hover:bg-muted"
      >
        Legend
        <ChevronDown aria-hidden className="size-3.5" />
      </button>
    );
  }

  return (
    <div className="absolute right-4 top-4 w-[240px] rounded-lg border border-border bg-background/90 text-xs text-foreground shadow-sm backdrop-blur">
      <button
        type="button"
        aria-expanded
        onClick={() => setOpen(false)}
        className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        Legend
        <ChevronUp aria-hidden className="size-3.5" />
      </button>

      <LegendSection title={heatLabel}>
        <div
          className="h-1.5 w-full rounded-full"
          style={{ background: gradient }}
        />
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      </LegendSection>

      <LegendSection title="Freshness">
        <ul className="space-y-1">
          <LegendRow
            swatch={
              <span className="inline-block size-2 rounded-full ring-1 ring-foreground/70" />
            }
            label={`Fresh (≤${FRESH_DAYS}d)`}
          />
          <LegendRow
            swatch={
              <span
                className="inline-block size-2 rounded-full border border-dashed border-foreground/55"
              />
            }
            label={`Stale (${FRESH_DAYS}-${STALE_DAYS}d)`}
          />
          <LegendRow
            swatch={<span className="inline-block size-2 rounded-full bg-muted-foreground/60" />}
            label="No measurement"
          />
        </ul>
      </LegendSection>

      <LegendSection title="Nodes">
        <ul className="space-y-1">
          <LegendRow
            swatch={<Swatch fill="var(--foreground)" size={10} />}
            label="Phlo"
          />
          <LegendRow
            swatch={
              <Swatch
                fill="var(--border)"
                stroke="var(--muted-foreground)"
                size={10}
              />
            }
            label="Team"
          />
          <LegendRow
            swatch={
              <Swatch
                fill="var(--muted-foreground)"
                stroke="var(--muted-foreground)"
                size={9}
              />
            }
            label="Person"
          />
          {/* Neutral swatch on purpose: workflow fill is the heat scale, so
              a green chip here would read as "good" rather than "workflow". */}
          <LegendRow
            swatch={
              <Swatch
                fill="var(--background)"
                stroke="var(--muted-foreground)"
                size={9}
              />
            }
            label="Workflow (colour = scale above)"
          />
        </ul>
      </LegendSection>

      <LegendSection title="Markers" last>
        <ul className="space-y-1">
          <LegendRow
            swatch={
              <Swatch fill="var(--background)" stroke="var(--muted-foreground)" ring="#9333ea" size={9} />
            }
            label="Has active AI initiatives"
          />
          <LegendRow
            swatch={
              <Swatch
                fill="var(--background)"
                stroke="var(--muted-foreground)"
                ring="#dc2626"
                ringDashed
                size={9}
              />
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
          : "border-b border-border px-3 py-2.5"
      }
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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

function buildGraph(data: GalaxyData): { nodes: Node[]; links: Link_[] } {
  const nodes: Node[] = [];
  const links: Link_[] = [];

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
        frequencyLabel: w.frequencyLabel,
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
  links: Link_[],
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

// Programmatic zoom helpers driven by the toolbar buttons. Mutating the ref
// is not enough on its own now that the draw loop parks itself - callers
// must also call requestFrameRef.current().
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
      className="flex size-8 items-center justify-center text-foreground hover:bg-muted"
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
// These are data-scale colours (they also appear in the legend gradient),
// not chrome, so they stay literal rather than reading theme tokens.
const COLOR_GOOD: [number, number, number] = [22, 163, 74]; // green-600
const COLOR_WARN: [number, number, number] = [217, 119, 6]; // amber-600
const COLOR_BAD: [number, number, number] = [220, 38, 38]; // red-600

function workflowColor(
  value: number | null,
  scales: HeatScales,
  unknownColor: string,
): string {
  if (value === null) return unknownColor;
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
  heatScales: HeatScales;
  heatValue: number | null;
  freshness: "fresh" | "stale" | "none";
  activeInterventions: number;
  imageMap: Map<string, HTMLImageElement>;
  isHover: boolean;
  theme: Theme;
};

function drawNode(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  if (n.kind === "company") return drawCompany(ctx, n, opts);
  if (n.kind === "team") return drawTeam(ctx, n, opts);
  if (n.kind === "person") return drawPerson(ctx, n, opts);
  return drawWorkflow(ctx, n, opts);
}

function drawCompany(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;

  ctx.fillStyle = opts.theme.foreground;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTeam(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;

  ctx.fillStyle = opts.theme.border;
  ctx.strokeStyle = opts.theme.mutedForeground;
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

  const prevAlpha = ctx.globalAlpha;
  ctx.strokeStyle = opts.theme.mutedForeground;
  if (isGhost) ctx.globalAlpha = prevAlpha * 0.5;
  ctx.lineWidth = opts.isHover ? 2.5 : 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = prevAlpha;

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
    ctx.fillStyle = opts.theme.mutedForeground;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWorkflow(ctx: CanvasRenderingContext2D, n: Node, opts: DrawOpts) {
  const x = n.x!;
  const y = n.y!;
  const r = n.radius;
  const prevAlpha = ctx.globalAlpha;

  const color = workflowColor(
    opts.heatValue,
    opts.heatScales,
    opts.theme.mutedForeground,
  );

  // Halo around workflows with an active intervention.
  if (opts.activeInterventions > 0) {
    ctx.strokeStyle = "#9333ea"; // purple-600 (matches the legend marker)
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Stroke style encodes data freshness:
  //   fresh = solid dark ring, stale = dashed ring, none = no ring at all.
  if (opts.freshness !== "none") {
    ctx.strokeStyle = opts.theme.foreground;
    ctx.globalAlpha = prevAlpha * (opts.freshness === "fresh" ? 0.6 : 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash(opts.freshness === "stale" ? [2, 2] : []);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = prevAlpha;
  }

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
    ctx.strokeStyle = opts.theme.foreground;
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
  pinned,
  onClose,
}: {
  node: Node;
  data: GalaxyData;
  pinned: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 max-w-xs rounded-lg border bg-background p-4 text-sm text-foreground",
        // A pinned card is interactive with a stronger border + shadow;
        // a hover preview is lighter and never steals pointer events.
        pinned
          ? "border-foreground/25 shadow-md"
          : "pointer-events-none border-border opacity-90 shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {node.kind}
          </p>
          <p className="mt-0.5 font-semibold">{node.label}</p>
        </div>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        )}
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
        AI initiatives
      </p>
    </div>
  );
}

function PersonDetail({ node, data }: { node: Node; data: GalaxyData }) {
  const ownedWorkflows = data.workflows.filter((w) => w.ownerIds.includes(node.id));
  return (
    <div className="mt-2 space-y-1 text-xs">
      {typeof node.meta.title === "string" && node.meta.title && (
        <p className="text-foreground">{node.meta.title}</p>
      )}
      <p className="text-muted-foreground">
        {node.team ? `Team: ${node.team}` : "No team"}
      </p>
      <p>{ownedWorkflows.length} workflows owned</p>
      {ownedWorkflows.slice(0, 5).map((w) => (
        <p key={w.id} className="truncate text-foreground">
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
      <p className="text-muted-foreground">
        Team: {(m.team as string | null) ?? "-"}
      </p>
      <p>Frequency: {(m.frequencyLabel as string | null) ?? "-"}</p>
      <p>Criticality: {(m.criticality as number) ?? 3}/5</p>
      <p>
        Active initiatives: {(m.activeInterventions as number) ?? 0}
      </p>
      {(m.regulatory as boolean) && (
        <p className="text-red-600">⚠ Regulatory</p>
      )}
    </div>
  );
}
