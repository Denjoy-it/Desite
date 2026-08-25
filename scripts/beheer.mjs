#!/usr/bin/env node
// Lokale beheertool voor Desite: één plek om (1) een Word-document (.docx) of
// een los .md-bestand om te zetten naar een concept-wiki-artikel, (2) die
// concepten te beoordelen en te publiceren, en (3) klanten aan te maken en
// te bewerken. Draait alleen op je eigen machine (npm run beheer), bindt
// expliciet aan 127.0.0.1 - geen login, dus niet aan het netwerk
// blootstellen. Geen deploy-impact: dit script is geen onderdeel van de
// Astro-build, alleen een los Node-hulpmiddel.
//
// Bewust geen login: dit draait alleen lokaal op jouw eigen machine, en wie
// dit script kan starten had toch al volledige bestandstoegang tot de repo.
// Zie scripts/start-windows.bat / scripts/start-mac.command om dit als vaste
// snelkoppeling (evt. bij het opstarten van je machine) te starten.
//
// Gebruik: npm run beheer
// - "/" - upload een .docx of .md (titel/beschrijving/categorie/klant(en)
//   invullen, dan klikken/slepen); komt als concept (draft: true) in
//   src/content/wiki/. Een .md-bestand wordt niet geconverteerd (het is al
//   Markdown) - een eventuele eigen frontmatter erin wordt genegeerd, die
//   komt uit het formulier. De klant-lijst in dit formulier wordt bij elke
//   paginalaad vers van schijf gelezen, dus een klant die je net hebt
//   aangemaakt staat er meteen bij.
// - "/drafts" - overzicht van alle concepten in de wachtrij.
// - "/drafts/edit?slug=..." - ruwe Markdown-editor per concept: opslaan
//   (blijft concept), publiceren (zet draft: false) of verwijderen.
// - "/klanten" - overzicht van alle klanten, met een mini-formulier om een
//   nieuwe klant te starten.
// - "/klanten/edit?slug=..." - ruwe Markdown-editor per klant: opslaan of
//   verwijderen.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import matter from "gray-matter";
import { parse as parseHtml } from "node-html-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WIKI_DIR = path.join(ROOT, "src/content/wiki");
const CLIENTS_DIR = path.join(ROOT, "src/content/clients");
const PORT = 4555;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB ruwe bestandsgrootte

// Moet gelijk blijven aan CATEGORIES in src/content.config.ts - los gehouden
// omdat dat bestand "astro:content" importeert en dus niet als los Node-
// script te draaien is.
const CATEGORIES = [
  "Algemeen",
  "Azure",
  "Microsoft 365",
  "Entra ID",
  "Exchange Online",
  "SharePoint",
  "Teams",
  "Office",
  "Defender",
  "Intune",
  "Compliance & Purview",
  "PowerShell",
  "Windows Server & Client",
  "Netwerken",
];

// Skelet voor een nieuw huisstijl-artikel - zie ook src/content/wiki/azure-bastion-toegang.md
// als volledig uitgewerkt voorbeeld. Wordt gebruikt door "Nieuw concept starten"
// én getoond als spiekbriefje in de concept-editor.
const HOUSE_STYLE_TEMPLATE_BODY = `Korte inleidende alinea: wat is de context, wat lost dit artikel op, voor wie is het bedoeld.

## Eerste hoofdstuk

Uitleg-tekst. Gebruik een callout voor iets dat extra aandacht verdient:

<div class="call info"><div class="ct"><span>&#9670;</span> Titel van de tip</div><p>Uitleg van de tip.</p></div>

Andere callout-varianten: <code>call warn</code> (let op), <code>call caution</code> (waarschuwing/risico), <code>call ok</code> (positief/geslaagd).

## Stappen

<ol class="phases">
<li><b>Eerste stap.</b> Uitleg wat je doet en waarom.</li>
<li><b>Tweede stap.</b> Uitleg.</li>
</ol>

## Diagram (optioneel, alleen als een plaatje het proces echt verduidelijkt)

\`\`\`mermaid
flowchart LR
    A[Start] --> B[Einde]
\`\`\`

## Besluiten (alleen als er een architecturale keuze is vastgelegd)

| ADR | Besluit | Status |
|---|---|---|
| **ADR-0001 — Titel van het besluit** | Korte beschrijving van wat er is besloten en waarom. | <span class="badge b-ok">Accepted</span> |

## Bronnen

- [Titel van de bron](https://learn.microsoft.com/...)
`;

function slugify(title) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function readFrontmatterFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const { data } = matter(raw);
      return { id: f.replace(/\.mdx?$/, ""), data };
    });
}

