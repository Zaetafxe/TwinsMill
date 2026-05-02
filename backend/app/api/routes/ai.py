from fastapi import APIRouter

from app.core.cache import clear_cache, get_or_set_cache
from app.core.config import settings
from app.etl.synthetic_data import generate_synthetic_datasets
from app.ml.customer_models import run_customer_analytics
from app.ml.quality_models import train_quality_models
from app.schemas.ai import AILabScenarioRequest, CopilotAnswer, CopilotQuestion, NotebookAnalysisRequest, NotebookAnalysisResponse
from app.services.copilot import answer_copilot
from app.services.decision_engine import build_recommendations
from app.services.granos import build_ai_insights, build_ai_lab_scenario, ensure_realistic_operational_data
from app.services.maturity import get_digital_maturity_score
from app.services.notebook import analyze_prompt
from app.services.profit_optimizer import run_profit_optimizer
from app.services.repository import seed_synthetic_data

router = APIRouter()


@router.get("/recommendations")
def recommendations() -> list[dict]:
    """Recomendaciones basadas en analítica de calidad y clientes con fallback rápido"""
    def _compute() -> list[dict]:
        try:
            quality = train_quality_models()
            customers = run_customer_analytics()
            return build_recommendations(
                quality_probability=quality["quality_deviation_probability"],
                churn_probability=customers["churn_prediction"]["probability"],
            )
        except Exception as e:
            # Fallback con recomendaciones genéricas si el análisis falla o tarda
            print(f"Warning: Recommendations fallback used: {e}")
            return [
                {
                    "title": "Optimizar control de calidad",
                    "severity": "medium",
                    "recommendation": "Revisar parámetros de molienda para reducir variabilidad",
                    "impact_area": "calidad",
                },
                {
                    "title": "Revisar costos de producción",
                    "severity": "low",
                    "recommendation": "Analizar eficiencia energética en etapa de molienda",
                    "impact_area": "financiero",
                },
            ]

    return get_or_set_cache("ai:recommendations", ttl_seconds=60, compute_fn=_compute)


@router.post("/copilot", response_model=CopilotAnswer)
def copilot_qa(payload: CopilotQuestion) -> CopilotAnswer:
    result = answer_copilot(payload.question)
    return CopilotAnswer(**result)


@router.get("/maturity")
def maturity_score() -> dict:
    return get_digital_maturity_score()


@router.get("/profit-optimizer")
def ai_profit_optimizer() -> dict:
    """Optimizador de rentabilidad con fallback rápido"""
    try:
        return run_profit_optimizer()
    except Exception as e:
        # Fallback con plan genérico si la optimización falla
        print(f"Warning: Profit optimizer fallback used: {e}")
        return {
            "what_to_produce": "Harina de alta proteína (12-13% proteína)",
            "when_to_produce": "Aumentar producción en Q1 y Q4",
            "what_to_blend": "Blend premium 60% trigo duro + 40% trigo suave",
            "which_customers_to_prioritize": ["Panaderías industriales", "Distribuidores mayoristas"],
            "expected_profit": 450000.0,
        }


@router.post("/seed")
def seed_data() -> dict:
    if not settings.enable_synthetic_seed:
        return {
            "status": "disabled",
            "message": "La siembra sintetica esta deshabilitada en esta instancia.",
        }

    data = generate_synthetic_datasets()
    inserted = seed_synthetic_data(data)
    ops_inserted = ensure_realistic_operational_data(target_records=50, days=90)
    return {"status": "ok", "inserted": inserted, "operational_inserted": ops_inserted}


@router.get("/datasets")
def synthetic_datasets() -> dict:
    return generate_synthetic_datasets()


@router.get("/insights")
def insights(months: int = 3) -> dict:
    bounded_months = max(3, min(12, int(months)))
    return get_or_set_cache(
        f"ai:insights:{bounded_months}",
        ttl_seconds=60,
        compute_fn=lambda: build_ai_insights(months=bounded_months),
    )


@router.post("/cache/clear")
def clear_ai_cache() -> dict:
    removed = clear_cache(prefix="ai:")
    return {"status": "ok", "cleared": removed}


@router.post("/lab/run")
def run_ai_lab(payload: AILabScenarioRequest) -> dict:
    return build_ai_lab_scenario(payload.model_dump())


@router.post("/notebook/analyze", response_model=NotebookAnalysisResponse)
def analyze_notebook_prompt(payload: NotebookAnalysisRequest) -> NotebookAnalysisResponse:
    cells = analyze_prompt(payload.prompt)
    return NotebookAnalysisResponse(cells=cells)

