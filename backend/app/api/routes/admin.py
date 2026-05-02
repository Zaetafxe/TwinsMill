from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.schemas.admin import (
    CompanySummaryResponse,
    CompanyUserSummaryResponse,
    LicenseAssignRequest,
    LicenseAssignResponse,
    UserPasswordResetRequest,
    UserPasswordResetResponse,
)
from app.schemas.auth import SessionUser
from app.services.auth import (
    assign_company_license,
    get_access_context,
    list_companies,
    list_company_users,
    reset_company_user_password,
)

router = APIRouter()
security = HTTPBearer(auto_error=False)


def require_platform_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> SessionUser:
    token = credentials.credentials if credentials else request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion requerida")

    user, _ = get_access_context(token)
    if user.role != "platform_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos de administrador de plataforma")

    return user


@router.get("/companies", response_model=list[CompanySummaryResponse])
def get_companies(
    status_filter: str = Query(default="all", alias="status"),
    _: SessionUser = Depends(require_platform_admin),
) -> list[CompanySummaryResponse]:
    return [CompanySummaryResponse(**item) for item in list_companies(status_filter=status_filter)]


@router.post("/companies/{tenant_id}/license", response_model=LicenseAssignResponse)
def activate_company_license(
    tenant_id: str,
    payload: LicenseAssignRequest,
    admin_user: SessionUser = Depends(require_platform_admin),
) -> LicenseAssignResponse:
    if payload.duration_unit == "annual":
        duration_days = 365 * payload.duration_value
    elif payload.duration_unit == "months":
        duration_days = 30 * payload.duration_value
    else:
        duration_days = payload.duration_value

    result = assign_company_license(tenant_id=tenant_id, duration_days=duration_days, assigned_by=admin_user.email)
    return LicenseAssignResponse(**result)


@router.get("/companies/{tenant_id}/users", response_model=list[CompanyUserSummaryResponse])
def get_company_users(
    tenant_id: str,
    _: SessionUser = Depends(require_platform_admin),
) -> list[CompanyUserSummaryResponse]:
    return [CompanyUserSummaryResponse(**item) for item in list_company_users(tenant_id=tenant_id)]


@router.post("/companies/{tenant_id}/users/reset-password", response_model=UserPasswordResetResponse)
def reset_user_password(
    tenant_id: str,
    payload: UserPasswordResetRequest,
    admin_user: SessionUser = Depends(require_platform_admin),
) -> UserPasswordResetResponse:
    result = reset_company_user_password(
        tenant_id=tenant_id,
        email=payload.email,
        new_password=payload.new_password,
        changed_by=admin_user.email,
    )
    return UserPasswordResetResponse(**result)
