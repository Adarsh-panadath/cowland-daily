import { test } from "node:test";
import assert from "node:assert/strict";
import { generateStops, itemsOn, lineTotal, netCharged, planOn, refundableOn, shortLines } from "../src/store/rules";
import { planRoute } from "../src/lib/routePlan";
import { routeById, seedCustomers, seedStops } from "../src/data/seed";
import type { Customer, Txn } from "../src/data/types";

const base: Customer = {
  id: "c-900", name: "Test family", contact: "Test Person", flat: "A-101", society: "Anand Vihar", area: "Samarth Nagar",
  routeId: "r4", phone: "+91 90000 00001", plan: [{ productId: "a2", qty: 3 }], wallet: 1000, since: "2026-01-01", status: "active", dropNote: "",
};

test("a regular quantity of three can be two for one date while other dates stay at three", () => {
  const o = { qty: { a2: 2 } };
  assert.deepEqual(itemsOn(base, o, "2026-10-12"), [{ productId: "a2", qty: 2 }]);
  assert.deepEqual(itemsOn(base, undefined, "2026-10-13"), [{ productId: "a2", qty: 3 }]);
  assert.deepEqual(itemsOn(base, { qty: { a2: 0 } }, "2026-10-12"), []);
});

test("skipped and vacation days have no items, even with extras recorded", () => {
  assert.deepEqual(itemsOn(base, { status: "vacation", qty: { paneer: 1 } }, "2026-10-12"), []);
  assert.deepEqual(itemsOn(base, { status: "skipped" }, "2026-10-12"), []);
});

test("plan changes apply only from their effective date", () => {
  const c = { ...base, planChanges: [{ from: "2026-10-15", items: [{ productId: "a2", qty: 1 }] }] };
  assert.equal(planOn(c, "2026-10-14")[0]!.qty, 3);
  assert.equal(planOn(c, "2026-10-15")[0]!.qty, 1);
});

test("new households get nothing before their start date", () => {
  const c = { ...base, startDate: "2026-10-12" };
  assert.deepEqual(itemsOn(c, undefined, "2026-10-11"), []);
  assert.equal(itemsOn(c, undefined, "2026-10-12").length, 1);
});

test("order generation is idempotent and holds orders the wallet can't cover", () => {
  const poor = { ...base, id: "c-901", wallet: 50 };
  const away = { ...base, id: "c-902" };
  const overrides = { "c-902": { "2026-10-12": { status: "vacation" as const } } };
  const a = generateStops([base, poor, away], overrides, "2026-10-12", {});
  const b = generateStops([base, poor, away], overrides, "2026-10-12", {});
  assert.deepEqual(a, b);
  assert.equal(a.length, 2, "vacation household has no order");
  assert.equal(new Set(a.map((s) => s.orderId)).size, 2, "one order per household per date");
  assert.equal(a.find((s) => s.customerId === "c-901")!.status, "held");
  assert.equal(a.find((s) => s.customerId === "c-900")!.status, "pending");
});

test("partial delivery: only delivered lines are charged; the rest is listed as short", () => {
  const ordered = [{ productId: "a2", qty: 2 }, { productId: "paneer", qty: 1 }];
  const delivered = [{ productId: "a2", qty: 2 }];
  assert.equal(lineTotal(delivered), 96);
  assert.deepEqual(shortLines(ordered, delivered), [{ productId: "paneer", qty: 1 }]);
});

test("refunds are bounded by the net amount still charged on the order", () => {
  const t = (kind: Txn["kind"], amount: number): Txn => ({ id: Math.random().toString(), customerId: "c", at: "", kind, amount, note: "", orderId: "O1" });
  const txns = [t("debit", 96), t("refund", 96), t("debit", 96), t("refund", 30)];
  assert.equal(netCharged("O1", txns), 66);
  assert.equal(refundableOn("O1", txns), 66);
  assert.equal(refundableOn("OTHER", txns), 0);
});

test("route planner never suggests a longer drive than the current order", () => {
  for (const r of ["r1", "r2", "r3", "r4", "r5"]) {
    const stops = seedStops.filter((s) => s.routeId === r);
    const p = planRoute(stops, seedCustomers, routeById[r]!);
    assert.ok(p.after.driveMin <= p.before.driveMin + 1e-9, `route ${r}`);
    assert.equal(p.suggested.length, stops.length);
    assert.deepEqual(new Set(p.suggested.map((s) => s.id)), new Set(stops.map((s) => s.id)));
  }
});
