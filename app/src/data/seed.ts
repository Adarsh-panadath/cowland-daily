import type { Batch, Customer, Exception, LineItem, Notice, Product, Rider, Route, Stop, Txn, WaitEntry } from "./types";
import { addDays, dayKey } from "../lib/format";

/* Deterministic PRNG so the demo looks the same on every load */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(431001);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (a: number, b: number) => a + rand() * (b - a);

export const ME = "c-001";

/** Stable, human-readable order ID: one consolidated order per household per delivery date. */
export const orderIdFor = (date: string, customerId: string) => `CD-${date.slice(5, 7)}${date.slice(8, 10)}-${customerId.replace("c-", "")}`;

export const products: Product[] = [
  { id: "a2", name: "Gir cow A2 milk", mr: "गीर गाईचे दूध", kind: "milk", size: "500 ml glass bottle", volumeMl: 500, price: 48, desc: "Single-herd Gir milk from Khuldabad, chilled to 4°C within 40 minutes of milking. Never boiled, never homogenised.", note: "Fat 4.6–5.0%, returnable glass", hue: "#F6F7F9", subscribable: true },
  { id: "buff", name: "Buffalo malai milk", mr: "म्हशीचे दूध", kind: "milk", size: "500 ml glass bottle", volumeMl: 500, price: 42, desc: "Thick Murrah buffalo milk for chai, kheer and setting your own dahi. Leaves a proper layer of malai.", note: "Fat 7.0–7.5%, returnable glass", hue: "#FFFDF4", subscribable: true },
  { id: "toned", name: "Everyday toned milk", mr: "रोजचे दूध", kind: "milk", size: "500 ml pouch", volumeMl: 500, price: 30, desc: "Lighter cow milk for families who want fresh dairy without the cream. Comes in a recyclable pouch.", note: "Fat 3.0%, pouch", hue: "#EEF3FA", subscribable: true },
  { id: "dahi", name: "Matka dahi", mr: "मातीच्या मडक्यातील दही", kind: "curd", size: "400 g clay pot", volumeMl: 0, price: 55, desc: "Set overnight in unglazed clay so it comes out thick and slightly tangy. Return the pot and we reuse it.", note: "Set in clay, 2-day shelf life", hue: "#F3E9DC", subscribable: true },
  { id: "taak", name: "Masala taak", mr: "मसाला ताक", kind: "buttermilk", size: "500 ml bottle", volumeMl: 0, price: 25, desc: "Churned buttermilk with roasted jeera, ginger and coriander. Best before lunch.", note: "Fresh churned, same day", hue: "#E8F0E4", subscribable: true },
  { id: "paneer", name: "Malai paneer", mr: "मलई पनीर", kind: "paneer", size: "200 g block", volumeMl: 0, price: 110, desc: "Pressed this morning from A2 milk set with lemon. Soft enough for bhurji, firm enough for tikka.", note: "Made today, never frozen", hue: "#FAF6EC", subscribable: false },
  { id: "ghee", name: "Bilona ghee", mr: "बिलोना तूप", kind: "ghee", size: "500 ml jar", volumeMl: 0, price: 1250, desc: "Hand-churned from cultured A2 butter and simmered slowly until granular. One jar takes 25 litres of milk.", note: "Bilona method, 6-month shelf life", hue: "#F2C14E", subscribable: false },
  { id: "loni", name: "White loni butter", mr: "पांढरे लोणी", kind: "butter", size: "200 g tub", volumeMl: 0, price: 140, desc: "Unsalted white butter skimmed from churned dahi. The kind your aaji kept for thalipeeth.", note: "Unsalted, keep chilled", hue: "#FFF8E1", subscribable: false },
  { id: "shrikhand", name: "Kesar shrikhand", mr: "केशर श्रीखंड", kind: "sweet", size: "250 g kulhad", volumeMl: 0, price: 85, desc: "Hung chakka whipped with saffron, cardamom and a little mishri. Made in small batches on weekends.", note: "Weekends only, contains sugar", hue: "#F7D58B", subscribable: false },
];

