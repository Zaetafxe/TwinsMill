"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createOpsCapture, getGrainCatalogs, getOpsCaptures, type GrainCatalogKey, type GrainCatalogs } from "@/lib/api";
import { CATALOGS_UPDATED_EVENT, CATALOGS_UPDATED_TS_KEY } from "@/lib/catalog-events";
import { fallbackGrainCatalogs } from "@/lib/grain-catalogs";
import type { ModuleKey } from "@/lib/modules";

type OpsField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  catalogKey?: GrainCatalogKey;
  placeholder?: string;
};

type OpsArea = {
  key: string;
  naturalLabel: string;
  fields: OpsField[];
};

function getVisibleFields(area: OpsArea, captureMode: "rapida" | "completa"): OpsField[] {
  if (captureMode === "completa") {
    return area.fields;
  }

  const preferredKeys = ["lote", "codigo", "cliente", "producto", "volumen_ton", "entrada_ton", "salida_ton", "precio", "riesgo", "margen"];
  const prioritized = area.fields.filter((field) => preferredKeys.some((key) => field.key.includes(key)));
  const fallback = area.fields.filter((field) => !prioritized.some((item) => item.key === field.key)).slice(0, 3);
  return [...prioritized, ...fallback].slice(0, 6);
}

type OpsRecord = {
  id: string;
  processKey: string;
  naturalLabel: string;
  date: string;
  reference: string;
  summary: string;
};

const FLOW_CONTEXT_KEY = "twinsmill_flow_context_v1";

const fieldLabelOverrides: Record<string, string> = {
  precio_trigo_usd_ton: "Trigo USD/Tm",
  precio_harina_usd_ton: "Harina USD/Tm",
  precio_subproducto_usd_ton: "Subproducto USD/Tm",
  energia_usd_ton_trigo: "Energia USD/Tm trigo",
  lab_humidity: "Humedad lab (%)",
  lab_impurities: "Impurezas lab (%)",
  extraccion: "Extraccion (%)",
  capacidad_ton_dia: "Capacidad Tm/dia",
  disponibilidad_operativa: "Disponibilidad operativa (%)",
  capacidad_nominal_pct: "% capacidad nominal",
  dias_laborables_anuales: "Dias laborables anuales",
  humedad_harina: "Humedad harina (%)",
  eficiencia_envasado: "Eficiencia envasado (%)",
  riesgo: "Riesgo",
  margen: "Margen (%)",
  precio: "Precio",
};

function humanizeFieldKey(key: string, fieldLabelMap: Record<string, string>): string {
  if (fieldLabelMap[key]) return fieldLabelMap[key];
  if (fieldLabelOverrides[key]) return fieldLabelOverrides[key];
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildSummary(
  fields: Record<string, string>,
  fieldLabelMap: Record<string, string>,
  allowedKeys: Set<string> | null = null,
): string {
  const entries = Object.entries(fields)
    .filter(([key]) => (allowedKeys ? allowedKeys.has(key) : true))
    .filter(([, value]) => `${value ?? ""}`.trim().length > 0);

  if (entries.length === 0) {
    return "Sin datos relevantes para este proceso";
  }

  const preview = entries.slice(0, 8).map(([key, value]) => `${humanizeFieldKey(key, fieldLabelMap)}: ${value}`);
  const hidden = entries.length - preview.length;
  return hidden > 0 ? `${preview.join(" | ")} | +${hidden} campos` : preview.join(" | ");
}

function normalizeFlowKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function validateFieldValue(fieldKey: string, value: string): string | null {
  if (value.trim().length === 0) return null;

  const numericValue = Number(value);
  const hasNumber = !Number.isNaN(numericValue);
  const key = fieldKey.toLowerCase();

  if (key.includes("humedad") && hasNumber && (numericValue < 8 || numericValue > 18)) {
    return "Rango sugerido 8-18% para humedad.";
  }
  if (key.includes("proteina") && hasNumber && (numericValue < 8 || numericValue > 17)) {
    return "Rango sugerido 8-17% para proteina.";
  }
  if (key.includes("ceniza") && hasNumber && (numericValue < 0.2 || numericValue > 2.5)) {
    return "Rango sugerido 0.2-2.5% para cenizas.";
  }
  if ((key.includes("extraccion") || key.includes("eficiencia") || key.includes("disponibilidad")) && hasNumber && (numericValue < 0 || numericValue > 100)) {
    return "Valor esperado entre 0 y 100%.";
  }
  if (key.includes("riesgo") && hasNumber && (numericValue < 0 || numericValue > 1)) {
    return "Riesgo esperado entre 0 y 1.";
  }
  if (key.includes("descuento") && hasNumber && (numericValue < 0 || numericValue > 30)) {
    return "Descuento sugerido entre 0 y 30%.";
  }
  if (key.includes("temperatura") && hasNumber && (numericValue < 0 || numericValue > 60)) {
    return "Temperatura sugerida entre 0 y 60 C.";
  }
  if ((key.includes("entrada_ton") || key.includes("salida_ton") || key.includes("volumen_ton")) && hasNumber && numericValue <= 0) {
    return "Toneladas deben ser mayores a 0.";
  }

  return null;
}

function loadFlowContext(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FLOW_CONTEXT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { values?: Record<string, string> };
    return parsed.values ?? {};
  } catch {
    return {};
  }
}

