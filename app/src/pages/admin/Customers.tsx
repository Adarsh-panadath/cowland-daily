import { useMemo, useState } from "react";
import clsx from "clsx";
import { Search, Download, ArrowUpDown, BellRing } from "lucide-react";
import { useStore, lineTotal } from "../../store/useStore";
import { ME, productById, routeById, routes } from "../../data/seed";
import type { Customer } from "../../data/types";
import { dayMonth, inr, initials } from "../../lib/format";
import { Avatar, Badge, Button, Card, Drawer, Empty, inputCls } from "../../components/ui";
import { toast } from "../../store/toast";
import { CallSheet } from "../../components/CallSheet";

type SortKey = "name" | "wallet" | "daily" | "since";

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const remind = useStore((s) => s.remindLowBalances);
  const remindedAt = useStore((s) => s.remindedAt);
  const [q, setQ] = useState("");
  const [route, setRoute] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "paused" | "low">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "wallet", dir: 1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PER = 20;

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    return customers
      .filter((c) => route === "all" || c.routeId === route)
      .filter((c) => status === "all" || (status === "low" ? c.wallet < 200 && c.status === "active" : c.status === status))
      .filter((c) => !ql || `${c.name} ${c.contact} ${c.flat} ${c.society} ${c.phone}`.toLowerCase().includes(ql))
      .map((c) => ({ c, daily: lineTotal(c.plan) }))
      .sort((a, b) => {
        const k = sort.key;
        const va = k === "name" ? a.c.contact : k === "wallet" ? a.c.wallet : k === "daily" ? a.daily : a.c.since;
        const vb = k === "name" ? b.c.contact : k === "wallet" ? b.c.wallet : k === "daily" ? b.daily : b.c.since;
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
  }, [customers, q, route, status, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const pg = Math.min(page, pages - 1);

  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const low = customers.filter((c) => c.status === "active" && c.wallet < 200).length;
  const mrr = customers.filter((c) => c.status === "active").reduce((s, c) => s + lineTotal(c.plan) * 30, 0);

  const exportCsv = () => {
    const lines = [["Name", "Contact", "Flat", "Society", "Route", "Phone", "Daily order (INR)", "Wallet (INR)", "Status"], ...rows.map(({ c, daily }) => [c.name, c.contact, c.flat, c.society, routeById[c.routeId]!.code, c.phone, String(daily), String(c.wallet), c.status])];
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.map((x) => `"${x}"`).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cowland-customers.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} customers.`);
  };

  const Th = ({ k, children, right }: { k: SortKey; children: string; right?: boolean }) => (
    <th className={clsx("px-3 py-2.5 font-semibold", right && "text-right")}>
      <button onClick={() => toggleSort(k)} className={clsx("inline-flex items-center gap-1 hover:text-ink", sort.key === k && "text-ink")}>
        {children} <ArrowUpDown size={13} />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-ink-soft">{customers.filter((c) => c.status === "active").length} active households, about {inr(mrr)} in monthly orders.</p>
        </div>
        <div className="flex gap-2">
          {low > 0 && (remindedAt && Date.now() - new Date(remindedAt).getTime() < 3 * 3600e3
            ? <Button variant="outline" icon={<BellRing size={16} />} disabled>Reminded at {new Date(remindedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</Button>
            : <Button variant="outline" icon={<BellRing size={16} />} onClick={() => { const ids = customers.filter((c) => c.status === "active" && c.wallet < 200).map((c) => c.id); remind(ids); toast(`Top-up reminder sent to ${ids.length} households.`); }}>Remind {low} low balances</Button>)}
          <Button variant="soft" icon={<Download size={16} />} onClick={exportCsv}>Export</Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search customers</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search name, flat, society or phone" className={clsx(inputCls, "pl-9")} />
          </label>
          <select value={route} onChange={(e) => { setRoute(e.target.value); setPage(0); }} className={clsx(inputCls, "lg:w-56")} aria-label="Filter by route">
            <option value="all">All routes</option>
            {routes.map((r) => <option key={r.id} value={r.id}>Route {r.code}, {r.name}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(0); }} className={clsx(inputCls, "lg:w-48")} aria-label="Filter by status">
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="low">Balance under ₹200</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<Search size={20} />} title="No customers match" body="Clear the search or change the filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-y border-milk-2 bg-milk text-left text-ink-soft">
                  <th className="w-10 px-5 py-2.5" />
                  <Th k="name">Household</Th>
                  <th className="px-3 py-2.5 font-semibold">Route</th>
                  <th className="px-3 py-2.5 font-semibold">Regular order</th>
                  <Th k="daily" right>Per day</Th>
                  <Th k="wallet" right>Wallet</Th>
                  <Th k="since">Since</Th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-milk-2">
                {rows.slice(pg * PER, pg * PER + PER).map(({ c, daily }) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-milk/60">
                    <td className="px-5 py-2.5"><Avatar text={initials(c.contact)} size={30} color={routeById[c.routeId]!.color} /></td>
                    <td className="px-3 py-2.5"><p className="font-semibold">{c.contact}{c.id === ME && <span className="ml-1.5 text-xs font-normal text-marigold-deep">demo</span>}</p><p className="text-xs text-ink-soft">{c.flat}, {c.society}</p></td>
                    <td className="px-3 py-2.5 tabular">{routeById[c.routeId]!.code}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{c.plan.map((p) => `${p.qty} ${productById[p.productId]!.name}`).join(", ")}</td>
                    <td className="px-3 py-2.5 text-right tabular">{inr(daily)}</td>
                    <td className={clsx("px-3 py-2.5 text-right font-semibold tabular", c.wallet < 0 ? "text-brick" : c.wallet < 200 && "text-marigold-deep")}>{inr(c.wallet)}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{dayMonth(c.since)} {c.since.slice(0, 4)}</td>
                    <td className="px-5 py-2.5">{c.status === "active" ? <Badge tone="good">Active</Badge> : <Badge>Paused</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-milk-2 px-5 py-3 text-sm">
              <span className="text-ink-soft">{pg * PER + 1}–{Math.min(rows.length, pg * PER + PER)} of {rows.length}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </Card>
      <CustomerDrawer c={customers.find((x) => x.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </div>
  );
}

function CustomerDrawer({ c, onClose }: { c: Customer | null; onClose: () => void }) {
  const toggle = useStore((s) => s.toggleCustomer);
  const stop = useStore((s) => (c ? s.stops.find((x) => x.customerId === c.id) : undefined));
  const tickets = useStore((s) => (c ? s.exceptions.filter((e) => e.customerId === c.id) : []));
  const [calling, setCalling] = useState(false);
  if (!c) return null;
  const r = routeById[c.routeId]!;
  return (
    <Drawer open onClose={onClose} title={c.contact}
      footer={<div className="flex gap-2"><Button variant={c.status === "active" ? "danger" : "primary"} className="flex-1" onClick={() => { toggle(c.id); toast(c.status === "active" ? `${c.name} paused from tomorrow.` : `${c.name} resumed from tomorrow.`); }}>{c.status === "active" ? "Pause deliveries" : "Resume deliveries"}</Button><Button variant="soft" className="flex-1" onClick={() => setCalling(true)}>Call</Button></div>}>
      <div className="space-y-4 pb-6">
        <div className="flex items-center gap-3">
          <Avatar text={initials(c.contact)} color={r.color} size={48} />
          <div><p className="font-semibold">{c.name}</p><p className="text-sm text-ink-soft">{c.flat}, {c.society}, {c.area}</p></div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-milk p-3"><dt className="text-ink-soft">Wallet</dt><dd className={clsx("font-display text-xl font-bold tabular", c.wallet < 0 && "text-brick")}>{inr(c.wallet)}</dd></div>
          <div className="rounded-xl bg-milk p-3"><dt className="text-ink-soft">Per day</dt><dd className="font-display text-xl font-bold tabular">{inr(lineTotal(c.plan))}</dd></div>
          <div className="rounded-xl bg-milk p-3"><dt className="text-ink-soft">Route</dt><dd className="font-semibold">{r.code}, {r.window}</dd></div>
          <div className="rounded-xl bg-milk p-3"><dt className="text-ink-soft">Customer since</dt><dd className="font-semibold">{dayMonth(c.since)} {c.since.slice(0, 4)}</dd></div>
        </dl>
        <div><p className="text-sm font-semibold">Regular order</p><ul className="mt-1 text-sm">{c.plan.map((p) => <li key={p.productId}>{p.qty} × {productById[p.productId]!.name}</li>)}</ul></div>
        <div><p className="text-sm font-semibold">Doorstep note</p><p className="mt-1 text-sm text-ink-soft">{c.dropNote}</p></div>
        <div><p className="text-sm font-semibold">This morning</p><p className="mt-1 text-sm text-ink-soft">{!stop ? "No delivery today (paused)." : stop.status === "delivered" ? "Delivered." : stop.status === "issue" ? `Rider flagged: ${stop.issueNote}` : "Still on the van."}</p></div>
        <CallSheet name={calling ? c.contact : null} sub={`${c.flat}, ${c.society}`} color={r.color} onClose={() => setCalling(false)} />
        <div><p className="text-sm font-semibold">Tickets</p><p className="mt-1 text-sm text-ink-soft">{tickets.length ? `${tickets.length} total, ${tickets.filter((t) => t.status === "open").length} open` : "None"}</p></div>
      </div>
    </Drawer>
  );
}
