"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DesignSnapshot {
  grain: string;
  machineCount: number;
  score: number;
  dailyCapacity: number;
  annualCapacity: number;
  extractionPct: number;
  energyKwhPerTon: number;
  bottleneckLabel: string;
  warnings: string[];
  recommendations: string[];
  products: Array<{ label: string; yieldPct: number; color: string }>;
  pipelineLabels: string[];
  savedAt: string;
}

const GRAIN_LABELS: Record<string, string> = {
  trigo_blando: "Trigo Blando",
  trigo_duro: "Trigo Duro",
  maiz: "Maíz",
};

export function DesignImportBanner() {
  const [snap, setSnap] = useState<DesignSnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mill-design-snapshot");
      if (raw) setSnap(JSON.parse(raw) as DesignSnapshot);
    } catch {
      /* ignore parse errors */
    }
  }, []);

  if (!snap || dismissed) return null;

  const scoreColor =
    snap.score >= 80 ? "#059669" : snap.score >= 60 ? "#d97706" : "#dc2626";

  const savedDate = new Date(snap.savedAt).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Score ring mini */}
          <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke={scoreColor}
              strokeWidth="4"
              strokeDasharray={`${(snap.score / 100) * 100.5} 100.5`}
              strokeLinecap="round"
              transform="rotate(-90 20 20)"
            />
            <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="700" fill={scoreColor}>
              {snap.score}
            </text>
          </svg>

          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-blue-600">
              Diseño importado desde el Diseñador de Molino
            </p>
            <p className="text-sm font-bold text-slate-800 truncate">
              {GRAIN_LABELS[snap.grain] ?? snap.grain} · {snap.machineCount} equipos · {snap.dailyCapacity.toFixed(0)} t/día
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:block text-[0.62rem] text-slate-400">{savedDate}</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[0.68rem] font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
          >
            {expanded ? "Ocultar" : "Ver detalle"}
          </button>
          <Link
            href="/disenador"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[0.68rem] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Editar
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem("mill-design-snapshot");
              setDismissed(true);
            }}
            aria-label="Cerrar banner"
            className="ml-1 rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-blue-100 bg-white px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            {[
              { label: "Extracción", value: `${snap.extractionPct.toFixed(1)}%` },
              { label: "Capacidad diaria", value: `${snap.dailyCapacity.toFixed(0)} t/d` },
              { label: "Capacidad anual", value: `${(snap.annualCapacity / 1000).toFixed(1)} kt/año` },
              { label: "Energía", value: `${snap.energyKwhPerTon.toFixed(1)} kWh/t` },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
                <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-400">{kpi.label}</p>
                <p className="text-sm font-bold text-slate-800">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Products */}
          <div className="mb-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Rendimientos del diseño</p>
            <div className="flex flex-wrap gap-2">
              {snap.products.map((p) => (
                <span
                  key={p.label}
                  className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold text-white"
                  style={{ background: p.color }}
                >
                  {p.label} {p.yieldPct.toFixed(1)}%
                </span>
              ))}
            </div>
          </div>

          {/* Bottleneck */}
          <p className="text-[0.68rem] text-slate-500 mb-2">
            <span className="font-semibold text-amber-700">Cuello de botella:</span> {snap.bottleneckLabel}
          </p>

          {/* Warnings */}
          {snap.warnings.length > 0 && (
            <div className="space-y-1 mb-2">
              {snap.warnings.map((w, i) => (
                <p key={i} className="text-[0.68rem] text-amber-700">⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {snap.recommendations.length > 0 && (
            <div className="space-y-1">
              {snap.recommendations.map((r, i) => (
                <p key={i} className="text-[0.68rem] text-blue-700">💡 {r}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
