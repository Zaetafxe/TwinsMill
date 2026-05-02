from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.schemas.auth import SessionUser
from app.services.auth import get_access_context, get_session_user_by_email

security = HTTPBearer(auto_error=False)


def require_active_session(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> SessionUser:
    token = credentials.credentials if credentials else request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion requerida")

    user_from_token, _ = get_access_context(token)
    return get_session_user_by_email(user_from_token.email, enforce_access=True)


def require_platform_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> SessionUser:
    user = require_active_session(request=request, credentials=credentials)
    if user.role == "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El administrador de plataforma solo puede usar el modulo de gestion de empresas.",
        )
    return user
