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

export interface DayOverride {
  status?: DayStatus;
  extras?: LineItem[];
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

export type StopStatus = "pending" | "delivered" | "issue" | "skipped";

export interface Stop {
  id: string;
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
}

export interface Txn {
  id: string;
  customerId: string;
  at: string;
  kind: "debit" | "topup" | "refund";
  amount: number;
  note: string;
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
