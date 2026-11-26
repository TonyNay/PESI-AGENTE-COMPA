export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="7" fill="#0e8f7e" />
        <path d="M6 17l4-5 3 3 6-8" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19" cy="7" r="1.8" fill="#f6a04a" />
      </svg>
      <span className={dark ? "text-white" : "text-ink"}>Compa</span>
    </span>
  );
}
