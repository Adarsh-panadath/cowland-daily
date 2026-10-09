import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Eye, EyeOff, ShieldCheck, Smartphone, Truck, Building2, KeyRound, ChevronDown } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button, inputCls } from "../components/ui";
import { useStore } from "../store/useStore";
import { accounts, normalisePhone } from "../lib/auth";
import type { Role } from "../data/types";
import { toast } from "../store/toast";

const tabs: { role: Role; label: string; icon: ReactNode }[] = [
  { role: "customer", label: "Customer", icon: <Smartphone size={16} /> },
  { role: "rider", label: "Rider", icon: <Truck size={16} /> },
  { role: "admin", label: "Hub staff", icon: <Building2 size={16} /> },
];

const copy: Record<Role, { title: string; sub: string }> = {
  customer: { title: "Sign in to plan your milk", sub: "We'll send a one-time code to your mobile number." },
  rider: { title: "Start your dawn round", sub: "Use the rider ID on your badge and your 4-digit PIN." },
  admin: { title: "Hub team sign in", sub: "Use your Cowland work email and password." },
};

export default function Login() {
  const [params, setParams] = useSearchParams();
  const session = useStore((s) => s.session);
  const signIn = useStore((s) => s.signIn);
  const nav = useNavigate();
  const initial = (params.get("role") as Role) || "customer";
  const [role, setRole] = useState<Role>(initial in accounts ? initial : "customer");
  const next = params.get("next");
  const [fill, setFill] = useState(0);

  if (session) return <Navigate to={next && next.startsWith(accounts[session].home) ? next : accounts[session].home} replace />;

  const done = (r: Role) => {
    signIn(r);
    toast(`Signed in as ${accounts[r].name}.`);
    nav(next && next.startsWith(accounts[r].home) ? next : accounts[r].home, { replace: true });
  };

  const pick = (r: Role) => {
    setRole(r);
    setFill(0);
    const p = new URLSearchParams(params);
    p.set("role", r);
    setParams(p, { replace: true });
  };

  return (
    <div className="grid min-h-screen bg-milk lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand side */}
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[460px] w-[460px] rounded-full bg-[#B9879A] opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-[320px] w-[320px] rounded-full bg-marigold opacity-20 blur-3xl" />
        <Link to="/" aria-label="Cowland Daily home"><Logo light /></Link>
        <div className="relative mt-auto max-w-md">
          <p className="font-mr text-lg text-marigold">पहाटेचं ताजं दूध</p>
          <p className="mt-3 font-display text-5xl font-bold leading-[1.05] tracking-tight">One account for every morning.</p>
          <p className="mt-5 text-lg leading-relaxed text-white/70">Families plan their milk, riders run their rounds and the hub keeps every crate on time, each from their own sign-in.</p>
        </div>
        <p className="relative mt-10 text-sm text-white/50">Helpline +91 240 2345 890, 4:30 AM to 10:30 PM</p>
      </aside>

      {/* Form side */}
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="lg:hidden" aria-label="Cowland Daily home"><Logo /></Link>
          <Link to="/" className="text-sm font-semibold text-ink-3 hover:text-ink">Back to site</Link>
        </div>

        <div className="mx-auto my-auto w-full max-w-[420px] py-10">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-milk-2 p-1" role="tablist" aria-label="Who is signing in">
            {tabs.map((t) => (
              <button key={t.role} role="tab" aria-selected={role === t.role} onClick={() => pick(t.role)}
                className={clsx("flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-semibold transition sm:text-sm", role === t.role ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink")}>
                <span className="hidden sm:inline">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">{copy[role].title}</h1>
          <p className="mt-1.5 text-ink-soft">{copy[role].sub}</p>

          <div className="mt-7" key={role}>
            {role === "customer" && <CustomerForm fill={fill} onDone={() => done("customer")} />}
            {role === "rider" && <RiderForm fill={fill} onDone={() => done("rider")} />}
            {role === "admin" && <StaffForm fill={fill} onDone={() => done("admin")} />}
          </div>

          <DemoAccounts role={role} onFill={() => setFill((n) => n + 1)} />
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />;
}

function ErrorText({ children }: { children: ReactNode }) {
  return <p role="alert" className="mt-2 text-sm font-medium text-brick">{children}</p>;
}

/* ---------- Customer: mobile + OTP ---------- */
function CustomerForm({ onDone, fill }: { onDone: () => void; fill: number }) {
  const acc = accounts.customer;
  const [phone, setPhone] = useState(acc.id);
  useEffect(() => { if (fill) { setPhone(acc.id); setErr(""); } }, [fill]);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [timer, setTimer] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const n = normalisePhone(phone);
    if (n.length !== 10) return setErr("Enter a 10-digit mobile number.");
    if (n !== acc.id) return setErr("We couldn't find a subscription for this number. Use the demo number below.");
    setErr("");
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setStep("otp");
      setTimer(30);
      toast(`SMS: your Cowland code is ${acc.secret}. It has been filled in for you.`, "info");
      setOtp(acc.secret.split(""));
    }, 800);
  };

  const verify = (code: string) => {
    if (code.length < 4) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (code === acc.secret) onDone();
      else {
        setErr("That code doesn't match. Check the SMS and try again.");
        setOtp(["", "", "", ""]);
        boxes.current[0]?.focus();
      }
    }, 600);
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) {
      // pasted the whole code
      const arr = d.slice(0, 4).split("");
      const filled = [0, 1, 2, 3].map((k) => arr[k] ?? "");
      setOtp(filled);
      if (arr.length === 4) verify(arr.join(""));
      return;
    }
    const nextOtp = otp.map((x, k) => (k === i ? d : x));
    setOtp(nextOtp);
    setErr("");
    if (d && i < 3) boxes.current[i + 1]?.focus();
    if (nextOtp.every(Boolean)) verify(nextOtp.join(""));
  };

  if (step === "otp")
    return (
      <div>
        <p className="text-sm text-ink-soft">Code sent to <b className="text-ink">+91 {normalisePhone(phone).replace(/(\d{5})(\d{5})/, "$1 $2")}</b>. <button className="font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-2" onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); setErr(""); }}>Change</button></p>
        <fieldset className="mt-4">
          <legend className="sr-only">One-time code</legend>
          <div className="flex gap-3">
            {otp.map((d, i) => (
              <input key={i} ref={(el) => (boxes.current[i] = el)} value={d} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`Digit ${i + 1}`}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) boxes.current[i - 1]?.focus(); }}
                className={clsx("h-14 w-14 rounded-2xl border bg-white text-center font-display text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-marigold/50", err ? "border-brick" : "border-milk-3 focus:border-ink-3")} />
            ))}
          </div>
        </fieldset>
        {err && <ErrorText>{err}</ErrorText>}
        <Button size="lg" className="mt-6 w-full" disabled={busy || otp.some((x) => !x)} onClick={() => verify(otp.join(""))}>{busy ? <Spinner /> : "Verify and sign in"}</Button>
        <p className="mt-4 text-center text-sm text-ink-soft">
          {timer > 0 ? <>Resend code in <span className="tabular">0:{String(timer).padStart(2, "0")}</span></> : <button className="font-semibold text-ink hover:underline" onClick={() => send()}>Resend code</button>}
        </p>
      </div>
    );

  return (
    <form onSubmit={send} noValidate>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Mobile number</span>
        <div className={clsx("flex items-center rounded-xl border bg-white focus-within:ring-2 focus-within:ring-marigold/40", err ? "border-brick" : "border-milk-3 focus-within:border-ink-3")}>
          <span className="border-r border-milk-2 px-3.5 py-3 text-sm font-semibold text-ink-3">+91</span>
          <input value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }} inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile number" className="w-full rounded-r-xl bg-transparent px-3.5 py-3 text-[15px] focus:outline-none" />
        </div>
      </label>
      {err && <ErrorText>{err}</ErrorText>}
      <Button size="lg" type="submit" className="mt-6 w-full" disabled={busy}>{busy ? <Spinner /> : "Send code"}</Button>
      <p className="mt-4 text-center text-sm text-ink-soft">New to Cowland? <Link to="/" state={{ scrollTo: "areas" }} className="font-semibold text-ink hover:underline">Check if we deliver to you</Link></p>
    </form>
  );
}

