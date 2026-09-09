/**
 * Layout checker for ai.wirewalk.com.
 *
 * Run from a directory that has playwright installed, because this repo has no
 * node_modules of its own:
 *
 *     cd ~/Downloads/wirewalk-shots
 *     node ~/Downloads/wirewalkai/tools/check-layout.mjs [url]
 *
 * Exists because of a bug that shipped and that neither the site checker nor a
 * careful read of the CSS could have caught: the desktop navigation overlapped
 * itself at every width from 1080 to 1600, rendering as "WirewalkThAe lenses",
 * while horizontal overflow stayed at exactly 0px the whole time.
 *
 * That is the lesson worth encoding. `scrollWidth - clientWidth` cannot see
 * elements sitting on top of each other -- an absolutely positioned or
 * z-indexed element overlaps its neighbour without the document ever growing.
 * Overflow and collision are two different faults and need two different
 * measurements, so this checks both:
 *
 *   1. Horizontal overflow, naming the widest offending element rather than
 *      just reporting a number nobody can act on.
 *   2. Pairwise bounding-box collision between visible text-bearing elements
 *      in the header. Text on text is the failure a visitor actually sees.
 */

/* Resolved from the working directory, not from this file: the script lives in
   a repo with no node_modules and is run from one that has playwright. A plain
   `import "playwright"` resolves relative to the FILE and fails here. */
import { createRequire } from "node:module";
const { chromium } = createRequire(process.cwd() + "/")("playwright");

const URL = process.argv[2] || "https://ai.wirewalk.com/";
const WIDTHS = [1600, 1440, 1366, 1280, 1180, 1120, 1080, 1024, 960, 820, 768, 640, 480, 390, 360];

/* Runs in the page. Kept in one function so it can be passed to evaluate(). */
function measure() {
  const vw = document.documentElement.clientWidth;

  const visible = el => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /* Only leaves that actually paint text. A container overlapping its own
     child is not a bug, and comparing containers produces nothing but noise. */
  const textLeaves = root => [...root.querySelectorAll("*")].filter(el => {
    if (!visible(el)) return false;
    const ownText = [...el.childNodes]
      .filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
    return ownText.length > 0;
  });

  const box = el => {
    const r = el.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom };
  };
  const label = el => {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}` +
           `${el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}` +
           (t ? ` "${t}"` : "");
  };

  // --- 1. horizontal overflow -----------------------------------------
  const de = document.documentElement;
  const overflow = Math.max(0, Math.round(de.scrollWidth - de.clientWidth));
  const offenders = [];
  if (overflow > 0) {
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        // Report the outermost offender, not every descendant it drags along.
        if (!offenders.some(o => o.el.contains(el)))
          offenders.push({ el, over: Math.round(Math.max(r.right - vw, -r.left)) });
      }
    }
  }

  // --- 2. pairwise collisions in the header ---------------------------
  const header = document.querySelector("header");
  const collisions = [];
  if (header) {
    const els = textLeaves(header);
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        const A = box(a), B = box(b);
        const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l);
        const oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
        // A pixel of touching is kerning; two is a collision.
        if (ox > 2 && oy > 2)
          collisions.push({ a: label(a), b: label(b), ox: Math.round(ox) });
      }
    }
  }

  return {
    overflow,
    offenders: offenders.slice(0, 4).map(o => `${label(o.el)}  (+${o.over}px)`),
    collisions: collisions.slice(0, 6),
    collisionCount: collisions.length,
    burger: (() => {
      const b = document.querySelector(".burger");
      return b && getComputedStyle(b).display !== "none" ? "compact" : "full";
    })(),
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
let bad = 0;

console.log(`\n  ${URL}\n`);
console.log("  width   nav       overflow   header collisions");
console.log("  " + "-".repeat(66));

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle" });
  // Let the sliding pill and any entrance transitions land before measuring.
  await page.waitForTimeout(600);
  const m = await page.evaluate(measure);

  const fail = m.overflow > 0 || m.collisionCount > 0;
  if (fail) bad++;
  console.log(
    `  ${String(width).padStart(5)}   ${m.burger.padEnd(9)} ${String(m.overflow + "px").padStart(8)}   ` +
    `${String(m.collisionCount).padStart(3)}   ${fail ? "FAIL" : "ok"}`);
  for (const o of m.offenders) console.log(`          overflowing: ${o}`);
  for (const c of m.collisions) console.log(`          ${c.a}  ><  ${c.b}   (${c.ox}px)`);
}

console.log("  " + "-".repeat(66));
console.log(bad === 0
  ? "  PASS — no overflow and no header collisions at any tested width\n"
  : `  FAIL — ${bad} width(s) with overflow or collisions\n`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