export const productById = Object.fromEntries(products.map((p) => [p.id, p])) as Record<string, Product>;

export const routes: Route[] = [
  { id: "r1", code: "01", name: "Station Road & Kranti Chowk", area: "Central", riderId: "rd1", window: "5:00 – 5:50 AM", color: "#2a78d6", van: "EV van 01", tempC: 3.6 },
  { id: "r2", code: "02", name: "CIDCO N-1 to N-6", area: "CIDCO", riderId: "rd2", window: "5:20 – 6:10 AM", color: "#eb6834", van: "EV van 03", tempC: 3.9 },
  { id: "r3", code: "03", name: "Ulkanagari & Beed Bypass", area: "South", riderId: "rd3", window: "5:30 – 6:20 AM", color: "#1baf7a", van: "EV van 05", tempC: 4.2 },
  { id: "r4", code: "04", name: "Samarth Nagar & Garkheda", area: "Samarth Nagar", riderId: "rd4", window: "5:15 – 6:15 AM", color: "#eda100", van: "EV van 02", tempC: 3.8 },
  { id: "r5", code: "05", name: "Jalna Road & Mukundwadi", area: "East", riderId: "rd5", window: "5:25 – 6:20 AM", color: "#e87ba4", van: "EV van 04", tempC: 4.0 },
];
export const routeById = Object.fromEntries(routes.map((r) => [r.id, r])) as Record<string, Route>;

export const riders: Rider[] = [
  { id: "rd1", name: "Rahul Bhosale", phone: "+91 97654 32189", vehicle: "EV van 01", routeId: "r1", rating: 4.9, years: 3 },
  { id: "rd2", name: "Sachin Patil", phone: "+91 98231 44102", vehicle: "EV van 03", routeId: "r2", rating: 4.8, years: 2 },
  { id: "rd3", name: "Aniket Kulkarni", phone: "+91 99701 55670", vehicle: "EV van 05", routeId: "r3", rating: 4.6, years: 1 },
  { id: "rd4", name: "Ganesh Shinde", phone: "+91 94220 88712", vehicle: "EV van 02", routeId: "r4", rating: 4.9, years: 4 },
  { id: "rd5", name: "Pooja Jadhav", phone: "+91 90284 61733", vehicle: "EV van 04", routeId: "r5", rating: 4.7, years: 1 },
];
export const riderById = Object.fromEntries(riders.map((r) => [r.id, r])) as Record<string, Rider>;

export const societies: Record<string, string[]> = {
  r1: ["Bansilal Nagar", "Usmanpura Heights", "Padampura Residency", "Kranti Chowk Towers"],
  r2: ["Avishkar Colony", "Shivaji Nagar", "CIDCO N-4 Sector B", "Jijamata Colony"],
  r3: ["Ulkanagari Shanti Niwas", "Mahanubhav Society", "Sutgirni Chowk Apts", "Beed Bypass Greens"],
  r4: ["Anand Vihar", "Mayur Park", "Gajanan Society", "Garkheda Parisar"],
  r5: ["Mukundwadi Gardens", "Jalna Road Residency", "Chikalthana Enclave", "Kamgar Colony"],
};
const surnames = ["Kulkarni", "Joshi", "Patil", "Jadhav", "Pawar", "More", "Gaikwad", "Chavan", "Deshpande", "Sawant", "Kale", "Wagh", "Thakur", "Sharma", "Shaikh", "Iyer", "Mehta", "Agrawal", "Rathod", "Salunke", "Karande", "Gokhale", "Apte", "Lokhande", "Mane", "Nikam", "Bhide", "Khan", "Pande", "Dange"];
const firsts = ["Arvind", "Sneha", "Meera", "Rohan", "Priya", "Sunil", "Anjali", "Vikas", "Kavita", "Amol", "Swati", "Nikhil", "Rekha", "Sameer", "Pallavi", "Imran", "Farah", "Ramesh", "Neha", "Ajay", "Gauri", "Tejas", "Manasi", "Omkar"];
const notes = [
  "Hang the bag on the door latch. Don't ring the bell.",
  "Leave in the blue cooler by the shoe rack.",
  "Watchman collects for the building — hand to him.",
  "Ring once softly after 6 AM.",
  "Wire basket on the grill. Empties will be inside it.",
  "Elderly couple — please place on the stool, not the floor.",
];
const planTemplates: LineItem[][] = [
  [{ productId: "a2", qty: 2 }],
  [{ productId: "a2", qty: 1 }],
  [{ productId: "buff", qty: 2 }],
  [{ productId: "a2", qty: 2 }, { productId: "dahi", qty: 1 }],
  [{ productId: "toned", qty: 2 }],
  [{ productId: "buff", qty: 1 }, { productId: "a2", qty: 1 }],
  [{ productId: "a2", qty: 4 }],
  [{ productId: "toned", qty: 1 }, { productId: "taak", qty: 1 }],
];

