import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app", "src/components"];
const COPY_ATTR = /data-copy-lint="(header|subhead)"/;
const ELEMENT_PATTERN =
  /data-copy-lint="(header|subhead)"[\s\S]*?>([\s\S]*?)<\/(?:h1|h2|p|div|span)>/g;

// Sagasan reply files: chat copy that gets surfaced verbatim to
// users. The house style is em-dashes (—) for parentheticals, never
// space-hyphen-space. This list is the set of files we scan for
// regressions; add new reply-template files here as they're created.
const REPLY_FILES = [
  "src/lib/sagasanAgent.ts",
  "src/lib/sagasanOrganizerIntake.ts",
  "src/lib/sagasanSystemPrompt.ts",
  "src/lib/hostBriefHandoff.ts",
];

// Match ` - ` (space-hyphen-space) inside a single-line
// double-quoted OR template-literal string. The `[^"\n]` /
// `[^`\n]` keeps each match from crossing line boundaries
// (otherwise the greedy quote-search matches across code regions,
// producing nonsense diagnostics).
//
// Template-literal coverage was added in response to a Codex review
// finding on PR #38: several user-visible replies in the reply
// files are backtick literals with ${...} interpolation (e.g. the
// new buildFanSuccessReply variants), so omitting them would let
// regressions slip through that one rule was meant to prevent.
//
// We scan single-line template literals only — multi-line backtick
// templates exist in TS source for code/JSX snippets and HEREDOC-y
// data, and matching across newlines would create too many false
// positives. The Sagasan reply templates we care about are all
// one-liners.
const HYPHEN_IN_STRING_LITERALS = [
  /"[^"\n]* - [^"\n]*"/g,
  /`[^`\n]* - [^`\n]*`/g,
];

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

// Em-dash regression rule. Closes P2-OI-16: Cowork QA flagged
// inconsistent hyphen vs em-dash usage in Sagasan replies. The
// codebase already standardizes on em-dashes; this rule prevents
// future regressions when new reply strings get added.
for (const replyFile of REPLY_FILES) {
  let source: string;
  try {
    source = readFileSync(replyFile, "utf8");
  } catch {
    // File doesn't exist on this branch (e.g. a future split).
    // Don't fail the lint over a missing entry; just skip.
    continue;
  }

  // Strip block + line comments before matching so example copy in
  // comments doesn't trigger the rule.
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  for (const pattern of HYPHEN_IN_STRING_LITERALS) {
    for (const match of stripped.matchAll(pattern)) {
      failures.push(
        `${replyFile} reply-string uses ' - ' (space-hyphen-space). Use an em-dash (—) for parentheticals. Offending literal: ${match[0]}`,
      );
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

console.log(
  `Copy lint passed: ${checked} headers checked, ${REPLY_FILES.length} reply files scanned for hyphen regressions.`,
);
