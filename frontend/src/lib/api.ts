function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";
  const isLoopbackHost = (hostname: string): boolean => hostname === "localhost" || hostname === "127.0.0.1";

  if (typeof window === "undefined") {
    return configured.startsWith("/") ? `http://localhost:8000${configured}` : configured;
  }

  if (/^https?:\/\//i.test(configured)) {
    return configured;
  }

  // Local dev runs frontend on :3000 or :3010 and backend on :8000 without reverse proxy.
  if (
    isLoopbackHost(window.location.hostname) &&
    configured.startsWith("/") &&
    (window.location.port === "3000" || window.location.port === "3010")
  ) {
    return `http://${window.location.hostname}:8000${configured}`;
  }

  return `${window.location.origin}${configured}`;
}


const API_BASE = resolveApiBase().replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 15000;

export type DashboardBundle = {
  kpis: {
    production: { oee: number; extraction_rate: number };
    quality: { spec_compliance: number };
    financial: { cost_per_ton: number; profit_forecast: number };
  };
  forecast: { demand_curves: Array<{ month: string; forecast_tons: number; ci_low: number; ci_high: number }> };
  quality: Record<string, unknown>;
  customers: Record<string, unknown>;
  disruptions: { failure_probability: number };
  recommendations: Array<{ title: string; severity: string; recommendation: string; impact_area: string }>;
  maturity: { overall_score: number };
  optimizer: {
    what_to_produce: string;
    when_to_produce: string;
    what_to_blend: string;
    which_customers_to_prioritize: string[];
    expected_profit: number;
  };
};

export type WhatIfResult = {
  revenue_impact: number;
  inventory_impact_tons: number;
  service_level_impact: number;
  simulated: { stages: Array<{ stage: string; input_tons: number; output_tons: number; efficiency: number; risk_index: number }> };
};

export type GrainCapturePayload = {
  receipt_date: string;
  grain_code: string;
  variety_id: string;
  farmer_id: string;
  grain_warehouse_id: string;
  reception_batch: string;
  milling_batch: string;
  production_batch: string;
  lab_humidity: number;
  lab_protein: number;
  lab_impurities: number;
  flour_warehouse_id: string;
  flour_type_id: string;
  packed_product_id: string;
  package_unit_id: string;
  site_id: string;
  customer_id: string;
  notes: string;
};

export type CatalogItem = { id: string; label: string };

export type GrainCatalogs = {
  grain_varieties: CatalogItem[];
  grain_warehouses: CatalogItem[];
  flour_warehouses: CatalogItem[];
  flour_types: CatalogItem[];
  flour_lines: CatalogItem[];
  packed_products: CatalogItem[];
  packaging_units: CatalogItem[];
  sites: CatalogItem[];
  customers: CatalogItem[];
  customer_types: CatalogItem[];
  farmers: CatalogItem[];
};

export type GrainCatalogKey = keyof GrainCatalogs;

export type GrainReception = {
  id: string;
  receipt_batch: string;
  receipt_date?: string;
  shift_turn?: string;
  grain_code: string;
  wheat_lot_code?: string;
  variety_id: string;
  farmer_id: string;
  grain_warehouse_id: string;
  preclean_wheat_type_id?: string;
  preclean_humidity_pct?: number | null;
  preclean_impurity_pct?: number | null;
  preclean_test_weight_kg_hl?: number | null;
  lab_humidity: number;
  lab_protein: number;
  lab_impurities?: number;
  defect_white_belly_pct?: number | null;
  test_weight_kg_hl?: number | null;
  wet_gluten_pct?: number | null;
  ash_pct?: number | null;
  falling_number_sec?: number | null;
  damaged_broken_pct?: number | null;
  tons_received: number;
  created_at?: string;
};

export type MillingRun = {
  id: string;
  milling_batch: string;
  flour_lot: string;
  flour_output_tons: number;
  created_at?: string;
};

