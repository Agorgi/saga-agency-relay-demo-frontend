#!/usr/bin/env tsx
/**
 * Cleanup stale WebSession rows + their cascading WebChatMessage history.
 *
 * Defaults to **dry-run**: scans, prints what it would delete, exits 0.
 * Pass `--apply` to actually delete. The audit log records every run.
 *
 * Usage
 * -----
 *
 *   # Dry-run (default — safe to run anywhere):
 *   npm run cleanup:web-sessions
 *
 *   # Apply against staging Neon:
 *   DATABASE_URL="<neon-url>" POSTGRES_URL_NON_POOLING="<neon-direct-url>" \
 *     npm run cleanup:web-sessions -- --apply
 *
 *   # Custom TTL (default reads WEB_SESSION_TTL_DAYS env, fallback 90):
 *   npm run cleanup:web-sessions -- --ttl-days=180
 *
 * Stale = `lastSeenAt` older than TTL AND (no project OR project archived).
 * Active projects (intake / brief_ready / crew_reviewing / outreach_*)
 * are never touched. See src/lib/webSessionCleanup.ts for the full
 * rules.
 */

import { PrismaClient } from "@prisma/client";
import {
  cleanupStaleSessions,
  getConfiguredTtlDays,
} from "@/lib/webSessionCleanup";

function parseArgs(argv: string[]) {
  let apply = false;
  let ttlDays: number | undefined;
  for (const arg of argv.slice(2)) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    const ttlMatch = arg.match(/^--ttl-days=(\d+)$/);
    if (ttlMatch) {
      const parsed = Number.parseInt(ttlMatch[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) ttlDays = parsed;
      continue;
    }
  }
  return { apply, ttlDays };
}

async function main() {
  const { apply, ttlDays } = parseArgs(process.argv);
  const effectiveTtl = ttlDays ?? getConfiguredTtlDays();
  const dryRun = !apply;

  console.log(
    `web-session cleanup: ttl=${effectiveTtl}d, mode=${dryRun ? "dry-run" : "APPLY"}`,
  );

  const prisma = new PrismaClient();
  try {
    const result = await cleanupStaleSessions({
      ttlDays: effectiveTtl,
      dryRun,
      db: prisma,
    });

    console.log(
      [
        `Cutoff:       ${result.cutoff.toISOString()}`,
        `Candidates:   ${result.candidates.length}`,
        `Deleted:      ${result.deleted}${dryRun ? " (dry-run)" : ""}`,
      ].join("\n"),
    );

    if (result.candidates.length > 0) {
      console.log("\nSample of stale sessions (up to 10):");
      for (const candidate of result.candidates.slice(0, 10)) {
        const noteParts = [
          `lastSeenAt=${candidate.lastSeenAt.toISOString()}`,
          candidate.projectId
            ? `project=${candidate.projectId} (${candidate.projectJourneyStep ?? "?"})`
            : "no project",
        ];
        console.log(`  - ${candidate.id} (${noteParts.join(", ")})`);
      }
      if (result.candidates.length > 10) {
        console.log(`  ... and ${result.candidates.length - 10} more`);
      }
    }

    if (dryRun) {
      console.log(
        "\nDry-run complete. Re-run with --apply to actually delete.",
      );
    } else {
      console.log("\nCleanup applied. Audit log entry recorded.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run when invoked directly (not when imported by tests).
const invokedDirectly =
  process.argv[1] && /cleanup-web-sessions\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
