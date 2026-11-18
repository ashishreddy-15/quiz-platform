import { NextResponse } from "next/server";
import { conceptsForSubject } from "@/lib/graph";
import { SubjectSchema } from "@/lib/schema";
import type { GraphRes } from "@/lib/api-contract";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = SubjectSchema.safeParse(new URL(req.url).searchParams.get("subject"));
  if (!s.success) return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  const body: GraphRes = { concepts: conceptsForSubject(s.data) };
  return NextResponse.json(body);
}
