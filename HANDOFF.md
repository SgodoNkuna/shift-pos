# Handoff: where the build stopped

Code lives at https://github.com/SgodoNkuna/shift-pos (private). Moved from a cloud session on 23 Nov 2026.

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
| 4. Local store (Dexie) and outbox | Done, 8 tests |
| 5. Shell + PIN | PIN hashing/lockout done (5 tests); screens not started |
| 6–9 | Not started (till, stock, clock out, report) |
| 10. Supabase | Schema, roles and RLS **applied** to project `qnlndzxlgfcoieqnpnfh` (eu-central-1). 29/29 role tests pass (`supabase/tests/rls_test.sql`), security advisor 0 warnings. Still to do: sync client, invite edge function. |
| 11–13 | Not started |

Run SQL against the project with `python3 scripts/sbsql.py <file.sql>` (cloud session: the token is injected by the network proxy). Keep Supabase's GitHub "Deploy to production" **off**; migrations are applied with `--migrate <name>` and the file names match the versions Supabase recorded.

Note: the app uses React 19 (the plan says 18; 19 is fine).

## Still needed from the owner
- Supabase: done. Separate account/org; project `qnlndzxlgfcoieqnpnfh`, URL https://qnlndzxlgfcoieqnpnfh.supabase.co
- Cloudflare: token saved on the cloud environment and verified (Task 13)

## Start the local session with
> Read HANDOFF.md, the design and the plan. Continue the Shift POS build from Task 4 using superpowers:executing-plans. Run `npm test` in `app/` first.
