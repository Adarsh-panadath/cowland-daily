# Cowland Daily

An interactive product prototype for **Cowland Daily**, a dawn A2-milk subscription service in Chhatrapati Sambhajinagar. One React app covers all three sides of the business on shared sample data, and actions in one app show up in the others.

- **Customer app**: sign-up for new households, two-week milk diary (skip a day, take less or add more, 10 PM lock), vacation pause, regular-order editor with an effective date, shop with basket and delivery-date picker, wallet with demo top-ups, statements, problem reports linked to an order and its items, and a daily milk chit that shows part deliveries.
- **Rider app**: built for riders who aren't comfortable with text-heavy apps. Each item on the next-home card has − and + buttons for what is actually handed over (fewer is charged less, more comes from the van's spares at the normal price), the empty-bottle count sits in its own clearly marked box, and "Start this round again (demo)" reopens every drop with charges reversed. One big next-home card with item pictures, a giant Delivered button, tap-only problem tiles, a picture-and-buttons screen for part deliveries, read-aloud doorstep notes, English / मराठी / हिंदी. The shift runs in three steps: crate check, delivering (with Done / Left / Problem counters and a finish-by clock), and bottle handover. Earnings show today, this week and the next payday.
- **Hub**: live KPIs and routes, a route planner that compares the current stop order with a shorter one, held orders, tickets with bounded refunds or a retry on the next run, customers, a demand and waitlist page for areas not served yet, milk quality, and a full analytics suite (delivery timing, route economics, cohorts, scenarios).

Live site: https://adarsh-panadath.github.io/cowland-daily/

## Demo access

Each portal has its own sign-in at `/#/login`. The demo details are pre-filled.

| Account | Sign in with | Demo login |
|---|---|---|
| Customer (Aditi Deshmukh, Route 04) | Mobile number + one-time code | 1234567890, code 1234 |
| Any household you create | The mobile number you signed up with | code 1234 |
| Rider (Ganesh Shinde, Route 04) | Rider ID + PIN | 1234, PIN 1234 |
| Hub staff (Mahesh Kale) | Work email + password | admin@cowland.in, admin |

New households sign up at `/#/join` (or **Get started** / **Start delivery here** on the home page). No SMS is sent; the code is always 1234.

## Demo database

Hub staff have it built in: **Database** in the hub sidebar, and a **Live activity** feed on the Overview showing the latest clicks from every app. It's also available without signing in at `/#/data` (linked from every sign-in page, the sidebar and the account menu), handy in its own tab. It shows everything the prototype has saved, live:

- **Activity**: every click as a plain-English line (who, what, which order, wallet effect), including clicks the rules refused, such as a change after the 10 PM lock.
- **Orders** for the current delivery morning, with each order's activity, ledger entries and tickets.
- **Ledger, Households, Tickets, Waitlist**: the raw records.
- **Integrity checks**, recalculated after every change: every wallet equals its opening balance plus the ledger, nobody pays for what they didn't get, each delivery is charged once, one order per household per day, spares never oversold, refunds never exceed payments, held orders stay off the van.
- **Export JSON** downloads the whole database.

### Several tabs at once

All tabs in one browser share one copy of the data. Each action first loads anything another tab saved, so a hub tab running the simulation can't overwrite a rider's deliveries, and other tabs refresh the moment anything changes. Sign-in belongs to each tab, so you can keep the customer, rider and hub apps open side by side. The simulation only runs in the tab you're looking at.

## The demo clock

The prototype runs on a delivery-morning clock. It opens on "this morning", with some routes part-way through.

