"use client";

import { useRef, useEffect, useState, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────── */
type Status = "ok" | "warn" | "risk" | "idle";

interface ProcessStage {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  icon: string;
  status: Status;
  kpis: Array<{ label: string; value: string; unit: string }>;
  inputs: Array<{ key: string; label: string; value: number; min: number; max: number; step: number; unit: string }>;
  color: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pathIndex: number;
  progress: number;
  color: string;
}

interface FlowPath {
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  product: "grain" | "flour" | "bran" | "byproduct";
}

/* ─── Layout constants ――――――――――――――――――――――――――――――――――――― */
const W = 1320;
const H = 520;
const NODE_H = 112;
const NODE_W = 130;

/* ─── Wheat milling stages ―――――――――――――――――――――――――――――――― */
const initialStages: ProcessStage[] = [
  {
    id: "reception",
    label: "Recepción",
    sublabel: "Silos & Báscula",
    x: 30, y: 180,
    w: NODE_W, h: NODE_H,
    icon: "silo",
    status: "ok",
    color: "#b98656",
    kpis: [
      { label: "Humedad entrada", value: "13.2", unit: "%" },
      { label: "Cobertura", value: "18.4", unit: "días" },
      { label: "Temperatura", value: "22.1", unit: "°C" },
    ],
    inputs: [
      { key: "moisture", label: "Humedad entrada", value: 13.2, min: 10, max: 18, step: 0.1, unit: "%" },
      { key: "temp", label: "Temperatura silo", value: 22.1, min: 15, max: 40, step: 0.5, unit: "°C" },
      { key: "inventory", label: "Inventario", value: 3680, min: 500, max: 10000, step: 50, unit: "ton" },
    ],
  },
  {
    id: "precleaning",
    label: "Pre-Limpieza",
    sublabel: "Criba + Imán",
    x: 210, y: 180,
    w: NODE_W, h: NODE_H,
    icon: "sieve",
    status: "ok",
    color: "#0f2f63",
    kpis: [
      { label: "Eficiencia", value: "98.1", unit: "%" },
      { label: "Impurezas rem.", value: "1.9", unit: "%" },
      { label: "Caudal", value: "12.8", unit: "t/h" },
    ],
    inputs: [
      { key: "efficiency", label: "Eficiencia cribado", value: 98.1, min: 90, max: 99.9, step: 0.1, unit: "%" },
      { key: "impurity", label: "Impurezas entrada", value: 1.9, min: 0.1, max: 5, step: 0.1, unit: "%" },
    ],
  },
  {
    id: "conditioning",
    label: "Acondicionamiento",
    sublabel: "Agua + Reposo",
    x: 400, y: 180,
    w: NODE_W + 10, h: NODE_H,
    icon: "drop",
    status: "ok",
    color: "#0ea5e9",
    kpis: [
      { label: "Humedad objetivo", value: "15.3", unit: "%" },
      { label: "Reposo", value: "18", unit: "h" },
      { label: "Temp. agua", value: "18.5", unit: "°C" },
    ],
    inputs: [
      { key: "target_moisture", label: "Humedad objetivo", value: 15.3, min: 13, max: 17, step: 0.1, unit: "%" },
      { key: "rest_time", label: "Tiempo reposo", value: 18, min: 8, max: 36, step: 0.5, unit: "h" },
      { key: "water_temp", label: "Temp. agua", value: 18.5, min: 10, max: 35, step: 0.5, unit: "°C" },
    ],
  },
  {
    id: "rolling",
    label: "Rotura",
    sublabel: "Banco Cilindros",
    x: 600, y: 180,
    w: NODE_W, h: NODE_H,
    icon: "rollers",
    status: "warn",
    color: "#7c3aed",
    kpis: [
      { label: "Velocidad", value: "470", unit: "rpm" },
      { label: "Presión", value: "5.4", unit: "bar" },
      { label: "Pases", value: "5", unit: "" },
    ],
    inputs: [
      { key: "rpm", label: "Velocidad rodillos", value: 470, min: 280, max: 780, step: 5, unit: "rpm" },
      { key: "pressure", label: "Presión molienda", value: 5.4, min: 2.5, max: 10, step: 0.1, unit: "bar" },
      { key: "passes", label: "Pases", value: 5, min: 3, max: 8, step: 1, unit: "" },
    ],
  },
  {
    id: "sifting",
    label: "Cernido",
    sublabel: "Plansifter",
    x: 790, y: 180,
    w: NODE_W, h: NODE_H,
    icon: "grid",
    status: "ok",
    color: "#059669",
    kpis: [
      { label: "Extracción", value: "76.5", unit: "%" },
      { label: "Eficiencia", value: "95.8", unit: "%" },
      { label: "Granul.", value: "0.185", unit: "mm" },
    ],
    inputs: [
      { key: "extraction", label: "Extracción harina", value: 76.5, min: 65, max: 86, step: 0.1, unit: "%" },
      { key: "sifter_eff", label: "Eficiencia cernido", value: 95.8, min: 85, max: 99.8, step: 0.1, unit: "%" },
    ],
  },
  {
    id: "purification",
    label: "Purificación",
    sublabel: "Sassors + Reducción",
    x: 980, y: 180,
    w: NODE_W + 10, h: NODE_H,
    icon: "funnel",
    status: "ok",
    color: "#d97706",
    kpis: [
      { label: "Proteína", value: "11.4", unit: "%" },
      { label: "Cenizas", value: "0.57", unit: "%" },
      { label: "Salvado rem.", value: "99.2", unit: "%" },
    ],
    inputs: [
      { key: "protein", label: "Proteína harina", value: 11.4, min: 9, max: 14, step: 0.1, unit: "%" },
      { key: "ash", label: "Cenizas", value: 0.57, min: 0.35, max: 0.9, step: 0.01, unit: "%" },
      { key: "purifier_eff", label: "Eficiencia purificador", value: 94, min: 85, max: 99.8, step: 0.1, unit: "%" },
    ],
  },
];

/* ─── Flow paths between stages ―――――――――――――――――――――――――― */
function buildPaths(stages: ProcessStage[]): FlowPath[] {
  const s = Object.fromEntries(stages.map((st) => [st.id, st]));
  const cx = (st: ProcessStage) => st.x + st.w / 2;
  const cy = (st: ProcessStage) => st.y + st.h / 2;
  const rEdge = (st: ProcessStage) => st.x + st.w;
  const lEdge = (st: ProcessStage) => st.x;
  const bEdge = (st: ProcessStage) => st.y + st.h;

  return [
    {
      from: "reception", to: "precleaning", product: "grain",
      points: [
        { x: rEdge(s.reception), y: cy(s.reception) },
        { x: lEdge(s.precleaning), y: cy(s.precleaning) },
      ],
    },
    {
      from: "precleaning", to: "conditioning", product: "grain",
      points: [
        { x: rEdge(s.precleaning), y: cy(s.precleaning) },
        { x: lEdge(s.conditioning), y: cy(s.conditioning) },
      ],
    },
    {
      from: "conditioning", to: "rolling", product: "grain",
      points: [
        { x: rEdge(s.conditioning), y: cy(s.conditioning) },
        { x: lEdge(s.rolling), y: cy(s.rolling) },
      ],
    },
    {
      from: "rolling", to: "sifting", product: "grain",
      points: [
        { x: rEdge(s.rolling), y: cy(s.rolling) },
        { x: lEdge(s.sifting), y: cy(s.sifting) },
      ],
    },
    {
      from: "sifting", to: "purification", product: "flour",
      points: [
        { x: rEdge(s.sifting), y: cy(s.sifting) },
        { x: lEdge(s.purification), y: cy(s.purification) },
      ],
    },
    // Byproducts going down
    {
      from: "precleaning", to: "byproduct_1", product: "byproduct",
      points: [
        { x: cx(s.precleaning), y: bEdge(s.precleaning) },
        { x: cx(s.precleaning), y: bEdge(s.precleaning) + 60 },
        { x: cx(s.precleaning) + 30, y: bEdge(s.precleaning) + 60 },
      ],
    },
    {
      from: "sifting", to: "byproduct_2", product: "bran",
      points: [
        { x: cx(s.sifting), y: bEdge(s.sifting) },
        { x: cx(s.sifting), y: bEdge(s.sifting) + 60 },
        { x: cx(s.sifting) + 30, y: bEdge(s.sifting) + 60 },
      ],
    },
  ];
}

/* ─── SVG Icon drawings ―――――――――――――――――――――――――――――――――――― */
function StageIcon({ type, cx, cy, size = 28, color }: { type: string; cx: number; cy: number; size?: number; color: string }) {
  const s = size;
  const hs = s / 2;

  if (type === "silo") {
    return (
      <g transform={`translate(${cx - hs}, ${cy - hs})`}>
        <rect x={s * 0.05} y={s * 0.3} width={s * 0.28} height={s * 0.7} rx={3} fill={color} opacity={0.9} />
        <rect x={s * 0.38} y={s * 0.15} width={s * 0.28} height={s * 0.85} rx={3} fill={color} opacity={0.75} />
        <rect x={s * 0.7} y={s * 0.25} width={s * 0.25} height={s * 0.75} rx={3} fill={color} opacity={0.6} />
        <ellipse cx={s * 0.19} cy={s * 0.3} rx={s * 0.14} ry={s * 0.06} fill={color} />
        <ellipse cx={s * 0.52} cy={s * 0.15} rx={s * 0.14} ry={s * 0.06} fill={color} />
        <ellipse cx={s * 0.83} cy={s * 0.25} rx={s * 0.12} ry={s * 0.05} fill={color} />
      </g>
    );
  }
  if (type === "sieve") {
    return (
      <g transform={`translate(${cx - hs}, ${cy - hs})`}>
        <rect x={2} y={s * 0.25} width={s - 4} height={s * 0.5} rx={4} fill="none" stroke={color} strokeWidth={2.5} />
        {[0.35, 0.5, 0.65].map((fy) =>
          [0.25, 0.45, 0.65, 0.85].map((fx) => (
            <circle key={`${fy}-${fx}`} cx={fx * s} cy={fy * s} r={2} fill={color} />
          ))
        )}
        <line x1={s * 0.1} y1={s * 0.12} x2={s * 0.5} y2={s * 0.25} stroke={color} strokeWidth={2} />
        <line x1={s * 0.9} y1={s * 0.12} x2={s * 0.5} y2={s * 0.25} stroke={color} strokeWidth={2} />
      </g>
    );
  }
  if (type === "drop") {
    return (
      <g transform={`translate(${cx - hs}, ${cy - hs})`}>
        <path d={`M${s * 0.3} ${s * 0.85} Q${s * 0.05} ${s * 0.55} ${s * 0.3} ${s * 0.25} Q${s * 0.5} ${s * 0.05} ${s * 0.7} ${s * 0.25} Q${s * 0.95} ${s * 0.55} ${s * 0.7} ${s * 0.85} Z`}
          fill={color} opacity={0.85} />
        <rect x={s * 0.7} y={s * 0.2} width={s * 0.25} height={s * 0.6} rx={4} fill="none" stroke={color} strokeWidth={2} />
        <line x1={s * 0.82} y1={s * 0.5} x2={s * 0.5} y2={s * 0.55} stroke={color} strokeWidth={1.5} strokeDasharray="3 2" />
      </g>
    );
  }
  if (type === "rollers") {
    return (
      <g transform={`translate(${cx - hs}, ${cy - hs})`}>
        <ellipse cx={s * 0.5} cy={s * 0.38} rx={s * 0.38} ry={s * 0.18} fill="none" stroke={color} strokeWidth={2.5} />
        <ellipse cx={s * 0.5} cy={s * 0.62} rx={s * 0.38} ry={s * 0.18} fill="none" stroke={color} strokeWidth={2.5} />
        <line x1={s * 0.18} y1={s * 0.38} x2={s * 0.18} y2={s * 0.62} stroke={color} strokeWidth={2} />
        <line x1={s * 0.82} y1={s * 0.38} x2={s * 0.82} y2={s * 0.62} stroke={color} strokeWidth={2} />
        {[0.3, 0.5, 0.7].map((tx) => (
          <line key={tx} x1={tx * s} y1={s * 0.38} x2={tx * s} y2={s * 0.62} stroke={color} strokeWidth={1} strokeDasharray="2 3" />
        ))}
      </g>
    );
  }
  if (type === "grid") {
    return (
      <g transform={`translate(${cx - hs}, ${cy - hs})`}>
        <rect x={4} y={4} width={s - 8} height={s - 8} rx={4} fill="none" stroke={color} strokeWidth={2} />
        {[0.33, 0.66].map((t) => (
          <line key={`h${t}`} x1={4} y1={t * s} x2={s - 4} y2={t * s} stroke={color} strokeWidth={1.5} />
        ))}
        {[0.33, 0.66].map((t) => (
          <line key={`v${t}`} x1={t * s} y1={4} x2={t * s} y2={s - 4} stroke={color} strokeWidth={1.5} />
        ))}
        <path d={`M4 ${s - 4} L${(s - 4) * 0.5} ${s * 1.1}`} stroke={color} strokeWidth={2} />
      </g>
    );
  }
  if (type === "funnel") {
    return (
      <g transform={`translate(${cx - hs}, ${cy - hs})`}>
        <path d={`M4 4 L${s - 4} 4 L${s * 0.62} ${s * 0.58} L${s * 0.62} ${s * 0.88} L${s * 0.38} ${s * 0.88} L${s * 0.38} ${s * 0.58} Z`}
          fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} />
        <line x1={s * 0.5} y1={s * 0.88} x2={s * 0.5} y2={s * 1.0} stroke={color} strokeWidth={3} />
      </g>
    );
  }
  return null;
}

