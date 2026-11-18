import { LESSON_HEADINGS } from "@/lib/api-contract";

export type Section = { heading: string; body: string };

/** Split streaming markdown on "## " headings. Text before the first heading is ignored. */
export function splitSections(text: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const line of text.split("\n")) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) { cur = { heading: m[1].trim(), body: "" }; out.push(cur); }
    else if (cur) cur.body += line + "\n";
  }
  return out.map((s) => ({ ...s, body: s.body.trim() }));
}

export type Segment = { kind: "md"; text: string } | { kind: "reveal"; summary: string; text: string };

/** Turn <details><summary>X</summary>Y</details> into reveal segments; hide a still-open <details> while streaming. */
export function splitReveals(body: string): Segment[] {
  const out: Segment[] = [];
  const re = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push({ kind: "md", text: body.slice(last, m.index) });
    out.push({ kind: "reveal", summary: m[1].trim(), text: m[2].trim() });
    last = m.index + m[0].length;
  }
  let rest = body.slice(last);
  const open = rest.search(/<d(e(t(a(i(l(s)?)?)?)?)?)?$|<details/i);
  if (open >= 0) rest = rest.slice(0, open);
  if (rest.trim()) out.push({ kind: "md", text: rest });
  return out;
}

export function analogySummary(lesson: string): string {
  const a = splitSections(lesson).find((s) => s.heading.toLowerCase().startsWith("analogy"));
  return (a?.body ?? "").replace(/\s+/g, " ").slice(0, 120);
}

export const HEADINGS: readonly string[] = LESSON_HEADINGS;
