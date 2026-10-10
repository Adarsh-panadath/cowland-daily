/**
 * Turns each store action into a plain-English line for the activity log,
 * by comparing the data before and after the click.
 */
import type { ActivityEvent, Actor, Customer, DayOverride, Role, Stop } from "../data/types";
import { productById, riderById, routeById } from "../data/seed";
import { accounts } from "../lib/auth";
import { fromKey, todayKey, uid } from "../lib/format";
import { itemsOn, lineTotal } from "./rules";

export interface Snap {
  session: Role | null;
  meId: string;
  customers: Customer[];
  stops: Stop[];
  overrides: Record<string, Record<string, DayOverride>>;
  exceptions: { id: string; kind: string; orderId?: string; customerId: string; status: string; refund?: number }[];
  waitlist: { id: string }[];
  cart: { productId: string; qty: number }[];
  shift: { loadedAt: string | null; short: string[] };
  dayOffset: number;
}

const day = (k: string) => fromKey(k).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const items = (l: { productId: string; qty: number }[]) => l.map((i) => `${i.qty} × ${productById[i.productId]?.name ?? i.productId}`).join(", ") || "nothing";
const prod = (id: string) => productById[id]?.name ?? id;
const riderOf = (routeId: string) => riderById[routeById[routeId]?.riderId ?? ""]?.name ?? "Rider";

const CUSTOMER = new Set(["setDayStatus", "setDayQty", "setVacation", "savePlan", "topUp", "checkout", "reportIssue", "confirmReceived", "signup", "buyFromVan", "updateDropNote", "shareInvite", "joinWaitlist"]);
const RIDER = new Set(["deliver", "flagStop", "undoStop", "confirmLoad", "handover", "restartRound"]);

