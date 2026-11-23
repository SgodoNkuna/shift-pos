# Shift POS app: discovery notes, round 1

Status: planning only. Nothing gets built until the questions are answered and you approve the design.

---

## 1. Improved prompt

> Build a simple, mobile-first **shift POS and stock-take app**. It should install on my phone and also work in a browser. It replaces the paper shift sheet in the attached photos.
>
> **How it works today**
> - Each shift (day or night) fills in a paper sheet, one table per category: main products, Beverages and Rolling Material.
> - Columns: Product, Price, Stock in, Out, Open, Close, Sales (R), Total stock (R).
> - Shift summary: Total sales, Total expenses, Card sales, Cash on hand.
> - Logs: Stock in, Stock out and Expenses, each with a note.
> - Some products are counted in units. Others are counted in grams, in 0.5 g steps.
>
> **Core flow**
> 1. **Clock in:** name, shift, date. Opening counts carry over from the last shift's close. I confirm or correct them, and any change is flagged.
> 2. **During the shift:** tap products to ring up sales like a till, and mark each sale Cash or Card. Log stock in, stock out (with a reason) and expenses (with a note) as they happen.
> 3. **Clock out:**
>    - I enter the closing counts.
>    - The app works out sold = open + in − out − close, the sales value, the stock value, and cash on hand = sales − expenses − card sales.
>    - It flags any gap between rung-up sales and counted sales, and between the card sales and the card machine's total.
> 4. **Send:** the shift locks. The app makes a PDF that looks like the paper sheet, plus a spreadsheet, and opens WhatsApp so I can send both to my boss.
>
> **Also**
> - Add, edit and archive products, categories, prices and units. Only the boss can do this, behind a PIN.
> - Works offline. Nothing is lost if the signal drops or the phone dies.
> - Simple, high-contrast, easy-to-read design (style still to be decided). Generic, with no business name yet.
> - Future version: link the Capitec card machine so card sales are recorded automatically.
>
> Before building, ask me questions in rounds (at least 5), suggest improvements and add-ons, then plan.

---

## 2. What the paper sheet actually does (data analysis)

### Structure
| Level | Fields |
|---|---|
| Shift header | Staff name, shift (Day / Night), date |
| Category | Main products (no title on the sheet), Beverages, Rolling Material |
| Product row | Product, Price, Stock in, Out, Open, Close, Sales R, Total stock R |
| Shift footer | Total sales, Total expenses, Card sales, Cash on hand, category "Sales" and "Total stock" subtotals |
| Logs | Stock in (item → qty), Stock out (qty → item, reason), Expenses (R → note) |

### The formulas the sheet uses (checked against the 28 Nov day shift)
| Formula | Check from the sheet |
|---|---|
| Sold = Open + Stock in − Out − Close | Outdoor: 44 + 28 − 0 − 59 = 13 |
| Sales R = Sold × Price | 13 × R20 = **R260** ✓ |
| Stock value R = Close × Price | 59 × R20 = **R1,180** ✓ |
| Super cheese | 17 + 34 − 25 = 26 × R30 = **R780** ✓; 25 × R30 = **R750** ✓ |
| Exodus C | 27 − 26 = 1 × R80 = **R80** ✓; 26 × R80 = **R2,080** ✓ |
| Cash on hand = Total sales − Expenses − Card sales | R2,905 − R40 − R2,370 = **R495** ✓ |

### Things the app must handle that a simple till usually doesn't
1. **Two kinds of unit.** Some items are whole units (joints, gummies, drinks) and some are grams with half-gram amounts (3g, 0.5g). Each product needs its own unit and step size.
2. **"Out" is not a sale.** It's stock that leaves without money, such as the 0.5 g outs listed under "Stock out" on 28 Nov. Each one needs a reason.
3. **Card sales are entered as a sum** ("R2,340 + R30"), which suggests they are added up from machine slips. One tap per sale removes that step.
4. **Sales are found by counting.** On paper, sales are only known at close, from the count. A till records each sale as it happens. Doing both gives a **variance**: what should be left versus what is actually left.
5. **An unexplained gap.** As I read the 28 Nov sheet, the product "Sales" subtotal is **R2,610** but Total sales is **R2,905**. That's **R295** the page doesn't explain. The app would work out every total itself, so a gap like this can't happen silently.
6. **Opening stock comes from the last close.** On 28 Nov the night-shift template's opening figures were reused. The app should carry them over automatically.

### Product list seen (seed data, prices in R)
- **Main:** Outdoor 20, Super Cheese 30, Castro Pop 60, Exodus C 80, Pink Ink 100, Eucalypto 100, Cadillac 120, Ice Cool 120, Grape Balls 150, Martian F 150, Gummies 30, Kings 250
- **Beverages:** Coke 20, Sprite 20, Monster 25, Powerade 25
- **Rolling material:** Blue Star 20, Bob Marley 20, Limitless 30, Rizla 30, Rizla 20, Bejo 30, Raw 40, Honey P 20

(The app will ship generic, with an empty product list or demo data. This list is only for testing against your real sheets.)

---

## 3. Risk register

