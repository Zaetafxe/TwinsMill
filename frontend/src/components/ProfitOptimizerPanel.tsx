type ProfitOptimizerData = {
  what_to_produce: string;
  when_to_produce: string;
  what_to_blend: string;
  which_customers_to_prioritize: string[];
  expected_profit: number;
};

export function ProfitOptimizerPanel({ data }: { data: ProfitOptimizerData }) {
  return (
    <section className="panel col-span-6 p-5 fade-up md:p-6">
      <h3 className="font-display text-xl text-slate-800">Optimizador de Utilidad con IA</h3>
      <p className="ops-copy mt-1 text-xs text-slate-500">Recomendaciones sobre que producir, cuando y para quien, buscando maximizar margen.</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">
        <p><span className="font-semibold text-slate-500">Que producir:</span> {data.what_to_produce}</p>
        <p><span className="font-semibold text-slate-500">Cuando producir:</span> {data.when_to_produce}</p>
        <p><span className="font-semibold text-slate-500">Que mezclar:</span> {data.what_to_blend}</p>
        <p><span className="font-semibold text-slate-500">Clientes prioritarios:</span> {data.which_customers_to_prioritize.join(", ")}</p>
      </div>
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
        Utilidad estimada optimizada: ${data.expected_profit.toLocaleString()}
      </div>
    </section>
  );
}
