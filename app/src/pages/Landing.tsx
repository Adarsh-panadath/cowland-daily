import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, ShieldCheck, Recycle, Clock3, ArrowUpRight, Smartphone, Truck, LayoutDashboard, Check } from "lucide-react";
import { Logo } from "../components/Logo";
import { DawnJourney } from "../components/DawnJourney";
import { ProductArt } from "../components/ProductArt";
import { products, routes, seedCustomers } from "../data/seed";
import { useStore } from "../store/useStore";
import { inr } from "../lib/format";
import { Avatar, Button, Stepper } from "../components/ui";
import { accounts } from "../lib/auth";
import type { Role } from "../data/types";

const onRoute = (r: string) => seedCustomers.filter((c) => c.routeId === r).length;
const areas = [
  { id: "samarth", name: "Samarth Nagar, Nirala Bazar", route: "r4", slots: 6, homes: onRoute("r4") },
  { id: "cidco", name: "CIDCO N-1 to N-6", route: "r2", slots: 4, homes: onRoute("r2") },
  { id: "station", name: "Station Road, Kranti Chowk", route: "r1", slots: 2, homes: onRoute("r1") },
  { id: "ulka", name: "Ulkanagari, Beed Bypass", route: "r3", slots: 7, homes: onRoute("r3") },
  { id: "jalna", name: "Jalna Road, Mukundwadi", route: "r5", slots: 9, homes: onRoute("r5") },
  { id: "satara", name: "Satara Parisar", route: "", slots: 0, homes: 48 },
];

function useOpen() {
  const session = useStore((s) => s.session);
  const nav = useNavigate();
  return (r: Role) => {
    if (session === r) nav(accounts[r].home);
    else nav(`/login?role=${r}`);
  };
}

