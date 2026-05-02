"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getTwinBlueprint,
  runPhysicalTwinModel,
  type PhysicalModelInput,
  type PhysicalModelOutput,
  type TwinBlueprint,
  type TwinKpiSpec,
} from "@/lib/api";

const defaultInput: PhysicalModelInput = {
  wheat_input_tons: 520,
  wheat_moisture_pct: 13.2,
  tempering_target_pct: 15.3,
  roller_speed_rpm: 470,
  grinding_pressure_bar: 5.4,
  sifter_efficiency_pct: 95.8,
  purifier_efficiency_pct: 94,
  extraction_target_pct: 75,
  specific_energy_kwh_ton: 56,
  planned_time_minutes: 1440,
  downtime_minutes: 65,
  quality_protein_pct: 11.4,
  quality_ash_pct: 0.57,
};

const controllable: Array<{
  key: keyof PhysicalModelInput;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  { key: "wheat_input_tons", label: "Entrada de trigo", min: 300, max: 1200, step: 10, unit: "ton" },
  { key: "wheat_moisture_pct", label: "Humedad de trigo", min: 10, max: 17, step: 0.1, unit: "%" },
  { key: "tempering_target_pct", label: "Objetivo acondicionamiento", min: 12, max: 17, step: 0.1, unit: "%" },
  { key: "roller_speed_rpm", label: "Velocidad rodillos", min: 280, max: 780, step: 5, unit: "rpm" },
  { key: "grinding_pressure_bar", label: "Presion molienda", min: 2.5, max: 10, step: 0.1, unit: "bar" },
  { key: "sifter_efficiency_pct", label: "Eficiencia cernido", min: 85, max: 99.8, step: 0.1, unit: "%" },
  { key: "purifier_efficiency_pct", label: "Eficiencia purificador", min: 85, max: 99.8, step: 0.1, unit: "%" },
  { key: "specific_energy_kwh_ton", label: "Energia especifica", min: 35, max: 85, step: 0.5, unit: "kWh/t" },
  { key: "downtime_minutes", label: "Paro no programado", min: 0, max: 360, step: 5, unit: "min" },
  { key: "quality_protein_pct", label: "Proteina harina", min: 9, max: 14, step: 0.1, unit: "%" },
  { key: "quality_ash_pct", label: "Cenizas harina", min: 0.35, max: 0.9, step: 0.01, unit: "%" },
];

