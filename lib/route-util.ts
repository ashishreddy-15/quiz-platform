import { NextResponse } from "next/server";
import type { z } from "zod";

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  try {
    const r = schema.safeParse(await req.json());
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, res: NextResponse.json({ error: "Invalid request", issues: r.error.issues.slice(0, 5) }, { status: 400 }) };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}

export function safeErr(e: unknown) {
  return String(e instanceof Error ? e.message : e).replace(/gsk_[A-Za-z0-9]+/g, "[redacted]").slice(0, 300);
}
