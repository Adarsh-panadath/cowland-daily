/**
 * Synthetic 180-day operating history for the hub analytics workspace.
 * Deterministic so every visitor sees the same numbers.
 */
import { addDays, dayKey } from "../lib/format";
import { routes, seedCustomers } from "./seed";
import type { Customer } from "./types";

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = prng(2026);
const noise = (amp: number) => (r() * 2 - 1) * amp;

export const productGroups = [
  { id: "a2", label: "A2 cow milk", price: 48, color: "#2a78d6" }, // average price per unit sold
  { id: "buff", label: "Buffalo milk", price: 42, color: "#eb6834" },
  { id: "toned", label: "Toned milk", price: 30, color: "#1baf7a" },
  { id: "cultured", label: "Dahi & taak", price: 45, color: "#eda100" },
  { id: "premium", label: "Ghee, paneer & sweets", price: 220, color: "#e87ba4" },
] as const;
export type GroupId = (typeof productGroups)[number]["id"];

export const routeKm: Record<string, number> = { r1: 18, r2: 26, r3: 31, r4: 22, r5: 28 };
const routeBase: Record<string, number> = { r1: 0.92, r2: 1.18, r3: 0.98, r4: 0.82, r5: 0.88 };
const routeLate: Record<string, number> = { r1: 0.6, r2: 1.2, r3: 3.4, r4: 1.0, r5: 2.4 };
const mixBase: Record<GroupId, number> = { a2: 15.5, buff: 7, toned: 5, cultured: 4.6, premium: 1.15 }; // units per route per day, six months ago

export interface DayRow {
  date: string;
  dow: number;
  route: string;
  units: Record<GroupId, number>;
  revenue: number;
  litres: number;
  drops: number;
  onTimePct: number;
  complaints: number;
  skips: number;
  bottlesOut: number;
  bottlesBack: number;
  minutes: number;
}

const DAYS = 180;
const today = new Date();
const festival = new Set([18, 47, 96, 131, 160]); // days-ago indexes with festival bumps

export const dayRows: DayRow[] = (() => {
  const rows: DayRow[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const dow = d.getDay();
    const growth = 1 + ((DAYS - 1 - i) / DAYS) * 0.34; // ~34% growth over six months
    const weekend = dow === 0 ? 1.12 : dow === 6 ? 1.07 : dow === 1 ? 0.96 : 1;
    const fest = festival.has(i) ? 1.22 : 1;
    const monsoon = i > 70 && i < 130 ? 0.97 : 1;
    for (const rt of routes) {
      const k = routeBase[rt.id]! * growth * weekend * monsoon;
      const units = {} as Record<GroupId, number>;
      for (const g of productGroups) {
        const premiumBoost = g.id === "premium" || g.id === "cultured" ? fest * (dow === 0 ? 1.4 : 1) : fest;
        units[g.id] = Math.max(0, mixBase[g.id] * k * premiumBoost * (1 + noise(0.08)) * (g.id === "premium" ? 1 + (DAYS - i) / 400 : 1));
      }
      const revenue = productGroups.reduce((s, g) => s + units[g.id] * g.price, 0); // milk units are 500 ml bottles or pouches
      const litres = (units.a2 + units.buff + units.toned) * 0.5;
      const drops = Math.round(litres / 1.05);
      const late = Math.max(0, routeLate[rt.id]! * (i > 70 && i < 130 ? 1.8 : 1) + noise(1.2));
      const complaints = r() < drops * (0.008 + late / 700) ? 1 : 0;
      const bottlesOut = Math.round((units.a2 + units.buff) * 0.97);
      rows.push({
        date: dayKey(d),
        dow,
        route: rt.id,
        units,
        revenue: Math.round(revenue),
        litres,
        drops,
        onTimePct: Math.min(100, +(100 - late).toFixed(1)),
        complaints,
        skips: Math.max(0, drops * (0.035 + noise(0.012)) * (dow === 0 ? 1.6 : 1)),
        bottlesOut,
        bottlesBack: Math.round(bottlesOut * (0.955 - (rt.id === "r3" ? 0.03 : 0) + noise(0.012))),
        minutes: Math.round(drops * 2.4 + routeKm[rt.id]! * 2.2 + noise(6)),
      });
    }
  }
  return rows;
})();

export const allDates = [...new Set(dayRows.map((d) => d.date))];

/** Network totals per day, used by the hub overview */
export const dailyTotals = allDates.map((date) => {
  const rs = dayRows.filter((x) => x.date === date);
  const drops = rs.reduce((s, x) => s + x.drops, 0);
  return {
    date,
    litres: Math.round(rs.reduce((s, x) => s + x.litres, 0)),
    revenue: Math.round(rs.reduce((s, x) => s + x.revenue, 0)),
    drops,
    onTime: +(rs.reduce((s, x) => s + x.onTimePct * x.drops, 0) / (drops || 1)).toFixed(1),
    complaints: rs.reduce((s, x) => s + x.complaints, 0),
  };
});

/* ---------- Unit economics ---------- */
export const ECON = {
  cogsPct: 0.56, // milk procurement + processing as share of revenue
  riderPerDrop: 14,
  evPerKm: 2.4,
  bottleCost: 22,
  hubOverheadPerDay: 2600,
};

