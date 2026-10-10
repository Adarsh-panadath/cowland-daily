import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Bell, CalendarDays, ShoppingBasket, Wallet, ReceiptText, LifeBuoy, Route as RouteIcon, BarChart3,
  LayoutDashboard, Users, TriangleAlert, FlaskConical, RotateCcw, Truck, X, CheckCircle2, Info, LogOut, ChevronDown, ChartNoAxesCombined, MapPinned, Database } from "lucide-react";
import { useStore, useAccount } from "../../store/useStore";
import { accounts } from "../../lib/auth";
import { toast, useToast } from "../../store/toast";
import type { Role } from "../../data/types";
import { Avatar, Badge } from "../ui";
import { Logo } from "../Logo";
import { timeAgo } from "../../lib/format";

type NavItem = { to: string; label: string; short?: string; icon: ReactNode; end?: boolean };

const nav: Record<Role, NavItem[]> = {
  customer: [
    { to: "/customer", label: "My deliveries", short: "Home", icon: <CalendarDays size={18} />, end: true },
    { to: "/customer/shop", label: "Shop", icon: <ShoppingBasket size={18} /> },
    { to: "/customer/wallet", label: "Wallet", icon: <Wallet size={18} /> },
    { to: "/customer/history", label: "Bills", icon: <ReceiptText size={18} /> },
    { to: "/customer/help", label: "Help", icon: <LifeBuoy size={18} /> },
  ],
  rider: [
    { to: "/rider", label: "Today's homes", short: "Today", icon: <RouteIcon size={18} />, end: true },
    { to: "/rider/summary", label: "My earnings", short: "Earnings", icon: <BarChart3 size={18} /> },
  ],
  admin: [
    { to: "/admin", label: "Overview", short: "Home", icon: <LayoutDashboard size={18} />, end: true },
    { to: "/admin/analytics", label: "Analytics", short: "Stats", icon: <ChartNoAxesCombined size={18} /> },
    { to: "/admin/routes", label: "Live routes", short: "Routes", icon: <Truck size={18} /> },
    { to: "/admin/tickets", label: "Tickets", icon: <TriangleAlert size={18} /> },
    { to: "/admin/customers", label: "Customers", short: "People", icon: <Users size={18} /> },
    { to: "/admin/demand", label: "Demand", icon: <MapPinned size={18} /> },
    { to: "/admin/data", label: "Database", short: "Data", icon: <Database size={18} /> },
    { to: "/admin/quality", label: "Milk quality", short: "Quality", icon: <FlaskConical size={18} /> },
  ],
};

const roleMeta: Record<Role, { label: string; home: string }> = {
  customer: { label: "Customer", home: "/customer" },
  rider: { label: "Rider", home: "/rider" },
  admin: { label: "Hub team", home: "/admin" },
};

function useSimulation() {
  const simOn = useStore((s) => s.simOn);
  const tick = useStore((s) => s.tick);
  useEffect(() => {
    if (!simOn) return;
    // only the tab you're looking at drives the simulation
    const t = setInterval(() => { if (!document.hidden) tick(); }, 2200);
    return () => clearInterval(t);
  }, [simOn, tick]);
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, {now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
    </span>
  );
}

function Who({ role }: { role: Role }) {
  const acc = useAccount(role);
  return (
    <div className="flex items-center gap-3">
      <Avatar text={acc.initials} color={acc.color} />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-semibold text-white">{acc.name}</p>
        <p className="truncate text-xs text-white/60">{acc.sub}</p>
      </div>
    </div>
  );
}

