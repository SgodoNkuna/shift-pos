# Handoff: where the build stopped

Moved from a cloud session to a local machine on 23 Nov 2026.

## Read these first
- Design (approved): `docs/superpowers/specs/2026-11-23-shift-pos-design.md`
- Build plan (13 tasks): `docs/superpowers/plans/2026-11-23-shift-pos.md`
- Clickable prototype (open in a browser): `prototype/shift-pos-walkthrough.html`
- Explainer video for the boss and manager: `video/shift-app-explainer.mp4`
- R295 discrepancy report: `reports/28-nov-day-shift-discrepancy.pdf`

## Progress
| Task | Status |
|---|---|
| 1. Scaffold (Vite + React + TS + Tailwind + Vitest) | Done |
| 2. Domain types and number helpers | Done, 21 tests |
| 3. Shift calculations, flags, lock rules | Done, 27 tests |
| 4. Local store (Dexie) and outbox | **In progress.** Failing tests are written in `app/src/data/actions.test.ts`. Next: implement `app/src/data/db.ts`, `actions.ts` and `outbox.ts` until they pass. |
| 5–13 | Not started |

Note: the app uses React 19 (the plan says 18; 19 is fine).

## Still needed from the owner
- An empty private GitHub repo to push to (`shift-pos`)
- Supabase project: decide which organization (Task 10)
- Cloudflare API token with "Cloudflare Pages: Edit" (Task 13)

## Start the local session with
> Read HANDOFF.md, the design and the plan. Continue the Shift POS build from Task 4 using superpowers:executing-plans. Run `npm test` in `app/` first.
