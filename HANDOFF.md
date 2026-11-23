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
| 5. Shell + PIN | Done: first-run setup, PIN sign-in, People (add staff, unlock), menu |
| 6. Till | Done: basket, cash/card/split, change, undo last sale; 3-tap cash sale |
| 7. Stock + expenses | Done: clock in, stock in, stock out request (lead approves on the spot with PIN), expenses |
| 8. Clock out | Done: count with one-tap ✓, card slip, cash, both PINs, lock rules in plain words |
| 9. Report | Done: paper-style screen, PDF + XLSX (loaded only when sending), WhatsApp share text |

End-to-end: `npm run build && npx vite preview --port 4173` then `npm run e2e -- http://localhost:4173 <shots dir>` plays a whole shift (17 steps).

| 10. Supabase | Done. Schema, roles, RLS, server-checked PINs (41/41 role tests, `supabase/tests/rls_test.sql`). Sign-ups closed. Products + first opening seeded. `redeem-invite` edge function deployed. Sync engine (outbox send rules, pull, realtime). Live two-phone test: `app/e2e/live.e2e.cjs` (creates test staff via SQL first; clean up after). |
| 11. Alerts | Done. `claim_due_notifications` (12/12 timing tests, `supabase/tests/alerts_test.sql`), trigger on stock out + pg_cron every minute → `notify` edge function (web push, VAPID; private key only in function secrets). Phone: `public/sw.js`, manifest + icons, Turn-on-alerts card, test alert. Live-tested with stand-in endpoints (headless browsers cannot hold real push subscriptions): `app/e2e/alerts.e2e.cjs`. |
| 12. Boss screens | Done: overview; Settings (boss: float, stock-out reasons, alert minutes, multi-seller shown locked); Products & prices (leads; price history in `prices`; boss cost prices in `product_costs`); boss-only profit on the report screen (never in the shared files). Opening count corrections at clock in, flagged on the report. Browser test: `app/e2e/boss.e2e.cjs` |
| 13. Deploy | **Live at https://shift-pos.pages.dev.** GitHub Action `.github/workflows/deploy.yml` tests, builds and deploys on every push to main (repo secret `CLOUDFLARE_API_TOKEN`). Don't deploy with wrangler from the cloud session: the proxy rewrites the upload token. |

Run SQL against the project with `python3 scripts/sbsql.py <file.sql>` (cloud session: the token is injected by the network proxy). Keep Supabase's GitHub "Deploy to production" **off**; migrations are applied with `--migrate <name>` and the file names match the versions Supabase recorded.

Note: the app uses React 19 (the plan says 18; 19 is fine).

## Staff
Boss Ta Vuyo, manager Rori, employee Wisani Nkuna (phones in the `staff` table, not in git). First invites sent 24 Nov, valid 7 days; new ones from Menu → People.

## Still needed from the owner
- Supabase: done. Separate account/org; project `qnlndzxlgfcoieqnpnfh`, URL https://qnlndzxlgfcoieqnpnfh.supabase.co
- Cloudflare: token saved on the cloud environment and verified (Task 13)

## Start the local session with
> Read HANDOFF.md, the design and the plan. Continue the Shift POS build from Task 4 using superpowers:executing-plans. Run `npm test` in `app/` first.
