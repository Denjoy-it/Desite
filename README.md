# Desite

Interne kennisbank + klantendatabase voor Microsoft cloud-beheer (Azure,
Microsoft 365, Entra ID, PowerShell, Defender, enz.), opgebouwd als een
Astro-site met drie secties:

- **Wiki** (`src/content/wiki/`) - universele naslagpagina's per
  productcategorie, permanent zijmenu, geen datum.
- **Klanten** (`src/content/clients/`) - interne naslag per klant: tenant-info,
  contactpersonen, afspraken en omgevingsinrichting. **Geen wachtwoorden of
  andere geheimen** - die horen in een wachtwoordmanager, niet hier. Zie
  "Klant-koppeling" hieronder voor hoe wiki-pagina's en klanten samenhangen,
  en "Klanten afschermen" voor het cosmetische inlogscherm op de publieke build.
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
| `npm run beheer` | Lokale beheertool op `localhost:4555`: documenten uploaden, concepten publiceren, klanten aanmaken/bewerken - zie "Desite-beheer" hieronder |

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

## Desite-beheer

`npm run beheer` start een lokale beheertool (`scripts/beheer.mjs`) op
`localhost:4555` - werkt alleen op je eigen machine (bindt expliciet aan
127.0.0.1), **bewust geen login**: wie dit script kan starten heeft toch al
volledige bestandstoegang tot de repo. Eén tool, één poort, voor drie dingen:
documenten uploaden, concepten beoordelen/publiceren, en klanten
aanmaken/bewerken.

### Documenten uploaden

Vul titel, beschrijving, categorie en eventuele klant(en) in en upload een
`.docx` **of `.md`** (klikken of slepen op de knop); de conversie (mammoth
&rarr; turndown, met een fix voor Word-tabellen) draait meteen op de
achtergrond, met een statusbalk die live bijhoudt of hij bezig is, gelukt of
mislukt. Het resultaat komt als concept (`draft: true`) in
`src/content/wiki/` te staan.

Een `.md`-bestand wordt niet geconverteerd - het is al Markdown, dus alleen
de inhoud wordt overgenomen. Heeft het bestand zelf ook frontmatter, dan
wordt die genegeerd: de frontmatter van het concept komt altijd uit het
formulier, niet uit het geüploade bestand.

De klant-checkboxes in dit formulier worden bij elke paginalaad vers van
schijf gelezen - een klant die je net via het "Klanten"-tabblad hebt
aangemaakt staat er dus meteen bij, zonder de tool te herstarten.

### Concepten beoordelen

**Review-wachtrij** (`/drafts`, met een badge-teller in de navigatie): lijst
van alle concepten met een "Beoordelen"-link naar een ruwe Markdown-editor
(frontmatter + inhoud). Daar kun je **opslaan** (blijft concept), **publiceren**
(zet `draft: false`, verschijnt live) of **verwijderen**.

Vanaf `/drafts` kun je ook een **nieuw concept starten vanuit het
huisstijl-sjabloon** (titel + categorie, geen upload nodig), en de editor
heeft een inklapbaar **huisstijl-spiekbriefje** (koppen, `ol.phases`,
callouts, Mermaid) met een verwijzing naar `azure-bastion-toegang.md` als
volledig voorbeeld - puur als hulpmiddel bij handmatig opmaken, geen
automatische opmaak. Een knop **"Opmaken volgens huisstijl (AI)"** staat
klaar maar uitgeschakeld: die zou de conversie naar Claude sturen om te
herstructureren, maar vereist een eigen Anthropic API-key en brengt kosten
per document met zich mee.

