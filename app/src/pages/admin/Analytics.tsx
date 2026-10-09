import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, AreaChart, LabelList,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Download, Info, Phone, Gift, Table2, LineChart as LineIcon } from "lucide-react";
import { routes, routeById } from "../../data/seed";
import {
  dayRows, allDates, productGroups, routeEconomics, ECON, cohorts, scoreCustomers, segmentColors, funnel, movingAvg, sum,
  type DayRow, type GroupId, type Segment,
} from "../../data/analytics";
import { useStore, lineTotal } from "../../store/useStore";
import { dayMonth, inr, num } from "../../lib/format";
import { Badge, Button, Card, CardHead, Segmented } from "../../components/ui";
import { toast } from "../../store/toast";

type Tab = "performance" | "routes" | "customers" | "products" | "scenarios";
type Period = "7" | "30" | "90";

const tip = { contentStyle: { borderRadius: 12, border: "none", boxShadow: "0 8px 24px -12px rgba(20,33,61,.35)", fontSize: 13 }, cursor: { fill: "#F6F7F9" } };
const GRID = "#ECEEF3";
const INK = "#14213D";
const SERIES1 = "#2a78d6";
const short = (v: number) => (Math.abs(v) >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${Math.round(v)}`);

/* ---------- helpers ---------- */
function slice(period: number, route: string, offset = 0) {
  const dates = allDates.slice(allDates.length - period * (offset + 1), allDates.length - period * offset);
  const set = new Set(dates);
  return { dates, rows: dayRows.filter((r) => set.has(r.date) && (route === "all" || r.route === route)) };
}
function byDate(rows: DayRow[], dates: string[]) {
  const m = new Map<string, DayRow[]>();
  for (const r of rows) m.set(r.date, [...(m.get(r.date) ?? []), r]);
  return dates.map((d) => {
    const rs = m.get(d) ?? [];
    const drops = sum(rs.map((x) => x.drops));
    return {
      date: d,
      revenue: sum(rs.map((x) => x.revenue)),
      litres: sum(rs.map((x) => x.litres)),
      drops,
      onTime: drops ? sum(rs.map((x) => x.onTimePct * x.drops)) / drops : 0,
      complaints: sum(rs.map((x) => x.complaints)),
      skips: sum(rs.map((x) => x.skips)),
      out: sum(rs.map((x) => x.bottlesOut)),
      back: sum(rs.map((x) => x.bottlesBack)),
      units: Object.fromEntries(productGroups.map((g) => [g.id, sum(rs.map((x) => x.units[g.id] * g.price))])) as Record<GroupId, number>,
    };
  });
}
function kpis(days: ReturnType<typeof byDate>) {
  const n = days.length || 1;
  const revenue = sum(days.map((d) => d.revenue));
  const drops = sum(days.map((d) => d.drops));
  return {
    revenue,
    litres: sum(days.map((d) => d.litres)) / n,
    households: drops / n,
    arpu: drops ? revenue / drops : 0,
    onTime: drops ? sum(days.map((d) => d.onTime * d.drops)) / drops : 0,
    complaints: drops ? (sum(days.map((d) => d.complaints)) / drops) * 1000 : 0,
    skip: sum(days.map((d) => d.skips)) / (drops + sum(days.map((d) => d.skips)) || 1) * 100,
    returns: (sum(days.map((d) => d.back)) / (sum(days.map((d) => d.out)) || 1)) * 100,
  };
}
const pctDelta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

function csv(name: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Legendish({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? <span className="w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

function ViewToggle({ table, setTable }: { table: boolean; setTable: (b: boolean) => void }) {
  return (
    <div className="flex rounded-lg bg-milk-2 p-0.5" role="group" aria-label="Chart or table">
      <button aria-pressed={!table} onClick={() => setTable(false)} className={clsx("grid h-7 w-8 place-items-center rounded-md", !table ? "bg-white text-ink shadow-sm" : "text-ink-soft")} aria-label="Chart view"><LineIcon size={15} /></button>
      <button aria-pressed={table} onClick={() => setTable(true)} className={clsx("grid h-7 w-8 place-items-center rounded-md", table ? "bg-white text-ink shadow-sm" : "text-ink-soft")} aria-label="Table view"><Table2 size={15} /></button>
    </div>
  );
}

/* =================================================================== */

export default function Analytics() {
  const [tab, setTab] = useState<Tab>("performance");
  const [period, setPeriod] = useState<Period>("30");
  const [route, setRoute] = useState("all");
  const p = Number(period);

  const cur = useMemo(() => slice(p, route), [p, route]);
  const prev = useMemo(() => slice(p, route, 1), [p, route]);
  const curDays = useMemo(() => byDate(cur.rows, cur.dates), [cur]);
  const prevDays = useMemo(() => byDate(prev.rows, prev.dates), [prev]);

  const exportView = () => {
    csv(`cowland-${route === "all" ? "network" : `route-${routeById[route]!.code}`}-${p}d.csv`, [
      ["Date", "Revenue (INR)", "Litres", "Households served", "On-time %", "Complaints", "Skips", "Bottles out", "Bottles back", ...productGroups.map((g) => `${g.label} revenue`)],
      ...curDays.map((d) => [d.date, Math.round(d.revenue), d.litres.toFixed(1), d.drops, d.onTime.toFixed(1), d.complaints, d.skips.toFixed(1), d.out, d.back, ...productGroups.map((g) => Math.round(d.units[g.id]))]),
    ]);
    toast(`Exported ${curDays.length} days of data.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-ink-soft">Six months of operating history. Every number compares against the period just before it.</p>
        </div>
        <Button variant="outline" icon={<Download size={16} />} onClick={exportView}>Export this view</Button>
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-20 -mx-4 flex flex-col gap-3 border-b border-milk-2 bg-milk/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-3 lg:flex-row lg:items-center">
        <div className="scrollbar-none overflow-x-auto">
          <Segmented value={tab} onChange={setTab} options={[
            { value: "performance", label: "Performance" },
            { value: "routes", label: "Route economics" },
            { value: "customers", label: "Customers" },
            { value: "products", label: "Products" },
            { value: "scenarios", label: "Scenarios" },
          ]} />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {tab !== "scenarios" && tab !== "customers" && (
            <>
              <Segmented value={period} onChange={setPeriod} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
              {tab !== "routes" && (
                <select value={route} onChange={(e) => setRoute(e.target.value)} aria-label="Route" className="h-10 rounded-xl border border-milk-3 bg-white px-3 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-marigold/40">
                  <option value="all">All routes</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>Route {r.code}, {r.name}</option>)}
                </select>
              )}
            </>
          )}
        </div>
      </div>

      {tab === "performance" && <Performance cur={curDays} prev={prevDays} period={p} route={route} />}
      {tab === "routes" && <RoutesTab period={p} />}
      {tab === "customers" && <CustomersTab />}
      {tab === "products" && <ProductsTab cur={curDays} prev={prevDays} rows={cur.rows} />}
      {tab === "scenarios" && <Scenarios />}
    </div>
  );
}

