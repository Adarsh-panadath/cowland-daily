import { useState } from "react";
import { Pause, Play, Megaphone } from "lucide-react";
import { useStore, lineTotal, volumeMl } from "../../store/useStore";
import { routes } from "../../data/seed";
import type { Stop } from "../../data/types";
import { Button, Field, Modal, inputCls } from "../../components/ui";
import { toast } from "../../store/toast";

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
    const rs = stops.filter((s) => s.routeId === r.id);
    const delivered = rs.filter((s) => s.status === "delivered");
    const issues = rs.filter((s) => s.status === "issue");
    const total = rs.length;
    const pct = total ? ((delivered.length + issues.length) / total) * 100 : 0;
    const litresPlanned = rs.reduce((s, x) => s + volumeMl(x.items), 0) / 1000;
    const litresDone = delivered.reduce((s, x) => s + volumeMl(x.items), 0) / 1000;
    const value = delivered.reduce((s, x) => s + lineTotal(x.items), 0);
    const last = delivered.map((s) => s.at!).sort().at(-1);
    const remaining = total - delivered.length - issues.length;
    const eta = new Date((last ? new Date(last).getTime() : Date.now()) + remaining * 2.6 * 60000);
    return { route: r, total, delivered: delivered.length, issues: issues.length, pct, litresPlanned, litresDone, value, remaining, eta, done: remaining === 0 };
  });
}
