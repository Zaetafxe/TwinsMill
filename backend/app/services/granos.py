from __future__ import annotations

from datetime import datetime, timedelta
import random
from typing import Any
from uuid import uuid4

import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import train_test_split

from app.core.config import settings
from app.db.session import get_db

CATALOG_COLLECTION = "grain_catalogs"
RECEPTION_COLLECTION = "grain_receptions"
MILLING_COLLECTION = "grain_milling_runs"
PACKAGING_COLLECTION = "grain_packaging_runs"
SALES_COLLECTION = "grain_sales_runs"
COMPLAINTS_COLLECTION = "customer_complaints"
OPS_CAPTURE_COLLECTION = "ops_captures"
ECONOMIC_SCENARIOS_COLLECTION = "economic_scenarios"
SEED_META_COLLECTION = "synthetic_seed_meta"


ECONOMIC_DEFAULTS = {
    "wheat_price_usd_ton": 306.0,
    "flour_price_usd_ton": 620.0,
    "byproduct_price_usd_ton": 260.0,
    "energy_usd_ton_wheat": 7.0,
    "wheat_moisture_reception_pct": 12.5,
    "capacity_ton_day": 200.0,
    "labor_days_year": 300.0,
    "flour_moisture_pct": 14.5,
    "packaging_efficiency_pct": 99.8,
    "operational_availability_pct": 85.0,
    "nominal_capacity_pct": 90.0,
    "impurity_input_pct": 1.0,
    "flour_extraction_pct": 76.5,
    "wheat_moisture_input_pct": 15.5,
}


def _normalize_catalog_item(item: dict[str, str]) -> dict[str, str]:
    return {"id": item["id"].strip(), "label": item["label"].strip()}


def _catalog_seed() -> dict[str, list[dict[str, str]]]:
    return {
        "grain_varieties": [
            {"id": "trigo-suave", "label": "Trigo suave"},
            {"id": "trigo-duro", "label": "Trigo duro"},
            {"id": "trigo-panificable", "label": "Trigo panificable"},
        ],
        "grain_warehouses": [
            {"id": "bg-norte-1", "label": "Bodega Norte 1"},
            {"id": "bg-sur-1", "label": "Bodega Sur 1"},
        ],
        "flour_warehouses": [
            {"id": "alm-harina-a", "label": "Almacen Harina A"},
            {"id": "alm-harina-b", "label": "Almacen Harina B"},
        ],
        "flour_types": [
            {"id": "harina-premium", "label": "Harina premium"},
            {"id": "harina-estandar", "label": "Harina estandar"},
            {"id": "harina-integral", "label": "Harina integral"},
        ],
        "flour_lines": [
            {"id": "linea-a", "label": "Linea A"},
            {"id": "linea-b", "label": "Linea B"},
            {"id": "linea-c", "label": "Linea C"},
        ],
        "packed_products": [
            {"id": "prod-25kg", "label": "Harina 25 kg"},
            {"id": "prod-10kg", "label": "Harina 10 kg"},
            {"id": "prod-1kg", "label": "Harina 1 kg"},
        ],
        "packaging_units": [
            {"id": "saco", "label": "Saco"},
            {"id": "bolsa", "label": "Bolsa"},
            {"id": "bigbag", "label": "Big bag"},
        ],
        "sites": [
            {"id": "sede-cdmx", "label": "CDMX"},
            {"id": "sede-guadalajara", "label": "Guadalajara"},
            {"id": "sede-monterrey", "label": "Monterrey"},
        ],
        "customers": [
            {"id": "cli-pan-norte", "label": "Panificadora Norte"},
            {"id": "cli-galleta-plus", "label": "Galleta Plus"},
            {"id": "cli-foodservice", "label": "Foodservice Central"},
        ],
        "customer_types": [
            {"id": "industrial", "label": "Industrial"},
            {"id": "retail", "label": "Retail"},
            {"id": "foodservice", "label": "Foodservice"},
        ],
        "farmers": [
            {"id": "agr-san-jose", "label": "Agricola San Jose"},
            {"id": "agr-valle-verde", "label": "Valle Verde"},
            {"id": "agr-campo-alto", "label": "Campo Alto"},
        ],
    }


CATALOG_KEYS = set(_catalog_seed().keys())


def _assert_catalog_key(catalog_key: str) -> None:
    if catalog_key not in CATALOG_KEYS:
        raise ValueError(f"Catalogo no soportado: {catalog_key}")


def _strip_id(document: dict[str, Any]) -> dict[str, Any]:
    output = dict(document)
    output.pop("_id", None)
    return output


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        normalized = value.strip().replace("%", "").replace(",", ".")
        if not normalized:
            return None
        try:
            return float(normalized)
        except ValueError:
            return None
    return None


def _avg(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 4)


def get_or_seed_catalogs() -> dict[str, list[dict[str, str]]]:
    db = get_db()
    stored = db[CATALOG_COLLECTION].find_one({"_id": "default"})
    if stored:
        stored.pop("_id", None)
        return stored

    seed = _catalog_seed()
    db[CATALOG_COLLECTION].insert_one({"_id": "default", **seed})
    return seed


def list_catalog_items(catalog_key: str) -> list[dict[str, str]]:
    _assert_catalog_key(catalog_key)
    catalogs = get_or_seed_catalogs()
    return [_normalize_catalog_item(item) for item in catalogs.get(catalog_key, [])]


def upsert_catalog_item(catalog_key: str, item: dict[str, str]) -> list[dict[str, str]]:
    _assert_catalog_key(catalog_key)
    db = get_db()
    catalogs = get_or_seed_catalogs()
    normalized = _normalize_catalog_item(item)
    current = catalogs.get(catalog_key, [])

    replaced = False
    updated_items: list[dict[str, str]] = []
    for existing in current:
        normalized_existing = _normalize_catalog_item(existing)
        if normalized_existing["id"] == normalized["id"]:
            updated_items.append(normalized)
            replaced = True
        else:
            updated_items.append(normalized_existing)

    if not replaced:
        updated_items.append(normalized)

    db[CATALOG_COLLECTION].update_one(
        {"_id": "default"},
        {"$set": {catalog_key: updated_items}},
        upsert=True,
    )
    return updated_items


def delete_catalog_item(catalog_key: str, item_id: str) -> list[dict[str, str]]:
    _assert_catalog_key(catalog_key)
    db = get_db()
    catalogs = get_or_seed_catalogs()
    normalized_item_id = item_id.strip()
    current = catalogs.get(catalog_key, [])
    updated_items = [_normalize_catalog_item(item) for item in current if item.get("id", "").strip() != normalized_item_id]

    db[CATALOG_COLLECTION].update_one(
        {"_id": "default"},
        {"$set": {catalog_key: updated_items}},
        upsert=True,
    )
    return updated_items


