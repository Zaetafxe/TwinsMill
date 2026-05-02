"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { DigitalTwinBlueprintPanel } from "@/components/DigitalTwinBlueprintPanel";
import { TwinMillFlowBoard } from "@/components/TwinMillFlowBoard";
import { MillProcessDiagram } from "@/components/MillProcessDiagram";
import { DesignImportBanner } from "@/components/DesignImportBanner";
import { DigitalTwinSimView } from "@/components/DigitalTwinSimView";

const ThreeMillView = dynamic(() => import("@/components/ThreeMillView").then((m) => ({ default: m.ThreeMillView })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64 rounded-2xl bg-slate-100 text-slate-400 text-sm">Cargando vista 3D…</div>,
});

export default function TwinMillPage() {
  return (
    <div className="mx-auto max-w-[1520px] px-4 pb-12 md:px-8">
      {/* ── Design import banner (from MillDesignerBuilder) ── */}
      <DesignImportBanner />

      {/* ── Digital Twin Simulation View (when design is available) ── */}
      <DigitalTwinSimView />

      {/* ── Hero header ──────────────────────────────────────── */}
      <header className="pt-6 pb-5">
        <p className="text-[0.7rem] font-bold tracking-[0.18em] uppercase text-blue-700/70">
          Molino Virtual · Gemelo Digital
        </p>
        <h1
          className="mt-1 text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Sora, sans-serif", letterSpacing: "-0.025em" }}
        >
          Centro de Simulación de Molienda
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          Diagrama de proceso interactivo, gemelo digital físico y simulador económico. Registra variables
          por etapa, simula escenarios y analiza resultados en tiempo real.
        </p>
      </header>

      {/* ── Process Flow Diagram ─────────────────────────────── */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[0.68rem] font-bold tracking-[0.16em] uppercase text-slate-400">
              Diagrama de Proceso
            </p>
            <h2
              className="text-lg font-bold text-slate-800"
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              Flujo Completo de Molienda de Trigo
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-900/10 px-3 py-1 text-[0.7rem] font-semibold text-blue-700 border border-blue-200">
              7 etapas · Interactivo
            </span>
            <Link
              href="/disenador"
              className="rounded-xl border border-blue-700 bg-blue-700 px-3 py-1.5 text-[0.7rem] font-bold text-white hover:bg-blue-800 transition-colors shadow-sm"
            >
              + Diseñar mi molino
            </Link>
          </div>
        </div>
        <div className="panel overflow-hidden p-0">
          <MillProcessDiagram />
        </div>
        <p className="mt-2 text-[0.72rem] text-slate-400">
          Haz clic en cualquier etapa del diagrama para ver sus KPIs en tiempo real y ajustar variables de proceso.
          Los cambios se reflejan inmediatamente en los indicadores de cada nodo.
        </p>
      </section>

      {/* ── 3D View ──────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase text-slate-400">
          Visualización 3D
        </p>
        <ThreeMillView />
      </section>

      {/* ── Scenario economic simulator ──────────────────────── */}
      <section className="mb-6">
        <div className="mb-3">
          <p className="text-[0.68rem] font-bold tracking-[0.16em] uppercase text-slate-400">
            Simulador Económico de Escenarios
          </p>
          <h2
            className="text-lg font-bold text-slate-800"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            What-if · Contribución Anual
          </h2>
        </div>
        <TwinMillFlowBoard />
      </section>

      {/* ── Physical twin blueprint ──────────────────────────── */}
      <section>
        <div className="mb-3">
          <p className="text-[0.68rem] font-bold tracking-[0.16em] uppercase text-slate-400">
            Modelo Físico del Gemelo
          </p>
          <h2
            className="text-lg font-bold text-slate-800"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            Simulación Física · Balance de Masa y OEE
          </h2>
        </div>
        <DigitalTwinBlueprintPanel />
      </section>
    </div>
  );
}

