/**
 *     cd ~/Downloads/wirewalk-shots
 *     node ~/Downloads/wirewalkai/tools/check-portal-gate.mjs <portal-token>
 *
 * Renders /portal/ under the failure conditions a real client can hit and
 * reports what a human would actually see. The point is not that Turnstile
 * fails -- it will, under automation -- but that the page says something
 * actionable when it does, within a bounded time.
 */
/* Resolved from the working directory: this repo has no node_modules, and the
   script is run from one that has playwright. */
import { createRequire } from "node:module";
const { chromium } = createRequire(process.cwd() + "/")("playwright");

const URL_BASE = "https://ai.wirewalk.com/portal/";
const TOKEN = process.argv[2] || "";

async function run(name, { url, block = [], waitMs }) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const t0 = Date.now();
  for (const pat of block) await page.route(pat, r => r.abort("failed"));
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Wait until the gate stops saying "checking", or give up well past the
  // page's own longest deadline (8s script + 18s challenge).
  let settled = null;
  try {
    await page.waitForFunction(
      () => !/We are\s+checking your link/.test(document.querySelector("#gate-h")
              ? document.body.innerText : ""),
      null, { timeout: waitMs });
    settled = Date.now() - t0;
  } catch { settled = null; }

  const out = await page.evaluate(() => ({
    h: (document.querySelector("#gate-h") || {}).textContent || "",
    p: (document.querySelector("#gate-p") || {}).innerText || "",
    body: (document.querySelector("#gate-body") || {}).innerText || "",
    acts: [...document.querySelectorAll("#gate-acts button, #gate-acts a")]
            .map(e => e.textContent.trim()),
    appVisible: !(document.querySelector("#app") || { className: "hide" })
                  .className.includes("hide"),
    spinning: !!document.querySelector("#gate-p .spin"),
  }));

  console.log("\n" + "=".repeat(72));
  console.log(name);
  console.log("=".repeat(72));
  console.log(settled === null
    ? "  SETTLED    NO — still showing the checking state (this is the bug)"
    : `  SETTLED    yes, after ${(settled / 1000).toFixed(1)}s`);
  console.log(`  SPINNER    ${out.spinning ? "still spinning" : "gone"}`);
  console.log(`  HEADING    ${out.h}`);
  console.log(`  MESSAGE    ${out.p.replace(/\s+/g, " ").trim()}`);
  if (out.body) console.log("  BODY       " +
    out.body.replace(/\n+/g, "\n             ").trim());
  console.log(`  ACTIONS    ${out.acts.length ? out.acts.join("  |  ") : "(none)"}`);
  console.log(`  PORTAL     ${out.appVisible ? "opened" : "not opened"}`);
  await browser.close();
  return settled;
}

const scenarios = [
  ["1. Turnstile blocked outright (content blocker / corporate filter)",
   { url: URL_BASE + "#t=" + TOKEN,
     block: ["**challenges.cloudflare.com/**"], waitMs: 40000 }],
  ["2. Turnstile loads but never completes (real automation, the coordinator's case)",
   { url: URL_BASE + "#t=" + TOKEN, waitMs: 40000 }],
  ["3. The Worker is unreachable (Turnstile fine, our API not)",
   { url: URL_BASE + "#t=" + TOKEN,
     block: ["**wirewalk-upload.workers.dev/**"], waitMs: 60000 }],
  ["4. No token at all (a stranger reaches /portal/)",
   { url: URL_BASE, waitMs: 15000 }],
  ["5. A wrong token (well-formed, not ours)",
   { url: URL_BASE + "#t=" + "A".repeat(43), waitMs: 60000 }],
];

let hung = 0;
for (const [name, opts] of scenarios) if ((await run(name, opts)) === null) hung++;
console.log("\n" + "=".repeat(72));
console.log(hung === 0
  ? "ALL SCENARIOS RENDERED AN ACTIONABLE STATE. None hung."
  : `${hung} SCENARIO(S) STILL HANG.`);
process.exit(hung === 0 ? 0 : 1);