// Leest de klant-lijst altijd vers van schijf (geen caching) - een klant die
// net via /klanten is aangemaakt staat dus meteen in het upload-formulier.
function getClients() {
  return readFrontmatterFiles(CLIENTS_DIR)
    .map((c) => ({ id: c.id, title: c.data.title ?? c.id, description: c.data.description ?? "" }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function nextOrder(category) {
  const existing = readFrontmatterFiles(WIKI_DIR).filter((e) => e.data.category === category);
  if (existing.length === 0) return 1;
  return Math.max(...existing.map((e) => Number(e.data.order) || 0)) + 1;
}

function nextClientOrder() {
  const existing = readFrontmatterFiles(CLIENTS_DIR);
  if (existing.length === 0) return 1;
  return Math.max(...existing.map((e) => Number(e.data.order) || 0)) + 1;
}

function uniqueSlug(base, dir) {
  const existingIds = new Set(readFrontmatterFiles(dir).map((e) => e.id));
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Wachtrij: alle wiki-concepten (draft: true), voor het overzicht op /drafts.
function listDrafts() {
  return readFrontmatterFiles(WIKI_DIR)
    .filter((e) => e.data.draft === true)
    .map((e) => ({
      slug: e.id,
      title: e.data.title ?? e.id,
      category: e.data.category ?? "",
      clients: Array.isArray(e.data.clients) ? e.data.clients : [],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function draftFilePath(slug) {
  // Geen padtraversal: alleen een kale bestandsnaam zonder / of .. toestaan.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const p = path.join(WIKI_DIR, `${slug}.md`);
  return fs.existsSync(p) ? p : null;
}

function clientFilePath(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const p = path.join(CLIENTS_DIR, `${slug}.md`);
  return fs.existsSync(p) ? p : null;
}

// Willekeurige, redelijk uitspreekbare passphrase voor het cosmetische
// KlantGate-inlogscherm op de publieke GitHub Pages-build (zie
// src/components/KlantGate.astro) - elke klant krijgt bij aanmaken een eigen
// wachtwoord, zodat klant A niet ook klant B's artikelen kan ontgrendelen.
const PASSPHRASE_WORDS = [
  "beukennoot", "dennenappel", "haverkorrel", "iepenblad", "kastanje",
  "lisdodde", "mosterdzaad", "narcis", "populier", "rietvink",
  "sleedoorn", "tamme", "veenmos", "wilgentak", "zonnedauw",
];
function generatePassphrase() {
  const w1 = PASSPHRASE_WORDS[crypto.randomInt(PASSPHRASE_WORDS.length)];
  const w2 = PASSPHRASE_WORDS[crypto.randomInt(PASSPHRASE_WORDS.length)];
  const n = crypto.randomInt(10, 100);
  return `${w1}-${w2}-${n}`;
}
function sha256Hex(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-", // huisstijl gebruikt overal "-", niet turndown's default "*"
});
turndownService.use(gfm);

// Kop waarvan de hele tekst vetgedrukt is (bv. "# **Doel**") is een vaste
// mammoth/turndown-artefact van Word-koppen, geen huisstijl - het dubbele
// gewicht (kop + vet) is altijd overbodig. Zet 'm om naar een gewone kop.
function stripBoldOnlyHeadings(markdown) {
  // [ \t]* (niet \s*) vóór $ - \s zou ook de \n van een volgende lege regel
  // opeten en zo de blanco regel na de kop laten verdwijnen.
  return markdown.replace(/^(#{1,6})[ \t]*\*\*(.+?)\*\*[ \t]*$/gm, "$1 $2");
}

// Mammoth-tabellen hebben twee eigenschappen die turndown-plugin-gfm niet
// zelfstandig aankan:
// 1. Elke cel is een platte <td>, ook de koprij (Word kent geen <th>-
//    equivalent) - de plugin herkent een tabel alleen met een echte koprij.
//    Aanname: de eerste rij is de koprij; klopt dat een keer niet, is dat te
//    corrigeren in het weggeschreven concept.
// 2. Celinhoud staat in <p>-tags. turndown-plugin-gfm's cell()-helper plakt
//    de geconverteerde celinhoud ruw tussen "| ... |" zonder newlines eruit
//    te halen (zie node_modules/turndown-plugin-gfm) - een <p> erin levert
//    dus een kapotte, meerregelige tabelrij op. Fix: <p>'s in een cel
//    uitpakken (samenvoegen met <br> bij meerdere alinea's) vóór turndown.
function normalizeTableHtml(html) {
  const root = parseHtml(html);
  for (const table of root.querySelectorAll("table")) {
    const firstRow = table.querySelector("tr");
    if (firstRow) {
      const asHeader = firstRow.outerHTML
        .replace(/<td(\s|>)/g, "<th$1")
        .replace(/<\/td>/g, "</th>");
      firstRow.replaceWith(asHeader);
    }
    for (const cell of table.querySelectorAll("td, th")) {
      const paragraphs = cell.childNodes.filter((n) => n.tagName === "P");
      if (paragraphs.length === 0) continue;
      cell.innerHTML = paragraphs.map((p) => p.innerHTML.trim()).join("<br>");
    }
  }
  return root.toString();
}

async function convertDocxToMarkdown(buffer) {
  const { value: rawHtml, messages } = await mammoth.convertToHtml({ buffer });
  const html = normalizeTableHtml(rawHtml);
  const markdown = stripBoldOnlyHeadings(turndownService.turndown(html));
  return { markdown, warnings: messages.filter((m) => m.type === "warning") };
}

// Een geüpload .md-bestand is al Markdown - geen mammoth/turndown nodig. Een
// eventuele eigen frontmatter van het bestand wordt genegeerd: de frontmatter
// van het concept komt uit het formulier (titel/beschrijving/categorie/...),
// niet uit het bestand zelf.
function convertMarkdownUpload(buffer) {
  const { content } = matter(buffer.toString("utf-8"));
  const markdown = stripBoldOnlyHeadings(content.trim());
  return { markdown, warnings: [] };
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// CSS die alle pagina's van deze tool delen (nav, basislayout, formulierstijl).
const SHARED_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans", system-ui, sans-serif; background: #f4f5f7; color: #161a20; margin: 0; padding: 0 20px 120px; }
  .wrap { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e3e6eb; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  p.lede { color: #586170; margin: 0 0 28px; font-size: 14px; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 18px 0 6px; }
  input[type="text"], textarea, select {
    width: 100%; padding: 9px 10px; border: 1px solid #d3d8df; font-family: inherit; font-size: 14px;
  }
  textarea { min-height: 70px; resize: vertical; }
  .chk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 4px; }
  .chk { display: flex; align-items: center; gap: 6px; font-weight: 400; font-size: 13px; margin: 0; }
  .chk input { width: auto; }
  .hint { color: #8b929e; font-size: 12px; }
  .style-warning {
    background: #fdf1e4; border: 1px solid #ee7214; padding: 10px 14px;
    font-size: 13px; margin-bottom: 12px; line-height: 1.5;
  }
  .style-warning ul { margin: 6px 0 0; padding-left: 18px; }

  /* Topnav: schakelen tussen uploaden, concepten en klanten. */
  .topnav { max-width: 640px; margin: 0 auto; padding: 18px 0 22px; display: flex; gap: 6px; }
  .topnav a {
    font-size: 13px; font-weight: 600; color: #586170; text-decoration: none;
    padding: 7px 14px; border: 1px solid #e3e6eb; background: #fff;
  }
  .topnav a.active { color: #fff; background: #161a20; border-color: #161a20; }
  .topnav a .badge {
    display: inline-block; margin-left: 6px; background: #ee7214; color: #fff;
    border-radius: 999px; font-size: 11px; padding: 1px 7px;
  }

  /* Conceptenlijst / klantenlijst */
  .draft-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid #e3e6eb;
  }
  .draft-row:last-child { border-bottom: none; }
  .draft-row .meta { flex: 1; min-width: 0; }
  .draft-row .title { font-weight: 600; font-size: 14px; }
  .draft-row .sub { color: #8b929e; font-size: 12px; margin-top: 2px; }
  .draft-row a.editbtn {
    font-size: 13px; font-weight: 600; color: #ee7214; text-decoration: none; white-space: nowrap;
  }
  .empty-state { color: #8b929e; font-size: 14px; padding: 20px 0; }

  /* Editor */
  #editor {
    width: 100%; min-height: 60vh; font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 12.5px; line-height: 1.6; padding: 16px; border: 1px solid #d3d8df; resize: vertical;
  }
  .editor-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .editor-actions button { border: none; padding: 11px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
  #btnPublish { background: #16a34a; color: #fff; }
  #btnSave { background: #161a20; color: #fff; }
  #btnDelete { background: none; color: #e11d48; border: 1px solid #e11d48 !important; margin-left: auto; }
  #editorMsg { margin-top: 12px; font-size: 13px; padding: 10px 12px; display: none; }
  #editorMsg.ok { display: block; background: #eafaf0; border: 1px solid #16a34a; }
  #editorMsg.err { display: block; background: #fdecec; border: 1px solid #e11d48; }
  #btnAiFormat {
    background: #fff; color: #8b929e; border: 1px solid #d3d8df !important; cursor: not-allowed;
  }

  /* Huisstijl-spiekbriefje: helpt bij handmatig opmaken, geen automatisering. */
  .cheatsheet { margin-top: 22px; border: 1px solid #e3e6eb; }
  .cheatsheet summary {
    padding: 12px 16px; font-size: 13px; font-weight: 600; cursor: pointer; background: #f4f5f7;
  }
  .cheatsheet .inner { padding: 16px; }
  .cheatsheet h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #8b929e; margin: 16px 0 6px; }
  .cheatsheet h3:first-child { margin-top: 0; }
  .cheatsheet pre {
    background: #161a20; color: #e3e6eb; padding: 10px 12px; font-size: 11.5px; line-height: 1.5;
    overflow-x: auto; font-family: "IBM Plex Mono", ui-monospace, monospace; white-space: pre-wrap;
  }
  .cheatsheet ul { margin: 0; padding-left: 18px; font-size: 13px; color: #586170; }
  .cheatsheet ul li { margin: 4px 0; }
  .cheatsheet .example-link { font-size: 12px; }

  /* "Nieuw concept/klant starten" - klein formulier bovenaan de lijst. */
  .new-draft-box {
    border: 1px dashed #d3d8df; padding: 16px; margin-bottom: 22px; display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;
  }
  .new-draft-box .field { flex: 1; min-width: 160px; }
  .new-draft-box label { margin: 0 0 4px; }
  .new-draft-box button { background: #161a20; color: #fff; border: none; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }

  /* Upload-knop: dubbelt als dropzone. Klik opent de bestandskiezer; slepen
     werkt ook. Zodra er een bestand gekozen/gesleept is, start de upload
     automatisch - geen aparte "verstuur"-stap. */
  #dropzone {
    margin-top: 18px; border: 2px dashed #d3d8df; padding: 22px; text-align: center;
    cursor: pointer; transition: border-color .15s, background .15s;
  }
  #dropzone:hover, #dropzone.drag { border-color: #ee7214; background: #fff7f0; }
  #dropzone .btn {
    display: inline-flex; align-items: center; gap: 8px; background: #ee7214; color: #fff;
    border: none; padding: 11px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  #dropzone .filehint { margin-top: 10px; font-size: 12px; color: #8b929e; }
  #fileInput { display: none; }

  /* Statusbalk: vast onderaan het scherm, blijft zichtbaar tijdens en na de
     achtergrondconversie zodat je nooit hoeft te wachten op een blokkerend
     dialoogvenster. */
  #statusbar {
    position: fixed; left: 0; right: 0; bottom: 0; transform: translateY(100%);
    background: #161a20; color: #fff; padding: 14px 20px; font-size: 13px;
    transition: transform .2s ease; z-index: 100;
  }
  #statusbar.show { transform: translateY(0); }
  #statusbar .row { max-width: 640px; margin: 0 auto; display: flex; align-items: center; gap: 12px; }
  #statusbar .spinner {
    width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,.25);
    border-top-color: #ee7214; animation: spin .7s linear infinite; flex: none;
  }
  #statusbar.ok .spinner, #statusbar.err .spinner { display: none; }
  #statusbar .icon-ok, #statusbar .icon-err { display: none; font-size: 15px; flex: none; }
  #statusbar.ok .icon-ok { display: inline; color: #4ade80; }
  #statusbar.err .icon-err { display: inline; color: #f87171; }
  #statusbar .text { flex: 1; white-space: pre-wrap; }
  #statusbar .bar { position: absolute; left: 0; bottom: 0; height: 2px; background: #ee7214; width: 40%; animation: indeterminate 1.1s ease-in-out infinite; }
  #statusbar.ok .bar, #statusbar.err .bar { display: none; }
  #statusbar .dismiss { background: none; border: none; color: #8b929e; cursor: pointer; font-size: 18px; line-height: 1; flex: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`;

function pageShell(title, activeNav, bodyHtml) {
  const draftCount = listDrafts().length;
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Desite - ${escapeHtml(title)}</title>
<style>${SHARED_STYLE}</style>
</head>
<body>
<nav class="topnav">
  <a href="/"${activeNav === "upload" ? ' class="active"' : ""}>Uploaden</a>
  <a href="/drafts"${activeNav === "drafts" ? ' class="active"' : ""}>Concepten${draftCount ? `<span class="badge">${draftCount}</span>` : ""}</a>
  <a href="/klanten"${activeNav === "klanten" ? ' class="active"' : ""}>Klanten</a>
</nav>
${bodyHtml}
</body>
</html>`;
}

function renderForm() {
  const clients = getClients();
  const categoryOptions = CATEGORIES.map(
    (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`,
  ).join("");
  const clientCheckboxes = clients.length
    ? clients
        .map(
          (c) =>
            `<label class="chk"><input type="checkbox" name="clients" value="${escapeHtml(c.id)}"> ${escapeHtml(c.title)}</label>`,
        )
        .join("")
    : `<p class="hint">Nog geen klanten - <a href="/klanten">maak er eerst een aan</a>.</p>`;

  const body = `
<div class="wrap">
  <h1>Document importeren</h1>
  <p class="lede">Vul de metadata in, kies daarna een .docx- of .md-bestand (of sleep 'm op de knop) - de upload en conversie starten meteen op de achtergrond. Zet een concept dat als draft in src/content/wiki/ komt: bekijk 'm daarna op de <a href="/drafts">conceptenpagina</a> om na te lezen en te publiceren.</p>
  <form id="f">
    <label for="title">Titel</label>
    <input type="text" id="title" required>

    <label for="description">Beschrijving (1-2 zinnen, voor de wiki-lijst)</label>
    <textarea id="description" required></textarea>

    <label for="category">Categorie</label>
    <select id="category">${categoryOptions}</select>

    <label>Klant(en) (optioneel)</label>
    <div class="chk-grid">${clientCheckboxes}</div>

    <div id="dropzone">
      <input type="file" id="fileInput" accept=".docx,.md,.markdown">
      <button type="button" class="btn" id="pickBtn">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"></path><path d="M7 8l5-5 5 5"></path><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"></path></svg>
        Bestand uploaden (.docx of .md)
      </button>
      <div class="filehint">Klik, of sleep een .docx- of .md-bestand op deze knop</div>
    </div>
  </form>
</div>
<div id="statusbar">
  <div class="bar"></div>
  <div class="row">
    <span class="spinner"></span>
    <span class="icon-ok">&#10003;</span>
    <span class="icon-err">&#10007;</span>
    <span class="text" id="statusText"></span>
    <button class="dismiss" id="statusDismiss" title="Sluiten">&times;</button>
  </div>
</div>
<script>
  const titleEl = document.getElementById("title");
  const descEl = document.getElementById("description");
  const categoryEl = document.getElementById("category");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const pickBtn = document.getElementById("pickBtn");
  const statusbar = document.getElementById("statusbar");
  const statusText = document.getElementById("statusText");
  const statusDismiss = document.getElementById("statusDismiss");

  function setStatus(state, text) {
    statusbar.className = "show" + (state ? " " + state : "");
    statusText.textContent = text;
  }
  statusDismiss.addEventListener("click", () => statusbar.classList.remove("show"));

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadAndConvert(file) {
    if (!titleEl.value.trim() || !descEl.value.trim()) {
      setStatus("err", "Vul eerst titel en beschrijving in voor je een bestand uploadt.");
      return;
    }
    setStatus("", "Bezig met uploaden en converteren op de achtergrond: " + file.name + "...");
    try {
      const fileBase64 = await fileToBase64(file);
      const clients = [...document.querySelectorAll('input[name="clients"]:checked')].map((c) => c.value);
      const res = await fetch("/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileBase64,
          title: titleEl.value,
          description: descEl.value,
          category: categoryEl.value,
          clients,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Onbekende fout");
      setStatus(
        "ok",
        "Klaar - concept opgeslagen: " + data.path +
        (data.warnings?.length ? "\\nWaarschuwingen: " + data.warnings.join("; ") : "") +
        "\\nBekijk 'm op de conceptenpagina om na te lezen en te publiceren."
      );
      titleEl.value = "";
      descEl.value = "";
      document.querySelectorAll('input[name="clients"]:checked').forEach((c) => (c.checked = false));
    } catch (err) {
      setStatus("err", "Mislukt: " + err.message);
    }
  }

  pickBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) uploadAndConvert(fileInput.files[0]);
    fileInput.value = "";
  });
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) uploadAndConvert(file);
  });
</script>`;
  return pageShell("Document importeren", "upload", body);
}

function renderDraftsList() {
  const drafts = listDrafts();
  const rows = drafts.length
    ? drafts
        .map(
          (d) => `<div class="draft-row">
    <div class="meta">
      <div class="title">${escapeHtml(d.title)}</div>
      <div class="sub">${escapeHtml(d.category)}${d.clients.length ? " &middot; " + escapeHtml(d.clients.join(", ")) : ""} &middot; <code>${escapeHtml(d.slug)}.md</code></div>
    </div>
    <a class="editbtn" href="/drafts/edit?slug=${encodeURIComponent(d.slug)}">Beoordelen &rarr;</a>
  </div>`,
        )
        .join("")
    : `<p class="empty-state">Geen concepten in de wachtrij. Nieuwe uploads verschijnen hier automatisch.</p>`;

  const categoryOptions = CATEGORIES.map(
    (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`,
  ).join("");

  const body = `<div class="wrap">
  <h1>Concepten - wachtrij</h1>
  <p class="lede">Wiki-pagina's die via een upload zijn omgezet, of hier direct gestart, en nog op <code>draft: true</code> staan. Beoordeel de inhoud, ruim de opmaak op waar nodig, en publiceer of verwijder.</p>

  <form id="newDraftForm" class="new-draft-box">
    <div class="field">
      <label for="newTitle">Nieuw concept starten - titel</label>
      <input type="text" id="newTitle" placeholder="Titel van het nieuwe artikel" required>
    </div>
    <div class="field" style="flex: 0 0 200px;">
      <label for="newCategory">Categorie</label>
      <select id="newCategory">${categoryOptions}</select>
    </div>
    <button type="submit">Starten vanuit sjabloon</button>
  </form>

  ${rows}
</div>
<script>
  document.getElementById("newDraftForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("newTitle").value.trim();
    const category = document.getElementById("newCategory").value;
    if (!title) return;
    const res = await fetch("/drafts/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      window.location.href = "/drafts/edit?slug=" + encodeURIComponent(data.slug);
    } else {
      alert("Mislukt: " + (data.error || "Onbekende fout"));
    }
  });
</script>`;
  return pageShell("Concepten", "drafts", body);
}

function renderCheatsheet() {
  return `<details class="cheatsheet">
  <summary>Huisstijl-spiekbriefje (klik om te openen)</summary>
  <div class="inner">
    <p class="example-link">Volledig uitgewerkt voorbeeld: <code>src/content/wiki/azure-bastion-toegang.md</code></p>

    <h3>Koppen</h3>
    <p style="font-size:13px;color:#586170;margin:0">Gebruik echte Markdown-koppen (<code>##</code>, <code>###</code>) - nooit <b>vetgedrukte tekst</b> als vervanging. Zonder echte koppen krijgt de pagina geen inhoudsopgave.</p>

    <h3>Stappen</h3>
    <pre>&lt;ol class="phases"&gt;
&lt;li&gt;&lt;b&gt;Eerste stap.&lt;/b&gt; Uitleg.&lt;/li&gt;
&lt;li&gt;&lt;b&gt;Tweede stap.&lt;/b&gt; Uitleg.&lt;/li&gt;
&lt;/ol&gt;</pre>

    <h3>Callouts</h3>
    <pre>&lt;div class="call info"&gt;&lt;div class="ct"&gt;&lt;span&gt;&amp;#9670;&lt;/span&gt; Titel&lt;/div&gt;&lt;p&gt;Tekst.&lt;/p&gt;&lt;/div&gt;</pre>
    <ul>
      <li><code>call info</code> - context/toelichting</li>
      <li><code>call warn</code> - let op</li>
      <li><code>call caution</code> - waarschuwing/risico</li>
      <li><code>call ok</code> - positief/geslaagd</li>
    </ul>

    <h3>Diagram (optioneel)</h3>
    <pre>\`\`\`mermaid
flowchart LR
    A[Start] --&gt; B[Einde]
\`\`\`</pre>

    <h3>Besluiten (optioneel)</h3>
    <pre>| ADR | Besluit | Status |
|---|---|---|
| **ADR-0001 — Titel** | Beschrijving. | &lt;span class="badge b-ok"&gt;Accepted&lt;/span&gt; |</pre>

    <h3>Checklist voor je publiceert</h3>
    <ul>
      <li>Echte <code>##</code>/<code>###</code> koppen, geen vetgedrukte pseudo-koppen</li>
      <li>Stappenlijst? Gebruik <code>ol.phases</code>, niet een gewone genummerde lijst</li>
      <li>Belangrijke tip/waarschuwing/bevinding? Gebruik een callout</li>
      <li>Meerstaps-proces waar een plaatje het verduidelijkt? Overweeg een Mermaid-diagram</li>
      <li>Sluit af met Bronnen (en Besluiten, indien van toepassing)</li>
    </ul>
  </div>
</details>`;
}

function renderDraftEditor(slug, content) {
  const body = `<div class="wrap">
  <h1>Concept beoordelen</h1>
  <p class="lede"><code>${escapeHtml(slug)}.md</code> &mdash; ruwe Markdown incl. frontmatter. Wijzig wat nodig is en publiceer zodra het klaar is.</p>
  <div id="styleWarning" class="style-warning" hidden></div>
  <textarea id="editor">${escapeHtml(content)}</textarea>
  <div class="editor-actions">
    <button id="btnSave">Opslaan (blijft concept)</button>
    <button id="btnPublish">Publiceren</button>
    <button id="btnAiFormat" type="button" disabled title="Nog niet actief - vereist een eigen Anthropic API-key. Zie AGENTS.md.">Opmaken volgens huisstijl (AI) - binnenkort</button>
    <button id="btnDelete" type="button">Verwijderen</button>
  </div>
  <div id="editorMsg"></div>
  ${renderCheatsheet()}
</div>
<script>
  const slug = ${JSON.stringify(slug)};
  const editor = document.getElementById("editor");
  const msg = document.getElementById("editorMsg");
  const styleWarning = document.getElementById("styleWarning");

  function setMsg(state, text) {
    msg.className = state;
    msg.textContent = text;
  }

  // Lichte, deterministische check op vaste kenmerken van ruwe Word-conversie
  // die de huisstijl nooit gebruikt - geen vervanging voor menselijke review,
  // wel een vangnet tegen per ongeluk ongeformatteerd publiceren.
  function checkHouseStyleIssues(content) {
    const body = content.replace(/^---[\\s\\S]*?---/, ""); // frontmatter overslaan
    const issues = [];
    if (/^#{1,6}\\s*\\*\\*.+\\*\\*\\s*$/m.test(body)) {
      issues.push("Er staat nog een kop die volledig vetgedrukt is (bv. \\"# **Titel**\\") - gebruik een gewone kop zonder vet.");
    }
    if (body.trim().length > 400 && !/^#{2,3}\\s/m.test(body)) {
      issues.push("Geen enkele ## of ###-kop gevonden in een langere tekst - de pagina krijgt dan geen inhoudsopgave.");
    }
    if (/^\\*\\s{2,}\\S/m.test(body)) {
      issues.push("Er staan nog bullets met \\"*\\" in plaats van \\"-\\" (Word-conversie-restant).");
    }
    return issues;
  }

  function renderStyleWarning() {
    const issues = checkHouseStyleIssues(editor.value);
    if (issues.length === 0) {
      styleWarning.hidden = true;
      return issues;
    }
    styleWarning.hidden = false;
    styleWarning.innerHTML =
      "<b>Lijkt nog niet opgemaakt volgens de huisstijl:</b><ul>" +
      issues.map((i) => "<li>" + i + "</li>").join("") +
      "</ul>";
    return issues;
  }

  renderStyleWarning();
  let debounceTimer;
  editor.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderStyleWarning, 400);
  });

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Onbekende fout");
    return data;
  }

  document.getElementById("btnSave").addEventListener("click", async () => {
    try {
      await post("/drafts/save", { slug, content: editor.value });
      setMsg("ok", "Opgeslagen (blijft concept).");
    } catch (err) {
      setMsg("err", "Mislukt: " + err.message);
    }
  });

  document.getElementById("btnPublish").addEventListener("click", async () => {
    const issues = renderStyleWarning();
    if (issues.length > 0) {
      const proceed = confirm(
        "Deze pagina lijkt nog niet volledig opgemaakt volgens de huisstijl:\\n\\n- " +
          issues.join("\\n- ") +
          "\\n\\nToch publiceren zonder deze punten aan te passen?",
      );
      if (!proceed) return;
    }
    try {
      await post("/drafts/save", { slug, content: editor.value });
      await post("/drafts/publish", { slug });
      window.location.href = "/drafts";
    } catch (err) {
      setMsg("err", "Mislukt: " + err.message);
    }
  });

  document.getElementById("btnDelete").addEventListener("click", async () => {
    if (!confirm("Dit concept definitief verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    try {
      await post("/drafts/delete", { slug });
      window.location.href = "/drafts";
    } catch (err) {
      setMsg("err", "Mislukt: " + err.message);
    }
  });
</script>`;
  return pageShell("Concept beoordelen", "drafts", body);
}

function renderClientsList() {
  const clients = getClients();
  const rows = clients.length
    ? clients
        .map(
          (c) => `<div class="draft-row">
    <div class="meta">
      <div class="title">${escapeHtml(c.title)}</div>
      <div class="sub">${escapeHtml(c.description)} &middot; <code>${escapeHtml(c.id)}.md</code></div>
    </div>
    <a class="editbtn" href="/klanten/edit?slug=${encodeURIComponent(c.id)}">Bewerken &rarr;</a>
  </div>`,
        )
        .join("")
    : `<p class="empty-state">Nog geen klanten. Maak er hierboven een aan.</p>`;

  const body = `<div class="wrap">
  <h1>Klanten</h1>
  <p class="lede">Klantpagina's in <code>src/content/clients/</code>. Een nieuwe klant staat meteen beschikbaar in de klant-lijst bij het uploaden van een document.</p>

  <form id="newClientForm" class="new-draft-box">
    <div class="field">
      <label for="newTitle">Nieuwe klant - naam</label>
      <input type="text" id="newTitle" placeholder="Naam van de klant" required>
    </div>
    <div class="field">
      <label for="newDescription">Korte omschrijving</label>
      <input type="text" id="newDescription" placeholder="Een zin die samenvat wie/wat dit is">
    </div>
    <button type="submit">Klant aanmaken</button>
  </form>

  ${rows}
</div>
<script>
  document.getElementById("newClientForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("newTitle").value.trim();
    const description = document.getElementById("newDescription").value.trim();
    if (!title) return;
    const res = await fetch("/klanten/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      alert(
        "Klant aangemaakt. Wachtwoord voor het publieke inlogscherm (GitHub Pages) van deze klant:\\n\\n" +
          data.passphrase +
          "\\n\\nNoteer dit ergens - het wordt niet nogmaals getoond (alleen de hash staat in het bestand)."
      );
      window.location.href = "/klanten/edit?slug=" + encodeURIComponent(data.slug);
    } else {
      alert("Mislukt: " + (data.error || "Onbekende fout"));
    }
  });
</script>`;
  return pageShell("Klanten", "klanten", body);
}

function renderClientEditor(slug, content) {
  const body = `<div class="wrap">
  <h1>Klant bewerken</h1>
  <p class="lede"><code>${escapeHtml(slug)}.md</code> &mdash; ruwe Markdown incl. frontmatter (<code>facts</code>, <code>gatePassphraseHash</code>, ...).</p>
  <textarea id="editor">${escapeHtml(content)}</textarea>
  <div class="editor-actions">
    <button id="btnSave">Opslaan</button>
    <button id="btnDelete" type="button">Verwijderen</button>
  </div>
  <div id="editorMsg"></div>
</div>
<script>
  const slug = ${JSON.stringify(slug)};
  const editor = document.getElementById("editor");
  const msg = document.getElementById("editorMsg");

  function setMsg(state, text) {
    msg.className = state;
    msg.textContent = text;
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Onbekende fout");
    return data;
  }

  document.getElementById("btnSave").addEventListener("click", async () => {
    try {
      await post("/klanten/save", { slug, content: editor.value });
      setMsg("ok", "Opgeslagen.");
    } catch (err) {
      setMsg("err", "Mislukt: " + err.message);
    }
  });

  document.getElementById("btnDelete").addEventListener("click", async () => {
    if (!confirm("Deze klant en de pagina definitief verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    try {
      await post("/klanten/delete", { slug });
      window.location.href = "/klanten";
    } catch (err) {
      setMsg("err", "Mislukt: " + err.message);
    }
  });
</script>`;
  return pageShell("Klant bewerken", "klanten", body);
}

async function handleImport(req, res) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES * 1.4) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Bestand te groot (max 25MB)." }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Ongeldige aanvraag." }));
    return;
  }

  const { title, description, category, clients = [], fileBase64, filename = "" } = payload;
  if (!title?.trim() || !description?.trim() || !category || !fileBase64) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Titel, beschrijving, categorie en bestand zijn verplicht." }));
    return;
  }
  if (!CATEGORIES.includes(category)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Onbekende categorie." }));
    return;
  }
  const ext = path.extname(filename).toLowerCase();
  if (![".docx", ".md", ".markdown"].includes(ext)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Alleen .docx- of .md-bestanden worden ondersteund." }));
    return;
  }

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const { markdown, warnings } =
      ext === ".docx" ? await convertDocxToMarkdown(buffer) : convertMarkdownUpload(buffer);

    const slug = uniqueSlug(slugify(title), WIKI_DIR);
    const order = nextOrder(category);
    const frontmatter = {
      title: title.trim(),
      description: description.trim(),
      category,
      order,
      clients: Array.isArray(clients) ? clients : [],
      draft: true,
    };

    const file = matter.stringify(`\n${markdown}\n`, frontmatter);
    if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });
    const outPath = path.join(WIKI_DIR, `${slug}.md`);
    fs.writeFileSync(outPath, file, "utf-8");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        path: path.relative(ROOT, outPath),
        warnings: warnings.map((w) => w.message),
      }),
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

async function readJsonBody(req, res, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Aanvraag te groot." }));
      req.destroy();
      return null;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Ongeldige aanvraag." }));
    return null;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleDraftNew(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;
  const { title, category } = payload;
  if (!title?.trim()) return sendJson(res, 400, { ok: false, error: "Titel is verplicht." });
  if (!CATEGORIES.includes(category)) {
    return sendJson(res, 400, { ok: false, error: "Onbekende categorie." });
  }

  const slug = uniqueSlug(slugify(title), WIKI_DIR);
  const order = nextOrder(category);
  const frontmatter = {
    title: title.trim(),
    description: "TODO: een zin die samenvat waar dit artikel over gaat.",
    category,
    order,
    clients: [],
    draft: true,
  };
  const file = matter.stringify(`\n${HOUSE_STYLE_TEMPLATE_BODY}`, frontmatter);
  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });
  fs.writeFileSync(path.join(WIKI_DIR, `${slug}.md`), file, "utf-8");
  sendJson(res, 200, { ok: true, slug });
}

async function handleDraftSave(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;
  const { slug, content } = payload;
  const filePath = draftFilePath(slug);
  if (!filePath) return sendJson(res, 404, { ok: false, error: "Concept niet gevonden." });
  if (typeof content !== "string" || !content.trim()) {
    return sendJson(res, 400, { ok: false, error: "Lege inhoud." });
  }
  let parsed;
  try {
    parsed = matter(content);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: "Frontmatter kan niet worden gelezen: " + err.message });
  }
  const { title, description, category } = parsed.data ?? {};
  if (!title || !description || !category) {
    return sendJson(res, 400, {
      ok: false,
      error: "title, description en category zijn verplicht in de frontmatter.",
    });
  }
  if (!CATEGORIES.includes(category)) {
    return sendJson(res, 400, { ok: false, error: `Onbekende categorie "${category}".` });
  }
  fs.writeFileSync(filePath, content, "utf-8");
  sendJson(res, 200, { ok: true });
}

