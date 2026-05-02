"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteCatalogItem,
  getGrainCatalogs,
  saveCatalogItem,
  type CatalogItem,
  type GrainCatalogKey,
  type GrainCatalogs,
} from "@/lib/api";
import { CATALOGS_UPDATED_EVENT, CATALOGS_UPDATED_TS_KEY } from "@/lib/catalog-events";
import { fallbackGrainCatalogs } from "@/lib/grain-catalogs";
import { useAuth } from "@/components/AuthProvider";

type CatalogDomain = "materias-primas" | "produccion" | "logistica" | "comercial";

type CatalogCard = {
  key: GrainCatalogKey;
  label: string;
  description: string;
  domain: CatalogDomain;
};

const catalogCards: CatalogCard[] = [
  { key: "grain_varieties", label: "Variedades de trigo", description: "Materias primas por variedad para recepcion y mezcla.", domain: "materias-primas" },
  { key: "farmers", label: "Agricultores", description: "Proveedores de trigo y trazabilidad de origen.", domain: "materias-primas" },
  { key: "grain_warehouses", label: "Bodegas de granos", description: "Ubicaciones de almacenamiento para recepcion de trigo.", domain: "materias-primas" },
  { key: "flour_types", label: "Tipos de harina", description: "Clasificacion comercial y tecnica para molienda y calidad.", domain: "produccion" },
  { key: "flour_lines", label: "Lineas de produccion", description: "Lineas y equipos de proceso para programacion operativa.", domain: "produccion" },
  { key: "packed_products", label: "Productos empacados", description: "Presentaciones comerciales para empaque y ventas.", domain: "produccion" },
  { key: "packaging_units", label: "Unidades de empaque", description: "Unidades maestras para conversion de empaque.", domain: "produccion" },
  { key: "flour_warehouses", label: "Almacenes de harina", description: "Ubicaciones logisticas para producto terminado.", domain: "logistica" },
  { key: "sites", label: "Sedes", description: "Sucursales y plazas para gestion regional.", domain: "logistica" },
  { key: "customers", label: "Clientes", description: "Base de clientes para ventas y trazabilidad de lotes.", domain: "comercial" },
  { key: "customer_types", label: "Tipos de cliente", description: "Segmentacion por canal industrial, retail o foodservice.", domain: "comercial" },
];

const domainLabelMap: Record<CatalogDomain, string> = {
  "materias-primas": "Materias Primas",
  produccion: "Produccion y Empaque",
  logistica: "Logistica",
  comercial: "Comercial",
};

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function publishCatalogUpdate() {
  if (typeof window === "undefined") return;
  const now = Date.now().toString();
  window.localStorage.setItem(CATALOGS_UPDATED_TS_KEY, now);
  window.dispatchEvent(new CustomEvent(CATALOGS_UPDATED_EVENT, { detail: now }));
}

