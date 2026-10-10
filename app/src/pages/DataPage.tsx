import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { CheckCircle2, XCircle, Download, ExternalLink, Search, Database, ChevronDown } from "lucide-react";
import { Logo } from "../components/Logo";
import { Badge, Button, Card, Segmented, inputCls } from "../components/ui";
import { useStore, useToday, lineTotal } from "../store/useStore";
import { integrityChecks, netCharged } from "../store/rules";
import { productById, routeById } from "../data/seed";
import type { Actor, LineItem, Stop } from "../data/types";
import { clock, dayMonth, inr } from "../lib/format";

type Tab = "activity" | "orders" | "ledger" | "households" | "tickets" | "waitlist";
const items = (l?: LineItem[]) => (l?.length ? l.map((i) => `${i.qty} ${productById[i.productId]?.name ?? i.productId}`).join(", ") : "—");
const actorTone: Record<Actor, "good" | "warn" | "bad" | "ink" | "accent" | "neutral"> = { customer: "accent", rider: "good", hub: "ink", simulation: "neutral", system: "neutral" };
const statusTone: Record<Stop["status"], "good" | "warn" | "bad" | "neutral"> = { delivered: "good", pending: "warn", issue: "bad", held: "bad", skipped: "neutral" };
const money = (n?: number) => (n === undefined || n === 0 ? "" : n > 0 ? `+${inr(n)}` : `−${inr(-n)}`);
const LIMIT = 150;

/**
 * A live view of everything the prototype has saved in this browser. Open it next to the apps:
 * it updates the moment a click in any tab changes the data.
 */