/* ─── Status color helpers ―――――――――――――――――――――――――――――――― */
function statusFill(status: Status) {
  if (status === "ok") return "#d1fae5";
  if (status === "warn") return "#fef3c7";
  if (status === "risk") return "#fee2e2";
  return "#f1f5f9";
}
function statusStroke(status: Status) {
  if (status === "ok") return "#059669";
  if (status === "warn") return "#d97706";
  if (status === "risk") return "#dc2626";
  return "#94a3b8";
}
function statusDot(status: Status) {
  if (status === "ok") return "#10b981";
  if (status === "warn") return "#f59e0b";
  if (status === "risk") return "#ef4444";
  return "#94a3b8";
}
function statusBadgeText(status: Status) {
  if (status === "ok") return "OK";
  if (status === "warn") return "⚠";
  if (status === "risk") return "RIESGO";
  return "—";
}

/* ─── Stage node SVG ―――――――――――――――――――――――――――――――――――――― */
function StageNode({
  stage, selected, onClick,
}: {
  stage: ProcessStage;
  selected: boolean;
  onClick: () => void;
}) {
  const { x, y, w, h, label, sublabel, icon, status, color } = stage;
  const cx = x + w / 2;
  const iconCy = y + h * 0.38;
  const glow = selected ? `drop-shadow(0 0 10px ${color}88)` : "none";

  return (
    <g
      style={{ cursor: "pointer", filter: glow, transition: "filter 0.2s" }}
      onClick={onClick}
    >
      {/* Background fill */}
      <rect
        x={x} y={y} width={w} height={h} rx={12}
        fill={selected ? statusFill(status) : "rgba(255,255,255,0.96)"}
        stroke={selected ? statusStroke(status) : "rgba(148,163,184,0.5)"}
        strokeWidth={selected ? 2.5 : 1.5}
      />

      {/* Top accent bar */}
      <rect x={x + 6} y={y} width={w - 12} height={4} rx={2} fill={color} opacity={0.8} />

      {/* Icon */}
      <StageIcon type={icon} cx={cx} cy={iconCy} size={30} color={color} />

      {/* Label */}
      <text x={cx} y={y + h * 0.7} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1c2a3e" fontFamily="Manrope, sans-serif">
        {label}
      </text>
      <text x={cx} y={y + h * 0.84} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="Manrope, sans-serif">
        {sublabel}
      </text>

      {/* Status badge */}
      <circle cx={x + w - 12} cy={y + 12} r={6} fill={statusDot(status)} />
      {status !== "ok" && (
        <text x={x + w - 12} y={y + 16.5} textAnchor="middle" fontSize={8} fill="white" fontWeight={700} fontFamily="Manrope, sans-serif">
          {status === "warn" ? "!" : "×"}
        </text>
      )}
    </g>
  );
}

