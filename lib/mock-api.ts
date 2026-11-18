// Offline mocks (NEXT_PUBLIC_MOCK=1) so the UI works without the backend.
// `generate` returns an AI-style "Photosynthesis" pack for any topic; presets return a fractions pack.
import type {
  DiagnoseRes, GenerateRes, GradeRes, LessonReq, MasteryReq, MasteryRes, QuizRes, TeachbackReq, TeachbackRes,
} from "./api-contract";
import type { Concept, GradedResponse, MasteryItem, Question, StudentResponse, Subject, TopicPack } from "./schema";

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); });
  });

const concept = (prefix: string, subject: string) => (id: string, name: string, prerequisites: string[], grade: number, description: string): Concept => ({
  id: `${prefix}.${id}`, subject, name, description, prerequisites: prerequisites.map((p) => `${prefix}.${p}`), grade,
});
type Opt = [string, string | null];
const mcq = (prefix: string, subject: string) => (id: string, difficulty: number, stem: string, concepts: string[], answer: string, opts: Opt[], explanation: string): Question => ({
  id, subject, type: "mcq", difficulty, stem, concepts: concepts.map((c) => `${prefix}.${c}`), answer, explanation,
  options: opts.map(([text, misconception], i) => ({ id: "abcd"[i], text, misconception })),
});

// ---------- AI-style pack: Photosynthesis ----------
const pc = concept("bio.photo", "photosynthesis");
const pq = mcq("bio.photo", "photosynthesis");
const PHOTO: TopicPack = {
  id: "mock-photosynthesis", topic: "Photosynthesis", subject: "photosynthesis", level: "High school", source: "ai",
  concepts: [
    pc("matter", "Conservation of matter", [], 6, "Atoms are rearranged in reactions, never created or destroyed."),
    pc("energy", "Forms of energy", [], 6, "Energy can change form, e.g. light into chemical energy."),
    pc("cells", "Plant cells and chloroplasts", [], 7, "Chloroplasts hold chlorophyll, the pigment that captures light."),
    pc("gases", "Gas exchange in leaves", ["cells"], 7, "Leaves take in carbon dioxide and release oxygen through stomata."),
    pc("light", "Light as an energy source", ["energy"], 8, "Sunlight supplies the energy that drives the reaction."),
    pc("inputs", "Inputs and outputs of photosynthesis", ["matter", "gases"], 8, "CO₂ and water go in; glucose and oxygen come out."),
    pc("glucose", "Glucose as stored energy", ["light", "inputs"], 9, "Glucose locks the captured light energy into chemical bonds."),
    pc("overall", "Photosynthesis", ["glucose", "cells"], 9, "How plants turn light, water and CO₂ into food and oxygen."),
  ],
  questions: [
    pq("p1", 2, "Where does most of the mass of a growing tree come from?", ["inputs", "matter"], "c",
      [["Minerals absorbed from the soil", "mass_from_soil"], ["Water pulled up by the roots", "mass_from_water"], ["Carbon dioxide taken from the air", null], ["Energy absorbed from sunlight", "light_is_matter"]],
      "The carbon atoms in glucose (and so in wood) come from CO₂ in the air."),
    pq("p2", 1, "What is the main job of chlorophyll in a leaf?", ["cells", "light"], "a",
      [["It absorbs light energy", null], ["It stores sugar for later", "chlorophyll_stores_food"], ["It pulls carbon dioxide into the leaf", "chlorophyll_takes_gas"], ["It makes the leaf look green to attract insects", "green_for_display"]],
      "Chlorophyll captures light energy that powers the reaction."),
    pq("p3", 1, "Which gas do plants release as a product of photosynthesis?", ["gases"], "b",
      [["Carbon dioxide", "reversed_gas_exchange"], ["Oxygen", null], ["Nitrogen", "nitrogen_product"], ["Only water vapour", "only_water_out"]],
      "Oxygen is released when water molecules are split."),
    pq("p4", 2, "A plant is sealed in a jar with light and water but no carbon dioxide. What happens?", ["inputs", "glucose"], "b",
      [["It grows normally because it has light", "light_alone_enough"], ["It can no longer make glucose", null], ["It makes extra oxygen instead", "oxygen_from_nothing"], ["It grows faster with less competition", "unrelated_growth"]],
      "Without CO₂ there is no carbon to build glucose, so photosynthesis stops."),
    pq("p5", 2, "The energy stored in a plant's glucose originally came from…", ["light", "glucose"], "b",
      [["Nutrients in the soil", "energy_from_soil"], ["The Sun", null], ["The water the plant absorbs", "energy_from_water"], ["The plant's own cells", "energy_created"]],
      "Light energy from the Sun is converted into chemical energy in glucose."),
  ],
};

