import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Customer, DayOverride, DayStatus, Exception, ExceptionKind, LineItem, Notice, Role, Stop, Txn, WaitEntry } from "../data/types";
import { ME, productById, routeById, seedCustomers, seedExceptions, seedNotices, seedStops, seedTxns, seedWaitlist } from "../data/seed";
import { accounts, type DemoAccount } from "../lib/auth";
import { addDays, dayKey, demoAt, demoNow, firstEditableDate, fromKey, isLockedDate, setDemoOffset, todayKey, uid } from "../lib/format";
import { generateStops, itemsOn, lineTotal, mergeItems, planOn, refundCap, shortLines } from "./rules";

export { lineTotal, mergeItems } from "./rules";

export const kindLabel: Record<ExceptionKind, string> = {
  missing: "Missing item",
  leak: "Leak or damage",
  late: "Running late",
  seal: "Seal check",
  access: "Couldn't reach door",
  quality: "Quality concern",
  callback: "Callback request",
};

export type RiderLang = "en" | "mr" | "hi";

export interface RiderShift {
  loadedAt: string | null;
  checked: Record<string, boolean>;
  short: string[];
  handedOverAt: string | null;
  returnedBottles: number | null;
}

/** Result of a customer edit. Rules are enforced here, not only by disabled buttons. */
export type EditResult = "ok" | "locked" | "off";

export interface SignupInput {
  name: string;
  mobile: string;
  routeId: string;
  area: string;
  society: string;
  flat: string;
  landmark: string;
  dropNote: string;
  plan: LineItem[];
  startDate: string;
  topUp: number;
}

interface State {
  role: Role;
  session: Role | null;
  meId: string; // the signed-in household
  dayOffset: number; // demo clock: whole days ahead of the real date
  stopsDate: string; // delivery date the current run belongs to
  customers: Customer[];
  stops: Stop[];
  exceptions: Exception[];
  txns: Txn[];
  notices: Notice[];
  overrides: Record<string, Record<string, DayOverride>>; // customerId -> date -> changes
  waitlist: WaitEntry[];
  nextSeq: Record<string, number>; // customerId -> stop number, waiting for the next morning's run
  cart: LineItem[];
  simOn: boolean;
  autoTopUp: boolean;
  offers: Record<string, string>;
  remindedAt: string | null;
  planned: Record<string, boolean>;
  riderLang: RiderLang;
  shift: RiderShift;

  setRole: (r: Role) => void;
  signIn: (r: Role, customerId?: string) => void;
  signOut: () => void;

  // customer
  setDayStatus: (date: string, status: DayStatus) => EditResult;
  setDayQty: (date: string, productId: string, qty: number) => EditResult;
  setVacation: (from: string, to: string) => number;
  savePlan: (items: LineItem[]) => string;
  topUp: (amount: number, method: string) => void;
  cartAdd: (productId: string, delta: number) => void;
  cartClear: () => void;
  checkout: (date: string) => EditResult;
  reportIssue: (kind: ExceptionKind, message: string, items?: LineItem[]) => void;
  confirmReceived: () => void;
  signup: (input: SignupInput) => string;
  joinWaitlist: (e: Omit<WaitEntry, "id" | "at">) => "added" | "duplicate";

  // rider
  deliver: (stopId: string, bottles?: number, delivered?: LineItem[]) => void;
  flagStop: (stopId: string, kind: ExceptionKind, note: string) => void;
  setBottles: (stopId: string, n: number) => void;
  undoStop: (stopId: string) => void;

  // admin
  resolve: (exId: string, refund: number, resolution: string) => number;
  scheduleRetry: (exId: string) => string | null;
  broadcast: (text: string) => void;
  toggleCustomer: (customerId: string) => void;
  applyRouteOrder: (routeId: string, customerIds: string[]) => "now" | "tomorrow";
  setSim: (on: boolean) => void;
  tick: () => void;
  advanceDay: () => void;

  setAutoTopUp: (on: boolean) => void;
  sendOffer: (customerId: string) => void;
  remindLowBalances: (ids: string[]) => void;
  togglePlanned: (id: string) => void;
  setRiderLang: (l: RiderLang) => void;
  toggleLoadItem: (productId: string) => void;
  confirmLoad: (short: string[]) => void;
  handover: (returned: number) => void;
  markRead: (role: Role) => void;
  reset: () => void;
}

