"use client";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { useSession } from "@/lib/store";
import type { Concept } from "@/lib/schema";
import { useGraph } from "./hooks";
import { Skeleton, ErrorBox } from "./ui";

type NodeStatus = "untested" | "tested" | "wrong" | "gap" | "mastered" | "strength" | "teacher";
type GNode = Node<{ label: string; status: NodeStatus }, "concept">;

const STYLE: Record<NodeStatus, string> = {
  untested: "border-slate-600/60 bg-slate-800/70 text-slate-400",
  tested: "border-indigo-400/50 bg-indigo-500/15 text-indigo-100",
  wrong: "gf-wrong border-rose-400 bg-rose-500/25 text-rose-50",
  gap: "gf-gap border-amber-300 bg-amber-400/25 text-amber-50 scale-110",
  mastered: "border-emerald-400 bg-emerald-500/25 text-emerald-50",
  strength: "border-emerald-500/60 bg-emerald-500/15 text-emerald-100",
  teacher: "border-orange-400 bg-orange-500/25 text-orange-50",
};
const ICON: Partial<Record<NodeStatus, string>> = { wrong: "✕", gap: "◎", mastered: "✓", strength: "✓", teacher: "!" };

function ConceptNode({ data }: NodeProps<GNode>) {
  return (
    <div className={clsx("gf-node flex w-[168px] items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-center text-[13px] font-semibold leading-tight", STYLE[data.status])}>
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-slate-500" />
      {ICON[data.status] && <span className="text-xs opacity-90">{ICON[data.status]}</span>}
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-slate-500" />
    </div>
  );
}
const nodeTypes = { concept: ConceptNode };

const NW = 168, GX = 36, GY = 96;

/** Layered layout: depth = longest prerequisite chain; rows by depth, ordered by parent barycenter. */
function layout(concepts: Concept[]): Record<string, { x: number; y: number }> {
  const ids = new Set(concepts.map((c) => c.id));
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const depth = new Map<string, number>();
  const d = (id: string, seen: Set<string> = new Set()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = (byId.get(id)?.prerequisites ?? []).filter((p) => ids.has(p));
    const v = ps.length ? 1 + Math.max(...ps.map((p) => d(p, seen))) : 0;
    depth.set(id, v);
    return v;
  };
  concepts.forEach((c) => d(c.id));
  const rows: string[][] = [];
  concepts.forEach((c) => (rows[depth.get(c.id)!] ??= []).push(c.id));
  const xIdx = new Map<string, number>();
  const maxRow = Math.max(...rows.map((r) => r?.length ?? 0));
  const pos: Record<string, { x: number; y: number }> = {};
  rows.forEach((row, y) => {
    if (!row) return;
    const bary = (id: string) => {
      const ps = (byId.get(id)?.prerequisites ?? []).filter((p) => xIdx.has(p));
      return ps.length ? ps.reduce((a, p) => a + xIdx.get(p)!, 0) / ps.length : maxRow / 2;
    };
    const sorted = [...row].sort((a, b) => bary(a) - bary(b));
    const offset = ((maxRow - sorted.length) * (NW + GX)) / 2;
    sorted.forEach((id, i) => {
      const x = offset + i * (NW + GX);
      xIdx.set(id, x / (NW + GX));
      pos[id] = { x, y: y * GY };
    });
  });
  return pos;
}

export type GraphMode = "diagnosing" | "diagnosis" | "static";