// ---------- Preset pack: Fractions ----------
const fc = concept("math.frac", "math");
const fq = mcq("math.frac", "math");
const FRACTIONS: TopicPack = {
  id: "preset-math", topic: "Adding fractions", subject: "math", level: "Grade 5", source: "preset",
  concepts: [
    fc("meaning", "Fractions as parts", [], 3, "A fraction names equal parts of a whole."),
    fc("equivalence", "Equivalent fractions", ["meaning"], 4, "Different fractions can name the same amount."),
    fc("compare", "Comparing fractions", ["equivalence"], 4, "Decide which of two fractions is larger."),
    fc("simplify", "Simplifying fractions", ["equivalence"], 5, "Divide top and bottom by a common factor."),
    fc("addlike", "Adding like denominators", ["meaning"], 4, "Add the tops when the pieces are the same size."),
    fc("addunlike", "Adding unlike denominators", ["equivalence", "addlike"], 5, "Rewrite with a common denominator first."),
  ],
  questions: [
    fq("q1", 1, "Which fraction is equal to $\\frac{1}{2}$?", ["equivalence"], "b",
      [["$\\frac{2}{3}$", "adds_to_num_and_den"], ["$\\frac{3}{6}$", null], ["$\\frac{1}{4}$", "bigger_den_means_bigger"], ["$\\frac{2}{1}$", "inverted"]], "Multiply top and bottom by 3."),
    fq("q2", 2, "Which is larger, $\\frac{3}{4}$ or $\\frac{2}{3}$?", ["compare", "equivalence"], "a",
      [["$\\frac{3}{4}$", null], ["$\\frac{2}{3}$", "compares_numerators_only"], ["They are equal", "compares_differences"], ["Can't tell", "unknown_error"]], "9/12 > 8/12."),
    fq("q3", 2, "What is $\\frac{1}{3} + \\frac{1}{4}$?", ["addunlike"], "c",
      [["$\\frac{2}{7}$", "adds_across"], ["$\\frac{2}{12}$", "adds_across"], ["$\\frac{7}{12}$", null], ["$\\frac{1}{7}$", "adds_across"]], "4/12 + 3/12 = 7/12."),
    fq("q4", 2, "Simplify $\\frac{6}{8}$ as far as possible.", ["simplify"], "a",
      [["$\\frac{3}{4}$", null], ["$\\frac{6}{8}$", "already_simplest"], ["$\\frac{2}{3}$", "subtracts_to_simplify"], ["$\\frac{1}{2}$", "rounds_fraction"]], "Divide both by 2."),
    fq("q5", 1, "A pizza is cut into 8 equal slices and you eat 3. What fraction did you eat?", ["meaning"], "d",
      [["$\\frac{3}{5}$", "part_to_part"], ["$\\frac{8}{3}$", "inverted"], ["$\\frac{5}{8}$", "counts_remaining"], ["$\\frac{3}{8}$", null]], "3 of 8 equal slices."),
  ],
};

const MISCONCEPTIONS: Record<string, string> = {
  mass_from_soil: "Thinks a plant's mass comes from the soil rather than from carbon dioxide in the air.",
  mass_from_water: "Thinks water alone builds the plant's body.",
  light_is_matter: "Treats light as a substance that becomes part of the plant.",
  light_alone_enough: "Believes light by itself is enough for a plant to make food.",
  reversed_gas_exchange: "Mixes up which gas goes in and which comes out.",
  energy_from_soil: "Thinks plants get their energy from soil nutrients.",
  adds_across: "Adds numerators and denominators straight across.",
  adds_to_num_and_den: "Treats the top and bottom numbers as separate counts.",
  compares_numerators_only: "Compares fractions by looking only at the top numbers.",
};
const human = (tag: string | null) => (tag ? MISCONCEPTIONS[tag] ?? `${tag.replace(/_/g, " ")}.`.replace(/^./, (c) => c.toUpperCase()) : "");

const packOf = (pack: TopicPack | null | undefined) => pack ?? FRACTIONS;

export async function generate(topic: string, level?: string, signal?: AbortSignal): Promise<GenerateRes> {
  await sleep(2200, signal);
  if (/^\s*fail\b/i.test(topic)) throw new Error("The AI couldn't build a quiz for that topic. Try rephrasing it.");
  return { pack: { ...PHOTO, level: level ?? PHOTO.level } };
}

export async function getQuiz(subject: Subject): Promise<QuizRes> {
  void subject;
  await sleep(300);
  return {
    pack: FRACTIONS,
    questions: FRACTIONS.questions.map((q) => ({
      id: q.id, subject: q.subject, type: q.type, difficulty: q.difficulty, stem: q.stem, concepts: q.concepts,
      options: q.options?.map((o) => ({ id: o.id, text: o.text, misconception: null })),
    })),
  };
}

