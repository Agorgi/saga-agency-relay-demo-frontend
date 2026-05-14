# PR-B Audit — Dependency Consolidation

**Date:** 2026-05-14  
**Branch:** `feature/web-chat/pr-b-deps-consolidation`  
**Result:** PASS

## Scope

PR-B consolidates the relay-demo frontend and imported `sms-engine/` dependency requirements into a single root `package.json` so `npm install` at the repo root works end-to-end. As part of that consolidation, relay-demo is upgraded from Next 15 to Next 16, Tailwind 3 to Tailwind 4, and the root toolchain is adjusted so lint, build, and local runtime verification all continue to pass without installing from `sms-engine/package.json`.

## Pinned versions

Resolved versions from `npm ls --depth=0`:

| Package | Resolved version | Notes |
| --- | --- | --- |
| `@emnapi/core` | `1.9.2` | extraneous |
| `@emnapi/runtime` | `1.9.2` | extraneous |
| `@emnapi/wasi-threads` | `1.2.1` | extraneous |
| `@napi-rs/wasm-runtime` | `0.2.12` | extraneous |
| `@prisma/client` | `6.19.3` | expected |
| `@tailwindcss/postcss` | `4.3.0` | prompt requested `^4`; tool resolved latest compatible 4.x |
| `@tybys/wasm-util` | `0.10.1` | extraneous |
| `@types/node` | `22.19.17` | expected 22.x |
| `@types/react-dom` | `19.2.3` | codemod bumped from prompt baseline |
| `@types/react` | `19.2.14` | codemod bumped from prompt baseline |
| `autoprefixer` | `10.5.0` | preserved from relay-demo |
| `clsx` | `2.1.1` | expected |
| `dotenv` | `17.4.2` | expected |
| `eslint-config-next` | `16.2.6` | codemod bumped from `16.2.4` |
| `eslint` | `9.39.4` | expected 9.x |
| `framer-motion` | `11.18.2` | preserved from relay-demo |
| `lucide-react` | `1.16.0` | resolved above sms-engine’s requested `^1.14.0` |
| `next` | `16.2.6` | codemod bumped from `16.2.4` |
| `openai` | `6.37.0` | resolved above prompt baseline `^6.36.0` |
| `postcss` | `8.5.14` | preserved from relay-demo |
| `prisma` | `6.19.3` | expected |
| `react-dom` | `19.2.6` | codemod bumped from `19.2.4` |
| `react` | `19.2.6` | codemod bumped from `19.2.4` |
| `tailwindcss` | `4.3.0` | tool resolved latest compatible 4.x |
| `tsconfig-paths` | `4.2.0` | expected |
| `tsx` | `4.21.0` | expected |
| `twilio` | `6.0.2` | resolved above prompt baseline `^6.0.0` |
| `typescript` | `5.9.3` | expected within requested `^5.7.0` |
| `vercel` | `51.8.0` | preserved from relay-demo |
| `zod` | `4.4.3` | expected |
| `zustand` | `5.0.12` | preserved from relay-demo |

Notable deviations from the prompt’s requested manifest:

- `next`, `react`, `react-dom`, and `eslint-config-next` landed on `16.2.6` / `19.2.6` after the official Next 16 codemod upgraded them together.
- `@types/react` and `@types/react-dom` were bumped by the codemod and paired with root `overrides`.
- Tailwind 4 resolved to `4.3.0` after install/upgrade.
- A small set of `extraneous` WASM helper packages still appears in `npm ls --depth=0` after a clean reinstall. They do not block lint, build, or runtime verification.

## Changes by file

- `package.json`
  - full rewrite for consolidated root dependencies
  - diff stats: `+23 -8`
- `package-lock.json`
  - regenerated for consolidated install
  - diff stats: `+1893 -724`
- `sms-engine/package.json` → `sms-engine/package.json.original`
  - rename only, no content change
- `sms-engine/package-lock.json` → `sms-engine/package-lock.json.original`
  - rename only, no content change
- `postcss.config.js`
  - updated to use `@tailwindcss/postcss`
  - diff stats: `+1 -1`
- `tailwind.config.ts`
  - still present after the Tailwind 4 upgrade
  - not modified by the tool
