import numpy as np


def run_monte_carlo_disruption(n_runs: int = 1000) -> dict:
    machine_failure = np.random.binomial(1, 0.18, n_runs)
    supply_shortage = np.random.binomial(1, 0.12, n_runs)

    revenue_impact = machine_failure * np.random.normal(65000, 12000, n_runs)
    customer_service_impact = (machine_failure + supply_shortage) * np.random.normal(7.5, 2.1, n_runs)
    inventory_impact = supply_shortage * np.random.normal(85, 18, n_runs)

    return {
        "failure_probability": round(float(machine_failure.mean()), 4),
        "shortage_probability": round(float(supply_shortage.mean()), 4),
        "expected_revenue_impact": round(float(revenue_impact.mean()), 2),
        "expected_service_level_impact": round(float(customer_service_impact.mean()), 2),
        "expected_inventory_impact_tons": round(float(inventory_impact.mean()), 2),
        "p95_revenue_impact": round(float(np.percentile(revenue_impact, 95)), 2),
    }
