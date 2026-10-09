import { useMemo, useState } from "react";
import clsx from "clsx";
import { Download, MapPinned, Users, Droplets, IndianRupee } from "lucide-react";
import { useStore } from "../../store/useStore";
import { areas, WAITLIST_THRESHOLD } from "../../data/areas";
import { productById, routes, societies } from "../../data/seed";
import { extraMinutesFor, PLAN_ASSUMPTIONS } from "../../lib/routePlan";
import { lineTotal } from "../../store/rules";
import { inr, num, timeAgo } from "../../lib/format";
import { Badge, Button, Card, CardHead, Empty } from "../../components/ui";

/** A litre of A2 milk at today's bottle price (two 500 ml bottles). */
const PER_LITRE = productById.a2!.price * 2;

export default function Demand() {
  const waitlist = useStore((s) => s.waitlist);
  const stops = useStore((s) => s.stops);
  const customers = useStore((s) => s.customers);
  const shares = useStore((s) => s.shares);

  // Where one more home costs the van the least: societies already on a route
  const fill = useMemo(() => {
    const rows: { society: string; route: string; homes: number; minutes: number; perHome: number; invites: number }[] = [];
    for (const r of routes) {
      const onVan = stops.filter((x) => x.routeId === r.id && x.status !== "held");
      if (!onVan.length) continue;
      const perHome = onVan.reduce((a, x) => a + lineTotal(x.items), 0) / onVan.length;
      for (const soc of societies[r.id]!) {
        const homes = customers.filter((c) => c.routeId === r.id && c.society === soc && c.status === "active").length;
        rows.push({ society: soc, route: r.code, homes, minutes: extraMinutesFor(onVan, customers, soc, r.id), perHome, invites: shares.filter((x) => x.society === soc && x.routeId === r.id).length });
      }
    }
    return rows.sort((a, b) => a.minutes - b.minutes);
  }, [stops, customers, shares]);
  const [showAll, setShowAll] = useState(false);
  const unserved = areas.filter((a) => !a.route);

  const byArea = useMemo(() => {
    const names = new Set([...unserved.map((a) => a.name), ...waitlist.map((w) => w.area)]);
    return [...names]
      .map((name) => {
        const list = waitlist.filter((w) => w.area === name);
        const litres = list.reduce((s, w) => s + w.litres, 0);
        return { name, homes: list.length, litres, fresh: list.filter((w) => !w.sample).length, perDay: litres * PER_LITRE };
      })
      .sort((a, b) => b.homes - a.homes);
  }, [waitlist, unserved]);

  const total = waitlist.length;
  const litres = waitlist.reduce((s, w) => s + w.litres, 0);
  const recent = waitlist.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);

  const exportCsv = () => {
    const rows = [["Name", "Mobile", "Area", "Litres a day", "Joined", "Source"], ...waitlist.map((w) => [w.name, w.mobile, w.area, String(w.litres), w.at.slice(0, 10), w.sample ? "Sample" : "Website"])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cowland-waitlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Demand</h1>
          <p className="text-ink-soft">Where the next customers should come from: buildings the vans already pass, then areas on the waitlist.</p>
        </div>
        <Button variant="outline" icon={<Download size={16} />} onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: <Users size={18} />, label: "Households waiting", value: num(total) },
          { icon: <Droplets size={18} />, label: "Milk asked for", value: `${num(litres, 1)} L a day` },
          { icon: <IndianRupee size={18} />, label: "If they all joined", value: `${inr(litres * PER_LITRE)} a day`, sub: `At ${inr(PER_LITRE)} a litre of A2` },
          { icon: <MapPinned size={18} />, label: "Areas over the bar", value: String(byArea.filter((a) => a.homes >= WAITLIST_THRESHOLD).length), sub: `Bar is ${WAITLIST_THRESHOLD} homes (illustrative)` },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-ink-soft">{k.label}</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-milk-2 text-ink-3">{k.icon}</span></div>
            <p className="mt-2 font-display text-3xl font-bold tabular">{k.value}</p>
            {k.sub && <p className="text-sm text-ink-soft">{k.sub}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <CardHead
          title="Fill the vans first"
          sub="A home in a building the van already visits adds about a minute and a half to the run. A home in a new area needs a whole new van. Canvass these buildings first."
          right={<Badge>Illustrative travel model</Badge>}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">Building</th><th className="px-3 py-2.5">Route</th><th className="px-3 py-2.5 text-right">Homes now</th><th className="px-3 py-2.5 text-right">Van minutes for one more</th><th className="px-3 py-2.5 text-right">Typical order a day</th><th className="px-5 py-2.5 text-right">Invites shared</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {(showAll ? fill : fill.slice(0, 8)).map((r) => (
                <tr key={r.route + r.society}>
                  <td className="px-5 py-2.5 font-semibold">{r.society}</td>
                  <td className="px-3 py-2.5 tabular">{r.route}</td>
                  <td className="px-3 py-2.5 text-right tabular">{r.homes}</td>
                  <td className="px-3 py-2.5 text-right tabular">{r.minutes.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{inr(r.perHome)}</td>
                  <td className="px-5 py-2.5 text-right tabular">{r.invites || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-ink-soft">
          <span>Minutes use the route planner's model: synthetic positions, {PLAN_ASSUMPTIONS.speedKmh} km/h, {PLAN_ASSUMPTIONS.serviceMin} min at the door. Invites come from customers' "Share an invite" button; there's no reward attached.</span>
          {fill.length > 8 && <button onClick={() => setShowAll(!showAll)} className="font-semibold text-ink underline">{showAll ? "Show fewer" : `Show all ${fill.length}`}</button>}
        </div>
      </Card>

      <Card>
        <CardHead title="By area" sub={`A new route is worth planning at about ${WAITLIST_THRESHOLD} homes. That bar is an illustrative number; set it from the van's cost per morning and margin per home.`} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-y border-milk-2 bg-milk text-left text-ink-soft"><th className="px-5 py-2.5">Area</th><th className="px-3 py-2.5 text-right">Homes</th><th className="px-3 py-2.5 text-right">Litres a day</th><th className="px-3 py-2.5 text-right">Milk value a day</th><th className="w-[28%] px-5 py-2.5">Towards {WAITLIST_THRESHOLD}</th></tr></thead>
            <tbody className="divide-y divide-milk-2">
              {byArea.map((a) => {
                const pct = Math.min(100, (a.homes / WAITLIST_THRESHOLD) * 100);
                return (
                  <tr key={a.name}>
                    <td className="px-5 py-3 font-semibold">{a.name}{a.fresh > 0 && <Badge tone="good" className="ml-2">{a.fresh} new</Badge>}</td>
                    <td className="px-3 py-3 text-right tabular">{a.homes}</td>
                    <td className="px-3 py-3 text-right tabular">{num(a.litres, 1)}</td>
                    <td className="px-3 py-3 text-right tabular">{inr(a.perDay)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-milk-2"><div className={clsx("h-full rounded-full", pct >= 100 ? "bg-neem" : "bg-marigold")} style={{ width: `${pct}%` }} /></div>
                        <span className="w-10 text-right text-xs tabular text-ink-soft">{Math.round(pct)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead title="Latest sign-ups" sub="Entries marked Sample came with the demo. Anything you add from the home page appears here straight away." />
        {recent.length === 0 ? <Empty icon={<Users size={20} />} title="No one waiting" body="Add yourself from the area checker on the home page." /> : (
          <ul className="divide-y divide-milk-2 px-5 py-2 text-sm">
            {recent.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><b>{w.name}</b> <span className="text-ink-soft">{w.area}, {w.litres} L a day</span></span>
                <span className="flex items-center gap-2 text-ink-soft">{w.sample ? <Badge>Sample</Badge> : <Badge tone="good">Website</Badge>}{timeAgo(w.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
