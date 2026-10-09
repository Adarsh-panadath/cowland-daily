import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDownLeft, ArrowUpRight, RotateCcw } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore, useMe, lineTotal } from "../../store/useStore";
import { ME } from "../../data/seed";
import { addDays, dayKey, dayMonth, inr, clock } from "../../lib/format";
import { Button, Card, CardHead, Segmented } from "../../components/ui";
import { TopUpModal } from "../../components/customer";
import { toast } from "../../store/toast";

export default function WalletPage() {
  const me = useMe();
  const txns = useStore((s) => s.txns.filter((t) => t.customerId === ME));
  const [filter, setFilter] = useState<"all" | "debit" | "topup" | "refund">("all");
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(true);
  const daily = lineTotal(me.plan);

  const chart = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const k = dayKey(addDays(new Date(), i - 13));
      const spent = txns.filter((t) => t.kind === "debit" && dayKey(new Date(t.at)) === k).reduce((s, t) => s + t.amount, 0);
      return { day: dayMonth(k), spent };
    });
  }, [txns]);
  const monthSpend = txns.filter((t) => t.kind === "debit" && new Date(t.at) > addDays(new Date(), -30)).reduce((s, t) => s + t.amount, 0);
  const list = txns.filter((t) => filter === "all" || t.kind === filter);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-pop">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-marigold/25 blur-2xl" />
          <p className="text-sm text-white/60">Cowland wallet</p>
          <p className="mt-1 font-display text-5xl font-bold tabular">{inr(me.wallet)}</p>
          <p className="mt-2 text-sm text-white/70">About {daily ? Math.max(0, Math.floor(me.wallet / daily)) : "—"} days of milk at {inr(daily)} a day</p>
          <div className="mt-6 flex gap-2">
            <Button variant="accent" className="flex-1" onClick={() => setOpen(true)}>Add money</Button>
          </div>
        </div>
        <Card className="p-5">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-semibold">Automatic top-up</span>
              <span className="mt-0.5 block text-sm text-ink-soft">Add {inr(2000)} by UPI when the balance drops below {inr(400)}.</span>
            </span>
            <button role="switch" aria-checked={auto} onClick={() => { setAuto(!auto); toast(auto ? "Automatic top-up turned off." : "Automatic top-up turned on.", "info"); }} className={clsx("relative mt-1 h-6 w-11 shrink-0 rounded-full transition", auto ? "bg-neem" : "bg-milk-3")}>
              <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", auto ? "left-[22px]" : "left-0.5")} />
            </button>
          </label>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-soft">Spent in the last 30 days</p>
          <p className="font-display text-3xl font-bold tabular">{inr(monthSpend)}</p>
          <div className="mt-4 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -24, right: 0, top: 4, bottom: 0 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} interval={3} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <Tooltip cursor={{ fill: "#ECEEF3" }} formatter={(v: number) => [inr(v), "Spent"]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px -12px rgba(20,33,61,.35)" }} />
                <Bar dataKey="spent" fill="#14213D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Transactions" right={<Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "debit", label: "Deliveries" }, { value: "topup", label: "Top-ups" }, { value: "refund", label: "Refunds" }]} />} />
        <ul className="mt-3 divide-y divide-milk-2 px-2 pb-2">
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-milk">
              <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", t.kind === "debit" ? "bg-milk-2 text-ink-3" : t.kind === "topup" ? "bg-neem-soft text-neem" : "bg-marigold-soft text-marigold-deep")}>
                {t.kind === "debit" ? <ArrowUpRight size={18} /> : t.kind === "topup" ? <ArrowDownLeft size={18} /> : <RotateCcw size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.note}</p>
                <p className="text-xs text-ink-soft">{dayMonth(dayKey(new Date(t.at)))}, {clock(t.at)}</p>
              </div>
              <span className={clsx("font-semibold tabular", t.kind === "debit" ? "text-ink" : "text-neem")}>{t.kind === "debit" ? "−" : "+"}{inr(t.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <TopUpModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
