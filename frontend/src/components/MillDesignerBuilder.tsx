"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { runPhysicalTwinModel, type PhysicalModelOutput } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type GrainType = "trigo_blando" | "trigo_duro" | "maiz";

type PhaseKey =
  | "almacenaje"
  | "recepcion"
  | "limpieza"
  | "acondicionamiento"
  | "molienda"
  | "cernido"
  | "terminacion"
  | "empaque";

interface MachineDef {
  id: string;
  code: string;
  label: string;
  phase: PhaseKey;
  iconType: string;
  desc: string;
  capacityMin: number;
  capacityMax: number;
  powerKwPerTon: number;
  required: boolean;
  grains: GrainType[];
  flowFactor: number;
  extractionBonus: number;
  color: string;
  bagSizeKg?: number; // if set, capacity slider shows bolsas/h instead of t/h
  param2?: {
    key: string; label: string; unit: string;
    min: number; max: number; step: number; default: number;
    icon?: string;
  };
}

interface PlacedMachine extends MachineDef {
  instanceId: string;
  configuredCapacity: number;
  param2Value?: number; // current value of the second engineering parameter
}

interface AnalysisResult {
  score: number;
  bottleneck: number;
  bottleneckLabel: string;
  dailyCapacity: number;
  annualCapacity: number;
  warnings: string[];
  recommendations: string[];
  products: Array<{ label: string; yieldPct: number; color: string }>;
  energyKwhPerTon: number;
  extractionPct: number;
}

interface DetailedSimResult {
  throughputTph: number;
  extractionPct: number;
  ashPct: number;
  proteinPct: number;
  energyKwhPerTon: number;
  dailyCapacityTons: number;
  annualCapacityKt: number;
  flourTonPerDay: number;
  branTonPerDay: number;
  temperingHours: number;
  bottleneckLabel: string;
  bottleneckTph: number;
  score: number;
  stageBalance: Array<{
    stage: string; inputTph: number; outputTph: number; lossTph: number;
    lossKgPerTon: number; loadPct: number; efficiencyPct: number;
    energyKwhPerTon: number; status: "ok" | "overload" | "underload" | "critical";
  }>;
  products: Array<{ label: string; yieldPct: number; tonPerDay: number; color: string }>;
  warnings: string[];
  recommendations: string[];
}

/* ═══════════════════════════════════════════════════════════
   MACHINE CATALOG  (datos reales basados en Prillwitz + Idugel)
═══════════════════════════════════════════════════════════ */
const PHASE_META: Record<PhaseKey, { label: string; color: string; order: number; icon: string; desc: string }> = {
  almacenaje:         { label: "Almacenaje de Grano",  color: "#5a7a4a", order: -1, icon: "🌾", desc: "Recepción de grano desde campo: foso, balanza camión, silos de hormigón/cemento, secado, aireación y termometría" },
  recepcion:          { label: "Recepción",            color: "#b98656", order: 0,  icon: "🏗",  desc: "Ingreso, pesaje y almacenamiento inicial de grano en bruto" },
  limpieza:           { label: "Limpieza",             color: "#3b74d4", order: 1, icon: "🧹", desc: "Separación de impurezas: piedras, metales, polvos, insectos y materias extrañas" },
  acondicionamiento:  { label: "Acondicionamiento",    color: "#0ea5e9", order: 2, icon: "💧", desc: "Humectación controlada + reposo en silos para ablandar el salvado del endospermo" },
  molienda:           { label: "Molienda",             color: "#7c3aed", order: 3, icon: "⚙️",  desc: "Reducción progresiva del endospermo a partículas de harina mediante bancos de cilindros" },
  cernido:            { label: "Cernido",              color: "#059669", order: 4, icon: "📊", desc: "Clasificación y purificación granulométrica: separa harinas, semolín y salvado" },
  terminacion:        { label: "Terminación",          color: "#d97706", order: 5, icon: "🏭", desc: "Almacenamiento de harinas clasificadas, recuperación de polvo y control ambiental" },
  empaque:            { label: "Empaque / Despacho",   color: "#dc2626", order: 6, icon: "📦", desc: "Envasado en presentaciones comerciales (5–50 kg) y despacho a granel en camión" },
};

