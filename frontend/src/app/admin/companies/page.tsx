"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignCompanyLicense,
  createCompanyUser,
  type CompanySummary,
  type CompanyUserSummary,
  getAdminCompanies,
  getCompanyUsers,
  resetCompanyUserPassword,
} from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

type DurationUnit = "days" | "months" | "annual";

export default function AdminCompaniesPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "suspended">("pending");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [durationValue, setDurationValue] = useState(30);
  const [busyTenantId, setBusyTenantId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<CompanyUserSummary[]>([]);
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"operator" | "tenant_admin">("operator");
  const [creatingUser, setCreatingUser] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(() => user?.role === "platform_admin", [user?.role]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.push("/login");
      return;
    }

    if (!canManage) {
      router.push("/dashboard");
      return;
    }

    getAdminCompanies(statusFilter)
      .then((data) => {
        setCompanies(data);
        if (!selectedTenantId && data.length > 0) {
          setSelectedTenantId(data[0].tenant_id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la lista de empresas"));
  }, [authLoading, canManage, router, selectedTenantId, statusFilter, user]);

  useEffect(() => {
    if (!selectedTenantId) {
      setSelectedUsers([]);
      setSelectedUserEmail("");
      return;
    }

    getCompanyUsers(selectedTenantId)
      .then((users) => {
        setSelectedUsers(users);
        if (!selectedUserEmail && users.length > 0) {
          setSelectedUserEmail(users[0].email);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar los usuarios de la empresa"));
  }, [selectedTenantId, selectedUserEmail]);

  async function handleActivate(tenantId: string) {
    try {
      setError(null);
      setSuccess(null);
      setBusyTenantId(tenantId);
      await assignCompanyLicense(tenantId, { durationUnit, durationValue });
      const refreshed = await getAdminCompanies(statusFilter);
      setCompanies(refreshed);
      setSuccess("Licencia actualizada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar la licencia");
    } finally {
      setBusyTenantId(null);
    }
  }

  async function handleLogoutToLogin() {
    await logout();
    router.push("/login");
  }

  async function handleResetPassword() {
    if (!selectedTenantId || !selectedUserEmail || newPassword.length < 8) {
      setError("Selecciona usuario y define una clave de al menos 8 caracteres.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setUpdatingPassword(true);
      await resetCompanyUserPassword(selectedTenantId, selectedUserEmail, newPassword);
      setNewPassword("");
      setSuccess(`Contrasena actualizada para ${selectedUserEmail}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contrasena.");
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function handleCreateUser() {
    if (!selectedTenantId) {
      setError("Selecciona una empresa para dar de alta al usuario.");
      return;
    }
    if (!newUserFullName.trim() || !newUserEmail.trim() || newUserPassword.length < 8) {
      setError("Completa nombre, correo y contrasena (minimo 8 caracteres).");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setCreatingUser(true);
      await createCompanyUser({
        tenantId: selectedTenantId,
        fullName: newUserFullName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });

      const refreshedUsers = await getCompanyUsers(selectedTenantId);
      setSelectedUsers(refreshedUsers);
      setSelectedUserEmail(newUserEmail);
      setNewUserFullName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("operator");
      setSuccess("Usuario dado de alta correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setCreatingUser(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <section className="mx-auto max-w-6xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Administracion</p>
            <h1 className="text-2xl font-semibold text-slate-900">Gestion de empresas y licencias</h1>
            <p className="mt-2 text-sm text-slate-600">
              Este panel es exclusivo para alta, aprobacion y vigencia de empresas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogoutToLogin}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Cambiar cuenta
            </button>
            <button
              type="button"
              onClick={handleLogoutToLogin}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Cerrar sesion
            </button>
          </div>

          <label className="text-sm text-slate-700">
            Filtro
            <select
              className="ml-2 rounded-md border border-slate-300 px-2 py-1"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "pending" | "active" | "suspended")}
            >
              <option value="pending">Pendientes</option>
              <option value="active">Activas</option>
              <option value="suspended">Suspendidas</option>
              <option value="all">Todas</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border border-slate-200 bg-slate-50 p-4">
          <label className="text-sm text-slate-700">
            Unidad
            <select
              className="ml-2 rounded-md border border-slate-300 px-2 py-1"
              value={durationUnit}
              onChange={(event) => setDurationUnit(event.target.value as DurationUnit)}
            >
              <option value="days">Dias</option>
              <option value="months">Meses</option>
              <option value="annual">Anual</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Valor
            <input
              min={1}
              max={36}
              type="number"
              value={durationValue}
              onChange={(event) => setDurationValue(Number(event.target.value) || 1)}
              className="ml-2 w-24 rounded-md border border-slate-300 px-2 py-1"
            />
          </label>

          <p className="text-xs text-slate-600">La vigencia definida se aplica al presionar &quot;Activar licencia&quot;.</p>
        </div>

        {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

        <div className="mt-6 tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Estado</th>
                <th>Licencia</th>
                <th>Duración</th>
                <th>Consumido</th>
                <th>Restante</th>
                <th>Vence</th>
                <th>Usuarios</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const busy = busyTenantId === company.tenant_id;
                return (
                  <tr key={company.tenant_id}>
                    <td>{company.name}</td>
                    <td>{company.status}</td>
                    <td>{company.license_status}</td>
                    <td>{company.license_duration_days} día(s)</td>
                    <td>{company.license_days_consumed} día(s)</td>
                    <td>{company.license_days_remaining} día(s)</td>
                    <td>{company.license_ends_at ? new Date(company.license_ends_at).toLocaleDateString() : "—"}</td>
                    <td>{company.users_count}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy}
                          onClick={() => handleActivate(company.tenant_id)}
                          className="rounded-md bg-[#8d5b31] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busy ? "Aplicando..." : "Activar licencia"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTenantId(company.tenant_id);
                            setSelectedUserEmail("");
                            setNewPassword("");
                          }}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          Usuarios
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-base font-semibold text-slate-900">Gestion de usuarios y contrasenas</h2>
          <p className="mt-1 text-sm text-slate-600">Selecciona empresa, usuario y define una nueva contrasena.</p>

          <div className="mt-4 flex flex-wrap items-end gap-3 border border-slate-200 bg-white p-3">
            <label className="text-sm text-slate-700">
              Nombre nuevo usuario
              <input
                value={newUserFullName}
                onChange={(event) => setNewUserFullName(event.target.value)}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1"
                placeholder="Nombre completo"
              />
            </label>
            <label className="text-sm text-slate-700">
              Correo
              <input
                type="email"
                value={newUserEmail}
                onChange={(event) => setNewUserEmail(event.target.value)}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1"
                placeholder="usuario@empresa.com"
              />
            </label>
            <label className="text-sm text-slate-700">
              Contrasena
              <input
                type="password"
                minLength={8}
                value={newUserPassword}
                onChange={(event) => setNewUserPassword(event.target.value)}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1"
                placeholder="Minimo 8 caracteres"
              />
            </label>
            <label className="text-sm text-slate-700">
              Rol
              <select
                value={newUserRole}
                onChange={(event) => setNewUserRole(event.target.value as "operator" | "tenant_admin")}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1"
              >
                <option value="operator">Operador</option>
                <option value="tenant_admin">Administrador empresa</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={creatingUser}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {creatingUser ? "Creando..." : "Alta de usuario"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-700">
              Empresa
              <select
                className="ml-2 rounded-md border border-slate-300 px-2 py-1"
                value={selectedTenantId ?? ""}
                onChange={(event) => {
                  setSelectedTenantId(event.target.value || null);
                  setSelectedUserEmail("");
                  setNewPassword("");
                }}
              >
                <option value="">Seleccionar</option>
                {companies.map((company) => (
                  <option key={company.tenant_id} value={company.tenant_id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Usuario
              <select
                className="ml-2 rounded-md border border-slate-300 px-2 py-1"
                value={selectedUserEmail}
                onChange={(event) => setSelectedUserEmail(event.target.value)}
              >
                <option value="">Seleccionar</option>
                {selectedUsers.map((companyUser) => (
                  <option key={companyUser.email} value={companyUser.email}>
                    {companyUser.full_name} ({companyUser.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Nueva contrasena
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1"
                placeholder="Minimo 8 caracteres"
              />
            </label>

            <button
              type="button"
              onClick={handleResetPassword}
              disabled={updatingPassword}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {updatingPassword ? "Guardando..." : "Cambiar contrasena"}
            </button>
          </div>

          {selectedUsers.length > 0 ? (
            <div className="mt-4 tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Último acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUsers.map((companyUser) => (
                    <tr key={companyUser.email}>
                      <td>{companyUser.full_name}</td>
                      <td className="tbl-mono">{companyUser.email}</td>
                      <td>{companyUser.role}</td>
                      <td className="tbl-muted">{companyUser.last_login_at ? new Date(companyUser.last_login_at).toLocaleString() : "Sin acceso"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No hay usuarios disponibles para la empresa seleccionada.</p>
          )}
        </div>
      </section>
    </main>
  );
}
