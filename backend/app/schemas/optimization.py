from pydantic import BaseModel, Field


class OptimizationRequest(BaseModel):
    demand_tons: float = Field(default=400.0, gt=0)
    max_capacity_tons: float = Field(default=500.0, gt=0)
    inventory_tons: float = Field(default=180.0, ge=0)
    quality_target_protein: float = Field(default=11.5, gt=0)


class OptimizationResponse(BaseModel):
    production_tons: float
    blend_ratio_high_protein: float
    estimated_cost: float
    estimated_profit: float
    decision_notes: list[str]
