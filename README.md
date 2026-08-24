# Desite

Interne kennisbank + klantendatabase voor Microsoft cloud-beheer (Azure,
Microsoft 365, Entra ID, PowerShell, Defender, enz.), opgebouwd als een
Astro-site met drie secties:

- **Wiki** (`src/content/wiki/`) - universele naslagpagina's per
  productcategorie, permanent zijmenu, geen datum.
- **Klanten** (`src/content/clients/`) - interne naslag per klant: tenant-info,
  contactpersonen, afspraken en omgevingsinrichting. **Geen wachtwoorden of
  andere geheimen** - die horen in een wachtwoordmanager, niet hier. Zie
  "Klant-koppeling" hieronder voor hoe wiki-pagina's en klanten samenhangen.
- **Blog** (`src/content/blog/`) - chronologische aantekeningen/updates.
  Bewust uit de hoofdnavigatie en zoekresultaten gehouden (zie
  `noIndex`/`data-pagefind-ignore` in `ArticleLayout.astro`); de content
  blijft gewoon bestaan en bouwt mee onder `/blog/`.

De vormgeving is overgenomen uit de QUBE-huisstijl: platte vormen, oranje/navy
accent, IBM Plex + Familjen Grotesk (zelf gehost, zie `public/fonts/`).

**Deze site draait bewust alleen lokaal** (nog niet gedeployed) zolang er
klant-vertrouwelijke info in staat en er geen toegangsbeveiliging is geregeld.
Overweeg dat serieus voor je hem ooit publiek hosted.

## Commando's

| Commando | Werking |
| --- | --- |
| `npm run dev` | Lokale dev-server op `localhost:4321` |
| `npm run build` | Bouwt de statische site naar `dist/` (bouwt ook de zoekindex) |
| `npx pagefind --site dist` | Alleen nodig als je de index handmatig wil herbouwen zonder volledige build |
| `npm run preview` | Bekijk de build lokaal, inclusief werkende zoekfunctie |
| `npm run import-docx` | Lokale tool op `localhost:4555` om een Word-document (.docx) om te zetten naar een concept-wiki-pagina - zie "Word-document importeren" hieronder |

**Let op:** zoeken werkt alleen na `npm run build` + `npm run preview` (of een
echte deploy). Pagefind indexeert de gebouwde HTML; in `npm run dev` zonder
voorafgaande build levert de zoekbalk geen resultaten op. Dit is geen bug.

## Een nieuwe pagina toevoegen

Maak een `.md`- of `.mdx`-bestand aan in `src/content/blog/` of
`src/content/wiki/`, met frontmatter bovenaan:

**Blog** (`src/content/blog/mijn-post.md`):

```yaml
---
title: "Titel van de post"
description: "Een zin die samenvat waar de post over gaat."
date: 2026-08-17
category: "Azure"
# draft: true   # optioneel, laat de post uit /blog/ en de zoekindex
---
```

**Wiki** (`src/content/wiki/mijn-pagina.md`):

```yaml
---
title: "Titel van de pagina"
description: "Een zin die samenvat waar de pagina over gaat."
category: "Azure"
# order: 1              # optioneel, bepaalt volgorde binnen de categorie (laag = eerst)
# clients: ["landschappen"]   # optioneel, zie "Klant-koppeling" hieronder
# draft: true            # optioneel, verbergt de pagina overal (nav/categorie/klant/zoeken)
---
```

De toegestane categorieën staan in `src/content.config.ts` (export
`CATEGORIES`). Nieuwe categorie nodig? Voeg hem daar toe aan de lijst - de
volgorde in die lijst bepaalt de volgorde van de categorie-groepen in de
wiki-navigatie.

**Klanten** (`src/content/clients/mijn-klant.md`):

```yaml
---
title: "Naam van de klant"
description: "Een zin die samenvat wie/wat dit is."
order: 1
facts:
  - label: "Subscription"
    value: "..."
    mono: true          # optioneel, mono-lettertype voor technische waarden
  - label: "Contactpersoon"
    value: "..."
---
```

De bestandsnaam (zonder extensie) is de klant-**slug**, bijvoorbeeld
`landschappen.md` -> slug `landschappen`, pagina op `/klanten/landschappen/`.
`facts` wordt als een facts-strip boven de pagina getoond (zelfde component
als de wiki/blog-headers).

