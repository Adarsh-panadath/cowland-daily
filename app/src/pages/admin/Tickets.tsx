import { useState } from "react";
import clsx from "clsx";
import { Inbox, User, Truck, Cpu } from "lucide-react";
import { useStore, kindLabel, lineTotal } from "../../store/useStore";
import { ME, productById, routeById } from "../../data/seed";
import type { Exception, ExceptionKind } from "../../data/types";
import { clock, inr, timeAgo } from "../../lib/format";
import { Badge, Button, Card, Empty, Field, Modal, Segmented, inputCls } from "../../components/ui";
import { toast } from "../../store/toast";

const tone: Record<ExceptionKind, "bad" | "warn" | "neutral"> = { missing: "bad", leak: "bad", seal: "warn", late: "warn", access: "neutral", quality: "bad" };
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
                      <p className="truncate text-sm text-ink-soft">{e.message}</p>
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
  const customers = useStore((s) => s.customers);
  const stop = useStore((s) => (ex ? s.stops.find((x) => x.customerId === ex.customerId) : undefined));
  const suggested = stop && ex ? (ex.kind === "missing" || ex.kind === "leak" ? productById[stop.items[0]!.productId]!.price : ex.kind === "late" ? 20 : 0) : 0;
  const [action, setAction] = useState<"refund" | "replace" | "explain">("refund");
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  if (!ex) return null;
  const c = customers.find((x) => x.id === ex.customerId)!;
  const amt = amount ?? suggested;
  const close = () => { setAmount(null); setNote(""); setAction("refund"); onClose(); };
  const done = ex.status === "resolved";

  return (
    <Modal open onClose={close} title={kindLabel[ex.kind]} wide
      footer={done ? <Button onClick={close}>Close</Button> : <><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={() => {
        const text = action === "refund" ? `Refunded ${inr(amt)} to wallet` : action === "replace" ? "Replacement sent on the same route" : note || "Explained to the customer";
        resolve(ex.id, action === "refund" ? amt : 0, text);
        toast(action === "refund" ? `${inr(amt)} refunded to ${c.name}.` : "Ticket resolved.");
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
          {stop && (
            <div className="rounded-2xl bg-milk p-4 text-sm">
              <p className="text-ink-soft">Today's order, Route {routeById[stop.routeId]!.code}</p>
              <ul className="mt-1">{stop.items.map((i) => <li key={i.productId}>{i.qty} × {productById[i.productId]!.name}</li>)}</ul>
              <p className="mt-2">{stop.status === "delivered" ? `Delivered at ${clock(stop.at!)}` : stop.status === "issue" ? `Rider flagged: ${stop.issueNote}` : "Not delivered yet"}, worth {inr(lineTotal(stop.items))}</p>
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
                {([["refund", "Refund to wallet"], ["replace", "Send a replacement now"], ["explain", "No refund, reply with an explanation"]] as const).map(([v, l]) => (
                  <label key={v} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", action === v ? "border-ink bg-milk" : "border-milk-3")}>
                    <input type="radio" name="act" checked={action === v} onChange={() => setAction(v)} className="accent-[#14213D]" /> {l}
                  </label>
                ))}
              </fieldset>
              {action === "refund" && <Field label="Refund amount" hint={suggested ? `Suggested ${inr(suggested)}, the value of the affected item` : undefined}><input type="number" min={0} value={amt} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} /></Field>}
              {action === "explain" && <Field label="Reply to customer"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The cap is a second paper seal. The batch stamp underneath was intact." className={inputCls} /></Field>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
