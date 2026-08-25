## Windows / macOS via OneDrive

This project lives in a OneDrive-synced folder shared between a Windows PC and a
MacBook. OneDrive syncs `node_modules/`, `dist/` and `.astro/` as plain files even
though they're gitignored — but these contain platform-specific binaries
(e.g. esbuild, fsevents, pagefind, npm's `.bin` shims), so a `node_modules`
installed on one OS will not work on the other (missing `.cmd`/`.ps1` shims on
Windows, broken/empty native binaries, etc.).

**Whenever you switch machines**, before running `npm run dev`:

```
rm -rf node_modules dist .astro
npm install
```

There is a single `package-lock.json` for both platforms — npm resolves the
correct platform-specific optional dependencies from it automatically, so
there's no need for separate per-OS lockfiles.

## Desite-beheer (upload, concepten, klanten)

`npm run beheer` start `scripts/beheer.mjs` op http://localhost:4555 - één
lokale tool, één poort, voor alles wat je normaal met de repo zelf zou
doen: documenten uploaden, concepten beoordelen/publiceren, en klanten
aanmaken/bewerken. Bindt expliciet aan 127.0.0.1 (alleen je eigen machine),
**bewust geen login** - wie dit script kan starten heeft toch al volledige
bestandstoegang tot de repo. Geen server/deploy-impact: dit is geen
onderdeel van de Astro-build, alleen een los Node-hulpmiddel. Zie
"Automatisch starten" hieronder voor een snelkoppeling op Windows/Mac.

**Uploaden** (`/`): vul titel, beschrijving, categorie en eventuele klant(en)
in, upload dan een .docx **of .md** via de upload-knop (klikken of slepen) -
de conversie start meteen op de achtergrond, met een statusbalk onderin die
live bijhoudt of hij bezig is, gelukt of mislukt. Het resultaat komt als
concept (`draft: true`) in `src/content/wiki/` te staan. Concepten
verschijnen nergens in de navigatie/zoekresultaten totdat je ze publiceert.
De klant-checkboxes in dit formulier worden bij elke paginalaad vers van
schijf gelezen (`getClients()`, geen caching) - een klant die je net via
"Klanten" hebt aangemaakt staat er dus meteen bij, zonder de tool te
herstarten.

Een `.md`-upload wordt niet geconverteerd (het is al Markdown) - alleen de
inhoud wordt overgenomen. Een eigen frontmatter in het geüploade bestand
wordt genegeerd; de frontmatter van het concept komt altijd uit het
formulier (titel/beschrijving/categorie/klant(en)/`draft: true`), niet uit
het bestand zelf. `convertMarkdownUpload` in `scripts/beheer.mjs` doet dit
(via `gray-matter` om eventuele frontmatter eraf te knippen).

**Review-wachtrij** (`/drafts`): overzicht van alle concepten, met een
badge-teller in de navigatie. Klik "Beoordelen" voor een ruwe Markdown-editor
per concept (frontmatter + inhoud in één tekstveld):

- **Opslaan** - schrijft de wijziging weg, blijft concept.
- **Publiceren** - slaat op en zet `draft: false`; verdwijnt daarna uit de
  wachtrij en verschijnt live op de site.
- **Verwijderen** - verwijdert het conceptbestand definitief (met bevestiging).

**Nieuw concept starten** (knop bovenaan `/drafts`): begint een artikel vanuit
het huisstijl-sjabloon (titel + categorie invullen, de rest is skelet) in
plaats van vanuit een Word-upload - handig voor artikelen die je direct in de
tool wil schrijven. In de editor staat ook een **huisstijl-spiekbriefje**
(inklapbaar): syntax voor koppen, `ol.phases`-stappen, callouts en een
Mermaid-diagram, met een verwijzing naar `azure-bastion-toegang.md` als
volledig uitgewerkt voorbeeld. Dit is bewust *geen* automatische opmaak - het
maakt handmatig consistent opmaken alleen sneller.

De docx&rarr;markdown-conversie (`convertDocxToMarkdown` in
`scripts/beheer.mjs`) normaliseert twee dingen automatisch, zodat elke
upload al dichter bij de huisstijl start: bullets komen er als `-` uit (niet
turndown's default `*`), en een kop die volledig vetgedrukt is (het vaste
Word-conversie-artefact `# **Titel**`) wordt automatisch `# Titel`. Dit lost
niet alles op - callouts, `ol.phases` en kopstructuur van "gewone alinea's
die eruitzien als een kop" blijven mensenwerk.

Om te voorkomen dat een concept per ongeluk ongeformatteerd gepubliceerd
wordt (gebeurde eerder met een geïmporteerd artikel), draait de editor bij
elke wijziging en vóór publiceren een lichte, deterministische check
(`checkHouseStyleIssues` in `renderDraftEditor`) op vaste kenmerken van ruwe
Word-conversie: een volledig vetgedrukte kop, een langere tekst zonder enige
`##`/`###`-kop, of nog `*`-bullets. Bij een treffer verschijnt een
waarschuwingsbalk, en "Publiceren" vraagt een expliciete bevestiging met de
gevonden punten erbij. Dit is geen harde blokkade (soms is er bewust geen
`##`-kop nodig) en geen vervanging voor menselijke review - wel een vangnet
tegen precies de fout die hierboven beschreven staat.

De knop **"Opmaken volgens huisstijl (AI)"** staat in de editor maar is nog
uitgeschakeld: dat zou de ruwe conversie naar Claude sturen om te
herstructureren naar de huisstijl, voordat een mens 'm beoordeelt. Vereist een
eigen Anthropic API-key en brengt kleine kosten per document met zich mee -
bewust nog niet aangezet totdat daarvoor gekozen wordt.

Er is bewust geen login: dit draait alleen lokaal, en wie de repo kan
bewerken kon het bestand toch al rechtstreeks aanpassen. Zodra de site ooit
live gaat voor mensen zonder repo-toegang, is een git-based CMS (bijv. Decap
CMS of Keystatic) de logische vervanger van deze wachtrij - niet dit
eigen-bouw-tooltje uitbreiden met een login.

**Klanten** (`/klanten` in dezelfde tool): lijst van alle klanten
(`src/content/clients/*.md`) met een mini-formulier om een nieuwe klant aan
te maken (alleen naam + korte omschrijving nodig). Aanmaken genereert
automatisch een eigen `gatePassphraseHash` (zie hieronder) en toont de
bijbehorende plaintext-passphrase één keer in een alert - noteer die, hij
staat verder alleen als hash in het bestand. Klikken op een klant opent
dezelfde ruwe Markdown-editor als bij concepten (opslaan/verwijderen) - daar
pas je `facts`, de omgevingsbeschrijving of `gatePassphraseHash` handmatig
aan.

## Automatisch starten (Windows/Mac)

`scripts/start-windows.bat` en `scripts/start-mac.command` starten zowel
`npm run dev` (de website) als `npm run beheer` (upload/klanten-tool), elk in
een eigen venster, vanuit de juiste projectmap - ongeacht van waar je ze
aanklikt. Op Windows via `start "titel" cmd /k ...` (twee losse
consolevensters); op Mac via `osascript` die twee nieuwe Terminal-vensters
opent. Dubbelklikken is genoeg voor handmatig starten. Voor automatisch
starten bij het opstarten/inloggen van je machine staat de instructie
(Startup-map op Windows via `shell:startup`, Inlogitems op macOS) als
commentaar bovenin elk script. `start-mac.command` staat in git als
uitvoerbaar bestand (`git update-index --chmod=+x`); mocht dat om wat voor
reden niet meekomen, `chmod +x scripts/start-mac.command` zet het recht.

## Klanten afschermen op de publieke build: cosmetisch GitHub Pages-scherm

Klantdocumentatie (`/klanten/*`) mag op de publieke, statisch gehoste
GitHub Pages-build niet zomaar voor iedereen zichtbaar zijn:

GitHub Pages kan geen serverside toegang afdwingen (statische hosting).
Daarom staat er op `/klanten/*` in de publieke build een **cosmetisch**
inlogscherm (`src/components/KlantGate.astro`, ingehangen via
`ClientLayout.astro`), gecheckt via `crypto.subtle.digest` in de browser en
onthouden per browser via `localStorage`. Dit is **nadrukkelijk geen
beveiliging** - de volledige pagina staat gewoon in de HTML-bron, ook
verborgen. Er staat een permanente disclaimer op het scherm zelf.

Er is niet één gedeeld wachtwoord: elke klant heeft zijn **eigen**
passphrase (`gatePassphraseHash` in de frontmatter van
`src/content/clients/<slug>.md`), plus is er één QUBE-brede
masterpassphrase (`MASTER_PASSPHRASE_HASH` in `KlantGate.astro`, standaard
`qube-klanten-2026`) die alles ontgrendelt. Zo kan klant A's contactpersoon
niet ook klant B's artikelen lezen. `KlantGate` accepteert een
`extraHashes`-prop (SHA-256-hashes) die naast de masterpassphrase ook
geldig zijn voor die specifieke pagina; `ClientLayout.astro` geeft dit door
als `gateHashes`. `/klanten/index.astro` (de klantenlijst) geeft geen
klant-hash door - die vereist dus altijd de masterpassphrase, nooit een
losse klant-passphrase, want hij toont alle klanten tegelijk. Wachtwoord
wijzigen: herbereken de hash (instructie in de comments bovenin
`KlantGate.astro`) en vervang hem in `MASTER_PASSPHRASE_HASH` of in het
klant-bestand.

Klantpagina's krijgen ook `noindex` (uit Google én uit de
Pagefind-zoekindex).

