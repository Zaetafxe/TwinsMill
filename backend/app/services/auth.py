import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from pymongo.database import Database

from app.core.config import settings
from app.db.session import get_db
from app.schemas.auth import SessionUser


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return _b64url_encode(digest)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_company_name(company: str) -> str:
    return " ".join(company.strip().split())


def _normalize_company_key(company: str) -> str:
    normalized = _normalize_company_name(company).lower()
    normalized = re.sub(r"\s+", "-", normalized)
    normalized = re.sub(r"[^a-z0-9\-]", "", normalized)
    return normalized or "empresa"


def _iso_or_none(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _to_utc_datetime(value).isoformat()


def _build_token(payload: dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    encoded_payload = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    signature = hmac.new(settings.auth_secret_key.encode(), signing_input, hashlib.sha256).digest()
    return f"{encoded_header}.{encoded_payload}.{_b64url_encode(signature)}"


def _verify_token_signature(token: str, expected_use: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    encoded_header, encoded_payload, encoded_signature = parts
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    expected_signature = hmac.new(settings.auth_secret_key.encode(), signing_input, hashlib.sha256).digest()

    if not hmac.compare_digest(_b64url_encode(expected_signature), encoded_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firma de token invalida")

    try:
        payload = json.loads(_b64url_decode(encoded_payload).decode())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Payload de token invalido") from exc

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    if payload.get("iss") != settings.auth_issuer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Issuer invalido")

    if payload.get("aud") != settings.auth_audience:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Audience invalida")

    if payload.get("use") != expected_use:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tipo de token invalido")

    if not payload.get("jti") or not payload.get("sid"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identificador de token invalido")

    return payload


def _users_collection(db: Database):
    collection = db["users"]
    collection.create_index("email", unique=True)
    collection.create_index("tenant_id")
    return collection


def _companies_collection(db: Database):
    collection = db["companies"]
    collection.create_index("tenant_id", unique=True)
    collection.create_index("normalized_name", unique=True)
    collection.create_index("created_at")
    return collection


def _refresh_tokens_collection(db: Database):
    collection = db["refresh_tokens"]
    collection.create_index("token_hash", unique=True)
    collection.create_index("email")
    collection.create_index("family_id")
    collection.create_index("expires_at", expireAfterSeconds=0)
    return collection


def _company_access_state(company_doc: dict[str, Any] | None) -> tuple[str, str, datetime | None]:
    if not company_doc:
        return "pending", "inactive", None

    company_status = str(company_doc.get("status", "pending"))
    license_doc = company_doc.get("license") if isinstance(company_doc.get("license"), dict) else {}
    license_status = str(license_doc.get("status", "inactive"))
    ends_at_raw = license_doc.get("ends_at")
    ends_at = ends_at_raw if isinstance(ends_at_raw, datetime) else None

    if ends_at and _to_utc_datetime(ends_at) <= _now_utc():
        return company_status, "expired", ends_at

    return company_status, license_status, ends_at


def _license_metrics(company_doc: dict[str, Any]) -> tuple[datetime | None, datetime | None, int, int, int]:
    license_doc = company_doc.get("license") if isinstance(company_doc.get("license"), dict) else {}
    starts_at_raw = license_doc.get("starts_at")
    ends_at_raw = license_doc.get("ends_at")
    starts_at = _to_utc_datetime(starts_at_raw) if isinstance(starts_at_raw, datetime) else None
    ends_at = _to_utc_datetime(ends_at_raw) if isinstance(ends_at_raw, datetime) else None

    stored_duration = int(license_doc.get("duration_days", 0) or 0)
    if starts_at and ends_at:
        measured_duration = max(0, int((ends_at - starts_at).total_seconds() // 86400))
    else:
        measured_duration = 0
    duration_days = stored_duration if stored_duration > 0 else measured_duration

    if not starts_at or duration_days <= 0:
        return starts_at, ends_at, 0, 0, 0

    now = _now_utc()
    elapsed_days = max(0, int((now - starts_at).total_seconds() // 86400))
    consumed = min(duration_days, elapsed_days)
    remaining = max(0, duration_days - consumed)
    return starts_at, ends_at, duration_days, consumed, remaining


def _to_session_user(user_doc: dict[str, Any], company_doc: dict[str, Any] | None) -> SessionUser:
    company_status, license_status, license_ends_at = _company_access_state(company_doc)
    return SessionUser(
        full_name=str(user_doc.get("full_name", "")),
        email=str(user_doc.get("email", "")),
        company=str(user_doc.get("company", "")),
        role=str(user_doc.get("role", "operator")),
        tenant_id=str(user_doc.get("tenant_id", "")),
        company_status=company_status,
        license_status=license_status,
        license_ends_at=_iso_or_none(license_ends_at),
    )


def _get_or_create_company(db: Database, company_name: str, *, activate_immediately: bool = False) -> dict[str, Any]:
    normalized_name = _normalize_company_name(company_name)
    company_key = _normalize_company_key(normalized_name)
    existing = _companies_collection(db).find_one({"normalized_name": company_key})
    if existing:
        return existing

    now = _now_utc()
    ends_at = now + timedelta(days=3650) if activate_immediately else None
    company_doc = {
        "tenant_id": str(uuid4()),
        "name": normalized_name,
        "normalized_name": company_key,
        "status": "active" if activate_immediately else "pending",
        "is_active": bool(activate_immediately),
        "created_at": now,
        "approved_at": now if activate_immediately else None,
        "license": {
            "status": "active" if activate_immediately else "inactive",
            "starts_at": now if activate_immediately else None,
            "ends_at": ends_at,
            "duration_days": 3650 if activate_immediately else 0,
            "assigned_by": "system",
        },
    }
    _companies_collection(db).insert_one(company_doc)
    return company_doc


def _user_from_payload(payload: dict[str, Any]) -> SessionUser:
    return SessionUser(
        full_name=str(payload.get("name", "")),
        email=str(payload.get("sub", "")),
        company=str(payload.get("company", "")),
        role=str(payload.get("role", "admin")),
        tenant_id=str(payload.get("tenant_id", "")),
        company_status=str(payload.get("company_status", "pending")),
        license_status=str(payload.get("license_status", "inactive")),
        license_ends_at=str(payload.get("license_ends_at")) if payload.get("license_ends_at") else None,
    )


def create_access_token(user: SessionUser, session_id: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user.email,
        "name": user.full_name,
        "company": user.company,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "company_status": user.company_status,
        "license_status": user.license_status,
        "license_ends_at": user.license_ends_at,
        "iss": settings.auth_issuer,
        "aud": settings.auth_audience,
        "jti": secrets.token_urlsafe(12),
        "sid": session_id,
        "use": "access",
        "iat": now,
        "exp": now + settings.auth_access_token_exp_minutes * 60,
    }
    return _build_token(payload)


def _create_refresh_token(user: SessionUser, session_id: str, family_id: str) -> tuple[str, datetime]:
    now = int(time.time())
    exp_dt = _now_utc() + timedelta(days=settings.auth_refresh_token_exp_days)
    payload = {
        "sub": user.email,
        "name": user.full_name,
        "company": user.company,
        "role": user.role,
        "iss": settings.auth_issuer,
        "aud": settings.auth_audience,
        "jti": secrets.token_urlsafe(12),
        "sid": session_id,
        "fid": family_id,
        "use": "refresh",
        "iat": now,
        "exp": int(exp_dt.timestamp()),
    }
    return _build_token(payload), exp_dt


def _persist_refresh_token(email: str, refresh_token: str, session_id: str, family_id: str, expires_at: datetime, rotated_from: str | None = None) -> None:
    db = get_db()
    _refresh_tokens_collection(db).insert_one(
        {
            "email": email,
            "session_id": session_id,
            "family_id": family_id,
            "token_hash": _hash_token(refresh_token),
            "rotated_from": rotated_from,
            "created_at": _now_utc(),
            "last_used_at": None,
            "revoked_at": None,
            "expires_at": expires_at,
        }
    )


def issue_session_tokens(user: SessionUser, session_id: str | None = None, family_id: str | None = None) -> tuple[str, str]:
    sid = session_id or secrets.token_urlsafe(12)
    fid = family_id or secrets.token_urlsafe(12)
    access_token = create_access_token(user, sid)
    refresh_token, refresh_exp = _create_refresh_token(user, sid, fid)
    _persist_refresh_token(email=user.email, refresh_token=refresh_token, session_id=sid, family_id=fid, expires_at=refresh_exp)
    return access_token, refresh_token


def _revoke_refresh_family(db: Database, family_id: str) -> None:
    _refresh_tokens_collection(db).update_many(
        {"family_id": family_id, "revoked_at": None},
        {"$set": {"revoked_at": _now_utc()}},
    )


def rotate_refresh_token(refresh_token: str) -> tuple[SessionUser, str, str]:
    payload = _verify_token_signature(refresh_token, expected_use="refresh")
    token_hash = _hash_token(refresh_token)
    db = get_db()

    refresh_doc = _refresh_tokens_collection(db).find_one({"token_hash": token_hash})
    if not refresh_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token no reconocido")

    family_id = str(refresh_doc.get("family_id", ""))
    if refresh_doc.get("revoked_at") is not None:
        if family_id:
            _revoke_refresh_family(db, family_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reutilizado")

    expires_at = refresh_doc.get("expires_at")
    if isinstance(expires_at, datetime) and _to_utc_datetime(expires_at) < _now_utc():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expirado")

    user_doc = _users_collection(db).find_one({"email": payload.get("sub")})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    company_doc = _resolve_company_for_user(db, user_doc)
    _assert_license_access(user_doc, company_doc)
    user = _to_session_user(user_doc, company_doc)

    _refresh_tokens_collection(db).update_one(
        {"token_hash": token_hash},
        {"$set": {"revoked_at": _now_utc(), "last_used_at": _now_utc()}},
    )

    access_token, new_refresh_token = issue_session_tokens(
        user=user,
        session_id=str(payload.get("sid")),
        family_id=str(payload.get("fid")),
    )

    _refresh_tokens_collection(db).update_one(
        {"token_hash": _hash_token(new_refresh_token)},
        {"$set": {"rotated_from": token_hash}},
    )

    return user, access_token, new_refresh_token


def revoke_session_by_refresh_token(refresh_token: str | None) -> None:
    if not refresh_token:
        return

    db = get_db()
    token_hash = _hash_token(refresh_token)
    refresh_doc = _refresh_tokens_collection(db).find_one({"token_hash": token_hash})
    if not refresh_doc:
        return

    family_id = str(refresh_doc.get("family_id", ""))
    if family_id:
        _revoke_refresh_family(db, family_id)


def _resolve_company_for_user(db: Database, user_doc: dict[str, Any]) -> dict[str, Any] | None:
    tenant_id = str(user_doc.get("tenant_id", "")).strip()
    if tenant_id:
        return _companies_collection(db).find_one({"tenant_id": tenant_id})

    company_name = str(user_doc.get("company", "")).strip()
    if not company_name:
        return None

    # Backward compatibility for legacy users created before tenant support.
    company_doc = _get_or_create_company(db, company_name, activate_immediately=True)
    _users_collection(db).update_one(
        {"email": user_doc.get("email")},
        {"$set": {"tenant_id": company_doc["tenant_id"], "updated_at": _now_utc()}},
    )
    user_doc["tenant_id"] = company_doc["tenant_id"]
    return company_doc


def _assert_license_access(user_doc: dict[str, Any], company_doc: dict[str, Any] | None) -> None:
    role = str(user_doc.get("role", "operator"))
    if role == "platform_admin":
        return

    if not company_doc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Empresa pendiente de configuracion")

    company_status, license_status, _ = _company_access_state(company_doc)
    if company_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu empresa aun no ha sido activada por el administrador de la plataforma.",
        )

    if license_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La licencia de tu empresa esta inactiva o vencida. Contacta al administrador.",
        )


def register_user(full_name: str, email: str, company: str, password: str) -> SessionUser:
    db = get_db()
    normalized_email = _normalize_email(email)

    existing = _users_collection(db).find_one({"email": normalized_email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya esta registrado")

    salt = secrets.token_urlsafe(16)
    password_hash = _hash_password(password, salt)

    company_doc = _get_or_create_company(db, company)
    has_users_in_company = _users_collection(db).count_documents({"tenant_id": company_doc["tenant_id"]}) > 0
    is_platform_admin = normalized_email == _normalize_email(settings.platform_admin_email)
    user_role = "platform_admin" if is_platform_admin else ("operator" if has_users_in_company else "tenant_admin")

    now = _now_utc()
    _users_collection(db).insert_one(
        {
            "full_name": full_name.strip(),
            "email": normalized_email,
            "company": company_doc["name"],
            "tenant_id": company_doc["tenant_id"],
            "password_hash": password_hash,
            "salt": salt,
            "failed_login_attempts": 0,
            "lockout_until": None,
            "created_at": now,
            "updated_at": now,
            "role": user_role,
        }
    )

    user_doc = _users_collection(db).find_one({"email": normalized_email})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No fue posible crear el usuario")
    return _to_session_user(user_doc, company_doc)


def login_user(email: str, password: str) -> SessionUser:
    db = get_db()
    normalized_email = _normalize_email(email)
    user_doc = _users_collection(db).find_one({"email": normalized_email})

    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invalidas")

    lockout_until = user_doc.get("lockout_until")
    now = _now_utc()
    if isinstance(lockout_until, datetime) and _to_utc_datetime(lockout_until) > now:
        minutes_remaining = max(1, int((_to_utc_datetime(lockout_until) - now).total_seconds() // 60))
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cuenta bloqueada temporalmente. Intenta de nuevo en {minutes_remaining} minuto(s).",
        )

    expected_hash = str(user_doc.get("password_hash", ""))
    salt = str(user_doc.get("salt", ""))
    candidate_hash = _hash_password(password, salt)

    if not hmac.compare_digest(expected_hash, candidate_hash):
        failed_attempts = int(user_doc.get("failed_login_attempts", 0)) + 1

        update_doc: dict[str, Any] = {
            "failed_login_attempts": failed_attempts,
            "updated_at": now,
        }

        if failed_attempts >= settings.auth_lockout_max_attempts:
            update_doc["lockout_until"] = now + timedelta(minutes=settings.auth_lockout_minutes)
            update_doc["failed_login_attempts"] = 0

        _users_collection(db).update_one({"email": normalized_email}, {"$set": update_doc})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invalidas")

    company_doc = _resolve_company_for_user(db, user_doc)
    _assert_license_access(user_doc, company_doc)

    _users_collection(db).update_one(
        {"email": normalized_email},
        {
            "$set": {
                "failed_login_attempts": 0,
                "lockout_until": None,
                "last_login_at": now,
                "updated_at": now,
            }
        },
    )

    refreshed_user_doc = _users_collection(db).find_one({"email": normalized_email})
    if not refreshed_user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invalidas")

    return _to_session_user(refreshed_user_doc, company_doc)


def create_company_user(
    actor: SessionUser,
    full_name: str,
    email: str,
    password: str,
    role: str = "operator",
    tenant_id: str | None = None,
) -> SessionUser:
    if actor.role not in {"tenant_admin", "platform_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para crear usuarios")

    db = get_db()
    normalized_email = _normalize_email(email)
    existing = _users_collection(db).find_one({"email": normalized_email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya esta registrado")

    allowed_roles = {"operator", "tenant_admin"}
    requested_role = role.strip().lower()
    user_role = requested_role if requested_role in allowed_roles else "operator"
    if actor.role == "tenant_admin" and user_role == "platform_admin":
        user_role = "operator"

    resolved_tenant_id = actor.tenant_id
    if actor.role == "platform_admin":
        resolved_tenant_id = (tenant_id or actor.tenant_id).strip()
        if not resolved_tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes seleccionar una empresa para crear usuarios")
    elif not resolved_tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario sin empresa asignada")

    company_doc = _companies_collection(db).find_one({"tenant_id": resolved_tenant_id})
    if not company_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    salt = secrets.token_urlsafe(16)
    password_hash = _hash_password(password, salt)
    now = _now_utc()

    _users_collection(db).insert_one(
        {
            "full_name": full_name.strip(),
            "email": normalized_email,
            "company": company_doc.get("name", ""),
            "tenant_id": resolved_tenant_id,
            "password_hash": password_hash,
            "salt": salt,
            "failed_login_attempts": 0,
            "lockout_until": None,
            "created_at": now,
            "updated_at": now,
            "role": user_role,
            "created_by": actor.email,
        }
    )

    user_doc = _users_collection(db).find_one({"email": normalized_email})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No fue posible crear el usuario")

    return _to_session_user(user_doc, company_doc)


def list_companies(status_filter: str = "all") -> list[dict[str, Any]]:
    db = get_db()
    query: dict[str, Any] = {}
    normalized_filter = status_filter.strip().lower()
    if normalized_filter in {"pending", "active", "suspended"}:
        query["status"] = normalized_filter

    companies = list(_companies_collection(db).find(query).sort("created_at", -1))
    output: list[dict[str, Any]] = []
    for company in companies:
        tenant_id = str(company.get("tenant_id", ""))
        users_count = _users_collection(db).count_documents({"tenant_id": tenant_id})
        company_status, license_status, license_ends_at = _company_access_state(company)
        starts_at, ends_at, duration_days, days_consumed, days_remaining = _license_metrics(company)
        output.append(
            {
                "tenant_id": tenant_id,
                "name": str(company.get("name", "")),
                "status": company_status,
                "license_status": license_status,
                "license_starts_at": _iso_or_none(starts_at),
                "license_ends_at": _iso_or_none(ends_at if ends_at else license_ends_at),
                "license_duration_days": duration_days,
                "license_days_consumed": days_consumed,
                "license_days_remaining": days_remaining,
                "created_at": _iso_or_none(company.get("created_at") if isinstance(company.get("created_at"), datetime) else None),
                "users_count": users_count,
            }
        )

    return output


def assign_company_license(tenant_id: str, duration_days: int, assigned_by: str) -> dict[str, Any]:
    db = get_db()
    company = _companies_collection(db).find_one({"tenant_id": tenant_id})
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    days = max(1, int(duration_days))
    now = _now_utc()
    ends_at = now + timedelta(days=days)
    _companies_collection(db).update_one(
        {"tenant_id": tenant_id},
        {
            "$set": {
                "status": "active",
                "is_active": True,
                "approved_at": now,
                "updated_at": now,
                "license": {
                    "status": "active",
                    "starts_at": now,
                    "ends_at": ends_at,
                    "duration_days": days,
                    "assigned_by": assigned_by,
                },
            }
        },
    )

    updated = _companies_collection(db).find_one({"tenant_id": tenant_id})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    company_status, license_status, license_ends_at = _company_access_state(updated)
    starts_at, ends_at, _, _, _ = _license_metrics(updated)
    return {
        "tenant_id": tenant_id,
        "name": str(updated.get("name", "")),
        "status": company_status,
        "license_status": license_status,
        "license_starts_at": _iso_or_none(starts_at),
        "license_ends_at": _iso_or_none(ends_at if ends_at else license_ends_at),
        "duration_days": days,
    }


def list_company_users(tenant_id: str) -> list[dict[str, Any]]:
    db = get_db()
    company = _companies_collection(db).find_one({"tenant_id": tenant_id})
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    cursor = _users_collection(db).find(
        {"tenant_id": tenant_id},
        {"_id": 0, "full_name": 1, "email": 1, "role": 1, "last_login_at": 1},
    ).sort("full_name", 1)

    return [
        {
            "full_name": str(item.get("full_name", "")),
            "email": str(item.get("email", "")),
            "role": str(item.get("role", "operator")),
            "last_login_at": _iso_or_none(item.get("last_login_at") if isinstance(item.get("last_login_at"), datetime) else None),
        }
        for item in cursor
    ]


def reset_company_user_password(tenant_id: str, email: str, new_password: str, changed_by: str) -> dict[str, str]:
    db = get_db()
    company = _companies_collection(db).find_one({"tenant_id": tenant_id})
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    normalized_email = _normalize_email(email)
    user = _users_collection(db).find_one({"tenant_id": tenant_id, "email": normalized_email})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado en esta empresa")

    salt = secrets.token_urlsafe(16)
    password_hash = _hash_password(new_password, salt)
    _users_collection(db).update_one(
        {"tenant_id": tenant_id, "email": normalized_email},
        {
            "$set": {
                "password_hash": password_hash,
                "salt": salt,
                "updated_at": _now_utc(),
                "lockout_until": None,
                "failed_login_attempts": 0,
                "password_changed_by": changed_by,
            }
        },
    )

    return {"email": normalized_email, "status": "updated"}


def get_access_context(token: str) -> tuple[SessionUser, dict[str, Any]]:
    payload = _verify_token_signature(token, expected_use="access")
    return _user_from_payload(payload), payload


def get_user_from_token(token: str) -> SessionUser:
    user, _ = get_access_context(token)
    return user


def get_session_user_by_email(email: str, *, enforce_access: bool = True) -> SessionUser:
    db = get_db()
    user_doc = _users_collection(db).find_one({"email": _normalize_email(email)})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    company_doc = _resolve_company_for_user(db, user_doc)
    if enforce_access:
        _assert_license_access(user_doc, company_doc)

    return _to_session_user(user_doc, company_doc)
