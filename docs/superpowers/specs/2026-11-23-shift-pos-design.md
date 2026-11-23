# Shift POS: design

Status: **awaiting approval** · Date: 23 Nov 2026 · Working name: "Shift POS" (generic; to be renamed)

## 1. Why
The shop runs on a handwritten shift sheet: one table per category, with Open / In / Out / Close counts and money totals. It's slow, easy to get wrong, and hard to check. On 28 Nov, total sales were R295 more than the product lines, and nothing explained the gap. The app replaces the sheet with a phone till. It counts and adds everything itself, flags anything that doesn't reconcile, and sends the boss and manager a finished report at every handover.

**Success looks like this:** each 08:00 and 20:00 handover produces a locked shift report (PDF + spreadsheet) in the boss/manager WhatsApp group within minutes. Every rand and every item is accounted for, and differences are flagged with the name of whoever was responsible.

## 2. Goals, non-goals, anti-goals
**Goals (v1)**
- Till-style selling on each person's own phone: basket, cash/card/split, change calculator, units or grams (0.5 g steps)
- Stock in, stock out (approval required), and expenses (noted only)
- Joint handover count, with both PINs, that closes one shift and opens the next
- Calculated reconciliation: stock difference per item, cash difference, card vs machine slip
- Live buzz to approvers, with escalation to the manager after 5 minutes
- PDF that looks like the paper sheet + XLSX, shared to WhatsApp by the person clocking out, with reminders and alerts if it isn't sent
- Boss / manager / employee roles. Cost prices and profit are boss-only.
- Works offline. Nothing is lost if the signal drops or a phone dies.
- Free to run (R0 a month)

**Non-goals (v1)**
- Linking the Capitec card machine (planned for v2; see §9)
- Deals or discounts (prices only change over time)
- Several sellers in one shift (built, but switched off)
- Several shops; app-store versions; customer receipts

**Anti-goals: failure even if it "works"**
- Slower than paper at the counter. A one-item cash sale must take **3 taps or fewer**.
- A total that can be typed in by hand instead of calculated
- Changing an old report after it was sent without a visible record of the change
- Monthly bills

## 3. Constraints
- Phones: staff's own Android and iPhone phones. Shop Wi-Fi is good; power cuts are rare but must be planned for.
- Budget: free tiers only. Vercel's free plan is personal/non-commercial use only, so it's not used.
- Currency ZAR. Timezone Africa/Johannesburg. Shifts: **Day 08:00–20:00** and **Night 20:00–08:00**. A night shift is filed under its start date.
- iPhone push notifications require the app to be added to the Home Screen (iOS 16.4+).
- WhatsApp sending uses the phone's share sheet: the user taps Share → WhatsApp → the group → Send. No paid WhatsApp API.

## 4. Approaches (chosen: A)
| | Approach | Trade-off | Decision |
|---|---|---|---|
| **A** | Installable web app (PWA) + Supabase + Cloudflare Pages | R0, every phone, offline, live push; iPhone push needs the Home Screen step | **Chosen by you** |
| B | Native store apps + Supabase | Most reliable push; Apple ~US$99/yr + Google ~US$25; store review delays; second build for the boss | Rejected: not free |
| C | No-code spreadsheet app builder | Fastest start; weak offline, user/row caps, can't do live approvals or the design | Rejected |

## 5. Decided by you (as decided)
| Area | Decision |
|---|---|
| Roles | Boss, Manager, Employee (table in §6) |
| Managers | Can change prices and products, manage staff, approve stock out, and **close a shift that's stuck on a pending stock out** |
| Sales method | Ring up every sale **and** count at close; the app shows the difference |
| Shift ownership | One person per shift. Multi-seller built but locked (boss-only switch). |
| Stock out | "Given to boss" etc. Needs **live approval**. Approver is buzzed; **manager buzzed after 5 min**. Stays **pending** until answered. Clock-out is **blocked** while pending, unless a **manager closes it**. |
| Offline | Fine. Requests and sales queue on the phone and send when back online. |
| Handover | Counted with both people present; outgoing person clocks out and sends the report; flagged if not sent |
| Report recipients | Boss and manager (one WhatsApp group) |
| Payments | Cash, card, and split; change calculator |
| Cash | Opening float + physical cash count at handover |
| Expenses | From the till, amount + note, no approval |
| Cost price / profit | Boss only |
| Login | Phone number + PIN (free invite-link method, §7.1) |
| Look | Dark "vault" style: greys/white, one accent colour, big blocky buttons, high contrast |
| Budget | Free tiers |

## 6. Roles and permissions
| Action | Employee | Manager | Boss |
|---|:-:|:-:|:-:|
| Clock in/out, sell, cash/card/split, void own sale (with reason) | ✅ | ✅ | ✅ |
| Log stock in, expenses | ✅ | ✅ | ✅ |
| Request stock out | ✅ | ✅ | ✅ |
| Approve / reject stock out | ❌ | ✅ | ✅ |
| Close a shift with pending stock out | ❌ | ✅ | ✅ |
| Prices, products, categories, units | ❌ | ✅ | ✅ |
| Add staff, send invites, reset PINs | ❌ | ✅ | ✅ |
| See all shifts and reports | own | ✅ | ✅ |
| Cost prices, profit reports | ❌ | ❌ | ✅ |
| Edit a locked shift (logged, shown on report) | ❌ | ❌ | ✅ |
| Turn on multi-seller, change reminder times, set the float | ❌ | ❌ | ✅ |

## 7. How it works

