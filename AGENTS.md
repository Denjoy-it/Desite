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
