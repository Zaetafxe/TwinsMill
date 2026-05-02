from __future__ import annotations

from datetime import datetime, timedelta
import statistics

from app.db.session import get_db
from app.services.granos import ensure_realistic_operational_data


def _safe_avg(values: list[float], default: float = 0.0) -> float:
    return float(sum(values) / len(values)) if values else default


def _safe_std(values: list[float], default: float = 0.0) -> float:
    if len(values) < 2:
        return default
    return float(statistics.pstdev(values))


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def compute_kpis() -> dict:
    # Datos sintéticos ahora se generan solo al startup o via /ai/seed
    # ensure_realistic_operational_data(target_records=50, days=90)

    db = get_db()
    window_start = datetime.utcnow() - timedelta(days=90)

    receptions = list(
        db["grain_receptions"].find(
            {"created_at": {"$gte": window_start}},
            {"_id": 0, "created_at": 1, "tons_received": 1, "lab_humidity": 1, "lab_protein": 1, "lab_impurities": 1},
        )
    )
    milling_runs = list(
        db["grain_milling_runs"].find(
            {"created_at": {"$gte": window_start}},
            {"_id": 0, "created_at": 1, "wheat_input_tons": 1, "flour_output_tons": 1, "extraction_target_pct": 1, "total_production_cost": 1},
        )
    )
    packaging_runs = list(
        db["grain_packaging_runs"].find(
            {"created_at": {"$gte": window_start}},
            {"_id": 0, "packed_output_tons": 1, "flour_output_tons": 1, "weight_balance_delta_pct": 1},
        )
    )
    sales_runs = list(
        db["grain_sales_runs"].find(
            {"created_at": {"$gte": window_start}},
            {
                "_id": 0,
                "created_at": 1,
                "sold_tons": 1,
                "net_revenue": 1,
                "estimated_total_cost": 1,
                "estimated_margin": 1,
                "estimated_margin_pct": 1,
                "complaint_risk_index": 1,
                "customer_id": 1,
            },
        )
    )
    ops = list(
        db["ops_captures"].find(
            {"created_at": {"$gte": window_start}},
            {"_id": 0, "fields": 1},
        )
    )

    extraction_rates = [float(item.get("extraction_target_pct", 0.0)) / 100.0 for item in milling_runs if item.get("extraction_target_pct") is not None]
    yields = [
        (float(item.get("flour_output_tons", 0.0)) / float(item.get("wheat_input_tons", 1.0)))
        for item in milling_runs
        if float(item.get("wheat_input_tons", 0.0)) > 0
    ]
    throughput_tph = [float(item.get("wheat_input_tons", 0.0)) / 24.0 for item in milling_runs if item.get("wheat_input_tons") is not None]

    humidity_values = [float(item.get("lab_humidity", 0.0)) for item in receptions if item.get("lab_humidity") is not None]
    protein_values = [float(item.get("lab_protein", 0.0)) for item in receptions if item.get("lab_protein") is not None]
    impurity_values = [float(item.get("lab_impurities", 0.0)) for item in receptions if item.get("lab_impurities") is not None]

    compliant_count = sum(
        1
        for item in receptions
        if float(item.get("lab_humidity", 99.0)) <= 14.0 and float(item.get("lab_protein", 0.0)) >= 11.0 and float(item.get("lab_impurities", 99.0)) <= 1.5
    )
    spec_compliance = compliant_count / len(receptions) if receptions else 0.0

    downtime_minutes = []
    energy_cost_values = []
    for item in ops:
        fields = item.get("fields") or {}
        try:
            if "tiempo_paro_min" in fields:
                downtime_minutes.append(float(str(fields["tiempo_paro_min"]).replace(",", ".")))
        except ValueError:
            pass
        try:
            if "energia_usd_ton_trigo" in fields:
                energy_cost_values.append(float(str(fields["energia_usd_ton_trigo"]).replace(",", ".")))
        except ValueError:
            pass

    total_sold = sum(float(item.get("sold_tons", 0.0)) for item in sales_runs)
    total_revenue = sum(float(item.get("net_revenue", 0.0)) for item in sales_runs)
    total_cost = sum(float(item.get("estimated_total_cost", 0.0)) for item in sales_runs)
    margins_pct = [float(item.get("estimated_margin_pct", 0.0)) for item in sales_runs]
    total_margin = sum(float(item.get("estimated_margin", 0.0)) for item in sales_runs)

    monthly_revenue: dict[str, float] = {}
    customers_by_month: dict[str, set[str]] = {}
    for sale in sales_runs:
        created_at = sale.get("created_at")
        if not isinstance(created_at, datetime):
            continue
        month_key = created_at.strftime("%Y-%m")
        monthly_revenue[month_key] = monthly_revenue.get(month_key, 0.0) + float(sale.get("net_revenue", 0.0))
        customers_by_month.setdefault(month_key, set()).add(str(sale.get("customer_id", "")))

    sorted_months = sorted(monthly_revenue.keys())
    revenue_trend = 0.0
    if len(sorted_months) >= 2 and monthly_revenue[sorted_months[0]] > 0:
        revenue_trend = (monthly_revenue[sorted_months[-1]] - monthly_revenue[sorted_months[0]]) / monthly_revenue[sorted_months[0]]

    customer_growth = 0.0
    if len(sorted_months) >= 2:
        first = len(customers_by_month.get(sorted_months[0], set()))
        last = len(customers_by_month.get(sorted_months[-1], set()))
        if first > 0:
            customer_growth = (last - first) / first

    avg_margin_pct = _safe_avg(margins_pct)
    margin_per_product = avg_margin_pct / 100.0
    cost_per_ton = (total_cost / total_sold) if total_sold > 0 else 0.0
    monthly_margin_projection = total_margin / max(1, len(sorted_months))
    profit_forecast = monthly_margin_projection * 12

    weight_alerts = sum(1 for item in packaging_runs if abs(float(item.get("weight_balance_delta_pct", 0.0))) > 2.0)
    high_risk_sales = sum(1 for item in sales_runs if float(item.get("complaint_risk_index", 0.0)) >= 0.65)

    sold_daily = total_sold / 90.0 if total_sold > 0 else 0.0
    stock_reference_tons = _safe_avg([float(item.get("flour_output_tons", 0.0)) for item in packaging_runs], default=140.0) * 4.0
    days_inventory = stock_reference_tons / sold_daily if sold_daily > 0 else 20.0
    safety_stock = sold_daily * 9.0

    fill_numerator = sum(float(item.get("sold_tons", 0.0)) for item in sales_runs)
    fill_denominator = sum(float(item.get("packed_output_tons", 0.0)) for item in packaging_runs)
    fill_rate = (fill_numerator / fill_denominator) if fill_denominator > 0 else 0.9

    production_oee = _clamp((_safe_avg(yields, default=0.75) * _safe_avg(extraction_rates, default=0.75)) / 0.62, 0.62, 0.98)
    downtime_risk = _clamp((_safe_avg(downtime_minutes, default=28.0) / 120.0), 0.03, 0.45)
    energy_efficiency = _clamp(1 - (_safe_avg(energy_cost_values, default=7.0) - 5.0) / 10.0, 0.5, 0.98)

    humidity_std = _safe_std(humidity_values, default=0.4)
    protein_std = _safe_std(protein_values, default=0.3)
    quality_variability = _clamp((humidity_std / 4.0) + (protein_std / 4.0), 0.02, 0.4)
    protein_stability_index = _clamp(1 - (protein_std / 2.4), 0.45, 0.99)
    defect_probability = _clamp((weight_alerts / max(1, len(packaging_runs))) * 0.6 + (high_risk_sales / max(1, len(sales_runs))) * 0.4, 0.02, 0.5)

    forecast_accuracy = _clamp(0.92 - abs(revenue_trend) * 0.12, 0.72, 0.97)
    product_profitability = _clamp(avg_margin_pct / 100.0, 0.02, 0.5)

    stockout_probability = _clamp((1 - fill_rate) * 1.4 + high_risk_sales / max(1, len(sales_runs)) * 0.2, 0.02, 0.5)
    working_capital_impact = _clamp(days_inventory / 90.0, 0.05, 0.6)

    production_cost_per_ton = [
        float(item.get("total_production_cost", 0.0)) / float(item.get("flour_output_tons", 1.0))
        for item in milling_runs
        if float(item.get("flour_output_tons", 0.0)) > 0
    ]
    production_cost_variability = _clamp(_safe_std(production_cost_per_ton, default=18.0) / max(1.0, _safe_avg(production_cost_per_ton, default=310.0)), 0.01, 0.4)

    otif = _clamp(1 - high_risk_sales / max(1, len(sales_runs)) * 0.7, 0.55, 0.99)
    backorder_risk = _clamp(1 - fill_rate, 0.01, 0.5)
    supply_variability_risk = _clamp((_safe_std([float(item.get("tons_received", 0.0)) for item in receptions], default=16.0) / 120.0), 0.03, 0.5)

    return {
        "production": {
            "oee": round(production_oee, 4),
            "extraction_rate": round(_safe_avg(extraction_rates, default=0.75), 4),
            "yield": round(_safe_avg(yields, default=0.78), 4),
            "downtime_risk": round(downtime_risk, 4),
            "energy_efficiency": round(energy_efficiency, 4),
            "throughput_tph": round(_safe_avg(throughput_tph, default=24.0), 3),
        },
        "quality": {
            "spec_compliance": round(spec_compliance, 4),
            "quality_variability": round(quality_variability, 4),
            "defect_probability": round(defect_probability, 4),
            "protein_stability_index": round(protein_stability_index, 4),
        },
        "commercial": {
            "forecast_accuracy": round(forecast_accuracy, 4),
            "customer_growth": round(customer_growth, 4),
            "revenue_trend": round(revenue_trend, 4),
            "product_profitability": round(product_profitability, 4),
        },
        "inventory": {
            "days_inventory": round(days_inventory, 2),
            "safety_stock": round(safety_stock, 2),
            "stockout_probability": round(stockout_probability, 4),
            "working_capital_impact": round(working_capital_impact, 4),
        },
        "financial": {
            "cost_per_ton": round(cost_per_ton, 2),
            "margin_per_product": round(margin_per_product, 4),
            "profit_forecast": round(profit_forecast, 2),
            "production_cost_variability": round(production_cost_variability, 4),
        },
        "supply_chain": {
            "otif": round(otif, 4),
            "fill_rate": round(fill_rate, 4),
            "backorder_risk": round(backorder_risk, 4),
            "supply_variability_risk": round(supply_variability_risk, 4),
        },
    }
