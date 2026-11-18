// Typed fetch wrappers for every route in api-contract.ts. Routes to mock-api when NEXT_PUBLIC_MOCK=1.
// Every call after quiz/generate sends the session's `pack` so the stateless routes know the topic.
import type {
  DiagnoseReq, DiagnoseRes, GenerateReq, GenerateRes, GradeReq, GradeRes, LessonReq, MasteryReq, MasteryRes, QuizReq,
  QuizRes, TeachbackReq, TeachbackRes,
} from "./api-contract";
import type { GradedResponse, StudentResponse, Subject, TopicPack } from "./schema";
import * as mock from "./mock-api";

const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      if (j?.error) return typeof j.error === "string" ? j.error : JSON.stringify(j.error);
      if (j?.message) return String(j.message);
    } catch {
      if (text && text.length < 300 && !text.trimStart().startsWith("<")) return text.trim();
    }
  } catch {}
  return `${fallback} (${res.status})`;
}

async function request<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(await errorMessage(res, "Request failed"));
  return (await res.json()) as T;
}

/** AI builds a concept map + 5 diagnostic questions for any topic. */
export const generate = (topic: string, level?: string, signal?: AbortSignal): Promise<GenerateRes> =>
  MOCK ? mock.generate(topic, level, signal) : request<GenerateRes>("/api/generate", { topic, ...(level ? { level } : {}) } satisfies GenerateReq, signal);

/** Preset topic from the static bank. */
export const getQuiz = (subject: Subject, signal?: AbortSignal): Promise<QuizRes> =>
  MOCK ? mock.getQuiz(subject) : request<QuizRes>("/api/quiz", { subject } satisfies QuizReq, signal);

export const grade = (responses: StudentResponse[], pack: TopicPack | null): Promise<GradeRes> =>
  MOCK ? mock.grade(responses, pack) : request<GradeRes>("/api/grade", { responses, ...(pack ? { pack } : {}) } satisfies GradeReq);

export const diagnose = (subject: Subject, graded: GradedResponse[], pack: TopicPack | null): Promise<DiagnoseRes> =>
  MOCK ? mock.diagnose(subject, graded, pack)
    : request<DiagnoseRes>("/api/diagnose", { subject, graded, ...(pack ? { pack } : {}) } satisfies DiagnoseReq);

export async function streamLesson(
  req: LessonReq,
  onChunk: (fullTextSoFar: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; fallback: boolean }> {
  if (MOCK) return mock.streamLesson(req, onChunk, signal);
  let res: Response;
  try {
    res = await fetch("/api/lesson", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok || !res.body) throw new Error(await errorMessage(res, "Lesson failed"));
  const fallback = res.headers.get("x-fallback") === "1";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    onChunk(text);
  }
  text += dec.decode();
  onChunk(text);
  return { text, fallback };
}

export const getMastery = (req: MasteryReq): Promise<MasteryRes> =>
  MOCK ? mock.getMastery(req) : request<MasteryRes>("/api/mastery", req);

export const teachback = (req: TeachbackReq): Promise<TeachbackRes> =>
  MOCK ? mock.teachback(req) : request<TeachbackRes>("/api/teachback", req);