export function CatalogsManager() {
  const { user } = useAuth();
  const [catalogs, setCatalogs] = useState<GrainCatalogs>(fallbackGrainCatalogs as GrainCatalogs);
  const [openKey, setOpenKey] = useState<GrainCatalogKey | null>(null);
  const [itemLabel, setItemLabel] = useState("");
  const [itemId, setItemId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [activeDomain, setActiveDomain] = useState<CatalogDomain | "todos">("todos");

  const canWriteCatalogs = user?.role === "admin" || user?.role === "data_steward";

  const activeItems = useMemo(() => {
    if (!openKey) return [];
    return catalogs[openKey] ?? [];
  }, [catalogs, openKey]);

  const activeCard = useMemo(() => catalogCards.find((item) => item.key === openKey) ?? null, [openKey]);

  const visibleCards = useMemo(() => {
    if (activeDomain === "todos") return catalogCards;
    return catalogCards.filter((card) => card.domain === activeDomain);
  }, [activeDomain]);

  const refreshCatalogs = async () => {
    const data = await getGrainCatalogs();
    setCatalogs(data);
  };

  useEffect(() => {
    refreshCatalogs().catch(() => {
      setStatus("No se pudo cargar catalogos del backend. Se muestra base local.");
    });
  }, []);

  useEffect(() => {
    if (!itemLabel || editingId) {
      if (!itemLabel && !editingId) setItemId("");
      return;
    }
    setItemId(toSlug(itemLabel));
  }, [editingId, itemLabel]);

  const resetForm = () => {
    setItemLabel("");
    setItemId("");
    setEditingId(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!openKey) return;
    setIsSaving(true);
    setStatus(null);

    try {
      const updated = await saveCatalogItem(openKey, { id: itemId, label: itemLabel });
      setCatalogs((previous) => ({ ...previous, [openKey]: updated }));
      setStatus(editingId ? "Item actualizado en catalogo." : "Item agregado en catalogo.");
      resetForm();
      publishCatalogUpdate();
    } catch {
      setStatus("No fue posible guardar el item de catalogo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: CatalogItem) => {
    if (!openKey) return;
    setIsDeletingId(item.id);
    setStatus(null);

    try {
      const updated = await deleteCatalogItem(openKey, item.id);
      setCatalogs((previous) => ({ ...previous, [openKey]: updated }));
      setStatus(`Item ${item.label} eliminado del catalogo.`);
      if (editingId === item.id) {
        resetForm();
      }
      publishCatalogUpdate();
    } catch {
      setStatus("No fue posible eliminar el item del catalogo.");
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <article className="panel p-5 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Catalogos Maestros</h3>
        <p className="ops-copy mt-2 text-sm text-slate-600">
          Administra materiales, productos, clientes y parametros maestros para poblar combobox en formularios de todas las areas.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Permiso de escritura: {canWriteCatalogs ? "habilitado" : "solo lectura"} (rol actual: {user?.role ?? "operator"}).
        </p>
        {status ? <p className="mt-3 text-sm font-medium text-emerald-700">{status}</p> : null}
      </article>

      <article className="panel p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveDomain("todos")}
            className={`capture-tab ${activeDomain === "todos" ? "capture-tab-active" : "capture-tab-inactive"}`}
          >
            Todos
          </button>
          {(Object.keys(domainLabelMap) as CatalogDomain[]).map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => setActiveDomain(domain)}
              className={`capture-tab ${activeDomain === domain ? "capture-tab-active" : "capture-tab-inactive"}`}
            >
              {domainLabelMap[domain]}
            </button>
          ))}
        </div>
      </article>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => {
          const total = catalogs[card.key]?.length ?? 0;
          return (
            <article key={card.key} className="panel p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">{domainLabelMap[card.domain]}</p>
              <h4 className="mt-2 font-display text-lg text-slate-800">{card.label}</h4>
              <p className="mt-2 text-sm text-slate-600">{card.description}</p>
              <p className="mt-3 text-sm font-semibold text-slate-700">Items: {total}</p>
              <button
                type="button"
                onClick={() => {
                  setOpenKey(card.key);
                  resetForm();
                }}
                className="btn-primary"
              >
                Abrir catalogo
              </button>
            </article>
          );
        })}
      </section>

      {openKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-xl text-slate-800">Catalogo: {activeCard?.label ?? openKey}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {canWriteCatalogs ? "Alta, edicion y eliminacion de elementos maestros." : "Solo lectura para este rol."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                className="module-btn-ghost px-4 py-1.5"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSave} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-600">Descripcion</span>
                <input
                  required
                  value={itemLabel}
                  onChange={(event) => setItemLabel(event.target.value)}
                  placeholder="Ej. Harina panificacion premium"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={!canWriteCatalogs}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">ID</span>
                <input
                  required
                  value={itemId}
                  onChange={(event) => setItemId(event.target.value)}
                  placeholder="harina-panificacion-premium"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={!canWriteCatalogs || !!editingId}
                />
              </label>
              <div className="md:col-span-3 flex justify-end gap-2">
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="module-btn-ghost px-4 py-2"
                  >
                    Cancelar edicion
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={isSaving || !canWriteCatalogs}
                  className="btn-primary"
                >
                  {isSaving ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar item"}
                </button>
              </div>
            </form>

            <div className="mt-4 tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Descripción</th>
                    <th className="tbl-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((item) => (
                    <tr key={item.id}>
                      <td className="tbl-mono">{item.id}</td>
                      <td>{item.label}</td>
                      <td className="tbl-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setItemId(item.id);
                              setItemLabel(item.label);
                            }}
                            disabled={!canWriteCatalogs}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={!canWriteCatalogs || isDeletingId === item.id}
                            className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                          >
                            {isDeletingId === item.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
