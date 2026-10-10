/**
 * Pure business rules shared by the store and the tests.
 * No React, no storage: given the same inputs they always return the same answer.
 */
import type { Customer, DayOverride, Exception, LineItem, OrderLink, Stop, Txn } from "../data/types";
import { productById, orderIdFor } from "../data/seed";

export const lineTotal = (items: LineItem[]) =>
  items.reduce((s, i) => s + (productById[i.productId]?.price ?? 0) * i.qty, 0);

export const mergeItems = (a: LineItem[], b: LineItem[]) => {
  const map = new Map<string, number>();
  for (const i of [...a, ...b]) map.set(i.productId, (map.get(i.productId) ?? 0) + i.qty);
  return [...map.entries()].filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
};

/** The regular plan in force on a delivery date (plan changes take effect from their `from` date). */
export function planOn(c: Customer, date: string): LineItem[] {
  const changes = (c.planChanges ?? []).filter((p) => p.from <= date).sort((a, b) => a.from.localeCompare(b.from));
  return changes.length ? changes[changes.length - 1]!.items : c.plan;
}

/** What should be delivered to a customer on a date: plan, then that day's absolute quantities, minus skips. */
export function itemsOn(c: Customer, o: DayOverride | undefined, date: string): LineItem[] {
  if (c.startDate && date < c.startDate) return [];
  if (o?.status === "skipped" || o?.status === "vacation") return [];
  const map = new Map<string, number>();
  for (const i of planOn(c, date)) map.set(i.productId, i.qty);
  for (const [pid, q] of Object.entries(o?.qty ?? {})) map.set(pid, q);
  return [...map.entries()].filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
}

/** Quantity of one product on a date, after overrides */
export const qtyOn = (c: Customer, o: DayOverride | undefined, date: string, pid: string) =>
  itemsOn(c, o, date).find((i) => i.productId === pid)?.qty ?? 0;

const glassCount = (items: LineItem[]) => items.filter((i) => i.productId === "a2" || i.productId === "buff").reduce((s, i) => s + i.qty, 0);

/** One-off additions on a date: paid redeliveries and free replacements, each tied to a ticket. */
export function oneOffsOn(o: DayOverride | undefined): { add: LineItem[]; free: Record<string, number>; links: OrderLink[] } {
  if (o?.status === "skipped" || o?.status === "vacation") return { add: [], free: {}, links: [] };
  const add = Object.entries(o?.add ?? {}).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
  const free = Object.fromEntries(Object.entries(o?.free ?? {}).filter(([, q]) => q > 0));
  return { add, free, links: o?.links ?? [] };
}

/** Today's catalogue prices for the products in an order, stored on it so later charges never change. */
export const pricesFor = (items: LineItem[]) => Object.fromEntries(items.map((i) => [i.productId, productById[i.productId]?.price ?? 0]));

/**
 * Build the morning's run for a date. Idempotent: the same inputs give the same orders and IDs,
 * so regenerating never creates duplicates. Route order follows `prevSeq` (the last known sequence),
 * with new households added at the end of their route.
 */
export function generateStops(customers: Customer[], overrides: Record<string, Record<string, DayOverride>>, date: string, prevSeq: Record<string, number>): Stop[] {
  const byRoute = new Map<string, Customer[]>();
  for (const c of customers) {
    if (c.status !== "active") continue;
    byRoute.set(c.routeId, [...(byRoute.get(c.routeId) ?? []), c]);
  }
  const out: Stop[] = [];
  for (const [routeId, cs] of byRoute) {
    cs.sort((a, b) => (prevSeq[a.id] ?? 9999) - (prevSeq[b.id] ?? 9999) || a.id.localeCompare(b.id));
    let seq = 0;
    for (const c of cs) {
      const o = overrides[c.id]?.[date];
      const base = itemsOn(c, o, date);
      const one = oneOffsOn(c.startDate && date < c.startDate ? undefined : o);
      const freeLines = Object.entries(one.free).map(([productId, qty]) => ({ productId, qty }));
      const items = mergeItems(mergeItems(base, one.add), freeLines);
      if (!items.length) continue;
      const total = lineTotal(mergeItems(base, one.add)); // free replacements are never charged
      seq++;
      const held = total > 0 && c.wallet < total;
      out.push({
        id: `s-${c.id}-${date}`,
        orderId: orderIdFor(date, c.id),
        date,
        customerId: c.id,
        routeId,
        seq,
        items,
        prices: pricesFor(items),
        free: Object.keys(one.free).length ? one.free : undefined,
        links: one.links.length ? one.links : undefined,
        status: held ? "held" : "pending",
        bottlesDue: glassCount(planOn(c, date)),
        bottlesCollected: 0,
        holdReason: held ? `Wallet ₹${c.wallet} is below this order's ₹${total}` : undefined,
      });
    }
  }
  return out;
}

