# Cowland Daily

A front-end prototype for **Cowland Daily**, an artisanal A2 milk subscription and dawn-delivery service in Chhatrapati Sambhajinagar. It covers the three sides of the business: the household customer, the delivery rider, and the hub operations team.

## Screens

| Page | File | What it shows |
|---|---|---|
| Customer Portal | `index.html` | Dudhachi Diary (7-day milk planner), skip / extra / vacation controls, daily milk chit (पावती), prepaid wallet, farm-fresh catalog, route serviceability checker |
| Delivery Partner Round | `rider.html` | Rider shift header, round progress, door-by-door drop sheet, crate load manifest, empty-bottle recovery counter, field incident tools |
| Admin Hub & AI Intelligence | `admin.html` | Dispatch KPIs, dawn dispatch curve, AI route & demand recommendations, live route monitor, exception resolution, lab QA certificate |

## Running it

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

The pages load Tailwind CSS (CDN), Google Fonts (Playfair Display, Be Vietnam Pro) and Material Symbols, so an internet connection is needed for styling.

## Notes

- All data (households, riders, routes, lab values) is mock data for the prototype.
- Interactions (skip tomorrow, add to basket, mark delivered, bottle counter) are client-side only and reset on reload.
- Bilingual UI: English with Marathi labels.

## Stack

HTML · Tailwind CSS (CDN, custom Material-3-style token config) · vanilla JavaScript
