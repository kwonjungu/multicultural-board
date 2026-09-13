import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase = process.argv[2] || "before";
const output = path.resolve(root, "..", "multicultural-design-review", phase);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 800 }]) {
    for (const view of ["setup", "home", "board", "post"]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      // An independent network guard prevents fixture traffic leaving the machine.
      await context.route(/(?:firebaseio\.com|firebasedatabase\.app|googleapis\.com\/identitytoolkit|127\.0\.0\.1:9)/, route => route.abort());
      await context.routeWebSocket(/(?:firebaseio\.com|firebasedatabase\.app|127\.0\.0\.1:9)/, ws => ws.close());
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:3100/design-preview?view=${view}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.getByText("로컬 미리보기 준비 중", { exact: true }).waitFor({ state: "hidden", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(output, `${view}-${viewport.width}.png`), fullPage: true, animations: "disabled" });
      const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll("button")].filter(b => b.getBoundingClientRect().width > 0).map(b => ({ text: b.innerText.slice(0, 50), width: Math.round(b.getBoundingClientRect().width), height: Math.round(b.getBoundingClientRect().height) })) }));
      results.push({ view, viewport, errors, metrics });
      console.log(`${phase}: ${view} ${viewport.width}, errors=${errors.length}, width=${metrics.scrollWidth}`);
      await context.close();
    }
  }
} finally {
  await fs.writeFile(path.join(output, "checks.json"), JSON.stringify(results, null, 2));
  await browser.close();
}