- **Next delivery morning** (hub Overview and Live routes, and at the end of the rider's shift) moves one day ahead. Every household's order for that date is built from its regular order, plan changes, skipped days, vacations and extras. Homes whose wallet can't cover the order are **held**: they stay off the rider's list and show on Live routes.
- Changes for a date lock at **10 PM IST the night before**. The lock is enforced in the shared data layer, so the diary, shop, vacation form and plan editor all follow it.
- Reopening the site on a new real day keeps everything and builds that morning's orders. **Reset demo data** (account menu, with a confirmation) starts over.

## Presentation walkthrough

This is the connected journey used to verify the prototype (it runs end to end in a headless browser, customer and rider on a phone-sized screen).

1. **Waitlist:** on the home page, pick **Harsul** in "Do we come to you?" and join. It appears on the hub's **Demand** page.
2. **Sign up:** **Get started** → **Samarth Nagar** (Route 04, so the demo rider Ganesh delivers it) → name and a new mobile number → code 1234 → Mayur Park, flat C-201 → press + once for **3 bottles of A2 a day** → first delivery date → ₹1,000 demo top-up → create.
3. **Change one day only:** in the milk diary open the first delivery day, press − once (2 bottles that day) and tap **+ Malai paneer**. "Your regular order" still says 3 a day.
4. **Advance:** sign in as hub staff → **Next delivery morning**. Today's run has 2 × A2 + 1 × paneer for C-201.
5. **Partial delivery:** sign in as the rider → check the crate → deliver until C-201 → press − on the paneer → **Delivered**. Exactly 2 × A2 is recorded and ₹96 charged; a ticket opens for the paneer.
6. **Same numbers everywhere:** the customer's chit shows "0 of 1 × Malai paneer, not delivered, not charged" and ₹96; the hub ticket and the database show the same order ID and ₹96.
7. **Complaint and refund:** as the customer, report a leaking bottle (1 × A2). The hub refunds ₹48 (the limit is the delivered, paid-for bottle).
8. **Undo after a refund:** the rider opens **All homes** and undoes C-201. The wallet goes back to ₹1,000, not ₹1,048: the undo returns only the ₹48 still charged. The ledger keeps the debit, the refund and the reversal. Deliver again (paneer still short): one new ₹96 charge, wallet ₹904.
9. **Redelivery:** the hub opens the paneer ticket. Refund is blocked (it was never paid for); choose **Deliver the missing items on the next run**.
10. **Next morning:** **Next delivery morning**. Yesterday's order is kept under **Database → Orders → Earlier** with what was delivered and charged, and old tickets still open against it. Deliver C-201: the rider sees the paneer marked "missed last time"; ₹254 is charged (3 × A2 + the paneer), wallet ₹650. Refresh or switch apps: the database's integrity checks all pass.

## Selling more on the same vans## Selling more on the same vans

Four ideas for raising sales by making each morning's run work harder. None of them uses discounts.

1. **Spares on the van.** Every van already leaves with 2 spares of each item on its route. While the van is on its way, customers see "On Ganesh's van right now" and can add a spare to that morning's milk at the normal price, paid only if it reaches the door. The rider gets a message and a "+1 from spares" tag on that home's card. Unsold spares are shown on the handover screen. The hub sees spare sales on the Overview.
2. **Fill the vans first.** One more home in a building the van already visits adds about a minute and a half to the run; a new area needs a whole new van. The hub's **Demand** page ranks buildings on existing routes by the van minutes one more home would add (using the route planner's model). Customers can share a plain invite with neighbours in their building (no reward), and the hub sees how many invites each building has shared.
3. **Win back held orders.** The customer's home page warns the night before, with the exact amount short (after today's milk is paid for). When an order is held, the hub can remind those homes, and a top-up that covers the order puts it straight back on that morning's van, at the end of the route. The Overview shows money still held and money won back.
4. **Fewer failed doors.** If the door was locked on an earlier morning, the rider sees "Door was locked last time. Call first." After a failed delivery, the customer is asked to update their drop instructions, which the rider sees (and hears read aloud) next time.

## How the rules work

The business rules live in `app/src/store/rules.ts` as plain functions, and the store (`app/src/store/useStore.ts`) uses them for every action.

- **Orders by date.** Day changes are stored as absolute quantities per household and date ("3 every day, 2 on Tuesday"). A regular-order change is a draft until Save, then applies from the first date that isn't locked. One-off redeliveries and free replacements are stored separately from the regular order and never change it.
- **Order IDs and prices are fixed** per household and date. Each order stores the unit prices it was built with, so old charges never change if the catalogue does. Rebuilding a morning never creates duplicates.
- **Delivery records exactly what was handed over.** Fewer than ordered: only what was given is charged and a shortage ticket opens. More than ordered: the extra comes from the van's spares (if any are left and the wallet covers it). Nothing handed over: a failed attempt, not a delivery.
- **History is kept.** Moving to the next morning (or reopening the site on a new day) files this morning's orders under earlier orders. Tickets, receipts and refund limits always use the original order.
- **Three kinds of money back, kept apart in the ledger:**
  - *Refund*: compensation for a problem. Limited to the delivered, paid-for value of the ticket's items that hasn't already been refunded or replaced, and never more than is still charged on the order. A ticket with no order can credit at most ₹50 goodwill.
  - *Reversal*: an undone delivery. It returns what is still charged after any refunds, so the same money is never returned twice. A ₹0 reversal is recorded when everything was already refunded, so the history shows the undo.
  - *Free replacement*: for delivered, paid-for items that were defective. It rides on the next open delivery at no charge, linked to the ticket.
