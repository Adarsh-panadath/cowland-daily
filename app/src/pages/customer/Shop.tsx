import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Search, ShoppingBasket, Plus, PackageOpen } from "lucide-react";
import { products } from "../../data/seed";
import type { Product } from "../../data/types";
import { useStore, useMe, lineTotal } from "../../store/useStore";
import { addDays, dayKey, dayMonth, inr, weekday } from "../../lib/format";
import { Button, Drawer, Empty, Modal, Stepper, inputCls } from "../../components/ui";
import { ProductArt } from "../../components/ProductArt";
import { toast } from "../../store/toast";

const cats = [
  { id: "all", label: "Everything" },
  { id: "milk", label: "Milk" },
  { id: "cultured", label: "Dahi & taak" },
  { id: "fat", label: "Ghee & butter" },
  { id: "treats", label: "Paneer & sweets" },
] as const;
type Cat = (typeof cats)[number]["id"];
const inCat = (p: Product, c: Cat) =>
  c === "all" ||
  (c === "milk" && p.kind === "milk") ||
  (c === "cultured" && (p.kind === "curd" || p.kind === "buttermilk")) ||
  (c === "fat" && (p.kind === "ghee" || p.kind === "butter")) ||
  (c === "treats" && (p.kind === "paneer" || p.kind === "sweet"));

export default function Shop() {
  const [cat, setCat] = useState<Cat>("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useStore((s) => s.cart);
  const cartAdd = useStore((s) => s.cartAdd);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const list = useMemo(
    () => products.filter((p) => inCat(p, cat) && (p.name + p.mr + p.desc).toLowerCase().includes(q.toLowerCase())),
    [cat, q],
  );

  const add = (p: Product) => {
    cartAdd(p.id, 1);
    toast(`${p.name} added to your basket.`, "good", { label: "View", run: () => setCartOpen(true) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Fresh from the farm</h1>
          <p className="mt-1 text-ink-soft">Order by 10 PM and it comes in tomorrow's crate with your milk.</p>
        </div>
        <Button variant="primary" icon={<ShoppingBasket size={17} />} onClick={() => setCartOpen(true)}>
          Basket {count > 0 && <span className="rounded-full bg-marigold px-2 py-0.5 text-xs text-ink tabular">{count}</span>}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {cats.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={clsx("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", cat === c.id ? "bg-ink text-white" : "bg-white text-ink-3 shadow-sm hover:text-ink")}>{c.label}</button>
          ))}
        </div>
        <label className="relative sm:ml-auto sm:w-64">
          <span className="sr-only">Search products</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search paneer, ghee…" className={clsx(inputCls, "pl-9")} />
        </label>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Search size={20} />} title="Nothing matches that" body="Try a different word, or browse everything." action={<Button variant="soft" onClick={() => { setQ(""); setCat("all"); }}>Show everything</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const inCart = cart.find((c) => c.productId === p.id)?.qty ?? 0;
            return (
              <article key={p.id} className="flex flex-col rounded-3xl bg-white p-4 shadow-lift">
                <button onClick={() => setDetail(p)} className="flex gap-4 text-left" aria-label={`About ${p.name}`}>
                  <ProductArt product={p} size={96} />
                  <div className="min-w-0 pt-1">
                    <p className="font-mr text-sm text-ink-soft">{p.mr}</p>
                    <h2 className="font-display text-lg font-semibold leading-snug">{p.name}</h2>
                    <p className="text-sm text-ink-soft">{p.size}</p>
                    <p className="mt-1 text-xs text-ink-3">{p.note}</p>
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-display text-2xl font-bold tabular">{inr(p.price)}</span>
                  {inCart > 0 ? (
                    <Stepper label={p.name} value={inCart} onChange={(v) => cartAdd(p.id, v - inCart)} />
                  ) : (
                    <Button size="sm" icon={<Plus size={15} />} onClick={() => add(p)}>Add</Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} footer={detail && <Button onClick={() => { add(detail); setDetail(null); }}>Add for {inr(detail.price)}</Button>}>
        {detail && (
          <div>
            <div className="flex justify-center rounded-2xl bg-milk-2 py-4"><ProductArt product={detail} size={160} bg={false} /></div>
            <p className="mt-4 font-mr text-ink-soft">{detail.mr}</p>
            <p className="mt-2 leading-relaxed">{detail.desc}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-milk p-3"><dt className="text-ink-soft">Pack</dt><dd className="font-semibold">{detail.size}</dd></div>
              <div className="rounded-xl bg-milk p-3"><dt className="text-ink-soft">Good to know</dt><dd className="font-semibold">{detail.note}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const cart = useStore((s) => s.cart);
  const cartAdd = useStore((s) => s.cartAdd);
  const checkout = useStore((s) => s.checkout);
  const nav = useNavigate();
  const startOffset = new Date().getHours() >= 22 ? 2 : 1;
  const dates = Array.from({ length: 4 }, (_, i) => dayKey(addDays(new Date(), startOffset + i)));
  const [date, setDate] = useState(dates[0]!);
  const total = lineTotal(cart);
  const short = total > me.wallet;

  return (
    <Drawer open={open} onClose={onClose} title="Your basket"
      footer={cart.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between"><span className="text-ink-soft">Total</span><span className="font-display text-2xl font-bold tabular">{inr(total)}</span></div>
          {short && <p className="text-sm text-brick">Your wallet has {inr(me.wallet)}. Add money before 10 PM so this can be packed.</p>}
          <Button size="lg" className="w-full" onClick={() => {
            const t = checkout(date);
            toast(`Added to your ${weekday(date, "long")} crate. ${inr(t)} will be charged on delivery.`);
            onClose();
            nav("/customer");
          }}>Add to {dates[0] === date && startOffset === 1 ? "tomorrow's" : `${weekday(date, "long")}'s`} crate</Button>
        </div>
      )}>
      {cart.length === 0 ? (
        <Empty icon={<PackageOpen size={20} />} title="Your basket is empty" body="Add paneer, ghee or extra milk and it rides along with your morning delivery." />
      ) : (
        <div className="space-y-5 pb-6">
          <ul className="divide-y divide-milk-2">
            {cart.map((i) => {
              const p = products.find((x) => x.id === i.productId)!;
              return (
                <li key={i.productId} className="flex items-center gap-3 py-3">
                  <ProductArt product={p} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-sm text-ink-soft tabular">{inr(p.price * i.qty)}</p>
                  </div>
                  <Stepper label={p.name} value={i.qty} onChange={(v) => cartAdd(p.id, v - i.qty)} />
                </li>
              );
            })}
          </ul>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Deliver with milk on</legend>
            <div className="grid grid-cols-4 gap-2">
              {dates.map((d) => (
                <button key={d} onClick={() => setDate(d)} aria-pressed={date === d} className={clsx("rounded-xl border py-2 text-center", date === d ? "border-ink bg-ink text-white" : "border-milk-3")}>
                  <span className="block text-xs opacity-70">{weekday(d)}</span>
                  <span className="block text-sm font-semibold">{dayMonth(d)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </Drawer>
  );
}
