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

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
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

/* proposal page */
.prop-hero{padding:26px 0 6px}
.phase{list-style:none;padding:0;margin:22px 0 0;display:grid;gap:0}
.phase li{display:grid;grid-template-columns:96px 1fr;gap:18px;padding:18px 0;
  border-top:1px solid var(--ln)}
.phase li:last-child{border-bottom:1px solid var(--ln)}
.phase .wk{font:650 12px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ac);padding-top:2px}
.phase b{display:block;font-size:15.5px;margin-bottom:5px}
.phase span{font-size:14.5px;line-height:1.6;color:var(--tx2)}
.deliv{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:9px}
.deliv li{padding-left:24px;position:relative;font-size:14.5px;line-height:1.55}
.deliv li:before{content:"";position:absolute;left:6px;top:8px;width:6px;height:6px;
  border-radius:50%;background:var(--ac)}
.quotebox{border:1px solid var(--ln);border-radius:11px;padding:22px;margin:26px 0 0;
  background:var(--bg2)}
.quotebox label{display:block;font-size:13px;color:var(--tx2);margin-bottom:7px}
.quotebox input,.quotebox select{width:100%;max-width:220px;padding:11px 12px;
  font:500 15px/1.2 var(--sans);border:1px solid var(--ln);border-radius:7px;
  background:var(--bg);color:var(--tx)}
.qrow{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end}
.qout{margin-top:20px;padding-top:18px;border-top:1px solid var(--ln)}
.qbig{font:700 34px/1.1 var(--sans);letter-spacing:-.02em}
.qsub{font-size:13.5px;color:var(--tx2);margin-top:5px}
.qlines{list-style:none;padding:0;margin:15px 0 0;display:grid;gap:6px}
.qlines li{display:flex;justify-content:space-between;gap:14px;font-size:13.5px;
  color:var(--tx2);font-variant-numeric:tabular-nums}
.qopts{display:grid;gap:9px;margin-top:16px}
.qopt{display:flex;justify-content:space-between;gap:14px;padding:11px 13px;
  border:1px solid var(--ln);border-radius:7px;font-size:14px;background:var(--bg)}
