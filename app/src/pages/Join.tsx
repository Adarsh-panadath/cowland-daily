import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Check, ChevronLeft, MapPin, ShieldCheck } from "lucide-react";
import { Logo } from "../components/Logo";
import { ProductArt } from "../components/ProductArt";
import { Button, Field, Stepper, inputCls } from "../components/ui";
import { areas, areaById } from "../data/areas";
import { products, routeById, riderById, societies } from "../data/seed";
import type { LineItem } from "../data/types";
import { addDays, dayKey, dayMonth, firstEditableDate, fromKey, inr, weekday } from "../lib/format";
import { normalisePhone } from "../lib/auth";
import { useStore, lineTotal } from "../store/useStore";
import { toast } from "../store/toast";

const STEPS = ["Area", "You", "Verify", "Address", "Order", "Review"] as const;
const DEMO_OTP = "1234";

export default function Join() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const customers = useStore((s) => s.customers);
  const signup = useStore((s) => s.signup);
  const served = areas.filter((a) => a.route);
  const initial = params.get("area");
  const [step, setStep] = useState(0);
  const [areaId, setAreaId] = useState(initial && areaById[initial]?.route ? initial : served[0]!.id);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const area = areaById[areaId]!;
  const route = routeById[area.route!]!;
  const socs = societies[route.id]!;
  const [society, setSociety] = useState(socs[0]!);
  const [flat, setFlat] = useState("");
  const [landmark, setLandmark] = useState("");
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<LineItem[]>([{ productId: "a2", qty: 2 }]);
  const first = firstEditableDate();
  const starts = useMemo(() => Array.from({ length: 5 }, (_, i) => dayKey(addDays(fromKey(first), i))), [first]);
  const [start, setStart] = useState(starts[0]!);
  const [topUp, setTopUp] = useState(1000);
  const [err, setErr] = useState("");

  useEffect(() => { if (!socs.includes(society)) setSociety(socs[0]!); }, [socs, society]);
  useEffect(() => setErr(""), [step]);

  const daily = lineTotal(plan);
  const minTopUp = Math.ceil(daily / 100) * 100;
  const qty = (pid: string) => plan.find((p) => p.productId === pid)?.qty ?? 0;
  const setQty = (pid: string, v: number) => setPlan((d) => [...d.filter((x) => x.productId !== pid), ...(v > 0 ? [{ productId: pid, qty: v }] : [])]);
  const phone = normalisePhone(mobile);

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    if (step === 1) {
      if (name.trim().split(/\s+/).length < 2) return setErr("Enter your first and last name.");
      if (phone.length !== 10) return setErr("Enter a 10-digit mobile number.");
      if (customers.some((c) => normalisePhone(c.phone) === phone)) return setErr("This number already has a subscription. Sign in instead.");
      toast(`SMS: your Cowland code is ${DEMO_OTP}. (Demo: no SMS is sent.)`, "info");
    }
    if (step === 2 && otp !== DEMO_OTP) return setErr(`That code doesn't match. In this demo the code is always ${DEMO_OTP}.`);
    if (step === 3 && !flat.trim()) return setErr("Enter your flat or house number.");
    if (step === 4) {
      if (!plan.length) return setErr("Choose at least one item for your daily order.");
      if (topUp < minTopUp) return setErr(`Add at least ${inr(minTopUp)} so your first morning's milk can be packed.`);
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const create = () => {
    signup({ name: name.trim(), mobile: phone, routeId: route.id, area: route.area, society, flat, landmark, dropNote: note, plan, startDate: start, topUp });
    toast(`Welcome, ${name.trim().split(/\s+/)[0]}! Your account is ready.`, "good");
    nav("/customer", { replace: true });
  };

  return (
    <div className="min-h-screen bg-milk">
      <header className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-5">
        <Link to="/" aria-label="Cowland Daily home"><Logo /></Link>
        <Link to="/login?role=customer" className="text-sm font-semibold text-ink-3 hover:text-ink">I already have an account</Link>
      </header>
      <main className="mx-auto max-w-[640px] px-5 pb-16">
        <ol className="mb-6 flex gap-1.5" aria-label="Sign-up progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <span className={clsx("block h-1.5 rounded-full", i <= step ? "bg-ink" : "bg-milk-3")} />
              <span className={clsx("mt-1.5 hidden text-xs font-semibold sm:block", i === step ? "text-ink" : "text-ink-soft")}>{s}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={step === STEPS.length - 1 ? (e) => { e.preventDefault(); create(); } : next} noValidate className="rounded-3xl bg-white p-6 shadow-lift sm:p-8">
          {step === 0 && (
            <Section title="Where should we deliver?" sub="We serve these localities today. Not listed? Join the waitlist on the home page.">
              <div className="grid gap-2">
                {served.map((a) => (
                  <label key={a.id} className={clsx("flex cursor-pointer items-center gap-3 rounded-2xl border p-4", areaId === a.id ? "border-ink bg-milk" : "border-milk-3")}>
                    <input type="radio" name="area" checked={areaId === a.id} onChange={() => setAreaId(a.id)} className="accent-[#14213D]" />
                    <MapPin size={18} className="text-ink-soft" />
                    <span className="flex-1"><span className="block font-semibold">{a.name}</span><span className="block text-sm text-ink-soft">Route {routeById[a.route!]!.code}, milk {routeById[a.route!]!.window}</span></span>
                  </label>
                ))}
              </div>
              <Link to="/" state={{ scrollTo: "areas" }} className="mt-3 inline-block text-sm font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-2">My area isn't listed</Link>
            </Section>
          )}

          {step === 1 && (
            <Section title="Who's the account for?" sub="We'll text a code to check the number. Your rider calls this number only through a masked line.">
              <div className="space-y-4">
                <Field label="Full name"><input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="For example: Kavita Joshi" autoComplete="name" className={inputCls} /></Field>
                <Field label="Mobile number" hint="Try any 10-digit number that isn't 1234567890">
                  <input value={mobile} onChange={(e) => { setMobile(e.target.value); setErr(""); }} inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile number" className={inputCls} />
                </Field>
              </div>
            </Section>
          )}

          {step === 2 && (
            <Section title="Enter the code" sub={`Sent to +91 ${phone.replace(/(\d{5})(\d{5})/, "$1 $2")}. In this demo no SMS is sent and the code is ${DEMO_OTP}.`}>
              <input value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }} inputMode="numeric" autoComplete="one-time-code" aria-label="One-time code" placeholder="••••" className={clsx(inputCls, "h-14 max-w-[200px] text-center font-display text-2xl tracking-[.5em]")} />
              <button type="button" onClick={() => setOtp(DEMO_OTP)} className="ml-3 text-sm font-semibold text-ink-3 underline">Fill demo code</button>
            </Section>
          )}

          {step === 3 && (
            <Section title="Your address" sub={`On Route ${route.code}. Riders read these notes at the door, so keep them short.`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Society or colony">
                  <select value={society} onChange={(e) => setSociety(e.target.value)} className={inputCls}>{socs.map((s) => <option key={s}>{s}</option>)}</select>
                </Field>
                <Field label="Flat or house number"><input value={flat} onChange={(e) => { setFlat(e.target.value); setErr(""); }} placeholder="For example: C-201" className={inputCls} /></Field>
                <Field label="Landmark (optional)"><input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near the Ganesh temple" className={inputCls} /></Field>
                <Field label="Where to leave the milk (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bag on the door latch, don't ring" className={inputCls} /></Field>
              </div>
            </Section>
          )}

          {step === 4 && (
            <Section title="Your daily order" sub="You can skip days, add extras or change this any time before 10 PM the night before.">
              <div className="divide-y divide-milk-2">
                {products.filter((p) => p.subscribable).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    <ProductArt product={p} size={48} />
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.name}</p><p className="text-xs text-ink-soft">{p.size}, {inr(p.price)}</p></div>
                    <Stepper label={p.name} value={qty(p.id)} max={10} onChange={(v) => setQty(p.id, v)} />
                  </div>
                ))}
              </div>
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-semibold">First delivery</legend>
                <div className="grid grid-cols-5 gap-2">
                  {starts.map((d) => (
                    <button type="button" key={d} onClick={() => setStart(d)} aria-pressed={start === d} className={clsx("rounded-xl border py-2 text-center", start === d ? "border-ink bg-ink text-white" : "border-milk-3")}>
                      <span className="block text-xs opacity-70">{weekday(d)}</span><span className="block text-sm font-semibold">{dayMonth(d)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-semibold">Add money to your wallet</legend>
                <div className="grid grid-cols-4 gap-2">
                  {[500, 1000, 2000, 3000].map((v) => (
                    <button type="button" key={v} onClick={() => setTopUp(v)} aria-pressed={topUp === v} disabled={v < minTopUp} className={clsx("rounded-xl border py-2.5 text-sm font-semibold tabular disabled:opacity-30", topUp === v ? "border-ink bg-ink text-white" : "border-milk-3")}>{inr(v)}</button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-ink-soft">{daily ? `Daily order ${inr(daily)}. ${inr(topUp)} covers about ${Math.floor(topUp / daily)} days.` : "Choose at least one item."}</p>
                <p className="mt-2 rounded-xl bg-marigold-soft px-3 py-2 text-sm text-marigold-deep">Demo payment. No money moves and no payment app opens.</p>
              </fieldset>
            </Section>
          )}

          {step === 5 && (
            <Section title="Check and create your account" sub="You can change any of this later from the app.">
              <dl className="divide-y divide-milk-2 rounded-2xl bg-milk text-sm">
                <Row k="Name" v={name} />
                <Row k="Mobile" v={`+91 ${phone.replace(/(\d{5})(\d{5})/, "$1 $2")}`} />
                <Row k="Address" v={`${flat}, ${society}${landmark ? ` (${landmark})` : ""}`} />
                <Row k="Route" v={`Route ${route.code}, ${riderById[route.riderId]!.name}, ${route.window}`} />
                <Row k="Daily order" v={plan.map((p) => `${p.qty} × ${products.find((x) => x.id === p.productId)!.name}`).join(", ")} />
                <Row k="First delivery" v={`${weekday(start, "long")}, ${dayMonth(start)}`} />
                <Row k="Wallet" v={`${inr(topUp)} (demo payment)`} />
              </dl>
              <p className="mt-4 flex items-start gap-2 text-sm text-ink-soft"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-neem" /> The hub sees your new account straight away, and your first order goes on {riderById[route.riderId]!.name.split(" ")[0]}'s list for that morning.</p>
            </Section>
          )}

          {err && <p role="alert" className="mt-4 text-sm font-medium text-brick">{err}{err.includes("Sign in") && <> <Link to="/login?role=customer" className="underline">Go to sign in</Link></>}</p>}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? <Button type="button" variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => setStep(step - 1)}>Back</Button> : <span />}
            <Button type="submit" size="lg" icon={step === STEPS.length - 1 ? <Check size={18} /> : undefined}>
              {step === 1 ? "Send code" : step === 2 ? "Verify" : step === STEPS.length - 1 ? "Create my account" : "Continue"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-1.5 text-ink-soft">{sub}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}
