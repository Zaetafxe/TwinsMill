"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { createEconomicScenario, getEconomicBaseline, getEconomicScenarios, getEconomicTrend } from "@/lib/api";

type Stage = {
  key: string;
  label: string;
  short: string;
  value: string;
  status: "ok" | "warn" | "risk";
  detail: string;
};

type EconomicInputs = {
  wheatPriceUsdTon: number;
  flourPriceUsdTon: number;
  byproductPriceUsdTon: number;
  energyUsdTonWheat: number;
  wheatMoistureReceptionPct: number;
  capacityTonDay: number;
  laborDaysYear: number;
  flourMoisturePct: number;
  packagingEfficiencyPct: number;
  operationalAvailabilityPct: number;
  nominalCapacityPct: number;
  impurityInputPct: number;
  flourExtractionPct: number;
  wheatMoistureInputPct: number;
};

type EconomicResult = {
  processedWheatTon: number;
  saleableFlourTon: number;
  byproductTon: number;
  variableCostUsd: number;
  annualContributionUsd: number;
  revenueUsd: number;
  marginPct: number;
  contributionPerTon: number;
};

const stageData: Stage[] = [
  {
    key: "silo",
    label: "Silo y recepcion",
    short: "Silo",
    value: "13.2% humedad",
    status: "ok",
    detail: "Inventario sano con 18.4 dias de cobertura y calidad estable de entrada.",
  },
  {
    key: "cleaning",
    label: "Limpieza",
    short: "Limpieza",
    value: "98.1% eficiencia",
    status: "ok",
    detail: "Separacion de impurezas en rango objetivo con bajo impacto en merma.",
  },
  {
    key: "milling",
    label: "Molienda",
    short: "Molienda",
    value: "75.0% extraccion",
    status: "warn",
    detail: "La extraccion esta en objetivo, pero con sensibilidad alta a variacion de humedad.",
  },
  {
    key: "quality",
    label: "Harina y calidad",
    short: "Harina",
    value: "93.0% espec",
    status: "ok",
    detail: "Liberacion de lote consistente para clientes industriales y panificacion.",
  },
  {
    key: "warehouse",
    label: "Almacen y despacho",
    short: "Despacho",
    value: "96.0% servicio",
    status: "warn",
    detail: "Nivel de servicio alto, con alerta de quiebre potencial en 14 dias.",
  },
  {
    key: "customer",
    label: "Venta a cliente",
    short: "Cliente",
    value: "$319.5/ton",
    status: "risk",
    detail: "Margen bajo presion por energia y mezcla de portafolio en clientes de menor precio.",
  },
];

const economicBase: EconomicInputs = {
  wheatPriceUsdTon: 306,
  flourPriceUsdTon: 620,
  byproductPriceUsdTon: 260,
  energyUsdTonWheat: 7,
  wheatMoistureReceptionPct: 12.5,
  capacityTonDay: 200,
  laborDaysYear: 300,
  flourMoisturePct: 14.5,
  packagingEfficiencyPct: 99.8,
  operationalAvailabilityPct: 85,
  nominalCapacityPct: 90,
  impurityInputPct: 1,
  flourExtractionPct: 76.5,
  wheatMoistureInputPct: 15.5,
};

const variableFieldOrder: Array<{ key: keyof EconomicInputs; label: string; step?: number }> = [
  { key: "wheatPriceUsdTon", label: "Trigo USD/Tm" },
  { key: "flourPriceUsdTon", label: "Harina USD/Tm" },
  { key: "byproductPriceUsdTon", label: "Subproductos USD/Tm" },
  { key: "energyUsdTonWheat", label: "Energia USD/Tm trigo", step: 0.1 },
  { key: "wheatMoistureReceptionPct", label: "Humedad trigo recepcion (%)", step: 0.1 },
  { key: "capacityTonDay", label: "Capacidad Tm/dia" },
  { key: "laborDaysYear", label: "Dias laborables anuales" },
  { key: "flourMoisturePct", label: "Humedad harina (%)", step: 0.1 },
  { key: "packagingEfficiencyPct", label: "Eficiencia envasado (%)", step: 0.1 },
  { key: "operationalAvailabilityPct", label: "Disponibilidad operativa (%)", step: 0.1 },
  { key: "nominalCapacityPct", label: "% capacidad nominal", step: 0.1 },
  { key: "impurityInputPct", label: "Impurezas entrada (%)", step: 0.1 },
  { key: "flourExtractionPct", label: "Extraccion harinas (%)", step: 0.1 },
  { key: "wheatMoistureInputPct", label: "Humedad Trigo Molienda (%)", step: 0.1 },
];

