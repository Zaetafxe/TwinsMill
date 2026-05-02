from datetime import datetime, timedelta

import numpy as np


def generate_synthetic_datasets(seed: int = 21) -> dict:
    rng = np.random.default_rng(seed)

    wheat_lots = [
        {
            "lot_code": f"LOT-{i:03}",
            "protein_pct": round(float(rng.normal(11.8, 0.5)), 2),
            "moisture_pct": round(float(rng.normal(13.2, 0.4)), 2),
            "available_tons": round(float(rng.uniform(80, 240)), 2),
        }
        for i in range(1, 16)
    ]

    production_batches = [
        {
            "batch_code": f"BAT-{i:03}",
            "planned_tons": round(float(rng.uniform(300, 520)), 2),
            "actual_tons": round(float(rng.uniform(280, 510)), 2),
            "energy_kwh": round(float(rng.uniform(9000, 14500)), 2),
            "downtime_minutes": round(float(rng.uniform(20, 180)), 2),
        }
        for i in range(1, 24)
    ]

    quality_tests = [
        {
            "test_id": f"QT-{i:03}",
            "protein_pct": round(float(rng.normal(11.9, 0.35)), 2),
            "ash_pct": round(float(rng.normal(0.62, 0.05)), 2),
            "moisture_pct": round(float(rng.normal(13.1, 0.3)), 2),
            "spec_compliant": bool(rng.choice([0, 1], p=[0.08, 0.92])),
        }
        for i in range(1, 60)
    ]

    customers = [
        {
            "customer_code": f"CUST-{i:03}",
            "segment": str(rng.choice(["Industrial", "Retail", "Export", "B2B Bakery"])),
            "avg_monthly_tons": round(float(rng.uniform(40, 360)), 2),
            "risk_score": round(float(rng.uniform(0.05, 0.75)), 3),
        }
        for i in range(1, 45)
    ]

    inventory = [
        {
            "sku": str(rng.choice(["FLOUR-STD", "FLOUR-PREM", "BRAN", "SEMOLINA"])),
            "on_hand_tons": round(float(rng.uniform(90, 420)), 2),
            "safety_stock_tons": round(float(rng.uniform(30, 120)), 2),
            "days_inventory": round(float(rng.uniform(8, 28)), 2),
        }
        for _ in range(20)
    ]

    energy_usage = [
        {
            "date": str(today - timedelta(days=30 - i)),
            "kwh": round(float(rng.uniform(8500, 15200)), 2),
            "kwh_per_ton": round(float(rng.uniform(23, 34)), 2),
        }
        for i in range(30)
    ]

    today = datetime.utcnow().date()
    sales = [
        {
            "date": str(today - timedelta(days=30 - i)),
            "tons": round(float(rng.uniform(120, 220)), 2),
            "revenue": round(float(rng.uniform(48000, 92000)), 2),
        }
        for i in range(30)
    ]

    failures = [
        {
            "event_id": f"FAIL-{i:03}",
            "stage": rng.choice(["Milling", "Sieving", "Packing"]),
            "duration_min": int(rng.integers(15, 220)),
            "severity": rng.choice(["low", "medium", "high"], p=[0.5, 0.35, 0.15]),
        }
        for i in range(1, 18)
    ]

    return {
        "wheat_lots": wheat_lots,
        "production_batches": production_batches,
        "quality_tests": quality_tests,
        "customers": customers,
        "sales": sales,
        "inventory": inventory,
        "energy_usage": energy_usage,
        "failures": failures,
        "pipeline": [
            "data_ingestion",
            "feature_engineering",
            "model_training",
            "model_validation",
            "prediction_layer",
            "recommendation_engine",
        ],
    }
