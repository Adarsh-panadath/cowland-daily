import { useState } from "react";
import { orderTotal } from "../../store/rules";
import { Pause, Play, Megaphone, SunMedium } from "lucide-react";
import { useStore, volumeMl } from "../../store/useStore";
import { routes } from "../../data/seed";
import type { Stop } from "../../data/types";
import { Button, Field, Modal, inputCls } from "../../components/ui";
import { toast } from "../../store/toast";
import { demoAt } from "../../lib/format";

export function SimToggle() {
  const simOn = useStore((s) => s.simOn);
  const setSim = useStore((s) => s.setSim);
  return (
    <Button
      variant={simOn ? "soft" : "accent"}
      icon={simOn ? <Pause size={16} /> : <Play size={16} />}
      onClick={() => {
        setSim(!simOn);
        toast(simOn ? "Simulation paused." : "Simulation running. Riders on routes 01, 02, 03 and 05 will move on their own.", "info");
      }}
    >
      {simOn ? "Pause simulation" : "Run live simulation"}
    </Button>
  );
}

export function BroadcastButton() {
  const broadcast = useStore((s) => s.broadcast);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("Gate repair at CIDCO N-4 today. Use the rear entrance near the temple.");
  return (
    <>
      <Button variant="outline" icon={<Megaphone size={16} />} onClick={() => setOpen(true)}>Message riders</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Message all riders"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!text.trim()} onClick={() => { broadcast(text.trim()); toast("Sent to 5 riders. It shows in the rider app now."); setOpen(false); }}>Send to 5 riders</Button></>}>
        <Field label="Message" hint="Riders see this at the top of their round and as a notification.">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
        </Field>
      </Modal>
    </>
  );
}

export function routeStats(stops: Stop[]) {
  return routes.map((r) => {
    const all = stops.filter((s) => s.routeId === r.id);
    const rs = all.filter((s) => s.status !== "held"); // held orders aren't on the van
    const held = all.length - rs.length;
    const delivered = rs.filter((s) => s.status === "delivered");
    const issues = rs.filter((s) => s.status === "issue");
    const total = rs.length;
    const pct = total ? ((delivered.length + issues.length) / total) * 100 : 0;
    const litresPlanned = rs.reduce((s, x) => s + volumeMl(x.items), 0) / 1000;
    const litresDone = delivered.reduce((s, x) => s + volumeMl(x.delivered ?? x.items), 0) / 1000;
    const value = delivered.reduce((s, x) => s + (x.charged ?? orderTotal(x)), 0);
    const last = delivered.map((s) => s.at!).sort().at(-1);
    const remaining = total - delivered.length - issues.length;
    const eta = new Date((last ? new Date(last).getTime() : demoAt(5, 15).getTime()) + remaining * 2.6 * 60000);
    return { route: r, held, total, delivered: delivered.length, issues: issues.length, pct, litresPlanned, litresDone, value, remaining, eta, done: remaining === 0 };
  });
}

/** Demo clock: jump to the next delivery morning, building its orders from plans, skips and extras. */
export function NextMorningButton({ variant = "outline" }: { variant?: "outline" | "soft" }) {
  const advance = useStore((s) => s.advanceDay);
  const pending = useStore((s) => s.stops.filter((x) => x.status === "pending").length);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} icon={<SunMedium size={16} />} onClick={() => setOpen(true)}>Next delivery morning</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Move to the next delivery morning?"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { advance(); setOpen(false); toast("New delivery morning. Orders are built and the vans haven't left yet.", "info"); }}>Go to next morning</Button></>}>
        <div className="space-y-3 text-sm text-ink-3">
          <p>This demo clock jumps one day ahead. Every household's order for that morning is built from their regular order, plan changes, skipped days, vacations and extras.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Homes whose wallet can't cover the order are <b>held</b> and stay off the rider's list.</li>
            <li>Riders start again at the crate check. Tickets, wallets and history carry over.</li>
            {pending > 0 && <li>{pending} drop{pending === 1 ? " is" : "s are"} still pending this morning and won't be delivered or charged.</li>}
          </ul>
        </div>
      </Modal>
    </>
  );
}