export function ConceptGraph({ mode = "static", className = "h-[420px]" }: { mode?: GraphMode; className?: string }) {
  const subject = useSession((s) => s.subject);
  const graded = useSession((s) => s.graded);
  const diagnosis = useSession((s) => s.diagnosis);
  const progress = useSession((s) => s.progress);
  const { concepts, error, retry } = useGraph(subject);

  const wrongIds = useMemo(() => [...new Set(graded.filter((g) => !g.correct).flatMap((g) => g.concepts))], [graded]);
  const correctIds = useMemo(() => new Set(graded.filter((g) => g.correct).flatMap((g) => g.concepts)), [graded]);
  const rootIds = useMemo(() => diagnosis?.root_gaps.map((g) => g.concept_id) ?? [], [diagnosis]);

  // Animation stage: shownWrong = number of wrong nodes revealed; traced = edges highlighted; lit = root gaps glow.
  const [shownWrong, setShownWrong] = useState(mode === "static" ? 999 : 0);
  const [traced, setTraced] = useState(mode === "static");
  const [lit, setLit] = useState(mode === "static");
  useEffect(() => {
    if (mode === "static") { setShownWrong(999); setTraced(true); setLit(true); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (mode === "diagnosing") {
      setTraced(false); setLit(false); setShownWrong(0);
      wrongIds.forEach((_, i) => timers.push(setTimeout(() => setShownWrong(i + 1), 500 + i * 550)));
    } else {
      setShownWrong(999); setTraced(false); setLit(false);
      timers.push(setTimeout(() => setTraced(true), 700), setTimeout(() => setLit(true), 1700));
    }
    return () => timers.forEach(clearTimeout);
  }, [mode, wrongIds]);

  const { nodes, edges } = useMemo(() => {
    if (!concepts) return { nodes: [] as GNode[], edges: [] as Edge[] };
    const pos = layout(concepts);
    const byId = new Map(concepts.map((c) => [c.id, c]));
    const revealed = new Set(wrongIds.slice(0, shownWrong));

    const status = (id: string): NodeStatus => {
      const p = progress[id]?.status;
      if (p === "mastered") return "mastered";
      if (p === "needs_teacher") return "teacher";
      if ((p === "gap" || p === "learning") && lit) return "gap";
      if (wrongIds.includes(id)) return revealed.has(id) || mode !== "diagnosing" ? "wrong" : "tested";
      if (mode !== "diagnosing" && (correctIds.has(id) || diagnosis?.strengths.includes(id))) return "strength";
      if (correctIds.has(id) || wrongIds.includes(id)) return "tested";
      return "untested";
    };

    // nodes on a prerequisite path from a root gap down to a wrong concept
    const up = (id: string, acc = new Set<string>()): Set<string> => {
      if (acc.has(id)) return acc;
      acc.add(id);
      (byId.get(id)?.prerequisites ?? []).forEach((p) => byId.has(p) && up(p, acc));
      return acc;
    };
    const pathNodes = new Set<string>();
    const rootSet = new Set(rootIds);
    for (const w of wrongIds) {
      const anc = up(w);
      for (const r of rootIds) {
        if (!anc.has(r)) continue;
        // nodes between r and w: ancestors of w that have r as ancestor-or-self
        anc.forEach((n) => { if (up(n).has(r)) pathNodes.add(n); });
      }
    }

    const nodes: GNode[] = concepts.map((c) => ({
      id: c.id, type: "concept", position: pos[c.id], draggable: false, selectable: false,
      data: { label: c.name, status: status(c.id) },
    }));
    const edges: Edge[] = [];
    for (const c of concepts) for (const p of c.prerequisites) {
      if (!byId.has(p)) continue;
      const hot = traced && pathNodes.has(p) && pathNodes.has(c.id) && rootSet.size > 0;
      const done = progress[p]?.status === "mastered" && progress[c.id]?.status === "mastered";
      const color = hot ? "#fbbf24" : done ? "#34d399" : "#475569";
      edges.push({
        id: `${p}->${c.id}`, source: p, target: c.id, type: "smoothstep", animated: hot,
        style: { stroke: color, strokeWidth: hot ? 3 : 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      });
    }
    return { nodes, edges };
  }, [concepts, progress, wrongIds, correctIds, rootIds, diagnosis, shownWrong, traced, lit, mode]);

  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!concepts) return <Skeleton className={clsx("w-full", className)} />;
  return (
    <div className={clsx("glass relative w-full overflow-hidden rounded-2xl", className)}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        fitView fitViewOptions={{ padding: 0.15 }} proOptions={{ hideAttribution: true }}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        zoomOnScroll={false} preventScrolling={false} minZoom={0.3}
      />
      <div className="pointer-events-none absolute bottom-2 left-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />wrong</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300" />root gap</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />mastered</span>
      </div>
    </div>
  );
}
