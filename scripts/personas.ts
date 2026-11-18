// Usage: BASE_URL=http://localhost:3101 npx tsx scripts/personas.ts
import bankJson from "../data/question-bank.json";
import { QuestionBankSchema, type GradedResponse, type Question, type Subject } from "../lib/schema";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3101";
const bank = QuestionBankSchema.parse(bankJson);
const Q = new Map(bank.questions.map((q) => [q.id, q]));

type Pick = { qid: string; wrong?: string; conf: number }; // wrong = misconception tag; omitted = correct answer
type Persona = { name: string; subject: Subject; picks: Pick[]; accept: string[] };

function build(p: Pick): GradedResponse {
  const q = Q.get(p.qid) as Question;
  const correctText = q.type === "mcq" ? q.options!.find((o) => o.id === q.answer)!.text : q.answer;
  let answer = q.answer, chosenText = correctText, misconception: string | null = null, correct = true;
  if (p.wrong) {
    correct = false; misconception = p.wrong;
    if (q.type === "mcq") {
      const o = q.options!.find((x) => x.misconception === p.wrong);
      if (!o) throw new Error(`${p.qid}: no option with tag ${p.wrong}`);
      answer = o.id; chosenText = o.text;
    } else {
      answer = chosenText = p.wrong === "conflates_zero_velocity_with_zero_acceleration" ? "zero" : p.wrong === "ignores_coefficients_and_mole_ratios" ? "3" : "6/8";
    }
  }
  return {
    qid: q.id, answer, confidence: p.conf, timeMs: 6000, correct, misconception, stem: q.stem, chosenText, correctText,
    explanation: q.explanation, concepts: q.concepts,
  };
}

const personas: Persona[] = [
  { name: "math: adds numerators & denominators", subject: "math", accept: ["math.frac.equivalence", "math.frac.parts_whole", "math.frac.common_denominator", "math.frac.add_sub"],
    picks: [
      { qid: "math-1", wrong: "adds_numerators_and_denominators", conf: 0.9 },
      { qid: "math-4", wrong: "adds_numerators_and_denominators", conf: 0.85 },
      { qid: "math-2", wrong: "treats_equivalence_as_adding_same_amount_to_both_parts", conf: 0.8 },
      { qid: "math-3", conf: 0.7 }, { qid: "math-6", conf: 0.6 },
    ] },
  { name: "math: additive (not multiplicative) scaling", subject: "math", accept: ["math.frac.equivalence", "math.frac.parts_whole"],
    picks: [
      { qid: "math-2", wrong: "treats_equivalence_as_adding_same_amount_to_both_parts", conf: 0.9 },
      { qid: "math-5", wrong: "treats_equivalence_as_adding_same_amount_to_both_parts", conf: 0.8 },
      { qid: "math-6", wrong: "treats_equivalence_as_adding_same_amount_to_both_parts", conf: 0.9 },
      { qid: "math-3", conf: 0.7 },
    ] },
  { name: "physics: zero velocity = zero acceleration", subject: "physics", accept: ["phys.kin.acceleration", "phys.kin.speed_velocity", "phys.kin.position_displacement"],
    picks: [
      { qid: "phys-1", wrong: "conflates_zero_velocity_with_zero_acceleration", conf: 0.9 },
      { qid: "phys-2", wrong: "conflates_zero_velocity_with_zero_acceleration", conf: 0.95 },
      { qid: "phys-5", conf: 0.7 }, { qid: "phys-6", conf: 0.6 },
    ] },
  { name: "physics: motion needs a force", subject: "physics", accept: ["phys.force.newton1", "phys.force.concept", "phys.kin.speed_velocity"],
    picks: [
      { qid: "phys-4", wrong: "thinks_motion_requires_a_net_force", conf: 0.9 },
      { qid: "phys-3", conf: 0.7 }, { qid: "phys-1", conf: 0.6 },
    ] },
  { name: "chemistry: mass number vs atomic number", subject: "chemistry", accept: ["chem.atom.atomic_mass_number", "chem.atom.structure"],
    picks: [
      { qid: "chem-1", wrong: "confuses_mass_number_with_atomic_number", conf: 0.9 },
      { qid: "chem-4", wrong: "confuses_molar_mass_with_particle_count", conf: 0.8 },
      { qid: "chem-3", wrong: "ignores_subscripts_when_computing_molar_mass", conf: 0.8 },
      { qid: "chem-5", conf: 0.6 },
    ] },
  { name: "chemistry: ignores coefficients", subject: "chemistry", accept: ["chem.reaction.balancing", "chem.formula.compounds"],
    picks: [
      { qid: "chem-5", wrong: "ignores_coefficients_and_mole_ratios", conf: 0.9 },
      { qid: "chem-6", wrong: "ignores_coefficients_and_mole_ratios", conf: 0.9 },
      { qid: "chem-1", conf: 0.7 },
    ] },
];

async function main() {
  const rows: { name: string; top: string; verdict: string }[] = [];
  let fails = 0;
  for (const p of personas) {
    let verdict = "FAIL", top = "";
    try {
      const graded = p.picks.map(build);
      const res = await fetch(`${BASE_URL}/api/diagnose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: p.subject, graded }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { root_gaps: { concept_id: string }[]; fallback?: boolean };
      const got = body.root_gaps.slice(0, 3).map((g) => g.concept_id);
      top = got.join(", ") + (body.fallback ? " (fallback)" : "");
      if (got.some((id) => p.accept.includes(id))) verdict = "PASS";
    } catch (e) { top = String(e); }
    if (verdict === "FAIL") fails++;
    rows.push({ name: p.name, top, verdict });
  }
  const w = Math.max(...rows.map((r) => r.name.length));
  for (const r of rows) console.log(`${r.verdict}  ${r.name.padEnd(w)}  -> ${r.top}`);
  console.log(`\n${rows.length - fails}/${rows.length} passed`);
  process.exit(fails ? 1 : 0);
}
main();