async function handleDraftPublish(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;
  const filePath = draftFilePath(payload.slug);
  if (!filePath) return sendJson(res, 404, { ok: false, error: "Concept niet gevonden." });
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  parsed.data.draft = false;
  fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
  sendJson(res, 200, { ok: true });
}

async function handleDraftDelete(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;
  const filePath = draftFilePath(payload.slug);
  if (!filePath) return sendJson(res, 404, { ok: false, error: "Concept niet gevonden." });
  fs.unlinkSync(filePath);
  sendJson(res, 200, { ok: true });
}

async function handleClientNew(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;
  const { title, description = "" } = payload;
  if (!title?.trim()) return sendJson(res, 400, { ok: false, error: "Naam is verplicht." });

  const slug = uniqueSlug(slugify(title), CLIENTS_DIR);
  const order = nextClientOrder();
  const passphrase = generatePassphrase();
  const frontmatter = {
    title: title.trim(),
    description: description.trim(),
    facts: [],
    order,
    gatePassphraseHash: sha256Hex(passphrase),
  };
  const body = `\n## Omgeving\n\nTODO: beschrijf de omgeving van deze klant.\n`;
  // Comment met de plaintext-passphrase direct achter de hash plakken (net als
  // bij de handmatig aangemaakte klanten), niet ergens los in de body - anders
  // is hij bij het lezen van het bestand niet te vinden.
  const file = matter
    .stringify(body, frontmatter)
    .replace(
      /^(gatePassphraseHash: .+)$/m,
      `$1 # "${passphrase}"`,
    );
  if (!fs.existsSync(CLIENTS_DIR)) fs.mkdirSync(CLIENTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(CLIENTS_DIR, `${slug}.md`), file, "utf-8");
  sendJson(res, 200, { ok: true, slug, passphrase });
}

