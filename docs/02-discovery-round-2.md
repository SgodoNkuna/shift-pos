# Shift POS app: discovery notes, round 2

## Round 1 answers (yours)
| # | Topic | Answer |
|---|---|---|
| 1 | Who uses it | Boss, manager and employees. Several people and phones. |
| 2 | Sales method | **C**: ring up every sale **and** count at close. The app shows the difference. |
| 3 | "Out" stock | Given to the boss. The boss approves it and is notified on his side. |
| 4 | Products and prices | Manager and boss change them. No deals yet, but prices do change. |
| 5 | Card machine | Runs "0.12.15-newpos" software. NEWPOS is a maker of Android card terminals. |
| 6 | The R295 gap | Not your entry; you want it flagged. Report done: `reports/28-nov-day-shift-discrepancy.pdf` |
| 7 | Look | **B**: clean, dark "vault" style, grey and white, one accent colour, big blocky buttons |
| 8 | Power and Wi-Fi | Power cuts are rare but should be planned for. Wi-Fi is good enough for HD YouTube. |

## What changed because of these answers
- **An online backend is now required.** Several people on several phones, plus the boss approving things on his own phone, means data has to sync through a server. The phone keeps working offline and catches up when it's back online.
- **Prices must be kept by date.** When a price changes, past sales keep the price they were sold at, so old reports don't change.
- **"Out" becomes a request.** The employee logs it, the boss gets a notification and approves or rejects it, and the shift report shows each one's status.
- **Card machine.** NEWPOS terminals run Android, but Capitec controls the software on them. A direct link would need Capitec's cooperation. The matching plan (one tap per card sale, then check against the end-of-day slip) stays for v1.

## Proposed roles (playback, please correct)
| Action | Employee | Manager | Boss |
|---|:-:|:-:|:-:|
| Clock in/out, sell, cash/card | ✅ | ✅ | ✅ |
| Log stock in | ✅ | ✅ | ✅ |
| Log stock out / "given to boss" | request | request | approves |
| Log expenses | ✅ | ✅ | ✅ |
| Change prices, add or remove products | ❌ | ✅ | ✅ |
| Edit a locked (sent) shift | ❌ | ❌ | ✅ (logged) |
| See all shifts and reports | own only | ✅ | ✅ |
| Manage staff and PINs | ❌ | ✅ | ✅ |

## Updated prompt
See the chat reply for round 2. It is repeated here for the record.

```
Build a simple, mobile-first shift POS and stock-take app for a small shop. It
must install on a phone (Android and iPhone) and also run in a browser. It
replaces the paper shift sheet (photos attached).

Users and roles: Boss, Manager, Employee. Everyone signs in with their own PIN,
and every action records who did it and when.
- Employees sell, log stock in and expenses, and request stock out.
- Managers also change prices and products and manage staff.
- The Boss approves stock out and can view and edit everything; every edit is logged.

Shift flow:
1. Clock in. Opening counts carry over from the previous shift's close. Any change is flagged.
2. Sell. Tap products like a till, choose Cash or Card, undo the last sale.
   Items are sold in units or grams (0.5 g steps).
3. Log stock in, expenses (with a note), and stock out (with a reason). Stock
   out goes to the Boss for approval, with a notification on his phone.
4. Clock out:
   - Count the closing stock.
   - The app works out sold = open + in − out − close for each item.
   - It flags differences between rung-up sales and counted sales, and between
     the card total and the card machine's end-of-day slip.
   - Cash on hand = sales − expenses − card.
5. Lock and send. A PDF that looks like the paper sheet, plus a spreadsheet,
   goes to the Boss on WhatsApp. The Boss also has a live web view.

Rules:
- Prices change over time; past sales keep the price they were sold at.
- Every total is calculated from its lines, and anything that doesn't
  reconcile is flagged.

Design: clean, dark "vault" style. Grey and white with one accent colour, big
blocky buttons, high contrast, easy to read. Generic name for now.

Reliability: Wi-Fi is usually good, but the app must keep working offline and
during power cuts, and sync later. No data loss if a phone dies.

Future: link the Capitec card machine (NEWPOS terminal, software 0.12.15) so
card sales are recorded automatically.
```
