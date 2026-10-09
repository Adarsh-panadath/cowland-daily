/**
 * Pure business rules shared by the store and the tests.
 * No React, no storage: given the same inputs they always return the same answer.
 */
import type { Customer, DayOverride, Exception, LineItem, Stop, Txn } from "../data/types";
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
      const items = itemsOn(c, overrides[c.id]?.[date], date);
      if (!items.length) continue;
      const total = lineTotal(items);
      seq++;
      const held = c.wallet < total;
      out.push({
        id: `s-${c.id}-${date}`,
        orderId: orderIdFor(date, c.id),
        date,
        customerId: c.id,
        routeId,
        seq,
        items,
        status: held ? "held" : "pending",
        bottlesDue: glassCount(planOn(c, date)),
        bottlesCollected: 0,
        holdReason: held ? `Wallet ₹${c.wallet} is below this order's ₹${total}` : undefined,
      });
    }
  }
  return out;
}

/** Charge only what reached the door. */
export const chargeFor = (delivered: LineItem[]) => lineTotal(delivered);

/** Undelivered lines: ordered minus delivered */
export function shortLines(ordered: LineItem[], delivered: LineItem[]): LineItem[] {
  return ordered
    .map((o) => ({ productId: o.productId, qty: o.qty - (delivered.find((d) => d.productId === o.productId)?.qty ?? 0) }))
    .filter((x) => x.qty > 0);
}

/** Net amount currently charged on an order: debits minus reversals and refunds, from the ledger. */
export function netCharged(orderId: string, txns: Txn[]): number {
  let n = 0;
  for (const t of txns) if (t.orderId === orderId) n += t.kind === "debit" ? t.amount : t.kind === "refund" ? -t.amount : 0;
  return n;
}

/** Most that can still be refunded on an order: never more than what is currently charged. */
export const refundableOn = (orderId: string | undefined, txns: Txn[]) => (orderId ? Math.max(0, netCharged(orderId, txns)) : 0);

/** Most a ticket that isn't linked to an order can credit as goodwill. */
export const GOODWILL_CAP = 50;

/**
 * Most a ticket can refund: never more than is still charged on its order, and when the ticket
 * names items, only the part of those items that was delivered (and so paid for).
 */
export function refundCap(ex: Exception, stop: Stop | undefined, txns: Txn[]): number {
  if (!ex.orderId) return GOODWILL_CAP;
  const order = refundableOn(ex.orderId, txns);
  if (!ex.items?.length || !stop?.delivered) return order;
  const paid = ex.items.map((i) => ({ productId: i.productId, qty: Math.min(i.qty, stop.delivered!.find((d) => d.productId === i.productId)?.qty ?? 0) }));
  return Math.min(order, lineTotal(paid));
}