export async function grade(responses: StudentResponse[], pack: TopicPack | null): Promise<GradeRes> {
  await sleep(400);
  const P = packOf(pack);
  const graded: GradedResponse[] = responses.map((r) => {
    const q = P.questions.find((x) => x.id === r.qid)!;
    const opt = q.options?.find((o) => o.id === r.answer);
    const correct = r.answer.trim().toLowerCase() === q.answer.toLowerCase();
    return {
      ...r, correct, misconception: correct ? null : opt?.misconception ?? "unknown_error", stem: q.stem,
      chosenText: opt?.text ?? r.answer, correctText: q.options?.find((o) => o.id === q.answer)?.text ?? q.answer,
      explanation: q.explanation, concepts: q.concepts,
    };
  });
  return { graded };
}

export async function diagnose(subject: Subject, graded: GradedResponse[], pack: TopicPack | null): Promise<DiagnoseRes> {
  void subject;
  await sleep(1600);
  const P = packOf(pack);
  const wrong = graded.filter((g) => !g.correct);
  const count = new Map<string, string[]>();
  for (const w of wrong) for (const c of w.concepts) count.set(c, [...(count.get(c) ?? []), w.qid]);
  const order = P.concepts.map((c) => c.id);
  const ranked = [...count.entries()].sort((a, b) => b[1].length - a[1].length || order.indexOf(a[0]) - order.indexOf(b[0]));
  const gaps: DiagnoseRes["root_gaps"] = [];
  const covered = new Set<string>();
  for (const [cid, qids] of ranked) {
    if (gaps.length >= 2) break;
    if (qids.every((q) => covered.has(q))) continue;
    qids.forEach((q) => covered.add(q));
    const name = P.concepts.find((c) => c.id === cid)?.name ?? cid;
    gaps.push({
      concept_id: cid, confidence: gaps.length === 0 ? 0.86 : 0.62, explains_qids: qids,
      reasoning: `Wrong answers on ${qids.length} question${qids.length > 1 ? "s" : ""} share one pattern that points back to ${name}. The chosen distractors match a known misconception rather than a careless slip, and the student was fairly confident, which suggests a stable mental model that needs re-teaching.`,
      student_facing_summary: P.id.startsWith("mock-photo") && cid.endsWith("inputs")
        ? "You picture plants pulling their building material out of the soil. In fact, most of a plant is built from carbon dioxide in the air, and without it no glucose can be made."
        : `Several of your answers point to the same missing idea: ${name.toLowerCase()}. Once that clicks, the other questions get much easier.`,
    });
  }
  const strengths = [...new Set(graded.filter((g) => g.correct).flatMap((g) => g.concepts))].filter((c) => !count.has(c));
  return {
    per_question: graded.map((g) => ({
      qid: g.qid,
      error_type: g.correct ? "correct" : g.confidence < 0.3 ? "guess" : g.confidence < 0.55 && !g.misconception ? "slip" : "misconception",
      misconception: g.correct ? "" : human(g.misconception),
      evidence: g.correct ? "Correct answer." : `Chose "${g.chosenText}" with ${Math.round(g.confidence * 100)}% confidence.`,
    })),
    root_gaps: gaps,
    strengths,
    heuristic: [],
    fallback: false,
  };
}

const PHOTO_LESSON = (req: LessonReq) => `## The idea
Photosynthesis is a recipe with **two ingredients that are matter** and **one that is energy**. Carbon dioxide from the air and water from the roots are rearranged into glucose and oxygen. Light doesn't become part of the plant — it only powers the rearranging.

$$
6\\,CO_2 + 6\\,H_2O \\xrightarrow{\\text{light}} C_6H_{12}O_6 + 6\\,O_2
$$

## Why your answer happened
You picked "${req.wrongAnswer || "minerals from the soil"}". It feels right because roots sit in soil and plants need nutrients. But nutrients are tiny amounts, like vitamins. The bulk of a plant — every carbon atom in its wood and leaves — was pulled out of the air as CO₂.

## Analogy
${req.interest === "cooking"
    ? "Think of baking a cake. The cake is made of flour and eggs; the oven's heat makes the change happen but never ends up inside the cake. CO₂ and water are the flour and eggs. Light is the oven."
    : `Think of ${req.interest}: a stadium is built from steel and concrete delivered by trucks; the electricity running the cranes powers the build but isn't part of the stadium. CO₂ and water are the building materials. Light is the electricity.`}${req.previousAnalogy ? " (A fresh angle from last time.)" : ""}

## Worked example
A 5 kg seedling grows into a 200 kg tree, and the soil around it loses only about 0.1 kg.

