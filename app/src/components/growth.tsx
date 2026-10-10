/** Customer-side cards for the delivery-efficiency ideas: van spares, held-order shortfall, failed doors, neighbour invites. */
import { useState } from "react";
import { Truck, Plus, AlertTriangle, DoorClosed, Share2, Check } from "lucide-react";
import { useStore, useMe } from "../store/useStore";
import { sparesLeft, orderTotal } from "../store/rules";
import { productById, riderById, routeById } from "../data/seed";
import type { Stop } from "../data/types";
import { dayMonth, inr, weekday } from "../lib/format";
import { Button, Card, inputCls } from "./ui";
import { ProductArt } from "./ProductArt";
import { toast } from "../store/toast";

/* ---------- 1. Spares on the van ---------- */
export function OnTheVan({ stop }: { stop: Stop }) {
  const buy = useStore((s) => s.buyFromVan);
  const stops = useStore((s) => s.stops);
  const route = routeById[stop.routeId]!;
  const rider = riderById[route.riderId]!;
  const left = sparesLeft(stops, stop.routeId);
  const avail = Object.entries(left).filter(([, n]) => n > 0).map(([pid, n]) => ({ p: productById[pid]!, n }));
  const before = stops.filter((x) => x.routeId === stop.routeId && x.status === "pending" && x.seq < stop.seq).length;
  if (stop.status !== "pending" || (!avail.length && !stop.fromVan?.length)) return null;
  const first = rider.name.split(" ")[0];
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-display text-lg font-semibold"><Truck size={18} className="text-neem" /> On {first}'s van right now</p>
      <p className="mt-1 text-sm text-ink-soft">
        Spare stock that's already on its way to your building. Add it to today's milk, same price as always, paid only if it reaches your door. {before > 0 ? `${before} home${before === 1 ? "" : "s"} before yours.` : "You're next."}
      </p>
      {stop.fromVan?.length ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-neem-soft px-3 py-2 text-sm font-semibold text-neem-deep">
          <Check size={15} /> Coming with your milk: {stop.fromVan.map((i) => `${i.qty} × ${productById[i.productId]!.name}`).join(", ")}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-milk-2">
        {avail.map(({ p, n }) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <ProductArt product={p} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-ink-soft">{inr(p.price)}, {n} left on the van</p>
            </div>
            <Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={() => {
              const r = buy(p.id);
              if (r === "ok") toast(`${p.name} added. ${first} will bring it with your milk.`, "good");
              else if (r === "gone") toast("Someone on your route just took the last one.", "warn");
              else if (r === "passed") toast("The van has already been to your door today.", "warn");
              else if (r === "wallet") toast(`Your wallet doesn't cover this. Add money first.`, "warn");
            }} aria-label={`Add ${p.name} from the van`}>Add</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------- 3. Tomorrow's shortfall ---------- */
export function Shortfall({ date, total, onTopUp }: { date: string; total: number; onTopUp: (amount: number) => void }) {
  const me = useMe();
  // today's milk, if still on the way, comes out of the wallet first
  const today = useStore((s) => s.stops.find((x) => x.customerId === s.meId && x.status === "pending"));
  const after = me.wallet - (today ? orderTotal(today) : 0);
  const short = total - after;
  if (short <= 0 || total === 0) return null;
  const round = Math.ceil(short / 100) * 100;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brick/30 bg-brick-soft/40 p-4">
      <AlertTriangle size={20} className="shrink-0 text-brick" />
      <p className="min-w-0 flex-1 text-sm">
        <b>{weekday(date, "long")}'s order is {inr(total)} and your wallet {today ? `will have ${inr(after)} after today's milk` : `has ${inr(me.wallet)}`}.</b> Add {inr(short)} before 10 PM the night before, or that morning's milk will be held at the hub.
      </p>
      <Button size="sm" onClick={() => onTopUp(round)}>Add {inr(round)}</Button>
    </div>
  );
}

/* ---------- 4. Failed door: fix the instructions ---------- */
export function DoorFix() {
  const me = useMe();
  const save = useStore((s) => s.updateDropNote);
  const last = useStore((s) =>
    s.exceptions
      .filter((e) => e.customerId === s.meId && e.source === "rider" && e.kind === "access" && Date.now() - new Date(e.createdAt).getTime() < 3 * 864e5)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
  );
  const [note, setNote] = useState(me.dropNote);
  if (!last || (me.dropNoteAt && me.dropNoteAt > last.createdAt)) return null;
  const rider = riderById[routeById[me.routeId]!.riderId]!;
  return (
    <Card className="border border-marigold/40 p-5">
      <p className="flex items-center gap-2 font-semibold"><DoorClosed size={18} className="text-marigold-deep" /> We couldn't reach your door on {dayMonth(last.createdAt.slice(0, 10))}</p>
      <p className="mt-1 text-sm text-ink-soft">{rider.name} noted: "{last.message}" Tell {rider.name.split(" ")[0]} where to leave it next time. He hears this read aloud at your door.</p>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} mt-3`} aria-label="Where to leave your milk" />
      <Button className="mt-3" size="sm" onClick={() => { save(note); toast("Saved. Your rider will see this tomorrow.", "good"); }}>Save instructions</Button>
    </Card>
  );
}

/* ---------- 2. Neighbour invite (no reward) ---------- */
export function InviteNeighbour() {
  const me = useMe();
  const share = useStore((s) => s.shareInvite);
  const neighbours = useStore((s) => s.customers.filter((c) => c.society === me.society && c.status === "active").length);
  const url = `${location.origin}${location.pathname}#/join`;
  const text = `We get fresh A2 milk from Cowland Daily, delivered to ${me.society} before 6:15 AM. Sign up here: ${url}`;
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-display text-lg font-semibold"><Share2 size={18} className="text-ink-3" /> Know a neighbour in {me.society}?</p>
      <p className="mt-1 text-sm text-ink-soft">{neighbours} home{neighbours === 1 ? "" : "s"} here already get milk from the same van, so it's an easy stop to add.</p>
      <Button className="mt-3 w-full" variant="soft" icon={<Share2 size={15} />} onClick={async () => {
        share();
        try {
          if (navigator.share) await navigator.share({ title: "Cowland Daily", text });
          else { await navigator.clipboard.writeText(text); toast("Invite copied. Paste it in your building's WhatsApp group.", "good"); }
        } catch { toast("Invite ready. Copy the link from the address bar if sharing didn't open.", "info"); }
      }}>Share an invite</Button>
    </Card>
  );
}