/* ─── Animated flow arrow ―――――――――――――――――――――――――――――――――― */
function FlowArrow({ path, product }: { path: FlowPath; product: string }) {
  const pts = path.points;
  const d = pts.length === 2
    ? `M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y}`
    : `M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y} L${pts[2].x} ${pts[2].y}`;

  const strokeColor =
    product === "grain" ? "#b98656"
      : product === "flour" ? "#f1f5f9"
        : product === "bran" ? "#78350f"
          : "#94a3b8";

  const arrowEnd = pts[pts.length - 1];
  const arrowPrev = pts[pts.length - 2];
  const dx = arrowEnd.x - arrowPrev.x;
  const dy = arrowEnd.y - arrowPrev.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / len;
  const ny = dy / len;
  const ax = arrowEnd.x - nx * 10;
  const ay = arrowEnd.y - ny * 10;
  const perpX = -ny * 5;
  const perpY = nx * 5;
  const arrowPath = `M${arrowEnd.x} ${arrowEnd.y} L${ax + perpX} ${ay + perpY} L${ax - perpX} ${ay - perpY} Z`;

  const pathId = `path-${path.from}-${path.to}`;

  return (
    <g>
      <defs>
        <path id={pathId} d={d} />
      </defs>
      {/* Background dash */}
      <path d={d} fill="none" stroke={strokeColor} strokeWidth={2.5} strokeDasharray="6 4" opacity={0.4}>
        <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.4s" repeatCount="indefinite" />
      </path>
      {/* Arrow head */}
      <path d={arrowPath} fill={strokeColor} opacity={0.7} />
      {/* Flowing dot */}
      <circle r={4} fill={strokeColor} opacity={0.9}>
        <animateMotion dur="2.2s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
    </g>
  );
}

