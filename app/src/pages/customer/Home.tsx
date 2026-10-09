import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Lock, Plane, PauseCircle, PlayCircle, Plus, Wallet, Undo2, PencilLine } from "lucide-react";
import { useStore, useMe, itemsForDay, lineTotal, volumeMl } from "../../store/useStore";
import { ME, productById, products } from "../../data/seed";
import { addDays, dayKey, dayMonth, fromKey, inr, litres, longDate, tomorrowKey, weekday } from "../../lib/format";
import { Badge, Button, Card, CardHead, Field, Modal, Stepper, inputCls } from "../../components/ui";
import { Paavti, ReportModal, TopUpModal } from "../../components/customer";
import { ProductArt } from "../../components/ProductArt";
import { toast } from "../../store/toast";

const DAYS = 14;

function isLocked(k: string) {
  const tKey = tomorrowKey();
  if (k < tKey) return true;
  return k === tKey && new Date().getHours() >= 22;
}

export default function CustomerHome() {
  const me = useMe();
  const overrides = useStore((s) => s.overrides);
  const stop = useStore((s) => s.stops.find((x) => x.customerId === ME));
  const setDayStatus = useStore((s) => s.setDayStatus);
  const bumpExtra = useStore((s) => s.bumpExtra);
  const [selected, setSelected] = useState(tomorrowKey());
  const [vacation, setVacation] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [topUp, setTopUp] = useState(false);
  const [report, setReport] = useState(false);

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => dayKey(addDays(new Date(), i + 1))), []);
  const dailyCost = lineTotal(me.plan);
  const upcomingCost = days.slice(0, 7).reduce((s, d) => s + lineTotal(itemsForDay(me.plan, overrides[d])), 0);
  const daysLeft = dailyCost ? Math.floor(me.wallet / dailyCost) : 99;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const sel = overrides[selected];
  const selItems = itemsForDay(me.plan, sel);
  const locked = isLocked(selected);
  const off = sel?.status === "skipped" || sel?.status === "vacation";
  const extras = sel?.extras ?? [];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mr text-ink-soft">शुभ प्रभात, देशमुख कुटुंब</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{greet}, {me.contact.split(" ")[0]}</h1>
          <p className="mt-1 text-ink-soft">{me.flat}, {me.society}, {me.area}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Plane size={16} />} onClick={() => setVacation(true)}>Going away?</Button>
          <Link to="/customer/shop"><Button variant="accent" icon={<Plus size={16} />}>Add to tomorrow</Button></Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Diary */}
          <Card>
            <CardHead
              title={<span>Milk diary <span className="font-mr text-base font-normal text-ink-soft">दुधाची डायरी</span></span>}
              sub="Tap a day to skip it or add extra. Changes for tomorrow lock at 10 PM tonight."
            />
            <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto px-5 pb-1" role="listbox" aria-label="Upcoming days">
              {days.map((d) => {
                const o = overrides[d];
                const items = itemsForDay(me.plan, o);
                const st = o?.status;
                const hasExtra = (o?.extras?.length ?? 0) > 0 && !(st === "skipped" || st === "vacation");
                const isSel = d === selected;
                const sunday = fromKey(d).getDay() === 0;
                return (
                  <button
                    key={d}
                    role="option"
                    aria-selected={isSel}
                    onClick={() => setSelected(d)}
                    className={clsx(
                      "relative flex w-[76px] shrink-0 flex-col items-center rounded-2xl border px-2 pb-3 pt-2.5 transition",
                      isSel ? "border-ink bg-ink text-white" : st === "vacation" ? "border-transparent bg-[#E8ECF7]" : st === "skipped" ? "border-transparent bg-brick-soft/60" : "border-milk-2 bg-milk hover:border-milk-3",
                    )}
                  >
                    <span className={clsx("text-xs font-semibold", isSel ? "text-white/70" : sunday ? "text-brick" : "text-ink-soft")}>{weekday(d)}</span>
                    <span className="font-display text-2xl font-bold leading-tight tabular">{fromKey(d).getDate()}</span>
                    <span className={clsx("mt-1 text-[11px] font-semibold tabular", isSel ? "text-marigold" : "text-ink-3")}>
                      {st === "vacation" ? "Away" : st === "skipped" ? "Skipped" : litres(volumeMl(items))}
                    </span>
                    {hasExtra && <span className={clsx("absolute right-2 top-2 h-2 w-2 rounded-full", isSel ? "bg-marigold" : "bg-neem")} aria-label="Has extras" />}
                    {isLocked(d) && <Lock size={11} className={clsx("absolute left-2 top-2", isSel ? "text-white/60" : "text-ink-soft")} aria-label="Locked" />}
                  </button>
                );
              })}
            </div>

            {/* Selected day */}
            <div className="m-5 rounded-2xl bg-milk p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold">{longDate(selected)}</p>
                  <p className="text-sm text-ink-soft">
                    {off ? (sel?.status === "vacation" ? "You're away. Nothing will be delivered." : "Skipped. You won't be charged.") : `${litres(volumeMl(selItems))} of milk, ${inr(lineTotal(selItems))} from your wallet`}
                  </p>
                </div>
                {locked ? (
                  <Badge tone="neutral"><Lock size={12} /> Locked for packing</Badge>
                ) : off ? (
                  <Button size="sm" variant="outline" icon={<PlayCircle size={15} />} onClick={() => { setDayStatus(selected, "scheduled"); toast(`Delivery restored for ${dayMonth(selected)}.`); }}>Deliver this day</Button>
                ) : (
                  <Button size="sm" variant="danger" icon={<PauseCircle size={15} />} onClick={() => { setDayStatus(selected, "skipped"); toast(`${weekday(selected, "long")} skipped. No charge.`, "info", { label: "Undo", run: () => setDayStatus(selected, "scheduled") }); }}>Skip this day</Button>
                )}
              </div>

              {!off && (
                <div className="mt-4 divide-y divide-milk-2 rounded-xl bg-white">
                  {me.plan.map((i) => {
                    const p = productById[i.productId]!;
                    const extra = extras.find((e) => e.productId === i.productId)?.qty ?? 0;
                    return (
                      <div key={i.productId} className="flex items-center gap-3 p-3">
                        <ProductArt product={p} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className="text-xs text-ink-soft">{i.qty} in your plan{extra ? `, +${extra} extra` : ""}</p>
                        </div>
                        {locked ? <span className="font-semibold tabular">{i.qty + extra}</span> : (
                          <Stepper label={p.name} value={i.qty + extra} min={0} max={12} onChange={(v) => bumpExtra(selected, p.id, v - (i.qty + extra))} />
                        )}
                      </div>
                    );
                  })}
                  {extras.filter((e) => !me.plan.some((p) => p.productId === e.productId)).map((e) => {
                    const p = productById[e.productId]!;
                    return (
                      <div key={e.productId} className="flex items-center gap-3 p-3">
                        <ProductArt product={p} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className="text-xs text-neem-deep">Extra for this day</p>
                        </div>
                        {locked ? <span className="font-semibold tabular">{e.qty}</span> : <Stepper label={p.name} value={e.qty} onChange={(v) => bumpExtra(selected, p.id, v - e.qty)} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {!off && !locked && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {products.filter((p) => !me.plan.some((x) => x.productId === p.id) && !extras.some((x) => x.productId === p.id)).slice(0, 4).map((p) => (
                    <button key={p.id} onClick={() => { bumpExtra(selected, p.id, 1); toast(`${p.name} added for ${dayMonth(selected)}.`); }} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-soft/50 px-3 py-1.5 text-xs font-semibold text-ink-3 hover:border-ink hover:text-ink">
                      <Plus size={13} /> {p.name} <span className="font-normal text-ink-soft">{inr(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Plan */}
          <Card>
            <CardHead title="Your regular order" sub="What arrives every day unless you change a day above." right={<Button size="sm" variant="soft" icon={<PencilLine size={14} />} onClick={() => setPlanOpen(true)}>Edit</Button>} />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {me.plan.map((i) => {
                const p = productById[i.productId]!;
                return (
                  <div key={i.productId} className="flex items-center gap-3 rounded-2xl bg-milk p-3">
                    <ProductArt product={p} size={56} />
                    <div>
                      <p className="font-semibold">{i.qty} × {p.name}</p>
                      <p className="text-sm text-ink-soft">{p.size}, {inr(p.price * i.qty)} a day</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-milk-2 px-5 py-4 text-sm">
              <span className="text-ink-soft">Daily total <b className="text-ink tabular">{inr(dailyCost)}</b></span>
              <span className="text-ink-soft">Next 7 days <b className="text-ink tabular">{inr(upcomingCost)}</b></span>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Paavti stop={stop} onReport={() => setReport(true)} />
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink-soft">Wallet balance</p>
                <p className={clsx("font-display text-3xl font-bold tabular", me.wallet < 0 && "text-brick")}>{inr(me.wallet)}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-marigold-soft text-marigold-deep"><Wallet size={20} /></span>
            </div>
            <p className={clsx("mt-2 text-sm", daysLeft <= 3 ? "font-semibold text-brick" : "text-ink-soft")}>
              {daysLeft <= 3 ? `Enough for ${Math.max(0, daysLeft)} more day${daysLeft === 1 ? "" : "s"}. Top up to avoid a missed delivery.` : `Covers about ${daysLeft} days of your regular order.`}
            </p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => setTopUp(true)}>Add money</Button>
              <Link to="/customer/wallet" className="flex-1"><Button variant="soft" className="w-full">History</Button></Link>
            </div>
          </Card>
        </div>
      </div>

      <VacationModal open={vacation} onClose={() => setVacation(false)} dailyCost={dailyCost} />
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
      <TopUpModal open={topUp} onClose={() => setTopUp(false)} />
      <ReportModal open={report} onClose={() => setReport(false)} />
    </div>
  );
}

function VacationModal({ open, onClose, dailyCost }: { open: boolean; onClose: () => void; dailyCost: number }) {
  const setVacation = useStore((s) => s.setVacation);
  const setDayStatus = useStore((s) => s.setDayStatus);
  const overrides = useStore((s) => s.overrides);
  const first = new Date().getHours() >= 22 ? dayKey(addDays(new Date(), 2)) : tomorrowKey();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(dayKey(addDays(fromKey(first), 3)));
  const n = Math.max(0, Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 864e5) + 1);
  const away = Object.entries(overrides).filter(([k, o]) => o.status === "vacation" && k >= tomorrowKey()).map(([k]) => k).sort();
  return (
    <Modal open={open} onClose={onClose} title="Pause for a trip"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={n <= 0} onClick={() => { const c = setVacation(from, to); toast(`Paused for ${c} day${c === 1 ? "" : "s"}. Safe travels!`); onClose(); }}>Pause {n} day{n === 1 ? "" : "s"}</Button></>}>
      <p className="text-sm text-ink-soft">We'll stop deliveries and won't charge you. Your regular order starts again the morning after you're back.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Field label="Leaving"><input type="date" min={first} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} className={inputCls} /></Field>
        <Field label="Back on"><input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="mt-4 rounded-xl bg-milk p-4 text-sm">
        You'll save about <b className="tabular">{inr(n * dailyCost)}</b> and {n * 2} glass bottles stay at the hub.
      </div>
      {away.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Already paused</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {away.map((k) => (
              <button key={k} onClick={() => setDayStatus(k, "scheduled")} className="inline-flex items-center gap-1 rounded-full bg-[#E8ECF7] px-3 py-1 text-xs font-semibold text-ink-2 hover:bg-milk-3" aria-label={`Resume ${dayMonth(k)}`}>
                {dayMonth(k)} <Undo2 size={12} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function PlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const setPlanQty = useStore((s) => s.setPlanQty);
  const subs = products.filter((p) => p.subscribable);
  return (
    <Modal open={open} onClose={onClose} title="Edit your regular order" footer={<Button onClick={() => { onClose(); toast("Regular order updated from the next unlocked day."); }}>Save order</Button>}>
      <p className="text-sm text-ink-soft">Changes apply from the next day that isn't locked for packing.</p>
      <div className="mt-4 divide-y divide-milk-2">
        {subs.map((p) => {
          const q = me.plan.find((x) => x.productId === p.id)?.qty ?? 0;
          return (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <ProductArt product={p} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-ink-soft">{p.size}, {inr(p.price)}</p>
              </div>
              <Stepper label={p.name} value={q} max={10} onChange={(v) => setPlanQty(p.id, v)} />
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-between rounded-xl bg-milk p-4 text-sm">
        <span>New daily total</span><b className="tabular">{inr(lineTotal(me.plan))}</b>
      </div>
    </Modal>
  );
}
