// Regression tests for the issues raised in the code review of 65da1c1.
// Every test drives the real store actions (deliver, resolve, undoStop, advanceDay, topUp…).
import "./setup";
import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { useStore, orderById } from "../src/store/useStore";
import { integrityChecks, netCharged, refundCap } from "../src/store/rules";
import { firstEditableDate, todayKey } from "../src/lib/format";
import type { LineItem } from "../src/data/types";

const S = () => useStore.getState();
beforeEach(() => { mock.timers.reset(); S().reset(); });

/** A new household on Route 04 with ₹1,000, then advance to its first delivery morning. */
function household(plan: LineItem[], extra?: LineItem[], topUp = 1000) {
  const start = firstEditableDate();
  const id = S().signup({ name: "Test Person", mobile: `98765${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}`, routeId: "r4", area: "Samarth Nagar", society: "Mayur Park", flat: "C-201", landmark: "", dropNote: "", plan, startDate: start, topUp });
  for (const e of extra ?? []) S().setDayQty(start, e.productId, e.qty);
  while (todayKey() < start) S().advanceDay();
  assert.ok(S().stops.some((s) => s.customerId === id), "first order is on the run");
  return id;
}
const stopOf = (id: string) => S().stops.find((s) => s.customerId === id)!;
const wallet = (id: string) => S().customers.find((c) => c.id === id)!.wallet;
const checksPass = () => {
  const c = integrityChecks({ customers: S().customers, stops: [...S().stops, ...(S().pastOrders ?? [])], txns: S().txns, opening: S().opening });
  for (const x of c) assert.ok(x.ok, `${x.label}: ${x.detail}`);
};
const ticketFor = (orderId: string, source: "rider" | "customer") => S().exceptions.find((e) => e.orderId === orderId && e.source === source)!;

/* ---------- 1. partial delivery quantities and charges ---------- */

for (const [given, charge] of [[3, 144], [2, 96], [1, 48]] as const) {
  test(`deliver 3 → ${given}: records ${given}, charges ₹${charge}${given < 3 ? ", opens a shortage ticket" : ""}`, () => {
    const id = household([{ productId: "a2", qty: 3 }]);
    S().deliver(stopOf(id).id, 0, [{ productId: "a2", qty: given }]);
    const st = stopOf(id);
    assert.equal(st.status, "delivered");
    assert.deepEqual(st.delivered, [{ productId: "a2", qty: given }]);
    assert.equal(st.charged, charge);
    assert.equal(wallet(id), 1000 - charge);
    const t = S().exceptions.find((e) => e.orderId === st.orderId && e.source === "rider");
    if (given < 3) assert.deepEqual(t?.items, [{ productId: "a2", qty: 3 - given }]);
    else assert.equal(t, undefined);
    checksPass();
  });
}

test("deliver 3 → 0 is a failed attempt, not a delivery", () => {
  const id = household([{ productId: "a2", qty: 3 }]);
  S().deliver(stopOf(id).id, 0, [{ productId: "a2", qty: 0 }]);
  const st = stopOf(id);
  assert.equal(st.status, "issue");
  assert.equal(netCharged(st.orderId, S().txns), 0);
  assert.equal(wallet(id), 1000);
  assert.ok(ticketFor(st.orderId, "rider"));
  checksPass();
});

test("mixed products: milk delivered, paneer short → charges milk only", () => {
  const id = household([{ productId: "a2", qty: 2 }], [{ productId: "paneer", qty: 1 }]);
  S().deliver(stopOf(id).id, 0, [{ productId: "a2", qty: 2 }, { productId: "paneer", qty: 0 }]);
  const st = stopOf(id);
  assert.equal(st.charged, 96);
  assert.deepEqual(ticketFor(st.orderId, "rider").items, [{ productId: "paneer", qty: 1 }]);
  checksPass();
});

