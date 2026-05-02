"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { logoutUser, registerUser } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="auth-wrap">
      <section className="auth-panel">
        <BrandLogo />
        <p className="section-kicker mt-2">Crear cuenta</p>
        <h1 className="font-display text-slate-900">Registra tu espacio de trabajo de gemelo digital</h1>
        <p className="ops-copy mt-2 text-sm text-slate-600">Configura tu cuenta de planta para entrar al centro de control.</p>

        <form
          className="mt-6 space-y-4"
          method="post"
          action="/register"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);

            const fullName = String(form.get("fullName") ?? "").trim();
            const email = String(form.get("email") ?? "").trim();
            const company = String(form.get("company") ?? "").trim();
            const password = String(form.get("password") ?? "");

            setError(null);
            setInfo(null);
            setLoading(true);

            const result = await registerUser({ fullName, email, company, password });
            setLoading(false);

            if (!result.ok) {
              setError(result.error);
              return;
            }

            if (result.user.role === "platform_admin") {
              setUser(result.user);
              router.push("/admin/companies");
              return;
            }

            if (result.user.companyStatus !== "active") {
              await logoutUser();
              setUser(null);
              setInfo("Empresa registrada. Un administrador de plataforma debe activar la licencia para habilitar el acceso.");
              return;
            }

            setUser(result.user);
            router.push("/dashboard");
          }}
        >
          <label className="auth-label">
            Nombre completo
            <input required name="fullName" className="auth-input" placeholder="Director de Operaciones" />
          </label>
          <label className="auth-label">
            Empresa
            <input required name="company" className="auth-input" placeholder="Grupo Molinero SA" />
          </label>
          <label className="auth-label">
            Email
            <input
              required
              type="email"
              name="email"
              autoComplete="username"
              className="auth-input"
              placeholder="director@plant.com"
            />
          </label>
          <label className="auth-label">
            Contrasena
            <input
              required
              minLength={6}
              type="password"
              name="password"
              autoComplete="new-password"
              className="auth-input"
              placeholder="******"
            />
          </label>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

          <button disabled={loading} className="auth-button" type="submit">
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Ya tienes cuenta?{" "}
          <Link href="/login?switch=1" className="ghost-accent-link">
            Iniciar sesion
          </Link>
        </p>

        <p className="mt-2 text-sm text-slate-600">
          Eres administrador de plataforma?{" "}
          <Link href="/admin/companies" className="ghost-accent-link">
            Ir al panel admin
          </Link>
        </p>
      </section>
    </main>
  );
}
