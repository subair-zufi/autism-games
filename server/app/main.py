"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import admin, auth, events, progress, students
from .seed import init_db

logger = logging.getLogger("uvicorn.error")

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and seed the first admin on startup.
    try:
        init_db()
    except Exception as exc:  # pragma: no cover - surfaced in logs on misconfig
        logger.error("Database initialisation failed: %s", exc)
        raise
    yield


app = FastAPI(
    title="Autism Games Analytics API",
    description="Records player analytics for the Autism Games app and powers the admin dashboard.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(students.router)
app.include_router(events.router)
app.include_router(progress.router)
app.include_router(admin.router)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/admin", response_class=HTMLResponse, tags=["admin"])
def admin_dashboard() -> HTMLResponse:
    """Serve the built-in admin dashboard (login + analytics + user management)."""
    html = (TEMPLATES_DIR / "admin.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html)


@app.get("/", response_class=HTMLResponse, tags=["meta"])
def index() -> HTMLResponse:
    return HTMLResponse(
        "<h1>Autism Games Analytics API</h1>"
        '<p>See <a href="/docs">/docs</a> for the API and '
        '<a href="/admin">/admin</a> for the dashboard.</p>'
    )
