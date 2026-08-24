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

## Word-document importeren

`npm run import-docx` start een lokale tool op http://localhost:4555 (alleen op
je eigen machine, bindt expliciet aan 127.0.0.1 - geen login, dus niet aan het
netwerk blootstellen, geen server/deploy-impact). Vul titel, beschrijving,
categorie en eventuele klant(en) in, upload dan een .docx via de upload-knop
(klikken of slepen) - de conversie start meteen op de achtergrond, met een
statusbalk onderin die live bijhoudt of hij bezig is, gelukt of mislukt. Het
resultaat komt als concept (`draft: true`) in `src/content/wiki/` te staan.
Concepten verschijnen nergens in de navigatie/zoekresultaten totdat je ze
publiceert.

**Review-wachtrij** (`/drafts`): overzicht van alle concepten, met een
badge-teller in de navigatie. Klik "Beoordelen" voor een ruwe Markdown-editor
per concept (frontmatter + inhoud in één tekstveld):

- **Opslaan** - schrijft de wijziging weg, blijft concept.
- **Publiceren** - slaat op en zet `draft: false`; verdwijnt daarna uit de
  wachtrij en verschijnt live op de site.
- **Verwijderen** - verwijdert het conceptbestand definitief (met bevestiging).

Er is bewust geen login: dit draait alleen lokaal, en wie de repo kan
bewerken kon het bestand toch al rechtstreeks aanpassen. Zodra de site ooit
live gaat voor mensen zonder repo-toegang, is een git-based CMS (bijv. Decap
CMS of Keystatic) de logische vervanger van deze wachtrij - niet dit
eigen-bouw-tooltje uitbreiden met een login.

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
