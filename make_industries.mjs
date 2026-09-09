/**
 * Generates /industries/ and the twenty /industries/<slug>/ pages.
 *
 *   node make_industries.mjs
 *
 * Written as a generator rather than twenty hand-maintained files because
 * twenty pages of near-identical prose is exactly the failure mode this
 * section exists to avoid. Everything that differs between pages comes from
 * industries.js and intake-template.js; everything that would be the same
 * sentence on every page lives here, once.
 *
 * The source of truth is the portal worker's data files, so an industry page
 * cannot claim the review would ask for something the intake does not
 * actually ask for.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INDUSTRIES } from "../wirewalk-portal-worker/src/industries.js";
import { SECTOR_MODULES } from "../wirewalk-portal-worker/src/intake-template.js";
import { DEPTH } from "../wirewalk-portal-worker/src/industry-depth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "industries");
mkdirSync(OUT, { recursive: true });

const esc = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
/* The data uses real typography -- em dashes and curly quotes. Keep them. */
const yaml = s => JSON.stringify(String(s).replace(/\s+/g, " ").trim());
/* Search engines truncate anyway; truncating mid-word is just untidy. */
const clip = (s, n) => {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, t.lastIndexOf(" ", n - 1)).replace(/[,;:—-]$/, "") + "…";
};

const BY_SLUG = Object.fromEntries(INDUSTRIES.map(i => [i.slug, i]));

/* Grouped so somebody finds themselves in about two seconds. Twenty identical
   cards in one grid is a directory, not a route in. */
const GROUPS = [
  { id: "advisory", title: "Professional and advisory firms",
    blurb: "Where the product is time, and three different numbers describe the same hour.",
    slugs: ["law-firms", "accountancy", "professional-services", "agencies", "staffing"] },
  { id: "financial", title: "Financial services and insurance",
    blurb: "Where regulated cost is an operating line, and the operations underneath it are rarely priced.",
    slugs: ["financial-services", "insurance", "real-estate-finance"] },
  { id: "industrial", title: "Making, moving and building",
    blurb: "Where margin is calculated from standards, and the standards drift.",
    slugs: ["manufacturing", "aerospace-defence", "warehousing-logistics",
             "transport-fleet", "construction"] },
  { id: "asset", title: "Property, energy and infrastructure",
    blurb: "Where the asset is the business, and what is contracted is not what is collected.",
    slugs: ["real-estate", "energy-utilities"] },
  { id: "commerce", title: "Selling and serving",
    blurb: "Where volume hides the unit, and the unit is where the loss is.",
    slugs: ["retail-ecommerce", "hospitality", "technology-saas"] },
  { id: "funded", title: "Public, funded and regulated",
    blurb: "Where the funder, the regulator or the statute sets the operating model, and the cost of complying with it is nobody's line item.",
    slugs: ["healthcare", "government-contracting", "public-sector",
            "education-research", "nonprofit"] },
];

/* Adjacency the group alone would not produce. A managing partner reading the
   law-firm page has more in common with an agency principal than the grouping
   suggests, and a plant manager with a fleet director. */
const ALSO = {
  "law-firms": ["professional-services", "agencies", "insurance"],
  "professional-services": ["law-firms", "agencies", "staffing"],
  "agencies": ["professional-services", "law-firms", "staffing"],
  "staffing": ["professional-services", "agencies", "healthcare"],
  "manufacturing": ["warehousing-logistics", "transport-fleet", "construction"],
  "warehousing-logistics": ["manufacturing", "transport-fleet", "retail-ecommerce"],
  "transport-fleet": ["warehousing-logistics", "manufacturing", "energy-utilities"],
  "construction": ["manufacturing", "real-estate", "government-contracting"],
  "real-estate": ["construction", "energy-utilities", "hospitality"],
  "energy-utilities": ["transport-fleet", "public-sector", "real-estate"],
  "retail-ecommerce": ["warehousing-logistics", "hospitality", "technology-saas"],
  "hospitality": ["retail-ecommerce", "real-estate", "staffing"],
  "technology-saas": ["professional-services", "retail-ecommerce", "agencies"],
  "healthcare": ["insurance", "staffing", "education-research"],
  "government-contracting": ["public-sector", "construction", "professional-services"],
  "public-sector": ["government-contracting", "education-research", "energy-utilities"],
  "education-research": ["nonprofit", "public-sector", "healthcare"],
  "nonprofit": ["education-research", "public-sector", "healthcare"],
  "financial-services": ["insurance", "professional-services", "technology-saas"],
  "insurance": ["financial-services", "healthcare", "law-firms"],
  "accountancy": ["law-firms", "professional-services", "financial-services"],
  "aerospace-defence": ["manufacturing", "government-contracting", "technology-saas"],
  "real-estate-finance": ["real-estate", "financial-services", "construction"],
};

