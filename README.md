# Saga — Visual Talent Discovery Demo

A warm-toned investor demo that merges Saga's creative talent matching engine with Spiral's spatial discovery UX.

## What It Does

The demo lets a user:

- describe an event or project idea in natural language
- watch Saga analyze the brief and detect likely production roles
- explore a pannable canvas of matching creative talent
- focus on individual creators to inspect fit, clients, skills, and style
- select similar creators and go deeper into a tighter taste pocket
- assemble a team role-by-role
- launch a project page with the selected crew

## Stack

- Next.js 15
- React 19 + TypeScript
- Tailwind CSS
- Framer Motion
- Zustand

## Data Notes

- The demo uses the real curated creator source from the original Saga app
- The source file currently contains `50` creator profiles and `6` sample events/projects
- Creator imagery is seeded through `picsum.photos` for demo purposes

## Run It

```bash
npm install
npm run demo
```

Open [http://localhost:3000](http://localhost:3000).

For a production-style local run:

```bash
npm run demo:prod
```

## Key Files

- `src/data/talentData.ts` — creator model, role detection, matching, deepening, project generation
- `src/store/useAppStore.ts` — merged app state machine
- `src/components/FloatingResultsCanvas.tsx` — pannable talent canvas
- `src/components/FocusOverlay.tsx` — creator focus mode
- `src/components/AssemblyView.tsx` — team assembly board
- `src/components/ProjectDetailView.tsx` — launched project page

## Sagasan QA

Run the Sagasan verification sweep with:

```bash
npm run test:sagasan-agent
npm run test:sagasan-model-preflight
npm run lint
npm run typecheck
npm run build
npm run lint:copy
```

Useful docs:

- `docs/sagasan-agent-readiness-v2.md`
- `docs/sagasan-voice-guide.md`
- `docs/sagasan-eval-suite.md`
- `docs/sagasan-runtime-modes.md`
- `docs/sagasan-handoff-schema.md`
- `docs/sagasan-responses-api-migration-plan.md`

## Sagasan Internal Dogfood

Internal testing docs:

- `docs/sagasan-internal-dogfood-v3.md`
- `docs/sagasan-dogfood-test-script.md`
- `docs/sagasan-dogfood-feedback-form.md`
- `docs/sagasan-dogfood-scoring-rubric.md`
- `docs/sagasan-dogfood-issue-log-template.md`
- `docs/sagasan-internal-tester-instructions.md`