| # | Risk | Likelihood | Impact | Level | Mitigation | Owner |
|---|---|---|---|---|---|---|
| 1 | Phone dies, is lost or breaks mid-shift and the shift data is gone | High | High | **Critical** | Save every tap on the phone immediately (offline-first). Back up to the cloud whenever there is signal. Allow a printable blank sheet as a paper fallback. | Build |
| 2 | No data, airtime or power (load-shedding) at clock-out, so the report can't be sent | High | Medium | **High** | Make the PDF and spreadsheet on the phone, with no internet needed. Queue the send. Keep the files in the phone's storage. | Build |
| 3 | Opening count doesn't match the last shift's close (handover disputes) | High | Medium | **High** | Carry the last close forward automatically. Any change at clock-in is flagged in the report with the name of whoever made it. | Build + Boss |
| 4 | Prices or stock edited to hide a shortage | Medium | High | **High** | Only the boss PIN can change prices or products. Keep an edit history (who, what, when). Lock a shift once it's sent. | Boss |
| 5 | Card total differs from the Capitec machine | Medium | Medium | Medium | Tag each sale Card or Cash. At close, enter the machine's end-of-day total and show any difference. | Staff |
| 6 | Report goes to the wrong WhatsApp chat, or a business-data leak | Low | High | Medium | Boss's number is fixed in settings (boss PIN). Reports hold no customer data. App PIN on open. | Boss |
| 7 | Capitec has no way to connect to the app | High | Low | Medium | v1 doesn't depend on it (one-tap Card button). Later, import a statement or switch providers. See section 5. | Later |
| 8 | Rounding errors with grams (0.5 g) | Medium | Low | Low | Store quantities as decimals with a set step size for each product. Test the maths against your real sheets. | Build |
| 9 | Automated WhatsApp costs or approval delays | Medium | Medium | Medium | v1 uses the phone's normal share button (free, instant). The WhatsApp Business API stays optional for later. | Later |
| 10 | Staff find the app slower than paper and stop using it | Medium | High | **High** | Big buttons, at most 2 taps per sale, a closing-count screen that looks like the sheet, and a test week alongside paper. | Build + You |

---

## 4. Backend shape (from the backend checklist)

| Need | Recommended piece |
|---|---|
| Works on phone and web, installable, offline | One web app installed to the home screen (PWA), with data saved on the phone first |
| Sync shifts so the boss can see them and nothing is lost | Vercel Functions (API) + Postgres from the Vercel Marketplace (e.g. Neon or Supabase) |
| Store sent PDFs and spreadsheets | Vercel Blob |
| End-of-shift report | Made on the phone, so it works offline. A copy is uploaded when online. |
| Scheduled jobs (e.g. "shift not closed by 08:00" alert) | Vercel Cron, an optional add-on |

A backend is **optional for v1** if the boss only needs the WhatsApp files. It's **required** if the boss wants a live view or a history across shifts and phones. See question 1.

---

## 5. Capitec card machine: can it be linked later?

- **Short answer:** probably not directly. As far as I know, Capitec doesn't publish a public developer connection for its business card machines that a third-party app can plug into. **I'll check what's currently available before we plan v2.** Don't treat this as final.
- **v1, works now:** a **Card** button on each sale records the amount with no re-typing. At clock-out you type the machine's end-of-day total once, and the app shows any difference.
- **v2 options:**
  - (a) Import Capitec Business's transaction export or statement and auto-match it to card sales.
  - (b) If you ever switch to a card provider that offers an app connection, wire it in. Some South African providers advertise this. We'd verify before choosing.
- The app will keep payments behind one "payment method" layer, so adding any of these later doesn't mean rewriting it.

---

## 6. Ideas and add-ons (pick what you want)

**Obvious, planned for v1**
- Add, edit and archive products, categories, prices, units, and low-stock levels
- Stock in, stock out with a reason, and expenses with a note
- Cash or Card on every sale; undo the last sale
- Opening stock carried over from the last close; closing count screen
- Locked shift → PDF + spreadsheet → WhatsApp

**Suggested add-ons**
1. **Variance report:** expected versus counted stock per item, in rands
2. **Cash-up helper:** count notes and coins (R200 × n …) to check cash on hand
3. **Low-stock alert** and a restock list sent with the report
4. **Mid-shift update:** a "send snapshot to boss" button
5. **Staff PINs**, so each sale and edit is tagged with who did it
6. **Boss dashboard (web):** daily, weekly and best-sellers, with history across shifts
7. **Quick-sale grid** with the most-sold items first
8. **Photo of the receipt or slip** attached to an expense or stock-in
9. **Half-gram stepper buttons** (+0.5 / −0.5) for weighed items
10. **Paper fallback:** print a blank sheet from the app for power cuts

---

## 7. Skills to use in later turns

| When | Skill | Why |
|---|---|---|
| After design approval | `superpowers:writing-plans` | Turn the approved design into build steps |
| UI build | `frontend-design:frontend-design` | Simple, high-contrast phone screens |
| Database | `vercel:marketplace`, `vercel:vercel-storage` | Provision Postgres and Blob properly |
| App framework | `vercel:nextjs`, `vercel:shadcn` | Web app + installable phone app from one codebase |
| Reports | `anthropic-skills:pdf`, `anthropic-skills:xlsx` | PDF that matches the paper sheet; spreadsheet for the boss |
| Maths correctness | `superpowers:test-driven-development` | Test the formulas against your real sheets |
| Restock add-on | `small-business:inventory-planner`, `small-business:restock` | Reorder levels |
| Staff procedure | `operations:runbook`, `operations:process-doc` | Shift SOP, including the power-cut fallback |
| Going live | `vercel:deploy`, `superpowers:verification-before-completion` | Deploy and prove it works |
