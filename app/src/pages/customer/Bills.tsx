import { Download, FileText } from "lucide-react";
import { useStore, useMe } from "../../store/useStore";
import { ME } from "../../data/seed";
import { dayKey, dayMonth, inr, weekday, clock } from "../../lib/format";
import { Badge, Button, Card, CardHead } from "../../components/ui";
import { toast } from "../../store/toast";

export default function Bills() {
  const me = useMe();
  const txns = useStore((s) => s.txns.filter((t) => t.customerId === ME));
  const debits = txns.filter((t) => t.kind === "debit");
  const refunds = txns.filter((t) => t.kind === "refund").reduce((s, t) => s + t.amount, 0);
  const total = debits.reduce((s, t) => s + t.amount, 0);
  const now = new Date();
  const month = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const download = () => {
    const rows = [["Date", "Time", "Type", "Description", "Amount (INR)"], ...txns.map((t) => [dayKey(new Date(t.at)), clock(t.at), t.kind, t.note, (t.kind === "debit" ? -t.amount : t.amount).toString()])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cowland-statement-${me.flat}-${dayKey(now)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Statement downloaded.");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-ink-soft">Deliveries billed</p><p className="font-display text-3xl font-bold tabular">{debits.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-ink-soft">Total spent</p><p className="font-display text-3xl font-bold tabular">{inr(total)}</p></Card>
        <Card className="p-5"><p className="text-sm text-ink-soft">Refunds received</p><p className="font-display text-3xl font-bold tabular text-neem">{inr(refunds)}</p></Card>
      </div>
      <Card>
        <CardHead title={`Statement for ${month}`} sub={`${me.name}, ${me.flat} ${me.society}`} right={<Button size="sm" variant="outline" icon={<Download size={15} />} onClick={download}>Download CSV</Button>} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-y border-milk-2 bg-milk text-left text-ink-soft">
                <th className="px-5 py-2.5 font-semibold">Day</th>
                <th className="px-3 py-2.5 font-semibold">What</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-milk-2">
              {txns.map((t) => {
                const k = dayKey(new Date(t.at));
                return (
                  <tr key={t.id} className="hover:bg-milk/60">
                    <td className="whitespace-nowrap px-5 py-3"><span className="font-semibold">{dayMonth(k)}</span> <span className="text-ink-soft">{weekday(k)}</span></td>
                    <td className="px-3 py-3"><span className="flex items-center gap-2"><FileText size={14} className="text-ink-soft" />{t.note}</span></td>
                    <td className="px-3 py-3">{t.kind === "debit" ? <Badge tone="neutral">Paid from wallet</Badge> : t.kind === "topup" ? <Badge tone="good">Top-up</Badge> : <Badge tone="warn">Refund</Badge>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular">{t.kind === "debit" ? "−" : "+"}{inr(t.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
