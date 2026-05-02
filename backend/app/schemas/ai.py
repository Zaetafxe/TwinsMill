from pydantic import BaseModel
from typing import Any


class AIRecommendation(BaseModel):
    title: str
    severity: str
    impact_area: str
    recommendation: str


class CopilotQuestion(BaseModel):
    question: str


class CopilotAnswer(BaseModel):
    answer: str
    confidence: float


class AILabScenarioRequest(BaseModel):
    start_date: str
    end_date: str
    algorithm: str
    forecast_growth_pct: float = 0.0
    price_adjustment_pct: float = 0.0
    cost_increase_pct: float = 0.0
    quality_failure_pct: float = 0.0


class NotebookAnalysisRequest(BaseModel):
    prompt: str


class NotebookAnalysisResponse(BaseModel):
    cells: list[dict[str, Any]]

