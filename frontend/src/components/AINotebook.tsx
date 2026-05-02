"use client";

import { useState } from "react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  ScatterChart, 
  Scatter,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from "recharts";
import { analyzeNotebookPrompt } from "@/lib/api";

type CellType = "input" | "markdown" | "table" | "chart" | "metrics" | "confusion-matrix";

type ChartData = {
  type: "line" | "bar" | "scatter";
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  title?: string;
};

type TableData = {
  headers: string[];
  rows: Array<string[]>;
};

type MetricsData = {
  metrics: Array<{ label: string; value: string | number; description?: string }>;
};

type ConfusionMatrixData = {
  matrix: number[][];
  labels: string[];
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
};

type NotebookCell = {
  id: string;
  type: CellType;
  content?: string;
  data?: ChartData | TableData | MetricsData | ConfusionMatrixData;
  executing?: boolean;
};

export function AINotebook() {
  const [cells, setCells] = useState<NotebookCell[]>([
    {
      id: "welcome",
      type: "markdown",
      content: `# Bienvenido al Notebook Interactivo con IA

Escribe tu pregunta o premisa en lenguaje natural y el sistema generará automáticamente:
- 📊 Visualizaciones (gráficos de líneas, barras, dispersión)
- 📋 Tablas de datos
- 📈 Métricas clave
- 🎯 Matrices de confusión
- 📝 Análisis y conclusiones

**Ejemplos de preguntas que puedes hacer:**
- "Analiza la tendencia de ventas del último trimestre"
- "Muestra la correlación entre calidad y precio"
- "Genera una matriz de confusión del modelo de predicción de demanda"
- "Calcula las métricas de rendimiento del modelo de clasificación"`,
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [executing, setExecuting] = useState(false);

  async function handleAnalyze() {
    if (!prompt.trim() || executing) return;

    const inputCellId = `input-${Date.now()}`;
    const outputCellId = `output-${Date.now()}`;
    const currentPrompt = prompt;

    // Agregar celda de input
    setCells((prev) => [
      ...prev,
      { id: inputCellId, type: "input", content: currentPrompt },
      { id: outputCellId, type: "markdown", content: "", executing: true },
    ]);

    setExecuting(true);
    setPrompt("");

    try {
      const result = await analyzeNotebookPrompt(currentPrompt);

      // Actualizar con los resultados
      setCells((prev) =>
        prev.map((cell) => {
          if (cell.id === outputCellId) {
            return { id: outputCellId, type: "markdown", content: "", executing: false };
          }
          return cell;
        })
      );

      // Agregar las nuevas celdas generadas
      const newCells = result.cells || [];
      setCells((prev) => [
        ...prev.filter((c) => c.id !== outputCellId || !c.executing),
        ...newCells.map((c, i: number) => ({ ...c, id: `${outputCellId}-${i}` } as NotebookCell)),
      ]);
    } catch (error) {
      setCells((prev) =>
        prev.map((cell) => {
          if (cell.id === outputCellId) {
            return {
              id: outputCellId,
              type: "markdown",
              content: `❌ **Error**: ${error instanceof Error ? error.message : "No se pudo completar el análisis"}`,
              executing: false,
            };
          }
          return cell;
        })
      );
    } finally {
      setExecuting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAnalyze();
    }
  }

  return (
    <div className="space-y-4">
      {/* Notebook Cells */}
      <div className="space-y-3">
        {cells.map((cell) => (
          <NotebookCellView key={cell.id} cell={cell} />
        ))}
      </div>

      {/* Input Area */}
      <div className="panel sticky bottom-4 p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta o análisis en lenguaje natural... (Ctrl+Enter para ejecutar)"
              className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-[#8d5b31] focus:outline-none focus:ring-2 focus:ring-[#8d5b31]/20"
              rows={3}
              disabled={executing}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={executing || !prompt.trim()}
            className="self-end rounded-lg bg-gradient-to-r from-[#8d5b31] to-[#6b4423] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analizando...
              </span>
            ) : (
              "Ejecutar Análisis"
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tip: Usa <kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs">Ctrl+Enter</kbd> para ejecutar rápidamente
        </p>
      </div>
    </div>
  );
}

function NotebookCellView({ cell }: { cell: NotebookCell }) {
  if (cell.executing) {
    return (
      <div className="panel border-l-4 border-yellow-500 bg-yellow-50 p-4">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-yellow-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-medium text-yellow-800">Ejecutando análisis...</span>
        </div>
      </div>
    );
  }

  switch (cell.type) {
    case "input":
      return (
        <div className="panel border-l-4 border-blue-500 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <span className="rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">IN</span>
            <p className="flex-1 whitespace-pre-wrap text-sm text-slate-700">{cell.content}</p>
          </div>
        </div>
      );

    case "markdown":
      return (
        <div className="panel border-l-4 border-green-500 p-4">
          <div className="prose prose-sm max-w-none">
            <MarkdownContent content={cell.content || ""} />
          </div>
        </div>
      );

    case "table":
      return (
        <div className="panel border-l-4 border-purple-500 p-4">
          <TableView data={cell.data as TableData} />
        </div>
      );

    case "chart":
      return (
        <div className="panel border-l-4 border-orange-500 p-4">
          <ChartView data={cell.data as ChartData} />
        </div>
      );

    case "metrics":
      return (
        <div className="panel border-l-4 border-indigo-500 p-4">
          <MetricsView data={cell.data as MetricsData} />
        </div>
      );

    case "confusion-matrix":
      return (
        <div className="panel border-l-4 border-pink-500 p-4">
          <ConfusionMatrixView data={cell.data as ConfusionMatrixData} />
        </div>
      );

    default:
      return null;
  }
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown parser (puedes extender esto)
  const lines = content.split("\n");
  
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("# ")) {
          return <h1 key={i} className="text-2xl font-bold text-slate-900">{line.slice(2)}</h1>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={i} className="text-xl font-bold text-slate-800">{line.slice(3)}</h2>;
        }
        if (line.startsWith("### ")) {
          return <h3 key={i} className="text-lg font-semibold text-slate-700">{line.slice(4)}</h3>;
        }
        if (line.startsWith("- ")) {
          return <li key={i} className="ml-4 text-slate-700">{line.slice(2)}</li>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-bold text-slate-800">{line.slice(2, -2)}</p>;
        }
        if (line.trim() === "") {
          return <br key={i} />;
        }
        return <p key={i} className="text-slate-700">{line}</p>;
      })}
    </>
  );
}

