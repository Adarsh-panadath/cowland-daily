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

Open `/#/data` (also linked from every sign-in page, the sidebar and the account menu) in its own tab. It shows everything the prototype has saved, live:

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

1. On the home page, pick **Harsul** in "Do we come to you?" and join the waitlist. It appears on the hub's **Demand** page.
2. **Get started** → choose **Samarth Nagar** (Route 04, so Ganesh delivers it) → name and a new mobile number → code 1234 → address → 2 bottles of A2 milk, first delivery date, ₹1,000 demo top-up → create the account.
3. In the milk diary, open the first delivery day and tap **+ Malai paneer**.
4. Sign out. Sign in as hub staff → **Next delivery morning** (repeat until the first delivery day if you chose a later one).
5. **Live routes** → Route 04 → **Route planner**: compare the current and suggested order, then **Apply to today's run**.
6. Sign in as the rider → check the crate → deliver until the new household's door → **Problem** → **Item short or broken** → press − on the paneer → **Give the rest**.
7. Sign in as the new customer: the chit shows the order ID, "0 of 1 × Malai paneer, not delivered, not charged" and ₹96 charged. Report the missing paneer.
8. Sign in as hub staff → **Tickets**: the ticket shows the same order ID and that paneer was never charged, so a refund is blocked. Choose **Deliver the missing items on the next run**. The customer sees it on their next order and in Help, and the wallet reads ₹904.

## Selling more on the same vans

Four ideas for raising sales by making each morning's run work harder. None of them uses discounts.

1. **Spares on the van.** Every van already leaves with 2 spares of each item on its route. While the van is on its way, customers see "On Ganesh's van right now" and can add a spare to that morning's milk at the normal price, paid only if it reaches the door. The rider gets a message and a "+1 from spares" tag on that home's card. Unsold spares are shown on the handover screen. The hub sees spare sales on the Overview.
2. **Fill the vans first.** One more home in a building the van already visits adds about a minute and a half to the run; a new area needs a whole new van. The hub's **Demand** page ranks buildings on existing routes by the van minutes one more home would add (using the route planner's model). Customers can share a plain invite with neighbours in their building (no reward), and the hub sees how many invites each building has shared.
3. **Win back held orders.** The customer's home page warns the night before, with the exact amount short (after today's milk is paid for). When an order is held, the hub can remind those homes, and a top-up that covers the order puts it straight back on that morning's van, at the end of the route. The Overview shows money still held and money won back.
4. **Fewer failed doors.** If the door was locked on an earlier morning, the rider sees "Door was locked last time. Call first." After a failed delivery, the customer is asked to update their drop instructions, which the rider sees (and hears read aloud) next time.

## How the rules work

The business rules live in `app/src/store/rules.ts` as plain functions, and the store (`app/src/store/useStore.ts`) uses them for every action.

- Day changes are stored as absolute quantities per household and date, so "3 every day, 2 on Tuesday" works.
- A regular-order change is a draft until Save, then applies from the first date that isn't locked.
- Order IDs are fixed per household and date, so rebuilding a morning never creates duplicates.
- Riders can deliver part of an order. Only what reached the door is charged, and the missing lines open a ticket automatically.
- Every debit, refund and reversal is a ledger entry tied to its order. Undoing a delivery adds a reversal instead of deleting the charge, and clears the customer's "I've got my milk" confirmation.
- A refund can never exceed what is still charged on the order, and only covers affected items that were delivered (and so paid for). A ticket with no order can credit at most ₹50 goodwill.

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

## Not built (by choice)

To keep the prototype focused, these suggestions from the implementation brief were left out: a dispatch queue for assigning orders to riders (the rider app always signs in as Route 04's rider; other routes move with the live simulation), stock and inventory tracking, paise-level accounting, and admin edits to a customer's confirmation after the fact.

## Tests

```bash
cd app
npm test         # business-rule and store tests (Node's test runner, bundled with esbuild)
npm run build    # type-check, tests, then build into the repo root
```

The tests cover the regressions the brief listed: lowering one day below the regular plan, the draft plan editor and its effective date, the 10 PM IST lock at 9:59 and 10:00 across every entry point, undo leaving a reversal and clearing the confirmation, a new real day keeping the demo, new households acting as themselves, plus part delivery, bounded refunds, retries, held orders, van spares, held orders won back by a top-up, two tabs never overwriting each other, per-tab sign-in, the integrity checks after a busy morning, blocked clicks being logged, waitlist de-duplication, upgrading an older saved demo and route sequencing.

## Stack

React 18, TypeScript, Vite, Tailwind CSS, React Router (hash routing for GitHub Pages), Zustand (state, saved to localStorage), Recharts, Lucide icons. Product illustrations are hand-built SVG.

The source lives in `app/`. The build writes the site to the repo root, which GitHub Pages serves.
