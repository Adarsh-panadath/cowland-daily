import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Check, Phone, MapPin, TriangleAlert, Volume2, Minus, Plus, DoorClosed, PackageX, Hand, MapPinOff, List, X, Undo2, Megaphone, PartyPopper, PackageCheck, Truck, Warehouse, Clock3, Recycle, Wallet, RotateCcw } from "lucide-react";
import { useStore, lineTotal, mergeItems, type RiderLang } from "../../store/useStore";
import { productById, products } from "../../data/seed";
import type { Customer, ExceptionKind, Stop } from "../../data/types";
import { ProductArt } from "../../components/ProductArt";
import { CallSheet } from "../../components/CallSheet";
import { toast } from "../../store/toast";
import { tr, speechLang } from "../../lib/riderText";
import { SPARES_PER_ITEM, packedItems, sparesLeft } from "../../store/rules";
import { demoAt } from "../../lib/format";

const ROUTE = "r4";

const noteTr: Record<string, { mr: string; hi: string }> = {
  "Hang the bag on the door latch. Don't ring the bell.": { mr: "पिशवी दाराच्या कडीला लावा. बेल वाजवू नका.", hi: "थैला दरवाज़े की कुंडी पर टांग दें. घंटी न बजाएं." },
  "Leave in the blue cooler by the shoe rack.": { mr: "बुटांच्या कपाटाजवळच्या निळ्या कूलरमध्ये ठेवा.", hi: "जूतों की रैक के पास नीले कूलर में रखें." },
  "Watchman collects for the building — hand to him.": { mr: "इमारतीचा वॉचमन घेतो. त्याच्याकडे द्या.", hi: "बिल्डिंग का चौकीदार लेता है. उसे दे दें." },
  "Ring once softly after 6 AM.": { mr: "सकाळी ६ नंतर एकदाच हळू बेल वाजवा.", hi: "सुबह 6 बजे के बाद एक बार धीरे से घंटी बजाएं." },
  "Wire basket on the grill. Empties will be inside it.": { mr: "ग्रिलवरच्या टोपलीत ठेवा. रिकाम्या बाटल्या त्यातच असतील.", hi: "ग्रिल पर लगी टोकरी में रखें. खाली बोतलें उसी में होंगी." },
  "Elderly couple — please place on the stool, not the floor.": { mr: "वयस्कर जोडपं आहे. जमिनीवर नाही, स्टूलवर ठेवा.", hi: "बुज़ुर्ग दंपति हैं. ज़मीन पर नहीं, स्टूल पर रखें." },
  "Wire basket on the iron grill. Please don't ring before 6:30 AM.": { mr: "लोखंडी ग्रिलवरच्या टोपलीत ठेवा. ६:३० आधी बेल वाजवू नका.", hi: "लोहे की ग्रिल पर लगी टोकरी में रखें. 6:30 से पहले घंटी न बजाएं." },
};
const hiName: Record<string, string> = { a2: "गिर गाय का दूध", buff: "भैंस का दूध", toned: "टोंड दूध", dahi: "मटका दही", taak: "मसाला छाछ", paneer: "मलाई पनीर", ghee: "बिलोना घी", loni: "सफ़ेद मक्खन", shrikhand: "केसर श्रीखंड" };

const noteFor = (c: Customer, l: RiderLang) => (l === "en" ? c.dropNote : noteTr[c.dropNote]?.[l] ?? c.dropNote);
const itemName = (id: string, l: RiderLang) => (l === "mr" ? productById[id]!.mr : l === "hi" ? hiName[id] ?? productById[id]!.name : productById[id]!.name);

const problems: { kind: ExceptionKind; key: "doorLocked" | "itemBad" | "noWant" | "noAddress"; icon: JSX.Element; note: string }[] = [
  { kind: "access", key: "doorLocked", icon: <DoorClosed size={34} />, note: "Door locked, no bag outside" },
  { kind: "missing", key: "itemBad", icon: <PackageX size={34} />, note: "Item short or broken in the crate" },
  { kind: "access", key: "noWant", icon: <Hand size={34} />, note: "Customer said they don't want it today" },
  { kind: "access", key: "noAddress", icon: <MapPinOff size={34} />, note: "Couldn't find the home" },
];

