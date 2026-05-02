from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=160)
    company: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=160)
    password: str = Field(min_length=6, max_length=128)


class CompanyUserCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=160)
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="operator", min_length=3, max_length=40)
    tenant_id: str | None = None


class CompanyUserResponse(BaseModel):
    full_name: str
    email: str
    role: str
    tenant_id: str


class SessionUser(BaseModel):
    full_name: str
    email: str
    company: str
    role: str = "operator"
    tenant_id: str = ""
    company_status: str = "pending"
    license_status: str = "inactive"
    license_ends_at: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: SessionUser
