from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.granos import (
    CatalogItem,
    CatalogItemUpsertRequest,
    CausalKPIsResponse,
    GrainCatalogsResponse,
    GrainReceptionCreate,
    GrainReceptionResponse,
    LegacyCaptureCreate,
    OpsCaptureCreate,
    OpsCaptureResponse,
    EconomicBaselineResponse,
    EconomicScenarioCreate,
    EconomicScenarioResponse,
    EconomicTrendResponse,
    MillingRunCreate,
    MillingRunResponse,
    PackagingRunCreate,
    PackagingRunResponse,
    SaleCreate,
    SaleResponse,
)
from app.services.granos import (
    compute_causal_kpis,
    create_legacy_capture,
    create_milling_run,
    create_packaging_run,
    create_reception,
    create_sale,
    get_or_seed_catalogs,
    list_milling_runs,
    list_packaging_runs,
    list_receptions,
    list_sales_runs,
    delete_catalog_item,
    list_catalog_items,
    upsert_catalog_item,
    create_ops_capture,
    list_ops_captures,
    compute_economic_baseline,
    create_economic_scenario,
    list_economic_scenarios,
    compute_economic_trend,
)

router = APIRouter()
security = HTTPBearer(auto_error=False)


def require_catalog_write_permission(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> None:
    from app.core.config import settings
    from app.services.auth import get_access_context

    token = credentials.credentials if credentials else request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion requerida para editar catalogos")

    user, _ = get_access_context(token)
    if user.role not in {"admin", "data_steward"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para modificar catalogos")


@router.get("/catalogs", response_model=GrainCatalogsResponse)
def get_catalogs() -> GrainCatalogsResponse:
    return GrainCatalogsResponse(**get_or_seed_catalogs())


@router.get("/catalogs/{catalog_key}", response_model=list[CatalogItem])
def get_catalog_items(catalog_key: str) -> list[CatalogItem]:
    try:
        return [CatalogItem(**item) for item in list_catalog_items(catalog_key)]
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/catalogs/{catalog_key}/items", response_model=list[CatalogItem])
def save_catalog_item(
    catalog_key: str,
    payload: CatalogItemUpsertRequest,
    _: None = Depends(require_catalog_write_permission),
) -> list[CatalogItem]:
    try:
        items = upsert_catalog_item(catalog_key, payload.model_dump())
        return [CatalogItem(**item) for item in items]
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/catalogs/{catalog_key}/items/{item_id}", response_model=list[CatalogItem])
def remove_catalog_item(
    catalog_key: str,
    item_id: str,
    _: None = Depends(require_catalog_write_permission),
) -> list[CatalogItem]:
    try:
        items = delete_catalog_item(catalog_key, item_id)
        return [CatalogItem(**item) for item in items]
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/receptions", response_model=GrainReceptionResponse)
def register_reception(payload: GrainReceptionCreate) -> GrainReceptionResponse:
    record = create_reception(payload.model_dump())
    return GrainReceptionResponse(**record)


@router.get("/receptions", response_model=list[GrainReceptionResponse])
def get_receptions(limit: int = Query(default=40, ge=1, le=200)) -> list[GrainReceptionResponse]:
    return [GrainReceptionResponse(**item) for item in list_receptions(limit=limit)]


@router.post("/milling-runs", response_model=MillingRunResponse)
def register_milling_run(payload: MillingRunCreate) -> MillingRunResponse:
    try:
        record = create_milling_run(payload.model_dump())
        return MillingRunResponse(**record)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/milling-runs", response_model=list[MillingRunResponse])
def get_milling_runs(limit: int = Query(default=40, ge=1, le=200)) -> list[MillingRunResponse]:
    return [MillingRunResponse(**item) for item in list_milling_runs(limit=limit)]


@router.post("/packaging-runs", response_model=PackagingRunResponse)
def register_packaging_run(payload: PackagingRunCreate) -> PackagingRunResponse:
    try:
        record = create_packaging_run(payload.model_dump())
        return PackagingRunResponse(**record)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/packaging-runs", response_model=list[PackagingRunResponse])
def get_packaging_runs(limit: int = Query(default=40, ge=1, le=200)) -> list[PackagingRunResponse]:
    return [PackagingRunResponse(**item) for item in list_packaging_runs(limit=limit)]


@router.post("/sales", response_model=SaleResponse)
def register_sale(payload: SaleCreate) -> SaleResponse:
    try:
        record = create_sale(payload.model_dump())
        return SaleResponse(**record)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/sales", response_model=list[SaleResponse])
def get_sales(limit: int = Query(default=40, ge=1, le=200)) -> list[SaleResponse]:
    return [SaleResponse(**item) for item in list_sales_runs(limit=limit)]


@router.get("/kpis-causal", response_model=CausalKPIsResponse)
def get_causal_kpis(window_days: int = Query(default=90, ge=0, le=365)) -> CausalKPIsResponse:
    return CausalKPIsResponse(**compute_causal_kpis(window_days=window_days or None))


@router.post("/capturas")
def create_capture(payload: LegacyCaptureCreate) -> dict[str, str]:
    return create_legacy_capture(payload.model_dump())


@router.post("/ops-captures", response_model=OpsCaptureResponse)
def register_ops_capture(payload: OpsCaptureCreate) -> OpsCaptureResponse:
    record = create_ops_capture(payload.model_dump())
    return OpsCaptureResponse(**record)


@router.get("/ops-captures", response_model=list[OpsCaptureResponse])
def get_ops_captures(
    module_key: str | None = Query(default=None),
    limit: int = Query(default=120, ge=1, le=500),
) -> list[OpsCaptureResponse]:
    return [OpsCaptureResponse(**item) for item in list_ops_captures(module_key=module_key, limit=limit)]


@router.get("/economic-baseline", response_model=EconomicBaselineResponse)
def get_economic_baseline(window_days: int = Query(default=0, ge=0, le=365)) -> EconomicBaselineResponse:
    return EconomicBaselineResponse(**compute_economic_baseline(window_days=window_days or None))


@router.post("/economic-scenarios", response_model=EconomicScenarioResponse)
def save_economic_scenario(payload: EconomicScenarioCreate) -> EconomicScenarioResponse:
    return EconomicScenarioResponse(**create_economic_scenario(payload.model_dump()))


@router.get("/economic-scenarios", response_model=list[EconomicScenarioResponse])
def get_economic_scenarios(limit: int = Query(default=40, ge=1, le=200)) -> list[EconomicScenarioResponse]:
    return [EconomicScenarioResponse(**item) for item in list_economic_scenarios(limit=limit)]


@router.post("/economic-trend", response_model=EconomicTrendResponse)
def get_economic_trend(payload: dict[str, dict[str, float] | int]) -> EconomicTrendResponse:
    months = int(payload.get("months", 6)) if isinstance(payload.get("months", 6), int) else 6
    variables = payload.get("variables") if isinstance(payload.get("variables"), dict) else None
    window_days = int(payload.get("window_days", 0)) if isinstance(payload.get("window_days", 0), int) else 0
    months = max(3, min(24, months))
    return EconomicTrendResponse(**compute_economic_trend(months=months, scenario_variables=variables, baseline_window_days=window_days or None))
