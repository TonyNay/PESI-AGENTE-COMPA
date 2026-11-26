import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <Link href="/"><Logo /></Link>
      <div className="card mt-8 w-full max-w-lg p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