async function handleClientSave(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;
  const { slug, content } = payload;
  const filePath = clientFilePath(slug);
  if (!filePath) return sendJson(res, 404, { ok: false, error: "Klant niet gevonden." });
  if (typeof content !== "string" || !content.trim()) {
    return sendJson(res, 400, { ok: false, error: "Lege inhoud." });
  }
  try {
    const parsed = matter(content);
    if (!parsed.data?.title) {
      return sendJson(res, 400, { ok: false, error: "title is verplicht in de frontmatter." });
    }
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: "Frontmatter kan niet worden gelezen: " + err.message });
  }
  fs.writeFileSync(filePath, content, "utf-8");
  sendJson(res, 200, { ok: true });
}

async function handleClientDelete(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;
  const filePath = clientFilePath(payload.slug);
  if (!filePath) return sendJson(res, 404, { ok: false, error: "Klant niet gevonden." });
  fs.unlinkSync(filePath);
  sendJson(res, 200, { ok: true });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderForm());
    return;
  }
  if (req.method === "POST" && url.pathname === "/import") {
    handleImport(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/drafts") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderDraftsList());
    return;
  }
  if (req.method === "GET" && url.pathname === "/drafts/edit") {
    const slug = url.searchParams.get("slug") ?? "";
    const filePath = draftFilePath(slug);
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Concept niet gevonden.");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderDraftEditor(slug, fs.readFileSync(filePath, "utf-8")));
    return;
  }
  if (req.method === "POST" && url.pathname === "/drafts/new") return handleDraftNew(req, res);
  if (req.method === "POST" && url.pathname === "/drafts/save") return handleDraftSave(req, res);
  if (req.method === "POST" && url.pathname === "/drafts/publish") return handleDraftPublish(req, res);
  if (req.method === "POST" && url.pathname === "/drafts/delete") return handleDraftDelete(req, res);

  if (req.method === "GET" && url.pathname === "/klanten") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderClientsList());
    return;
  }
  if (req.method === "GET" && url.pathname === "/klanten/edit") {
    const slug = url.searchParams.get("slug") ?? "";
    const filePath = clientFilePath(slug);
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Klant niet gevonden.");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderClientEditor(slug, fs.readFileSync(filePath, "utf-8")));
    return;
  }
  if (req.method === "POST" && url.pathname === "/klanten/new") return handleClientNew(req, res);
  if (req.method === "POST" && url.pathname === "/klanten/save") return handleClientSave(req, res);
  if (req.method === "POST" && url.pathname === "/klanten/delete") return handleClientDelete(req, res);

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// Alleen op localhost bereikbaar: dit endpoint heeft geen login en kan
// bestanden in de repo schrijven/verwijderen, dus niet aan het netwerk
// blootstellen (Node bindt anders standaard aan alle interfaces).
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nDesite-beheer klaar op http://localhost:${PORT}\nOpen dit adres in je browser. Ctrl+C om te stoppen.\n`);
});
