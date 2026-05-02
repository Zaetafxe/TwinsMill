from dataclasses import dataclass

import numpy as np

from app.schemas.digital_twin import DigitalTwinResponse, DigitalTwinScenario, StageFlow


@dataclass
class StageDefinition:
    name: str
    base_efficiency: float
    base_risk: float


class MillingDigitalTwin:
    def __init__(self) -> None:
        self.stages = [
            StageDefinition("Recepción", 0.995, 0.03),
            StageDefinition("Limpieza", 0.980, 0.05),
            StageDefinition("Molienda", 0.940, 0.08),
            StageDefinition("Cernido", 0.965, 0.06),
            StageDefinition("Mezcla", 0.985, 0.04),
            StageDefinition("Empaque", 0.992, 0.03),
            StageDefinition("Almacén", 0.998, 0.02),
            StageDefinition("Despacho", 0.997, 0.03),
        ]

    def run(self, scenario: DigitalTwinScenario) -> DigitalTwinResponse:
        input_tons = scenario.wheat_input_tons * scenario.capacity_factor
        flows: list[StageFlow] = []

        for stage in self.stages:
            volatility = np.random.uniform(-0.01, 0.01)
            efficiency = max(0.85, min(1.0, stage.base_efficiency + volatility))
            output_tons = input_tons * efficiency
            risk_index = min(1.0, stage.base_risk + (1 - scenario.capacity_factor) * 0.15)
            flows.append(
                StageFlow(
                    stage=stage.name,
                    input_tons=round(input_tons, 2),
                    output_tons=round(output_tons, 2),
                    efficiency=round(efficiency, 4),
                    risk_index=round(risk_index, 4),
                )
            )
            input_tons = output_tons

        sold_tons = flows[-1].output_tons * scenario.demand_index
        revenue = sold_tons * scenario.selling_price_per_ton
        raw_material_cost = scenario.wheat_input_tons * scenario.wheat_cost_per_ton
        energy_cost = sold_tons * 24.5
        gross_profit = revenue - raw_material_cost - energy_cost

        quality_dev_probability = float(np.clip(0.05 + (1 - flows[2].efficiency) * 1.8, 0, 0.95))

        return DigitalTwinResponse(
            stages=flows,
            financial_output={
                "revenue": round(revenue, 2),
                "raw_material_cost": round(raw_material_cost, 2),
                "energy_cost": round(energy_cost, 2),
                "gross_profit": round(gross_profit, 2),
            },
            quality_output={
                "quality_deviation_probability": round(quality_dev_probability, 4),
                "protein_stability_index": round(1 - quality_dev_probability, 4),
            },
            demand_output={
                "demand_index": scenario.demand_index,
                "fulfilled_tons": round(sold_tons, 2),
            },
        )
