import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/AuthForms";
import { registrationOpen } from "@/lib/auth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  if (!registrationOpen()) redirect("/login");
  return (
    <>
      <h1 className="display text-2xl font-bold">Crea tu cuenta</h1>
      <p className="mb-6 mt-1 text-sm text-soft">Registra tu empresa y empieza a vigilar a tu competencia.</p>
      <RegisterForm referralCode={(await searchParams).ref?.slice(0, 20) ?? ""} />
    </>
  );
}
