import { Link } from "react-router-dom";
import clsx from "clsx";
import { Activity } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Actor } from "../data/types";
import { clock, inr } from "../lib/format";
import { Badge, Card } from "./ui";

const tone: Record<Actor, "good" | "accent" | "ink" | "neutral"> = { customer: "accent", rider: "good", hub: "ink", simulation: "neutral", system: "neutral" };

/** The latest clicks from every app, newest first. Updates live, including from other tabs. */
export function LiveActivity({ limit = 8 }: { limit?: number }) {
  const events = useStore((s) => s.events.slice(0, limit));
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Activity size={18} /> Live activity</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neem-soft px-2.5 py-0.5 text-xs font-semibold text-neem-deep"><span className="h-2 w-2 animate-pulse rounded-full bg-neem" /> Live</span>
      </div>
      <p className="px-5 text-sm text-ink-soft">What customers, riders and the hub are doing right now, from any tab.</p>
      <ul className="mt-3 divide-y divide-milk-2">
        {events.map((e, i) => (
          <li key={e.id} className={clsx("flex items-start gap-3 px-5 py-2.5 text-sm", i === 0 && "animate-fade")}>
            <span className="w-16 shrink-0 tabular text-xs text-ink-soft">{clock(e.at)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5"><Badge tone={tone[e.actor]}>{e.actor}</Badge><b className={clsx(e.blocked && "text-brick")}>{e.action}</b><span className="text-ink-soft">{e.who}</span></span>
              <span className="block truncate text-ink-3">{e.detail}</span>
            </span>
            {e.amount ? <span className={clsx("shrink-0 tabular font-semibold", e.amount > 0 ? "text-neem-deep" : "text-ink")}>{e.amount > 0 ? "+" : "−"}{inr(Math.abs(e.amount))}</span> : null}
          </li>
        ))}
      </ul>
      <div className="border-t border-milk-2 px-5 py-3 text-right">
        <Link to="/admin/data" className="text-sm font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-2">Open the database</Link>
      </div>
    </Card>
  );
}