.qopt b{font-variant-numeric:tabular-nums}
.qerr{color:#b4232a;font-size:14px;margin-top:12px}
@media(max-width:640px){.phase li{grid-template-columns:1fr;gap:6px}}

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
.subv li.has{padding:0}
.subv li.has a{display:block;padding:12px 14px;text-decoration:none;color:inherit;
  border-radius:8px;transition:background .16s}
.subv li.has a:hover{background:var(--alt)}
.subv li.has em{display:block;margin-top:7px;font-style:normal;font-size:13px;
  font-weight:600;color:var(--ac2)}
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

  /* DO NOT COUNT THE INDUSTRIES HERE.
   *
   * This page used to open with "N industries, each read in its own
   * vocabulary". That number is the wrong boast. A managing partner looking for
   * someone who understands law firms reads a sector count as evidence of a
   * template with the nouns swapped -- breadth is exactly what a specialist
   * buyer discounts, and stating it first invites the discount before they have
   * read a word of their own page.
   *
   * The breadth still earns its keep: it is how someone arrives, and it is what
   * lets an owner of two unrelated businesses find both. But it should be
   * DISCOVERED by scrolling, not announced. So this page is a way in, and every
   * claim it makes is about the depth of one page rather than the number of
   * them. */
  return `---
permalink: /industries/
title: Industries
description: >-
  Where operating loss concentrates in your sector, what a review would ask you
  for, and who commissions it — written for one industry at a time.
---
${head(`Industries — Wirewalk AI`,
  `Where operating loss concentrates in your sector, what a review would ask you for, and who commissions it. Written for one industry at a time.`,
  "https://ai.wirewalk.com/industries/")}
<div class="wrap">
  <p class="crumb"><a href="/">The Operating Review</a> &rsaquo; Industries</p>
  <span class="eyebrow">Industries</span>
  <h1>Find yours.</h1>
  <p class="lede">The argument is the same everywhere: loss concentrates rather than
  distributes, so a sample of thirty transactions and eight interviews is the wrong
  instrument for finding it. What differs by sector is where it concentrates, and what
  it is called.</p>
  <p>Each page below was written for one industry and borrows nothing from the others.
  It names the losses that recur there in the words that sector actually uses, the
  systems the data sits in, the filings that set the deadlines, and what the intake
  would ask for. If yours is here, start there rather than with the
  <a href="/">method</a> &mdash; the method reads better once it is about your own
  operation.</p>
  <p class="sub">If yours is not listed, it is worth asking anyway. The reason these
  are separate pages rather than one is that the vocabulary matters, and that is a
  conversation rather than a page.</p>

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
      d.subsectors.map(x => {
        /* Link only where a page exists. A card that looks clickable and is
           not is worse than a card that never did. */
        const body = `<b>${esc(x.name)}</b><span>${esc(x.note)}</span>`;
        return x.slug && x.patterns
          ? `      <li class="has"><a href="/industries/${ind.slug}/${x.slug}/">${body}` +
            `<em>Read the page for ${esc(x.name.toLowerCase())} &rarr;</em></a></li>`
          : `      <li>${body}</li>`;
      }).join("\n") +
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
    <div class="hd"><b>${mod.items.length} requests written for ${esc(phrase)}
      and asked of nobody else</b> &mdash; ${coreCount} of them core. They sit alongside
      the operating spine every business has &mdash; finance, revenue, receivables,
      payables, contracts, people, IT, operations, risk, commercial and governance
      &mdash; which is 107 further requests.</div>
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
    <a class="btn" href="/industries/${ind.slug}/proposal/">See the proposal and the price</a>
    <a class="btn g" href="/#contact">Talk it through first</a>
  </div>
  <p class="sub" style="margin-top:11px">The proposal sets out the sequence week by
  week, what we would need from you, and what it costs for your number of operating
  units. No call required to see the number.</p>

  <h2>Closest to this</h2>
  <p class="sub">Operations that share more with ${esc(phrase)} than the sector label
  suggests.</p>
  <ul class="also">
${alsoLinks}
    <li><a href="/industries/#${group.id}">All of ${esc(group.title.toLowerCase())}</a></li>
  </ul>
${foot}`;
}

const ORDERS_API = "https://wirewalk-orders.wirewalk-upload.workers.dev";

/* The sequence is the same shape in every sector -- it is the method, not the
   industry -- but WHAT is read in each phase is drawn from that sector's own
   intake module and loss patterns. A proposal that describes a generic method
   with generic examples reads as a template, because it is one. */