export function routeEconomics(rows: DayRow[]) {
  return routes.map((rt) => {
    const rs = rows.filter((x) => x.route === rt.id);
    const days = new Set(rs.map((x) => x.date)).size || 1;
    const revenue = rs.reduce((s, x) => s + x.revenue, 0);
    const drops = rs.reduce((s, x) => s + x.drops, 0);
    const minutes = rs.reduce((s, x) => s + x.minutes, 0);
    const cogs = revenue * ECON.cogsPct;
    const rider = drops * ECON.riderPerDrop;
    const vehicle = days * routeKm[rt.id]! * ECON.evPerKm * 2;
    const bottleLoss = rs.reduce((s, x) => s + (x.bottlesOut - x.bottlesBack), 0) * ECON.bottleCost;
    const margin = revenue - cogs - rider - vehicle - bottleLoss;
    const complaints = rs.reduce((s, x) => s + x.complaints, 0);
    return {
      route: rt,
      revenue,
      cogs,
      rider,
      vehicle,
      bottleLoss,
      margin,
      marginPct: revenue ? (margin / revenue) * 100 : 0,
      perDrop: drops ? margin / drops : 0,
      dropsPerHour: minutes ? (drops / minutes) * 60 : 0,
      revPerKm: revenue / (days * routeKm[rt.id]! * 2),
      onTime: rs.reduce((s, x) => s + x.onTimePct, 0) / (rs.length || 1),
      complaintsPer1k: drops ? (complaints / drops) * 1000 : 0,
      returnRate: rs.reduce((s, x) => s + x.bottlesBack, 0) / (rs.reduce((s, x) => s + x.bottlesOut, 0) || 1),
      drops,
    };
  });
}

/* ---------- Cohorts ---------- */
export const cohorts = (() => {
  const out: { label: string; size: number; retention: (number | null)[] }[] = [];
  for (let m = 11; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    const size = Math.round(22 + (11 - m) * 3.4 + noise(5));
    const quality = 1 + (11 - m) * 0.006; // onboarding improved over the year
    const retention: (number | null)[] = [];
    for (let k = 0; k <= 11; k++) {
      if (k > m) retention.push(null);
      else if (k === 0) retention.push(100);
      else {
        const base = 100 * Math.pow(0.86, Math.min(k, 2)) * Math.pow(0.975, Math.max(0, k - 2)) * Math.min(1.08, quality);
        retention.push(Math.min(100, Math.round(base + noise(2.5))));
      }
    }
    out.push({ label, size, retention });
  }
  return out;
})();

/* ---------- Customer scoring ---------- */
export interface Scored {
  c: Customer;
  daily: number;
  tenureDays: number;
  skipRate: number;
  complaints90: number;
  daysOfWallet: number;
  ltv: number;
  risk: number;
  segment: Segment;
  reasons: string[];
}
export type Segment = "Champions" | "Loyal" | "New" | "At risk" | "Light buyers";
export const segmentColors: Record<Segment, string> = {
  Champions: "#2a78d6",
  Loyal: "#1baf7a",
  New: "#eda100",
  "At risk": "#eb6834",
  "Light buyers": "#e87ba4",
};

const custR = prng(77);
const custTraits = new Map(seedCustomers.map((c) => [c.id, { skip: custR() * 0.22, comp: Math.floor(custR() * custR() * 5) }]));

export function scoreCustomers(customers: Customer[], dailyValue: (c: Customer) => number): Scored[] {
  return customers.map((c) => {
    const t = custTraits.get(c.id) ?? { skip: 0.05, comp: 0 };
    const daily = dailyValue(c);
    const tenureDays = Math.max(1, Math.round((today.getTime() - new Date(c.since).getTime()) / 864e5));
    const daysOfWallet = daily ? c.wallet / daily : 99;
    const ltv = daily * Math.min(tenureDays, 720) * (1 - t.skip);
    const reasons: string[] = [];
    let risk = 0;
    if (daysOfWallet < 2) { risk += 30; reasons.push(c.wallet < 0 ? "Negative wallet" : "Wallet almost empty"); }
    if (t.skip > 0.14) { risk += 25; reasons.push(`Skips ${Math.round(t.skip * 100)}% of days`); }
    if (t.comp >= 2) { risk += 20; reasons.push(`${t.comp} complaints in 90 days`); }
    if (tenureDays < 45) { risk += 10; reasons.push("First 45 days"); }
    if (c.status === "paused") { risk += 25; reasons.push("Paused deliveries"); }
    risk = Math.min(99, risk + Math.round(t.skip * 20));
    const segment: Segment =
      risk >= 45 ? "At risk" : tenureDays < 60 ? "New" : daily >= 140 && tenureDays > 240 ? "Champions" : daily < 75 ? "Light buyers" : "Loyal";
    return { c, daily, tenureDays, skipRate: t.skip, complaints90: t.comp, daysOfWallet, ltv, risk, segment, reasons };
  });
}

/* ---------- Funnel (last 30 days) ---------- */
export const funnel = [
  { stage: "Visited the site", value: 4820 },
  { stage: "Checked their area", value: 1960 },
  { stage: "Verified mobile", value: 642 },
  { stage: "Placed first order", value: 311 },
  { stage: "Still active after 30 days", value: 252 },
];

/* ---------- Helpers ---------- */
export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export function movingAvg(values: number[], n = 7) {
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - n + 1), i + 1);
    return w.length < n ? null : sum(w) / n;
  });
}
