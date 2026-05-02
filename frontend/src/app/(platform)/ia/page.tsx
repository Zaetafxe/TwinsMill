"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AIAnalyticsPanel } from "@/components/AIAnalyticsPanel";
import { AILabWorkbench } from "@/components/AILabWorkbench";
import { getAIInsights, type AIInsights } from "@/lib/api";

export default function IAPage() {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAIInsights(3);
        setInsights(data);
      } catch (error) {
        console.error("Error loading AI insights:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !insights) {
    return (
      <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-6 md:px-8">
        <section className="panel mb-6 p-5 md:p-6 animate-pulse">
          <div className="flex justify-between items-start">
            <div>
              <div className="h-4 w-24 bg-slate-200 rounded mb-3"></div>
              <div className="h-10 w-96 bg-slate-300 rounded mb-2"></div>
              <div className="h-4 w-full max-w-3xl bg-slate-200 rounded"></div>
            </div>
            <div className="h-12 w-48 bg-slate-300 rounded-lg"></div>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="panel p-6 animate-pulse">
              <div className="h-6 w-48 bg-slate-200 rounded mb-4"></div>
              <div className="h-48 bg-slate-100 rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-200 rounded"></div>
                <div className="h-3 w-5/6 bg-slate-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-6 md:px-8">
      <section className="panel mb-6 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Centro IA</p>
            <h1 className="section-title font-display text-4xl md:text-6xl">IA Data Science Lab</h1>
            <p className="section-copy ops-copy mt-2 max-w-4xl text-sm text-slate-600">
              Analitica avanzada con datos operativos de tres meses. Aqui se consolidan graficas de produccion, ventas, calidad y estado de algoritmos para evaluar resultados end-to-end.
            </p>
          </div>
          <Link
            href="/ia/notebook"
            className="inline-flex items-center gap-2 rounded-xl border border-[#6f4b2d] bg-gradient-to-r from-[#0c2551] via-[#123569] to-[#1a487f] px-5 py-3 text-sm font-semibold tracking-[0.01em] text-[#ecd5bf] shadow-[0_12px_26px_rgba(12,32,67,0.35)] transition hover:shadow-[0_14px_34px_rgba(12,32,67,0.42)] hover:brightness-110"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notebook Interactivo IA
          </Link>
        </div>
      </section>

      <AIAnalyticsPanel data={insights} />

      <div className="mt-6">
        <AILabWorkbench data={insights} />
      </div>
    </main>
  );
}
