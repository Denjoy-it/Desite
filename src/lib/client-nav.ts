import { getCollection, type CollectionEntry } from "astro:content";
import { CATEGORIES } from "../content.config";

export type ClientEntry = CollectionEntry<"clients">;
export type WikiEntry = CollectionEntry<"wiki">;

export async function getAllClients(): Promise<ClientEntry[]> {
  const clients = await getCollection("clients");
  return clients.sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
  );
}

export async function getRelatedWikiPages(clientId: string) {
  const wiki = await getCollection("wiki", ({ data }) => data.clients.includes(clientId));
  return wiki.sort((a, b) => a.data.title.localeCompare(b.data.title));
}

/** Wiki-paginas van een klant, gegroepeerd per categorie - zelfde volgorde/indeling als de wiki zelf. */
export async function getRelatedWikiByCategory(
  clientId: string,
): Promise<Map<string, WikiEntry[]>> {
  const pages = await getRelatedWikiPages(clientId);
  const byCategory = new Map<string, WikiEntry[]>();
  for (const cat of CATEGORIES) byCategory.set(cat, []);
  for (const entry of pages) byCategory.get(entry.data.category)?.push(entry);
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
  }
  return byCategory;
}

export async function getRelatedBlogPosts(clientId: string) {
  const posts = await getCollection(
    "blog",
    ({ data }) => data.clients.includes(clientId) && !data.draft,
  );
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