/** Unit price on an order (the price when it was built), falling back to the catalogue. */
export const priceOf = (stop: Pick<Stop, "prices"> | undefined, pid: string) => stop?.prices?.[pid] ?? productById[pid]?.price ?? 0;

/** Value of some lines at an order's own prices. */
export const orderValue = (stop: Pick<Stop, "prices"> | undefined, lines: LineItem[]) => lines.reduce((s, l) => s + priceOf(stop, l.productId) * l.qty, 0);

const qtyIn = (lines: LineItem[] | undefined, pid: string) => lines?.find((l) => l.productId === pid)?.qty ?? 0;

/** Of what was handed over, how many of a product are paid (free replacement quantities are delivered last). */
export function paidDeliveredQty(stop: Stop, delivered: LineItem[] | undefined, pid: string) {
  const ordered = qtyIn(stop.items, pid);
  const free = stop.free?.[pid] ?? 0;
  return Math.min(qtyIn(delivered, pid), Math.max(0, ordered - free));
}

/** What a delivery costs: only what reached the door, at the order's prices, never the free replacements. */
export function chargeFor(stop: Stop, delivered: LineItem[]) {
  return delivered.reduce((s, d) => s + priceOf(stop, d.productId) * paidDeliveredQty(stop, delivered, d.productId), 0);
}

/** Undelivered lines: ordered minus delivered */
export function shortLines(ordered: LineItem[], delivered: LineItem[]): LineItem[] {
  return ordered
    .map((o) => ({ productId: o.productId, qty: o.qty - (delivered.find((d) => d.productId === o.productId)?.qty ?? 0) }))
    .filter((x) => x.qty > 0);
}

/** Net amount currently charged on an order: debits minus refunds and reversals, from the ledger. */
export function netCharged(orderId: string, txns: Txn[]): number {
  let n = 0;
  for (const t of txns) if (t.orderId === orderId) n += t.kind === "debit" ? t.amount : t.kind === "refund" || t.kind === "reversal" ? -t.amount : 0;
  return n;
}

/** Most that can still be refunded on an order: never more than what is currently charged. */
export const refundableOn = (orderId: string | undefined, txns: Txn[]) => (orderId ? Math.max(0, netCharged(orderId, txns)) : 0);

/** Most a ticket that isn't linked to an order can credit as goodwill. */
export const GOODWILL_CAP = 50;

/**
 * Value (₹) already given back per product on an order, by resolved tickets: refunds
 * (spread over the ticket's items) and free replacements.
 */
export function compensatedValue(stop: Stop, exceptions: Exception[], skipId?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of exceptions) {
    if (e.id === skipId || e.orderId !== stop.orderId || e.status !== "resolved" || !e.items?.length) continue;
    if (e.compensation?.kind === "replacement") for (const i of e.compensation.items ?? []) out[i.productId] = (out[i.productId] ?? 0) + i.qty * priceOf(stop, i.productId);
    let rem = e.refund ?? 0;
    for (const i of e.items) {
      if (rem <= 0) break;
      const v = Math.min(rem, i.qty * priceOf(stop, i.productId));
      out[i.productId] = (out[i.productId] ?? 0) + v;
      rem -= v;
    }
  }
  return out;
}

/** Paid, delivered value of a product on an order that hasn't been compensated yet. */
function openValue(stop: Stop, pid: string, comp: Record<string, number>) {
  return Math.max(0, paidDeliveredQty(stop, stop.delivered, pid) * priceOf(stop, pid) - (comp[pid] ?? 0));
}

/**
 * Most a ticket can refund: never more than is still charged on its order, and when the ticket
 * names items, only the delivered, paid-for part of them that hasn't already been refunded or replaced.
 */
