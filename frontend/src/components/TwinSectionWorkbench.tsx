"use client";

import { useMemo, useState } from "react";
import type { ModuleKey } from "@/lib/modules";
import { platformModules } from "@/lib/modules";
import { defaultTwinInputs, simulateTwin, type TwinInputs, type TwinOutcome } from "@/lib/twin-simulator";
import { GrainCaptureCard } from "@/components/GrainCaptureCard";
import { ModuleOpsBoard } from "@/components/ModuleOpsBoard";
import { ProcessFlowWizard } from "@/components/ProcessFlowWizard";

type Props = {
  moduleKey: ModuleKey;
  title: string;
  subtitle: string;
};

// ─── Accent color tokens ───────────────────────────────────────────────────
type AccentKey = "blue" | "sky" | "emerald" | "violet" | "amber" | "rose" | "indigo" | "cyan" | "green";

const accentClasses: Record<AccentKey, {
  bar: string;
  badge: string;
  badgeText: string;
  primaryValue: string;
  primaryBorder: string;
  primaryBg: string;
  sliderThumb: string;
}> = {
  blue:    { bar: "bg-blue-500",    badge: "bg-blue-50 border-blue-200",    badgeText: "text-blue-700",    primaryValue: "text-blue-600",    primaryBorder: "border-blue-200",   primaryBg: "bg-gradient-to-br from-blue-50 to-blue-100/60",    sliderThumb: "#2563eb" },
  sky:     { bar: "bg-sky-500",     badge: "bg-sky-50 border-sky-200",      badgeText: "text-sky-700",     primaryValue: "text-sky-600",     primaryBorder: "border-sky-200",    primaryBg: "bg-gradient-to-br from-sky-50 to-sky-100/60",      sliderThumb: "#0ea5e9" },
  emerald: { bar: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200", badgeText: "text-emerald-700", primaryValue: "text-emerald-600", primaryBorder: "border-emerald-200", primaryBg: "bg-gradient-to-br from-emerald-50 to-emerald-100/60", sliderThumb: "#10b981" },
  violet:  { bar: "bg-violet-500",  badge: "bg-violet-50 border-violet-200", badgeText: "text-violet-700", primaryValue: "text-violet-600",  primaryBorder: "border-violet-200", primaryBg: "bg-gradient-to-br from-violet-50 to-violet-100/60", sliderThumb: "#7c3aed" },
  amber:   { bar: "bg-amber-500",   badge: "bg-amber-50 border-amber-200",   badgeText: "text-amber-700",   primaryValue: "text-amber-600",   primaryBorder: "border-amber-200",  primaryBg: "bg-gradient-to-br from-amber-50 to-amber-100/60",   sliderThumb: "#d97706" },
  rose:    { bar: "bg-rose-500",    badge: "bg-rose-50 border-rose-200",     badgeText: "text-rose-700",    primaryValue: "text-rose-600",    primaryBorder: "border-rose-200",   primaryBg: "bg-gradient-to-br from-rose-50 to-rose-100/60",    sliderThumb: "#e11d48" },
  indigo:  { bar: "bg-indigo-500",  badge: "bg-indigo-50 border-indigo-200", badgeText: "text-indigo-700", primaryValue: "text-indigo-600",  primaryBorder: "border-indigo-200", primaryBg: "bg-gradient-to-br from-indigo-50 to-indigo-100/60", sliderThumb: "#4338ca" },
  cyan:    { bar: "bg-cyan-500",    badge: "bg-cyan-50 border-cyan-200",     badgeText: "text-cyan-700",    primaryValue: "text-cyan-600",    primaryBorder: "border-cyan-200",   primaryBg: "bg-gradient-to-br from-cyan-50 to-cyan-100/60",    sliderThumb: "#06b6d4" },
  green:   { bar: "bg-green-500",   badge: "bg-green-50 border-green-200",   badgeText: "text-green-700",   primaryValue: "text-green-600",   primaryBorder: "border-green-200",  primaryBg: "bg-gradient-to-br from-green-50 to-green-100/60",  sliderThumb: "#16a34a" },
};

// ─── Module configuration ──────────────────────────────────────────────────
type ModuleConfig = {
  controlKeys: (keyof TwinInputs)[];
  simulatorTitle: string;
  simulatorDesc: string;
  primaryKpi: keyof TwinOutcome["kpis"];
  secondaryKpis: [keyof TwinOutcome["kpis"], keyof TwinOutcome["kpis"], keyof TwinOutcome["kpis"]];
  accent: AccentKey;
};

const moduleConfigs: Partial<Record<ModuleKey, ModuleConfig>> = {
  granos: {
    controlKeys: ["wheatMoisture", "qualityStrictness", "extractionTarget"],
    simulatorTitle: "Variabilidad de recepcion",
    simulatorDesc: "Simula como la humedad y calidad del grano impactan la extraccion y el riesgo de desviacion del lote.",
    primaryKpi: "specCompliance",
    secondaryKpis: ["customerRisk", "yieldRate", "serviceLevel"],
    accent: "sky",
  },
  tolvas: {
    controlKeys: ["wheatMoisture", "millingEfficiency", "capacityFactor"],
    simulatorTitle: "Estabilidad de tolvas",
    simulatorDesc: "Simula el impacto de variaciones en flujo limpio y distribucion de materia prima hacia molienda.",
    primaryKpi: "yieldRate",
    secondaryKpis: ["specCompliance", "serviceLevel", "customerRisk"],
    accent: "cyan",
  },
  molienda: {
    controlKeys: ["extractionTarget", "millingEfficiency", "capacityFactor", "energyCostIndex"],
    simulatorTitle: "Ajuste de setpoints",
    simulatorDesc: "Modifica la meta de extraccion, eficiencia y costo energetico para optimizar el rendimiento de harina.",
    primaryKpi: "yieldRate",
    secondaryKpis: ["specCompliance", "serviceLevel", "customerRisk"],
    accent: "emerald",
  },
  produccion: {
    controlKeys: ["capacityFactor", "millingEfficiency", "demandIndex"],
    simulatorTitle: "Capacidad operativa",
    simulatorDesc: "Evalua el impacto del factor de capacidad y la demanda en el cumplimiento de lotes y continuidad de planta.",
    primaryKpi: "yieldRate",
    secondaryKpis: ["serviceLevel", "specCompliance", "customerRisk"],
    accent: "blue",
  },
  calidad: {
    controlKeys: ["qualityStrictness", "wheatMoisture", "extractionTarget"],
    simulatorTitle: "Control de especificaciones",
    simulatorDesc: "Ajusta el rigor de calidad para evaluar el impacto sobre conformidad de lotes y riesgo de reclamos.",
    primaryKpi: "specCompliance",
    secondaryKpis: ["customerRisk", "yieldRate", "serviceLevel"],
    accent: "violet",
  },
  harina: {
    controlKeys: ["qualityStrictness", "extractionTarget", "millingEfficiency"],
    simulatorTitle: "Calidad de liberacion de lote",
    simulatorDesc: "Simula como los parametros de calidad y extraccion afectan la tasa de liberacion de harina y reclamos.",
    primaryKpi: "specCompliance",
    secondaryKpis: ["customerRisk", "yieldRate", "serviceLevel"],
    accent: "green",
  },
  empaques: {
    controlKeys: ["capacityFactor", "millingEfficiency", "demandIndex"],
    simulatorTitle: "Flujo de empaque",
    simulatorDesc: "Analiza la capacidad de empaque frente a la demanda y el impacto en nivel de servicio.",
    primaryKpi: "serviceLevel",
    secondaryKpis: ["yieldRate", "specCompliance", "customerRisk"],
    accent: "indigo",
  },
  almacenes: {
    controlKeys: ["capacityFactor", "demandIndex"],
    simulatorTitle: "Inventario y despacho",
    simulatorDesc: "Simula la presion de inventario frente a la demanda y la capacidad de despacho.",
    primaryKpi: "serviceLevel",
    secondaryKpis: ["customerRisk", "yieldRate", "specCompliance"],
    accent: "amber",
  },
  ventas: {
    controlKeys: ["demandIndex", "capacityFactor", "qualityStrictness"],
    simulatorTitle: "Modelo de demanda",
    simulatorDesc: "Evalua como el comportamiento de demanda y calidad del portafolio afectan ingresos y nivel de servicio.",
    primaryKpi: "serviceLevel",
    secondaryKpis: ["customerRisk", "yieldRate", "specCompliance"],
    accent: "rose",
  },
  rentabilidad: {
    controlKeys: ["energyCostIndex", "demandIndex", "extractionTarget", "capacityFactor"],
    simulatorTitle: "Palancas financieras",
    simulatorDesc: "Analiza la sensibilidad del margen ante variaciones en costo energetico, demanda y extraccion.",
    primaryKpi: "profitForecast",
    secondaryKpis: ["yieldRate", "serviceLevel", "customerRisk"],
    accent: "emerald",
  },
  procesos: {
    controlKeys: ["wheatMoisture", "extractionTarget", "millingEfficiency", "capacityFactor", "demandIndex", "energyCostIndex", "qualityStrictness"],
    simulatorTitle: "Simulacion transversal de proceso",
    simulatorDesc: "Vista integral de todas las variables del flujo, de grano a cliente en un solo recorrido.",
    primaryKpi: "serviceLevel",
    secondaryKpis: ["yieldRate", "specCompliance", "profitForecast"],
    accent: "blue",
  },
  catalogos: {
    controlKeys: [],
    simulatorTitle: "",
    simulatorDesc: "",
    primaryKpi: "serviceLevel",
    secondaryKpis: ["yieldRate", "specCompliance", "customerRisk"],
    accent: "blue",
  },
};

const defaultConfig: ModuleConfig = {
  controlKeys: [],
  simulatorTitle: "Simulacion de proceso",
  simulatorDesc: "Ajusta variables de proceso y mercado para simular impacto.",
  primaryKpi: "serviceLevel",
  secondaryKpis: ["yieldRate", "specCompliance", "customerRisk"],
  accent: "blue",
};

// ─── Control definitions ───────────────────────────────────────────────────
const allControls: Array<{ key: keyof TwinInputs; label: string; min: number; max: number; step: number; unit: string }> = [
  { key: "wheatMoisture",    label: "Humedad del trigo",      min: 10.5, max: 16.5, step: 0.1, unit: "%" },
  { key: "extractionTarget", label: "Meta de extraccion",     min: 69,   max: 79,   step: 0.1, unit: "%" },
  { key: "millingEfficiency",label: "Eficiencia de molienda", min: 86,   max: 97,   step: 0.1, unit: "%" },
  { key: "capacityFactor",   label: "Factor de capacidad",    min: 85,   max: 108,  step: 1,   unit: "%" },
  { key: "demandIndex",      label: "Indice de demanda",      min: 85,   max: 125,  step: 1,   unit: "idx" },
  { key: "energyCostIndex",  label: "Costo energetico",       min: 85,   max: 130,  step: 1,   unit: "idx" },
  { key: "qualityStrictness",label: "Rigor de calidad",       min: 90,   max: 120,  step: 1,   unit: "idx" },
];

// ─── KPI labels per module context ────────────────────────────────────────
const defaultKpiLabels: Record<keyof TwinOutcome["kpis"], string> = {
  yieldRate:      "Tasa de rendimiento",
  specCompliance: "Cumplimiento de especificacion",
  serviceLevel:   "Nivel de servicio",
  profitForecast: "Pronostico de utilidad",
  customerRisk:   "Riesgo de clientes",
};

const moduleKpiLabels: Partial<Record<ModuleKey, Partial<Record<keyof TwinOutcome["kpis"], string>>>> = {
  granos:       { yieldRate: "Rendimiento estimado",    specCompliance: "Calidad del grano",           customerRisk: "Riesgo de desviacion",      serviceLevel: "Impacto en abasto" },
  tolvas:       { yieldRate: "Flujo limpio",            specCompliance: "Estabilidad granulometrica",  customerRisk: "Riesgo de contaminacion",   serviceLevel: "Continuidad de tolvas" },
  molienda:     { yieldRate: "Tasa de extraccion",      specCompliance: "Estabilidad de lote",         customerRisk: "Riesgo de rechazo",         serviceLevel: "Continuidad de planta" },
  produccion:   { yieldRate: "Efectividad operacional", specCompliance: "Conformidad de proceso",      customerRisk: "Riesgo de incumplimiento",  serviceLevel: "Cumplimiento de lotes" },
  calidad:      { yieldRate: "Rendimiento bajo control",specCompliance: "Conformidad de lote",         customerRisk: "Riesgo de reclamo",         serviceLevel: "Impacto en despacho" },
  harina:       { yieldRate: "Rendimiento por lote",    specCompliance: "Tasa de liberacion",          customerRisk: "Riesgo de reclamo",         serviceLevel: "Nivel de despacho" },
  empaques:     { yieldRate: "Eficiencia de linea",     specCompliance: "Calidad de presentacion",     customerRisk: "Riesgo de merma", },
  almacenes:    { serviceLevel: "Nivel de abasto",      customerRisk: "Riesgo de quiebre",             yieldRate: "Rotacion de inventario", },
  ventas:       { serviceLevel: "Nivel de entrega",     customerRisk: "Riesgo comercial",              yieldRate: "Eficiencia de conversion", },
  rentabilidad: { profitForecast: "Utilidad proyectada",yieldRate: "Eficiencia de extraccion",         serviceLevel: "Nivel de servicio",         customerRisk: "Riesgo de portafolio" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatKpi(key: keyof TwinOutcome["kpis"], value: number): string {
  if (key === "profitForecast") return `$${value.toLocaleString()}`;
  return `${(value * 100).toFixed(1)}%`;
}

function getKpiLabel(moduleKey: ModuleKey, kpi: keyof TwinOutcome["kpis"]): string {
  return moduleKpiLabels[moduleKey]?.[kpi] ?? defaultKpiLabels[kpi];
}

function getKpiValueColor(key: keyof TwinOutcome["kpis"], value: number): string {
  if (key === "customerRisk") {
    if (value > 0.30) return "text-rose-600";
    if (value > 0.18) return "text-amber-500";
    return "text-emerald-600";
  }
  if (key === "profitForecast") return "text-emerald-600";
  if (key === "serviceLevel") {
    if (value < 0.88) return "text-rose-600";
    if (value < 0.94) return "text-amber-500";
    return "text-emerald-600";
  }
  if (key === "specCompliance") {
    if (value < 0.85) return "text-rose-600";
    if (value < 0.91) return "text-amber-500";
    return "text-emerald-600";
  }
  if (key === "yieldRate") {
    if (value < 0.70) return "text-rose-600";
    if (value < 0.74) return "text-amber-500";
    return "text-emerald-600";
  }
  return "text-slate-700";
}

const operationalModules = platformModules.filter((m) => m.section === "operacion");
const operationalCount = operationalModules.length;

function getProcessStep(key: ModuleKey): number | null {
  const mod = operationalModules.find((m) => m.key === key);
  return mod ? mod.processOrder : null;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function TwinSectionWorkbench({ moduleKey, title, subtitle }: Props) {
  const [inputs, setInputs] = useState<TwinInputs>(defaultTwinInputs);
  const outcome = useMemo(() => simulateTwin(moduleKey, inputs), [inputs, moduleKey]);

  const config = moduleConfigs[moduleKey] ?? defaultConfig;
  const colors = accentClasses[config.accent];
  const stepNumber = getProcessStep(moduleKey);
  const relevantControls = allControls.filter((c) => config.controlKeys.includes(c.key));
  const hasSimulator = relevantControls.length > 0;
  const showProfitSeparately = hasSimulator && config.primaryKpi !== "profitForecast";

  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-6 md:px-8 min-h-screen">

      {/* ── Module Header ────────────────────────────────────────────── */}
      <section className="panel relative mb-6 overflow-hidden p-5 md:p-6">
        <div className={`absolute inset-x-0 top-0 h-[3px] ${colors.bar} opacity-90`} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="section-kicker">Modulo operativo</p>
              {stepNumber !== null && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.66rem] font-bold tracking-wide ${colors.badge} ${colors.badgeText}`}>
                  Paso {stepNumber} / {operationalCount}
                </span>
              )}
            </div>
            <h1 className="section-title font-display text-3xl md:text-5xl">{title}</h1>
            <p className="section-copy ops-copy mt-2 max-w-4xl text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
      </section>

      {/* ── Twin Simulator + KPIs ─────────────────────────────────────── */}
      {hasSimulator && (
        <section className="mb-4 grid gap-4 lg:grid-cols-5">

          {/* Controls panel */}
          <div className="panel flex flex-col gap-0 p-5 lg:col-span-2 md:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className={`mt-1 h-9 w-1 shrink-0 rounded-full ${colors.bar} opacity-75`} />
              <div>
                <h2 className="font-display text-lg text-slate-800">{config.simulatorTitle}</h2>
                <p className="ops-copy mt-1 text-xs leading-relaxed text-slate-500">{config.simulatorDesc}</p>
              </div>
            </div>

            <div className="flex-1 space-y-5">
              {relevantControls.map((control) => (
                <label key={control.key} className="block">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{control.label}</span>
                    <span className={`text-sm font-bold tabular-nums ${colors.primaryValue}`}>
                      {inputs[control.key].toFixed(control.step < 1 ? 1 : 0)}<span className="ml-0.5 text-xs font-normal text-slate-400">{control.unit}</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={inputs[control.key]}
                    onChange={(event) =>
                      setInputs((prev) => ({ ...prev, [control.key]: Number(event.target.value) }))
                    }
                    className="w-full"
                  />
                  <div className="mt-0.5 flex justify-between text-[0.6rem] text-slate-400">
                    <span>{control.min}<span className="ml-0.5">{control.unit}</span></span>
                    <span>{control.max}<span className="ml-0.5">{control.unit}</span></span>
                  </div>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setInputs(defaultTwinInputs)}
              className="module-btn-ghost mt-5 w-full"
            >
              Restablecer valores base
            </button>
          </div>

          {/* KPIs panel */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            {/* Primary KPI */}
            <article className={`panel relative overflow-hidden p-5 md:p-6 ${colors.primaryBg} border-2 ${colors.primaryBorder}`}>
              <div className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[40px] ${colors.bar} opacity-[0.07]`} />
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.18em] text-slate-400">
                {getKpiLabel(moduleKey, config.primaryKpi)}
              </p>
              <p className={`mt-2 font-display text-5xl font-bold leading-none tabular-nums ${colors.primaryValue}`}>
                {formatKpi(config.primaryKpi, outcome.kpis[config.primaryKpi])}
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">{outcome.recommendation}</p>
            </article>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {config.secondaryKpis.map((kpiKey) => {
                const value = outcome.kpis[kpiKey];
                const valueColor = getKpiValueColor(kpiKey, value);
                return (
                  <article key={kpiKey} className="panel p-4 md:p-5">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-slate-400 leading-tight">
                      {getKpiLabel(moduleKey, kpiKey)}
                    </p>
                    <p className={`mt-2 font-bold text-2xl leading-none tabular-nums ${valueColor}`}>
                      {formatKpi(kpiKey, value)}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Causal Narrative + Profit Forecast ───────────────────────── */}
      {hasSimulator && (
        <section className="mb-4 grid gap-4 lg:grid-cols-3">
          <article className="panel p-5 lg:col-span-2 md:p-6">
            <h3 className="font-display text-lg text-slate-800">Cadena causal del proceso</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{outcome.narrative}</p>
          </article>
          {showProfitSeparately && (
            <article className="panel p-5 md:p-6">
              <h3 className="font-display text-lg text-slate-800">Utilidad proyectada</h3>
              <p className="mt-3 font-bold text-4xl tabular-nums text-emerald-600">
                ${outcome.kpis.profitForecast.toLocaleString()}
              </p>
              <p className="ops-copy mt-2 text-sm text-slate-500">Proyeccion mensual bajo condiciones actuales.</p>
            </article>
          )}
        </section>
      )}

      {/* ── Module-specific content ───────────────────────────────────── */}
      {moduleKey === "granos" && (
        <section className="mt-4">
          <GrainCaptureCard />
        </section>
      )}

      {(moduleKey === "produccion" ||
        moduleKey === "tolvas" ||
        moduleKey === "empaques" ||
        moduleKey === "almacenes" ||
        moduleKey === "ventas" ||
        moduleKey === "calidad" ||
        moduleKey === "catalogos" ||
        moduleKey === "molienda" ||
        moduleKey === "rentabilidad" ||
        moduleKey === "harina") && (
        <ModuleOpsBoard moduleKey={moduleKey} title={title} />
      )}

      {moduleKey === "procesos" && <ProcessFlowWizard />}
    </main>
  );
}
