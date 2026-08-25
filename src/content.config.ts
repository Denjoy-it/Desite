import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Vaste categorie-lijst, gericht op Microsoft cloud-beheer (Azure/M365/enz.).
// Volgorde bepaalt de volgorde van de categorie-groepen in de wiki-navigatie.
// Uitbreiden doe je hier - beide collections gebruiken dezelfde lijst.
export const CATEGORIES = [
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
] as const;

export const categoryEnum = z.enum(CATEGORIES);

// Klanten hebben geen vaste lijst zoals categorieen - die groeit organisch.
// Een wiki/blog-pagina verwijst naar een klant via diens slug (de bestandsnaam
// in src/content/clients/, zonder extensie), niet via de weergavenaam.
const factSchema = z.object({
  label: z.string(),
  value: z.string(),
  mono: z.boolean().optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: categoryEnum,
    draft: z.boolean().default(false),
    clients: z.array(z.string()).default([]),
  }),
});

const wiki = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/wiki" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: categoryEnum,
    order: z.number().default(0),
    clients: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const clients = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/clients" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    facts: z.array(factSchema).default([]),
    order: z.number().default(0),
    // Wachtwoord (als SHA-256-hash) voor het cosmetische inlogscherm op de
    // publieke GitHub Pages-build (zie src/components/KlantGate.astro). Elke
    // klant heeft zijn eigen wachtwoord, zodat klant A niet automatisch ook
    // klant B's artikelen kan zien. Er is daarnaast één QUBE-brede
    // masterpassphrase die alles ontgrendelt (zie KlantGate.astro).
    gatePassphraseHash: z.string().optional(),
  }),
});

export const collections = { blog, wiki, clients };
