import { AINotebook } from "@/components/AINotebook";

export default function NotebookPage() {
  return (
    <main className="mx-auto max-w-[1680px] px-4 pb-8 pt-6 md:px-8">
      <section className="panel mb-6 p-5 md:p-6">
        <p className="section-kicker">Análisis con IA</p>
        <h1 className="section-title font-display text-3xl md:text-5xl">Notebook Interactivo</h1>
        <p className="section-copy ops-copy mt-2 max-w-4xl text-sm text-slate-600">
          Realiza análisis de datos profesionales usando lenguaje natural. Pregunta lo que necesites y obtén 
          visualizaciones, métricas, matrices de confusión y análisis completos sin escribir código.
        </p>
      </section>

      <AINotebook />
    </main>
  );
}
