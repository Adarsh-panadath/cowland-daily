# Cowland Daily

An interactive product prototype for **Cowland Daily**, a dawn A2-milk subscription service in Chhatrapati Sambhajinagar. One React app covers all three sides of the business, on shared sample data:

- **Customer app**: two-week milk diary (skip a day, add extras, 10 PM lock), vacation pause, regular-order editor, shop with basket and delivery-date picker, wallet with top-up flow and spend chart, downloadable statement, problem reports with status tracking.
- **Rider app**: built for riders who aren't comfortable with text-heavy apps. One big next-home card with item pictures, a giant Delivered button, tap-only problem tiles (no typing), read-aloud doorstep notes, English / मराठी / हिंदी. The shift runs in three steps: a picture load check before leaving the hub (short items go straight to the hub), delivering with Done / Left / Problem counters and a finish-by-6:15 clock, and a bottle handover at the end. Earnings show today, this week and the next payday. "Start a new shift (demo)" replays the whole morning.
- **Hub analytics**: a Delivery view first (arrival-time spread against the 6:15 promise, late drops by route and day, causes of lateness, door problems, trouble-spot societies, rider scorecard, how bad mornings drive cancellations, revenue at risk, and a ranked list of fixes with rupee impact you can add to a plan), then a KPI scorecard with period-over-period change, trend with moving average and prior-period overlay, 14-day demand forecast with a likely range, route P&L with a revenue-to-profit waterfall, cohort retention, customer segments, churn-risk list, acquisition funnel, product mix and weekday heatmap, and a what-if scenario planner with 12-month projection and sensitivity chart. Filter by period and route, export to CSV.
- **Hub dashboard**: live KPIs, 30-day trends, product mix, 7-day forecast, suggestions panel, live route map with a running simulation, ticket queue with refunds, searchable customer list with CSV export, lab quality trends and batch log.

Actions flow between portals: a customer's report lands in the hub's ticket queue, a hub refund appears in the customer's wallet, and a rider's delivery moves the hub's route map.

## Sign-in

Each portal has its own sign-in at `/#/login`, and a signed-in person only sees their own portal.

| Account | How they sign in | Demo login |
|---|---|---|
| Customer (Aditi Deshmukh) | Mobile number + one-time code | 1234567890, OTP 1234 |
| Rider (Ganesh Shinde) | Rider ID + PIN | 1234, PIN 1234 |
| Hub staff (Mahesh Kale) | Work email + password | admin@cowland.in, admin |

The demo details are pre-filled on each sign-in form.

This is a static prototype, so credentials are checked in the browser. A real launch would verify them on a server (SMS OTP gateway, hashed PINs and passwords, server sessions).

## Every control works

Calls open an in-app masked-call screen instead of dialling made-up numbers, callback requests create hub tickets, offers and reminders are recorded, and CSV exports download real files. An automated crawl clicks every button and link on every page; the only no-ops are items that are already selected.

## Live site

https://adarsh-panadath.github.io/cowland-daily/

## Stack

React 18, TypeScript, Vite, Tailwind CSS, React Router (hash routing for GitHub Pages), Zustand (state, saved to localStorage), Recharts, Lucide icons. Product illustrations are hand-built SVG, so there are no stock images.

## Working on it

The source lives in `app/`. The build writes the site to the repo root, which GitHub Pages serves.

```bash
cd app
npm install
npm run dev      # local dev server
npm run build    # type-check, then build into the repo root
```

All data is sample data generated in `app/src/data/seed.ts`. Use **Reset demo data** in the sidebar to start the morning over.
