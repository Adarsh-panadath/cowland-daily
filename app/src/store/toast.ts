import { create } from "zustand";

export interface Toast {
  id: number;
  text: string;
  tone: "good" | "info" | "warn";
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let n = 0;
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (text: string, tone: Toast["tone"] = "good", action?: Toast["action"]) =>
  useToast.getState().push({ text, tone, action });