/* How each name reads inside a sentence. Most are fine lowercased; these are
   the ones where that produces "recur in public sector" or "technology and
   saas". Grammar only -- no content lives here. */
const PHRASE = {
  "public-sector": "the public sector",
  "nonprofit": "nonprofit and grant-funded organisations",
  "technology-saas": "technology and SaaS",
  "financial-services": "financial services",
  "government-contracting": "government contracting",
};
Object.assign(PHRASE, {
  "accountancy": "an accountancy firm",
  "aerospace-defence": "an aerospace and defence manufacturer",
  "real-estate-finance": "a real estate sponsor",
});
const phraseOf = i => PHRASE[i.slug] || i.name.toLowerCase();

/* ------------------------------------------------------------------ *
 * Shared chrome. Said once, here, rather than twenty times in prose.
 * ------------------------------------------------------------------ */

const CSS = `
:root{
  --bg:#FAF9F5; --alt:#F4F2EC; --alt2:#EFEDE5; --ln:#E4E0D5; --ln2:#D5D0C0;
  --tx:#1F1E1D; --tx2:#5C5A54; --tx3:#8A8781;
  --ac:#D97757; --ac2:#C2603F; --acs:#FBEEE8;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,'Helvetica Neue',Arial,sans-serif;
  --mono:ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font-family:var(--sans);
     font-size:17px;line-height:1.62;-webkit-font-smoothing:antialiased}
.wrap{max-width:900px;margin:0 auto;padding:0 clamp(20px,5vw,32px)}
header.top{border-bottom:1px solid var(--ln);padding:22px 0;margin-bottom:44px}
.brand{display:inline-flex;align-items:center;gap:11px;text-decoration:none;color:var(--tx);
       font-weight:600}
.mark{width:21px;height:21px;flex:0 0 21px;display:grid;
      grid-template:repeat(2,1fr)/repeat(2,1fr);gap:2.5px}
.mark i{background:var(--ac);border-radius:1.5px;transform:scale(.84)}
.mark i:nth-child(4){background:transparent;box-shadow:inset 0 0 0 1.8px var(--ac)}
.brand s{text-decoration:none;color:var(--tx3);font-weight:500;margin-left:6px}
.back{float:right;font-size:14px;color:var(--tx2);text-decoration:none}
.back:hover{color:var(--ac)}
.crumb{font-size:13.5px;color:var(--tx3);margin:0 0 14px}
.crumb a{color:var(--tx2);text-decoration:none}
.crumb a:hover{color:var(--ac2)}
.eyebrow{display:block;font-size:12px;letter-spacing:.13em;text-transform:uppercase;
         color:var(--ac2);font-weight:600;margin-bottom:10px}
h1{font-size:clamp(30px,5.4vw,42px);line-height:1.13;letter-spacing:-.024em;margin:0 0 16px;
   text-wrap:balance}
h2{font-size:clamp(21px,2.9vw,26px);letter-spacing:-.016em;margin:56px 0 8px;text-wrap:balance}
h3{font-size:17.5px;margin:0 0 5px}
p{max-width:70ch}
.lede{color:var(--tx2);font-size:19px;margin:0 0 12px}
.sub{color:var(--tx3);font-size:15px;margin:0 0 22px}
a{color:var(--ac2);text-underline-offset:2px}
.btn{display:inline-flex;align-items:center;gap:8px;font:inherit;font-size:15.5px;
     font-weight:600;padding:12px 22px;border-radius:9px;border:1px solid var(--ac);
     background:var(--ac);color:#fff;cursor:pointer;text-decoration:none}
.btn:hover{background:var(--ac2);border-color:var(--ac2)}
.btn.g{background:#fff;color:var(--tx);border-color:var(--ln2)}
.btn.g:hover{background:var(--alt)}
.acts{display:flex;flex-wrap:wrap;gap:11px;margin:22px 0 0}

/* depth blocks -- systems, sub-verticals, filings, triggers */
.depth{margin:26px 0 0}
.depth h3{font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:var(--tx2);
  margin:0 0 10px;font-weight:650}
.sysl{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.sysl li{padding:11px 13px;background:var(--bg2);border-radius:7px;font-size:14.5px;
  line-height:1.5;border-left:2px solid var(--ac)}
.subv{list-style:none;padding:0;margin:0;display:grid;gap:11px}
.subv li{padding:12px 14px;border:1px solid var(--ln);border-radius:8px}
.subv b{display:block;font-size:14.5px;margin-bottom:4px}
.subv span{font-size:14px;line-height:1.55;color:var(--tx2)}
.fil,.trg{margin:0;padding-left:20px;display:grid;gap:7px}
.fil li,.trg li{font-size:14.5px;line-height:1.55}
.mets{list-style:none;display:flex;flex-wrap:wrap;gap:6px;padding:0;margin:0}
.mets li{font:600 12px/1 var(--mono);letter-spacing:.02em;padding:6px 9px;
  background:var(--bg2);border-radius:5px;color:var(--tx2)}
.roles{display:grid;gap:9px;margin:0;padding:0;list-style:none}
.roles li{font-size:14.5px;line-height:1.5}
.roles b{color:var(--tx2);font-weight:650}
@media(max-width:640px){.subv li{padding:11px 12px}}

/* vocabulary strip */
.vocab{display:flex;flex-wrap:wrap;gap:7px;margin:22px 0 0;padding:0;list-style:none}
.vocab li{font:12.5px/1 var(--mono);color:var(--tx2);background:var(--alt);
          border:1px solid var(--ln);border-radius:20px;padding:6px 12px}
.vocab-note{color:var(--tx3);font-size:13.5px;margin:10px 0 0}

/* the patterns -- the substance of the page, so give them room */
.pat{list-style:none;margin:22px 0 0;padding:0;counter-reset:p}
.pat li{counter-increment:p;position:relative;border-top:1px solid var(--ln);
        padding:20px 0 20px 58px;font-size:17px;color:var(--tx);max-width:74ch}
.pat li:last-child{border-bottom:1px solid var(--ln)}
.pat li:before{content:counter(p,decimal-leading-zero);position:absolute;left:0;top:20px;
               font:700 13px/1.5 var(--mono);color:var(--ac2);letter-spacing:.04em}

/* what the intake would ask for */
.ask{border:1px solid var(--ln);border-radius:12px;background:#fff;margin:22px 0 0;
     overflow:hidden}
.ask .hd{background:var(--alt);border-bottom:1px solid var(--ln);padding:15px 20px;
         font-size:14.5px;color:var(--tx2)}
.ask .hd b{color:var(--tx)}
.ask ul{list-style:none;margin:0;padding:4px 20px 8px}
.ask li{border-top:1px solid var(--ln);padding:14px 0}
.ask li:first-child{border-top:0}
.ask b{display:block;font-size:16px;color:var(--tx)}
.ask b .core{font:700 10.5px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
             color:#fff;background:var(--ac2);border-radius:20px;padding:4px 9px;
             margin-left:9px;vertical-align:2px}
.ask span{display:block;color:var(--tx2);font-size:14.5px;max-width:70ch}

.who{border-left:2px solid var(--ac);padding-left:18px;margin:22px 0 0;color:var(--tx2);
     font-size:16px}
.who b{color:var(--tx)}

/* the index */
.grp{margin:46px 0 0}
.grp h2{margin:0 0 4px}
.grp>p{color:var(--tx2);font-size:15.5px;margin:0 0 16px}
.cards{display:grid;gap:1px;background:var(--ln);border:1px solid var(--ln);border-radius:12px;
       overflow:hidden;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.cards a{display:block;background:#fff;padding:18px 20px;text-decoration:none;color:var(--tx)}
.cards a:hover{background:var(--acs)}
.cards b{display:block;font-size:16.5px;margin-bottom:4px}
.cards span{display:block;color:var(--tx2);font-size:14.5px}
.cards em{display:block;font:12px/1.5 var(--mono);font-style:normal;color:var(--tx3);
          margin-top:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.also{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0 0;padding:0;list-style:none}
.also a{display:inline-block;font-size:14.5px;text-decoration:none;color:var(--tx);
        border:1px solid var(--ln2);border-radius:20px;padding:7px 15px;background:#fff}
.also a:hover{border-color:var(--ac);background:var(--acs);color:var(--ac2)}

.note{border:1px solid var(--ac);background:var(--acs);border-radius:12px;padding:20px 22px;
      margin:30px 0 0}
.note b{display:block;font-size:17px;color:var(--tx);margin-bottom:6px}
.note p{margin:0;color:var(--tx2);font-size:15.5px;max-width:none}
.note p+p{margin-top:9px}

footer.end{margin:60px 0 46px;padding-top:24px;border-top:1px solid var(--ln);
           color:var(--tx3);font-size:14px}
footer.end a{color:var(--ac2)}
footer.end .fl{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 12px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`.trim();

