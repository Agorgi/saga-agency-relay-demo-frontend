import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  formatReleaseCandidateReport,
  getReleaseCandidateSummary,
  releaseCandidateTag,
} from "@/lib/releaseCandidate/releaseCandidate";

function git(args: string) {
  try {
    return execSync(`git ${args}`, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const summary = await getReleaseCandidateSummary();
  const report = formatReleaseCandidateReport({
    summary,
    git: {
      commit: git("rev-parse HEAD"),
      branch: git("branch --show-current"),
      tag: releaseCandidateTag,
    },
  });

  if (process.env.RC_REPORT_WRITE === "true") {
    const outputPath = join(
      process.cwd(),
      "reports",
      "release-candidate-v0.1-report.md",
    );
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${report}\n`, "utf8");
    console.log(`Wrote redacted release candidate report: ${outputPath}`);
    return;
  }

  console.log(report);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Release candidate report failed: ${message}`);
  process.exitCode = 1;
});
