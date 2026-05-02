from app.ml.forecast_models import generate_forecast
from app.optimization.planner import optimize_production
from app.schemas.optimization import OptimizationRequest


def run_profit_optimizer() -> dict:
    forecast = generate_forecast()
    next_month_demand = forecast["demand_curves"][0]["forecast_tons"]

    plan = optimize_production(
        OptimizationRequest(
            demand_tons=next_month_demand,
            max_capacity_tons=520,
            inventory_tons=190,
            quality_target_protein=11.6,
        )
    )

    priority_customers = ["CUST-ALFA", "CUST-OMEGA", "CUST-NORTE"]

    return {
        "what_to_produce": "Portafolio de harina premium para pan + mezcla de harina estandar",
        "when_to_produce": "Incrementar produccion en semana 2 y semana 4 con base en picos de pronostico y compromisos comerciales",
        "what_to_blend": f"Usar proporcion alta en proteina de {plan.blend_ratio_high_protein} para clientes premium",
        "which_customers_to_prioritize": priority_customers,
        "expected_profit": plan.estimated_profit,
    }
