import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { Minus, Plus, X } from "lucide-react";

/* ---------- Button ---------- */
type BtnVariant = "primary" | "ghost" | "soft" | "accent" | "danger" | "outline";
export function Button({
  variant = "primary",
  size = "md",
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold [&_svg]:shrink-0 transition active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marigold",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-[15px]",
        variant === "primary" && "bg-ink text-white hover:bg-ink-2",
        variant === "accent" && "bg-marigold text-ink hover:brightness-105",
        variant === "soft" && "bg-milk-2 text-ink hover:bg-milk-3",
        variant === "ghost" && "text-ink-2 hover:bg-milk-2",
        variant === "outline" && "border border-milk-3 bg-white text-ink hover:border-ink-3",
        variant === "danger" && "bg-brick-soft text-brick hover:bg-brick hover:text-white",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  const c = className ?? "";
  return <As className={clsx("rounded-2xl", !/(^|\s)bg-/.test(c) && "bg-white", !/(^|\s)shadow-/.test(c) && "shadow-lift", c)}>{children}</As>;
}

export function CardHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold leading-tight text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */
type Tone = "neutral" | "good" | "warn" | "bad" | "ink" | "accent";
export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-milk-2 text-ink-3",
        tone === "good" && "bg-neem-soft text-neem-deep",
        tone === "warn" && "bg-marigold-soft text-marigold-deep",
        tone === "bad" && "bg-brick-soft text-brick",
        tone === "ink" && "bg-ink text-white",
        tone === "accent" && "bg-marigold text-ink",
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, color, className, height = 8 }: { value: number; color?: string; className?: string; height?: number }) {
  return (
    <div className={clsx("w-full overflow-hidden rounded-full bg-milk-2", className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color ?? "#2F7D5B" }} />
    </div>
  );
}

/* ---------- Stepper ---------- */
export function Stepper({ value, onChange, min = 0, max = 20, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-milk-2 p-1">
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-ink hover:bg-white disabled:opacity-30">
        <Minus size={16} />
      </button>
      <span className="w-8 text-center font-semibold tabular-nums text-ink" aria-live="polite">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-ink hover:bg-white disabled:opacity-30">
        <Plus size={16} />
      </button>
    </div>
  );
}

/* ---------- Segmented ---------- */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-milk-2 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("rounded-lg px-3 py-1.5 text-sm font-semibold transition", value === o.value ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx("relative max-h-[92vh] w-full animate-rise overflow-y-auto rounded-t-3xl bg-white shadow-pop sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-6 pb-3 pt-5 backdrop-blur">
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-milk-2">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-milk-2 bg-white px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Drawer ---------- */
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-ink/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slidein flex-col bg-white shadow-pop">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-milk-2">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6">{children}</div>
        {footer && <div className="border-t border-milk-2 px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}

/* ---------- Field helpers ---------- */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}
export const inputCls =
  "w-full rounded-xl border border-milk-3 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus:border-ink-3 focus:outline-none focus:ring-2 focus:ring-marigold/40";

/* ---------- Empty ---------- */
export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-milk-2 text-ink-3">{icon}</div>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-ink-soft">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ text, color = "#2B3A67", size = 36 }: { text: string; color?: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ background: color, width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {text}
    </span>
  );
}