- **Redeliveries** are for items that never arrived (and were never charged). They ride on the next open delivery and are charged only when delivered.
- **Top-ups and held orders.** A held order goes back into this morning's run only if its van hasn't left the hub (Route 04: crate not yet loaded; other routes: no drop made yet). After that, the top-up covers the next delivery instead; today's held order stays off the van and uncharged, and the customer is told so. A payment never puts milk on a van that has left.
- Every action is logged in the activity log, and the integrity checks on the database page are recalculated after every change.

## Route planner assumptions

The planner is illustrative. It needs map positions and travel times, and the prototype has neither, so:

- Homes get **synthetic positions**, grouped by society around each route's area. A real version would geocode addresses.
- Travel time is straight-line distance × 1.35 at 20 km/h. Each door takes 1.4 min, plus 0.15 min per extra item.
- The van leaves the hub 15 min before the route's window. A drop is late if it lands after the window closes.
- The suggestion comes from nearest-neighbour then 2-opt, compared with 2-opt on the current order; the shorter wins, so it is never worse than today.
- Before the van leaves, applying it resequences today's run (the rider app updates immediately). After the van has started, it is saved for the next morning so nobody's drop moves mid-run.

## Sample data and its limits

- Customers, orders, ticket history, analytics history (120 days), lab results and the seeded waitlist are **generated sample data**. Pages label this ("Sample history", "Sample lab data", "Illustrative funnel", "Scenario estimates", "Sample" suggestions). The waitlist's 60-home bar for a new route is an illustrative number.
- Payments, OTPs, calls and SMS are simulated and say so. No money moves.
- Everything is saved in this browser only (localStorage). Tabs in the same browser stay in sync; other browsers and devices have their own copy.
- Sign-in is checked in the browser. A real launch needs server-side auth (SMS OTP, hashed PINs and passwords, sessions).
- The day lock uses India Standard Time for the hour and the device's own calendar for the date, so it is correct for devices set to IST.

## Known limitations

- Only Route 04 has an interactive rider app; routes 01, 02, 03 and 05 move with the simulation.
- The route planner minimises driving time on synthetic positions. It doesn't check van capacity, traffic or preferred drop times.
- Stock is modelled only as "2 spares per item per van". There is no hub inventory, so a recovery after the van has left waits for the next run.
- If a customer pauses the day a redelivery or replacement was booked on, that one-off is not moved to another day automatically.
- Farm, product and lab details, the 98.4% on-time figure and the analytics history are illustrative or sample data.

## Not built (by choice)

To keep the prototype focused, these suggestions from the implementation brief were left out: a dispatch queue for assigning orders to riders (the rider app always signs in as Route 04's rider; other routes move with the live simulation), stock and inventory tracking, paise-level accounting, and admin edits to a customer's confirmation after the fact.

## Tests

```bash
cd app
npm test         # business-rule and store tests (Node's test runner, bundled with esbuild)
npm run build    # type-check, tests, then build into the repo root
```

`tests/review.test.ts` drives the real store actions for every issue in the code review: deliveries of 3 → 3, 2, 1 and 0, a mixed milk-and-paneer partial delivery, extras from the spares; delivery → undo, refund → undo, full refund → undo, refund → undo → redelivery, duplicate refund and duplicate undo; a ticket's refund limit before and after advancing the day and after a reload; redelivery vs free replacement through the next delivery, with receipt and wallet checks; and top-ups before loading, during the round and after handover. The other tests cover the regressions the first brief listed: lowering one day below the regular plan, the draft plan editor and its effective date, the 10 PM IST lock at 9:59 and 10:00 across every entry point, undo leaving a reversal and clearing the confirmation, a new real day keeping the demo, new households acting as themselves, plus part delivery, bounded refunds, retries, held orders, van spares, held orders won back by a top-up, two tabs never overwriting each other, per-tab sign-in, the integrity checks after a busy morning, blocked clicks being logged, waitlist de-duplication, upgrading an older saved demo and route sequencing.

## Stack

React 18, TypeScript, Vite, Tailwind CSS, React Router (hash routing for GitHub Pages), Zustand (state, saved to localStorage), Recharts, Lucide icons. Product illustrations are hand-built SVG.

The source lives in `app/`. The build writes the site to the repo root, which GitHub Pages serves.
