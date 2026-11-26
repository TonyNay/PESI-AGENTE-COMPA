"use client";
import { animate, motion, useMotionValue, useTransform, type Variants } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/** Contenedor que escalona la entrada de sus hijos `<motion.* variants={item}>`. */
export const stagger = (gap = 0.05, delay = 0): Variants => ({ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } });
export const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 320, damping: 22 } },
};

export function Stagger({ children, className, gap, delay, as = "div" }: { children: ReactNode; className?: string; gap?: number; delay?: number; as?: "div" | "ul" | "ol" }) {
  const C = motion[as];
  return <C className={className} variants={stagger(gap, delay)} initial="hidden" animate="show">{children}</C>;
}

/** Número que cuenta desde 0 hasta `value`. */
export function CountUp({ value, decimals = 0, suffix = "", duration = 1.1 }: { value: number; decimals?: number; suffix?: string; duration?: number }) {
  const mv = useMotionValue(0);
  const [text, setText] = useState((0).toFixed(decimals));
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setText(v.toFixed(decimals)) });
    return () => c.stop();
  }, [mv, value, decimals, duration]);
  return <span className="tabular-nums">{text}{suffix}</span>;
}

/** Arco semicircular con aguja; `mark` dibuja una referencia (p. ej. 2.5 en EFI/EFE). */
export function Gauge({ value, min = 1, max = 4, mark, label, tone = "var(--brand)", size = 150 }: {
  value: number; min?: number; max?: number; mark?: number; label?: ReactNode; tone?: string; size?: number;
}) {
  const r = 52, cx = 64, cy = 62;
  const frac = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const pt = (f: number, rr = r) => [cx - rr * Math.cos(Math.PI * f), cy - rr * Math.sin(Math.PI * f)];
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const p = useMotionValue(0);
  const target = frac(value);
  useEffect(() => { const c = animate(p, target, { duration: 1.2, ease: [0.16, 1, 0.3, 1] }); return () => c.stop(); }, [p, target]);
  const rot = useTransform(p, (f) => -90 + f * 180);
  const m = mark != null ? [pt(frac(mark), r - 9), pt(frac(mark), r + 9)] : null;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 128 72" width={size} height={size * 0.56} aria-hidden>
        <path d={arc} stroke="#ece9e0" strokeWidth={10} fill="none" strokeLinecap="round" />
        <motion.path d={arc} stroke={tone} strokeWidth={10} fill="none" strokeLinecap="round" style={{ pathLength: p }} />
        {m && <line x1={m[0][0]} y1={m[0][1]} x2={m[1][0]} y2={m[1][1]} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="2 2" />}
        {/* El origen de un elemento SVG es relativo a su caja: 0.5/1 es el pie de la aguja (cx, cy). */}
        <motion.g style={{ rotate: rot, originX: 0.5, originY: 1 }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 14} stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" />
        </motion.g>
        <circle cx={cx} cy={cy} r={4.5} fill="var(--ink)" />
      </svg>
      {label}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <motion.span className={`inline-block rounded-full border-2 border-current border-t-transparent ${className}`}
      animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
  );
}

/** Placeholder animado mientras el agente genera una herramienta. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {Array.from({ length: rows * 3 }, (_, i) => (
        <motion.div key={i} className="h-24 rounded-xl bg-[#ece9e0]"
          animate={{ opacity: [0.45, 1, 0.45] }} transition={{ repeat: Infinity, duration: 1.6, delay: (i % 3) * 0.15 }} />
      ))}
    </div>
  );
}

/** Control segmentado con indicador que se desliza entre opciones. */
export function Segmented<T extends string>({ value, onChange, options, id }: { value: T; onChange: (v: T) => void; options: { key: T; label: ReactNode }[]; id: string }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-line bg-white p-1">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          className={`relative rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${value === o.key ? "text-white" : "text-soft hover:text-ink"}`}>
          {value === o.key && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
