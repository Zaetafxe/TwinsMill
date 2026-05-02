"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AIInsights } from "@/lib/api";

type Props = {
  data: AIInsights;
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function usd(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function metricPill(label: string, value: string) {
  return (
    <div className="ia-metric-pill">
      <p className="ia-metric-label">{label}</p>
      <p className="ia-metric-value">{value}</p>
    </div>
  );
}

export function AIAnalyticsPanel({ data }: Props) {
  const qualityModel = data.model_lab.quality_random_forest;
  const marginModel = data.model_lab.margin_random_forest;
  const salesRiskModel = data.model_lab.sales_risk_random_forest;

  return (
    <section className="ia-lab-grid">
      <article className="panel ia-hero ia-reveal ia-delay-1 lg:col-span-12">
        <div>
          <p className="section-kicker">Plataforma IA Aplicada</p>
          <h2 className="ia-hero-title">Modelado predictivo industrial para molino de trigo</h2>
          <p className="ia-hero-copy">
            Esta vista integra entrenamiento, explicabilidad y desempeno en modelos de calidad, margen y riesgo comercial usando datos operativos de 90 dias.
          </p>
        </div>
        <div className="ia-hero-badges">
          <span className="ia-chip">Random Forest Lab</span>
          <span className="ia-chip">KPIs conectados a planta</span>
          <span className="ia-chip">Decision intelligence</span>
        </div>
      </article>

      <article className="panel ia-kpi ia-reveal ia-delay-2 lg:col-span-3 md:p-6">
        <p className="ia-kpi-label">Base operativa</p>
        <p className="ia-kpi-value text-slate-800">{data.summary.records.receptions.toLocaleString("en-US")}</p>
        <p className="ia-kpi-copy">Registros de recepcion, molienda y venta conectados a trazabilidad.</p>
      </article>

      <article className="panel ia-kpi ia-reveal ia-delay-3 lg:col-span-3 md:p-6">
        <p className="ia-kpi-label">Ingreso 3 meses</p>
        <p className="ia-kpi-value text-emerald-700">{usd(data.summary.revenue_window)}</p>
        <p className="ia-kpi-copy">Revenue neto consolidado para calibrar modelos comerciales.</p>
      </article>

      <article className="panel ia-kpi ia-reveal ia-delay-4 lg:col-span-3 md:p-6">
        <p className="ia-kpi-label">Calidad promedio</p>
        <p className="ia-kpi-value text-sky-700">{pct(data.summary.avg_spec_compliance)}</p>
        <p className="ia-kpi-copy">Cumplimiento de especificacion medido en la ventana analitica.</p>
      </article>

      <article className="panel ia-kpi ia-reveal ia-delay-5 lg:col-span-3 md:p-6">
        <p className="ia-kpi-label">Margen medio</p>
        <p className="ia-kpi-value text-amber-700">{data.summary.avg_margin_pct.toFixed(2)}%</p>
        <p className="ia-kpi-copy">Ventas de alto riesgo detectadas: {data.summary.high_risk_sales}.</p>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-2 p-4 lg:col-span-8 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Flujo productivo mensual</h3>
        <p className="ops-copy mt-1 text-xs text-slate-500">Toneladas recibidas, molidas y vendidas con datos de operacion real.</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.series.production}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Bar dataKey="tons_received" name="Recepcion" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tons_milled" name="Molienda" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tons_sold" name="Ventas" fill="#b45309" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-3 p-4 lg:col-span-4 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Pipeline IA en produccion</h3>
        <div className="mt-4 space-y-3">
          {data.algorithm_pipeline.map((algorithm) => (
            <div key={algorithm.name} className="ia-algo-card">
              <p className="text-sm font-semibold text-slate-800">{algorithm.name}</p>
              <p className="text-xs text-slate-600">{algorithm.objective}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                {algorithm.status} | score {algorithm.score.toFixed(3)}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-4 p-4 lg:col-span-6 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Random Forest: Calidad</h3>
        <p className="mt-1 text-xs text-slate-500">
          Modelo: {qualityModel.model}. Proposito: {qualityModel.explanation.purpose}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {metricPill("Accuracy", `${(qualityModel.metrics.accuracy * 100).toFixed(1)}%`)}
          {metricPill("ROC AUC", qualityModel.metrics.roc_auc.toFixed(3))}
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={qualityModel.feature_importance} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis type="number" stroke="#64748b" domain={[0, 1]} />
              <YAxis type="category" dataKey="feature" stroke="#64748b" width={150} />
              <Tooltip />
              <Bar dataKey="importance" name="Importancia" fill="#2563eb" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-5 p-4 lg:col-span-6 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Distribucion de riesgo de calidad</h3>
        <p className="mt-1 text-xs text-slate-500">Variables usadas: {qualityModel.explanation.variables.join(", ")}</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={qualityModel.risk_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="bucket" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="count" name="Muestras" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-2 p-4 lg:col-span-8 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Random Forest: Margen (Prediccion vs Real)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Modelo: {marginModel.model}. Proposito: {marginModel.explanation.purpose}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {metricPill("R2", marginModel.metrics.r2.toFixed(3))}
          {metricPill("MAE", `${marginModel.metrics.mae.toFixed(2)} pts`)}
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={marginModel.prediction_samples}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="sample" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" name="Margen real" stroke="#b45309" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="predicted" name="Margen predicho" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-3 p-4 lg:col-span-4 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Drivers de margen</h3>
        <p className="mt-1 text-xs text-slate-500">{marginModel.explanation.why}</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={marginModel.feature_importance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="feature" stroke="#64748b" />
              <YAxis stroke="#64748b" domain={[0, 1]} />
              <Tooltip />
              <Bar dataKey="importance" name="Importancia" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-4 p-4 lg:col-span-6 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Random Forest: Riesgo de ventas</h3>
        <p className="mt-1 text-xs text-slate-500">{salesRiskModel.explanation.purpose}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {metricPill("Accuracy", `${(salesRiskModel.metrics.accuracy * 100).toFixed(1)}%`)}
          {metricPill("ROC AUC", salesRiskModel.metrics.roc_auc.toFixed(3))}
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesRiskModel.feature_importance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="feature" stroke="#64748b" />
              <YAxis stroke="#64748b" domain={[0, 1]} />
              <Tooltip />
              <Bar dataKey="importance" name="Importancia" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-5 p-4 lg:col-span-6 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Revenue mensual</h3>
        <p className="mt-1 text-xs text-slate-500">KPI economico natural para molino: venta neta con trazabilidad de proceso</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series.sales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip formatter={(value) => usd(Number(value))} />
              <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel ia-chart-card ia-reveal ia-delay-3 p-5 lg:col-span-12 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Algoritmos sugeridos para un molino de trigo (Premium Stack)</h3>
        <p className="ops-copy mt-1 text-xs text-slate-500">
          Seleccion orientada a ciencia de datos industrial: cada algoritmo incluye por que usarlo, que mide y variables operativas clave.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.recommended_algorithms.map((algorithm) => (
            <div key={algorithm.algorithm} className="ia-algo-card">
              <p className="text-sm font-semibold text-slate-800">{algorithm.algorithm}</p>
              <p className="mt-1 text-xs text-slate-600"><span className="font-semibold text-slate-700">Por que:</span> {algorithm.why}</p>
              <p className="mt-1 text-xs text-slate-600"><span className="font-semibold text-slate-700">Proposito:</span> {algorithm.purpose}</p>
              <p className="mt-1 text-xs text-slate-600"><span className="font-semibold text-slate-700">Variables:</span> {algorithm.variables.join(", ")}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