test("extra handed over from spares is charged at the order's price, capped by spares", () => {
  const id = household([{ productId: "a2", qty: 2 }]);
  S().deliver(stopOf(id).id, 0, [{ productId: "a2", qty: 9 }]);
  const st = stopOf(id);
  assert.equal(st.delivered![0]!.qty, 4, "2 ordered + 2 spares on the van");
  assert.equal(st.charged, 192);
  checksPass();
});

/* ---------- 2. refund, undo and redelivery accounting ---------- */

function deliveredTwo() {
  const id = household([{ productId: "a2", qty: 2 }]);
  S().deliver(stopOf(id).id, 2, [{ productId: "a2", qty: 2 }]);
  return id;
}

test("delivery → undo returns the charge once", () => {
  const id = deliveredTwo();
  S().undoStop(stopOf(id).id);
  S().undoStop(stopOf(id).id);
  assert.equal(wallet(id), 1000);
  checksPass();
});

test("delivery → ₹48 refund → undo returns only the remaining ₹48", () => {
  const id = deliveredTwo();
  const o = stopOf(id).orderId;
  S().signIn("customer", id);
  S().reportIssue("leak", "", [{ productId: "a2", qty: 1 }]);
  assert.equal(S().resolve(S().exceptions[0]!.id, 48, "refund"), 48);
  assert.equal(S().resolve(S().exceptions[0]!.id, 48, "again"), 0, "duplicate refund does nothing");
  S().undoStop(stopOf(id).id);
  assert.equal(wallet(id), 1000);
  const kinds = S().txns.filter((t) => t.orderId === o).map((t) => t.kind).sort();
  assert.deepEqual(kinds, ["debit", "refund", "reversal"], "debit, refund and reversal all kept and told apart");
  assert.equal(S().txns.find((t) => t.orderId === o && t.kind === "reversal")!.amount, 48);
  checksPass();
});

test("delivery → full refund → undo moves no more money", () => {
  const id = deliveredTwo();
  S().signIn("customer", id);
  S().reportIssue("leak", "", [{ productId: "a2", qty: 2 }]);
  assert.equal(S().resolve(S().exceptions[0]!.id, 96, "refund"), 96);
  S().undoStop(stopOf(id).id);
  assert.equal(wallet(id), 1000);
  checksPass();
});

test("delivery → refund → undo → redelivery charges the new delivery once", () => {
  const id = deliveredTwo();
  S().signIn("customer", id);
  S().reportIssue("leak", "", [{ productId: "a2", qty: 1 }]);
  S().resolve(S().exceptions[0]!.id, 48, "refund");
  S().undoStop(stopOf(id).id);
  S().deliver(stopOf(id).id, 2, [{ productId: "a2", qty: 2 }]);
  S().deliver(stopOf(id).id, 2, [{ productId: "a2", qty: 2 }]);
  assert.equal(wallet(id), 904);
  assert.equal(netCharged(stopOf(id).orderId, S().txns), 96);
  checksPass();
});

/* ---------- 3. order history survives the next morning and a reload ---------- */

test("an undelivered item's ticket keeps a ₹0 refund limit after advancing the day and reloading", async () => {
  const id = household([{ productId: "a2", qty: 2 }], [{ productId: "paneer", qty: 1 }]);
  S().deliver(stopOf(id).id, 0, [{ productId: "a2", qty: 2 }]);
  const o = stopOf(id).orderId;
  const t = ticketFor(o, "rider");
  const cap = () => refundCap(t, orderById(S(), o), S().txns);
  assert.equal(cap(), 0);
  S().advanceDay();
  assert.ok(orderById(S(), o), "the delivered order is still on record");
  assert.deepEqual(orderById(S(), o)!.delivered, [{ productId: "a2", qty: 2 }]);
  assert.equal(cap(), 0);
  await useStore.persist.rehydrate();
  assert.equal(cap(), 0);
  assert.equal(S().resolve(t.id, 999, "try"), 0);
  assert.ok(!S().stops.some((s) => s.orderId === o), "yesterday's order is not in today's run");
  checksPass();
});