/* ---------- Rider: ID + PIN ---------- */
function RiderForm({ onDone, fill }: { onDone: () => void; fill: number }) {
  const acc = accounts.rider;
  const [id, setId] = useState(acc.id);
  const [pin, setPin] = useState(acc.secret);
  useEffect(() => { if (fill) { setId(acc.id); setPin(acc.secret); setErr(""); } }, [fill, acc]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!id.trim() || pin.length !== 4) return setErr("Enter your rider ID and 4-digit PIN.");
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (id.trim().toUpperCase() === acc.id && pin === acc.secret) onDone();
      else setErr("Rider ID or PIN is wrong. Ask the hub to reset your PIN if you've forgotten it.");
    }, 600);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Rider ID</span>
        <input value={id} onChange={(e) => { setId(e.target.value); setErr(""); }} placeholder="On your badge" autoComplete="username" className={clsx(inputCls, "py-3", err && "border-brick")} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">PIN</span>
        <input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }} type="password" inputMode="numeric" autoComplete="current-password" placeholder="4 digits" className={clsx(inputCls, "py-3 tracking-[.4em]", err && "border-brick")} />
      </label>
      {err && <ErrorText>{err}</ErrorText>}
      <Button size="lg" type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : "Start my round"}</Button>
    </form>
  );
}

