"use client";

const areas = [
  "Operaciones",
  "Calidad",
  "Inventario",
  "Comercial",
  "Finanzas",
  "Cadena de suministro",
  "Cliente",
  "Mantenimiento",
];

function scoreToColor(score: number) {
  if (score > 0.7) return "bg-red-500/70";
  if (score > 0.45) return "bg-amber-400/70";
  return "bg-emerald-400/70";
}

export function RiskHeatmap({ baseScore }: { baseScore: number }) {
  return (
    <div className="panel col-span-4 p-5 fade-up md:p-6">
      <h3 className="font-display text-xl text-slate-800">Mapa de Riesgo con IA</h3>
      <p className="ops-copy mt-1 text-xs text-slate-500">Intensidad de riesgo entre dominios con simulaciones de gemelo digital y disrupciones.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {areas.map((area, idx) => {
          const score = Math.min(0.95, Math.max(0.1, baseScore + idx * 0.04 - 0.12));
          return (
            <div key={area} className="rounded-xl border border-slate-300/70 bg-white/90 p-3">
              <p className="text-xs font-semibold text-slate-600">{area}</p>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${scoreToColor(score)}`} style={{ width: `${score * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{(score * 100).toFixed(0)}% de riesgo</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