function TableView({ data }: { data: TableData }) {
  if (!data || !data.headers || !data.rows) {
    return <p className="text-sm text-slate-500">No hay datos de tabla disponibles</p>;
  }

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {data.headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartView({ data }: { data: ChartData }) {
  if (!data || !data.data || data.data.length === 0) {
    return <p className="text-sm text-slate-500">No hay datos de gráfico disponibles</p>;
  }

  return (
    <div>
      {data.title && <h3 className="mb-3 text-lg font-semibold text-slate-800">{data.title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        {data.type === "line" ? (
          <LineChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={data.xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={data.yKey} stroke="#8d5b31" strokeWidth={2} />
          </LineChart>
        ) : data.type === "bar" ? (
          <BarChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={data.xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={data.yKey} fill="#8d5b31" />
          </BarChart>
        ) : (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={data.xKey} />
            <YAxis dataKey={data.yKey} />
            <Tooltip />
            <Legend />
            <Scatter data={data.data} fill="#8d5b31" />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function MetricsView({ data }: { data: MetricsData }) {
  if (!data || !data.metrics || data.metrics.length === 0) {
    return <p className="text-sm text-slate-500">No hay métricas disponibles</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.metrics.map((metric, i) => (
        <div key={i} className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{metric.label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metric.value}</p>
          {metric.description && (
            <p className="mt-1 text-xs text-slate-500">{metric.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ConfusionMatrixView({ data }: { data: ConfusionMatrixData }) {
  if (!data || !data.matrix || !data.labels) {
    return <p className="text-sm text-slate-500">No hay matriz de confusión disponible</p>;
  }

  const maxValue = Math.max(...data.matrix.flat());

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Matriz de Confusión</h3>
      
      {/* Métricas de rendimiento */}
      {(data.accuracy || data.precision || data.recall || data.f1Score) && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.accuracy !== undefined && (
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs font-medium text-green-700">Accuracy</p>
              <p className="text-lg font-bold text-green-900">{(data.accuracy * 100).toFixed(1)}%</p>
            </div>
          )}
          {data.precision !== undefined && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">Precision</p>
              <p className="text-lg font-bold text-blue-900">{(data.precision * 100).toFixed(1)}%</p>
            </div>
          )}
          {data.recall !== undefined && (
            <div className="rounded-lg bg-purple-50 p-3">
              <p className="text-xs font-medium text-purple-700">Recall</p>
              <p className="text-lg font-bold text-purple-900">{(data.recall * 100).toFixed(1)}%</p>
            </div>
          )}
          {data.f1Score !== undefined && (
            <div className="rounded-lg bg-orange-50 p-3">
              <p className="text-xs font-medium text-orange-700">F1 Score</p>
              <p className="text-lg font-bold text-orange-900">{(data.f1Score * 100).toFixed(1)}%</p>
            </div>
          )}
        </div>
      )}

      {/* Matriz */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th></th>
              {data.labels.map((label, i) => (
                <th key={i} className="tbl-center">Pred: {label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: "#0f2f63" }}>Real: {data.labels[i]}</td>
                {row.map((value, j) => {
                  const intensity = maxValue > 0 ? value / maxValue : 0;
                  const bgColor = i === j
                    ? `rgba(34, 197, 94, ${0.15 + intensity * 0.5})`
                    : `rgba(239, 68, 68, ${0.08 + intensity * 0.4})`;
                  return (
                    <td
                      key={j}
                      className="tbl-center"
                      style={{ backgroundColor: bgColor, fontWeight: 700 }}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
