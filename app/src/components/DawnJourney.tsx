import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const steps = [
  { t: 195, title: "Milked at the gotha", body: "Gir cows at our Khuldabad farm are milked by hand. No hormones, no early weaning of calves.", place: "Khuldabad" },
  { t: 225, title: "Chilled to 4°C", body: "Milk goes straight into a bulk chiller. It never sits warm, so it never needs boiling or preservatives.", place: "Farm chiller" },
  { t: 250, title: "Tested in the lab", body: "Every batch is checked for fat, SNF, urea and starch. The report is printed on your milk chit.", place: "Samarth Nagar hub" },
  { t: 270, title: "Vans leave the hub", body: "Five electric vans, each held at 3.8°C, leave with crates packed in drop order.", place: "Hub gate" },
  { t: 348, title: "At your door", body: "Bottles go into your basket quietly. You get a message with the time and a photo.", place: "Your doorstep" },
];
const START = 180;
const END = 375;

const sky = [
  { at: 0, top: "#070D20", bottom: "#14213D" },
  { at: 0.45, top: "#14213D", bottom: "#2B3A67" },
  { at: 0.72, top: "#2B3A67", bottom: "#B9879A" },
  { at: 0.88, top: "#4A5784", bottom: "#F2B48A" },
  { at: 1, top: "#7E9BD1", bottom: "#FFD9A8" },
];

function hex(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i]! - v) * t)).join(",")})`;
}
function skyAt(p: number) {
  let i = 0;
  while (i < sky.length - 2 && p > sky[i + 1]!.at) i++;
  const a = sky[i]!, b = sky[i + 1]!;
  const t = Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at)));
  return { top: mix(a.top, b.top, t), bottom: mix(a.bottom, b.bottom, t) };
}
const fmt = (m: number) => {
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return `${h}:${String(mm).padStart(2, "0")} AM`;
};

export function DawnJourney() {
  const [min, setMin] = useState(START);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number>();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setMin(348);
    else setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      setMin((m) => {
        const next = m + dt * 0.028;
        if (next >= 348) {
          setPlaying(false);
          return 348;
        }
        return next;
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current!);
  }, [playing]);

  const p = (min - START) / (END - START);
  const { top, bottom } = skyAt(p);
  const active = [...steps].reverse().find((s) => min >= s.t) ?? steps[0]!;
  const sunY = 210 - Math.max(0, p - 0.6) * 260;
  const vanX = min < 270 ? 70 : min > 348 ? 470 : 70 + ((min - 270) / 78) * 400;

  return (
    <div className="relative overflow-hidden rounded-[28px] shadow-pop ring-1 ring-white/10">
      <span className="absolute right-3 top-3 z-10 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] font-semibold text-white/80">Illustrative journey</span>
      <div className="relative h-[260px] sm:h-[300px]" style={{ background: `linear-gradient(${top}, ${bottom})` }}>
        <svg viewBox="0 0 540 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
          {/* stars fade as dawn comes */}
          <g fill="#fff" opacity={Math.max(0, 0.9 - p * 1.4)}>
            {[[40, 40], [120, 70], [200, 30], [300, 60], [380, 25], [470, 55], [510, 90], [80, 110], [250, 95], [430, 120]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} />
            ))}
          </g>
          <circle cx="410" cy={sunY} r="34" fill="#FFD27A" opacity={Math.min(1, Math.max(0, (p - 0.55) * 3))} />
          {/* farm on the left, city on the right */}
          <path d="M0 230 Q90 200 180 226 T360 222 T540 214 V300 H0 Z" fill="#0F1A33" opacity=".55" />
          <g fill="#0B1428">
            <path d="M20 240 l26 -22 l26 22 v26 h-52z" />
            <rect x="80" y="236" width="40" height="30" />
            <path d="M330 266 V214 h22 v52 M356 266 V196 h30 v70 M390 266 V222 h24 v44 M418 266 V204 h34 v62 M456 266 V228 h26 v38 M486 266 V210 h30 v56 M520 266 V232 h20 v34" />
          </g>
          <g fill="#FFE7A3" opacity={Math.max(0.15, 1 - p * 1.1)}>
            {[[362, 210], [372, 226], [428, 218], [440, 238], [494, 224], [500, 244], [336, 230]].map(([x, y], i) => (
              <rect key={i} x={x} y={y} width="5" height="7" rx="1" />
            ))}
          </g>
          <rect x="0" y="264" width="540" height="36" fill="#0B1428" />
          <path d="M0 278 H540" stroke="#F2A900" strokeWidth="2" strokeDasharray="10 12" opacity=".5" />
          {/* van */}
          <g transform={`translate(${vanX - 26}, 248)`}>
            <rect x="0" y="6" width="38" height="20" rx="4" fill="#F6F7F9" />
            <path d="M38 12 h10 l6 8 v6 h-16z" fill="#F2A900" />
            <rect x="6" y="11" width="20" height="5" rx="2" fill="#14213D" opacity=".85" />
            <circle cx="10" cy="27" r="4.5" fill="#14213D" /><circle cx="44" cy="27" r="4.5" fill="#14213D" />
            {min >= 270 && min < 348 && <path d="M56 18 l14 -4 l0 8 z" fill="#FFE7A3" opacity=".7" />}
          </g>
        </svg>
        <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
          <span className="tabular">{fmt(min)}</span>
          <span className="text-white/60">{active.place}</span>
        </div>
      </div>
      <div className="bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="font-display text-xl font-semibold text-ink">{active.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{active.body}</p>
          </div>
          <button
            onClick={() => {
              if (min >= 348) setMin(START);
              setPlaying((x) => !x);
            }}
            aria-label={playing ? "Pause the journey" : "Play the journey"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white hover:bg-ink-2"
          >
            {playing ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
          </button>
        </div>
        <div className="mt-4">
          <input
            type="range"
            min={START}
            max={360}
            step={1}
            value={Math.round(min)}
            onChange={(e) => {
              setPlaying(false);
              setMin(Number(e.target.value));
            }}
            aria-label="Time of morning"
            className="w-full accent-[#F2A900]"
          />
          <div className="relative mt-1 h-5 text-xs text-ink-soft">
            {steps.map((s) => (
              <button key={s.t} onClick={() => { setPlaying(false); setMin(s.t); }} style={{ left: `${((s.t - START) / (360 - START)) * 100}%` }} className={"absolute -translate-x-1/2 " + (min >= s.t ? "font-semibold text-ink" : "")}>
                {fmt(s.t).replace(" AM", "")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
