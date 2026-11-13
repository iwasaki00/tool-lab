import { readdir, readFile, writeFile } from "node:fs/promises";
const ignored = new Set([
  "node_modules",
  "dist",
  ".git",
  "test-results",
  "playwright-report",
]);
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else if (
      /\.(?:tsx?|css|json|mjs|md|html|webmanifest)$/.test(path) ||
      [".gitignore", ".gitattributes"].includes(entry.name)
    ) {
      const text = await readFile(path, "utf8");
      await writeFile(path, text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"));
    }
  }
}
await walk(".");
