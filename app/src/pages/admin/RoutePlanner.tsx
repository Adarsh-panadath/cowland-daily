import { useMemo, useState } from "react";
import clsx from "clsx";
import { Route as RouteIcon, Info, Check } from "lucide-react";
import { useStore } from "../../store/useStore";
import { routeById } from "../../data/seed";
import { PLAN_ASSUMPTIONS, planRoute, windowOf, type Pt } from "../../lib/routePlan";
import { Badge, Button, Card, CardHead, Segmented } from "../../components/ui";
import { toast } from "../../store/toast";

const hhmm = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return `${h > 12 ? h - 12 : h}:${String(mm).padStart(2, "0")} AM`;
};

export function RoutePlanner({ routeId }: { routeId: string }) {
  const route = routeById[routeId]!;
  const allStops = useStore((s) => s.stops);
  const customers = useStore((s) => s.customers);
  const nextSeq = useStore((s) => s.nextSeq);
  const apply = useStore((s) => s.applyRouteOrder);
  const [show, setShow] = useState<"suggested" | "current">("suggested");
  const stops = useMemo(() => allStops.filter((x) => x.routeId === routeId && x.status !== "held"), [allStops, routeId]);
  const plan = useMemo(() => planRoute(stops, customers, route), [stops, customers, route]);
  const started = stops.some((x) => x.status === "delivered" || x.status === "issue");
  const savedForTomorrow = started && plan.suggested.length > 0 && plan.suggested.every((s, i) => nextSeq[s.customerId] === i + 1);
  const [, close] = windowOf(route);
  const { before: b, after: a } = plan;

  if (stops.length < 3) return null;

  const rows = [
    { k: "Driving time", b: `${Math.round(b.driveMin)} min`, a: `${Math.round(a.driveMin)} min`, d: Math.round(b.driveMin - a.driveMin), unit: "min less" },
    { k: "Distance", b: `${b.km.toFixed(1)} km`, a: `${a.km.toFixed(1)} km`, d: +(b.km - a.km).toFixed(1), unit: "km less" },
    { k: "Last drop", b: hhmm(b.finishMin), a: hhmm(a.finishMin), d: Math.round(b.finishMin - a.finishMin), unit: "min earlier" },
    { k: `Drops after ${hhmm(close)}`, b: String(b.late), a: String(a.late), d: b.late - a.late, unit: "fewer late" },
  ];

  return (
    <Card>
      <CardHead
        title={<span className="flex items-center gap-2"><RouteIcon size={18} /> Route planner</span>}
        sub={`An illustrative model: it reorders Route ${route.code}'s stops to cut driving time and distance, scoring the current and suggested order with the same travel model. Van capacity isn't checked yet.`}
        right={<Badge tone="neutral">Illustrative model</Badge>}
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Segmented value={show} onChange={setShow} options={[{ value: "suggested", label: "Suggested" }, { value: "current", label: "Current" }]} />
            <span className="text-xs text-ink-soft">Positions are synthetic</span>
          </div>
          <PlanMap order={(show === "suggested" ? plan.suggested : plan.current).map((s) => plan.positions.get(s.customerId)!)} color={show === "suggested" ? route.color : "#8C93A8"} />
        </div>
        <div className="min-w-0">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-soft"><th className="py-2 font-medium" /><th className="py-2 text-right font-medium">Current</th><th className="py-2 text-right font-medium">Suggested</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {rows.map((r) => (
                <tr key={r.k}>
                  <td className="py-2.5 text-ink-soft">{r.k}</td>
                  <td className="py-2.5 text-right tabular">{r.b}</td>
                  <td className="py-2.5 text-right font-semibold tabular">{r.a}{r.d > 0 && <span className="block text-xs font-semibold text-neem-deep">{r.d} {r.unit}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            {savedForTomorrow ? (
              <p className="flex items-center gap-2 rounded-xl bg-neem-soft px-3 py-2.5 text-sm font-semibold text-neem-deep"><Check size={16} /> Saved. The rider gets this order on the next delivery morning.</p>
            ) : !plan.better ? (
              <p className="flex items-center gap-2 rounded-xl bg-milk px-3 py-2.5 text-sm text-ink-3"><Check size={16} /> The current order is already the shortest one the planner found.</p>
            ) : (
              <>
                <Button className="w-full" onClick={() => {
                  const r = apply(routeId, plan.suggested.map((s) => s.customerId));
                  toast(r === "now" ? `Route ${route.code} resequenced. The rider app shows the new order now.` : `Saved for the next delivery morning. Today's van has already started, so nobody's drop moves mid-run.`, "good");
                }}>{started ? "Use this order from the next morning" : "Apply to today's run"}</Button>
                {started && <p className="mt-2 text-xs text-ink-soft">The van has started today's run, so the change waits for the next morning.</p>}
              </>
            )}
          </div>
          <details className="mt-4 text-xs text-ink-soft">
            <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-ink-3"><Info size={13} /> How this is worked out</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Homes have made-up map positions grouped by society. A real version would use geocoded addresses and a road-distance service.</li>
              <li>Travel time is straight-line distance × {PLAN_ASSUMPTIONS.roadFactor} at {PLAN_ASSUMPTIONS.speedKmh} km/h. Each door takes {PLAN_ASSUMPTIONS.serviceMin} min, plus {PLAN_ASSUMPTIONS.perItemMin} min per extra item.</li>
              <li>The van leaves the hub {PLAN_ASSUMPTIONS.leaveBeforeWindowMin} min before the {route.window} window. Late means after the window closes.</li>
              <li>Order found with nearest-neighbour, then 2-opt swaps. The objective is driving time only; late drops are reported but not optimised for. Held orders are left out because they aren't on the van.</li>
              <li>Not yet modelled: van capacity (crates, litres), traffic, one-way streets and customers' preferred drop times.</li>
            </ul>
          </details>
        </div>
      </div>
    </Card>
  );
}

function PlanMap({ order, color }: { order: Pt[]; color: string }) {
  const all = [{ x: 0, y: 0 }, ...order];
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const W = 420, H = 260, pad = 22;
  const sc = Math.min((W - pad * 2) / Math.max(0.1, maxX - minX), (H - pad * 2) / Math.max(0.1, maxY - minY));
  const P = (p: Pt) => ({ x: pad + (p.x - minX) * sc, y: H - pad - (p.y - minY) * sc });
  const hub = P({ x: 0, y: 0 });
  const pts = order.map(P);
  const d = [`M ${hub.x} ${hub.y}`, ...pts.map((p) => `L ${p.x} ${p.y}`)].join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-2xl bg-[#F6F7F9]" role="img" aria-label="Stop order on an illustrative map">
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="9" fill="#fff" stroke={color} strokeWidth="2" />
          <text x={p.x} y={p.y + 3.5} textAnchor="middle" className={clsx("fill-ink text-[9px] font-bold")}>{i + 1}</text>
        </g>
      ))}
      <g transform={`translate(${hub.x - 11} ${hub.y - 11})`}><rect width="22" height="22" rx="6" fill="#14213D" /><path d="M5 16v-6l6-4 6 4v6z" fill="#F2A900" /></g>
    </svg>
  );
}
