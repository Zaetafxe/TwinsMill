"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ForecastPoint = {
  month: string;
  forecast_tons: number;
  ci_low: number;
  ci_high: number;
};

export function ForecastChart({ data }: { data: ForecastPoint[] }) {
  return (
    <div className="panel col-span-8 p-5 fade-up md:p-6">
      <h3 className="font-display text-xl text-slate-800">Pronostico de Demanda y Curva de Confianza</h3>
      <p className="ops-copy mt-1 text-xs text-slate-500">Banda de pronostico con base de serie temporal en XGBoost, compatible con Prophet y ARIMA.</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cdd7e6" />
            <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                boxShadow: "0 10px 26px rgba(30, 58, 138, 0.12)",
              }}
            />
            <Area type="monotone" dataKey="ci_high" stroke="#8eb6f0" fill="#8eb6f033" />
            <Area type="monotone" dataKey="forecast_tons" stroke="#1e3a8a" fill="#1e3a8a22" />
            <Area type="monotone" dataKey="ci_low" stroke="#56b7c6" fill="#56b7c615" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
