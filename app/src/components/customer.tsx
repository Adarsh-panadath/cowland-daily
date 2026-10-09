import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, CheckCircle2, Smartphone, CreditCard, Landmark } from "lucide-react";
import { Button, Field, Modal, Stepper, inputCls } from "./ui";
import { useStore, kindLabel, lineTotal } from "../store/useStore";
import { productById, riderById, routeById, seedBatches } from "../data/seed";
import type { ExceptionKind, Stop } from "../data/types";
import { clock, inr } from "../lib/format";
import { toast } from "../store/toast";

/* ---------- Paavti: the daily milk chit ---------- */
export function Paavti({ stop, onReport }: { stop: Stop | undefined; onReport: () => void }) {
  const confirm = useStore((s) => s.confirmReceived);
  const batch = seedBatches[0]!;
  if (!stop) return null;
  const route = routeById[stop.routeId]!;
  const rider = riderById[route.riderId]!;
  const delivered = stop.status === "delivered";
  const got = (pid: string) => (stop.delivered ? stop.delivered.find((d) => d.productId === pid)?.qty ?? 0 : null);
  const partial = delivered && stop.items.some((i) => (got(i.productId) ?? i.qty) < i.qty);
  const total = delivered || stop.status === "issue" ? stop.charged ?? 0 : lineTotal(stop.items);
  return (
    <div className="relative">
      <div className="rounded-t-2xl bg-white p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mr text-sm text-ink-soft">आजची पावती</p>
            <p className="font-display text-lg font-semibold text-ink">Today's milk chit</p>
            <p className="text-xs text-ink-soft tabular">Order {stop.orderId}</p>
          </div>
          <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", delivered && !partial ? "bg-neem-soft text-neem-deep" : stop.status === "issue" || partial ? "bg-brick-soft text-brick" : "bg-marigold-soft text-marigold-deep")}>
            {partial ? `Part delivered ${clock(stop.at!)}` : delivered ? `Delivered ${clock(stop.at!)}` : stop.status === "issue" ? "Couldn't deliver" : "On the way"}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-milk p-3 text-sm">
          <dt className="text-ink-soft">Rider</dt><dd className="text-right font-semibold">{rider.name}</dd>
          <dt className="text-ink-soft">Route</dt><dd className="text-right font-semibold">{route.code}, {route.van}</dd>
          <dt className="text-ink-soft">Empties picked up</dt><dd className="text-right font-semibold">{delivered ? `${stop.bottlesCollected} of ${stop.bottlesDue}` : "—"}</dd>
        </dl>
        <ul className="mt-4 space-y-2.5">
          {stop.items.map((i) => {
            const p = productById[i.productId]!;
            const g = got(i.productId);
            const short = g !== null && g < i.qty;
            return (
              <li key={i.productId} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <span className="font-semibold">{short ? `${g} of ${i.qty}` : i.qty} × {p.name}</span>
                  <span className={clsx("block text-xs", short ? "text-brick" : "text-ink-soft")}>{short ? `${i.qty - g} not delivered, not charged` : p.size}</span>
                </span>
                <span className="font-semibold tabular">{inr(p.price * (g ?? i.qty))}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-milk-3 pt-3">
          <span className="font-semibold">{delivered ? "Charged" : "Total"}</span>
          <span className="font-display text-2xl font-bold tabular">{inr(total)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">{delivered ? "Paid from your wallet. You only pay for what reached your door." : stop.status === "issue" ? "Nothing was charged for this order." : "Paid from your wallet on delivery, only for what arrives."}</p>
      </div>
      <div className="perforation h-3 rotate-180" aria-hidden />
      <div className="rounded-b-2xl bg-white px-5 pb-5 pt-2 shadow-lift">
        <p className="text-xs text-ink-soft">
          <span className="mr-1 rounded bg-milk-2 px-1.5 py-0.5 font-semibold text-ink-3">Sample lab data</span>
          Batch {batch.id}: fat {batch.fat}%, SNF {batch.snf}%, urea and starch not detected.
        </p>
        <div className="mt-4 grid gap-2">
          {delivered && !stop.confirmed && (
            <Button variant="accent" icon={<Check size={18} />} onClick={() => { confirm(); toast("Thanks — marked as received."); }}>
              I've got my milk
            </Button>
          )}
          {stop.confirmed && <p className="flex items-center justify-center gap-2 rounded-xl bg-neem-soft py-2.5 text-sm font-semibold text-neem-deep"><CheckCircle2 size={16} /> You confirmed this delivery</p>}
          <Button variant="ghost" onClick={onReport}>Something wrong with this delivery?</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Top-up ---------- */
export function TopUpModal({ open, onClose, suggest }: { open: boolean; onClose: () => void; suggest?: number }) {
  const topUp = useStore((s) => s.topUp);
  const [amount, setAmount] = useState(suggest ?? 2000);
  const [method, setMethod] = useState("UPI");
  const [stage, setStage] = useState<"form" | "paying" | "done">("form");
  useEffect(() => { if (open && stage === "form") setAmount(suggest ?? 2000); }, [open, suggest]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { onClose(); setTimeout(() => setStage("form"), 300); };
  const pay = () => {
    setStage("paying");
    setTimeout(() => {
      topUp(amount, method === "UPI" ? "UPI (PhonePe)" : method);
      setStage("done");
    }, 1300);
  };
  return (
    <Modal open={open} onClose={close} title="Add money to wallet"
      footer={stage === "form" ? <><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={pay} disabled={amount < 100}>Pay {inr(amount)}</Button></> : stage === "done" ? <Button onClick={close}>Done</Button> : undefined}>
      {stage === "done" ? (
        <div className="py-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-neem-soft text-neem"><CheckCircle2 size={28} /></span>
          <p className="mt-4 font-display text-2xl font-bold">{inr(amount)} added</p>
          <p className="mt-1 text-sm text-ink-soft">This is a demo payment. No money moved.</p>
        </div>
      ) : stage === "paying" ? (
        <div className="py-10 text-center">
          <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-milk-2 border-t-ink" />
          <p className="mt-4 text-sm text-ink-soft">Waiting for {method} to confirm…</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-2">
            {[500, 1000, 2000, 5000].map((v) => (
              <button key={v} onClick={() => setAmount(v)} className={clsx("rounded-xl border py-2.5 text-sm font-semibold tabular", amount === v ? "border-ink bg-ink text-white" : "border-milk-3 hover:border-ink-3")}>{inr(v)}</button>
            ))}
          </div>
          <Field label="Or enter an amount" hint="Minimum ₹100">
            <input type="number" min={100} step={50} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} className={inputCls} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Pay with</legend>
            <div className="grid gap-2">
              {[["UPI", <Smartphone key="u" size={18} />, "PhonePe, GPay, Paytm"], ["Card", <CreditCard key="c" size={18} />, "Visa ending 4417"], ["Net banking", <Landmark key="n" size={18} />, "All major banks"]].map(([m, icon, sub]) => (
                <label key={m as string} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border p-3", method === m ? "border-ink bg-milk" : "border-milk-3")}>
                  <input type="radio" name="pay" className="accent-[#14213D]" checked={method === m} onChange={() => setMethod(m as string)} />
                  <span className="text-ink-3">{icon}</span>
                  <span className="flex-1"><span className="block text-sm font-semibold">{m}</span><span className="block text-xs text-ink-soft">{sub}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="rounded-xl bg-marigold-soft px-3 py-2 text-sm text-marigold-deep">Demo payment. No money moves and no payment app opens.</p>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Report a problem ---------- */
const kinds: ExceptionKind[] = ["missing", "leak", "seal", "late", "quality"];
export function ReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const report = useStore((s) => s.reportIssue);
  const stop = useStore((s) => s.stops.find((x) => x.customerId === s.meId && x.status !== "held"));
  const [kind, setKind] = useState<ExceptionKind>("missing");
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const close = () => { onClose(); setTimeout(() => { setSent(false); setMsg(""); setPicked({}); }, 300); };
  const needsItems = kind !== "late";
  const lines = stop?.items ?? [];
  const items = Object.entries(picked).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
  const canSend = !stop || !needsItems || items.length > 0;
  return (
    <Modal open={open} onClose={close} title={sent ? "We're on it" : "Report a problem"}
      footer={sent ? <Button onClick={close}>Done</Button> : <><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={!canSend} onClick={() => { report(kind, msg || `${kindLabel[kind]} with today's delivery.`, needsItems ? items : undefined); setSent(true); }}>Send report</Button></>}>
      {sent ? (
        <div className="py-4">
          <p className="text-ink-soft">The hub team has your report{stop ? ` for order ${stop.orderId}` : ""} and will reply within 30 minutes. Any refund goes to your wallet and can't be more than you paid for that order.</p>
          <p className="mt-4 rounded-xl bg-milk p-3 text-sm">Demo tip: sign out, then sign in as <b>hub staff</b> and open Tickets to see your report arrive.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {stop ? <p className="text-sm text-ink-soft">About today's order <b className="text-ink tabular">{stop.orderId}</b></p> : <p className="rounded-xl bg-milk p-3 text-sm">You have no order this morning, so this goes to the hub as a general report.</p>}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What went wrong?</legend>
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={clsx("rounded-full border px-3.5 py-1.5 text-sm font-medium", kind === k ? "border-ink bg-ink text-white" : "border-milk-3 hover:border-ink-3")}>{kindLabel[k]}</button>
              ))}
            </div>
          </fieldset>
          {stop && needsItems && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Which items? <span className="font-normal text-ink-soft">Tap to choose how many</span></legend>
              <div className="divide-y divide-milk-2 rounded-xl border border-milk-2">
                {lines.map((l) => {
                  const p = productById[l.productId]!;
                  const v = picked[l.productId] ?? 0;
                  return (
                    <div key={l.productId} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-ink-soft">{l.qty} ordered</p>
                      </div>
                      <Stepper label={p.name} value={v} max={l.qty} onChange={(n) => setPicked((x) => ({ ...x, [l.productId]: n }))} />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Field label="Tell us more (optional)">
            <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="For example: only two bottles were in the basket" className={inputCls} />
          </Field>
        </div>
      )}
    </Modal>
  );
}
