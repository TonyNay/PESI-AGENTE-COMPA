import { LoginForm } from "@/components/AuthForms";
import { registrationOpen } from "@/lib/auth";

export default function LoginPage() {
  return (
    <>
      <h1 className="display text-2xl font-bold">Inicia sesión</h1>
      <p className="mb-6 mt-1 text-sm text-soft">Accede al panel de inteligencia competitiva de tu empresa.</p>
      <LoginForm allowRegister={registrationOpen()} />
    </>
  );
}
