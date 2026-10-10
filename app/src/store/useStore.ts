import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ActivityEvent, Customer, DayOverride, DayStatus, Exception, ExceptionKind, LineItem, Notice, OrderLink, Role, Share, Stop, Txn, WaitEntry } from "../data/types";
import { describe, makeEvent, simSpares, type Snap } from "./activity";
import { ME, productById, routeById, seedCustomers, seedExceptions, seedNotices, seedStops, seedTxns, seedWaitlist } from "../data/seed";
import { accounts, type DemoAccount } from "../lib/auth";
import { addDays, dayKey, demoAt, demoNow, firstEditableDate, fromKey, isLockedDate, setDemoOffset, todayKey, uid } from "../lib/format";
import { chargeFor, generateStops, lineTotal, mergeItems, netCharged, planOn, pricesFor, refundCap, replaceable, retryable, shortLines, sparesLeft } from "./rules";

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

/** Result of buying a spare from the van. */
export type VanResult = "ok" | "gone" | "passed" | "wallet" | "none";

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
  shares: Share[];
  pastOrders: Stop[]; // earlier delivery mornings, newest first, kept so tickets and receipts resolve against the original order
  events: ActivityEvent[]; // activity log, newest first
  opening: Record<string, number>; // each wallet when the demo started or the household signed up
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
  buyFromVan: (productId: string) => VanResult;
  updateDropNote: (note: string) => void;
  shareInvite: () => void;
  joinWaitlist: (e: Omit<WaitEntry, "id" | "at">) => "added" | "duplicate";

  // rider
  deliver: (stopId: string, bottles?: number, delivered?: LineItem[]) => void;
  flagStop: (stopId: string, kind: ExceptionKind, note: string) => void;
  setBottles: (stopId: string, n: number) => void;
  undoStop: (stopId: string) => void;
  restartRound: (routeId: string) => number;

  // admin
  resolve: (exId: string, refund: number, resolution: string) => number;
  scheduleRetry: (exId: string) => string | null;
  scheduleReplacement: (exId: string) => string | null;
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
  // Sample: a few homes on other routes have already bought spares from their van this morning.
  for (const [rid, pid] of [["r2", "paneer"], ["r3", "dahi"], ["r5", "a2"], ["r5", "shrikhand"]] as const) {
    const left = sparesLeft(stops, rid);
    const st = stops.filter((x) => x.routeId === rid && x.status === "pending" && !x.fromVan).sort((a, b) => a.seq - b.seq)[1];
    const pick = (left[pid] ?? 0) > 0 ? pid : Object.keys(left).find((k) => left[k]! > 0);
    if (st && pick) { st.items = mergeItems(st.items, [{ productId: pick, qty: 1 }]); st.fromVan = [{ productId: pick, qty: 1 }]; }
  }
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
    shares: [] as Share[],
    pastOrders: [] as Stop[],
    events: [makeEvent({ actor: "system", who: "Demo", action: "Demo started", detail: "Sample data loaded for this morning. Every click from here is logged." })] as ActivityEvent[],
    opening: Object.fromEntries(seedCustomers.map((c) => [c.id, c.wallet])) as Record<string, number>,
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
const MAX_TXNS = 5000;
const MAX_PAST = 2500;
/** Keep earlier mornings' orders (newest first) so tickets, receipts and refunds resolve against them. */
const archive = (today: Stop[], past: Stop[]) => [...today, ...past.filter((p) => !today.some((t) => t.orderId === p.orderId))].slice(0, MAX_PAST);
/** New money movements are marked live, so wallets can be checked against the ledger. */
const ledger = (txns: Txn[], add: Txn[]) => [...add.map((t) => ({ ...t, live: true })), ...txns].slice(0, MAX_TXNS);

/**
 * Add a one-off to a household's next open delivery date (never their recurring plan), linked to
 * the ticket and its order. Retries are paid on delivery; replacements are free.
 */
