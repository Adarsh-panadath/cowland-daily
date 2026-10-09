import { useEffect, useState } from "react";
import { PhoneOff, PhoneCall, ShieldCheck } from "lucide-react";
import { Avatar } from "./ui";
import { initials } from "../lib/format";

/**
 * In-app calling, the way delivery apps mask numbers. This prototype doesn't dial a real phone,
 * so the sheet says so instead of opening a tel: link to a made-up number.
 */
export function CallSheet({ name, sub, onClose, color = "#2B3A67" }: { name: string | null; sub?: string; onClose: () => void; color?: string }) {
  const [stage, setStage] = useState<"connecting" | "ringing" | "live">("connecting");
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!name) return;
    setStage("connecting");
    setSecs(0);
    const a = setTimeout(() => setStage("ringing"), 900);
    const b = setTimeout(() => setStage("live"), 2600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [name]);
  useEffect(() => {
    if (stage !== "live") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);
  useEffect(() => {
    if (!name) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [name, onClose]);
  if (!name) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={`Call with ${name}`}>
      <div className="w-full max-w-sm animate-rise rounded-[28px] bg-ink p-7 text-center text-white shadow-pop">
        <div className="mx-auto w-fit"><Avatar text={initials(name)} color={color} size={84} /></div>
        <p className="mt-4 font-display text-2xl font-bold">{name}</p>
        {sub && <p className="text-sm text-white/60">{sub}</p>}
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-white/80" aria-live="polite">
          <PhoneCall size={15} className={stage !== "live" ? "animate-pulse" : ""} />
          {stage === "connecting" ? "Connecting…" : stage === "ringing" ? "Ringing…" : `On call ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}
        </p>
        <p className="mx-auto mt-5 flex max-w-[16rem] items-start gap-2 rounded-xl bg-white/[.07] p-3 text-left text-xs text-white/70">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#7BD3A8]" />
          Calls go through a masked Cowland line, so nobody sees the other person's number. Demo call, no phone is dialled.
        </p>
        <button onClick={onClose} className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full bg-brick text-white hover:brightness-110" aria-label="End call">
          <PhoneOff size={26} />
        </button>
      </div>
    </div>
  );
}