function saveFlowContext(values: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const payload = {
    values,
    updated_at: new Date().toISOString(),
  };
  window.localStorage.setItem(FLOW_CONTEXT_KEY, JSON.stringify(payload));
}

const moduleAreaMap: Record<ModuleKey, OpsArea[] | null> = {
  dashboard: null,
  ia: null,
  twinmill: null,
  granos: null,
  catalogos: null,
  produccion: [
    {
      key: "lote-turno-produccion",
      naturalLabel: "Lote y turno de produccion",
      fields: [
        { key: "hora_turno", label: "Hora / Turno", type: "text", placeholder: "1T" },
        { key: "lote_molienda", label: "Lote molienda", type: "text", placeholder: "MOL-260311-01" },
        { key: "lote_trigo", label: "Lote trigo", type: "text", placeholder: "MOTTLER" },
        { key: "linea", label: "Linea", type: "select", catalogKey: "flour_lines" },
        { key: "capacidad_ton_dia", label: "Capacidad Tm/dia", type: "number", placeholder: "200" },
        { key: "disponibilidad_operativa", label: "Disponibilidad operativa (%)", type: "number", placeholder: "85" },
        { key: "capacidad_nominal_pct", label: "% capacidad nominal", type: "number", placeholder: "90" },
        { key: "dias_laborables_anuales", label: "Dias laborables anuales", type: "number", placeholder: "300" },
        { key: "energia_usd_ton_trigo", label: "Energia USD/Tm trigo", type: "number", placeholder: "7" },
      ],
    },
    {
      key: "acondicionado-bk1",
      naturalLabel: "Acondicionado BK1",
      fields: [
        { key: "tipo_harina", label: "Tipo de harina", type: "select", catalogKey: "flour_types" },
        { key: "humedad_bk1", label: "Humedad BK1 (%)", type: "number", placeholder: "14.85" },
        { key: "ceniza_bk1", label: "Ceniza BK1 (%)", type: "number", placeholder: "1.709" },
        { key: "impureza_bk1", label: "Impureza BK1 (%)", type: "number", placeholder: "0.90" },
        { key: "peso_hect_bk1", label: "Peso hectolitrico BK1", type: "number", placeholder: "76.4" },
      ],
    },
    {
      key: "subproducto-afrecho",
      naturalLabel: "Subproducto afrecho grueso",
      fields: [
        { key: "humedad_afrecho", label: "Humedad afrecho (%)", type: "number", placeholder: "13.42" },
        { key: "ceniza_afrecho", label: "Ceniza afrecho (%)", type: "number", placeholder: "6.195" },
      ],
    },
    {
      key: "molienda-harina-lab",
      naturalLabel: "Molienda harina (laboratorio)",
      fields: [
        { key: "humedad_harina", label: "Humedad harina (%)", type: "number", placeholder: "13.88" },
        { key: "ceniza_harina", label: "Ceniza harina (%)", type: "number", placeholder: "0.600" },
      ],
    },
  ],
  tolvas: [
    {
      key: "recepcion-tolvas",
      naturalLabel: "Recepcion y distribucion a tolvas",
      fields: [
        { key: "hora_turno", label: "Hora / Turno", type: "text", placeholder: "2T" },
        { key: "tipo_trigo", label: "Tipo de trigo", type: "select", catalogKey: "grain_varieties" },
        { key: "tolva", label: "Tolva destino", type: "select", catalogKey: "grain_warehouses" },
        { key: "lote_trigo", label: "Lote trigo", type: "text", placeholder: "TRI-260311-04" },
        { key: "entrada_ton", label: "Entrada (t)", type: "number", placeholder: "22.4" },
        { key: "salida_ton", label: "Salida a proceso (t)", type: "number", placeholder: "21.8" },
      ],
    },
    {
      key: "control-calidad-tolvas",
      naturalLabel: "Control de calidad en tolvas",
      fields: [
        { key: "humedad_tolva", label: "Humedad (%)", type: "number", placeholder: "13.6" },
        { key: "impureza_tolva", label: "Impureza (%)", type: "number", placeholder: "0.12" },
        { key: "peso_hect_tolva", label: "Peso hectolitrico", type: "number", placeholder: "77.9" },
        { key: "temperatura_tolva", label: "Temperatura (C)", type: "number", placeholder: "24" },
        { key: "observacion", label: "Observacion", type: "text", placeholder: "Flujo estable y sin atoros" },
      ],
    },
  ],
  empaques: [
    {
      key: "corrida-empaque",
      naturalLabel: "Corrida de empaque",
      fields: [
        { key: "hora_turno", label: "Hora / Turno", type: "text", placeholder: "3T" },
        { key: "lote_harina", label: "Lote harina", type: "text", placeholder: "HAR-260311-C" },
        { key: "linea", label: "Linea", type: "select", catalogKey: "flour_lines" },
        { key: "producto", label: "Producto", type: "select", catalogKey: "packed_products" },
        { key: "unidad", label: "Unidad empaque", type: "select", catalogKey: "packaging_units" },
        { key: "unidades", label: "Unidades", type: "number", placeholder: "3200" },
        { key: "peso_objetivo", label: "Peso objetivo (kg)", type: "number", placeholder: "25" },
        { key: "peso_promedio", label: "Peso promedio real (kg)", type: "number", placeholder: "24.98" },
      ],
    },
    {
      key: "calidad-sellado-empaque",
      naturalLabel: "Calidad de sellado y merma",
      fields: [
        { key: "merma_pct", label: "Merma (%)", type: "number", placeholder: "0.9" },
        { key: "rechazo_unidades", label: "Unidades rechazadas", type: "number", placeholder: "46" },
        { key: "fuga_pct", label: "Fuga en sellado (%)", type: "number", placeholder: "0.18" },
        { key: "tiempo_paro_min", label: "Paro de linea (min)", type: "number", placeholder: "22" },
        { key: "causa", label: "Causa principal", type: "text", placeholder: "Descalibracion selladora" },
      ],
    },
  ],
  procesos: null,
  molienda: [
    {
      key: "ajuste-molienda",
      naturalLabel: "Ajuste de molienda",
      fields: [
        { key: "linea", label: "Linea", type: "text", placeholder: "Linea A" },
        { key: "lote_harina", label: "Lote harina", type: "text", placeholder: "HAR-260311-A" },
        { key: "extraccion", label: "Extraccion (%)", type: "number", placeholder: "75" },
        { key: "energia", label: "Energia (kWh/t)", type: "number", placeholder: "43" },
      ],
    },
    {
      key: "paros-y-mermas",
      naturalLabel: "Paros y mermas",
      fields: [
        { key: "minutos_paro", label: "Minutos paro", type: "number", placeholder: "35" },
        { key: "merma_ton", label: "Merma (t)", type: "number", placeholder: "1.2" },
        { key: "causa", label: "Causa", type: "text", placeholder: "Cambio de malla" },
      ],
    },
  ],
  harina: [
    {
      key: "liberacion-lote",
      naturalLabel: "Liberacion de lote",
      fields: [
        { key: "lote", label: "Lote", type: "text", placeholder: "HAR-260311-A" },
        { key: "humedad", label: "Humedad (%)", type: "number", placeholder: "13.8" },
        { key: "proteina", label: "Proteina (%)", type: "number", placeholder: "11.6" },
        { key: "estado", label: "Estado", type: "text", placeholder: "Liberado" },
      ],
    },
    {
      key: "reclamaciones",
      naturalLabel: "Reclamaciones de calidad",
      fields: [
        { key: "cliente", label: "Cliente", type: "select", catalogKey: "customers" },
        { key: "motivo", label: "Motivo", type: "text", placeholder: "Baja absorcion" },
        { key: "severidad", label: "Severidad", type: "text", placeholder: "Media" },
      ],
    },
  ],
  almacenes: [
    {
      key: "entrada-salida",
      naturalLabel: "Entrada y salida inventario",
      fields: [
        { key: "almacen", label: "Almacen", type: "select", catalogKey: "flour_warehouses" },
        { key: "sku", label: "Producto", type: "select", catalogKey: "packed_products" },
        { key: "entrada_ton", label: "Entrada (t)", type: "number", placeholder: "22" },
        { key: "salida_ton", label: "Salida (t)", type: "number", placeholder: "18" },
      ],
    },
    {
      key: "despacho",
      naturalLabel: "Despacho y servicio",
      fields: [
        { key: "pedido", label: "Pedido", type: "text", placeholder: "PED-2031" },
        { key: "zona", label: "Zona", type: "text", placeholder: "Norte" },
        { key: "lead_time", label: "Lead time (h)", type: "number", placeholder: "16" },
      ],
    },
  ],
  ventas: [
    {
      key: "pedido-venta",
      naturalLabel: "Pedido y cierre de venta",
      fields: [
        { key: "fecha_promesa", label: "Fecha promesa", type: "date" },
        { key: "cliente", label: "Cliente", type: "select", catalogKey: "customers" },
        { key: "producto", label: "Producto", type: "select", catalogKey: "packed_products" },
        { key: "tipo_cliente", label: "Tipo cliente", type: "select", catalogKey: "customer_types" },
        { key: "volumen_ton", label: "Volumen (t)", type: "number", placeholder: "28" },
        { key: "precio", label: "Precio por ton", type: "number", placeholder: "540" },
        { key: "precio_harina_usd_ton", label: "Harina USD/Tm", type: "number", placeholder: "620" },
        { key: "precio_trigo_usd_ton", label: "Trigo USD/Tm", type: "number", placeholder: "306" },
        { key: "precio_subproducto_usd_ton", label: "Subproductos USD/Tm", type: "number", placeholder: "260" },
        { key: "descuento", label: "Descuento (%)", type: "number", placeholder: "2.5" },
      ],
    },
    {
      key: "cartera-riesgo-zona",
      naturalLabel: "Rentabilidad y riesgo por zona",
      fields: [
        { key: "zona", label: "Zona / Sede", type: "select", catalogKey: "sites" },
        { key: "costo_logistico", label: "Costo logistico (USD/t)", type: "number", placeholder: "21" },
        { key: "margen", label: "Margen (%)", type: "number", placeholder: "17" },
        { key: "riesgo", label: "Riesgo cartera", type: "number", placeholder: "0.22" },
        { key: "dias_cobro", label: "Dias promedio de cobro", type: "number", placeholder: "34" },
      ],
    },
  ],
  calidad: [
    {
      key: "prelimpia-lab",
      naturalLabel: "Prelimpia trigo seco sucio y limpio",
      fields: [
        { key: "tipo_trigo", label: "Tipo de trigo", type: "select", catalogKey: "grain_varieties" },
        { key: "humedad_prelimpia", label: "Humedad (%)", type: "number", placeholder: "13.30" },
        { key: "impureza_prelimpia", label: "Impureza (%)", type: "number", placeholder: "0.09" },
        { key: "peso_hect_prelimpia", label: "Peso hectolitrico", type: "number", placeholder: "78.2" },
      ],
    },
    {
      key: "analisis-ceniza",
      naturalLabel: "Analisis de ceniza",
      fields: [
        { key: "lote", label: "Lote", type: "text", placeholder: "HAR-260311-A" },
        { key: "ceniza", label: "Ceniza (%)", type: "number", placeholder: "0.58" },
        { key: "metodo", label: "Metodo", type: "text", placeholder: "ICC" },
      ],
    },
    {
      key: "analisis-proteina",
      naturalLabel: "Analisis de proteina",
      fields: [
        { key: "lote", label: "Lote", type: "text", placeholder: "HAR-260311-A" },
        { key: "proteina", label: "Proteina (%)", type: "number", placeholder: "11.9" },
        { key: "equipo", label: "Equipo", type: "text", placeholder: "NIR" },
      ],
    },
    {
      key: "analisis-alveografo",
      naturalLabel: "Analisis alveografo",
      fields: [
        { key: "lote", label: "Lote", type: "text", placeholder: "HAR-260311-A" },
        { key: "w", label: "W", type: "number", placeholder: "210" },
        { key: "p_l", label: "P/L", type: "number", placeholder: "0.65" },
      ],
    },
  ],
  rentabilidad: null,
};