### 7.1 Sign-in
1. A manager or the boss adds a person (name, phone, role). This creates a one-time invite link.
2. The link is sent via the WhatsApp share sheet.
3. Opening the link on the phone ties it to the account, and the person sets a 4-digit PIN.
4. After that, sign-in is by PIN only. Five wrong PINs lock the account until a manager resets it.
5. On iPhone, a one-time screen walks the person through "Add to Home Screen", then asks for notification permission.

### 7.2 Shift lifecycle
```
OPEN ──sell / stock in / stock out request / expense──► CLOSING ──joint count + both PINs──► LOCKED ──share──► SENT
```
- **Clock in:** the opening stock and float come from the previous shift's locked count. Nothing is re-entered.
- **Clock out:**
  1. Enter the closing count per item and the counted cash.
  2. Enter the card machine slip total.
  3. The incoming person enters their PIN. A disagreement records both numbers.
  4. If anything is pending, clock-out is blocked until it's answered or a manager closes it.
- **Locked:** the shift's numbers are frozen and the next shift opens.
- **Report reminders:**
  - Locked but not shared after **15 min** → the person who clocked out is reminded.
  - After **30 min** → the boss and manager are buzzed "report not sent".
  - The boss can change both times.

### 7.3 Calculations (always derived, never typed)
Per item:
- expected_close = open + stock_in − approved_out − rung_up_sold
- counted_sold = open + stock_in − approved_out − counted_close
- stock_diff = counted_close − expected_close (in units/g and in R at the shift's prices)
- sales_R = Σ rung-up sale lines (qty × price at the time of sale)
- stock_value_R = counted_close × current price

Per shift:
- total_sales = Σ sales_R; card_sales = Σ card portions; cash_sales = total_sales − card_sales
- expected_cash = float + cash_sales − expenses
- cash_diff = counted_cash − expected_cash
- card_diff = machine_slip_total − card_sales
- Category subtotals must add up to the shift total. This is checked automatically, which prevents another 28-Nov-style gap.

Quantities are stored as decimals with a per-product step (1 for units, 0.5 for grams). Money is stored in cents.

### 7.4 Stock-out approval
1. The employee picks an item, a quantity and a reason. The reasons are a list the boss can edit, starting with: given to boss, sample, damaged, other + note. The request is created as **pending**.
2. All boss phones are buzzed. After 5 min unanswered, all managers are buzzed too.
3. The approver taps Approve or Reject. The employee's screen updates live.
4. Approved → it counts as Out. Rejected → it's shown on the report as rejected; the stock never left.
5. If offline, the request waits on the phone and sends when the connection returns.

### 7.5 Report (PDF + XLSX)
- **PDF:** laid out like the paper sheet. Header (name, Day/Night, date), one table per category (Product, Price, In, Out, Open, Close, Sold, Sales R, Stock R, Diff), a totals block (Total sales, Card, Cash, Expenses, Float, Expected vs counted cash, Card slip diff), logs (stock in, stock out with status and approver, expenses, voids), and a **Flags** box listing every difference.
- **XLSX:** one sheet per section (Summary, Items, Sales lines, Stock in, Stock out, Expenses, Flags).
- **Boss-only version:** adds cost and profit. The boss sees it in the app, not in the WhatsApp group.

### 7.6 Boss / manager screens
Live today (sales so far and the current shift), pending approvals, shift history with downloadable reports, products/prices (with price history), staff, settings. The boss also gets profit by item, day and week.

## 8. Architecture
- **Front end:** a single installable web app (PWA): React + TypeScript + Vite + Tailwind. A service worker caches the app so it opens with no signal.
- **Local-first data:** every action is written to on-phone storage (IndexedDB) first, with an "outbox" that syncs to the server. Each record has an ID made on the phone, so retries never double-count.
- **Backend:** Supabase free tier.
  - Postgres with row-level security per role. Cost columns are only readable by the boss.
  - Realtime for live approvals.
  - Edge Functions for web push and invites.
  - Scheduled jobs (pg_cron) for the 5-min escalation and the 15/30-min report reminders.
- **Hosting:** Cloudflare Pages free tier (commercial use allowed).
- **Reports:** made on the phone (works offline). A copy is uploaded to Supabase Storage when online.
- **Data model:** shops (only one for now), users, products (unit, step, active), prices (with effective-from), categories, shifts, sales, sale_lines, payments, stock_movements (in / out / adjust, with status and approver), expenses, counts, audit_log, settings.

## 9. Capitec card machine (v2)
- **Direct link:** Capitec controls the software on its NEWPOS Android terminal, so a direct link needs Capitec's cooperation. This will be checked before v2 is planned.
- **v2 fallback:** import Capitec Business transaction exports and match them to card sales automatically.
- **Groundwork in v1:** all card logic sits behind one "payment method" module, so v2 doesn't need a rewrite.

## 10. Left to the builder
- Folder layout, libraries within the stack above, test tooling, exact colours and fonts within the vault style
- Wording of reasons, flags and buttons (plain English, short)
- The free-tier limits check and the setup steps for Supabase and Cloudflare

## 11. My calls (please check)
1. **Void a sale:** an employee can void their own sale during their open shift, with a reason. Voids are listed on the report.
2. **Float:** set by the boss in settings (default R0). Counted at every handover.
3. **Five wrong PINs** lock the account until a manager resets it.
4. **Stock-out reasons** start as: given to boss, sample, damaged, other (with note). The boss can edit the list.
5. **Report reminders** at 15 min (to the person) and 30 min (to the boss and manager).
6. **Manager close:** a manager can close a stuck shift either from their own phone or by entering their PIN on the employee's phone.
7. **The app starts empty,** with an optional "load demo products" button that uses your sheet's list.
8. **The boss-only profit report** stays in the app and is not sent to the WhatsApp group (the manager is in that group).
