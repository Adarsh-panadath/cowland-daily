import type { Product } from "../data/types";

/** Hand-drawn style product illustrations, so the prototype needs no stock photos. */
export function ProductArt({ product, size = 120, bg = true }: { product: Product; size?: number; bg?: boolean }) {
  const p = product;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className="block">
      {bg && <rect width="120" height="120" rx="24" fill="#ECEEF3" />}
      <ellipse cx="60" cy="104" rx="30" ry="5" fill="#14213D" opacity=".08" />
      {p.id === "toned" ? (
        <g>
          <path d="M38 34 Q60 26 82 34 L86 96 Q60 104 34 96 Z" fill="#EEF3FA" stroke="#2B3A67" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M40 56 Q60 50 80 56 L82 78 Q60 84 38 78 Z" fill="#6C8EF5" opacity=".85" />
          <path d="M52 64 h16 M50 70 h20" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M44 34 l4 -8 M76 34 l-4 -8" stroke="#2B3A67" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ) : p.kind === "milk" || p.kind === "buttermilk" ? (
        <g>
          <rect x="50" y="14" width="20" height="9" rx="2.5" fill={p.id === "buff" ? "#2B3A67" : p.kind === "buttermilk" ? "#2F7D5B" : "#F2A900"} />
          <path d="M51 23 h18 v10 q12 8 12 20 v40 q0 8 -8 8 h-26 q-8 0 -8 -8 v-40 q0 -12 12 -20 z" fill="#fff" stroke="#2B3A67" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M42 56 h36 v37 q0 6 -6 6 h-24 q-6 0 -6 -6 z" fill={p.kind === "buttermilk" ? "#E1EEDB" : p.hue} />
          <path d="M42 56 h36" stroke="#2B3A67" strokeWidth="1.5" strokeDasharray="3 3" opacity=".35" />
          <rect x="46" y="66" width="28" height="16" rx="4" fill={p.id === "buff" ? "#2B3A67" : p.kind === "buttermilk" ? "#2F7D5B" : "#F2A900"} />
          <path d="M51 74 h18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M48 40 q-3 6 -3 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
        </g>
      ) : p.kind === "curd" ? (
        <g>
          <ellipse cx="60" cy="42" rx="30" ry="8" fill="#FBF8F2" stroke="#8A4B2A" strokeWidth="2.5" />
          <path d="M30 42 q-2 34 14 52 q16 10 32 0 q16 -18 14 -52" fill="#C0703F" stroke="#8A4B2A" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M34 60 q26 8 52 0" stroke="#8A4B2A" strokeWidth="2" opacity=".5" fill="none" />
          <path d="M37 72 q23 7 46 0" stroke="#8A4B2A" strokeWidth="2" opacity=".35" fill="none" />
          <ellipse cx="60" cy="42" rx="24" ry="5" fill="#fff" />
        </g>
      ) : p.kind === "ghee" ? (
        <g>
          <rect x="38" y="22" width="44" height="12" rx="3" fill="#2B3A67" />
          <path d="M36 34 h48 v54 q0 10 -10 10 h-28 q-10 0 -10 -10 z" fill="#fff" stroke="#2B3A67" strokeWidth="2.5" />
          <path d="M39 50 h42 v38 q0 7 -7 7 h-28 q-7 0 -7 -7 z" fill="#F2C14E" />
          <circle cx="50" cy="66" r="2" fill="#E5A90F" /><circle cx="64" cy="74" r="2.4" fill="#E5A90F" /><circle cx="70" cy="60" r="1.8" fill="#E5A90F" /><circle cx="55" cy="82" r="2" fill="#E5A90F" />
        </g>
      ) : p.kind === "paneer" ? (
        <g>
          <path d="M28 58 L60 44 L92 58 L60 72 Z" fill="#FFFDF6" stroke="#2B3A67" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M28 58 v22 L60 94 V72 Z" fill="#F3EBD8" stroke="#2B3A67" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M92 58 v22 L60 94 V72 Z" fill="#EADFC6" stroke="#2B3A67" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="54" cy="56" r="1.6" fill="#2F7D5B" /><circle cx="66" cy="60" r="1.6" fill="#2F7D5B" /><circle cx="60" cy="52" r="1.3" fill="#14213D" />
        </g>
      ) : p.kind === "butter" ? (
        <g>
          <path d="M32 50 h56 l-5 40 q-1 6 -7 6 h-32 q-6 0 -7 -6 z" fill="#fff" stroke="#2B3A67" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M40 50 q4 -16 20 -16 q16 0 20 16 z" fill="#FFF3C7" stroke="#2B3A67" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="44" y="64" width="32" height="14" rx="4" fill="#F2A900" />
        </g>
      ) : (
        <g>
          <path d="M34 46 h52 l-8 44 q-2 8 -10 8 h-16 q-8 0 -10 -8 z" fill="#B5683A" stroke="#7A3F1E" strokeWidth="2.5" strokeLinejoin="round" />
          <ellipse cx="60" cy="46" rx="26" ry="7" fill="#F7D58B" stroke="#7A3F1E" strokeWidth="2.5" />
          <circle cx="54" cy="45" r="1.6" fill="#C2410C" /><circle cx="64" cy="47" r="1.6" fill="#C2410C" /><path d="M58 42 l6 -3" stroke="#2F7D5B" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
