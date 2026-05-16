import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PUBLIC_TICKETING_COPY,
  shouldShowPublicBackstagePanel,
} from "@/lib/publicEventPresentation";

test("legacy top-nav aliases exist so /for-me and /discover do not 404", () => {
  assert.equal(
    fs.existsSync(path.join(process.cwd(), "src/app/for-me/page.tsx")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(process.cwd(), "src/app/discover/page.tsx")),
    true,
  );
});

test("public event presentation hides backstage data and keeps ticketing external", () => {
  assert.equal(shouldShowPublicBackstagePanel(), false);
  assert.doesNotMatch(PUBLIC_TICKETING_COPY.eventCta, /get tickets/i);
  assert.match(PUBLIC_TICKETING_COPY.sidebarHelper, /outside Sagasan/i);
  assert.match(PUBLIC_TICKETING_COPY.checkoutHelper, /demo ticket tiers/i);
});
