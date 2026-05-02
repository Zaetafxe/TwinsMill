import pulp

from app.schemas.optimization import OptimizationRequest, OptimizationResponse


def optimize_production(request: OptimizationRequest) -> OptimizationResponse:
    model = pulp.LpProblem("SmartMillingProfitMax", pulp.LpMaximize)

    production = pulp.LpVariable("production", lowBound=0)
    # Usar ratio fijo para evitar multiplicación no-lineal de variables
    high_protein_ratio = 0.5  # Ratio promedio fijo

    unit_price = 470
    base_cost = 290
    premium_cost = 18
    inventory_holding_cost = 5

    # Ahora la expresión es lineal: production es variable, todo lo demás es constante
    revenue = production * unit_price
    cost_per_unit = base_cost + high_protein_ratio * premium_cost
    cost = (
        production * cost_per_unit
        + (request.inventory_tons + production - request.demand_tons) * inventory_holding_cost
    )

    model += revenue - cost

    model += production <= request.max_capacity_tons
    model += request.inventory_tons + production >= request.demand_tons
    # Constraint simplificada
    model += production >= 0

    model.solve(pulp.PULP_CBC_CMD(msg=False))

    production_val = max(0.0, float(production.value() or 0.0))
    # high_protein_ratio es un float constante, no una LpVariable
    ratio_val = max(0.0, min(1.0, float(high_protein_ratio)))
    estimated_cost = production_val * (base_cost + ratio_val * premium_cost)
    estimated_profit = production_val * unit_price - estimated_cost

    notes = [
        "Prioritize high-protein blend to stabilize flour specs",
        "Keep inventory buffer above 10 days equivalent demand",
    ]

    return OptimizationResponse(
        production_tons=round(production_val, 2),
        blend_ratio_high_protein=round(ratio_val, 4),
        estimated_cost=round(estimated_cost, 2),
        estimated_profit=round(estimated_profit, 2),
        decision_notes=notes,
    )
