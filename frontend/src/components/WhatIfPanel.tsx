"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

import { runWhatIf } from "@/lib/api";

const initial = {
  wheat_input_tons: 520,
  demand_index: 1,
  capacity_factor: 1,
  wheat_cost_per_ton: 295,
  selling_price_per_ton: 465,
};

const inputLabels: Record<keyof typeof initial, string> = {
  wheat_input_tons: "Trigo de entrada (ton)",
  demand_index: "Indice de demanda",
  capacity_factor: "Factor de capacidad",
  wheat_cost_per_ton: "Costo de trigo por tonelada",
  selling_price_per_ton: "Precio de venta por tonelada",
};

export function WhatIfPanel() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<null | { revenue_impact: number; inventory_impact_tons: number; service_level_impact: number }>(null);

  async function execute() {
    const data = await runWhatIf(form);
    setResult(data);
  }

  return (
    <section className="panel col-span-7 p-5 fade-up md:p-6">
      <h3 className="font-display text-xl text-slate-800">Simulaciones Inteligentes - WHAT IF</h3>
      <p className="ops-copy mt-1 text-xs text-slate-500">Sensibilidad de demanda, costo de trigo y capacidad con traduccion de impacto a resultados de negocio.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
        {Object.entries(form).map(([key, value]) => (
          <label key={key} className="space-y-1">
            <span className="text-slate-500">{inputLabels[key as keyof typeof initial]}</span>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800 outline-none transition focus:border-[#1e3a8a]/60 focus:ring-2 focus:ring-[#1e3a8a]/10"
              value={value}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
      </div>
      <button
        className="mt-4 rounded-xl bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2448ac]"
        onClick={execute}
      >
        Ejecutar What-If
      </button>
      {result && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-slate-300 bg-white p-3 text-slate-700">Impacto en ingresos: ${result.revenue_impact.toLocaleString()}</div>
          <div className="rounded-lg border border-slate-300 bg-white p-3 text-slate-700">Impacto en inventario: {result.inventory_impact_tons} ton</div>
          <div className="rounded-lg border border-slate-300 bg-white p-3 text-slate-700">Nivel de servicio: {(result.service_level_impact * 100).toFixed(1)}%</div>
        </div>
      )}
    </section>
  );
}
