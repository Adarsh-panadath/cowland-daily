import { useState } from "react";
import clsx from "clsx";
import { Inbox, User, Truck, Cpu } from "lucide-react";
import { useStore, kindLabel, lineTotal } from "../../store/useStore";
import { GOODWILL_CAP, refundCap, refundableOn } from "../../store/rules";
import { ME, productById, routeById } from "../../data/seed";
import type { Exception, ExceptionKind } from "../../data/types";
import { clock, inr, timeAgo, weekday } from "../../lib/format";
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
  const customers = useStore((s) => s.customers);
  const txns = useStore((s) => s.txns);
  const stop = useStore((s) => (ex?.orderId ? s.stops.find((x) => x.orderId === ex.orderId) : undefined));
  const [action, setAction] = useState<"refund" | "retry" | "explain" | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  if (!ex) return null;
  const c = customers.find((x) => x.id === ex.customerId)!;
  // Refunds are bounded by what the ledger says is still charged on this order.
  const cap = refundCap(ex, stop, txns);
  const orderCharged = ex.orderId ? refundableOn(ex.orderId, txns) : 0;
  // Only the affected items the customer actually paid for can be refunded; undelivered ones were never charged.
  const paidFor = (ex.items ?? []).map((i) => ({ productId: i.productId, qty: stop?.delivered ? Math.min(i.qty, stop.delivered.find((d) => d.productId === i.productId)?.qty ?? 0) : i.qty }));
  const itemsValue = ex.items ? lineTotal(paidFor) : ex.kind === "late" ? 20 : 0;
  const unpaid = (ex.items ?? []).filter((i, k) => paidFor[k]!.qty < i.qty);
  const suggested = Math.min(cap, itemsValue);
  const canRetry = !!ex.items?.length;
  const act = action ?? (suggested > 0 ? "refund" : canRetry ? "retry" : "explain");
  const amt = amount ?? suggested;
  const over = amt > cap || amt < 0;
  const close = () => { setAmount(null); setNote(""); setAction(null); onClose(); };
  const done = ex.status === "resolved";

  return (
    <Modal open onClose={close} title={kindLabel[ex.kind]} wide
      footer={done ? <Button onClick={close}>Close</Button> : <><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={act === "refund" && (over || amt === 0)} onClick={() => {
        if (act === "retry") {
          const d = retry(ex.id);
          toast(d ? `Added to ${c.name}'s ${weekday(d, "long")} delivery. Charged only when it arrives.` : "Couldn't schedule a retry.", d ? "good" : "warn");
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
                const got = stop.delivered?.find((d) => d.productId === i.productId)?.qty;
                return <li key={i.productId}>{i.qty} × {productById[i.productId]!.name}{got !== undefined && got < i.qty ? <span className="text-brick"> ({got} delivered)</span> : null}</li>;
              })}</ul>}
              {stop && <p className="mt-2">{stop.status === "delivered" ? `Delivered at ${clock(stop.at!)}` : stop.status === "issue" ? `Rider flagged: ${stop.issueNote}` : stop.status === "held" ? "Held: wallet too low" : "Not delivered yet"}</p>}
              <p className="mt-2">Charged on this order now <b className="tabular">{inr(orderCharged)}</b></p>
            </div>
          ) : (
            <p className="rounded-2xl bg-milk p-4 text-sm text-ink-soft">Not linked to an order. Goodwill credit is capped at {inr(GOODWILL_CAP)}.</p>
          )}
          {ex.items && (
            <div className="rounded-2xl border border-milk-3 p-4 text-sm">
              <p className="font-semibold">Affected items</p>
              <ul className="mt-1">{ex.items.map((i) => <li key={i.productId}>{i.qty} × {productById[i.productId]!.name}, {inr(productById[i.productId]!.price * i.qty)}</li>)}</ul>
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
                {([["refund", "Refund to wallet"], ["retry", "Deliver the missing items on the next run"], ["explain", "No refund, reply with an explanation"]] as const).filter(([v]) => v !== "retry" || canRetry).map(([v, l]) => (
                  <label key={v} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", act === v ? "border-ink bg-milk" : "border-milk-3", v === "refund" && cap === 0 && "opacity-50")}>
                    <input type="radio" name="act" checked={act === v} disabled={v === "refund" && cap === 0} onChange={() => setAction(v)} className="accent-[#14213D]" /> {l}{v === "refund" && cap === 0 ? (orderCharged > 0 ? " (these items weren't charged)" : " (nothing charged on this order)") : ""}
                  </label>
                ))}
                {unpaid.length > 0 && <p className="rounded-xl bg-milk px-3 py-2 text-xs text-ink-3">{unpaid.map((i) => productById[i.productId]!.name).join(", ")} wasn't delivered, so it wasn't charged. Refunding it would pay the customer for something they never paid for.</p>}
                {act === "retry" && <p className="rounded-xl bg-neem-soft px-3 py-2 text-xs text-neem-deep">Adds the items to the customer's next order that isn't locked. They're charged only if delivered, so nothing is paid twice.</p>}
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
