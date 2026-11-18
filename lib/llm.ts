// SHARED CONTRACT — the only module that talks to the LLM provider (Groq). Server-only.
import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// Used when the primary model is rate-limited (429) — separate per-model quota on Groq.
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";

function isRateLimit(e: unknown) {
  return typeof e === "object" && e !== null && (e as { status?: number }).status === 429;
}
/** Runs `fn(model)` on the primary model, retrying once on the fallback model if rate-limited. */
async function withModel<T>(fn: (model: string) => Promise<T>): Promise<T> {
  try {
    return await fn(MODEL);
  } catch (e) {
    if (!isRateLimit(e) || FALLBACK_MODEL === MODEL) throw e;
    console.warn(`[llm] ${MODEL} rate-limited; retrying on ${FALLBACK_MODEL}`);
    return fn(FALLBACK_MODEL);
  }
}
let client: Groq | null = null;
function groq() {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");
  return (client ??= new Groq({ apiKey: process.env.GROQ_API_KEY }));
}

/**
 * Structured call via forced function-calling. Output is validated with `schema`;
 * on failure, retries once with the validation error appended.
 */
export async function chatJSON<T>(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const parameters = z.toJSONSchema(opts.schema, { target: "draft-7" }) as Record<string, unknown>;
  delete parameters.$schema;
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await withModel((model) => groq().chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      tools: [{ type: "function", function: { name: opts.toolName, description: opts.toolDescription, parameters } }],
      tool_choice: { type: "function", function: { name: opts.toolName } },
      // gpt-oss reasoning knob; ignored by other models
      ...({ reasoning_effort: "medium" } as object),
    }));
    const call = res.choices[0]?.message?.tool_calls?.[0];
    const raw = call?.function?.arguments ?? res.choices[0]?.message?.content ?? "";
    try {
      return opts.schema.parse(JSON.parse(raw));
    } catch (e) {
      lastErr = e;
      messages.push({ role: "assistant", content: raw || "(empty)" });
      messages.push({
        role: "user",
        content: `Your previous output failed validation: ${String(e).slice(0, 800)}. Call ${opts.toolName} again with corrected arguments.`,
      });
    }
  }
  throw new Error(`chatJSON(${opts.toolName}) failed: ${String(lastErr)}`);
}

/** Streams plain text deltas as a UTF-8 ReadableStream. */
export async function chatStream(opts: { system: string; user: string; temperature?: number }): Promise<ReadableStream<Uint8Array>> {
  const stream = await withModel((model) => groq().chat.completions.create({
    model,
    stream: true,
    temperature: opts.temperature ?? 0.7,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    ...({ reasoning_effort: "low" } as object),
  }));
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content;
          if (t) controller.enqueue(enc.encode(t));
        }
      } catch (e) {
        controller.enqueue(enc.encode(`\n\n> Stream interrupted: ${String(e).slice(0, 200)}`));
      }
      controller.close();
    },
  });
}

export const LLM_MODEL = MODEL;
