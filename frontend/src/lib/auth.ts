export type SessionUser = {
  fullName: string;
  email: string;
  company: string;
  role: string;
  tenantId: string;
  companyStatus: string;
  licenseStatus: string;
  licenseEndsAt: string | null;
};

type AuthApiUser = {
  full_name: string;
  email: string;
  company: string;
  role: string;
  tenant_id: string;
  company_status: string;
  license_status: string;
  license_ends_at: string | null;
};

export type CompanySummary = {
  tenant_id: string;
  name: string;
  status: string;
  license_status: string;
  license_starts_at: string | null;
  license_ends_at: string | null;
  license_duration_days: number;
  license_days_consumed: number;
  license_days_remaining: number;
  created_at: string | null;
  users_count: number;
};

export type CompanyUserSummary = {
  full_name: string;
  email: string;
  role: string;
  last_login_at: string | null;
};

export type CompanyUserCreatePayload = {
  tenantId: string;
  fullName: string;
  email: string;
  password: string;
  role: "operator" | "tenant_admin";
};

export type LicenseAssignPayload = {
  durationUnit: "days" | "months" | "annual";
  durationValue: number;
};

type AuthApiResponse = {
  access_token: string;
  token_type: string;
  user: AuthApiUser;
};

function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";
  const isLoopbackHost = (hostname: string): boolean => hostname === "localhost" || hostname === "127.0.0.1";

  if (typeof window === "undefined") {
    return configured.startsWith("/") ? `http://localhost:8000${configured}` : configured;
  }

  if (/^https?:\/\//i.test(configured)) {
    return configured;
  }

  if (
    isLoopbackHost(window.location.hostname) &&
    configured.startsWith("/") &&
    (window.location.port === "3000" || window.location.port === "3010")
  ) {
    return `http://${window.location.hostname}:8000${configured}`;
  }

  return `${window.location.origin}${configured}`;
}


const API_BASE = resolveApiBase().replace(/\/$/, "");
const SESSION_KEY = "twinsmill_session";
const AUTH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = AUTH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    // Suprimir errores de red/timeout para no mostrarlos en overlay de Next.js
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
      throw new Error('NETWORK_ERROR');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
  } catch (error) {
    // Si es error de red conocido, ser más específico
    if (error instanceof Error && error.message === 'NETWORK_ERROR') {
      throw new Error("No se pudo conectar con el servidor. Verifica que el backend este corriendo en http://localhost:8000");
    }
    // Para otros errores, relanzar tal cual
    throw error;
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ?? "";
    } catch {
      detail = "";
    }

    const fallback = detail || (response.status === 409 ? "El correo ya esta registrado" : "Fallo la solicitud de autenticacion");
    throw new Error(fallback);
  }

  return (await response.json()) as T;
}

function toSessionUser(data: AuthApiResponse): SessionUser {
  return {
    fullName: data.user.full_name,
    email: data.user.email,
    company: data.user.company,
    role: data.user.role,
    tenantId: data.user.tenant_id,
    companyStatus: data.user.company_status,
    licenseStatus: data.user.license_status,
    licenseEndsAt: data.user.license_ends_at,
  };
}


async function fetchJSONWithSession<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? "";
    } catch {
      detail = "";
    }

    throw new Error(detail || "No se pudo completar la solicitud");
  }

  return (await response.json()) as T;
}

export async function registerUser(payload: {
  fullName: string;
  email: string;
  company: string;
  password: string;
}): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  try {
    const response = await postJSON<AuthApiResponse>("/auth/register", {
      full_name: payload.fullName,
      email: payload.email,
      company: payload.company,
      password: payload.password,
    });

    const sessionUser = toSessionUser(response);
    setSessionUser(sessionUser);
    return { ok: true, user: sessionUser };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo registrar la cuenta" };
  }
}

export async function loginUser(email: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  try {
    const response = await postJSON<AuthApiResponse>("/auth/login", { email, password });
    const sessionUser = toSessionUser(response);
    setSessionUser(sessionUser);
    return { ok: true, user: sessionUser };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Correo o contrasena invalidos" };
  }
}

export function setSessionUser(user: SessionUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSessionUser() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function validateSession(): Promise<SessionUser | null> {
  try {
    let response = await fetchWithTimeout(`${API_BASE}/auth/me`, {
      credentials: "include",
    });

    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        clearSessionUser();
        return null;
      }

      response = await fetchWithTimeout(`${API_BASE}/auth/me`, {
        credentials: "include",
      });
    }

    if (!response.ok) {
      clearSessionUser();
      return null;
    }

    const data = (await response.json()) as { user: AuthApiUser | null };
    if (!data.user) {
      clearSessionUser();
      return null;
    }

    return {
      fullName: data.user.full_name,
      email: data.user.email,
      company: data.user.company,
      role: data.user.role,
      tenantId: data.user.tenant_id,
      companyStatus: data.user.company_status,
      licenseStatus: data.user.license_status,
      licenseEndsAt: data.user.license_ends_at,
    };
  } catch (error) {
    // Silenciar errores de red - retornar sesión de localStorage si existe
    if (error instanceof Error && error.message === 'NETWORK_ERROR') {
      return getSessionUser();
    }
    // Para otros errores, también intentar recuperar de localStorage
    return getSessionUser();
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetchWithTimeout(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearSessionUser();
  }
}

export async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as AuthApiResponse;
    setSessionUser(toSessionUser(data));
    return true;
  } catch {
    return false;
  }
}


export async function getAdminCompanies(status: "all" | "pending" | "active" | "suspended" = "all"): Promise<CompanySummary[]> {
  return fetchJSONWithSession<CompanySummary[]>(`/admin/companies?status=${encodeURIComponent(status)}`);
}


export async function assignCompanyLicense(tenantId: string, payload: LicenseAssignPayload): Promise<void> {
  await fetchJSONWithSession(`/admin/companies/${encodeURIComponent(tenantId)}/license`, {
    method: "POST",
    body: JSON.stringify({
      duration_unit: payload.durationUnit,
      duration_value: payload.durationValue,
    }),
  });
}


export async function getCompanyUsers(tenantId: string): Promise<CompanyUserSummary[]> {
  return fetchJSONWithSession<CompanyUserSummary[]>(`/admin/companies/${encodeURIComponent(tenantId)}/users`);
}


export async function resetCompanyUserPassword(tenantId: string, email: string, newPassword: string): Promise<void> {
  await fetchJSONWithSession(`/admin/companies/${encodeURIComponent(tenantId)}/users/reset-password`, {
    method: "POST",
    body: JSON.stringify({ email, new_password: newPassword }),
  });
}


export async function createCompanyUser(payload: CompanyUserCreatePayload): Promise<void> {
  await fetchJSONWithSession("/auth/company/users", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: payload.tenantId,
      full_name: payload.fullName,
      email: payload.email,
      password: payload.password,
      role: payload.role,
    }),
  });
}
