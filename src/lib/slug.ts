const DIACRITICS = /[̀-ͯ]/g;

export function slugifyCategory(category: string): string {
  return category
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}
