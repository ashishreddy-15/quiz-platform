import { NextResponse } from "next/server";
import { z } from "zod";
import { conceptsForSubject, graphFor } from "@/lib/graph";
import { chatJSON } from "@/lib/llm";
import { diagnosePrompt } from "@/lib/prompts";
import { DiagnosisSchema, GradedResponseSchema, SubjectSchema, TopicPackSchema, type Concept, type Diagnosis, type GapCandidate, type GradedResponse } from "@/lib/schema";
import { parseBody, safeErr } from "@/lib/route-util";
import type { DiagnoseRes } from "@/lib/api-contract";

export const runtime = "nodejs";

function heuristicDiagnosis(graded: GradedResponse[], heuristic: GapCandidate[], byId: Map<string, Concept>): Diagnosis {
  const root_gaps = heuristic.slice(0, 3).map((h) => {
    const name = byId.get(h.concept)?.name ?? h.concept;
    return {
      concept_id: h.concept,
      confidence: Math.max(0.3, Math.min(0.9, h.score)),
      explains_qids: h.explains_qids,
      reasoning: `Heuristic: ${h.evidence_count} wrong answer(s) trace back to "${name}" or its prerequisites.`,
      student_facing_summary: `It looks like ${name} is the idea to firm up. Several of your mistakes trace back to it, so a quick refresher should help.`,
    };
  });
  return {
    per_question: graded.map((g) => ({
      qid: g.qid,
      error_type: g.correct ? ("correct" as const) : g.confidence < 0.4 ? ("guess" as const) : ("misconception" as const),
      misconception: g.correct ? "" : (g.misconception ?? "Unclear misconception"),
      evidence: g.correct ? "Answered correctly." : `Chose "${g.chosenText}" instead of "${g.correctText}".`,
    })),
    root_gaps,
    strengths: [...new Set(graded.filter((g) => g.correct).flatMap((g) => g.concepts))],
  };
}

export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ subject: SubjectSchema, graded: z.array(GradedResponseSchema).min(1).max(20), pack: TopicPackSchema.optional() }));
  if (!p.ok) return p.res;
  const { subject, graded, pack } = p.data;
  const g0 = graphFor(pack);
  const graph = pack ? pack.concepts : conceptsForSubject(subject);
  const byId = new Map(graph.map((c) => [c.id, c]));
  const wrong = graded.filter((g) => !g.correct);
  const heuristic = g0.scoreGaps(graded);

  if (wrong.length === 0) {
    const d = heuristicDiagnosis(graded, [], byId);
    const out: DiagnoseRes = { ...d, root_gaps: [], heuristic };
    return NextResponse.json(out);
  }

  try {
    const { system, user } = diagnosePrompt(graph, graded, heuristic);
    const d = await chatJSON({ system, user, toolName: "report_diagnosis", toolDescription: "Report the diagnosis of the student's concept gaps", schema: DiagnosisSchema, temperature: 0.2 });
    const root_gaps = d.root_gaps.filter((g) => byId.has(g.concept_id)).slice(0, 3);
    const strengths = d.strengths.filter((s) => byId.has(s));
    if (root_gaps.length === 0) {
      const f = heuristicDiagnosis(graded, heuristic, byId);
      const out: DiagnoseRes = { ...d, root_gaps: f.root_gaps, strengths, heuristic, fallback: true };
      return NextResponse.json(out);
    }
    const out: DiagnoseRes = { ...d, root_gaps, strengths, heuristic };
    return NextResponse.json(out);
  } catch (e) {
    console.error("diagnose failed:", safeErr(e));
    const out: DiagnoseRes = { ...heuristicDiagnosis(graded, heuristic, byId), heuristic, fallback: true };
    return NextResponse.json(out);
  }
}
