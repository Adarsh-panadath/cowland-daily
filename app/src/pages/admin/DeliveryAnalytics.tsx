import { useMemo, useState } from "react";
import clsx from "clsx";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Lightbulb, Plus } from "lucide-react";
import { allDates, drops, dayRows, churnByExperience, churnRateFor, AVG_REFUND, HOME_MONTHLY_VALUE, PROMISE_MIN, fmtClock, lateCauses, issueTypes, type DropRec } from "../../data/analytics";
import { routes, routeById, riders } from "../../data/seed";
import { useStore } from "../../store/useStore";
import { inr, num, dayMonth } from "../../lib/format";
import { Badge, Button, Card, CardHead } from "../../components/ui";
import { toast } from "../../store/toast";

const tip = { contentStyle: { borderRadius: 12, border: "none", boxShadow: "0 8px 24px -12px rgba(20,33,61,.35)", fontSize: 13 }, cursor: { fill: "#F6F7F9" } };
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const orangeRamp = ["#f4f5f8", "#fde3d7", "#f9c4a9", "#f4a07a", "#eb6834", "#c94d1c"];
const lateShade = (pct: number) => orangeRamp[pct <= 0 ? 0 : pct < 5 ? 1 : pct < 10 ? 2 : pct < 20 ? 3 : pct < 35 ? 4 : 5]!;

function inWindow(period: number, route: string, offset = 0) {
  const dates = allDates.slice(allDates.length - period * (offset + 1), allDates.length - period * offset);
  const set = new Set(dates);
  return drops.filter((d) => set.has(d.date) && (route === "all" || d.route === route));
}

/** Monthly revenue at risk: extra cancellations caused by bad mornings, plus refunds, scaled to 30 days. */
function revenueAtRisk(ds: DropRec[], period: number) {
  const bad = new Map<string, number>();
  for (const d of ds) if (d.late || d.issue) bad.set(d.home, (bad.get(d.home) ?? 0) + 1);
  const homes = new Set(ds.map((d) => d.home));
  let churn = 0;
  for (const h of homes) {
    const b = Math.round(((bad.get(h) ?? 0) * 30) / period);
    churn += (churnRateFor(b) - churnRateFor(0)) * HOME_MONTHLY_VALUE;
  }
  const refunds = (ds.filter((d) => d.issue).length * AVG_REFUND * 30) / period;
  return { churn, refunds, total: churn + refunds, homesHit: [...bad.values()].filter((b) => b * 30 / period >= 2).length };
}

const Delta = ({ now, before, goodWhenUp }: { now: number; before: number; goodWhenUp: boolean }) => {
  const d = before ? ((now - before) / before) * 100 : 0;
  if (Math.abs(d) < 0.5) return <span className="text-xs font-semibold text-ink-soft">No change vs previous</span>;
  const good = goodWhenUp ? d > 0 : d < 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-neem-deep" : "text-brick")}>
      {d > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(d).toFixed(1)}%<span className="font-normal text-ink-soft">&nbsp;vs previous</span>
    </span>
  );
};