export type PackagingRun = {
  id: string;
  packaging_batch: string;
  packed_output_tons: number;
  flour_output_tons: number;
  weight_balance_delta_tons: number;
  weight_balance_delta_pct: number;
  created_at?: string;
};

export type SaleRun = {
  id: string;
  sale_batch: string;
  customer_id: string;
  site_id: string;
  sold_tons: number;
  net_revenue: number;
  estimated_margin: number;
  estimated_margin_pct: number;
  complaint_risk_index: number;
  created_at?: string;
};

export type CausalKpis = {
  average_humidity: number;
  average_protein: number;
  traceability_completion_pct: number;
  weight_balance_alerts: number;
  average_margin_pct: number;
  high_risk_sales: number;
  margin_projection_with_discounts: number;
};

export type OpsCapture = {
  id: string;
  module_key: string;
  process_key: string;
  natural_label: string;
  capture_date: string;
  reference: string;
  fields: Record<string, string>;
  created_at?: string;
};

export type EconomicBaseline = {
  wheat_price_usd_ton: number;
  flour_price_usd_ton: number;
  byproduct_price_usd_ton: number;
  energy_usd_ton_wheat: number;
  wheat_moisture_reception_pct: number;
  capacity_ton_day: number;
  labor_days_year: number;
  flour_moisture_pct: number;
  packaging_efficiency_pct: number;
  operational_availability_pct: number;
  nominal_capacity_pct: number;
  impurity_input_pct: number;
  flour_extraction_pct: number;
  wheat_moisture_input_pct: number;
  source_counts: Record<string, number>;
  window_days?: number;
};

export type EconomicScenario = {
  id: string;
  name: string;
  notes: string;
  variables: Record<string, number>;
  annual_contribution_usd: number;
  delta_vs_baseline_usd: number;
  created_at?: string;
};

export type EconomicTrend = {
  points: Array<{ month: string; baseline_usd: number; scenario_usd: number }>;
};

export type AIInsights = {
  window_months: number;
  summary: {
    records: {
      receptions: number;
      milling_runs: number;
      sales: number;
      ops_captures: number;
    };
    active_customers: number;
    high_risk_sales: number;
    avg_margin_pct: number;
    avg_spec_compliance: number;
    revenue_window: number;
  };
  series: {
    production: Array<{ month: string; tons_received: number; tons_milled: number; tons_sold: number }>;
    sales: Array<{ month: string; revenue: number }>;
    quality: Array<{ month: string; spec_compliance: number }>;
  };
  process_health: Array<{ process_key: string; records: number; anomaly_rate: number }>;
  algorithm_pipeline: Array<{ name: string; objective: string; status: string; score: number }>;
  model_lab: {
    quality_random_forest: {
      model: string;
      metrics: { accuracy: number; roc_auc: number };
      feature_importance: Array<{ feature: string; importance: number }>;
      risk_distribution: Array<{ bucket: string; count: number }>;
      explanation: { purpose: string; why: string; variables: string[] };
    };
    margin_random_forest: {
      model: string;
      metrics: { r2: number; mae: number };
      feature_importance: Array<{ feature: string; importance: number }>;
      prediction_samples: Array<{ sample: string; actual: number; predicted: number }>;
      explanation: { purpose: string; why: string; variables: string[] };
    };
    sales_risk_random_forest: {
      model: string;
      metrics: { accuracy: number; roc_auc: number };
      feature_importance: Array<{ feature: string; importance: number }>;
      explanation: { purpose: string; why: string; variables: string[] };
    };
  };
  recommended_algorithms: Array<{
    algorithm: string;
    why: string;
    purpose: string;
    variables: string[];
  }>;
};

export type TwinProcessStage = {
  name: string;
  inputs: string[];
  outputs: string[];
  critical_variables: string[];
  equipment: string[];
  operational_risks: string[];
};

export type TwinSensorSpec = {
  process: string;
  variable: string;
  sensor_type: string;
  source: string;
  frequency_seconds: number;
};