/* ---------- Hub staff: email + password ---------- */
function StaffForm({ onDone, fill }: { onDone: () => void; fill: number }) {
  const acc = accounts.admin;
  const [email, setEmail] = useState(acc.id);
  const [pw, setPw] = useState(acc.secret);
  useEffect(() => { if (fill) { setEmail(acc.id); setPw(acc.secret); setErr(""); } }, [fill, acc]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || !pw) return setErr("Enter your work email and password.");
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (email.trim().toLowerCase() === acc.id && pw === acc.secret) onDone();
      else setErr("Email or password is wrong.");
    }, 700);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Work email</span>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@cowland.in" autoComplete="username" className={clsx(inputCls, "py-3", err && "border-brick")} />
      </label>
      <label className="block">
        <span className="mb-1.5 flex justify-between text-sm font-semibold">Password <button type="button" onClick={() => toast("A reset link would be emailed to you. In this demo the password is shown below.", "info")} className="font-medium text-ink-3 hover:text-ink">Forgot?</button></span>
        <div className="relative">
          <input type={show ? "text" : "password"} value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} autoComplete="current-password" className={clsx(inputCls, "py-3 pr-11", err && "border-brick")} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-soft hover:bg-milk-2">
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
      {err && <ErrorText>{err}</ErrorText>}
      <Button size="lg" type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : "Sign in"}</Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-soft"><ShieldCheck size={14} /> Hub access is limited to Cowland staff</p>
    </form>
  );
}

/* ---------- Demo credentials ---------- */
function DemoAccounts({ role, onFill }: { role: Role; onFill: () => void }) {
  const [open, setOpen] = useState(false);
  const a = accounts[role];
  const rows: Record<Role, [string, string][]> = {
    customer: [["Mobile", a.id], ["OTP", a.secret]],
    rider: [["Rider ID", a.id], ["PIN", a.secret]],
    admin: [["Email", a.id], ["Password", a.secret]],
  };
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-milk-3 bg-white/60">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold">
        <span className="flex items-center gap-2"><KeyRound size={15} className="text-marigold-deep" /> Demo login for {a.label.toLowerCase()}</span>
        <ChevronDown size={16} className={clsx("transition", open && "rotate-180")} />
      </button>
      {open && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 pb-4 text-sm">
          {rows[role].map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-ink-soft">{k}</dt><dd className="font-mono font-semibold text-ink">{v}</dd></div>
          ))}
          <dd className="col-span-2 mt-1 text-xs text-ink-soft">Signs in as {a.name}, {a.sub}.</dd>
          <dd className="col-span-2 mt-2"><Button size="sm" variant="soft" type="button" onClick={onFill}>Fill in for me</Button></dd>
        </dl>
      )}
    </div>
  );
}
