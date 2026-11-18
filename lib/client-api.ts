// Typed fetch wrappers for every route in api-contract.ts. Routes to mock-api when NEXT_PUBLIC_MOCK=1.
import type {
  DiagnoseReq, DiagnoseRes, GradeReq, GradeRes, GraphRes, LessonReq, MasteryReq, MasteryRes, QuizReq, QuizRes,
  TeachbackReq, TeachbackRes,
} from "./api-contract";
import type { GradedResponse, StudentResponse, Subject } from "./schema";
import * as mock from "./mock-api";

const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";

async function request<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const getGraph = (subject: Subject): Promise<GraphRes> =>
  MOCK ? mock.getGraph(subject) : request<GraphRes>(`/api/graph?subject=${subject}`);

export const getQuiz = (subject: Subject): Promise<QuizRes> =>
  MOCK ? mock.getQuiz(subject) : request<QuizRes>("/api/quiz", { subject } satisfies QuizReq);

export const grade = (responses: StudentResponse[]): Promise<GradeRes> =>
  MOCK ? mock.grade(responses) : request<GradeRes>("/api/grade", { responses } satisfies GradeReq);

export const diagnose = (subject: Subject, graded: GradedResponse[]): Promise<DiagnoseRes> =>
  MOCK ? mock.diagnose(subject, graded) : request<DiagnoseRes>("/api/diagnose", { subject, graded } satisfies DiagnoseReq);

export async function streamLesson(
  req: LessonReq,
  onChunk: (fullTextSoFar: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; fallback: boolean }> {
  if (MOCK) return mock.streamLesson(req, onChunk, signal);
  const res = await fetch("/api/lesson", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Lesson failed (${res.status})`);
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
