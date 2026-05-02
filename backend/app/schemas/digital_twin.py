from pydantic import BaseModel, Field


class DigitalTwinScenario(BaseModel):
    wheat_input_tons: float = Field(default=520.0, gt=0)
    demand_index: float = Field(default=1.0, gt=0)
    capacity_factor: float = Field(default=1.0, gt=0)
    wheat_cost_per_ton: float = Field(default=295.0, gt=0)
    selling_price_per_ton: float = Field(default=465.0, gt=0)


class StageFlow(BaseModel):
    stage: str
    input_tons: float
    output_tons: float
    efficiency: float
    risk_index: float


class DigitalTwinResponse(BaseModel):
    stages: list[StageFlow]
    financial_output: dict
    quality_output: dict
    demand_output: dict


class ProcessStageSpec(BaseModel):
    name: str
    inputs: list[str]
    outputs: list[str]
    critical_variables: list[str]
    equipment: list[str]
    operational_risks: list[str]


class SensorSpec(BaseModel):
    process: str
    variable: str
    sensor_type: str
    source: str
    frequency_seconds: int


class DataCoreSpec(BaseModel):
    capture_frequencies: dict[str, str]
    time_series_structure: dict[str, str]
    integration_sources: list[str]


class KpiSpec(BaseModel):
    name: str
    category: str
    formula: str
    unit: str
    target: str


class TwinModelSpec(BaseModel):
    physical_model: list[str]
    mathematical_model: list[str]
    data_model: list[str]
    predictive_model: list[str]
    capabilities: list[str]


class MathematicalEquation(BaseModel):
    name: str
    expression: str
    description: str


class TwinBlueprintResponse(BaseModel):
    process_stages: list[ProcessStageSpec]
    sensors: list[SensorSpec]
    data_core: DataCoreSpec
    kpis: list[KpiSpec]
    twin_model: TwinModelSpec
    equations: list[MathematicalEquation]


class PhysicalModelInput(BaseModel):
    wheat_input_tons: float = Field(default=520.0, gt=0)
    wheat_moisture_pct: float = Field(default=13.2, ge=9.0, le=18.0)
    tempering_target_pct: float = Field(default=15.3, ge=11.0, le=18.0)
    roller_speed_rpm: float = Field(default=470.0, ge=250.0, le=900.0)
    grinding_pressure_bar: float = Field(default=5.4, ge=2.0, le=12.0)
    sifter_efficiency_pct: float = Field(default=95.8, ge=80.0, le=99.9)
    purifier_efficiency_pct: float = Field(default=94.0, ge=80.0, le=99.9)
    extraction_target_pct: float = Field(default=75.0, ge=60.0, le=85.0)
    specific_energy_kwh_ton: float = Field(default=56.0, ge=20.0, le=120.0)
    planned_time_minutes: int = Field(default=1440, ge=60, le=10080)
    downtime_minutes: int = Field(default=65, ge=0, le=10080)
    quality_protein_pct: float = Field(default=11.4, ge=7.0, le=17.0)
    quality_ash_pct: float = Field(default=0.57, ge=0.2, le=1.5)


class StageMassBalance(BaseModel):
    stage: str
    input_tons: float
    output_tons: float
    losses_tons: float


class PhysicalModelOutput(BaseModel):
    stage_balance: list[StageMassBalance]
    kpis: dict[str, float]
    alerts: list[str]
