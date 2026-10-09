/**
 * Route planner for one van's morning run.
 *
 * Everything here is illustrative: homes get synthetic map positions (we have no real geocodes),
 * travel time comes from straight-line distance with a road factor and an assumed dawn speed,
 * and each door has a fixed service time. The comparison is fair because the current order and
 * the suggested order are scored with exactly the same model.
 */
import type { Customer, Route, Stop } from "../data/types";

export const PLAN_ASSUMPTIONS = {
  speedKmh: 20, // EV van on empty dawn streets
  roadFactor: 1.35, // roads are longer than a straight line
  serviceMin: 1.4, // park, climb, drop, collect empties
  perItemMin: 0.15, // each extra line in the bag
  leaveBeforeWindowMin: 15, // van leaves the hub this long before the window opens
};

export interface Pt { x: number; y: number } // km from the hub

/** Small deterministic hash so the same society always lands in the same place. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

const sector: Record<string, { angle: number; dist: number }> = {
  r1: { angle: 0.3, dist: 1.8 },
  r2: { angle: 1.6, dist: 4.2 },
  r3: { angle: 3.4, dist: 3.6 },
  r4: { angle: 4.6, dist: 2.6 },
  r5: { angle: 5.7, dist: 4.8 },
};

export function positionOf(c: Customer): Pt {
  const s = sector[c.routeId] ?? { angle: 0, dist: 3 };
  const cx = Math.cos(s.angle) * s.dist;
  const cy = Math.sin(s.angle) * s.dist;
  // society within ~1.4 km of the route's centre, flat within ~60 m of its society gate
  const a = hash(c.society) * Math.PI * 2;
  const r = 0.35 + hash(c.society + "r") * 1.05;
  const fa = hash(c.flat + c.id) * Math.PI * 2;
  const fr = 0.015 + hash(c.id) * 0.045;
  return { x: cx + Math.cos(a) * r + Math.cos(fa) * fr, y: cy + Math.sin(a) * r + Math.sin(fa) * fr };
}

const HUB: Pt = { x: 0, y: 0 };
const km = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) * PLAN_ASSUMPTIONS.roadFactor;
const drive = (a: Pt, b: Pt) => (km(a, b) / PLAN_ASSUMPTIONS.speedKmh) * 60;

/** "5:15 – 6:15 AM" → [315, 375] minutes after midnight */
export function windowOf(route: Route): [number, number] {
  const m = [...route.window.matchAll(/(\d{1,2}):(\d{2})/g)].map((x) => Number(x[1]) * 60 + Number(x[2]));
  return [m[0] ?? 315, m[1] ?? 375];
}

export interface PlanScore {
  driveMin: number;
  km: number;
  finishMin: number;
  late: number;
  arrivals: number[];
}

export function score(order: Stop[], pos: Map<string, Pt>, route: Route): PlanScore {
  const [open, close] = windowOf(route);
  let t = open - PLAN_ASSUMPTIONS.leaveBeforeWindowMin;
  let at = HUB;
  let driveMin = 0;
  let dist = 0;
  const arrivals: number[] = [];
  for (const s of order) {
    const p = pos.get(s.customerId)!;
    const d = drive(at, p);
    driveMin += d;
    dist += km(at, p);
    t += d;
    t = Math.max(t, open); // never drop before the window opens
    arrivals.push(t);
    t += PLAN_ASSUMPTIONS.serviceMin + PLAN_ASSUMPTIONS.perItemMin * Math.max(0, s.items.length - 1);
    at = p;
  }
  return { driveMin, km: dist, finishMin: arrivals.at(-1) ?? open, late: arrivals.filter((a) => a > close).length, arrivals };
}

/** Total driving along an open path that starts at the hub. */
function pathCost(ids: number[], d: number[][]) {
  let c = d[0]![ids[0]! + 1]!;
  for (let i = 1; i < ids.length; i++) c += d[ids[i - 1]! + 1]![ids[i]! + 1]!;
  return c;
}

/** 2-opt on an open path anchored at the hub. Reverses segments while that shortens the drive. */
function twoOpt(start: number[], d: number[][]) {
  let best = start.slice();
  let bestCost = pathCost(best, d);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const c = pathCost(cand, d);
        if (c < bestCost - 1e-9) {
          best = cand;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return best;
}

export interface PlanResult {
  current: Stop[];
  suggested: Stop[];
  before: PlanScore;
  after: PlanScore;
  positions: Map<string, Pt>;
  better: boolean;
}

/**
 * Suggest a stop order: nearest-neighbour from the hub, then 2-opt. The current order is also
 * improved with 2-opt, and the shorter of the two wins, so the suggestion is never worse than today.
 */
export function planRoute(stops: Stop[], customers: Customer[], route: Route): PlanResult {
  const current = stops.slice().sort((a, b) => a.seq - b.seq);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const positions = new Map(current.map((s) => [s.customerId, positionOf(byId.get(s.customerId)!)]));
  const pts = [HUB, ...current.map((s) => positions.get(s.customerId)!)];
  const d = pts.map((a) => pts.map((b) => drive(a, b)));

  // nearest neighbour
  const left = new Set(current.map((_, i) => i));
  const nn: number[] = [];
  let at = -1;
  while (left.size) {
    let pick = -1;
    let bestD = Infinity;
    for (const j of left) {
      const v = d[at + 1]![j + 1]!;
      if (v < bestD) { bestD = v; pick = j; }
    }
    nn.push(pick);
    left.delete(pick);
    at = pick;
  }
  const a = twoOpt(nn, d);
  const b = twoOpt(current.map((_, i) => i), d);
  const best = pathCost(a, d) <= pathCost(b, d) ? a : b;
  const suggested = best.map((i) => current[i]!);
  const before = score(current, positions, route);
  const after = score(suggested, positions, route);
  return { current, suggested, before, after, positions, better: after.driveMin < before.driveMin - 0.5 };
}

/**
 * Extra van minutes to add one more home in a society, inserted at the cheapest point of the
 * route's current order (detour driving plus the door's service time).
 */
export function extraMinutesFor(order: Stop[], customers: Customer[], society: string, routeId: string): number {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const pts = [HUB, ...order.slice().sort((a, b) => a.seq - b.seq).map((s) => positionOf(byId.get(s.customerId)!))];
  const probe = positionOf({ id: `new-${society}`, flat: "NEW", society, routeId } as Customer);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1];
    const add = b ? drive(a, probe) + drive(probe, b) - drive(a, b) : drive(a, probe);
    best = Math.min(best, add);
  }
  return best + PLAN_ASSUMPTIONS.serviceMin;
}
