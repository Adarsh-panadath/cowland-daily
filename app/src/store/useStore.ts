import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Customer, DayOverride, DayStatus, Exception, ExceptionKind, LineItem, Notice, Role, Stop, Txn } from "../data/types";
import { ME, productById, routeById, seedCustomers, seedExceptions, seedNotices, seedStops, seedTxns } from "../data/seed";
import { addDays, dayKey, fromKey, uid } from "../lib/format";

export const lineTotal = (items: LineItem[]) =>
  items.reduce((s, i) => s + (productById[i.productId]?.price ?? 0) * i.qty, 0);

export const mergeItems = (a: LineItem[], b: LineItem[]) => {
  const map = new Map<string, number>();
  for (const i of [...a, ...b]) map.set(i.productId, (map.get(i.productId) ?? 0) + i.qty);
  return [...map.entries()].filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
};

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

const atToday = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

interface State {
  role: Role;
  session: Role | null;
  customers: Customer[];
  stops: Stop[];
  exceptions: Exception[];
  txns: Txn[];
  notices: Notice[];
  overrides: Record<string, DayOverride>; // for ME, keyed by YYYY-MM-DD
  cart: LineItem[];
  simOn: boolean;
  seedDay: string;
  autoTopUp: boolean;
  offers: Record<string, string>;
  remindedAt: string | null;
  planned: Record<string, boolean>;
  riderLang: RiderLang;
  shift: RiderShift;

  setRole: (r: Role) => void;
  signIn: (r: Role) => void;
  signOut: () => void;

  // customer
  setDayStatus: (date: string, status: DayStatus) => void;
  bumpExtra: (date: string, productId: string, delta: number) => void;
  setVacation: (from: string, to: string) => number;
  setPlanQty: (productId: string, qty: number) => void;
  topUp: (amount: number, method: string) => void;
  cartAdd: (productId: string, delta: number) => void;
  cartClear: () => void;
  checkout: (date: string) => number;
  reportIssue: (kind: ExceptionKind, message: string) => void;
  confirmReceived: () => void;

  // rider
  deliver: (stopId: string, bottles?: number) => void;
  flagStop: (stopId: string, kind: ExceptionKind, note: string) => void;
  setBottles: (stopId: string, n: number) => void;
  undoStop: (stopId: string) => void;

  // admin
  resolve: (exId: string, refund: number, resolution: string) => void;
  broadcast: (text: string) => void;
  toggleCustomer: (customerId: string) => void;
  setSim: (on: boolean) => void;
  tick: () => void;

  setAutoTopUp: (on: boolean) => void;
  sendOffer: (customerId: string) => void;
  remindLowBalances: (ids: string[]) => void;
  togglePlanned: (id: string) => void;
  setRiderLang: (l: RiderLang) => void;
  toggleLoadItem: (productId: string) => void;
  confirmLoad: (short: string[]) => void;
  handover: (returned: number) => void;
  startNewShift: () => void;
  markRead: (role: Role) => void;
  reset: () => void;
}

const fresh = () => ({
  role: "customer" as Role,
  session: null as Role | null,
  customers: structuredClone(seedCustomers),
  stops: structuredClone(seedStops),
  exceptions: structuredClone(seedExceptions),
  txns: structuredClone(seedTxns),
  notices: structuredClone(seedNotices),
  overrides: {
    [dayKey(addDays(new Date(), 3))]: { extras: [{ productId: "a2", qty: 2 }] },
    [dayKey(addDays(new Date(), 5))]: { extras: [{ productId: "paneer", qty: 1 }] },
  } as Record<string, DayOverride>,
  cart: [] as LineItem[],
  simOn: false,
  seedDay: dayKey(new Date()),
  autoTopUp: true,
  offers: {} as Record<string, string>,
  remindedAt: null as string | null,
  planned: {} as Record<string, boolean>,
  riderLang: "en" as RiderLang,
  shift: { loadedAt: atToday(4, 41), checked: {}, short: [], handedOverAt: null, returnedBottles: null } as RiderShift,
});