- `src/app/globals.css`
  - Tailwind 4 migration output plus CSS import ordering cleanup
  - diff stats: `+146 -121`
- `eslint.config.mjs`
  - updated flat config for Next 16 root linting, `sms-engine/**` ignore, and React Compiler-era rule compatibility
  - diff stats: `+12 -13`
- `next.config.js`
  - removed deprecated `eslint` block (unsupported in Next 16)
  - diff stats: `+0 -3`
- `tsconfig.json`
  - Next 16 updated JSX mode and `.next` type includes
  - preserved `sms-engine` exclusion from PR-A
  - diff stats: `+28 -6`
- Other files touched by the Tailwind upgrade tool:
  - `src/components/FocusInfoCard.tsx`
  - `src/components/FocusOverlay.tsx`
  - `src/components/HeroTrendingCluster.tsx`
  - `src/components/ImageTile.tsx`
  - `src/components/MyEventsView.tsx`
  - `src/components/PostComposerModal.tsx`
  - `src/components/ProjectBriefBuilderView.tsx`
  - `src/components/ProjectTalentDiscoveryView.tsx`
  - `src/components/PublicTicketCard.tsx`
  - `src/components/RelatedRail.tsx`
  - `src/components/SearchPill.tsx`
  - `src/components/SelectionTray.tsx`
  - `src/components/TalentReviewCanvas.tsx`
  - `src/components/TicketCheckoutView.tsx`
  - `src/components/TransitionLayer.tsx`

## Verification

- `npm install`: PASS
  - warnings:
    - `EBADENGINE` for `@renovatebot/pep440`
    - `EBADENGINE` for `eslint-visitor-keys`
    - deprecated `scmp`
    - deprecated `tar`
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run dev` on `:3000`: PASS
  - homepage HTML contained `Saga`
- Existing relay-demo routes returned `200`:
  - `/`
  - `/explore`
  - `/feed`
  - `/my-events`
  - `/post-project`
  - `/profile`
  - `/projects`
  - `/relay`
  - `/talent`
  - `/projects/court-of-stars-fan-gala`
  - `/projects/court-of-stars-fan-gala/discover`
  - `/events/court-of-stars`
  - `/events/court-of-stars/apply`
  - `/events/court-of-stars/tickets`
  - `/talent/jill-bottcher`
- `sms-engine/node_modules/` exists? `No`
- Secret-pattern sweep:
  - `AC[0-9a-f]{32}`: `0`
  - `sk-[a-zA-Z0-9]{20,}`: `0`

## What is intentionally deferred to later PRs

- `sms-engine` scripts (`test:*`, `prisma:*`, `db:*`, `jobs:*`, `observability:*`, `launch:*`, `command-center:*`, `beta:*`, `release:*`, `web-research:*`, `public-web:*`, `matching:*`) remain unlifted — PR-C
- root Prisma block and any root `postinstall: prisma generate` behavior remain deferred — PR-C
- lifting code out of `sms-engine/src/` and `sms-engine/scripts/` remains deferred — PR-C
- wiring the engine into relay-demo routes and product flow remains deferred — PR-F

## Anything that didn't go to plan

- The Tailwind 4 upgrade tool could not run until `npm install` was re-run after the root `package.json` rewrite, because `node_modules` still contained Tailwind 3 from the previous install.
- The Tailwind upgrade tool attempted to modify files under `sms-engine/`; those changes were reverted immediately to keep the imported subtree untouched.
- The official Next 16 codemod upgraded some pinned versions beyond the prompt’s requested `16.2.4` / `19.2.4` values and added root `overrides` for React type packages. Those codemod-managed versions were kept rather than forcing them back down manually.
- `next lint` is no longer a valid root lint command under this upgraded Next 16 setup, so the root `lint` script was changed to `eslint .`.
- The Tailwind tool did not fully update the existing root `postcss.config.js`, so the plugin key was switched manually from `tailwindcss` to `@tailwindcss/postcss`.
- Next 16 no longer accepts the `eslint` key in `next.config.js`, so that block was removed.
- `npm ls --depth=0` still reports a handful of `extraneous` WASM helper packages after a clean reinstall. They appear to be harmless toolchain residue and do not block install, lint, build, or runtime checks.
