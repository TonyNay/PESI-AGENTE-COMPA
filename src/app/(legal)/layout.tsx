import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">
    <header className="border-b border-line bg-white/90 px-5 sm:px-8">
      <div className="mx-auto flex h-20 max-w-3xl items-center justify-between gap-4">
        <Link href="/" aria-label="Compa, ir al inicio"><Logo /></Link>
        <nav className="flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm text-soft"><Link className="hover:text-brand" href="/privacidad">Privacidad</Link><Link className="hover:text-brand" href="/terminos">Términos</Link><Link className="hover:text-brand" href="/libro-reclamaciones">Libro de Reclamaciones</Link></nav>
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <article className="card space-y-4 p-6 text-sm leading-relaxed sm:p-8 [&_h2]:pt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">{children}</article>
    </main>
  </div>;
}
