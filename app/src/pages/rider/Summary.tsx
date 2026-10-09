import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Star, Clock3, Recycle, IndianRupee, Route as RouteIcon } from "lucide-react";
import { useStore } from "../../store/useStore";
import { riderById, routeById } from "../../data/seed";
import { Card, CardHead } from "../../components/ui";
import { inr } from "../../lib/format";

const ROUTE = "r4";
const PER_DROP = 14;

export default function RiderSummary() {
  const stops = useStore((s) => s.stops.filter((x) => x.routeId === ROUTE));
  const route = routeById[ROUTE]!;
  const rider = riderById[route.riderId]!;
  const delivered = stops.filter((s) => s.status === "delivered");
  const onTime = delivered.filter((s) => { const d = new Date(s.at!); return d.getHours() * 60 + d.getMinutes() <= 375; }).length;
  const bottles = stops.reduce((s, x) => s + x.bottlesCollected, 0);
  const due = stops.reduce((s, x) => s + x.bottlesDue, 0);
  const bonus = delivered.length === stops.length ? 120 : 0;
  const earnings = delivered.length * PER_DROP + Math.round(bottles * 2) + bonus;

  const timeline = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const s of delivered) {
      const d = new Date(s.at!);
      const m = Math.floor((d.getHours() * 60 + d.getMinutes()) / 10) * 10;
      const label = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
      buckets[label] = (buckets[label] ?? 0) + 1;
    }
    return Object.entries(buckets).sort(([a], [b]) => (a.padStart(5, "0") < b.padStart(5, "0") ? -1 : 1)).map(([time, drops]) => ({ time, drops }));
  }, [delivered]);

  const stats = [
    { icon: <RouteIcon size={18} />, label: "Doors delivered", value: `${delivered.length} / ${stops.length}` },
    { icon: <Clock3 size={18} />, label: "Before 6:15 AM", value: delivered.length ? `${Math.round((onTime / delivered.length) * 100)}%` : "—" },
    { icon: <Recycle size={18} />, label: "Empties collected", value: `${bottles} / ${due}` },
    { icon: <IndianRupee size={18} />, label: "Earned today", value: inr(earnings) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Shift summary</h1>
        <p className="text-ink-soft">{rider.name}, Route {route.code}. {rider.years} years with Cowland.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-milk-2 text-ink-3">{s.icon}</span>
            <p className="mt-3 font-display text-3xl font-bold tabular">{s.value}</p>
            <p className="text-sm text-ink-soft">{s.label}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHead title="Your pace this morning" sub="Drops completed in each 10-minute window" />
          <div className="h-64 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ left: -20, top: 10 }}>
                <defs>
                  <linearGradient id="pace" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#F2A900" stopOpacity={0.5} /><stop offset="100%" stopColor="#F2A900" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [v, "Drops"]} contentStyle={{ borderRadius: 12, border: "none" }} />
                <Area type="monotone" dataKey="drops" stroke="#B37A00" strokeWidth={2.5} fill="url(#pace)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHead title="How pay adds up" />
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">{delivered.length} drops × {inr(PER_DROP)}</dt><dd className="font-semibold tabular">{inr(delivered.length * PER_DROP)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">{bottles} empties × ₹2</dt><dd className="font-semibold tabular">{inr(bottles * 2)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Full-route bonus</dt><dd className="font-semibold tabular">{bonus ? inr(bonus) : "Finish all doors"}</dd></div>
            <div className="flex justify-between border-t border-milk-2 pt-3 text-base"><dt className="font-semibold">Today</dt><dd className="font-display text-xl font-bold tabular">{inr(earnings)}</dd></div>
          </dl>
          <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl bg-marigold-soft p-3">
            <Star size={20} className="fill-marigold text-marigold" />
            <p className="text-sm"><b>{rider.rating}</b> rating from 212 households this month</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
