from typing import Literal

from pydantic import BaseModel, Field


class LicenseAssignRequest(BaseModel):
    duration_unit: Literal["days", "months", "annual"] = "days"
    duration_value: int = Field(default=30, ge=1, le=36)


class CompanySummaryResponse(BaseModel):
    tenant_id: str
    name: str
    status: str
    license_status: str
    license_starts_at: str | None = None
    license_ends_at: str | None = None
    license_duration_days: int = 0
    license_days_consumed: int = 0
    license_days_remaining: int = 0
    created_at: str | None = None
    users_count: int = 0


class LicenseAssignResponse(BaseModel):
    tenant_id: str
    name: str
    status: str
    license_status: str
    license_starts_at: str | None = None
    license_ends_at: str | None = None
    duration_days: int


class CompanyUserSummaryResponse(BaseModel):
    full_name: str
    email: str
    role: str
    last_login_at: str | None = None


class UserPasswordResetRequest(BaseModel):
    email: str = Field(min_length=5, max_length=160)
    new_password: str = Field(min_length=8, max_length=128)


class UserPasswordResetResponse(BaseModel):
    email: str
    status: str
