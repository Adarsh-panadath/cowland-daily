export type ProductKind = "milk" | "curd" | "ghee" | "paneer" | "sweet" | "butter" | "buttermilk";

export interface Product {
  id: string;
  name: string;
  mr: string; // Marathi name
  kind: ProductKind;
  size: string;
  volumeMl: number; // milk-equivalent volume for litre counts (0 for non-liquid)
  price: number;
  desc: string;
  note: string; // short spec line, e.g. "Fat 6.5% · glass bottle"
  hue: string; // swatch colour for illustrations
  subscribable: boolean;
}

export interface LineItem {
  productId: string;
  qty: number;
}

export type DayStatus = "scheduled" | "skipped" | "vacation";

/** One customer's changes for one delivery date. `qty` holds absolute quantities (0 removes an item). */
export interface DayOverride {
  status?: DayStatus;
  qty?: Record<string, number>;
}

export interface PlanChange {
  from: string; // first delivery date this plan applies to
  items: LineItem[];
}

export interface Customer {
  id: string;
  name: string; // household / contact name
  contact: string;
  flat: string;
  society: string;
  area: string;
  routeId: string;
  phone: string;
  plan: LineItem[];
  wallet: number;
  since: string; // YYYY-MM-DD
  status: "active" | "paused";
  dropNote: string;
  dropNoteAt?: string; // when the customer last changed it
  planChanges?: PlanChange[];
  startDate?: string; // first delivery date for new households
  landmark?: string;
  isNew?: boolean;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  routeId: string;
  rating: number;
  years: number;
}

export interface Route {
  id: string;
  code: string;
  name: string;
  area: string;
  riderId: string;
  window: string;
  color: string;
  van: string;
  tempC: number;
}

export type StopStatus = "pending" | "delivered" | "issue" | "skipped" | "held";

export interface Stop {
  id: string;
  orderId: string;
  date: string;
  customerId: string;
  routeId: string;
  seq: number;
  items: LineItem[];
  status: StopStatus;
  at?: string; // ISO time of delivery / issue
  bottlesDue: number;
  bottlesCollected: number;
  issueNote?: string;
  confirmed?: boolean;
  confirmedAt?: string;
  delivered?: LineItem[]; // what actually reached the door; missing means not attempted yet
  charged?: number; // amount debited for this order (after reversals)
  holdReason?: string;
  fromVan?: LineItem[]; // spares bought from the van this morning (already included in items)
  releasedAt?: string; // when a held order went back on the van after a top-up
}

export type ExceptionKind = "missing" | "leak" | "late" | "seal" | "access" | "quality" | "callback";

export interface Exception {
  id: string;
  kind: ExceptionKind;
  customerId: string;
  routeId: string;
  source: "customer" | "rider" | "system";
  message: string;
  createdAt: string;
  status: "open" | "resolved";
  refund?: number;
  resolution?: string;
  orderId?: string;
  items?: LineItem[]; // affected lines
}

export interface Txn {
  id: string;
  customerId: string;
  at: string;
  kind: "debit" | "topup" | "refund";
  amount: number;
  note: string;
  orderId?: string;
  live?: boolean; // created during the demo (seed history is already in opening balances)
}

export interface Batch {
  id: string;
  date: string;
  fat: number;
  snf: number;
  tempC: number;
  litres: number;
  urea: "nil" | "trace";
  starch: "nil";
  chemist: string;
  status: "passed" | "held";
}

export type Role = "customer" | "rider" | "admin";

export interface Notice {
  id: string;
  role: Role;
  text: string;
  at: string;
  read: boolean;
  tone: "info" | "good" | "warn";
}

export interface WaitEntry {
  id: string;
  name: string;
  mobile: string;
  area: string;
  litres: number;
  at: string;
  sample?: boolean;
}

export interface Share {
  customerId: string;
  society: string;
  routeId: string;
  at: string;
}

export type Actor = "customer" | "rider" | "hub" | "simulation" | "system";

/** One line in the demo's activity log: who did what, and what it did to money. */
export interface ActivityEvent {
  id: string;
  at: string; // real clock time of the click
  day: string; // demo delivery date it happened on
  actor: Actor;
  who: string;
  action: string;
  detail: string;
  orderId?: string;
  amount?: number; // wallet effect: + money in, − money out
  blocked?: boolean; // the rules refused it (locked day, paused day, sold out…)
}