const sensitivityVariables: Array<{ key: keyof EconomicInputs; label: string }> = [
  { key: "wheatMoistureReceptionPct", label: "Humedad trigo recepcion" },
  { key: "flourMoisturePct", label: "Humedad harina" },
  { key: "packagingEfficiencyPct", label: "Eficiencia envasado" },
  { key: "operationalAvailabilityPct", label: "Disponibilidad operativa" },
  { key: "nominalCapacityPct", label: "% capacidad nominal" },
  { key: "impurityInputPct", label: "Impurezas entrada" },
  { key: "flourExtractionPct", label: "Extraccion harinas" },
  { key: "wheatMoistureInputPct", label: "Humedad Trigo Molienda" },
];

const captureSourceMap = [
  { variable: "Humedad trigo recepcion / molienda", where: "Granos + Tolvas", field: "Recepcion, prelimpia y control tolvas" },
  { variable: "Impurezas de entrada", where: "Granos + Calidad", field: "Prelimpia y analisis de control" },
  { variable: "Extraccion harinas", where: "Produccion", field: "Molienda harina (laboratorio)" },
  { variable: "Disponibilidad / % capacidad", where: "Produccion", field: "Lote y turno de produccion" },
  { variable: "Humedad harina", where: "Calidad", field: "Analisis de humedad por lote" },
  { variable: "Eficiencia envasado", where: "Empaques", field: "Calidad de sellado y merma" },
  { variable: "Precios (trigo, harina, subproducto)", where: "Ventas + Catalogos", field: "Precio de compra y venta por periodo" },
  { variable: "Costo energia", where: "Produccion", field: "Costo energetico por tonelada" },
];

function statusClass(status: Stage["status"]) {
  if (status === "ok") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  if (status === "warn") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }
  return "bg-rose-100 text-rose-700 border-rose-200";
}