function scheduleOneOff(exId: string, kind: "retry" | "replacement"): string | null {
  const s = useStore.getState();
  const ex = s.exceptions.find((e) => e.id === exId);
  if (!ex || ex.status === "resolved" || !ex.orderId) return null;
  const order = orderById(s, ex.orderId);
  const lines = kind === "retry" ? retryable(ex, order, s.exceptions) : replaceable(ex, order, s.exceptions);
  if (!lines.length) return null;
  const c = s.customers.find((x) => x.id === ex.customerId)!;
  const mine = s.overrides[c.id] ?? {};
  let date = firstEditableDate();
  for (let i = 0; i < 21; i++) {
    const st = mine[date]?.status;
    if (st !== "skipped" && st !== "vacation" && !(c.startDate && date < c.startDate)) break;
    date = dayKey(addDays(fromKey(date), 1));
  }
  const cur = mine[date] ?? {};
  const field = kind === "retry" ? "add" : "free";
  const bucket = { ...(cur[field] ?? {}) };
  for (const l of lines) bucket[l.productId] = (bucket[l.productId] ?? 0) + l.qty;
  const links: OrderLink[] = [...(cur.links ?? []), ...lines.map((l) => ({ ticketId: ex.id, fromOrder: ex.orderId!, kind, productId: l.productId, qty: l.qty }))];
  const what = lines.map((i) => `${i.qty} × ${productById[i.productId]!.name}`).join(", ");
  const when = fromKey(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const text = kind === "retry" ? `${what} added to the ${when} delivery, charged only when delivered` : `free replacement of ${what} with the ${when} delivery`;
  useStore.setState({
    overrides: { ...s.overrides, [c.id]: { ...mine, [date]: { ...cur, [field]: bucket, links } } },
    exceptions: s.exceptions.map((e) => (e.id === exId ? { ...e, status: "resolved", refund: 0, resolution: `${kind === "retry" ? "Retry" : "Replacement"}: ${text}`, compensation: { kind, date, items: lines } } : e)),
    notices: c.id === s.meId ? [notice("customer", kind === "retry" ? `We'll bring ${what} with your ${when} delivery. You pay only when it arrives.` : `We'll replace ${what} free with your ${when} delivery. You won't be charged for it.`, "good"), ...s.notices] : s.notices,
  });
  return date;
}

/** Whether a route's van has left the hub this morning (Route 04: crate loaded; others: first drop made). */
export function routeDispatched(s: Pick<State, "stops" | "shift">, routeId: string) {
  if (routeId === "r4") return !!s.shift.loadedAt;
  return s.stops.some((x) => x.routeId === routeId && (x.status === "delivered" || x.status === "issue"));
}

/* ---------- one shared copy of the data across tabs ---------- */

const KEY = "cowland-daily-demo";
const TAB_KEY = "cowland-tab-session";
let lastSynced: string | null = null; // what this tab last read from or wrote to storage

const tabStorage = {
  getItem: (k: string) => { try { const v = localStorage.getItem(k); lastSynced = v; return v; } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); lastSynced = v; } catch { /* storage full or blocked: keep working in memory */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/** If another tab has saved since this tab last looked, load that first so nothing is overwritten. */
export function pullLatest() {
  let v: string | null = null;
  try { v = localStorage.getItem(KEY); } catch { return; }
  if (v !== null && v !== lastSynced) void useStore.persist.rehydrate();
}

/** Actions too small to log (typing, toggles, reading notifications). */
const QUIET = new Set(["setRole", "signOut", "cartAdd", "cartClear", "markRead", "toggleLoadItem", "setRiderLang", "togglePlanned", "setAutoTopUp", "setBottles"]);
let depth = 0;
let inTick = false;

/** Every action starts from the latest saved data, and leaves a line in the activity log. */
function synced<T extends object>(set: (p: Partial<State> | ((s: State) => Partial<State>)) => void, get: () => State, actions: T): T {
  return Object.fromEntries(
    Object.entries(actions).map(([k, v]) => {
      if (typeof v !== "function") return [k, v];
      const fn = v as (...x: unknown[]) => unknown;
      return [k, (...a: unknown[]) => {
        if (depth === 0) pullLatest();
        const before = get();
        depth++;
        if (k === "tick" && depth === 1) inTick = true;
        let r: unknown;
        try { r = fn(...a); } finally { depth--; }
        const after = get();
        const lines = QUIET.has(k) ? [] : k === "tick" ? simSpares(before as unknown as Snap, after as unknown as Snap) : [describe(k, a, before as unknown as Snap, after as unknown as Snap, r, inTick)].filter((x) => x !== null);
        if (depth === 0) inTick = false;
        if (lines.length) set((s) => ({ events: [...lines.map((l) => makeEvent(l!)), ...s.events].slice(0, 800) }));
        return r;
      }];
    }),
  ) as T;
}

/** Who is signed in belongs to this tab only, so a rider tab and a hub tab can sit side by side. */
type TabSession = { session: Role | null; role: Role; meId: string };
function loadTabSession(): Partial<TabSession> {
  try { return JSON.parse(sessionStorage.getItem(TAB_KEY) || "{}") as Partial<TabSession>; } catch { return {}; }
}

export const useStore = create<State>()(
  persist(
    (set, get) => synced(set, get, {
      ...fresh(),
      ...loadTabSession(),

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

      /**
       * Add money. A held order whose van hasn't left yet goes back into this morning's run.
       * Once the van has left (crate loaded or first drop made), the order stays off the van and
       * uncharged, and the money covers the next delivery instead. A payment never puts milk on a van.
       */
      topUp: (amount, method) =>
        set((s) => {
          const me = s.customers.find((c) => c.id === s.meId)!;
          const wallet = me.wallet + amount;
          const held = s.stops.find((x) => x.customerId === s.meId && x.status === "held");
          const covered = !!held && wallet >= chargeFor(held, held.items);
          const left = !!held && routeDispatched(s, held.routeId);
          const release = covered && !left;
          const lastSeq = Math.max(0, ...s.stops.filter((x) => held && x.routeId === held.routeId && x.status !== "held").map((x) => x.seq));
          const tomorrow = fromKey(dayKey(addDays(fromKey(s.stopsDate), 1))).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
          return {
            customers: s.customers.map((c) => (c.id === s.meId ? { ...c, wallet } : c)),
            stops: !held || !covered ? s.stops : s.stops.map((x) => (x.id !== held.id ? x : release
              ? { ...x, status: "pending", seq: lastSeq + 1, holdReason: undefined, releasedAt: new Date().toISOString() }
              : { ...x, holdReason: `Topped up after the van left. Not charged for today; your next delivery is ${tomorrow}` })),
            txns: ledger(s.txns, [{ id: uid("t"), customerId: s.meId, at: demoNow().toISOString(), kind: "topup", amount, note: `Demo top-up via ${method}` }]),
            notices: [
              ...(release ? [notice("admin", `${me.flat}, ${me.society} topped up before the van left. Held order ${held!.orderId} is back on Route ${routeById[held!.routeId]!.code}.`, "good"), notice("rider", `New stop added at the end: ${me.flat}, ${me.society}.`, "info")] : []),
              ...(covered && left ? [notice("admin", `${me.flat}, ${me.society} topped up after Route ${routeById[held!.routeId]!.code} left. Order ${held!.orderId} stays held, not charged; next delivery ${tomorrow}.`, "info")] : []),
              notice("customer", release ? `₹${amount.toLocaleString("en-IN")} added. Your milk is back in this morning's run.` : covered && left ? `₹${amount.toLocaleString("en-IN")} added. This morning's van has already left, so today's milk won't come and you won't be charged for it. Your next delivery is ${tomorrow}.` : `₹${amount.toLocaleString("en-IN")} added to your wallet (demo payment).`, "good"),
              ...s.notices,
            ],
          };
        }),

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
          opening: { ...s.opening, [id]: 0 },
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

      /** Add one spare from the van to this morning's order, at the normal price. Charged only on delivery. */
      buyFromVan: (pid) => {
        const s = get();
        const stop = s.stops.find((x) => x.customerId === s.meId);
        if (!stop) return "none";
        if (stop.status !== "pending") return "passed";
        if ((sparesLeft(s.stops, stop.routeId)[pid] ?? 0) <= 0) return "gone";
        const me = s.customers.find((c) => c.id === s.meId)!;
        const items = mergeItems(stop.items, [{ productId: pid, qty: 1 }]);
        if (me.wallet < lineTotal(items)) return "wallet";
        const p = productById[pid]!;
        set({
          stops: s.stops.map((x) => (x.id === stop.id ? { ...x, items, prices: { ...pricesFor([{ productId: pid, qty: 1 }]), ...x.prices }, fromVan: mergeItems(x.fromVan ?? [], [{ productId: pid, qty: 1 }]) } : x)),
          notices: [
            notice("rider", `Add 1 ${p.name} from the spares for ${me.flat}, ${me.society}.`, "info"),
            ...s.notices,
          ],
        });
        return "ok";
      },

      updateDropNote: (note) =>
        set((s) => ({
          customers: s.customers.map((c) => (c.id === s.meId ? { ...c, dropNote: note.trim() || c.dropNote, dropNoteAt: new Date().toISOString() } : c)),
          notices: [notice("admin", `${s.customers.find((c) => c.id === s.meId)!.flat}: drop instructions updated.`, "info"), ...s.notices],
        })),

      shareInvite: () =>
        set((s) => {
          const me = s.customers.find((c) => c.id === s.meId)!;
          return { shares: [...s.shares, { customerId: me.id, society: me.society, routeId: me.routeId, at: new Date().toISOString() }] };
        }),

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

      /**
       * Mark a stop with exactly what was handed over.
       * - Fewer than ordered: the rest is recorded as short, not charged, and a ticket is opened.
       * - More than ordered: the extra comes from the van's spares (only as many as are left and
       *   only if the wallet covers it), charged at the order's price.
       * - Nothing handed over: a failed attempt (problem), not a delivery.
       */
      deliver: (stopId, bottles, deliveredItems) => {
        const s0 = get();
        const found = s0.stops.find((x) => x.id === stopId);
        if (!found || found.status !== "pending") return;
        const asked = (deliveredItems ?? found.items).map((i) => ({ productId: i.productId, qty: Math.max(0, Math.floor(i.qty)) }));
        if (!asked.some((i) => i.qty > 0)) {
          get().flagStop(stopId, "missing", "Nothing could be handed over");
          return;
        }
        set((s) => {
          let stop = found;
          const left = sparesLeft(s.stops, found.routeId);
          const wallet = s.customers.find((c) => c.id === found.customerId)!.wallet;
          const extras: LineItem[] = [];
          const given: LineItem[] = [];
          for (const g of asked) {
            const ordered = found.items.find((i) => i.productId === g.productId)?.qty ?? 0;
            if (g.qty <= ordered) {
              if (g.qty > 0) given.push({ ...g }); // a smaller quantity is kept exactly as entered
              continue;
            }
            let extra = Math.min(g.qty - ordered, Math.max(0, left[g.productId] ?? 0));
            const priced = { ...found, prices: { ...pricesFor([g]), ...found.prices } };
            while (extra > 0 && chargeFor({ ...priced, items: mergeItems(found.items, [...extras, { productId: g.productId, qty: extra }]) }, mergeItems(found.items, [...extras, { productId: g.productId, qty: extra }])) > wallet) extra--;
            if (ordered + extra > 0) given.push({ productId: g.productId, qty: ordered + extra });
            if (extra) extras.push({ productId: g.productId, qty: extra });
          }
          if (extras.length) stop = { ...found, items: mergeItems(found.items, extras), prices: { ...pricesFor(extras), ...found.prices }, fromVan: mergeItems(found.fromVan ?? [], extras), atDoor: mergeItems(found.atDoor ?? [], extras) };
          const amount = chargeFor(stop, given);
          const missing = shortLines(stop.items, given);
          const cust = s.customers.find((c) => c.id === stop.customerId)!;
          const isMe = stop.customerId === s.meId;
          const autoTicket: Exception[] = missing.length
            ? [{ id: uid("ex"), kind: "missing", customerId: stop.customerId, routeId: stop.routeId, source: "rider", message: `Couldn't deliver ${missing.map((m) => `${m.qty} × ${productById[m.productId]!.name}`).join(", ")} at ${cust.flat}, ${cust.society}. Not charged.`, createdAt: new Date().toISOString(), status: "open", orderId: stop.orderId, items: missing }]
            : [];
          return {
            stops: s.stops.map((x) =>
              x.id === stopId ? { ...stop, status: "delivered", at: nextAt(s.stops, stop.routeId), bottlesCollected: bottles ?? x.bottlesDue, issueNote: missing.length ? "Partly delivered" : undefined, delivered: given, charged: amount, confirmed: false, confirmedAt: undefined } : x,
            ),
            customers: s.customers.map((c) => (c.id === stop.customerId ? { ...c, wallet: c.wallet - amount } : c)),
            txns: amount ? ledger(s.txns, [{ id: uid("t"), customerId: stop.customerId, at: demoNow().toISOString(), kind: "debit", amount, note: missing.length ? "Delivery, part order" : "Daily delivery", orderId: stop.orderId }]) : s.txns,
            exceptions: [...autoTicket, ...s.exceptions],
            notices: [
              ...(isMe ? [notice("customer", missing.length ? `Part of today's order was delivered. ${missing.map((m) => `${m.qty} × ${productById[m.productId]!.name}`).join(", ")} couldn't be delivered and wasn't charged.` : "Your milk has just been delivered.", missing.length ? "warn" : "good")] : []),
              ...(missing.length ? [notice("admin", `Route ${routeById[stop.routeId]!.code}: part delivery at ${cust.flat}, ${cust.society} (order ${stop.orderId}).`, "warn")] : []),
              ...s.notices,
            ],
          };
        });
      },

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

      /**
       * Reopen a stop. The delivery's charge is reversed with its own ledger entry, minus anything
       * already refunded on it, so the customer never gets the same money back twice. The original
       * debit and refunds stay in the history; a reversal is recorded even when nothing is left to return.
       */
      undoStop: (stopId) =>
        set((s) => {
          const stop = s.stops.find((x) => x.id === stopId);
          if (!stop || (stop.status !== "delivered" && stop.status !== "issue")) return {};
          const hadCharge = stop.status === "delivered" && (stop.charged ?? 0) > 0;
          const back = hadCharge ? Math.max(0, netCharged(stop.orderId, s.txns)) : 0;
          const refunded = hadCharge ? (stop.charged ?? 0) - back : 0;
          return {
            // extras handed over at the door go back into the van's spares
            stops: s.stops.map((x) => (x.id === stopId ? { ...x, items: shortLines(x.items, x.atDoor ?? []), fromVan: shortLines(x.fromVan ?? [], x.atDoor ?? []), atDoor: undefined, status: "pending", at: undefined, bottlesCollected: 0, issueNote: undefined, delivered: undefined, charged: undefined, confirmed: false, confirmedAt: undefined } : x)),
            customers: back ? s.customers.map((c) => (c.id === stop.customerId ? { ...c, wallet: c.wallet + back } : c)) : s.customers,
            txns: hadCharge ? ledger(s.txns, [{ id: uid("t"), customerId: stop.customerId, at: demoNow().toISOString(), kind: "reversal", amount: back, note: refunded > 0 ? `Delivery undone: ₹${back} returned (₹${refunded} was already refunded)` : "Delivery undone by rider", orderId: stop.orderId }]) : s.txns,
            // rider-raised tickets for this order no longer apply once the stop is reopened
            exceptions: s.exceptions.filter((e) => !(e.orderId === stop.orderId && e.source === "rider" && e.status === "open")),
          };
        }),

      /** Demo helper: reopen every drop on a route (each one reversed like an undo) and start the round again. */
      restartRound: (routeId) => {
        const done = get().stops.filter((x) => x.routeId === routeId && (x.status === "delivered" || x.status === "issue"));
        for (const x of done) get().undoStop(x.id);
        set((s) => ({ shift: { ...s.shift, handedOverAt: null, returnedBottles: null } }));
        return done.length;
      },

      /* ---------------- admin ---------------- */

      /** Refund a ticket, bounded by what is still charged and not already refunded or replaced. */
      resolve: (exId, refundAsked, resolution) => {
        const s = get();
        const ex = s.exceptions.find((e) => e.id === exId);
        if (!ex || ex.status === "resolved") return 0;
        const cap = refundCap(ex, ex.orderId ? orderById(s, ex.orderId) : undefined, s.txns, s.exceptions);
        const refund = Math.max(0, Math.min(Math.floor(refundAsked), cap));
        const isMe = ex.customerId === s.meId;
        set({
          exceptions: s.exceptions.map((e) => (e.id === exId ? { ...e, status: "resolved", refund, resolution, compensation: refund ? { kind: "refund", amount: refund } : { kind: "none" } } : e)),
          customers: refund ? s.customers.map((c) => (c.id === ex.customerId ? { ...c, wallet: c.wallet + refund } : c)) : s.customers,
          txns: refund ? ledger(s.txns, [{ id: uid("t"), customerId: ex.customerId, at: demoNow().toISOString(), kind: "refund", amount: refund, note: `Refund: ${kindLabel[ex.kind].toLowerCase()}`, orderId: ex.orderId }]) : s.txns,
          notices: isMe ? [notice("customer", refund ? `We've credited ₹${refund} for your ${kindLabel[ex.kind].toLowerCase()} report.` : `Your ${kindLabel[ex.kind].toLowerCase()} report is resolved: ${resolution}.`, "good"), ...s.notices] : s.notices,
        });
        return refund;
      },

      /** Items that never arrived: deliver them on the next open run, charged only when delivered. */
      scheduleRetry: (exId) => scheduleOneOff(exId, "retry"),

      /** Delivered, paid-for items that were defective: replace them free on the next open run. */
      scheduleReplacement: (exId) => scheduleOneOff(exId, "replacement"),

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
        const queue = byRoute.get(rid)!.sort((a, b) => a.seq - b.seq);
        const next = queue[0]!;
        // now and then a home further down the route buys a spare from the van
        const buyer = queue[1 + Math.floor(Math.random() * Math.max(1, queue.length - 1))];
        if (buyer && Math.random() < 0.25) {
          const left = Object.entries(sparesLeft(s.stops, rid)).filter(([, n]) => n > 0);
          const c = s.customers.find((x) => x.id === buyer.customerId)!;
          const pick = left[Math.floor(Math.random() * left.length)];
          if (pick && c.wallet >= lineTotal(buyer.items) + productById[pick[0]]!.price) {
            set({ stops: s.stops.map((x) => (x.id === buyer.id ? { ...x, items: mergeItems(x.items, [{ productId: pick[0], qty: 1 }]), fromVan: mergeItems(x.fromVan ?? [], [{ productId: pick[0], qty: 1 }]) } : x)) });
          }
        }
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
            pastOrders: archive(s.stops, s.pastOrders),
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
          notices: id === s.meId ? [notice("customer", "We noticed a few missed mornings. Reply here or call the hub and we'll sort out your delivery time or drop spot.", "info"), ...s.notices] : s.notices,
        })),
      remindLowBalances: (ids) =>
        set((s) => ({
          remindedAt: new Date().toISOString(),
          notices: [
            ...(ids.includes(s.meId) ? [(() => {
              const held = s.stops.find((x) => x.customerId === s.meId && x.status === "held");
              const w = s.customers.find((c) => c.id === s.meId)!.wallet;
              return held
                ? notice("customer", `This morning's milk is held: add ₹${Math.max(0, lineTotal(held.items) - w)} and it goes straight back on the van.`, "warn")
                : notice("customer", "Your wallet is running low. Add money before 10 PM so tomorrow's milk isn't held.", "warn");
            })()] : []),
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

      reset: () => set({ ...fresh(), role: get().role, session: get().session === "customer" ? null : get().session, meId: ME, riderLang: get().riderLang }),
    }),
    {
      name: KEY,
      version: 7,
      storage: createJSONStorage(() => tabStorage),
      // sign-in, basket and the simulation switch stay with the tab; everything else is shared
      partialize: (s) => {
        const { simOn: _a, session: _b, role: _c, meId: _d, cart: _e, ...rest } = s;
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
          const { simOn: _a, session: _b, role: _c, meId: _d, cart: _e, ...shared } = { ...base, ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)), overrides: { [ME]: mine } };
          // kept customers may have different balances from the fresh seed
          shared.opening = Object.fromEntries(shared.customers.map((c) => [c.id, c.wallet]));
          return shared;
        }
        // v5 saved the sign-in with the shared data; it now belongs to each tab
        const { session: _b, role: _c, meId: _d, cart: _e, ...shared } = p;
        if (version < 7) {
          // order history and refund/reversal kinds arrived in v7: older undo entries were stored as refunds
          shared.pastOrders = (shared.pastOrders as Stop[] | undefined) ?? [];
          shared.txns = ((shared.txns as Txn[] | undefined) ?? []).map((t) => (t.kind === "refund" && t.note?.startsWith("Delivery undone") ? { ...t, kind: "reversal" as const } : t));
        }
        if (version < 6) {
          // wallet checks start from the balances saved at the upgrade
          shared.opening = Object.fromEntries(((shared.customers as Customer[] | undefined) ?? []).map((c) => [c.id, c.wallet]));
          shared.events = [makeEvent({ actor: "system", who: "Demo", action: "Saved demo upgraded", detail: "Your earlier changes were kept. The activity log starts here." })];
        }
        return shared;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setDemoOffset(state.dayOffset ?? 0);
        // A new real day: keep everything, and build that morning's orders instead of resetting.
        const today = todayKey();
        if (state.stopsDate !== today) {
          const prevSeq = { ...Object.fromEntries(state.stops.map((x) => [x.customerId, x.seq])), ...state.nextSeq };
          useStore.setState({ nextSeq: {}, stopsDate: today, pastOrders: archive(state.stops, state.pastOrders ?? []), stops: generateStops(state.customers, state.overrides, today, prevSeq), shift: freshShift(false) });
        }
      },
    },
  ),
);

// Save this tab's sign-in, and follow other tabs' changes as they happen.
useStore.subscribe((s, prev) => {
  if (s.session !== prev.session || s.meId !== prev.meId || s.role !== prev.role) {
    try { sessionStorage.setItem(TAB_KEY, JSON.stringify({ session: s.session, role: s.role, meId: s.meId })); } catch { /* ignore */ }
  }
});
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) pullLatest(); });
}

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

/** Find an order by its ID, in this morning's run or in earlier mornings. */
export const orderById = (s: Pick<State, "stops" | "pastOrders">, orderId: string) => s.stops.find((x) => x.orderId === orderId) ?? s.pastOrders?.find((x) => x.orderId === orderId);