### Klant-koppeling

Een wiki- of blogpagina kan met `clients: ["slug1", "slug2"]` naar een of
meer klanten verwijzen (de slug, niet de weergavenaam). Dat levert op:

- Op de wiki-pagina zelf verschijnt een klikbaar "Klant"-label.
- Op de klantpagina verschijnt onder "Categorieën voor deze klant" een tegel
  per categorie met het aantal gekoppelde wiki-pagina's; klikken opent een
  klant-gefilterde categorielijst
  (`/klanten/<slug>/categorie/<categorie>/`, alleen die pagina's, niet de
  volledige wiki-categorie). Blogposts verschijnen apart onder "Gerelateerde
  blogposts". Dit is allemaal afgeleid uit `clients` - je hoeft dit niet los
  bij te houden op de klantpagina zelf.

Universele content (niet aan een specifieke klant gebonden) laat je `clients`
gewoon weg.

## Word-document importeren

`npm run import-docx` start een lokale tool (`scripts/import-docx.mjs`) op
`localhost:4555` - werkt alleen op je eigen machine (bindt expliciet aan
127.0.0.1, geen login), geen server/deploy-impact. Vul titel, beschrijving,
categorie en eventuele klant(en) in en upload een `.docx` (klikken of slepen
op de knop); de conversie (mammoth &rarr; turndown, met een fix voor
Word-tabellen) draait meteen op de achtergrond, met een statusbalk die live
bijhoudt of hij bezig is, gelukt of mislukt. Het resultaat komt als concept
(`draft: true`) in `src/content/wiki/` te staan.

**Review-wachtrij** (`/drafts`, met een badge-teller in de navigatie): lijst
van alle concepten met een "Beoordelen"-link naar een ruwe Markdown-editor
(frontmatter + inhoud). Daar kun je **opslaan** (blijft concept), **publiceren**
(zet `draft: false`, verschijnt live) of **verwijderen**. Bewust geen login -
dit draait alleen lokaal en wie de repo kan bewerken had toch al volledige
bestandstoegang. Gaat de site ooit live voor mensen zonder repo-toegang,
vervang dit tooltje dan door een git-based CMS (Decap CMS/Keystatic) in
plaats van er een login aan toe te voegen.

Tijdens `npm run dev` staat er een link "Word-document importeren" in de
footer van de site (alleen zichtbaar in dev, via `import.meta.env.DEV`) die
naar deze tool wijst.

## Artikel exporteren naar PDF

Elk wiki-artikel en elke blogpost heeft een "Exporteer naar PDF"-knop
(`src/components/ExportPdfButton.astro`), die de browser-printdialoog opent
(`window.print()`, met "Opslaan als PDF" als optie). Geen aparte PDF-generator
nodig - de `@media print`-stylesheet in `global.css` verbergt de site-chrome
(zijmenu, footer, de knop zelf) en toont alleen de artikelinhoud.

## Opmaak binnen een pagina

Gewone markdown werkt overal: koppen, tabellen, lijsten, `code`, afbeeldingen.
Daarnaast:

- **Genummerde procedure-stappen**: schrijf ruwe HTML met de class
  `ol.phases` (zie `src/content/wiki/entra-id-groepen-vs-rollen.md` voor een
  voorbeeld) - werkt in zowel `.md` als `.mdx`.
- **Callout-boxen** (`.mdx` only): importeer het component en gebruik het als
  JSX-tag:

  ```mdx
  import Callout from "../../components/Callout.astro";

  <Callout kind="warn" title="Let op">
  Tekst van de waarschuwing.
  </Callout>
  ```

  `kind` is een van `warn` / `info` / `caution` / `ok`. In gewone `.md` kan
  hetzelfde effect met ruwe HTML: `<div class="call warn">...</div>`.

- **Afbeeldingen**: zet het bestand in `public/wiki/<slug>/` en verwijs ernaar
  met een pad vanaf de root, bijv. `/wiki/mfa-authenticator/01-prompt.png`
  (zie `src/content/wiki/gebruikers-instructie-mfa-authenticator.md` voor een
  voorbeeld met `<figure>`/`<figcaption>`). `article img` in `global.css`
  zorgt voor een consistent kader; gebruik bij voorkeur officiële
  bron-screenshots (met bronvermelding) boven willekeurige plaatjes van
  internet.

