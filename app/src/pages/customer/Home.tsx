import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Lock, Plane, PauseCircle, PlayCircle, Plus, Wallet, Undo2, PencilLine, CalendarClock, AlertTriangle } from "lucide-react";
import { useStore, useMe, useMyOverrides, useToday, itemsOn, planOn, lineTotal, volumeMl, type EditResult } from "../../store/useStore";
import { productById, products, routeById, riderById } from "../../data/seed";
import type { LineItem } from "../../data/types";
import { addDays, dayKey, dayMonth, firstEditableDate, fromKey, inr, isLockedDate, litres, longDate, weekday } from "../../lib/format";
import { Badge, Button, Card, CardHead, Field, Modal, Stepper, inputCls } from "../../components/ui";
import { Paavti, ReportModal, TopUpModal } from "../../components/customer";
import { DoorFix, InviteNeighbour, OnTheVan, Shortfall } from "../../components/growth";
import { ProductArt } from "../../components/ProductArt";
import { toast } from "../../store/toast";

const DAYS = 14;
/** Most-added extras first */
const QUICK_ADD = ["paneer", "dahi", "buff", "shrikhand", "loni", "taak", "ghee", "toned", "a2"];

/** Tell the customer when the store refused an edit, instead of failing silently. */
export function explainEdit(r: EditResult, date: string) {
  if (r === "locked") toast(`${weekday(date, "long")} is already locked for packing. Changes close at 10 PM the night before.`, "warn");
  else if (r === "off") toast(`${weekday(date, "long")} is paused. Resume the day first, then change quantities.`, "warn");
  return r === "ok";
}

