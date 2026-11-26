import { AccountClient } from "@/components/AccountClient";
import { PageHeader } from "@/components/ui";
import { currentConsent, DEMO_EMAIL } from "@/lib/account";
import { LEGAL_VERSION } from "@/lib/legal";
import { twoFactorStatus } from "@/lib/two-factor";
import { AuditLog } from "@/components/AuditLog";
import { ReferralCard } from "@/components/ReferralCard";
import { listAudit } from "@/lib/audit";
import { registrationOpen, requireSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { referralSummary } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user, company } = await requireSession();
  const admin = user.role === "admin";
  const referral = admin ? referralSummary(getDb(), company.id) : null;
  // El enlace solo sirve si el registro público está abierto; si no, se comparte el código.
  const base = process.env.COMPA_PUBLIC_URL?.replace(/\/$/, "");
  const referralLink = referral && base && registrationOpen() ? `${base}/register?ref=${referral.code}` : null;
  return (<>
    <PageHeader eyebrow="Tus derechos sobre tus datos" title="Mi cuenta" sub="Consulta, corrige, descarga o elimina tu información." />
    <AccountClient
      user={{ name: user.name, email: user.email, role: user.role }}
      company={{ name: company.name, tax_id: company.tax_id, industry: company.industry }}
      consent={currentConsent(user.id)} version={LEGAL_VERSION} protectedAccount={user.email === DEMO_EMAIL} twoFactor={twoFactorStatus(user.id)} />
    {admin && <ReferralCard summary={referral!} link={referralLink} />}
    <AuditLog rows={listAudit(company.id, admin ? {} : { userId: user.id })} scope={admin ? "empresa" : "usuario"} />
  </>);
}
