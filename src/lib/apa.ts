import type { Research, Source } from "./types";

/** Una referencia en APA 7. `cita` es lo que va entre paréntesis en el texto, p. ej. "Porter, 1985". */
export type Reference = {
  id: string; cita: string; autor: string; anio: string; titulo: string;
  /** Revista con volumen y páginas, editorial o sitio web: lo que va tras el título. */
  fuente?: string; url?: string;
  /** El título va en cursiva salvo en artículos de revista (allí va en cursiva la revista). */
  articulo?: boolean;
  tipo: "teoria" | "web";
};

/** Marco teórico de cada herramienta (fuentes primarias de cada modelo). */
export const THEORY: Reference[] = [
  { id: "aguilar1967", cita: "Aguilar, 1967", autor: "Aguilar, F. J.", anio: "1967", titulo: "Scanning the business environment", fuente: "Macmillan", tipo: "teoria" },
  { id: "ansoff1957", cita: "Ansoff, 1957", autor: "Ansoff, H. I.", anio: "1957", titulo: "Strategies for diversification", fuente: "Harvard Business Review, 35(5), 113–124", articulo: true, tipo: "teoria" },
  { id: "david2017", cita: "David y David, 2017", autor: "David, F. R., y David, F. R.", anio: "2017", titulo: "Strategic management: A competitive advantage approach, concepts and cases (16.ª ed.)", fuente: "Pearson", tipo: "teoria" },
  { id: "henderson1970", cita: "Henderson, 1970", autor: "Henderson, B. D.", anio: "1970", titulo: "The product portfolio", fuente: "Boston Consulting Group", url: "https://www.bcg.com/publications/1970/strategy-the-product-portfolio", tipo: "teoria" },
  { id: "kaplan1996", cita: "Kaplan y Norton, 1996", autor: "Kaplan, R. S., y Norton, D. P.", anio: "1996", titulo: "The balanced scorecard: Translating strategy into action", fuente: "Harvard Business School Press", tipo: "teoria" },
  { id: "osterwalder2010", cita: "Osterwalder y Pigneur, 2010", autor: "Osterwalder, A., y Pigneur, Y.", anio: "2010", titulo: "Business model generation: A handbook for visionaries, game changers, and challengers", fuente: "John Wiley & Sons", tipo: "teoria" },
  { id: "porter1980", cita: "Porter, 1980", autor: "Porter, M. E.", anio: "1980", titulo: "Competitive strategy: Techniques for analyzing industries and competitors", fuente: "Free Press", tipo: "teoria" },
  { id: "porter1985", cita: "Porter, 1985", autor: "Porter, M. E.", anio: "1985", titulo: "Competitive advantage: Creating and sustaining superior performance", fuente: "Free Press", tipo: "teoria" },
  { id: "porter2008", cita: "Porter, 2008", autor: "Porter, M. E.", anio: "2008", titulo: "The five competitive forces that shape strategy", fuente: "Harvard Business Review, 86(1), 78–93", url: "https://hbr.org/2008/01/the-five-competitive-forces-that-shape-strategy", articulo: true, tipo: "teoria" },
  { id: "weihrich1982", cita: "Weihrich, 1982", autor: "Weihrich, H.", anio: "1982", titulo: "The TOWS matrix—A tool for situational analysis", fuente: "Long Range Planning, 15(2), 54–66", url: "https://doi.org/10.1016/0024-6301(82)90120-0", articulo: true, tipo: "teoria" },
  // Fase III: despliegue con S/TD, priorización, indicadores e investigación.
  { id: "apa2020", cita: "American Psychological Association, 2020", autor: "American Psychological Association", anio: "2020", titulo: "Publication manual of the American Psychological Association (7.ª ed.)", fuente: "American Psychological Association", url: "https://doi.org/10.1037/0000165-000", tipo: "teoria" },
  { id: "hernandez2018", cita: "Hernández-Sampieri y Mendoza, 2018", autor: "Hernández-Sampieri, R., y Mendoza, C. P.", anio: "2018", titulo: "Metodología de la investigación: Las rutas cuantitativa, cualitativa y mixta", fuente: "McGraw-Hill Interamericana", tipo: "teoria" },
  { id: "juran2010", cita: "Juran y De Feo, 2010", autor: "Juran, J. M., y De Feo, J. A.", anio: "2010", titulo: "Juran's quality handbook: The complete guide to performance excellence (6.ª ed.)", fuente: "McGraw-Hill", tipo: "teoria" },
  { id: "parmenter2015", cita: "Parmenter, 2015", autor: "Parmenter, D.", anio: "2015", titulo: "Key performance indicators: Developing, implementing, and using winning KPIs (3.ª ed.)", fuente: "John Wiley & Sons", tipo: "teoria" },
  { id: "ward2016", cita: "Ward y Peppard, 2016", autor: "Ward, J., y Peppard, J.", anio: "2016", titulo: "The strategic management of information systems: Building a digital strategy (4.ª ed.)", fuente: "John Wiley & Sons", tipo: "teoria" },
  { id: "westerman2014", cita: "Westerman et al., 2014", autor: "Westerman, G., Bonnet, D., y McAfee, A.", anio: "2014", titulo: "Leading digital: Turning technology into business transformation", fuente: "Harvard Business Review Press", tipo: "teoria" },
  { id: "wheelen2018", cita: "Wheelen et al., 2018", autor: "Wheelen, T. L., Hunger, J. D., Hoffman, A. N., y Bamford, C. E.", anio: "2018", titulo: "Strategic management and business policy: Globalization, innovation and sustainability (15.ª ed.)", fuente: "Pearson", tipo: "teoria" },
];
export const theoryRef = (id: string) => THEORY.find((r) => r.id === id);
/** Obras que solo usan los agentes de la fase III (la primera etapa no las cita). */
export const TD_THEORY_IDS = ["apa2020", "hernandez2018", "juran2010", "parmenter2015", "ward2016", "westerman2014"];

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
const year = (y?: string) => (y && /^\d{4}[a-z]?$/.test(y.trim()) ? y.trim() : "s.f.");

