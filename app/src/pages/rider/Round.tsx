import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Check, Phone, Navigation, TriangleAlert, Thermometer, Undo2, ChevronDown, Megaphone, PartyPopper, StickyNote, Recycle } from "lucide-react";
import { useStore, kindLabel } from "../../store/useStore";
import { productById, products, routeById, riderById } from "../../data/seed";
import type { ExceptionKind, Stop } from "../../data/types";
import { clock, timeAgo } from "../../lib/format";
import { Badge, Button, Card, CardHead, Field, Modal, Progress, Segmented, Stepper, inputCls } from "../../components/ui";
import { ProductArt } from "../../components/ProductArt";
import { toast } from "../../store/toast";

const ROUTE = "r4";

export default function RiderRound() {
  const stops = useStore((s) => s.stops.filter((x) => x.routeId === ROUTE).sort((a, b) => a.seq - b.seq));
  const customers = useStore((s) => s.customers);
  const notices = useStore((s) => s.notices.filter((n) => n.role === "rider"));
  const deliver = useStore((s) => s.deliver);
  const undo = useStore((s) => s.undoStop);
  const [tab, setTab] = useState<"todo" | "done" | "issues">("todo");
  const [flagging, setFlagging] = useState<Stop | null>(null);
  const [bottles, setBottles] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const route = routeById[ROUTE]!;
  const rider = riderById[route.riderId]!;
  const done = stops.filter((s) => s.status === "delivered").length;
  const issues = stops.filter((s) => s.status === "issue");
  const pending = stops.filter((s) => s.status === "pending");
  const next = pending[0];
  const pct = (100 * (done + issues.length)) / stops.length;
  const cust = (id: string) => customers.find((c) => c.id === id)!;

  const stock = useMemo(() => {
    return products
      .map((p) => {
        const loaded = stops.reduce((s, st) => s + (st.items.find((i) => i.productId === p.id)?.qty ?? 0), 0);
        const left = stops.filter((st) => st.status !== "delivered").reduce((s, st) => s + (st.items.find((i) => i.productId === p.id)?.qty ?? 0), 0);
        return { p, loaded: loaded + (loaded ? 2 : 0), left: left + (loaded ? 2 : 0) };
      })
      .filter((x) => x.loaded > 0);
  }, [stops]);
  const due = stops.reduce((s, x) => s + x.bottlesDue, 0);
  const got = stops.reduce((s, x) => s + x.bottlesCollected, 0);

  const doDeliver = (st: Stop) => {
    deliver(st.id, bottles[st.id] ?? st.bottlesDue);
    const c = cust(st.customerId);
    toast(`Delivered to ${c.flat}, ${c.society}.`, "good", { label: "Undo", run: () => undo(st.id) });
    setExpanded(null);
  };

  const list = tab === "todo" ? pending : tab === "done" ? stops.filter((s) => s.status === "delivered").reverse() : issues;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {/* Header */}
        <div className="rounded-3xl bg-ink p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/60">Route {route.code}, {route.window}</p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{route.name}</h1>
              <p className="mt-1 text-sm text-white/70">{rider.name} on {route.van}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm"><Thermometer size={15} className="text-[#9DD9F3]" /> {route.tempC}°C in the crate</span>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span><b className="font-display text-2xl tabular">{done}</b> <span className="text-white/60">of {stops.length} doors done</span></span>
              <span className="text-white/60">{pending.length} left{issues.length ? `, ${issues.length} flagged` : ""}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-marigold transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>

        {/* Next stop */}
        {next ? (
          <NextStop stop={next} c={cust(next.customerId)} bottles={bottles[next.id] ?? next.bottlesDue} setBottles={(n) => setBottles((b) => ({ ...b, [next.id]: n }))} onDeliver={() => doDeliver(next)} onFlag={() => setFlagging(next)} />
        ) : (
          <Card className="p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-marigold-soft text-marigold-deep"><PartyPopper size={26} /></span>
            <p className="mt-4 font-display text-2xl font-bold">Round complete</p>
            <p className="mt-1 text-ink-soft">All {stops.length} doors handled. Head back to the hub with {got} empties.</p>
            <Link to="/rider/summary"><Button className="mt-5">See shift summary</Button></Link>
          </Card>
        )}

        {/* List */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <h2 className="font-display text-lg font-semibold">Drop list</h2>
            <Segmented value={tab} onChange={setTab} options={[{ value: "todo", label: `To do ${pending.length}` }, { value: "done", label: `Done ${done}` }, { value: "issues", label: `Flagged ${issues.length}` }]} />
          </div>
          <ul className="mt-3 divide-y divide-milk-2 px-2 pb-2">
            {list.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-soft">{tab === "issues" ? "No problems flagged. Nice." : tab === "done" ? "Nothing delivered yet." : "Every door is done."}</li>}
            {list.map((st) => {
              const c = cust(st.customerId);
              const open = expanded === st.id;
              return (
                <li key={st.id}>
                  <button onClick={() => setExpanded(open ? null : st.id)} aria-expanded={open} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-milk">
                    <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold tabular", st.status === "delivered" ? "bg-neem-soft text-neem-deep" : st.status === "issue" ? "bg-brick-soft text-brick" : st === next ? "bg-marigold text-ink" : "bg-milk-2 text-ink-3")}>
                      {st.status === "delivered" ? <Check size={16} /> : st.seq}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.flat}, {c.society}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {st.items.map((i) => `${i.qty} ${productById[i.productId]!.name.split(" ").slice(-2).join(" ")}`).join(", ")}
                        {st.at && `, at ${clock(st.at)}`}
                      </span>
                    </span>
                    {st.status === "issue" && <Badge tone="bad">{st.issueNote}</Badge>}
                    <ChevronDown size={16} className={clsx("shrink-0 text-ink-soft transition", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="mx-3 mb-3 animate-fade rounded-xl bg-milk p-3 text-sm">
                      <p className="flex gap-2"><StickyNote size={15} className="mt-0.5 shrink-0 text-ink-soft" />{c.dropNote}</p>
                      <p className="mt-2 text-ink-soft">{c.contact}, {c.phone}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {st.status === "pending" && <Button size="sm" onClick={() => doDeliver(st)} icon={<Check size={14} />}>Delivered</Button>}
                        {st.status === "pending" && <Button size="sm" variant="danger" onClick={() => setFlagging(st)}>Problem</Button>}
                        {st.status !== "pending" && <Button size="sm" variant="outline" icon={<Undo2 size={14} />} onClick={() => { undo(st.id); toast("Stop moved back to your to-do list.", "info"); }}>Undo</Button>}
                        <a href={`tel:${c.phone.replace(/\s/g, "")}`}><Button size="sm" variant="soft" icon={<Phone size={14} />}>Call</Button></a>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Side */}
      <div className="space-y-5">
        <Card>
          <CardHead title="Crate stock" sub="Counts down as you deliver. Two spares of each item." />
          <ul className="space-y-3 p-5">
            {stock.map(({ p, loaded, left }) => (
              <li key={p.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{p.name}</span><span className="tabular text-ink-soft"><b className="text-ink">{left}</b> of {loaded}</span></div>
                <Progress value={(left / loaded) * 100} color={left <= 2 ? "#C2410C" : "#14213D"} height={6} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-neem-soft text-neem"><Recycle size={20} /></span>
            <div>
              <p className="text-sm text-ink-soft">Empty bottles collected</p>
              <p className="font-display text-2xl font-bold tabular">{got} <span className="text-base font-normal text-ink-soft">of {due} expected</span></p>
            </div>
          </div>
          <Progress className="mt-4" value={due ? (got / due) * 100 : 0} />
        </Card>
        <Card>
          <CardHead title="From the hub" />
          <ul className="space-y-2 p-5 pt-3">
            {notices.length === 0 && <li className="text-sm text-ink-soft">No messages this morning.</li>}
            {notices.slice(0, 5).map((n) => (
              <li key={n.id} className="flex gap-3 rounded-xl bg-milk p-3 text-sm">
                <Megaphone size={16} className="mt-0.5 shrink-0 text-marigold-deep" />
                <span><span className="block">{n.text}</span><span className="text-xs text-ink-soft">{timeAgo(n.at)}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <FlagModal stop={flagging} onClose={() => setFlagging(null)} />
    </div>
  );
}

function NextStop({ stop, c, bottles, setBottles, onDeliver, onFlag }: { stop: Stop; c: ReturnType<typeof useStore.getState>["customers"][number]; bottles: number; setBottles: (n: number) => void; onDeliver: () => void; onFlag: () => void }) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.society}, ${c.area}, Chhatrapati Sambhajinagar`)}`;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-marigold px-5 py-2.5 text-sm font-semibold text-ink">
        <span>Next door, stop {stop.seq}</span>
        <span className="tabular">{c.id === "c-001" ? "Deshmukh family" : c.name}</span>
      </div>
      <div className="p-5">
        <p className="font-display text-3xl font-bold tracking-tight">{c.flat}</p>
        <p className="text-lg text-ink-3">{c.society}</p>
        <div className="mt-4 flex gap-3 overflow-x-auto">
          {stop.items.map((i) => {
            const p = productById[i.productId]!;
            return (
              <div key={i.productId} className="flex shrink-0 items-center gap-2 rounded-2xl bg-milk py-2 pl-2 pr-4">
                <ProductArt product={p} size={44} />
                <span><span className="block font-display text-xl font-bold leading-none">{i.qty}×</span><span className="text-xs text-ink-soft">{p.name}</span></span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 flex gap-2 rounded-xl bg-[#FFF8E6] p-3 text-sm"><StickyNote size={16} className="mt-0.5 shrink-0 text-marigold-deep" />{c.dropNote}</p>
        {stop.bottlesDue > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-milk-2 p-3">
            <span className="text-sm"><b>Collect empties</b><span className="block text-ink-soft">{stop.bottlesDue} expected</span></span>
            <Stepper label="empty bottles" value={bottles} max={8} onChange={setBottles} />
          </div>
        )}
        <div className="mt-5 grid grid-cols-[1fr_auto_auto_auto] gap-2">
          <Button size="lg" variant="primary" icon={<Check size={18} />} onClick={onDeliver}>Delivered</Button>
          <a href={maps} target="_blank" rel="noreferrer" aria-label="Directions"><Button size="lg" variant="soft" className="w-12 px-0"><Navigation size={18} /></Button></a>
          <a href={`tel:${c.phone.replace(/\s/g, "")}`} aria-label={`Call ${c.contact}`}><Button size="lg" variant="soft" className="w-12 px-0"><Phone size={18} /></Button></a>
          <Button size="lg" variant="danger" className="w-12 px-0" aria-label="Report a problem" onClick={onFlag}><TriangleAlert size={18} /></Button>
        </div>
      </div>
    </Card>
  );
}

const riderKinds: ExceptionKind[] = ["access", "missing", "leak", "seal"];
function FlagModal({ stop, onClose }: { stop: Stop | null; onClose: () => void }) {
  const flag = useStore((s) => s.flagStop);
  const [kind, setKind] = useState<ExceptionKind>("access");
  const [note, setNote] = useState("");
  return (
    <Modal open={!!stop} onClose={onClose} title="What's the problem?"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { flag(stop!.id, kind, note); toast("Flagged. The hub team can see it now.", "warn"); setNote(""); onClose(); }}>Flag and move on</Button></>}>
      <div className="grid grid-cols-2 gap-2">
        {riderKinds.map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={clsx("rounded-xl border p-3 text-left text-sm font-semibold", kind === k ? "border-ink bg-ink text-white" : "border-milk-3")}>{kindLabel[k]}</button>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Note for the hub (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gate locked, watchman not around" className={inputCls} /></Field>
      </div>
    </Modal>
  );
}
