import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, registrationOpen } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { BILLING_PLANS, FREE_PLAN, igvBreakdown, REFUND_WINDOW_DAYS, soles } from "@/lib/billing/catalog";
import { siteUrl } from "@/lib/seo";

const FAQ = [
  ["¿De dónde salen los precios?", "El agente busca el producto en tiendas y marketplaces y guarda cada precio con el enlace de la página donde lo vio. No inventa cifras: si no encuentra ofertas comparables, lo dice."],
  ["¿Cuánto demora un análisis?", "Unos dos minutos por producto. Puedes seguir su avance en tiempo real mientras el agente busca, depura y calcula."],
  ["¿Necesito tarjeta para probar?", `No. La prueba gratuita incluye ${FREE_PLAN.priceAnalyses} análisis de precios y ${FREE_PLAN.strategicAnalyses} análisis estratégico. Cuando quieras más, pagas con tarjeta, Yape u otros medios.`],
  ["¿Se renueva solo?", "No. Cada plan dura 31 días y se paga una vez. Te avisamos antes de que venza para que decidas si renuevas."],
  ["¿Y si no me sirve?", `Tienes una garantía de ${REFUND_WINDOW_DAYS} días: si usaste pocos análisis, te devolvemos el total y emitimos la nota de crédito.`],
  ["¿Emiten comprobante?", "Sí. Cada pago genera una boleta o factura con el IGV desglosado. Puedes elegir factura con tu RUC."],
  ["¿Puedo traer mi catálogo de Shopify o WooCommerce?", "Sí. Sube la exportación CSV de tu tienda tal cual. Si un SKU ya existe, se actualiza su precio en lugar de duplicarse."],
  ["¿Qué pasa con mis datos?", "Cada empresa ve solo su información. Al modelo de IA solo se envían los datos del producto analizado, nunca tu nombre ni tus datos de pago."],
] as const;

const STEPS = [
  { t: "Registra tu catálogo", d: "Sube tus productos y servicios a mano o con un CSV. Un precio y un nombre bastan para empezar." },
  { t: "El agente investiga", d: "Busca en la web, visita tiendas competidoras y extrae precios, disponibilidad y características con su fuente." },
  { t: "Normaliza y compara", d: "Descarta ruido, deduplica, unifica monedas y calcula mínimo, máximo, mediana, percentil e índice de precio." },
  { t: "Decide con recomendaciones", d: "Recibe un reporte con FODA, fortalezas, debilidades y un precio sugerido, listo para exportar o imprimir." },
];

