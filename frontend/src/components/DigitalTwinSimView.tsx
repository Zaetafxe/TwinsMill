"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────── */
interface DesignSnapshot {
  grain: string;
  machineCount: number;
  score: number;
  dailyCapacity: number;
  annualCapacity: number;
  extractionPct: number;
  energyKwhPerTon: number;
  bottleneckLabel: string;
  warnings: string[];
  recommendations: string[];
  products: Array<{ label: string; yieldPct: number; color: string }>;
  pipelineLabels: string[];
  savedAt: string;
}

const GRAIN_LABELS: Record<string, string> = {
  trigo_blando: "Trigo Blando",
  trigo_duro: "Trigo Duro",
  maiz: "Maíz",
};

/* ─── Animated counter ──────────────────────────────────── */
function AnimCounter({ target, decimals = 0, suffix = "" }: { target: number; decimals?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(target * ease);
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]);
  return <>{val.toFixed(decimals)}{suffix}</>;
}

/* ─── Mini flow step node ─────────────────────────────────── */
const PHASE_COLORS: Record<string, string> = {
  "Recepción": "#b98656",
  "Limpieza": "#3b82f6",
  "Acondicionamiento": "#0ea5e9",
  "Molienda": "#7c3aed",
  "Cernido": "#059669",
  "Terminación": "#d97706",
  "Empaque": "#dc2626",
};
function guessPhase(label: string): string {
  for (const [ph, color] of Object.entries(PHASE_COLORS)) {
    if (label.toLowerCase().includes(ph.toLowerCase().split("/")[0])) return color;
  }
  return "#64748b";
}

