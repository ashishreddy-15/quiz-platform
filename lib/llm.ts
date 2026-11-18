// SHARED CONTRACT — the only module that talks to the LLM provider (Groq). Server-only.
import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// Used when the primary model is rate-limited (429) — separate per-model quota on Groq.
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";

function isRateLimit(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { status?: number }).status === 429
  );
}
/** Runs `fn(model)` on the primary model, retrying once on the fallback model if rate-limited. */
async function withModel<T>(fn: (model: string) => Promise<T>): Promise<T> {
  try {
    return await fn(MODEL);
  } catch (e) {
    if (!isRateLimit(e) || FALLBACK_MODEL === MODEL) throw e;
    // A short wait on the primary beats a weaker model (20b breaks JSON more often).
    const shortWait = retryAfterMs(e);
    if (shortWait !== null && shortWait <= 8_000) {
      console.warn(`[llm] ${MODEL} rate-limited; waiting ${shortWait}ms`);
      await new Promise((r) => setTimeout(r, shortWait));
      try {
        return await fn(MODEL);
      } catch (e3) {
        if (!isRateLimit(e3)) throw e3;
      }
    }
    console.warn(`[llm] ${MODEL} rate-limited; retrying on ${FALLBACK_MODEL}`);
    try {
      return await fn(FALLBACK_MODEL);
    } catch (e2) {
      // Both per-model quotas exhausted: wait out a short retry-after once rather than failing the request.
      const wait = retryAfterMs(e2) ?? retryAfterMs(e);
      if (!isRateLimit(e2) || wait === null || wait > 12_000) throw e2;
      console.warn(`[llm] both models rate-limited; waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      return fn(FALLBACK_MODEL);
    }
  }
}

function retryAfterMs(e: unknown): number | null {
  const h = (e as { headers?: Headers | Record<string, string> })?.headers;
  const v = h instanceof Headers ? h.get("retry-after") : h?.["retry-after"];
  const n = v ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? Math.ceil(n * 1000) + 250 : null;
}
let client: Groq | null = null;
function groq() {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");
  return (client ??= new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0, timeout: 45_000 }));
}

/** Fixes the most common model JSON breakage: LaTeX backslashes (\frac, \times) that are invalid JSON escapes. */
export function repairJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Double any backslash not starting a valid JSON escape (\" \\ \/ \b \f \n \r \t \uXXXX).
    // \b \f \n \r \t followed by a letter are almost always LaTeX (\frac, \theta, \nu, \rho, \times) → escape them too.
    const fixed = raw
      .replace(/\\(?=[bfnrt][a-zA-Z])/g, "\\\\")
      .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    return JSON.parse(fixed);
  }
}

/** Groq returns 400 tool_use_failed with the raw generation when tool-call JSON doesn't parse; recover it. */
function recoverFailedGeneration(e: unknown): string | null {
  const err = e as {
    status?: number;
    error?: { error?: { code?: string; failed_generation?: string } };
  };
  const fg =
    err?.status === 400 && err.error?.error?.code === "tool_use_failed"
      ? err.error.error.failed_generation
      : undefined;
  if (!fg) return null;
  try {
    const outer = repairJSON(fg) as { arguments?: unknown };
    if (outer && typeof outer === "object" && "arguments" in outer) {
      return typeof outer.arguments === "string"
        ? outer.arguments
        : JSON.stringify(outer.arguments);
    }
  } catch {
    // Fall through: try to cut out the arguments object textually.
    const i = fg.indexOf('"arguments"');
    if (i >= 0) {
      const start = fg.indexOf("{", i);
      const end = fg.lastIndexOf("}", fg.lastIndexOf("}") - 1);
      if (start >= 0 && end > start) return fg.slice(start, end + 1);
    }
  }
  return null;
}

function isToolUseFailed(e: unknown): boolean {
  const err = e as { status?: number; error?: { error?: { code?: string } } };
  return err?.status === 400 && err.error?.error?.code === "tool_use_failed";
}

/** Same request without tools: the schema goes in the prompt and the model must reply with one JSON object. */
async function jsonModeCall(
  messages: Groq.Chat.ChatCompletionMessageParam[],
  parameters: Record<string, unknown>,
  temperature: number,
  reasoning: string,
): Promise<string> {
  const res = await withModel((model) =>
    groq().chat.completions.create({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        ...messages,
        {
          role: "user",
          content: `Reply with ONLY one JSON object (no prose, no code fences) that validates against this JSON Schema:\n${JSON.stringify(parameters)}`,
        },
      ],
      ...({ reasoning_effort: reasoning } as object),
    }),
  );
  return res.choices[0]?.message?.content ?? "";
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
  /** gpt-oss reasoning effort. Reasoning tokens count against Groq's tokens-per-minute limit. */
  reasoning?: "low" | "medium" | "high";
}): Promise<T> {
  const reasoning = opts.reasoning ?? "medium";
  const parameters = z.toJSONSchema(opts.schema, {
    target: "draft-7",
  }) as Record<string, unknown>;
  delete parameters.$schema;
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      const res = await withModel((model) =>
        groq().chat.completions.create({
          model,
          messages,
          temperature: opts.temperature ?? 0.4,
          tools: [
            {
              type: "function",
              function: {
                name: opts.toolName,
                description: opts.toolDescription,
                parameters,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: opts.toolName } },
          // gpt-oss reasoning knob; ignored by other models
          ...({ reasoning_effort: reasoning } as object),
        }),
      );
      const call = res.choices[0]?.message?.tool_calls?.[0];
      raw = call?.function?.arguments ?? res.choices[0]?.message?.content ?? "";
    } catch (e) {
      const recovered = recoverFailedGeneration(e);
      if (recovered !== null) {
        console.warn(`[llm] ${opts.toolName}: recovered tool_use_failed output`);
        raw = recovered;
      } else if (isToolUseFailed(e)) {
        // Model skipped the tool entirely (seen on gpt-oss-20b): fall back to plain JSON mode.
        console.warn(`[llm] ${opts.toolName}: no tool call; retrying in JSON mode`);
        raw = await jsonModeCall(messages, parameters, opts.temperature ?? 0.4, reasoning);
      } else throw e;
    }
    try {
      return opts.schema.parse(repairJSON(raw));
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
export async function chatStream(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const stream = await withModel((model) =>
    groq().chat.completions.create({
      model,
      stream: true,
      temperature: opts.temperature ?? 0.7,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...({ reasoning_effort: "low" } as object),
    }),
  );
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content;
          if (t) controller.enqueue(enc.encode(t));
        }
      } catch (e) {
        controller.enqueue(
          enc.encode(`\n\n> Stream interrupted: ${String(e).slice(0, 200)}`),
        );
      }
      controller.close();
    },
  });
}

export const LLM_MODEL = MODEL;
