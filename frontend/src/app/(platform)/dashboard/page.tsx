"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { ForecastChart } from "@/components/ForecastChart";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { StatCard } from "@/components/StatCard";
import { getDashboardBundle, runWhatIf, type DashboardBundle, type WhatIfResult } from "@/lib/api";

const WhatIfPanel = dynamic(() => import("@/components/WhatIfPanel").then((module) => module.WhatIfPanel), {
  loading: () => <section className="panel col-span-12 min-h-36 p-5 lg:col-span-6 md:p-6" />,
});

const CopilotPanel = dynamic(() => import("@/components/CopilotPanel").then((module) => module.CopilotPanel), {
  loading: () => <section className="panel col-span-12 min-h-36 p-5 lg:col-span-6 md:p-6" />,
});

const ThreeMillView = dynamic(() => import("@/components/ThreeMillView").then((module) => module.ThreeMillView), {
  ssr: false,
  loading: () => <section className="panel col-span-12 min-h-72 p-5 lg:col-span-5 md:p-6" />,
});

const TwinFlowTable = dynamic(() => import("@/components/TwinFlowTable").then((module) => module.TwinFlowTable), {
  loading: () => <section className="panel col-span-12 min-h-52 p-5 md:p-6" />,
});

const ProfitOptimizerPanel = dynamic(() => import("@/components/ProfitOptimizerPanel").then((module) => module.ProfitOptimizerPanel), {
  loading: () => <section className="panel col-span-12 min-h-52 p-5 lg:col-span-6 md:p-6" />,
});

export default function DashboardPage() {
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [baselineTwin, setBaselineTwin] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const bundleData = await getDashboardBundle();
        setBundle(bundleData);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    runWhatIf({
      wheat_input_tons: 520,
      demand_index: 1,
      capacity_factor: 1,
      wheat_cost_per_ton: 295,
      selling_price_per_ton: 465,
    })
      .then((twinData) => setBaselineTwin(twinData))
      .catch((error) => {
        console.error("Error loading baseline simulation:", error);
      });
  }, []);

  if (loading || !bundle) {
    return (
      <main className="mx-auto max-w-[1440px] p-4 md:p-8">
        <div className="animate-pulse">
          <section className="panel mb-6 p-6">
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-3 w-24 bg-slate-200 rounded mb-2"></div>
                  <div className="h-8 w-32 bg-slate-300 rounded"></div>
                </div>
              ))}
            </div>
          </section>
          <section className="dashboard-grid mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="panel p-5 col-span-6 lg:col-span-3">
                <div className="h-3 w-28 bg-slate-200 rounded mb-3"></div>
                <div className="h-8 w-24 bg-slate-300 rounded mb-2"></div>
                <div className="h-2 w-40 bg-slate-200 rounded"></div>
              </div>
            ))}
          </section>
        </div>
      </main>
    );
  }

  const production = bundle.kpis.production;
  const quality = bundle.kpis.quality;
  const financial = bundle.kpis.financial;

  return (
    <main className="mx-auto max-w-[1440px] p-4 md:p-8">
      <section className="dashboard-grid">
        <ExecutiveSummary
          oee={production.oee}
          profitForecast={financial.profit_forecast}
          risk={bundle.disruptions.failure_probability}
          maturity={bundle.maturity.overall_score}
        />

        <StatCard label="OEE" value={`${(production.oee * 100).toFixed(1)}%`} hint="Linea base de efectividad operacional" />
        <StatCard label="Tasa de extraccion" value={`${(production.extraction_rate * 100).toFixed(1)}%`} hint="Ajustada por el gemelo digital" />
        <StatCard label="Cumplim. especificacion" value={`${(quality.spec_compliance * 100).toFixed(1)}%`} hint="Indice de aseguramiento de calidad" />
        <StatCard label="Costo por tonelada" value={`$${financial.cost_per_ton.toFixed(1)}`} hint="Costo ponderado de toda la planta" />

        <ForecastChart data={bundle.forecast.demand_curves} />
        <RiskHeatmap baseScore={bundle.disruptions.failure_probability} />

        <RecommendationsPanel recommendations={bundle.recommendations} />
        <ProfitOptimizerPanel data={bundle.optimizer} />

        <WhatIfPanel />
        <CopilotPanel />

        {/* ── Gemelo Digital + Alertas ─────────────────────── */}
        <section className="col-span-12 panel overflow-hidden">
          <div className="grid lg:grid-cols-5">
            {/* 3D Twin — left 3 cols */}
            <div className="lg:col-span-3 relative" style={{ background: "#0f1b2d" }}>
              <ThreeMillView />
            </div>

            {/* Alerts + causal chain — right 2 cols */}
            <div className="lg:col-span-2 flex flex-col divide-y divide-slate-100">
              {/* Alertas Predictivas */}
              <div className="p-5">
                <p className="text-[0.65rem] font-bold tracking-[0.16em] uppercase text-slate-400 mb-2">Alertas Predictivas</p>
                <div className="space-y-2">
                  <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
                    <p className="text-[0.78rem] text-amber-800 leading-snug">Riesgo de quiebre de inventario en 14 días bajo la curva actual de salida.</p>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <span className="text-rose-500 text-lg leading-none mt-0.5">🔧</span>
                    <p className="text-[0.78rem] text-rose-800 leading-snug">Alerta mantenimiento: etapa de molienda con tendencia creciente de paros.</p>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <span className="text-blue-500 text-lg leading-none mt-0.5">📈</span>
                    <p className="text-[0.78rem] text-blue-800 leading-snug">Señal de pronóstico: aumento de demanda esperado en próximos 2 meses.</p>
                  </div>
                </div>
              </div>

              {/* Cadena Causal */}
              <div className="p-5 flex-1">
                <p className="text-[0.65rem] font-bold tracking-[0.16em] uppercase text-slate-400 mb-1">Cadena Causal de Negocio</p>
                <p className="text-[0.72rem] text-slate-500 mb-3 leading-snug">
                  La humedad en recepción impacta extracción, lotes, conversión de pedidos y venta neta.
                </p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { label: "Humedad del trigo",              color: "border-cyan-200 bg-cyan-50 text-cyan-800" },
                    { label: "Extracción y rendimiento",        color: "border-blue-200 bg-blue-50 text-blue-800" },
                    { label: "Ajuste de lote por cliente",      color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
                    { label: "Ventas, utilidad y servicio",     color: "border-amber-200 bg-amber-50 text-amber-800" },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <span className="text-[0.6rem] font-bold text-slate-300 w-4 shrink-0">{i + 1}</span>
                      <p className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[0.72rem] font-semibold ${step.color}`}>{step.label}</p>
                      {i < 3 && <span className="text-[0.6rem] text-slate-300">↓</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {baselineTwin ? (
          <TwinFlowTable stages={baselineTwin.simulated.stages} />
        ) : (
          <section className="panel col-span-12 p-5 md:p-6">
            <h3 className="font-display text-xl text-slate-800">Flujo de Proceso</h3>
            <p className="ops-copy mt-2 text-sm text-slate-600">Cargando simulacion de linea base...</p>
          </section>
        )}
      </section>
    </main>
  );
}