export function refundCap(ex: Exception, stop: Stop | undefined, txns: Txn[], exceptions: Exception[] = []): number {
  if (!ex.orderId) return GOODWILL_CAP;
  const order = refundableOn(ex.orderId, txns);
  if (!ex.items?.length || !stop) return order;
  if (stop.status !== "delivered") return 0;
  const comp = compensatedValue(stop, exceptions, ex.id);
  const items = ex.items.reduce((s, i) => s + Math.min(i.qty * priceOf(stop, i.productId), openValue(stop, i.productId, comp)), 0);
  return Math.min(order, items);
}

/** Delivered, paid-for items on a ticket that can still be replaced free (not yet refunded or replaced). */
export function replaceable(ex: Exception, stop: Stop | undefined, exceptions: Exception[]): LineItem[] {
  if (!stop || stop.status !== "delivered" || !ex.items?.length) return [];
  const comp = compensatedValue(stop, exceptions, ex.id);
  return ex.items
    .map((i) => ({ productId: i.productId, qty: Math.min(i.qty, Math.floor(openValue(stop, i.productId, comp) / Math.max(1, priceOf(stop, i.productId)))) }))
    .filter((l) => l.qty > 0);
}

/** Items on a ticket that never reached the door and haven't been rescheduled yet. */
export function retryable(ex: Exception, stop: Stop | undefined, exceptions: Exception[]): LineItem[] {
  if (!stop || (stop.status !== "delivered" && stop.status !== "issue") || !ex.items?.length) return [];
  const already: Record<string, number> = {};
  for (const e of exceptions) {
    if (e.id === ex.id || e.orderId !== stop.orderId || e.compensation?.kind !== "retry") continue;
    for (const i of e.compensation.items ?? []) already[i.productId] = (already[i.productId] ?? 0) + i.qty;
  }
  return ex.items
    .map((i) => ({ productId: i.productId, qty: Math.min(i.qty, qtyIn(stop.items, i.productId) - qtyIn(stop.delivered, i.productId) - (already[i.productId] ?? 0)) }))
    .filter((l) => l.qty > 0);
}

/* ---------- spares on the van ---------- */

/** Every van leaves the hub with this many spares of each product on its route's orders. */
export const SPARES_PER_ITEM = 2;

/** The order as it was packed at the hub, before any spares were bought from the van. */
export const packedItems = (s: Stop) => shortLines(s.items, s.fromVan ?? []);

/**
 * Spares still on a route's van. Spares sold to homes that were then marked as a problem
 * (not delivered) go back on the van.
 */
export function sparesLeft(stops: Stop[], routeId: string): Record<string, number> {
  const rs = stops.filter((s) => s.routeId === routeId && s.status !== "held");
  const left: Record<string, number> = {};
  for (const s of rs) for (const i of packedItems(s)) left[i.productId] = SPARES_PER_ITEM;
  for (const s of rs) {
    if (s.status === "issue") continue;
    for (const i of s.fromVan ?? []) left[i.productId] = (left[i.productId] ?? 0) - i.qty;
  }
  return left;
}

/** Revenue from spares that reached a door (only delivered lines count). */
export function vanSalesValue(stops: Stop[]) {
  let sold = 0;
  let onTheWay = 0;
  let units = 0;
  for (const s of stops) {
    for (const v of s.fromVan ?? []) {
      if (s.status === "delivered") {
        const got = Math.min(v.qty, s.delivered?.find((d) => d.productId === v.productId)?.qty ?? 0);
        sold += priceOf(s, v.productId) * got;
        units += got;
      } else if (s.status === "pending") onTheWay += priceOf(s, v.productId) * v.qty;
    }
  }
  return { sold, onTheWay, units };
}

/* ---------- integrity checks shown on the demo database page ---------- */

export interface Check { id: string; label: string; ok: boolean; detail: string }

/**
 * Checks that must always hold if every click did exactly what it should.
 * `opening` is each household's wallet when the demo started (or when it signed up).
 */
