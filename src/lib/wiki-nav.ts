import { getCollection, type CollectionEntry } from "astro:content";
import { CATEGORIES } from "../content.config";

export type WikiEntry = CollectionEntry<"wiki">;

export async function getWikiByCategory(): Promise<Map<string, WikiEntry[]>> {
  const pages = await getCollection("wiki", ({ data }) => !data.draft);
  const byCategory = new Map<string, WikiEntry[]>();
  for (const cat of CATEGORIES) byCategory.set(cat, []);
  for (const entry of pages) byCategory.get(entry.data.category)?.push(entry);
  for (const list of byCategory.values()) {
    list.sort(
      (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
    );
  }
  return byCategory;
}