export function DeliveryAnalytics({ period, route }: { period: number; route: string }) {
  const planned = useStore((s) => s.planned);
  const togglePlanned = useStore((s) => s.togglePlanned);
  const cur = useMemo(() => inWindow(period, route), [period, route]);
  const prev = useMemo(() => inWindow(period, route, 1), [period, route]);

  const stats = (ds: DropRec[]) => {
    const n = ds.length || 1;
    return {
      n: ds.length,
      avg: ds.reduce((s, d) => s + d.minute, 0) / n,
      onTime: (ds.filter((d) => !d.late).length / n) * 100,
      late: ds.filter((d) => d.late).length,
      issues: ds.filter((d) => d.issue).length,
      per100: (ds.filter((d) => d.issue).length / n) * 100,
      clean: (ds.filter((d) => !d.late && !d.issue).length / n) * 100,
      lateMins: ds.filter((d) => d.late).reduce((s, d) => s + (d.minute - PROMISE_MIN), 0) / (ds.filter((d) => d.late).length || 1),
    };
  };
  const k = stats(cur), kp = stats(prev);
  const risk = revenueAtRisk(cur, period);
  const riskPrev = revenueAtRisk(prev, period);

  // arrival distribution, 5-minute buckets 5:00 to 7:00
  const hist = useMemo(() => {
    const b: { label: string; start: number; count: number; late: boolean }[] = [];
    for (let m = 300; m < 420; m += 5) b.push({ label: fmtClock(m).replace(" AM", ""), start: m, count: 0, late: m >= PROMISE_MIN });
    for (const d of cur) { const i = Math.floor((d.minute - 300) / 5); if (b[i]) b[i]!.count++; }
    return b.map((x) => ({ ...x, perDay: +(x.count / period).toFixed(1) }));
  }, [cur, period]);

  // route x day heatmap (last 14 days, all routes)
  const heat = useMemo(() => {
    const days = allDates.slice(-Math.min(14, period));
    return routes.map((r) => ({
      route: r,
      cells: days.map((date) => {
        const ds = drops.filter((d) => d.date === date && d.route === r.id);
        const late = ds.filter((d) => d.late);
        return { date, pct: ds.length ? Math.round((late.length / ds.length) * 100) : 0, cause: late[0]?.cause ?? null, n: ds.length };
      }),
    }));
  }, [period]);

  const causes = lateCauses.map((c) => {
    const ds = cur.filter((d) => d.cause === c);
    return { cause: c, count: ds.length, mins: ds.length ? Math.round(ds.reduce((s, d) => s + (d.minute - PROMISE_MIN), 0) / ds.length) : 0 };
  }).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
  const issues = issueTypes.map((t) => ({ type: t, count: cur.filter((d) => d.issue === t).length })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);

  const hotspots = useMemo(() => {
    const m = new Map<string, DropRec[]>();
    for (const d of cur) m.set(`${d.route}|${d.society}`, [...(m.get(`${d.route}|${d.society}`) ?? []), d]);
    return [...m.entries()].map(([key, ds]) => {
      const [rid, society] = key.split("|") as [string, string];
      const iss = ds.filter((d) => d.issue);
      const top = issueTypes.map((t) => [t, iss.filter((d) => d.issue === t).length] as const).sort((a, b) => b[1] - a[1])[0];
      const r = revenueAtRisk(ds, period);
      return { rid, society, n: ds.length, latePct: (ds.filter((d) => d.late).length / ds.length) * 100, per100: (iss.length / ds.length) * 100, top: top && top[1] > 0 ? top[0] : "—", risk: r.total };
    }).sort((a, b) => b.risk - a.risk).slice(0, 8);
  }, [cur, period]);

  const riderCard = routes.map((r) => {
    const ds = cur.filter((d) => d.route === r.id);
    const byDay = new Map<string, DropRec[]>();
    for (const d of ds) byDay.set(d.date, [...(byDay.get(d.date) ?? []), d]);
    const paces = [...byDay.values()].map((l) => (l.at(-1)!.minute - l[0]!.minute) / Math.max(1, l.length - 1));
    const rows = dayRows.filter((x) => x.route === r.id && new Set(allDates.slice(-period)).has(x.date));
    const out = rows.reduce((s, x) => s + x.bottlesOut, 0), back = rows.reduce((s, x) => s + x.bottlesBack, 0);
    const rider = riders.find((x) => x.routeId === r.id)!;
    return { r, rider, pace: paces.length ? paces.reduce((s, x) => s + x, 0) / paces.length : 0, first: ds.length ? Math.min(...ds.map((d) => d.minute)) : 0, onTime: ds.length ? (ds.filter((d) => !d.late).length / ds.length) * 100 : 0, per100: ds.length ? (ds.filter((d) => d.issue).length / ds.length) * 100 : 0, back: out ? (back / out) * 100 : 0 };
  });

  // homes by number of bad mornings this period (scaled to a month)
  const exposure = useMemo(() => {
    const bad = new Map<string, number>();
    const homes = new Set(cur.map((d) => d.home));
    for (const d of cur) if (d.late || d.issue) bad.set(d.home, (bad.get(d.home) ?? 0) + 1);
    const bucket = (b: number) => (b === 0 ? 0 : b === 1 ? 1 : b <= 3 ? 2 : 3);
    const counts = [0, 0, 0, 0];
    for (const h of homes) counts[bucket(Math.round(((bad.get(h) ?? 0) * 30) / period))]!++;
    return churnByExperience.map((c, i) => ({ ...c, homes: counts[i]! }));
  }, [cur, period]);

  // Fixes: remove a share of matching bad events, measure revenue protected per month
  const fixes = useMemo(() => {
    const all = inWindow(period, "all");
    const baseRisk = revenueAtRisk(all, period).total;
    const worst = [...routes].map((r) => ({ r, late: all.filter((d) => d.route === r.id && d.late).length / Math.max(1, all.filter((d) => d.route === r.id).length) })).sort((a, b) => b.late - a.late)[0]!;
    const gateSoc = (() => {
      const m = new Map<string, number>();
      for (const d of all) if (d.issue === "Door locked, no bag" || d.cause === "Gate entry delay") m.set(`${d.route}|${d.society}`, (m.get(`${d.route}|${d.society}`) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].split("|") ?? ["r3", "Mahanubhav Society"];
    })();
    // Fix a share of matching events: late ones become on time, problem ones become clean.
    const simulate = (lateFix: (d: DropRec) => boolean, issueFix: (d: DropRec) => boolean, share: number) => {
      let i = 0;
      const fixed = all.map((d) => {
        const l = d.late && lateFix(d), p = !!d.issue && issueFix(d);
        if (!(l || p) || (i++ % 100) >= share * 100) return d;
        return { ...d, late: l ? false : d.late, cause: l ? null : d.cause, issue: p ? null : d.issue };
      });
      return Math.max(0, baseRisk - revenueAtRisk(fixed, period).total);
    };
    const never = () => false;
    const list = [
      { id: `early-${worst.r.id}`, title: `Start Route ${worst.r.code} ten minutes earlier`, detail: `${(worst.late * 100).toFixed(0)}% of its drops miss 6:15 AM, mostly the last few homes. Loading it first at the hub fixes most of them.`, effort: "Low", value: simulate((d) => d.route === worst.r.id && ["Too many stops for the window", "Road work or traffic", "Gate entry delay"].includes(d.cause ?? ""), (d) => d.route === worst.r.id && d.issue === "Late delivery complaint", 0.75) },
      { id: `gate-${gateSoc[1]}`, title: `Pre-register vans with security at ${gateSoc[1]}`, detail: `Gate hold-ups and locked doors there cause more bad mornings than anywhere else on Route ${routeById[gateSoc[0]!]!.code}. A standing gate pass and a doorstep bag for each flat remove most of them.`, effort: "Low", value: simulate((d) => d.society === gateSoc[1] && d.cause === "Gate entry delay", (d) => d.society === gateSoc[1] && d.issue === "Door locked, no bag", 0.7) },
      { id: "dispatch-415", title: "Finish loading every van by 4:15 AM", detail: `Late dispatch from the hub caused ${all.filter((d) => d.cause === "Late dispatch from hub").length} late drops. A packing cut-off and a second loading bay keep all five vans on time.`, effort: "Medium", value: simulate((d) => d.cause === "Late dispatch from hub", never, 0.85) },
      { id: "rain-plan", title: "Rain plan: leave ten minutes early when rain is forecast", detail: `Rain mornings made ${all.filter((d) => d.cause === "Rain").length} drops late. Riders get the alert the night before, along with rain covers for the crates.`, effort: "Low", value: simulate((d) => d.cause === "Rain", never, 0.55) },
      { id: "crate-liners", title: "Fit leak-proof liners and a packing checklist", detail: `${all.filter((d) => d.issue === "Leak or broken" || d.issue === "Item missing" || d.issue === "Wrong item").length} drops had leaks, missing or wrong items. Liners plus a scan-before-load check cut these by about half.`, effort: "Medium", value: simulate(never, (d) => d.issue === "Leak or broken" || d.issue === "Item missing" || d.issue === "Wrong item", 0.5) },
      { id: "ev-charge", title: "Charge vans to 100% by 3:30 AM and keep a spare", detail: `Breakdowns and low charge caused ${all.filter((d) => d.cause === "Van charging or breakdown").length} late drops, usually long delays of 20+ minutes.`, effort: "Medium", value: simulate((d) => d.cause === "Van charging or breakdown", never, 0.8) },
    ];
    return list.map((f) => ({ ...f, value: Math.round(f.value) })).sort((a, b) => b.value - a.value);
  }, [period]);
  const plannedValue = fixes.filter((f) => planned[f.id]).reduce((s, f) => s + f.value, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-ink-soft">Delivered before 6:15 AM</p>
          <p className="mt-1 font-display text-[26px] font-bold tabular">{k.onTime.toFixed(1)}%</p>
          <Delta now={k.onTime} before={kp.onTime} goodWhenUp />
        </Card>
        <Card className="p-4">
          <p className="text-sm text-ink-soft">Average arrival</p>
          <p className="mt-1 font-display text-[26px] font-bold tabular">{fmtClock(k.avg)}</p>
          <p className="text-xs text-ink-soft">Late drops were {Math.round(k.lateMins)} min late on average</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-ink-soft">Problems per 100 drops</p>
          <p className="mt-1 font-display text-[26px] font-bold tabular">{k.per100.toFixed(2)}</p>
          <Delta now={k.per100} before={kp.per100} goodWhenUp={false} />
        </Card>
        <Card className="bg-ink p-4 text-white">
          <p className="text-sm text-white/70">Revenue at risk from bad mornings</p>
          <p className="mt-1 font-display text-[26px] font-bold tabular text-marigold">{inr(risk.total)}<span className="text-base font-normal text-white/60"> /month</span></p>
          <p className="text-xs text-white/60">{inr(risk.churn)} likely cancellations, {inr(risk.refunds)} refunds{riskPrev.total ? `, ${risk.total < riskPrev.total ? "down" : "up"} from ${inr(riskPrev.total)}` : ""}</p>
        </Card>
      </div>

      {/* Fixes */}
      <Card>
        <CardHead title={<span className="flex items-center gap-2"><Lightbulb size={18} className="text-marigold-deep" /> Fixes that protect the most revenue</span>}
          sub="Estimated from the last period's late and problem deliveries, and how often those homes cancel afterwards"
          right={plannedValue > 0 ? <Badge tone="good">Plan protects {inr(plannedValue)}/month</Badge> : undefined} />
        <ol className="grid gap-3 p-5 lg:grid-cols-2">
          {fixes.map((f, i) => (
            <li key={f.id} className={clsx("flex gap-3 rounded-2xl border p-4", planned[f.id] ? "border-neem bg-neem-soft/40" : "border-milk-2")}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{f.title}</p>
                  <p className="font-display text-lg font-bold tabular text-neem-deep">+{inr(f.value)}<span className="text-xs font-normal text-ink-soft">/month</span></p>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{f.detail}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone="neutral">{f.effort} effort</Badge>
                  <Button size="sm" variant={planned[f.id] ? "soft" : "primary"} icon={planned[f.id] ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                    onClick={() => { togglePlanned(f.id); toast(planned[f.id] ? "Removed from this week's plan." : "Added to this week's plan."); }}>
                    {planned[f.id] ? "In this week's plan" : "Add to plan"}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="When milk reaches the door" sub={`Drops per morning in each 5-minute slot, last ${period} days${route !== "all" ? `, Route ${routeById[route]!.code}` : ""}`} />
          <div className="mt-3 flex gap-4 px-5 text-xs text-ink-3">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BLUE }} />Before 6:15</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ORANGE }} />Late</span>
          </div>
          <ArrivalHistogram hist={hist} />
        </Card>

        <Card>
          <CardHead title="Why drops were late" sub={`${num(k.late)} late drops, last ${period} days`} />
          <ul className="space-y-3 p-5">
            {causes.length === 0 && <li className="text-sm text-ink-soft">No late drops in this period.</li>}
            {causes.map((c) => (
              <li key={c.cause}>
                <div className="mb-1 flex justify-between gap-2 text-sm"><span className="font-medium">{c.cause}</span><span className="tabular text-ink-soft"><b className="text-ink">{c.count}</b> drops, {c.mins} min late</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-milk-2"><div className="h-full rounded-full" style={{ width: `${(c.count / causes[0]!.count) * 100}%`, background: ORANGE }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHead title="Late drops by route and day" sub="Share of each route's drops after 6:15 AM. Hover a cell for the main cause." />
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-[3px] text-center text-xs">
            <thead><tr className="text-ink-soft"><th className="w-40 text-left font-semibold">Route</th>{heat[0]!.cells.map((c) => <th key={c.date} className="font-semibold">{dayMonth(c.date).replace(" ", " ")}</th>)}</tr></thead>
            <tbody>
              {heat.map((h) => (
                <tr key={h.route.id}>
                  <td className="truncate pr-2 text-left font-semibold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: h.route.color }} />{h.route.code} {h.route.name}</td>
                  {h.cells.map((c) => (
                    <td key={c.date} title={`Route ${h.route.code}, ${dayMonth(c.date)}: ${c.pct}% late${c.cause ? `, mostly ${c.cause.toLowerCase()}` : ""}`} className={clsx("h-9 rounded-md tabular", c.pct >= 20 ? "font-semibold text-white" : "text-ink")} style={{ background: lateShade(c.pct) }}>
                      {c.pct ? `${c.pct}%` : "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
            <span>On time</span><span className="flex h-2.5 w-36 overflow-hidden rounded-full">{orangeRamp.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</span><span>35%+ late</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHead title="Bad mornings drive cancellations" sub="Homes that cancel the next month, by late or problem deliveries in a month" />
          <div className="h-64 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exposure} margin={{ top: 22, left: -12 }}>
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis hide />
                <Tooltip {...tip} formatter={(v: number) => [`${v}%`, "Cancel next month"]} />
                <Bar dataKey="rate" fill={ORANGE} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                  <LabelList dataKey="rate" position="top" formatter={(v: number) => `${v}%`} fill="#43474d" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2 px-5 pb-5 text-center text-xs text-ink-soft">
            {exposure.map((e) => <div key={e.bucket} className="rounded-lg bg-milk py-2"><b className="block font-display text-lg text-ink tabular">{e.homes}</b>homes now</div>)}
          </div>
        </Card>

        <Card>
          <CardHead title="What went wrong at the door" sub={`${k.issues} problem deliveries, last ${period} days`} />
          <ul className="space-y-3 p-5">
            {issues.length === 0 && <li className="text-sm text-ink-soft">No problems reported in this period.</li>}
            {issues.map((x) => (
              <li key={x.type}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{x.type}</span><span className="tabular text-ink-soft"><b className="text-ink">{x.count}</b> ({((x.count / Math.max(1, k.issues)) * 100).toFixed(0)}%)</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-milk-2"><div className="h-full rounded-full" style={{ width: `${(x.count / issues[0]!.count) * 100}%`, background: BLUE }} /></div>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-5 text-sm text-ink-soft">Refunds for these cost about {inr(k.issues * AVG_REFUND)} in this period.</p>
        </Card>
      </div>

      <Card>
        <CardHead title="Trouble spots" sub="Societies where late or problem deliveries put the most revenue at risk" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">Society</th><th className="px-3 py-2.5">Route</th><th className="px-3 py-2.5 text-right">Drops</th><th className="px-3 py-2.5 text-right">Late</th><th className="px-3 py-2.5 text-right">Problems /100</th><th className="px-3 py-2.5">Most common problem</th><th className="px-5 py-2.5 text-right">At risk /month</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {hotspots.map((h) => (
                <tr key={h.rid + h.society} className="hover:bg-milk/60">
                  <td className="px-5 py-2.5 font-semibold">{h.society}</td>
                  <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: routeById[h.rid]!.color }} />{routeById[h.rid]!.code}</span></td>
                  <td className="px-3 py-2.5 text-right tabular">{num(h.n)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{h.latePct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular">{h.per100.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-ink-3">{h.top}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular">{inr(h.risk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead title="Rider scorecard" sub={`Last ${period} days`} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">Rider</th><th className="px-3 py-2.5">Route</th><th className="px-3 py-2.5 text-right">First drop</th><th className="px-3 py-2.5 text-right">Minutes per home</th><th className="px-3 py-2.5 text-right">Before 6:15</th><th className="px-3 py-2.5 text-right">Problems /100</th><th className="px-3 py-2.5 text-right">Bottles back</th><th className="px-5 py-2.5 text-right">Rating</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {riderCard.map((x) => (
                <tr key={x.r.id} className="hover:bg-milk/60">
                  <td className="px-5 py-2.5 font-semibold">{x.rider.name}</td>
                  <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.r.color }} />{x.r.code}</span></td>
                  <td className="px-3 py-2.5 text-right tabular">{x.first ? fmtClock(x.first) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular">{x.pace.toFixed(1)}</td>
                  <td className={clsx("px-3 py-2.5 text-right font-semibold tabular", x.onTime < 90 ? "text-brick" : x.onTime < 97 ? "text-marigold-deep" : "text-neem-deep")}>{x.onTime.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular">{x.per100.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{x.back.toFixed(1)}%</td>
                  <td className="px-5 py-2.5 text-right tabular">{x.rider.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-4 text-sm text-ink-soft">{(() => {
          const slow = [...riderCard].sort((a, b) => b.pace - a.pace)[0]!;
          const late = [...riderCard].sort((a, b) => a.onTime - b.onTime)[0]!;
          return slow.r.id === late.r.id
            ? `${late.rider.name} is both the slowest per home and the latest. Ride along one morning before changing the route.`
            : `${late.rider.name} has the most late drops but isn't the slowest per home (${slow.rider.name} is). Route ${late.r.code}'s start time and stop count are the problem, not the rider.`;
        })()}</p>
      </Card>
    </div>
  );
}

/** Plain SVG histogram: one bar per 5-minute slot, with a marked 6:15 promise line and hover readout. */
function ArrivalHistogram({ hist }: { hist: { label: string; start: number; perDay: number; late: boolean }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...hist.map((h) => h.perDay));
  const W = 720, H = 240, padL = 34, padB = 26, padT = 18;
  const bw = (W - padL) / hist.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, max / 2, max].map((v) => Math.round(v * 10) / 10);
  const promiseX = padL + hist.findIndex((h) => h.start === PROMISE_MIN) * bw;
  const h = hover != null ? hist[hover] : null;
  return (
    <div className="relative p-3 pr-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Drops per morning by arrival time" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#ECEEF3" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B7591">{t}</text>
          </g>
        ))}
        {hist.map((b, i) => (
          <g key={b.label} onMouseEnter={() => setHover(i)}>
            <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
            {b.perDay > 0 && <rect x={padL + i * bw + 1.5} y={y(b.perDay)} width={bw - 3} height={Math.max(1, H - padB - y(b.perDay))} rx={3} fill={b.late ? "#eb6834" : "#2a78d6"} opacity={hover == null || hover === i ? 1 : 0.55} />}
            {i % 3 === 0 && <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6B7591">{b.label}</text>}
          </g>
        ))}
        <line x1={promiseX} x2={promiseX} y1={padT - 6} y2={H - padB} stroke="#14213D" strokeDasharray="4 3" />
        <text x={promiseX + 6} y={padT + 4} fontSize="11" fill="#14213D" fontWeight="600">6:15 promise</text>
      </svg>
      {h && (
        <div className="pointer-events-none absolute right-6 top-3 rounded-xl bg-white px-3 py-2 text-sm shadow-pop">
          <p className="font-semibold">{h.label}–{h.label.replace(/:(\d+)/, (_m, mm) => `:${String(Number(mm) + 4).padStart(2, "0")}`)} AM</p>
          <p className="text-ink-soft">{h.perDay} drops a morning{h.late ? ", late" : ""}</p>
        </div>
      )}
    </div>
  );
}
