import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps literal text, including explicit spaces, inside native text components", () => {
  const violations: string[] = [];
  const textComponents = new Set(["Text", "Label", "Heading", "LocalizedText", "TranslatedText"]);
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!file.endsWith(".tsx") || file.endsWith(".test.tsx")) continue;
      const tree = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        if (ts.isJsxElement(node) && !textComponents.has(node.openingElement.tagName.getText(tree))) {
          for (const child of node.children) {
            // JSX formatting whitespace is discarded, but {" "} is a real native text node.
            const literal = ts.isJsxText(child) ? !!child.text.trim()
              : ts.isJsxExpression(child) && !!child.expression &&
                (ts.isStringLiteral(child.expression) || ts.isNumericLiteral(child.expression));
            if (literal) {
              const { line } = tree.getLineAndCharacterOfPosition(child.getStart(tree));
              violations.push(`${file}:${line + 1}: text under ${node.openingElement.tagName.getText(tree)}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
  }
  scan(resolve(process.cwd(), "src"));
  expect(violations).toEqual([]);
});
