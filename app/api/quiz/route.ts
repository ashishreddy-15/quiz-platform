import { NextResponse } from "next/server";
import { z } from "zod";
import { presetPack, toPublic } from "@/lib/graph";
import { SubjectSchema } from "@/lib/schema";
import { parseBody } from "@/lib/route-util";
import type { QuizRes } from "@/lib/api-contract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ subject: SubjectSchema }));
  if (!p.ok) return p.res;
  const pack = presetPack(p.data.subject);
  if (pack.questions.length < 3) return NextResponse.json({ error: "Unknown subject" }, { status: 400 });
  const body: QuizRes = { pack, questions: pack.questions.map(toPublic) };
  return NextResponse.json(body);
}
