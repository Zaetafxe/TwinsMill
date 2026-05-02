# TwinsMill — Smart Milling AI Platform

Plataforma SaaS para operaciones de molienda de trigo (Industria 4.0): Digital Twin, KPIs, ML, optimización y Control Tower.

## Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, Recharts
- **Backend**: FastAPI (Python 3.11+), MongoDB
- **ML / Sim / Opt**: scikit-learn, xgboost, prophet, statsmodels, NumPy/SciPy/SimPy, PuLP

## Estructura
- `frontend/` — App web (Next.js)
- `backend/` — API FastAPI, Digital Twin, KPI engine, ML, optimización
- `docs/` — Arquitectura

## Requisitos
- Python 3.11+
- Node.js 18+ y npm
- MongoDB local (`mongodb://localhost:27017`) o remoto (Atlas)

## Clonar
```powershell
git clone https://github.com/Zaetafxe/TwinsMill.git
cd TwinsMill
```

## Backend — instalación y ejecución
```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Crea `backend/.env` (opcional, hay defaults):
```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=smart_milling
API_PREFIX=/api/v1
AUTH_SECRET_KEY=cambia-esto-por-un-secreto-largo
PLATFORM_ADMIN_EMAIL=admin@local
FRONTEND_ORIGINS=http://localhost:3010
```

Iniciar API:
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Docs: http://127.0.0.1:8000/docs

## Frontend — instalación y ejecución
```powershell
cd frontend
npm install
```

Opcional `frontend/.env.local`:
```
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
```

Iniciar app:
```powershell
npm run dev -- -p 3010
```
- App: http://localhost:3010

## Atajo: iniciar todo
Desde la raíz del repo:
```powershell
./start-dev.ps1                # inicia backend (8000) y frontend (3010)
./start-dev.ps1 -InstallDeps   # primera vez: instala dependencias
```

## Módulos de negocio
- Digital Twin de proceso (recepción → limpieza → molienda → cernido → mezclado → empaque → almacén → despacho)
- Motor de KPIs y heatmap de riesgos
- Recomendaciones IA (operacional y comercial)
- Forecast de demanda y optimizador de rentabilidad
- Simulación Monte Carlo de disrupciones
- WHAT-IF con impacto de negocio
- Copilot ejecutivo y scoring de madurez digital

## Notas
Scaffolding production-style con datos sintéticos deterministas, listo para integrarse con historian de planta, ERP y CRM reales.