- **Flowcharts/diagrammen**: een gewoon Mermaid-codeblok, werkt in zowel
  `.md` als `.mdx`:

  ````
  ```mermaid
  flowchart LR
      A[Start] --> B[Einde]
  ```
  ````

  Rendert client-side (zelf gehoste `mermaid.js`, geen CDN) via
  `src/components/MermaidInit.astro`. Standaard-node is wit met een navy
  rand, afgeronde hoeken en een zachte schaduw - zoals de handgetekende
  QUBE-diagrammen. Voor de kleur-states (oranje = kern/wijziging, rood =
  geblokkeerd/fout, groen = geslaagd, lichtblauw = context) plak je dit
  blok bovenaan het diagram en pas je `class` toe op de betreffende nodes:

  ````
  ```mermaid
  flowchart LR
      classDef qHighlight fill:#fff7f0,stroke:#ee7214,stroke-width:2px,color:#161a20
      classDef qBlocked fill:#fdf1f1,stroke:#e11d48,stroke-width:2px,stroke-dasharray:5 3,color:#7a1a1a
      classDef qSuccess fill:#f0f9f2,stroke:#16a34a,stroke-width:2px,color:#14532d
      classDef qInfo fill:#eef3fc,stroke:#03295a,stroke-width:2px,color:#161a20

      A[Normale stap] --> B[Kern-instelling]
      B --> C[Geblokkeerd]
      B --> D[Geslaagd]
      class B qHighlight
      class C qBlocked
      class D qSuccess
  ```
  ````

## Projectstructuur

```text
scripts/
└── import-docx.mjs            - lokale Word-import-tool (npm run import-docx)
public/
└── wiki/<slug>/                - afbeeldingen bij wiki-pagina's (zie hierboven)
src/
├── content.config.ts        - categorie-enum + Zod-schema's voor blog/wiki/clients
├── content/
│   ├── blog/                  - .md/.mdx blogposts (uit nav/zoeken gehouden)
│   ├── wiki/                  - .md/.mdx universele naslagpagina's
│   └── clients/                - .md/.mdx per-klant naslag
├── layouts/
│   ├── BaseLayout.astro        - head, header, footer, toTop
│   ├── ArticleLayout.astro     - blog: hero-kop/facts-strip/genummerde secties/PDF-knop
│   ├── WikiLayout.astro        - wiki: permanent categorie-zijmenu + content
│   └── ClientLayout.astro      - klanten: permanent klantenlijst-zijmenu + content
├── components/                 - Header (incl. wiki-dropdown), Footer, Callout,
│                                  Badge, Fact(Row), ArticleListRow, SearchBox,
│                                  ToTop, WikiSidebar, ClientSidebar, MermaidInit,
│                                  ExportPdfButton, icons/MsServiceIcon
├── styles/
│   ├── tokens.css              - kleuren/fonts/root-variabelen
│   ├── fonts.css                - zelf gehoste @font-face-declaraties
│   └── global.css               - componenten (tabellen, callouts, badges, print-CSS, ...)
├── lib/
│   ├── format.ts                 - datumformattering (nl-NL)
│   ├── slug.ts                    - categorie -> URL-slug
│   ├── wiki-nav.ts                 - wiki-paginas gegroepeerd per categorie
│   ├── client-nav.ts                - klantenlijst + gerelateerde wiki/blog-content
│   └── rehype-*.mjs                  - tabellen auto-wrappen, blog-secties nummeren
└── pages/
    ├── index.astro, 404.astro, rss.xml.js
    ├── blog/index.astro, blog/[slug].astro
    ├── wiki/index.astro, wiki/[slug].astro, wiki/categorie/[category]/index.astro
    └── klanten/index.astro, klanten/[slug].astro,
        klanten/[slug]/categorie/[category]/index.astro  - klant-gefilterde categorielijst
```

## Hosting

Nog niet bepaald. De build is standaard static output (`dist/`) en niet aan
een host gebonden - werkt op GitHub Pages, Netlify, Vercel of een eigen
server zodra dat gekozen is.