function proposalPage(ind) {
  const mod = SECTOR_MODULES[ind.sector];
  const d = DEPTH[ind.slug] || {};
  const phrase = phraseOf(ind);
  const core = mod.items.filter(i => i.importance === "core");

  const phases = [
    { wk: "Week 1", title: "Intake and reconciliation",
      body: `You complete the intake in the client portal — ${mod.items.length} requests ` +
            `written for ${phrase} and asked of nobody else, alongside the 107 that ` +
            `cover the operating spine any business has. ` +
            `Anything you do not have is skipped in one click, with a reason. We reconcile ` +
            `what arrives against what was asked and tell you, before any fieldwork, which ` +
            `findings the gaps will limit.` },
    { wk: "Weeks 2–3", title: "Full pass, not a sample",
      body: `Every ${d.metrics ? d.metrics[0] : "record"} in scope is read rather than ` +
            `sampled. Concentrated loss is exactly what sampling misses — one contract, one ` +
            `queue, one unreviewed account — so a sample of the operation tends to miss it ` +
            `and a full pass tends to find it.` },
    { wk: "Week 4", title: "Quantification and challenge",
      body: `Each finding is sized, and each is put to the person who owns it before it is ` +
            `written down. A finding the operator can immediately explain away is not a ` +
            `finding, and it is cheaper to discover that here than in the room.` },
    { wk: "Week 5", title: "Report and walkthrough",
      body: `A written report with the evidence attached, and a walkthrough with whoever ` +
            `you want in the room. Findings are ranked by annual value and by how hard they ` +
            `are to act on, because those are different axes and the cheap ones should not ` +
            `wait for the big ones.` },
  ];

  const phaseHtml = phases.map(p => `    <li>
      <span class="wk">${esc(p.wk)}</span>
      <div><b>${esc(p.title)}</b><span>${esc(p.body)}</span></div>
    </li>`).join("\n");

  const patHtml = ind.patterns.slice(0, 5).map(p =>
    `    <li>${esc(p)}</li>`).join("\n");
  const coreHtml = core.map(i =>
    `    <li><b>${esc(i.label)}</b>${i.detail ? ` — ${esc(i.detail)}` : ""}</li>`).join("\n");

  const triggerHtml = d.triggers ? `
  <h2>If any of this is already happening</h2>
  <p>The review is always worth doing and rarely urgent. It becomes urgent when
  something else is happening — and if one of these is, the sequence above compresses
  to fit it.</p>
  <ul class="trg">
${d.triggers.map(t => `    <li>${esc(t)}</li>`).join("\n")}
  </ul>` : "";

  const roleHtml = d.roles ? `
  <h2>Who needs to be in the room</h2>
  <ul class="roles">
    <li><b>Signs it:</b> ${esc(d.roles.signs)}</li>
    <li><b>Will resist it:</b> ${esc(d.roles.blocks)} — worth telling them what the
      review is for before they hear it from somewhere else.</li>
    <li><b>Has been asking for it:</b> ${esc(d.roles.benefits)}</li>
  </ul>` : "";

  return `---
permalink: /industries/${ind.slug}/proposal/
title: ${yaml("Proposal — " + ind.name)}
description: ${yaml("What the Operating Review would do for " + phrase + ": scope, sequence, what you get, and what it costs.")}
---
${head(`Proposal — ${ind.name} — Wirewalk AI`,
       clip(`What the Operating Review would do for ${phrase}: the sequence, the deliverable, what we need from you, and what it costs.`, 290),
       `https://ai.wirewalk.com/industries/${ind.slug}/proposal/`)}
<div class="wrap">
  <p class="crumb"><a href="/">The Operating Review</a> &rsaquo;
    <a href="/industries/">Industries</a> &rsaquo;
    <a href="/industries/${ind.slug}/">${esc(ind.name)}</a> &rsaquo; Proposal</p>

  <div class="prop-hero">
    <span class="eyebrow">Proposal &mdash; ${esc(ind.name)}</span>
    <h1>${esc(ind.headline)}</h1>
    <p class="lede">This is what we would actually do, in what order, and what it costs.
    No discovery call is required to see the number.</p>
  </div>

  <h2>What we would go looking for</h2>
  <p class="sub">These are patterns that recur in ${esc(phrase)}, written as things to
  look for. They are not findings from a named engagement.</p>
  <ol class="pat">
${patHtml}
  </ol>

  <h2>The sequence</h2>
  <p>Five weeks for one operating unit. More units run in parallel rather than in
  series, so a group does not take five times as long.</p>
  <ul class="phase">
${phaseHtml}
  </ul>

  <h2>What you get</h2>
  <ul class="deliv">
    <li>A written report, with the evidence for each finding attached rather than
      referenced.</li>
    <li>Each finding sized in annual value, and ranked against how hard it is to act on.</li>
    <li>The reconciliation of what was asked for against what was provided, so the
      limits of the work are stated rather than implied.</li>
    <li>A walkthrough with whoever you want present.</li>
    <li>Your documents destroyed on completion, with a certificate naming every file.</li>
  </ul>
  <p class="sub" style="margin-top:14px">Phase one is priced before phase two is
  discussed. The report is yours either way, and we take no vendor commissions or
  referral fees on anything we recommend.</p>

  <h2>What we need from you</h2>
  <p>${core.length} core requests written for ${esc(phrase)}, inside the full intake.
  Anything you do not have can be skipped with a reason — skipping narrows what the
  review can conclude, and we tell you where before the work starts rather than after.</p>
  <ul class="deliv">
${coreHtml}
  </ul>
${triggerHtml}
${roleHtml}

  <h2>What it costs</h2>
  <p>Priced by operating unit — an entity, a location, or a business the accounts are
  kept separately for. The second unit costs less than the first because by then the
  intake is built, the chart of accounts is understood and the patterns are known.</p>

  <div class="quotebox">
    <div class="qrow">
      <div>
        <label for="units">Operating units in scope</label>
        <input id="units" type="number" min="1" max="25" value="1" inputmode="numeric">
      </div>
      <div>
        <label for="sectors">Sector modules</label>
        <select id="sectors">
          <option value="1">1 — ${esc(ind.name.toLowerCase())} only</option>
          <option value="2">2 — plus one adjacent</option>
          <option value="3">3 — plus two adjacent</option>
          <option value="4">4 — plus three adjacent</option>
        </select>
      </div>
    </div>
    <div class="qout" id="qout" aria-live="polite">
      <div class="qbig" id="qbig">&mdash;</div>
      <div class="qsub" id="qsub">Choose a scope to see the price.</div>
      <ul class="qlines" id="qlines"></ul>
      <div class="qopts" id="qopts"></div>
    </div>
    <div class="acts" style="margin-top:20px">
      <a class="btn" href="/order/#catalog" id="orderbtn">Commission it</a>
      <a class="btn g" href="/#contact">Ask a question first</a>
    </div>
    <p class="sub" style="margin-top:14px">Purchase order is the primary route — most
    buyers this size raise a PO and pay against an invoice on terms. Card and bank
    transfer exist for those who prefer them.</p>
  </div>

  <h2>Read first, if you would rather</h2>
  <ul class="also">
    <li><a href="/industries/${ind.slug}/">${esc(ind.name)} &mdash; where loss concentrates</a></li>
    <li><a href="/">How the review works</a></li>
    <li><a href="/terms/">Ordering terms</a></li>
  </ul>

<script>
(function(){
  var API=${JSON.stringify(ORDERS_API)};
  var u=document.getElementById("units"), s=document.getElementById("sectors");
  var big=document.getElementById("qbig"), sub=document.getElementById("qsub");
  var lines=document.getElementById("qlines"), opts=document.getElementById("qopts");
  var t=null;
  function esc(x){return String(x).replace(/[&<>"]/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function render(d){
    big.textContent=d.engagementTotalFormatted;
    sub.textContent=d.units+" operating unit"+(d.units===1?"":"s")+
      " — "+d.perUnitFormatted+" each"+
      (d.scaleSaving>0?", "+d.scaleSavingFormatted+" below the flat rate":"");
    lines.innerHTML=d.lines.map(function(l){
      return "<li><span>"+esc(l.label)+"</span><span>"+esc(l.amountFormatted)+"</span></li>";}).join("");
    var o=d.options;
    opts.innerHTML=
      '<div class="qopt"><span>Purchase order — invoiced on terms</span><b>'+esc(o.po.totalFormatted)+'</b></div>'+
      '<div class="qopt"><span>Deposit now, balance on delivery</span><b>'+esc(o.deposit.dueNowFormatted)+' now</b></div>'+
      '<div class="qopt"><span>Pay in full</span><b>'+esc(o.full.dueNowFormatted)+'</b></div>'+
      '<div class="qopt"><span>Pay in full by bank transfer</span><b>'+esc(o.fullAch.dueNowFormatted)+'</b></div>';
  }
  function fail(msg){
    big.textContent="—"; lines.innerHTML=""; opts.innerHTML="";
    sub.innerHTML='<span class="qerr">'+esc(msg)+'</span>';
  }
  function go(){
    /* The browser sends the SHAPE of the business and never a price. Every
       figure above is resolved server-side and resolved again at checkout. */
    fetch(API+"/quote",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({units:Number(u.value)||1,sectors:Number(s.value)||1})})
      .then(function(r){return r.json().then(function(b){return {ok:r.ok,b:b};});})
      .then(function(x){
        if(!x.ok){ fail(x.b.error||"That scope needs a conversation — please get in touch."); return; }
        render(x.b);
      })
      .catch(function(){ fail("Could not reach pricing just now. Please try again, or email sales@wirewalk.com."); });
  }
  function debounced(){ clearTimeout(t); t=setTimeout(go,220); }
  u.addEventListener("input",debounced); s.addEventListener("change",go);
  go();
})();
</script>
${foot}`;
}

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Sub-vertical pages
 * ------------------------------------------------------------------ *
 * A sub-vertical gets its own page ONLY when it has `slug` and `patterns` --
 * that is, when somebody has written material the parent page cannot carry.
 * The rest stay as cards on the parent, which is the honest outcome: pages
 * that restate their parent with a different noun are doorway pages, and they
 * would contradict the one claim this whole section rests on, that each page
 * is written for one reader.
 *
 * An insurance-defence firm should meet LEDES exports, task-code rejections
 * and carrier audits here -- none of which belong on a page a plaintiff firm
 * also reads.
 */
function subVerticalPage(ind, sub) {
  const phrase = phraseOf(ind);
  const pats = (sub.patterns || []).map(x => `    <li>${esc(x)}</li>`).join("\n");
  const sys = (sub.systems || []).map(x => `      <li>${esc(x)}</li>`).join("\n");
  const vocab = (sub.vocabulary || []).map(v => `    <li>${esc(v)}</li>`).join("\n");

  return `---
permalink: /industries/${ind.slug}/${sub.slug}/
title: ${yaml(sub.name + " — " + ind.name)}
description: ${yaml(sub.note)}
---
${head(`${sub.name} — ${ind.name} — Wirewalk AI`,
       clip(`${sub.note} ${sub.lede || ""}`, 290),
       `https://ai.wirewalk.com/industries/${ind.slug}/${sub.slug}/`)}
<div class="wrap">
  <p class="crumb"><a href="/">The Operating Review</a> &rsaquo;
    <a href="/industries/">Industries</a> &rsaquo;
    <a href="/industries/${ind.slug}/">${esc(ind.name)}</a> &rsaquo; ${esc(sub.name)}</p>
  <span class="eyebrow">${esc(ind.name)} &mdash; ${esc(sub.name)}</span>
  <h1>${esc(sub.note)}</h1>
  ${sub.lede ? `<p class="lede">${esc(sub.lede)}</p>` : ""}

  ${vocab ? `<ul class="vocab">\n${vocab}\n  </ul>
  <p class="vocab-note">These are the terms the review uses with you. A page written for
  ${esc(phrase)} generally would not contain any of them.</p>` : ""}

  <h2>Where it concentrates here</h2>
  <p>Specific to ${esc(sub.name.toLowerCase())}, not to ${esc(phrase)} generally. Each is
  concentrated &mdash; a single agreement, a single code, a single account nobody reviews
  &mdash; which is why a sample of the operation tends to miss it and a full pass tends to
  find it. They are not findings from a named engagement.</p>
  <ol class="pat">
${pats}
  </ol>

  ${sys ? `<h2>Where this data actually lives</h2>
  <div class="depth">
    <ul class="sysl">
${sys}
    </ul>
    <p class="sub" style="margin-top:11px">Named because it changes what the intake asks
    for. An extract from one of these has known gaps, and the review is built around them
    rather than surprised by them.</p>
  </div>` : ""}

  <div class="acts">
    <a class="btn" href="/industries/${ind.slug}/proposal/">See the proposal and the price</a>
    <a class="btn g" href="/#contact">Talk it through first</a>
  </div>
  <p class="sub" style="margin-top:11px">The proposal is written for ${esc(phrase)} as a
  whole &mdash; the sequence, what we would need from you, and what it costs for your
  number of operating units. What is on this page is what we would additionally expect to
  find in ${esc(sub.name.toLowerCase())}.</p>

  <h2>The rest of the sector</h2>
  <ul class="also">
    <li><a href="/industries/${ind.slug}/">${esc(ind.name)} &mdash; where loss concentrates</a></li>
${(DEPTH[ind.slug]?.subsectors || []).filter(o => o.slug && o.slug !== sub.slug)
   .map(o => `    <li><a href="/industries/${ind.slug}/${o.slug}/">${esc(o.name)}</a></li>`).join("\n")}
  </ul>
${foot}`;
}

/* ------------------------------------------------------------------ *
 * The homepage teaser
 * ------------------------------------------------------------------ *
 * The homepage used to hand-list every industry. It had silently gone stale --
 * twenty listed against twenty-three that existed, missing the three most
 * recently added -- because nothing connects a hand-written list to the data it
 * is supposed to describe. Any list kept in two places is a list that
 * eventually disagrees with itself, and the version a visitor reads is the one
 * nobody remembered to update.
 *
 * So it is written from the same INDUSTRIES data as everything else, between
 * markers in index.html. Adding the twenty-fourth industry means adding it once.
 */
function homepageTeaser() {
  return GROUPS.map(g => {
    const links = g.slugs
      .filter(sl => BY_SLUG[sl])
      .map(sl => `<a class="ilink" href="/industries/${sl}/">${esc(BY_SLUG[sl].name)}</a>`)
      .join(" &middot;\n      ");
    return `    <div><span class="n">${esc(g.id.charAt(0).toUpperCase() + g.id.slice(1))}</span>` +
           `<h4>${esc(g.title)}</h4>\n      <p>${esc(g.blurb)}<br>\n      ${links}</p></div>`;
  });
}

function writeHomepageTeaser() {
  const HOME = join(HERE, "index.html");
  const html = readFileSync(HOME, "utf8");
  const A = "<!--GEN:industries-start-->", B = "<!--GEN:industries-end-->";
  const i = html.indexOf(A), j = html.indexOf(B);
  if (i < 0 || j < 0) {
    console.error("homepage markers missing — teaser NOT written");
    process.exitCode = 1;
    return 0;
  }
  const cards = homepageTeaser();
  /* Three to a row, so the grid stays whole however many industries exist. */
  const rows = [];
  for (let k = 0; k < cards.length; k += 3) {
    rows.push(`  <div class="g3" data-rv${k ? ' style="margin-top:1px"' : ""}>\n` +
              cards.slice(k, k + 3).join("\n") + "\n  </div>");
  }
  const out = html.slice(0, i + A.length) + "\n" + rows.join("\n") + "\n  " + html.slice(j);
  writeFileSync(HOME, out);
  return cards.length;
}

writeFileSync(join(OUT, "index.html"), indexPage());
let n = 1, subs = 0;
for (const ind of INDUSTRIES) {
  writeFileSync(join(OUT, `${ind.slug}.html`), industryPage(ind));
  n++;
  writeFileSync(join(OUT, `${ind.slug}-proposal.html`), proposalPage(ind));
  n++;
  for (const sub of (DEPTH[ind.slug]?.subsectors || [])) {
    if (!sub.slug || !sub.patterns) continue;   // card only, no page
    writeFileSync(join(OUT, `${ind.slug}--${sub.slug}.html`), subVerticalPage(ind, sub));
    n++; subs++;
  }
}
const teased = writeHomepageTeaser();
console.log(`wrote ${n} files into ${OUT} (${subs} sub-vertical page(s))`);
console.log(`homepage teaser: ${teased} group card(s) from ${INDUSTRIES.length} industries`);