const today = new Date();
const sizes: Record<string, number> = { r1: 22, r2: 26, r3: 21, r4: 16, r5: 19 };

function buildCustomers(): Customer[] {
  const list: Customer[] = [
    {
      id: ME,
      name: "Deshmukh family",
      contact: "Aditi Deshmukh",
      flat: "B-402",
      society: "Anand Vihar",
      area: "Samarth Nagar",
      routeId: "r4",
      phone: "+91 12345 67890",
      plan: [
        { productId: "a2", qty: 3 },
        { productId: "dahi", qty: 1 },
      ],
      wallet: 1420,
      since: dayKey(addDays(today, -412)),
      status: "active",
      dropNote: "Wire basket on the iron grill. Please don't ring before 6:30 AM.",
    },
  ];
  let n = 2;
  for (const r of routes) {
    const count = sizes[r.id]! - (r.id === "r4" ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const sur = pick(surnames);
      const first = pick(firsts);
      const soc = pick(societies[r.id]!);
      const wing = pick(["A", "B", "C", "D"]);
      const flat = `${wing}-${Math.floor(between(1, 7))}0${Math.floor(between(1, 5))}`;
      list.push({
        id: `c-${String(n).padStart(3, "0")}`,
        name: `${sur} family`,
        contact: `${first} ${sur}`,
        flat,
        society: soc,
        area: r.area,
        routeId: r.id,
        phone: `+91 9${Math.floor(between(100000000, 999999999))}`,
        plan: pick(planTemplates).map((x) => ({ ...x })),
        wallet: Math.round(between(-180, 3200) / 10) * 10,
        since: dayKey(addDays(today, -Math.floor(between(12, 700)))),
        status: rand() < 0.06 ? "paused" : "active",
        dropNote: pick(notes),
      });
      n++;
    }
  }
  return list;
}

export const seedCustomers = buildCustomers();

/** Fraction of each route already delivered when the demo opens */
const progress: Record<string, number> = { r1: 1, r2: 0.84, r3: 0.52, r4: 0.56, r5: 0.4 };
const routeStartMin: Record<string, number> = { r1: 300, r2: 320, r3: 330, r4: 315, r5: 325 };

function atMinute(min: number) {
  const d = new Date(today);
  d.setHours(Math.floor(min / 60), Math.floor(min % 60), Math.floor(rand() * 59), 0);
  return d.toISOString();
}