export default async function Landing() {
  if (await getSession()) redirect("/dashboard");
  const canRegister = registrationOpen();
  const start = canRegister ? "/register" : "/login";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication", name: "Compa", applicationCategory: "BusinessApplication", operatingSystem: "Web", inLanguage: "es-PE",
        url: siteUrl().toString(),
        description: "Agente de inteligencia competitiva que compara tus precios con la competencia y sugiere un precio con FODA y recomendaciones.",
        offers: BILLING_PLANS.map((p) => ({ "@type": "Offer", name: `Plan ${p.name}`, price: (p.amount / 100).toFixed(2), priceCurrency: "PEN" })),
      },
      { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">Iniciar sesión</Link>
          {canRegister && <Link href="/register" className="btn btn-primary">Registrarse</Link>}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="eyebrow">Inteligencia competitiva para empresas</p>
          <h1 className="display mt-3 text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">Sabe cuánto cobra tu competencia, <span className="text-brand">sin salir a buscarlo.</span></h1>
          <p className="mt-5 max-w-xl text-lg text-soft">Compa es un agente automatizado que rastrea la web, compara tus precios con el mercado y te entrega un reporte con acciones concretas para vender mejor.</p>
          <div className="mt-8 flex flex-wrap items-start gap-3">
            {canRegister
              ? <Link href="/register" className="btn btn-primary !px-5 !py-3 !text-base">Crear cuenta gratis</Link>
              : <Link href="/login" className="btn btn-primary !px-5 !py-3 !text-base">Iniciar sesión</Link>}
            <Link href="/ejemplo" className="btn btn-ghost !px-5 !py-3 !text-base">Ver un reporte real</Link>
          </div>
          <p className="mt-3 text-xs text-soft">Acceso solo por invitación. Pide tus credenciales al administrador.</p>
        </div>
        <div className="card relative overflow-hidden p-5 shadow-xl" aria-hidden>
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">Freidora de aire Oster 4L</span><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">En mercado</span></div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[["Tu precio", "S/ 329"], ["Promedio", "S/ 299"], ["Índice", "110"]].map(([a, b]) => (<div key={a} className="rounded-lg bg-[#f6f5f1] p-3"><div className="text-[11px] uppercase tracking-wide text-soft">{a}</div><div className="display text-lg font-bold">{b}</div></div>))}
          </div>
          <div className="mt-5 space-y-2.5">
            {[["Tú", 329, "#12203a"], ["Falabella", 329, "#8ccfc3"], ["Plaza Vea", 269, "#8ccfc3"], ["Ripley", 289, "#8ccfc3"]].map(([n, v, c]) => (
              <div key={String(n)} className="flex items-center gap-3 text-xs"><span className="w-16 text-soft">{n}</span><div className="h-3 rounded-sm" style={{ width: `${(Number(v) / 360) * 100}%`, background: String(c) }} /><span className="font-semibold tabular-nums">{v}</span></div>
            ))}
          </div>
          <p className="mt-5 rounded-lg bg-[#eef7f5] p-3 text-xs text-brand-dark"><strong>Recomendación:</strong> ajustar el precio hacia S/ 299 para recuperar competitividad.</p>
        </div>
      </section>

      <section className="border-y border-line bg-white/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="eyebrow">Cómo funciona</p>
          <h2 className="display mt-2 text-3xl font-bold">De tu catálogo a una decisión en 4 pasos</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="card p-5"><span className="display text-4xl font-bold text-brand/30">0{i + 1}</span><h3 className="mt-2 font-semibold">{s.t}</h3><p className="mt-1.5 text-sm text-soft">{s.d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-16" aria-labelledby="precios">
        <p className="eyebrow">Planes</p>
        <h2 id="precios" className="display mt-2 text-3xl font-bold">Precios claros, con IGV incluido</h2>
        <p className="mt-2 text-soft">Sin contratos ni renovación automática. Empieza gratis y paga solo cuando lo necesites.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article className="card flex flex-col p-5">
            <h3 className="font-semibold">Prueba gratuita</h3><p className="display mt-2 text-3xl font-bold">S/ 0</p><p className="text-xs text-soft">sin tarjeta</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-soft"><li>{FREE_PLAN.priceAnalyses} análisis de precios</li><li>{FREE_PLAN.strategicAnalyses} análisis estratégico</li><li>Hasta {FREE_PLAN.products} productos</li></ul>
            <Link href={start} className="btn btn-ghost mt-5">Probar gratis</Link>
          </article>
          {BILLING_PLANS.map((p) => (
            <article key={p.id} className={`card flex flex-col p-5 ${"highlighted" in p ? "border-[#12253b] ring-1 ring-[#12253b]" : ""}`}>
              <h3 className="font-semibold">{p.name}</h3><p className="display mt-2 text-3xl font-bold">{soles(p.amount)}</p><p className="text-xs text-soft">por 31 días · IGV {soles(igvBreakdown(p.amount).igv)}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-soft">{p.features.slice(0, 3).map((f) => <li key={f}>{f}</li>)}</ul>
              <Link href={start} className={`btn mt-5 ${"highlighted" in p ? "btn-primary" : "btn-ghost"}`}>Elegir {p.name}</Link>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs text-soft">Garantía de {REFUND_WINDOW_DAYS} días. Paga con tarjeta, Yape, QR, banca móvil o agentes. Boleta o factura electrónica en cada compra.</p>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[["Fuentes verificables", "Cada oferta incluye el enlace a la página donde se vio el precio. Nada de cifras inventadas."], ["Multi-empresa", "Cada cliente ve únicamente su propia información, con acceso protegido."], ["Listo para el comité", "Exporta a CSV o guarda el reporte como PDF con un clic."]].map(([t, d]) => (
            <div key={t} className="p-2"><h3 className="display text-xl font-bold">{t}</h3><p className="mt-1.5 text-soft">{d}</p></div>
          ))}
        </div>
        <div className="mt-14" aria-labelledby="faq">
          <p className="eyebrow">Preguntas frecuentes</p>
          <h2 id="faq" className="display mt-2 text-3xl font-bold">Lo que suelen preguntarnos</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">{FAQ.map(([q, a]) => (
            <details key={q} className="card p-4"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm text-soft">{a}</p></details>
          ))}</div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0f1b33] p-8 text-white">
          <div><h2 className="display text-2xl font-bold">Empieza a vigilar el mercado hoy</h2><p className="mt-1 text-slate-300">Ingresa con las credenciales que te dio el administrador.</p></div>
          <div className="flex flex-wrap gap-3">{canRegister && <Link href="/register" className="btn btn-primary">Registrarse</Link>}<Link href="/login" className="btn !bg-white/10 !text-white hover:!bg-white/20">Iniciar sesión</Link></div>
        </div>
      </section>
      <footer className="pb-10 text-center text-xs text-soft">Compa · Proyecto universitario “Agente automatizado” · <Link href="/ejemplo" className="underline">Ejemplo de reporte</Link> · <Link href="/privacidad" className="underline">Privacidad</Link> · <Link href="/terminos" className="underline">Términos</Link>
        <Link href="/libro-reclamaciones" className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 font-semibold text-ink hover:border-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h3" /></svg>Libro de Reclamaciones
        </Link>
      </footer>
    </div>
  );
}
