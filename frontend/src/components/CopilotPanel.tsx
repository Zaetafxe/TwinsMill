"use client";

import { useState } from "react";

import { askCopilot } from "@/lib/api";

export function CopilotPanel() {
  const [question, setQuestion] = useState("Por que esta bajando el rendimiento?");
  const [answer, setAnswer] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);

  async function submit() {
    const result = await askCopilot(question);
    setAnswer(result.answer);
    setConfidence(result.confidence);
  }

  return (
    <section className="panel col-span-5 p-5 fade-up md:p-6">
      <h3 className="font-display text-xl text-slate-800">Copiloto IA de Molienda</h3>
      <p className="ops-copy mt-1 text-xs text-slate-500">Haz preguntas estrategicas al asistente industrial de IA simulado.</p>
      <input
        className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1e3a8a]/60 focus:ring-2 focus:ring-[#1e3a8a]/10"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button className="mt-3 rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5f58]" onClick={submit}>
        Preguntar al Copiloto
      </button>
      {answer && (
        <div className="mt-4 rounded-xl border border-slate-300 bg-white/95 p-4 text-sm text-slate-700 shadow-sm">
          <p className="leading-relaxed">{answer}</p>
          <p className="ops-detail mt-2 text-xs text-slate-500">Confianza: {(confidence * 100).toFixed(1)}%</p>
        </div>
      )}
    </section>
  );
}