export function DigitalTwinBlueprintPanel() {
  const [blueprint, setBlueprint] = useState<TwinBlueprint | null>(null);
  const [inputs, setInputs] = useState<PhysicalModelInput>(defaultInput);
  const [result, setResult] = useState<PhysicalModelOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [bp, baseline] = await Promise.all([getTwinBlueprint(), runPhysicalTwinModel(defaultInput)]);
        setBlueprint(bp);
        setResult(baseline);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function handleRun() {
    setSimulating(true);
    try {
      const simulated = await runPhysicalTwinModel(inputs);
      setResult(simulated);
    } finally {
      setSimulating(false);
    }
  }

  const groupedKpis = useMemo(() => {
    if (!blueprint) return {} as Record<string, TwinKpiSpec[]>;

    return blueprint.kpis.reduce<Record<string, TwinKpiSpec[]>>((acc, kpi) => {
      if (!acc[kpi.category]) {
        acc[kpi.category] = [];
      }
      acc[kpi.category].push(kpi);
      return acc;
    }, {});
  }, [blueprint]);

  if (loading || !blueprint || !result) {
    return <section className="panel mt-6 min-h-48 p-6" />;
  }

  return (
    <section className="mt-6 space-y-4">
      <article className="panel p-5 md:p-6">
        <p className="section-kicker">Blueprint Integral</p>
        <h2 className="font-display text-2xl text-slate-800">Gemelo Digital del Molino</h2>
        <p className="ops-copy mt-2 text-sm text-slate-600">
          Modelo integrado de proceso, sensores, KPIs y simulacion fisica para decisiones operativas y de mantenimiento.
        </p>
      </article>

      <div className="grid gap-4 xl:grid-cols-5">
        <article className="panel p-5 xl:col-span-2 md:p-6">
          <h3 className="font-display text-xl text-slate-800">Simulador Fisico (What-if)</h3>
          <p className="ops-copy mt-2 text-xs text-slate-500">Ajusta variables de planta para recalcular balance de masa, OEE y alertas.</p>

          <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
            {controllable.map((control) => (
              <label key={control.key} className="block">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{control.label}</span>
                  <span>
                    {inputs[control.key].toFixed(control.step < 1 ? 2 : 0)} {control.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={inputs[control.key]}
                  onChange={(event) =>
                    setInputs((previous) => ({
                      ...previous,
                      [control.key]: Number(event.target.value),
                    }))
                  }
                  className="w-full"
                />
              </label>
            ))}
          </div>

          <button
            onClick={handleRun}
            disabled={simulating}
            className="btn-primary mt-4"
          >
            {simulating ? "Simulando..." : "Ejecutar modelo fisico"}
          </button>
        </article>

        <article className="panel p-5 xl:col-span-3 md:p-6">
          <h3 className="font-display text-xl text-slate-800">Resultados del Modelo Fisico</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Extraccion</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">{result.kpis.extraction_pct.toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">OEE</p>
              <p className="mt-1 text-2xl font-semibold text-blue-600">{result.kpis.oee_pct.toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Energia</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{result.kpis.specific_energy_kwh_ton.toFixed(1)} kWh/t</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Throughput</p>
              <p className="mt-1 text-2xl font-semibold text-violet-600">{result.kpis.throughput_tph.toFixed(2)} t/h</p>
            </div>
          </div>

          <div className="mt-4 tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Entrada (ton)</th>
                  <th>Salida (ton)</th>
                  <th>Merma (ton)</th>
                </tr>
              </thead>
              <tbody>
                {result.stage_balance.map((stage) => (
                  <tr key={stage.stage}>
                    <td>{stage.stage}</td>
                    <td>{stage.input_tons.toFixed(3)}</td>
                    <td>{stage.output_tons.toFixed(3)}</td>
                    <td>{stage.losses_tons.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2">
            {result.alerts.length > 0 ? (
              result.alerts.map((alert) => (
                <p key={alert} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
                  {alert}
                </p>
              ))
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">Operacion dentro de parametros esperados.</p>
            )}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5 md:p-6">
          <h3 className="font-display text-xl text-slate-800">Modelo del Proceso Molinero</h3>
          <div className="mt-3 space-y-3 text-sm">
            {blueprint.process_stages.map((stage) => (
              <div key={stage.name} className="rounded-lg border border-slate-200 p-3">
                <h4 className="font-semibold text-slate-800">{stage.name}</h4>
                <p className="mt-1 text-slate-600">Variables criticas: {stage.critical_variables.join(", ")}</p>
                <p className="mt-1 text-slate-600">Equipos: {stage.equipment.join(", ")}</p>
                <p className="mt-1 text-slate-600">Riesgos: {stage.operational_risks.join(", ")}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-5 md:p-6">
          <h3 className="font-display text-xl text-slate-800">Variables y Sensores (Data Core)</h3>
<div className="mt-3 tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Proceso</th>
                  <th>Variable</th>
                  <th>Sensor</th>
                  <th>Fuente</th>
                  <th>Frecuencia</th>
                </tr>
              </thead>
              <tbody>
                {blueprint.sensors.map((sensor) => (
                  <tr key={`${sensor.process}-${sensor.variable}`}>
                    <td>{sensor.process}</td>
                    <td>{sensor.variable}</td>
                    <td>{sensor.sensor_type}</td>
                    <td>{sensor.source}</td>
                    <td className="tbl-mono">{sensor.frequency_seconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="mt-4 text-sm font-semibold text-slate-700">Integracion de fuentes</h4>
          <p className="mt-1 text-sm text-slate-600">{blueprint.data_core.integration_sources.join(" | ")}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5 md:p-6">
          <h3 className="font-display text-xl text-slate-800">KPIs del Molino</h3>
          {Object.entries(groupedKpis).map(([category, entries]) => (
            <div key={category} className="mt-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{category}</p>
              <div className="mt-2 space-y-2 text-sm">
                {entries.map((kpi) => (
                  <div key={kpi.name} className="rounded-lg border border-slate-200 p-2">
                    <p className="font-semibold text-slate-800">{kpi.name}</p>
                    <p className="text-slate-600">Formula: {kpi.formula}</p>
                    <p className="text-slate-500">Objetivo: {kpi.target} {kpi.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </article>

        <article className="panel p-5 md:p-6">
          <h3 className="font-display text-xl text-slate-800">Modelo del Gemelo Digital</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p><span className="font-semibold">Modelo fisico:</span> {blueprint.twin_model.physical_model.join("; ")}</p>
            <p><span className="font-semibold">Modelo matematico:</span> {blueprint.twin_model.mathematical_model.join("; ")}</p>
            <p><span className="font-semibold">Modelo de datos:</span> {blueprint.twin_model.data_model.join("; ")}</p>
            <p><span className="font-semibold">Modelo predictivo:</span> {blueprint.twin_model.predictive_model.join("; ")}</p>
          </div>

          <h4 className="mt-4 text-sm font-semibold text-slate-700">Ecuaciones base</h4>
          <div className="mt-2 space-y-2">
            {blueprint.equations.map((equation) => (
              <div key={equation.name} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="font-semibold text-slate-800">{equation.name}</p>
                <p className="font-mono text-xs text-slate-700">{equation.expression}</p>
                <p className="text-xs text-slate-600">{equation.description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
