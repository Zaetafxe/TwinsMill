from datetime import datetime

from pydantic import BaseModel, Field


class CatalogItem(BaseModel):
    id: str
    label: str


class CatalogItemUpsertRequest(BaseModel):
    id: str = Field(min_length=2, max_length=80)
    label: str = Field(min_length=2, max_length=160)


class GrainCatalogsResponse(BaseModel):
    grain_varieties: list[CatalogItem]
    grain_warehouses: list[CatalogItem]
    flour_warehouses: list[CatalogItem]
    flour_types: list[CatalogItem]
    flour_lines: list[CatalogItem]
    packed_products: list[CatalogItem]
    packaging_units: list[CatalogItem]
    sites: list[CatalogItem]
    customers: list[CatalogItem]
    customer_types: list[CatalogItem]
    farmers: list[CatalogItem]


class GrainReceptionCreate(BaseModel):
    receipt_date: str
    shift_turn: str | None = Field(default=None, max_length=30)
    grain_code: str = Field(min_length=2, max_length=60)
    wheat_lot_code: str | None = Field(default=None, max_length=80)
    variety_id: str
    farmer_id: str
    grain_warehouse_id: str
    preclean_wheat_type_id: str | None = None
    preclean_humidity_pct: float | None = Field(default=None, ge=0, le=100)
    preclean_impurity_pct: float | None = Field(default=None, ge=0, le=100)
    preclean_test_weight_kg_hl: float | None = Field(default=None, ge=0)
    tons_received: float = Field(gt=0)
    lab_humidity: float = Field(ge=0, le=100)
    lab_protein: float = Field(ge=0, le=100)
    lab_impurities: float = Field(ge=0, le=100)
    defect_white_belly_pct: float | None = Field(default=None, ge=0, le=100)
    test_weight_kg_hl: float | None = Field(default=None, ge=0)
    wet_gluten_pct: float | None = Field(default=None, ge=0, le=100)
    ash_pct: float | None = Field(default=None, ge=0, le=100)
    falling_number_sec: float | None = Field(default=None, ge=0)
    damaged_broken_pct: float | None = Field(default=None, ge=0, le=100)
    notes: str = ""


class GrainReceptionResponse(BaseModel):
    id: str
    receipt_batch: str
    receipt_date: str
    shift_turn: str | None = None
    grain_code: str
    wheat_lot_code: str | None = None
    variety_id: str
    farmer_id: str
    grain_warehouse_id: str
    preclean_wheat_type_id: str | None = None
    preclean_humidity_pct: float | None = None
    preclean_impurity_pct: float | None = None
    preclean_test_weight_kg_hl: float | None = None
    tons_received: float
    lab_humidity: float
    lab_protein: float
    lab_impurities: float
    defect_white_belly_pct: float | None = None
    test_weight_kg_hl: float | None = None
    wet_gluten_pct: float | None = None
    ash_pct: float | None = None
    falling_number_sec: float | None = None
    damaged_broken_pct: float | None = None
    notes: str
    created_at: datetime


class MillingRunCreate(BaseModel):
    reception_id: str
    flour_type_id: str
    flour_product_target_id: str
    flour_line_id: str
    extraction_target_pct: float = Field(gt=0, le=100)
    ingredient_tons: float = Field(ge=0)
    energy_cost: float = Field(ge=0)
    labor_cost: float = Field(ge=0)
    logistics_cost: float = Field(ge=0)


class MillingRunResponse(BaseModel):
    id: str
    reception_id: str
    milling_batch: str
    flour_lot: str
    flour_type_id: str
    flour_product_target_id: str
    flour_line_id: str
    wheat_input_tons: float
    flour_output_tons: float
    extraction_target_pct: float
    ingredient_tons: float
    total_production_cost: float
    created_at: datetime


class PackagingPresentation(BaseModel):
    packed_product_id: str
    package_unit_id: str
    package_size_kg: float = Field(gt=0)
    units: int = Field(gt=0)


class PackagingRunCreate(BaseModel):
    milling_run_id: str
    flour_warehouse_id: str
    presentations: list[PackagingPresentation] = Field(min_length=1)


class PackagingRunResponse(BaseModel):
    id: str
    milling_run_id: str
    packaging_batch: str
    packed_output_tons: float
    flour_output_tons: float
    weight_balance_delta_tons: float
    weight_balance_delta_pct: float
    created_at: datetime


class SaleCreate(BaseModel):
    packaging_run_id: str
    customer_id: str
    customer_type_id: str
    site_id: str
    sale_price_per_ton: float = Field(gt=0)
    sold_tons: float = Field(gt=0)
    discount_pct: float = Field(ge=0, le=100)
    complaint_risk_index: float = Field(ge=0, le=1)


class SaleResponse(BaseModel):
    id: str
    sale_batch: str
    packaging_run_id: str
    customer_id: str
    site_id: str
    sold_tons: float
    net_revenue: float
    estimated_total_cost: float
    estimated_margin: float
    estimated_margin_pct: float
    complaint_risk_index: float
    created_at: datetime


class CausalKPIsResponse(BaseModel):
    average_humidity: float
    average_protein: float
    traceability_completion_pct: float
    weight_balance_alerts: int
    average_margin_pct: float
    high_risk_sales: int
    margin_projection_with_discounts: float


class LegacyCaptureCreate(BaseModel):
    receipt_date: str
    grain_code: str
    variety_id: str
    farmer_id: str
    grain_warehouse_id: str
    reception_batch: str
    milling_batch: str
    production_batch: str
    lab_humidity: float
    lab_protein: float
    lab_impurities: float
    flour_warehouse_id: str
    flour_type_id: str
    packed_product_id: str
    package_unit_id: str
    site_id: str
    customer_id: str
    notes: str = ""


class OpsCaptureCreate(BaseModel):
    module_key: str = Field(min_length=2, max_length=40)
    process_key: str = Field(min_length=2, max_length=80)
    natural_label: str = Field(min_length=2, max_length=120)
    capture_date: str
    reference: str = Field(min_length=2, max_length=80)
    fields: dict[str, str]


class OpsCaptureResponse(BaseModel):
    id: str
    module_key: str
    process_key: str
    natural_label: str
    capture_date: str
    reference: str
    fields: dict[str, str]
    created_at: datetime


class EconomicBaselineResponse(BaseModel):
    wheat_price_usd_ton: float
    flour_price_usd_ton: float
    byproduct_price_usd_ton: float
    energy_usd_ton_wheat: float
    wheat_moisture_reception_pct: float
    capacity_ton_day: float
    labor_days_year: float
    flour_moisture_pct: float
    packaging_efficiency_pct: float
    operational_availability_pct: float
    nominal_capacity_pct: float
    impurity_input_pct: float
    flour_extraction_pct: float
    wheat_moisture_input_pct: float
    source_counts: dict[str, int]
    window_days: int = 0


class EconomicScenarioCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    notes: str = Field(default="", max_length=400)
    variables: dict[str, float]


class EconomicScenarioResponse(BaseModel):
    id: str
    name: str
    notes: str
    variables: dict[str, float]
    annual_contribution_usd: float
    delta_vs_baseline_usd: float
    created_at: datetime


class EconomicTrendPoint(BaseModel):
    month: str
    baseline_usd: float
    scenario_usd: float


class EconomicTrendResponse(BaseModel):
    points: list[EconomicTrendPoint]
