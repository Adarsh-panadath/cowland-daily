import "./setup";
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useStore } from "../src/store/useStore";
import { lineTotal, netCharged, refundableOn, sparesLeft } from "../src/store/rules";
import { ME } from "../src/data/seed";
import { addDays, dayKey, firstEditableDate, fromKey, todayKey, tomorrowKey } from "../src/lib/format";

const S = () => useStore.getState();
const IST = (iso: string) => new Date(`${iso}+05:30`).getTime();

beforeEach(() => {
  mock.timers.reset();
  S().reset();
});

function newHousehold(overrides: Partial<Parameters<ReturnType<typeof S>["signup"]>[0]> = {}) {
  return S().signup({
    name: "Kavita Joshi", mobile: "9876500011", routeId: "r4", area: "Samarth Nagar", society: "Mayur Park", flat: "C-201",
    landmark: "", dropNote: "", plan: [{ productId: "a2", qty: 2 }], startDate: firstEditableDate(), topUp: 1000, ...overrides,
  });
}

test("10 PM IST cutoff: 9:59 PM edit works, 10:00 PM is locked everywhere, plan editor included", () => {
  mock.timers.enable({ apis: ["Date"], now: IST("2026-10-09T21:59:00") });
  S().reset();
  const tmr = tomorrowKey();
  assert.equal(tmr, "2026-10-10");
  assert.equal(S().setDayQty(tmr, "a2", 2), "ok");

  mock.timers.setTime(IST("2026-10-09T22:00:00"));
  assert.equal(S().setDayQty(tmr, "a2", 1), "locked");
  assert.equal(S().setDayStatus(tmr, "skipped"), "locked");
  assert.equal(S().setVacation(tmr, tmr), 0);
  S().cartAdd("paneer", 1);
  assert.equal(S().checkout(tmr), "locked");
  assert.equal(S().overrides[ME]![tmr]!.qty!.a2, 2, "the 9:59 change stands, the 10:00 one doesn't");
  const from = S().savePlan([{ productId: "a2", qty: 1 }]);
  assert.equal(from, "2026-10-11", "plan changes start after the locked day");
  mock.timers.reset();
});

test("new households act as themselves, not as the demo customer", () => {
  const id = newHousehold();
  assert.notEqual(id, ME);
  assert.equal(S().meId, id);
  const d = dayKey(addDays(fromKey(firstEditableDate()), 1));
  assert.equal(S().setDayQty(d, "paneer", 1), "ok");
  assert.equal(S().overrides[id]![d]!.qty!.paneer, 1);
  assert.equal(S().overrides[ME]?.[d]?.qty?.paneer, undefined);
  S().reportIssue("quality", "test");
  assert.equal(S().exceptions[0]!.customerId, id);
  S().topUp(500, "UPI");
  assert.equal(S().customers.find((c) => c.id === id)!.wallet, 1500);
});

test("vacation day: no order, and adding an extra doesn't quietly resume it", () => {
  const d = dayKey(addDays(fromKey(firstEditableDate()), 2));
  assert.equal(S().setVacation(d, d), 1);
  assert.equal(S().setDayQty(d, "a2", 4), "off");
  S().cartAdd("paneer", 1);
  assert.equal(S().checkout(d), "off");
  assert.equal(S().overrides[ME]![d]!.status, "vacation");
});

