from fastapi import APIRouter

from app.core.cache import get_or_set_cache
from app.kpi.engine import compute_kpis

router = APIRouter()


@router.get("/")
def get_all_kpis() -> dict:
    return get_or_set_cache("kpis:all", ttl_seconds=45, compute_fn=compute_kpis)
