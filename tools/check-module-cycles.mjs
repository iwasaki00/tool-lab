import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve(process.argv[2] ?? "06_3D空間実験室/src");
const files = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.name.endsWith(".ts")) files.push(target);
  }
}

visit(sourceRoot);
const known = new Set(files);
const graph = new Map();
const importPattern = /(?:from\s+|import\s*\()["'](\.[^"']+)["']/g;

for (const file of files) {
  const dependencies = [];
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const base = path.resolve(path.dirname(file), match[1]);
    const resolved = [`${base}.ts`, path.join(base, "index.ts")].find((candidate) => known.has(candidate));
    if (resolved) dependencies.push(resolved);
  }
  graph.set(file, dependencies);
}

const visited = new Set();
const active = new Set();
const cycles = new Set();

function inspect(file, route) {
  if (active.has(file)) {
    const start = route.indexOf(file);
    const cycle = route.slice(start).concat(file).map((item) => path.relative(sourceRoot, item).replaceAll("\\", "/"));
    cycles.add(cycle.join(" -> "));
    return;
  }
  if (visited.has(file)) return;
  visited.add(file);
  active.add(file);
  for (const dependency of graph.get(file) ?? []) inspect(dependency, route.concat(dependency));
  active.delete(file);
}

for (const file of files) inspect(file, [file]);
console.log(`TypeScript modules: ${files.length}`);
console.log(`Circular dependencies: ${cycles.size}`);
for (const cycle of cycles) console.log(cycle);
if (cycles.size) process.exitCode = 1;