export function describe(name: string, args: unknown[], b: Snap, a: Snap, r: unknown, inTick: boolean): Omit<ActivityEvent, "id" | "at" | "day"> | null {
  const me = a.customers.find((c) => c.id === a.meId) ?? b.customers.find((c) => c.id === b.meId);
  const meName = me?.contact ?? "Customer";
  const stopOf = (id: unknown, s: Snap) => s.stops.find((x) => x.id === id);
  const home = (st?: Stop) => { const c = a.customers.find((x) => x.id === st?.customerId); return c ? `${c.flat}, ${c.society}` : "a home"; };
  let actor: Actor = CUSTOMER.has(name) ? "customer" : RIDER.has(name) ? "rider" : "hub";
  if (inTick) actor = "simulation";
  if (name === "joinWaitlist") actor = "customer";
  if (name === "advanceDay" || name === "reset") actor = b.session === "rider" ? "rider" : b.session === "customer" ? "customer" : "hub";
  const who = (st?: Stop) => (actor === "customer" ? (name === "joinWaitlist" ? String((args[0] as { name?: string })?.name ?? "Visitor") : meName) : actor === "rider" || actor === "simulation" ? riderOf(st?.routeId ?? "r4") : accounts.admin.name);
  const blocked = (what: string) => ({ actor, who: who(), action: "Blocked", detail: `${what}: ${r === "locked" ? "that day is locked for packing (10 PM cutoff)" : r === "off" ? "that day is paused, resume it first" : String(r)}`, blocked: true });

  switch (name) {
    case "signIn": return { actor: (args[0] === "admin" ? "hub" : args[0]) as Actor, who: args[0] === "customer" ? meName : accounts[args[0] as Role].name, action: "Signed in", detail: `${accounts[args[0] as Role].label} app` };
    case "setDayStatus": {
      const [d, st] = args as [string, string];
      if (r !== "ok") return blocked(`Change ${day(d)}`);
      return { actor, who: who(), action: st === "skipped" ? "Skipped a day" : "Resumed a day", detail: `${day(d)}${st === "skipped" ? ", won't be charged" : ""}` };
    }
    case "setDayQty": {
      const [d, pid, q] = args as [string, string, number];
      if (r !== "ok") return blocked(`Change ${prod(pid)} on ${day(d)}`);
      const before = me ? itemsOn(me, b.overrides[me.id]?.[d], d).find((i) => i.productId === pid)?.qty ?? 0 : 0;
      return { actor, who: who(), action: "Changed a day", detail: `${day(d)}: ${prod(pid)} ${before} → ${q}` };
    }
    case "setVacation": return { actor, who: who(), action: "Paused for a trip", detail: `${r} day${r === 1 ? "" : "s"} from ${day(args[0] as string)}` };
    case "savePlan": return { actor, who: who(), action: "New regular order", detail: `${items(args[0] as never)} from ${day(r as string)}` };
    case "topUp": {
      const held = b.stops.find((x) => x.customerId === b.meId && x.status === "held");
      const back = held && a.stops.find((x) => x.id === held.id)?.status === "pending";
      return { actor, who: who(), action: "Topped up wallet", detail: `Demo payment via ${args[1]}${back ? `. Held order ${held!.orderId} went back on the van` : ""}`, amount: args[0] as number, orderId: back ? held!.orderId : undefined };
    }
    case "checkout": {
      const d = args[0] as string;
      if (r !== "ok") return blocked(`Add basket to ${day(d)}`);
      return { actor, who: who(), action: "Ordered extras", detail: `${items(b.cart)} on ${day(d)}` };
    }
    case "reportIssue": {
      const ex = a.exceptions[0];
      return { actor, who: who(), action: "Reported a problem", detail: `${String(args[0])}${args[2] ? `: ${items(args[2] as never)}` : ""}`, orderId: ex?.orderId };
    }
    case "confirmReceived": return { actor, who: who(), action: "Confirmed delivery", detail: "Tapped \"I've got my milk\"", orderId: a.stops.find((x) => x.customerId === a.meId)?.orderId };
    case "signup": {
      const c = a.customers.find((x) => x.id === r);
      return { actor: "customer", who: c?.contact ?? "New customer", action: "Signed up", detail: c ? `${c.flat}, ${c.society} on Route ${routeById[c.routeId]?.code}. First delivery ${day(c.startDate!)}` : "", amount: c?.wallet || undefined };
    }
    case "buyFromVan": {
      const pid = args[0] as string;
      const st = a.stops.find((x) => x.customerId === a.meId);
      if (r !== "ok") return { actor, who: who(), action: "Blocked", detail: `Spare ${prod(pid)}: ${r === "gone" ? "sold out on the van" : r === "passed" ? "the van has already been" : r === "wallet" ? "wallet too low" : "no order today"}`, blocked: true };
      return { actor, who: who(), action: "Bought a spare from the van", detail: `1 × ${prod(pid)}, ₹${productById[pid]?.price}, charged on delivery`, orderId: st?.orderId };
    }
    case "updateDropNote": return { actor, who: who(), action: "Updated drop instructions", detail: `"${String(args[0]).slice(0, 80)}"` };
    case "shareInvite": return { actor, who: who(), action: "Shared an invite", detail: me ? `Neighbours in ${me.society}` : "" };
    case "joinWaitlist": {
      const e = args[0] as { area: string; litres: number };
      return { actor, who: who(), action: r === "added" ? "Joined the waitlist" : "Blocked", detail: r === "added" ? `${e.area}, ${e.litres} L a day` : `Already on the ${e.area} list`, blocked: r !== "added" };
    }
    case "deliver": {
      const before = stopOf(args[0], b), after = stopOf(args[0], a);
      if (!after || before?.status === after.status) return null;
      const short = after.items.filter((i) => (after.delivered?.find((d) => d.productId === i.productId)?.qty ?? 0) < i.qty);
      const extra = after.atDoor?.length && !before?.atDoor?.length ? `. Extra from van spares: ${items(after.atDoor)}` : "";
      return { actor, who: who(after), action: short.length ? "Part delivered" : "Delivered", detail: `${home(after)}${short.length ? `. Not delivered (not charged): ${items(short.map((i) => ({ productId: i.productId, qty: i.qty - (after.delivered?.find((d) => d.productId === i.productId)?.qty ?? 0) })))}` : ""}${extra}. ${after.bottlesCollected} empty bottle${after.bottlesCollected === 1 ? "" : "s"} back`, orderId: after.orderId, amount: -(after.charged ?? 0) };
    }
    case "flagStop": {
      const after = stopOf(args[0], a);
      if (!after || after.status !== "issue") return null;
      return { actor, who: who(after), action: "Couldn't deliver", detail: `${home(after)}: ${after.issueNote}. Not charged`, orderId: after.orderId };
    }
    case "undoStop": {
      const before = stopOf(args[0], b), after = stopOf(args[0], a);
      if (!before || !after || before.status === after.status) return null;
      return { actor, who: who(after), action: "Undid a drop", detail: `${home(after)} is pending again${before.charged ? `, ₹${before.charged} reversed` : ""}`, orderId: after.orderId, amount: before.status === "delivered" ? before.charged ?? 0 : undefined };
    }
    case "resolve": {
      const ex = b.exceptions.find((e) => e.id === args[0]);
      if (!ex || ex.status === "resolved") return null;
      return { actor, who: who(), action: "Resolved a ticket", detail: `${ex.kind}${r ? `, refunded ₹${r}` : ", no refund"}`, orderId: ex.orderId, amount: (r as number) || undefined };
    }
    case "scheduleRetry": {
      if (!r) return null;
      const ex = b.exceptions.find((e) => e.id === args[0]);
      return { actor, who: who(), action: "Scheduled a retry", detail: `Missing items added to the ${day(r as string)} delivery, charged only on delivery`, orderId: ex?.orderId };
    }
    case "broadcast": return { actor, who: who(), action: "Messaged riders", detail: `"${String(args[0]).slice(0, 80)}"` };
    case "toggleCustomer": { const c = a.customers.find((x) => x.id === args[0]); return { actor, who: who(), action: c?.status === "paused" ? "Paused a household" : "Resumed a household", detail: c ? `${c.contact}, ${c.flat} ${c.society}` : "" }; }
    case "applyRouteOrder": return { actor, who: who(), action: "Changed stop order", detail: `Route ${routeById[args[0] as string]?.code}: ${r === "now" ? "applied to this morning's run" : "saved for the next morning"}` };
    case "setSim": return { actor, who: who(), action: args[0] ? "Started the simulation" : "Paused the simulation", detail: "Routes 01, 02, 03 and 05" };
    case "advanceDay": {
      const held = a.stops.filter((x) => x.status === "held").length;
      return { actor, who: actor === "hub" ? accounts.admin.name : actor === "rider" ? riderOf("r4") : meName, action: "Next delivery morning", detail: `${day(todayKey())}: ${a.stops.length} orders built, ${held} held for low wallets` };
    }
    case "sendOffer": { const c = a.customers.find((x) => x.id === args[0]); return { actor, who: who(), action: "Sent a check-in", detail: c?.contact ?? "" }; }
    case "remindLowBalances": return { actor, who: who(), action: "Sent top-up reminders", detail: `${(args[0] as string[]).length} households` };
    case "confirmLoad": return { actor, who: riderOf("r4"), action: "Loaded the crate", detail: (args[0] as string[]).length ? `Short: ${(args[0] as string[]).map(prod).join(", ")}` : "Everything on board" };
    case "handover": return { actor, who: riderOf("r4"), action: "Handed over at the hub", detail: `${args[0]} empty bottles returned` };
    case "restartRound": return { actor, who: riderOf(args[0] as string), action: "Restarted the round (demo)", detail: `Route ${routeById[args[0] as string]?.code}: ${r} drop${r === 1 ? "" : "s"} reopened, charges reversed` };
    case "reset": return { actor: "system", who: "Demo", action: "Reset demo data", detail: "Back to the first demo morning" };
    default: return null;
  }
}