1. Where did the other ~195 kg come from? Not the soil — it barely changed.
2. Water adds mass, but much of it is lost again through the leaves.
3. The rest is carbon fixed from **CO₂ in the air**, locked into glucose and then into wood.

## Try this
A plant gets light and water but the air around it has had all CO₂ removed. Can it keep building glucose?

<details><summary>Show answer</summary>No. Glucose is made of carbon atoms, and the only carbon source is CO₂. Light alone supplies energy but no building material.</details>
`;

const FRACTIONS_LESSON = (req: LessonReq) => `## The idea
Equivalent fractions name the **same amount** with different pieces. $\\frac{1}{2}=\\frac{3}{6}$ because multiplying top and bottom by the same number just cuts each piece smaller.

## Why your answer happened
You picked "${req.wrongAnswer}". That treats the top and bottom as separate numbers, so changing them independently *seems* fine. It changes the amount.

## Analogy
Think of ${req.interest}: making 1 of 2 shots is the same rate as 3 of 6. Doubling the attempts and the makes together keeps the percentage fixed.

## Worked example
Is $\\frac{2}{3}$ equal to $\\frac{4}{6}$? Multiply top and bottom by $2$: $\\frac{2\\cdot 2}{3\\cdot 2}=\\frac{4}{6}$. Yes.

## Try this
Find a fraction equal to $\\frac{3}{5}$ with denominator $20$.

<details><summary>Show answer</summary>Multiply by $4$: $\\frac{12}{20}$.</details>
`;

export async function streamLesson(req: LessonReq, onChunk: (t: string) => void, signal?: AbortSignal) {
  await sleep(500, signal);
  const text = req.pack?.id.startsWith("mock-photo") ? PHOTO_LESSON(req) : FRACTIONS_LESSON(req);
  let i = 0;
  await new Promise<void>((resolve, reject) => {
    const t = setInterval(() => {
      if (signal?.aborted) { clearInterval(t); reject(new DOMException("Aborted", "AbortError")); return; }
      i = Math.min(text.length, i + 9);
      onChunk(text.slice(0, i));
      if (i >= text.length) { clearInterval(t); resolve(); }
    }, 20);
  });
  return { text, fallback: false };
}

const item = (kind: MasteryItem["kind"], stem: string, answer: string, opts: string[], explanation: string): MasteryItem => ({
  kind, stem, answer, explanation, options: opts.map((text, i) => ({ id: "abcd"[i], text, misconception: "abcd"[i] === answer ? null : "distractor" })),
});

export async function getMastery(req: MasteryReq): Promise<MasteryRes> {
  await sleep(900);
  if (req.pack?.id.startsWith("mock-photo"))
    return {
      items: [
        item("recall", "Which two substances are the raw materials of photosynthesis?", "a",
          ["Carbon dioxide and water", "Oxygen and glucose", "Soil minerals and water", "Light and chlorophyll"], "CO₂ and water are rearranged into glucose and oxygen."),
        item("application", "A sealed jar has a plant, light and water. Which change would let it make the most glucose?", "c",
          ["Adding more soil", "Adding a second light", "Adding carbon dioxide to the air", "Removing the oxygen"], "CO₂ is the missing carbon source; without it, light can't help."),
        item("transfer", "Farmers sometimes pump extra CO₂ into greenhouses. Why does this work?", "b",
          ["CO₂ keeps the greenhouse warm at night", "Plants build more glucose, and so more mass, from the extra carbon", "CO₂ kills insects that eat the crops", "It replaces the need for water"], "More CO₂ means more carbon available to fix into sugars."),
      ],
      fallback: false,
    };
  return {
    items: [
      item("recall", "Equivalent fractions represent…", "a", ["The same amount", "The same numerator", "The same denominator", "Different amounts"], "Same amount, different names."),
      item("application", "Which equals $\\frac{2}{5}$?", "b", ["$\\frac{3}{6}$", "$\\frac{4}{10}$", "$\\frac{2}{10}$", "$\\frac{5}{2}$"], "Multiply both by 2: 4/10."),
      item("transfer", "A team makes 4 of 8 shots, another 9 of 18. Who shoots better?", "c", ["First team", "Second team", "They are equal", "Not enough info"], "Both are 1/2: equal."),
    ],
    fallback: false,
  };
}

export async function teachback(r: TeachbackReq): Promise<TeachbackRes> {
  await sleep(1200);
  const words = r.explanation.trim().split(/\s+/).length;
  const score = Math.min(92, 35 + words * 2);
  return {
    accuracy: Math.min(9, 4 + words / 6), completeness: Math.min(8.5, 3 + words / 8), misconception_present: words < 8, score,
    tip: "Strong start. Add one concrete example — like the greenhouse with extra CO₂ — to show you can apply the idea, not just state it.",
  };
}
