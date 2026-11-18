"use client";
import { useMemo } from "react";
import type { Concept, TopicPack } from "@/lib/schema";
import { useSession } from "@/lib/store";

/** Concepts for the current session come from the pack (AI or preset). */
export function useConcepts(): Concept[] {
  const pack = useSession((s) => s.pack);
  return pack?.concepts ?? [];
}

export function prettifyId(id: string | null | undefined): string {
  if (!id) return "";
  const last = id.split(".").pop() ?? id;
  const s = last.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function conceptName(concepts: Concept[] | null | undefined, id: string | null | undefined): string {
  return concepts?.find((c) => c.id === id)?.name ?? prettifyId(id);
}

/** "Q2" style label from the question's position in the pack (falls back to the id). */
export function useQLabel() {
  const questions = useSession((s) => s.questions);
  return useMemo(() => {
    const idx = new Map(questions.map((q, i) => [q.id, i + 1]));
    return (qid: string) => (idx.has(qid) ? `Q${idx.get(qid)}` : qid.toUpperCase());
  }, [questions]);
}

/** Join ["Q2","Q4","Q5"] → "Q2, Q4 and Q5". */
export function joinAnd(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

/** Longest-path depth of each concept from the roots of the DAG (cycles are tolerated). */
export function conceptDepths(concepts: Concept[]): Map<string, number> {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const c = byId.get(id);
    const pre = (c?.prerequisites ?? []).filter((p) => byId.has(p));
    const d = pre.length ? 1 + Math.max(...pre.map(visit)) : 0;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  concepts.forEach((c) => visit(c.id));
  return depth;
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "topic";

export type { TopicPack };
