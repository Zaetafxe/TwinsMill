"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createOpsCapture, getOpsCaptures, type OpsCapture } from "@/lib/api";

type WizardField = {
  key: string;
  label: string;
  type: "text" | "number" | "date";
  placeholder?: string;
  required?: boolean;
};

type WizardStep = {
  key: string;
  title: string;
  moduleKey: string;
  fields: WizardField[];
};

type RuleProfile = {
  name: string;
  humidityMin: number;
  humidityMax: number;
  proteinMin: number;
  proteinMax: number;
  ashMin: number;
  ashMax: number;
  extractionMin: number;
  extractionMax: number;
};

type StepStatus = "ok" | "warn" | "error" | "pending";

const FLOW_CONTEXT_KEY = "twinsmill_flow_context_v1";

const steps: WizardStep[] = [
  {
    key: "recepcion-granos",
    title: "1. Recepcion de granos",
    moduleKey: "granos",
    fields: [
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "grain_code", label: "Codigo de grano", type: "text", required: true, placeholder: "TRI-001" },
      { key: "variedad", label: "Variedad", type: "text", required: true, placeholder: "Durum" },
      { key: "tons_received", label: "Toneladas recibidas", type: "number", required: true, placeholder: "120" },
      { key: "humedad", label: "Humedad (%)", type: "number", required: true, placeholder: "13.5" },
    ],
  },
  {
    key: "limpieza-tolvas",
    title: "2. Limpieza y tolvas",
    moduleKey: "tolvas",
    fields: [
      { key: "tolva", label: "Tolva", type: "text", required: true, placeholder: "Tolva A" },
      { key: "impureza_prelimpia", label: "Impureza (%)", type: "number", required: true, placeholder: "0.9" },
      { key: "temperatura_tolva", label: "Temperatura (C)", type: "number", placeholder: "24" },
    ],
  },
  {
    key: "molienda",
    title: "3. Molienda",
    moduleKey: "molienda",
    fields: [
      { key: "lote_molienda", label: "Lote molienda", type: "text", required: true, placeholder: "MOL-001" },
      { key: "extraccion", label: "Extraccion (%)", type: "number", required: true, placeholder: "75" },
      { key: "energia", label: "Energia (kWh/t)", type: "number", required: true, placeholder: "43" },
    ],
  },
  {
    key: "produccion",
    title: "4. Produccion",
    moduleKey: "produccion",
    fields: [
      { key: "linea", label: "Linea", type: "text", required: true, placeholder: "Linea A" },
      { key: "capacidad_ton_dia", label: "Capacidad (t/dia)", type: "number", required: true, placeholder: "200" },
      { key: "disponibilidad_operativa", label: "Disponibilidad (%)", type: "number", required: true, placeholder: "85" },
    ],
  },
  {
    key: "calidad-harina",
    title: "5. Calidad y harina",
    moduleKey: "calidad",
    fields: [
      { key: "lote_harina", label: "Lote harina", type: "text", required: true, placeholder: "HAR-001" },
      { key: "proteina", label: "Proteina (%)", type: "number", required: true, placeholder: "11.7" },
      { key: "ceniza", label: "Ceniza (%)", type: "number", required: true, placeholder: "0.58" },
    ],
  },
  {
    key: "empaque",
    title: "6. Empaque",
    moduleKey: "empaques",
    fields: [
      { key: "producto", label: "Producto", type: "text", required: true, placeholder: "Harina 25kg" },
      { key: "unidades", label: "Unidades", type: "number", required: true, placeholder: "3200" },
      { key: "merma_pct", label: "Merma (%)", type: "number", placeholder: "0.9" },
    ],
  },
  {
    key: "almacen-despacho",
    title: "7. Almacen y despacho",
    moduleKey: "almacenes",
    fields: [
      { key: "almacen", label: "Almacen", type: "text", required: true, placeholder: "ALM-NORTE" },
      { key: "salida_ton", label: "Salida (t)", type: "number", required: true, placeholder: "18" },
      { key: "lead_time", label: "Lead time (h)", type: "number", placeholder: "16" },
    ],
  },
  {
    key: "venta-entrega",
    title: "8. Venta y entrega",
    moduleKey: "ventas",
    fields: [
      { key: "cliente", label: "Cliente", type: "text", required: true, placeholder: "CUST-ALFA" },
      { key: "tipo_cliente", label: "Tipo cliente", type: "text", required: true, placeholder: "Industrial" },
      { key: "volumen_ton", label: "Volumen (t)", type: "number", required: true, placeholder: "28" },
      { key: "precio", label: "Precio por ton", type: "number", required: true, placeholder: "540" },
      { key: "estado_entrega", label: "Estado entrega", type: "text", required: true, placeholder: "Entregado" },
    ],
  },
];

