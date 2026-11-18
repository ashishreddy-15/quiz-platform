// Usage: node scripts/shot.mjs <url> <out.png> [width=1280] [height=860] [waitMs=1500]
// Full-page screenshot with headless Chromium (Playwright). Read the PNG to inspect the UI.
import { chromium } from "playwright";
const [url, out, w = "1280", h = "860", wait = "1500"] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: "dark" });
p.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
p.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(+wait);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log("saved", out);
