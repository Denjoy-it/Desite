import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  // @astrojs/rss resolveert "link" alleen tegen "site", niet tegen het
  // geconfigureerde base-pad - dat moeten we er zelf voor plakken.
  const base = import.meta.env.BASE_URL.replace(new RegExp("/?$"), "/"); // garandeer trailing slash
  return rss({
    title: "Desite - blog",
    description: "Chronologische aantekeningen en updates over Microsoft cloud-beheer.",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `${base}blog/${post.id}/`,
    })),
  });
}