export default function Landing() {
  const open = useOpen();
  const [area, setArea] = useState(areas[0]!.id);
  const a = areas.find((x) => x.id === area)!;
  const r = routes.find((x) => x.id === a.route);
  const [bottles, setBottles] = useState(2);
  const [curd, setCurd] = useState(true);
  const perDay = bottles * 48 + (curd ? 55 : 0);

  return (
    <div className="bg-milk text-ink">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5">
          <Logo light />
          <nav className="hidden items-center gap-7 text-sm font-medium text-white/80 md:flex" aria-label="Main">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#products" className="hover:text-white">What we deliver</a>
            <a href="#areas" className="hover:text-white">Areas</a>
            <a href="#prototype" className="hover:text-white">Inside the app</a>
          </nav>
          <HeaderAccount />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink pb-16 pt-28 text-white sm:pb-24 sm:pt-32" id="how">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-ink-2 opacity-60 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="font-mr text-lg text-marigold">छत्रपती संभाजीनगर</p>
            <h1 className="mt-3 font-display text-[44px] font-bold leading-[1.02] tracking-[-0.02em] sm:text-[64px]">
              Milked at 3:15.
              <br />
              At your door by 6.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-white/75">
              Cowland Daily brings raw-chilled A2 milk, matka dahi and bilona ghee from our Khuldabad farm to your doorstep before the city wakes up. Plan your week, skip a day or add extra for guests, right up to 10 PM the night before.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="accent" onClick={() => open("customer")}>Plan my milk</Button>
              <a href="#prototype" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">
                Tour the three apps
              </a>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {[[String(seedCustomers.length), "homes on five routes"], ["98.4%", "drops before 6:15 AM"], ["0", "preservatives, ever"]].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-3xl font-bold tabular">{v}</dd>
                  <dd className="mt-1 text-xs leading-snug text-white/60">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <DawnJourney />
        </div>
      </section>

      {/* Promise row */}
      <section className="border-b border-milk-2 bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Clock3 size={20} />, t: "Change plans till 10 PM", b: "Skip, pause or add extra for tomorrow from the app." },
            { icon: <ShieldCheck size={20} />, t: "Lab report on every chit", b: "Fat, SNF and adulteration results for each morning's batch." },
            { icon: <Recycle size={20} />, t: "Glass and clay, returned", b: "Riders collect empties. We sterilise and reuse them." },
            { icon: <MapPin size={20} />, t: "Quiet doorstep drop", b: "No doorbell before 6:30 unless you ask for one." },
          ].map((x) => (
            <div key={x.t} className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marigold-soft text-marigold-deep">{x.icon}</span>
              <div>
                <p className="font-semibold">{x.t}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{x.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Products */}
      <section id="products" className="mx-auto max-w-[1200px] px-5 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-display text-4xl font-bold tracking-tight">What comes in the crate</h2>
            <p className="mt-3 text-ink-soft">Everything is made from the same morning's milk, or the day before for dahi and paneer. Prices include delivery.</p>
          </div>
          <Link to="/customer/shop" className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-4">
            See the full shop <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.filter((p) => ["a2", "buff", "dahi", "ghee"].includes(p.id)).map((p) => (
            <article key={p.id} className="group rounded-3xl bg-white p-5 shadow-lift">
              <ProductArt product={p} size={96} />
              <p className="mt-4 font-mr text-sm text-ink-soft">{p.mr}</p>
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">{p.size}</p>
              <p className="mt-4 font-display text-2xl font-bold tabular">{inr(p.price)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Plan calculator + Area checker */}
      <section id="areas" className="bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-20 lg:grid-cols-2">
          <div className="rounded-3xl bg-milk p-7">
            <h2 className="font-display text-3xl font-bold tracking-tight">What a month costs</h2>
            <p className="mt-2 text-ink-soft">Pick a daily order. You pay from a prepaid wallet, only for days we deliver.</p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
                <div>
                  <p className="font-semibold">A2 milk, 500 ml bottles</p>
                  <p className="text-sm text-ink-soft">{inr(48)} each</p>
                </div>
                <Stepper value={bottles} onChange={setBottles} min={1} max={8} label="bottles" />
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-white p-4">
                <div>
                  <p className="font-semibold">Matka dahi, 400 g</p>
                  <p className="text-sm text-ink-soft">{inr(55)} a day</p>
                </div>
                <input type="checkbox" checked={curd} onChange={(e) => setCurd(e.target.checked)} className="h-5 w-5 accent-[#14213D]" />
              </label>
            </div>
            <div className="mt-6 flex items-end justify-between border-t border-milk-3 pt-5">
              <div>
                <p className="text-sm text-ink-soft">About 30 deliveries</p>
                <p className="font-display text-4xl font-bold tabular">{inr(perDay * 30)}</p>
              </div>
              <p className="text-right text-sm text-ink-soft">{inr(perDay)} a day<br />{(bottles * 0.5).toFixed(1)} L of milk</p>
            </div>
          </div>

          <div className="rounded-3xl bg-ink p-7 text-white">
            <h2 className="font-display text-3xl font-bold tracking-tight">Do we come to you?</h2>
            <p className="mt-2 text-white/70">Choose your area to see when milk reaches your door.</p>
            <label className="mt-6 block">
              <span className="sr-only">Your area</span>
              <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded-xl border-0 bg-white/10 px-4 py-3 text-white focus:ring-2 focus:ring-marigold">
                {areas.map((x) => <option key={x.id} value={x.id} className="text-ink">{x.name}</option>)}
              </select>
            </label>
            {r ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-neem text-white"><Check size={20} /></span>
                  <div>
                    <p className="font-semibold">Yes, Route {r.code} covers this area</p>
                    <p className="text-sm text-white/60">Milk arrives between {r.window}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/[.06] p-4"><p className="font-display text-2xl font-bold tabular">{a.homes}</p><p className="text-sm text-white/60">homes already on this route</p></div>
                  <div className="rounded-2xl bg-white/[.06] p-4"><p className="font-display text-2xl font-bold tabular text-marigold">{a.slots}</p><p className="text-sm text-white/60">spots open this month</p></div>
                </div>
                <Button variant="accent" onClick={() => open("customer")}>Start delivery here</Button>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white/[.06] p-5">
                <p className="font-semibold">Not yet, but soon</p>
                <p className="mt-1 text-sm text-white/70">{a.homes} families in {a.name} are on the waitlist. We open a new route once 60 sign up.</p>
                <Progress60 value={a.homes} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Prototype portals */}
      <section id="prototype" className="mx-auto max-w-[1200px] px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-bold tracking-tight">One morning, three apps</h2>
          <p className="mt-3 text-ink-soft">Each app has its own sign-in, and all three share the same sample data. Report a missing bottle as a customer and it lands in the hub's ticket queue. Mark a drop as delivered in the rider app and the family's wallet updates. Demo logins are shown on the sign-in screen.</p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {[
            { r: "customer" as Role, icon: <Smartphone size={22} />, t: "Customer app", who: "The Deshmukh family, Anand Vihar", b: "A two-week milk diary, skip and vacation controls, a shop that adds to tomorrow's crate, wallet top-ups and help tickets.", c: "#F2A900" },
            { r: "rider" as Role, icon: <Truck size={22} />, t: "Rider app", who: "Ganesh Shinde, Route 04", b: "Door-by-door drop list in route order, bottle returns, crate stock that counts down, and one-tap problem reports.", c: "#2F7D5B" },
            { r: "admin" as Role, icon: <LayoutDashboard size={22} />, t: "Hub dashboard", who: "Dispatch team, Samarth Nagar", b: "Live route progress, a simulation you can switch on, ticket handling with refunds, customers and daily lab results.", c: "#6C8EF5" },
          ].map((x) => (
            <button key={x.r} onClick={() => open(x.r)} className="group flex flex-col rounded-3xl bg-white p-6 text-left shadow-lift transition hover:-translate-y-0.5 hover:shadow-pop">
              <span className="grid h-12 w-12 place-items-center rounded-2xl text-ink" style={{ background: x.c }}>{x.icon}</span>
              <span className="mt-5 font-display text-2xl font-semibold">{x.t}</span>
              <span className="mt-0.5 text-sm font-medium text-ink-3">{x.who}</span>
              <span className="mt-3 text-sm leading-relaxed text-ink-soft">{x.b}</span>
              <span className="mt-6 inline-flex items-center gap-1 font-semibold text-ink">Sign in to the {x.t.toLowerCase()} <ArrowUpRight size={16} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
            </button>
          ))}
        </div>
      </section>

      <footer className="bg-ink text-white/70">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-12 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo light />
            <p className="mt-4 max-w-sm text-sm">Hub office: Station Road, opposite Kranti Chowk, Chhatrapati Sambhajinagar 431001. Helpline +91 240 2345 890.</p>
          </div>
          <p className="max-w-sm text-sm">A product prototype with sample data, built to explore how a dawn milk subscription could work for customers, riders and the hub.</p>
        </div>
      </footer>
    </div>
  );
}

function Progress60({ value }: { value: number }) {
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-marigold" style={{ width: `${Math.min(100, (value / 60) * 100)}%` }} /></div>
      <p className="mt-2 text-xs text-white/60">{value} of 60 needed</p>
    </div>
  );
}

function HeaderAccount() {
  const session = useStore((s) => s.session);
  const nav = useNavigate();
  if (session) {
    const a = accounts[session];
    return (
      <button onClick={() => nav(a.home)} className="flex items-center gap-2.5 rounded-xl bg-white/10 py-1.5 pl-1.5 pr-4 text-left text-white hover:bg-white/15">
        <Avatar text={a.initials} color={a.color} size={32} />
        <span className="leading-tight"><span className="block text-sm font-semibold">Go to my app</span><span className="block text-xs text-white/60">{a.name}</span></span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link to="/login" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:block">Sign in</Link>
      <Button variant="accent" onClick={() => nav("/login?role=customer")}>Get started</Button>
    </div>
  );
}