function initialState() {
  const state: Record<string, Record<string, string>> = {};
  for (const step of steps) {
    state[step.key] = Object.fromEntries(
      step.fields.map((field) => [field.key, field.type === "date" ? new Date().toISOString().slice(0, 10) : ""]),
    );
  }
  return state;
}

function createWizardFolio(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TM-${stamp}-${rand}`;
}

function flattenValues(form: Record<string, Record<string, string>>): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const step of steps) {
    for (const [key, value] of Object.entries(form[step.key] ?? {})) {
      if (String(value).trim().length > 0) {
        merged[key] = String(value);
      }
    }
  }
  return merged;
}

function getRuleProfile(context: Record<string, string>): RuleProfile {
  const variedad = (context.variedad ?? "").toLowerCase();
  const tipoCliente = (context.tipo_cliente ?? context.cliente ?? "").toLowerCase();

  const base: RuleProfile = {
    name: "Base",
    humidityMin: 8,
    humidityMax: 18,
    proteinMin: 8,
    proteinMax: 17,
    ashMin: 0.2,
    ashMax: 2.5,
    extractionMin: 60,
    extractionMax: 85,
  };

  if (variedad.includes("durum") || tipoCliente.includes("premium") || tipoCliente.includes("industrial")) {
    return {
      name: "Perfil premium",
      humidityMin: 11,
      humidityMax: 15,
      proteinMin: 11,
      proteinMax: 15.5,
      ashMin: 0.35,
      ashMax: 1.1,
      extractionMin: 70,
      extractionMax: 80,
    };
  }

  if (variedad.includes("maiz") || variedad.includes("corn")) {
    return {
      name: "Perfil maiz",
      humidityMin: 10,
      humidityMax: 16,
      proteinMin: 7,
      proteinMax: 13,
      ashMin: 0.2,
      ashMax: 1.8,
      extractionMin: 62,
      extractionMax: 82,
    };
  }

  return base;
}

function rangeWarning(fieldKey: string, value: string, profile: RuleProfile): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const key = fieldKey.toLowerCase();

  if (key.includes("humedad") && (n < profile.humidityMin || n > profile.humidityMax)) {
    return `Humedad fuera de rango sugerido (${profile.humidityMin}-${profile.humidityMax}%).`;
  }
  if (key.includes("proteina") && (n < profile.proteinMin || n > profile.proteinMax)) {
    return `Proteina fuera de rango sugerido (${profile.proteinMin}-${profile.proteinMax}%).`;
  }
  if (key.includes("ceniza") && (n < profile.ashMin || n > profile.ashMax)) {
    return `Ceniza fuera de rango sugerido (${profile.ashMin}-${profile.ashMax}%).`;
  }
  if (key.includes("extraccion") && (n < profile.extractionMin || n > profile.extractionMax)) {
    return `Extraccion fuera de rango sugerido (${profile.extractionMin}-${profile.extractionMax}%).`;
  }
  if (key.includes("energia") && (n < 20 || n > 90)) return "Energia fuera de rango sugerido (20-90 kWh/t).";
  if ((key.includes("ton") || key.includes("volumen")) && n <= 0) return "Toneladas/volumen debe ser mayor a 0.";

  return null;
}

function inferValueForField(fieldKey: string, context: Record<string, string>): string {
  const aliases: Record<string, string[]> = {
    lote_molienda: ["grain_code", "lote_harina"],
    lote_harina: ["lote_molienda", "grain_code"],
    salida_ton: ["volumen_ton", "tons_received"],
    volumen_ton: ["salida_ton", "tons_received"],
    tons_received: ["volumen_ton"],
    cliente: ["tipo_cliente"],
  };

  if (context[fieldKey]) return context[fieldKey];
  for (const alias of aliases[fieldKey] ?? []) {
    if (context[alias]) return context[alias];
  }
  return "";
}

function isCriticalField(fieldKey: string): boolean {
  const key = fieldKey.toLowerCase();
  return (
    key.includes("humedad") ||
    key.includes("proteina") ||
    key.includes("ceniza") ||
    key.includes("extraccion") ||
    key.includes("energia") ||
    key.includes("ton") ||
    key.includes("volumen")
  );
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function ProcessFlowWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, Record<string, string>>>(() => initialState());
  const [wizardFolio] = useState<string>(() => createWizardFolio());
  const [timeline, setTimeline] = useState<OpsCapture[]>([]);

  const currentStep = steps[stepIndex];
  const currentValues = useMemo(() => form[currentStep.key] ?? {}, [currentStep.key, form]);
  const allValues = useMemo(() => flattenValues(form), [form]);
  const ruleProfile = useMemo(() => getRuleProfile(allValues), [allValues]);

  const autofillCurrentStep = useCallback(() => {
    setForm((previous) => {
      const context = flattenValues(previous);
      const nextCurrent = { ...(previous[currentStep.key] ?? {}) };
      let hasChanges = false;

      for (const field of currentStep.fields) {
        if ((nextCurrent[field.key] ?? "").trim().length > 0) continue;
        const inferred = inferValueForField(field.key, context);
        if (inferred) {
          nextCurrent[field.key] = inferred;
          hasChanges = true;
        }
      }

      if (!hasChanges) {
        return previous;
      }

      return {
        ...previous,
        [currentStep.key]: nextCurrent,
      };
    });
  }, [currentStep.fields, currentStep.key]);

  useEffect(() => {
    autofillCurrentStep();
  }, [autofillCurrentStep]);

  useEffect(() => {
    const payload = {
      values: {
        ...allValues,
        wizard_folio: wizardFolio,
      },
      updated_at: new Date().toISOString(),
    };
    window.localStorage.setItem(FLOW_CONTEXT_KEY, JSON.stringify(payload));
  }, [allValues, wizardFolio]);

  const currentWarnings = useMemo(() => {
    return Object.fromEntries(
      currentStep.fields
        .map((field) => [field.key, rangeWarning(field.key, currentValues[field.key] ?? "", ruleProfile)])
        .filter((entry) => entry[1]),
    ) as Record<string, string>;
  }, [currentStep.fields, currentValues, ruleProfile]);

  const stepChecklist = useMemo(() => {
    return steps.map((step) => {
      const values = form[step.key] ?? {};
      const missingRequired = step.fields.some((field) => field.required && (values[field.key] ?? "").trim().length === 0);
      const warnings = step.fields.filter((field) => rangeWarning(field.key, values[field.key] ?? "", ruleProfile));
      const criticalWarnings = warnings.filter((field) => isCriticalField(field.key));

      let status: StepStatus = "ok";
      if (Object.values(values).every((value) => String(value).trim().length === 0)) {
        status = "pending";
      } else if (missingRequired || criticalWarnings.length > 0) {
        status = "error";
      } else if (warnings.length > 0) {
        status = "warn";
      }

      return {
        key: step.key,
        title: step.title,
        status,
        warnings: warnings.length,
        criticalWarnings: criticalWarnings.length,
      };
    });
  }, [form, ruleProfile]);

  const hasWarnings = Object.keys(currentWarnings).length > 0;
  const hasCriticalWarnings = currentStep.fields.some(
    (field) => isCriticalField(field.key) && Boolean(currentWarnings[field.key]),
  );

  const canAdvanceToNextStep = !currentStep.fields.some(
    (field) => field.required && (currentValues[field.key] ?? "").trim().length === 0,
  ) && !hasCriticalWarnings;

  useEffect(() => {
    getOpsCaptures("procesos")
      .then((items) => {
        const filtered = items.filter((item) => item.fields?.wizard_folio === wizardFolio);
        setTimeline(filtered);
      })
      .catch(() => {
        setTimeline([]);
      });
  }, [wizardFolio]);

  const exportCsv = useCallback(() => {
    const rows: string[] = [
      "wizard_folio,step_key,step_title,field_key,field_value",
    ];

    for (const step of steps) {
      const values = form[step.key] ?? {};
      for (const field of step.fields) {
        const value = (values[field.key] ?? "").replace(/"/g, '""');
        rows.push(`"${wizardFolio}","${step.key}","${step.title}","${field.key}","${value}"`);
      }
    }

    downloadFile(`twinsmill-${wizardFolio}-trazabilidad.csv`, rows.join("\n"), "text/csv;charset=utf-8");
  }, [form, wizardFolio]);

  const exportPrintableReport = useCallback(() => {
    const stepHtml = stepChecklist
      .map((step) => `<tr><td>${step.title}</td><td>${step.status}</td><td>${step.warnings}</td><td>${step.criticalWarnings}</td></tr>`)
      .join("");

    const timelineHtml = timeline
      .map((item) => `<tr><td>${item.capture_date}</td><td>${item.natural_label}</td><td>${item.reference}</td></tr>`)
      .join("");

    const reportWindow = window.open("", "_blank", "width=1000,height=800");
    if (!reportWindow) return;

    reportWindow.document.write(`
      <html>
        <head>
          <title>Reporte ${wizardFolio}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1, h2 { margin: 0 0 12px 0; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>TwinsMill - Reporte de Trazabilidad</h1>
          <p><strong>Folio:</strong> ${wizardFolio}</p>
          <p><strong>Perfil:</strong> ${ruleProfile.name}</p>
          <h2>Checklist Semaforo</h2>
          <table>
            <thead><tr><th>Etapa</th><th>Estado</th><th>Advertencias</th><th>Criticas</th></tr></thead>
            <tbody>${stepHtml}</tbody>
          </table>
          <h2>Timeline de Capturas</h2>
          <table>
            <thead><tr><th>Fecha</th><th>Etapa</th><th>Referencia</th></tr></thead>
            <tbody>${timelineHtml || "<tr><td colspan='3'>Sin registros guardados</td></tr>"}</tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }, [ruleProfile.name, stepChecklist, timeline, wizardFolio]);

  async function saveCurrentStep() {
    const values = form[currentStep.key] ?? {};
    const missingRequired = currentStep.fields.some((field) => field.required && (values[field.key] ?? "").trim().length === 0);
    if (missingRequired) {
      setStatus("Completa los campos requeridos antes de guardar.");
      return;
    }

    if (hasCriticalWarnings) {
      setStatus("Hay valores criticos fuera de rango. Corrige antes de guardar.");
      return;
    }

    setSaving(true);
    setStatus(null);
    const date = values.fecha || new Date().toISOString().slice(0, 10);
    const reference = `${wizardFolio}-${currentStep.key.toUpperCase()}`;

    try {
      await createOpsCapture({
        module_key: "procesos",
        process_key: currentStep.key,
        natural_label: currentStep.title,
        capture_date: date,
        reference,
        fields: {
          ...values,
          wizard_folio: wizardFolio,
          rule_profile: ruleProfile.name,
        },
      });

      const savedCapture: OpsCapture = {
        id: `${currentStep.key}-${Date.now()}`,
        module_key: "procesos",
        process_key: currentStep.key,
        natural_label: currentStep.title,
        capture_date: date,
        reference,
        fields: {
          ...values,
          wizard_folio: wizardFolio,
          rule_profile: ruleProfile.name,
        },
      };
      setTimeline((previous) => [savedCapture, ...previous]);

      const merged = flattenValues(form);
      window.localStorage.setItem(FLOW_CONTEXT_KEY, JSON.stringify({ values: { ...merged, wizard_folio: wizardFolio }, updated_at: new Date().toISOString() }));

      setStatus(hasWarnings ? "Captura guardada con advertencias no criticas." : "Captura guardada en flujo transversal.");
      if (stepIndex < steps.length - 1) {
        setStepIndex(stepIndex + 1);
      }
    } catch {
      setStatus("No se pudo guardar en backend, pero el avance local se mantiene.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <article className="panel p-5 md:p-6">
        <p className="section-kicker">Wizard Transversal</p>
        <h3 className="font-display text-2xl text-slate-800">Flujo de Grano a Cliente</h3>
        <p className="ops-copy mt-2 text-sm text-slate-600">Captura toda la trazabilidad operativa en un solo recorrido, con validaciones por etapa y autoarrastre de datos.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            Etapa {stepIndex + 1} de {steps.length}: {currentStep.title}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">Folio de trazabilidad: {wizardFolio}</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">Perfil de validacion: {ruleProfile.name}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="module-btn-ghost"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={exportPrintableReport}
            className="module-btn-ghost"
          >
            Exportar reporte (PDF)
          </button>
        </div>
      </article>

      <article className="panel p-5 md:p-6">
        <div className="mb-3 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Checklist semaforo por etapa</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {stepChecklist.map((step) => {
              const color =
                step.status === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : step.status === "warn"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : step.status === "error"
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : "bg-slate-50 border-slate-200 text-slate-600";
              const label = step.status === "ok" ? "OK" : step.status === "warn" ? "Alerta" : step.status === "error" ? "Falta" : "Pendiente";
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setStepIndex(steps.findIndex((item) => item.key === step.key))}
                  className={`rounded-md border px-3 py-2 text-left text-xs ${color}`}
                >
                  <p className="font-semibold">{step.title}</p>
                  <p>{label}{step.warnings > 0 ? ` | ${step.warnings} advertencias` : ""}{step.criticalWarnings > 0 ? ` | ${step.criticalWarnings} criticas` : ""}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {steps.map((step, idx) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setStepIndex(idx)}
              className={`capture-tab ${idx === stepIndex ? "capture-tab-active" : "capture-tab-inactive"}`}
            >
              {idx + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={autofillCurrentStep}
            className="module-btn-ghost"
          >
            Autocompletar etapa
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {currentStep.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="text-xs font-medium text-slate-600">{field.label}</span>
              <input
                type={field.type}
                required={Boolean(field.required)}
                value={currentValues[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    [currentStep.key]: {
                      ...(previous[currentStep.key] ?? {}),
                      [field.key]: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {currentWarnings[field.key] ? <p className="mt-1 text-xs text-amber-700">{currentWarnings[field.key]}</p> : null}
            </label>
          ))}
        </div>

        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Etapa anterior
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveCurrentStep}
              disabled={saving}
              className="rounded-lg border border-blue-800 bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar etapa"}
            </button>
            <button
              type="button"
              disabled={stepIndex >= steps.length - 1 || !canAdvanceToNextStep}
              onClick={() => {
                if (!canAdvanceToNextStep) {
                  setStatus("No puedes avanzar: hay requeridos faltantes o alertas criticas en rojo.");
                  return;
                }
                setStepIndex(Math.min(steps.length - 1, stepIndex + 1));
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Siguiente etapa
            </button>
          </div>
        </div>
      </article>

      <article className="panel p-5 md:p-6">
        <h4 className="font-display text-lg text-slate-800">Timeline de trazabilidad por folio</h4>
        <p className="mt-1 text-xs text-slate-500">Registros de etapas guardados para {wizardFolio}.</p>
        <div className="mt-3 tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Etapa</th>
                <th>Referencia</th>
                <th>Perfil</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap">{item.capture_date}</td>
                  <td>{item.natural_label}</td>
                  <td className="tbl-mono">{item.reference}</td>
                  <td>{item.fields?.rule_profile ?? "—"}</td>
                </tr>
              ))}
              {timeline.length === 0 ? (
                <tr>
                  <td colSpan={4} className="td-empty">Aún no hay etapas guardadas para este folio.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
