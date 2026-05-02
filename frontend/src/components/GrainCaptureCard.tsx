"use client";

import { useEffect, useMemo, useState } from "react";
import { createGrainReception, getGrainCatalogs, getGrainReceptions, type GrainCatalogs, type GrainReception } from "@/lib/api";
import { CATALOGS_UPDATED_EVENT, CATALOGS_UPDATED_TS_KEY } from "@/lib/catalog-events";
import { fallbackGrainCatalogs } from "@/lib/grain-catalogs";

const FLOW_CONTEXT_KEY = "twinsmill_flow_context_v1";

function toDateValue(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getLabel(items: Array<{ id: string; label: string }>, id: string) {
  return items.find((item) => item.id === id)?.label ?? id;
}

function upsertFlowContext(values: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const currentRaw = window.localStorage.getItem(FLOW_CONTEXT_KEY);
    const current = currentRaw ? (JSON.parse(currentRaw) as { values?: Record<string, string> }) : { values: {} };
    const merged = { ...(current.values ?? {}), ...values };
    window.localStorage.setItem(FLOW_CONTEXT_KEY, JSON.stringify({ values: merged, updated_at: new Date().toISOString() }));
  } catch {
    // ignore local storage errors
  }
}

export function GrainCaptureCard() {
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [captureMode, setCaptureMode] = useState<"rapida" | "completa">("rapida");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [catalogs, setCatalogs] = useState<GrainCatalogs>(fallbackGrainCatalogs as GrainCatalogs);
  const [receptions, setReceptions] = useState<GrainReception[]>([]);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterText, setFilterText] = useState("");

  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [shiftTurn, setShiftTurn] = useState("1T");
  const [grainCode, setGrainCode] = useState("");
  const [wheatLotCode, setWheatLotCode] = useState("");
  const [varietyId, setVarietyId] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [grainWarehouseId, setGrainWarehouseId] = useState("");
  const [precleanWheatTypeId, setPrecleanWheatTypeId] = useState("");
  const [precleanHumidityPct, setPrecleanHumidityPct] = useState("13.2");
  const [precleanImpurityPct, setPrecleanImpurityPct] = useState("0.8");
  const [precleanTestWeightKgHl, setPrecleanTestWeightKgHl] = useState("79.0");
  const [tonsReceived, setTonsReceived] = useState("120");
  const [labHumidity, setLabHumidity] = useState("13.5");
  const [labProtein, setLabProtein] = useState("11.8");
  const [labImpurities, setLabImpurities] = useState("1.4");
  const [defectWhiteBellyPct, setDefectWhiteBellyPct] = useState("0.6");
  const [testWeightKgHl, setTestWeightKgHl] = useState("78.5");
  const [wetGlutenPct, setWetGlutenPct] = useState("28.0");
  const [ashPct, setAshPct] = useState("1.7");
  const [fallingNumberSec, setFallingNumberSec] = useState("280");
  const [damagedBrokenPct, setDamagedBrokenPct] = useState("0.9");
  const [notes, setNotes] = useState("");

  const refreshData = async () => {
    const [catalogData, receptionData] = await Promise.all([getGrainCatalogs(), getGrainReceptions()]);
    setCatalogs(catalogData);
    setReceptions(receptionData);
  };

  useEffect(() => {
    refreshData().catch(() => {
      setStatusMessage("Sin conexion completa a backend. Se muestran catalogos base.");
    });
  }, []);

  useEffect(() => {
    const refresh = () => {
      refreshData().catch(() => {
        setStatusMessage("Sin conexion completa a backend. Se muestran catalogos base.");
      });
    };

    const onCatalogsUpdated = () => refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CATALOGS_UPDATED_TS_KEY) {
        refresh();
      }
    };

    window.addEventListener(CATALOGS_UPDATED_EVENT, onCatalogsUpdated as EventListener);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(CATALOGS_UPDATED_EVENT, onCatalogsUpdated as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    const sorted = [...receptions].sort((a, b) => (toDateValue(a.created_at) < toDateValue(b.created_at) ? 1 : -1));
    return sorted.filter((row) => {
      const date = toDateValue(row.created_at) || row.receipt_date || "";
      if (filterFrom && date < filterFrom) return false;
      if (filterTo && date > filterTo) return false;
      if (text) {
        const detail = `${row.receipt_batch} ${row.grain_code} ${row.variety_id} ${row.farmer_id} ${row.grain_warehouse_id}`.toLowerCase();
        if (!detail.includes(text)) return false;
      }
      return true;
    });
  }, [filterFrom, filterText, filterTo, receptions]);

  const totalTons = useMemo(() => receptions.reduce((acc, row) => acc + row.tons_received, 0), [receptions]);
  const avgHumidity = useMemo(
    () => (receptions.length ? receptions.reduce((acc, row) => acc + row.lab_humidity, 0) / receptions.length : 0),
    [receptions],
  );
  const avgProtein = useMemo(
    () => (receptions.length ? receptions.reduce((acc, row) => acc + row.lab_protein, 0) / receptions.length : 0),
    [receptions],
  );

  const submitReception = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    const humidity = Number(labHumidity);
    const protein = Number(labProtein);
    const impurities = Number(labImpurities);
    if (humidity < 8 || humidity > 18 || protein < 8 || protein > 17 || impurities < 0 || impurities > 8) {
      setStatusMessage("Revisa rangos recomendados: humedad 8-18%, proteina 8-17%, impurezas 0-8%.");
      setIsSaving(false);
      return;
    }

    try {
      await createGrainReception({
        receipt_date: receiptDate,
        shift_turn: shiftTurn,
        grain_code: grainCode,
        wheat_lot_code: wheatLotCode,
        variety_id: varietyId,
        farmer_id: farmerId,
        grain_warehouse_id: grainWarehouseId,
        preclean_wheat_type_id: precleanWheatTypeId,
        preclean_humidity_pct: Number(precleanHumidityPct),
        preclean_impurity_pct: Number(precleanImpurityPct),
        preclean_test_weight_kg_hl: Number(precleanTestWeightKgHl),
        tons_received: Number(tonsReceived),
        lab_humidity: Number(labHumidity),
        lab_protein: Number(labProtein),
        lab_impurities: Number(labImpurities),
        defect_white_belly_pct: Number(defectWhiteBellyPct),
        test_weight_kg_hl: Number(testWeightKgHl),
        wet_gluten_pct: Number(wetGlutenPct),
        ash_pct: Number(ashPct),
        falling_number_sec: Number(fallingNumberSec),
        damaged_broken_pct: Number(damagedBrokenPct),
        notes,
      });

      await refreshData();
      upsertFlowContext({
        grain_code: grainCode,
        lote_trigo: wheatLotCode,
        tons_received: tonsReceived,
        humedad: labHumidity,
        proteina: labProtein,
        impurezas: labImpurities,
        variety_id: varietyId,
        farmer_id: farmerId,
      });
      setStatusMessage("Recepcion de granos registrada correctamente.");
      setIsCaptureOpen(false);
      setGrainCode("");
      setNotes("");
    } catch {
      setStatusMessage("No se pudo guardar la recepcion.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mt-4 space-y-4">
      <article className="panel p-5 md:p-6">
        <h3 className="font-display text-xl text-slate-800">Operacion de Granos</h3>
        <p className="ops-copy mt-2 text-sm text-slate-600">
          Esta captura corresponde solo al proceso de recepcion de granos. Los demas procesos operan en sus menus correspondientes.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Lotes recepcion</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{receptions.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Toneladas recibidas</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{totalTons.toFixed(2)} t</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Humedad promedio</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{avgHumidity.toFixed(2)}%</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Proteina promedio</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{avgProtein.toFixed(2)}%</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setIsCaptureOpen(true)}
            className="btn-primary"
          >
            Abrir formulario de captura
          </button>
        </div>
        {statusMessage ? <p className="mt-3 text-sm font-medium text-emerald-700">{statusMessage}</p> : null}
      </article>

      {isCaptureOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-xl text-slate-800">Captura de informacion de Granos</h4>
                <p className="mt-1 text-xs text-slate-500">Formulario exclusivo de recepcion de granos.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCaptureMode("rapida")}
                    className={`capture-tab ${captureMode === "rapida" ? "capture-tab-active" : "capture-tab-inactive"}`}
                  >
                    Captura rapida
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureMode("completa")}
                    className={`capture-tab ${captureMode === "completa" ? "capture-tab-active" : "capture-tab-inactive"}`}
                  >
                    Captura completa
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCaptureOpen(false)}
                className="module-btn-ghost px-4 py-2"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={submitReception} className="panel space-y-3 p-5">
              <h4 className="font-display text-lg text-slate-800">Area: Recepcion de granos</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Fecha recepcion</span>
                  <input
                    type="date"
                    required
                    value={receiptDate}
                    onChange={(event) => setReceiptDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Hora / Turno</span>
                  <input
                    required
                    value={shiftTurn}
                    onChange={(event) => setShiftTurn(event.target.value)}
                    placeholder="1T"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Codigo grano</span>
                  <input
                    required
                    value={grainCode}
                    onChange={(event) => setGrainCode(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Toneladas recibidas</span>
                  <input
                    type="number"
                    min={1}
                    step="0.1"
                    required
                    value={tonsReceived}
                    onChange={(event) => setTonsReceived(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Lote trigo</span>
                  <input
                    value={wheatLotCode}
                    onChange={(event) => setWheatLotCode(event.target.value)}
                    placeholder="MOTTLER"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Variedad</span>
                  <select
                    value={varietyId}
                    onChange={(event) => setVarietyId(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecciona una opcion</option>
                    {catalogs.grain_varieties.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Agricultor</span>
                  <select
                    value={farmerId}
                    onChange={(event) => setFarmerId(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecciona una opcion</option>
                    {catalogs.farmers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Tipo trigo prelimpia</span>
                  <select
                    value={precleanWheatTypeId}
                    onChange={(event) => setPrecleanWheatTypeId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecciona una opcion</option>
                    {catalogs.grain_varieties.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Bodega recepcion</span>
                  <select
                    value={grainWarehouseId}
                    onChange={(event) => setGrainWarehouseId(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecciona una opcion</option>
                    {catalogs.grain_warehouses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Humedad (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    required
                    value={labHumidity}
                    onChange={(event) => setLabHumidity(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Proteina (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    required
                    value={labProtein}
                    onChange={(event) => setLabProtein(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Impurezas (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    required
                    value={labImpurities}
                    onChange={(event) => setLabImpurities(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                {captureMode === "completa" ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Humedad prelimpia (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={precleanHumidityPct}
                        onChange={(event) => setPrecleanHumidityPct(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Impureza prelimpia (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={precleanImpurityPct}
                        onChange={(event) => setPrecleanImpurityPct(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Peso hectolitrico prelimpia (kg/hl)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={precleanTestWeightKgHl}
                        onChange={(event) => setPrecleanTestWeightKgHl(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Panza blanca (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={defectWhiteBellyPct}
                        onChange={(event) => setDefectWhiteBellyPct(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Peso hectolitrico (kg/hl)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={testWeightKgHl}
                        onChange={(event) => setTestWeightKgHl(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Gluten humedo (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={wetGlutenPct}
                        onChange={(event) => setWetGlutenPct(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Cenizas (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={ashPct}
                        onChange={(event) => setAshPct(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Falling number (s)</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={fallingNumberSec}
                        onChange={(event) => setFallingNumberSec(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Danados/quebrados (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={damagedBrokenPct}
                        onChange={(event) => setDamagedBrokenPct(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </>
                ) : null}
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Notas</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary"
                >
                  {isSaving ? "Guardando..." : "Guardar recepcion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <article className="panel p-5 md:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <h4 className="font-display text-lg text-slate-800">Tabla de registros de Granos</h4>
          <label className="block">
            <span className="text-xs text-slate-600">Desde</span>
            <input
              type="date"
              value={filterFrom}
              onChange={(event) => setFilterFrom(event.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Hasta</span>
            <input
              type="date"
              value={filterTo}
              onChange={(event) => setFilterTo(event.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block min-w-56 flex-1">
            <span className="text-xs text-slate-600">Buscar</span>
            <input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="lote, codigo, variedad..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Lote</th>
                <th>Código</th>
                <th>Lote trigo</th>
                <th>Variedad</th>
                <th>Agricultor</th>
                <th>Bodega</th>
                <th>Tipo trigo prelim.</th>
                <th>Hum. prelim.</th>
                <th>Imp. prelim.</th>
                <th>kg/hl prelim.</th>
                <th>Toneladas</th>
                <th>Humedad</th>
                <th>Proteína</th>
                <th>P. Blanca</th>
                <th>kg/hl</th>
                <th>Gluten</th>
                <th>Ceniza</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{toDateValue(row.created_at) || row.receipt_date || "—"}</td>
                  <td>{row.shift_turn || "—"}</td>
                  <td className="tbl-mono">{row.receipt_batch}</td>
                  <td>{row.grain_code}</td>
                  <td>{row.wheat_lot_code || "—"}</td>
                  <td>{getLabel(catalogs.grain_varieties, row.variety_id)}</td>
                  <td>{getLabel(catalogs.farmers, row.farmer_id)}</td>
                  <td>{getLabel(catalogs.grain_warehouses, row.grain_warehouse_id)}</td>
                  <td>{row.preclean_wheat_type_id ? getLabel(catalogs.grain_varieties, row.preclean_wheat_type_id) : "—"}</td>
                  <td>{row.preclean_humidity_pct != null ? `${row.preclean_humidity_pct.toFixed(2)}%` : "—"}</td>
                  <td>{row.preclean_impurity_pct != null ? `${row.preclean_impurity_pct.toFixed(2)}%` : "—"}</td>
                  <td>{row.preclean_test_weight_kg_hl != null ? row.preclean_test_weight_kg_hl.toFixed(1) : "—"}</td>
                  <td>{row.tons_received.toFixed(2)}</td>
                  <td>{row.lab_humidity.toFixed(2)}%</td>
                  <td>{row.lab_protein.toFixed(2)}%</td>
                  <td>{row.defect_white_belly_pct != null ? `${row.defect_white_belly_pct.toFixed(2)}%` : "—"}</td>
                  <td>{row.test_weight_kg_hl != null ? row.test_weight_kg_hl.toFixed(1) : "—"}</td>
                  <td>{row.wet_gluten_pct != null ? `${row.wet_gluten_pct.toFixed(2)}%` : "—"}</td>
                  <td>{row.ash_pct != null ? `${row.ash_pct.toFixed(2)}%` : "—"}</td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="td-empty">
                    No hay registros para los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