export const makeEvent = (e: Omit<ActivityEvent, "id" | "at" | "day">): ActivityEvent => ({ id: uid("e"), at: new Date().toISOString(), day: todayKey(), ...e });

/** The simulation's own spare purchases (it changes data directly, not through a customer action). */
export function simSpares(b: Snap, a: Snap): Omit<ActivityEvent, "id" | "at" | "day">[] {
  const out: Omit<ActivityEvent, "id" | "at" | "day">[] = [];
  for (const st of a.stops) {
    const was = b.stops.find((x) => x.id === st.id)?.fromVan?.reduce((n, i) => n + i.qty, 0) ?? 0;
    const now = st.fromVan?.reduce((n, i) => n + i.qty, 0) ?? 0;
    if (now > was) {
      const c = a.customers.find((x) => x.id === st.customerId);
      const added = st.fromVan!.at(-1)!;
      out.push({ actor: "simulation", who: c?.contact ?? "Customer", action: "Bought a spare from the van", detail: `1 × ${prod(added.productId)} on Route ${routeById[st.routeId]?.code}, charged on delivery (${lineTotal([{ productId: added.productId, qty: 1 }]) ? `₹${lineTotal([{ productId: added.productId, qty: 1 }])}` : ""})`, orderId: st.orderId });
    }
  }
  return out;
}
