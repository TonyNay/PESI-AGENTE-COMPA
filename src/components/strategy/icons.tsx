import type { SVGProps } from "react";

const PATHS: Record<string, string> = {
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z",
  canvas: "M3 5h18v14H3zM9 5v9M15 5v9M3 14h18M12 5v4M12 9h3",
  chain: "M3 7h13l4 5-4 5H3l3-5-3-5ZM3 4h14",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z",
  forces: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 2v4M12 18v4M2 12h4M18 12h4M9.5 9.5 6 6",
  podium: "M4 20V13h5v7M9 20V8h6v12M15 20v-9h5v9M3 20h18",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  bubbles: "M8 10a4 4 0 1 0 0 .01M17 7a2.5 2.5 0 1 0 0 .01M16 17a3 3 0 1 0 0 .01M3 21h18M3 3v18",
  arrows: "M4 20 20 4M20 4h-6M20 4v6M4 4h7v7H4z",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  summary: "M5 3h10l4 4v14H5zM8 10h8M8 14h8M8 18h5",
  evidence: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4.5 4.5",
  check: "M5 12.5 10 17l9-10",
  plus: "M12 5v14M5 12h14",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  building: "M4 21V5l8-3v19M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2M2 21h20",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4.5 4.5",
  file: "M6 2h8l5 5v15H6zM14 2v5h5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  terminal: "M4 5h16v14H4zM7 9l3 3-3 3M12 15h5",
  x: "M6 6l12 12M18 6 6 18",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  report: "M6 2h8l5 5v15H6zM14 2v5h5M9 13h6M9 17h6M9 9h2",
  briefcase: "M3 8h18v12H3zM8 8V5h8v3M3 13h18",
  book: "M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4zM12 5v15",
  chip: "M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  pareto: "M3 21h18M5 21V9M9 21v-8M13 21v-5M17 21v-3M4 10c4-4 9-6 16-6",
  coins: "M8 7a5 2.5 0 1 0 10 0 5 2.5 0 1 0-10 0M8 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7M3 13a5 2.5 0 1 0 10 0M3 13v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4",
  gauge: "M4 17a8 8 0 1 1 16 0M12 17l4-6M12 17a1 1 0 1 0 0 .01M7 13h.01M12 9h.01M17 13h.01",
  flask: "M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10",
  gap: "M3 6h7v12H3zM14 6h7v12h-7zM10 12h4M11.5 10.5 10 12l1.5 1.5M12.5 10.5 14 12l-1.5 1.5",
  rocket: "M5 19c1-3 2-4 4-5M14 4c3 0 6 3 6 6-2 4-6 7-9 8l-5-5c1-3 4-7 8-9ZM15 9a1 1 0 1 0 0 .01M5 14l-2 1 3 3 1-2",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4",
  refresh: "M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
};

export function Icon({ name, className = "h-5 w-5", ...rest }: { name: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden {...rest}>
      <path d={PATHS[name] ?? PATHS.sparkle} />
    </svg>
  );
}