const head = (title, desc, canonical) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/favicon-180.png">
<style>
${CSS}
</style>
</head>
<body>

<header class="top"><div class="wrap">
  <a href="/" class="brand"><span class="mark"><i></i><i></i><i></i><i></i></span>
    <span>Wirewalk<s>AI</s></span></a>
  <a class="back" href="/order/">Commission an engagement</a>
</div></header>
`;

/* One footer, one set of links, said once. */
const foot = `
  <footer class="end">
    <div class="fl">
      <a href="/">The Operating Review</a>
      <a href="/industries/">All industries</a>
      <a href="/order/">What it costs</a>
      <a href="/terms/">Ordering terms</a>
      <a href="/writing/">Notes</a>
      <a href="/portal/">Client portal</a>
      <a href="https://www.wirewalk.com/">Wirewalk</a>
    </div>
    <p>Wirewalk AI · <a href="mailto:sales@wirewalk.com">sales@wirewalk.com</a> ·
    <a href="tel:+15162691517">516-269-1517</a></p>
    <p style="margin-top:9px">The patterns on these pages are what recurs in each
    sector and what a review therefore goes looking for. They are not claims about
    any particular organisation, and nothing here reports a client, an engagement
    or a measured result.</p>
  </footer>
</div>
</body></html>
`;

/* ------------------------------------------------------------------ *
 * Index
 * ------------------------------------------------------------------ */

const listed = new Set(GROUPS.flatMap(g => g.slugs));
for (const i of INDUSTRIES)
  if (!listed.has(i.slug)) throw new Error(`industry not in any group: ${i.slug}`);
for (const g of GROUPS)
  for (const s of g.slugs)
    if (!BY_SLUG[s]) throw new Error(`group ${g.id} names an unknown industry: ${s}`);

function indexPage() {
  const groups = GROUPS.map(g => `
  <div class="grp" id="${g.id}">
    <h2>${esc(g.title)}</h2>
    <p>${esc(g.blurb)}</p>
    <div class="cards">