/* ---------- 4. retries vs free replacements ---------- */

test("never delivered: retry adds it to the next run and charges it on delivery", () => {
  const id = household([{ productId: "a2", qty: 2 }], [{ productId: "paneer", qty: 1 }]);
  const plan = JSON.stringify(S().customers.find((c) => c.id === id)!.plan);
  S().deliver(stopOf(id).id, 0, [{ productId: "a2", qty: 2 }]);
  const t = ticketFor(stopOf(id).orderId, "rider");
  assert.equal(S().scheduleReplacement(t.id), null, "nothing was paid for, so no free replacement");
  const day = S().scheduleRetry(t.id)!;
  assert.ok(day);
  while (todayKey() < day) S().advanceDay();
  const st = stopOf(id);
  S().deliver(st.id);
  assert.equal(stopOf(id).charged, 96 + 110);
  assert.equal(JSON.stringify(S().customers.find((c) => c.id === id)!.plan), plan, "recurring plan untouched");
  checksPass();
});

test("delivered and defective: free replacement on the next run, no extra charge, no double compensation", () => {
  const id = deliveredTwo();
  S().signIn("customer", id);
  S().reportIssue("leak", "", [{ productId: "a2", qty: 2 }]);
  const t = S().exceptions[0]!;
  assert.equal(S().scheduleRetry(t.id), null, "a paid item isn't re-sold as a retry");
  const day = S().scheduleReplacement(t.id)!;
  assert.ok(day);
  // both delivered bottles are now replaced: another complaint about them can't be compensated again
  S().reportIssue("leak", "one of the same bottles", [{ productId: "a2", qty: 1 }]);
  const dup = S().exceptions[0]!;
  assert.equal(S().resolve(dup.id, 48, "refund too"), 0);
  assert.equal(S().scheduleReplacement(dup.id), null);
  while (todayKey() < day) S().advanceDay();
  const st = stopOf(id);
  assert.equal(st.items.find((i) => i.productId === "a2")!.qty, 4, "2 regular + 2 free replacements");
  assert.equal(st.free?.a2, 2);
  const w = wallet(id);
  S().deliver(st.id);
  assert.equal(stopOf(id).charged, 96, "only the 2 regular bottles are charged");
  assert.equal(wallet(id), w - 96);
  checksPass();
});

/* ---------- 5. top-ups never put orders on a van that has left ---------- */

/** ₹100 covers one morning (₹96); after that delivery the next morning's order is held. */
function heldMorning() {
  const id = household([{ productId: "a2", qty: 2 }], [], 100);
  S().deliver(stopOf(id).id);
  S().advanceDay();
  assert.equal(stopOf(id).status, "held");
  S().signIn("customer", id);
  return id;
}

test("top-up before the crate is loaded: back on this morning's run", () => {
  const id = heldMorning();
  S().topUp(500, "UPI");
  assert.equal(stopOf(id).status, "pending");
});

test("top-up after the van left: stays off the van, not charged, next delivery tomorrow", () => {
  const id = heldMorning();
  S().confirmLoad([]);
  S().topUp(500, "UPI");
  assert.equal(stopOf(id).status, "held");
  assert.match(stopOf(id).holdReason!, /left/);
  assert.ok(!S().notices.some((n) => n.role === "rider" && n.text.includes("C-201")), "rider isn't told about a stop that isn't coming");
  S().advanceDay();
  assert.equal(stopOf(id).status, "pending");
});

test("top-up after handover: same, nothing appears on a finished round", () => {
  const id = heldMorning();
  S().confirmLoad([]);
  for (const s of S().stops.filter((x) => x.routeId === "r4" && x.status === "pending")) S().deliver(s.id);
  S().handover(0);
  S().topUp(500, "UPI");
  assert.equal(stopOf(id).status, "held");
  checksPass();
});