function buildStops(customers: Customer[]): Stop[] {
  const stops: Stop[] = [];
  for (const r of routes) {
    const cs = customers.filter((c) => c.routeId === r.id && c.status === "active");
    // keep "me" early in route 4 so the customer view shows a completed drop
    if (r.id === "r4") cs.sort((a, b) => (a.id === ME ? -1 : b.id === ME ? 1 : 0));
    const done = Math.round(cs.length * progress[r.id]!);
    cs.forEach((c, i) => {
      const glass = c.plan.filter((p) => p.productId === "a2" || p.productId === "buff").reduce((s, p) => s + p.qty, 0);
      const delivered = i < done;
      const date = dayKey(today);
      stops.push({
        id: `s-${c.id}-${date}`,
        orderId: orderIdFor(date, c.id),
        date,
        customerId: c.id,
        routeId: r.id,
        seq: i + 1,
        items: c.plan.map((x) => ({ ...x })),
        status: delivered ? "delivered" : "pending",
        at: delivered ? atMinute(routeStartMin[r.id]! + i * 2.6 + rand()) : undefined,
        bottlesDue: glass,
        bottlesCollected: delivered ? Math.max(0, glass - (rand() < 0.15 ? 1 : 0)) : 0,
        delivered: delivered ? c.plan.map((x) => ({ ...x })) : undefined,
        charged: delivered ? c.plan.reduce((sum, x) => sum + (productById[x.productId]?.price ?? 0) * x.qty, 0) : undefined,
      });
    });
  }
  const mine = stops.find((s) => s.customerId === ME);
  if (mine) mine.bottlesCollected = 2;
  return stops;
}

export const seedStops = buildStops(seedCustomers);

/** Morning timestamps for seeded events: today at the given minute-of-day, or N minutes ago if that's earlier */
function ago(min: number) {
  const morning = new Date(today);
  morning.setHours(6, 40, 0, 0);
  const base = Math.min(Date.now(), morning.getTime());
  return new Date(base - min * 60000).toISOString();
}

/** Seeded customer tickets point at an order that was really delivered this morning, with the affected line. */
const deliveredWith = (routeId: string, pid: string) =>
  seedStops.find((s) => s.routeId === routeId && s.status === "delivered" && s.customerId !== ME && s.items.some((i) => i.productId === pid && i.qty >= 2)) ??
  seedStops.find((s) => s.routeId === routeId && s.status === "delivered" && s.customerId !== ME)!;
const exA = deliveredWith("r4", "a2");
const exB = deliveredWith("r2", "buff");

export const seedExceptions: Exception[] = [
  {
    id: "ex-1",
    kind: "missing",
    customerId: exA.customerId,
    routeId: "r4",
    source: "customer",
    message: `Ordered ${exA.items[0]!.qty} × ${productById[exA.items[0]!.productId]!.name}, one was missing from the bag.`,
    createdAt: ago(38),
    status: "open",
    orderId: exA.orderId,
    items: [{ productId: exA.items[0]!.productId, qty: 1 }],
  },
  {
    id: "ex-2",
    kind: "seal",
    customerId: exB.customerId,
    orderId: exB.orderId,
    items: [{ productId: exB.items[0]!.productId, qty: 1 }],
    routeId: "r2",
    source: "customer",
    message: `The paper cap on the ${productById[exB.items[0]!.productId]!.name.toLowerCase()} bottle was loose. Is it safe to drink?`,
    createdAt: ago(52),
    status: "open",
  },
  {
    id: "ex-3",
    kind: "late",
    customerId: seedCustomers.find((c) => c.routeId === "r3")!.id,
    routeId: "r3",
    source: "system",
    message: "Route 03 is running 14 minutes behind plan after a gate delay at Mahanubhav Society.",
    createdAt: ago(21),
    status: "open",
  },
  {
    id: "ex-4",
    kind: "leak",
    customerId: seedCustomers.find((c) => c.routeId === "r1")!.id,
    routeId: "r1",
    source: "rider",
    message: "Dahi pot cracked in the crate. Replaced from spare stock at the door.",
    createdAt: ago(60 * 26),
    status: "resolved",
    refund: 0,
    resolution: "Replaced on the spot",
  },
];