test("presentation walkthrough: sign up, advance, part-deliver, refund once", () => {
  const id = newHousehold();
  const first = firstEditableDate();
  assert.equal(S().setDayQty(first, "paneer", 1), "ok");
  // move the demo clock until the first delivery morning
  while (todayKey() < first) S().advanceDay();
  const stop = S().stops.find((s) => s.customerId === id)!;
  assert.ok(stop, "the order survives advancing the day");
  assert.equal(stop.status, "pending");
  assert.deepEqual(stop.items.slice().sort((a, b) => a.productId.localeCompare(b.productId)), [{ productId: "a2", qty: 2 }, { productId: "paneer", qty: 1 }]);

  S().deliver(stop.id, 2, [{ productId: "a2", qty: 2 }]);
  const after = S().stops.find((s) => s.id === stop.id)!;
  assert.equal(after.charged, 96, "only milk is charged");
  assert.equal(S().customers.find((c) => c.id === id)!.wallet, 1000 - 96);
  const auto = S().exceptions.find((e) => e.orderId === stop.orderId)!;
  assert.deepEqual(auto.items, [{ productId: "paneer", qty: 1 }]);

  S().deliver(stop.id, 2, [{ productId: "a2", qty: 2 }]);
  assert.equal(netCharged(stop.orderId, S().txns), 96, "a second tap doesn't charge twice");

  assert.equal(S().resolve(auto.id, 9999, "try"), 0, "paneer wasn't charged, so nothing can be refunded for it");
  // the customer also reports a leaking milk bottle on the same order
  S().reportIssue("leak", "one bottle leaked", [{ productId: "a2", qty: 1 }]);
  const leak = S().exceptions[0]!;
  assert.equal(leak.orderId, stop.orderId);
  assert.equal(S().resolve(leak.id, 9999, "goodwill"), 48, "capped at the paid-for bottle");
  assert.equal(S().resolve(leak.id, 50, "again"), 0, "resolved tickets can't refund again");
  assert.equal(refundableOn(stop.orderId, S().txns), 48);
  assert.equal(S().customers.find((c) => c.id === id)!.wallet, 1000 - 96 + 48);
});

test("a retry puts missing items on the next open order, charged only on delivery", () => {
  const id = newHousehold();
  const first = firstEditableDate();
  S().setDayQty(first, "paneer", 1);
  while (todayKey() < first) S().advanceDay();
  const stop = S().stops.find((s) => s.customerId === id)!;
  S().deliver(stop.id, 2, [{ productId: "a2", qty: 2 }]);
  const auto = S().exceptions.find((e) => e.orderId === stop.orderId)!;
  const when = S().scheduleRetry(auto.id)!;
  assert.ok(when > todayKey());
  const c = S().customers.find((x) => x.id === id)!;
  assert.equal(c.wallet, 1000 - 96, "nothing charged for the retry yet");
  assert.equal(S().overrides[id]![when]!.qty!.paneer, 1);
  assert.equal(S().scheduleRetry(auto.id), null, "can't schedule the same retry twice");
});

test("deliver, undo, deliver leaves one net charge and clears the old acknowledgment", () => {
  const stop = S().stops.find((s) => s.routeId === "r4" && s.status === "pending")!;
  const owner = stop.customerId;
  const w0 = S().customers.find((c) => c.id === owner)!.wallet;
  S().deliver(stop.id);
  const charge = S().stops.find((s) => s.id === stop.id)!.charged!;
  useStore.setState((s) => ({ stops: s.stops.map((x) => (x.id === stop.id ? { ...x, confirmed: true } : x)) }));
  S().undoStop(stop.id);
  const reopened = S().stops.find((s) => s.id === stop.id)!;
  assert.equal(reopened.status, "pending");
  assert.equal(reopened.confirmed, false);
  const ledger = S().txns.filter((t) => t.orderId === stop.orderId);
  assert.deepEqual(ledger.map((t) => t.kind).sort(), ["debit", "refund"], "the original debit stays, with a reversal");
  S().deliver(stop.id);
  assert.equal(netCharged(stop.orderId, S().txns), charge);
  assert.equal(S().customers.find((c) => c.id === owner)!.wallet, w0 - charge);
});

test("a new calendar day keeps the demo and builds that morning's orders", async () => {
  const id = newHousehold();
  const txnCount = S().txns.length;
  const raw = JSON.parse(localStorage.getItem("cowland-daily-demo")!);
  raw.state.stopsDate = "2000-01-01";
  localStorage.setItem("cowland-daily-demo", JSON.stringify(raw));
  await useStore.persist.rehydrate();
  assert.ok(S().customers.some((c) => c.id === id), "new household kept");
  assert.equal(S().txns.length, txnCount, "ledger kept");
  assert.equal(S().stopsDate, todayKey());
  assert.ok(S().stops.every((s) => s.date === todayKey()));
});

test("saved demos from the previous version are upgraded, not wiped", async () => {
  const d = dayKey(addDays(new Date(), 4));
  localStorage.setItem("cowland-daily-demo", JSON.stringify({ version: 4, state: { overrides: { [d]: { extras: [{ productId: "a2", qty: 1 }] } }, riderLang: "mr" } }));
  await useStore.persist.rehydrate();
  assert.equal(S().overrides[ME]![d]!.qty!.a2, 4, "plan 3 + 1 extra becomes an absolute 4");
  assert.equal(S().riderLang, "mr");
});