export type TwinKpiSpec = {
  name: string;
  category: string;
  formula: string;
  unit: string;
  target: string;
};

export type TwinEquation = {
  name: string;
  expression: string;
  description: string;
};

export type TwinBlueprint = {
  process_stages: TwinProcessStage[];
  sensors: TwinSensorSpec[];
  data_core: {
    capture_frequencies: Record<string, string>;
    time_series_structure: Record<string, string>;
    integration_sources: string[];
  };
  kpis: TwinKpiSpec[];
  twin_model: {
    physical_model: string[];
    mathematical_model: string[];
    data_model: string[];
    predictive_model: string[];
    capabilities: string[];
  };
  equations: TwinEquation[];
};

export type PhysicalModelInput = {
  wheat_input_tons: number;
  wheat_moisture_pct: number;
  tempering_target_pct: number;
  roller_speed_rpm: number;
  grinding_pressure_bar: number;
  sifter_efficiency_pct: number;
  purifier_efficiency_pct: number;
  extraction_target_pct: number;
  specific_energy_kwh_ton: number;
  planned_time_minutes: number;
  downtime_minutes: number;
  quality_protein_pct: number;
  quality_ash_pct: number;
};

export type PhysicalModelOutput = {
  stage_balance: Array<{
    stage: string;
    input_tons: number;
    output_tons: number;
    losses_tons: number;
  }>;
  kpis: Record<string, number>;
  alerts: string[];
};

export type AILabScenarioPayload = {
  start_date: string;
  end_date: string;
  algorithm: string;
  forecast_growth_pct: number;
  price_adjustment_pct: number;
  cost_increase_pct: number;
  quality_failure_pct: number;
};

