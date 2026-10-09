import { Link } from "react-router-dom";
import { IndianRupee, Home, Recycle, Clock3, Star } from "lucide-react";
import { useStore } from "../../store/useStore";
import { riderById, routeById } from "../../data/seed";
import { inr } from "../../lib/format";
import { tr } from "../../lib/riderText";
import { LangSwitch } from "./Round";

const ROUTE = "r4";
const PER_DROP = 14;
const PER_BOTTLE = 2;
const BONUS = 120;

export default function RiderSummary() {
  const lang = useStore((s) => s.riderLang);
  const stops = useStore((s) => s.stops.filter((x) => x.routeId === ROUTE));
  const rider = riderById[routeById[ROUTE]!.riderId]!;
  const delivered = stops.filter((s) => s.status === "delivered");
  const onTime = delivered.filter((s) => { const d = new Date(s.at!); return d.getHours() * 60 + d.getMinutes() <= 375; }).length;
  const bottles = stops.reduce((s, x) => s + x.bottlesCollected, 0);
  const allDone = stops.every((s) => s.status !== "pending");
  const bonus = allDone ? BONUS : 0;
  const total = delivered.length * PER_DROP + bottles * PER_BOTTLE + bonus;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <LangSwitch />
      <div className="rounded-3xl bg-ink p-6 text-center text-white">
        <p className="text-white/70">{tr("earnToday", lang)}</p>
        <p className="mt-1 font-display text-6xl font-bold tabular">{inr(total)}</p>
        <p className="mt-2 flex items-center justify-center gap-1 text-white/70"><Star size={16} className="fill-marigold text-marigold" /> {rider.rating}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Home size={26} />, v: `${delivered.length}/${stops.length}`, l: tr("homes", lang) },
          { icon: <Recycle size={26} />, v: String(bottles), l: tr("bottles", lang) },
          { icon: <Clock3 size={26} />, v: delivered.length ? `${Math.round((onTime / delivered.length) * 100)}%` : "—", l: tr("onTime", lang) },
        ].map((x) => (
          <div key={x.l} className="flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-sm">
            <span className="text-ink-3">{x.icon}</span>
            <span className="mt-1 font-display text-3xl font-bold tabular">{x.v}</span>
            <span className="text-sm text-ink-soft">{x.l}</span>
          </div>
        ))}
      </div>
      <WeekPay lang={lang} today={total} />
      <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
        <Row icon={<Home size={20} />} label={`${delivered.length} × ${inr(PER_DROP)} ${tr("perHome", lang)}`} value={inr(delivered.length * PER_DROP)} />
        <Row icon={<Recycle size={20} />} label={`${bottles} × ${inr(PER_BOTTLE)} ${tr("perBottle", lang)}`} value={inr(bottles * PER_BOTTLE)} />
        <Row icon={<IndianRupee size={20} />} label={tr("bonus", lang)} value={allDone ? inr(BONUS) : `— (${inr(BONUS)})`} />
      </div>
      {!allDone && <Link to="/rider" className="flex h-16 items-center justify-center rounded-2xl bg-neem text-xl font-bold text-white">{tr("next", lang)}</Link>}
    </div>
  );
}

function Row({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-lg">
      <span className="text-ink-3">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="font-bold tabular">{value}</span>
    </div>
  );
}

/** This week's pay, Monday to today, with the next payday. Earlier days are sample history. */
function WeekPay({ lang, today }: { lang: "en" | "mr" | "hi"; today: number }) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  const past = [262, 248, 281, 0, 270, 255, 266]; // Thursday was the weekly off
  const days = Array.from({ length: dow + 1 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (dow - i));
    return { label: d.toLocaleDateString(lang === "en" ? "en-IN" : lang === "mr" ? "mr-IN" : "hi-IN", { weekday: "short" }), amount: i === dow ? today : past[i]!, isToday: i === dow, off: i !== dow && past[i] === 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.amount));
  const total = days.reduce((s, d) => s + d.amount, 0);
  const payday = new Date(now);
  payday.setDate(now.getDate() + (7 - dow));
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-lg font-bold">{tr("thisWeek", lang)}</p>
        <p className="font-display text-3xl font-bold tabular">{inr(total)}</p>
      </div>
      <div className="mt-4 flex h-40 items-end gap-2" role="img" aria-label={`${tr("thisWeek", lang)}: ${inr(total)}`}>
        {days.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular text-ink-3">{d.off ? "—" : `₹${d.amount}`}</span>
            <div className={d.isToday ? "w-full rounded-t-lg bg-marigold" : "w-full rounded-t-lg bg-ink-2"} style={{ height: `${d.off ? 4 : Math.max(6, (d.amount / max) * 110)}px`, opacity: d.off ? 0.25 : 1 }} />
            <span className={d.isToday ? "text-sm font-bold" : "text-sm text-ink-soft"}>{d.isToday ? tr("today", lang) : d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-neem-soft p-3 text-center font-semibold text-neem-deep">
        {tr("payday", lang)}: {payday.toLocaleDateString(lang === "en" ? "en-IN" : lang === "mr" ? "mr-IN" : "hi-IN", { weekday: "long", day: "numeric", month: "long" })}
      </p>
    </div>
  );
}