/* ─── Packaging output node ―――――――――――――――――――――――――――――――― */
function PackagingOutput({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={100} height={90} rx={12}
        fill="rgba(255,255,255,0.96)" stroke="rgba(5,150,105,0.6)" strokeWidth={1.5} />
      <rect x={x + 5} y={y} width={90} height={4} rx={2} fill="#059669" opacity={0.8} />
      {/* Bag icon */}
      <rect x={x + 30} y={y + 18} width={40} height={36} rx={6} fill="#059669" opacity={0.25} stroke="#059669" strokeWidth={2} />
      <text x={x + 50} y={y + 41} textAnchor="middle" fontSize={9} fill="#064e3b" fontWeight={700} fontFamily="Manrope,sans-serif">HARINA</text>
      <text x={x + 50} y={y + 65} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1c2a3e" fontFamily="Manrope,sans-serif">Empaque</text>
      <text x={x + 50} y={y + 78} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="Manrope,sans-serif">Despacho</text>
      <circle cx={x + 88} cy={y + 12} r={6} fill="#10b981" />
    </g>
  );
}

/* ─── Byproduct nodes ―――――――――――――――――――――――――――――――――――――― */
function ByproductNode({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={80} height={48} rx={8}
        fill="rgba(255,255,255,0.9)" stroke={`${color}66`} strokeWidth={1.5} />
      <rect x={x + 4} y={y} width={72} height={3} rx={2} fill={color} opacity={0.7} />
      <text x={x + 40} y={y + 20} textAnchor="middle" fontSize={9} fill={color} fontWeight={700} fontFamily="Manrope,sans-serif">SALIDA</text>
      <text x={x + 40} y={y + 34} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1c2a3e" fontFamily="Manrope,sans-serif">{label}</text>
    </g>
  );
}

