import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Check, Phone, MapPin, TriangleAlert, Volume2, Minus, Plus, DoorClosed, PackageX, Hand, MapPinOff, List, X, Undo2, Megaphone, PartyPopper } from "lucide-react";
import { useStore, type RiderLang } from "../../store/useStore";
import { productById } from "../../data/seed";
import type { Customer, ExceptionKind, Stop } from "../../data/types";
import { ProductArt } from "../../components/ProductArt";
import { CallSheet } from "../../components/CallSheet";
import { toast } from "../../store/toast";
import { tr, speechLang } from "../../lib/riderText";

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
  const stops = useStore((s) => s.stops.filter((x) => x.routeId === ROUTE).sort((a, b) => a.seq - b.seq));
  const customers = useStore((s) => s.customers);
  const notices = useStore((s) => s.notices.filter((n) => n.role === "rider" && !n.read));
  const markRead = useStore((s) => s.markRead);
  const deliver = useStore((s) => s.deliver);
  const flag = useStore((s) => s.flagStop);
  const undo = useStore((s) => s.undoStop);
  const [bottles, setBottles] = useState<Record<string, number>>({});
  const [problemFor, setProblemFor] = useState<Stop | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [calling, setCalling] = useState<{ name: string; sub?: string } | null>(null);

  const cust = (id: string) => customers.find((c) => c.id === id)!;
  const pending = stops.filter((s) => s.status === "pending");
  const handled = stops.length - pending.length;
  const next = pending[0];
  const c = next ? cust(next.customerId) : null;
  const got = stops.reduce((s, x) => s + x.bottlesCollected, 0);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = () => {
    if (!c || !next) return;
    const items = next.items.map((i) => `${i.qty} ${itemName(i.productId, lang)}`).join(", ");
    const u = new SpeechSynthesisUtterance(`${c.flat}, ${c.society}. ${items}. ${noteFor(c, lang)}`);
    u.lang = speechLang[lang];
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const doDeliver = () => {
    if (!next) return;
    const id = next.id;
    deliver(id, bottles[id] ?? next.bottlesDue);
    toast(`✓ ${c!.flat}`, "good", { label: tr("undo", lang), run: () => undo(id) });
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

      {/* Progress */}
      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="flex items-end justify-between">
          <p><span className="font-display text-5xl font-bold tabular">{handled}</span><span className="text-2xl text-white/50">/{stops.length}</span> <span className="text-white/70">{tr("homes", lang)} {tr("done", lang)}</span></p>
          <p className="text-right"><span className="font-display text-3xl font-bold tabular text-marigold">{pending.length}</span><span className="block text-sm text-white/70">{tr("left", lang)}</span></p>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-marigold transition-[width] duration-700" style={{ width: `${(handled / stops.length) * 100}%` }} /></div>
      </div>

      {next && c ? (
        <div className="overflow-hidden rounded-3xl bg-white shadow-lift">
          <div className="flex items-center justify-between bg-marigold px-5 py-3 font-bold text-ink">
            <span className="text-lg">{tr("next", lang)}</span>
            <span className="rounded-full bg-ink px-3 py-1 text-sm text-white tabular">#{next.seq}</span>
          </div>
          <div className="p-5">
            <p className="font-display text-6xl font-bold leading-none tracking-tight">{c.flat}</p>
            <p className="mt-2 text-2xl font-semibold text-ink-3">{c.society}</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {next.items.map((i) => (
                <div key={i.productId} className="flex items-center gap-3 rounded-2xl bg-milk p-3">
                  <ProductArt product={productById[i.productId]!} size={60} />
                  <div className="min-w-0">
                    <p className="font-display text-4xl font-bold leading-none">{i.qty}</p>
                    <p className={clsx("line-clamp-2 text-sm leading-tight text-ink-soft", lang !== "en" && "font-mr")}>{itemName(i.productId, lang)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#FFF6DD] p-4">
              <p className={clsx("flex-1 text-lg leading-snug", lang !== "en" && "font-mr")}>{noteFor(c, lang)}</p>
              {canSpeak && (
                <button onClick={speak} className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink-3" aria-label={tr("listen", lang)}>
                  <Volume2 size={22} />{tr("listen", lang)}
                </button>
              )}
            </div>

            {next.bottlesDue > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-milk-2 p-4">
                <p className={clsx("text-center font-semibold text-ink-3", lang !== "en" && "font-mr")}>{tr("takeEmpty", lang)}</p>
                <div className="mt-3 flex items-center justify-center gap-6">
                  <button aria-label="One less bottle" onClick={() => setBottles((b) => ({ ...b, [next.id]: Math.max(0, (b[next.id] ?? next.bottlesDue) - 1) }))} className="grid h-16 w-16 place-items-center rounded-2xl bg-milk-2 text-ink active:scale-95"><Minus size={30} /></button>
                  <span className="w-16 text-center font-display text-6xl font-bold tabular" aria-live="polite">{bottles[next.id] ?? next.bottlesDue}</span>
                  <button aria-label="One more bottle" onClick={() => setBottles((b) => ({ ...b, [next.id]: Math.min(9, (b[next.id] ?? next.bottlesDue) + 1) }))} className="grid h-16 w-16 place-items-center rounded-2xl bg-milk-2 text-ink active:scale-95"><Plus size={30} /></button>
                </div>
              </div>
            )}

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
      ) : (
        <div className="rounded-3xl bg-white p-8 text-center shadow-lift">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-neem-soft text-neem"><PartyPopper size={40} /></span>
          <p className="mt-4 font-display text-3xl font-bold">{tr("allDone", lang)}</p>
          <p className="mt-2 text-lg text-ink-soft">{tr("goBack", lang)}</p>
          <p className="mt-4 font-display text-5xl font-bold tabular">{got} <span className="text-xl font-normal text-ink-soft">{tr("bottles", lang)}</span></p>
          <Link to="/rider/summary" className="mt-6 inline-flex h-14 items-center justify-center rounded-2xl bg-ink px-8 text-lg font-bold text-white">{tr("earnToday", lang)}</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setListOpen(true)} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white font-bold shadow-sm"><List size={22} />{tr("allHomes", lang)}</button>
        <button onClick={() => setCalling({ name: "Samarth Nagar hub", sub: "Dispatch desk" })} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white font-bold shadow-sm"><Phone size={20} />{tr("helpLine", lang)}</button>
      </div>

      {/* Problem picker: tap only, no typing */}
      {problemFor && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-label={tr("whatProblem", lang)}>
          <div className="w-full max-w-lg animate-rise rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <p className="text-center font-display text-2xl font-bold">{tr("whatProblem", lang)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {problems.map((p) => (
                <button key={p.key} onClick={() => {
                  const id = problemFor.id;
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

      <CallSheet name={calling?.name ?? null} sub={calling?.sub} color="#2F7D5B" onClose={() => setCalling(null)} />
    </div>
  );
}
