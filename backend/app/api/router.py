from fastapi import APIRouter, Depends

from app.api.dependencies import require_active_session, require_platform_user
from app.api.routes import admin, ai, analytics, auth, granos, kpis, simulation, twin

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["Platform Administration"])
api_router.include_router(twin.router, prefix="/twin", tags=["Digital Twin"], dependencies=[Depends(require_platform_user)])
api_router.include_router(analytics.router, prefix="/analytics", tags=["AI Analytics"], dependencies=[Depends(require_platform_user)])
api_router.include_router(simulation.router, prefix="/simulation", tags=["Simulation"], dependencies=[Depends(require_platform_user)])
api_router.include_router(kpis.router, prefix="/kpis", tags=["KPIs"], dependencies=[Depends(require_platform_user)])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Decision Engine"], dependencies=[Depends(require_platform_user)])
api_router.include_router(granos.router, prefix="/granos", tags=["Granos Process"], dependencies=[Depends(require_platform_user)])
