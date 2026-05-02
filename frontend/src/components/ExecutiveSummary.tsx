type ExecutiveSummaryProps = {
  oee: number;
  profitForecast: number;
  risk: number;
  maturity: number;
};

export function ExecutiveSummary({ oee, profitForecast, risk, maturity }: ExecutiveSummaryProps) {
  return (
    <section className="panel col-span-12 overflow-hidden p-6 fade-up md:p-7" style={{
      background:
        "radial-gradient(circle at 92% 0%, rgba(185,134,86,0.16), transparent 34%), linear-gradient(148deg, rgba(255,255,255,0.96), rgba(242,247,255,0.9))",
    }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-4xl">
          <p className="section-kicker">Resumen Ejecutivo de Torre de Control</p>
          <h1 className="section-title font-display text-3xl md:text-5xl">Plataforma Ejecutiva para Molinos Inteligentes</h1>
          <p className="section-copy ops-copy max-w-3xl text-sm md:text-[0.95rem]">
            Orquestacion de planta en tiempo real con gemelo digital, analitica predictiva, control de calidad y decisiones
            de alto impacto para direccion de operaciones.
          </p>
        </div>
        <div className="topbar-chip px-5 py-4 text-sm">
          <p className="text-slate-500">OEE: <span className="font-semibold text-slate-800">{(oee * 100).toFixed(1)}%</span></p>
          <p className="text-slate-500">Utilidad proyectada: <span className="font-semibold text-slate-800">${profitForecast.toLocaleString()}</span></p>
          <p className="text-slate-500">Riesgo de portafolio: <span className="font-semibold text-slate-800">{(risk * 100).toFixed(1)}%</span></p>
          <p className="text-slate-500">Madurez digital: <span className="font-semibold text-slate-800">{maturity.toFixed(1)}/100</span></p>
        </div>
      </div>
    </section>
  );
}
