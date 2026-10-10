import { useState } from "react";
import clsx from "clsx";
import { Inbox, User, Truck, Cpu } from "lucide-react";
import { useStore, kindLabel, orderById } from "../../store/useStore";
import { GOODWILL_CAP, orderValue, refundCap, refundableOn, replaceable, retryable } from "../../store/rules";
import { ME, productById, routeById } from "../../data/seed";
import type { Exception, ExceptionKind } from "../../data/types";
import { clock, dayMonth, inr, timeAgo, weekday } from "../../lib/format";
import { Badge, Button, Card, Empty, Field, Modal, Segmented, inputCls } from "../../components/ui";
import { toast } from "../../store/toast";

const tone: Record<ExceptionKind, "bad" | "warn" | "neutral"> = { missing: "bad", leak: "bad", seal: "warn", late: "warn", access: "neutral", quality: "bad", callback: "neutral" };
const srcIcon = { customer: <User size={14} />, rider: <Truck size={14} />, system: <Cpu size={14} /> };

const srcLabel = { customer: "Customer", rider: "Rider", system: "Automatic" };

export default function Tickets() {
  const exceptions = useStore((s) => s.exceptions);
  const customers = useStore((s) => s.customers);
  const [view, setView] = useState<"open" | "resolved" | "all">("open");
  const [active, setActive] = useState<Exception | null>(null);
  const list = exceptions.filter((e) => view === "all" || e.status === view).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = { open: exceptions.filter((e) => e.status === "open").length, resolved: exceptions.filter((e) => e.status === "resolved").length };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-ink-soft">Reports from customers and riders. Aim to close each one within 30 minutes.</p>
        </div>
        <Segmented value={view} onChange={setView} options={[{ value: "open", label: `Open ${counts.open}` }, { value: "resolved", label: `Resolved ${counts.resolved}` }, { value: "all", label: "All" }]} />
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty icon={<Inbox size={20} />} title="Inbox zero" body="No open tickets. Try reporting a problem from the customer app to see one arrive." />
        ) : (
          <ul className="divide-y divide-milk-2">
            {list.map((e) => {
              const c = customers.find((x) => x.id === e.customerId)!;
              return (
                <li key={e.id}>
                  <button onClick={() => setActive(e)} className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-milk/60 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2 sm:w-44">
                      <Badge tone={e.status === "resolved" ? "good" : tone[e.kind]}>{kindLabel[e.kind]}</Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.flat}, {c.society} <span className="font-normal text-ink-soft">{c.id === ME ? "(Deshmukh family, demo customer)" : c.contact}</span></p>
                      <p className="truncate text-sm text-ink-soft">{e.orderId && <span className="mr-1.5 tabular text-ink-3">{e.orderId}</span>}{e.message}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-soft sm:w-56 sm:justify-end">
                      <span className="inline-flex items-center gap-1">{srcIcon[e.source]} {srcLabel[e.source]}</span>
                      <span>Route {routeById[e.routeId]!.code}</span>
                      <span>{timeAgo(e.createdAt)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <TicketModal ex={active} onClose={() => setActive(null)} />
    </div>
  );
}

function TicketModal({ ex, onClose }: { ex: Exception | null; onClose: () => void }) {
  const resolve = useStore((s) => s.resolve);
  const retry = useStore((s) => s.scheduleRetry);
  const replace = useStore((s) => s.scheduleReplacement);
  const customers = useStore((s) => s.customers);
  const txns = useStore((s) => s.txns);
  const exceptions = useStore((s) => s.exceptions);
  // the original order, even if it was on an earlier morning
  const stop = useStore((s) => (ex?.orderId ? orderById(s, ex.orderId) : undefined));
  const [action, setAction] = useState<"refund" | "retry" | "replace" | "explain" | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const today = useStore((s) => s.stopsDate);
  if (!ex) return null;
  const c = customers.find((x) => x.id === ex.customerId)!;
  // Refunds: bounded by what's still charged, and only for delivered, paid-for items not already refunded or replaced.
  const cap = refundCap(ex, stop, txns, exceptions);
  const orderCharged = ex.orderId ? refundableOn(ex.orderId, txns) : 0;
  const toRetry = retryable(ex, stop, exceptions); // never delivered, never charged
  const toReplace = replaceable(ex, stop, exceptions); // delivered, paid for, defective
  const itemsValue = ex.items ? orderValue(stop, ex.items) : ex.kind === "late" ? 20 : 0;
  const suggested = Math.min(cap, itemsValue);
  const act = action ?? (toRetry.length ? "retry" : suggested > 0 ? "refund" : toReplace.length ? "replace" : "explain");
  const amt = amount ?? suggested;
  const over = amt > cap || amt < 0;
  const list = (l: { productId: string; qty: number }[]) => l.map((i) => `${i.qty} × ${productById[i.productId]!.name}`).join(", ");
  const options: { v: "refund" | "retry" | "replace" | "explain"; label: string; sub: string; off?: boolean }[] = [
    ...(toRetry.length ? [{ v: "retry" as const, label: "Deliver the missing items on the next run", sub: `${list(toRetry)} never arrived and wasn't charged. Charged only when delivered.` }] : []),
    { v: "refund", label: "Refund to wallet", sub: cap > 0 ? `Up to ${inr(cap)}: delivered, paid-for items not yet compensated.` : orderCharged > 0 ? "Nothing on this ticket was paid for, or it's already been compensated." : "Nothing is charged on this order.", off: cap === 0 },
    ...(toReplace.length ? [{ v: "replace" as const, label: "Replace free on the next run", sub: `${list(toReplace)} was delivered and paid for. The replacement comes free, separate from the regular order.` }] : []),
    { v: "explain", label: "No compensation, reply with an explanation", sub: "Closes the ticket without moving money." },
  ];
  const close = () => { setAmount(null); setNote(""); setAction(null); onClose(); };
  const done = ex.status === "resolved";

  return (
    <Modal open onClose={close} title={kindLabel[ex.kind]} wide
      footer={done ? <Button onClick={close}>Close</Button> : <><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={act === "refund" && (over || amt === 0)} onClick={() => {
        if (act === "retry" || act === "replace") {
          const d = act === "retry" ? retry(ex.id) : replace(ex.id);
          toast(d ? (act === "retry" ? `Added to ${c.name}'s ${weekday(d, "long")} delivery. Charged only when it arrives.` : `Free replacement added to ${c.name}'s ${weekday(d, "long")} delivery.`) : "Nothing left to send on this ticket.", d ? "good" : "warn");
          return close();
        }
        const text = act === "refund" ? `Refunded ${inr(amt)} to wallet` : note || "Explained to the customer";
        const paid = resolve(ex.id, act === "refund" ? amt : 0, text);
        toast(act === "refund" ? `${inr(paid)} refunded to ${c.name}.` : "Ticket resolved.");
        close();
      }}>Resolve ticket</Button></>}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl bg-milk p-4">
            <p className="text-sm text-ink-soft">Customer</p>
            <p className="font-semibold">{c.name}</p>
            <p className="text-sm">{c.flat}, {c.society}</p>
            <p className="text-sm text-ink-soft">{c.phone}</p>
            <p className="mt-2 text-sm">Wallet <b className={clsx("tabular", c.wallet < 0 && "text-brick")}>{inr(c.wallet)}</b></p>
          </div>
          {ex.orderId ? (
            <div className="rounded-2xl bg-milk p-4 text-sm">
              <p className="text-ink-soft">Order <b className="tabular text-ink">{ex.orderId}</b>{stop ? `, Route ${routeById[stop.routeId]!.code}` : ""}</p>
              {stop && <ul className="mt-1">{stop.items.map((i) => {
                const got = stop.delivered ? stop.delivered.find((d) => d.productId === i.productId)?.qty ?? 0 : undefined;
                return <li key={i.productId}>{i.qty} × {productById[i.productId]!.name}{got !== undefined && got < i.qty ? <span className="text-brick"> ({got} delivered)</span> : null}</li>;
              })}</ul>}
              {stop && stop.date !== today && <p className="mt-1 text-xs font-semibold text-marigold-deep">From the {dayMonth(stop.date)} delivery</p>}
              {stop && <p className="mt-2">{stop.status === "delivered" ? `Delivered at ${clock(stop.at!)}` : stop.status === "issue" ? `Rider flagged: ${stop.issueNote}` : stop.status === "held" ? "Held: wallet too low" : "Not delivered yet"}</p>}
              <p className="mt-2">Charged on this order now <b className="tabular">{inr(orderCharged)}</b></p>
            </div>
          ) : (
            <p className="rounded-2xl bg-milk p-4 text-sm text-ink-soft">Not linked to an order. Goodwill credit is capped at {inr(GOODWILL_CAP)}.</p>
          )}
          {ex.items && (
            <div className="rounded-2xl border border-milk-3 p-4 text-sm">
              <p className="font-semibold">Affected items</p>
              <ul className="mt-1">{ex.items.map((i) => <li key={i.productId}>{i.qty} × {productById[i.productId]!.name}, {inr(orderValue(stop, [i]))}</li>)}</ul>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-ink-soft">{srcLabel[ex.source]} report, {timeAgo(ex.createdAt)}</p>
          <blockquote className="mt-1 border-l-4 border-marigold pl-3 text-ink">{ex.message}</blockquote>
          {done ? (
            <div className="mt-5 rounded-2xl bg-neem-soft p-4 text-sm text-neem-deep"><b>Resolved.</b> {ex.resolution}</div>
          ) : (
            <div className="mt-5 space-y-3">
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-semibold">What should we do?</legend>
                {options.map((o) => (
                  <label key={o.v} className={clsx("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm", act === o.v ? "border-ink bg-milk" : "border-milk-3", o.off && "cursor-not-allowed opacity-50")}>
                    <input type="radio" name="act" checked={act === o.v} disabled={o.off} onChange={() => setAction(o.v)} className="mt-0.5 accent-[#14213D]" />
                    <span><span className="block font-semibold">{o.label}</span><span className="block text-xs text-ink-soft">{o.sub}</span></span>
                  </label>
                ))}
              </fieldset>
              {act === "refund" && (
                <Field label="Refund amount" hint={`Up to ${inr(cap)}${suggested ? `. Suggested ${inr(suggested)}, the value of the affected items` : ""}.`}>
                  <input type="number" min={0} max={cap} value={amt} onChange={(e) => setAmount(Number(e.target.value))} className={clsx(inputCls, over && "border-brick")} />
                  {over && <span className="mt-1 block text-xs font-semibold text-brick">Can't refund more than {inr(cap)} on this order.</span>}
                </Field>
              )}
              {act === "explain" && <Field label="Reply to customer"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The cap is a second paper seal. The batch stamp underneath was intact." className={inputCls} /></Field>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