export function LangSwitch() {
  const lang = useStore((s) => s.riderLang);
  const setLang = useStore((s) => s.setRiderLang);
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-milk-2 p-1" role="radiogroup" aria-label="Language">
      {([["en", "English"], ["mr", "मराठी"], ["hi", "हिंदी"]] as const).map(([v, l]) => (
        <button key={v} role="radio" aria-checked={lang === v} onClick={() => setLang(v)} className={clsx("rounded-xl py-2 text-sm font-semibold", lang === v ? "bg-white text-ink shadow-sm" : "text-ink-soft")}>{l}</button>
      ))}
    </div>
  );
}

export default function RiderRound() {
  const lang = useStore((s) => s.riderLang);
  // Held orders (wallet too low) never reach the rider's list; the hub sees them instead.
  const stops = useStore((s) => s.stops.filter((x) => x.routeId === ROUTE && x.status !== "held").sort((a, b) => a.seq - b.seq));
  const customers = useStore((s) => s.customers);
  const notices = useStore((s) => s.notices.filter((n) => n.role === "rider" && !n.read));
  const markRead = useStore((s) => s.markRead);
  const deliver = useStore((s) => s.deliver);
  const flag = useStore((s) => s.flagStop);
  const undo = useStore((s) => s.undoStop);
  const [bottles, setBottles] = useState<Record<string, number>>({});
  const [problemFor, setProblemFor] = useState<Stop | null>(null);
  const [partFor, setPartFor] = useState<Stop | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [calling, setCalling] = useState<{ name: string; sub?: string } | null>(null);
  const [crateOpen, setCrateOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const restartRound = useStore((s) => s.restartRound);
  const shift = useStore((s) => s.shift);
  const advanceDay = useStore((s) => s.advanceDay);

  const cust = (id: string) => customers.find((c) => c.id === id)!;
  const pending = stops.filter((s) => s.status === "pending");
  const handled = stops.length - pending.length;
  const next = pending[0];
  const c = next ? cust(next.customerId) : null;
  // a door that was locked on an earlier morning (not today's attempts)
  const lockedBefore = useStore((s) => !!next && s.exceptions.some((e) => e.customerId === next.customerId && e.source === "rider" && e.kind === "access" && e.createdAt < demoAt(4, 0).toISOString()));
  const got = stops.reduce((s, x) => s + x.bottlesCollected, 0);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const issues = stops.filter((s) => s.status === "issue").length;
  const delivered = stops.filter((s) => s.status === "delivered").length;

  // Route clock: the time of the last drop (or leaving the hub), projected forward at ~2.6 min a home.
  const lastAt = stops.map((s) => s.at).filter(Boolean).sort().at(-1);
  const clockMin = (() => {
    const d = lastAt ? new Date(lastAt) : shift.loadedAt ? new Date(new Date(shift.loadedAt).getTime() + 32 * 60000) : null;
    return d ? d.getHours() * 60 + d.getMinutes() : 315;
  })();
  const finishMin = Math.round(clockMin + pending.length * 2.6);
  const slack = 375 - finishMin;
  const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;


  const speak = () => {
    if (!c || !next) return;
    const items = next.items.map((i) => `${i.qty} ${itemName(i.productId, lang)}`).join(", ");
    const u = new SpeechSynthesisUtterance(`${c.flat}, ${c.society}. ${items}. ${noteFor(c, lang)}`);
    u.lang = speechLang[lang];
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  // What the rider is handing over at this door: starts at the order, − for short, + from the van's spares.
  const [give, setGiveMap] = useState<Record<string, Record<string, number>>>({});
  const giveOf = (pid: string, ordered: number) => (next ? give[next.id]?.[pid] ?? ordered : ordered);
  const setGive = (pid: string, n: number) => next && setGiveMap((g) => ({ ...g, [next.id]: { ...g[next.id], [pid]: Math.max(0, n) } }));
  const spareNow = useStore((s) => sparesLeft(s.stops, ROUTE));
  const walletNow = c?.wallet ?? 0;
  const canGiveMore = (pid: string, ordered: number) => {
    if (!next) return false;
    const g = giveOf(pid, ordered);
    if (g < ordered) return true;
    const extrasUsed = g - ordered;
    if (extrasUsed >= Math.max(0, spareNow[pid] ?? 0)) return false;
    const extras = next.items.map((i) => ({ productId: i.productId, qty: Math.max(0, giveOf(i.productId, i.qty) - i.qty) + (i.productId === pid ? 1 : 0) }));
    return lineTotal(mergeItems(next.items, extras)) <= walletNow;
  };
  const bottleCount = next ? bottles[next.id] ?? next.bottlesDue : 0;

  const doDeliver = () => {
    if (!next) return;
    const id = next.id;
    const given = next.items.map((i) => ({ productId: i.productId, qty: giveOf(i.productId, i.qty) }));
    if (given.every((g) => g.qty === 0)) { setProblemFor(next); return; }
    deliver(id, bottleCount, given);
    toast(`✓ ${c!.flat} · ${bottleCount} ${tr("bottles", lang)}`, "good", { label: tr("undo", lang), run: () => { undo(id); setGiveMap((g) => { const n = { ...g }; delete n[id]; return n; }); } });
  };

  const maps = useMemo(() => (c ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.society}, ${c.area}, Chhatrapati Sambhajinagar`)}` : "#"), [c]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <LangSwitch />

      {notices[0] && (
        <div className="flex items-start gap-3 rounded-2xl bg-marigold-soft p-4" role="status">
          <Megaphone size={22} className="mt-0.5 shrink-0 text-marigold-deep" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-marigold-deep">{tr("hubSays", lang)}</p>
            <p className="font-medium">{notices[0].text}</p>
          </div>
          <button onClick={() => markRead("rider")} className="rounded-xl bg-white px-3 py-2 text-sm font-bold">{tr("ok", lang)}</button>
        </div>
      )}

      <ShiftSteps lang={lang} loaded={!!shift.loadedAt} loadedAt={shift.loadedAt} done={handled} total={stops.length} returned={!!shift.handedOverAt} short={shift.short.length} onLoad={() => setCrateOpen(true)} />

      {!shift.loadedAt ? (
        <LoadCrate lang={lang} stops={stops} />
      ) : (
      <>
      {pending.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Counter icon={<Check size={22} strokeWidth={3} />} value={delivered} label={tr("doneShort", lang)} tone="good" />
            <Counter icon={<Truck size={22} />} value={pending.length} label={tr("leftShort", lang)} tone="ink" />
            <Counter icon={<TriangleAlert size={22} />} value={issues} label={tr("problemShort", lang)} tone={issues ? "bad" : "muted"} />
          </div>
          <div className={clsx("flex items-center gap-4 rounded-3xl p-4", slack >= 5 ? "bg-neem-soft" : slack >= 0 ? "bg-marigold-soft" : "bg-brick-soft")}>
            <span className={clsx("grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white", slack >= 5 ? "bg-neem" : slack >= 0 ? "bg-marigold-deep" : "bg-brick")}><Clock3 size={28} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{tr("finishBy", lang)}</p>
              <p className="text-sm text-ink-3">{tr("atThisSpeed", lang)} <b className="tabular text-ink">{hhmm(finishMin)}</b></p>
            </div>
            <div className="text-right">
              <p className={clsx("font-display text-3xl font-bold tabular", slack >= 5 ? "text-neem-deep" : slack >= 0 ? "text-marigold-deep" : "text-brick")}>{Math.abs(slack)}</p>
              <p className="text-xs font-semibold text-ink-3">{slack >= 0 ? tr("minLeft", lang) : tr("minLate", lang)}</p>
            </div>
          </div>
        </>
      )}

      {next && c ? (
        <div className="overflow-hidden rounded-3xl bg-white shadow-lift">
          <div className="flex items-center justify-between bg-marigold px-5 py-3 font-bold text-ink">
            <span className="text-lg">{tr("next", lang)}</span>
            <span className="rounded-full bg-ink px-3 py-1 text-sm text-white tabular">#{next.seq}</span>
          </div>
          <div className="p-5">
            <p className="font-display text-6xl font-bold leading-none tracking-tight">{c.flat}</p>
            <p className="mt-2 text-2xl font-semibold text-ink-3">{c.society}</p>
            {lockedBefore && (
              <p className={clsx("mt-3 flex items-center gap-2 rounded-2xl bg-brick-soft px-3 py-2.5 font-bold text-brick", lang !== "en" && "font-mr")}><DoorClosed size={22} className="shrink-0" />{tr("lockedLast", lang)}</p>
            )}

            <p className={clsx("mt-5 text-center font-semibold text-ink-3", lang !== "en" && "font-mr")}>{tr("handOver2", lang)}</p>
            <div className="mt-2 space-y-3">
              {next.items.map((i) => {
                const g = giveOf(i.productId, i.qty);
                const more = canGiveMore(i.productId, i.qty);
                const bought = next.fromVan?.find((v) => v.productId === i.productId)?.qty ?? 0;
                return (
                  <div key={i.productId} className={clsx("flex items-center gap-2 rounded-2xl border-[3px] p-2.5", g < i.qty ? "border-brick bg-brick-soft/50" : g > i.qty ? "border-marigold bg-marigold-soft/60" : "border-transparent bg-milk")}>
                    <ProductArt product={productById[i.productId]!} size={54} />
                    <div className="min-w-0 flex-1">
                      <p className={clsx("line-clamp-2 text-sm font-semibold leading-tight text-ink-3", lang !== "en" && "font-mr")}>{itemName(i.productId, lang)}</p>
                      {g < i.qty && <p className={clsx("text-sm font-bold text-brick", lang !== "en" && "font-mr")}>{i.qty - g} {tr("short", lang)}</p>}
                      {g > i.qty && <p className={clsx("text-sm font-bold text-marigold-deep", lang !== "en" && "font-mr")}>+{g - i.qty} {tr("fromSpare", lang)}</p>}
                      {bought > 0 && g === i.qty && <p className={clsx("text-xs font-bold text-marigold-deep", lang !== "en" && "font-mr")}>+{bought} {tr("fromSpare", lang)}</p>}
                    </div>
                    <button aria-label={`One less ${productById[i.productId]!.name}`} disabled={g <= 0} onClick={() => setGive(i.productId, g - 1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-ink active:scale-95 disabled:opacity-30"><Minus size={26} /></button>
                    <span className="w-10 text-center font-display text-5xl font-bold tabular" aria-live="polite">{g}</span>
                    <button aria-label={`One more ${productById[i.productId]!.name}`} disabled={!more} onClick={() => setGive(i.productId, g + 1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-ink active:scale-95 disabled:opacity-30"><Plus size={26} /></button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#FFF6DD] p-4">
              <p className={clsx("flex-1 text-lg leading-snug", lang !== "en" && "font-mr")}>{noteFor(c, lang)}</p>
              {canSpeak && (
                <button onClick={speak} className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink-3" aria-label={tr("listen", lang)}>
                  <Volume2 size={22} />{tr("listen", lang)}
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-dashed border-milk-3 p-2.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-neem-soft text-neem"><Recycle size={26} /></span>
              <p className={clsx("min-w-0 flex-1 text-sm font-semibold leading-tight text-ink-3", lang !== "en" && "font-mr")}>{tr("takeEmpty", lang)}</p>
              <button aria-label="One less bottle" disabled={bottleCount <= 0} onClick={() => setBottles((b) => ({ ...b, [next.id]: Math.max(0, bottleCount - 1) }))} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-milk-2 text-ink active:scale-95 disabled:opacity-30"><Minus size={22} /></button>
              <span className="w-8 text-center font-display text-3xl font-bold tabular" aria-live="polite">{bottleCount}</span>
              <button aria-label="One more bottle" onClick={() => setBottles((b) => ({ ...b, [next.id]: Math.min(12, bottleCount + 1) }))} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-milk-2 text-ink active:scale-95"><Plus size={22} /></button>
            </div>

            <button onClick={doDeliver} className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-neem text-2xl font-bold text-white shadow-lift active:scale-[.98]">
              <Check size={34} strokeWidth={3} /> {tr("delivered", lang)}
            </button>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <button onClick={() => setProblemFor(next)} className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-brick-soft font-bold text-brick active:scale-95"><TriangleAlert size={26} />{tr("problem", lang)}</button>
              <button onClick={() => setCalling({ name: c.contact, sub: `${c.flat}, ${c.society}` })} className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-milk-2 font-bold text-ink active:scale-95"><Phone size={26} />{tr("call", lang)}</button>
              <a href={maps} target="_blank" rel="noreferrer" className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-milk-2 font-bold text-ink active:scale-95"><MapPin size={26} />{tr("map", lang)}</a>
            </div>
          </div>
        </div>
      ) : !shift.handedOverAt ? (
        <ReturnToHub lang={lang} collected={got} stops={stops} />
      ) : (
        <div className="rounded-3xl bg-white p-8 text-center shadow-lift">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-neem-soft text-neem"><PartyPopper size={40} /></span>
          <p className="mt-4 font-display text-3xl font-bold">{tr("shiftDone", lang)}</p>
          <p className="mt-2 text-lg text-ink-soft">{tr("handedAt", lang)} {new Date(shift.handedOverAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl bg-milk p-4"><Check size={22} className="text-neem" /><p className="mt-1 font-display text-3xl font-bold tabular">{delivered}</p><p className="text-sm text-ink-soft">{tr("homes", lang)}</p></div>
            <div className="rounded-2xl bg-milk p-4"><Recycle size={22} className="text-neem" /><p className="mt-1 font-display text-3xl font-bold tabular">{shift.returnedBottles}</p><p className="text-sm text-ink-soft">{tr("bottles", lang)}</p></div>
          </div>
          <Link to="/rider/summary" className="mt-5 flex h-16 items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-bold text-white"><Wallet size={22} />{tr("earnToday", lang)}</Link>
          <button onClick={() => { advanceDay(); setBottles({}); toast(tr("newShift", lang), "info"); }} className="mt-3 h-14 w-full rounded-2xl bg-milk-2 font-bold text-ink-3">{tr("newShift", lang)}</button>
        </div>
      )}
      </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setListOpen(true)} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white font-bold shadow-sm"><List size={22} />{tr("allHomes", lang)}</button>
        <button onClick={() => setCalling({ name: "Samarth Nagar hub", sub: "Dispatch desk" })} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white font-bold shadow-sm"><Phone size={20} />{tr("helpLine", lang)}</button>
      </div>
      {handled > 0 && (
        <button onClick={() => setRestartOpen(true)} className={clsx("flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-milk-3 font-semibold text-ink-3", lang !== "en" && "font-mr")}><RotateCcw size={18} />{tr("restart", lang)}</button>
      )}
      {restartOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-label={tr("restart", lang)}>
          <div className="w-full max-w-lg animate-rise rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-marigold-soft text-marigold-deep"><RotateCcw size={30} /></span>
            <p className={clsx("mt-3 text-center text-lg font-semibold", lang !== "en" && "font-mr")}>{tr("restartSure", lang)}</p>
            <button onClick={() => { restartRound(ROUTE); setGiveMap({}); setBottles({}); setRestartOpen(false); toast(tr("restart", lang), "info"); }} className={clsx("mt-4 h-16 w-full rounded-2xl bg-ink text-lg font-bold text-white", lang !== "en" && "font-mr")}>{tr("restartYes", lang)}</button>
            <button onClick={() => setRestartOpen(false)} className="mt-3 h-14 w-full rounded-2xl bg-milk-2 text-lg font-bold">{tr("cancel", lang)}</button>
          </div>
        </div>
      )}

      {/* Problem picker: tap only, no typing */}
      {problemFor && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-label={tr("whatProblem", lang)}>
          <div className="w-full max-w-lg animate-rise rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <p className="text-center font-display text-2xl font-bold">{tr("whatProblem", lang)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {problems.map((p) => (
                <button key={p.key} onClick={() => {
                  const id = problemFor.id;
                  if (p.key === "itemBad") { setPartFor(problemFor); setProblemFor(null); return; }
                  flag(id, p.kind, p.note);
                  setProblemFor(null);
                  toast(tr("saved", lang), "warn", { label: tr("undo", lang), run: () => undo(id) });
                }} className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-brick-soft p-3 text-center font-bold text-brick active:scale-95">
                  {p.icon}<span className={clsx("leading-tight", lang !== "en" && "font-mr")}>{tr(p.key, lang)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setProblemFor(null)} className="mt-3 h-14 w-full rounded-2xl bg-milk-2 text-lg font-bold">{tr("cancel", lang)}</button>
          </div>
        </div>
      )}

      {partFor && (
        <PartDelivery lang={lang} stop={partFor} onClose={() => setPartFor(null)} onDone={(given) => {
          const id = partFor.id;
          if (given.length) deliver(id, bottles[id] ?? partFor.bottlesDue, given);
          else flag(id, "missing", "Item short or broken in the crate");
          setPartFor(null);
          toast(tr("saved", lang), "warn", { label: tr("undo", lang), run: () => undo(id) });
        }} />
      )}

      {/* All homes */}
      {listOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-label={tr("allHomes", lang)}>
          <div className="flex max-h-[88vh] w-full max-w-lg animate-rise flex-col rounded-t-3xl bg-white sm:rounded-3xl">
            <div className="flex items-center justify-between p-5 pb-3">
              <p className="font-display text-2xl font-bold">{tr("allHomes", lang)}</p>
              <button onClick={() => setListOpen(false)} aria-label={tr("close", lang)} className="grid h-12 w-12 place-items-center rounded-full bg-milk-2"><X size={22} /></button>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto px-5 pb-5">
              {stops.map((s) => {
                const cc = cust(s.customerId);
                return (
                  <li key={s.id} className={clsx("flex items-center gap-3 rounded-2xl p-3", s === next ? "bg-marigold-soft" : "bg-milk")}>
                    <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-bold", s.status === "delivered" ? "bg-neem text-white" : s.status === "issue" ? "bg-brick text-white" : "bg-white text-ink")}>
                      {s.status === "delivered" ? <Check size={22} strokeWidth={3} /> : s.status === "issue" ? <TriangleAlert size={20} /> : s.seq}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xl font-bold">{cc.flat}</span>
                      <span className="block truncate text-ink-soft">{cc.society}</span>
                    </span>
                    {s.status !== "pending" && (
                      <button onClick={() => undo(s.id)} className="flex h-12 items-center gap-1 rounded-xl bg-white px-3 font-bold text-ink-3"><Undo2 size={18} />{tr("undo", lang)}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {crateOpen && <CrateSheet lang={lang} stops={stops} onClose={() => setCrateOpen(false)} />}
      <CallSheet name={calling?.name ?? null} sub={calling?.sub} color="#2F7D5B" onClose={() => setCalling(null)} />
    </div>
  );
}

/* ---------- part delivery: pictures and − + only ---------- */
function PartDelivery({ lang, stop, onClose, onDone }: { lang: RiderLang; stop: Stop; onClose: () => void; onDone: (given: { productId: string; qty: number }[]) => void }) {
  const [given, setGiven] = useState<Record<string, number>>(() => Object.fromEntries(stop.items.map((i) => [i.productId, i.qty])));
  const lines = stop.items.map((i) => ({ productId: i.productId, qty: given[i.productId] ?? i.qty }));
  const changed = stop.items.some((i) => (given[i.productId] ?? i.qty) < i.qty);
  const none = lines.every((l) => l.qty === 0);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-label={tr("gaveTitle", lang)}>
      <div className="flex max-h-[92vh] w-full max-w-lg animate-rise flex-col rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="p-5 pb-2 text-center">
          <p className="font-display text-2xl font-bold">{tr("gaveTitle", lang)}</p>
          <p className={clsx("text-ink-soft", lang !== "en" && "font-mr")}>{tr("gaveSub", lang)}</p>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 pb-2">
          {stop.items.map((i) => {
            const g = given[i.productId] ?? i.qty;
            const short = g < i.qty;
            return (
              <div key={i.productId} className={clsx("flex items-center gap-3 rounded-2xl border-[3px] p-3", short ? "border-brick bg-brick-soft/50" : "border-milk-2")}>
                <ProductArt product={productById[i.productId]!} size={64} />
                <div className="min-w-0 flex-1">
                  <p className={clsx("line-clamp-2 text-sm leading-tight text-ink-3", lang !== "en" && "font-mr")}>{itemName(i.productId, lang)}</p>
                  {short && <p className="text-sm font-bold text-brick">{i.qty - g} {tr("notGiven", lang)}</p>}
                </div>
                <button aria-label="One less" onClick={() => setGiven((x) => ({ ...x, [i.productId]: Math.max(0, g - 1) }))} className="grid h-14 w-14 place-items-center rounded-2xl bg-milk-2 active:scale-95"><Minus size={26} /></button>
                <span className="w-10 text-center font-display text-4xl font-bold tabular" aria-live="polite">{g}</span>
                <button aria-label="One more" disabled={g >= i.qty} onClick={() => setGiven((x) => ({ ...x, [i.productId]: Math.min(i.qty, g + 1) }))} className="grid h-14 w-14 place-items-center rounded-2xl bg-milk-2 active:scale-95 disabled:opacity-30"><Plus size={26} /></button>
              </div>
            );
          })}
        </div>
        <div className="grid gap-3 p-5">
          <button disabled={!changed} onClick={() => onDone(none ? [] : lines.filter((l) => l.qty > 0))} className={clsx("flex h-20 w-full items-center justify-center gap-3 rounded-2xl text-2xl font-bold text-white active:scale-[.98] disabled:opacity-40", none ? "bg-brick" : "bg-neem")}>
            {none ? <><PackageX size={30} /> {tr("gaveNone", lang)}</> : <><Check size={30} strokeWidth={3} /> {tr("giveRest", lang)}</>}
          </button>
          <button onClick={onClose} className="h-14 w-full rounded-2xl bg-milk-2 text-lg font-bold">{tr("cancel", lang)}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- shift pieces ---------- */

/** What was packed at the hub: everyone's orders (before any spares were sold) plus the spares. */
function crateList(stops: Stop[]) {
  const m = new Map<string, number>();
  for (const s of stops) for (const i of packedItems(s)) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
  return products.filter((p) => m.has(p.id)).map((p) => ({ p, qty: m.get(p.id)! + SPARES_PER_ITEM }));
}

function ShiftSteps({ lang, loaded, loadedAt, done, total, returned, short, onLoad }: { lang: RiderLang; loaded: boolean; loadedAt: string | null; done: number; total: number; returned: boolean; short: number; onLoad: () => void }) {
  const allDone = done === total;
  const steps = [
    { key: "load", icon: <PackageCheck size={20} />, label: tr("stepLoad", lang), state: loaded ? "done" : "now", sub: loaded && loadedAt ? new Date(loadedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) + (short ? `, ${short} ${tr("short", lang)}` : "") : "", onClick: loaded ? onLoad : undefined },
    { key: "deliver", icon: <Truck size={20} />, label: tr("stepDeliver", lang), state: !loaded ? "later" : allDone ? "done" : "now", sub: loaded ? `${done}/${total}` : "" },
    { key: "return", icon: <Warehouse size={20} />, label: tr("stepReturn", lang), state: returned ? "done" : loaded && allDone ? "now" : "later", sub: "" },
  ] as const;
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Shift steps">
      {steps.map((st) => {
        const body = (
          <>
            <span className={clsx("grid h-9 w-9 place-items-center rounded-full", st.state === "done" ? "bg-neem text-white" : st.state === "now" ? "bg-marigold text-ink" : "bg-milk-2 text-ink-soft")}>{st.state === "done" ? <Check size={18} strokeWidth={3} /> : st.icon}</span>
            <span className="text-sm font-bold">{st.label}</span>
            {st.sub && <span className="text-xs tabular text-ink-soft">{st.sub}</span>}
          </>
        );
        return (
          <li key={st.key}>
            {"onClick" in st && st.onClick ? (
              <button onClick={st.onClick} className="flex w-full flex-col items-center gap-1 rounded-2xl bg-white p-2.5 shadow-sm" aria-label={tr("checkCrate", lang)}>{body}</button>
            ) : (
              <div className={clsx("flex flex-col items-center gap-1 rounded-2xl p-2.5", st.state === "now" ? "bg-white shadow-sm" : "bg-white/50")} aria-current={st.state === "now" ? "step" : undefined}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Counter({ icon, value, label, tone }: { icon: JSX.Element; value: number; label: string; tone: "good" | "ink" | "bad" | "muted" }) {
  return (
    <div className={clsx("flex flex-col items-center rounded-3xl p-3", tone === "good" ? "bg-neem text-white" : tone === "ink" ? "bg-ink text-white" : tone === "bad" ? "bg-brick text-white" : "bg-white text-ink-soft")}>
      {icon}
      <span className="font-display text-4xl font-bold leading-tight tabular">{value}</span>
      <span className="text-sm font-semibold opacity-90">{label}</span>
    </div>
  );
}

function CrateTiles({ lang, items, checked, onToggle, short }: { lang: RiderLang; items: { p: (typeof products)[number]; qty: number }[]; checked: Record<string, boolean>; onToggle?: (id: string) => void; short?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ p, qty }) => {
        const on = short ? !short.includes(p.id) : !!checked[p.id];
        const Tag = onToggle ? "button" : "div";
        return (
          <Tag key={p.id} {...(onToggle ? { onClick: () => onToggle(p.id), "aria-pressed": on } : {})}
            className={clsx("relative flex flex-col items-center rounded-2xl border-[3px] p-3 text-center transition", on ? "border-neem bg-neem-soft/50" : short ? "border-brick bg-brick-soft/60" : "border-milk-2 bg-white")}>
            {on && <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-neem text-white"><Check size={16} strokeWidth={3} /></span>}
            {!on && short && <span className="absolute right-2 top-2 rounded-full bg-brick px-2 py-0.5 text-xs font-bold text-white">{tr("short", lang)}</span>}
            <ProductArt product={p} size={64} />
            <span className="mt-1 font-display text-4xl font-bold leading-none tabular">{qty}</span>
            <span className={clsx("mt-1 line-clamp-2 text-sm leading-tight text-ink-3", lang !== "en" && "font-mr")}>{itemName(p.id, lang)}</span>
          </Tag>
        );
      })}
    </div>
  );
}

function LoadCrate({ lang, stops }: { lang: RiderLang; stops: Stop[] }) {
  const shift = useStore((s) => s.shift);
  const toggle = useStore((s) => s.toggleLoadItem);
  const confirm = useStore((s) => s.confirmLoad);
  const items = crateList(stops);
  const missing = items.filter((x) => !shift.checked[x.p.id]).map((x) => x.p.id);
  const count = items.length - missing.length;
  return (
    <div className="rounded-3xl bg-white p-5 shadow-lift">
      <p className="font-display text-3xl font-bold">{tr("loadTitle", lang)}</p>
      <p className={clsx("mt-1 text-ink-soft", lang !== "en" && "font-mr")}>{tr("loadSub", lang)} ({tr("spares", lang)})</p>
      <div className="my-4 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-milk-2"><div className="h-full rounded-full bg-neem transition-[width]" style={{ width: `${(count / items.length) * 100}%` }} /></div>
        <span className="font-display text-xl font-bold tabular">{count}/{items.length}</span>
      </div>
      <CrateTiles lang={lang} items={items} checked={shift.checked} onToggle={toggle} />
      {missing.length === 0 ? (
        <button onClick={() => { confirm([]); toast(tr("crateLoaded", lang)); }} className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-neem text-2xl font-bold text-white active:scale-[.98]">
          <Truck size={30} /> {tr("startDelivering", lang)}
        </button>
      ) : (
        <button onClick={() => { confirm(missing); toast(`${tr("crateLoaded", lang)}: ${missing.length} ${tr("short", lang)}`, "warn"); }} className="mt-5 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-marigold-soft px-4 py-3 text-lg font-bold text-marigold-deep active:scale-[.98]">
          <TriangleAlert size={24} /> {tr("startShort", lang)}
        </button>
      )}
    </div>
  );
}

function CrateSheet({ lang, stops, onClose }: { lang: RiderLang; stops: Stop[]; onClose: () => void }) {
  const shift = useStore((s) => s.shift);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-label={tr("checkCrate", lang)}>
      <div className="flex max-h-[90vh] w-full max-w-lg animate-rise flex-col rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-center justify-between p-5 pb-2">
          <p className="font-display text-2xl font-bold">{tr("crateLoaded", lang)}</p>
          <button onClick={onClose} aria-label={tr("close", lang)} className="grid h-12 w-12 place-items-center rounded-full bg-milk-2"><X size={22} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">
          <CrateTiles lang={lang} items={crateList(stops)} checked={{}} short={shift.short} />
          <button onClick={onClose} className="mt-4 h-14 w-full rounded-2xl bg-ink text-lg font-bold text-white">{tr("close2", lang)}</button>
        </div>
      </div>
    </div>
  );
}

function ReturnToHub({ lang, collected, stops }: { lang: RiderLang; collected: number; stops: Stop[] }) {
  const handover = useStore((s) => s.handover);
  const [n, setN] = useState(collected);
  const left = sparesLeft(stops, ROUTE);
  const spares = crateList(stops).map(({ p }) => ({ p, qty: Math.max(0, left[p.id] ?? 0) })).filter((x) => x.qty > 0);
  return (
    <div className="rounded-3xl bg-white p-5 shadow-lift">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-marigold text-ink"><Warehouse size={28} /></span>
        <div>
          <p className="font-display text-3xl font-bold">{tr("returnTitle", lang)}</p>
          <p className="text-ink-soft">{tr("allDone", lang)}</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border-2 border-milk-2 p-4">
        <p className={clsx("text-center font-semibold text-ink-3", lang !== "en" && "font-mr")}>{tr("returnBottles", lang)}</p>
        <div className="mt-3 flex items-center justify-center gap-6">
          <button aria-label="One less bottle" onClick={() => setN(Math.max(0, n - 1))} className="grid h-16 w-16 place-items-center rounded-2xl bg-milk-2 active:scale-95"><Minus size={30} /></button>
          <span className="w-20 text-center font-display text-6xl font-bold tabular" aria-live="polite">{n}</span>
          <button aria-label="One more bottle" onClick={() => setN(n + 1)} className="grid h-16 w-16 place-items-center rounded-2xl bg-milk-2 active:scale-95"><Plus size={30} /></button>
        </div>
      </div>
      <p className={clsx("mt-5 font-semibold text-ink-3", lang !== "en" && "font-mr")}>{tr("returnSpares", lang)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {spares.map(({ p, qty }) => (
          <span key={p.id} className="flex items-center gap-2 rounded-2xl bg-milk py-1.5 pl-1.5 pr-3"><ProductArt product={p} size={36} /><b className="font-display text-xl">{qty}</b></span>
        ))}
      </div>
      <button onClick={() => { handover(n); toast(tr("shiftDone", lang)); }} className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-neem text-2xl font-bold text-white active:scale-[.98]">
        <Check size={32} strokeWidth={3} /> {tr("handOver", lang)}
      </button>
    </div>
  );
}
