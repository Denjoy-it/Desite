// @ts-check
import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import { unified } from "@astrojs/markdown-remark";
import rehypeWrapTables from "./src/lib/rehype-wrap-tables.mjs";
import rehypeNumberSections from "./src/lib/rehype-number-sections.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://denjoy-it.github.io",
  base: "/Desite",
  integrations: [mdx(), pagefind()],
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      // Mermaid-codeblokken ongemoeid laten zodat de client-side mermaid.js
      // de ruwe diagram-tekst kan uitlezen (zie ArticleLayout-script).
      excludeLangs: ["mermaid"],
    },
    processor: unified({ rehypePlugins: [rehypeWrapTables, rehypeNumberSections] }),
  },
});
