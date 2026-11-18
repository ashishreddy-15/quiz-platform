import { NextResponse } from "next/server";
import { z } from "zod";
import { getConcept } from "@/lib/graph";
import { chatJSON } from "@/lib/llm";
import { masteryPrompt } from "@/lib/prompts";
import { getFallbackMastery } from "@/lib/fallback";
import { MasteryItemsSchema, type MasteryItem } from "@/lib/schema";
import { parseBody, safeErr } from "@/lib/route-util";
import type { MasteryRes } from "@/lib/api-contract";

export const runtime = "nodejs";

const KINDS = ["recall", "application", "transfer"] as const;

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Validate exactly one correct option matching answer; shuffle and re-letter. Throws if invalid. */
function normalizeItems(items: MasteryItem[]): MasteryItem[] {
  return items.map((it, i) => {
    const correct = it.options.filter((o) => o.misconception === null);
    if (correct.length !== 1 || correct[0].id !== it.answer) throw new Error(`item ${i}: need exactly one correct option matching answer`);
    const shuffled = shuffle(it.options);
    const letters = ["a", "b", "c", "d"];
    const options = shuffled.map((o, k) => ({ ...o, id: letters[k] }));
    const answer = options.find((o) => o.misconception === null)!.id;
    return { ...it, kind: KINDS[i], options, answer };
  });
}

export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ conceptId: z.string(), misconception: z.string().max(1000), attempt: z.number().int().min(1).max(10), workedExample: z.string().max(4000).optional() }));
  if (!p.ok) return p.res;
  const concept = getConcept(p.data.conceptId);
  if (!concept) return NextResponse.json({ error: "Unknown concept" }, { status: 400 });
  try {
    const { system, user } = masteryPrompt(concept, p.data);
    const r = await chatJSON({ system, user, toolName: "create_mastery_items", toolDescription: "Create 3 mastery-check MCQ items", schema: MasteryItemsSchema, temperature: 0.5 });
    const out: MasteryRes = { items: normalizeItems(r.items) };
    return NextResponse.json(out);
  } catch (e) {
    console.error("mastery failed:", safeErr(e));
    const out: MasteryRes = { items: getFallbackMastery(p.data.conceptId), fallback: true };
    return NextResponse.json(out);
  }
}
