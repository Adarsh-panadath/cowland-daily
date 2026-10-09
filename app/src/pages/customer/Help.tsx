import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, MessageCircle, Phone, TicketCheck, CircleDot, CheckCircle2 } from "lucide-react";
import { useStore, kindLabel } from "../../store/useStore";
import { ME } from "../../data/seed";
import { inr, timeAgo } from "../../lib/format";
import { Badge, Button, Card, CardHead, Empty } from "../../components/ui";
import { ReportModal } from "../../components/customer";

const faqs = [
  ["When do I need to make changes by?", "Changes for tomorrow lock at 10 PM tonight, when the hub starts packing crates. Anything after that applies from the day after."],
  ["What happens to the glass bottles?", "Leave yesterday's empties in your basket. The rider collects them, and the hub washes them at 85°C and steam-sterilises them before reuse."],
  ["Is raw-chilled milk safe to drink without boiling?", "We test every batch, but we still recommend boiling for children, older family members and anyone pregnant. It keeps for two days at 4°C."],
  ["How do refunds work?", "If something is missing, leaked or late, report it here. Approved refunds go to your Cowland wallet, usually within 30 minutes."],
  ["Can I pause for a long trip?", "Yes. Use “Going away?” on your diary. There's no fee for pausing and your regular order restarts automatically."],
];

export default function Help() {
  const tickets = useStore((s) => s.exceptions.filter((e) => e.customerId === ME));
  const [open, setOpen] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card>
          <CardHead title="Your reports" sub="Problems you've told us about, and what we did." right={<Button size="sm" onClick={() => setOpen(true)}>Report a problem</Button>} />
          {tickets.length === 0 ? (
            <Empty icon={<TicketCheck size={20} />} title="No reports yet" body="If a delivery isn't right, tell us and we'll sort it out the same morning." />
          ) : (
            <ul className="space-y-3 p-5">
              {tickets.map((t) => (
                <li key={t.id} className="rounded-2xl bg-milk p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{kindLabel[t.kind]}</p>
                    {t.status === "open" ? <Badge tone="warn" dot>With the hub team</Badge> : <Badge tone="good" dot>Resolved</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{t.message}</p>
                  <ol className="mt-4 space-y-2 text-sm">
                    <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-neem" /> Reported {timeAgo(t.createdAt)}</li>
                    <li className="flex items-center gap-2">{t.status === "resolved" ? <CheckCircle2 size={16} className="text-neem" /> : <CircleDot size={16} className="text-marigold-deep" />} Hub team reviewing</li>
                    <li className={clsx("flex items-center gap-2", t.status === "open" && "text-ink-soft")}>
                      {t.status === "resolved" ? <CheckCircle2 size={16} className="text-neem" /> : <CircleDot size={16} className="text-milk-3" />}
                      {t.status === "resolved" ? (t.refund ? `${inr(t.refund)} credited to your wallet` : t.resolution) : "Resolution"}
                    </li>
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Common questions" />
          <div className="p-3">
            {faqs.map(([q, a], i) => (
              <div key={q} className="border-b border-milk-2 last:border-0">
                <button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i} className="flex w-full items-center justify-between gap-4 px-2 py-4 text-left font-semibold">
                  {q}
                  <ChevronDown size={18} className={clsx("shrink-0 transition", faq === i && "rotate-180")} />
                </button>
                {faq === i && <p className="animate-fade px-2 pb-4 text-sm leading-relaxed text-ink-soft">{a}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <p className="font-display text-lg font-semibold">Talk to the dawn desk</p>
          <p className="mt-1 text-sm text-ink-soft">Open 4:30 AM to 10:30 PM, every day.</p>
          <div className="mt-4 grid gap-2">
            <a href="tel:+912402345890"><Button variant="outline" className="w-full" icon={<Phone size={16} />}>Call +91 240 2345 890</Button></a>
            <a href="https://wa.me/919422012345" target="_blank" rel="noreferrer"><Button variant="soft" className="w-full" icon={<MessageCircle size={16} />}>WhatsApp us</Button></a>
          </div>
        </Card>
        <Card className="bg-marigold-soft p-5 shadow-none">
          <p className="font-semibold">Something wrong this morning?</p>
          <p className="mt-1 text-sm text-ink-3">Report before 7 AM and a replacement can still reach you on the same route.</p>
          <Button className="mt-4" onClick={() => setOpen(true)}>Report a problem</Button>
        </Card>
      </div>
      <ReportModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
