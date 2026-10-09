import clsx from "clsx";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#F2A900" />
      <path d="M15 8h10v4l3 5v14a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V17l3-5z" fill="#F6F7F9" stroke="#14213D" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12.5 22h15v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" fill="#14213D" />
      <circle cx="20" cy="27" r="2.6" fill="#F2A900" />
    </svg>
  );
}

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={compact ? 30 : 34} />
      {!compact && (
        <span className="leading-none">
          <span className={clsx("block font-display text-[19px] font-bold tracking-tight", light ? "text-white" : "text-ink")}>Cowland Daily</span>
          <span className={clsx("mt-0.5 block font-mr text-[12px]", light ? "text-white/60" : "text-ink-soft")}>गोकुळ ताजं दूध</span>
        </span>
      )}
    </span>
  );
}