const freshShift = (loaded: boolean): RiderShift => ({
  loadedAt: loaded ? demoAt(4, 41).toISOString() : null,
  checked: {},
  short: [],
  handedOverAt: null,
  returnedBottles: null,
});

const fresh = () => {
  setDemoOffset(0);
  const stops = structuredClone(seedStops);
  // today's ledger entries for drops already made this morning, so refunds can be bounded per order
  const todayDebits: Txn[] = stops
    .filter((s) => s.status === "delivered")
    .map((s) => ({ id: `t-${s.orderId}`, customerId: s.customerId, at: s.at!, kind: "debit" as const, amount: s.charged ?? lineTotal(s.items), note: "Daily delivery", orderId: s.orderId }));
  const txns = [...todayDebits, ...structuredClone(seedTxns)].sort((a, b) => b.at.localeCompare(a.at));
  const me = seedCustomers.find((c) => c.id === ME)!;
  const qtyPlus = (pid: string, extra: number) => (me.plan.find((p) => p.productId === pid)?.qty ?? 0) + extra;
  return {
    role: "customer" as Role,
    session: null as Role | null,
    meId: ME,
    dayOffset: 0,
    stopsDate: dayKey(new Date()),
    customers: structuredClone(seedCustomers),
    stops,
    exceptions: structuredClone(seedExceptions),
    txns,
    notices: structuredClone(seedNotices),
    overrides: {
      [ME]: {
        [dayKey(addDays(new Date(), 3))]: { qty: { a2: qtyPlus("a2", 2) } },
        [dayKey(addDays(new Date(), 5))]: { qty: { paneer: 1 } },
      },
    } as Record<string, Record<string, DayOverride>>,
    waitlist: structuredClone(seedWaitlist),
    nextSeq: {} as Record<string, number>,
    cart: [] as LineItem[],
    simOn: false,
    autoTopUp: true,
    offers: {} as Record<string, string>,
    remindedAt: null as string | null,
    planned: {} as Record<string, boolean>,
    riderLang: "en" as RiderLang,
    shift: freshShift(true),
  };
};

/** Keep the demo on a coherent dawn timeline: each new drop lands 2–3 minutes after the route's last one. */
function nextAt(stops: Stop[], routeId: string) {
  const last = stops.filter((x) => x.routeId === routeId && x.at).map((x) => x.at!).sort().at(-1);
  const base = last ? new Date(last) : demoAt(5, 15);
  return new Date(base.getTime() + (120 + Math.random() * 60) * 1000).toISOString();
}

