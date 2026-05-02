import { MillDesignerBuilder } from "@/components/MillDesignerBuilder";

export default function DisenadorPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-12 md:px-6">
      {/* Hero header */}
      <header className="pt-6 pb-5">
        <p className="text-[0.7rem] font-bold tracking-[0.18em] uppercase text-blue-700/70">
          Constructor Inteligente · IA
        </p>
        <h1
          className="mt-1 text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Sora, sans-serif", letterSpacing: "-0.025em" }}
        >
          Diseñador de Diagrama de Molino
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
          Arma el diagrama de proceso de tu molino como un rompecabezas — selecciona equipos reales del
          catálogo (Prillwitz / Idugel), configura su capacidad y la IA calcula automáticamente el rendimiento
          de molienda, extracción, productos obtenidos, cuello de botella y recomendaciones de mejora.
        </p>
        {/* Feature chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "29 máquinas industriales reales",
            "Trigo blando · Trigo duro · Maíz",
            "Cálculo de cuello de botella",
            "Análisis de extracción % con IA",
            "Plantillas rápidas precargadas",
            "Score de calidad del diseño",
          ].map((chip) => (
            <span key={chip} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[0.68rem] text-slate-600 shadow-sm">
              {chip}
            </span>
          ))}
        </div>
      </header>

      {/* Main builder */}
      <MillDesignerBuilder />

      {/* Footer info */}
      <footer className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "¿Cómo funciona?",
            body: "Selecciona equipos del catálogo izquierdo por fase de proceso. Aparecen en el flujo de tu molino en el centro. Ajusta la capacidad de cada equipo con el slider.",
          },
          {
            title: "Motor de análisis IA",
            body: "El motor calcula el cuello de botella (mínima t/h), la producción diaria/anual, el porcentaje de extracción según equipos y grano, y emite alertas y sugerencias de optimización.",
          },
          {
            title: "Opciones de grano",
            body: "Trigo Blando (harina 000/0000), Trigo Duro/Candeal (semolín, pasta), Maíz (polenta, gritz, harina fina). Cada selección filtra equipos compatibles y ajusta los rendimientos.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.body}</p>
          </div>
        ))}
      </footer>
    </div>
  );
}
