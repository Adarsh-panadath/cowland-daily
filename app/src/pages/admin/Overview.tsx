import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, DoorOpen, TriangleAlert, IndianRupee, Sparkles, TrendingUp, MapPinned, WalletMinimal, CloudRain } from "lucide-react";
import { useStore, useToday } from "../../store/useStore";
import { vanSalesValue, orderTotal } from "../../store/rules";
import { LiveActivity } from "../../components/LiveActivity";
import { toast } from "../../store/toast";
import { productById, products } from "../../data/seed";
import { dailyTotals } from "../../data/analytics";
const history = dailyTotals.slice(-30);
import { addDays, dayKey, dayMonth, demoNow, inr, num, weekday, clock } from "../../lib/format";
import { Badge, Card, CardHead, Progress, Segmented } from "../../components/ui";
import { BroadcastButton, NextMorningButton, SimToggle, routeStats } from "./shared";
import { WAITLIST_THRESHOLD } from "../../data/areas";

export default function AdminOverview() {
  const allStops = useStore((s) => s.stops);
  const stops = useMemo(() => allStops.filter((s) => s.status !== "held"), [allStops]);
  const heldCount = allStops.length - stops.length;
  const waitlist = useStore((s) => s.waitlist);
  useToday();
  const exceptions = useStore((s) => s.exceptions);
  const customers = useStore((s) => s.customers);
  const [metric, setMetric] = useState<"litres" | "revenue">("litres");

  const rs = routeStats(stops);
  const delivered = stops.filter((s) => s.status === "delivered");
  const litresPlanned = rs.reduce((s, r) => s + r.litresPlanned, 0);
  const litresDone = rs.reduce((s, r) => s + r.litresDone, 0);
  const value = rs.reduce((s, r) => s + r.value, 0);
  const open = exceptions.filter((e) => e.status === "open");
  const lowWallet = customers.filter((c) => c.status === "active" && c.wallet < 200).length;

  const mix = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stops) for (const i of s.items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
    return products.filter((p) => m.has(p.id)).map((p) => ({ name: p.name, qty: m.get(p.id)!, color: p.id === "a2" ? "#F2A900" : p.id === "buff" ? "#14213D" : p.id === "toned" ? "#6C8EF5" : p.id === "dahi" ? "#C0703F" : "#2F7D5B" }));
  }, [stops]);

  const forecast = useMemo(() => {
    const avg = history.slice(-7).reduce((s, h) => s + h.litres, 0) / 7;
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(demoNow(), i + 1);
      const dow = d.getDay();
      const f = dow === 0 ? 1.09 : dow === 6 ? 1.06 : 1;
      const fest = i === 3 ? 1.14 : 1;
      return { day: `${weekday(dayKey(d))} ${d.getDate()}`, litres: Math.round(avg * f * fest), fest: fest > 1 };
    });
  }, []);

  const chartData = history.map((h) => ({ ...h, label: dayMonth(h.date) }));

  const kpis = [
    { icon: <Droplets size={18} />, label: "Milk delivered", value: `${num(litresDone, 0)} L`, sub: `of ${num(litresPlanned, 0)} L planned`, pct: (litresDone / litresPlanned) * 100 },
    { icon: <DoorOpen size={18} />, label: "Doors done", value: `${delivered.length} / ${stops.length}`, sub: `${Math.round((delivered.length / Math.max(1, stops.length)) * 100)}% complete${heldCount ? `, ${heldCount} held` : ""}`, pct: (delivered.length / Math.max(1, stops.length)) * 100 },
    { icon: <TriangleAlert size={18} />, label: "Open tickets", value: String(open.length), sub: open.length ? `Oldest ${clock(open.map((o) => o.createdAt).sort()[0]!)}` : "All clear", tone: open.length ? "warn" : "good" },
    { icon: <IndianRupee size={18} />, label: "Collected from wallets", value: inr(value), sub: "This morning so far" },
  ];

  // Live from the waitlist the website collects
  const topArea = useMemo(() => {
    const m = new Map<string, { n: number; l: number }>();
    for (const w of waitlist) { const x = m.get(w.area) ?? { n: 0, l: 0 }; m.set(w.area, { n: x.n + 1, l: x.l + w.litres }); }
    return [...m.entries()].map(([area, v]) => ({ area, ...v })).sort((a, b) => b.n - a.n)[0];
  }, [waitlist]);

  const van = vanSalesValue(allStops);
  const heldStops = allStops.filter((x) => x.status === "held");
  const heldValue = heldStops.reduce((a, x) => a + orderTotal(x), 0);
  const released = allStops.filter((x) => x.releasedAt);
  const releasedValue = released.reduce((a, x) => a + orderTotal(x), 0);
  const remind = useStore((s) => s.remindLowBalances);
  const remindedAt = useStore((s) => s.remindedAt);

  const insights: { icon: JSX.Element; title: string; body: string; tone: "warn" | "info"; link?: string; linkLabel?: string; sample?: boolean }[] = [
    ...(topArea ? [{ icon: <MapPinned size={16} />, title: `${topArea.area}: ${topArea.n} households waiting`, body: `${Math.round((topArea.n / WAITLIST_THRESHOLD) * 100)}% of the ${WAITLIST_THRESHOLD}-home bar for a new route. They want ${num(topArea.l, 1)} L a day, about ${inr(topArea.l * productById.a2!.price * 2)} of milk.`, tone: topArea.n >= WAITLIST_THRESHOLD ? ("warn" as const) : ("info" as const), link: "/admin/demand", linkLabel: "See demand" }] : []),
    { icon: <WalletMinimal size={16} />, title: `${lowWallet} customers below ₹200`, body: "Send a top-up reminder tonight so their milk isn't held at 10 PM.", tone: lowWallet > 5 ? ("warn" as const) : ("info" as const), link: "/admin/customers", linkLabel: "Review customers" },
    { icon: <TrendingUp size={16} />, title: `Dahi demand up on ${weekday(dayKey(addDays(demoNow(), 4)), "long")}`, body: "Ekadashi falls in four days. Last year matka dahi orders rose 35% that morning. Set 40 extra pots on Route 02.", tone: "warn" as const, sample: true },
    { icon: <CloudRain size={16} />, title: "Rain likely at 5 AM tomorrow", body: "Routes 03 and 05 ran 9 minutes slower on the last rainy morning. Start them 10 minutes early.", tone: "info" as const, sample: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">This morning at the hub</h1>
          <p className="text-ink-soft">Five routes, {stops.length} doors, batch {`B312-SAM`} released at 4:12 AM.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BroadcastButton />
          <NextMorningButton />
          <SimToggle />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">{k.label}</span>
              <span className={clsx("grid h-8 w-8 place-items-center rounded-lg", k.tone === "warn" ? "bg-marigold-soft text-marigold-deep" : "bg-milk-2 text-ink-3")}>{k.icon}</span>
            </div>
            <p className="mt-2 font-display text-3xl font-bold tabular">{k.value}</p>
            <p className="text-sm text-ink-soft">{k.sub}</p>
            {k.pct !== undefined && <Progress className="mt-3" value={k.pct} height={6} />}
          </Card>
        ))}
      </div>

      <LiveActivity />

      <Card>
        <CardHead title="Extra sales from today's vans" sub="Money the same vans earn on the same run: spares sold at the door, and held orders won back by a top-up." right={<Badge tone="good">No discounts</Badge>} />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="rounded-2xl bg-milk p-4">
            <p className="text-sm text-ink-soft">Spares sold from vans</p>
            <p className="mt-1 font-display text-2xl font-bold tabular">{inr(van.sold)}</p>
            <p className="text-sm text-ink-soft">{van.units} item{van.units === 1 ? "" : "s"} delivered{van.onTheWay ? `, ${inr(van.onTheWay)} more on the way` : ""}</p>
          </div>
          <div className="rounded-2xl bg-milk p-4">
            <p className="text-sm text-ink-soft">Held orders won back</p>
            <p className="mt-1 font-display text-2xl font-bold tabular">{inr(releasedValue)}</p>
            <p className="text-sm text-ink-soft">{released.length} home{released.length === 1 ? "" : "s"} topped up and went back on the van</p>
          </div>
          <div className="rounded-2xl bg-milk p-4">
            <p className="text-sm text-ink-soft">Still held at the hub</p>
            <p className="mt-1 font-display text-2xl font-bold tabular text-brick">{inr(heldValue)}</p>
            <p className="text-sm text-ink-soft">{heldStops.length} home{heldStops.length === 1 ? "" : "s"} short on wallet</p>
            {heldStops.length > 0 && (
              <button onClick={() => { remind(heldStops.map((x) => x.customerId)); toast(`Top-up reminder with the exact amount sent to ${heldStops.length} home${heldStops.length === 1 ? "" : "s"}.`); }} className="mt-2 text-sm font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-2">
                {remindedAt ? "Remind again" : "Remind them to top up"}
              </button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="flex flex-col">
          <CardHead title="Last 30 days" sub={metric === "litres" ? "Litres delivered per morning" : "Revenue per morning, all products"} right={<Segmented value={metric} onChange={setMetric} options={[{ value: "litres", label: "Litres" }, { value: "revenue", label: "Revenue" }]} />} />
          <div className="min-h-72 flex-1 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%" minHeight={260}>
              <AreaChart data={chartData} margin={{ left: 0, top: 10 }}>
                <defs>
                  <linearGradient id="hist" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14213D" stopOpacity={0.25} /><stop offset="100%" stopColor="#14213D" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#ECEEF3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} />
                <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (metric === "revenue" ? `₹${(v / 1000).toFixed(1)}k` : num(v))} domain={["auto", "auto"]} />
                <Tooltip formatter={(v: number) => [metric === "revenue" ? inr(v) : `${num(v)} L`, metric === "revenue" ? "Revenue" : "Litres"]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px -12px rgba(20,33,61,.35)" }} />
                <Area type="monotone" dataKey={metric} stroke="#14213D" strokeWidth={2.5} fill="url(#hist)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-ink text-white">
          <div className="flex items-center gap-2 px-5 pt-5">
            <Sparkles size={18} className="text-marigold" />
            <h2 className="font-display text-lg font-semibold">Worth a look today</h2>
          </div>
          <p className="px-5 text-sm text-white/60">The first two are worked out live from your waitlist and wallets. Items marked Sample show the kind of alert a real data feed would give.</p>
          <ul className="space-y-2 p-4">
            {insights.map((i) => (
              <li key={i.title} className="rounded-2xl bg-white/[.06] p-3.5">
                <p className="flex items-center gap-2 font-semibold"><span className={i.tone === "warn" ? "text-marigold" : "text-[#9DB4FF]"}>{i.icon}</span><span className="flex-1">{i.title}</span>{i.sample && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">Sample</span>}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/70">{i.body}</p>
                {i.link && <Link to={i.link} className="mt-2 inline-block text-sm font-semibold text-marigold hover:underline">{i.linkLabel}</Link>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHead title="Routes right now" right={<Link to="/admin/routes" className="text-sm font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-4">Open live view</Link>} />
          <ul className="space-y-4 p-5">
            {rs.map((r) => (
              <li key={r.route.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.route.color }} /><span className="truncate font-semibold">{r.route.code} {r.route.name}</span></span>
                  {r.done ? <Badge tone="good">Done</Badge> : <span className="shrink-0 tabular text-ink-soft">{r.delivered}/{r.total}</span>}
                </div>
                <Progress value={r.pct} color={r.route.color} height={7} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHead title="What's in the crates" sub="Units packed for this morning" />
          <div className="h-64 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mix} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [v, "Units"]} cursor={{ fill: "#F6F7F9" }} contentStyle={{ borderRadius: 12, border: "none" }} />
                <Bar dataKey="qty" radius={[0, 8, 8, 0]} barSize={18}>
                  {mix.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead title="Next 7 mornings" sub="Forecast litres, from recent orders and the calendar" />
          <div className="h-64 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast} margin={{ left: -10 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip formatter={(v: number) => [`${num(v)} L`, "Forecast"]} cursor={{ fill: "#F6F7F9" }} contentStyle={{ borderRadius: 12, border: "none" }} />
                <Bar dataKey="litres" radius={[8, 8, 0, 0]}>
                  {forecast.map((f) => <Cell key={f.day} fill={f.fest ? "#F2A900" : "#2B3A67"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="px-5 pb-5 text-xs text-ink-soft">Gold bar: Ekadashi, expect higher dahi and milk orders.</p>
        </Card>
      </div>

      <Card>
        <CardHead title="Latest tickets" right={<Link to="/admin/tickets" className="text-sm font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-4">All tickets</Link>} />
        <ul className="divide-y divide-milk-2 p-2">
          {open.slice(0, 4).map((e) => {
            const c = customers.find((x) => x.id === e.customerId)!;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <Badge tone={e.kind === "late" ? "warn" : "bad"}>{e.kind === "late" ? "Late" : e.kind === "seal" ? "Seal" : e.kind === "access" ? "Access" : e.kind === "leak" ? "Leak" : "Missing"}</Badge>
                <span className="min-w-0 flex-1 text-sm"><b>{c.flat}, {c.society}</b> <span className="text-ink-soft">{e.message}</span></span>
                <span className="text-xs text-ink-soft">{clock(e.createdAt)}</span>
              </li>
            );
          })}
          {open.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-soft">No open tickets.</li>}
        </ul>
      </Card>
    </div>
  );
}