${g.slugs.map(s => {
  const i = BY_SLUG[s];
  return `      <a href="/industries/${i.slug}/">
        <b>${esc(i.name)}</b>
        <span>${esc(i.headline)}</span>
        <em>${esc(i.vocabulary.slice(0, 4).join(" · "))}</em>
      </a>`;
}).join("\n")}
    </div>
  </div>`).join("\n");

  return `---
permalink: /industries/
title: Industries
description: >-
  ${INDUSTRIES.length} industries, each read in its own vocabulary — where operating
  loss concentrates in that sector, what a review would ask for, and who commissions it.
---
${head(`Industries — Wirewalk AI`,
  `${INDUSTRIES.length} industries, each read in its own vocabulary: where operating loss concentrates in that sector, what a review would ask for, and who commissions it.`,
  "https://ai.wirewalk.com/industries/")}
<div class="wrap">
  <p class="crumb"><a href="/">The Operating Review</a> &rsaquo; Industries</p>
  <span class="eyebrow">Industries</span>
  <h1>Your operation, in your own vocabulary.</h1>
  <p class="lede">The argument is the same everywhere: loss concentrates rather than
  distributes, so a sample of thirty transactions and eight interviews is the wrong
  instrument for finding it. What differs by sector is where it concentrates, and what
  it is called.</p>
  <p>Below, ${INDUSTRIES.length} industries. Each page names five concentrated losses
  that recur in that sector &mdash; not abstractions, and not case studies &mdash; and
  shows what the intake would actually ask for. Find yours, or read the
  <a href="/">method</a> first if you would rather start there.</p>

