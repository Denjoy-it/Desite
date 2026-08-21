import { toText } from "hast-util-to-text";

// Groepeert de content per h2 in genummerde <section>-blokken, zoals de
// hoofdstukstructuur uit de QUBE-huisstijl (.snum boven elke h2). Content
// voor de eerste h2 (de inleiding) blijft ongegroepeerd, direct onder de
// paginakop.
//
// Alleen voor de blog: die behoudt de "oplevering"-achtige lay-out (hero-kop,
// genummerde secties). De wiki oogt bewust als een gewone kennisbank-pagina
// zonder nummering - vandaar de check op het bronpad.
export default function rehypeNumberSections() {
  return (tree, file) => {
    const path = file?.path ?? file?.history?.[0] ?? "";
    if (!/[\\/]content[\\/]blog[\\/]/.test(path)) return;

    const children = tree.children;
    const firstH2 = children.findIndex(
      (n) => n.type === "element" && n.tagName === "h2",
    );
    if (firstH2 === -1) return;

    const intro = children.slice(0, firstH2);
    const rest = children.slice(firstH2);

    const sections = [];
    let current = null;
    let num = 0;

    for (const node of rest) {
      if (node.type === "element" && node.tagName === "h2") {
        num += 1;
        const label = String(num).padStart(2, "0");
        const title = toText(node).toUpperCase();
        current = {
          type: "element",
          tagName: "section",
          properties: { className: ["reveal"] },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: { className: ["snum"] },
              children: [{ type: "text", value: `${label} — ${title}` }],
            },
            node,
          ],
        };
        sections.push(current);
      } else if (current) {
        current.children.push(node);
      } else {
        intro.push(node);
      }
    }

    tree.children = [...intro, ...sections];
  };
}
