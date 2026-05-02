import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.schemas.auth import AuthResponse, CompanyUserCreateRequest, CompanyUserResponse, LoginRequest, RegisterRequest, SessionUser
from app.services.auth import (
    create_company_user,
    create_access_token,
    get_access_context,
    get_session_user_by_email,
    issue_session_tokens,
    login_user,
    register_user,
    revoke_session_by_refresh_token,
    rotate_refresh_token,
)

router = APIRouter()
security = HTTPBearer(auto_error=False)


def _resolve_authenticated_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    *,
    enforce_access: bool = True,
) -> SessionUser:
    token = credentials.credentials if credentials else request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion no disponible")

    user_from_token, _ = get_access_context(token)
    return get_session_user_by_email(user_from_token.email, enforce_access=enforce_access)


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.auth_access_token_exp_minutes * 60,
        path="/",
    )


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_refresh_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.auth_refresh_token_exp_days * 24 * 60 * 60,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key=settings.auth_cookie_name, path="/")
    response.delete_cookie(key=settings.auth_refresh_cookie_name, path="/")


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, response: Response) -> AuthResponse:
    user = register_user(
        full_name=payload.full_name,
        email=payload.email,
        company=payload.company,
        password=payload.password,
    )
    access_token, refresh_token = issue_session_tokens(user=user)
    _set_auth_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(access_token=access_token, user=user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response) -> AuthResponse:
    user = login_user(email=payload.email, password=payload.password)
    access_token, refresh_token = issue_session_tokens(user=user)
    _set_auth_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(access_token=access_token, user=user)


@router.post("/refresh", response_model=AuthResponse)
def refresh(request: Request, response: Response) -> AuthResponse:
    refresh_token = request.cookies.get(settings.auth_refresh_cookie_name)
    if not refresh_token:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion no disponible")

    user, access_token, new_refresh_token = rotate_refresh_token(refresh_token)
    _set_auth_cookie(response, access_token)
    _set_refresh_cookie(response, new_refresh_token)
    return AuthResponse(access_token=access_token, user=user)


@router.get("/me")
def me(request: Request, response: Response, credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    token = credentials.credentials if credentials else request.cookies.get(settings.auth_cookie_name)
    if not token:
        return {"user": None}

    user_from_token, payload = get_access_context(token)
    try:
        user = get_session_user_by_email(user_from_token.email, enforce_access=True)
    except HTTPException:
        _clear_auth_cookies(response)
        return {"user": None}

    exp = int(payload.get("exp", 0))
    now = int(time.time())
    remaining = exp - now
    if remaining <= settings.auth_access_token_sliding_minutes * 60:
        session_id = str(payload.get("sid"))
        new_access_token = create_access_token(user=user, session_id=session_id)
        _set_auth_cookie(response, new_access_token)

    return {"user": user.model_dump()}


@router.post("/company/users", response_model=CompanyUserResponse)
def register_company_user(
    payload: CompanyUserCreateRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CompanyUserResponse:
    actor = _resolve_authenticated_user(request, credentials, enforce_access=True)
    user = create_company_user(
        actor=actor,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
        role=payload.role,
        tenant_id=payload.tenant_id,
    )
    return CompanyUserResponse(
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        tenant_id=user.tenant_id,
    )


@router.post("/logout")
def logout(request: Request, response: Response) -> dict:
    revoke_session_by_refresh_token(request.cookies.get(settings.auth_refresh_cookie_name))
    _clear_auth_cookies(response)
    return {"status": "ok"}
