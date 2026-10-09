import { useMemo, useState } from "react";
import clsx from "clsx";
import { Phone, Thermometer, Clock3, Warehouse } from "lucide-react";
import { useStore } from "../../store/useStore";
import { productById, riderById } from "../../data/seed";
import type { Stop } from "../../data/types";
import { Avatar, Badge, Card, CardHead, Progress } from "../../components/ui";
import { NextMorningButton, SimToggle, routeStats } from "./shared";
import { RoutePlanner } from "./RoutePlanner";
import { CallSheet } from "../../components/CallSheet";
import { clock, initials } from "../../lib/format";

function snake(n: number) {
  // lay stops out along a serpentine "street" so the run reads left-to-right like a map
  const perRow = Math.ceil(n / 3);
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = 70 + (col / Math.max(1, perRow - 1)) * 500;
    return { x: row % 2 === 0 ? x : 640 - x, y: 50 + row * 75 + Math.sin(i * 1.7) * 8 };
  });
}

function RouteMap({ stops, color, onPick, picked }: { stops: Stop[]; color: string; onPick: (id: string) => void; picked: string | null }) {
  const pts = useMemo(() => snake(stops.length), [stops.length]);
  const lastDone = stops.reduce((m, s, i) => (s.status !== "pending" ? i : m), -1);
  const van = pts[Math.min(stops.length - 1, lastDone + 1)] ?? pts[0]!;
  const d = ["M 20 50", ...pts.map((p) => `L ${p.x} ${p.y}`)].join(" ");
  const doneD = ["M 20 50", ...pts.slice(0, lastDone + 1).map((p) => `L ${p.x} ${p.y}`)].join(" ");
  return (
    <svg viewBox="0 0 660 230" className="h-auto w-full" role="img" aria-label="Route map with stops">
      <rect width="660" height="230" rx="18" fill="#F6F7F9" />
      {[40, 120, 200].map((y) => <path key={y} d={`M0 ${y + 20} H660`} stroke="#ECEEF3" strokeWidth="14" />)}
      <path d={d} fill="none" stroke="#DDE1EA" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={doneD} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(8 38)"><rect width="24" height="24" rx="6" fill="#14213D" /><path d="M6 17v-6l6-4 6 4v6z" fill="#F2A900" /></g>
      {stops.map((s, i) => {
        const p = pts[i]!;
        const fill = s.status === "delivered" ? color : s.status === "issue" ? "#C2410C" : "#fff";
        return (
          <g key={s.id} onClick={() => onPick(s.id)} className="cursor-pointer" role="button" aria-label={`Stop ${s.seq}`}>
            <circle cx={p.x} cy={p.y} r={picked === s.id ? 11 : 8} fill={fill} stroke={s.status === "pending" ? "#4A5784" : "#fff"} strokeWidth="2.5" />
            {picked === s.id && <circle cx={p.x} cy={p.y} r="16" fill="none" stroke="#14213D" strokeWidth="1.5" strokeDasharray="3 3" />}
          </g>
        );
      })}
      {lastDone < stops.length - 1 && (
        <g style={{ transform: `translate(${van.x - 14}px, ${van.y - 34}px)`, transition: "transform .7s cubic-bezier(.2,.8,.2,1)" }}>
          <rect width="28" height="18" rx="5" fill="#14213D" />
          <rect x="4" y="4" width="12" height="6" rx="2" fill="#F2A900" />
          <path d="M10 18 l4 6 l4 -6z" fill="#14213D" />
        </g>
      )}
    </svg>
  );
}

