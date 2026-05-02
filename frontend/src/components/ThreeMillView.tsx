"use client";

import { useEffect, useState } from "react";

/* â”€â”€ Process stage data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const STAGES = [
  { id: "recepcion",   label: "Recepción",   eff: 94, load: 92, tph: 42.5, color: "#60a5fa", bottleneck: false },
  { id: "limpieza",    label: "Limpieza",    eff: 91, load: 88, tph: 41.7, color: "#34d399", bottleneck: false },
  { id: "acondicion",  label: "Acondic.",    eff: 87, load: 85, tph: 40.2, color: "#a78bfa", bottleneck: false },
  { id: "molienda",    label: "Molienda",    eff: 76, load: 97, tph: 38.9, color: "#f59e0b", bottleneck: true  },
  { id: "cernido",     label: "Cernido",     eff: 89, load: 82, tph: 38.1, color: "#38bdf8", bottleneck: false },
  { id: "terminacion", label: "Terminación", eff: 93, load: 79, tph: 37.4, color: "#fb923c", bottleneck: false },
  { id: "empaque",     label: "Empaque",     eff: 97, load: 76, tph: 36.9, color: "#e879f9", bottleneck: false },
] as const;

const KPI_STRIP = [
  { label: "Throughput", value: "42.5", unit: "t/h",   color: "#60a5fa" },
  { label: "Extracción",  value: "76.5", unit: "%",     color: "#34d399" },
  { label: "OEE",         value: "81.4", unit: "%",     color: "#a78bfa" },
  { label: "Energía",     value: "56",   unit: "kWh/t", color: "#f59e0b" },
  { label: "Cap. / día",  value: "204",  unit: "t/d",   color: "#38bdf8" },
];

/* â”€â”€ Mini efficiency ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function EffRing({ eff, color }: { eff: number; color: string }) {
  const r = 19;
  const circ = 2 * Math.PI * r;
  const filled = (eff / 100) * circ;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        style={{ filter: `drop-shadow(0 0 5px ${color}88)`, transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="24" y="28" textAnchor="middle" fill="white" fontSize="10.5" fontWeight="800"
        fontFamily="Manrope, Sora, sans-serif">
        {eff}%
      </text>
    </svg>
  );
}

/* â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export function ThreeMillView() {
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 110);
    return () => clearInterval(id);
  }, []);

  const shinePos = (tick * 1.8) % 115;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ background: "linear-gradient(145deg, #0b1422 0%, #0e1e44 55%, #0b1422 100%)" }}
    >
      {/* â”€â”€ Header â”€â”€ */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(185,134,86,0.18)" }}
      >
        <div>
          <p className="text-[0.57rem] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(185,134,86,0.65)" }}>
            Gemelo Digital · Monitor de Proceso
          </p>
          <h3 className="mt-0.5 text-sm font-bold text-white/90" style={{ fontFamily: "Sora, sans-serif" }}>
            Flujo Industrial en Tiempo Real
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg px-3 py-1.5 text-center"
            style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.25)" }}
          >
            <p className="text-[0.5rem] font-bold uppercase tracking-widest" style={{ color: "rgba(52,211,153,0.7)" }}>Efic. Global</p>
            <p className="text-sm font-black text-emerald-400" style={{ fontFamily: "Manrope, sans-serif" }}>88.1%</p>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.28)" }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[0.57rem] font-bold tracking-widest text-emerald-400">EN VIVO</span>
          </div>
        </div>
      </div>

      {/* â”€â”€ Stage flow â”€â”€ */}
      <div className="overflow-x-auto px-4 pt-4 pb-2">
        <div className="flex items-stretch gap-0" style={{ minWidth: 680 }}>
          {STAGES.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <div
                className="relative flex flex-col items-center gap-1.5 rounded-xl px-2.5 py-3 cursor-pointer"
                style={{
                  width: 86,
                  background: hovered === stage.id ? "rgba(6,16,40,0.98)" : "rgba(8,20,46,0.78)",
                  border: stage.bottleneck
                    ? "1.5px solid rgba(245,158,11,0.72)"
                    : hovered === stage.id
                      ? `1.5px solid ${stage.color}80`
                      : `1px solid ${stage.color}28`,
                  boxShadow: stage.bottleneck
                    ? "0 0 18px rgba(245,158,11,0.22), 0 2px 12px rgba(0,0,0,0.5)"
                    : hovered === stage.id
                      ? `0 0 14px ${stage.color}28, 0 2px 10px rgba(0,0,0,0.4)`
                      : "0 2px 8px rgba(0,0,0,0.3)",
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={() => setHovered(stage.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Top accent bar */}
                <div
                  className="absolute top-0 left-3 right-3 h-[3px] rounded-b"
                  style={{ background: stage.bottleneck ? "#f59e0b" : stage.color, opacity: 0.9 }}
                />

                {/* Bottleneck badge */}
                {stage.bottleneck && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[0.46rem] font-black uppercase tracking-wide"
                    style={{ background: "#f59e0b", color: "#451a03" }}
                  >
                    âš¡ CUELLO
                  </span>
                )}

                <EffRing eff={stage.eff} color={stage.bottleneck ? "#f59e0b" : stage.color} />

                <p
                  className="text-[0.57rem] font-bold text-center leading-tight"
                  style={{ color: stage.bottleneck ? "#fbbf24" : "rgba(255,255,255,0.82)" }}
                >
                  {stage.label}
                </p>

                <div className="w-full">
                  <div className="mb-0.5 flex justify-between">
                    <span className="text-[0.46rem] font-bold uppercase tracking-widest text-white/30">Carga</span>
                    <span
                      className="text-[0.46rem] font-bold tabular-nums"
                      style={{ color: stage.bottleneck ? "#f59e0b" : stage.color }}
                    >
                      {stage.load}%
                    </span>
                  </div>
                  <div className="h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${stage.load}%`,
                        background: stage.bottleneck ? "#f59e0b" : stage.color,
                        opacity: 0.75,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>

                <p className="text-[0.5rem] font-mono tabular-nums text-white/35">
                  {stage.tph.toFixed(1)} t/h
                </p>
              </div>

              {/* Animated connector */}
              {idx < STAGES.length - 1 && (
                <div className="flex shrink-0 items-center justify-center" style={{ width: 30 }}>
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line
                      x1="0" y1="6" x2="22" y2="6"
                      stroke="rgba(185,134,86,0.4)" strokeWidth="1.5"
                      strokeDasharray="4 3"
                      strokeDashoffset={-((tick * 2) % 14)}
                    />
                    <polygon points="22,3 30,6 22,9" fill="rgba(185,134,86,0.55)" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Grain flow bar â”€â”€ */}
      <div className="mx-5 mb-3 mt-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[0.5rem] font-bold uppercase tracking-widest text-white/25">
            Flujo activo de grano
          </span>
          <span className="text-[0.5rem] font-bold tabular-nums text-white/35">
            42.5 t/h â†’ 36.9 t/h{" "}
            <span style={{ color: "#f87171" }}>âˆ’13.2%</span>
          </span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: "87%",
              background:
                "linear-gradient(90deg, #60a5fa 0%, #34d399 18%, #a78bfa 35%, #f59e0b 50%, #38bdf8 65%, #fb923c 82%, #e879f9 100%)",
              opacity: 0.65,
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-14 rounded-full"
            style={{
              left: `${shinePos}%`,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            }}
          />
        </div>
      </div>

      {/* â”€â”€ KPI strip â”€â”€ */}
      <div
        className="mx-4 mb-4 grid grid-cols-5 overflow-hidden rounded-xl"
        style={{ border: "1px solid rgba(185,134,86,0.14)" }}
      >
        {KPI_STRIP.map((kpi, i) => (
          <div
            key={kpi.label}
            className="flex flex-col items-center px-1 py-2.5"
            style={{
              background: i % 2 === 0 ? "rgba(8,20,48,0.9)" : "rgba(10,24,54,0.7)",
              borderRight: i < KPI_STRIP.length - 1 ? "1px solid rgba(185,134,86,0.10)" : "none",
            }}
          >
            <p
              className="mb-0.5 text-center text-[0.48rem] font-bold uppercase tracking-[0.12em]"
              style={{ color: `${kpi.color}a0` }}
            >
              {kpi.label}
            </p>
            <p
              className="text-sm font-black leading-none tabular-nums"
              style={{ color: kpi.color, fontFamily: "Manrope, sans-serif" }}
            >
              {kpi.value}
            </p>
            <p className="mt-0.5 text-[0.48rem] font-semibold" style={{ color: `${kpi.color}66` }}>
              {kpi.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
