import { requireSession } from "@/lib/auth";
import { billingService } from "@/lib/billing/server";
import { BillingClient } from "@/components/billing/BillingClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { user, company } = await requireSession();
  const initial = billingService().overview({ companyId: company.id, userId: user.id, name: user.name, email: user.email, role: user.role });
  return <BillingClient initial={initial} company={company.name} canBuy={user.role === "admin"} />;
}