export function ModuleOpsBoard({ moduleKey, title }: { moduleKey: ModuleKey; title: string }) {
  const areas = moduleAreaMap[moduleKey];
  const availableAreas = useMemo(() => areas ?? [], [areas]);
  const [catalogs, setCatalogs] = useState<GrainCatalogs>(fallbackGrainCatalogs as GrainCatalogs);
  const [records, setRecords] = useState<OpsRecord[]>([]);
  const [captureMode, setCaptureMode] = useState<"rapida" | "completa">("rapida");
  const [activeAreaKey, setActiveAreaKey] = useState<string>("");
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterArea, setFilterArea] = useState("todos");
  const [filterText, setFilterText] = useState("");

  const [formState, setFormState] = useState<Record<string, Record<string, string>>>(() => {
    const seed: Record<string, Record<string, string>> = {};
    for (const area of availableAreas) {
      seed[area.key] = Object.fromEntries(
        area.fields.map((field) => [field.key, field.type === "date" ? new Date().toISOString().slice(0, 10) : ""]),
      );
    }
    return seed;
  });

  const fieldLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const area of availableAreas) {
      for (const field of area.fields) {
        map[field.key] = field.label;
      }
    }
    return map;
  }, [availableAreas]);

  const processFieldKeys = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const area of availableAreas) {
      map.set(area.key, new Set(area.fields.map((field) => field.key)));
    }
    return map;
  }, [availableAreas]);

  const filtered = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    return records.filter((item) => {
      if (filterArea !== "todos" && item.processKey !== filterArea) return false;
      if (filterFrom && item.date < filterFrom) return false;
      if (filterTo && item.date > filterTo) return false;
      if (text) {
        const row = `${item.naturalLabel} ${item.summary} ${item.reference}`.toLowerCase();
        if (!row.includes(text)) return false;
      }
      return true;
    });
  }, [filterArea, filterFrom, filterText, filterTo, records]);

  const kpiCount = records.length;
  const kpiLastDate = records[0]?.date ?? "-";
  const kpiAreaCoverage = availableAreas.length ? (new Set(records.map((item) => item.processKey)).size / availableAreas.length) * 100 : 0;

  useEffect(() => {
    getGrainCatalogs()
      .then((data) => setCatalogs(data))
      .catch(() => {
        setCatalogs(fallbackGrainCatalogs as GrainCatalogs);
      });
  }, []);

  useEffect(() => {
    getOpsCaptures(moduleKey)
      .then((data) => {
        const mapped: OpsRecord[] = data.map((item) => {
          const allowedKeys = processFieldKeys.get(item.process_key) ?? null;
          return {
            id: item.id,
            processKey: item.process_key,
            naturalLabel: item.natural_label,
            date: item.capture_date,
            reference: item.reference,
            summary: buildSummary(item.fields, fieldLabelMap, allowedKeys),
          };
        });
        setRecords(mapped);
      })
      .catch(() => {
        setRecords([]);
      });
  }, [fieldLabelMap, moduleKey, processFieldKeys]);

  useEffect(() => {
    const refresh = () => {
      getGrainCatalogs()
        .then((data) => setCatalogs(data))
        .catch(() => {
          setCatalogs(fallbackGrainCatalogs as GrainCatalogs);
        });
    };

    const onCatalogsUpdated = () => refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CATALOGS_UPDATED_TS_KEY) {
        refresh();
      }
    };

    window.addEventListener(CATALOGS_UPDATED_EVENT, onCatalogsUpdated as EventListener);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(CATALOGS_UPDATED_EVENT, onCatalogsUpdated as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (availableAreas.length === 0) {
      setActiveAreaKey("");
      return;
    }

    if (!activeAreaKey || !availableAreas.some((area) => area.key === activeAreaKey)) {
      setActiveAreaKey(availableAreas[0].key);
    }
  }, [activeAreaKey, availableAreas]);

  const activeIndex = availableAreas.findIndex((area) => area.key === activeAreaKey);
  const activeArea = activeIndex >= 0 ? availableAreas[activeIndex] : availableAreas[0] ?? { key: "", naturalLabel: "", fields: [] };
  const activeFields = getVisibleFields(activeArea, captureMode);

  const activeValidationErrors = useMemo(() => {
    const values = formState[activeArea.key] ?? {};
    return Object.fromEntries(
      activeFields
        .map((field) => [field.key, validateFieldValue(field.key, values[field.key] ?? "")])
        .filter((entry) => entry[1]),
    ) as Record<string, string>;
  }, [activeArea.key, activeFields, formState]);

  const hasActiveValidationErrors = Object.keys(activeValidationErrors).length > 0;

  const applyContextToForms = useCallback(() => {
    const context = loadFlowContext();
    if (Object.keys(context).length === 0) return;

    setFormState((previous) => {
      const next = { ...previous };

      for (const area of availableAreas) {
        const current = { ...(next[area.key] ?? {}) };
        for (const field of area.fields) {
          if ((current[field.key] ?? "").trim().length > 0) continue;
          const direct = context[field.key];
          const normalized = context[normalizeFlowKey(field.key)];
          if (direct) {
            current[field.key] = direct;
          } else if (normalized) {
            current[field.key] = normalized;
          }
        }
        next[area.key] = current;
      }

      return next;
    });
  }, [availableAreas]);

  useEffect(() => {
    applyContextToForms();
  }, [applyContextToForms]);

  if (availableAreas.length === 0) return null;

  return (
    <section className="mt-4 space-y-4">
      <article className="panel p-5 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Operacion por Areas: {title}</h3>
        <p className="ops-copy mt-2 text-sm text-slate-600">
          Captura en formularios por proceso y consulta en una sola tabla con filtros por fecha y etiquetas naturales.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Registros cargados</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{kpiCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Ultima captura</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{kpiLastDate}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Cobertura de areas</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{kpiAreaCoverage.toFixed(1)}%</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCaptureMode("rapida")}
            className={`capture-tab ${captureMode === "rapida" ? "capture-tab-active" : "capture-tab-inactive"}`}
          >
            Captura rapida
          </button>
          <button
            type="button"
            onClick={() => setCaptureMode("completa")}
            className={`capture-tab ${captureMode === "completa" ? "capture-tab-active" : "capture-tab-inactive"}`}
          >
            Captura completa
          </button>
          <p className="text-xs text-slate-500">Modo {captureMode}: {captureMode === "rapida" ? "campos esenciales por etapa" : "todos los campos"}.</p>
          <button
            type="button"
            onClick={applyContextToForms}
            className="module-btn-ghost"
          >
            Autoarrastrar ultimo flujo
          </button>
        </div>
      </article>

      <section className="space-y-3">
        <article className="panel p-4 md:p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Flujo de captura por etapa</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableAreas.map((area, idx) => (
              <button
                key={area.key}
                type="button"
                onClick={() => setActiveAreaKey(area.key)}
                className={`capture-tab ${activeArea.key === area.key ? "capture-tab-active" : "capture-tab-inactive"}`}
              >
                {idx + 1}. {area.naturalLabel}
              </button>
            ))}
          </div>
        </article>

        <form
          key={activeArea.key}
          className="panel space-y-3 p-5"
          onSubmit={(event) => {
              event.preventDefault();
              if (hasActiveValidationErrors) {
                setFormErrorMessage("Hay valores fuera de rango sugerido. Corrige los campos marcados.");
                return;
              }
              setFormErrorMessage(null);
              const values = formState[activeArea.key] ?? {};
              const date = values.fecha || new Date().toISOString().slice(0, 10);
              const reference = `${activeArea.key.toUpperCase()}-${Date.now().toString().slice(-6)}`;
              const summary = activeArea.fields
                .map((field) => `${field.label}: ${values[field.key] || "-"}`)
                .join(" | ");

              createOpsCapture({
                module_key: moduleKey,
                process_key: activeArea.key,
                natural_label: activeArea.naturalLabel,
                capture_date: date,
                reference,
                fields: Object.fromEntries(
                  activeArea.fields.map((field) => [field.key, (values[field.key] ?? "").toString()]),
                ),
              })
                .then((saved) => {
                  const allowedKeys = processFieldKeys.get(saved.process_key) ?? null;
                  const savedSummary = buildSummary(saved.fields, fieldLabelMap, allowedKeys);

                  setRecords((previous) => [
                    {
                      id: saved.id,
                      processKey: saved.process_key,
                      naturalLabel: saved.natural_label,
                      date: saved.capture_date,
                      reference: saved.reference,
                      summary: savedSummary,
                    },
                    ...previous,
                  ]);

                  const contextValues: Record<string, string> = {};
                  for (const [key, value] of Object.entries(saved.fields)) {
                    contextValues[key] = String(value);
                    contextValues[normalizeFlowKey(key)] = String(value);
                  }
                  saveFlowContext(contextValues);

                  if (activeIndex < availableAreas.length - 1) {
                    setActiveAreaKey(availableAreas[activeIndex + 1].key);
                  }
                })
                .catch(() => {
                  setRecords((previous) => [
                    {
                      id: `${activeArea.key}-${Date.now()}`,
                      processKey: activeArea.key,
                      naturalLabel: activeArea.naturalLabel,
                      date,
                      reference,
                      summary,
                    },
                    ...previous,
                  ]);

                  const contextValues: Record<string, string> = {};
                  for (const [key, value] of Object.entries(values)) {
                    contextValues[key] = String(value ?? "");
                    contextValues[normalizeFlowKey(key)] = String(value ?? "");
                  }
                  saveFlowContext(contextValues);
                });
            }}
        >
            <h4 className="font-display text-lg text-slate-800">Area: {activeArea.naturalLabel}</h4>
            {formErrorMessage ? <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{formErrorMessage}</p> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-600">Fecha de captura</span>
                <input
                  type="date"
                  required
                  value={formState[activeArea.key]?.fecha ?? new Date().toISOString().slice(0, 10)}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      [activeArea.key]: { ...(previous[activeArea.key] ?? {}), fecha: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              {activeFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="text-xs font-medium text-slate-600">{field.label}</span>
                  {field.type === "select" && field.catalogKey ? (
                    <select
                      value={formState[activeArea.key]?.[field.key] ?? ""}
                      onChange={(event) =>
                        setFormState((previous) => ({
                          ...previous,
                          [activeArea.key]: { ...(previous[activeArea.key] ?? {}), [field.key]: event.target.value },
                        }))
                      }
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Selecciona una opcion</option>
                      {(catalogs[field.catalogKey] ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={formState[activeArea.key]?.[field.key] ?? ""}
                      onChange={(event) =>
                        setFormState((previous) => ({
                          ...previous,
                          [activeArea.key]: { ...(previous[activeArea.key] ?? {}), [field.key]: event.target.value },
                        }))
                      }
                      placeholder={field.placeholder}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  )}
                  {activeValidationErrors[field.key] ? <p className="mt-1 text-xs text-amber-700">{activeValidationErrors[field.key]}</p> : null}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => setActiveAreaKey(availableAreas[Math.max(0, activeIndex - 1)].key)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Etapa anterior
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= availableAreas.length - 1}
                  onClick={() => setActiveAreaKey(availableAreas[Math.min(availableAreas.length - 1, activeIndex + 1)].key)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Siguiente etapa
                </button>
              </div>
              <button
                type="submit"
                disabled={hasActiveValidationErrors}
                className="btn-primary"
              >
                Guardar captura
              </button>
            </div>
          </form>
      </section>

      <article className="panel p-5 md:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <h4 className="font-display text-lg text-slate-800">Tabla de informacion</h4>
          <label className="block">
            <span className="text-xs text-slate-600">Desde</span>
            <input
              type="date"
              value={filterFrom}
              onChange={(event) => setFilterFrom(event.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Hasta</span>
            <input
              type="date"
              value={filterTo}
              onChange={(event) => setFilterTo(event.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Etiqueta natural</span>
            <select
              value={filterArea}
              onChange={(event) => setFilterArea(event.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="todos">Todos</option>
              {availableAreas.map((area) => (
                <option key={area.key} value={area.key}>
                  {area.naturalLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-56 flex-1">
            <span className="text-xs text-slate-600">Buscar</span>
            <input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="codigo, lote, resumen..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proceso</th>
                <th>Referencia</th>
                <th>Resumen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap">{item.date}</td>
                  <td>{item.naturalLabel}</td>
                  <td className="tbl-mono whitespace-nowrap">{item.reference}</td>
                  <td className="max-w-[520px] tbl-wrap-text">{item.summary}</td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="td-empty">
                    No hay registros para los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