export function integrityChecks(d: { customers: Customer[]; stops: Stop[]; txns: Txn[]; opening: Record<string, number>; today?: string }): Check[] {
  const out: Check[] = [];
  const name = (id: string) => d.customers.find((c) => c.id === id)?.contact ?? id;

  // 1. wallets: opening balance + every movement in the ledger = balance now
  const moved = new Map<string, number>();
  for (const t of d.txns) if (t.live) moved.set(t.customerId, (moved.get(t.customerId) ?? 0) + (t.kind === "debit" ? -t.amount : t.amount));
  const off = d.customers.filter((c) => (d.opening[c.id] ?? c.wallet) + (moved.get(c.id) ?? 0) !== c.wallet);
  out.push({ id: "wallets", label: "Every wallet matches its ledger", ok: off.length === 0, detail: off.length ? `${off.length} don't match: ${off.slice(0, 3).map((c) => name(c.id)).join(", ")}` : `${d.customers.length} wallets = opening balance + top-ups + refunds + reversals − charges` });

  // 2. nobody pays for what didn't reach them
  const over = d.stops.filter((s) => netCharged(s.orderId, d.txns) > (s.status === "delivered" ? chargeFor(s, s.delivered ?? []) : 0));
  out.push({ id: "paid-for", label: "Nobody pays for milk they didn't get", ok: over.length === 0, detail: over.length ? `${over.length} orders charged above what was delivered` : `${d.stops.length} orders: charge ≤ value delivered` });

  // 3. charges match what was handed over (order prices, free replacements excluded)
  const delivered = d.stops.filter((s) => s.status === "delivered");
  const wrong = delivered.filter((s) => s.charged !== chargeFor(s, s.delivered ?? []));
  out.push({ id: "matches", label: "Charges match what was handed over", ok: wrong.length === 0, detail: wrong.length ? `${wrong.length} orders charged differently from their delivery` : "At the order's own prices, free replacements never charged" });

  // 4. each delivery charged once: every undo leaves exactly one reversal
  const bad = d.stops.filter((s) => {
    const mine = d.txns.filter((t) => t.orderId === s.orderId);
    const debits = mine.filter((t) => t.kind === "debit");
    const live = debits.length - mine.filter((t) => t.kind === "reversal").length;
    if (s.status !== "delivered") return live !== 0;
    return live !== (s.charged ? 1 : 0) || (s.charged ? debits[0]!.amount !== s.charged : false);
  });
  out.push({ id: "once", label: "Each delivery is charged exactly once", ok: bad.length === 0, detail: bad.length ? `${bad.length} orders don't match their charge` : `${delivered.length} delivered orders, one live charge each; every undo has its reversal` });

  // 5. one order per household per day
  const seen = new Set<string>();
  let dup = 0;
  for (const s of d.stops) { const k = `${s.customerId}|${s.date}`; if (seen.has(k)) dup++; seen.add(k); }
  out.push({ id: "one-order", label: "One order per household per day", ok: dup === 0, detail: dup ? `${dup} duplicate orders` : `${d.stops.length} orders on record` });

  // 6. spares (this morning's vans)
  const run = d.today ? d.stops.filter((s) => s.date === d.today) : d.stops;
  const routesOn = [...new Set(run.map((s) => s.routeId))];
  const oversold = routesOn.flatMap((r) => Object.entries(sparesLeft(run, r)).filter(([, n]) => n < 0).map(([p]) => `${r}:${p}`));
  out.push({ id: "spares", label: "Spares sold never exceed what the van carried", ok: oversold.length === 0, detail: oversold.length ? `Oversold: ${oversold.join(", ")}` : `${SPARES_PER_ITEM} spares of each item per van` });

  // 7. refunds bounded
  const neg = [...new Set(d.txns.filter((t) => t.orderId).map((t) => t.orderId!))].filter((o) => netCharged(o, d.txns) < 0);
  out.push({ id: "refunds", label: "Refunds never exceed what was paid", ok: neg.length === 0, detail: neg.length ? `${neg.length} orders refunded above their charge` : "Every order's refunds and reversals ≤ its charges" });

  // 8. held orders
  const badHeld = d.stops.filter((s) => s.status === "held" && (s.delivered?.length || netCharged(s.orderId, d.txns) !== 0));
  out.push({ id: "held", label: "Held orders stay off the van and uncharged", ok: badHeld.length === 0, detail: `${run.filter((s) => s.status === "held").length} held this morning` });

  return out;
}

/** What an order costs if everything on it is delivered (free replacements excluded, order prices). */
export const orderTotal = (stop: Stop) => chargeFor(stop, stop.items);

/** What a day will cost: the customer's items plus paid redeliveries (free replacements excluded). */
export const chargeableOn = (c: Customer, o: DayOverride | undefined, date: string) =>
  lineTotal(itemsOn(c, o, date)) + (c.startDate && date < c.startDate ? 0 : lineTotal(oneOffsOn(o).add));