/** Keep the demo on a coherent dawn timeline: each new drop lands 2–3 minutes after the route's last one. */
function nextAt(stops: Stop[], routeId: string) {
  const last = stops.filter((x) => x.routeId === routeId && x.at).map((x) => x.at!).sort().at(-1);
  const base = last ? new Date(last) : (() => { const d = new Date(); d.setHours(5, 15, 0, 0); return d; })();
  return new Date(base.getTime() + (120 + Math.random() * 60) * 1000).toISOString();
}

const notice = (role: Role, text: string, tone: Notice["tone"] = "info"): Notice => ({
  id: uid("n"),
  role,
  text,
  at: new Date().toISOString(),
  read: false,
  tone,
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...fresh(),

      setRole: (role) => set({ role }),
      signIn: (role) => set({ session: role, role }),
      signOut: () => set({ session: null, simOn: false }),

      setDayStatus: (date, status) =>
        set((s) => ({ overrides: { ...s.overrides, [date]: { ...s.overrides[date], status } } })),

      bumpExtra: (date, productId, delta) =>
        set((s) => {
          const cur = s.overrides[date] ?? {};
          const extras = mergeItems(cur.extras ?? [], [{ productId, qty: delta }]);
          return { overrides: { ...s.overrides, [date]: { ...cur, extras } } };
        }),

      setVacation: (from, to) => {
        let n = 0;
        set((s) => {
          const o = { ...s.overrides };
          for (let d = fromKey(from); d <= fromKey(to); d = addDays(d, 1)) {
            const k = dayKey(d);
            o[k] = { ...o[k], status: "vacation" };
            n++;
          }
          return { overrides: o };
        });
        return n;
      },

      setPlanQty: (productId, qty) =>
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id !== ME
              ? c
              : {
                  ...c,
                  plan: qty <= 0
                    ? c.plan.filter((p) => p.productId !== productId)
                    : c.plan.some((p) => p.productId === productId)
                      ? c.plan.map((p) => (p.productId === productId ? { ...p, qty } : p))
                      : [...c.plan, { productId, qty }],
                },
          ),
        })),

      topUp: (amount, method) =>
        set((s) => ({
          customers: s.customers.map((c) => (c.id === ME ? { ...c, wallet: c.wallet + amount } : c)),
          txns: [{ id: uid("t"), customerId: ME, at: new Date().toISOString(), kind: "topup", amount, note: `Top-up via ${method}` }, ...s.txns],
          notices: [notice("customer", `₹${amount.toLocaleString("en-IN")} added to your wallet.`, "good"), ...s.notices],
        })),

      cartAdd: (productId, delta) => set((s) => ({ cart: mergeItems(s.cart, [{ productId, qty: delta }]) })),
      cartClear: () => set({ cart: [] }),

      checkout: (date) => {
        const { cart } = get();
        const total = lineTotal(cart);
        set((s) => {
          const cur = s.overrides[date] ?? {};
          return {
            overrides: { ...s.overrides, [date]: { ...cur, status: cur.status === "scheduled" || !cur.status ? cur.status : "scheduled", extras: mergeItems(cur.extras ?? [], s.cart) } },
            cart: [],
          };
        });
        return total;
      },

      reportIssue: (kind, message) =>
        set((s) => {
          const me = s.customers.find((c) => c.id === ME)!;
          const ex: Exception = { id: uid("ex"), kind, customerId: ME, routeId: me.routeId, source: "customer", message, createdAt: new Date().toISOString(), status: "open" };
          return {
            exceptions: [ex, ...s.exceptions],
            notices: [notice("admin", `New ticket from ${me.name}, ${me.flat} ${me.society}: ${kindLabel[kind].toLowerCase()}.`, "warn"), ...s.notices],
          };
        }),

      confirmReceived: () =>
        set((s) => ({ stops: s.stops.map((x) => (x.customerId === ME ? { ...x, confirmed: true } : x)) })),

      deliver: (stopId, bottles) =>
        set((s) => {
          const stop = s.stops.find((x) => x.id === stopId);
          if (!stop || stop.status === "delivered") return {};
          const amount = lineTotal(stop.items);
          const isMe = stop.customerId === ME;
          return {
            stops: s.stops.map((x) =>
              x.id === stopId ? { ...x, status: "delivered", at: nextAt(s.stops, stop.routeId), bottlesCollected: bottles ?? x.bottlesDue, issueNote: undefined } : x,
            ),
            customers: s.customers.map((c) => (c.id === stop.customerId ? { ...c, wallet: c.wallet - amount } : c)),
            txns: isMe
              ? [{ id: uid("t"), customerId: ME, at: new Date().toISOString(), kind: "debit" as const, amount, note: "Daily delivery" }, ...s.txns]
              : s.txns,
            notices: isMe ? [notice("customer", "Your milk has just been delivered.", "good"), ...s.notices] : s.notices,
          };
        }),

      flagStop: (stopId, kind, note) =>
        set((s) => {
          const stop = s.stops.find((x) => x.id === stopId);
          if (!stop) return {};
          const cust = s.customers.find((c) => c.id === stop.customerId)!;
          const ex: Exception = {
            id: uid("ex"),
            kind,
            customerId: stop.customerId,
            routeId: stop.routeId,
            source: "rider",
            message: note || `${kindLabel[kind]} at ${cust.flat}, ${cust.society}.`,
            createdAt: new Date().toISOString(),
            status: "open",
          };
          return {
            stops: s.stops.map((x) => (x.id === stopId ? { ...x, status: "issue", at: nextAt(s.stops, stop.routeId), issueNote: note || kindLabel[kind] } : x)),
            exceptions: [ex, ...s.exceptions],
            notices: [notice("admin", `Route ${routeById[stop.routeId]!.code}: ${kindLabel[kind].toLowerCase()} at ${cust.flat}, ${cust.society}.`, "warn"), ...s.notices],
          };
        }),

      setBottles: (stopId, n) =>
        set((s) => ({ stops: s.stops.map((x) => (x.id === stopId ? { ...x, bottlesCollected: Math.max(0, n) } : x)) })),

      undoStop: (stopId) =>
        set((s) => {
          const stop = s.stops.find((x) => x.id === stopId);
          if (!stop) return {};
          const refund = stop.status === "delivered" ? lineTotal(stop.items) : 0;
          return {
            stops: s.stops.map((x) => (x.id === stopId ? { ...x, status: "pending", at: undefined, bottlesCollected: 0, issueNote: undefined } : x)),
            customers: s.customers.map((c) => (c.id === stop.customerId ? { ...c, wallet: c.wallet + refund } : c)),
          };
        }),

      resolve: (exId, refund, resolution) =>
        set((s) => {
          const ex = s.exceptions.find((e) => e.id === exId);
          if (!ex) return {};
          const isMe = ex.customerId === ME;
          return {
            exceptions: s.exceptions.map((e) => (e.id === exId ? { ...e, status: "resolved", refund, resolution } : e)),
            customers: refund ? s.customers.map((c) => (c.id === ex.customerId ? { ...c, wallet: c.wallet + refund } : c)) : s.customers,
            txns: refund && isMe ? [{ id: uid("t"), customerId: ME, at: new Date().toISOString(), kind: "refund" as const, amount: refund, note: `Refund — ${kindLabel[ex.kind].toLowerCase()}` }, ...s.txns] : s.txns,
            notices: isMe
              ? [notice("customer", refund ? `We've credited ₹${refund} for your ${kindLabel[ex.kind].toLowerCase()} report.` : `Your ${kindLabel[ex.kind].toLowerCase()} report is resolved: ${resolution}.`, "good"), ...s.notices]
              : s.notices,
          };
        }),

      broadcast: (text) => set((s) => ({ notices: [notice("rider", text, "warn"), ...s.notices] })),

      toggleCustomer: (id) =>
        set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, status: c.status === "active" ? "paused" : "active" } : c)) })),

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

      setAutoTopUp: (autoTopUp) => set({ autoTopUp }),
      sendOffer: (id) =>
        set((s) => ({
          offers: { ...s.offers, [id]: new Date().toISOString() },
          notices: id === ME ? [notice("customer", "A gift from Cowland: your next top-up of ₹1,000 or more comes with a free bottle of A2 milk.", "good"), ...s.notices] : s.notices,
        })),
      remindLowBalances: (ids) =>
        set((s) => ({
          remindedAt: new Date().toISOString(),
          notices: [
            ...(ids.includes(ME) ? [notice("customer", "Your wallet is running low. Add money before 10 PM so tomorrow's milk isn't held.", "warn")] : []),
            notice("admin", `Top-up reminder sent to ${ids.length} households.`, "info"),
            ...s.notices,
          ],
        })),
      togglePlanned: (id) => set((s) => ({ planned: { ...s.planned, [id]: !s.planned[id] } })),
      setRiderLang: (riderLang) => set({ riderLang }),

      toggleLoadItem: (pid) => set((s) => ({ shift: { ...s.shift, checked: { ...s.shift.checked, [pid]: !s.shift.checked[pid] } } })),

      confirmLoad: (short) =>
        set((s) => ({
          shift: { ...s.shift, loadedAt: atToday(4, 40 + Math.floor(Math.random() * 6)), short },
          notices: short.length
            ? [notice("admin", `Route 04 left the hub short: ${short.map((id) => productById[id]?.name ?? id).join(", ")}. Send a top-up with the 5:30 runner.`, "warn"), ...s.notices]
            : [notice("admin", "Route 04 crate checked and loaded in full.", "good"), ...s.notices],
        })),

      handover: (returned) =>
        set((s) => {
          const r4 = s.stops.filter((x) => x.routeId === "r4");
          const collected = r4.reduce((a, x) => a + x.bottlesCollected, 0);
          const last = r4.map((x) => x.at).filter(Boolean).sort().at(-1);
          const at = new Date((last ? new Date(last).getTime() : Date.now()) + 16 * 60000).toISOString();
          const gap = collected - returned;
          return {
            shift: { ...s.shift, handedOverAt: at, returnedBottles: returned },
            notices: [notice("admin", `Ganesh (Route 04) handed over ${returned} empty bottles${gap > 0 ? `, ${gap} fewer than collected` : ""}.`, gap > 0 ? "warn" : "good"), ...s.notices],
          };
        }),

      startNewShift: () =>
        set((s) => {
          const refunds = new Map<string, number>();
          for (const x of s.stops) if (x.routeId === "r4" && x.status === "delivered") refunds.set(x.customerId, lineTotal(x.items));
          return {
            stops: s.stops.map((x) => (x.routeId === "r4" ? { ...x, status: "pending" as const, at: undefined, bottlesCollected: 0, issueNote: undefined, confirmed: false } : x)),
            customers: s.customers.map((c) => (refunds.has(c.id) ? { ...c, wallet: c.wallet + refunds.get(c.id)! } : c)),
            txns: refunds.has(ME) ? [{ id: uid("t"), customerId: ME, at: new Date().toISOString(), kind: "refund" as const, amount: refunds.get(ME)!, note: "Today's delivery restarted (demo)" }, ...s.txns] : s.txns,
            shift: { loadedAt: null, checked: {}, short: [], handedOverAt: null, returnedBottles: null },
          };
        }),

      markRead: (role) => set((s) => ({ notices: s.notices.map((n) => (n.role === role ? { ...n, read: true } : n)) })),

      reset: () => set({ ...fresh(), role: get().role, session: get().session, riderLang: get().riderLang }),
    }),
    {
      name: "cowland-daily-demo",
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { simOn: _simOn, ...rest } = s;
        return rest;
      },
      // A new calendar day starts a fresh demo morning.
      onRehydrateStorage: () => (state) => {
        if (state && state.seedDay !== dayKey(new Date())) state.reset();
      },
    },
  ),
);

/* ---------- selectors ---------- */

export const useMe = () => useStore((s) => s.customers.find((c) => c.id === ME)!);

export function itemsForDay(plan: LineItem[], o: DayOverride | undefined) {
  if (o?.status === "skipped" || o?.status === "vacation") return [];
  return mergeItems(plan, o?.extras ?? []);
}

export const volumeMl = (items: LineItem[]) =>
  items.reduce((s, i) => s + (productById[i.productId]?.volumeMl ?? 0) * i.qty, 0);