function buildTxns(): Txn[] {
  const out: Txn[] = [];
  for (let i = 1; i <= 24; i++) {
    const d = addDays(today, -i);
    d.setHours(6, 0, 0, 0);
    const extra = i % 7 === 2 ? 110 : 0;
    out.push({ id: `t-d${i}`, customerId: ME, at: d.toISOString(), kind: "debit", amount: 3 * 48 + 55 + extra, note: extra ? "Daily delivery + malai paneer" : "Daily delivery" });
  }
  const top = addDays(today, -9);
  top.setHours(20, 14, 0, 0);
  out.push({ id: "t-top1", customerId: ME, at: top.toISOString(), kind: "topup", amount: 3000, note: "UPI top-up via PhonePe" });
  const ref = addDays(today, -15);
  ref.setHours(8, 2, 0, 0);
  out.push({ id: "t-ref1", customerId: ME, at: ref.toISOString(), kind: "refund", amount: 48, note: "Refund — bottle leaked in transit" });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
export const seedTxns = buildTxns();

function buildBatches(): Batch[] {
  const out: Batch[] = [];
  for (let i = 0; i < 30; i++) {
    const date = dayKey(addDays(today, -i));
    const fat = +(between(4.55, 5.0)).toFixed(2);
    const snf = +(between(8.75, 9.25)).toFixed(2);
    out.push({
      id: `B${String(312 - i)}-SAM`,
      date,
      fat,
      snf,
      tempC: +between(3.3, 4.3).toFixed(1),
      litres: Math.round(between(92, 118)),
      urea: "nil",
      starch: "nil",
      chemist: i % 3 === 1 ? "Dr. Vaishali Rao" : "Dr. Meera Karkhanis",
      status: i === 17 ? "held" : "passed",
    });
  }
  return out;
}
export const seedBatches = buildBatches();

/** 30 days of history for admin charts */
export const history = Array.from({ length: 30 }, (_, k) => {
  const i = 29 - k;
  const d = addDays(today, -i);
  const dow = d.getDay();
  const weekend = dow === 0 || dow === 6;
  const trend = 1 + (29 - i) * 0.006;
  const litresV = Math.round((1180 + between(-40, 50) + (weekend ? 90 : 0)) * trend);
  const revenue = Math.round(litresV * 96 * between(1.08, 1.18));
  return {
    date: dayKey(d),
    litres: litresV,
    revenue,
    onTime: +between(94.5, 99.4).toFixed(1),
    households: Math.round(litresV / 4.1),
    complaints: Math.max(0, Math.round(between(-1, 5))),
  };
});

/** Sample waitlist so the demand page has a starting point. Marked sample; new requests are added on top. */
export const seedWaitlist: WaitEntry[] = (() => {
  const out: WaitEntry[] = [];
  const plan: [string, number][] = [["Satara Parisar", 47], ["Harsul", 21], ["Padegaon", 9], ["Paithan Road", 14]];
  let k = 0;
  for (const [area, n] of plan) {
    for (let i = 0; i < n; i++) {
      out.push({ id: `w-${k}`, name: `${pick(firsts)} ${pick(surnames)}`, mobile: `9${String(700000000 + k * 7919).slice(0, 9)}`, area, litres: [0.5, 1, 1, 1.5, 2][k % 5]!, at: new Date(Date.now() - (k % 40) * 864e5).toISOString(), sample: true });
      k++;
    }
  }
  return out;
})();

export const seedNotices: Notice[] = [
  { id: "n1", role: "customer", text: "Today's milk is in your wire basket. Rider Ganesh picked up 2 empties.", at: ago(70), read: false, tone: "good" },
  { id: "n2", role: "customer", text: "Kesar shrikhand is back this weekend. Add it before 10 PM Friday.", at: ago(60 * 20), read: true, tone: "info" },
  { id: "n3", role: "rider", text: "Gate repair at CIDCO N-4 — use the rear entrance today.", at: ago(95), read: false, tone: "warn" },
  { id: "n4", role: "admin", text: "Waitlist for Satara Parisar reached 48 households.", at: ago(140), read: false, tone: "info" },
];