test("waitlist keeps one entry per number and area", () => {
  const n = S().waitlist.length;
  assert.equal(S().joinWaitlist({ name: "A B", mobile: "98765 43210", area: "Harsul", litres: 1 }), "added");
  assert.equal(S().joinWaitlist({ name: "A B", mobile: "+91 9876543210", area: "Harsul", litres: 1 }), "duplicate");
  assert.equal(S().waitlist.length, n + 1);
});

test("route order applies now before the van leaves, otherwise from the next morning", () => {
  const r4 = () => S().stops.filter((s) => s.routeId === "r4").sort((a, b) => a.seq - b.seq);
  const reversed = r4().map((s) => s.customerId).reverse();
  assert.equal(S().applyRouteOrder("r4", reversed), "tomorrow", "Route 04 has started this morning");
  S().advanceDay();
  const tomorrowOrder = r4().map((s) => s.customerId);
  assert.deepEqual(tomorrowOrder, reversed.filter((id) => tomorrowOrder.includes(id)));
  const again = tomorrowOrder.slice().reverse();
  assert.equal(S().applyRouteOrder("r4", again), "now");
  assert.deepEqual(r4().map((s) => s.customerId), again);
});

test("held orders stay off the van until the wallet covers them", () => {
  useStore.setState((s) => ({ customers: s.customers.map((c) => (c.id === ME ? { ...c, wallet: 10 } : c)) }));
  S().advanceDay();
  const mine = S().stops.find((s) => s.customerId === ME);
  assert.equal(mine?.status, "held");
  S().deliver(mine!.id);
  assert.equal(S().stops.find((s) => s.customerId === ME)!.status, "held", "a held order can't be delivered");
});

test("spares on the van: normal price, limited stock, charged only on delivery", () => {
  const mine = S().stops.find((s) => s.customerId === ME)!;
  // the demo customer's drop is already done this morning, so the van has passed
  assert.equal(S().buyFromVan("paneer"), mine.status === "pending" ? "ok" : "passed");
  S().advanceDay();
  const stop = () => S().stops.find((s) => s.customerId === ME)!;
  assert.equal(stop().status, "pending");
  const pid = Object.keys(sparesLeft(S().stops, stop().routeId))[0]!;
  const w0 = S().customers.find((c) => c.id === ME)!.wallet;
  assert.equal(S().buyFromVan(pid), "ok");
  assert.equal(S().buyFromVan(pid), "ok");
  assert.equal(S().buyFromVan(pid), "gone", "only two spares of each item on the van");
  assert.equal(S().customers.find((c) => c.id === ME)!.wallet, w0, "nothing charged before delivery");
  assert.equal(stop().fromVan![0]!.qty, 2);
  S().deliver(stop().id);
  assert.equal(stop().charged, lineTotal(stop().items), "charged at the normal price on delivery");
  assert.equal(S().buyFromVan(pid), "passed");
});

test("a top-up that covers a held order puts it back on the van", () => {
  useStore.setState((s) => ({ customers: s.customers.map((c) => (c.id === ME ? { ...c, wallet: 10 } : c)) }));
  S().advanceDay();
  const held = S().stops.find((s) => s.customerId === ME)!;
  assert.equal(held.status, "held");
  S().topUp(50, "UPI");
  assert.equal(S().stops.find((s) => s.customerId === ME)!.status, "held", "not enough yet");
  S().topUp(1000, "UPI");
  const back = S().stops.find((s) => s.customerId === ME)!;
  assert.equal(back.status, "pending");
  assert.ok(back.releasedAt);
  const last = Math.max(...S().stops.filter((s) => s.routeId === back.routeId && s.id !== back.id && s.status !== "held").map((s) => s.seq));
  assert.ok(back.seq > last, "added at the end of the route");
});

test("updated drop instructions are saved for the rider", () => {
  S().updateDropNote("Leave it with the watchman");
  const me = S().customers.find((c) => c.id === ME)!;
  assert.equal(me.dropNote, "Leave it with the watchman");
  assert.ok(me.dropNoteAt);
  S().shareInvite();
  assert.equal(S().shares.at(-1)!.society, me.society);
});
