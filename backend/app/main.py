import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.session import ensure_indexes

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    print(
        f"TIMING {request.method} {request.url.path} -> {response.status_code} in {elapsed_ms:.1f}ms"
    )
    return response


@app.get("/")
def health() -> dict:
    return {
        "service": settings.app_name,
        "status": "healthy",
        "env": settings.env,
    }


@app.on_event("startup")
def bootstrap_db_indexes() -> None:
    try:
        ensure_indexes()
    except Exception as exc:
        # Allow API startup in local/dev when MongoDB is unavailable.
        print(f"WARN MongoDB unavailable during startup: {exc}")


app.include_router(api_router, prefix=settings.api_prefix)
