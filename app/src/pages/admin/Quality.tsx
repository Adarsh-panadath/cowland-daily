import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, ShieldAlert, Printer } from "lucide-react";
import { seedBatches } from "../../data/seed";
import { dayMonth, longDate, num } from "../../lib/format";
import { Badge, Button, Card, CardHead, Segmented } from "../../components/ui";

export default function Quality() {
  const [metric, setMetric] = useState<"fat" | "snf" | "tempC">("fat");
  const today = seedBatches[0]!;
  const data = [...seedBatches].reverse().map((b) => ({ ...b, label: dayMonth(b.date) }));
  const ref = metric === "fat" ? { y: 4.5, label: "Min 4.5% for A2 label" } : metric === "snf" ? { y: 8.5, label: "FSSAI min 8.5%" } : { y: 4.5, label: "Max 4.5°C" };
  const held = seedBatches.filter((b) => b.status === "held");
  const avg = (k: "fat" | "snf") => seedBatches.reduce((s, b) => s + b[k], 0) / seedBatches.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Milk quality</h1>
          <p className="text-ink-soft">Every batch is tested before vans are loaded. Results print on each customer's milk chit.</p>
          <p className="mt-1.5 inline-flex rounded-lg bg-marigold-soft px-2.5 py-1 text-xs font-semibold text-marigold-deep">Sample lab data, not real test results.</p>
        </div>
        <Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()}>Print today's certificate</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="bg-neem px-5 py-4 text-white">
            <p className="flex items-center gap-2 text-sm text-white/80"><BadgeCheck size={16} /> Released for dispatch</p>
            <p className="font-display text-2xl font-bold">Batch {today.id}</p>
            <p className="text-sm text-white/80">{longDate(today.date)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 p-5 text-sm">
            {[
              ["Fat", `${today.fat}%`, "Target 4.5–5.0%"],
              ["SNF", `${today.snf}%`, "FSSAI min 8.5%"],
              ["Chiller temperature", `${today.tempC}°C`, "Must stay under 4.5°C"],
              ["Volume", `${num(today.litres)} L`, "From 34 cows"],
              ["Urea", "Not detected", "Strip test"],
              ["Starch", "Not detected", "Iodine test"],
            ].map(([k, v, s]) => (
              <div key={k} className="rounded-xl bg-milk p-3"><dt className="text-ink-soft">{k}</dt><dd className="font-display text-lg font-bold">{v}</dd><dd className="text-xs text-ink-soft">{s}</dd></div>
            ))}
          </dl>
          <p className="px-5 pb-5 text-sm text-ink-soft">Signed by {today.chemist}, chief dairy chemist, at 4:08 AM.</p>
        </Card>

        <Card>
          <CardHead title="30-day trend" sub={`Average fat ${avg("fat").toFixed(2)}%, SNF ${avg("snf").toFixed(2)}%`} right={<Segmented value={metric} onChange={setMetric} options={[{ value: "fat", label: "Fat" }, { value: "snf", label: "SNF" }, { value: "tempC", label: "Temp" }]} />} />
          <div className="h-80 p-3 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, left: -10 }}>
                <CartesianGrid vertical={false} stroke="#ECEEF3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} />
                <YAxis tickLine={false} axisLine={false} domain={metric === "fat" ? [4.3, 5.1] : metric === "snf" ? [8.3, 9.4] : [3, 5]} />
                <Tooltip formatter={(v: number) => [metric === "tempC" ? `${v}°C` : `${v}%`, metric === "tempC" ? "Temperature" : metric.toUpperCase()]} contentStyle={{ borderRadius: 12, border: "none" }} />
                <ReferenceLine y={ref.y} stroke="#C2410C" strokeDasharray="5 4" label={{ value: ref.label, position: "insideBottomRight", fill: "#C2410C", fontSize: 12 }} />
                <Line type="monotone" dataKey={metric} stroke="#2F7D5B" strokeWidth={2.5} dot={{ r: 2.5, fill: "#2F7D5B" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {held.length > 0 && (
        <Card className="flex items-start gap-3 bg-marigold-soft p-5 shadow-none">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-marigold-deep" />
          <p className="text-sm"><b>Batch {held[0]!.id} was held on {dayMonth(held[0]!.date)}</b> while a urea retest ran. It cleared at 4:41 AM and vans left 26 minutes late. Customers on all routes got a ₹10 credit.</p>
        </Card>
      )}

      <Card>
        <CardHead title="Batch log" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">Batch</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5 text-right">Fat</th><th className="px-3 py-2.5 text-right">SNF</th><th className="px-3 py-2.5 text-right">Temp</th><th className="px-3 py-2.5 text-right">Litres</th><th className="px-3 py-2.5">Chemist</th><th className="px-5 py-2.5">Result</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {seedBatches.slice(0, 14).map((b) => (
                <tr key={b.id} className="hover:bg-milk/60">
                  <td className="px-5 py-2.5 font-semibold">{b.id}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{dayMonth(b.date)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{b.fat}%</td>
                  <td className="px-3 py-2.5 text-right tabular">{b.snf}%</td>
                  <td className="px-3 py-2.5 text-right tabular">{b.tempC}°C</td>
                  <td className="px-3 py-2.5 text-right tabular">{num(b.litres)}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{b.chemist}</td>
                  <td className="px-5 py-2.5">{b.status === "passed" ? <Badge tone="good">Passed</Badge> : <Badge tone="warn">Held, then passed</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