${groups}

  <div class="note">
    <b>Not on the list?</b>
    <p>The general review does not depend on the sector module. Every engagement runs the
    same 107 document requests across finance, revenue, receivables, payables, contracts,
    people, IT, operations, risk, commercial and governance; the sector module is
    additional, and exists so that a manufacturer is never asked about payer contracts and
    a health system never has to translate its own vocabulary into someone else's. If your
    sector is not here, the review still runs. Tell us what you do and we will say what we
    would add.</p>
  </div>

  <div class="acts">
    <a class="btn" href="/order/#catalog">See what it costs</a>
    <a class="btn g" href="/#contact">Talk it through first</a>
  </div>
${foot}`;
}

/* ------------------------------------------------------------------ *
 * One industry
 * ------------------------------------------------------------------ */

function industryPage(ind) {
  const mod = SECTOR_MODULES[ind.sector];
  if (!mod) throw new Error(`${ind.slug} maps to unknown sector module ${ind.sector}`);
  const also = (ALSO[ind.slug] || []).filter(s => BY_SLUG[s] && s !== ind.slug);
  const group = GROUPS.find(g => g.slugs.includes(ind.slug));

  const asks = mod.items.map(it => `      <li>
        <b>${esc(it.label)}${it.importance === "core" ? ' <span class="core">Core</span>' : ""}</b>
        ${it.detail ? `<span>${esc(it.detail)}</span>` : ""}
      </li>`).join("\n");

  const pats = ind.patterns.map(p => `    <li>${esc(p)}</li>`).join("\n");
  const vocab = ind.vocabulary.map(v => `    <li>${esc(v)}</li>`).join("\n");
  const alsoLinks = also.map(s =>
    `    <li><a href="/industries/${s}/">${esc(BY_SLUG[s].name)}</a></li>`).join("\n");

  const coreCount = mod.items.filter(i => i.importance === "core").length;
  const phrase = phraseOf(ind);

  /* Depth is OPTIONAL and PARTIAL. An industry without an entry renders exactly
     as it did before; one with an entry renders more. That is what lets depth
     be written in the order the pipeline demands rather than all at once. */
  const d = DEPTH[ind.slug] || {};
  const block = (cls, title, inner) => inner
    ? `\n  <div class="depth">\n    <h3>${title}</h3>\n${inner}\n  </div>` : "";

  const systemsHtml = block("sys",
    "Where this data actually lives",
    d.systems ? `    <ul class="sysl">\n` +
      d.systems.map(x => `      <li>${esc(x)}</li>`).join("\n") +
      `\n    </ul>\n    <p class="sub" style="margin-top:11px">Named because it changes ` +
      `what the intake asks for. An extract from one of these has known gaps, and the ` +
      `review is built around them rather than surprised by them.</p>` : "");

  const subHtml = block("sub",
    `Not every ${esc(phrase.replace(/^an? /, ""))} is the same business`,
    d.subsectors ? `    <ul class="subv">\n` +
      d.subsectors.map(x =>
        `      <li><b>${esc(x.name)}</b><span>${esc(x.note)}</span></li>`).join("\n") +
      `\n    </ul>` : "");

  const filHtml = block("fil",
    "The obligations that set the deadlines",
    d.filings ? `    <ul class="fil">\n` +
      d.filings.map(x => `      <li>${esc(x)}</li>`).join("\n") +
      `\n    </ul>` : "");

  const trgHtml = block("trg",
    "When this stops being interesting and becomes urgent",
    d.triggers ? `    <ul class="trg">\n` +
      d.triggers.map(x => `      <li>${esc(x)}</li>`).join("\n") +
      `\n    </ul>` : "");

  const metHtml = block("met",
    "Reported in your numbers, not ours",
    d.metrics ? `    <ul class="mets">\n` +
      d.metrics.map(x => `      <li>${esc(x)}</li>`).join("\n") +
      `\n    </ul>` : "");

  const roleHtml = d.roles ? `\n  <div class="depth">
    <h3>Who this involves</h3>
    <ul class="roles">
      <li><b>Signs it:</b> ${esc(d.roles.signs)}</li>
      <li><b>Resists it:</b> ${esc(d.roles.blocks)}</li>
      <li><b>Has been asking for it:</b> ${esc(d.roles.benefits)}</li>
    </ul>
  </div>` : "";

  return `---