const ALL_MACHINES: MachineDef[] = [
  /* ─── ALMACENAJE DE GRANO (campo → silo → planta) ─────── */
  { id:"foso_receptor",  code:"FRP",   label:"Foso Receptor",              phase:"almacenaje", iconType:"pit",      desc:"Foso de recepción de camiones: descarga directa desde campo. Capacidad de recepción 20–200 t/h.",         capacityMin:20,   capacityMax:200,  powerKwPerTon:0.08, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#5a7a4a", param2:{key:"humCampo",label:"H° campo",unit:"%",min:8,max:22,step:0.5,default:12,icon:"💧"} },
  { id:"balanza_camion", code:"BCP",   label:"Balanza Puente de Camión",   phase:"almacenaje", iconType:"truck",    desc:"Pesaje gravimétrico de camiones a la entrada y salida. Trazabilidad total de recepción.",                  capacityMin:30,   capacityMax:120,  powerKwPerTon:0.0,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#5a7a4a" },
  { id:"silo_hormigon",  code:"SHC",   label:"Silo de Hormigón/Cemento",   phase:"almacenaje", iconType:"silo",     desc:"Almacenamiento hermético en silos de concreto armado (500–30 000 t). Mejor control térmico e higroscópico.", capacityMin:500,  capacityMax:30000, powerKwPerTon:0.02, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,  extractionBonus:0,   color:"#5a7a4a", param2:{key:"humAlmac",label:"H° almacenado",unit:"%",min:8,max:18,step:0.1,default:13,icon:"💧"} },
  { id:"almacen_plano",  code:"ALP",   label:"Almacén / Bodega Industrial", phase:"almacenaje", iconType:"stack",    desc:"Bodega plana o nave industrial para almacenaje a granel (1 000–30 000 t). Ideal para grandes volúmenes campañas.", capacityMin:1000, capacityMax:30000, powerKwPerTon:0.01, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,  extractionBonus:0,   color:"#5a7a4a", param2:{key:"humAlmacBodega",label:"H° bodega",unit:"%",min:8,max:18,step:0.1,default:13,icon:"💧"} },
  { id:"trans_banda",    code:"TBP",   label:"Transportador de Banda",     phase:"almacenaje", iconType:"conveyor", desc:"Transporte horizontal de grano entre foso, silos y pre-limpieza. Ideal largas distancias (10–80 t/h).",   capacityMin:10,   capacityMax:80,   powerKwPerTon:0.30, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.999, extractionBonus:0,   color:"#5a7a4a" },
  { id:"aireacion_silo", code:"AIRS",  label:"Sistema de Aireación",       phase:"almacenaje", iconType:"wind",     desc:"Ventiladores e insuflación de aire frío para conservar calidad del grano en silos (50–30 000 t silo).",   capacityMin:50,   capacityMax:30000, powerKwPerTon:0.04, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0.1, color:"#5a7a4a", param2:{key:"tempTarget",label:"T° objetivo",unit:"°C",min:5,max:25,step:1,default:15,icon:"🌡️"} },
  { id:"termometria",    code:"TMD",   label:"Termometría Digital",        phase:"almacenaje", iconType:"sensor",   desc:"Cables de termometría para monitoreo continuo de temperatura en silos. Previene infestaciones.",           capacityMin:100,  capacityMax:30000, powerKwPerTon:0.0,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#5a7a4a", param2:{key:"tempAlarma",label:"T° alarma",unit:"°C",min:18,max:40,step:1,default:28,icon:"⚠️"} },
  { id:"secadora_grano", code:"SGD",   label:"Secadora de Grano",          phase:"almacenaje", iconType:"dryer",    desc:"Secado continuo de grano húmedo (>14%) antes de almacenaje largo plazo. Reduce pérdidas por hongos (5–40 t/h).", capacityMin:5, capacityMax:40, powerKwPerTon:4.0, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.998, extractionBonus:0.3, color:"#5a7a4a", param2:{key:"humEntrada",label:"H° entrada",unit:"%",min:12,max:25,step:0.5,default:16,icon:"💧"} },
  { id:"prelimpiadora",  code:"PRL",   label:"Pre-limpiadora/Scalperator", phase:"almacenaje", iconType:"sieve",    desc:"Separación gruesa de impurezas antes de silos: paja, piedras grandes, materias voluminosas (10–80 t/h).",  capacityMin:10,   capacityMax:80,   powerKwPerTon:0.35, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.985, extractionBonus:0,   color:"#5a7a4a" },

  /* RECEPCIÓN */
  { id:"silo_mp",       code:"SILO-MP",  label:"Silo Materia Prima",      phase:"recepcion",  iconType:"silo",    desc:"Almacenamiento de grano en silos metálicos o de tela (50–30 000 t).",   capacityMin:50,   capacityMax:30000, powerKwPerTon:0.05, required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#b98656", param2:{key:"humGrano",label:"H° grano recibido",unit:"%",min:8,max:18,step:0.1,default:13,icon:"💧"} },
  { id:"elevador",      code:"BWG",      label:"Elevador Cangilones",      phase:"recepcion",  iconType:"elevator",desc:"Transporte vertical eficiente para grano seco (10–80 t/h).",              capacityMin:10,   capacityMax:80,   powerKwPerTon:0.8,  required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.999, extractionBonus:0,   color:"#b98656" },
  { id:"balanza",       code:"BSS",      label:"Balanza de Flujo",         phase:"recepcion",  iconType:"balance", desc:"Medición gravimétrica continua del caudal (5–50 t/h).",                 capacityMin:5,    capacityMax:50,   powerKwPerTon:0.05, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#b98656" },

  /* LIMPIEZA */
  { id:"zaranda",       code:"RSVM",     label:"Zaranda Vibratoria",       phase:"limpieza",   iconType:"sieve",   desc:"Separación de impurezas gruesas y finas por tamizado vibratorio (5–50 t/h).", capacityMin:5,  capacityMax:50,   powerKwPerTon:0.4,  required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.980, extractionBonus:0,   color:"#0f2f63" },
  { id:"despedradora",  code:"DPR",      label:"Despedradora Gravimétrica",phase:"limpieza",   iconType:"stone",   desc:"Eliminación de piedras por densidad diferencial en mesa de aire (3–20 t/h).", capacityMin:3, capacityMax:20,   powerKwPerTon:0.3,  required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.997, extractionBonus:0,   color:"#0f2f63" },
  { id:"sep_mag",       code:"TM",       label:"Trampa Magnética",         phase:"limpieza",   iconType:"magnet",  desc:"Captura partículas ferrosas para proteger equipos aguas abajo (pasivo).",   capacityMin:10,  capacityMax:80,   powerKwPerTon:0.0,  required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.9995,extractionBonus:0,   color:"#0f2f63" },
  { id:"sep_discos",    code:"SDA",      label:"Separador a Discos",       phase:"limpieza",   iconType:"disc",    desc:"Clasifica granos por forma con discos alveolados (5–30 t/h).",              capacityMin:5,  capacityMax:30,   powerKwPerTon:0.5,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.990, extractionBonus:0,   color:"#0f2f63" },
  { id:"triarvejon",    code:"HSR",      label:"Triarvejón",               phase:"limpieza",   iconType:"trieur",  desc:"Trieur alveolar separa por longitud de partícula (3–15 t/h).",              capacityMin:3,  capacityMax:15,   powerKwPerTon:0.5,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:0.993, extractionBonus:0,   color:"#0f2f63" },
  { id:"despuntadora",  code:"RHS",      label:"Despuntadora / Escarif.",  phase:"limpieza",   iconType:"brush",   desc:"Limpieza superficial del grano y eliminación de barba (5–25 t/h).",        capacityMin:5,  capacityMax:25,   powerKwPerTon:1.2,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:0.986, extractionBonus:0.3, color:"#0f2f63" },
  { id:"tarara",        code:"TC",       label:"Tarara Cilíndrica",        phase:"limpieza",   iconType:"wind",    desc:"Clasificación neumática por peso/densidad del grano (3–18 t/h).",          capacityMin:3,  capacityMax:18,   powerKwPerTon:0.6,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.992, extractionBonus:0,   color:"#0f2f63" },

  /* ACONDICIONAMIENTO */
  { id:"mojador",       code:"DAGH",     label:"Mojador / Humectador",     phase:"acondicionamiento", iconType:"drop",    desc:"Dosificación automática de agua para acondicionamiento del grano (5–30 t/h).", capacityMin:5, capacityMax:30, powerKwPerTon:0.1, required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.015, extractionBonus:1.2, color:"#0ea5e9", param2:{key:"humTarget",label:"H° objetivo reposo",unit:"%",min:13,max:18,step:0.1,default:15.5,icon:"🎯"} },
  { id:"silo_reposo",   code:"SR",       label:"Silos de Reposo",          phase:"acondicionamiento", iconType:"tank",    desc:"Almacenamiento de reposo post-humectación (12–36 h para trigo, 4–8 h maíz).", capacityMin:50, capacityMax:2000, powerKwPerTon:0.0, required:true, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0.8, color:"#0ea5e9", param2:{key:"humReposo",label:"H° en reposo",unit:"%",min:13,max:18,step:0.1,default:15.5,icon:"💧"} },

  /* MOLIENDA */
  { id:"banco_cil_1",   code:"BCH-1",    label:"Banco Cilindros 1°",       phase:"molienda",   iconType:"rollers", desc:"Primer banco de cilindros corrugados: rotura del grano (4–24 t/h).",         capacityMin:4,  capacityMax:24,   powerKwPerTon:12.0, required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#7c3aed", param2:{key:"rollerGap",label:"Luz cilindros",unit:"μm",min:80,max:500,step:10,default:280,icon:"⚙️"} },
  { id:"banco_cil_2",   code:"BCH-2",    label:"Banco Cilindros 2°",       phase:"molienda",   iconType:"rollers", desc:"Segundo banco (lisos): reducción del endospermo (4–24 t/h).",               capacityMin:4,  capacityMax:24,   powerKwPerTon:10.0, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:1.5, color:"#7c3aed", param2:{key:"rollerGap",label:"Luz cilindros",unit:"μm",min:40,max:300,step:5,default:150,icon:"⚙️"} },
  { id:"banco_cil_3",   code:"BCH-3",    label:"Banco Cilindros 3°",       phase:"molienda",   iconType:"rollers", desc:"Tercer banco: reducción final y compactado del endospermo (4–20 t/h).",     capacityMin:4,  capacityMax:20,   powerKwPerTon:9.0,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:1.0,   extractionBonus:1.2, color:"#7c3aed", param2:{key:"rollerGap",label:"Luz cilindros",unit:"μm",min:20,max:200,step:5,default:80,icon:"⚙️"} },
  { id:"detacheur",     code:"HDR",      label:"Détacheur",                phase:"molienda",   iconType:"spin",    desc:"Desglose de aglomerados entre pases de molienda (3–15 t/h).",               capacityMin:3,  capacityMax:15,   powerKwPerTon:2.0,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:1.0,   extractionBonus:0.4, color:"#7c3aed" },
  { id:"mol_martillos", code:"SIGMA",    label:"Molino a Martillos",       phase:"molienda",   iconType:"hammer",  desc:"Molienda por impacto para harinas gruesas y subproductos (2–20 t/h).",      capacityMin:2,  capacityMax:20,   powerKwPerTon:25.0, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#7c3aed" },

  /* CERNIDO */
  { id:"plansichter",   code:"PC",       label:"Plansichter / Plansifter", phase:"cernido",    iconType:"grid",    desc:"Clasificación integral de harinas y semolín en plano oscilante (5–30 t/h).", capacityMin:5, capacityMax:30,   powerKwPerTon:3.0,  required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.995, extractionBonus:0.8, color:"#059669", param2:{key:"siftEff",label:"Efic. cernido",unit:"%",min:85,max:99,step:0.5,default:96,icon:"📊"} },
  { id:"sasor",         code:"SGVM",     label:"Sasor",                    phase:"cernido",    iconType:"funnel",  desc:"Purificación de semolín: separa endospermo de salvado residual (2–10 t/h).", capacityMin:2, capacityMax:10,   powerKwPerTon:1.5,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:0.970, extractionBonus:0.9, color:"#059669", param2:{key:"meshSize",label:"Malla purif.",unit:"μm",min:100,max:400,step:10,default:200,icon:"🔲"} },
  { id:"cernid_conico", code:"CC",       label:"Cernidor Cónico",          phase:"cernido",    iconType:"cone",    desc:"Control de calidad final de harina mediante malla cónica rotativa (2–15 t/h).", capacityMin:2, capacityMax:15,  powerKwPerTon:0.8,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.998, extractionBonus:0,   color:"#059669" },
  { id:"cernid_centr",  code:"HVS",      label:"Cernidor Centrífugo",      phase:"cernido",    iconType:"spin",    desc:"Alta capacidad de cernido centrífugo para harinas ultrafinas (2–15 t/h).",   capacityMin:2, capacityMax:15,   powerKwPerTon:1.2,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.996, extractionBonus:0.3, color:"#059669" },

  /* TERMINACIÓN */
  { id:"cepilladora",   code:"CA",       label:"Cepilladora de Afrecho",   phase:"terminacion",iconType:"brush",   desc:"Extrae harina residual adherida al salvado, mejora rendimiento ~0.4% (2–12 t/h).", capacityMin:2, capacityMax:12,  powerKwPerTon:3.0,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:1.020, extractionBonus:0.5, color:"#d97706" },
  { id:"silo_harina",   code:"SH",       label:"Silos de Harina",          phase:"terminacion",iconType:"tank",    desc:"Almacenamiento intermedio de harinas clasificadas por tipo (10–1000 t).",    capacityMin:10,  capacityMax:1000, powerKwPerTon:0.1,  required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#d97706", param2:{key:"humHarina",label:"H° harina",unit:"%",min:12,max:16,step:0.1,default:14.5,icon:"💧"} },
  { id:"filtro_mangas", code:"HDFA",     label:"Filtro de Mangas",         phase:"terminacion",iconType:"filter",  desc:"Colector de polvo para control ambiental y recuperación de harina fina (5–60 t/h).", capacityMin:5, capacityMax:60,  powerKwPerTon:0.5,  required:true,  grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.005, extractionBonus:0.2, color:"#d97706" },

  /* EMPAQUE — múltiples presentaciones comerciales */
  { id:"embolsadora_5kg",  code:"EMB-5",   label:"Embolsadora 5 kg",      phase:"empaque", iconType:"bag",  bagSizeKg:5,  desc:"Envasado automático en bolsas de 5 kg — retail y supermercados. Hasta 2000 bolsas/h.",              capacityMin:2,  capacityMax:10, powerKwPerTon:2.2, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.998,  extractionBonus:0, color:"#dc2626" },
  { id:"embolsadora_10kg", code:"EMB-10",  label:"Embolsadora 10 kg",     phase:"empaque", iconType:"bag",  bagSizeKg:10, desc:"Envasado en bolsas de 10 kg — panaderías y pastelerías. Hasta 1000 bolsas/h.",                  capacityMin:3,  capacityMax:12, powerKwPerTon:1.9, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.998,  extractionBonus:0, color:"#dc2626" },
  { id:"embolsadora_25kg", code:"EMB-25",  label:"Embolsadora 25 kg",     phase:"empaque", iconType:"bag",  bagSizeKg:25, desc:"Envasado en bolsas de 25 kg — distribución gastronómica e industrial. Hasta 700 bolsas/h.",       capacityMin:5,  capacityMax:18, powerKwPerTon:1.6, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.9985,extractionBonus:0, color:"#dc2626" },
  { id:"embolsadora_50kg", code:"EMB-50",  label:"Embolsadora 50 kg",     phase:"empaque", iconType:"bag",  bagSizeKg:50, desc:"Ensacado en sacos de 50 kg boca abierta — industria molinera y exportación. Hasta 700 sacos/h.",  capacityMin:10, capacityMax:35, powerKwPerTon:1.5, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.9985,extractionBonus:0, color:"#dc2626" },
  { id:"despacho_granel",  code:"TG",      label:"Despacho a Granel",     phase:"empaque", iconType:"truck",             desc:"Carga directa a camión cisterna o contenedor. Mínimo costo por tonelada (5–40 t/h).",             capacityMin:5,  capacityMax:40, powerKwPerTon:0.3, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0, color:"#dc2626" },

  /* LIMPIEZA — adicionales */
  { id:"selector_optico", code:"OPT",  label:"Selector Óptico / Color",   phase:"limpieza",   iconType:"scan",  desc:"Clasificación electrónica por color y forma. Elimina granos dañados, manchados e impurezas resistentes (2–15 t/h).", capacityMin:2,  capacityMax:15,   powerKwPerTon:1.2,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.994, extractionBonus:0.2, color:"#0f2f63" },
  { id:"lavadora",         code:"TLW",  label:"Lavadora / Mojadora Grano", phase:"limpieza",   iconType:"drop",  desc:"Lavado superficial y eliminación de polvos, hongos adheridos y residuos agroquímicos (3–20 t/h).",               capacityMin:3,  capacityMax:20,   powerKwPerTon:1.8,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:0.990, extractionBonus:0.4, color:"#0f2f63" },

  /* ACONDICIONAMIENTO — adicionales */
  { id:"mojador_intensivo", code:"DAGH-I", label:"Mojador Intensivo",        phase:"acondicionamiento", iconType:"drop", desc:"Humedecimiento instantáneo de alta presión para trigos muy secos. Acorta el ciclo de reposo (3–20 t/h).", capacityMin:3,  capacityMax:20,  powerKwPerTon:0.15, required:false, grains:["trigo_blando","trigo_duro"], flowFactor:1.018, extractionBonus:1.5, color:"#0ea5e9" },
  { id:"segunda_agua",      code:"SM-2",   label:"Segunda Humedecida",       phase:"acondicionamiento", iconType:"drop", desc:"Segunda humectación en corto reposo (1–2 h) antes de molienda para ajuste fino de humedad (3–20 t/h).",  capacityMin:3,  capacityMax:20,  powerKwPerTon:0.08, required:false, grains:["trigo_blando","trigo_duro"], flowFactor:1.010, extractionBonus:0.8, color:"#0ea5e9" },

  /* MOLIENDA — adicionales */
  { id:"entoleter",    code:"ENT",    label:"Entoleter / Dest. Insectos",  phase:"molienda",   iconType:"spin",    desc:"Destructor centrífugo de insectos y huevos antes del primer banco. Exigencia HACCP (2–15 t/h).",             capacityMin:2,  capacityMax:15,  powerKwPerTon:1.5,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.999, extractionBonus:0,   color:"#7c3aed" },
  { id:"laminador",    code:"LAM",    label:"Banco Laminador (Reducción)", phase:"molienda",   iconType:"rollers", desc:"Cilindros lisos para laminado final de semolín y aplanado de partículas en cola de molienda (3–20 t/h).",  capacityMin:3,  capacityMax:20,  powerKwPerTon:7.0,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:1.0,   extractionBonus:0.8, color:"#7c3aed" },

  /* CERNIDO — adicionales */
  { id:"bran_finisher", code:"BRF",   label:"Finalizador de Afrecho",     phase:"cernido",    iconType:"brush",   desc:"Extrae harina residual del salvado por impacto y fricción. Recupera 1.5–2% extra de rendimiento (1–8 t/h).",  capacityMin:1,  capacityMax:8,   powerKwPerTon:4.0,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:1.025, extractionBonus:1.2, color:"#059669" },
  { id:"sep_germen",    code:"GER-S", label:"Separador de Germen",        phase:"cernido",    iconType:"disc",    desc:"Aísla el germen como subproducto independiente de alto valor para industria del aceite (2–12 t/h).",          capacityMin:2,  capacityMax:12,  powerKwPerTon:1.8,  required:false, grains:["maiz"],                            flowFactor:0.985, extractionBonus:0,   color:"#059669" },

  /* TERMINACIÓN — adicionales */
  { id:"mezclador_harina",  code:"MH",   label:"Mezclador de Harinas",      phase:"terminacion", iconType:"spin",   desc:"Homogenización de lotes para estandarizar proteína y cenizas entre silos de harina (5–50 t/h).",              capacityMin:5,  capacityMax:50,  powerKwPerTon:0.8,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#d97706" },
  { id:"dosif_aditivos",    code:"DA",   label:"Dosificador de Aditivos",   phase:"terminacion", iconType:"drop",   desc:"Adición automática de mejorantes (ácido ascórbico, enzimas, DATEM) en línea continua (5–50 t/h).",          capacityMin:5,  capacityMax:50,  powerKwPerTon:0.2,  required:false, grains:["trigo_blando","trigo_duro"],       flowFactor:1.0,   extractionBonus:0,   color:"#d97706" },
  { id:"enfriador_harina",  code:"EH",   label:"Enfriador de Harina",       phase:"terminacion", iconType:"wind",   desc:"Reduce temperatura de harina caliente post-molienda a <25 °C para conservar proteína (5–30 t/h).",          capacityMin:5,  capacityMax:30,  powerKwPerTon:0.6,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0,   color:"#d97706" },
  { id:"trans_neumatico",   code:"TN",   label:"Transporte Neumático",      phase:"terminacion", iconType:"wind",   desc:"Transporte en suspensión con aire comprimido. Conecta molienda, cernido y silos de harina (5–60 t/h).",      capacityMin:5,  capacityMax:60,  powerKwPerTon:2.5,  required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.003, extractionBonus:0.1, color:"#d97706" },

  /* EMPAQUE — adicionales */
  { id:"big_bag",       code:"BBG",   label:"Big Bag / Jumbo 500 kg",      phase:"empaque", iconType:"bag",   bagSizeKg:500, desc:"Ensacado en big bags de 500–1000 kg para exportación, industria harinera y despacho mayorista.",           capacityMin:5,  capacityMax:30, powerKwPerTon:1.2, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:0.999, extractionBonus:0, color:"#dc2626" },
  { id:"paletizador",   code:"PAL",   label:"Paletizador Automático",      phase:"empaque", iconType:"stack", desc:"Paletizado automático de bolsas/sacos en línea. Reduce mano de obra y homogeniza pallets (5–30 t/h).",       capacityMin:5,  capacityMax:30, powerKwPerTon:0.8, required:false, grains:["trigo_blando","trigo_duro","maiz"], flowFactor:1.0,   extractionBonus:0, color:"#dc2626" },
];

/* ═══════════════════════════════════════════════════════════
   TEMPLATES
═══════════════════════════════════════════════════════════ */
type TemplateKey = "basico" | "intermedio" | "completo";
const TEMPLATES: Record<TemplateKey, { label: string; desc: string; machineIds: string[]; capacities: number[] }> = {
  basico: {
    label: "Básico 50 t/d",
    desc: "Estructura mínima para operación segura",
    machineIds: ["silo_mp","elevador","zaranda","despedradora","sep_mag","mojador","silo_reposo","banco_cil_1","plansichter","silo_harina","filtro_mangas","embolsadora_25kg"],
    capacities:  [2200,      20,        15,         10,           30,        8,         300,          8,             12,             200,           20,              8],
  },
  intermedio: {
    label: "Intermedio 150 t/d",
    desc: "Equilibrio rendimiento / complejidad",
    machineIds: ["silo_mp","elevador","balanza","zaranda","despedradora","sep_mag","sep_discos","tarara","mojador","silo_reposo","banco_cil_1","banco_cil_2","detacheur","plansichter","sasor","cernid_conico","silo_harina","filtro_mangas","embolsadora_25kg"],
    capacities:  [5000,      40,        30,        30,         15,           50,        18,           12,       15,       500,           12,             12,             10,           20,             6,              8,             500,           40,              10],
  },
  completo: {
    label: "Completo 300 t/d",
    desc: "Alta extracción con calidad premium",
    machineIds: ["silo_mp","elevador","balanza","zaranda","despedradora","sep_mag","sep_discos","triarvejon","despuntadora","tarara","mojador","silo_reposo","banco_cil_1","banco_cil_2","banco_cil_3","detacheur","plansichter","sasor","cernid_conico","cernid_centr","cepilladora","silo_harina","filtro_mangas","embolsadora_25kg","despacho_granel"],
    capacities:  [8000,      70,        40,        45,         20,           70,        25,           12,          20,           15,   24,        600,           22,             20,             18,             15,           28,             9,              12,             12,             8,             800,           60,               15,              20],
  },
};

/* ═══════════════════════════════════════════════════════════
   AI ANALYSIS ENGINE
═══════════════════════════════════════════════════════════ */
function analyzeDesign(
  pipeline: PlacedMachine[],
  grain: GrainType,
  hoursPerDay: number,
  availabilityPct: number,
): AnalysisResult {
  const empty: AnalysisResult = {
    score: 0, bottleneck: 0, bottleneckLabel: "—", dailyCapacity: 0, annualCapacity: 0,
    warnings: [], recommendations: [], products: [], energyKwhPerTon: 0, extractionPct: 0,
  };
  if (pipeline.length === 0) return empty;

  // Bottleneck — exclude storage silos + packaging machines (they don't limit milling throughput)
  const _processLine = pipeline.filter(m => !STORAGE_IDS.has(m.id) && m.phase !== "empaque" && m.phase !== "almacenaje");
  const _activeLine = _processLine.length > 0 ? _processLine : pipeline;
  const bottleneck = _activeLine.length > 0 ? Math.min(..._activeLine.map((m) => m.configuredCapacity)) : 0;
  const bottleneckMachine = _activeLine.find((m) => m.configuredCapacity === bottleneck) ?? pipeline[0];
  const maxCap = _activeLine.length > 0 ? Math.max(..._activeLine.map((m) => m.configuredCapacity)) : 0;

  // Daily / annual
  const dailyCapacity = bottleneck * hoursPerDay * (availabilityPct / 100);
  const annualCapacity = dailyCapacity * 300;

  // Extraction
  let baseExtraction = grain === "maiz" ? 68 : 75;
  pipeline.forEach((m) => { baseExtraction += m.extractionBonus; });
  const extractionPct = Math.min(grain === "maiz" ? 80 : 83, Math.round(baseExtraction * 10) / 10);

  // Energy
  const energyKwhPerTon = pipeline.reduce((s, m) => s + m.powerKwPerTon, 0);

  // Presence checks
  const has = (id: string) => pipeline.some((m) => m.id === id);
  const hasPhase = (phase: PhaseKey) => pipeline.some((m) => m.phase === phase);
  const requiredMachines = ALL_MACHINES.filter((m) => m.required && m.grains.includes(grain));
  const missingRequired = requiredMachines.filter((req) => !has(req.id));

  const warnings: string[] = [];
  const recommendations: string[] = [];

  missingRequired.forEach((m) => warnings.push(`Equipo requerido faltante: ${m.label} (${m.code})`));
  if (!hasPhase("limpieza")) warnings.push("Sin etapa de limpieza — riesgo de contaminación en harina.");
  if (!hasPhase("molienda")) warnings.push("Sin banco de molienda — proceso incompleto.");
  if (!hasPhase("cernido")) warnings.push("Sin cernido/plansichter — no hay clasificación de producto.");
  if (maxCap > 0 && bottleneck < maxCap * 0.55) {
    warnings.push(`Cuello de botella severo: ${bottleneckMachine?.label} limita a ${bottleneck.toFixed(1)} t/h vs máquinas de ${maxCap.toFixed(1)} t/h.`);
  }

  // Phase order validation
  const phaseOrdersByPos = pipeline.map((m) => PHASE_META[m.phase].order);
  for (let i = 1; i < phaseOrdersByPos.length; i++) {
    if (phaseOrdersByPos[i] < phaseOrdersByPos[i - 1] - 2) {
      warnings.push(`Orden atípico: ${pipeline[i].label} aparece antes de etapas previas en el flujo.`);
      break;
    }
  }

  if (!has("sasor") && grain !== "maiz") recommendations.push("Añadir Sasor (SGVM): +0.9% extracción y pureza de semolín mejorada.");
  if (!has("cepilladora") && grain !== "maiz") recommendations.push("Cepilladora (CA) recupera harina del salvado: +0.5% extracción.");
  if (!has("banco_cil_2")) recommendations.push("2° Banco de Cilindros (BCH-2): +1.5% extracción por reducción adicional.");
  if (!has("filtro_mangas")) recommendations.push("Filtro de Mangas (HDFA) es requerido por normativa ambiental industrial.");
  if (!has("sep_mag")) recommendations.push("Trampa Magnética (TM) protege equipos y calidad de producto.");
  if (!hasPhase("empaque")) recommendations.push("Completar con embolsadora o tolva a granel para circuito cerrado.");
  if (!has("balanza")) recommendations.push("Balanza de Flujo (BSS) mejora trazabilidad y rendimiento de gestión.");

  // Products
  const products: AnalysisResult["products"] = [];
  if (grain === "trigo_blando" || grain === "trigo_duro") {
    const harina000 = extractionPct * 0.55;
    const harina0000 = extractionPct > 79 ? extractionPct * 0.20 : 0;
    const semolin = extractionPct * 0.09;
    const salvado = 14 - Math.max(0, extractionPct - 76) * 0.3;
    products.push({ label: grain === "trigo_duro" ? "Harina 00 / pasta" : "Harina 000 panadera", yieldPct: harina000, color: "#f8fafc" });
    if (harina0000 > 0) products.push({ label: "Harina 0000 pastera", yieldPct: harina0000, color: "#f1f5f9" });
    products.push({ label: "Semolín",               yieldPct: semolin, color: "#fef9c3" });
    products.push({ label: "Salvado / Afrecho",     yieldPct: salvado, color: "#92400e" });
    products.push({ label: "Germen",                yieldPct: 3,       color: "#d97706" });
  } else {
    products.push({ label: "Sémola de maíz / Polenta", yieldPct: extractionPct * 0.50, color: "#fef9c3" });
    products.push({ label: "Gritz / Grits",             yieldPct: extractionPct * 0.30, color: "#fef08a" });
    products.push({ label: "Harina fina de maíz",       yieldPct: extractionPct * 0.20, color: "#f8fafc" });
    products.push({ label: "Salvado",                   yieldPct: 15,                   color: "#92400e" });
    products.push({ label: "Germen",                    yieldPct: 8,                    color: "#d97706" });
  }

  // Score (0–100)
  const reqScore = ((requiredMachines.length - missingRequired.length) / requiredMachines.length) * 40;
  const balanceScore = maxCap > 0 ? (bottleneck / maxCap) * 20 : 0;
  const envScore = has("filtro_mangas") ? 10 : 0;
  const complexityScore = Math.min(20, pipeline.length * 1.2);
  const safetyScore = has("sep_mag") ? 10 : 0;
  const score = Math.min(100, Math.round(reqScore + balanceScore + envScore + complexityScore + safetyScore));

  return { score, bottleneck, bottleneckLabel: bottleneckMachine?.label ?? "—", dailyCapacity, annualCapacity, warnings, recommendations, products, energyKwhPerTon, extractionPct };
}

// ============================================================
// PHYSICS-BASED DIGITAL TWIN SIMULATION ENGINE
// (Modelo de ingeniero molinero experto - sensibilidad real)
// ============================================================
const STORAGE_IDS = new Set(["silo_mp", "silo_reposo", "silo_harina", "silo_hormigon", "almacen_plano", "foso_receptor", "balanza_camion", "trans_banda", "aireacion_silo", "termometria", "secadora_grano", "prelimpiadora"]);
// Packaging runs on its own schedule — excluded from milling-line bottleneck calculation
// We exclude by phase so any new empaque machine added is automatically excluded
const FLOW_EXCLUDED_IDS = STORAGE_IDS; // empaque phase is filtered separately by m.phase !== "empaque"

function runDetailedSimulation(
  pipeline: PlacedMachine[],
  grain: GrainType,
  hoursPerDay: number,
  availabilityPct: number,
): DetailedSimResult | null {
  const has  = (id: string) => pipeline.some(m => m.id === id);
  const get  = (id: string) => pipeline.find(m => m.id === id);
  const hasPhase = (ph: PhaseKey) => pipeline.some(m => m.phase === ph);
  const flowMachines = pipeline.filter(m => !FLOW_EXCLUDED_IDS.has(m.id) && m.phase !== "empaque" && m.phase !== "almacenaje");
  if (flowMachines.length === 0) return null;

  // 1. THROUGHPUT — bottleneck of all flow machines
  const bottleneckM = flowMachines.reduce((mn, m) => m.configuredCapacity < mn.configuredCapacity ? m : mn);
  const throughputTph = bottleneckM.configuredCapacity;
  const dailyCapacityTons = throughputTph * hoursPerDay * (availabilityPct / 100);

  // 2. TEMPERING TIME — silo capacity / throughput = rest hours (critical!)
  const siloReposo = get("silo_reposo");
  const temperingHours = siloReposo && throughputTph > 0 ? siloReposo.configuredCapacity / throughputTph : 0;

  // 3. Load-factor helper
  const lf = (m: PlacedMachine) => throughputTph / m.configuredCapacity;

  // 4. CONTINUOUS QUALITY CURVE — every capacity slider produces a measurable output change
  // Optimal zone: 0.65–0.88. Below = underload (thin bed, poor separation).
  // Above = overload (insufficient dwell time, degraded quality).
  const lfQuality = (lfVal: number): number => {
    if (lfVal >= 0.65 && lfVal <= 0.88) return 1.0;
    if (lfVal > 0.88) return Math.max(0.05, 1.0 - (lfVal - 0.88) * 3.8);
    return 0.20 + (lfVal / 0.65) * 0.80; // 20% at lf→0, 100% at lf=0.65
  };

  // 5. EXTRACTION — fully continuous: every ±1 t/h on any slider produces visible change
  const baseExt = grain === "maiz" ? 64.0 : grain === "trigo_duro" ? 71.0 : 73.5;
  let ext = baseExt;

  // 5a. Cleaning — continuous effect on impurity carry-through
  if (!hasPhase("limpieza")) {
    ext -= 3.8;
  } else {
    const zaranda = get("zaranda");
    if (!zaranda) {
      ext -= 2.5;
    } else {
      const lfZ = lf(zaranda);
      // Underload → grain bed too thin, impurities not properly lifted/separated
      ext += (lfQuality(lfZ) - 1.0) * 2.2;
      if (lfZ > 0.88) ext -= (lfZ - 0.88) * 14; // overload → impurities pass to mill
    }
    if (!has("despedradora")) {
      ext -= 1.6;
    } else {
      const lfD = lf(get("despedradora")!);
      ext += (lfQuality(lfD) - 1.0) * 0.9; // stones → roller damage → extraction loss
    }
    if (has("despuntadora"))  ext += 0.30;
    if (has("tarara"))        ext += 0.20;
    if (has("sep_discos")) {
      const lfSD = lf(get("sep_discos")!);
      ext += lfQuality(lfSD) * 0.15;
    }
    if (has("triarvejon")) {
      const lfTV = lf(get("triarvejon")!);
      ext += lfQuality(lfTV) * 0.15;
    }
  }

  // 5b. Conditioning — most sensitive variable in wheat milling
  if (!has("mojador")) {
    ext -= 2.8; // no conditioning: bran adheres tightly to endosperm
  } else {
    const mojador = get("mojador")!;
    const lfM = lf(mojador);
    // param2Value = target conditioning moisture — most critical variable in wheat milling
    const mojadorMoistureTarget = mojador.param2Value ?? 15.5;
    const optMoist = grain === "trigo_duro" ? 16.0 : grain === "maiz" ? 14.5 : 15.5;
    const moistDev = Math.abs(mojadorMoistureTarget - optMoist);
    const moistFactor = Math.max(0.25, 1.0 - moistDev * 0.22); // ±1% = −22% effect
    // Overloaded mojador → uneven water dosing, inconsistent moisture
    ext += (lfQuality(lfM) - 0.60) * 2.8 * moistFactor;
    if (moistDev < 1.0) ext += (1.0 - moistDev) * 0.6; // moisture bonus near optimum
    // Tempering time: silo_reposo (tons) / throughput (t/h) = actual rest hours
    // Continuous curve — most visible effect when adjusting silo size slider
    const optHours = grain === "maiz" ? 6.0 : 22.0;
    const tRatio = Math.min(1.0, temperingHours / optHours);
    const tempEffect = tRatio >= 1.0 ? 3.2
      : tRatio >= 0.55 ? -0.3 + tRatio * 3.5
      : tRatio >= 0.25 ? -1.2 + tRatio * 2.8
      : -1.8 + tRatio * 2.4;
    ext += Math.max(-1.8, Math.min(3.2, tempEffect));
  }

  // 5c. Milling — quality of endosperm size reduction
  if (!hasPhase("molienda")) {
    ext = 0;
  } else {
    if (!has("banco_cil_1")) {
      ext -= 5.0;
    } else {
      const lfB1 = lf(get("banco_cil_1")!);
      // param2Value = roller gap µm — optimal 1st break: 250–320 µm trigo blando, 180–220 trigo duro
      const gapB1 = get("banco_cil_1")!.param2Value ?? 280;
      const optGapB1 = grain === "trigo_duro" ? 200 : grain === "maiz" ? 300 : 280;
      const gapFactorB1 = Math.max(0.40, 1.0 - Math.abs(gapB1 - optGapB1) / 320);
      // Optimal: endosperm fully released at each pass without bran fragmentation
      ext += (lfQuality(lfB1) - 0.50) * 3.6 * gapFactorB1;
    }
    if (has("banco_cil_2")) {
      const lfB2 = lf(get("banco_cil_2")!);
      const gapB2 = get("banco_cil_2")!.param2Value ?? 150;
      const optGapB2 = grain === "trigo_duro" ? 100 : grain === "maiz" ? 200 : 150;
      const gapFactorB2 = Math.max(0.40, 1.0 - Math.abs(gapB2 - optGapB2) / 250);
      ext += lfQuality(lfB2) * 1.5 * gapFactorB2 + 0.20;
    }
    if (has("banco_cil_3")) {
      const lfB3 = lf(get("banco_cil_3")!);
      const gapB3 = get("banco_cil_3")!.param2Value ?? 80;
      const optGapB3 = grain === "trigo_duro" ? 60 : grain === "maiz" ? 100 : 80;
      const gapFactorB3 = Math.max(0.40, 1.0 - Math.abs(gapB3 - optGapB3) / 180);
      ext += lfQuality(lfB3) * 1.2 * gapFactorB3 + 0.15;
    }
    if (has("detacheur")) ext += 0.40;
    if (has("mol_martillos")) {
      const lfMM = lf(get("mol_martillos")!);
      ext += lfQuality(lfMM) * 0.35;
    }
  }

  // 5d. Sifting — flour/bran separation quality, directly controlled by plansichter load
  if (!hasPhase("cernido")) {
    ext -= 2.5;
  } else {
    const ps = get("plansichter");
    if (!ps) {
      ext -= 1.5;
    } else {
      const lfP = lf(ps);
      // param2Value = sifting efficiency % — directly scales flour/bran separation
      const siftEff = (ps.param2Value ?? 96) / 100;
      ext += (lfQuality(lfP) - 0.50) * 2.8 * siftEff; // optimal: clean stream separation
      if (lfP > 0.88) ext -= (lfP - 0.88) * 9.0; // overloaded → flour escapes into bran
    }
    if (has("sasor")) {
      const lfS = lf(get("sasor")!);
      ext += lfQuality(lfS) * 0.90;
    }
    if (has("cernid_conico")) {
      const lfCC = lf(get("cernid_conico")!);
      ext += lfQuality(lfCC) * 0.18;
    }
    if (has("cernid_centr")) {
      const lfCE = lf(get("cernid_centr")!);
      ext += lfQuality(lfCE) * 0.35;
    }
  }

  // 5e. Finishing — residual flour recovery
  if (has("cepilladora")) {
    const lfCA = lf(get("cepilladora")!);
    ext += lfQuality(lfCA) * 0.60;
  }
  if (has("filtro_mangas")) {
    const lfFM = lf(get("filtro_mangas")!);
    ext += lfQuality(lfFM) * 0.28;
  }

  const maxExt = grain === "maiz" ? 78 : grain === "trigo_duro" ? 80 : 83;
  const extractionPct = Math.round(Math.max(grain === "maiz" ? 40 : 45, Math.min(maxExt, ext)) * 10) / 10;

  // 6. ENERGY — smooth parabolic curve (minimum kWh/t at lf=0.82, rises at both ends)
  const loadEnergyMult = (lfVal: number): number => {
    const dev = lfVal - 0.82;
    return 1.0 + dev * dev * 2.4 + Math.max(0, lfVal - 0.95) * 0.7;
  };
  let totalEnergy = 0;
  for (const m of flowMachines) totalEnergy += m.powerKwPerTon * loadEnergyMult(lf(m));
  const energyKwhPerTon = Math.round(Math.max(8, Math.min(135, totalEnergy)) * 10) / 10;

  // 7. ASH CONTENT — continuous sensitivity to every relevant slider
  const baseAsh = grain === "maiz" ? 0.28 : grain === "trigo_duro" ? 0.46 : 0.42;
  let ash = baseAsh;
  ash += Math.max(0, extractionPct - baseExt) * 0.022; // higher extraction → more bran contact
  const zarandaAsh = get("zaranda");
  if (zarandaAsh) {
    const lfZA = lf(zarandaAsh);
    if (lfZA > 0.88) ash += (lfZA - 0.88) * 0.35;       // overload: impurities pass
    else if (lfZA < 0.40) ash += (0.40 - lfZA) * 0.15;  // underload: thin bed, poor cleaning
  } else {
    ash += 0.06;
  }
  if (temperingHours < 10) ash += (10 - temperingHours) * 0.004; // short tempering: bran not loosened
  if (!has("mojador")) ash += 0.07;
  const psAsh = get("plansichter");
  if (psAsh) {
    const lfPA = lf(psAsh);
    if (lfPA > 0.88) ash += (lfPA - 0.88) * 0.42;     // overloaded: bran escapes into flour
    if (lfPA < 0.50) ash += (0.50 - lfPA) * 0.08;     // underloaded: poor separation
  }
  if (has("sasor"))         ash -= 0.04;
  if (has("cernid_conico")) ash -= 0.015;
  const ashPct = Math.round(Math.max(0.20, Math.min(0.95, ash)) * 1000) / 1000;

  // 7. PROTEIN
  const baseProt = grain === "trigo_duro" ? 12.5 : grain === "trigo_blando" ? 10.8 : 7.2;
  const proteinPct = Math.round(Math.max(7, baseProt + (extractionPct - baseExt) * 0.05) * 10) / 10;

  // 8. STAGE BALANCE — mass flow through each machine
  const stageBalance: DetailedSimResult["stageBalance"] = [];
  let curTph = throughputTph;
  for (const m of pipeline) {
    if (STORAGE_IDS.has(m.id) || m.phase === "empaque") continue;
    const lfM = throughputTph / m.configuredCapacity;
    const loadAdj = lfM > 0.95 ? 0.9985 : lfM > 0.75 ? 0.9992 : lfM > 0.4 ? 0.9996 : 0.9993;
    const eff = m.flowFactor * loadAdj;
    const outTph = curTph * eff;
    const lossTph = Math.max(0, curTph - outTph);
    const status: "ok" | "overload" | "underload" | "critical" =
      lfM > 1.05 ? "critical" : lfM > 0.93 ? "overload" : lfM < 0.25 ? "underload" : "ok";
    stageBalance.push({
      stage: m.label,
      inputTph:  Math.round(curTph  * 100) / 100,
      outputTph: Math.round(outTph  * 100) / 100,
      lossTph:   Math.round(lossTph * 1000) / 1000,
      lossKgPerTon: Math.round((lossTph / (curTph || 1)) * 10000) / 10,
      loadPct:       Math.round(lfM  * 1000) / 10,
      efficiencyPct: Math.round(eff  * 1000) / 10,
      energyKwhPerTon: Math.round(m.powerKwPerTon * loadEnergyMult(lfM) * 10) / 10,
      status,
    });
    curTph = outTph;
  }

  // 9. PRODUCTS
  const products: DetailedSimResult["products"] = [];
  if (grain !== "maiz") {
    const h000  = extractionPct * 0.55;
    const h0000 = extractionPct > 78 ? extractionPct * 0.18 : 0;
    const sml   = extractionPct * 0.09;
    const salv  = Math.max(0, 100 - extractionPct - 3 - 1);
    products.push({ label: grain === "trigo_duro" ? "Harina 00 / pasta" : "Harina 000 panadera",
      yieldPct: h000, tonPerDay: dailyCapacityTons * h000 / 100, color: "#f8fafc" });
    if (h0000 > 0) products.push({ label: "Harina 0000 pastera",
      yieldPct: h0000, tonPerDay: dailyCapacityTons * h0000 / 100, color: "#f1f5f9" });
    products.push({ label: "Semolín", yieldPct: sml, tonPerDay: dailyCapacityTons * sml / 100, color: "#fef9c3" });
    products.push({ label: "Salvado / Afrecho", yieldPct: salv, tonPerDay: dailyCapacityTons * salv / 100, color: "#92400e" });
    products.push({ label: "Germen", yieldPct: 3, tonPerDay: dailyCapacityTons * 0.03, color: "#d97706" });
  } else {
    products.push({ label: "Sémola / Polenta", yieldPct: extractionPct * 0.48, tonPerDay: dailyCapacityTons * extractionPct * 0.0048, color: "#fef9c3" });
    products.push({ label: "Gritz / Grits",    yieldPct: extractionPct * 0.32, tonPerDay: dailyCapacityTons * extractionPct * 0.0032, color: "#fef08a" });
    products.push({ label: "Harina de maíz",   yieldPct: extractionPct * 0.20, tonPerDay: dailyCapacityTons * extractionPct * 0.0020, color: "#f8fafc" });
    products.push({ label: "Salvado",  yieldPct: 18, tonPerDay: dailyCapacityTons * 0.18, color: "#92400e" });
    products.push({ label: "Germen",   yieldPct: 8,  tonPerDay: dailyCapacityTons * 0.08, color: "#d97706" });
  }

  // 10. WARNINGS
  const warnings: string[] = [];
  const reqMachines = ALL_MACHINES.filter(m => m.required && m.grains.includes(grain));
  reqMachines.forEach(m => { if (!has(m.id)) warnings.push(`Equipo requerido faltante: ${m.label} (${m.code})`); });
  if (!hasPhase("limpieza")) warnings.push("Sin limpieza — grano sucio entra a molienda: contaminación y desgaste acelerado de rodillos.");
  if (!hasPhase("molienda")) warnings.push("Sin banco de molienda — el proceso no genera harina.");
  if (!hasPhase("cernido"))  warnings.push("Sin plansichter — harina, semolín y salvado sin clasificar.");
  for (const m of flowMachines) {
    const lfM = lf(m);
    if (lfM > 0.961) {
      const rec = Math.ceil(throughputTph * 1.18);
      warnings.push(`${m.label} al ${Math.round(lfM * 100)}% de carga → sobrecarga. Subir cap. de ${m.configuredCapacity} a ${rec} t/h o bajar throughput a ${(m.configuredCapacity * 0.9).toFixed(1)} t/h.`);
    }
  }
  if (has("mojador") && grain !== "maiz" && temperingHours < 10) {
    const minSilo = Math.ceil(throughputTph * 16);
    warnings.push(`Reposo ${temperingHours.toFixed(1)}h insuficiente (silo ${siloReposo?.configuredCapacity ?? 0}t ÷ ${throughputTph} t/h). Trigo requiere ≥16h. Ampliar silo a ${minSilo}t.`);
  }

  // Moisture in tempering silo — critical for bran loosening
  const siloReposoMoisture = siloReposo?.param2Value ?? 15.5;
  if (has("silo_reposo") && grain !== "maiz") {
    const optRangeLow  = grain === "trigo_duro" ? 15.5 : 15.0;
    const optRangeHigh = grain === "trigo_duro" ? 16.5 : 16.0;
    if (siloReposoMoisture < optRangeLow) {
      warnings.push(`H° reposo ${siloReposoMoisture}% bajo óptimo (${optRangeLow}–${optRangeHigh}%). Salvado no ablanda → extracción reducida y mayor fragmentación de cáscara.`);
    } else if (siloReposoMoisture > optRangeHigh) {
      warnings.push(`H° reposo ${siloReposoMoisture}% excesiva (óptimo ${optRangeLow}–${optRangeHigh}%). Masa pegajosa en cilindros → mayor kWh/t y riesgo de atasco en plansichter.`);
    }
  }

  // Field moisture: if grain arrives wet without dryer
  const fosoMoisture = pipeline.find(m => m.id === "foso_receptor")?.param2Value;
  const siloMpMoisture = pipeline.find(m => m.id === "silo_mp")?.param2Value;
  const inboundMoisture = fosoMoisture ?? siloMpMoisture;
  if (inboundMoisture && inboundMoisture > 14.0 && !has("secadora_grano")) {
    warnings.push(`Grano campo/recibo ${inboundMoisture.toFixed(1)}% H° supera límite almacenaje seguro (14%). Sin secadora activa → alto riesgo de calentamiento, hongos (Aspergillus/Fusarium) y pérdida de calidad.`);
  }

  // Roller gap warnings
  const gapB1 = pipeline.find(m => m.id === "banco_cil_1")?.param2Value;
  const optGapB1 = grain === "trigo_duro" ? 200 : grain === "maiz" ? 300 : 280;
  if (gapB1 !== undefined) {
    if (gapB1 < optGapB1 * 0.45) warnings.push(`Luz 1°banco ${gapB1}µm muy cerrada → fragmentación excesiva del salvado, cenizas altas en harina y mayor desgaste de rodillos.`);
    if (gapB1 > optGapB1 * 1.7) warnings.push(`Luz 1°banco ${gapB1}µm muy abierta → grano no se abre completamente en primer pase, extracción reducida.`);
  }
  const maxFlowCap = Math.max(...flowMachines.map(m => m.configuredCapacity));
  if (maxFlowCap > 0 && throughputTph < maxFlowCap * 0.45) {
    warnings.push(`Desbalance severo: ${throughputTph} t/h vs equipo mayor ${maxFlowCap} t/h (${Math.round(throughputTph / maxFlowCap * 100)}%). Inversión sobredimensionada: alta energía sin producción adicional.`);
  }
  if (extractionPct < baseExt - 2.5 && hasPhase("molienda")) {
    warnings.push(`Extracción ${extractionPct}% bajo potencial (${baseExt}%). Revisar: acondicionamiento${temperingHours < 12 ? ` (solo ${temperingHours.toFixed(1)}h reposo)` : ""}, carga plansichter y bancos de cilindros.`);
  }

  // 11. RECOMMENDATIONS (expert milling engineer — actionable and quantified)
  const recommendations: string[] = [];
  const bnPhase = PHASE_META[bottleneckM.phase]?.label ?? bottleneckM.phase;
  const extraDailyTons = Math.round((throughputTph * 1.35 - throughputTph) * hoursPerDay * availabilityPct / 100);
  recommendations.push(`⚡ Cuello en ${bnPhase} — ${bottleneckM.label} (${throughputTph} t/h). Escalar a ${Math.round(throughputTph * 1.35)} t/h libera +${extraDailyTons} t/día de producción.`);
  if (has("mojador") && grain !== "maiz" && temperingHours < 18) {
    const optSilo = Math.ceil(throughputTph * 20);
    const gainExt = Math.round(Math.max(0.3, 2.6 - (temperingHours >= 16 ? 2.1 : temperingHours >= 12 ? 1.5 : temperingHours >= 8 ? 0.8 : 0.1)) * 10) / 10;
    recommendations.push(`⏱ Silos reposo: ${siloReposo?.configuredCapacity ?? 0}t → ${optSilo}t (actual ${temperingHours.toFixed(1)}h, óptimo 20h). Potencial +${gainExt}% extracción = +${Math.round(dailyCapacityTons * gainExt / 100)} kg harina/día.`);
  }
  if (!has("banco_cil_2") && hasPhase("molienda")) {
    recommendations.push(`🔩 BCH-2 (2° banco cilindros): +1.5% extracción = +${Math.round(dailyCapacityTons * 15)} kg harina/día. Segundo pase de reducción eleva rendimiento sin ampliar capacidad base.`);
  }
  if (!has("sasor") && grain !== "maiz") {
    recommendations.push(`🎯 Sasor (SGVM): purifica semolín, −0.04% cenizas y +0.9% extracción. Esencial si vendes harina pastera o 0000 premium.`);
  }
  if (energyKwhPerTon > 58) {
    const culprits = flowMachines.filter(m => lf(m) < 0.40 && m.powerKwPerTon > 1).map(m => m.label);
    if (culprits.length > 0) recommendations.push(`⚡ Consumo ${energyKwhPerTon} kWh/t (ref. 40–55). Equipos infrautilizados: ${culprits.join(", ")}. Reducir capacidad instalada o aumentar flujo objetivo.`);
    else recommendations.push(`⚡ Consumo ${energyKwhPerTon} kWh/t sobre el estándar (40–55). Revisar luz entre cilindros y velocidades diferenciales de rodillos.`);
  }
  if (ashPct > 0.56) {
    const detail: string[] = [];
    const psC = get("plansichter"); psC && lf(psC) > 0.88 && detail.push(`plansichter ${Math.round(lf(psC)*100)}%`);
    temperingHours < 10 && detail.push(`reposo ${temperingHours.toFixed(1)}h`);
    !has("sasor") && detail.push("sin sasor");
    recommendations.push(`⚠ Cenizas ${(ashPct * 100).toFixed(2)}% (límite 000: 0.55%). Causas: ${detail.join(", ") || "extracción agresiva"}. Reducir tasa extracción o añadir purificación.`);
  }
  if (!has("cepilladora") && grain !== "maiz") {
    recommendations.push(`🖌 Cepilladora (CA): recupera harina adherida al salvado = +0.5% extracción → +${Math.round(dailyCapacityTons * 5)} kg/día con consumo mínimo.`);
  }
  if (!has("filtro_mangas")) {
    recommendations.push(`🌬 Filtro de mangas (HDFA): normativa ambiental + recupera harina fina en suspensión → +${Math.round(dailyCapacityTons * 2)} kg/día.`);
  }
  if (!hasPhase("empaque")) {
    recommendations.push("📦 Circuito incompleto: sin etapa de empaque. Añadir embolsadora o tolva a granel para despacho.");
  }

  // 12. SCORE (weighted: equipment completeness, extraction, balance, energy, ash)
  const missingReq = reqMachines.filter(m => !has(m.id));
  const reqSc    = reqMachines.length > 0 ? ((reqMachines.length - missingReq.length) / reqMachines.length) * 35 : 35;
  const extSc    = Math.min(25, (extractionPct / (grain === "maiz" ? 75 : 80)) * 25);
  const balSc    = flowMachines.length > 1 ? Math.min(12, (throughputTph / maxFlowCap) * 12) : 6;
  const enSc     = Math.min(10, Math.max(0, (75 - energyKwhPerTon) / 3.5));
  const ashSc    = Math.min(10, Math.max(0, (0.65 - ashPct) / 0.018));
  const cmpSc    = Math.min(8, pipeline.length * 0.38);
  const score    = Math.min(100, Math.round(reqSc + extSc + balSc + enSc + ashSc + cmpSc));

  return {
    throughputTph, extractionPct, ashPct, proteinPct, energyKwhPerTon,
    dailyCapacityTons: Math.round(dailyCapacityTons * 10) / 10,
    annualCapacityKt:  Math.round(dailyCapacityTons * 300 / 100) / 10,
    flourTonPerDay:    Math.round(dailyCapacityTons * extractionPct / 100 * 10) / 10,
    branTonPerDay:     Math.round(dailyCapacityTons * Math.max(0, 100 - extractionPct - 4) / 100 * 10) / 10,
    temperingHours:    Math.round(temperingHours * 10) / 10,
    bottleneckLabel: bottleneckM.label, bottleneckTph: throughputTph, score,
    stageBalance, products, warnings, recommendations,
  };
}

function MachineIcon({ type, size = 24, color }: { type: string; size?: number; color: string }) {
  const s = size;
  switch (type) {
    case "silo":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="6" height="14" rx="1" fill={color} opacity={0.9}/>
      <rect x="9" y="4" width="6" height="18" rx="1" fill={color} opacity={0.7}/>
      <rect x="16" y="6" width="6" height="16" rx="1" fill={color} opacity={0.55}/>
      <ellipse cx="5" cy="8" rx="3" ry="1.5" fill={color} opacity={0.8}/>
      <ellipse cx="12" cy="4" rx="3" ry="1.5" fill={color} opacity={0.8}/>
      <ellipse cx="19" cy="6" rx="3" ry="1.5" fill={color} opacity={0.8}/>
    </svg>;
    case "elevator": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="8" y="2" width="8" height="20" rx="2" stroke={color} strokeWidth="2"/>
      <rect x="10" y="6" width="4" height="5" rx="1" fill={color}/>
      <rect x="10" y="14" width="4" height="5" rx="1" fill={color} opacity={0.5}/>
    </svg>;
    case "balance":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="17" width="20" height="4" rx="1" fill={color} opacity={0.5}/>
      <rect x="9" y="5" width="6" height="12" rx="1" fill={color} opacity={0.7}/>
      <line x1="12" y1="3" x2="12" y2="5" stroke={color} strokeWidth="2"/>
      <circle cx="12" cy="3" r="1.5" fill={color}/>
    </svg>;
    case "sieve":   return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="2"/>
      {[7,11,15].map(cx => [9,14,18].map(cy => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" fill={color}/>))}
      <line x1="4" y1="3" x2="12" y2="6" stroke={color} strokeWidth="1.5"/>
      <line x1="20" y1="3" x2="12" y2="6" stroke={color} strokeWidth="1.5"/>
    </svg>;
    case "stone":   return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 20 L8 12 L12 16 L16 8 L20 14 L20 20 Z" fill={color} opacity={0.3} stroke={color} strokeWidth="1.5"/>
      <circle cx="7" cy="14" r="2" fill={color} opacity={0.8}/>
      <ellipse cx="16" cy="10" rx="3" ry="2" fill={color} opacity={0.6}/>
    </svg>;
    case "magnet":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 4 L6 14 Q6 20 12 20 Q18 20 18 14 L18 4" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="4" y1="4" x2="8" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>;
    case "disc":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2"/>
      {[30, 90, 150, 210, 270, 330].map(a => {
        const rad = (a * Math.PI) / 180;
        return <circle key={a} cx={12 + Math.cos(rad) * 5} cy={12 + Math.sin(rad) * 5} r="1.5" fill={color}/>;
      })}
    </svg>;
    case "trieur":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="20" height="8" rx="4" stroke={color} strokeWidth="2"/>
      {[5,9,13,17].map(x => <circle key={x} cx={x} cy="12" r="1.5" fill={color}/>)}
    </svg>;
    case "brush":   return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="10" y="2" width="4" height="14" rx="1" fill={color} opacity={0.7}/>
      <rect x="4" y="16" width="16" height="5" rx="2" fill={color} opacity={0.5}/>
      {[6,8,10,12,14,16,18].map(x => <line key={x} x1={x} y1="21" x2={x} y2="23" stroke={color} strokeWidth="1.5"/>)}
    </svg>;
    case "wind":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 8 Q10 4 17 8 Q24 12 17 16 Q10 20 3 16" stroke={color} strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="2" fill={color}/>
    </svg>;
    case "drop":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3 Q6 10 6 15 A6 6 0 0 0 18 15 Q18 10 12 3" fill={color} opacity={0.7}/>
      <rect x="16" y="8" width="5" height="12" rx="2" stroke={color} strokeWidth="1.5" fill="none"/>
    </svg>;
    case "tank":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="16" height="16" rx="2" fill={color} opacity={0.25} stroke={color} strokeWidth="2"/>
      <ellipse cx="12" cy="6" rx="8" ry="2.5" fill={color} opacity={0.7}/>
      <line x1="12" y1="22" x2="12" y2="24" stroke={color} strokeWidth="2"/>
    </svg>;
    case "rollers": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="8" rx="9" ry="4" stroke={color} strokeWidth="2"/>
      <ellipse cx="12" cy="16" rx="9" ry="4" stroke={color} strokeWidth="2"/>
      <line x1="3" y1="8" x2="3" y2="16" stroke={color} strokeWidth="2"/>
      <line x1="21" y1="8" x2="21" y2="16" stroke={color} strokeWidth="2"/>
    </svg>;
    case "hammer":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="10" height="8" rx="2" fill={color} opacity={0.8}/>
      <path d="M13 7 L21 15 L19 17 L11 9" fill={color} opacity={0.5}/>
      <line x1="8" y1="11" x2="8" y2="21" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>;
    case "spin":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 A10 10 0 1 1 2 12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points="2,12 6,8 6,16" fill={color}/>
      <circle cx="12" cy="12" r="3" fill={color} opacity={0.5}/>
    </svg>;
    case "grid":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="2" stroke={color} strokeWidth="2"/>
      <line x1="2" y1="9" x2="22" y2="9" stroke={color} strokeWidth="1.5"/>
      <line x1="2" y1="16" x2="22" y2="16" stroke={color} strokeWidth="1.5"/>
      <line x1="9" y1="2" x2="9" y2="22" stroke={color} strokeWidth="1.5"/>
      <line x1="16" y1="2" x2="16" y2="22" stroke={color} strokeWidth="1.5"/>
    </svg>;
    case "funnel":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 3 L21 3 L14 13 L14 21 L10 21 L10 13 Z" fill={color} opacity={0.3} stroke={color} strokeWidth="2"/>
    </svg>;
    case "cone":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L20 20 L4 20 Z" fill={color} opacity={0.3} stroke={color} strokeWidth="2"/>
      <line x1="12" y1="20" x2="12" y2="23" stroke={color} strokeWidth="2.5"/>
    </svg>;
    case "filter":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="2"/>
      {[5,9,13,17].map(y => <line key={y} x1="7" y1={y} x2="17" y2={y} stroke={color} strokeWidth="1.5"/>)}
      <path d="M10 21 L10 24 L14 24 L14 21" stroke={color} strokeWidth="1.5"/>
    </svg>;
    case "bag":     return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M7 10 L5 22 L19 22 L17 10 Z" fill={color} opacity={0.3} stroke={color} strokeWidth="2"/>
      <path d="M9 10 Q9 5 12 5 Q15 5 15 10" stroke={color} strokeWidth="1.5" fill="none"/>
    </svg>;
    case "truck":   return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="9" width="15" height="11" rx="1" fill={color} opacity={0.25} stroke={color} strokeWidth="1.5"/>
      <path d="M16 13 L20 13 L22 18 L16 18 Z" fill={color} opacity={0.5} stroke={color} strokeWidth="1"/>
      <circle cx="5"  cy="21" r="2" fill={color}/>
      <circle cx="13" cy="21" r="2" fill={color}/>
      <circle cx="19" cy="21" r="2" fill={color}/>
    </svg>;
    case "pit":     return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M2 6 L6 18 L18 18 L22 6 Z" fill={color} opacity={0.2} stroke={color} strokeWidth="2"/>
      <line x1="2" y1="6" x2="22" y2="6" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      {[7,11,15].map(x => <line key={x} x1={x} y1="18" x2={x+1} y2="22" stroke={color} strokeWidth="1.5"/>)}
    </svg>;
    case "conveyor": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="9" width="20" height="6" rx="3" stroke={color} strokeWidth="2"/>
      <circle cx="5" cy="12" r="2.5" stroke={color} strokeWidth="1.5"/>
      <circle cx="19" cy="12" r="2.5" stroke={color} strokeWidth="1.5"/>
      {[8,11,14].map(x => <rect key={x} x={x} y="10" width="2" height="4" rx="0.5" fill={color} opacity={0.6}/>)}
    </svg>;
    case "sensor":  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="14" rx="2" stroke={color} strokeWidth="2"/>
      <circle cx="12" cy="20" r="2" fill={color}/>
      <line x1="12" y1="16" x2="12" y2="18" stroke={color} strokeWidth="2"/>
      <path d="M6 8 Q4 12 6 16" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M18 8 Q20 12 18 16" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>;
    case "dryer":   return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="2"/>
      {[7,11,15].map(x => <path key={x} d={`M${x} 20 L${x} 8`} stroke={color} strokeWidth="1.5" opacity={0.5}/>)}
      <path d="M3 8 L21 8" stroke={color} strokeWidth="1.5"/>
      <path d="M3 14 L21 14" stroke={color} strokeWidth="1.5"/>
      <circle cx="7" cy="2" r="1.5" fill={color} opacity={0.7}/>
      <circle cx="12" cy="2" r="1.5" fill={color} opacity={0.7}/>
      <circle cx="17" cy="2" r="1.5" fill={color} opacity={0.7}/>
    </svg>;
    case "scan":    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="2"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity={0.8}/>
      <circle cx="9" cy="8" r="2" fill={color} opacity={0.6}/>
      <circle cx="15" cy="16" r="2" fill={color} opacity={0.4}/>
    </svg>;
    case "stack":   return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="14" width="18" height="5" rx="1" fill={color} opacity={0.7}/>
      <rect x="3" y="8" width="18" height="5" rx="1" fill={color} opacity={0.5}/>
      <rect x="3" y="2" width="18" height="5" rx="1" fill={color} opacity={0.3}/>
      <line x1="12" y1="19" x2="12" y2="23" stroke={color} strokeWidth="2"/>
    </svg>;
    default: return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10" fill={color}>?</text>
    </svg>;
  }
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════ */

/* Palette machine card */
function PaletteCard({ m, onAdd, placedCount }: { m: MachineDef; onAdd: (m: MachineDef) => void; placedCount: number }) {
  const phase = PHASE_META[m.phase];
  return (
    <div
      style={{ borderLeft: `3px solid ${phase.color}` }}
      className="relative rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-slate-300"
    >
      {m.required && (
        <span className="absolute right-2 top-2 text-[0.58rem] font-bold uppercase tracking-widest text-amber-500">
          ★ req
        </span>
      )}
      {placedCount > 0 && (
        <span
          className="absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[0.55rem] font-black"
          style={{ background: `${phase.color}25`, color: phase.color }}
        >
          ×{placedCount}
        </span>
      )}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0"><MachineIcon type={m.iconType} size={22} color={phase.color} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-bold text-slate-800 leading-tight">{m.label}</p>
          <p className="text-[0.62rem] text-slate-400 font-mono">{m.code}</p>
          <p className="mt-0.5 text-[0.62rem] text-slate-500 leading-tight line-clamp-2">{m.desc}</p>
          <p className="mt-1 text-[0.62rem] text-slate-400">
            {m.bagSizeKg
              ? `${Math.round(m.capacityMin * 1000 / m.bagSizeKg)}–${Math.round(m.capacityMax * 1000 / m.bagSizeKg)} bolsas/h · bolsas ${m.bagSizeKg} kg`
              : `${m.capacityMin}–${m.capacityMax} t/h · ${m.powerKwPerTon} kWh/t`}
          </p>
        </div>
      </div>
      <button
        onClick={() => onAdd(m)}
        className="mt-2 w-full rounded-lg py-1 text-[0.7rem] font-bold transition-colors bg-slate-900 text-white hover:bg-blue-900"
      >
        {placedCount > 0 ? `⊕ Agregar otra (${placedCount} en flujo)` : "+ Agregar"}
      </button>
    </div>
  );
}

/* Pipeline puzzle piece node */
function PipelineNode({
  m,
  index,
  total,
  onRemove,
  onCapChange,
  onParam2Change,
  onMoveLeft,
  onMoveRight,
  showConnector,
  isBottleneck,
}: {
  m: PlacedMachine;
  index: number;
  total: number;
  onRemove: () => void;
  onCapChange: (v: number) => void;
  onParam2Change: (v: number) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  showConnector: boolean;
  isBottleneck: boolean;
}) {
  const phase = PHASE_META[m.phase];
  const pct = Math.max(0, Math.min(100,
    ((m.configuredCapacity - m.capacityMin) / (m.capacityMax - m.capacityMin || 1)) * 100
  ));
  return (
    <div className="flex shrink-0 items-center">
      {/* Glass card on dark canvas */}
      <div
        className="relative w-48 rounded-2xl shadow-xl overflow-hidden"
        style={{
          background: "rgba(8, 22, 50, 0.88)",
          border: isBottleneck ? "2px solid rgba(245,158,11,0.85)" : `1px solid ${phase.color}70`,
          backdropFilter: "blur(8px)",
          boxShadow: isBottleneck
            ? "0 0 22px rgba(245,158,11,0.30), 0 4px 16px rgba(0,0,0,0.5)"
            : `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px ${phase.color}20`,
        }}
      >
        {/* Top phase accent bar */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${isBottleneck ? "#f59e0b" : phase.color}, ${isBottleneck ? "#f59e0b44" : phase.color + "44"})` }} />

        {/* Bottleneck badge */}
        {isBottleneck && (
          <div className="absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-wide bg-amber-500 text-amber-950 leading-tight">
            ⚡ CUELLO
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
          <div className="shrink-0 rounded-lg p-1.5" style={{ background: `${phase.color}30` }}>
            <MachineIcon type={m.iconType} size={20} color={isBottleneck ? "#f59e0b" : phase.color} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.72rem] font-bold text-white/95 leading-tight truncate pr-8">{m.label}</p>
            <p className="text-[0.58rem] font-mono font-semibold" style={{ color: isBottleneck ? "#f59e0bcc" : `${phase.color}dd` }}>{m.code}</p>
          </div>
        </div>

        {/* Capacity badge + slider */}
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[0.58rem] font-bold uppercase tracking-widest text-white/65">Capacidad</span>
            <span
              className="text-lg font-black leading-none tabular-nums"
              style={{
                color: isBottleneck ? "#f59e0b" : phase.color,
                textShadow: `0 0 10px ${isBottleneck ? "#f59e0b" : phase.color}66`,
              }}
            >
              {m.bagSizeKg
                ? Math.round(m.configuredCapacity * 1000 / m.bagSizeKg).toString()
                : m.configuredCapacity.toFixed(0)}
              <span className="text-[0.6rem] font-semibold text-white/55 ml-0.5">
                {m.bagSizeKg ? "b/h" : "t/h"}
              </span>
            </span>
          </div>
          <input
            type="range"
            min={m.capacityMin}
            max={m.capacityMax}
            step={1}
            value={m.configuredCapacity}
            onChange={(e) => onCapChange(parseFloat(e.target.value))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, ${isBottleneck ? "#f59e0bcc" : phase.color + "cc"} ${pct}%, rgba(255,255,255,0.13) ${pct}%)`,
              height: "4px",
              borderRadius: "9999px",
            }}
          />
          <div className="flex justify-between text-[0.52rem] mt-1 font-semibold" style={{ color: isBottleneck ? "#f59e0b99" : `${phase.color}99` }}>
            <span>{m.bagSizeKg ? Math.round(m.capacityMin * 1000 / m.bagSizeKg) : m.capacityMin}</span>
            <span>{m.bagSizeKg ? Math.round(m.capacityMax * 1000 / m.bagSizeKg) : m.capacityMax}</span>
          </div>
        </div>

        {/* Second engineering parameter (moisture / temp / gap / efficiency) */}
        {m.param2 && (() => {
          const p2 = m.param2!;
          const val = m.param2Value ?? p2.default;
          const pct2 = Math.max(0, Math.min(100, ((val - p2.min) / (p2.max - p2.min || 1)) * 100));
          const decimals = p2.step < 1 ? (p2.step < 0.1 ? 2 : 1) : 0;
          // Colour: amber if out of typical optimal range (±15% from default)
          const deviation = Math.abs(val - p2.default) / (p2.max - p2.min || 1);
          const p2Color = deviation > 0.25 ? "#f59e0b" : isBottleneck ? "#f59e0b" : `${phase.color}cc`;
          return (
            <div className="px-3 pb-2 border-t border-white/5 pt-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[0.52rem] font-bold uppercase tracking-widest text-white/45 flex items-center gap-0.5">
                  {p2.icon && <span className="text-[0.62rem]">{p2.icon}</span>}
                  {p2.label}
                </span>
                <span className="text-[1.05rem] font-black leading-none tabular-nums" style={{ color: p2Color }}>
                  {val.toFixed(decimals)}
                  <span className="text-[0.52rem] font-normal text-white/35 ml-0.5">{p2.unit}</span>
                </span>
              </div>
              <input
                type="range"
                min={p2.min} max={p2.max} step={p2.step}
                value={val}
                onChange={(e) => onParam2Change(parseFloat(e.target.value))}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, ${p2Color} ${pct2}%, rgba(255,255,255,0.10) ${pct2}%)`,
                  height: "3px", borderRadius: "9999px",
                }}
              />
              <div className="flex justify-between text-[0.46rem] mt-0.5 font-semibold" style={{ color: `${phase.color}55` }}>
                <span>{p2.min}{p2.unit}</span>
                <span>{p2.max}{p2.unit}</span>
              </div>
            </div>
          );
        })()}

        {/* Controls */}
        <div className="flex items-center justify-between border-t px-2 py-1" style={{ borderColor: `${phase.color}25` }}>
          <div className="flex gap-0.5">
            <button
              onClick={onMoveLeft}
              disabled={index === 0}
              className="rounded px-1.5 py-0.5 text-[0.6rem] text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20"
            >←</button>
            <button
              onClick={onMoveRight}
              disabled={index === total - 1}
              className="rounded px-1.5 py-0.5 text-[0.6rem] text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20"
            >→</button>
          </div>
          <button
            onClick={onRemove}
            className="rounded px-1.5 py-0.5 text-[0.6rem] text-rose-400/80 hover:bg-rose-500/20 hover:text-rose-300"
          >✕</button>
        </div>
      </div>
      {/* Connector arrow */}
      {showConnector && (
        <div className="relative h-6 w-8 shrink-0 flex items-center justify-center">
          <svg width="32" height="12" viewBox="0 0 32 12">
            <line x1="0" y1="6" x2="24" y2="6" stroke="#b98656" strokeWidth="2" strokeDasharray="4 2">
              <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="0.9s" repeatCount="indefinite" />
            </line>
            <polygon points="24,2 32,6 24,10" fill="#b98656" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* AI Score ring */
function ScoreRing({ score }: { score: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x="48" y="44" textAnchor="middle" fontSize="22" fontWeight="800" fill={color} fontFamily="Sora,sans-serif">
          {score}
        </text>
        <text x="48" y="60" textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="Manrope,sans-serif">
          / 100
        </text>
      </svg>
      <p className="text-[0.68rem] font-semibold text-slate-500">Calidad del Diseño</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export function MillDesignerBuilder() {
  const [grain, setGrain] = useState<GrainType>("trigo_blando");
  const [hoursPerDay, setHoursPerDay] = useState(20);
  const [availabilityPct, setAvailabilityPct] = useState(85);
  // ── Parámetros de humedad de grano (para fórmulas de rendimiento) ──────
  const [grainFieldMoisturePct, setGrainFieldMoisturePct] = useState(12.0);      // H° recepción campo
  const [conditioningTargetMoisturePct, setConditioningTargetMoisturePct] = useState(15.5); // H° objetivo reposo
  const [flourOutputMoisturePct, setFlourOutputMoisturePct] = useState(14.5);    // H° harina salida
  const router = useRouter();
  const [pipeline, setPipeline] = useState<PlacedMachine[]>([]);
  const [activePhase, setActivePhase] = useState<PhaseKey>("recepcion");
  const [activePaletteTab, setActivePaletteTab] = useState<PhaseKey | "todos">("todos");

  /* ── Persist & restore pipeline across navigation ── */
  useEffect(() => {
    try {
      const savedPipeline = localStorage.getItem("mill-design-pipeline");
      const savedConfig = localStorage.getItem("mill-design-config");
      if (savedPipeline) {
        const p = JSON.parse(savedPipeline) as PlacedMachine[];
        if (Array.isArray(p) && p.length > 0) setPipeline(p);
      }
      if (savedConfig) {
        const c = JSON.parse(savedConfig) as { grain?: GrainType; hoursPerDay?: number; availabilityPct?: number };
        if (c.grain) setGrain(c.grain);
        if (c.hoursPerDay) setHoursPerDay(c.hoursPerDay);
        if (c.availabilityPct) setAvailabilityPct(c.availabilityPct);
      }
    } catch { /* ignore parse errors */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("mill-design-pipeline", JSON.stringify(pipeline));
  }, [pipeline]);

  useEffect(() => {
    localStorage.setItem("mill-design-config", JSON.stringify({ grain, hoursPerDay, availabilityPct }));
  }, [grain, hoursPerDay, availabilityPct]);

  /* Template loader */
  const loadTemplate = useCallback((key: TemplateKey) => {
    const tpl = TEMPLATES[key];
    const loaded: PlacedMachine[] = tpl.machineIds.map((mid, i) => {
      const def = ALL_MACHINES.find((m) => m.id === mid)!;
      return {
        ...def,
        instanceId: `${mid}-${Date.now()}-${i}`,
        configuredCapacity: tpl.capacities[i] ?? Math.round((def.capacityMin + def.capacityMax) / 2),
        param2Value: def.param2?.default,
      };
    });
    setPipeline(loaded);
  }, []);

  /* Add machine */
  const addMachine = useCallback((def: MachineDef) => {
    const mid = `${def.id}-${Date.now()}`;
    setPipeline((prev) => [
      ...prev,
      { ...def, instanceId: mid, configuredCapacity: Math.round((def.capacityMin + def.capacityMax) / 2), param2Value: def.param2?.default },
    ]);
  }, []);

  /* Remove machine */
  const removeMachine = useCallback((instanceId: string) => {
    setPipeline((prev) => prev.filter((m) => m.instanceId !== instanceId));
  }, []);

  /* Update capacity */
  const updateCapacity = useCallback((instanceId: string, value: number) => {
    setPipeline((prev) => prev.map((m) => (m.instanceId === instanceId ? { ...m, configuredCapacity: value } : m)));
  }, []);

  /* Update second engineering parameter */
  const updateParam2 = useCallback((instanceId: string, value: number) => {
    setPipeline((prev) => prev.map((m) => (m.instanceId === instanceId ? { ...m, param2Value: value } : m)));
  }, []);

  /* Move machine */
  const moveMachine = useCallback((instanceId: string, direction: -1 | 1) => {
    setPipeline((prev) => {
      const idx = prev.findIndex((m) => m.instanceId === instanceId);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  /* Analysis */
  const analysis = useMemo(() => analyzeDesign(pipeline, grain, hoursPerDay, availabilityPct), [pipeline, grain, hoursPerDay, availabilityPct]);

  const placedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of pipeline) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
    return counts;
  }, [pipeline]);

  /* Physical twin simulation state */
  const [detailedResult, setDetailedResult] = useState<DetailedSimResult | null>(null);
  const [simulating, setSimulating]         = useState(false);
  const [simError, setSimError]             = useState<string | null>(null);
  const [simDirty, setSimDirty]             = useState(false);

  // ── Fórmulas estándar de humedad en molinería ───────────────────────────
  // 1. Agua a agregar en acondicionamiento (ISO / Mühlenchemie):
  //    Agua (L/100 kg trigo) = (H_objetivo − H_campo) / (100 − H_objetivo) × 100
  const waterToAddLper100kg = useMemo(() => {
    const T = conditioningTargetMoisturePct;
    const M = grainFieldMoisturePct;
    if (T <= M || T >= 100) return 0;
    return Math.round(((T - M) / (100 - T)) * 100 * 100) / 100;
  }, [conditioningTargetMoisturePct, grainFieldMoisturePct]);

  // 2. Rendimiento en Base Seca (RBS) — corrección real de humedad:
  //    RBS = Extracción_aparente × (100 − H_harina) / (100 − H_trigo_entrada)
  //    Elimina la distorsión del agua añadida en el reposo sobre el "rendimiento" aparente.
  const rendimientoBaseSeca = useMemo(() => {
    const ext = detailedResult?.extractionPct ?? analysis.extractionPct;
    if (conditioningTargetMoisturePct >= 100 || conditioningTargetMoisturePct <= 0) return ext;
    return Math.round(ext * (100 - flourOutputMoisturePct) / (100 - conditioningTargetMoisturePct) * 10) / 10;
  }, [detailedResult, analysis.extractionPct, flourOutputMoisturePct, conditioningTargetMoisturePct]);

  // Mark stale when config changes after a simulation
  useEffect(() => { if (detailedResult) setSimDirty(true); }, [pipeline, grain, hoursPerDay, availabilityPct]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Build legacy PhysicalModelInput for backend persistence (fire-and-forget) */
  const buildPhysicalInput = useCallback(() => {
    const bottleneckTph = analysis.bottleneck > 0 ? analysis.bottleneck : 10;
    const molinos = pipeline.filter((m) => m.phase === "molienda");
    const avgRollerCap = molinos.length > 0 ? molinos.reduce((s, m) => s + m.configuredCapacity, 0) / molinos.length : bottleneckTph;
    const rollerRpm = Math.round(300 + (avgRollerCap / 30) * 200);
    const pressure = grain === "trigo_duro" ? 6.2 : grain === "maiz" ? 4.8 : 5.4;
    const cernidoMachines = pipeline.filter((m) => m.phase === "cernido");
    const wheatInput = Math.max(50, analysis.dailyCapacity > 0 ? analysis.dailyCapacity : bottleneckTph * hoursPerDay);
    const downtimeMin = Math.round((1 - availabilityPct / 100) * hoursPerDay * 60);
    return {
      wheat_input_tons: Math.round(wheatInput), wheat_moisture_pct: grain === "maiz" ? 14.5 : 13.2,
      tempering_target_pct: grain === "maiz" ? 14.5 : 15.3, roller_speed_rpm: rollerRpm,
      grinding_pressure_bar: pressure, sifter_efficiency_pct: cernidoMachines.length > 0 ? 96 : 88,
      purifier_efficiency_pct: cernidoMachines.length > 1 ? 95 : 88,
      extraction_target_pct: analysis.extractionPct, specific_energy_kwh_ton: Math.max(35, analysis.energyKwhPerTon),
      planned_time_minutes: hoursPerDay * 60, downtime_minutes: downtimeMin,
      quality_protein_pct: grain === "trigo_duro" ? 12.5 : 11.4, quality_ash_pct: grain === "trigo_duro" ? 0.65 : 0.57,
    };
  }, [pipeline, analysis, grain, hoursPerDay, availabilityPct]);

  const handleExportPDF = useCallback(() => {
    if (!detailedResult) return;
    const d = detailedResult;
    const grainLabel = grain === "trigo_blando" ? "Trigo Blando 🌾" : grain === "trigo_duro" ? "Trigo Duro 🌾" : "Maíz 🌽";
    const dateStr = new Date().toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
    const scoreColor = d.score >= 80 ? "#16a34a" : d.score >= 60 ? "#d97706" : "#dc2626";
    const ashOk = d.ashPct * 100 <= 0.55;

    const machineRows = pipeline.map(m => `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#0f2f63;font-weight:600">${m.code}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${m.label}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center">${PHASE_META[m.phase]?.label ?? m.phase}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-weight:700;color:#b98656">${m.configuredCapacity} t/h</td>
      </tr>`).join("");

    const balanceRows = d.stageBalance.map(s => {
      const sc = s.status === "critical" ? "#dc2626" : s.status === "overload" ? "#d97706" : s.status === "underload" ? "#94a3b8" : "#16a34a";
      const barW = Math.min(100, s.loadPct);
      return `<tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10.5px">${s.stage}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10.5px;text-align:right">${s.inputTph}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10.5px;text-align:right">${s.outputTph}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">
          <div style="background:#e2e8f0;border-radius:4px;height:8px;width:100px;display:inline-block;vertical-align:middle">
            <div style="background:${sc};height:8px;border-radius:4px;width:${barW}%"></div>
          </div>
          <span style="font-size:10px;margin-left:4px;color:${sc};font-weight:700">${s.loadPct.toFixed(0)}%</span>
        </td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10.5px;text-align:right">${s.energyKwhPerTon}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;color:${sc};font-weight:700;text-transform:uppercase">${s.status}</td>
      </tr>`;
    }).join("");

    const productRows = d.products.map(p => `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${p.label}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">
          <div style="background:#e2e8f0;border-radius:4px;height:10px;width:${Math.min(180, p.yieldPct * 2.2).toFixed(0)}px;display:inline-block;background:${p.color === "#f8fafc" || p.color === "#f1f5f9" ? "#94a3b8" : p.color}"></div>
          <span style="font-size:11px;margin-left:6px;font-weight:700">${p.yieldPct.toFixed(1)}%</span>
        </td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;text-align:right">${p.tonPerDay.toFixed(1)} t/día</td>
      </tr>`).join("");

    const warnItems = d.warnings.map(w => `<li style="margin:4px 0;font-size:11px;color:#7f1d1d;padding:6px 10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:0 4px 4px 0">${w}</li>`).join("");
    const recItems = d.recommendations.map(r => `<li style="margin:4px 0;font-size:11px;color:#1e3a5f;padding:6px 10px;background:#eff6ff;border-left:3px solid #2563eb;border-radius:0 4px 4px 0">${r}</li>`).join("");

    // ── Diagrama de flujo para PDF ─────────────────────────────
    const pdfDiagramGroups = (Object.entries(PHASE_META) as [PhaseKey, typeof PHASE_META[PhaseKey]][])
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([phaseKey, meta]) => ({ meta, machines: pipeline.filter(m => m.phase === phaseKey) }))
      .filter(g => g.machines.length > 0);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Mapa de Molienda Inteligente — TwinsMill</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; }
  .page { page-break-after: always; min-height: 240mm; padding-bottom: 10mm; }
  .page:last-child { page-break-after: avoid; }
  h1 { font-size: 22px; color: #0f2f63; margin: 0 0 2px; }
  h2 { font-size: 14px; color: #0f2f63; border-bottom: 2px solid #b98656; padding-bottom: 4px; margin: 18px 0 10px; }
  h3 { font-size: 12px; color: #475569; margin: 12px 0 6px; font-weight: 600; }
  .brand { color: #b98656; font-weight: 800; }
  .header-band { background: linear-gradient(135deg,#0f2f63,#1a4b8f); color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 14px; }
  .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
  .kpi-val { font-size: 22px; font-weight: 900; color: #0f2f63; }
  .kpi-unit { font-size: 10px; color: #64748b; margin-top: 2px; }
  .kpi-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f2f63; color: white; padding: 6px 8px; font-size: 10.5px; text-align: left; }
  .score-badge { font-size: 42px; font-weight: 900; color: ${scoreColor}; }
  .footer { font-size: 9px; color: #94a3b8; text-align: center; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  ul { list-style: none; padding: 0; margin: 0; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; }
  .chip-ok { background: #dcfce7; color: #15803d; }
  .chip-warn { background: #fef9c3; color: #92400e; }
  .chip-bad { background: #fee2e2; color: #b91c1c; }
</style></head><body>

<!-- ══ PÁGINA 1: PORTADA + DIAGRAMA ══════════════════════════ -->
<div class="page">
  <div class="header-band">
    <div>
      <div style="font-size:10px;letter-spacing:0.15em;opacity:0.7;margin-bottom:4px">REPORTE TÉCNICO · TWINSMILLL IA</div>
      <h1 style="color:white;margin:0">Mapa de Molienda Inteligente</h1>
      <div style="font-size:12px;opacity:0.75;margin-top:4px">${grainLabel} &nbsp;·&nbsp; ${hoursPerDay}h/día &nbsp;·&nbsp; ${availabilityPct}% disponibilidad</div>
    </div>
    <div style="text-align:right">
      <div class="score-badge" style="color:#f8fafc">${d.score}</div>
      <div style="font-size:10px;opacity:0.65;margin-top:2px">SCORE DISEÑO / 100</div>
      <div style="font-size:9px;opacity:0.5;margin-top:6px">${dateStr}</div>
    </div>
  </div>

  <h2>Indicadores Clave de Desempeño</h2>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-lbl">Throughput</div><div class="kpi-val">${d.throughputTph.toFixed(1)}</div><div class="kpi-unit">t/h</div></div>
    <div class="kpi-card"><div class="kpi-lbl">Extracción</div><div class="kpi-val" style="color:#16a34a">${d.extractionPct.toFixed(1)}</div><div class="kpi-unit">%</div></div>
    <div class="kpi-card"><div class="kpi-lbl">Cap. Diaria</div><div class="kpi-val">${d.dailyCapacityTons.toFixed(0)}</div><div class="kpi-unit">t/día</div></div>
    <div class="kpi-card"><div class="kpi-lbl">Prod. Anual</div><div class="kpi-val">${d.annualCapacityKt.toFixed(1)}</div><div class="kpi-unit">kt/año</div></div>
    <div class="kpi-card"><div class="kpi-lbl">Energía</div><div class="kpi-val" style="color:#d97706">${d.energyKwhPerTon.toFixed(1)}</div><div class="kpi-unit">kWh/t</div></div>
    <div class="kpi-card"><div class="kpi-lbl">Cenizas</div><div class="kpi-val" style="color:${ashOk ? "#16a34a":"#dc2626"}">${(d.ashPct*100).toFixed(2)}</div><div class="kpi-unit">% <span class="chip ${ashOk?"chip-ok":"chip-bad"}">${ashOk?"OK":"ALTO"}</span></div></div>
    <div class="kpi-card"><div class="kpi-lbl">Harina/día</div><div class="kpi-val" style="color:#0f2f63">${d.flourTonPerDay.toFixed(1)}</div><div class="kpi-unit">t/día</div></div>
    <div class="kpi-card"><div class="kpi-lbl">Acondic.</div><div class="kpi-val" style="color:${d.temperingHours>=12?"#0284c7":"#dc2626"}">${d.temperingHours.toFixed(1)}</div><div class="kpi-unit">h reposo</div></div>
  </div>

  <h2>Diagrama de Proceso — Equipos Configurados</h2>
  <table>
    <thead><tr><th>Código</th><th>Equipo</th><th>Etapa</th><th style="text-align:right">Capacidad</th></tr></thead>
    <tbody>${machineRows}</tbody>
  </table>
  <div class="footer">TwinsMill · Mapa de Molienda Inteligente · Generado ${dateStr} · Pág. 1 de 4</div>
</div>

<!-- ══ PÁGINA 2: DIAGRAMA DE FLUJO ═════════════════════════════ -->
<div class="page">
  <div class="header-band" style="padding:10px 20px">
    <div>
      <div style="font-size:9px;opacity:0.6;letter-spacing:0.12em">TWINSMILLL IA · DISEÑO DE PROCESO</div>
      <div style="font-size:16px;font-weight:800;color:white">Diagrama de Flujo del Proceso</div>
    </div>
    <div style="font-size:11px;opacity:0.75">${grainLabel} · ${dateStr}</div>
  </div>
  <div style="margin-bottom:10px;display:flex;align-items:center;gap:6px">
    <div style="flex:1;height:1px;background:#b98656;opacity:0.4"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:0.15em;color:#b98656;text-transform:uppercase;white-space:nowrap">↓ ENTRADA DE GRANO</span>
    <div style="flex:1;height:1px;background:#b98656;opacity:0.4"></div>
  </div>
  ${pdfDiagramGroups.map((group, gIdx) => {
    const machineBoxes = group.machines.map((m, mIdx) => {
      const isBn = d.bottleneckTph > 0 && m.configuredCapacity === d.bottleneckTph && pipeline.length > 1;
      const capTxt = m.bagSizeKg ? `${Math.round(m.configuredCapacity * 1000 / m.bagSizeKg)} b/h` : `${m.configuredCapacity} t/h`;
      const boxBg = isBn ? '#fffbeb' : `${group.meta.color}12`;
      const boxBorder = isBn ? '2px solid #f59e0b' : `1px solid ${group.meta.color}45`;
      const codeColor = isBn ? '#d97706' : group.meta.color;
      const arrow = mIdx < group.machines.length - 1 ? `<span style="color:${group.meta.color};font-size:13px;flex-shrink:0">→</span>` : '';
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;padding:5px 9px;border-radius:7px;background:${boxBg};border:${boxBorder};min-width:72px;text-align:center">${isBn ? '<div style="font-size:8px;font-weight:800;color:#d97706">⚡ CUELLO</div>' : ''}<div style="font-size:10px;font-weight:800;color:${codeColor};font-family:monospace">${m.code}</div><div style="font-size:8.5px;color:#374151;margin-top:1px;line-height:1.2">${m.label}</div><div style="font-size:8.5px;font-weight:700;color:#6b7280;margin-top:2px">${capTxt}</div></div>${arrow}`;
    }).join('');
    const nextGroup = pdfDiagramGroups[gIdx + 1];
    const connector = gIdx < pdfDiagramGroups.length - 1 && nextGroup
      ? `<div style="display:flex;align-items:center;padding:2px 0 2px 8px;gap:5px"><span style="font-size:8.5px;color:${nextGroup.meta.color};font-weight:700;text-transform:uppercase;letter-spacing:0.08em">${nextGroup.meta.icon} ${nextGroup.meta.label} ↓</span></div>`
      : '';
    return `<div style="margin-bottom:5px"><div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:7px;background:${group.meta.color}14;border-left:4px solid ${group.meta.color};margin-bottom:5px"><span style="font-size:12px">${group.meta.icon}</span><div style="flex:1"><span style="font-size:10px;font-weight:800;color:${group.meta.color};text-transform:uppercase;letter-spacing:0.08em">${group.meta.label}</span><span style="font-size:9px;color:#6b7280;margin-left:6px">${group.meta.desc}</span></div><span style="font-size:9px;background:${group.meta.color}25;color:${group.meta.color};padding:1px 7px;border-radius:99px;font-weight:700">${group.machines.length} eq.</span></div><div style="display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:0 8px;margin-bottom:2px">${machineBoxes}</div></div>${connector}`;
  }).join('')}
  <div style="margin-top:10px;display:flex;align-items:center;gap:6px">
    <div style="flex:1;height:1px;background:#b98656;opacity:0.4"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:0.15em;color:#b98656;text-transform:uppercase;white-space:nowrap">SALIDA DE HARINA ↓</span>
    <div style="flex:1;height:1px;background:#b98656;opacity:0.4"></div>
  </div>
  <div class="footer">TwinsMill · Mapa de Molienda Inteligente · Generado ${dateStr} · Pág. 2 de 4</div>
</div>

<!-- ══ PÁGINA 3: BALANCE DE MASA + PRODUCTOS ═════════════════ -->
<div class="page">
  <div class="header-band" style="padding:10px 20px">
    <div><div style="font-size:9px;opacity:0.6;letter-spacing:0.12em">TWINSMILLL IA · SIMULACIÓN FÍSICA</div>
    <div style="font-size:16px;font-weight:800;color:white">Balance de Masa y Productos</div></div>
    <div style="font-size:11px;opacity:0.75">${grainLabel} · ${dateStr}</div>
  </div>

  <h2>Balance de Masa por Etapa</h2>
  <table>
    <thead><tr><th>Etapa</th><th style="text-align:right">Entrada t/h</th><th style="text-align:right">Salida t/h</th><th>Carga %</th><th style="text-align:right">kWh/t</th><th>Estado</th></tr></thead>
    <tbody>${balanceRows}</tbody>
  </table>
  <div style="margin-top:8px;display:flex;gap:12px;font-size:10px">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#16a34a;border-radius:2px;display:inline-block"></span> OK</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#d97706;border-radius:2px;display:inline-block"></span> Sobrecarga</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#94a3b8;border-radius:2px;display:inline-block"></span> Subcarga</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#dc2626;border-radius:2px;display:inline-block"></span> Crítico</span>
  </div>

  <h2>Distribución de Productos</h2>
  <table>
    <thead><tr><th>Producto</th><th>Rendimiento</th><th style="text-align:right">Producción</th></tr></thead>
    <tbody>${productRows}</tbody>
  </table>
  <div style="margin-top:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;display:flex;gap:24px">
    <div><div style="font-size:10px;color:#64748b;margin-bottom:2px">HARINA TOTAL / DÍA</div><div style="font-size:20px;font-weight:900;color:#15803d">${d.flourTonPerDay.toFixed(1)} t</div></div>
    <div><div style="font-size:10px;color:#64748b;margin-bottom:2px">SALVADO / DÍA</div><div style="font-size:20px;font-weight:900;color:#92400e">${d.branTonPerDay.toFixed(1)} t</div></div>
    <div><div style="font-size:10px;color:#64748b;margin-bottom:2px">CUELLO DE BOTELLA</div><div style="font-size:14px;font-weight:800;color:#b98656">${d.bottleneckLabel}</div><div style="font-size:11px;color:#94a3b8">${d.bottleneckTph.toFixed(1)} t/h</div></div>
  </div>
  <div class="footer">TwinsMill · Mapa de Molienda Inteligente · Generado ${dateStr} · Pág. 3 de 4</div>
</div>

<!-- ══ PÁGINA 3: ALERTAS + RECOMENDACIONES IA ════════════════ -->
<div class="page">
  <div class="header-band" style="padding:10px 20px">
    <div><div style="font-size:9px;opacity:0.6;letter-spacing:0.12em">TWINSMILLL IA · MOTOR DE RECOMENDACIONES</div>
    <div style="font-size:16px;font-weight:800;color:white">Alertas y Recomendaciones</div></div>
    <div style="text-align:right">
      <div style="font-size:30px;font-weight:900;color:${scoreColor === "#16a34a" ? "#86efac" : scoreColor === "#d97706" ? "#fde68a" : "#fca5a5"}">${d.score}<span style="font-size:13px;font-weight:400;opacity:0.7">/100</span></div>
      <div style="font-size:9px;opacity:0.6">${d.score >= 80 ? "DISEÑO ÓPTIMO ✅" : d.score >= 60 ? "DISEÑO FUNCIONAL ⚠" : "REVISAR DISEÑO ❌"}</div>
    </div>
  </div>

  ${d.warnings.length > 0 ? `<h2>⚠ Alertas Críticas (${d.warnings.length})</h2><ul>${warnItems}</ul>` : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;color:#15803d;font-weight:700;margin-bottom:16px">✅ Sin alertas críticas — todas las etapas cubiertas</div>`}

  <h2>🤖 Recomendaciones IA — Acciones Cuantificadas</h2>
  <ul>${recItems}</ul>

  <h2>Parámetros de Simulación</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">
      <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700">Grano</div>
      <div style="font-size:13px;font-weight:700;color:#0f2f63;margin-top:2px">${grainLabel}</div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">
      <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700">Horas / día</div>
      <div style="font-size:13px;font-weight:700;color:#0f2f63;margin-top:2px">${hoursPerDay} h</div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">
      <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700">Disponibilidad</div>
      <div style="font-size:13px;font-weight:700;color:#0f2f63;margin-top:2px">${availabilityPct}%</div>
    </div>
  </div>

  <div class="footer" style="margin-top:16px">TwinsMill · Mapa de Molienda Inteligente · Generado ${dateStr} · Pág. 4 de 4 &nbsp;|&nbsp; Resultados basados en simulación física — no reemplazan engineering review profesional</div>
</div>
</body></html>`;

    const win = window.open("", "_blank", "width=900,height=750");
    if (!win) { alert("Permite ventanas emergentes para exportar el PDF"); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }, [pipeline, grain, hoursPerDay, availabilityPct, detailedResult]);

  const handleSimulate = useCallback(async () => {
    if (pipeline.length < 3) return;
    setSimulating(true);
    setSimError(null);
    setSimDirty(false);
    // Brief delay for UX — gives sense of computation
    await new Promise(resolve => setTimeout(resolve, 550));
    try {
      const result = runDetailedSimulation(pipeline, grain, hoursPerDay, availabilityPct);
      if (!result) throw new Error("No hay equipos de flujo en el pipeline");
      setDetailedResult(result);
      // Also push to backend for persistence (non-blocking)
      runPhysicalTwinModel(buildPhysicalInput()).catch(() => {});
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Error en simulación");
    } finally {
      setSimulating(false);
    }
  }, [pipeline, grain, hoursPerDay, availabilityPct, buildPhysicalInput]);

  const palettePhases: Array<PhaseKey | "todos"> = ["todos", "almacenaje", "recepcion", "limpieza", "acondicionamiento", "molienda", "cernido", "terminacion", "empaque"];

  /* Phase-grouped view for canvas */
  const phaseGroups = useMemo(() => {
    return (Object.entries(PHASE_META) as [PhaseKey, typeof PHASE_META[PhaseKey]][])
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([phaseKey, meta]) => ({
        phase: phaseKey,
        meta,
        machines: pipeline
          .map((m, globalIdx) => ({ m, globalIdx }))
          .filter(({ m }) => m.phase === phaseKey),
      }))
      .filter((g) => g.machines.length > 0);
  }, [pipeline]);

  const filteredMachines = useMemo(() => {
    const grainFiltered = ALL_MACHINES.filter((m) => m.grains.includes(grain));
    if (activePaletteTab === "todos") return grainFiltered;
    return grainFiltered.filter((m) => m.phase === activePaletteTab);
  }, [grain, activePaletteTab]);

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-lg">

      {/* ── TOP HEADER ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-slate-900 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.18em] uppercase text-slate-400">Constructor de Molino</p>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Sora, sans-serif" }}>
              Diseñador de Diagrama de Proceso
            </h2>
            <p className="text-[0.72rem] text-slate-400 mt-0.5">
              Selecciona equipos como piezas de un rompecabezas · La IA calcula capacidad, rendimiento y cuello de botella
            </p>
          </div>

          {/* Grain selector */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              {([["trigo_blando", "Trigo Blando"], ["trigo_duro", "Trigo Duro"], ["maiz", "Maíz"]] as [GrainType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setGrain(key)}
                  className={`rounded-lg px-3 py-1.5 text-[0.72rem] font-bold border transition-all ${
                    grain === key
                      ? "bg-amber-500 text-white border-amber-400 shadow-md"
                      : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"
                  }`}
                >
                  {key === "maiz" ? "🌽" : "🌾"} {label}
                </button>
              ))}
            </div>
            {/* Hours + availability */}
            <div className="flex gap-4">
              <label className="flex flex-col">
                <span className="text-[0.6rem] text-slate-400">Horas/día</span>
                <div className="flex items-center gap-2">
                  <input type="range" min={8} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(+e.target.value)}
                    className="w-20 h-1 accent-amber-500" />
                  <span className="text-[0.7rem] font-bold text-white w-8">{hoursPerDay}h</span>
                </div>
              </label>
              <label className="flex flex-col">
                <span className="text-[0.6rem] text-slate-400">Disponibilidad</span>
                <div className="flex items-center gap-2">
                  <input type="range" min={60} max={99} value={availabilityPct} onChange={(e) => setAvailabilityPct(+e.target.value)}
                    className="w-20 h-1 accent-amber-500" />
                  <span className="text-[0.7rem] font-bold text-white w-10">{availabilityPct}%</span>
                </div>
              </label>
            </div>
            {/* Moisture parameters for yield formulas */}
            <div className="flex gap-3 flex-wrap">
              {[
                { label: "💧 H° campo (%)", value: grainFieldMoisturePct, set: setGrainFieldMoisturePct, min: 8, max: 22, step: 0.5, title: "Humedad del grano al llegar del campo" },
                { label: "🎯 H° reposo (%)", value: conditioningTargetMoisturePct, set: setConditioningTargetMoisturePct, min: 12, max: 18, step: 0.1, title: "Humedad objetivo tras acondicionamiento" },
                { label: "📦 H° harina (%)", value: flourOutputMoisturePct, set: setFlourOutputMoisturePct, min: 10, max: 16, step: 0.1, title: "Humedad de harina empacada" },
              ].map((f) => (
                <label key={f.label} className="flex flex-col" title={f.title}>
                  <span className="text-[0.6rem] text-slate-400">{f.label}</span>
                  <input
                    type="number"
                    min={f.min} max={f.max} step={f.step}
                    value={f.value}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) f.set(Math.max(f.min, Math.min(f.max, v)));
                    }}
                    className="w-16 rounded px-1.5 py-0.5 text-[0.72rem] font-bold text-slate-900 bg-slate-200 border-0 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Template quick-loads */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[0.62rem] text-slate-500 self-center">Plantillas rápidas:</span>
          {(Object.entries(TEMPLATES) as [TemplateKey, typeof TEMPLATES[TemplateKey]][]).map(([key, tpl]) => (
            <button
              key={key}
              onClick={() => loadTemplate(key)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-[0.68rem] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              ⚡ {tpl.label}
            </button>
          ))}
          <button
            onClick={() => { setPipeline([]); localStorage.removeItem("mill-design-pipeline"); }}
            className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-2.5 py-1 text-[0.68rem] font-semibold text-rose-400 hover:bg-rose-900/40 transition-colors"
          >
            ✕ Limpiar
          </button>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────── */}
      <div className="flex min-h-[560px] overflow-hidden">

        {/* ── LEFT: MACHINE PALETTE ─────────────────── */}
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-3 py-2">
            <p className="text-[0.65rem] font-bold tracking-widest uppercase text-slate-400">Catálogo de Equipos</p>
            {/* Phase filter tabs (vertical) */}
            <div className="mt-2 flex flex-wrap gap-1">
              {palettePhases.map((ph) => (
                <button
                  key={ph}
                  onClick={() => setActivePaletteTab(ph)}
                  className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold border transition-all ${
                    activePaletteTab === ph
                      ? "text-white"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                  }`}
                  style={
                    activePaletteTab === ph
                      ? { background: ph === "todos" ? "#0f2f63" : PHASE_META[ph as PhaseKey]?.color, borderColor: "transparent" }
                      : {}
                  }
                >
                  {ph === "todos" ? "Todos" : PHASE_META[ph as PhaseKey].label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 p-3">
            {filteredMachines.map((m) => (
              <PaletteCard
                key={m.id}
                m={m}
                onAdd={addMachine}
                placedCount={placedCounts.get(m.id) ?? 0}
              />
            ))}
          </div>
        </aside>

        {/* ── CENTER: BUILD CANVAS ──────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Phase progress bar */}
          <div className="flex border-b border-slate-200 bg-white">
            {(Object.entries(PHASE_META) as [PhaseKey, typeof PHASE_META[PhaseKey]][])
              .sort((a, b) => a[1].order - b[1].order)
              .map(([key, meta]) => {
                const inPipeline = pipeline.some((m) => m.phase === key);
                return (
                  <div
                    key={key}
                    className={`flex-1 py-1.5 text-center border-r border-slate-100 transition-colors ${
                      inPipeline ? "opacity-100" : "opacity-30"
                    }`}
                    style={{ borderBottom: inPipeline ? `2.5px solid ${meta.color}` : "2.5px solid transparent" }}
                  >
                    <p className="text-[0.58rem] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                      {meta.label}
                    </p>
                    {inPipeline && (
                      <p className="text-[0.55rem] text-slate-400">
                        {pipeline.filter((m) => m.phase === key).length} eq.
                      </p>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Pipeline canvas — phase swim-lanes */}
          <div
            className="relative flex-1 overflow-auto p-5"
            style={{ background: "linear-gradient(145deg, #0d1829 0%, #0f2f63 60%, #0d1829 100%)" }}
          >
            {/* Dot grid */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]">
              <defs>
                <pattern id="dg" width="32" height="32" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.8)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dg)" />
            </svg>

            {pipeline.length === 0 ? (
              <div className="relative flex h-full min-h-[280px] flex-col items-center justify-center gap-3">
                <div className="rounded-2xl border-2 border-dashed border-slate-600/60 p-10 text-center max-w-sm">
                  <p className="text-5xl mb-4">🧩</p>
                  <p className="text-base font-bold text-white/80" style={{ fontFamily: "Sora, sans-serif" }}>
                    Construye tu diagrama de proceso
                  </p>
                  <p className="mt-1.5 text-sm text-slate-400">
                    Selecciona equipos del catálogo o carga una plantilla rápida
                  </p>
                  <p className="mt-3 text-[0.7rem] text-slate-500">
                    La IA calculará capacidad, extracción y cuello de botella en tiempo real
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative flex flex-col gap-0 min-w-0">
                {/* Entry label */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-amber-500/20" />
                  <span className="text-[0.58rem] font-bold tracking-[0.22em] text-amber-500/50 uppercase">
                    ↓ Entrada de Grano
                  </span>
                  <div className="h-px flex-1 bg-amber-500/20" />
                </div>

                {phaseGroups.map((group, groupIdx) => (
                  <div key={group.phase}>
                    {/* ── SWIM LANE ROW ── */}
                    <div>
                      {/* Full-width phase banner */}
                      <div
                        className="flex items-center gap-3 px-3 py-2 mb-3 rounded-xl"
                        style={{
                          background: `${group.meta.color}18`,
                          border: `1px solid ${group.meta.color}35`,
                          borderLeft: `4px solid ${group.meta.color}`,
                        }}
                      >
                        <span className="text-lg shrink-0">{group.meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className="text-[0.7rem] font-black uppercase tracking-widest leading-tight"
                              style={{ color: group.meta.color }}
                            >
                              {group.meta.label}
                            </p>
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[0.52rem] font-bold"
                              style={{ background: `${group.meta.color}25`, color: group.meta.color }}
                            >
                              {group.machines.length} eq.
                            </span>
                          </div>
                          <p className="text-[0.6rem] text-white/45 mt-0.5 truncate">{group.meta.desc}</p>
                        </div>
                      </div>

                      {/* Machines — horizontal scroll within lane */}
                      <div className="overflow-x-auto pb-1">
                        <div className="flex items-center gap-0">
                          {group.machines.map(({ m, globalIdx }, localIdx) => (
                            <PipelineNode
                              key={m.instanceId}
                              m={m}
                              index={globalIdx}
                              total={pipeline.length}
                              onRemove={() => removeMachine(m.instanceId)}
                              onCapChange={(v) => updateCapacity(m.instanceId, v)}
                              onParam2Change={(v) => updateParam2(m.instanceId, v)}
                              onMoveLeft={() => moveMachine(m.instanceId, -1)}
                              onMoveRight={() => moveMachine(m.instanceId, 1)}
                              showConnector={localIdx < group.machines.length - 1}
                              isBottleneck={analysis.bottleneck > 0 && m.configuredCapacity === analysis.bottleneck && pipeline.length > 1}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── VERTICAL CONNECTOR to next phase ── */}
                    {groupIdx < phaseGroups.length - 1 && (
                      <div className="flex items-center my-0.5" style={{ marginLeft: 12 }}>
                        <svg width="24" height="32" viewBox="0 0 24 32">
                          <line
                            x1="12" y1="0" x2="12" y2="22"
                            stroke="#b98656" strokeWidth="1.5" strokeDasharray="4 2"
                          >
                            <animate
                              attributeName="stroke-dashoffset"
                              from="0" to="-12"
                              dur="0.85s" repeatCount="indefinite"
                            />
                          </line>
                          <polygon points="6,20 12,32 18,20" fill="#b98656" opacity="0.75" />
                        </svg>
                        <span
                          className="ml-2 text-[0.55rem] font-semibold uppercase tracking-widest"
                          style={{ color: phaseGroups[groupIdx + 1]?.meta.color ?? "#b98656", opacity: 0.6 }}
                        >
                          {phaseGroups[groupIdx + 1]?.meta.label}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Exit label */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-amber-500/20" />
                  <span className="text-[0.58rem] font-bold tracking-[0.22em] text-amber-500/50 uppercase">
                    Salida de Harina ↓
                  </span>
                  <div className="h-px flex-1 bg-amber-500/20" />
                </div>
              </div>
            )}
          </div>

          {/* Bottom stats bar */}
          {pipeline.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-white px-5 py-3">
              {[
                { label: "Cuello botella", value: `${analysis.bottleneck.toFixed(0)} t/h`, sub: analysis.bottleneckLabel, color: analysis.bottleneck < 10 ? "text-rose-600" : "text-blue-700" },
                { label: "Capacidad/día", value: `${Math.round(analysis.dailyCapacity)} t`, sub: `${hoursPerDay}h × ${availabilityPct}%`, color: "text-emerald-600" },
                { label: "Producción anual", value: `${Math.round(analysis.annualCapacity / 1000)} kt`, sub: "300 días", color: "text-violet-600" },
                { label: "Extracción", value: `${analysis.extractionPct.toFixed(1)}%`, sub: `${grain.replace("_", " ")}`, color: "text-amber-600" },
                { label: "Energía", value: `${analysis.energyKwhPerTon.toFixed(0)} kWh/t`, sub: "estimado", color: "text-slate-600" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[0.62rem] text-slate-400 uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[0.6rem] text-slate-400">{stat.sub}</p>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* ── RIGHT: AI ANALYSIS — dark live panel ─────── */}
        <aside
          className="w-80 shrink-0 flex flex-col overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #060f1f 0%, #091629 100%)",
            borderLeft: "1px solid rgba(185,134,86,0.18)",
          }}
        >
          {/* ── STICKY TOP: header + Calcular + PDF ─────── */}
          <div className="shrink-0" style={{ background: "rgba(6,12,28,0.98)", borderBottom: "1px solid rgba(185,134,86,0.18)" }}>
            {/* Header */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5">
              <div>
                <p className="text-[0.55rem] font-bold tracking-[0.2em] uppercase text-amber-400/70">Motor IA · Análisis en Tiempo Real</p>
                <p className="text-[0.78rem] font-bold text-white mt-0.5">Simulación de Molienda</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[0.55rem] text-emerald-400 font-semibold">LIVE</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-3 py-3 space-y-2">
              {/* CALCULAR */}
              <button
                disabled={pipeline.length < 3 || simulating}
                onClick={handleSimulate}
                className="w-full rounded-xl py-2.5 text-[0.8rem] font-bold text-white transition-all disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: pipeline.length >= 3
                    ? simulating
                      ? "linear-gradient(135deg,#b98656aa,#d4a76aaa)"
                      : "linear-gradient(135deg,#b98656,#d4a76a)"
                    : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(185,134,86,0.5)",
                  boxShadow: pipeline.length >= 3 && !simulating ? "0 0 18px rgba(185,134,86,0.35)" : "none",
                }}
              >
                {simulating ? (
                  <>
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20" />
                    </svg>
                    Calculando...
                  </>
                ) : (
                  <> ⚙ Calcular / Procesar </>
                )}
              </button>

              {/* PDF + Gemelo row */}
              <div className="flex gap-2">
                <button
                  disabled={!detailedResult || simDirty}
                  onClick={handleExportPDF}
                  className="flex-1 rounded-xl py-2 text-[0.72rem] font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  style={{
                    background: detailedResult && !simDirty ? "linear-gradient(135deg,#1e3a5f,#2563eb)" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(37,99,235,0.4)",
                  }}
                  title="Exportar Mapa de Molienda Inteligente en PDF (3 páginas)"
                >
                  📄 Exportar PDF
                </button>
                <button
                  disabled={pipeline.length < 3}
                  onClick={() => {
                    localStorage.setItem("mill-design-snapshot", JSON.stringify({
                      grain, machineCount: pipeline.length, score: analysis.score,
                      dailyCapacity: analysis.dailyCapacity, annualCapacity: analysis.annualCapacity,
                      extractionPct: analysis.extractionPct, energyKwhPerTon: analysis.energyKwhPerTon,
                      bottleneckLabel: analysis.bottleneckLabel, warnings: analysis.warnings,
                      recommendations: analysis.recommendations, products: analysis.products,
                      pipelineLabels: pipeline.map(m => `${m.code} · ${m.label}`),
                      twinResult: detailedResult ?? null, savedAt: new Date().toISOString(),
                    }));
                    router.push("/twinmill");
                  }}
                  className="flex-1 rounded-xl py-2 text-[0.72rem] font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  style={{
                    background: pipeline.length >= 3 ? "linear-gradient(135deg,#0f2f63,#1a4b8f)" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(185,134,86,0.3)",
                  }}
                >
                  🔬 Gemelo
                </button>
              </div>

              {/* Status hint */}
              {simError && <p className="text-[0.6rem] text-rose-400 text-center">{simError}</p>}
              {!simError && (
                <p className="text-center text-[0.55rem] text-white/25">
                  {pipeline.length < 3
                    ? `Mín. 3 equipos · actual: ${pipeline.length}`
                    : detailedResult && !simDirty
                    ? "✅ Calculado — PDF disponible"
                    : simDirty ? "⚠ Config cambió — recalcular" : "Configura y presiona Calcular"}
                </p>
              )}
            </div>
          </div>

          {/* ── SCROLLABLE BODY: all results ─────────────── */}
          <div className="flex-1 overflow-y-auto">
            {pipeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/4 p-6">
                  <p className="text-3xl mb-3">🤖</p>
                  <p className="text-sm font-semibold text-white/60">Agrega equipos al flujo</p>
                  <p className="text-[0.68rem] text-white/30 mt-1">Los indicadores estratégicos se calcularán automáticamente</p>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-3">

                {/* Score row */}
                {(() => {
                  const sc = detailedResult?.score ?? analysis.score;
                  const scColor = sc >= 80 ? "#34d399" : sc >= 60 ? "#fbbf24" : "#f87171";
                  return (
                    <div className="rounded-2xl border border-white/8 bg-white/4 p-3 flex items-center gap-3">
                      <div className="relative shrink-0">
                        <svg width="52" height="52" viewBox="0 0 52 52">
                          <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
                          <circle cx="26" cy="26" r="21" fill="none" stroke={scColor} strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={`${(sc / 100) * 132} 132`}
                            transform="rotate(-90 26 26)"
                            style={{ transition: "stroke-dasharray 0.8s ease" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[1rem] font-black leading-none" style={{ color: scColor }}>{sc}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[0.58rem] uppercase tracking-widest text-white/40 font-bold">Score</p>
                          {detailedResult && !simDirty && <span className="rounded-full px-1.5 py-0.5 text-[0.48rem] font-bold" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>SIMULADO</span>}
                          {simDirty && detailedResult && <span className="rounded-full px-1.5 py-0.5 text-[0.48rem] font-bold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>DESACT.</span>}
                        </div>
                        <p className="text-[0.68rem] text-white/70 mt-0.5 leading-tight">
                          {sc >= 80 ? "Diseño industrial óptimo" : sc >= 60 ? "Funcional — mejoras posibles" : "Incompleto — revisar equipos"}
                        </p>
                        <p className="text-[0.58rem] text-white/30 mt-0.5">{pipeline.length} equipos</p>
                      </div>
                    </div>
                  );
                })()}

                {/* KPI grid — 2-column, larger numbers */}
                {(() => {
                  const d = detailedResult;
                  const kpis = [
                    { label: "Throughput",  value: d ? d.throughputTph.toFixed(1)     : analysis.bottleneck.toFixed(0),               unit: "t/h",    accent: "#60a5fa", bg: "rgba(59,130,246,0.09)",   border: "rgba(59,130,246,0.22)" },
                    { label: "Extracción",  value: d ? d.extractionPct.toFixed(1)     : analysis.extractionPct.toFixed(1),            unit: "%",      accent: "#34d399", bg: "rgba(52,211,153,0.09)",  border: "rgba(52,211,153,0.22)" },
                    { label: "Cap./Día",    value: d ? d.dailyCapacityTons.toFixed(0)  : Math.round(analysis.dailyCapacity).toString(), unit: "t/día",  accent: "#a78bfa", bg: "rgba(167,139,250,0.09)", border: "rgba(167,139,250,0.22)" },
                    { label: "Energía",     value: d ? d.energyKwhPerTon.toFixed(1)    : analysis.energyKwhPerTon.toFixed(0),          unit: "kWh/t",  accent: "#fbbf24", bg: "rgba(251,191,36,0.09)",  border: "rgba(251,191,36,0.22)" },
                    { label: "Anual",       value: d ? d.annualCapacityKt.toFixed(1)   : (analysis.annualCapacity / 1000).toFixed(0),  unit: "kt/año", accent: "#f472b6", bg: "rgba(244,114,182,0.09)", border: "rgba(244,114,182,0.22)" },
                    { label: d ? "Cenizas" : "Disponib.", value: d ? (d.ashPct * 100).toFixed(2) : availabilityPct.toString(), unit: "%",
                      accent: d ? (d.ashPct > 0.0055 ? "#f87171" : "#34d399") : "#38bdf8",
                      bg: d ? "rgba(248,113,113,0.09)" : "rgba(56,189,248,0.09)", border: d ? "rgba(248,113,113,0.22)" : "rgba(56,189,248,0.22)" },
                    ...(d ? [
                      { label: "Harina/día", value: d.flourTonPerDay.toFixed(1), unit: "t",  accent: "#86efac", bg: "rgba(134,239,172,0.09)", border: "rgba(134,239,172,0.22)" },
                      { label: "Acondic.",   value: d.temperingHours.toFixed(1),  unit: "h",
                        accent: d.temperingHours < 10 ? "#f87171" : "#38bdf8",
                        bg: "rgba(56,189,248,0.09)", border: "rgba(56,189,248,0.22)" },
                    ] : [{ label: "Disponib.", value: availabilityPct.toString(), unit: "%", accent: "#38bdf8", bg: "rgba(56,189,248,0.09)", border: "rgba(56,189,248,0.22)" }]),
                  ];
                  return (
                    <div>
                      <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-amber-400/60 mb-1.5">Indicadores Clave</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {kpis.map((kpi) => (
                          <div key={kpi.label} className="rounded-xl p-2.5 text-center" style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                            <p className="text-[0.52rem] uppercase tracking-widest font-bold mb-1" style={{ color: kpi.accent, opacity: 0.75 }}>{kpi.label}</p>
                            <p className="text-[1.4rem] font-black leading-none tabular-nums" style={{ color: kpi.accent }}>{kpi.value}</p>
                            <p className="text-[0.52rem] font-semibold mt-0.5" style={{ color: kpi.accent, opacity: 0.55 }}>{kpi.unit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── HUMEDAD Y RENDIMIENTO BASE SECA ──────────────── */}
                <div className="rounded-xl overflow-hidden border border-sky-500/20 bg-sky-500/6 px-3 py-2.5">
                  <p className="text-[0.55rem] font-bold uppercase tracking-widest text-sky-400/80 mb-2">💧 Humedad · Rendimiento Real</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[0.6rem] text-white/55">H° campo entrada</span>
                      <span className="text-[0.78rem] font-bold text-sky-300">{grainFieldMoisturePct.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[0.6rem] text-white/55">H° objetivo reposo</span>
                      <span className="text-[0.78rem] font-bold text-sky-300">{conditioningTargetMoisturePct.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[0.6rem] text-white/55">H° harina salida</span>
                      <span className="text-[0.78rem] font-bold text-sky-300">{flourOutputMoisturePct.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 border-t border-white/8 pt-1.5 flex justify-between items-baseline">
                      <span className="text-[0.6rem] text-sky-300/80 font-semibold">💦 Agua a agregar</span>
                      <span className="text-[0.9rem] font-black text-sky-200">
                        {waterToAddLper100kg.toFixed(2)}
                        <span className="text-[0.55rem] font-normal text-white/40 ml-0.5">L/100 kg</span>
                      </span>
                    </div>
                    <div className="rounded-lg bg-emerald-500/12 border border-emerald-500/20 px-2.5 py-2 mt-1">
                      <p className="text-[0.52rem] text-emerald-400/70 uppercase tracking-widest font-bold mb-0.5">Rendimiento Base Seca (RBS)</p>
                      <p className="text-[1.2rem] font-black text-emerald-300 leading-none tabular-nums">
                        {rendimientoBaseSeca.toFixed(1)}%
                      </p>
                      <p className="text-[0.5rem] text-white/25 mt-0.5 leading-tight">
                        = Extracción × (100−H°harina) / (100−H°trigo)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottleneck */}
                {(detailedResult?.bottleneckLabel ?? analysis.bottleneckLabel) !== "—" && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5">
                    <p className="text-[0.55rem] font-bold uppercase tracking-widest text-amber-400/70 mb-0.5">⚡ Cuello de Botella</p>
                    <p className="text-[0.82rem] font-bold text-amber-300 leading-tight">{detailedResult?.bottleneckLabel ?? analysis.bottleneckLabel}</p>
                    <p className="text-[0.6rem] text-amber-400/60 mt-0.5">
                      {(detailedResult?.bottleneckTph ?? analysis.bottleneck).toFixed(1)} t/h limita el flujo
                      {detailedResult && ` · ${detailedResult.flourTonPerDay.toFixed(1)} t harina/día`}
                    </p>
                  </div>
                )}

                {/* Products */}
                {(() => {
                  const prods = detailedResult?.products ?? analysis.products.map(p => ({ ...p, tonPerDay: 0 }));
                  return (
                    <div>
                      <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-amber-400/60 mb-1.5">Productos · Rendimiento</p>
                      <div className="space-y-1.5">
                        {prods.map((p) => {
                          const isLight = p.color === "#f8fafc" || p.color === "#f1f5f9";
                          const dc = isLight ? "#94a3b8" : p.color;
                          return (
                            <div key={p.label}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: dc }} />
                                  <span className="text-[0.62rem] text-white/65 leading-tight">{p.label}</span>
                                </div>
                                <div className="text-right ml-1 shrink-0">
                                  <span className="text-[0.7rem] font-black tabular-nums" style={{ color: dc }}>{p.yieldPct.toFixed(1)}%</span>
                                  {p.tonPerDay > 0 && <span className="ml-1 text-[0.52rem] text-white/30">{p.tonPerDay.toFixed(0)}t</span>}
                                </div>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, p.yieldPct * 1.2)}%`, background: dc, opacity: 0.8 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Stage balance table */}
                {detailedResult && !simulating && (
                  <div>
                    <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-emerald-400/70 mb-1.5">📊 Balance de Masa — {detailedResult.stageBalance.length} etapas</p>
                    <div className="rounded-xl overflow-hidden border border-white/8">
                      {detailedResult.stageBalance.map((s, i) => {
                        const sc = s.status === "critical" ? "#f87171" : s.status === "overload" ? "#fbbf24" : s.status === "underload" ? "#94a3b8" : "#34d399";
                        const barW = Math.min(100, s.loadPct);
                        return (
                          <div key={i} className="px-2.5 py-2 border-b border-white/5 last:border-0" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sc }} />
                                <span className="text-[0.6rem] text-white/65 truncate">{s.stage}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-1">
                                <span className="text-[0.62rem] font-bold tabular-nums" style={{ color: sc }}>{s.outputTph.toFixed(1)}<span className="text-white/25 font-normal"> t/h</span></span>
                                <span className="text-[0.55rem] text-white/30 tabular-nums w-8 text-right">{s.loadPct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barW}%`, background: sc }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex justify-between text-[0.55rem] px-1">
                      <span className="text-white/40">Harina/día: <span className="text-emerald-400 font-bold">{detailedResult.flourTonPerDay.toFixed(1)}t</span></span>
                      <span className="text-white/40">Salvado: <span className="text-amber-400 font-bold">{detailedResult.branTonPerDay.toFixed(1)}t</span></span>
                    </div>
                  </div>
                )}

                {/* Alerts + Recommendations */}
                {(() => {
                  const warns = detailedResult?.warnings ?? analysis.warnings;
                  const recs  = detailedResult?.recommendations ?? analysis.recommendations;
                  const sc    = detailedResult?.score ?? analysis.score;
                  return (
                    <>
                      {warns.length > 0 && (
                        <div>
                          <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-rose-400/70 mb-1.5">⚠ Alertas ({warns.length})</p>
                          <div className="space-y-1">
                            {warns.map((w, i) => (
                              <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5">
                                <p className="text-[0.62rem] text-rose-300 leading-snug">{w}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {recs.length > 0 && (
                        <div>
                          <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-blue-400/70 mb-1.5">🤖 Recomendaciones IA</p>
                          <div className="space-y-1">
                            {recs.map((r, i) => (
                              <div key={i} className="rounded-lg border border-blue-500/18 bg-blue-500/6 px-2.5 py-1.5">
                                <p className="text-[0.62rem] text-blue-300 leading-snug">{r}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {warns.length === 0 && sc >= 70 && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
                          <p className="text-[0.7rem] font-bold text-emerald-300">✅ Diseño Validado</p>
                          <p className="text-[0.58rem] text-emerald-400/60 mt-0.5">Todas las etapas críticas cubiertas</p>
                        </div>
                      )}
                      {/* bottom spacer */}
                      <div className="h-2" />
                    </>
                  );
                })()}

              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
