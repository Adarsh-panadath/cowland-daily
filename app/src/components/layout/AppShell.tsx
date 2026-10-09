import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Bell, CalendarDays, ShoppingBasket, Wallet, ReceiptText, LifeBuoy, Route as RouteIcon, BarChart3,
  LayoutDashboard, Users, TriangleAlert, FlaskConical, RotateCcw, Truck, Home, X, CheckCircle2, Info,
} from "lucide-react";
import { useStore, useMe } from "../../store/useStore";
import { useToast } from "../../store/toast";
import type { Role } from "../../data/types";
import { riderById, routeById } from "../../data/seed";
import { Avatar, Badge } from "../ui";
import { Logo } from "../Logo";
import { initials, timeAgo } from "../../lib/format";

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
    { to: "/rider", label: "Today's round", short: "Round", icon: <RouteIcon size={18} />, end: true },
    { to: "/rider/summary", label: "Shift summary", short: "Summary", icon: <BarChart3 size={18} /> },
  ],
  admin: [
    { to: "/admin", label: "Overview", icon: <LayoutDashboard size={18} />, end: true },
    { to: "/admin/routes", label: "Live routes", short: "Routes", icon: <Truck size={18} /> },
    { to: "/admin/tickets", label: "Tickets", icon: <TriangleAlert size={18} /> },
    { to: "/admin/customers", label: "Customers", icon: <Users size={18} /> },
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
    const t = setInterval(tick, 2200);
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

export function RoleSwitch({ compact }: { compact?: boolean }) {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const navigate = useNavigate();
  return (
    <div className={clsx("grid grid-cols-3 rounded-xl bg-white/10 p-1", compact && "bg-milk-2")} role="tablist" aria-label="Switch portal">
      {(Object.keys(roleMeta) as Role[]).map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={role === r}
          onClick={() => {
            setRole(r);
            navigate(roleMeta[r].home);
          }}
          className={clsx(
            "rounded-lg px-2 py-1.5 text-[13px] font-semibold transition",
            compact
              ? role === r ? "bg-white text-ink shadow-sm" : "text-ink-soft"
              : role === r ? "bg-white text-ink" : "text-white/70 hover:text-white",
          )}
        >
          {roleMeta[r].label}
        </button>
      ))}
    </div>
  );
}

function Who({ role }: { role: Role }) {
  const me = useMe();
  if (role === "customer")
    return (
      <div className="flex items-center gap-3">
        <Avatar text="AD" color="#F2A900" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-semibold text-white">{me.contact}</p>
          <p className="truncate text-xs text-white/60">{me.flat}, {me.society}</p>
        </div>
      </div>
    );
  if (role === "rider") {
    const r = riderById["rd4"]!;
    return (
      <div className="flex items-center gap-3">
        <Avatar text={initials(r.name)} color="#2F7D5B" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-semibold text-white">{r.name}</p>
          <p className="truncate text-xs text-white/60">Route {routeById["r4"]!.code}, {r.vehicle}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar text="MK" color="#6C8EF5" />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-semibold text-white">Mahesh Kale</p>
        <p className="truncate text-xs text-white/60">Dispatch lead, Samarth Nagar hub</p>
      </div>
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
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex w-full max-w-md animate-rise items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-pop">
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
        </div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useSimulation();
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const reset = useStore((s) => s.reset);
  const loc = useLocation();
  const items = nav[role];
  const simOn = useStore((s) => s.simOn);

  // keep role in sync with the URL (deep links, back button)
  useEffect(() => {
    const seg = loc.pathname.split("/")[1] as Role;
    if (seg && seg in roleMeta && seg !== role) setRole(seg);
    window.scrollTo({ top: 0 });
  }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = items.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to))) ?? items[0]!;

  return (
    <div className="min-h-screen bg-milk lg:pl-[272px]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col bg-ink px-4 py-5 text-white lg:flex">
        <Link to="/" className="mb-6 flex items-center gap-2.5 px-2" aria-label="Cowland Daily home">
          <Logo light />
        </Link>
        <RoleSwitch />
        <div className="mt-5 rounded-2xl bg-white/[.06] p-3">
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
          <button onClick={reset} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/[.07] hover:text-white">
            <RotateCcw size={16} /> Reset demo data
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-milk-2 bg-milk/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="lg:hidden" aria-label="Cowland Daily home"><Logo compact /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold text-ink lg:text-xl">{current.label}</p>
            <p className="hidden text-xs text-ink-soft sm:block"><LiveClock /></p>
          </div>
          <div className="hidden sm:block lg:hidden"><RoleSwitch compact /></div>
          {simOn && <Badge tone="good" dot className="hidden sm:inline-flex lg:hidden">Live</Badge>}
          <Notifications role={role} />
        </div>
        <div className="px-4 pb-3 sm:hidden"><RoleSwitch compact /></div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-7">{children}</main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-milk-2 bg-white/95 backdrop-blur lg:hidden" aria-label="Sections">
        <div className="mx-auto flex max-w-lg justify-around px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => clsx("flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold", isActive ? "text-ink" : "text-ink-soft")}>
              {({ isActive }) => (
                <>
                  <span className={clsx("grid h-7 w-12 place-items-center rounded-full", isActive && "bg-marigold-soft")}>{i.icon}</span>
                  {i.short ?? i.label}
                </>
              )}
            </NavLink>
          ))}
          <Link to="/" className="flex min-w-[56px] flex-col items-center gap-1 px-2 py-1 text-[11px] font-semibold text-ink-soft">
            <span className="grid h-7 w-12 place-items-center"><Home size={18} /></span>Site
          </Link>
        </div>
      </nav>
      <Toaster />
    </div>
  );
}

export { Toaster };
