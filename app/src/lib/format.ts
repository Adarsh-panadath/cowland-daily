export const inr = (n: number, opts: { decimals?: boolean } = {}) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });

export const num = (n: number, d = 0) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const litres = (ml: number) => {
  const l = ml / 1000;
  return (Number.isInteger(l) ? l.toFixed(1) : l.toFixed(l * 10 === Math.round(l * 10) ? 1 : 2)) + " L";
};

/** Local-date key, YYYY-MM-DD */
export const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/* ---------- demo clock ----------
 * The prototype runs on the real time of day, shifted forward by whole days when the presenter
 * moves the demo to the next delivery morning. Every date-sensitive rule reads this one clock. */
let demoOffsetDays = 0;
export const setDemoOffset = (n: number) => { demoOffsetDays = n; };
export const getDemoOffset = () => demoOffsetDays;
export const demoNow = () => addDays(new Date(), demoOffsetDays);
/** Demo date at a given time of day */
export const demoAt = (h: number, m: number, s = 0) => { const d = demoNow(); d.setHours(h, m, s, 0); return d; };
export const todayKey = () => dayKey(demoNow());
export const tomorrowKey = () => dayKey(addDays(demoNow(), 1));
/** Orders for tomorrow lock at 10 PM tonight (prototype policy, Asia/Kolkata). */
export const CUTOFF_HOUR = 22;
const istHour = () => new Date(Date.now() + 330 * 60000).getUTCHours();
export const isLockedDate = (k: string) => {
  const t = tomorrowKey();
  if (k < t) return true;
  return k === t && istHour() >= CUTOFF_HOUR;
};
/** The first delivery date a customer can still change */
export const firstEditableDate = () => (istHour() >= CUTOFF_HOUR ? dayKey(addDays(demoNow(), 2)) : tomorrowKey());

export const weekday = (k: string, style: "short" | "long" = "short") =>
  fromKey(k).toLocaleDateString("en-IN", { weekday: style });

export const dayMonth = (k: string) =>
  fromKey(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const longDate = (k: string) =>
  fromKey(k).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

export const clock = (iso: string | number | Date) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

export const timeAgo = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const uid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
