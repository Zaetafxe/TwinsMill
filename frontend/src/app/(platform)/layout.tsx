"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlatformNav } from "@/components/PlatformNav";
import { useAuth } from "@/components/AuthProvider";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (!loading && user?.role === "platform_admin") {
      router.push("/admin/companies");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role === "platform_admin") {
    return (
      <main className="auth-wrap">
        <section className="auth-panel">
          <h1 className="font-display text-3xl text-slate-900">Redirigiendo...</h1>
          <p className="mt-2 text-sm text-slate-600">
            {loading
              ? "Validando sesion."
              : user?.role === "platform_admin"
                ? "Tu perfil de administrador usa solo el modulo de gestion de empresas."
                : "Sesion no valida. Redirigiendo al acceso..."}
          </p>
          <p className="mt-3 text-xs text-slate-500">Si esta pantalla persiste, refresca con Ctrl+F5.</p>
        </section>
      </main>
    );
  }

  return <PlatformNav>{children}</PlatformNav>;
}
