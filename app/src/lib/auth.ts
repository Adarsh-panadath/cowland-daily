import type { Role } from "../data/types";

/**
 * Demo accounts. This is a static prototype, so sign-in is checked in the browser.
 * A production build would verify these on a server (OTP via SMS gateway, hashed PINs/passwords, sessions).
 */
export interface DemoAccount {
  role: Role;
  name: string;
  sub: string;
  initials: string;
  color: string;
  home: string;
  label: string; // who this account is for, in plain words
  id: string;
  secret: string;
}

export const accounts: Record<Role, DemoAccount> = {
  customer: {
    role: "customer",
    name: "Aditi Deshmukh",
    sub: "B-402, Anand Vihar",
    initials: "AD",
    color: "#F2A900",
    home: "/customer",
    label: "Customer",
    id: "9822041567",
    secret: "1234",
  },
  rider: {
    role: "rider",
    name: "Ganesh Shinde",
    sub: "Route 04, EV van 02",
    initials: "GS",
    color: "#2F7D5B",
    home: "/rider",
    label: "Delivery partner",
    id: "CD-R04",
    secret: "4404",
  },
  admin: {
    role: "admin",
    name: "Mahesh Kale",
    sub: "Dispatch lead, Samarth Nagar hub",
    initials: "MK",
    color: "#6C8EF5",
    home: "/admin",
    label: "Hub staff",
    id: "mahesh@cowlanddaily.in",
    secret: "dawn2026",
  },
};

export const normalisePhone = (s: string) => s.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