export type AILabScenarioResult = {
  meta: {
    start_date: string;
    end_date: string;
    months: number;
    algorithm: string;
    algorithm_impact?: {
      forecast_power: number;
      risk_sensitivity: number;
      price_elasticity: number;
      quality_resilience: number;
    };
  };
  projection: {
    projected_revenue: number;
    projected_cost: number;
    projected_margin: number;
    projected_margin_pct: number;
    benefited_customers: number;
    affected_customers: number;
  };
  forecast_series: Array<{ month: string; baseline: number; forecast: number; scenario: number }>;
  customer_segments: Array<{ segment: string; customers: number; avg_margin: number; churn_risk: number }>;
  quality_impact: Array<{ product: string; clients_affected: number; risk_level: string; action: string }>;
  sentiment: {
    summary: { total_complaints: number; resolved: number; escalated: number; pending: number };
    confusion: { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; f1: number };
    quadrants: Array<{ product: string; emotion: string; x: number; y: number; complaints: number; risk: string }>;
    attribution: {
      totals: { price: number; service: number; quality: number };
      by_product: Array<{ product: string; price: number; service: number; quality: number; dominant_driver: string }>;
    };
    insights: string[];
  };
};

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const signal = init?.signal ?? controller.signal;
  const timeoutId = init?.signal ? null : setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.message.includes("fetch"))) {
      throw new Error("No se pudo conectar con el backend. Verifica que este corriendo en http://localhost:8000");
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

const fallbackBundle: DashboardBundle = {
  kpis: {
    production: { oee: 0.86, extraction_rate: 0.75 },
    quality: { spec_compliance: 0.93 },
    financial: { cost_per_ton: 319.5, profit_forecast: 1280000 },
  },
  forecast: {
    demand_curves: [
      { month: "2026-04", forecast_tons: 468, ci_low: 435, ci_high: 501 },
      { month: "2026-05", forecast_tons: 482, ci_low: 450, ci_high: 516 },
      { month: "2026-06", forecast_tons: 495, ci_low: 461, ci_high: 530 },
      { month: "2026-07", forecast_tons: 503, ci_low: 470, ci_high: 538 },
    ],
  },
  quality: { quality_deviation_probability: 0.19 },
  customers: { churn_prediction: { probability: 0.31 } },
  disruptions: { failure_probability: 0.18 },
  recommendations: [
    {
      title: "Ajuste de mezcla",
      severity: "alta",
      impact_area: "calidad",
      recommendation: "Se recomienda mezclar el Lote A con el Lote C para reducir la variabilidad de proteina.",
    },
    {
      title: "Riesgo de inventario",
      severity: "media",
      impact_area: "inventario",
      recommendation: "Se detecta riesgo de inventario en 14 dias. Incrementa el inventario de seguridad en 12%.",
    },
  ],
  maturity: { overall_score: 77.3 },
  optimizer: {
    what_to_produce: "Premium Bread Flour + Standard Flour blend portfolio",
    when_to_produce: "Increase production in week 2 and week 4 based on forecast peaks",
    what_to_blend: "Use high-protein ratio at 0.50",
    which_customers_to_prioritize: ["CUST-ALFA", "CUST-OMEGA", "CUST-NORTE"],
    expected_profit: 102400,
  },
};

const fallbackWhatIf: WhatIfResult = {
  revenue_impact: 38450,
  inventory_impact_tons: -18,
  service_level_impact: 0.96,
  simulated: {
    stages: [
      { stage: "Recepcion", input_tons: 520, output_tons: 517, efficiency: 0.995, risk_index: 0.03 },
      { stage: "Limpieza", input_tons: 517, output_tons: 507, efficiency: 0.98, risk_index: 0.05 },
      { stage: "Molienda", input_tons: 507, output_tons: 476, efficiency: 0.94, risk_index: 0.08 },
      { stage: "Cernido", input_tons: 476, output_tons: 459, efficiency: 0.965, risk_index: 0.06 },
      { stage: "Mezcla", input_tons: 459, output_tons: 452, efficiency: 0.985, risk_index: 0.04 },
      { stage: "Empaque", input_tons: 452, output_tons: 448, efficiency: 0.992, risk_index: 0.03 },
      { stage: "Almacen", input_tons: 448, output_tons: 447, efficiency: 0.998, risk_index: 0.02 },
      { stage: "Despacho", input_tons: 447, output_tons: 446, efficiency: 0.997, risk_index: 0.03 },
    ],
  },
};

const fallbackAIInsights: AIInsights = {
  window_months: 3,
  summary: {
    records: {
      receptions: 1000,
      milling_runs: 1000,
      sales: 1000,
      ops_captures: 1000,
    },
    active_customers: 40,
    high_risk_sales: 112,
    avg_margin_pct: 14.8,
    avg_spec_compliance: 0.92,
    revenue_window: 12500000,
  },
  series: {
    production: [
      { month: "2026-01", tons_received: 8210, tons_milled: 6122, tons_sold: 5483 },
      { month: "2026-02", tons_received: 7985, tons_milled: 6038, tons_sold: 5561 },
      { month: "2026-03", tons_received: 8440, tons_milled: 6298, tons_sold: 5719 },
    ],
    sales: [
      { month: "2026-01", revenue: 3970000 },
      { month: "2026-02", revenue: 4125000 },
      { month: "2026-03", revenue: 4405000 },
    ],
    quality: [
      { month: "2026-01", spec_compliance: 0.91 },
      { month: "2026-02", spec_compliance: 0.92 },
      { month: "2026-03", spec_compliance: 0.93 },
    ],
  },
  process_health: [
    { process_key: "pedido-venta", records: 220, anomaly_rate: 0.18 },
    { process_key: "corrida-empaque", records: 198, anomaly_rate: 0.11 },
    { process_key: "molienda-harina-lab", records: 176, anomaly_rate: 0.09 },
    { process_key: "control-calidad-tolvas", records: 143, anomaly_rate: 0.14 },
  ],
  algorithm_pipeline: [
    { name: "Forecast Booster", objective: "Forecast de demanda mensual", status: "running", score: 0.91 },
    { name: "Quality Drift Monitor", objective: "Deteccion de deriva de calidad", status: "running", score: 0.89 },
    { name: "Margin Risk Classifier", objective: "Riesgo de margen por venta", status: "running", score: 0.9 },
  ],
  model_lab: {
    quality_random_forest: {
      model: "RandomForestClassifier",
      metrics: { accuracy: 0.89, roc_auc: 0.93 },
      feature_importance: [
        { feature: "Humedad", importance: 0.34 },
        { feature: "Impurezas", importance: 0.27 },
        { feature: "Proteina", importance: 0.24 },
        { feature: "Toneladas recibidas", importance: 0.15 },
      ],
      risk_distribution: [
        { bucket: "0-20%", count: 18 },
        { bucket: "20-40%", count: 36 },
        { bucket: "40-60%", count: 29 },
        { bucket: "60-80%", count: 12 },
        { bucket: "80-100%", count: 5 },
      ],
      explanation: {
        purpose: "Estima probabilidad de desviacion de calidad por lote.",
        why: "Es robusto ante ruido y permite entender variables mas influyentes.",
        variables: ["Humedad", "Proteina", "Impurezas", "Toneladas recibidas"],
      },
    },
    margin_random_forest: {
      model: "RandomForestRegressor",
      metrics: { r2: 0.82, mae: 1.91 },
      feature_importance: [
        { feature: "Ingreso neto", importance: 0.47 },
        { feature: "Indice de riesgo", importance: 0.29 },
        { feature: "Toneladas vendidas", importance: 0.24 },
      ],
      prediction_samples: [
        { sample: "M-01", actual: 15.4, predicted: 14.9 },
        { sample: "M-02", actual: 12.7, predicted: 13.4 },
        { sample: "M-03", actual: 18.2, predicted: 17.5 },
        { sample: "M-04", actual: 10.1, predicted: 10.8 },
        { sample: "M-05", actual: 16.3, predicted: 15.9 },
      ],
      explanation: {
        purpose: "Pronostica margen por venta para priorizacion comercial.",
        why: "Captura interacciones no lineales entre precio, volumen y riesgo.",
        variables: ["Toneladas vendidas", "Ingreso neto", "Indice de riesgo"],
      },
    },
    sales_risk_random_forest: {
      model: "RandomForestClassifier",
      metrics: { accuracy: 0.86, roc_auc: 0.9 },
      feature_importance: [
        { feature: "Margen estimado", importance: 0.4 },
        { feature: "Ingreso neto", importance: 0.35 },
        { feature: "Toneladas vendidas", importance: 0.25 },
      ],
      explanation: {
        purpose: "Detecta ventas con alto riesgo de reclamacion y erosión de margen.",
        why: "Permite priorizar visitas tecnicas y acciones preventivas.",
        variables: ["Toneladas vendidas", "Ingreso neto", "Margen estimado"],
      },
    },
  },
  recommended_algorithms: [
    {
      algorithm: "Random Forest Classifier",
      why: "Excelente en datos tabulares con ruido operativo.",
      purpose: "Clasificar lotes fuera de especificacion.",
      variables: ["Humedad", "Proteina", "Impurezas", "Toneladas recibidas"],
    },
    {
      algorithm: "Random Forest Regressor",
      why: "Modela no linealidad en drivers de margen.",
      purpose: "Predecir margen por venta.",
      variables: ["Toneladas vendidas", "Ingreso neto", "Riesgo"],
    },
    {
      algorithm: "XGBoost Time Series",
      why: "Alta precision para demanda con estacionalidad.",
      purpose: "Forecast de demanda y plan de molienda.",
      variables: ["Historico ventas", "Precio", "Mix cliente", "Capacidad"],
    },
    {
      algorithm: "Isolation Forest",
      why: "Sin etiquetas para detectar anomalias multivariadas.",
      purpose: "Deteccion temprana de desviaciones en proceso.",
      variables: ["Extraccion", "Merma", "Energia", "Paros"],
    },
  ],
};

const fallbackAILabScenario: AILabScenarioResult = {
  meta: {
    start_date: "2026-01-01",
    end_date: "2026-06-01",
    months: 6,
    algorithm: "RandomForest + XGBoost",
    algorithm_impact: {
      forecast_power: 1.12,
      risk_sensitivity: 1.08,
      price_elasticity: 1,
      quality_resilience: 1.02,
    },
  },
  projection: {
    projected_revenue: 26125000,
    projected_cost: 21470000,
    projected_margin: 4655000,
    projected_margin_pct: 17.82,
    benefited_customers: 25,
    affected_customers: 11,
  },
  forecast_series: [
    { month: "2026-01", baseline: 3970000, forecast: 4050000, scenario: 4145000 },
    { month: "2026-02", baseline: 4125000, forecast: 4250000, scenario: 4362000 },
    { month: "2026-03", baseline: 4405000, forecast: 4512000, scenario: 4621000 },
    { month: "2026-04", baseline: 4201000, forecast: 4386000, scenario: 4462000 },
    { month: "2026-05", baseline: 4310000, forecast: 4528000, scenario: 4639000 },
    { month: "2026-06", baseline: 4468000, forecast: 4700000, scenario: 4794000 },
  ],
  customer_segments: [
    { segment: "Oro", customers: 11, avg_margin: 22.1, churn_risk: 0.08 },
    { segment: "Plata", customers: 17, avg_margin: 16.4, churn_risk: 0.14 },
    { segment: "Bronce", customers: 12, avg_margin: 10.7, churn_risk: 0.24 },
  ],
  quality_impact: [
    { product: "prod-25kg", clients_affected: 6, risk_level: "alto", action: "Aislar lotes y activar visita tecnica" },
    { product: "prod-10kg", clients_affected: 3, risk_level: "medio", action: "Ajustar mezcla y reforzar control de laboratorio" },
    { product: "prod-1kg", clients_affected: 2, risk_level: "bajo", action: "Monitoreo preventivo de entrega y calidad" },
  ],
  sentiment: {
    summary: { total_complaints: 61, resolved: 45, escalated: 10, pending: 6 },
    confusion: { tp: 31, fp: 8, fn: 7, tn: 15, precision: 0.7949, recall: 0.8158, f1: 0.8052 },
    quadrants: [
      { product: "prod-25kg", emotion: "Frustracion", x: -0.62, y: 0.72, complaints: 31, risk: "alto" },
      { product: "prod-10kg", emotion: "Incertidumbre", x: -0.22, y: 0.44, complaints: 19, risk: "medio" },
      { product: "prod-1kg", emotion: "Confianza", x: 0.46, y: -0.24, complaints: 11, risk: "bajo" },
    ],
    attribution: {
      totals: { price: 19, service: 14, quality: 28 },
      by_product: [
        { product: "prod-25kg", price: 7, service: 9, quality: 18, dominant_driver: "quality" },
        { product: "prod-10kg", price: 8, service: 4, quality: 9, dominant_driver: "quality" },
        { product: "prod-1kg", price: 4, service: 1, quality: 1, dominant_driver: "price" },
      ],
    },
    insights: [
      "Productos en cuadrantes de alta intensidad negativa requieren contencion comercial en menos de 24 horas.",
      "El clasificador de sentimiento ayuda a priorizar reclamaciones con impacto economico.",
      "Cruzar esta vista con lotes trazables permite acciones de calidad por cliente y producto.",
    ],
  },
};

export async function getDashboardBundle(): Promise<DashboardBundle> {
  try {
    const [kpis, forecast, quality, customers, disruptions, recommendations, maturity, optimizer] =
      await Promise.all([
        fetchJSON<DashboardBundle["kpis"]>("/kpis/"),
        fetchJSON<DashboardBundle["forecast"]>("/analytics/forecast"),
        fetchJSON<DashboardBundle["quality"]>("/analytics/quality"),
        fetchJSON<DashboardBundle["customers"]>("/analytics/customers"),
        fetchJSON<DashboardBundle["disruptions"]>("/simulation/disruptions"),
        fetchJSON<DashboardBundle["recommendations"]>("/ai/recommendations"),
        fetchJSON<DashboardBundle["maturity"]>("/ai/maturity"),
        fetchJSON<DashboardBundle["optimizer"]>("/ai/profit-optimizer"),
      ]);

    return { kpis, forecast, quality, customers, disruptions, recommendations, maturity, optimizer };
  } catch (error) {
    console.error("Failed to fetch dashboard bundle", error);
    return fallbackBundle;
  }
}

export async function runWhatIf(payload: {
  wheat_input_tons: number;
  demand_index: number;
  capacity_factor: number;
  wheat_cost_per_ton: number;
  selling_price_per_ton: number;
}): Promise<WhatIfResult> {
  try {
    return await fetchJSON("/simulation/what-if", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to execute what-if simulation", error);
    return fallbackWhatIf;
  }
}

export async function askCopilot(question: string) {
  try {
    return await fetchJSON<{ answer: string; confidence: number }>("/ai/copilot", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  } catch (error) {
    console.error("Failed to fetch copilot answer", error);
    return {
      answer:
        "Modo local del copiloto: no hay conexion con backend. Es probable que el rendimiento este bajando por variabilidad de humedad y tendencia de paros en molienda.",
      confidence: 0.71,
    };
  }
}

export async function createGrainCapture(payload: GrainCapturePayload) {
  try {
    return await fetchJSON<{ id: string; status: string }>("/granos/capturas", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to create grain capture", error);
    return {
      id: `local-${Date.now()}`,
      status: "stored-locally",
    };
  }
}

export async function getGrainCatalogs(): Promise<GrainCatalogs> {
  return fetchJSON<GrainCatalogs>("/granos/catalogs");
}

export async function getCatalogItems(catalogKey: GrainCatalogKey): Promise<CatalogItem[]> {
  return fetchJSON<CatalogItem[]>(`/granos/catalogs/${catalogKey}`);
}

export async function saveCatalogItem(catalogKey: GrainCatalogKey, payload: CatalogItem): Promise<CatalogItem[]> {
  return fetchJSON<CatalogItem[]>(`/granos/catalogs/${catalogKey}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteCatalogItem(catalogKey: GrainCatalogKey, itemId: string): Promise<CatalogItem[]> {
  return fetchJSON<CatalogItem[]>(`/granos/catalogs/${catalogKey}/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}

export async function getGrainReceptions(): Promise<GrainReception[]> {
  return fetchJSON<GrainReception[]>("/granos/receptions");
}

export async function getMillingRuns(): Promise<MillingRun[]> {
  return fetchJSON<MillingRun[]>("/granos/milling-runs");
}

export async function getPackagingRuns(): Promise<PackagingRun[]> {
  return fetchJSON<PackagingRun[]>("/granos/packaging-runs");
}

export async function getGrainCausalKpis(): Promise<CausalKpis> {
  return fetchJSON<CausalKpis>("/granos/kpis-causal");
}

export async function getSalesRuns(): Promise<SaleRun[]> {
  return fetchJSON<SaleRun[]>("/granos/sales");
}

export async function createGrainReception(payload: {
  receipt_date: string;
  shift_turn?: string;
  grain_code: string;
  wheat_lot_code?: string;
  variety_id: string;
  farmer_id: string;
  grain_warehouse_id: string;
  preclean_wheat_type_id?: string;
  preclean_humidity_pct?: number;
  preclean_impurity_pct?: number;
  preclean_test_weight_kg_hl?: number;
  tons_received: number;
  lab_humidity: number;
  lab_protein: number;
  lab_impurities: number;
  defect_white_belly_pct?: number;
  test_weight_kg_hl?: number;
  wet_gluten_pct?: number;
  ash_pct?: number;
  falling_number_sec?: number;
  damaged_broken_pct?: number;
  notes: string;
}) {
  return fetchJSON<GrainReception>("/granos/receptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createMillingRun(payload: {
  reception_id: string;
  flour_type_id: string;
  flour_product_target_id: string;
  flour_line_id: string;
  extraction_target_pct: number;
  ingredient_tons: number;
  energy_cost: number;
  labor_cost: number;
  logistics_cost: number;
}) {
  return fetchJSON<MillingRun>("/granos/milling-runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createPackagingRun(payload: {
  milling_run_id: string;
  flour_warehouse_id: string;
  presentations: Array<{
    packed_product_id: string;
    package_unit_id: string;
    package_size_kg: number;
    units: number;
  }>;
}) {
  return fetchJSON<PackagingRun>("/granos/packaging-runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createOpsCapture(payload: {
  module_key: string;
  process_key: string;
  natural_label: string;
  capture_date: string;
  reference: string;
  fields: Record<string, string>;
}) {
  return fetchJSON<OpsCapture>("/granos/ops-captures", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getOpsCaptures(moduleKey?: string): Promise<OpsCapture[]> {
  const query = moduleKey ? `?module_key=${encodeURIComponent(moduleKey)}` : "";
  return fetchJSON<OpsCapture[]>(`/granos/ops-captures${query}`);
}

export async function getEconomicBaseline(windowDays = 0): Promise<EconomicBaseline> {
  const query = windowDays > 0 ? `?window_days=${windowDays}` : "";
  return fetchJSON<EconomicBaseline>(`/granos/economic-baseline${query}`);
}

export async function createEconomicScenario(payload: {
  name: string;
  notes: string;
  variables: Record<string, number>;
}): Promise<EconomicScenario> {
  return fetchJSON<EconomicScenario>("/granos/economic-scenarios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getEconomicScenarios(): Promise<EconomicScenario[]> {
  return fetchJSON<EconomicScenario[]>("/granos/economic-scenarios");
}

export async function getEconomicTrend(payload: {
  months: number;
  variables: Record<string, number>;
  window_days?: number;
}): Promise<EconomicTrend> {
  return fetchJSON<EconomicTrend>("/granos/economic-trend", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createSale(payload: {
  packaging_run_id: string;
  customer_id: string;
  customer_type_id: string;
  site_id: string;
  sale_price_per_ton: number;
  sold_tons: number;
  discount_pct: number;
  complaint_risk_index: number;
}) {
  return fetchJSON<{
    id: string;
    sale_batch: string;
    estimated_margin_pct: number;
    estimated_margin: number;
    net_revenue: number;
  }>("/granos/sales", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAIInsights(months = 3): Promise<AIInsights> {
  try {
    return await fetchJSON<AIInsights>(`/ai/insights?months=${encodeURIComponent(String(months))}`);
  } catch {
    return fallbackAIInsights;
  }
}

export async function runAILabScenario(payload: AILabScenarioPayload): Promise<AILabScenarioResult> {
  try {
    return await fetchJSON<AILabScenarioResult>("/ai/lab/run", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      ...fallbackAILabScenario,
      meta: {
        ...fallbackAILabScenario.meta,
        start_date: payload.start_date,
        end_date: payload.end_date,
        algorithm: payload.algorithm,
      },
    };
  }
}

export async function analyzeNotebookPrompt(prompt: string): Promise<{ cells: Array<Record<string, unknown>> }> {
  return fetchJSON<{ cells: Array<Record<string, unknown>> }>("/ai/notebook/analyze", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function getTwinBlueprint(): Promise<TwinBlueprint> {
  return fetchJSON<TwinBlueprint>("/twin/blueprint");
}

export async function runPhysicalTwinModel(payload: PhysicalModelInput): Promise<PhysicalModelOutput> {
  return fetchJSON<PhysicalModelOutput>("/twin/physical-model/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

