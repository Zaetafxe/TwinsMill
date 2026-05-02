from app.digital_twin.engine import MillingDigitalTwin
from app.schemas.digital_twin import DigitalTwinScenario


def run_what_if(scenario: DigitalTwinScenario) -> dict:
    base = MillingDigitalTwin().run(DigitalTwinScenario())
    simulated = MillingDigitalTwin().run(scenario)

    revenue_impact = simulated.financial_output["revenue"] - base.financial_output["revenue"]
    inventory_impact = base.demand_output["fulfilled_tons"] - simulated.demand_output["fulfilled_tons"]
    service_level_impact = max(
        0.0,
        min(1.0, simulated.demand_output["fulfilled_tons"] / max(1.0, base.demand_output["fulfilled_tons"])),
    )

    return {
        "scenario": scenario.model_dump(),
        "revenue_impact": round(revenue_impact, 2),
        "inventory_impact_tons": round(inventory_impact, 2),
        "service_level_impact": round(service_level_impact, 4),
        "base": base.model_dump(),
        "simulated": simulated.model_dump(),
    }
