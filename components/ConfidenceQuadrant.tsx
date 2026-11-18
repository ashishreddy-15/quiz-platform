"use client";
import type { Diagnosis } from "@/lib/schema";
import type { GradedResponse } from "@/lib/schema";

/** 2x2: x = confidence, y = correct (top) / incorrect (bottom). Hand-rolled SVG. */
export function ConfidenceQuadrant({ graded, perQuestion }: { graded: GradedResponse[]; perQuestion?: Diagnosis["per_question"] }) {
  const W = 360, H = 280, P = 14;
  const iw = W - 2 * P, ih = H - 2 * P;
  const slot: Record<string, number> = {};
  const dots = graded.map((g) => {
    const key = `${g.correct}-${g.confidence >= 0.5}`;
    const n = (slot[key] = (slot[key] ?? -1) + 1);
    const x = P + Math.min(0.94, Math.max(0.06, g.confidence)) * iw;
    const yBase = g.correct ? P + ih * 0.2 : P + ih * 0.58;
    const y = yBase + (n % 3) * 26;
    const et = perQuestion?.find((p) => p.qid === g.qid)?.error_type;
    const fill = g.correct ? "#34d399" : et === "slip" ? "#fbbf24" : g.confidence >= 0.5 ? "#fb7185" : "#f59e0b";
    return { g, x, y, fill };
  });
  const quad = (x: number, y: number, w: number, h: number, fill: string, label: string, anchor: "start" | "end", ty: number) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={h} fill={fill} />
      <text x={anchor === "start" ? x + 8 : x + w - 8} y={ty} textAnchor={anchor} fontSize="10" fill="#cbd5e1" opacity=".85">{label}</text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Confidence versus correctness">
      <g transform="translate(0,0)">
        {quad(P, P, iw / 2, ih / 2, "rgba(251,191,36,0.10)", "Unsure & right → shaky", "start", P + 14)}
        {quad(P + iw / 2, P, iw / 2, ih / 2, "rgba(52,211,153,0.12)", "Confident & right → mastered", "end", P + 14)}
        {quad(P, P + ih / 2, iw / 2, ih / 2, "rgba(251,146,60,0.12)", "Unsure & wrong → gap", "start", P + ih - 8)}
        {quad(P + iw / 2, P + ih / 2, iw / 2, ih / 2, "rgba(244,63,94,0.16)", "Confident & wrong → misconception", "end", P + ih - 8)}
        <rect x={P} y={P} width={iw} height={ih} fill="none" stroke="#475569" strokeWidth="1" rx="6" />
        <line x1={P + iw / 2} x2={P + iw / 2} y1={P} y2={P + ih} stroke="#475569" strokeDasharray="3 3" />
        <line x1={P} x2={P + iw} y1={P + ih / 2} y2={P + ih / 2} stroke="#475569" strokeDasharray="3 3" />
        {dots.map(({ g, x, y, fill }) => (
          <g key={g.qid}>
            <circle cx={x} cy={y} r="11" fill={fill} fillOpacity=".9" stroke="#0f172a" strokeWidth="2" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">{g.qid.replace(/^q/i, "Q")}</text>
          </g>
        ))}
      </g>
      <text x={P} y={H + 10} fontSize="10" fill="#94a3b8">low confidence</text>
      <text x={W - P} y={H + 10} textAnchor="end" fontSize="10" fill="#94a3b8">high confidence →</text>
    </svg>
  );
}
