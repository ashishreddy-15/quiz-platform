// Usage: BASE_URL=http://localhost:3102 node scripts/ui-walkthrough.mjs [topic]
// Drives the whole GapFinder flow with Playwright and saves screenshots to screenshots/<nn>-<name>.png.
// Desktop 1280x860, plus 390x844 mobile and light-theme variants of key screens.
// Designed for mock mode (NEXT_PUBLIC_MOCK=1) but works against the real backend too (answers are positional).
// Exits 1 on any page error / console error.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3102";
const TOPIC = process.argv[2] || "Photosynthesis";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const errors = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: "dark" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(`PAGE ERROR: ${e.message}`));
p.on("console", (m) => m.type() === "error" && errors.push(`CONSOLE: ${m.text()}`));

let n = 0;
const shot = async (name, { mobile = false, light = false } = {}) => {
  if (mobile) await p.setViewportSize({ width: 390, height: 844 });
  if (light) await p.emulateMedia({ colorScheme: "light" });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(250);
  const file = `${OUT}/${String(++n).padStart(2, "0")}-${name}${mobile ? "-mobile" : ""}${light ? "-light" : ""}.png`;
  await p.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
  if (mobile) await p.setViewportSize({ width: 1280, height: 860 });
  if (light) await p.emulateMedia({ colorScheme: "dark" });
};
const step = (s) => console.log(`- ${s}`);
const T = 60_000;

try {
  // 1. Start
  step("start");
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: "networkidle" });
  await p.getByRole("heading", { name: "What do you want to learn?" }).waitFor({ timeout: T });
  await shot("start");
  await shot("start", { light: true });
  await shot("start", { mobile: true });

  await p.locator("#topic").fill(TOPIC);
  await p.getByRole("radio", { name: "cooking" }).click();
  await p.locator("#topic").press("Enter");
  await p.getByText("Mapping prerequisite concepts").waitFor({ timeout: T });
  await p.waitForTimeout(900);
  await shot("generating");

  // 2. Quiz
  step("quiz");
  await p.getByText(/^Question/).first().waitFor({ timeout: T });
  const plan = [
    { key: "a", conf: "Certain" },
    { key: "a", conf: "Fairly sure" },
    { key: "b", conf: "Certain" },
    { key: "a", conf: "Fairly sure", why: "Light is what gives plants energy, so it should be enough on its own." },
    { key: "b", conf: "Unsure" },
  ];
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i];
    await p.getByText(`Question ${i + 1} of`, { exact: false }).waitFor({ timeout: T });
    await p.waitForTimeout(200);
    await p.keyboard.press(a.key);
    if (i === 0) await shot("quiz-answer-picked");
    await p.getByRole("radio", { name: a.conf, exact: true }).click();
    if (a.why) {
      await p.getByRole("button", { name: /Explain your thinking/ }).click();
      await p.locator("textarea").fill(a.why);
    }
    if (i === 1) { await shot("quiz"); await shot("quiz", { mobile: true }); }
    await p.getByRole("button", { name: i === plan.length - 1 ? /Finish quiz/ : /^Next/ }).click();
  }

  // 3. Diagnosing
  step("diagnosing");
  await p.getByText("Analyzing your answers").waitFor({ timeout: T });
  await p.waitForTimeout(600);
  await shot("diagnosing");

  // 4. Diagnosis
  step("diagnosis");
  const startBtn = p.getByRole("button", { name: /Start lesson|See my report/ });
  await startBtn.waitFor({ timeout: T });
  await p.waitForTimeout(400);
  await shot("diagnosis");
  await shot("diagnosis", { light: true });
  await shot("diagnosis", { mobile: true });
  const why = p.getByText("Why", { exact: true }).first();
  if (await why.count()) await why.click();
  const missRow = p.locator("li button[aria-expanded]").first();
  if (await missRow.count()) await missRow.click();
  await p.waitForTimeout(300);
  await shot("diagnosis-expanded");

  if (await p.getByRole("button", { name: /Start lesson/ }).count()) {
    // 5. Lesson
    step("lesson");
    await p.getByRole("button", { name: /Start lesson/ }).click();
    await p.getByText("Writing a lesson for you").waitFor({ timeout: T }).catch(() => {});
    await p.waitForTimeout(1500);
    await shot("lesson-streaming");
    const ready = p.getByRole("button", { name: /check my understanding/ });
    await p.waitForFunction(() => {
      const btn = [...document.querySelectorAll("button")].find((x) => /check my understanding/.test(x.textContent || ""));
      return btn && !btn.disabled;
    }, null, { timeout: 90_000 });
    const show = p.getByRole("button", { name: /Show answer/ });
    if (await show.count()) await show.first().click();
    await shot("lesson");
    await shot("lesson", { mobile: true });
    await p.getByRole("button", { name: /Your learning path/ }).click();
    await p.waitForTimeout(250);
    await shot("lesson-path-open");
    await ready.click();

    // 6. Mastery check (mock answers: a, c, b)
    step("mastery");
    for (const [i, key] of ["a", "c", "b"].entries()) {
      await p.getByText(`${i + 1} of 3`).waitFor({ timeout: T });
      await p.waitForTimeout(200);
      if (i === 0) await shot("check");
      await p.keyboard.press(key);
      if (i === 0) await shot("check-feedback");
      await p.getByRole("button", { name: i === 2 ? /See result/ : /^Next/ }).click();
    }
    await p.getByText(/of 3 correct/).waitFor({ timeout: T });
    await shot("check-result");

    // 7. Teach back
    const tb = p.getByRole("button", { name: /Explain it back/ });
    if (await tb.count()) {
      step("teachback");
      await tb.click();
      await p.locator("textarea").fill("Plants build themselves mostly out of carbon dioxide from the air plus water. Light only powers the reaction; it doesn't become part of the plant. Soil gives tiny amounts of minerals.");
      await shot("teachback");
      await p.getByRole("button", { name: /Check my explanation/ }).click();
      await p.getByText("Coaching tip").waitFor({ timeout: T });
      await shot("teachback-result");
      await p.getByRole("button", { name: /See my report|Continue/ }).click();
    } else {
      await p.getByRole("button", { name: /Flag for teacher|different explanation|Skip/ }).first().click();
    }
  } else {
    await startBtn.click();
  }

  // 8. Report
  step("report");
  await p.getByText("Before → after").or(p.getByText("Your learning path")).first().waitFor({ timeout: T });
  await p.waitForTimeout(300);
  await shot("report");
  await shot("report", { mobile: true });
} catch (e) {
  errors.push(`SCRIPT: ${e.message}`);
  await p.screenshot({ path: `${OUT}/99-failure.png`, fullPage: true }).catch(() => {});
}

// Horizontal-overflow check at phone width on the final screen.
await p.setViewportSize({ width: 390, height: 844 });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (overflow) errors.push("LAYOUT: horizontal scroll at 390px");

await b.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("walkthrough OK");