permalink: /industries/${ind.slug}/
title: ${yaml(ind.name + " — the Operating Review")}
description: ${yaml(ind.headline + " " + ind.lede)}
---
${head(`${ind.name} — the Operating Review — Wirewalk AI`,
       clip(`${ind.headline} ${ind.lede}`, 290),
       `https://ai.wirewalk.com/industries/${ind.slug}/`)}
<div class="wrap">
  <p class="crumb"><a href="/">The Operating Review</a> &rsaquo;
    <a href="/industries/">Industries</a> &rsaquo; ${esc(ind.name)}</p>
  <span class="eyebrow">${esc(ind.name)}</span>
  <h1>${esc(ind.headline)}</h1>
  <p class="lede">${esc(ind.lede)}</p>

  <ul class="vocab">
${vocab}
  </ul>
  <p class="vocab-note">The terms above are the ones the review uses with you, because they
  are the ones you already use. Nothing is translated into a consultant's vocabulary and
  then translated back.</p>

  <h2>Where it concentrates here</h2>
  <p>${ind.patterns.length === 5 ? "Five" : ind.patterns.length} losses that recur in
  ${esc(phrase)} and are worth going looking for. Each is concentrated &mdash; a single
  agreement, a single queue, a single account nobody reviews &mdash; which is precisely why
  a sample of the operation tends to miss them and a full pass tends to find them. They are
  not findings from a named engagement; they are what a review of
  ${esc(phrase)} is built to look for.</p>
  <ol class="pat">
${pats}
  </ol>

${subHtml}
${systemsHtml}
${metHtml}
${filHtml}

  <h2>What the review would ask you for</h2>
  <div class="ask">
    <div class="hd"><b>${mod.items.length} further requests, specific to
      ${esc(phrase)}</b> &mdash; ${coreCount} of them core &mdash; on top of the 107 the
      intake asks of every organisation, across finance, revenue, receivables, payables,
      contracts, people, IT, operations, risk, commercial and governance.</div>
    <ul>
${asks}
    </ul>
  </div>
  <p class="sub" style="margin-top:16px">Anything you do not have can be skipped in one
  click, with a reason. The intake is completed in the
  <a href="/portal/">client portal</a>, which saves each answer as it is given and can be
  returned to as often as you like.</p>

${trgHtml}
${roleHtml}

  <h2>Who commissions it</h2>
  <p class="who"><b>${esc(ind.buyer)}.</b> Phase one is priced before phase two is
  discussed, the report is yours either way, and we take no vendor commissions or referral
  fees on anything we recommend.</p>

  <div class="acts">
    <a class="btn" href="/order/#catalog">Commission the review</a>
    <a class="btn g" href="/#contact">Talk it through first</a>
  </div>

  <h2>Closest to this</h2>
  <p class="sub">Operations that share more with ${esc(phrase)} than the sector label
  suggests.</p>
  <ul class="also">
${alsoLinks}
    <li><a href="/industries/#${group.id}">All of ${esc(group.title.toLowerCase())}</a></li>
  </ul>
${foot}`;
}

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

writeFileSync(join(OUT, "index.html"), indexPage());
let n = 1;
for (const ind of INDUSTRIES) {
  writeFileSync(join(OUT, `${ind.slug}.html`), industryPage(ind));
  n++;
}
console.log(`wrote ${n} files into ${OUT}`);