/* ---------------- Performance ---------------- */
function Kpi({ label, value, delta, goodWhenUp = true, spark, hint }: { label: string; value: string; delta: number; goodWhenUp?: boolean; spark: number[]; hint?: string }) {
  const good = goodWhenUp ? delta >= 0 : delta <= 0;
  const flat = Math.abs(delta) < 0.5;
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1 text-sm text-ink-soft" title={hint}>{label}{hint && <Info size={12} className="opacity-60" />}</p>
      <p className="mt-1 font-display text-[26px] font-bold leading-tight tabular">{value}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className={clsx("inline-flex items-center gap-0.5 text-xs font-semibold", flat ? "text-ink-soft" : good ? "text-neem-deep" : "text-brick")}>
          {flat ? "No change" : <>{delta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(delta).toFixed(1)}%</>}
          <span className="font-normal text-ink-soft">&nbsp;vs previous</span>
        </span>
        <div className="h-8 w-20" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark.map((v, i) => ({ i, v }))}><Line type="monotone" dataKey="v" stroke={SERIES1} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function Performance({ cur, prev, period, route }: { cur: ReturnType<typeof byDate>; prev: ReturnType<typeof byDate>; period: number; route: string }) {
  const [metric, setMetric] = useState<"revenue" | "litres" | "drops">("revenue");
  const [table, setTable] = useState(false);
  const k = kpis(cur), kp = kpis(prev);
  const sp = (f: (d: (typeof cur)[number]) => number) => cur.map(f);

  const ma = movingAvg(cur.map((d) => d[metric]), period <= 7 ? 3 : 7);
  const trend = cur.map((d, i) => ({ label: dayMonth(d.date), value: Math.round(d[metric] * 10) / 10, avg: ma[i] != null ? Math.round(ma[i]! * 10) / 10 : null, prev: prev[i] ? Math.round(prev[i]![metric] * 10) / 10 : null }));
  const fmt = (v: number) => (metric === "revenue" ? inr(v) : metric === "litres" ? `${num(v, 1)} L` : num(v));

  // 14-day forecast: weekday seasonality x linear trend over the last 56 days, 80% band from residuals
  const forecast = useMemo(() => {
    const hist = byDate(slice(56, route).rows, allDates.slice(-56));
    const ys = hist.map((d) => d.litres);
    const n = ys.length;
    const xm = (n - 1) / 2, ym = sum(ys) / n;
    const slope = sum(ys.map((y, i) => (i - xm) * (y - ym))) / sum(ys.map((_, i) => (i - xm) ** 2));
    const base = (i: number) => ym + slope * (i - xm);
    const dowF: number[] = Array(7).fill(0), dowN: number[] = Array(7).fill(0);
    hist.forEach((d, i) => { const w = new Date(d.date).getDay(); dowF[w] += ys[i]! / base(i); dowN[w]++; });
    const season = dowF.map((f, w) => (dowN[w] ? f / dowN[w]! : 1));
    const resid = hist.map((d, i) => ys[i]! - base(i) * season[new Date(d.date).getDay()]!);
    const sd = Math.sqrt(sum(resid.map((r) => r * r)) / n);
    const out: { label: string; actual: number | null; fc: number | null; band: [number, number] | null }[] = hist.slice(-28).map((d) => ({ label: dayMonth(d.date), actual: Math.round(d.litres * 10) / 10, fc: null, band: null }));
    const last = new Date(hist.at(-1)!.date);
    for (let j = 1; j <= 14; j++) {
      const dt = new Date(last); dt.setDate(dt.getDate() + j);
      const v = base(n - 1 + j) * season[dt.getDay()]!;
      const w = 1.28 * sd * Math.sqrt(1 + j / 14);
      out.push({ label: dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), actual: null, fc: Math.round(v * 10) / 10, band: [Math.round((v - w) * 10) / 10, Math.round((v + w) * 10) / 10] });
    }
    out[27]!.fc = out[27]!.actual; // join the lines
    const next7 = sum(out.slice(28, 35).map((o) => o.fc ?? 0));
    return { out, next7, growth: (slope / ym) * 30 * 100 };
  }, [route]);

  const dow = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ v: 0, n: 0 }));
    cur.forEach((d) => { const w = new Date(d.date).getDay(); acc[w]!.v += d.litres; acc[w]!.n++; });
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((w) => ({ day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w]!, litres: acc[w]!.n ? Math.round((acc[w]!.v / acc[w]!.n) * 10) / 10 : 0 }));
  }, [cur]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={inr(k.revenue)} delta={pctDelta(k.revenue, kp.revenue)} spark={sp((d) => d.revenue)} />
        <Kpi label="Milk per day" value={`${num(k.litres, 1)} L`} delta={pctDelta(k.litres, kp.litres)} spark={sp((d) => d.litres)} />
        <Kpi label="Homes served per day" value={num(k.households, 0)} delta={pctDelta(k.households, kp.households)} spark={sp((d) => d.drops)} />
        <Kpi label="Revenue per drop" value={inr(k.arpu, { decimals: true })} delta={pctDelta(k.arpu, kp.arpu)} spark={sp((d) => (d.drops ? d.revenue / d.drops : 0))} hint="Average basket value per doorstep delivery" />
        <Kpi label="On-time drops" value={`${k.onTime.toFixed(1)}%`} delta={pctDelta(k.onTime, kp.onTime)} spark={sp((d) => d.onTime)} hint="Delivered before 6:15 AM" />
        <Kpi label="Complaints per 1,000 drops" value={k.complaints.toFixed(1)} delta={pctDelta(k.complaints, kp.complaints)} goodWhenUp={false} spark={sp((d) => d.complaints)} />
        <Kpi label="Skip rate" value={`${k.skip.toFixed(1)}%`} delta={pctDelta(k.skip, kp.skip)} goodWhenUp={false} spark={sp((d) => d.skips)} hint="Share of scheduled days customers skipped" />
        <Kpi label="Bottles returned" value={`${k.returns.toFixed(1)}%`} delta={pctDelta(k.returns, kp.returns)} spark={sp((d) => (d.out ? (d.back / d.out) * 100 : 0))} />
      </div>

      <Card>
        <CardHead title="Trend" sub={`Daily ${metric === "revenue" ? "revenue" : metric === "litres" ? "litres delivered" : "homes served"}, with a ${period <= 7 ? 3 : 7}-day average and the previous ${period} days for comparison`}
          right={<div className="flex items-center gap-2"><Segmented value={metric} onChange={setMetric} options={[{ value: "revenue", label: "Revenue" }, { value: "litres", label: "Litres" }, { value: "drops", label: "Homes" }]} /><ViewToggle table={table} setTable={setTable} /></div>} />
        {table ? (
          <div className="mt-4 max-h-80 overflow-auto">
            <table className="w-full text-sm"><thead className="sticky top-0 bg-milk"><tr className="text-left text-ink-soft"><th className="px-5 py-2">Day</th><th className="px-3 py-2 text-right">This period</th><th className="px-3 py-2 text-right">Moving average</th><th className="px-5 py-2 text-right">Previous period</th></tr></thead>
              <tbody className="divide-y divide-milk-2">{trend.map((t) => <tr key={t.label}><td className="px-5 py-2">{t.label}</td><td className="px-3 py-2 text-right tabular">{fmt(t.value)}</td><td className="px-3 py-2 text-right tabular">{t.avg != null ? fmt(t.avg) : "—"}</td><td className="px-5 py-2 text-right tabular text-ink-soft">{t.prev != null ? fmt(t.prev) : "—"}</td></tr>)}</tbody></table>
          </div>
        ) : (
          <>
            <div className="mt-3 px-5"><Legendish items={[{ label: "Daily", color: "#9ec5f4" }, { label: "Moving average", color: SERIES1 }, { label: "Previous period", color: "#6B7591", dashed: true }]} /></div>
            <div className="h-72 p-3 pr-5">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 8, left: 4 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(trend.length / 8))} />
                  <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => (metric === "revenue" ? short(v) : num(v))} />
                  <Tooltip {...tip} formatter={(v: number, n: string) => [fmt(v), n === "value" ? "Daily" : n === "avg" ? "Moving average" : "Previous period"]} />
                  <Bar dataKey="value" fill="#9ec5f4" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Line type="monotone" dataKey="prev" stroke="#6B7591" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  <Line type="monotone" dataKey="avg" stroke={SERIES1} strokeWidth={2.5} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Demand forecast, next 14 days" sub="Litres per morning. Weekday pattern and 8-week trend, with an 80% range." />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-5">
            <Legendish items={[{ label: "Actual", color: INK }, { label: "Forecast", color: SERIES1, dashed: true }, { label: "Likely range", color: "#cde2fb" }]} />
            <span className="text-sm text-ink-soft">Next 7 days: <b className="text-ink tabular">{num(forecast.next7)} L</b>, trend <b className={clsx("tabular", forecast.growth >= 0 ? "text-neem-deep" : "text-brick")}>{forecast.growth >= 0 ? "+" : ""}{forecast.growth.toFixed(1)}%</b> a month</span>
          </div>
          <div className="h-72 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast.out} margin={{ top: 8, left: 4 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={6} />
                <YAxis tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
                <Tooltip {...tip} formatter={(v: number | [number, number], n: string) => [Array.isArray(v) ? `${v[0]}–${v[1]} L` : `${v} L`, n === "band" ? "Likely range" : n === "fc" ? "Forecast" : "Actual"]} />
                <Area dataKey="band" stroke="none" fill="#cde2fb" fillOpacity={0.9} isAnimationActive={false} />
                <Line dataKey="actual" stroke={INK} strokeWidth={2} dot={false} />
                <Line dataKey="fc" stroke={SERIES1} strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
                <ReferenceLine x={forecast.out[27]!.label} stroke="#C4C9D6" label={{ value: "Today", position: "insideTopRight", fill: "#6B7591", fontSize: 12 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHead title="Weekly rhythm" sub="Average litres by day of the week" />
          <div className="h-72 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dow} margin={{ top: 22, left: -8 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip {...tip} formatter={(v: number) => [`${v} L`, "Average"]} />
                <Bar dataKey="litres" fill={SERIES1} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  <LabelList dataKey="litres" position="top" fill="#43474d" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Route economics ---------------- */
function RoutesTab({ period }: { period: number }) {
  const { rows } = slice(period, "all");
  const econ = routeEconomics(rows);
  const [focus, setFocus] = useState("all");
  const tot = econ.reduce((a, e) => ({ revenue: a.revenue + e.revenue, cogs: a.cogs + e.cogs, rider: a.rider + e.rider, vehicle: a.vehicle + e.vehicle, bottleLoss: a.bottleLoss + e.bottleLoss, margin: a.margin + e.margin }), { revenue: 0, cogs: 0, rider: 0, vehicle: 0, bottleLoss: 0, margin: 0 });
  const overhead = ECON.hubOverheadPerDay * period;
  const f = focus === "all" ? tot : econ.find((e) => e.route.id === focus)!;

  const steps: { name: string; delta: number; total?: boolean }[] = [
    { name: "Revenue", delta: f.revenue, total: true },
    { name: "Milk & processing", delta: -f.cogs },
    { name: "Rider pay", delta: -f.rider },
    { name: "EV running", delta: -f.vehicle },
    { name: "Lost bottles", delta: -f.bottleLoss },
    { name: "Contribution", delta: f.margin, total: true },
    ...(focus === "all" ? [{ name: "Hub overhead", delta: -overhead }, { name: "Operating profit", delta: f.margin - overhead, total: true }] : []),
  ];
  let run = 0;
  const water = steps.map((s) => {
    if (s.total) { run = s.delta; return { name: s.name, span: [Math.min(0, s.delta), Math.max(0, s.delta)] as [number, number], value: s.delta, kind: s.delta >= 0 ? "total" : "neg" }; }
    const start = run; run += s.delta;
    return { name: s.name, span: [Math.min(start, run), Math.max(start, run)] as [number, number], value: s.delta, kind: s.delta >= 0 ? "pos" : "neg" };
  });

  const best = [...econ].sort((a, b) => b.marginPct - a.marginPct);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-ink-soft">Revenue, {period} days</p><p className="mt-1 font-display text-[26px] font-bold tabular">{inr(tot.revenue)}</p></Card>
        <Card className="p-4"><p className="text-sm text-ink-soft">Contribution margin</p><p className="mt-1 font-display text-[26px] font-bold tabular">{inr(tot.margin)}</p><p className="text-xs text-ink-soft">{((tot.margin / tot.revenue) * 100).toFixed(1)}% of revenue</p></Card>
        <Card className="p-4"><p className="text-sm text-ink-soft">After hub overhead</p><p className={clsx("mt-1 font-display text-[26px] font-bold tabular", tot.margin - overhead < 0 && "text-brick")}>{inr(tot.margin - overhead)}</p><p className="text-xs text-ink-soft">Overhead {inr(ECON.hubOverheadPerDay)} a day</p></Card>
        <Card className="p-4"><p className="text-sm text-ink-soft">Best route</p><p className="mt-1 font-display text-[26px] font-bold">Route {best[0]!.route.code}</p><p className="text-xs text-ink-soft">{best[0]!.marginPct.toFixed(1)}% margin, {inr(best[0]!.perDrop, { decimals: true })} per drop</p></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Where the money goes" sub={`Revenue to profit, last ${period} days`} right={
            <select value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Route for waterfall" className="h-9 rounded-xl border border-milk-3 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-marigold/40">
              <option value="all">Whole network</option>
              {routes.map((r) => <option key={r.id} value={r.id}>Route {r.code}</option>)}
            </select>} />
          <div className="h-80 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={water} margin={{ top: 24, left: 4 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} fontSize={11} angle={0} height={36} tick={{ width: 70 } as never} />
                <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={short} />
                <ReferenceLine y={0} stroke="#C4C9D6" />
                <Tooltip {...tip} formatter={(_v: number, _n: string, item: { payload?: { value: number } }) => [inr(item.payload?.value ?? 0), "Amount"]} />
                <Bar dataKey="span" radius={[4, 4, 4, 4]} maxBarSize={56} isAnimationActive={false}>
                  {water.map((w) => <Cell key={w.name} fill={w.kind === "total" ? INK : w.kind === "neg" ? "#eb6834" : "#1baf7a"} />)}
                  <LabelList dataKey="value" position="top" formatter={(v: number) => (v < 0 ? "−" : "") + short(Math.abs(v))} fill="#43474d" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-5"><Legendish items={[{ label: "Totals", color: INK }, { label: "Costs", color: "#eb6834" }]} /></div>
        </Card>

        <Card>
          <CardHead title="Speed versus earning power" sub="Each dot is a route. Up and right is better." />
          <div className="h-80 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 72, left: 4, bottom: 8 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis type="number" dataKey="dropsPerHour" name="Drops per hour" tickLine={false} axisLine={false} domain={["auto", "auto"]} label={{ value: "Drops per hour", position: "insideBottom", offset: -4, fill: "#6B7591", fontSize: 12 }} />
                <YAxis type="number" dataKey="perDrop" name="Margin per drop" tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `₹${v.toFixed(0)}`} domain={["auto", "auto"]} />
                <ZAxis range={[160, 160]} />
                <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} formatter={(v: number, n: string) => [n === "Drops per hour" ? v.toFixed(1) : inr(v, { decimals: true }), n]} />
                <Scatter data={econ.map((e) => ({ dropsPerHour: e.dropsPerHour, perDrop: e.perDrop, name: `Route ${e.route.code}`, color: e.route.color }))} isAnimationActive={false}
                  shape={(props: unknown) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { name: string; color: string } };
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={9} fill={payload.color} stroke="#fff" strokeWidth={2} />
                        <text x={cx + 14} y={cy + 4} fontSize={12} fill="#43474d" fontWeight={600}>{payload.name}</text>
                      </g>
                    );
                  }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Route profit and loss" sub={`Last ${period} days. Costs use ${Math.round(ECON.cogsPct * 100)}% milk cost, ₹${ECON.riderPerDrop} per drop rider pay, ₹${ECON.evPerKm}/km EV running and ₹${ECON.bottleCost} per lost bottle.`}
          right={<Button size="sm" variant="soft" icon={<Download size={14} />} onClick={() => csv(`cowland-route-pnl-${period}d.csv`, [["Route", "Revenue", "Milk & processing", "Rider pay", "EV running", "Lost bottles", "Contribution", "Margin %", "Per drop", "Drops/hour", "Revenue/km", "On-time %", "Complaints/1k", "Bottle return %"], ...econ.map((e) => [e.route.code, Math.round(e.revenue), Math.round(e.cogs), Math.round(e.rider), Math.round(e.vehicle), Math.round(e.bottleLoss), Math.round(e.margin), e.marginPct.toFixed(1), e.perDrop.toFixed(2), e.dropsPerHour.toFixed(1), e.revPerKm.toFixed(0), e.onTime.toFixed(1), e.complaintsPer1k.toFixed(1), (e.returnRate * 100).toFixed(1)])])}>CSV</Button>} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-right text-ink-soft">
              <th className="px-5 py-2.5 text-left">Route</th><th className="px-3 py-2.5">Revenue</th><th className="px-3 py-2.5">Costs</th><th className="px-3 py-2.5">Contribution</th><th className="px-3 py-2.5">Margin</th><th className="px-3 py-2.5">Per drop</th><th className="px-3 py-2.5">Drops/hr</th><th className="px-3 py-2.5">₹/km</th><th className="px-3 py-2.5">On time</th><th className="px-3 py-2.5">Complaints/1k</th><th className="px-5 py-2.5">Bottles back</th>
            </tr></thead>
            <tbody className="divide-y divide-milk-2">
              {econ.map((e) => (
                <tr key={e.route.id} className="text-right hover:bg-milk/60">
                  <td className="px-5 py-3 text-left"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: e.route.color }} /><b>{e.route.code}</b><span className="text-ink-soft">{e.route.name}</span></span></td>
                  <td className="px-3 py-3 tabular">{inr(e.revenue)}</td>
                  <td className="px-3 py-3 tabular text-ink-soft">{inr(e.cogs + e.rider + e.vehicle + e.bottleLoss)}</td>
                  <td className="px-3 py-3 font-semibold tabular">{inr(e.margin)}</td>
                  <td className="px-3 py-3"><span className="inline-flex items-center gap-2"><span className="h-1.5 w-14 overflow-hidden rounded-full bg-milk-2"><span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(0, Math.min(100, e.marginPct * 2.5))}%` }} /></span><span className="w-12 tabular">{e.marginPct.toFixed(1)}%</span></span></td>
                  <td className="px-3 py-3 tabular">{inr(e.perDrop, { decimals: true })}</td>
                  <td className="px-3 py-3 tabular">{e.dropsPerHour.toFixed(1)}</td>
                  <td className="px-3 py-3 tabular">{inr(e.revPerKm)}</td>
                  <td className="px-3 py-3 tabular">{e.onTime.toFixed(1)}%</td>
                  <td className="px-3 py-3 tabular">{e.complaintsPer1k.toFixed(1)}</td>
                  <td className="px-5 py-3 tabular">{(e.returnRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-4 text-sm text-ink-soft">
          {(() => {
            const lossy = [...econ].sort((a, b) => a.returnRate - b.returnRate)[0]!.route.code;
            const late = [...econ].sort((a, b) => a.onTime - b.onTime)[0]!.route.code;
            return lossy === late
              ? `Route ${lossy} loses the most bottles and is also late most often. Fixing its gate delays and empty collection is the quickest margin win.`
              : `Route ${lossy} loses the most bottles and Route ${late} is late most often. Both cost more margin than a small price change would recover.`;
          })()}
        </p>
      </Card>
    </div>
  );
}

/* ---------------- Customers ---------------- */
const blue = ["#e8f1fd", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const blueFor = (v: number) => blue[Math.min(blue.length - 1, Math.max(0, Math.floor(((v - 40) / 60) * blue.length)))]!;

function CustomersTab() {
  const customers = useStore((s) => s.customers);
  const scored = useMemo(() => scoreCustomers(customers, (c) => lineTotal(c.plan)), [customers]);
  const segs = (Object.keys(segmentColors) as Segment[]).map((sg) => {
    const list = scored.filter((x) => x.segment === sg);
    return { segment: sg, count: list.length, value: sum(list.map((x) => x.daily)) * 30, avgDaily: list.length ? sum(list.map((x) => x.daily)) / list.length : 0, avgTenure: list.length ? sum(list.map((x) => x.tenureDays)) / list.length : 0 };
  });
  const risky = [...scored].filter((x) => x.risk >= 30).sort((a, b) => b.risk - a.risk).slice(0, 10);
  const atRiskValue = sum(scored.filter((x) => x.segment === "At risk").map((x) => x.daily)) * 30;

  const ltvBins = useMemo(() => {
    const edges = [0, 10000, 20000, 40000, 60000, 80000, 100000, Infinity];
    const labels = ["<10k", "10–20k", "20–40k", "40–60k", "60–80k", "80k–1L", "1L+"];
    return labels.map((l, i) => ({ band: l, homes: scored.filter((x) => x.ltv >= edges[i]! && x.ltv < edges[i + 1]!).length }));
  }, [scored]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-ink-soft">Active households</p><p className="mt-1 font-display text-[26px] font-bold tabular">{customers.filter((c) => c.status === "active").length}</p><p className="text-xs text-ink-soft">{customers.filter((c) => c.status === "paused").length} paused</p></Card>
        <Card className="p-4"><p className="text-sm text-ink-soft">Average lifetime value</p><p className="mt-1 font-display text-[26px] font-bold tabular">{inr(sum(scored.map((x) => x.ltv)) / scored.length)}</p><p className="text-xs text-ink-soft">Spend so far, after skips</p></Card>
        <Card className="p-4"><p className="text-sm text-ink-soft">Monthly revenue at risk</p><p className="mt-1 font-display text-[26px] font-bold tabular text-brick">{inr(atRiskValue)}</p><p className="text-xs text-ink-soft">{segs.find((s) => s.segment === "At risk")!.count} households flagged</p></Card>
        <Card className="p-4"><p className="text-sm text-ink-soft">Month-3 retention</p><p className="mt-1 font-display text-[26px] font-bold tabular">{Math.round(sum(cohorts.filter((c) => c.retention[3] != null).map((c) => c.retention[3]!)) / cohorts.filter((c) => c.retention[3] != null).length)}%</p><p className="text-xs text-ink-soft">Average across cohorts</p></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Customer segments" sub="Grouped by order value, time with us and warning signs" />
          <div className="space-y-3 p-5">
            {segs.map((s) => (
              <div key={s.segment}>
                <div className="mb-1 flex items-baseline justify-between text-sm"><span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: segmentColors[s.segment] }} />{s.segment}</span><span className="tabular text-ink-soft"><b className="text-ink">{s.count}</b> homes, {inr(s.value)}/month</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-milk-2"><div className="h-full rounded-full" style={{ width: `${(s.count / scored.length) * 100}%`, background: segmentColors[s.segment] }} /></div>
                <p className="mt-1 text-xs text-ink-soft">Avg {inr(s.avgDaily)} a day, {Math.round(s.avgTenure)} days with us</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="How new customers find us" sub="Last 30 days, from first visit to a month of deliveries" />
          <div className="space-y-2.5 p-5">
            {funnel.map((f, i) => {
              const conv = i ? (f.value / funnel[i - 1]!.value) * 100 : 100;
              const shade = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"][i]!;
              return (
                <div key={f.stage}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{f.stage}</span><span className="tabular"><b>{num(f.value)}</b>{i > 0 && <span className="ml-2 text-ink-soft">{conv.toFixed(0)}% of previous</span>}</span></div>
                  <div className="h-7 overflow-hidden rounded-lg bg-milk-2"><div className="h-full rounded-lg" style={{ width: `${(f.value / funnel[0]!.value) * 100}%`, background: shade, minWidth: 6 }} /></div>
                </div>
              );
            })}
            <p className="pt-2 text-sm text-ink-soft">The biggest drop is between checking an area and verifying a mobile number. Most of those visitors live outside today's five routes.</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Cohort retention" sub="Share of each month's new customers still subscribed, by months since joining" />
        <div className="mt-4 overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[820px] border-separate border-spacing-[3px] text-center text-xs">
            <thead><tr className="text-ink-soft"><th className="px-2 py-1 text-left font-semibold">Joined</th><th className="px-2 py-1 font-semibold">Homes</th>{Array.from({ length: 12 }, (_, k) => <th key={k} className="px-1 py-1 font-semibold">M{k}</th>)}</tr></thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.label}>
                  <td className="whitespace-nowrap px-2 text-left font-semibold">{c.label}</td>
                  <td className="px-2 tabular text-ink-soft">{c.size}</td>
                  {c.retention.map((v, k) => (
                    <td key={k} title={v != null ? `${c.label}, month ${k}: ${v}% still subscribed (${Math.round((c.size * v) / 100)} homes)` : undefined}
                      className={clsx("h-8 rounded-md tabular", v == null ? "bg-transparent" : v >= 70 ? "text-white" : "text-ink")}
                      style={{ background: v == null ? undefined : blueFor(v) }}>{v != null ? `${v}%` : ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
            <span>40%</span><span className="flex h-2.5 w-40 overflow-hidden rounded-full">{blue.map((b) => <span key={b} className="flex-1" style={{ background: b }} />)}</span><span>100%</span>
            <span className="ml-4">Customers who joined since May hold on better through their first three months.</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Households likely to leave" sub="Highest risk first. Score combines wallet balance, skips, complaints and tenure." />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">Household</th><th className="px-3 py-2.5">Risk</th><th className="px-3 py-2.5">Why</th><th className="px-3 py-2.5 text-right">Per month</th><th className="px-5 py-2.5 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-milk-2">
                {risky.map((x) => (
                  <tr key={x.c.id} className="hover:bg-milk/60">
                    <td className="px-5 py-2.5"><p className="font-semibold">{x.c.contact}</p><p className="text-xs text-ink-soft">{x.c.flat}, {x.c.society}, Route {routeById[x.c.routeId]!.code}</p></td>
                    <td className="px-3 py-2.5"><Badge tone={x.risk >= 60 ? "bad" : "warn"}>{x.risk}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-ink-3">{x.reasons.join(", ")}</td>
                    <td className="px-3 py-2.5 text-right tabular">{inr(x.daily * 30)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button aria-label={`Send an offer to ${x.c.contact}`} onClick={() => toast(`Offer sent to ${x.c.contact}: 1 free bottle on their next top-up.`)} className="grid h-8 w-8 place-items-center rounded-lg bg-marigold-soft text-marigold-deep hover:bg-marigold hover:text-ink"><Gift size={15} /></button>
                        <a aria-label={`Call ${x.c.contact}`} href={`tel:${x.c.phone.replace(/\s/g, "")}`} className="grid h-8 w-8 place-items-center rounded-lg bg-milk-2 text-ink hover:bg-milk-3"><Phone size={15} /></a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHead title="Lifetime value spread" sub="Households by total spend so far" />
          <div className="h-72 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ltvBins} margin={{ top: 22, left: -16 }}>
                <XAxis dataKey="band" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis hide />
                <Tooltip {...tip} formatter={(v: number) => [v, "Households"]} />
                <Bar dataKey="homes" fill={SERIES1} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}><LabelList dataKey="homes" position="top" fill="#43474d" fontSize={12} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Products ---------------- */
function ProductsTab({ cur, prev, rows }: { cur: ReturnType<typeof byDate>; prev: ReturnType<typeof byDate>; rows: DayRow[] }) {
  const stacked = cur.map((d) => ({ label: dayMonth(d.date), ...Object.fromEntries(productGroups.map((g) => [g.id, Math.round(d.units[g.id])])) }));
  const totals = productGroups.map((g) => {
    const rev = sum(cur.map((d) => d.units[g.id]));
    const prv = sum(prev.map((d) => d.units[g.id]));
    return { g, rev, growth: pctDelta(rev, prv) };
  });
  const all = sum(totals.map((t) => t.rev));
  const drops = sum(cur.map((d) => d.drops));
  const premiumUnits = sum(rows.map((r) => r.units.premium));
  const culturedUnits = sum(rows.map((r) => r.units.cultured));

  // weekday x product index (100 = that product's average day)
  const heat = useMemo(() => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    return productGroups.map((g) => {
      const acc = Array.from({ length: 7 }, () => ({ v: 0, n: 0 }));
      cur.forEach((d) => { const w = new Date(d.date).getDay(); acc[w]!.v += d.units[g.id]; acc[w]!.n++; });
      const avg = acc.map((a) => (a.n ? a.v / a.n : 0));
      const mean = sum(avg) / 7 || 1;
      return { g, cells: order.map((w) => Math.round((avg[w]! / mean) * 100)) };
    });
  }, [cur]);
  const div = (v: number) => {
    const t = Math.max(-1, Math.min(1, (v - 100) / 25));
    if (Math.abs(t) < 0.12) return "#eef0f4";
    return t > 0 ? ["#fde3d7", "#f7b796", "#eb6834"][Math.min(2, Math.floor(t * 3))]! : ["#dbe8fb", "#9ec5f4", "#2a78d6"][Math.min(2, Math.floor(-t * 3))]!;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {totals.slice(0, 2).map((t) => (
          <Card key={t.g.id} className="p-4"><p className="text-sm text-ink-soft">{t.g.label}</p><p className="mt-1 font-display text-[26px] font-bold tabular">{inr(t.rev)}</p><p className={clsx("text-xs font-semibold", t.growth >= 0 ? "text-neem-deep" : "text-brick")}>{t.growth >= 0 ? "+" : ""}{t.growth.toFixed(1)}% <span className="font-normal text-ink-soft">vs previous</span></p></Card>
        ))}
        <Card className="p-4"><p className="text-sm text-ink-soft">Premium add-on rate</p><p className="mt-1 font-display text-[26px] font-bold tabular">{((premiumUnits / drops) * 100).toFixed(1)}%</p><p className="text-xs text-ink-soft">Drops with ghee, paneer or sweets</p></Card>
        <Card className="p-4"><p className="text-sm text-ink-soft">Dahi & taak attach rate</p><p className="mt-1 font-display text-[26px] font-bold tabular">{((culturedUnits / drops) * 100).toFixed(1)}%</p><p className="text-xs text-ink-soft">Cultured items per drop</p></Card>
      </div>

      <Card>
        <CardHead title="Revenue by product" sub="Daily revenue, stacked" />
        <div className="mt-3 px-5"><Legendish items={productGroups.map((g) => ({ label: g.label, color: g.color }))} /></div>
        <div className="h-80 p-3 pr-5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stacked} margin={{ top: 8, left: 4 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(stacked.length / 8))} />
              <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={short} />
              <Tooltip {...tip} formatter={(v: number, n: string) => [inr(v), productGroups.find((g) => g.id === n)?.label ?? n]} />
              {productGroups.map((g) => <Area key={g.id} type="monotone" dataKey={g.id} stackId="p" stroke="#fff" strokeWidth={2} fill={g.color} fillOpacity={0.92} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Product scorecard" />
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">Product</th><th className="px-3 py-2.5 text-right">Revenue</th><th className="px-3 py-2.5 text-right">Share</th><th className="px-5 py-2.5 text-right">Growth</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {totals.map((t) => (
                <tr key={t.g.id}>
                  <td className="px-5 py-3"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.g.color }} />{t.g.label}</span></td>
                  <td className="px-3 py-3 text-right tabular">{inr(t.rev)}</td>
                  <td className="px-3 py-3 text-right tabular">{((t.rev / all) * 100).toFixed(1)}%</td>
                  <td className={clsx("px-5 py-3 text-right font-semibold tabular", t.growth >= 0 ? "text-neem-deep" : "text-brick")}>{t.growth >= 0 ? "+" : ""}{t.growth.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHead title="When each product sells" sub="Index by weekday, 100 = that product's average day" />
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[460px] table-fixed border-separate border-spacing-[3px] text-center text-xs">
              <thead><tr className="text-ink-soft"><th className="w-[34%] text-left font-semibold">Product</th>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <th key={d} className="font-semibold">{d}</th>)}</tr></thead>
              <tbody>
                {heat.map((h) => (
                  <tr key={h.g.id}>
                    <td className="truncate pr-2 text-left font-semibold">{h.g.label}</td>
                    {h.cells.map((v, i) => <td key={i} className={clsx("h-9 rounded-md tabular", Math.abs(v - 100) > 17 && "font-semibold", v > 117 || v < 83 ? "text-white" : "text-ink")} style={{ background: div(v) }} title={`${h.g.label}, ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}: ${v}`}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink-soft">Orange is busier than usual, blue is quieter. Sundays pull premium items far above their weekday level.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Scenarios ---------------- */
function Slider({ label, value, min, max, step, onChange, fmt, help }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string; help?: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm"><span className="font-semibold">{label}</span><span className="font-display text-base font-bold tabular">{fmt(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[#14213D]" />
      {help && <span className="block text-xs text-ink-soft">{help}</span>}
    </label>
  );
}

function Scenarios() {
  // Baseline from the last 30 days of the network
  const base = useMemo(() => {
    const { rows, dates } = slice(30, "all");
    const days = byDate(rows, dates);
    const k = kpis(days);
    return { revenue: k.revenue, households: k.households, perDrop: k.arpu, skip: k.skip / 100 };
  }, []);
  const [price, setPrice] = useState(0);
  const [elastic, setElastic] = useState(-0.6);
  const [newHomes, setNewHomes] = useState(12);
  const [skip, setSkip] = useState(Math.round(base.skip * 1000) / 10);
  const [cogs, setCogs] = useState(Math.round(ECON.cogsPct * 100));
  const [riderPay, setRiderPay] = useState(ECON.riderPerDrop);

  const model = (o: { price: number; elastic: number; newHomes: number; skip: number; cogs: number; riderPay: number }, month = 1) => {
    const homes = base.households + o.newHomes * month * 0.84; // 84% of new homes survive month 1
    const vol = Math.max(0, 1 + o.elastic * (o.price / 100));
    const skipAdj = (1 - o.skip / 100) / (1 - base.skip);
    const drops = homes * 30 * vol * skipAdj;
    const revenue = drops * base.perDrop * (1 + o.price / 100);
    const fixedVehicle = Object.values({ r1: 18, r2: 26, r3: 31, r4: 22, r5: 28 }).reduce((s, km) => s + km * 2 * ECON.evPerKm, 0) * 30;
    const margin = revenue * (1 - o.cogs / 100 - 0.012) - drops * o.riderPay - fixedVehicle;
    return { revenue, margin, profit: margin - ECON.hubOverheadPerDay * 30, homes, drops };
  };
  const now = { price: 0, elastic, newHomes: 0, skip: base.skip * 100, cogs: ECON.cogsPct * 100, riderPay: ECON.riderPerDrop };
  const scen = { price, elastic, newHomes, skip, cogs, riderPay };
  const b = model(now, 0), s1 = model(scen, 1), s12 = model(scen, 12);

  const projection = Array.from({ length: 12 }, (_, m) => {
    const d = new Date(); d.setMonth(d.getMonth() + m + 1);
    return { month: d.toLocaleDateString("en-IN", { month: "short" }), Baseline: Math.round(model({ ...now, newHomes: 6 }, m + 1).profit), Scenario: Math.round(model(scen, m + 1).profit) };
  });
  const breakeven = projection.findIndex((x) => x.Scenario >= 0);

  // Sensitivity: change in monthly contribution for a 10% move in each driver
  const sens = useMemo(() => {
    const mid = model(scen, 1).margin;
    const drivers: { name: string; lo: Partial<typeof scen>; hi: Partial<typeof scen> }[] = [
      { name: "Price", lo: { price: price - 10 }, hi: { price: price + 10 } },
      { name: "Milk cost", lo: { cogs: cogs * 0.9 }, hi: { cogs: cogs * 1.1 } },
      { name: "Rider pay", lo: { riderPay: riderPay * 0.9 }, hi: { riderPay: riderPay * 1.1 } },
      { name: "Skip rate", lo: { skip: skip * 0.9 }, hi: { skip: skip * 1.1 } },
      { name: "New homes", lo: { newHomes: newHomes * 0.9 }, hi: { newHomes: newHomes * 1.1 } },
    ];
    return drivers.map((d) => {
      const lo = model({ ...scen, ...d.lo }, 1).margin - mid;
      const hi = model({ ...scen, ...d.hi }, 1).margin - mid;
      return { name: d.name, down: Math.round(Math.min(lo, hi)), up: Math.round(Math.max(lo, hi)), span: Math.abs(hi - lo) };
    }).sort((a, z) => z.span - a.span);
  }, [price, elastic, newHomes, skip, cogs, riderPay]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensMax = Math.max(1000, Math.ceil(Math.max(...sens.map((x) => Math.max(Math.abs(x.down), Math.abs(x.up)))) / 5000) * 5000);
  const Delta = ({ a, b: bb }: { a: number; b: number }) => {
    const d = a - bb;
    return <span className={clsx("text-xs font-semibold", Math.abs(d) < 1 ? "text-ink-soft" : d > 0 ? "text-neem-deep" : "text-brick")}>{Math.abs(d) < 1 ? "Same as this month" : `${d > 0 ? "+" : "−"}${inr(Math.abs(d))} vs this month`}</span>;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit p-5 xl:sticky xl:top-40">
        <h2 className="font-display text-lg font-semibold">What if…</h2>
        <p className="mt-0.5 text-sm text-ink-soft">Move the levers. Baseline is the last 30 days: {num(base.households, 0)} homes a day at {inr(base.perDrop, { decimals: true })} per drop.</p>
        <div className="mt-5 space-y-5">
          <Slider label="Price change" value={price} min={-10} max={15} step={1} onChange={setPrice} fmt={(v) => `${v > 0 ? "+" : ""}${v}%`} />
          <label className="block">
            <span className="text-sm font-semibold">How customers react to price</span>
            <select value={elastic} onChange={(e) => setElastic(Number(e.target.value))} className="mt-2 h-10 w-full rounded-xl border border-milk-3 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-marigold/40">
              <option value={-0.3}>Barely notice (−0.3 elasticity)</option>
              <option value={-0.6}>Some cut back (−0.6, our estimate)</option>
              <option value={-0.9}>Very price-sensitive (−0.9)</option>
            </select>
          </label>
          <Slider label="New households a month" value={newHomes} min={0} max={60} step={1} onChange={setNewHomes} fmt={(v) => String(v)} help="84% stay past their first month" />
          <Slider label="Skip rate" value={skip} min={1} max={15} step={0.5} onChange={setSkip} fmt={(v) => `${v.toFixed(1)}%`} />
          <Slider label="Milk & processing cost (share of revenue)" value={cogs} min={46} max={68} step={1} onChange={setCogs} fmt={(v) => `${Math.round(v)}%`} />
          <Slider label="Rider pay per drop" value={riderPay} min={10} max={22} step={1} onChange={setRiderPay} fmt={(v) => `₹${v}`} />
          <Button variant="soft" className="w-full" onClick={() => { setPrice(0); setElastic(-0.6); setNewHomes(12); setSkip(Math.round(base.skip * 1000) / 10); setCogs(Math.round(ECON.cogsPct * 100)); setRiderPay(ECON.riderPerDrop); }}>Reset levers</Button>
        </div>
      </Card>

      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4"><p className="text-sm text-ink-soft">Revenue next month</p><p className="mt-1 font-display text-[26px] font-bold tabular">{inr(s1.revenue)}</p><Delta a={s1.revenue} b={b.revenue} /></Card>
          <Card className="p-4"><p className="text-sm text-ink-soft">Contribution next month</p><p className="mt-1 font-display text-[26px] font-bold tabular">{inr(s1.margin)}</p><Delta a={s1.margin} b={b.margin} /></Card>
          <Card className="p-4"><p className="text-sm text-ink-soft">Operating profit in 12 months</p><p className={clsx("mt-1 font-display text-[26px] font-bold tabular", s12.profit < 0 && "text-brick")}>{inr(s12.profit)}</p><p className="text-xs text-ink-soft">{num(s12.homes, 0)} homes a day by then</p></Card>
        </div>

        <Card>
          <CardHead title="Monthly operating profit, next 12 months" sub={breakeven === 0 ? "Profitable from the first month." : breakeven > 0 ? `Breaks even in ${projection[breakeven]!.month}.` : "Doesn't break even within 12 months at these settings."} />
          <div className="mt-3 px-5"><Legendish items={[{ label: "Your scenario", color: SERIES1 }, { label: "Baseline (6 new homes a month, today's prices)", color: "#6B7591", dashed: true }]} /></div>
          <div className="h-72 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projection} margin={{ top: 8, left: 4 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={short} />
                <ReferenceLine y={0} stroke="#C2410C" strokeDasharray="4 4" label={{ value: "Break-even", position: "insideBottomLeft", fill: "#C2410C", fontSize: 12 }} />
                <Tooltip {...tip} formatter={(v: number, n: string) => [inr(v), n === "Scenario" ? "Your scenario" : "Baseline"]} />
                <Line dataKey="Baseline" stroke="#6B7591" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line dataKey="Scenario" stroke={SERIES1} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead title="Which lever matters most" sub="Change in next month's contribution if each driver moves 10% either way" />
          <div className="h-64 p-3 pr-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sens.map((x) => ({ ...x, lo: [x.down, 0] as [number, number], hi: [0, x.up] as [number, number] }))} layout="vertical" barGap={-18} margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => (v < 0 ? "−" : "") + short(Math.abs(v))} domain={[-sensMax, sensMax]} ticks={[-sensMax, -sensMax / 2, 0, sensMax / 2, sensMax]} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={84} />
                <ReferenceLine x={0} stroke="#6B7591" />
                <Tooltip {...tip} formatter={(v: [number, number], n: string) => { const x = n === "hi" ? v[1] : v[0]; return [`${x >= 0 ? "+" : "−"}${inr(Math.abs(x))}`, n === "hi" ? "Better case" : "Worse case"]; }} />
                <Bar dataKey="lo" fill="#eb6834" radius={[4, 0, 0, 4]} barSize={18} isAnimationActive={false} />
                <Bar dataKey="hi" fill={SERIES1} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} />
                <Legend formatter={(v: string) => (v === "hi" ? "Better case" : "Worse case")} iconType="square" wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="px-5 pb-5 text-sm text-ink-soft">{sens[0]!.name} has the largest effect: a 10% swing moves contribution by about {inr(sens[0]!.span / 2)} a month.</p>
        </Card>
      </div>
    </div>
  );
}

