export function RecommendationsPanel({ recommendations }: { recommendations: Array<{ title: string; severity: string; recommendation: string; impact_area: string }> }) {
  const severityMap: Record<string, string> = {
    high: "alta",
    medium: "media",
    low: "baja",
    alta: "alta",
    media: "media",
    baja: "baja",
  };

  return (
    <section className="panel col-span-6 p-5 fade-up md:p-6">
      <h3 className="font-display text-xl text-slate-800">Motor de Decisiones con IA</h3>
      <p className="ops-copy mt-1 text-xs text-slate-500">Motor de reglas + predicciones ML + reglas de negocio.</p>
      <div className="mt-4 space-y-3">
        {recommendations.map((item) => (
          <article key={item.title} className="rounded-xl border border-slate-300/70 bg-white/95 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
              <span className="rounded-full bg-[#1e3a8a]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#1e3a8a]">
                {severityMap[item.severity] ?? item.severity}
              </span>
            </div>
            <p className="ops-copy mt-2 text-xs leading-relaxed text-slate-600">{item.recommendation}</p>
            <p className="ops-detail mt-1 text-[11px] text-slate-500">Area de impacto: {item.impact_area}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
