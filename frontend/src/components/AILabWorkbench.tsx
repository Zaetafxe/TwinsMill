"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { runAILabScenario, type AILabScenarioResult, type AIInsights } from "@/lib/api";

type Props = {
  data: AIInsights;
};

type TabKey = "experiments" | "customers" | "quality" | "sentiment";

type ScenarioState = {
  startDate: string;
  endDate: string;
  algorithm: string;
  forecastGrowthPct: number;
  priceAdjustmentPct: number;
  costIncreasePct: number;
  qualityFailurePct: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function usd(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
}

function monthDiffInclusive(startISO: string, endISO: string) {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 1;
  }
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return Math.max(1, years * 12 + months + 1);
}

export function AILabWorkbench({ data }: Props) {
  const [tab, setTab] = useState<TabKey>("experiments");
  const [labResult, setLabResult] = useState<AILabScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioState>({
    startDate: "2026-01-01",
    endDate: "2026-06-01",
    algorithm: "RandomForest + XGBoost",
    forecastGrowthPct: 8,
    priceAdjustmentPct: 3,
    costIncreasePct: 2,
    qualityFailurePct: 4,
  });

  const projection = useMemo(() => {
    const periodMonths = monthDiffInclusive(scenario.startDate, scenario.endDate);
    const baseMonthlyRevenue = data.summary.revenue_window / Math.max(1, data.window_months);
    const baseMonthlyCost = baseMonthlyRevenue * (1 - data.summary.avg_margin_pct / 100);

    const priceFactor = 1 + scenario.priceAdjustmentPct / 100;
    const growthFactor = 1 + scenario.forecastGrowthPct / 100;
    const costFactor = 1 + scenario.costIncreasePct / 100;
    const qualityPenalty = clamp(scenario.qualityFailurePct / 100, 0, 0.4);

    const projectedRevenue = baseMonthlyRevenue * periodMonths * priceFactor * growthFactor * (1 - qualityPenalty * 0.35);
    const projectedCost = baseMonthlyCost * periodMonths * costFactor * (1 + qualityPenalty * 0.22);
    const projectedMargin = projectedRevenue - projectedCost;
    const projectedMarginPct = projectedRevenue > 0 ? (projectedMargin / projectedRevenue) * 100 : 0;

    const benefitedCustomers = Math.round(
      data.summary.active_customers * clamp(0.38 + scenario.priceAdjustmentPct * 0.02 + scenario.forecastGrowthPct * 0.012, 0.15, 0.92),
    );
    const affectedCustomers = Math.round(
      data.summary.active_customers * clamp(qualityPenalty * 1.45 + scenario.costIncreasePct * 0.008, 0.02, 0.72),
    );

    return {
      periodMonths,
      projectedRevenue,
      projectedCost,
      projectedMargin,
      projectedMarginPct,
      benefitedCustomers,
      affectedCustomers,
    };
  }, [data, scenario]);

  const forecastSeries = useMemo(() => {
    const months = projection.periodMonths;
    const start = new Date(`${scenario.startDate}T00:00:00`);
    const baseSales = data.series.sales.length > 0 ? data.series.sales : [{ month: "2026-01", revenue: data.summary.revenue_window / Math.max(1, data.window_months) }];

    return Array.from({ length: months }).map((_, index) => {
      const monthDate = new Date(start.getFullYear(), start.getMonth() + index, 1);
      const base = baseSales[index % baseSales.length].revenue;
      const trendFactor = 1 + (scenario.forecastGrowthPct / 100) * ((index + 1) / months);
      const scenarioFactor =
        (1 + scenario.priceAdjustmentPct / 100) *
        (1 - clamp(scenario.qualityFailurePct / 100, 0, 0.5) * 0.28) *
        (1 - scenario.costIncreasePct / 100 * 0.05);

      return {
        month: monthLabel(monthDate),
        baseline: Math.round(base),
        forecast: Math.round(base * trendFactor),
        scenario: Math.round(base * trendFactor * scenarioFactor),
      };
    });
  }, [data, projection.periodMonths, scenario]);

  const customerSegments = useMemo(() => {
    const total = data.summary.active_customers;
    const qualityPenalty = clamp(scenario.qualityFailurePct / 100, 0, 0.4);
    const marginLift = clamp((projection.projectedMarginPct - data.summary.avg_margin_pct) / 100, -0.25, 0.35);

    const gold = Math.round(total * clamp(0.24 + marginLift * 0.8 - qualityPenalty * 0.28, 0.12, 0.45));
    const silver = Math.round(total * clamp(0.43 + qualityPenalty * 0.18, 0.32, 0.58));
    const bronze = Math.max(0, total - gold - silver);

    return [
      { segment: "Oro", customers: gold, avgMargin: projection.projectedMarginPct + 3.6, churnRisk: 0.08 + qualityPenalty * 0.2 },
      { segment: "Plata", customers: silver, avgMargin: projection.projectedMarginPct + 0.9, churnRisk: 0.14 + qualityPenalty * 0.24 },
      { segment: "Bronce", customers: bronze, avgMargin: projection.projectedMarginPct - 2.2, churnRisk: 0.22 + qualityPenalty * 0.3 },
    ];
  }, [data.summary.active_customers, data.summary.avg_margin_pct, projection.projectedMarginPct, scenario.qualityFailurePct]);

  const qualityImpactMatrix = useMemo(() => {
    const failRate = clamp(scenario.qualityFailurePct / 100, 0, 0.6);
    const base = Math.max(1, data.summary.active_customers);

    return [
      {
        product: "Harina Panadera Premium",
        clientsAffected: Math.round(base * (0.16 + failRate * 0.78)),
        riskLevel: "alto",
        action: "Reasignar lote y activar reposicion prioritaria",
      },
      {
        product: "Harina Reposteria",
        clientsAffected: Math.round(base * (0.11 + failRate * 0.52)),
        riskLevel: "medio",
        action: "Ajustar mezcla y emitir certificado correctivo",
      },
      {
        product: "Harina Industrial",
        clientsAffected: Math.round(base * (0.08 + failRate * 0.45)),
        riskLevel: "medio",
        action: "Aumentar control de proteina por turno",
      },
      {
        product: "Premezcla Multiuso",
        clientsAffected: Math.round(base * (0.05 + failRate * 0.34)),
        riskLevel: "bajo",
        action: "Monitoreo comercial y plan preventivo",
      },
    ];
  }, [data.summary.active_customers, scenario.qualityFailurePct]);

  const sentimentModel = useMemo(() => {
    const qualityPenalty = clamp(scenario.qualityFailurePct / 100, 0, 0.45);
    const costStress = clamp(scenario.costIncreasePct / 100, 0, 0.3);

    const complaintsByProduct = [
      {
        product: "Harina Panadera Premium",
        emotion: "Frustracion",
        x: -0.62 + qualityPenalty * -0.2,
        y: 0.66 + costStress * 0.2,
        complaints: Math.round(34 + qualityPenalty * 95),
        risk: "alto",
      },
      {
        product: "Harina Reposteria",
        emotion: "Incertidumbre",
        x: -0.2 + qualityPenalty * -0.1,
        y: 0.42,
        complaints: Math.round(22 + qualityPenalty * 58),
        risk: "medio",
      },
      {
        product: "Harina Industrial",
        emotion: "Neutral",
        x: 0.12 - qualityPenalty * 0.06,
        y: -0.15 + costStress * 0.1,
        complaints: Math.round(16 + qualityPenalty * 30),
        risk: "medio",
      },
      {
        product: "Premezcla Multiuso",
        emotion: "Confianza",
        x: 0.55 - qualityPenalty * 0.14,
        y: -0.36 + costStress * 0.06,
        complaints: Math.round(9 + qualityPenalty * 18),
        risk: "bajo",
      },
    ];

    const totalComplaints = complaintsByProduct.reduce((acc, item) => acc + item.complaints, 0);
    const resolved = Math.round(totalComplaints * (0.72 - qualityPenalty * 0.22));
    const escalated = Math.round(totalComplaints * (0.18 + qualityPenalty * 0.12));
    const pending = Math.max(0, totalComplaints - resolved - escalated);

    const tp = Math.round(totalComplaints * (0.53 - qualityPenalty * 0.08));
    const fp = Math.round(totalComplaints * (0.12 + qualityPenalty * 0.08));
    const fn = Math.round(totalComplaints * (0.11 + qualityPenalty * 0.06));
    const tn = Math.max(0, totalComplaints - tp - fp - fn);

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      complaintsByProduct,
      summary: {
        totalComplaints,
        resolved,
        escalated,
        pending,
      },
      confusion: {
        tp,
        fp,
        fn,
        tn,
        precision,
        recall,
        f1,
      },
    };
  }, [scenario.costIncreasePct, scenario.qualityFailurePct]);

  const executeScenario = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runAILabScenario({
        start_date: scenario.startDate,
        end_date: scenario.endDate,
        algorithm: scenario.algorithm,
        forecast_growth_pct: scenario.forecastGrowthPct,
        price_adjustment_pct: scenario.priceAdjustmentPct,
        cost_increase_pct: scenario.costIncreasePct,
        quality_failure_pct: scenario.qualityFailurePct,
      });
      setLabResult(result);
    } catch {
      setError("No fue posible ejecutar el escenario con backend. Mostrando estimacion local.");
    } finally {
      setLoading(false);
    }
  }, [scenario]);

  useEffect(() => {
    void executeScenario();
  }, [executeScenario]);

  const projectionView = labResult
    ? {
        periodMonths: labResult.meta.months,
        projectedRevenue: labResult.projection.projected_revenue,
        projectedCost: labResult.projection.projected_cost,
        projectedMargin: labResult.projection.projected_margin,
        projectedMarginPct: labResult.projection.projected_margin_pct,
        benefitedCustomers: labResult.projection.benefited_customers,
        affectedCustomers: labResult.projection.affected_customers,
      }
    : projection;

  const forecastSeriesView = labResult ? labResult.forecast_series : forecastSeries;
  const customerSegmentsView = labResult
    ? labResult.customer_segments.map((item) => ({
        segment: item.segment,
        customers: item.customers,
        avgMargin: item.avg_margin,
        churnRisk: item.churn_risk,
      }))
    : customerSegments;
  const qualityImpactView = labResult
    ? labResult.quality_impact.map((item) => ({
        product: item.product,
        clientsAffected: item.clients_affected,
        riskLevel: item.risk_level,
        action: item.action,
      }))
    : qualityImpactMatrix;
  const sentimentView = labResult
    ? {
        complaintsByProduct: labResult.sentiment.quadrants,
        summary: {
          totalComplaints: labResult.sentiment.summary.total_complaints,
          resolved: labResult.sentiment.summary.resolved,
          escalated: labResult.sentiment.summary.escalated,
          pending: labResult.sentiment.summary.pending,
        },
        confusion: labResult.sentiment.confusion,
        attribution: labResult.sentiment.attribution,
        insights: labResult.sentiment.insights,
      }
    : {
        ...sentimentModel,
        attribution: {
          totals: { price: 19, service: 14, quality: 28 },
          by_product: [
            { product: "Harina Panadera Premium", price: 7, service: 9, quality: 18, dominant_driver: "quality" },
            { product: "Harina Reposteria", price: 8, service: 4, quality: 9, dominant_driver: "quality" },
            { product: "Harina Industrial", price: 4, service: 1, quality: 1, dominant_driver: "price" },
          ],
        },
        insights: [
          "Productos en cuadrantes de alta intensidad negativa requieren contencion comercial en menos de 24 horas.",
          "El clasificador de sentimiento ayuda a priorizar reclamaciones con impacto economico.",
          "Cruzar esta vista con lotes trazables permite acciones de calidad por cliente y producto.",
        ],
      };

  const algorithmImpact = labResult?.meta.algorithm_impact;

  return (
    <section className="panel ia-studio p-4 md:p-6">
      <div className="ia-studio-head">
        <div>
          <p className="section-kicker">Laboratorio Interactivo</p>
          <h2 className="section-title font-display text-2xl md:text-3xl">IA Scenario Studio</h2>
          <p className="ops-copy mt-2 max-w-4xl">
            Ejecuta escenarios con periodos de fecha, sensibilidad de precios/costos, impacto por calidad y segmentacion de clientes oro, plata y bronce.
          </p>
        </div>
        <div className="ia-chip-row">
          <span className="ia-chip">Prediccion</span>
          <span className="ia-chip">Clasificacion</span>
          <span className="ia-chip">Segmentacion</span>
        </div>
      </div>

      <div className="ia-tabs mt-4">
        <button className={tab === "experiments" ? "ia-tab ia-tab-active" : "ia-tab"} onClick={() => setTab("experiments")}>Experimentos</button>
        <button className={tab === "customers" ? "ia-tab ia-tab-active" : "ia-tab"} onClick={() => setTab("customers")}>Clientes</button>
        <button className={tab === "quality" ? "ia-tab ia-tab-active" : "ia-tab"} onClick={() => setTab("quality")}>Calidad y Riesgo</button>
        <button className={tab === "sentiment" ? "ia-tab ia-tab-active" : "ia-tab"} onClick={() => setTab("sentiment")}>Sentimiento</button>
      </div>

      <div className="ia-controls mt-4 grid gap-3 lg:grid-cols-4">
        <label className="ia-input-wrap">
          <span>Fecha inicio</span>
          <input type="date" value={scenario.startDate} onChange={(e) => setScenario((prev) => ({ ...prev, startDate: e.target.value }))} />
        </label>
        <label className="ia-input-wrap">
          <span>Fecha fin</span>
          <input type="date" value={scenario.endDate} onChange={(e) => setScenario((prev) => ({ ...prev, endDate: e.target.value }))} />
        </label>
        <label className="ia-input-wrap">
          <span>Pipeline</span>
          <select value={scenario.algorithm} onChange={(e) => setScenario((prev) => ({ ...prev, algorithm: e.target.value }))}>
            <option>RandomForest + XGBoost</option>
            <option>RandomForest + Prophet</option>
            <option>XGBoost + KMeans</option>
            <option>IsolationForest + RandomForest</option>
          </select>
        </label>
        <div className="ia-input-wrap">
          <span>Periodo analizado</span>
          <p className="ia-control-kpi">{projectionView.periodMonths} meses</p>
        </div>
      </div>

      <div className="ia-sliders mt-3 grid gap-3 lg:grid-cols-4">
        <label className="ia-slider-wrap">
          <span>Crecimiento forecast</span>
          <input type="range" min={-10} max={30} value={scenario.forecastGrowthPct} onChange={(e) => setScenario((prev) => ({ ...prev, forecastGrowthPct: Number(e.target.value) }))} />
          <strong>{scenario.forecastGrowthPct}%</strong>
        </label>
        <label className="ia-slider-wrap">
          <span>Ajuste de precio</span>
          <input type="range" min={-12} max={18} value={scenario.priceAdjustmentPct} onChange={(e) => setScenario((prev) => ({ ...prev, priceAdjustmentPct: Number(e.target.value) }))} />
          <strong>{scenario.priceAdjustmentPct}%</strong>
        </label>
        <label className="ia-slider-wrap">
          <span>Incremento de costos</span>
          <input type="range" min={0} max={20} value={scenario.costIncreasePct} onChange={(e) => setScenario((prev) => ({ ...prev, costIncreasePct: Number(e.target.value) }))} />
          <strong>{scenario.costIncreasePct}%</strong>
        </label>
        <label className="ia-slider-wrap">
          <span>Falla de calidad</span>
          <input type="range" min={0} max={18} value={scenario.qualityFailurePct} onChange={(e) => setScenario((prev) => ({ ...prev, qualityFailurePct: Number(e.target.value) }))} />
          <strong>{scenario.qualityFailurePct}%</strong>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="auth-button w-auto px-4 py-2 text-sm" onClick={() => void executeScenario()} disabled={loading}>
          {loading ? "Ejecutando laboratorio..." : "Ejecutar escenario IA"}
        </button>
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        {labResult ? (
          <p className="text-xs text-slate-600">
            Resultado backend activo: {labResult.meta.start_date} a {labResult.meta.end_date} | {labResult.meta.algorithm}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <article className="ia-kpi-mini">
          <p>Ingresos proyectados (ventas)</p>
          <strong>{usd(projectionView.projectedRevenue)}</strong>
        </article>
        <article className="ia-kpi-mini">
          <p>Costo proyectado</p>
          <strong>{usd(projectionView.projectedCost)}</strong>
        </article>
        <article className="ia-kpi-mini">
          <p>Margen proyectado</p>
          <strong>{projectionView.projectedMarginPct.toFixed(2)}%</strong>
        </article>
        <article className="ia-kpi-mini">
          <p>Clientes beneficiados</p>
          <strong>{projectionView.benefitedCustomers}</strong>
        </article>
      </div>

      {tab === "experiments" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <article className="panel ia-chart-card p-4 lg:col-span-8">
            <h3 className="font-display text-xl text-slate-800">Forecast de ventas: base vs escenario</h3>
            <p className="ops-copy mt-1 text-xs">Compara baseline, forecast y resultado ajustado por precio, costo y riesgo de calidad.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastSeriesView}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip formatter={(value) => usd(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="baseline" name="Base" stroke="#475569" strokeWidth={2} />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#2563eb" strokeWidth={2.4} />
                  <Line type="monotone" dataKey="scenario" name="Escenario" stroke="#0f766e" strokeWidth={2.8} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-4">
            <h3 className="font-display text-xl text-slate-800">Impacto comercial directo</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Algoritmo activo:</span> {scenario.algorithm}
              </p>
              <p>
                <span className="font-semibold">Clientes beneficiados por estrategia de precio:</span> {projectionView.benefitedCustomers}
              </p>
              <p>
                <span className="font-semibold">Clientes con riesgo por costo/calidad:</span> {projectionView.affectedCustomers}
              </p>
              <p>
                <span className="font-semibold">Utilidad esperada:</span> {usd(projectionView.projectedMargin)}
              </p>
              {algorithmImpact ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Como impacta el algoritmo seleccionado</p>
                  <p>Elasticidad de precio: {algorithmImpact.price_elasticity.toFixed(2)}x</p>
                  <p>Poder de forecast: {algorithmImpact.forecast_power.toFixed(2)}x</p>
                  <p>Sensibilidad a riesgo/churn: {algorithmImpact.risk_sensitivity.toFixed(2)}x</p>
                  <p>Resiliencia a calidad: {algorithmImpact.quality_resilience.toFixed(2)}x</p>
                </div>
              ) : null}
            </div>
          </article>
        </div>
      )}

      {tab === "customers" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <article className="panel ia-chart-card p-4 lg:col-span-7">
            <h3 className="font-display text-xl text-slate-800">Segmentacion de clientes: Oro, Plata y Bronce</h3>
            <p className="ops-copy mt-1 text-xs">Segmentos basados en volumen de compra, margen y sensibilidad al riesgo de calidad.</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerSegmentsView}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="segment" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="customers" name="Clientes" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="avgMargin" name="Margen promedio" fill="#b45309" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-5">
            <h3 className="font-display text-xl text-slate-800">Recomendacion por segmento</h3>
            <div className="mt-3 space-y-3 text-sm">
              {customerSegmentsView.map((segment) => (
                <div key={segment.segment} className="ia-algo-card">
                  <p className="font-semibold text-slate-800">{segment.segment}</p>
                  <p className="text-slate-600">Clientes: {segment.customers}</p>
                  <p className="text-slate-600">Margen esperado: {segment.avgMargin.toFixed(2)}%</p>
                  <p className="text-slate-600">Riesgo churn: {(segment.churnRisk * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}

      {tab === "quality" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <article className="panel ia-chart-card p-4 lg:col-span-6">
            <h3 className="font-display text-xl text-slate-800">Clientes afectados si una harina no cumple</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityImpactView}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="product" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="clientsAffected" name="Clientes afectados" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-6">
            <h3 className="font-display text-xl text-slate-800">Matriz de impacto por producto</h3>
            <div className="mt-3 tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Clientes</th>
                    <th>Riesgo</th>
                    <th>Acción sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityImpactView.map((item) => (
                    <tr key={item.product}>
                      <td>{item.product}</td>
                      <td>{item.clientsAffected}</td>
                      <td className="uppercase" style={{ letterSpacing: "0.08em" }}>{item.riskLevel}</td>
                      <td className="tbl-wrap-text">{item.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {tab === "sentiment" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <article className="panel ia-chart-card p-4 lg:col-span-7">
            <h3 className="font-display text-xl text-slate-800">Mapa emocional de quejas (4 cuadrantes)</h3>
            <p className="ops-copy mt-1 text-xs">
              Eje X: valencia emocional (negativa a positiva). Eje Y: intensidad emocional (baja a alta). Cada punto representa producto y volumen de quejas.
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis type="number" dataKey="x" domain={[-1, 1]} stroke="#64748b" name="Valencia" />
                  <YAxis type="number" dataKey="y" domain={[-1, 1]} stroke="#64748b" name="Intensidad" />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "complaints") {
                        return [value, "Quejas"];
                      }
                      return [value, name];
                    }}
                    cursor={{ strokeDasharray: "3 3" }}
                  />
                  <ReferenceLine x={0} stroke="#94a3b8" />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Scatter data={sentimentView.complaintsByProduct} dataKey="complaints" fill="#1d4ed8" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs text-slate-600">
              <p><span className="font-semibold text-slate-700">Q1 (x+, y+):</span> Alta energia positiva, oportunidad de fidelizacion.</p>
              <p><span className="font-semibold text-slate-700">Q2 (x-, y+):</span> Alta frustracion, requiere accion prioritaria.</p>
              <p><span className="font-semibold text-slate-700">Q3 (x-, y-):</span> Molestia silenciosa, riesgo de churn oculto.</p>
              <p><span className="font-semibold text-slate-700">Q4 (x+, y-):</span> Conformidad estable, mantener nivel de servicio.</p>
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-5">
            <h3 className="font-display text-xl text-slate-800">Estado de quejas por producto</h3>
            <div className="mt-3 space-y-2 text-sm">
              {sentimentView.complaintsByProduct.map((item) => (
                <div key={item.product} className="ia-algo-card">
                  <p className="font-semibold text-slate-800">{item.product}</p>
                  <p className="text-slate-600">Emocion dominante: {item.emotion}</p>
                  <p className="text-slate-600">Quejas: {item.complaints}</p>
                  <p className="text-slate-600 uppercase tracking-[0.08em]">Riesgo: {item.risk}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-6">
            <h3 className="font-display text-xl text-slate-800">Origen del sentimiento: precio vs servicio vs calidad</h3>
            <p className="ops-copy mt-1 text-xs">Distribucion total de drivers detectados en el texto de quejas.</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { driver: "Precio", casos: sentimentView.attribution.totals.price },
                    { driver: "Servicio", casos: sentimentView.attribution.totals.service },
                    { driver: "Calidad", casos: sentimentView.attribution.totals.quality },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="driver" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="casos" name="Casos" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-6">
            <h3 className="font-display text-xl text-slate-800">Driver dominante por producto</h3>
            <div className="mt-3 tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Servicio</th>
                    <th>Calidad</th>
                    <th>Dominante</th>
                  </tr>
                </thead>
                <tbody>
                  {sentimentView.attribution.by_product.map((row) => (
                    <tr key={row.product}>
                      <td>{row.product}</td>
                      <td>{row.price}</td>
                      <td>{row.service}</td>
                      <td>{row.quality}</td>
                      <td className="uppercase" style={{ letterSpacing: "0.08em" }}>{row.dominant_driver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-7">
            <h3 className="font-display text-xl text-slate-800">Matriz de confusion del clasificador de sentimiento</h3>
            <p className="ops-copy mt-1 text-xs">Clasifica quejas criticas vs no criticas para priorizar atencion comercial y tecnica.</p>
            <div className="mt-4 tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th></th>
                    <th className="tbl-center">Predicho Crítico</th>
                    <th className="tbl-center">Predicho No Crítico</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Real Crítico</td>
                    <td className="tbl-center" style={{ background: "rgba(52,211,153,0.14)", fontWeight: 700 }}>TP: {sentimentView.confusion.tp}</td>
                    <td className="tbl-center" style={{ background: "rgba(251,191,36,0.14)", fontWeight: 700 }}>FN: {sentimentView.confusion.fn}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Real No Crítico</td>
                    <td className="tbl-center" style={{ background: "rgba(251,191,36,0.14)", fontWeight: 700 }}>FP: {sentimentView.confusion.fp}</td>
                    <td className="tbl-center" style={{ background: "rgba(52,211,153,0.14)", fontWeight: 700 }}>TN: {sentimentView.confusion.tn}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
              <div className="ia-metric-pill"><p className="ia-metric-label">Precision</p><p className="ia-metric-value">{(sentimentView.confusion.precision * 100).toFixed(1)}%</p></div>
              <div className="ia-metric-pill"><p className="ia-metric-label">Recall</p><p className="ia-metric-value">{(sentimentView.confusion.recall * 100).toFixed(1)}%</p></div>
              <div className="ia-metric-pill"><p className="ia-metric-label">F1 Score</p><p className="ia-metric-value">{(sentimentView.confusion.f1 * 100).toFixed(1)}%</p></div>
            </div>
          </article>

          <article className="panel ia-chart-card p-4 lg:col-span-5">
            <h3 className="font-display text-xl text-slate-800">Lectura ejecutiva de resultados</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Quejas totales:</span> {sentimentView.summary.totalComplaints}. Resueltas: {sentimentView.summary.resolved}, escaladas: {sentimentView.summary.escalated}, pendientes: {sentimentView.summary.pending}.
              </p>
              {sentimentView.insights.map((insight) => (
                <p key={insight}>{insight}</p>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