/** Apellidos para la cita en el texto: "Pérez, J., y Gómez, L." → "Pérez y Gómez"; 3+ autores → "Pérez et al."; una organización va completa. */
export function citeAuthor(autor: string): string {
  const people = [...autor.matchAll(/([^,]+?),\s*(?:[A-ZÁÉÍÓÚÑ]\.\s*)+(?:,|$)/g)].map((m) => m[1].replace(/^\s*(?:y|&)\s+/, "").trim());
  if (!people.length) return autor.trim();
  return people.length === 1 ? people[0] : people.length === 2 ? `${people[0]} y ${people[1]}` : `${people[0]} et al.`;
}

/** Fuente de la investigación web como referencia APA 7 (página web). Sin autor, el autor es el sitio. */
export function webRef(s: Source, i: number): Reference {
  const sitio = s.sitio?.trim() || host(s.url);
  const autor = s.autor?.trim() || sitio || s.titulo;
  return {
    id: `w${i + 1}`, cita: `${citeAuthor(autor)}, ${year(s.anio)}`, autor, anio: year(s.anio), titulo: s.titulo || s.url,
    fuente: sitio && sitio !== autor ? sitio : undefined, url: /^https?:\/\//.test(s.url) ? s.url : undefined, tipo: "web",
  };
}

/** Lista de referencias del reporte: fuentes web + marco teórico de las herramientas usadas, en orden alfabético (APA 7). */
export function referenceList(research: Research | undefined, theoryIds: string[]): Reference[] {
  const seen = new Set<string>();
  const web = (research?.fuentes ?? []).map(webRef).filter((r) => {
    const k = r.url ?? r.titulo;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const theory = THEORY.filter((t) => theoryIds.includes(t.id));
  return [...web, ...theory].sort((a, b) => a.autor.localeCompare(b.autor, "es") || a.anio.localeCompare(b.anio));
}

/** Referencia en una línea (texto plano, para el prompt). */
export function refText(r: Reference): string {
  return `${r.autor} (${r.anio}). ${r.titulo}.${r.fuente ? ` ${r.fuente}.` : ""}${r.url ? ` ${r.url}` : ""}`;
}

const norm = (t: string) => t.toLowerCase().replace(/\s*&\s*/g, " y ").replace(/\s+/g, " ").replace(/s\.\s?f\./, "s.f.").trim();

/** Divide un texto en partes, marcando las citas APA "(Autor, año)" que corresponden a una referencia conocida. */
export function splitCitations(text: string, refs: Reference[]): ({ text: string } | { cite: string; ref: Reference })[] {
  const byKey = new Map(refs.map((r) => [norm(r.cita), r]));
  const out: ({ text: string } | { cite: string; ref: Reference })[] = [];
  let last = 0;
  for (const m of text.matchAll(/\(([^()]*?(?:\d{4}[a-z]?|s\.\s?f\.)[^()]*?)\)/g)) {
    const parts = m[1].split(";").map((p) => p.trim());
    const hits = parts.map((p) => byKey.get(norm(p)));
    if (!hits.some(Boolean)) continue;
    out.push({ text: text.slice(last, m.index) + "(" });
    parts.forEach((p, i) => {
      if (i) out.push({ text: "; " });
      out.push(hits[i] ? { cite: p, ref: hits[i]! } : { text: p });
    });
    out.push({ text: ")" });
    last = m.index! + m[0].length;
  }
  out.push({ text: text.slice(last) });
  return out;
}