function formatUsd(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeEconomicResult(input: EconomicInputs): EconomicResult {
  const processedWheatTon =
    input.capacityTonDay *
    input.laborDaysYear *
    (input.operationalAvailabilityPct / 100) *
    (input.nominalCapacityPct / 100);

  const humidityPenalty = Math.max(0, input.wheatMoistureInputPct - 15.5) * 0.0035;
  const impurityPenalty = Math.max(0, input.impurityInputPct - 1) * 0.01;
  const effectiveExtraction = clamp((input.flourExtractionPct / 100) * (1 - humidityPenalty) * (1 - impurityPenalty), 0.55, 0.86);

  const grossFlourTon = processedWheatTon * effectiveExtraction;
  const moistureSalePenalty = Math.max(0, input.flourMoisturePct - 14.5) * 0.002;
  const saleableFlourTon = grossFlourTon * (input.packagingEfficiencyPct / 100) * (1 - moistureSalePenalty);

  const byproductTon = Math.max(processedWheatTon - grossFlourTon - processedWheatTon * (input.impurityInputPct / 100), 0);

  const revenueUsd = saleableFlourTon * input.flourPriceUsdTon + byproductTon * input.byproductPriceUsdTon;
  const rawMaterialAndEnergyUsd = processedWheatTon * (input.wheatPriceUsdTon + input.energyUsdTonWheat);
  const dryingAndHandlingUsd = processedWheatTon * Math.max(0, input.wheatMoistureReceptionPct - 12.5) * 0.8;
  const qualityAdjustmentUsd = processedWheatTon * Math.max(0, 14.2 - input.flourMoisturePct) * 1.4;

  const variableCostUsd = rawMaterialAndEnergyUsd + dryingAndHandlingUsd + qualityAdjustmentUsd;
  const annualContributionUsd = revenueUsd - variableCostUsd;

  const marginPct = revenueUsd > 0 ? (annualContributionUsd / revenueUsd) * 100 : 0;
  const contributionPerTon = processedWheatTon > 0 ? annualContributionUsd / processedWheatTon : 0;

  return {
    processedWheatTon,
    saleableFlourTon,
    byproductTon,
    variableCostUsd,
    annualContributionUsd,
    revenueUsd,
    marginPct,
    contributionPerTon,
  };
}

function toBackendVariables(input: EconomicInputs): Record<string, number> {
  return {
    wheat_price_usd_ton: input.wheatPriceUsdTon,
    flour_price_usd_ton: input.flourPriceUsdTon,
    byproduct_price_usd_ton: input.byproductPriceUsdTon,
    energy_usd_ton_wheat: input.energyUsdTonWheat,
    wheat_moisture_reception_pct: input.wheatMoistureReceptionPct,
    capacity_ton_day: input.capacityTonDay,
    labor_days_year: input.laborDaysYear,
    flour_moisture_pct: input.flourMoisturePct,
    packaging_efficiency_pct: input.packagingEfficiencyPct,
    operational_availability_pct: input.operationalAvailabilityPct,
    nominal_capacity_pct: input.nominalCapacityPct,
    impurity_input_pct: input.impurityInputPct,
    flour_extraction_pct: input.flourExtractionPct,
    wheat_moisture_input_pct: input.wheatMoistureInputPct,
  };
}

function fromBackendVariables(values: Record<string, number>): EconomicInputs {
  return {
    wheatPriceUsdTon: values.wheat_price_usd_ton ?? economicBase.wheatPriceUsdTon,
    flourPriceUsdTon: values.flour_price_usd_ton ?? economicBase.flourPriceUsdTon,
    byproductPriceUsdTon: values.byproduct_price_usd_ton ?? economicBase.byproductPriceUsdTon,
    energyUsdTonWheat: values.energy_usd_ton_wheat ?? economicBase.energyUsdTonWheat,
    wheatMoistureReceptionPct: values.wheat_moisture_reception_pct ?? economicBase.wheatMoistureReceptionPct,
    capacityTonDay: values.capacity_ton_day ?? economicBase.capacityTonDay,
    laborDaysYear: values.labor_days_year ?? economicBase.laborDaysYear,
    flourMoisturePct: values.flour_moisture_pct ?? economicBase.flourMoisturePct,
    packagingEfficiencyPct: values.packaging_efficiency_pct ?? economicBase.packagingEfficiencyPct,
    operationalAvailabilityPct: values.operational_availability_pct ?? economicBase.operationalAvailabilityPct,
    nominalCapacityPct: values.nominal_capacity_pct ?? economicBase.nominalCapacityPct,
    impurityInputPct: values.impurity_input_pct ?? economicBase.impurityInputPct,
    flourExtractionPct: values.flour_extraction_pct ?? economicBase.flourExtractionPct,
    wheatMoistureInputPct: values.wheat_moisture_input_pct ?? economicBase.wheatMoistureInputPct,
  };
}

export function TwinMillFlowBoard() {
  const [selected, setSelected] = useState(stageData[2].key);
  const [economicBaseInput, setEconomicBaseInput] = useState<EconomicInputs>(economicBase);
  const [economicInput, setEconomicInput] = useState<EconomicInputs>(economicBase);
  const [linkWheatMoistures, setLinkWheatMoistures] = useState(true);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [baselineWindowDays, setBaselineWindowDays] = useState(0);
  const [scenarioName, setScenarioName] = useState("Escenario operativo");
  const [scenarioNotes, setScenarioNotes] = useState("");
  const [savedScenarios, setSavedScenarios] = useState<Array<{
    id: string;
    name: string;
    notes: string;
    variables: Record<string, number>;
    annual_contribution_usd: number;
    delta_vs_baseline_usd: number;
    created_at?: string;
  }>>([]);
  const [compareScenarioIds, setCompareScenarioIds] = useState<string[]>([]);
  const [scenarioCompareTrends, setScenarioCompareTrends] = useState<
    Record<string, Array<{ month: string; baseline_usd: number; scenario_usd: number }>>
  >({});
  const [trendMonths, setTrendMonths] = useState(6);
  const [trendPoints, setTrendPoints] = useState<Array<{ month: string; baseline_usd: number; scenario_usd: number }>>([]);

  const selectedCompareScenarios = useMemo(
    () => savedScenarios.filter((item) => compareScenarioIds.includes(item.id)).slice(0, 4),
    [compareScenarioIds, savedScenarios],
  );

  function applyPreset(mode: "optimista" | "pesimista") {
    const direction = mode === "optimista" ? 1 : -1;
    setEconomicInput({
      wheatPriceUsdTon: Math.max(1, economicBaseInput.wheatPriceUsdTon * (1 - direction * 0.03)),
      flourPriceUsdTon: Math.max(1, economicBaseInput.flourPriceUsdTon * (1 + direction * 0.02)),
      byproductPriceUsdTon: Math.max(1, economicBaseInput.byproductPriceUsdTon * (1 + direction * 0.02)),
      energyUsdTonWheat: Math.max(0, economicBaseInput.energyUsdTonWheat * (1 - direction * 0.05)),
      wheatMoistureReceptionPct: clamp(economicBaseInput.wheatMoistureReceptionPct - direction * 0.5, 0, 100),
      capacityTonDay: Math.max(1, economicBaseInput.capacityTonDay * (1 + direction * 0.02)),
      laborDaysYear: Math.max(1, economicBaseInput.laborDaysYear),
      flourMoisturePct: clamp(economicBaseInput.flourMoisturePct - direction * 0.3, 0, 100),
      packagingEfficiencyPct: clamp(economicBaseInput.packagingEfficiencyPct + direction * 0.3, 0, 100),
      operationalAvailabilityPct: clamp(economicBaseInput.operationalAvailabilityPct + direction * 1.8, 0, 100),
      nominalCapacityPct: clamp(economicBaseInput.nominalCapacityPct + direction * 1.2, 0, 100),
      impurityInputPct: clamp(economicBaseInput.impurityInputPct - direction * 0.25, 0, 100),
      flourExtractionPct: clamp(economicBaseInput.flourExtractionPct + direction * 0.8, 0, 100),
      wheatMoistureInputPct: clamp(economicBaseInput.wheatMoistureInputPct - direction * 0.4, 0, 100),
    });
  }

  function loadBaseline(windowDays: number) {
    getEconomicBaseline(windowDays)
      .then((baseline) => {
        const mapped: EconomicInputs = {
          wheatPriceUsdTon: baseline.wheat_price_usd_ton,
          flourPriceUsdTon: baseline.flour_price_usd_ton,
          byproductPriceUsdTon: baseline.byproduct_price_usd_ton,
          energyUsdTonWheat: baseline.energy_usd_ton_wheat,
          wheatMoistureReceptionPct: baseline.wheat_moisture_reception_pct,
          capacityTonDay: baseline.capacity_ton_day,
          laborDaysYear: baseline.labor_days_year,
          flourMoisturePct: baseline.flour_moisture_pct,
          packagingEfficiencyPct: baseline.packaging_efficiency_pct,
          operationalAvailabilityPct: baseline.operational_availability_pct,
          nominalCapacityPct: baseline.nominal_capacity_pct,
          impurityInputPct: baseline.impurity_input_pct,
          flourExtractionPct: baseline.flour_extraction_pct,
          wheatMoistureInputPct: baseline.wheat_moisture_input_pct,
        };
        setEconomicBaseInput(mapped);
        setEconomicInput(mapped);
        setSourceCounts(baseline.source_counts ?? {});
      })
      .catch(() => {
        setEconomicBaseInput(economicBase);
        setEconomicInput(economicBase);
      });
  }

  useEffect(() => {
    loadBaseline(baselineWindowDays);
  }, [baselineWindowDays]);

  useEffect(() => {
    getEconomicScenarios()
      .then((data) => setSavedScenarios(data))
      .catch(() => setSavedScenarios([]));
  }, []);

  useEffect(() => {
    getEconomicTrend({
      months: trendMonths,
      variables: toBackendVariables(economicInput),
      window_days: baselineWindowDays,
    })
      .then((data) => setTrendPoints(data.points ?? []))
      .catch(() => setTrendPoints([]));
  }, [baselineWindowDays, economicInput, trendMonths]);

  useEffect(() => {
    if (selectedCompareScenarios.length === 0) {
      setScenarioCompareTrends({});
      return;
    }

    Promise.all(
      selectedCompareScenarios.map((scenario) =>
        getEconomicTrend({
          months: trendMonths,
          variables: scenario.variables,
          window_days: baselineWindowDays,
        }),
      ),
    )
      .then((responses) => {
        const nextMap: Record<string, Array<{ month: string; baseline_usd: number; scenario_usd: number }>> = {};
        selectedCompareScenarios.forEach((scenario, idx) => {
          nextMap[scenario.id] = responses[idx]?.points ?? [];
        });
        setScenarioCompareTrends(nextMap);
      })
      .catch(() => setScenarioCompareTrends({}));
  }, [baselineWindowDays, selectedCompareScenarios, trendMonths]);

  const selectedStage = useMemo(() => stageData.find((stage) => stage.key === selected) ?? stageData[0], [selected]);
  const baselineResult = useMemo(() => computeEconomicResult(economicBaseInput), [economicBaseInput]);
  const scenarioResult = useMemo(() => computeEconomicResult(economicInput), [economicInput]);
  const annualDeltaUsd = scenarioResult.annualContributionUsd - baselineResult.annualContributionUsd;

  const sensitivity = useMemo(() => {
    return sensitivityVariables.map(({ key, label }) => {
      const singleChangeInput = { ...economicBaseInput, [key]: economicInput[key] };
      const result = computeEconomicResult(singleChangeInput);
      return {
        key,
        label,
        deltaUsd: result.annualContributionUsd - baselineResult.annualContributionUsd,
      };
    });
  }, [baselineResult.annualContributionUsd, economicBaseInput, economicInput]);

  const maxAbsDelta = useMemo(() => {
    const value = Math.max(...sensitivity.map((item) => Math.abs(item.deltaUsd)), 1);
    return value;
  }, [sensitivity]);

  const trendChartData = useMemo(() => {
    return trendPoints.map((point, idx) => {
      const row: Record<string, number | string | null> = {
        month: point.month,
        baseline_usd: point.baseline_usd,
        escenario_actual: point.scenario_usd,
      };
      selectedCompareScenarios.forEach((scenario) => {
        row[`sc_${scenario.id}`] = scenarioCompareTrends[scenario.id]?.[idx]?.scenario_usd ?? null;
      });
      return row;
    });
  }, [scenarioCompareTrends, selectedCompareScenarios, trendPoints]);

  const compareColors = ["#7c3aed", "#be123c", "#0f766e", "#ea580c"];

  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-6 md:px-8">
      <section className="panel p-5 md:p-6">
        <p className="section-kicker">TwinMill - Vista Integral</p>
        <h1 className="section-title font-display text-3xl md:text-5xl">Flujo de Trigo a Harina con KPIs de Margen</h1>
        <p className="section-copy ops-copy mt-2 max-w-4xl text-sm text-slate-600">
          Vista dinamica del proceso completo desde silo hasta cliente final, con indicadores clave de proceso, servicio y rentabilidad en una sola pantalla.
        </p>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-5">
        <article className="panel p-5 lg:col-span-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-slate-800">Diagrama de proceso twinMill</h2>
            <p className="text-xs text-slate-500">Selecciona una etapa para ver su impacto</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <svg viewBox="0 0 1160 250" className="h-[220px] w-full">
              <defs>
                <marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
              </defs>

              {stageData.map((stage, index) => {
                const x = 24 + index * 186;
                const active = selected === stage.key;
                return (
                  <g key={stage.key} onClick={() => setSelected(stage.key)} style={{ cursor: "pointer" }}>
                    <rect
                      x={x}
                      y="40"
                      rx="16"
                      width="164"
                      height="142"
                      fill={active ? "#eff6ff" : "#ffffff"}
                      stroke={active ? "#1e3a8a" : "#cbd5e1"}
                      strokeWidth={active ? 2.4 : 1.6}
                    />
                    <text x={x + 82} y="78" textAnchor="middle" fontSize="14" fontWeight="700" fill="#334155">
                      {stage.short}
                    </text>
                    <text x={x + 82} y="108" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1e3a8a">
                      {stage.value}
                    </text>
                    <text x={x + 82} y="132" textAnchor="middle" fontSize="11" fill="#64748b">
                      {stage.status === "ok" ? "Estable" : stage.status === "warn" ? "Atencion" : "Riesgo"}
                    </text>
                    <circle cx={x + 82} cy="155" r="6" fill={stage.status === "ok" ? "#10b981" : stage.status === "warn" ? "#f59e0b" : "#f43f5e"} />
                  </g>
                );
              })}

              {stageData.slice(0, -1).map((stage, index) => {
                const x1 = 24 + index * 186 + 164;
                const x2 = 24 + (index + 1) * 186;
                return (
                  <line
                    key={`line-${stage.key}`}
                    x1={x1 + 6}
                    y1="111"
                    x2={x2 - 10}
                    y2="111"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    markerEnd="url(#arrowHead)"
                  />
                );
              })}
            </svg>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Etapa</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Métrica clave</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {stageData.map((stage) => (
                  <tr
                    key={stage.key}
                    onClick={() => setSelected(stage.key)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${selected === stage.key ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{stage.label}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${
                        stage.status === "ok"
                          ? "bg-emerald-50 text-emerald-700"
                          : stage.status === "warn"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-rose-50 text-rose-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          stage.status === "ok" ? "bg-emerald-500" : stage.status === "warn" ? "bg-amber-500" : "bg-rose-500"
                        }`} />
                        {stage.status === "ok" ? "Estable" : stage.status === "warn" ? "Atención" : "Riesgo"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-700">{stage.value}</td>
                    <td className="px-3 py-2.5 text-slate-500 max-w-xs">{stage.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="panel p-4 md:p-5 flex flex-col gap-4">
          {/* Stage info */}
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Etapa seleccionada</p>
            <h3 className="mt-1 font-display text-lg text-slate-800 leading-tight">{selectedStage.label}</h3>
            <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(selectedStage.status)}`}>
              {selectedStage.status === "ok" ? "Estable" : selectedStage.status === "warn" ? "Atención" : "Riesgo"}
            </span>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">{selectedStage.detail}</p>
          </div>

          {/* Quick financial inputs */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">Variables clave</p>
            <div className="flex flex-col gap-2">
              {([
                { key: "wheatPriceUsdTon" as keyof EconomicInputs, label: "Trigo (USD/t)", icon: "🌾" },
                { key: "flourPriceUsdTon"  as keyof EconomicInputs, label: "Harina (USD/t)", icon: "🍞" },
                { key: "byproductPriceUsdTon" as keyof EconomicInputs, label: "Afrecho (USD/t)", icon: "🌿" },
                { key: "flourExtractionPct" as keyof EconomicInputs, label: "Extracción (%)", icon: "⚙️" },
                { key: "capacityTonDay"    as keyof EconomicInputs, label: "Capacidad (t/d)", icon: "🏭" },
                { key: "operationalAvailabilityPct" as keyof EconomicInputs, label: "Disponibilidad (%)", icon: "⏱️" },
              ] as Array<{ key: keyof EconomicInputs; label: string; icon: string }>).map((field) => (
                <label key={field.key} className="flex items-center gap-2">
                  <span className="text-base shrink-0">{field.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.65rem] text-slate-500 block">{field.label}</span>
                    <input
                      type="number"
                      step={field.key.includes("Pct") || field.key.includes("pct") ? 0.1 : 1}
                      value={economicInput[field.key]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setEconomicInput((prev) => ({
                          ...prev,
                          [field.key]: v,
                          ...(linkWheatMoistures && field.key === "wheatMoistureReceptionPct" ? { wheatMoistureInputPct: v } : {}),
                          ...(linkWheatMoistures && field.key === "wheatMoistureInputPct" ? { wheatMoistureReceptionPct: v } : {}),
                        }));
                      }}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Live financial KPIs */}
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">Contribución bruta anual</p>
              <p className={`mt-0.5 text-2xl font-black leading-none ${
                scenarioResult.annualContributionUsd >= baselineResult.annualContributionUsd ? "text-emerald-700" : "text-rose-600"
              }`}>
                {formatUsd(scenarioResult.annualContributionUsd)}
              </p>
              {Math.abs(annualDeltaUsd) > 0 && (
                <p className={`text-[0.7rem] font-semibold mt-0.5 ${
                  annualDeltaUsd >= 0 ? "text-emerald-600" : "text-rose-500"
                }`}>
                  {annualDeltaUsd >= 0 ? "+ " : ""}{formatUsd(annualDeltaUsd)} vs base
                </p>
              )}
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-blue-700">Margen variable</p>
              <p className="mt-0.5 text-2xl font-black text-blue-700">{scenarioResult.marginPct.toFixed(1)}%</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-[0.62rem] text-slate-400 font-semibold uppercase tracking-wide">Ingreso bruto</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{formatUsd(scenarioResult.revenueUsd)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-[0.62rem] text-slate-400 font-semibold uppercase tracking-wide">Costo variable</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{formatUsd(scenarioResult.variableCostUsd)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-[0.62rem] text-slate-400 font-semibold uppercase tracking-wide">USD / t trigo</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{scenarioResult.contributionPerTon.toFixed(1)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-[0.62rem] text-slate-400 font-semibold uppercase tracking-wide">Harina anual</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{Math.round(scenarioResult.saleableFlourTon).toLocaleString()} t</p>
              </div>
              <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[0.62rem] text-amber-700 font-semibold uppercase tracking-wide">🌿 Ingreso afrecho/salvado anual</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <p className="text-sm font-bold text-amber-800">{formatUsd(Math.round(scenarioResult.byproductTon * economicInput.byproductPriceUsdTon))}</p>
                  <p className="text-[0.6rem] text-amber-600">{Math.round(scenarioResult.byproductTon).toLocaleString()} t × {formatUsd(economicInput.byproductPriceUsdTon)}/t</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-12">
        <article className="panel p-5 xl:col-span-7 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Twinmill Economico</p>
              <h2 className="font-display text-2xl text-slate-800">Simulador anual de ganancia o perdida</h2>
            </div>
            <button
              type="button"
              onClick={() => setEconomicInput(economicBaseInput)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Restaurar base
            </button>
          </div>

          <p className="ops-copy mt-2 text-sm text-slate-600">
            Ajusta variables del analisis economico para estimar rentabilidad de costos variables y visualizar impacto individual por variable.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset("optimista")}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
            >
              Preset optimista
            </button>
            <button
              type="button"
              onClick={() => applyPreset("pesimista")}
              className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
            >
              Preset pesimista
            </button>
          </div>
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={linkWheatMoistures}
              onChange={(event) => setLinkWheatMoistures(event.target.checked)}
            />
            Vincular humedad trigo recepcion con humedad trigo entrada
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Linea base cargada desde capturas reales: {Object.values(sourceCounts).reduce((acc, value) => acc + value, 0)} valores detectados.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setBaselineWindowDays(0);
                loadBaseline(0);
              }}
              className={`capture-tab ${baselineWindowDays === 0 ? "capture-tab-active" : "capture-tab-inactive"}`}
            >
              Todo el historico
            </button>
            <button
              type="button"
              onClick={() => {
                setBaselineWindowDays(30);
                loadBaseline(30);
              }}
              className={`capture-tab ${baselineWindowDays === 30 ? "capture-tab-active" : "capture-tab-inactive"}`}
            >
              Ultimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => {
                setBaselineWindowDays(7);
                loadBaseline(7);
              }}
              className={`capture-tab ${baselineWindowDays === 7 ? "capture-tab-active" : "capture-tab-inactive"}`}
            >
              Ultimos 7 dias
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {variableFieldOrder.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-medium text-slate-600">{field.label}</span>
                <input
                  type="number"
                  step={field.step ?? 1}
                  value={economicInput[field.key]}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    setEconomicInput((prev) => {
                      const safeValue = Number.isFinite(parsed) ? parsed : 0;
                      const next: EconomicInputs = { ...prev, [field.key]: safeValue };
                      if (linkWheatMoistures) {
                        if (field.key === "wheatMoistureReceptionPct") {
                          next.wheatMoistureInputPct = safeValue;
                        }
                        if (field.key === "wheatMoistureInputPct") {
                          next.wheatMoistureReceptionPct = safeValue;
                        }
                      }
                      return next;
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-500">Rentabilidad base</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{formatUsd(baselineResult.annualContributionUsd)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-500">Rentabilidad escenario</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{formatUsd(scenarioResult.annualContributionUsd)}</p>
            </div>
            <div className={`rounded-lg border p-3 ${annualDeltaUsd >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-500">Ganancia o perdida anual</p>
              <p className={`mt-1 text-xl font-bold ${annualDeltaUsd >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {annualDeltaUsd >= 0 ? "+" : ""}
                {formatUsd(annualDeltaUsd)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Grafico de impacto por variable (vs base)</p>
            <div className="mt-3 space-y-2">
              {sensitivity.map((item) => {
                const width = `${Math.max((Math.abs(item.deltaUsd) / maxAbsDelta) * 100, 2)}%`;
                const isPositive = item.deltaUsd >= 0;
                return (
                  <div key={item.key} className="grid gap-2 md:grid-cols-[220px,1fr,130px] md:items-center">
                    <p className="text-xs text-slate-600">{item.label}</p>
                    <div className="h-3 w-full rounded-full bg-slate-200">
                      <div className={`h-3 rounded-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width }} />
                    </div>
                    <p className={`text-right text-xs font-semibold ${isPositive ? "text-emerald-700" : "text-rose-700"}`}>
                      {isPositive ? "+" : ""}
                      {formatUsd(item.deltaUsd)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">Tendencia mensual: base vs escenario</p>
            <div className="mt-2 flex items-center gap-3">
              <label className="text-xs text-slate-600">Meses</label>
              <select
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                value={trendMonths}
                onChange={(event) => setTrendMonths(Number(event.target.value))}
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={18}>18</option>
                <option value={24}>24</option>
              </select>
            </div>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe3ef" />
                  <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                    }}
                  />
                  <Line type="monotone" dataKey="baseline_usd" name="Base" stroke="#1e3a8a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="escenario_actual" name="Escenario actual" stroke="#0f766e" strokeWidth={2} dot={false} />
                  {selectedCompareScenarios.map((scenario, idx) => (
                    <Line
                      key={scenario.id}
                      type="monotone"
                      dataKey={`sc_${scenario.id}`}
                      name={scenario.name}
                      stroke={compareColors[idx % compareColors.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">Escenarios guardados</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={scenarioName}
                onChange={(event) => setScenarioName(event.target.value)}
                placeholder="Nombre del escenario"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  createEconomicScenario({
                    name: scenarioName,
                    notes: scenarioNotes,
                    variables: toBackendVariables(economicInput),
                  })
                    .then((saved) => {
                      setSavedScenarios((previous) => [saved, ...previous]);
                      setScenarioName(`Escenario ${new Date().toISOString().slice(0, 10)}`);
                    })
                    .catch(() => undefined);
                }}
              >
                Guardar escenario
              </button>
              <textarea
                value={scenarioNotes}
                onChange={(event) => setScenarioNotes(event.target.value)}
                placeholder="Notas: supuesto clave, riesgo, accion"
                className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={2}
              />
            </div>

            <div className="mt-3 max-h-56 space-y-2 overflow-auto">
              {savedScenarios.map((scenario) => (
                <div key={scenario.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{scenario.name}</p>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={compareScenarioIds.includes(scenario.id)}
                          onChange={(event) => {
                            setCompareScenarioIds((previous) => {
                              if (event.target.checked) {
                                return [...previous.filter((id) => id !== scenario.id), scenario.id].slice(-4);
                              }
                              return previous.filter((id) => id !== scenario.id);
                            });
                          }}
                        />
                        Comparar
                      </label>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        onClick={() => setEconomicInput(fromBackendVariables(scenario.variables))}
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{scenario.notes || "Sin notas"}</p>
                  <p className={`mt-1 text-xs font-semibold ${scenario.delta_vs_baseline_usd >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    Delta vs base: {scenario.delta_vs_baseline_usd >= 0 ? "+" : ""}
                    {formatUsd(scenario.delta_vs_baseline_usd)}
                  </p>
                </div>
              ))}
              {savedScenarios.length === 0 ? <p className="text-xs text-slate-500">Aun no hay escenarios guardados.</p> : null}
            </div>
          </div>
        </article>

        <aside className="panel p-5 xl:col-span-5 md:p-6">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Gobierno de datos</p>
          <h3 className="mt-2 font-display text-xl text-slate-800">Donde capturar cada variable</h3>
          <p className="mt-2 text-sm text-slate-600">
            Esta matriz valida donde registrar la informacion operativa para alimentar el modelo economico en Twinmill.
          </p>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Variable</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Menu</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Formulario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {captureSourceMap.map((row) => (
                  <tr key={row.variable}>
                    <td className="px-3 py-2 text-slate-700">{row.variable}</td>
                    <td className="px-3 py-2 text-slate-600">{row.where}</td>
                    <td className="px-3 py-2 text-slate-600">{row.field}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.15em] text-slate-500">Trigo procesado</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{scenarioResult.processedWheatTon.toFixed(0)} ton/anual</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.15em] text-slate-500">Harina vendible</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{scenarioResult.saleableFlourTon.toFixed(0)} ton/anual</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.15em] text-slate-500">Subproducto</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{scenarioResult.byproductTon.toFixed(0)} ton/anual</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.15em] text-slate-500">Costo variable anual</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{formatUsd(scenarioResult.variableCostUsd)}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
