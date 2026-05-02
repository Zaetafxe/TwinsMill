type Stage = {
  stage: string;
  input_tons: number;
  output_tons: number;
  efficiency: number;
  risk_index: number;
};

export function TwinFlowTable({ stages }: { stages: Stage[] }) {
  return (
    <section className="panel col-span-12 p-5 fade-up md:p-6">
      <h3 className="font-display text-xl text-slate-800">Flujo de Proceso del Gemelo Digital</h3>
      <p className="ops-copy mt-1 text-xs text-slate-500">Recepcion, limpieza, molienda, cernido, mezcla, empaque, almacen y despacho.</p>
      <div className="mt-4 tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Entrada (ton)</th>
              <th>Salida (ton)</th>
              <th>Eficiencia</th>
              <th>Índice de Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.stage}>
                <td>{s.stage}</td>
                <td>{s.input_tons.toFixed(1)}</td>
                <td>{s.output_tons.toFixed(1)}</td>
                <td style={{ color: "#1e3a8a", fontWeight: 600 }}>{(s.efficiency * 100).toFixed(2)}%</td>
                <td>
                  <span className="badge-risk">
                    {(s.risk_index * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
