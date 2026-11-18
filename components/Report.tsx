"use client";
import { useMemo } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Legend } from "recharts";
import { useSession, type MasteryStatus } from "@/lib/store";
import { ConceptGraph } from "./ConceptGraph";
import { conceptName, useGraph } from "./hooks";
import { Badge, Button, Card } from "./ui";

const AFTER: Record<MasteryStatus, number> = { mastered: 1, learning: 0.5, needs_teacher: 0.3, gap: 0.2, unknown: 0.2 };

export function Report() {
  const subject = useSession((s) => s.subject);
  const graded = useSession((s) => s.graded);
  const responses = useSession((s) => s.responses);
  const diagnosis = useSession((s) => s.diagnosis);
  const progress = useSession((s) => s.progress);
  const reset = useSession((s) => s.reset);
  const { concepts } = useGraph(subject);

  const stats = useMemo(() => {
    const tested = [...new Set(graded.flatMap((g) => g.concepts))];
    const wrongSet = new Set(graded.filter((g) => !g.correct).flatMap((g) => g.concepts));
    const mastered = (id: string) => progress[id]?.status === "mastered";
    const radar = tested.map((id) => {
      const before = wrongSet.has(id) ? 0.2 : 1;
      let after = before;
      if (progress[id]) after = AFTER[progress[id].status];
      else if (wrongSet.has(id)) {
        const pre = concepts?.find((c) => c.id === id)?.prerequisites ?? [];
        if (pre.length > 0 && pre.every(mastered)) after = 0.7;
      }
      return { concept: conceptName(concepts, id), before: before * 100, after: after * 100 };
    });
    const gapIds = diagnosis?.root_gaps.map((g) => g.concept_id) ?? [];
    const flagged = Object.entries(progress).filter(([, p]) => p.status === "needs_teacher").map(([id]) => id);
    const next = (concepts ?? []).filter((c) => !tested.includes(c.id) && !progress[c.id] && c.prerequisites.length > 0 && c.prerequisites.every(mastered));
    return { radar, gapIds, flagged, next, masteredCount: gapIds.filter(mastered).length };
  }, [graded, progress, diagnosis, concepts]);

  const mins = Math.max(1, Math.round(responses.reduce((a, r) => a + r.timeMs, 0) / 60000));
  const tiles = [
    { label: "Gaps found", value: stats.gapIds.length, tone: "text-amber-300" },
    { label: "Gaps mastered", value: `${stats.masteredCount}/${stats.gapIds.length}`, tone: "text-emerald-300" },
    { label: "Quiz time", value: `${mins} min`, tone: "text-indigo-300" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="text-4xl font-extrabold">Your GapFinder report</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} className="text-center">
            <div className={`text-4xl font-extrabold ${t.tone}`}>{t.value}</div>
            <div className="mt-1 text-sm text-slate-400">{t.label}</div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Before vs. after, per concept tested</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={stats.radar} outerRadius="70%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="concept" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Before" dataKey="before" stroke="#fb7185" fill="#fb7185" fillOpacity={0.25} />
                <Radar name="After" dataKey="after" stroke="#34d399" fill="#34d399" fillOpacity={0.35} />
                <Legend wrapperStyle={{ color: "#cbd5e1" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div>
          <ConceptGraph mode="static" className="h-[360px] lg:h-full lg:min-h-[360px]" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Flagged for your teacher</h3>
          {stats.flagged.length === 0 ? <p className="mt-2 text-slate-400">Nothing flagged. 🎯</p> : (
            <ul className="mt-3 flex flex-wrap gap-2">{stats.flagged.map((id) => <Badge key={id} tone="amber">{conceptName(concepts, id)}</Badge>)}</ul>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold">Recommended next</h3>
          {stats.next.length === 0 ? <p className="mt-2 text-slate-400">Take another quiz to explore more concepts.</p> : (
            <ul className="mt-3 flex flex-wrap gap-2">{stats.next.map((c) => <Badge key={c.id} tone="indigo">{c.name}</Badge>)}</ul>
          )}
        </Card>
      </div>
      <div className="mt-8 text-center"><Button onClick={reset} className="px-10">Start over ↺</Button></div>
    </div>
  );
}
