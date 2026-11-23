# Shift POS app: discovery notes, round 3

## Round 2 answers (yours)
| # | Topic | Answer |
|---|---|---|
| 1 | Roles | Table confirmed. **Managers can also approve stock out.** |
| 2 | Devices | Each person uses their **own phone**. |
| 3 | Stock-out approval | Confirmed **live** on the approver's side. The app **buzzes** them, and the stock stays **pending** until they answer. |
| 4 | Shifts | Day 8am–8pm, night 8pm–8am. Handover count is done with **both people present**. The person clocking out sends the report. **Flag it if they don't.** |
| 5 | Report goes to | Boss **and** manager |
| 6 | Card machine | "NN222468" looks like a serial number rather than the model. Low priority: this is for v2. |
| 7 | Budget | **Free tier** |

## Decisions this round
- **Shift dates.** A night shift is filed under the date it **starts** (e.g. "Night, 28 Nov" runs 28 Nov 20:00 to 29 Nov 08:00).
- **Handover sign-off.** The outgoing and incoming person both enter their PIN on the count. If they disagree, both numbers go on the report.
- **Report not sent.**
  - 15 minutes after clock-out, the app reminds the person who clocked out.
  - At 30 minutes it buzzes the boss and manager with "report not sent".
  - Times can be changed.
- **Buzz** means a phone notification with vibration.
  - **Android:** works normally.
  - **iPhone:** only works once the app has been added to the Home Screen (iOS 16.4 or newer). We'll show a one-time setup screen for this.
- **Free hosting.** Vercel's free plan is for personal, **non-commercial** use, and a shop POS is commercial. To stay at R0, the shortlist is:
  - **Supabase** (free): database, logins, and live updates for approvals
  - **Cloudflare Pages** (free, commercial use allowed): hosts the app

  I'll confirm current free limits before building. Supabase's free database (around 500 MB) holds years of shift data, and daily use keeps the project from pausing.
- **WhatsApp.** Send to **one WhatsApp group** (boss + manager + reporting phone) with a single tap. It's free.

## Screen sketches (vault style, text only)

### Sell screen
```
┌──────────────────────────────────┐
│ NIGHT · 28 NOV        ● ONLINE   │
│ Sales R1,240   Card R860  Cash R380│
├──────────────────────────────────┤
│ [ MAIN ] [ DRINKS ] [ ROLLING ]  │
│ ┌────────┐┌────────┐┌────────┐   │
│ │OUTDOOR ││SUPER CH││CASTRO P│   │
│ │  R20   ││  R30   ││  R60   │   │
│ │ 41 left││ 22 left││ 27 left│   │
│ └────────┘└────────┘└────────┘   │
│ ┌────────┐┌────────┐┌────────┐   │
│ │PINK INK││CADILLAC││ KINGS  │   │
│ │ R100/g ││ R120/g ││  R250  │   │
│ └────────┘└────────┘└────────┘   │
├──────────────────────────────────┤
│ BASKET: Outdoor ×2, Pink Ink 0.5g│
│ TOTAL R90                         │
│ [   CASH   ]      [   CARD   ]    │
└──────────────────────────────────┘
```

### Stock-out request (employee → approver)
```
Employee phone                     Boss / manager phone (buzz)
┌──────────────────────┐           ┌──────────────────────────┐
│ STOCK OUT            │  ──────►  │ ⚠ STOCK OUT REQUEST       │
│ Martian F   0.5 g    │           │ Martian F 0.5 g (R75)    │
│ Reason: Given to boss│           │ by Employee A · 21:14    │
│ [ SEND FOR APPROVAL ]│           │ [ APPROVE ]  [ REJECT ]  │
│ status: PENDING ⏳   │           └──────────────────────────┘
└──────────────────────┘
```

### Clock-out
```
┌──────────────────────────────────┐
│ CLOSE SHIFT · count with next    │
│ person present                   │
│ Item       Expected  Counted  Δ  │
│ Outdoor        59    [ 59 ]   0  │
│ Super Ch       25    [ 24 ]  -1 ⚠│
│ ...                              │
│ Card machine slip total [R2,370] │
│ Cash counted          [ R495 ]   │
│ Pending stock out: 1 ⏳           │
│ PIN out [****]   PIN in [****]   │
│ [ LOCK & SEND TO WHATSAPP ]      │
└──────────────────────────────────┘
```
