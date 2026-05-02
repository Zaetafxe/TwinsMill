"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <main className="auth-wrap">
      <section className="auth-panel">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Error de aplicacion</p>
        <h1 className="font-display text-3xl text-slate-900">Se recupero una falla de renderizado</h1>
        <p className="mt-2 text-sm text-slate-600">
          La plataforma detecto un error inesperado y evito una pantalla en blanco.
        </p>
        <button type="button" className="auth-button mt-6" onClick={() => reset()}>
          Reintentar
        </button>
      </section>
    </main>
  );
}