export default function DataPage() {
  const today = useToday();
  const s = useStore();
  const [tab, setTab] = useState<Tab>("activity");
  const [q, setQ] = useState("");
  const [actor, setActor] = useState<"all" | Actor | "blocked">("all");
  const [route, setRoute] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(1);
  const checks = useMemo(() => integrityChecks({ customers: s.customers, stops: s.stops, txns: s.txns, opening: s.opening }), [s.customers, s.stops, s.txns, s.opening]);
  const passing = checks.filter((c) => c.ok).length;
  const cust = (id: string) => s.customers.find((c) => c.id === id);
  const match = (...f: (string | undefined)[]) => !q || f.join(" ").toLowerCase().includes(q.toLowerCase());

  const exportJson = () => {
    const { customers, stops, txns, exceptions, waitlist, events, opening, overrides, dayOffset, stopsDate } = useStore.getState();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), deliveryDate: stopsDate, dayOffset, customers, orders: stops, ledger: txns, tickets: exceptions, waitlist, overrides, openingBalances: opening, activity: events }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cowland-demo-database-${stopsDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts: Record<Tab, number> = { activity: s.events.length, orders: s.stops.length, ledger: s.txns.length, households: s.customers.length, tickets: s.exceptions.length, waitlist: s.waitlist.length };
  const label: Record<Tab, string> = { activity: "Activity", orders: "Orders", ledger: "Ledger", households: "Households", tickets: "Tickets", waitlist: "Waitlist" };

  return (
    <div className="min-h-screen bg-milk">
      <header className="border-b border-milk-2 bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Cowland Daily home"><Logo /></Link>
          <nav className="flex flex-wrap gap-1.5 text-sm font-semibold" aria-label="Open an app in a new tab">
            {([["Customer", "/customer"], ["Rider", "/rider"], ["Hub", "/admin"]] as const).map(([l, to]) => (
              <a key={l} href={`#${to}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-ink-3 hover:bg-milk-2 hover:text-ink">{l} app <ExternalLink size={13} /></a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight"><Database size={26} /> Demo database</h1>
            <p className="mt-1 max-w-2xl text-ink-soft">Everything the prototype has saved in this browser. Keep this open in one tab and click around the apps in others: it updates the moment anything changes.</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neem-soft px-2.5 py-0.5 font-semibold text-neem-deep"><span className="h-2 w-2 animate-pulse rounded-full bg-neem" /> Live</span>
              Delivery morning <b className="text-ink">{dayMonth(today)}</b> · last change {s.events[0] ? clock(s.events[0].at) : "—"}
            </p>
          </div>
          <Button variant="outline" icon={<Download size={16} />} onClick={exportJson}>Export JSON</Button>
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Integrity checks</h2>
            <Badge tone={passing === checks.length ? "good" : "bad"}>{passing} of {checks.length} pass</Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">Rules that must hold after every click. They're recalculated from the raw records each time anything changes.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c) => (
              <li key={c.id} className={clsx("flex gap-2.5 rounded-xl p-3", c.ok ? "bg-neem-soft/50" : "bg-brick-soft")}>
                {c.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-neem" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-brick" />}
                <span className="min-w-0"><span className="block text-sm font-semibold">{c.label}</span><span className="block text-xs text-ink-soft">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Segmented value={tab} onChange={(t) => { setTab(t); setMore(1); setOpen(null); }} options={(Object.keys(label) as Tab[]).map((t) => ({ value: t, label: <span className="whitespace-nowrap">{label[t]} <span className="tabular text-ink-soft">{counts[t]}</span></span> }))} />
          </div>
          <label className="relative lg:ml-auto lg:w-72">
            <span className="sr-only">Search</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setMore(1); }} placeholder="Search name, flat, order ID…" className={clsx(inputCls, "pl-9")} />
          </label>
        </div>

        {tab === "activity" && (() => {
          const rows = s.events.filter((e) => (actor === "all" || (actor === "blocked" ? e.blocked : e.actor === actor)) && match(e.who, e.action, e.detail, e.orderId));
          return (
            <Card>
              <div className="flex flex-wrap gap-1.5 px-5 pt-4">
                {(["all", "customer", "rider", "hub", "simulation", "blocked"] as const).map((a) => (
                  <button key={a} onClick={() => { setActor(a); setMore(1); }} aria-pressed={actor === a} className={clsx("rounded-full border px-3 py-1 text-xs font-semibold capitalize", actor === a ? "border-ink bg-ink text-white" : "border-milk-3 text-ink-3 hover:border-ink-3")}>{a === "all" ? "Everyone" : a}</button>
                ))}
              </div>
              <Table head={["Time", "Who", "What happened", "Order", "Wallet"]} empty="No activity matches." rows={rows.slice(0, LIMIT * more).map((e) => (
                <tr key={e.id} className={clsx(e.blocked && "bg-brick-soft/30")}>
                  <Td className="whitespace-nowrap tabular text-ink-soft">{clock(e.at)}<span className="block text-[11px]">{dayMonth(e.day)}</span></Td>
                  <Td><Badge tone={actorTone[e.actor]}>{e.actor}</Badge><span className="mt-0.5 block text-xs text-ink-3">{e.who}</span></Td>
                  <Td><b className={clsx(e.blocked && "text-brick")}>{e.action}</b><span className="block text-ink-3">{e.detail}</span></Td>
                  <Td className="whitespace-nowrap tabular">{e.orderId ?? ""}</Td>
                  <Td className={clsx("whitespace-nowrap text-right tabular font-semibold", (e.amount ?? 0) > 0 ? "text-neem-deep" : "text-ink")}>{money(e.amount)}</Td>
                </tr>
              ))} />
              <More shown={Math.min(rows.length, LIMIT * more)} total={rows.length} onMore={() => setMore(more + 1)} />
            </Card>
          );
        })()}

        {tab === "orders" && (() => {
          const rows = s.stops.filter((o) => (route === "all" || o.routeId === route) && match(o.orderId, cust(o.customerId)?.contact, cust(o.customerId)?.flat, cust(o.customerId)?.society, o.status)).sort((a, b) => a.routeId.localeCompare(b.routeId) || a.seq - b.seq);
          return (
            <Card>
              <div className="flex flex-wrap items-center gap-2 px-5 pt-4 text-sm">
                <select value={route} onChange={(e) => setRoute(e.target.value)} aria-label="Route" className="h-9 rounded-lg border border-milk-3 bg-white px-2 font-semibold">
                  <option value="all">All routes</option>
                  {Object.values(routeById).map((r) => <option key={r.id} value={r.id}>Route {r.code}</option>)}
                </select>
                <span className="text-ink-soft">Orders for the {dayMonth(today)} delivery morning. Tap a row for its history.</span>
              </div>
              <Table head={["Order", "Household", "Route · stop", "Status", "Ordered", "Delivered", "Charged", ""]} empty="No orders match." rows={rows.slice(0, LIMIT * more).map((o) => {
                const c = cust(o.customerId);
                const net = netCharged(o.orderId, s.txns);
                const isOpen = open === o.orderId;
                return (
                  <Fragment key={o.id}>
                    <tr onClick={() => setOpen(isOpen ? null : o.orderId)} className={clsx("cursor-pointer hover:bg-milk/60", isOpen && "bg-marigold-soft/40")}>
                      <Td className="whitespace-nowrap tabular font-semibold">{o.orderId}</Td>
                      <Td>{c?.contact}<span className="block text-xs text-ink-soft">{c?.flat}, {c?.society}</span></Td>
                      <Td className="whitespace-nowrap tabular">{routeById[o.routeId]?.code} · #{o.seq}</Td>
                      <Td><Badge tone={statusTone[o.status]}>{o.status}</Badge>{o.confirmed && <span className="mt-0.5 block text-xs text-neem-deep">confirmed</span>}{o.releasedAt && <span className="mt-0.5 block text-xs text-neem-deep">won back</span>}</Td>
                      <Td className="text-ink-3">{items(o.items)}{o.fromVan?.length ? <span className="block text-xs text-marigold-deep">incl. {items(o.fromVan)} from van spares</span> : null}</Td>
                      <Td className="text-ink-3">{o.status === "delivered" ? items(o.delivered) : "—"}</Td>
                      <Td className="whitespace-nowrap text-right tabular font-semibold">{net ? inr(net) : "—"}<span className="block text-xs font-normal text-ink-soft">of {inr(lineTotal(o.items))}</span></Td>
                      <Td><ChevronDown size={16} className={clsx("text-ink-soft transition", isOpen && "rotate-180")} /></Td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={8} className="bg-milk/60 px-5 py-4"><OrderHistory orderId={o.orderId} /></td></tr>
                    )}
                  </Fragment>
                );
              })} />
              <More shown={Math.min(rows.length, LIMIT * more)} total={rows.length} onMore={() => setMore(more + 1)} />
            </Card>
          );
        })()}

        {tab === "ledger" && (() => {
          const rows = s.txns.filter((t) => match(t.orderId, t.note, cust(t.customerId)?.contact, t.kind));
          return (
            <Card>
              <p className="px-5 pt-4 text-sm text-ink-soft">Every rupee in or out of a wallet. Entries marked <b>demo</b> were made by clicks in this browser; the rest is sample history.</p>
              <Table head={["When", "Household", "Kind", "Order", "Note", "Amount"]} empty="No entries match." rows={rows.slice(0, LIMIT * more).map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap tabular text-ink-soft">{dayMonth(t.at.slice(0, 10))}<span className="block text-[11px]">{clock(t.at)}</span></Td>
                  <Td>{cust(t.customerId)?.contact ?? t.customerId}</Td>
                  <Td><Badge tone={t.kind === "debit" ? "neutral" : "good"}>{t.kind}</Badge>{t.live && <span className="ml-1 text-[11px] font-semibold text-marigold-deep">demo</span>}</Td>
                  <Td className="whitespace-nowrap tabular">{t.orderId ?? ""}</Td>
                  <Td className="text-ink-3">{t.note}</Td>
                  <Td className={clsx("whitespace-nowrap text-right tabular font-semibold", t.kind !== "debit" && "text-neem-deep")}>{t.kind === "debit" ? `−${inr(t.amount)}` : `+${inr(t.amount)}`}</Td>
                </tr>
              ))} />
              <More shown={Math.min(rows.length, LIMIT * more)} total={rows.length} onMore={() => setMore(more + 1)} />
            </Card>
          );
        })()}

        {tab === "households" && (() => {
          const rows = s.customers.filter((c) => match(c.id, c.contact, c.flat, c.society, c.phone));
          return (
            <Card>
              <Table head={["ID", "Household", "Phone", "Route", "Regular order", "Status", "Opening", "Wallet now"]} empty="No households match." rows={rows.slice(0, LIMIT * more).map((c) => (
                <tr key={c.id}>
                  <Td className="tabular text-ink-soft">{c.id}</Td>
                  <Td><b>{c.contact}</b>{c.isNew && <Badge tone="good" className="ml-1.5">new</Badge>}<span className="block text-xs text-ink-soft">{c.flat}, {c.society}</span></Td>
                  <Td className="whitespace-nowrap tabular">{c.phone}</Td>
                  <Td className="tabular">{routeById[c.routeId]?.code}</Td>
                  <Td className="text-ink-3">{items(c.planChanges?.at(-1)?.items ?? c.plan)}</Td>
                  <Td><Badge tone={c.status === "active" ? "good" : "neutral"}>{c.status}</Badge></Td>
                  <Td className="whitespace-nowrap text-right tabular text-ink-soft">{inr(s.opening[c.id] ?? c.wallet)}</Td>
                  <Td className={clsx("whitespace-nowrap text-right tabular font-semibold", c.wallet < 0 && "text-brick")}>{inr(c.wallet)}</Td>
                </tr>
              ))} />
              <More shown={Math.min(rows.length, LIMIT * more)} total={rows.length} onMore={() => setMore(more + 1)} />
            </Card>
          );
        })()}

        {tab === "tickets" && (() => {
          const rows = s.exceptions.filter((e) => match(e.orderId, e.message, cust(e.customerId)?.contact, e.kind)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return (
            <Card>
              <Table head={["Raised", "Household", "Kind", "From", "Order", "Items", "Status", "Refund"]} empty="No tickets match." rows={rows.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap tabular text-ink-soft">{clock(e.createdAt)}</Td>
                  <Td>{cust(e.customerId)?.contact}<span className="block text-xs text-ink-3">{e.message}</span></Td>
                  <Td>{e.kind}</Td>
                  <Td>{e.source}</Td>
                  <Td className="whitespace-nowrap tabular">{e.orderId ?? "—"}</Td>
                  <Td className="text-ink-3">{items(e.items)}</Td>
                  <Td><Badge tone={e.status === "open" ? "warn" : "good"}>{e.status}</Badge>{e.resolution && <span className="block text-xs text-ink-soft">{e.resolution}</span>}</Td>
                  <Td className="whitespace-nowrap text-right tabular">{e.refund ? inr(e.refund) : "—"}</Td>
                </tr>
              ))} />
            </Card>
          );
        })()}

        {tab === "waitlist" && (() => {
          const rows = s.waitlist.filter((w) => match(w.name, w.area, w.mobile)).slice().sort((a, b) => b.at.localeCompare(a.at));
          return (
            <Card>
              <Table head={["Joined", "Name", "Mobile", "Area", "Litres a day", "Source"]} empty="No one matches." rows={rows.slice(0, LIMIT * more).map((w) => (
                <tr key={w.id}>
                  <Td className="whitespace-nowrap tabular text-ink-soft">{dayMonth(w.at.slice(0, 10))}</Td>
                  <Td>{w.name}</Td>
                  <Td className="tabular">{w.mobile}</Td>
                  <Td>{w.area}</Td>
                  <Td className="tabular">{w.litres}</Td>
                  <Td>{w.sample ? <Badge>sample</Badge> : <Badge tone="good">website</Badge>}</Td>
                </tr>
              ))} />
              <More shown={Math.min(rows.length, LIMIT * more)} total={rows.length} onMore={() => setMore(more + 1)} />
            </Card>
          );
        })()}

        <p className="pb-6 text-xs text-ink-soft">This is a browser-only demo database (saved in this browser's local storage). Tabs in this browser share it; other browsers and devices have their own copy. Reset it from the account menu in any app.</p>
      </main>
    </div>
  );
}

/** Everything that happened to one order: ledger entries and activity lines. */
function OrderHistory({ orderId }: { orderId: string }) {
  const txns = useStore((s) => s.txns.filter((t) => t.orderId === orderId));
  const events = useStore((s) => s.events.filter((e) => e.orderId === orderId));
  const tickets = useStore((s) => s.exceptions.filter((e) => e.orderId === orderId));
  const net = netCharged(orderId, txns);
  return (
    <div className="grid gap-4 text-sm lg:grid-cols-3">
      <div>
        <p className="font-semibold">Activity</p>
        {events.length ? <ul className="mt-1 space-y-1">{events.slice().reverse().map((e) => <li key={e.id}><span className="tabular text-ink-soft">{clock(e.at)}</span> {e.who}: {e.action.toLowerCase()}{e.amount ? ` (${money(e.amount)})` : ""}</li>)}</ul> : <p className="text-ink-soft">No clicks on this order yet in this demo.</p>}
      </div>
      <div>
        <p className="font-semibold">Ledger</p>
        {txns.length ? <ul className="mt-1 space-y-1">{txns.slice().reverse().map((t) => <li key={t.id}><span className="tabular">{t.kind === "debit" ? `−${inr(t.amount)}` : `+${inr(t.amount)}`}</span> <span className="text-ink-soft">{t.note}</span></li>)}</ul> : <p className="text-ink-soft">No money has moved.</p>}
        <p className="mt-1 font-semibold">Net charged {inr(net)}</p>
      </div>
      <div>
        <p className="font-semibold">Tickets</p>
        {tickets.length ? <ul className="mt-1 space-y-1">{tickets.map((t) => <li key={t.id}>{t.kind}, {t.source}: {t.status}{t.refund ? `, refunded ${inr(t.refund)}` : ""}</li>)}</ul> : <p className="text-ink-soft">None.</p>}
      </div>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[]; empty: string }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-y border-milk-2 bg-milk text-left text-xs font-semibold text-ink-soft">{head.map((h, i) => <th key={i} className={clsx("px-3 py-2.5 first:pl-5 last:pr-5", (h === "Wallet" || h === "Charged" || h === "Amount" || h === "Refund" || h === "Opening" || h === "Wallet now") && "text-right")}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-milk-2">{rows.length ? rows : <tr><td colSpan={head.length} className="px-5 py-8 text-center text-ink-soft">{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("px-3 py-2.5 align-top first:pl-5 last:pr-5", className)}>{children}</td>;
}

function More({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (total <= shown) return <p className="px-5 py-3 text-xs text-ink-soft">{total} row{total === 1 ? "" : "s"}</p>;
  return (
    <div className="flex items-center justify-between px-5 py-3 text-xs text-ink-soft">
      <span>Showing {shown} of {total}</span>
      <button onClick={onMore} className="font-semibold text-ink underline">Show more</button>
    </div>
  );
}