/* ─── Detail panel (selected stage) ―――――――――――――――――――――――― */
function StageDetailPanel({
  stage,
  onUpdate,
  onClose,
}: {
  stage: ProcessStage;
  onUpdate: (stageId: string, key: string, value: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 rounded-b-2xl border-t border-slate-200/80 bg-white/97 backdrop-blur-sm shadow-lg">
      <div className="flex items-start justify-between px-5 py-3 border-b border-slate-100">
        <div>
          <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-slate-400">Etapa seleccionada</p>
          <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: "Sora, sans-serif" }}>{stage.label}</h3>
          <p className="text-xs text-slate-500">{stage.sublabel}</p>
        </div>
        <button
          onClick={onClose}
          className="mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-5 py-3 lg:grid-cols-4">
        {/* KPIs */}
        <div className="col-span-2 lg:col-span-2">
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-widest text-slate-400">KPIs actuales</p>
          <div className="flex flex-wrap gap-2">
            {stage.kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5">
                <p className="text-[0.67rem] text-slate-500">{kpi.label}</p>
                <p className="text-sm font-bold text-slate-800">
                  {kpi.value} <span className="text-xs font-normal text-slate-500">{kpi.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Input controls */}
        <div className="col-span-2 lg:col-span-2">
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-widest text-slate-400">Variables de proceso</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stage.inputs.map((inp) => (
              <label key={inp.key} className="block">
                <span className="text-[0.68rem] text-slate-500 block mb-0.5">{inp.label}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="range"
                    min={inp.min}
                    max={inp.max}
                    step={inp.step}
                    value={inp.value}
                    onChange={(e) => onUpdate(stage.id, inp.key, parseFloat(e.target.value))}
                    className="w-full accent-blue-700 h-1.5"
                  />
                  <span className="text-[0.7rem] font-mono font-semibold text-slate-800 w-12 text-right">
                    {inp.value.toFixed(inp.step < 1 ? (inp.step < 0.1 ? 2 : 1) : 0)}{inp.unit}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main diagram component ―――――――――――――――――――――――――――――――― */
export function MillProcessDiagram() {
  const [stages, setStages] = useState<ProcessStage[]>(initialStages);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedStage = stages.find((s) => s.id === selectedId) ?? null;

  const paths = buildPaths(stages);

  const handleStageClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleUpdate = useCallback((stageId: string, key: string, value: number) => {
    setStages((prev) =>
      prev.map((st) =>
        st.id === stageId
          ? {
            ...st,
            inputs: st.inputs.map((inp) => (inp.key === key ? { ...inp, value } : inp)),
            kpis: st.kpis.map((kpi) => {
              // Live KPI updates based on input changes
              if (stageId === "rolling" && key === "rpm" && kpi.label === "Velocidad") return { ...kpi, value: String(value) };
              if (stageId === "rolling" && key === "pressure" && kpi.label === "Presión") return { ...kpi, value: String(value) };
              if (stageId === "sifting" && key === "extraction" && kpi.label === "Extracción") return { ...kpi, value: String(value) };
              if (stageId === "conditioning" && key === "target_moisture" && kpi.label === "Humedad objetivo") return { ...kpi, value: String(value) };
              if (stageId === "purification" && key === "protein" && kpi.label === "Proteína") return { ...kpi, value: String(value) };
              if (stageId === "purification" && key === "ash" && kpi.label === "Cenizas") return { ...kpi, value: String(value) };
              return kpi;
            }),
          }
          : st
      )
    );
  }, []);

  // Packaging output node position
  const lastStage = stages[stages.length - 1];
  const packagingX = lastStage.x + lastStage.w + 30;
  const packagingY = lastStage.y + (lastStage.h - 90) / 2;
  const packagingCx = packagingX + 50;
  const packagingCy = packagingY + 45;

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl">
      {/* SVG diagram */}
      <div
        className="w-full overflow-x-auto"
        style={{ background: "linear-gradient(160deg, #0f1b2d 0%, #0f2f63 55%, #0f1b2d 100%)" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ minWidth: 720, display: "block" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background grid */}
          <defs>
            <pattern id="mill-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>
            <radialGradient id="mill-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(15,47,99,0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect width={W} height={H} fill="url(#mill-grid)" />
          <ellipse cx={W / 2} cy={H / 2} rx={W * 0.55} ry={H * 0.6} fill="url(#mill-glow)" />

          {/* Header */}
          <text x={W / 2} y={38} textAnchor="middle" fontSize={13} fontWeight={700}
            fill="rgba(255,255,255,0.85)" letterSpacing={3} fontFamily="Sora, sans-serif"
            textDecoration="none">
            GEMELO DIGITAL — FLUJO DE PROCESO DE MOLIENDA DE TRIGO
          </text>
          <line x1={W * 0.28} y1={48} x2={W * 0.72} y2={48} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

          {/* Stage labels above */}
          {stages.map((st, i) => (
            <text key={st.id}
              x={st.x + st.w / 2} y={st.y - 14}
              textAnchor="middle" fontSize={9} fontWeight={700}
              fill="rgba(255,255,255,0.45)" letterSpacing={1.5} fontFamily="Manrope, sans-serif">
              ETAPA {i + 1}
            </text>
          ))}
          <text x={packagingCx} y={packagingY - 14} textAnchor="middle" fontSize={9} fontWeight={700}
            fill="rgba(255,255,255,0.45)" letterSpacing={1.5} fontFamily="Manrope, sans-serif">
            ETAPA 7
          </text>

          {/* Flow paths */}
          {paths.map((p) => (
            <FlowArrow key={`${p.from}-${p.to}`} path={p} product={p.product} />
          ))}

          {/* Packaging to output arrow */}
          <defs>
            <path id="pack-out" d={`M${lastStage.x + lastStage.w} ${lastStage.y + lastStage.h / 2} L${packagingX} ${packagingCy}`} />
          </defs>
          <path d={`M${lastStage.x + lastStage.w} ${lastStage.y + lastStage.h / 2} L${packagingX} ${packagingCy}`}
            fill="none" stroke="#f1f5f9" strokeWidth={2.5} strokeDasharray="6 4" opacity={0.4}>
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.4s" repeatCount="indefinite" />
          </path>
          <circle r={4} fill="#f1f5f9" opacity={0.9}>
            <animateMotion dur="2.2s" repeatCount="indefinite">
              <mpath href="#pack-out" />
            </animateMotion>
          </circle>

          {/* Byproduct nodes */}
          <ByproductNode x={260} y={350} label="Impurezas" color="#78350f" />
          <ByproductNode x={840} y={350} label="Salvado" color="#92400e" />
          {/* Germen node */}
          <ByproductNode x={1030} y={350} label="Germen" color="#d97706" />
          {/* Germen arrow from purification */}
          <defs>
            <path id="germ-path"
              d={`M${stages[5].x + stages[5].w / 2} ${stages[5].y + stages[5].h} L${stages[5].x + stages[5].w / 2} ${stages[5].y + stages[5].h + 60} L${1070} ${stages[5].y + stages[5].h + 60}`} />
          </defs>
          <path d={`M${stages[5].x + stages[5].w / 2} ${stages[5].y + stages[5].h} L${stages[5].x + stages[5].w / 2} ${stages[5].y + stages[5].h + 60} L${1070} ${stages[5].y + stages[5].h + 60}`}
            fill="none" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
          <circle r={3} fill="#d97706" opacity={0.8}>
            <animateMotion dur="3s" repeatCount="indefinite">
              <mpath href="#germ-path" />
            </animateMotion>
          </circle>

          {/* Stage nodes */}
          {stages.map((st) => (
            <StageNode
              key={st.id}
              stage={st}
              selected={selectedId === st.id}
              onClick={() => handleStageClick(st.id)}
            />
          ))}

          {/* Packaging output node */}
          <PackagingOutput x={packagingX} y={packagingY} />

          {/* Legend */}
          <g transform={`translate(30, ${H - 52})`}>
            <text fontSize={8} fontWeight={700} fill="rgba(255,255,255,0.4)" letterSpacing={2} fontFamily="Manrope,sans-serif">LEYENDA</text>
            {[
              { color: "#b98656", label: "Flujo trigo/grano" },
              { color: "#f1f5f9", label: "Flujo harina" },
              { color: "#78350f", label: "Subproductos" },
            ].map((item, i) => (
              <g key={item.label} transform={`translate(${i * 155}, 12)`}>
                <line x1={0} y1={4} x2={22} y2={4} stroke={item.color} strokeWidth={2} strokeDasharray="5 3" />
                <circle cx={11} cy={4} r={3} fill={item.color} />
                <text x={26} y={8} fontSize={9} fill="rgba(255,255,255,0.55)" fontFamily="Manrope,sans-serif">{item.label}</text>
              </g>
            ))}
            <g transform="translate(0, 26)">
              {[
                { color: "#10b981", label: "OK" },
                { color: "#f59e0b", label: "Advertencia" },
                { color: "#ef4444", label: "Riesgo" },
              ].map((item, i) => (
                <g key={item.label} transform={`translate(${i * 110}, 0)`}>
                  <circle cx={5} cy={4} r={5} fill={item.color} />
                  <text x={14} y={8} fontSize={9} fill="rgba(255,255,255,0.55)" fontFamily="Manrope,sans-serif">{item.label}</text>
                </g>
              ))}
            </g>
          </g>

          {/* Click hint */}
          <text x={W - 20} y={H - 14} textAnchor="end" fontSize={8.5}
            fill="rgba(255,255,255,0.3)" fontFamily="Manrope,sans-serif">
            Haz clic en una etapa para ver variables y KPIs
          </text>
        </svg>
      </div>

      {/* Detail panel */}
      {selectedStage && (
        <StageDetailPanel
          stage={selectedStage}
          onUpdate={handleUpdate}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
