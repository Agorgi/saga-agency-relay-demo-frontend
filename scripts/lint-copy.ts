import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app", "src/components"];
const COPY_ATTR = /data-copy-lint="(header|subhead)"/;
const ELEMENT_PATTERN =
  /data-copy-lint="(header|subhead)"[\s\S]*?>([\s\S]*?)<\/(?:h1|h2|p|div|span)>/g;

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return walk(fullPath);
    }
    return fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

function countWords(value: string) {
  const cleaned = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]+\}/g, " ")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g)?.length ?? 0;
}

const files = ROOTS.flatMap((root) => walk(root));
const failures: string[] = [];
let checked = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (!COPY_ATTR.test(source)) {
    continue;
  }

  for (const match of source.matchAll(ELEMENT_PATTERN)) {
    const [, kind, content] = match;
    const words = countWords(content);
    checked += 1;
    if (words > 5) {
      failures.push(`${file} ${kind} "${content.trim()}" (${words} words)`);
    }
  }
}

if (failures.length) {
  console.error("Copy lint failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Copy lint passed: ${checked} headers checked.`);