/* ─── Flow process SVG diagram ──────────────────────────── */
function FlowDiagramSVG({ labels, bottleneckLabel }: { labels: string[]; bottleneckLabel: string }) {
  const nodeW = 110;
  const nodeH = 52;
  const gapX = 38;
  const perRow = Math.min(6, labels.length);
  const rows = Math.ceil(labels.length / perRow);
  const svgW = perRow * (nodeW + gapX) + 20;
  const svgH = rows * (nodeH + 54) + 20;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      width="100%"
      style={{ display: "block", maxHeight: 320 }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {labels.map((rawLabel, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const x = col * (nodeW + gapX) + 10;
        const y = row * (nodeH + 54) + 20;
        const cx = x + nodeW / 2;
        const isBottleneck = rawLabel.includes(bottleneckLabel) && bottleneckLabel !== "—";
        const parts = rawLabel.split(" · ");
        const code = parts[0] ?? "";
        const name = parts.slice(1).join(" ");
        const color = guessPhase(name + code);
        const isLast = i === labels.length - 1;
        const isLastInRow = col === perRow - 1;

        return (
          <g key={i}>
            {/* Node */}
            <rect
              x={x} y={y} width={nodeW} height={nodeH} rx={10}
              fill="rgba(12,30,65,0.88)"
              stroke={isBottleneck ? "#f59e0b" : color}
              strokeWidth={isBottleneck ? 2.2 : 1.2}
              filter={isBottleneck ? "url(#glow)" : undefined}
            />
            <rect x={x + 6} y={y} width={nodeW - 12} height={3} rx={1.5} fill={color} opacity={0.9} />

            <text x={cx} y={y + 20} textAnchor="middle" fontSize={8.5} fontWeight={700}
              fill={color} fontFamily="Manrope,sans-serif" letterSpacing={0.5}>
              {code}
            </text>
            <text x={cx} y={y + 33} textAnchor="middle" fontSize={9.5} fontWeight={600}
              fill="rgba(226,232,240,0.9)" fontFamily="Manrope,sans-serif">
              {name.length > 13 ? name.substring(0, 13) + "…" : name}
            </text>
            {isBottleneck && (
              <>
                <text x={cx} y={y + nodeH + 12} textAnchor="middle" fontSize={8} fill="#f59e0b" fontFamily="Manrope,sans-serif">
                  ⚡ cuello
                </text>
              </>
            )}

            {/* Connector */}
            {!isLast && !isLastInRow && (
              <g>
                <line
                  x1={x + nodeW} y1={y + nodeH / 2}
                  x2={x + nodeW + gapX - 8} y2={y + nodeH / 2}
                  stroke="#b98656" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.5}
                />
                <polygon
                  points={`${x + nodeW + gapX - 8},${y + nodeH / 2 - 4} ${x + nodeW + gapX},${y + nodeH / 2} ${x + nodeW + gapX - 8},${y + nodeH / 2 + 4}`}
                  fill="#b98656" opacity={0.5}
                />
              </g>
            )}
            {/* Row break connector */}
            {isLastInRow && !isLast && (
              <g>
                <line
                  x1={x + nodeW / 2} y1={y + nodeH}
                  x2={x + nodeW / 2} y2={y + nodeH + 30}
                  stroke="#b98656" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.4}
                />
                <line
                  x1={10 + nodeW / 2} y1={y + nodeH + 30}
                  x2={x + nodeW / 2} y2={y + nodeH + 30}
                  stroke="#b98656" strokeWidth={1} opacity={0.2}
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Radial gauge ──────────────────────────────────────── */
function RadialGauge({ value, max, label, color, unit }: {
  value: number; max: number; label: string; color: string; unit: string;
}) {
  const r = 36;
  const circumference = Math.PI * r; // half circle
  const pct = Math.min(value / max, 1);
  const dash = pct * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={60} viewBox="0 0 100 60">
        <path
          d="M 12 54 A 38 38 0 0 1 88 54"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} strokeLinecap="round"
        />
        <path
          d="M 12 54 A 38 38 0 0 1 88 54"
          fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize={14} fontWeight={800} fill={color} fontFamily="Sora,sans-serif">
          {value.toFixed(0)}
        </text>
        <text x="50" y="57" textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.35)" fontFamily="Manrope,sans-serif">
          {unit}
        </text>
      </svg>
      <p className="text-[0.6rem] font-bold uppercase tracking-widest mt-0.5" style={{ color, opacity: 0.75 }}>{label}</p>
    </div>
  );
}

/* ─── Animated bar chart for products ───────────────────── */
function ProductsBarChart({ products }: { products: DesignSnapshot["products"] }) {
  const sorted = [...products].sort((a, b) => b.yieldPct - a.yieldPct);
  return (
    <div className="space-y-2.5">
      {sorted.map((p) => {
        const isLight = p.color === "#f8fafc" || p.color === "#f1f5f9";
        const color = isLight ? "#94a3b8" : p.color;
        return (
          <div key={p.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.68rem] font-semibold" style={{ color }}>{p.label}</span>
              <span className="text-[0.72rem] font-black" style={{ color }}>{p.yieldPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/6 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, p.yieldPct * 1.15)}%`,
                  background: `linear-gradient(90deg, ${color}cc, ${color}55)`,
                  transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export function DigitalTwinSimView() {
  const [snap, setSnap] = useState<DesignSnapshot | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mill-design-snapshot");
      if (raw) setSnap(JSON.parse(raw) as DesignSnapshot);
    } catch { /* ignore */ }
  }, []);

  if (!snap) return null;

  const grainLabel = GRAIN_LABELS[snap.grain] ?? snap.grain;
  const scoreColor = snap.score >= 80 ? "#10b981" : snap.score >= 60 ? "#f59e0b" : "#ef4444";
  const revPerYear = snap.annualCapacity * (snap.extractionPct / 100) * 280; // ~280 USD/ton flour avg
  const marginPct = Math.max(0, snap.extractionPct - 72); // proxy gross margin
  const oee = Math.round(snap.score * 0.85);

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.18em] uppercase text-blue-700/60">
            Simulación — Gemelo Digital de Tu Molino
          </p>
          <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: "Sora, sans-serif" }}>
            Resultados Estratégicos · {grainLabel}
          </h2>
          <p className="text-[0.72rem] text-slate-500 mt-0.5">
            {snap.machineCount} equipos configurados · Score de diseño: <strong style={{ color: scoreColor }}>{snap.score}/100</strong>
          </p>
        </div>
        <Link
          href="/disenador"
          className="rounded-xl border border-blue-700 bg-blue-700 px-4 py-2 text-[0.72rem] font-bold text-white hover:bg-blue-800 transition-colors shadow-sm"
        >
          ✏ Modificar diseño
        </Link>
      </div>

      {/* ── Main dark dashboard card ────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #060f1f 0%, #091629 50%, #06101e 100%)",
          border: "1px solid rgba(185,134,86,0.25)",
        }}
      >
        {/* Top KPI strip */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {[
            { label: "Throughput", value: snap.dailyCapacity, max: 600, unit: "t/día", color: "#60a5fa" },
            { label: "Extracción", value: snap.extractionPct, max: 83, unit: "%", color: "#34d399" },
            { label: "Prod. Anual", value: snap.annualCapacity / 1000, max: 300, unit: "kt/año", color: "#a78bfa" },
            { label: "Energía", value: snap.energyKwhPerTon, max: 80, unit: "kWh/t", color: "#fbbf24" },
            { label: "OEE Estimado", value: oee, max: 100, unit: "%", color: "#f472b6" },
            { label: "Score", value: snap.score, max: 100, unit: "/100", color: scoreColor },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="flex flex-col items-center justify-center py-4 px-3"
              style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-[0.55rem] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: kpi.color, opacity: 0.65 }}>
                {kpi.label}
              </p>
              <p className="text-2xl font-black leading-none" style={{ color: kpi.color }}>
                <AnimCounter target={kpi.value} decimals={kpi.unit === "%" || kpi.unit === "/100" ? 0 : 1} />
              </p>
              <p className="text-[0.55rem] font-semibold mt-0.5" style={{ color: kpi.color, opacity: 0.45 }}>{kpi.unit}</p>
            </div>
          ))}
        </div>

        {/* Body: flow diagram + side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Flow diagram — 2 cols */}
          <div className="lg:col-span-2 p-6" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-amber-400/60">Diagrama de Flujo — Gemelo Digital</p>
                <p className="text-sm font-bold text-white/85">Tu Molino Configurado</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="text-[0.58rem] text-amber-400/80 font-semibold">SIMULANDO</span>
              </div>
            </div>

            {/* SVG flow diagram */}
            <div
              className="rounded-2xl overflow-hidden p-4"
              style={{ background: "rgba(4,11,28,0.65)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {snap.pipelineLabels.length > 0 ? (
                <FlowDiagramSVG labels={snap.pipelineLabels} bottleneckLabel={snap.bottleneckLabel} />
              ) : (
                <p className="text-white/30 text-sm text-center py-8">No hay equipos registrados</p>
              )}
            </div>

            {/* Phase coverage badges */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {snap.pipelineLabels.length > 0 && (() => {
                const phases = new Set<string>();
                snap.pipelineLabels.forEach((l) => {
                  const name = l.split(" · ").slice(1).join(" ");
                  for (const ph of Object.keys(PHASE_COLORS)) {
                    if (name.toLowerCase().includes(ph.toLowerCase().split("/")[0])) phases.add(ph);
                  }
                });
                return Array.from(phases).map((ph) => (
                  <span
                    key={ph}
                    className="rounded-full px-2 py-0.5 text-[0.58rem] font-bold"
                    style={{ background: `${PHASE_COLORS[ph]}20`, color: PHASE_COLORS[ph], border: `1px solid ${PHASE_COLORS[ph]}45` }}
                  >
                    ✓ {ph}
                  </span>
                ));
              })()}
            </div>
          </div>

          {/* Right gauges */}
          <div className="flex flex-col p-5 gap-5">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-white/30">Indicadores Radiales</p>
            <div className="grid grid-cols-2 gap-2">
              <RadialGauge value={snap.extractionPct} max={83} label="Extracción" color="#34d399" unit="%" />
              <RadialGauge value={oee} max={100} label="OEE" color="#f472b6" unit="%" />
              <RadialGauge value={snap.dailyCapacity} max={600} label="Cap/día" color="#60a5fa" unit="t" />
              <RadialGauge value={Math.min(snap.energyKwhPerTon, 80)} max={80} label="Energía" color="#fbbf24" unit="kWh/t" />
            </div>

            {/* Bottleneck callout */}
            {snap.bottleneckLabel !== "—" && (
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <p className="text-[0.58rem] font-bold uppercase tracking-widest text-amber-400/70">⚡ Cuello de Botella</p>
                <p className="text-sm font-bold text-amber-300 mt-0.5 truncate">{snap.bottleneckLabel}</p>
                <p className="text-[0.6rem] text-amber-400/50 mt-0.5">Optimizar = +{(snap.dailyCapacity * 0.18).toFixed(0)} t/día</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom section: products + economics + recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">

          {/* Products */}
          <div className="p-5" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-amber-400/60 mb-3">
              Productos · Rendimiento Simulado
            </p>
            <ProductsBarChart products={snap.products} />
          </div>

          {/* Economics */}
          <div className="p-5" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-emerald-400/60 mb-3">
              Proyección Económica Estimada
            </p>
            <div className="space-y-3">
              {[
                { label: "Ingreso bruto anual", value: `USD ${(revPerYear / 1_000_000).toFixed(1)}M`, color: "#34d399", sub: `${(snap.annualCapacity * snap.extractionPct / 100).toFixed(0)} t/año × 280 USD/t` },
                { label: "Margen extracción", value: `+${marginPct.toFixed(1)} pts`, color: "#60a5fa", sub: "vs base 72% extracción" },
                { label: "Eficiencia energética", value: `${snap.energyKwhPerTon.toFixed(0)} kWh/t`, color: "#fbbf24", sub: `${(snap.energyKwhPerTon * snap.annualCapacity / 1000).toFixed(0)} MWh/año` },
                { label: "Valor de molino", value: `Score ${snap.score}/100`, color: scoreColor, sub: snap.score >= 80 ? "Alta eficiencia operativa" : "Margen de mejora disponible" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: `${item.color}08`, border: `1px solid ${item.color}20` }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.6rem] font-semibold text-white/50 leading-tight">{item.label}</p>
                    <p className="text-sm font-black shrink-0" style={{ color: item.color }}>{item.value}</p>
                  </div>
                  <p className="text-[0.58rem] text-white/25 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts + Recommendations */}
          <div className="p-5">
            {snap.warnings.length > 0 && (
              <div className="mb-4">
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-rose-400/70 mb-2">
                  ⚠ Alertas del Diseño
                </p>
                <div className="space-y-1.5">
                  {snap.warnings.slice(0, 3).map((w, i) => (
                    <div key={i} className="rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <p className="text-[0.64rem] text-rose-300 leading-snug">{w}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-blue-400/70 mb-2">
                🤖 Recomendaciones IA
              </p>
              <div className="space-y-1.5">
                {snap.recommendations.slice(0, 4).map((r, i) => (
                  <div key={i} className="rounded-lg px-3 py-2" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}>
                    <p className="text-[0.64rem] text-blue-300 leading-snug">{r}</p>
                  </div>
                ))}
                {snap.recommendations.length === 0 && snap.warnings.length === 0 && (
                  <div className="rounded-xl px-3 py-3 text-center" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
                    <p className="text-[0.72rem] font-bold text-emerald-300">✅ Diseño Óptimo</p>
                    <p className="text-[0.6rem] text-emerald-400/50 mt-0.5">Todas las etapas críticas presentes</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
