"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginUser } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, setUser, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [switchPrepared, setSwitchPrepared] = useState(false);
  const [switchAccount, setSwitchAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setSwitchAccount(params.get("switch") === "1");
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (switchAccount) {
      if (!switchPrepared) {
        setSwitchPrepared(true);
        logout()
          .then(() => {
            setUser(null);
            setInfo("Sesion anterior cerrada. Ingresa con la cuenta que deseas usar.");
          })
          .catch(() => {
            setInfo("Ingresa con la cuenta que deseas usar.");
          });
      }
      return;
    }

    if (user) {
      if (user.role === "platform_admin") {
        router.push("/admin/companies");
      } else {
        router.push("/dashboard");
      }
    }
  }, [authLoading, logout, router, setUser, switchAccount, switchPrepared, user]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      setError(null);
      setSubmitting(true);
      const result = await loginUser(email, password);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUser(result.user);
      if (result.user.role === "platform_admin") {
        router.push("/admin/companies");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Ocurrio un error inesperado al iniciar sesion. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-panel">
        <BrandLogo variant="auth" />
        <p className="section-kicker mt-2">Acceso para usuarios activos</p>
        <h1 className="font-display text-slate-900">Inicia sesion</h1>
        <p className="auth-subtitle">Centro de control industrial MOLTURA</p>

        <form className="mt-6 space-y-4" method="post" action="/login" onSubmit={handleLogin}>
          <label className="auth-label">
            Email
            <input required type="email" name="email" autoComplete="username" className="auth-input" placeholder="director@plant.com" />
          </label>

          <label className="auth-label">
            Contrasena
            <input required type="password" name="password" autoComplete="current-password" className="auth-input" placeholder="******" />
          </label>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

          <button disabled={submitting} className="auth-button" type="submit">
            {submitting ? "Iniciando sesion..." : "Iniciar sesion"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Alta de empresa nueva?{" "}
          <Link href="/register" className="ghost-accent-link">
            Crear cuenta
          </Link>
        </p>
      </section>
    </main>
  );
}