`KlantGate` accepteert ook een `active`-prop (default `true`) zodat hij
overal herbruikbaar is zonder de inhoud dubbel te hoeven schrijven. Elke
wiki- of blogpagina met een niet-lege `clients`-lijst in de frontmatter gaat
automatisch achter hetzelfde scherm (`src/pages/wiki/[slug].astro` en
`src/pages/blog/[slug].astro` zetten `active={isClientLinked}` en geven de
`gatePassphraseHash` van elke gekoppelde klant door als `extraHashes` - een
artikel met meerdere gekoppelde klanten ontgrendelt met de passphrase van
één van hen) - anders zou een klant-specifiek wiki-artikel zoals
`meerwaarde-agenda-permissies.md` gewoon volledig publiek en onbeschermd
blijven staan, ook al is de klantpagina zelf wel afgeschermd. Universele
(niet-klantgebonden) wiki-/blogpagina's blijven ongewijzigd volledig
publiek. Titels en beschrijvingen in overzichtslijsten (wiki-categorie,
zijmenu) blijven wel zichtbaar zonder in te loggen - alleen de paginainhoud
zelf is afgeschermd, net als bij `/klanten/index.astro` dat klantnamen ook
ongated toont.

**Let op:** de passphrases staan als leesbare comments naast hun hash in de
broncode (`KlantGate.astro` en elk klant-bestand) - dat is alleen zinvol als
de GitHub-repo zelf **privé** is. Staat de repo public, dan is elke
passphrase net zo goed uit de repo te lezen als uit de gebouwde site.

## Artikel exporteren naar PDF

Elk wiki-artikel en elke blogpost heeft een "Exporteer naar PDF"-knop
(`ExportPdfButton.astro`), die de browser-printdialoog opent
(`window.print()`) met "Opslaan als PDF" als optie. Er is geen aparte
PDF-generatie nodig - de print-stylesheet (`@media print` in `global.css`)
verbergt de site-chrome (header, zijmenu, footer, knop zelf) en toont alleen
de artikelinhoud.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