const notice = (role: Role, text: string, tone: Notice["tone"] = "info"): Notice => ({ id: uid("n"), role, text, at: new Date().toISOString(), read: false, tone });
const MAX_TXNS = 2500;
const ledger = (txns: Txn[], add: Txn[]) => [...add, ...txns].slice(0, MAX_TXNS);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...fresh(),

      setRole: (role) => set({ role }),
      signIn: (role, customerId) => set((s) => ({ session: role, role, meId: role === "customer" ? customerId ?? s.meId : s.meId })),
      signOut: () => set({ session: null, simOn: false }),

      /* ---------------- customer ---------------- */

      setDayStatus: (date, status) => {
        if (isLockedDate(date)) return "locked";
        const id = get().meId;
        set((s) => ({ overrides: { ...s.overrides, [id]: { ...s.overrides[id], [date]: { ...s.overrides[id]?.[date], status } } } }));
        return "ok";
      },

      setDayQty: (date, productId, qty) => {
        if (isLockedDate(date)) return "locked";
        const id = get().meId;
        const cur = get().overrides[id]?.[date];
        if (cur?.status === "skipped" || cur?.status === "vacation") return "off"; // ask the customer to resume the day first
        set((s) => ({ overrides: { ...s.overrides, [id]: { ...s.overrides[id], [date]: { ...cur, qty: { ...cur?.qty, [productId]: Math.max(0, qty) } } } } }));
        return "ok";
      },

      setVacation: (from, to) => {
        const id = get().meId;
        let n = 0;
        set((s) => {
          const o = { ...s.overrides[id] };
          for (let d = fromKey(from); d <= fromKey(to); d = addDays(d, 1)) {
            const k = dayKey(d);
            if (isLockedDate(k)) continue;
            o[k] = { ...o[k], status: "vacation" };
            n++;
          }
          return { overrides: { ...s.overrides, [id]: o } };
        });
        return n;
      },

      savePlan: (items) => {
        const from = firstEditableDate();
        const id = get().meId;
        set((s) => ({
          customers: s.customers.map((c) => (c.id !== id ? c : { ...c, planChanges: [...(c.planChanges ?? []).filter((p) => p.from < from), { from, items: items.filter((i) => i.qty > 0) }] })),
        }));
        return from;
      },

      topUp: (amount, method) =>
        set((s) => ({
          customers: s.customers.map((c) => (c.id === s.meId ? { ...c, wallet: c.wallet + amount } : c)),
          txns: ledger(s.txns, [{ id: uid("t"), customerId: s.meId, at: demoNow().toISOString(), kind: "topup", amount, note: `Demo top-up via ${method}` }]),
          notices: [notice("customer", `₹${amount.toLocaleString("en-IN")} added to your wallet (demo payment).`, "good"), ...s.notices],
        })),

      cartAdd: (productId, delta) => set((s) => ({ cart: mergeItems(s.cart, [{ productId, qty: delta }]) })),
      cartClear: () => set({ cart: [] }),

      checkout: (date) => {
        if (isLockedDate(date)) return "locked";
        const s = get();
        const id = s.meId;
        const cur = s.overrides[id]?.[date];
        if (cur?.status === "skipped" || cur?.status === "vacation") return "off";
        const me = s.customers.find((c) => c.id === id)!;
        const qty = { ...cur?.qty };
        for (const i of s.cart) qty[i.productId] = (qty[i.productId] ?? planOn(me, date).find((p) => p.productId === i.productId)?.qty ?? 0) + i.qty;
        set({ overrides: { ...s.overrides, [id]: { ...s.overrides[id], [date]: { ...cur, qty } } }, cart: [] });
        return "ok";
      },

      reportIssue: (kind, message, items) =>
        set((s) => {
          const me = s.customers.find((c) => c.id === s.meId)!;
          const stop = s.stops.find((x) => x.customerId === s.meId);
          const ex: Exception = { id: uid("ex"), kind, customerId: s.meId, routeId: me.routeId, source: "customer", message, createdAt: new Date().toISOString(), status: "open", orderId: kind === "callback" ? undefined : stop?.orderId, items: items?.length ? items : undefined };
          return {
            exceptions: [ex, ...s.exceptions],
            notices: [notice("admin", `New ticket from ${me.name}, ${me.flat} ${me.society}: ${kindLabel[kind].toLowerCase()}${ex.orderId ? ` on order ${ex.orderId}` : ""}.`, "warn"), ...s.notices],
          };
        }),

      confirmReceived: () =>
        set((s) => ({ stops: s.stops.map((x) => (x.customerId === s.meId && x.status === "delivered" ? { ...x, confirmed: true, confirmedAt: new Date().toISOString() } : x)) })),

      signup: (input) => {
        const s = get();
        const n = Math.max(...s.customers.map((c) => Number(c.id.replace("c-", "")) || 0)) + 1;
        const id = `c-${String(n).padStart(3, "0")}`;
        const digits = input.mobile.replace(/\D/g, "").slice(-10);
        const c: Customer = {
          id,
          name: `${input.name.trim().split(/\s+/).slice(-1)[0]} family`,
          contact: input.name.trim(),
          flat: input.flat.trim(),
          society: input.society,
          area: input.area,
          routeId: input.routeId,
          phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
          plan: input.plan.filter((p) => p.qty > 0),
          wallet: input.topUp,
          since: todayKey(),
          status: "active",
          dropNote: input.dropNote.trim() || "Leave at the door.",
          landmark: input.landmark.trim(),
          startDate: input.startDate,
          isNew: true,
        };
        set({
          customers: [...s.customers, c],
          meId: id,
          session: "customer",
          role: "customer",
          txns: input.topUp ? ledger(s.txns, [{ id: uid("t"), customerId: id, at: demoNow().toISOString(), kind: "topup", amount: input.topUp, note: "Demo top-up at sign-up" }]) : s.txns,
          notices: [
            notice("admin", `New household: ${c.contact}, ${c.flat} ${c.society} (Route ${routeById[c.routeId]!.code}). First delivery ${input.startDate}.`, "good"),
            notice("customer", `Welcome to Cowland, ${c.contact.split(" ")[0]}! Your first delivery is on ${fromKey(input.startDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}.`, "good"),
            ...s.notices,
          ],
        });
        return id;
      },

      joinWaitlist: (e) => {
        const mobile = e.mobile.replace(/\D/g, "").slice(-10);
        if (get().waitlist.some((w) => w.mobile === mobile && w.area === e.area)) return "duplicate";
        set((s) => ({
          waitlist: [...s.waitlist, { ...e, mobile, id: uid("w"), at: new Date().toISOString() }],
          notices: [notice("admin", `Waitlist: ${e.name} in ${e.area} wants ${e.litres} L a day.`, "info"), ...s.notices],
        }));
        return "added";
      },

      /* ---------------- rider ---------------- */

      deliver: (stopId, bottles, deliveredItems) =>
        set((s) => {
          const stop = s.stops.find((x) => x.id === stopId);
          if (!stop || stop.status === "delivered" || stop.status === "held") return {};
          const delivered = deliveredItems ?? stop.items.map((i) => ({ ...i }));
          const amount = lineTotal(delivered);
          const missing = shortLines(stop.items, delivered);
          const cust = s.customers.find((c) => c.id === stop.customerId)!;
          const isMe = stop.customerId === s.meId;
          const autoTicket: Exception[] = missing.length
            ? [{ id: uid("ex"), kind: "missing", customerId: stop.customerId, routeId: stop.routeId, source: "rider", message: `Couldn't deliver ${missing.map((m) => `${m.qty} × ${productById[m.productId]!.name}`).join(", ")} at ${cust.flat}, ${cust.society}. Not charged.`, createdAt: new Date().toISOString(), status: "open", orderId: stop.orderId, items: missing }]
            : [];
          return {
            stops: s.stops.map((x) =>
              x.id === stopId ? { ...x, status: "delivered", at: nextAt(s.stops, stop.routeId), bottlesCollected: bottles ?? x.bottlesDue, issueNote: missing.length ? "Partly delivered" : undefined, delivered, charged: amount, confirmed: false, confirmedAt: undefined } : x,
            ),
            customers: s.customers.map((c) => (c.id === stop.customerId ? { ...c, wallet: c.wallet - amount } : c)),
            txns: amount ? ledger(s.txns, [{ id: uid("t"), customerId: stop.customerId, at: demoNow().toISOString(), kind: "debit", amount, note: missing.length ? "Delivery, part order" : "Daily delivery", orderId: stop.orderId }]) : s.txns,
            exceptions: [...autoTicket, ...s.exceptions],
            notices: [
              ...(isMe ? [notice("customer", missing.length ? `Part of today's order was delivered. ${missing.map((m) => productById[m.productId]!.name).join(", ")} couldn't be delivered and wasn't charged.` : "Your milk has just been delivered.", missing.length ? "warn" : "good")] : []),
              ...(missing.length ? [notice("admin", `Route ${routeById[stop.routeId]!.code}: part delivery at ${cust.flat}, ${cust.society} (order ${stop.orderId}).`, "warn")] : []),
              ...s.notices,
            ],
          };
        }),

      flagStop: (stopId, kind, note) =>
        set((s) => {
          const stop = s.stops.find((x) => x.id === stopId);
          if (!stop || stop.status !== "pending") return {};
          const cust = s.customers.find((c) => c.id === stop.customerId)!;
          const ex: Exception = { id: uid("ex"), kind, customerId: stop.customerId, routeId: stop.routeId, source: "rider", message: note || `${kindLabel[kind]} at ${cust.flat}, ${cust.society}.`, createdAt: new Date().toISOString(), status: "open", orderId: stop.orderId, items: stop.items };
          return {
            stops: s.stops.map((x) => (x.id === stopId ? { ...x, status: "issue", at: nextAt(s.stops, stop.routeId), issueNote: note || kindLabel[kind], delivered: [], charged: 0 } : x)),
            exceptions: [ex, ...s.exceptions],
            notices: [
              ...(stop.customerId === s.meId ? [notice("customer", "We couldn't deliver today's order. You haven't been charged, and the hub team will contact you.", "warn")] : []),
              notice("admin", `Route ${routeById[stop.routeId]!.code}: ${kindLabel[kind].toLowerCase()} at ${cust.flat}, ${cust.society}.`, "warn"),
              ...s.notices,
            ],
          };
        }),

      setBottles: (stopId, n) => set((s) => ({ stops: s.stops.map((x) => (x.id === stopId ? { ...x, bottlesCollected: Math.max(0, n) } : x)) })),

      /** Reopen a stop. Money already taken is reversed with its own ledger entry; the original stays in history. */
      undoStop: (stopId) =>
        set((s) => {
          const stop = s.stops.find((x) => x.id === stopId);
          if (!stop || (stop.status !== "delivered" && stop.status !== "issue")) return {};
          const back = stop.status === "delivered" ? stop.charged ?? 0 : 0;
          return {
            stops: s.stops.map((x) => (x.id === stopId ? { ...x, status: "pending", at: undefined, bottlesCollected: 0, issueNote: undefined, delivered: undefined, charged: undefined, confirmed: false, confirmedAt: undefined } : x)),
            customers: back ? s.customers.map((c) => (c.id === stop.customerId ? { ...c, wallet: c.wallet + back } : c)) : s.customers,
            txns: back ? ledger(s.txns, [{ id: uid("t"), customerId: stop.customerId, at: demoNow().toISOString(), kind: "refund", amount: back, note: "Delivery undone by rider (reversal)", orderId: stop.orderId }]) : s.txns,
            // rider-raised tickets for this order no longer apply once the stop is reopened
            exceptions: s.exceptions.filter((e) => !(e.orderId === stop.orderId && e.source === "rider" && e.status === "open")),
          };
        }),

      /* ---------------- admin ---------------- */

      resolve: (exId, refundAsked, resolution) => {
        const s = get();
        const ex = s.exceptions.find((e) => e.id === exId);
        if (!ex || ex.status === "resolved") return 0;
        const cap = refundCap(ex, s.stops.find((x) => x.orderId === ex.orderId), s.txns);
        const refund = Math.max(0, Math.min(refundAsked, cap));
        const isMe = ex.customerId === s.meId;
        set({
          exceptions: s.exceptions.map((e) => (e.id === exId ? { ...e, status: "resolved", refund, resolution } : e)),
          customers: refund ? s.customers.map((c) => (c.id === ex.customerId ? { ...c, wallet: c.wallet + refund } : c)) : s.customers,
          txns: refund ? ledger(s.txns, [{ id: uid("t"), customerId: ex.customerId, at: demoNow().toISOString(), kind: "refund", amount: refund, note: `Refund: ${kindLabel[ex.kind].toLowerCase()}`, orderId: ex.orderId }]) : s.txns,
          notices: isMe ? [notice("customer", refund ? `We've credited ₹${refund} for your ${kindLabel[ex.kind].toLowerCase()} report.` : `Your ${kindLabel[ex.kind].toLowerCase()} report is resolved: ${resolution}.`, "good"), ...s.notices] : s.notices,
        });
        return refund;
      },

      /** Put the ticket's missing items on the next run that can still change. Charged only if delivered. */
      scheduleRetry: (exId) => {
        const s = get();
        const ex = s.exceptions.find((e) => e.id === exId);
        if (!ex || ex.status === "resolved" || !ex.items?.length) return null;
        const c = s.customers.find((x) => x.id === ex.customerId)!;
        const mine = s.overrides[c.id] ?? {};
        let date = firstEditableDate();
        for (let i = 0; i < 21; i++) {
          const st = mine[date]?.status;
          if (st !== "skipped" && st !== "vacation" && !(c.startDate && date < c.startDate)) break;
          date = dayKey(addDays(fromKey(date), 1));
        }
        const cur = mine[date];
        const qty = { ...cur?.qty };
        const base = itemsOn(c, cur, date);
        for (const i of ex.items) qty[i.productId] = (base.find((b) => b.productId === i.productId)?.qty ?? 0) + i.qty;
        const what = ex.items.map((i) => `${i.qty} × ${productById[i.productId]!.name}`).join(", ");
        const when = fromKey(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
        set({
          overrides: { ...s.overrides, [c.id]: { ...mine, [date]: { ...cur, qty } } },
          exceptions: s.exceptions.map((e) => (e.id === exId ? { ...e, status: "resolved", refund: 0, resolution: `Retry: ${what} added to the ${when} delivery, charged only when delivered` } : e)),
          notices: c.id === s.meId ? [notice("customer", `We'll bring ${what} with your ${when} delivery. You pay only when it arrives.`, "good"), ...s.notices] : s.notices,
        });
        return date;
      },

      broadcast: (text) => set((s) => ({ notices: [notice("rider", text, "warn"), ...s.notices] })),

      toggleCustomer: (id) => set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, status: c.status === "active" ? "paused" : "active" } : c)) })),

      /**
       * Apply a new stop order. If the van hasn't started, today's run is resequenced now;
       * once it has, the order is saved for the next morning so nobody's drop moves mid-run.
       */
      applyRouteOrder: (routeId, customerIds) => {
        const seq = Object.fromEntries(customerIds.map((id, i) => [id, i + 1]));
        const started = get().stops.some((x) => x.routeId === routeId && (x.status === "delivered" || x.status === "issue"));
        if (started) {
          set((s) => ({ nextSeq: { ...s.nextSeq, ...seq } }));
          return "tomorrow";
        }
        set((s) => {
          let n = customerIds.length;
          return { stops: s.stops.map((x) => (x.routeId !== routeId ? x : { ...x, seq: seq[x.customerId] ?? ++n })).sort((a, b) => a.seq - b.seq) };
        });
        return "now";
      },

      setSim: (simOn) => set({ simOn }),

      tick: () => {
        const s = get();
        // Route 04 is driven by hand from the rider app; the others move on their own.
        const pending = s.stops.filter((x) => x.status === "pending" && x.routeId !== "r4");
        if (!pending.length) return;
        const byRoute = new Map<string, Stop[]>();
        for (const p of pending) byRoute.set(p.routeId, [...(byRoute.get(p.routeId) ?? []), p]);
        const routesLeft = [...byRoute.keys()];
        const rid = routesLeft[Math.floor(Math.random() * routesLeft.length)]!;
        const next = byRoute.get(rid)!.sort((a, b) => a.seq - b.seq)[0]!;
        if (Math.random() < 0.06) get().flagStop(next.id, "access", "");
        else get().deliver(next.id);
      },

      /** Move the demo to the next delivery morning: build that day's orders from plans, skips and extras. */
      advanceDay: () =>
        set((s) => {
          const dayOffset = s.dayOffset + 1;
          setDemoOffset(dayOffset);
          const date = todayKey();
          const prevSeq = { ...Object.fromEntries(s.stops.map((x) => [x.customerId, x.seq])), ...s.nextSeq };
          return {
            nextSeq: {},
            dayOffset,
            stopsDate: date,
            stops: generateStops(s.customers, s.overrides, date, prevSeq),
            shift: freshShift(false),
            simOn: false,
            cart: [],
            notices: [notice("admin", `Moved to the ${fromKey(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} delivery morning. Orders are built and waiting for the vans.`, "info"), ...s.notices],
          };
        }),

      setAutoTopUp: (autoTopUp) => set({ autoTopUp }),
      sendOffer: (id) =>
        set((s) => ({
          offers: { ...s.offers, [id]: new Date().toISOString() },
          notices: id === s.meId ? [notice("customer", "A gift from Cowland: your next top-up of ₹1,000 or more comes with a free bottle of A2 milk.", "good"), ...s.notices] : s.notices,
        })),
      remindLowBalances: (ids) =>
        set((s) => ({
          remindedAt: new Date().toISOString(),
          notices: [
            ...(ids.includes(s.meId) ? [notice("customer", "Your wallet is running low. Add money before 10 PM so tomorrow's milk isn't held.", "warn")] : []),
            notice("admin", `Top-up reminder sent to ${ids.length} households.`, "info"),
            ...s.notices,
          ],
        })),
      togglePlanned: (id) => set((s) => ({ planned: { ...s.planned, [id]: !s.planned[id] } })),
      setRiderLang: (riderLang) => set({ riderLang }),

      toggleLoadItem: (pid) => set((s) => ({ shift: { ...s.shift, checked: { ...s.shift.checked, [pid]: !s.shift.checked[pid] } } })),

      confirmLoad: (short) =>
        set((s) => ({
          shift: { ...s.shift, loadedAt: demoAt(4, 40 + Math.floor(Math.random() * 6)).toISOString(), short },
          notices: short.length
            ? [notice("admin", `Route 04 left the hub short: ${short.map((id) => productById[id]?.name ?? id).join(", ")}. Send a top-up with the 5:30 runner.`, "warn"), ...s.notices]
            : [notice("admin", "Route 04 crate checked and loaded in full.", "good"), ...s.notices],
        })),

      handover: (returned) =>
        set((s) => {
          const r4 = s.stops.filter((x) => x.routeId === "r4");
          const collected = r4.reduce((a, x) => a + x.bottlesCollected, 0);
          const last = r4.map((x) => x.at).filter(Boolean).sort().at(-1);
          const at = new Date((last ? new Date(last).getTime() : demoNow().getTime()) + 16 * 60000).toISOString();
          const gap = collected - returned;
          return {
            shift: { ...s.shift, handedOverAt: at, returnedBottles: returned },
            notices: [notice("admin", `Ganesh (Route 04) handed over ${returned} empty bottles${gap > 0 ? `, ${gap} fewer than collected` : ""}.`, gap > 0 ? "warn" : "good"), ...s.notices],
          };
        }),

      markRead: (role) => set((s) => ({ notices: s.notices.map((n) => (n.role === role ? { ...n, read: true } : n)) })),

      reset: () => set({ ...fresh(), role: get().role, session: get().session === "customer" ? null : get().session, riderLang: get().riderLang }),
    }),
    {
      name: "cowland-daily-demo",
      version: 5,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { simOn: _simOn, ...rest } = s;
        return rest;
      },
      // Older saved demos are upgraded instead of wiped.
      migrate: (persisted: unknown, version: number) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (version < 5) {
          const base = fresh();
          const old = (p.overrides ?? {}) as Record<string, { status?: DayStatus; extras?: LineItem[] }>;
          const me = ((p.customers as Customer[] | undefined) ?? base.customers).find((c) => c.id === ME);
          const mine: Record<string, DayOverride> = {};
          for (const [date, o] of Object.entries(old)) {
            const qty: Record<string, number> = {};
            for (const e of o.extras ?? []) qty[e.productId] = (me?.plan.find((x) => x.productId === e.productId)?.qty ?? 0) + e.qty;
            mine[date] = { status: o.status, qty: Object.keys(qty).length ? qty : undefined };
          }
          const keep = { customers: p.customers, exceptions: p.exceptions, notices: p.notices, autoTopUp: p.autoTopUp, offers: p.offers, planned: p.planned, riderLang: p.riderLang };
          return { ...base, ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)), overrides: { [ME]: mine } };
        }
        return p;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setDemoOffset(state.dayOffset ?? 0);
        // A new real day: keep everything, and build that morning's orders instead of resetting.
        const today = todayKey();
        if (state.stopsDate !== today) {
          const prevSeq = { ...Object.fromEntries(state.stops.map((x) => [x.customerId, x.seq])), ...state.nextSeq };
          useStore.setState({ nextSeq: {}, stopsDate: today, stops: generateStops(state.customers, state.overrides, today, prevSeq), shift: freshShift(false) });
        }
      },
    },
  ),
);

/* ---------- selectors ---------- */

export const useMe = () => useStore((s) => s.customers.find((c) => c.id === s.meId) ?? s.customers[0]!);
export const useMyOverrides = () => useStore((s) => s.overrides[s.meId] ?? {});

export { itemsOn, planOn } from "./rules";

export const volumeMl = (items: LineItem[]) => items.reduce((s, i) => s + (productById[i.productId]?.volumeMl ?? 0) * i.qty, 0);

/** Re-render on the demo clock and return the current delivery date. */
export const useToday = () => {
  useStore((s) => s.dayOffset);
  return todayKey();
};

/** The signed-in account card. Customers come from the store, so new households show their own name. */
export const useAccount = (role: Role): DemoAccount => {
  const me = useMe();
  const base = accounts[role];
  if (role !== "customer") return base;
  const initials = me.contact.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return { ...base, name: me.contact, sub: `${me.flat}, ${me.society}`, initials, id: me.phone.replace(/\D/g, "").slice(-10) };
};
