"use client";
import { useEffect, useState } from "react";
import { getGraph } from "@/lib/client-api";
import type { Concept, Subject } from "@/lib/schema";

const cache = new Map<Subject, Concept[]>();

/** Concept list for a subject (cached per page load). */
export function useGraph(subject: Subject | null) {
  const [concepts, setConcepts] = useState<Concept[] | null>(subject ? cache.get(subject) ?? null : null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!subject) return;
    const hit = cache.get(subject);
    if (hit && tick === 0) { setConcepts(hit); return; }
    let live = true;
    setError(null);
    getGraph(subject)
      .then((r) => { cache.set(subject, r.concepts); if (live) setConcepts(r.concepts); })
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [subject, tick]);
  return { concepts, error, retry: () => setTick((t) => t + 1) };
}

export function conceptName(concepts: Concept[] | null, id: string): string {
  return concepts?.find((c) => c.id === id)?.name ?? id.split(".").pop()!.replace(/[_-]/g, " ");
}