**Consistente opmaak bij upload:** de Word-conversie normaliseert bullets
naar `-` (in plaats van turndown's default `*`) en zet een volledig
vetgedrukte kop (`# **Titel**`, een vast Word-conversie-artefact) automatisch
om naar een gewone kop. Daarnaast checkt de editor bij elke wijziging en
vóór publiceren op zulke restanten van ruwe Word-opmaak (geen koppen in een
langere tekst, nog `*`-bullets, een vetgedrukte kop) en toont dan een
waarschuwing; "Publiceren" vraagt in dat geval een expliciete bevestiging.
Geen harde blokkade en geen vervanging voor menselijke review - wel een
vangnet tegen per ongeluk ongeformatteerd publiceren.

### Klanten beheren

`/klanten` (in dezelfde tool - niet te verwarren met de publieke
`/klanten/*` op de site zelf) toont alle klanten met een mini-formulier om
een nieuwe klant aan te maken: alleen naam + korte omschrijving nodig.
Aanmaken genereert automatisch een eigen wachtwoord voor het publieke
KlantGate-inlogscherm (zie "Klanten afschermen" hieronder) en toont dat
wachtwoord één keer in een pop-up - noteer het, daarna staat alleen de hash
nog in het bestand. Klikken op een klant opent dezelfde ruwe Markdown-editor
als bij concepten, waar je `facts`, de omgevingsbeschrijving of andere
velden aanpast.

### Automatisch starten

`scripts/start-windows.bat` en `scripts/start-mac.command` starten zowel
`npm run dev` (de website) als `npm run beheer` (upload/klanten-tool), elk in
een eigen venster, vanuit de juiste projectmap - ongeacht van waar je ze
aanklikt. Dubbelklikken is genoeg. Voor automatisch starten bij het
opstarten/inloggen van je machine:

- **Windows**: `Win + R` &rarr; `shell:startup` &rarr; zet er een
  snelkoppeling naar `start-windows.bat` in.
- **Mac**: Systeeminstellingen &rarr; Algemeen &rarr; Inlogitems &rarr; "+"
  &rarr; kies `scripts/start-mac.command`.

`start-mac.command` staat al als uitvoerbaar bestand in git; mocht dat niet
meekomen, zet `chmod +x scripts/start-mac.command` het recht.

Tijdens `npm run dev` staat er een link "Beheer" in de footer van de site
(alleen zichtbaar in dev, via `import.meta.env.DEV`) die naar deze tool
wijst.

## Klanten afschermen

`/klanten/*` op de publieke, statisch gehoste GitHub Pages-build mag niet
zomaar voor iedereen zichtbaar zijn. GitHub Pages is statische hosting - er
is geen server die per request kan controleren wie er mag kijken. Daarom
staat er op de publieke build een simpel, **nadrukkelijk
niet-echt-beveiligend** inlogscherm (`src/components/KlantGate.astro`,
automatisch actief op elke `/klanten/*` pagina via `ClientLayout.astro`):

- **Per klant een eigen wachtwoord**: `gatePassphraseHash` in de frontmatter
  van `src/content/clients/<slug>.md`. Zo kan klant A's contactpersoon niet
  ook klant B's pagina of artikelen ontgrendelen. Daarnaast is er één
  QUBE-brede masterpassphrase (`MASTER_PASSPHRASE_HASH` in
  `KlantGate.astro`, standaard `qube-klanten-2026`) die alles ontgrendelt -
  handig voor eigen gebruik/demo's. Beide zijn hashes; wijzigen kan door de
  hash te herberekenen (instructie in de comments bovenin `KlantGate.astro`)
  en te vervangen. De klantenlijst zelf (`/klanten/`) toont alle klanten
  tegelijk en accepteert daarom alleen de masterpassphrase, geen losse
  klant-passphrase.
- Gecontroleerd client-side via `crypto.subtle.digest`, onthouden per browser
  via `localStorage` - dus geen echte sessie, geen serverside check.
- **De klantpagina staat gewoon volledig in de HTML-bron**, ook terwijl hij
  "op slot" is - `view-source` of het handmatig zetten van de
  `localStorage`-vlag omzeilt dit scherm meteen. Er staat daarom een
  permanente disclaimer op het scherm zelf, en de pagina's krijgen
  `noindex` (blijven uit Google én uit de Pagefind-zoekindex).

Gebruik dit scherm dus alleen als drempel tegen toevallige bezoekers, niet
als bescherming voor echt gevoelige gegevens - zolang er geen serverside
authenticatie live staat, geen persoonsgegevens of vertrouwelijke informatie
via de publieke site delen die niet ook toevallig gevonden mag worden.

**Let op:** de wachtwoorden zelf staan als leesbare comment naast hun hash
in de broncode (in `KlantGate.astro` en in elk klant-bestand) - dat is alleen
zinvol als deze GitHub-repo **privé** staat. Is de repo public, dan is elke
passphrase net zo makkelijk uit de repo te lezen als uit de gebouwde site.

Dit scherm zit niet alleen op `/klanten/*`: elke wiki- of blogpagina met een
niet-lege `clients: [...]` in de frontmatter (zie "Klant-koppeling"
hierboven) gaat er automatisch ook achter - anders zou een klant-specifiek
wiki-artikel gewoon volledig publiek blijven staan terwijl de bijbehorende
klantpagina wel is afgeschermd. Alleen de paginainhoud zelf wordt verborgen;
de titel blijft (net als bij de klantenlijst) zichtbaar in overzichten zoals
het wiki-zijmenu en de categorielijst.

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
├── beheer.mjs                  - lokale beheertool: upload + concepten + klanten (npm run beheer)
├── start-windows.bat            - dubbelklik-snelkoppeling voor npm run beheer (Windows)
└── start-mac.command             - idem voor macOS (ook geschikt als Inlogitem)
public/
└── wiki/<slug>/                - afbeeldingen bij wiki-pagina's (zie hierboven)
src/
├── content.config.ts        - categorie-enum + Zod-schema's voor blog/wiki/clients
├── content/
│   ├── blog/                  - .md/.mdx blogposts (uit nav/zoeken gehouden)
│   ├── wiki/                  - .md/.mdx universele naslagpagina's
│   └── clients/                - .md/.mdx per-klant naslag (incl. gatePassphraseHash)
├── layouts/
│   ├── BaseLayout.astro        - head, header, footer, toTop
│   ├── ArticleLayout.astro     - blog: hero-kop/facts-strip/genummerde secties/PDF-knop
│   ├── WikiLayout.astro        - wiki: permanent categorie-zijmenu + content
│   └── ClientLayout.astro      - klanten: permanent klantenlijst-zijmenu + content + KlantGate
├── components/                 - Header (incl. wiki-dropdown), Footer, Callout,
│                                  Badge, Fact(Row), ArticleListRow, SearchBox,
│                                  ToTop, WikiSidebar, ClientSidebar, MermaidInit,
│                                  ExportPdfButton, KlantGate, icons/MsServiceIcon
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

De site staat live op GitHub Pages via `.github/workflows/astro.yml` (bouwt
en deployt automatisch bij een push naar `main`). Zie "Klanten afschermen"
hierboven voor hoe `/klanten/*` daar (cosmetisch) wordt afgeschermd - dat is
op dit moment de enige toegangscontrole op de publieke deploy.

Zodra er een Azure-abonnement beschikbaar is, is de logische vervolgstap een
deploy naar Azure Static Web Apps met Entra ID-authenticatie ("Easy Auth"),
zodat `/klanten/*` echt serverside afgeschermd wordt en inloggen met een
M365-account mogelijk is - dat vervangt dan het cosmetische scherm door
echte toegangsbeveiliging.