function AccountMenu({ role }: { role: Role }) {
  const acc = useAccount(role);
  const [confirmReset, setConfirmReset] = useState(false);
  const signOut = useStore((s) => s.signOut);
  const reset = useStore((s) => s.reset);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const out = () => { signOut(); nav("/login?role=" + role, { replace: true }); };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-milk-2">
        <Avatar text={acc.initials} color={acc.color} size={34} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-semibold text-ink">{acc.name}</span>
          <span className="block text-xs text-ink-soft">{acc.label}</span>
        </span>
        <ChevronDown size={16} className={clsx("hidden text-ink-soft transition md:block", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-72 animate-rise rounded-2xl bg-white p-2 shadow-pop">
          <div className="flex items-center gap-3 rounded-xl bg-milk p-3">
            <Avatar text={acc.initials} color={acc.color} size={40} />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold text-ink">{acc.name}</p>
              <p className="truncate text-xs text-ink-soft">{acc.sub}</p>
              <p className="mt-1 truncate text-xs text-ink-3">{role === "customer" ? `+91 ${acc.id}` : role === "rider" ? `Rider ID ${acc.id}` : acc.id}</p>
            </div>
          </div>
          <a role="menuitem" href="#/data" target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-milk">
            <Database size={16} className="text-ink-soft" /> Open demo database
          </a>
          {confirmReset ? (
            <div className="mt-1 rounded-xl border border-brick/30 p-3">
              <p className="text-sm font-semibold text-ink">Reset all demo data?</p>
              <p className="mt-0.5 text-xs text-ink-soft">This clears every change, ticket, new sign-up and waitlist entry made in this browser, and goes back to the first demo morning.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-lg bg-milk-2 py-1.5 text-sm font-semibold text-ink">Keep</button>
                <button onClick={() => { const newUser = role === "customer" && acc.id !== accounts.customer.id; reset(); setOpen(false); setConfirmReset(false); toast("Demo data reset.", "info"); if (newUser) nav("/login?role=customer", { replace: true }); }} className="flex-1 rounded-lg bg-brick py-1.5 text-sm font-semibold text-white">Reset</button>
              </div>
            </div>
          ) : (
            <button role="menuitem" onClick={() => setConfirmReset(true)} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-milk">
              <RotateCcw size={16} className="text-ink-soft" /> Reset demo data
            </button>
          )}
          <button role="menuitem" onClick={out} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-brick hover:bg-brick-soft">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Notifications({ role }: { role: Role }) {
  const notices = useStore((s) => s.notices.filter((n) => n.role === role));
  const markRead = useStore((s) => s.markRead);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notices.filter((n) => !n.read).length;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setTimeout(() => markRead(role), 1500);
        }}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-ink hover:bg-milk-2"
      >
        <Bell size={19} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brick px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] animate-rise rounded-2xl bg-white p-2 shadow-pop">
          <p className="px-3 pb-1 pt-2 font-display font-semibold text-ink">Updates</p>
          {notices.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-soft">Nothing new.</p>}
          <ul className="max-h-80 overflow-y-auto">
            {notices.slice(0, 12).map((n) => (
              <li key={n.id} className={clsx("flex gap-3 rounded-xl px-3 py-2.5", !n.read && "bg-milk")}>
                <span className={clsx("mt-0.5", n.tone === "good" ? "text-neem" : n.tone === "warn" ? "text-marigold-deep" : "text-ink-3")}>
                  {n.tone === "good" ? <CheckCircle2 size={16} /> : n.tone === "warn" ? <TriangleAlert size={16} /> : <Info size={16} />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{n.text}</p>
                  <p className="text-xs text-ink-soft">{timeAgo(n.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-3 lg:bottom-6" aria-live="polite">
      {toasts.map((t, i) => (
        <div key={t.id} className={clsx("pointer-events-auto w-full max-w-md animate-rise", i < toasts.length - 1 ? "hidden sm:flex" : "flex")} data-toast><div className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-pop">
          <span className={t.tone === "good" ? "text-[#7BD3A8]" : t.tone === "warn" ? "text-marigold" : "text-[#9DB4FF]"}>
            {t.tone === "good" ? <CheckCircle2 size={18} /> : t.tone === "warn" ? <TriangleAlert size={18} /> : <Info size={18} />}
          </span>
          <p className="flex-1">{t.text}</p>
          {t.action && (
            <button className="font-semibold text-marigold hover:underline" onClick={() => { t.action!.run(); dismiss(t.id); }}>
              {t.action.label}
            </button>
          )}
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-white/60 hover:text-white">
            <X size={16} />
          </button>
        </div></div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useSimulation();
  const role = useStore((s) => s.session) ?? "customer";
  const signOut = useStore((s) => s.signOut);
  const go = useNavigate();
  const loc = useLocation();
  const items = nav[role];
  const simOn = useStore((s) => s.simOn);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const current = items.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to))) ?? items[0]!;

  return (
    <div className="min-h-screen bg-milk lg:pl-[272px] print:pl-0">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] print:!hidden flex-col bg-ink px-4 py-5 text-white lg:flex">
        <Link to="/" className="mb-6 flex items-center gap-2.5 px-2" aria-label="Cowland Daily home">
          <Logo light />
        </Link>
        <div className="rounded-2xl bg-white/[.06] p-3">
          <p className="mb-2 text-xs font-semibold text-white/50">{accounts[role].label} account</p>
          <Who role={role} />
        </div>
        <nav className="mt-5 flex flex-col gap-1" aria-label={`${roleMeta[role].label} navigation`}>
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition", isActive ? "bg-marigold text-ink" : "text-white/75 hover:bg-white/[.07] hover:text-white")
              }
            >
              {i.icon}
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          {simOn && (
            <div className="flex items-center gap-2 rounded-xl bg-neem/25 px-3 py-2 text-xs text-white/90">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7BD3A8] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#7BD3A8]" /></span>
              Live simulation running
            </div>
          )}
          <p className="px-1 text-xs leading-relaxed text-white/50">Prototype with sample data. Changes are saved in this browser.</p>
          <a href="#/data" target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl px-1 py-1.5 text-sm font-semibold text-marigold hover:underline"><Database size={15} /> Demo database</a>
          <button onClick={() => { signOut(); go("/login?role=" + role, { replace: true }); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/[.07] hover:text-white">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b print:hidden border-milk-2 bg-milk/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="lg:hidden" aria-label="Cowland Daily home"><Logo compact /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold text-ink lg:text-xl">{current.label}</p>
            <p className="hidden text-xs text-ink-soft sm:block"><LiveClock /></p>
          </div>
          {simOn && <Badge tone="good" dot className="hidden sm:inline-flex lg:hidden">Live</Badge>}
          <Notifications role={role} />
          <AccountMenu role={role} />
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-7">{children}</main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t print:hidden border-milk-2 bg-white/95 backdrop-blur lg:hidden" aria-label="Sections">
        <div className="mx-auto flex max-w-lg justify-around px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => clsx("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 font-semibold", items.length > 5 ? "px-0 text-[10px]" : "px-1 text-[11px]", isActive ? "text-ink" : "text-ink-soft")}>
              {({ isActive }) => (
                <>
                  <span className={clsx("grid h-7 place-items-center rounded-full", items.length > 5 ? "w-9" : "w-11", isActive && "bg-marigold-soft")}>{i.icon}</span>
                  <span className="w-full truncate text-center">{i.short ?? i.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster />
    </div>
  );
}

export { Toaster };
