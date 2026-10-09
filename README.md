# Cowland Daily

An interactive product prototype for **Cowland Daily**, a dawn A2-milk subscription service in Chhatrapati Sambhajinagar. One React app covers all three sides of the business, on shared sample data:

- **Customer app**: two-week milk diary (skip a day, add extras, 10 PM lock), vacation pause, regular-order editor, shop with basket and delivery-date picker, wallet with top-up flow and spend chart, downloadable statement, problem reports with status tracking.
- **Rider app**: next-door card in route order, one-tap delivered with undo, empty-bottle counter, problem flags, crate stock that counts down, hub broadcasts, shift summary with pay breakdown.
- **Hub dashboard**: live KPIs, 30-day trends, product mix, 7-day forecast, suggestions panel, live route map with a running simulation, ticket queue with refunds, searchable customer list with CSV export, lab quality trends and batch log.

Actions flow between portals: a customer's report lands in the hub's ticket queue, a hub refund appears in the customer's wallet, and a rider's delivery moves the hub's route map.

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