export default function LiveRoutes() {
  const stops = useStore((s) => s.stops);
  const customers = useStore((s) => s.customers);
  const rs = routeStats(stops);
  const [sel, setSel] = useState("r4");
  const [picked, setPicked] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const shift = useStore((s) => s.shift);
  const cur = rs.find((r) => r.route.id === sel)!;
  const rider = riderById[cur.route.riderId]!;
  const rStops = stops.filter((s) => s.routeId === sel && s.status !== "held").sort((a, b) => a.seq - b.seq);
  const held = stops.filter((s) => s.routeId === sel && s.status === "held");
  const pickedStop = rStops.find((s) => s.id === picked);
  const cust = (id: string) => customers.find((c) => c.id === id)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Live routes</h1>
          <p className="text-ink-soft">Pick a route to follow the van. Route 04 moves when you deliver from the rider app.</p>
        </div>
        <div className="flex flex-wrap gap-2"><NextMorningButton /><SimToggle /></div>
      </div>

      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
        {rs.map((r) => (
          <button key={r.route.id} onClick={() => { setSel(r.route.id); setPicked(null); }} aria-pressed={sel === r.route.id}
            className={clsx("w-56 shrink-0 rounded-2xl p-4 text-left transition sm:w-auto", sel === r.route.id ? "bg-ink text-white shadow-pop" : "bg-white shadow-lift hover:-translate-y-0.5")}>
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-bold">{r.route.code}</span>
              <span className="h-3 w-3 rounded-full" style={{ background: r.route.color }} />
            </div>
            <p className={clsx("truncate text-sm", sel === r.route.id ? "text-white/70" : "text-ink-soft")}>{r.route.name}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${r.pct}%`, background: r.route.color }} /></div>
            <p className={clsx("mt-2 text-xs font-semibold", sel === r.route.id ? "text-white/80" : "text-ink-3")}>{r.done ? "Finished" : `${r.remaining} doors left, ETA ${clock(r.eta)}`}{r.held ? `, ${r.held} held` : ""}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHead title={`Route ${cur.route.code}, ${cur.route.name}`} sub={`${cur.delivered} delivered, ${cur.issues} flagged, ${cur.remaining} to go`} right={cur.done ? <Badge tone="good">Finished</Badge> : <Badge tone="warn" dot>On the road</Badge>} />
          <div className="p-5"><RouteMap stops={rStops} color={cur.route.color} onPick={setPicked} picked={picked} /></div>
          <div className="flex flex-wrap gap-4 px-5 pb-5 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: cur.route.color }} /> Delivered</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-ink-3 bg-white" /> Still to go</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-brick" /> Problem flagged</span>
            <span className="flex items-center gap-1.5"><Warehouse size={13} /> Hub</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar text={initials(rider.name)} color={cur.route.color} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{rider.name}</p>
                <p className="text-sm text-ink-soft">{rider.vehicle}, rated {rider.rating}</p>
              </div>
              <button onClick={() => setCalling(true)} aria-label={`Call ${rider.name}`} className="grid h-10 w-10 place-items-center rounded-xl bg-milk-2 text-ink hover:bg-milk-3"><Phone size={17} /></button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-milk p-3"><dt className="flex items-center gap-1 text-ink-soft"><Thermometer size={13} /> Crate</dt><dd className="font-display text-xl font-bold">{cur.route.tempC}°C</dd></div>
              <div className="rounded-xl bg-milk p-3"><dt className="flex items-center gap-1 text-ink-soft"><Clock3 size={13} /> Window</dt><dd className="font-semibold">{cur.route.window}</dd></div>
            </dl>
            {cur.route.id === "r4" && (
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex justify-between"><span className="text-ink-soft">Crate check</span><span className="font-semibold">{shift.loadedAt ? `${clock(shift.loadedAt)}, ${shift.short.length ? `${shift.short.length} item${shift.short.length > 1 ? "s" : ""} short` : "full"}` : "Not loaded yet"}</span></li>
                <li className="flex justify-between"><span className="text-ink-soft">Handover</span><span className="font-semibold">{shift.handedOverAt ? `${clock(shift.handedOverAt)}, ${shift.returnedBottles} bottles` : "Still on route"}</span></li>
              </ul>
            )}
            <Progress className="mt-4" value={(cur.litresDone / cur.litresPlanned) * 100} color={cur.route.color} />
            <p className="mt-1.5 text-xs text-ink-soft">{cur.litresDone.toFixed(1)} of {cur.litresPlanned.toFixed(1)} litres delivered</p>
          </Card>

          <Card className="p-5">
            {pickedStop ? (() => {
              const c = cust(pickedStop.customerId);
              return (
                <div className="animate-fade">
                  <p className="text-sm text-ink-soft">Stop {pickedStop.seq}</p>
                  <p className="font-display text-xl font-semibold">{c.flat}, {c.society}</p>
                  <p className="text-sm text-ink-soft">{c.contact}</p>
                  <ul className="mt-3 space-y-1 text-sm">{pickedStop.items.map((i) => <li key={i.productId}>{i.qty} × {productById[i.productId]!.name}</li>)}</ul>
                  <p className="mt-3 text-sm">{pickedStop.status === "delivered" ? `Delivered at ${clock(pickedStop.at!)}, ${pickedStop.bottlesCollected} empties back` : pickedStop.status === "issue" ? `Flagged: ${pickedStop.issueNote}` : "Not reached yet"}</p>
                </div>
              );
            })() : <p className="text-sm text-ink-soft">Tap a stop on the map to see who lives there and what they ordered.</p>}
          </Card>
        </div>
      </div>

      {held.length > 0 && (
        <Card>
          <CardHead title={`Held on Route ${cur.route.code}: ${held.length}`} sub="Wallet below the morning's order, so these stay at the hub and aren't charged. They go out once the customer tops up and the next run is built." />
          <ul className="divide-y divide-milk-2 px-5 py-2 text-sm">
            {held.map((h) => {
              const c = cust(h.customerId);
              return (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span><b>{c.flat}, {c.society}</b> <span className="text-ink-soft">{c.contact}</span></span>
                  <span className="text-ink-soft">{h.holdReason}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <RoutePlanner routeId={sel} />

      <CallSheet name={calling ? rider.name : null} sub={`Route ${cur.route.code}, ${rider.vehicle}`} color={cur.route.color} onClose={() => setCalling(false)} />
      <Card>
        <CardHead title="Stop sequence" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">#</th><th className="px-3 py-2.5">Home</th><th className="px-3 py-2.5">Order</th><th className="px-3 py-2.5">Status</th><th className="px-5 py-2.5 text-right">Empties</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {rStops.map((s) => {
                const c = cust(s.customerId);
                return (
                  <tr key={s.id} onClick={() => setPicked(s.id)} className={clsx("cursor-pointer hover:bg-milk/60", picked === s.id && "bg-marigold-soft/50")}>
                    <td className="px-5 py-2.5 tabular text-ink-soft">{s.seq}</td>
                    <td className="px-3 py-2.5 font-semibold">{c.flat}, {c.society}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{s.items.map((i) => `${i.qty} ${productById[i.productId]!.name}`).join(", ")}</td>
                    <td className="px-3 py-2.5">{s.status === "delivered" ? <Badge tone="good">{clock(s.at!)}</Badge> : s.status === "issue" ? <Badge tone="bad">{s.issueNote}</Badge> : <Badge>Pending</Badge>}</td>
                    <td className="px-5 py-2.5 text-right tabular">{s.status === "delivered" ? `${s.bottlesCollected}/${s.bottlesDue}` : s.bottlesDue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
