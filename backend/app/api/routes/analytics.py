from fastapi import APIRouter

from app.core.cache import get_or_set_cache
from app.ml.customer_models import run_customer_analytics
from app.ml.forecast_models import generate_forecast
from app.ml.quality_models import train_quality_models
from app.optimization.planner import optimize_production
from app.schemas.optimization import OptimizationRequest, OptimizationResponse

router = APIRouter()


@router.get("/quality")
def quality_prediction() -> dict:
    return get_or_set_cache("analytics:quality", ttl_seconds=60, compute_fn=train_quality_models)


@router.get("/forecast")
def demand_forecast() -> dict:
    return get_or_set_cache("analytics:forecast", ttl_seconds=60, compute_fn=generate_forecast)


@router.get("/customers")
def customer_analytics() -> dict:
    return get_or_set_cache("analytics:customers", ttl_seconds=60, compute_fn=run_customer_analytics)


@router.post("/optimize", response_model=OptimizationResponse)
def optimize(request: OptimizationRequest) -> OptimizationResponse:
    return optimize_production(request)
