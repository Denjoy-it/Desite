import { visit } from "unist-util-visit";

// CSS `overflow` heeft geen effect op een <table>-element zelf (de UA
// negeert het op de table-box) - vandaar de wrapper-div, met dezelfde
// .tbl-styling als de handgeschreven tabellen in de QUBE-huisstijl.
export default function rehypeWrapTables() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "table" && parent && index !== null) {
        parent.children[index] = {
          type: "element",
          tagName: "div",
          properties: { className: ["tbl"] },
          children: [node],
        };
      }
    });
  };
}