def create_reception(payload: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    now = datetime.utcnow()
    receipt_batch = f"REC-{now.strftime('%y%m%d')}-{str(uuid4())[:4].upper()}"

    doc = {
        "id": str(uuid4()),
        "receipt_batch": receipt_batch,
        "created_at": now,
        **payload,
    }
    db[RECEPTION_COLLECTION].insert_one(doc)
    return doc


def list_receptions(limit: int = 40) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db[RECEPTION_COLLECTION].find().sort("created_at", -1).limit(limit)
    return [_strip_id(item) for item in cursor]


def create_milling_run(payload: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    reception = db[RECEPTION_COLLECTION].find_one({"id": payload["reception_id"]})
    if not reception:
        raise ValueError("No existe la recepcion seleccionada.")

    now = datetime.utcnow()
    extraction_ratio = payload["extraction_target_pct"] / 100.0
    wheat_input = float(reception["tons_received"])
    flour_output = round((wheat_input * extraction_ratio) + payload["ingredient_tons"], 3)

    total_cost = round(payload["energy_cost"] + payload["labor_cost"] + payload["logistics_cost"], 2)

    doc = {
        "id": str(uuid4()),
        "created_at": now,
        "milling_batch": f"MOL-{now.strftime('%y%m%d')}-{str(uuid4())[:4].upper()}",
        "flour_lot": f"HAR-{now.strftime('%y%m%d')}-{str(uuid4())[:4].upper()}",
        "wheat_input_tons": wheat_input,
        "flour_output_tons": flour_output,
        "total_production_cost": total_cost,
        "traceability": {
            "receipt_batch": reception["receipt_batch"],
            "grain_code": reception["grain_code"],
            "lab_humidity": reception["lab_humidity"],
            "lab_protein": reception["lab_protein"],
        },
        **payload,
    }
    db[MILLING_COLLECTION].insert_one(doc)
    return doc


def list_milling_runs(limit: int = 40) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db[MILLING_COLLECTION].find().sort("created_at", -1).limit(limit)
    return [_strip_id(item) for item in cursor]


def create_packaging_run(payload: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    milling = db[MILLING_COLLECTION].find_one({"id": payload["milling_run_id"]})
    if not milling:
        raise ValueError("No existe la corrida de molienda seleccionada.")

    packed_output_tons = round(
        sum((item["package_size_kg"] * item["units"]) / 1000 for item in payload["presentations"]),
        3,
    )
    flour_output_tons = float(milling["flour_output_tons"])
    delta_tons = round(flour_output_tons - packed_output_tons, 3)
    delta_pct = round((delta_tons / flour_output_tons) * 100, 2) if flour_output_tons else 0.0

    now = datetime.utcnow()
    doc = {
        "id": str(uuid4()),
        "created_at": now,
        "packaging_batch": f"EMP-{now.strftime('%y%m%d')}-{str(uuid4())[:4].upper()}",
        "packed_output_tons": packed_output_tons,
        "flour_output_tons": flour_output_tons,
        "weight_balance_delta_tons": delta_tons,
        "weight_balance_delta_pct": delta_pct,
        "flour_lot": milling["flour_lot"],
        **payload,
    }
    db[PACKAGING_COLLECTION].insert_one(doc)
    return doc


def list_packaging_runs(limit: int = 40) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db[PACKAGING_COLLECTION].find().sort("created_at", -1).limit(limit)
    return [_strip_id(item) for item in cursor]


def create_sale(payload: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    packaging = db[PACKAGING_COLLECTION].find_one({"id": payload["packaging_run_id"]})
    if not packaging:
        raise ValueError("No existe la corrida de empaque seleccionada.")

    milling = db[MILLING_COLLECTION].find_one({"id": packaging["milling_run_id"]})
    if not milling:
        raise ValueError("No existe la corrida de molienda para este empaque.")

    sold_tons = payload["sold_tons"]
    gross = sold_tons * payload["sale_price_per_ton"]
    discount = gross * (payload["discount_pct"] / 100.0)
    net_revenue = round(gross - discount, 2)

    milling_cost_per_ton = (milling["total_production_cost"] / milling["flour_output_tons"]) if milling["flour_output_tons"] else 0
    estimated_total_cost = round(milling_cost_per_ton * sold_tons, 2)
    estimated_margin = round(net_revenue - estimated_total_cost, 2)
    estimated_margin_pct = round((estimated_margin / net_revenue) * 100, 2) if net_revenue else 0.0

    now = datetime.utcnow()
    doc = {
        "id": str(uuid4()),
        "created_at": now,
        "sale_batch": f"VTA-{now.strftime('%y%m%d')}-{str(uuid4())[:4].upper()}",
        "net_revenue": net_revenue,
        "estimated_total_cost": estimated_total_cost,
        "estimated_margin": estimated_margin,
        "estimated_margin_pct": estimated_margin_pct,
        "traceability": {
            "receipt_batch": milling["traceability"]["receipt_batch"],
            "milling_batch": milling["milling_batch"],
            "flour_lot": milling["flour_lot"],
            "packaging_batch": packaging["packaging_batch"],
        },
        **payload,
    }
    db[SALES_COLLECTION].insert_one(doc)
    return doc


def list_sales_runs(limit: int = 40) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db[SALES_COLLECTION].find().sort("created_at", -1).limit(limit)
    return [_strip_id(item) for item in cursor]


def compute_causal_kpis(window_days: int | None = 90) -> dict[str, Any]:
    db = get_db()
    query: dict[str, Any] = {}
    if window_days and window_days > 0:
        query["created_at"] = {"$gte": datetime.utcnow() - timedelta(days=window_days)}

    receptions = [
        _strip_id(item)
        for item in db[RECEPTION_COLLECTION].find(query, {"_id": 0, "lab_humidity": 1, "lab_protein": 1})
    ]
    milling_runs = [_strip_id(item) for item in db[MILLING_COLLECTION].find(query, {"_id": 0, "id": 1})]
    packaging_runs = [
        _strip_id(item)
        for item in db[PACKAGING_COLLECTION].find(query, {"_id": 0, "weight_balance_delta_pct": 1})
    ]
    sales_runs = [
        _strip_id(item)
        for item in db[SALES_COLLECTION].find(
            query,
            {
                "_id": 0,
                "estimated_margin_pct": 1,
                "complaint_risk_index": 1,
                "estimated_margin": 1,
                "discount_pct": 1,
            },
        )
    ]

    avg_humidity = round(sum(item.get("lab_humidity", 0.0) for item in receptions) / len(receptions), 3) if receptions else 0.0
    avg_protein = round(sum(item.get("lab_protein", 0.0) for item in receptions) / len(receptions), 3) if receptions else 0.0

    fully_traced = min(len(receptions), len(milling_runs), len(packaging_runs), len(sales_runs))
    traceability_pct = round((fully_traced / len(receptions)) * 100, 2) if receptions else 0.0

    weight_balance_alerts = sum(1 for item in packaging_runs if abs(item.get("weight_balance_delta_pct", 0.0)) > 2.0)
    avg_margin_pct = round(sum(item.get("estimated_margin_pct", 0.0) for item in sales_runs) / len(sales_runs), 2) if sales_runs else 0.0
    high_risk_sales = sum(1 for item in sales_runs if item.get("complaint_risk_index", 0.0) >= 0.65)

    if sales_runs:
        projected = round(
            sum(item["estimated_margin"] * (1 - ((item.get("discount_pct", 0.0) + 5) / 100.0)) for item in sales_runs)
            / len(sales_runs),
            2,
        )
    else:
        projected = 0.0

    return {
        "average_humidity": avg_humidity,
        "average_protein": avg_protein,
        "traceability_completion_pct": traceability_pct,
        "weight_balance_alerts": weight_balance_alerts,
        "average_margin_pct": avg_margin_pct,
        "high_risk_sales": high_risk_sales,
        "margin_projection_with_discounts": projected,
    }


def create_legacy_capture(payload: dict[str, Any]) -> dict[str, str]:
    reception = create_reception(
        {
            "receipt_date": payload["receipt_date"],
            "grain_code": payload["grain_code"],
            "variety_id": payload["variety_id"],
            "farmer_id": payload["farmer_id"],
            "grain_warehouse_id": payload["grain_warehouse_id"],
            "tons_received": 100.0,
            "lab_humidity": payload["lab_humidity"],
            "lab_protein": payload["lab_protein"],
            "lab_impurities": payload["lab_impurities"],
            "notes": payload.get("notes", ""),
        }
    )

    milling = create_milling_run(
        {
            "reception_id": reception["id"],
            "flour_type_id": payload["flour_type_id"],
            "flour_product_target_id": payload["packed_product_id"],
            "flour_line_id": "linea-a",
            "extraction_target_pct": 75.0,
            "ingredient_tons": 0.0,
            "energy_cost": 1200.0,
            "labor_cost": 840.0,
            "logistics_cost": 560.0,
        }
    )

    packaging = create_packaging_run(
        {
            "milling_run_id": milling["id"],
            "flour_warehouse_id": payload["flour_warehouse_id"],
            "presentations": [
                {
                    "packed_product_id": payload["packed_product_id"],
                    "package_unit_id": payload["package_unit_id"],
                    "package_size_kg": 25,
                    "units": 3000,
                }
            ],
        }
    )

    create_sale(
        {
            "packaging_run_id": packaging["id"],
            "customer_id": payload["customer_id"],
            "customer_type_id": "industrial",
            "site_id": payload["site_id"],
            "sale_price_per_ton": 520.0,
            "sold_tons": min(60.0, packaging["packed_output_tons"]),
            "discount_pct": 2.5,
            "complaint_risk_index": 0.35,
        }
    )

    return {"id": reception["id"], "status": "captured-sequentially"}


def create_ops_capture(payload: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    now = datetime.utcnow()
    doc = {
        "id": str(uuid4()),
        "created_at": now,
        **payload,
    }
    db[OPS_CAPTURE_COLLECTION].insert_one(doc)
    return doc


def list_ops_captures(module_key: str | None = None, limit: int = 120, window_days: int | None = None) -> list[dict[str, Any]]:
    db = get_db()
    query: dict[str, Any] = {}
    if module_key:
        query["module_key"] = module_key
    if window_days and window_days > 0:
        query["created_at"] = {"$gte": datetime.utcnow() - timedelta(days=window_days)}
    cursor = db[OPS_CAPTURE_COLLECTION].find(query).sort("created_at", -1).limit(limit)
    return [_strip_id(item) for item in cursor]


def compute_economic_baseline(window_days: int | None = None) -> dict[str, Any]:
    db = get_db()
    ops_docs = list_ops_captures(limit=400, window_days=window_days)
    query: dict[str, Any] = {}
    if window_days and window_days > 0:
        query["created_at"] = {"$gte": datetime.utcnow() - timedelta(days=window_days)}

    receptions = [_strip_id(item) for item in db[RECEPTION_COLLECTION].find(query).sort("created_at", -1).limit(180)]
    milling_runs = [_strip_id(item) for item in db[MILLING_COLLECTION].find(query).sort("created_at", -1).limit(180)]
    sales_runs = [_strip_id(item) for item in db[SALES_COLLECTION].find(query).sort("created_at", -1).limit(180)]

    values: dict[str, list[float]] = {
        "wheat_price_usd_ton": [],
        "flour_price_usd_ton": [],
        "byproduct_price_usd_ton": [],
        "energy_usd_ton_wheat": [],
        "wheat_moisture_reception_pct": [],
        "capacity_ton_day": [],
        "labor_days_year": [],
        "flour_moisture_pct": [],
        "packaging_efficiency_pct": [],
        "operational_availability_pct": [],
        "nominal_capacity_pct": [],
        "impurity_input_pct": [],
        "flour_extraction_pct": [],
        "wheat_moisture_input_pct": [],
    }

    field_map = {
        "wheat_price_usd_ton": ["precio_trigo_usd_ton", "wheat_price_usd_ton"],
        "flour_price_usd_ton": ["precio_harina_usd_ton", "flour_price_usd_ton", "precio"],
        "byproduct_price_usd_ton": ["precio_subproducto_usd_ton", "byproduct_price_usd_ton"],
        "energy_usd_ton_wheat": ["energia_usd_ton_trigo", "energy_usd_ton_wheat"],
        "wheat_moisture_reception_pct": ["lab_humidity", "preclean_humidity_pct", "wheat_moisture_reception_pct"],
        "capacity_ton_day": ["capacidad_ton_dia", "capacity_ton_day"],
        "labor_days_year": ["dias_laborables_anuales", "labor_days_year"],
        "flour_moisture_pct": ["humedad_harina", "flour_moisture_pct"],
        "packaging_efficiency_pct": ["eficiencia_envasado", "packaging_efficiency_pct"],
        "operational_availability_pct": ["disponibilidad_operativa", "operational_availability_pct"],
        "nominal_capacity_pct": ["capacidad_nominal_pct", "nominal_capacity_pct"],
        "impurity_input_pct": ["impurezas_entrada", "impurity_input_pct", "lab_impurities", "preclean_impurity_pct"],
        "flour_extraction_pct": ["extraccion", "flour_extraction_pct", "extraction_target_pct"],
        "wheat_moisture_input_pct": ["humedad_trigo_entrada", "wheat_moisture_input_pct", "lab_humidity"],
    }

    for doc in ops_docs:
        fields = doc.get("fields", {})
        for baseline_key, aliases in field_map.items():
            for alias in aliases:
                if alias in fields:
                    parsed = _to_float(fields.get(alias))
                    if parsed is not None:
                        values[baseline_key].append(parsed)
                    break

    for rec in receptions:
        if rec.get("lab_humidity") is not None:
            values["wheat_moisture_reception_pct"].append(float(rec["lab_humidity"]))
            values["wheat_moisture_input_pct"].append(float(rec["lab_humidity"]))
        if rec.get("lab_impurities") is not None:
            values["impurity_input_pct"].append(float(rec["lab_impurities"]))

    for run in milling_runs:
        extraction = _to_float(run.get("extraction_target_pct"))
        if extraction is not None:
            values["flour_extraction_pct"].append(extraction)

    for sale in sales_runs:
        flour_price = _to_float(sale.get("sale_price_per_ton"))
        if flour_price is not None:
            values["flour_price_usd_ton"].append(flour_price)

    result: dict[str, Any] = {}
    source_counts: dict[str, int] = {}
    for key, default in ECONOMIC_DEFAULTS.items():
        avg = _avg(values[key])
        result[key] = avg if avg is not None else default
        source_counts[key] = len(values[key])

    result["source_counts"] = source_counts
    result["window_days"] = int(window_days or 0)
    return result


def _compute_annual_contribution(variables: dict[str, float]) -> float:
    capacity = float(variables["capacity_ton_day"])
    labor_days = float(variables["labor_days_year"])
    availability = float(variables["operational_availability_pct"]) / 100.0
    nominal_capacity = float(variables["nominal_capacity_pct"]) / 100.0

    processed_wheat = capacity * labor_days * availability * nominal_capacity

    humidity_penalty = max(0.0, float(variables["wheat_moisture_input_pct"]) - 15.5) * 0.0035
    impurity_penalty = max(0.0, float(variables["impurity_input_pct"]) - 1.0) * 0.01
    extraction = max(0.55, min(0.86, (float(variables["flour_extraction_pct"]) / 100.0) * (1 - humidity_penalty) * (1 - impurity_penalty)))

    gross_flour = processed_wheat * extraction
    moisture_sale_penalty = max(0.0, float(variables["flour_moisture_pct"]) - 14.5) * 0.002
    saleable_flour = gross_flour * (float(variables["packaging_efficiency_pct"]) / 100.0) * (1 - moisture_sale_penalty)

    byproduct_ton = max(processed_wheat - gross_flour - processed_wheat * (float(variables["impurity_input_pct"]) / 100.0), 0.0)

    revenue = saleable_flour * float(variables["flour_price_usd_ton"]) + byproduct_ton * float(variables["byproduct_price_usd_ton"])
    variable_cost = processed_wheat * (float(variables["wheat_price_usd_ton"]) + float(variables["energy_usd_ton_wheat"]))
    variable_cost += processed_wheat * max(0.0, float(variables["wheat_moisture_reception_pct"]) - 12.5) * 0.8
    variable_cost += processed_wheat * max(0.0, 14.2 - float(variables["flour_moisture_pct"])) * 1.4

    return round(revenue - variable_cost, 2)


def create_economic_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    baseline = compute_economic_baseline()
    baseline_variables = {k: float(v) for k, v in baseline.items() if k in ECONOMIC_DEFAULTS}

    requested = payload.get("variables", {})
    merged = {**baseline_variables}
    for key in ECONOMIC_DEFAULTS:
        if key in requested:
            parsed = _to_float(requested.get(key))
            if parsed is not None:
                merged[key] = parsed

    baseline_annual = _compute_annual_contribution(baseline_variables)
    scenario_annual = _compute_annual_contribution(merged)

    now = datetime.utcnow()
    doc = {
        "id": str(uuid4()),
        "name": payload["name"].strip(),
        "notes": payload.get("notes", "").strip(),
        "variables": merged,
        "annual_contribution_usd": scenario_annual,
        "delta_vs_baseline_usd": round(scenario_annual - baseline_annual, 2),
        "created_at": now,
    }
    db[ECONOMIC_SCENARIOS_COLLECTION].insert_one(doc)
    return doc


def list_economic_scenarios(limit: int = 50) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db[ECONOMIC_SCENARIOS_COLLECTION].find().sort("created_at", -1).limit(limit)
    return [_strip_id(item) for item in cursor]


def compute_economic_trend(
    months: int = 6,
    scenario_variables: dict[str, Any] | None = None,
    baseline_window_days: int | None = None,
) -> dict[str, Any]:
    baseline = compute_economic_baseline(window_days=baseline_window_days)
    baseline_vars = {k: float(v) for k, v in baseline.items() if k in ECONOMIC_DEFAULTS}

    scenario_vars = {**baseline_vars}
    if scenario_variables:
        for key in ECONOMIC_DEFAULTS:
            if key in scenario_variables:
                parsed = _to_float(scenario_variables.get(key))
                if parsed is not None:
                    scenario_vars[key] = parsed

    base_annual = _compute_annual_contribution(baseline_vars)
    scenario_annual = _compute_annual_contribution(scenario_vars)

    now = datetime.utcnow()
    points: list[dict[str, Any]] = []
    for idx in range(months):
        month_index = now.month - (months - 1 - idx)
        year = now.year
        while month_index <= 0:
            month_index += 12
            year -= 1

        seasonal = 1 + ((idx - (months / 2)) / (months * 20))
        baseline_month = round((base_annual / 12.0) * seasonal, 2)
        scenario_month = round((scenario_annual / 12.0) * seasonal, 2)
        points.append(
            {
                "month": f"{year}-{month_index:02d}",
                "baseline_usd": baseline_month,
                "scenario_usd": scenario_month,
            }
        )

    return {"points": points}


def _pick(catalog: list[dict[str, str]], fallback: str, rng: random.Random) -> str:
    if not catalog:
        return fallback
    return rng.choice(catalog)["id"]


def _ensure_catalog_density(rng: random.Random) -> None:
    db = get_db()
    catalogs = get_or_seed_catalogs()

    targets: dict[str, tuple[int, str, str]] = {
        "grain_varieties": (8, "trigo-var", "Trigo Variedad"),
        "grain_warehouses": (6, "bg", "Bodega"),
        "flour_warehouses": (6, "alm", "Almacen Harina"),
        "flour_types": (8, "harina", "Harina"),
        "flour_lines": (6, "linea", "Linea"),
        "packed_products": (12, "prod", "Producto"),
        "packaging_units": (5, "unidad", "Unidad"),
        "sites": (8, "sede", "Sede"),
        "customers": (40, "cli", "Cliente"),
        "customer_types": (6, "seg", "Segmento"),
        "farmers": (32, "agr", "Agricola"),
    }

    changed = False
    for key, (target, prefix, label) in targets.items():
        current = [_normalize_catalog_item(item) for item in catalogs.get(key, [])]
        existing_ids = {item["id"] for item in current}
        next_idx = 1
        while len(current) < target:
            candidate_id = f"{prefix}-{next_idx:03d}"
            next_idx += 1
            if candidate_id in existing_ids:
                continue
            suffix = rng.choice(["Norte", "Sur", "Este", "Oeste", "Centro", "Industrial", "Prime", "Mix"])
            current.append({"id": candidate_id, "label": f"{label} {suffix} {len(current) + 1}"})
            existing_ids.add(candidate_id)
            changed = True
        catalogs[key] = current

    if changed:
        db[CATALOG_COLLECTION].update_one({"_id": "default"}, {"$set": catalogs}, upsert=True)


def _random_shift(rng: random.Random) -> str:
    return rng.choice(["1T", "2T", "3T"])


def _weighted_customer_type(rng: random.Random) -> str:
    return rng.choices(["industrial", "retail", "foodservice"], weights=[0.55, 0.25, 0.2], k=1)[0]


def _complaint_text_templates() -> dict[str, list[str]]:
    return {
        "critical": [
            "El cliente reporta lote inconsistente, olor extrano y textura fuera de especificacion en {product}.",
            "Queja severa: panificacion defectuosa, miga compacta y devolucion inmediata del producto {product}.",
            "Incidencia critica en {product}: variacion fuerte de humedad y rendimiento bajo en linea del cliente.",
            "Reclamo urgente para {product}: color irregular, sabor alterado y paro en produccion del cliente.",
        ],
        "warning": [
            "Observacion en {product}: ligeras variaciones de absorcion y ajuste menor en formulacion.",
            "Cliente indica inconsistencia moderada en {product} durante turno nocturno.",
            "Se detecta comportamiento variable en {product}, pero se mantiene la produccion con ajustes.",
            "Reclamo medio en {product}: estabilidad parcial y necesidad de soporte tecnico preventivo.",
        ],
        "positive": [
            "Comentario positivo: {product} mantiene buena estabilidad y rendimiento esperado en horneo.",
            "Cliente confirma satisfaccion con {product}, mejora de volumen y menor desperdicio.",
            "Retroalimentacion favorable para {product}: calidad consistente y entrega puntual.",
            "Evaluacion positiva de {product} por textura uniforme y proceso estable.",
        ],
    }


def _ensure_complaint_text_data(seed: int = 4242, min_records: int = 320) -> int:
    db = get_db()
    existing = db[COMPLAINTS_COLLECTION].count_documents({})
    if existing >= min_records:
        return 0

    rng = random.Random(seed)
    templates = _complaint_text_templates()

    sales_docs = list(
        db[SALES_COLLECTION].find(
            {},
            {
                "_id": 0,
                "id": 1,
                "customer_id": 1,
                "packaging_run_id": 1,
                "complaint_risk_index": 1,
                "created_at": 1,
            },
        )
    )
    packaging_docs = list(db[PACKAGING_COLLECTION].find({}, {"_id": 0, "id": 1, "presentations": 1}))
    package_to_product: dict[str, str] = {}
    for package in packaging_docs:
        product_id = "producto-mix"
        presentations = package.get("presentations") or []
        if presentations and isinstance(presentations, list):
            first = presentations[0] or {}
            product_id = str(first.get("packed_product_id") or product_id)
        package_to_product[str(package.get("id") or "")] = product_id

    if not sales_docs:
        return 0

    to_create = max(0, min_records - existing)
    inserts: list[dict[str, Any]] = []
    for index in range(to_create):
        sale = sales_docs[index % len(sales_docs)]
        risk = float(sale.get("complaint_risk_index", 0.0))
        product = package_to_product.get(str(sale.get("packaging_run_id") or ""), "producto-mix")

        if risk >= 0.62:
            bucket = "critical"
            is_critical = 1
        elif risk >= 0.35:
            bucket = "warning"
            is_critical = 0
        else:
            bucket = "positive"
            is_critical = 0

        template = rng.choice(templates[bucket])
        text = template.format(product=product)
        emotion = "Frustracion" if bucket == "critical" else "Incertidumbre" if bucket == "warning" else "Confianza"

        created_at = sale.get("created_at")
        if not isinstance(created_at, datetime):
            created_at = datetime.utcnow() - timedelta(days=rng.randint(0, 150))

        inserts.append(
            {
                "id": str(uuid4()),
                "sale_id": sale.get("id"),
                "customer_id": str(sale.get("customer_id") or "sin-cliente"),
                "product_id": product,
                "complaint_text": text,
                "emotion_label": emotion,
                "is_critical": is_critical,
                "status": "escalated" if is_critical else rng.choice(["resolved", "pending", "resolved"]),
                "created_at": created_at,
            }
        )

    if inserts:
        db[COMPLAINTS_COLLECTION].insert_many(inserts)
    return len(inserts)


def ensure_realistic_operational_data(target_records: int = 1000, days: int = 90, seed: int = 4242) -> dict[str, int]:
    db = get_db()
    rng = random.Random(seed)

    _ensure_catalog_density(rng)
    catalogs = get_or_seed_catalogs()

    today = datetime.utcnow().date()
    start_day = today - timedelta(days=max(30, days - 1))

    reception_count = db[RECEPTION_COLLECTION].count_documents({})
    milling_count = db[MILLING_COLLECTION].count_documents({})
    packaging_count = db[PACKAGING_COLLECTION].count_documents({})
    sales_count = db[SALES_COLLECTION].count_documents({})
    ops_count = db[OPS_CAPTURE_COLLECTION].count_documents({})

    inserted = {
        "receptions": 0,
        "milling_runs": 0,
        "packaging_runs": 0,
        "sales": 0,
        "ops_captures": 0,
    }

    if reception_count < target_records:
        docs: list[dict[str, Any]] = []
        for idx in range(target_records - reception_count):
            day_offset = idx % days
            receipt_date = start_day + timedelta(days=day_offset)
            created_at = datetime.combine(receipt_date, datetime.min.time()) + timedelta(hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
            humidity = round(rng.uniform(11.4, 14.6), 2)
            protein = round(rng.uniform(10.6, 13.8), 2)
            impurities = round(rng.uniform(0.05, 1.9), 2)
            doc = {
                "id": str(uuid4()),
                "receipt_batch": f"REC-{receipt_date.strftime('%y%m%d')}-{idx:04d}",
                "receipt_date": receipt_date.isoformat(),
                "shift_turn": _random_shift(rng),
                "grain_code": f"GRN-{rng.randint(10000, 99999)}",
                "wheat_lot_code": f"LOT-{rng.randint(1000, 9999)}",
                "variety_id": _pick(catalogs.get("grain_varieties", []), "trigo-suave", rng),
                "farmer_id": _pick(catalogs.get("farmers", []), "agr-san-jose", rng),
                "grain_warehouse_id": _pick(catalogs.get("grain_warehouses", []), "bg-norte-1", rng),
                "preclean_wheat_type_id": _pick(catalogs.get("grain_varieties", []), "trigo-suave", rng),
                "preclean_humidity_pct": round(humidity + rng.uniform(-0.4, 0.4), 2),
                "preclean_impurity_pct": round(max(0.0, impurities + rng.uniform(-0.1, 0.2)), 2),
                "preclean_test_weight_kg_hl": round(rng.uniform(74.1, 81.3), 2),
                "tons_received": round(rng.uniform(42.0, 138.0), 2),
                "lab_humidity": humidity,
                "lab_protein": protein,
                "lab_impurities": impurities,
                "defect_white_belly_pct": round(rng.uniform(0.0, 2.8), 2),
                "test_weight_kg_hl": round(rng.uniform(74.4, 81.7), 2),
                "wet_gluten_pct": round(rng.uniform(20.0, 35.0), 2),
                "ash_pct": round(rng.uniform(0.45, 0.82), 3),
                "falling_number_sec": round(rng.uniform(210, 410), 1),
                "damaged_broken_pct": round(rng.uniform(0.1, 2.4), 2),
                "notes": "Registro sintetico 3 meses",
                "created_at": created_at,
            }
            docs.append(doc)
        if docs:
            db[RECEPTION_COLLECTION].insert_many(docs)
            inserted["receptions"] = len(docs)

    reception_docs = list(db[RECEPTION_COLLECTION].find({}, {"_id": 0, "id": 1, "receipt_batch": 1, "grain_code": 1, "lab_humidity": 1, "lab_protein": 1, "tons_received": 1, "created_at": 1}))
    if milling_count < target_records and reception_docs:
        docs = []
        for idx in range(target_records - milling_count):
            ref = rng.choice(reception_docs)
            extraction = round(rng.uniform(72.0, 79.2), 2)
            flour_output = round((float(ref.get("tons_received", 100.0)) * extraction / 100.0) + rng.uniform(0.0, 2.4), 3)
            production_cost = round(flour_output * rng.uniform(265, 385), 2)
            created_at = (ref.get("created_at") or datetime.utcnow()) + timedelta(hours=rng.randint(1, 8))
            docs.append(
                {
                    "id": str(uuid4()),
                    "reception_id": ref["id"],
                    "milling_batch": f"MOL-{created_at.strftime('%y%m%d')}-{idx:04d}",
                    "flour_lot": f"HAR-{created_at.strftime('%y%m%d')}-{rng.randint(1000, 9999)}",
                    "flour_type_id": _pick(catalogs.get("flour_types", []), "harina-estandar", rng),
                    "flour_product_target_id": _pick(catalogs.get("packed_products", []), "prod-25kg", rng),
                    "flour_line_id": _pick(catalogs.get("flour_lines", []), "linea-a", rng),
                    "wheat_input_tons": float(ref.get("tons_received", 100.0)),
                    "flour_output_tons": flour_output,
                    "extraction_target_pct": extraction,
                    "ingredient_tons": round(rng.uniform(0.0, 1.4), 3),
                    "energy_cost": round(production_cost * rng.uniform(0.26, 0.36), 2),
                    "labor_cost": round(production_cost * rng.uniform(0.18, 0.3), 2),
                    "logistics_cost": round(production_cost * rng.uniform(0.14, 0.22), 2),
                    "total_production_cost": production_cost,
                    "traceability": {
                        "receipt_batch": ref.get("receipt_batch", "-"),
                        "grain_code": ref.get("grain_code", "-"),
                        "lab_humidity": ref.get("lab_humidity", 0.0),
                        "lab_protein": ref.get("lab_protein", 0.0),
                    },
                    "created_at": created_at,
                }
            )
        if docs:
            db[MILLING_COLLECTION].insert_many(docs)
            inserted["milling_runs"] = len(docs)

    milling_docs = list(db[MILLING_COLLECTION].find({}, {"_id": 0, "id": 1, "flour_output_tons": 1, "flour_lot": 1, "milling_batch": 1, "created_at": 1}))
    if packaging_count < target_records and milling_docs:
        docs = []
        for idx in range(target_records - packaging_count):
            ref = rng.choice(milling_docs)
            flour_output = float(ref.get("flour_output_tons", 70.0))
            packed_output = round(flour_output * rng.uniform(0.978, 1.003), 3)
            delta_tons = round(flour_output - packed_output, 3)
            delta_pct = round((delta_tons / flour_output) * 100, 2) if flour_output else 0.0
            created_at = (ref.get("created_at") or datetime.utcnow()) + timedelta(hours=rng.randint(1, 6))
            docs.append(
                {
                    "id": str(uuid4()),
                    "milling_run_id": ref["id"],
                    "packaging_batch": f"EMP-{created_at.strftime('%y%m%d')}-{idx:04d}",
                    "packed_output_tons": packed_output,
                    "flour_output_tons": flour_output,
                    "weight_balance_delta_tons": delta_tons,
                    "weight_balance_delta_pct": delta_pct,
                    "flour_warehouse_id": _pick(catalogs.get("flour_warehouses", []), "alm-harina-a", rng),
                    "presentations": [
                        {
                            "packed_product_id": _pick(catalogs.get("packed_products", []), "prod-25kg", rng),
                            "package_unit_id": _pick(catalogs.get("packaging_units", []), "saco", rng),
                            "package_size_kg": rng.choice([1, 5, 10, 25]),
                            "units": int(rng.uniform(900, 4200)),
                        }
                    ],
                    "flour_lot": ref.get("flour_lot", "-"),
                    "created_at": created_at,
                }
            )
        if docs:
            db[PACKAGING_COLLECTION].insert_many(docs)
            inserted["packaging_runs"] = len(docs)

    packaging_docs = list(db[PACKAGING_COLLECTION].find({}, {"_id": 0, "id": 1, "packed_output_tons": 1, "packaging_batch": 1, "milling_run_id": 1, "created_at": 1}))
    milling_cost_map = {
        item.get("id"): (
            float(item.get("total_production_cost", 0.0)) / float(item.get("flour_output_tons", 1.0)) if float(item.get("flour_output_tons", 0.0)) > 0 else 0.0
        )
        for item in db[MILLING_COLLECTION].find({}, {"_id": 0, "id": 1, "total_production_cost": 1, "flour_output_tons": 1})
    }
    if sales_count < target_records and packaging_docs:
        docs = []
        for idx in range(target_records - sales_count):
            ref = rng.choice(packaging_docs)
            packed_output = float(ref.get("packed_output_tons", 55.0))
            sold_tons = round(max(2.0, packed_output * rng.uniform(0.45, 0.95)), 3)
            price = round(rng.uniform(480, 760), 2)
            discount = round(rng.uniform(0.0, 9.5), 2)
            gross = sold_tons * price
            net_revenue = round(gross * (1 - discount / 100.0), 2)
            cost_per_ton = milling_cost_map.get(ref.get("milling_run_id"), rng.uniform(260, 390))
            estimated_total_cost = round(sold_tons * cost_per_ton, 2)
            estimated_margin = round(net_revenue - estimated_total_cost, 2)
            estimated_margin_pct = round((estimated_margin / net_revenue) * 100, 2) if net_revenue else 0.0
            risk = round(rng.uniform(0.05, 0.88), 3)
            created_at = (ref.get("created_at") or datetime.utcnow()) + timedelta(hours=rng.randint(1, 4))
            docs.append(
                {
                    "id": str(uuid4()),
                    "sale_batch": f"VTA-{created_at.strftime('%y%m%d')}-{idx:04d}",
                    "packaging_run_id": ref["id"],
                    "customer_id": _pick(catalogs.get("customers", []), "cli-pan-norte", rng),
                    "customer_type_id": _weighted_customer_type(rng),
                    "site_id": _pick(catalogs.get("sites", []), "sede-cdmx", rng),
                    "sale_price_per_ton": price,
                    "sold_tons": sold_tons,
                    "discount_pct": discount,
                    "complaint_risk_index": risk,
                    "net_revenue": net_revenue,
                    "estimated_total_cost": estimated_total_cost,
                    "estimated_margin": estimated_margin,
                    "estimated_margin_pct": estimated_margin_pct,
                    "traceability": {
                        "packaging_batch": ref.get("packaging_batch", "-"),
                    },
                    "created_at": created_at,
                }
            )
        if docs:
            db[SALES_COLLECTION].insert_many(docs)
            inserted["sales"] = len(docs)

    if ops_count < target_records:
        process_pool = [
            ("produccion", "lote-turno-produccion", "Lote y turno de produccion"),
            ("produccion", "molienda-harina-lab", "Molienda harina (laboratorio)"),
            ("tolvas", "control-calidad-tolvas", "Control de calidad en tolvas"),
            ("empaques", "corrida-empaque", "Corrida de empaque"),
            ("ventas", "pedido-venta", "Pedido y cierre de venta"),
            ("calidad", "prelimpia-lab", "Prelimpia trigo seco sucio y limpio"),
            ("almacenes", "entrada-salida", "Entrada y salida inventario"),
        ]
        docs = []
        for idx in range(target_records - ops_count):
            module_key, process_key, natural_label = rng.choice(process_pool)
            op_date = start_day + timedelta(days=idx % days)
            created_at = datetime.combine(op_date, datetime.min.time()) + timedelta(hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
            fields = {
                "precio_trigo_usd_ton": f"{round(rng.uniform(280, 340), 2)}",
                "precio_harina_usd_ton": f"{round(rng.uniform(520, 760), 2)}",
                "precio_subproducto_usd_ton": f"{round(rng.uniform(180, 320), 2)}",
                "energia_usd_ton_trigo": f"{round(rng.uniform(4.8, 10.5), 2)}",
                "lab_humidity": f"{round(rng.uniform(11.4, 14.7), 2)}",
                "lab_impurities": f"{round(rng.uniform(0.05, 1.9), 2)}",
                "extraccion": f"{round(rng.uniform(72.0, 79.5), 2)}",
                "capacidad_ton_dia": f"{round(rng.uniform(170, 245), 1)}",
                "disponibilidad_operativa": f"{round(rng.uniform(76, 92), 2)}",
                "capacidad_nominal_pct": f"{round(rng.uniform(82, 99), 2)}",
                "dias_laborables_anuales": f"{round(rng.uniform(286, 312), 0)}",
                "humedad_harina": f"{round(rng.uniform(13.4, 14.9), 2)}",
                "eficiencia_envasado": f"{round(rng.uniform(97.8, 100.0), 2)}",
                "riesgo": f"{round(rng.uniform(0.08, 0.88), 3)}",
                "margen": f"{round(rng.uniform(8.5, 24.0), 2)}",
                "precio": f"{round(rng.uniform(500, 760), 2)}",
            }
            docs.append(
                {
                    "id": str(uuid4()),
                    "module_key": module_key,
                    "process_key": process_key,
                    "natural_label": natural_label,
                    "capture_date": op_date.isoformat(),
                    "reference": f"OPS-{module_key[:3].upper()}-{op_date.strftime('%y%m%d')}-{idx:04d}",
                    "fields": fields,
                    "created_at": created_at,
                }
            )
        if docs:
            db[OPS_CAPTURE_COLLECTION].insert_many(docs)
            inserted["ops_captures"] = len(docs)

    db[SEED_META_COLLECTION].update_one(
        {"_id": "realistic_ops"},
        {
            "$set": {
                "target_records": target_records,
                "days": days,
                "seed": seed,
                "last_seeded_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    return inserted


def build_ai_insights(months: int = 3) -> dict[str, Any]:
    # Evita siembra de datos en cada request para mantener latencia baja.
    # La carga de datos se debe ejecutar por seed/startup controlado.
    db = get_db()
    window_start = datetime.utcnow() - timedelta(days=max(90, months * 30))

    receptions = list(db[RECEPTION_COLLECTION].find({"created_at": {"$gte": window_start}}, {"_id": 0, "created_at": 1, "tons_received": 1, "lab_humidity": 1, "lab_protein": 1, "lab_impurities": 1}))
    milling = list(db[MILLING_COLLECTION].find({"created_at": {"$gte": window_start}}, {"_id": 0, "created_at": 1, "flour_output_tons": 1, "extraction_target_pct": 1, "total_production_cost": 1}))
    sales = list(db[SALES_COLLECTION].find({"created_at": {"$gte": window_start}}, {"_id": 0, "created_at": 1, "sold_tons": 1, "net_revenue": 1, "estimated_margin_pct": 1, "complaint_risk_index": 1, "customer_id": 1}))
    ops = list(db[OPS_CAPTURE_COLLECTION].find({"created_at": {"$gte": window_start}}, {"_id": 0, "module_key": 1, "process_key": 1, "fields": 1}))

    month_keys: list[str] = []
    now = datetime.utcnow()
    for offset in range(months - 1, -1, -1):
        month = now.month - offset
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        month_keys.append(f"{year}-{month:02d}")

    monthly = {
        key: {
            "received": 0.0,
            "milled": 0.0,
            "sold": 0.0,
            "revenue": 0.0,
            "spec_ok": 0,
            "spec_total": 0,
        }
        for key in month_keys
    }

    for rec in receptions:
        created = rec.get("created_at")
        if not isinstance(created, datetime):
            continue
        key = created.strftime("%Y-%m")
        if key not in monthly:
            continue
        monthly[key]["received"] += float(rec.get("tons_received", 0.0))
        monthly[key]["spec_total"] += 1
        ok = float(rec.get("lab_humidity", 0.0)) <= 14.0 and float(rec.get("lab_protein", 0.0)) >= 11.0 and float(rec.get("lab_impurities", 0.0)) <= 1.5
        if ok:
            monthly[key]["spec_ok"] += 1

    for run in milling:
        created = run.get("created_at")
        if isinstance(created, datetime):
            key = created.strftime("%Y-%m")
            if key in monthly:
                monthly[key]["milled"] += float(run.get("flour_output_tons", 0.0))

    customer_pool: set[str] = set()
    high_risk_sales = 0
    margin_values: list[float] = []
    for sale in sales:
        created = sale.get("created_at")
        if isinstance(created, datetime):
            key = created.strftime("%Y-%m")
            if key in monthly:
                monthly[key]["sold"] += float(sale.get("sold_tons", 0.0))
                monthly[key]["revenue"] += float(sale.get("net_revenue", 0.0))
        if sale.get("customer_id"):
            customer_pool.add(str(sale.get("customer_id")))
        if float(sale.get("complaint_risk_index", 0.0)) >= 0.65:
            high_risk_sales += 1
        margin_values.append(float(sale.get("estimated_margin_pct", 0.0)))

    production_series = [
        {
            "month": key,
            "tons_received": round(monthly[key]["received"], 2),
            "tons_milled": round(monthly[key]["milled"], 2),
            "tons_sold": round(monthly[key]["sold"], 2),
        }
        for key in month_keys
    ]
    sales_series = [{"month": key, "revenue": round(monthly[key]["revenue"], 2)} for key in month_keys]
    quality_series = [
        {
            "month": key,
            "spec_compliance": round((monthly[key]["spec_ok"] / monthly[key]["spec_total"]), 4) if monthly[key]["spec_total"] else 0.0,
        }
        for key in month_keys
    ]

    process_counters: dict[str, int] = {}
    process_anomaly: dict[str, int] = {}
    for item in ops:
        process = str(item.get("process_key", "sin-proceso"))
        process_counters[process] = process_counters.get(process, 0) + 1
        fields = item.get("fields") or {}
        risk = _to_float((fields or {}).get("riesgo"))
        if risk is not None and risk > 0.55:
            process_anomaly[process] = process_anomaly.get(process, 0) + 1

    process_health = []
    for process, count in sorted(process_counters.items(), key=lambda pair: pair[1], reverse=True)[:8]:
        anomalies = process_anomaly.get(process, 0)
        process_health.append(
            {
                "process_key": process,
                "records": count,
                "anomaly_rate": round(anomalies / count, 4) if count else 0.0,
            }
        )

    avg_margin = round(sum(margin_values) / len(margin_values), 2) if margin_values else 0.0
    compliance_avg = round(sum(point["spec_compliance"] for point in quality_series) / len(quality_series), 4) if quality_series else 0.0
    total_revenue = round(sum(item["revenue"] for item in sales_series), 2)

    algorithm_pipeline = [
        {"name": "Forecast Booster", "objective": "Forecast de demanda mensual", "status": "running", "score": 0.91},
        {"name": "Quality Drift Monitor", "objective": "Deteccion de deriva en humedad/proteina", "status": "running", "score": round(0.82 + compliance_avg * 0.16, 3)},
        {"name": "Margin Risk Classifier", "objective": "Riesgo de margen por venta", "status": "running", "score": round(0.84 + min(0.1, avg_margin / 500), 3)},
    ]

    reception_np = [
        {
            "humidity": float(item.get("lab_humidity", 0.0)),
            "protein": float(item.get("lab_protein", 0.0)),
            "impurities": float(item.get("lab_impurities", 0.0)),
            "tons": float(item.get("tons_received", 0.0)),
            "target_fail": 1
            if not (
                float(item.get("lab_humidity", 0.0)) <= 14.0
                and float(item.get("lab_protein", 0.0)) >= 11.0
                and float(item.get("lab_impurities", 0.0)) <= 1.5
            )
            else 0,
        }
        for item in receptions
    ]

    sales_np = [
        {
            "sold_tons": float(item.get("sold_tons", 0.0)),
            "net_revenue": float(item.get("net_revenue", 0.0)),
            "risk": float(item.get("complaint_risk_index", 0.0)),
            "target_margin": float(item.get("estimated_margin_pct", 0.0)),
            "target_high_risk": 1 if float(item.get("complaint_risk_index", 0.0)) >= 0.65 else 0,
        }
        for item in sales
    ]

    quality_feature_names = ["Humedad", "Proteina", "Impurezas", "Toneladas recibidas"]
    quality_feature_importance = [{"feature": name, "importance": 0.0} for name in quality_feature_names]
    quality_metrics = {"accuracy": 0.0, "roc_auc": 0.0}
    quality_risk_distribution: list[dict[str, Any]] = []

    if len(reception_np) >= 100 and len({item["target_fail"] for item in reception_np}) >= 2:
        X_quality = np.array([[item["humidity"], item["protein"], item["impurities"], item["tons"]] for item in reception_np], dtype=float)
        y_quality = np.array([item["target_fail"] for item in reception_np], dtype=int)
        X_train_q, X_test_q, y_train_q, y_test_q = train_test_split(X_quality, y_quality, test_size=0.25, random_state=42, stratify=y_quality)

        quality_rf = RandomForestClassifier(n_estimators=180, random_state=42, max_depth=8, min_samples_leaf=6)
        quality_rf.fit(X_train_q, y_train_q)
        y_pred_q = quality_rf.predict(X_test_q)
        y_prob_q = quality_rf.predict_proba(X_test_q)[:, 1]

        quality_metrics = {
            "accuracy": round(float(accuracy_score(y_test_q, y_pred_q)), 4),
            "roc_auc": round(float(roc_auc_score(y_test_q, y_prob_q)), 4),
        }
        quality_feature_importance = [
            {"feature": quality_feature_names[idx], "importance": round(float(value), 4)}
            for idx, value in enumerate(quality_rf.feature_importances_)
        ]
        quality_feature_importance.sort(key=lambda item: item["importance"], reverse=True)

        bins = [0.0, 0.2, 0.4, 0.6, 0.8, 1.01]
        labels = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"]
        counts = [0, 0, 0, 0, 0]
        for probability in y_prob_q:
            for idx in range(len(bins) - 1):
                if bins[idx] <= probability < bins[idx + 1]:
                    counts[idx] += 1
                    break
        quality_risk_distribution = [{"bucket": labels[idx], "count": counts[idx]} for idx in range(len(labels))]

    margin_feature_names = ["Toneladas vendidas", "Ingreso neto", "Indice de riesgo"]
    margin_feature_importance = [{"feature": name, "importance": 0.0} for name in margin_feature_names]
    margin_metrics = {"r2": 0.0, "mae": 0.0}
    margin_predictions: list[dict[str, Any]] = []

    if len(sales_np) >= 120:
        X_margin = np.array([[item["sold_tons"], item["net_revenue"], item["risk"]] for item in sales_np], dtype=float)
        y_margin = np.array([item["target_margin"] for item in sales_np], dtype=float)
        X_train_m, X_test_m, y_train_m, y_test_m = train_test_split(X_margin, y_margin, test_size=0.25, random_state=42)

        margin_rf = RandomForestRegressor(n_estimators=220, random_state=42, max_depth=10, min_samples_leaf=5)
        margin_rf.fit(X_train_m, y_train_m)
        y_pred_m = margin_rf.predict(X_test_m)

        margin_metrics = {
            "r2": round(float(r2_score(y_test_m, y_pred_m)), 4),
            "mae": round(float(mean_absolute_error(y_test_m, y_pred_m)), 4),
        }
        margin_feature_importance = [
            {"feature": margin_feature_names[idx], "importance": round(float(value), 4)}
            for idx, value in enumerate(margin_rf.feature_importances_)
        ]
        margin_feature_importance.sort(key=lambda item: item["importance"], reverse=True)

        for idx in range(min(18, len(y_test_m))):
            margin_predictions.append(
                {
                    "sample": f"M-{idx + 1:02d}",
                    "actual": round(float(y_test_m[idx]), 2),
                    "predicted": round(float(y_pred_m[idx]), 2),
                }
            )

    sales_risk_metrics = {"accuracy": 0.0, "roc_auc": 0.0}
    sales_risk_importance = [
        {"feature": "Toneladas vendidas", "importance": 0.0},
        {"feature": "Ingreso neto", "importance": 0.0},
        {"feature": "Margen estimado", "importance": 0.0},
    ]
    if len(sales_np) >= 120 and len({item["target_high_risk"] for item in sales_np}) >= 2:
        X_risk = np.array(
            [
                [
                    item["sold_tons"],
                    item["net_revenue"],
                    item["target_margin"],
                ]
                for item in sales_np
            ],
            dtype=float,
        )
        y_risk = np.array([item["target_high_risk"] for item in sales_np], dtype=int)
        X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(X_risk, y_risk, test_size=0.25, random_state=42, stratify=y_risk)
        risk_rf = RandomForestClassifier(n_estimators=180, random_state=42, max_depth=7, min_samples_leaf=5)
        risk_rf.fit(X_train_r, y_train_r)
        y_pred_r = risk_rf.predict(X_test_r)
        y_prob_r = risk_rf.predict_proba(X_test_r)[:, 1]
        sales_risk_metrics = {
            "accuracy": round(float(accuracy_score(y_test_r, y_pred_r)), 4),
            "roc_auc": round(float(roc_auc_score(y_test_r, y_prob_r)), 4),
        }
        sales_risk_importance = [
            {"feature": ["Toneladas vendidas", "Ingreso neto", "Margen estimado"][idx], "importance": round(float(value), 4)}
            for idx, value in enumerate(risk_rf.feature_importances_)
        ]
        sales_risk_importance.sort(key=lambda item: item["importance"], reverse=True)

    premium_algorithm_recommendations = [
        {
            "algorithm": "Random Forest Classifier (Calidad)",
            "why": "Maneja relaciones no lineales y robustez ante ruido de sensores.",
            "purpose": "Predecir probabilidad de fuera de especificacion por lote.",
            "variables": ["Humedad", "Proteina", "Impurezas", "Toneladas recibidas"],
        },
        {
            "algorithm": "Random Forest Regressor (Margen)",
            "why": "Captura interacciones complejas entre volumen, precio y riesgo comercial.",
            "purpose": "Estimar margen esperado por venta para priorizar cartera.",
            "variables": ["Toneladas vendidas", "Ingreso neto", "Indice de riesgo cliente"],
        },
        {
            "algorithm": "XGBoost Time Series",
            "why": "Excelente para series con estacionalidad corta y variables exogenas.",
            "purpose": "Forecast semanal de demanda y carga de molienda.",
            "variables": ["Ventas historicas", "Mix cliente", "Precio", "Disponibilidad de linea"],
        },
        {
            "algorithm": "Isolation Forest",
            "why": "Detecta anomalias multivariadas sin etiquetado manual exhaustivo.",
            "purpose": "Detectar corridas atipicas de energia, merma y paros.",
            "variables": ["Energia USD/Tm", "Extraccion", "Merma", "Paros"],
        },
        {
            "algorithm": "Bayesian Optimization",
            "why": "Busca combinaciones optimas con menos iteraciones y menor costo operativo.",
            "purpose": "Optimizar setpoints de humedad y extraccion maximizando margen.",
            "variables": ["Humedad de trigo", "Extraccion objetivo", "Eficiencia de empaque", "Costo energia"],
        },
    ]

    return {
        "window_months": months,
        "summary": {
            "records": {
                "receptions": len(receptions),
                "milling_runs": len(milling),
                "sales": len(sales),
                "ops_captures": len(ops),
            },
            "active_customers": len(customer_pool),
            "high_risk_sales": high_risk_sales,
            "avg_margin_pct": avg_margin,
            "avg_spec_compliance": compliance_avg,
            "revenue_window": total_revenue,
        },
        "series": {
            "production": production_series,
            "sales": sales_series,
            "quality": quality_series,
        },
        "process_health": process_health,
        "algorithm_pipeline": algorithm_pipeline,
        "model_lab": {
            "quality_random_forest": {
                "model": "RandomForestClassifier",
                "metrics": quality_metrics,
                "feature_importance": quality_feature_importance,
                "risk_distribution": quality_risk_distribution,
                "explanation": {
                    "purpose": "Estima la probabilidad de desviacion de calidad por lote.",
                    "why": "Permite explicabilidad por importancia de variables y robustez operativa.",
                    "variables": quality_feature_names,
                },
            },
            "margin_random_forest": {
                "model": "RandomForestRegressor",
                "metrics": margin_metrics,
                "feature_importance": margin_feature_importance,
                "prediction_samples": margin_predictions,
                "explanation": {
                    "purpose": "Pronostica margen de venta para decisiones comerciales y de mezcla.",
                    "why": "Captura no linealidad entre volumen, ingreso y riesgo de reclamo.",
                    "variables": margin_feature_names,
                },
            },
            "sales_risk_random_forest": {
                "model": "RandomForestClassifier",
                "metrics": sales_risk_metrics,
                "feature_importance": sales_risk_importance,
                "explanation": {
                    "purpose": "Clasifica ventas con riesgo alto de reclamacion o perdida de margen.",
                    "why": "Ayuda a priorizar atencion comercial y calidad de servicio.",
                    "variables": ["Toneladas vendidas", "Ingreso neto", "Margen estimado"],
                },
            },
        },
        "recommended_algorithms": premium_algorithm_recommendations,
    }


def _parse_iso_date(value: str, fallback: datetime) -> datetime:
    try:
        return datetime.fromisoformat(value.strip().replace("Z", ""))
    except (AttributeError, ValueError):
        return fallback


def _month_range(start: datetime, end: datetime) -> list[datetime]:
    months: list[datetime] = []
    cursor = datetime(start.year, start.month, 1)
    limit = datetime(end.year, end.month, 1)
    while cursor <= limit and len(months) < 24:
        months.append(cursor)
        if cursor.month == 12:
            cursor = datetime(cursor.year + 1, 1, 1)
        else:
            cursor = datetime(cursor.year, cursor.month + 1, 1)
    if not months:
        months.append(datetime(start.year, start.month, 1))
    return months


def build_ai_lab_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    if settings.enable_synthetic_seed:
        ensure_realistic_operational_data(target_records=50, days=120)
        _ensure_complaint_text_data(min_records=320)

    db = get_db()

    now = datetime.utcnow()
    default_start = now - timedelta(days=180)
    start_date = _parse_iso_date(str(payload.get("start_date", "")), default_start)
    end_date = _parse_iso_date(str(payload.get("end_date", "")), now)
    if end_date < start_date:
        start_date, end_date = end_date, start_date

    forecast_growth_pct = float(_to_float(payload.get("forecast_growth_pct")) or 0.0)
    price_adjustment_pct = float(_to_float(payload.get("price_adjustment_pct")) or 0.0)
    cost_increase_pct = float(_to_float(payload.get("cost_increase_pct")) or 0.0)
    quality_failure_pct = float(_to_float(payload.get("quality_failure_pct")) or 0.0)
    algorithm = str(payload.get("algorithm", "RandomForest + XGBoost"))

    algorithm_profiles = {
        "RandomForest + XGBoost": {
            "forecast_power": 1.12,
            "risk_sensitivity": 1.08,
            "price_elasticity": 1.0,
            "quality_resilience": 1.02,
        },
        "RandomForest + Prophet": {
            "forecast_power": 1.06,
            "risk_sensitivity": 0.98,
            "price_elasticity": 0.9,
            "quality_resilience": 1.05,
        },
        "XGBoost + KMeans": {
            "forecast_power": 1.1,
            "risk_sensitivity": 1.04,
            "price_elasticity": 1.12,
            "quality_resilience": 0.96,
        },
        "IsolationForest + RandomForest": {
            "forecast_power": 0.96,
            "risk_sensitivity": 1.2,
            "price_elasticity": 0.82,
            "quality_resilience": 1.18,
        },
    }
    profile = algorithm_profiles.get(
        algorithm,
        {
            "forecast_power": 1.0,
            "risk_sensitivity": 1.0,
            "price_elasticity": 1.0,
            "quality_resilience": 1.0,
        },
    )

    query = {"created_at": {"$gte": start_date, "$lte": end_date}}
    sales = list(
        db[SALES_COLLECTION].find(
            query,
            {
                "_id": 0,
                "id": 1,
                "created_at": 1,
                "customer_id": 1,
                "packaging_run_id": 1,
                "sold_tons": 1,
                "net_revenue": 1,
                "estimated_margin_pct": 1,
                "complaint_risk_index": 1,
            },
        )
    )
    packaging = list(db[PACKAGING_COLLECTION].find({}, {"_id": 0, "id": 1, "presentations": 1}))

    month_points = _month_range(start_date, end_date)
    month_keys = [point.strftime("%Y-%m") for point in month_points]
    baseline_map = {key: 0.0 for key in month_keys}

    for item in sales:
        created = item.get("created_at")
        if not isinstance(created, datetime):
            continue
        key = created.strftime("%Y-%m")
        if key in baseline_map:
            baseline_map[key] += float(item.get("net_revenue", 0.0))

    baseline_avg = (sum(baseline_map.values()) / len(baseline_map)) if baseline_map else 1.0
    if baseline_avg <= 0:
        baseline_avg = 1.0

    growth_factor = 1 + (forecast_growth_pct / 100.0)
    price_factor = 1 + (price_adjustment_pct / 100.0)
    quality_penalty = max(0.0, min(0.5, quality_failure_pct / 100.0))
    cost_factor = 1 + (cost_increase_pct / 100.0)

    adjusted_growth_factor = 1 + ((growth_factor - 1) * profile["forecast_power"])
    adjusted_price_factor = 1 + ((price_factor - 1) * profile["price_elasticity"])
    adjusted_quality_penalty = max(0.0, quality_penalty / max(0.65, profile["quality_resilience"]))

    forecast_series: list[dict[str, Any]] = []
    projected_revenue = 0.0
    projected_cost = 0.0
    for index, point in enumerate(month_points):
        key = point.strftime("%Y-%m")
        baseline_value = baseline_map.get(key, baseline_avg)
        trend = 1 + ((index + 1) / max(1, len(month_points))) * (adjusted_growth_factor - 1)
        forecast_value = baseline_value * trend
        scenario_value = forecast_value * adjusted_price_factor * (1 - adjusted_quality_penalty * 0.35)
        scenario_cost = scenario_value * (0.78 * cost_factor * (1 + adjusted_quality_penalty * 0.18))

        projected_revenue += scenario_value
        projected_cost += scenario_cost
        forecast_series.append(
            {
                "month": key,
                "baseline": round(baseline_value, 2),
                "forecast": round(forecast_value, 2),
                "scenario": round(scenario_value, 2),
            }
        )

    projected_margin = projected_revenue - projected_cost
    projected_margin_pct = (projected_margin / projected_revenue * 100.0) if projected_revenue > 0 else 0.0

    customer_rollup: dict[str, dict[str, float]] = {}
    for item in sales:
        customer_id = str(item.get("customer_id") or "sin-cliente")
        bucket = customer_rollup.setdefault(customer_id, {"tons": 0.0, "margin": 0.0, "risk": 0.0, "count": 0.0})
        bucket["tons"] += float(item.get("sold_tons", 0.0))
        bucket["margin"] += float(item.get("estimated_margin_pct", 0.0))
        bucket["risk"] += float(item.get("complaint_risk_index", 0.0))
        bucket["count"] += 1

    scored_customers: list[tuple[str, float, float]] = []
    for customer_id, agg in customer_rollup.items():
        count = max(1.0, agg["count"])
        avg_margin = agg["margin"] / count
        avg_risk = agg["risk"] / count
        score = (agg["tons"] * 0.5) + (avg_margin * 4.0) - (avg_risk * 25.0)
        scored_customers.append((customer_id, score, avg_margin))

    scored_customers.sort(key=lambda item: item[1], reverse=True)
    n_customers = len(scored_customers)
    top_cut = max(1, int(n_customers * 0.3))
    mid_cut = max(top_cut + 1, int(n_customers * 0.75))

    segments = {
        "Oro": scored_customers[:top_cut],
        "Plata": scored_customers[top_cut:mid_cut],
        "Bronce": scored_customers[mid_cut:],
    }
    customer_segments: list[dict[str, Any]] = []
    for segment_name, members in segments.items():
        margins = [item[2] for item in members]
        avg_margin = (sum(margins) / len(margins)) if margins else 0.0
        base_churn = {"Oro": 0.08, "Plata": 0.14, "Bronce": 0.24}[segment_name]
        price_pressure = max(0.0, price_adjustment_pct) / 100.0
        aggressive_discount = abs(min(0.0, price_adjustment_pct)) / 100.0
        price_churn = price_pressure * 0.22 * profile["price_elasticity"]
        discount_retention = aggressive_discount * 0.12 * profile["price_elasticity"]
        quality_churn = adjusted_quality_penalty * 0.25 * profile["risk_sensitivity"]
        cost_churn = max(0.0, cost_increase_pct) / 1000.0
        churn = min(0.85, max(0.02, base_churn + price_churn + quality_churn + cost_churn - discount_retention))
        customer_segments.append(
            {
                "segment": segment_name,
                "customers": len(members),
                "avg_margin": round(avg_margin, 2),
                "churn_risk": round(churn, 4),
            }
        )

    packaging_map: dict[str, str] = {}
    for package in packaging:
        product = "producto-mix"
        presentations = package.get("presentations") or []
        if presentations and isinstance(presentations, list):
            first = presentations[0] or {}
            product = str(first.get("packed_product_id") or product)
        package_id = str(package.get("id") or "")
        if package_id:
            packaging_map[package_id] = product

    product_customer_set: dict[str, set[str]] = {}
    product_risk_bucket: dict[str, float] = {}
    for sale in sales:
        product = packaging_map.get(str(sale.get("packaging_run_id") or ""), "producto-mix")
        customer_id = str(sale.get("customer_id") or "sin-cliente")
        product_customer_set.setdefault(product, set()).add(customer_id)
        product_risk_bucket[product] = product_risk_bucket.get(product, 0.0) + float(sale.get("complaint_risk_index", 0.0))

    quality_impact: list[dict[str, Any]] = []
    for product, customers in sorted(product_customer_set.items(), key=lambda item: len(item[1]), reverse=True)[:6]:
        count = len(customers)
        risk_base = (product_risk_bucket.get(product, 0.0) / max(1, count))
        impacted = int(round(count * (0.12 + quality_penalty * 1.35)))
        level = "alto" if risk_base >= 0.58 or quality_penalty > 0.09 else "medio" if risk_base >= 0.35 else "bajo"
        action = (
            "Aislar lotes y activar visita tecnica"
            if level == "alto"
            else "Ajustar mezcla y reforzar control de laboratorio"
            if level == "medio"
            else "Monitoreo preventivo de entrega y calidad"
        )
        quality_impact.append(
            {
                "product": product,
                "clients_affected": max(1, impacted),
                "risk_level": level,
                "action": action,
            }
        )

    complaints_docs = list(
        db[COMPLAINTS_COLLECTION].find(
            {"created_at": {"$gte": start_date, "$lte": end_date}},
            {
                "_id": 0,
                "product_id": 1,
                "complaint_text": 1,
                "is_critical": 1,
                "status": 1,
            },
        )
    )
    if len(complaints_docs) < 60:
        complaints_docs = list(
            db[COMPLAINTS_COLLECTION].find(
                {},
                {
                    "_id": 0,
                    "product_id": 1,
                    "complaint_text": 1,
                    "is_critical": 1,
                    "status": 1,
                },
            ).limit(240)
        )

    texts = [str(item.get("complaint_text") or "") for item in complaints_docs]
    labels = [1 if int(item.get("is_critical", 0)) == 1 else 0 for item in complaints_docs]

    tp = fp = fn = tn = 0
    precision = recall = f1 = 0.0
    predicted_risks: list[float] = []

    if len(texts) >= 60 and len(set(labels)) >= 2:
        X_train, X_test, y_train, y_test = train_test_split(texts, labels, test_size=0.28, random_state=42, stratify=labels)
        vectorizer = TfidfVectorizer(max_features=800, ngram_range=(1, 2), min_df=2)
        X_train_vec = vectorizer.fit_transform(X_train)
        X_test_vec = vectorizer.transform(X_test)

        clf = LogisticRegression(max_iter=320, class_weight="balanced")
        clf.fit(X_train_vec, y_train)

        y_pred = clf.predict(X_test_vec)
        y_prob = clf.predict_proba(X_test_vec)[:, 1]
        predicted_risks = [float(item) for item in y_prob]

        for actual, predicted in zip(y_test, y_pred):
            if actual == 1 and predicted == 1:
                tp += 1
            elif actual == 0 and predicted == 1:
                fp += 1
            elif actual == 1 and predicted == 0:
                fn += 1
            else:
                tn += 1

        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    negative_words = {
        "devolucion",
        "defectuosa",
        "inconsistente",
        "urgente",
        "paro",
        "reclamo",
        "critica",
        "alterado",
        "falla",
        "incidencia",
    }
    positive_words = {
        "satisfaccion",
        "favorable",
        "estable",
        "consistente",
        "puntual",
        "mejora",
        "uniforme",
        "buena",
    }

    price_keywords = {
        "precio",
        "costo",
        "costos",
        "caro",
        "tarifa",
        "descuento",
        "margen",
        "factura",
    }
    service_keywords = {
        "servicio",
        "entrega",
        "atencion",
        "soporte",
        "demora",
        "retraso",
        "logistica",
        "puntual",
    }
    quality_keywords = {
        "calidad",
        "humedad",
        "proteina",
        "impurezas",
        "textura",
        "sabor",
        "olor",
        "especificacion",
        "lote",
    }

    product_bucket: dict[str, dict[str, float]] = {}
    attribution_totals = {"price": 0, "service": 0, "quality": 0}
    for index, doc in enumerate(complaints_docs):
        product = str(doc.get("product_id") or "producto-mix")
        text = str(doc.get("complaint_text") or "").lower()
        tokens = text.replace(",", " ").replace(".", " ").split()
        neg = sum(1 for token in tokens if token in negative_words)
        pos = sum(1 for token in tokens if token in positive_words)
        valence = max(-1.0, min(1.0, (pos - neg) / max(1, pos + neg + 1)))
        intensity = max(-1.0, min(1.0, (pos + neg) / 6.0))
        model_risk = predicted_risks[index % len(predicted_risks)] if predicted_risks else (0.65 if int(doc.get("is_critical", 0)) == 1 else 0.25)

        price_score = sum(1 for token in tokens if token in price_keywords)
        service_score = sum(1 for token in tokens if token in service_keywords)
        quality_score = sum(1 for token in tokens if token in quality_keywords)
        if price_score == 0 and service_score == 0 and quality_score == 0:
            # Backfill a plausible dominant driver when keywords are sparse.
            if int(doc.get("is_critical", 0)) == 1:
                quality_score = 1
            elif str(doc.get("status", "")).lower() == "pending":
                service_score = 1
            else:
                price_score = 1

        dominant_driver = "price"
        if service_score >= price_score and service_score >= quality_score:
            dominant_driver = "service"
        if quality_score >= price_score and quality_score >= service_score:
            dominant_driver = "quality"
        attribution_totals[dominant_driver] += 1

        bucket = product_bucket.setdefault(
            product,
            {
                "complaints": 0.0,
                "valence": 0.0,
                "intensity": 0.0,
                "risk": 0.0,
                "critical": 0.0,
                "price": 0.0,
                "service": 0.0,
                "quality": 0.0,
            },
        )
        bucket["complaints"] += 1.0
        bucket["valence"] += valence
        bucket["intensity"] += intensity
        bucket["risk"] += model_risk
        bucket["critical"] += 1.0 if int(doc.get("is_critical", 0)) == 1 else 0.0
        bucket["price"] += float(price_score)
        bucket["service"] += float(service_score)
        bucket["quality"] += float(quality_score)

    complaints_quadrants: list[dict[str, Any]] = []
    attribution_by_product: list[dict[str, Any]] = []
    for product, agg in sorted(product_bucket.items(), key=lambda item: item[1]["complaints"], reverse=True)[:8]:
        count = max(1.0, agg["complaints"])
        avg_valence = agg["valence"] / count
        avg_intensity = agg["intensity"] / count
        avg_risk = agg["risk"] / count
        critical_rate = agg["critical"] / count
        price_rel = agg["price"]
        service_rel = agg["service"]
        quality_rel = agg["quality"]
        emotion = "Frustracion" if avg_valence < -0.15 else "Incertidumbre" if avg_valence < 0.1 else "Confianza"
        risk_level = "alto" if avg_risk >= 0.6 or critical_rate >= 0.4 else "medio" if avg_risk >= 0.35 else "bajo"
        complaints_quadrants.append(
            {
                "product": product,
                "emotion": emotion,
                "x": round(avg_valence, 3),
                "y": round(avg_intensity, 3),
                "complaints": int(count),
                "risk": risk_level,
            }
        )
        dominant_driver = "price"
        if service_rel >= price_rel and service_rel >= quality_rel:
            dominant_driver = "service"
        if quality_rel >= price_rel and quality_rel >= service_rel:
            dominant_driver = "quality"
        attribution_by_product.append(
            {
                "product": product,
                "price": int(round(price_rel)),
                "service": int(round(service_rel)),
                "quality": int(round(quality_rel)),
                "dominant_driver": dominant_driver,
            }
        )

    complaint_total = len(complaints_docs)
    resolved = sum(1 for doc in complaints_docs if str(doc.get("status", "")).lower() == "resolved")
    escalated = sum(1 for doc in complaints_docs if str(doc.get("status", "")).lower() == "escalated")
    pending = max(0, complaint_total - resolved - escalated)

    active_customers = len(customer_rollup)
    benefited_customers = int(
        round(
            active_customers
            * min(
                0.92,
                0.38
                + max(0.0, price_adjustment_pct) * 0.016 * profile["price_elasticity"]
                + max(0.0, forecast_growth_pct) * 0.009 * profile["forecast_power"],
            )
        )
    )
    affected_customers = int(
        round(
            sum(item["clients_affected"] for item in quality_impact)
            * (1 + adjusted_quality_penalty * 0.25 * profile["risk_sensitivity"])
        )
    )

    return {
        "meta": {
            "start_date": start_date.date().isoformat(),
            "end_date": end_date.date().isoformat(),
            "months": len(month_points),
            "algorithm": algorithm,
            "algorithm_impact": {
                "forecast_power": profile["forecast_power"],
                "risk_sensitivity": profile["risk_sensitivity"],
                "price_elasticity": profile["price_elasticity"],
                "quality_resilience": profile["quality_resilience"],
            },
        },
        "projection": {
            "projected_revenue": round(projected_revenue, 2),
            "projected_cost": round(projected_cost, 2),
            "projected_margin": round(projected_margin, 2),
            "projected_margin_pct": round(projected_margin_pct, 2),
            "benefited_customers": benefited_customers,
            "affected_customers": affected_customers,
        },
        "forecast_series": forecast_series,
        "customer_segments": customer_segments,
        "quality_impact": quality_impact,
        "sentiment": {
            "summary": {
                "total_complaints": complaint_total,
                "resolved": resolved,
                "escalated": escalated,
                "pending": pending,
            },
            "confusion": {
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "tn": tn,
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
            },
            "quadrants": complaints_quadrants,
            "attribution": {
                "totals": attribution_totals,
                "by_product": attribution_by_product,
            },
            "insights": [
                "Sentimiento derivado de texto de quejas: usa NLP para priorizar reclamos criticos en tiempo casi real.",
                "Productos en cuadrantes de valencia negativa e intensidad alta requieren contencion comercial en menos de 24 horas.",
                "Cruzar quejas textuales con trazabilidad de lotes permite acciones correctivas por cliente y producto.",
                "La atribucion causal distingue si el sentimiento nace por precio, servicio o calidad para definir el plan de respuesta.",
            ],
        },
    }
