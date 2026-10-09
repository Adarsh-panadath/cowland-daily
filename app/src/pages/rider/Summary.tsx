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
