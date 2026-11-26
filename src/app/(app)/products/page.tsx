import { all } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductsClient } from "@/components/ProductsClient";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { company } = await requireSession();
  const products = all<Product>("SELECT * FROM products WHERE company_id = ? ORDER BY id DESC", company.id);
  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Productos y servicios" sub="Registra lo que vendes y deja que el agente compare tu precio con el mercado." />
      <ProductsClient products={products} currency={company.currency} />
    </>
  );
}
