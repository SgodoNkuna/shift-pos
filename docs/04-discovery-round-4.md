# Shift POS app: discovery notes, round 4 (how to build it)

## Round 3 answers (yours)
| # | Topic | Answer | What I'll do |
|---|---|---|---|
| 1 | Two sellers at once | A shift belongs to **one person**. Build multi-seller later, present but **locked away**. | Multi-seller is built behind an off switch that only the boss can turn on later. |
| 2 | Stock out still pending at clock-out | **Can't close** until someone answers. "Close and update later" is to be discussed. **5 minutes.** | Clock-out is blocked while anything is pending. If the boss hasn't answered after 5 minutes, the manager gets buzzed. |
| 3 | Baskets and split payment | Both happen | Multi-item basket, part-cash/part-card, and a change calculator |
| 4 | Cash float and counting | Yes | Opening float + counted cash at handover → cash difference flagged |
| 5 | Expenses | From the till, **just noted** | Amount + note, no approval, subtracted from expected cash |
| 6 | Cost prices | **Boss only** | Boss sets cost prices. Profit reports are boss-only. Employees and managers never see cost. |
| 7 | Login | **Both**: phone number + PIN | See the login note below |

## Login note (free-tier conflict)
Texting a code to a phone number (SMS) is **never free**. It needs a paid SMS provider and costs per message. To keep "phone number + PIN" at R0:
1. A manager or the boss adds the staff member's name and phone number. The app makes a **one-time invite link**.
2. The invite link is sent to that number **on WhatsApp** (free, one tap).
3. Opening the link on that phone ties the account to the phone, and the person sets a 4-digit PIN.
4. After that, the person signs in each time with their PIN. A new phone needs a new invite.

## Approaches

### A. Installable web app (PWA) + Supabase + Cloudflare Pages ← **recommended**
- **What it is:** one app, opened from a link and added to the Home Screen on Android or iPhone. The boss uses the same app with extra screens.
- **Cost:** R0. Supabase free tier for the database, logins, live updates and the scheduled reminders. Cloudflare Pages free tier hosts it, and commercial use is allowed.
- **Offline:** every tap is saved on the phone first, then synced. Reports are made on the phone.
- **Buzz:** web push. Works on Android. On iPhone it works only once the app is added to the Home Screen (iOS 16.4+).
- **Trade-offs:**
  - iPhone notifications are slightly less reliable than a store app.
  - It isn't in the app stores.
  - It can be wrapped as a store app later without a rewrite.

### B. Store app (Android + iPhone) + Supabase
- **Gains:** the most reliable notifications, and it's in the app stores.
- **Costs:**
  - Apple charges a developer fee of about US$99 a year, and Google about US$25 once. That breaks the free tier.
  - Every update waits for store review.
  - The boss's web view would be a second build.

### C. No-code (spreadsheet-backed app builders)
- **Gains:** fastest to get something on screen.
- **Costs:**
  - Free plans cap users and rows.
  - Offline is weak.
  - Live approve/reject buzzes and the vault design are hard to do.
  - You're locked into that vendor.

**Why A:** it's the only option that meets **R0, every phone, offline, live buzz and your design** at once, and it can grow into B later.

## Open items for round 5
- What happens at 8am if **neither** the boss nor the manager answers a pending stock out? Clock-out is blocked, so someone could be stuck.
- If the buzz can't be sent because the employee is offline, the request waits on the phone and sends when the connection returns. Is that OK?
