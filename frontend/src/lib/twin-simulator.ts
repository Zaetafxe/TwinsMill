import type { ModuleKey } from "@/lib/modules";

export type TwinInputs = {
  wheatMoisture: number;
  extractionTarget: number;
  millingEfficiency: number;
  capacityFactor: number;
  demandIndex: number;
  energyCostIndex: number;
  qualityStrictness: number;
};

export type TwinOutcome = {
  kpis: {
    yieldRate: number;
    specCompliance: number;
    serviceLevel: number;
    profitForecast: number;
    customerRisk: number;
  };
  narrative: string;
  recommendation: string;
};

const moduleWeights: Record<ModuleKey, { profit: number; risk: number; quality: number; service: number }> = {
  dashboard: { profit: 1, risk: 1, quality: 1, service: 1 },
  ia: { profit: 1.22, risk: 0.95, quality: 1.18, service: 1.08 },
  twinmill: { profit: 1.15, risk: 1.05, quality: 1.05, service: 1.1 },
  granos: { profit: 0.8, risk: 1.2, quality: 1.3, service: 0.9 },
  produccion: { profit: 1.2, risk: 1.02, quality: 1.1, service: 0.96 },
  tolvas: { profit: 0.92, risk: 1.18, quality: 1.02, service: 1.12 },
  empaques: { profit: 1.08, risk: 1.08, quality: 1, service: 1.06 },
  calidad: { profit: 0.9, risk: 1.26, quality: 1.42, service: 0.94 },
  procesos: { profit: 1.1, risk: 1.1, quality: 1, service: 1 },
  molienda: { profit: 1.2, risk: 1, quality: 1.1, service: 0.95 },
  harina: { profit: 0.95, risk: 1.15, quality: 1.35, service: 1 },
  almacenes: { profit: 0.85, risk: 1.25, quality: 0.9, service: 1.3 },
  ventas: { profit: 1.3, risk: 1.2, quality: 0.85, service: 1.15 },
  catalogos: { profit: 1, risk: 1, quality: 1, service: 1 },
  rentabilidad: { profit: 1.45, risk: 1.1, quality: 0.9, service: 0.95 },
  disenador: { profit: 1, risk: 1, quality: 1, service: 1 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function simulateTwin(moduleKey: ModuleKey, inputs: TwinInputs): TwinOutcome {
  const weights = moduleWeights[moduleKey];

  const moisturePenalty = Math.max(0, inputs.wheatMoisture - 13.4) * 0.012;
  const extractionEffect = (inputs.extractionTarget - 74) * 0.008;
  const efficiencyEffect = (inputs.millingEfficiency - 92) * 0.01;
  const capacityEffect = (inputs.capacityFactor - 100) * 0.004;
  const energyPenalty = (inputs.energyCostIndex - 100) * 0.0016;
  const demandEffect = (inputs.demandIndex - 100) * 0.003;
  const strictnessPenalty = (inputs.qualityStrictness - 100) * 0.0014;

  const yieldRate = clamp(0.74 + extractionEffect + efficiencyEffect - moisturePenalty, 0.62, 0.86);
  const specCompliance = clamp(0.91 + efficiencyEffect * 0.5 - strictnessPenalty - moisturePenalty * 0.7, 0.65, 0.99);
  const serviceLevel = clamp(0.94 + demandEffect + capacityEffect * 0.5 - moisturePenalty * 0.4, 0.7, 0.995);

  const marginBase = 1_320_000;
  const marginDelta =
    marginBase *
    (yieldRate - 0.74) *
    2.5 *
    weights.profit +
    marginBase * (serviceLevel - 0.94) * 1.1 * weights.service -
    marginBase * energyPenalty * 0.9;
  const profitForecast = Math.round(marginBase + marginDelta);

  const customerRisk = clamp(0.22 + moisturePenalty * 1.8 + strictnessPenalty * 0.8 - serviceLevel * 0.2, 0.05, 0.55);

  const narrative =
    `Si la humedad del trigo se mueve a ${inputs.wheatMoisture.toFixed(1)}% y la meta de extraccion a ${inputs.extractionTarget.toFixed(1)}%, ` +
    `el rendimiento proyectado llega a ${(yieldRate * 100).toFixed(1)}% con cumplimiento de especificacion de ${(specCompliance * 100).toFixed(1)}%. ` +
    `Esto mueve el nivel de servicio a ${(serviceLevel * 100).toFixed(1)}%, incrementa o reduce mermas y cambia la presion de riesgo comercial a ${(customerRisk * 100).toFixed(1)}%.`;

  const recommendation =
    customerRisk > 0.3
      ? "Reduce la variacion de humedad en recepcion y baja 0.5 puntos la meta de extraccion para proteger pedidos comprometidos de clientes clave."
      : "La configuracion actual es estable. Incrementa el factor de capacidad entre 1 y 2 puntos para capturar mas demanda sin afectar calidad ni abasto.";

  return {
    kpis: {
      yieldRate,
      specCompliance,
      serviceLevel,
      profitForecast,
      customerRisk,
    },
    narrative,
    recommendation,
  };
}

export const defaultTwinInputs: TwinInputs = {
  wheatMoisture: 13.2,
  extractionTarget: 74.8,
  millingEfficiency: 92.6,
  capacityFactor: 98,
  demandIndex: 101,
  energyCostIndex: 100,
  qualityStrictness: 102,
};