export default function CustomerHome() {
  const me = useMe();
  const today = useToday();
  const overrides = useMyOverrides();
  const stop = useStore((s) => s.stops.find((x) => x.customerId === s.meId));
  const setDayStatus = useStore((s) => s.setDayStatus);
  const setDayQty = useStore((s) => s.setDayQty);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => dayKey(addDays(fromKey(today), i + 1))), [today]);
  const [picked, setPicked] = useState(() => (me.startDate && me.startDate > days[0]! ? me.startDate : days[0]!));
  const selected = days.includes(picked) ? picked : days[0]!;
  const [vacation, setVacation] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [topUp, setTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number | undefined>(undefined);
  const nextDay = days[0]!;
  const nextTotal = lineTotal(itemsOn(me, overrides[nextDay], nextDay));
  const [report, setReport] = useState(false);

  const first = firstEditableDate();
  const regular = planOn(me, first);
  const dailyCost = lineTotal(regular);
  const upcomingCost = days.slice(0, 7).reduce((s, d) => s + lineTotal(itemsOn(me, overrides[d], d)), 0);
  const daysLeft = dailyCost ? Math.floor(me.wallet / dailyCost) : 99;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const nextChange = (me.planChanges ?? []).filter((p) => p.from > days[0]!).at(-1);

  const o = overrides[selected];
  const plan = planOn(me, selected);
  const selItems = itemsOn(me, o, selected);
  const locked = isLockedDate(selected);
  const notStarted = !!me.startDate && selected < me.startDate;
  const off = o?.status === "skipped" || o?.status === "vacation";
  const rowIds = [...new Set([...plan.map((p) => p.productId), ...Object.keys(o?.qty ?? {})])];
  const qtyOf = (pid: string) => selItems.find((i) => i.productId === pid)?.qty ?? 0;
  const change = (pid: string, v: number) => explainEdit(setDayQty(selected, pid, v), selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mr text-ink-soft">शुभ प्रभात</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{greet}, {me.contact.split(" ")[0]}</h1>
          <p className="mt-1 text-ink-soft">{me.flat}, {me.society}, {me.area}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Plane size={16} />} onClick={() => setVacation(true)}>Going away?</Button>
          <Link to="/customer/shop"><Button variant="accent" icon={<Plus size={16} />}>Order extras</Button></Link>
        </div>
      </div>

      <Shortfall date={nextDay} total={nextTotal} onTopUp={(a) => { setTopUpAmount(a); setTopUp(true); }} />
      <DoorFix />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHead
              title={<span>Milk diary <span className="font-mr text-base font-normal text-ink-soft">दुधाची डायरी</span></span>}
              sub="Tap a day to skip it, take less or add more. Each day locks at 10 PM the night before."
            />
            <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto px-5 pb-1" role="listbox" aria-label="Upcoming days">
              {days.map((d) => {
                const od = overrides[d];
                const items = itemsOn(me, od, d);
                const st = od?.status;
                const before = !!me.startDate && d < me.startDate;
                const changed = !!od?.qty && !(st === "skipped" || st === "vacation");
                const isSel = d === selected;
                const sunday = fromKey(d).getDay() === 0;
                return (
                  <button
                    key={d}
                    role="option"
                    aria-selected={isSel}
                    onClick={() => setPicked(d)}
                    className={clsx(
                      "relative flex w-[76px] shrink-0 flex-col items-center rounded-2xl border px-2 pb-3 pt-2.5 transition",
                      isSel ? "border-ink bg-ink text-white" : st === "vacation" ? "border-transparent bg-[#E8ECF7]" : st === "skipped" ? "border-transparent bg-brick-soft/60" : "border-milk-2 bg-milk hover:border-milk-3",
                    )}
                  >
                    <span className={clsx("text-xs font-semibold", isSel ? "text-white/70" : sunday ? "text-brick" : "text-ink-soft")}>{weekday(d)}</span>
                    <span className="font-display text-2xl font-bold leading-tight tabular">{fromKey(d).getDate()}</span>
                    <span className={clsx("mt-1 text-[11px] font-semibold tabular", isSel ? "text-marigold" : "text-ink-3")}>
                      {before ? "Not yet" : st === "vacation" ? "Away" : st === "skipped" ? "Skipped" : litres(volumeMl(items))}
                    </span>
                    {changed && <span className={clsx("absolute right-2 top-2 h-2 w-2 rounded-full", isSel ? "bg-marigold" : "bg-neem")} aria-label="Changed for this day" />}
                    {isLockedDate(d) && <Lock size={11} className={clsx("absolute left-2 top-2", isSel ? "text-white/60" : "text-ink-soft")} aria-label="Locked" />}
                  </button>
                );
              })}
            </div>

            <div className="m-5 rounded-2xl bg-milk p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold">{longDate(selected)}</p>
                  <p className="text-sm text-ink-soft">
                    {notStarted
                      ? `Your deliveries start on ${dayMonth(me.startDate!)}.`
                      : off
                        ? o?.status === "vacation" ? "You're away. Nothing will be delivered or charged." : "Skipped. You won't be charged."
                        : selItems.length ? `${litres(volumeMl(selItems))} of milk, ${inr(lineTotal(selItems))} from your wallet` : "Nothing ordered for this day."}
                  </p>
                </div>
                {notStarted ? null : locked ? (
                  <Badge tone="neutral"><Lock size={12} /> Locked for packing</Badge>
                ) : off ? (
                  <Button size="sm" variant="outline" icon={<PlayCircle size={15} />} onClick={() => { if (explainEdit(setDayStatus(selected, "scheduled"), selected)) toast(`Delivery back on for ${dayMonth(selected)}.`); }}>Resume this day</Button>
                ) : (
                  <Button size="sm" variant="danger" icon={<PauseCircle size={15} />} onClick={() => { if (explainEdit(setDayStatus(selected, "skipped"), selected)) toast(`${weekday(selected, "long")} skipped. No charge.`, "info", { label: "Undo", run: () => setDayStatus(selected, "scheduled") }); }}>Skip this day</Button>
                )}
              </div>

              {!off && !notStarted && (
                <div className="mt-4 divide-y divide-milk-2 rounded-xl bg-white">
                  {rowIds.map((pid) => {
                    const p = productById[pid]!;
                    const usual = plan.find((x) => x.productId === pid)?.qty ?? 0;
                    const q = qtyOf(pid);
                    const diff = q - usual;
                    return (
                      <div key={pid} className="flex items-center gap-3 p-3">
                        <ProductArt product={p} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className={clsx("text-xs", usual === 0 ? "text-neem-deep" : diff < 0 ? "text-brick" : "text-ink-soft")}>
                            {usual === 0 ? "Extra for this day" : `${usual} in your plan${diff > 0 ? `, +${diff} extra` : diff < 0 ? `, ${-diff} fewer this day` : ""}`}
                          </p>
                        </div>
                        {locked ? <span className="font-semibold tabular">{q}</span> : <Stepper label={p.name} value={q} min={0} max={12} onChange={(v) => change(pid, v)} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {!off && !locked && !notStarted && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_ADD.map((id) => productById[id]!).filter((p) => !rowIds.includes(p.id)).slice(0, 4).map((p) => (
                    <button key={p.id} onClick={() => { if (change(p.id, 1)) toast(`${p.name} added for ${dayMonth(selected)}.`); }} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-soft/50 px-3 py-1.5 text-xs font-semibold text-ink-3 hover:border-ink hover:text-ink">
                      <Plus size={13} /> {p.name} <span className="font-normal text-ink-soft">{inr(p.price)}</span>
                    </button>
                  ))}
                  <Link to="/customer/shop" className="inline-flex items-center px-2 py-1.5 text-xs font-semibold text-ink-3 underline underline-offset-2 hover:text-ink">More in the shop</Link>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Your regular order" sub="What arrives every day unless you change a day above." right={<Button size="sm" variant="soft" icon={<PencilLine size={14} />} onClick={() => setPlanOpen(true)}>Edit</Button>} />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {regular.map((i) => {
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
            {nextChange && (
              <p className="mx-5 mb-4 flex items-center gap-2 rounded-xl bg-marigold-soft px-3 py-2 text-sm text-marigold-deep">
                <CalendarClock size={15} /> This order starts on {weekday(nextChange.from, "long")}, {dayMonth(nextChange.from)}. Days before that keep the old order.
              </p>
            )}
            <div className="flex flex-wrap justify-between gap-2 border-t border-milk-2 px-5 py-4 text-sm">
              <span className="text-ink-soft">Daily total <b className="text-ink tabular">{inr(dailyCost)}</b></span>
              <span className="text-ink-soft">Next 7 days <b className="text-ink tabular">{inr(upcomingCost)}</b></span>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {stop?.status === "held" && (
            <Card className="border border-brick/30 p-5">
              <p className="flex items-center gap-2 font-semibold text-brick"><AlertTriangle size={18} /> Today's milk is on hold</p>
              <p className="mt-1 text-sm text-ink-soft">{stop.holdReason}. Add money and it goes straight back on this morning's van.</p>
              <Button className="mt-3 w-full" onClick={() => { setTopUpAmount(Math.max(100, Math.ceil((lineTotal(stop.items) - me.wallet) / 100) * 100)); setTopUp(true); }}>Add {inr(Math.max(100, Math.ceil((lineTotal(stop.items) - me.wallet) / 100) * 100))}</Button>
            </Card>
          )}
          {stop && stop.status === "pending" && <OnTheVan stop={stop} />}
          {stop && stop.status !== "held" ? <Paavti stop={stop} onReport={() => setReport(true)} /> : !stop && <FirstDelivery />}
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink-soft">Wallet balance</p>
                <p className={clsx("font-display text-3xl font-bold tabular", me.wallet < 0 && "text-brick")}>{inr(me.wallet)}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-marigold-soft text-marigold-deep"><Wallet size={20} /></span>
            </div>
            <p className={clsx("mt-2 text-sm", daysLeft <= 3 ? "font-semibold text-brick" : "text-ink-soft")}>
              {daysLeft <= 3 ? `Enough for ${Math.max(0, daysLeft)} more day${daysLeft === 1 ? "" : "s"}. Top up so your milk isn't held.` : `Covers about ${daysLeft} days of your regular order.`}
            </p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => setTopUp(true)}>Add money</Button>
              <Link to="/customer/wallet" className="flex-1"><Button variant="soft" className="w-full">History</Button></Link>
            </div>
          </Card>
          <InviteNeighbour />
        </div>
      </div>

      <VacationModal open={vacation} onClose={() => setVacation(false)} dailyCost={dailyCost} />
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
      <TopUpModal open={topUp} suggest={topUpAmount} onClose={() => { setTopUp(false); setTopUpAmount(undefined); }} />
      <ReportModal open={report} onClose={() => setReport(false)} />
    </div>
  );
}

/** Shown when the household has no order on the current delivery morning (new sign-ups, paused days). */
function FirstDelivery() {
  const me = useMe();
  const today = useToday();
  const route = routeById[me.routeId]!;
  const rider = riderById[route.riderId]!;
  const upcoming = me.startDate && me.startDate > today;
  return (
    <Card className="p-5">
      <p className="font-mr text-sm text-ink-soft">आजची पावती</p>
      <p className="font-display text-lg font-semibold">{upcoming ? "Your first delivery" : "No delivery this morning"}</p>
      <p className="mt-2 text-sm text-ink-soft">
        {upcoming
          ? `${longDate(me.startDate!)}, between 5:15 and 6:15 AM. ${rider.name} on Route ${route.code} will bring it to ${me.flat}.`
          : "You had nothing ordered for today. Your next order shows in the diary."}
      </p>
    </Card>
  );
}

function VacationModal({ open, onClose, dailyCost }: { open: boolean; onClose: () => void; dailyCost: number }) {
  const setVacation = useStore((s) => s.setVacation);
  const setDayStatus = useStore((s) => s.setDayStatus);
  const overrides = useMyOverrides();
  const today = useToday();
  const first = firstEditableDate();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(dayKey(addDays(fromKey(first), 3)));
  useEffect(() => { if (open) { setFrom(first); setTo(dayKey(addDays(fromKey(first), 3))); } }, [open, first]);
  const n = Math.max(0, Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 864e5) + 1);
  const away = Object.entries(overrides).filter(([k, o]) => o.status === "vacation" && k > today).map(([k]) => k).sort();
  return (
    <Modal open={open} onClose={onClose} title="Pause for a trip"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={n <= 0 || from < first} onClick={() => { const c = setVacation(from, to); toast(`Paused for ${c} day${c === 1 ? "" : "s"}. Safe travels!`); onClose(); }}>Pause {n} day{n === 1 ? "" : "s"}</Button></>}>
      <p className="text-sm text-ink-soft">We'll stop deliveries and won't charge you. Your regular order starts again the morning after you're back.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Field label="Leaving"><input type="date" min={first} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} className={inputCls} /></Field>
        <Field label="Back on"><input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="mt-4 rounded-xl bg-milk p-4 text-sm">
        You'll save about <b className="tabular">{inr(n * dailyCost)}</b> on your regular order.
      </div>
      {away.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Already paused</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {away.map((k) => (
              <button key={k} onClick={() => explainEdit(setDayStatus(k, "scheduled"), k)} className="inline-flex items-center gap-1 rounded-full bg-[#E8ECF7] px-3 py-1 text-xs font-semibold text-ink-2 hover:bg-milk-3" aria-label={`Resume ${dayMonth(k)}`}>
                {dayMonth(k)} {isLockedDate(k) ? <Lock size={11} /> : <Undo2 size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Edits a draft. Nothing changes until Save; Cancel throws the draft away. */
function PlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const savePlan = useStore((s) => s.savePlan);
  const first = firstEditableDate();
  const [draft, setDraft] = useState<LineItem[]>([]);
  useEffect(() => { if (open) setDraft(planOn(me, first).map((i) => ({ ...i }))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const subs = products.filter((p) => p.subscribable);
  const q = (pid: string) => draft.find((x) => x.productId === pid)?.qty ?? 0;
  const setQ = (pid: string, v: number) => setDraft((d) => [...d.filter((x) => x.productId !== pid), ...(v > 0 ? [{ productId: pid, qty: v }] : [])]);
  const before = lineTotal(planOn(me, first));
  const after = lineTotal(draft);
  return (
    <Modal open={open} onClose={onClose} title="Edit your regular order"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!draft.length} onClick={() => { const from = savePlan(draft); onClose(); toast(`Saved. Your new regular order starts ${weekday(from, "long")}, ${dayMonth(from)}.`, "good"); }}>Save order</Button></>}>
      <p className="text-sm text-ink-soft">
        Starts <b className="text-ink">{weekday(first, "long")}, {dayMonth(first)}</b>, the first day not yet locked for packing. Days you've already changed in the diary keep those changes.
      </p>
      <div className="mt-4 divide-y divide-milk-2">
        {subs.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-3">
            <ProductArt product={p} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="text-xs text-ink-soft">{p.size}, {inr(p.price)}</p>
            </div>
            <Stepper label={p.name} value={q(p.id)} max={10} onChange={(v) => setQ(p.id, v)} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between rounded-xl bg-milk p-4 text-sm">
        <span>Daily total</span>
        <b className="tabular">{after === before ? inr(after) : `${inr(before)} → ${inr(after)}`}</b>
      </div>
      {!draft.length && <p className="mt-2 text-sm text-brick">Keep at least one item. To stop for a while, use "Going away?" instead.</p>}
    </Modal>
  );
}
