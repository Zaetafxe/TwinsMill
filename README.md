# Smart Milling AI Platform

Enterprise SaaS platform for Industry 4.0 wheat milling operations.

## Core capabilities
- Full process Digital Twin for wheat reception, cleaning, milling, sieving, blending, packing, warehouse, and dispatch.
- AI analytics and predictive modeling for flour quality, customer risk, demand forecasting, and profit forecasting.
- Optimization engines for blending strategy, production planning, and inventory policy.
- Control Tower dashboard with executive KPIs, risk heatmaps, alerts, and WHAT-IF analysis.
- AI Decision Engine with operational and commercial recommendations.

## Tech stack
- Frontend: Next.js, React, TypeScript, Tailwind CSS, Recharts
- Backend: FastAPI, MongoDB
- ML: scikit-learn, xgboost, prophet, statsmodels
- Simulation: NumPy, SciPy, SimPy
- Optimization: PuLP, OR-Tools (extensible)

## Database configuration
- MongoDB URI is configured with environment variables in `backend/.env` or `backend/.env.example`
- Default local Docker URI in compose: `mongodb://mongodb:27017`
- Database name: `smart_milling`

## Monorepo structure
- `frontend/`: Executive web application and control tower views
- `backend/`: API, Digital Twin simulation, KPI engine, ML and optimization services
- `docs/`: Architecture and data flow diagrams

## Quick start
1. Run MongoDB and services with Docker:
   - `docker compose up --build`
2. Optional frontend API override (if backend URL differs):
   - Create `frontend/.env.local` with `NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1`
3. Backend API:
   - `http://localhost:8000/docs`
4. Frontend app:
   - `http://localhost:3000`

## Production deploy (Cloudflare + VPS + Nginx)
Target architecture:
- Internet -> Cloudflare -> VPS (Docker) -> Nginx reverse proxy -> Frontend + Backend -> MongoDB persistent volume

### 1) Prepare production env files
1. Copy and edit environment templates:
   - `cp deploy/production.env.example deploy/production.env`
   - `cp backend/env.production.example backend/.env.production`
   - `cp frontend/env.production.example frontend/.env.production`
2. Update at least:
   - `deploy/production.env`: `MONGO_ROOT_PASSWORD`
   - `backend/.env.production`: `AUTH_SECRET_KEY`, `PLATFORM_ADMIN_EMAIL`, `FRONTEND_ORIGINS`

### 2) Configure Cloudflare
1. Create DNS `A` record pointing your domain to VPS public IP.
2. Enable proxy (orange cloud).
3. SSL mode: `Full (strict)`.
4. Generate Cloudflare Origin Certificate and key.
5. Save cert files on VPS:
   - `deploy/nginx/certs/fullchain.pem`
   - `deploy/nginx/certs/privkey.pem`

### 3) Start production stack
Run from repository root:
- `docker compose -f docker-compose.prod.yml --env-file deploy/production.env up -d --build`

Check services:
- `docker compose -f docker-compose.prod.yml ps`

### 4) Endpoints
- Public app: `https://your-domain.com`
- API docs via Nginx: `https://your-domain.com/docs`

### 5) Useful operations
- Logs:
  - `docker compose -f docker-compose.prod.yml logs -f nginx backend frontend mongodb`
- Restart:
  - `docker compose -f docker-compose.prod.yml restart`
- Stop:
  - `docker compose -f docker-compose.prod.yml down`

## Business modules included
- Digital Twin simulation engine
- Intelligent KPI engine
- AI decision recommendation engine
- Customer analytics and churn risk
- Demand forecasting and profit optimizer
- Disruption Monte Carlo simulation
- Synthetic industrial dataset generation and ETL simulation
- AI Milling Copilot (simulated executive Q and A)
- Digital maturity scoring
- WHAT-IF smart scenario simulation with business impact

## Notes
This codebase is production-style scaffolding with deterministic synthetic data pipelines and realistic architecture boundaries. It is designed to be expanded with real plant historian, ERP, and CRM integrations.
