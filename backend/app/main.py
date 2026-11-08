import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import settings
from app.middleware import (
    SecurityHeadersMiddleware,
    RateLimiterMiddleware,
    ProcessTimeMiddleware,
)
from app.routers import (
    health_router,
    bills_router,
    chat_router,
    appliances_router,
    notifications_router,
    profile_router,
    database_router,
    auth_router,
    onboarding_router,
)

# Configure structured enterprise logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("wattwise.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting %s v%s", settings.PROJECT_NAME, settings.VERSION)
    logger.info("🔒 Security middlewares, GZip compression, and Rate Limiter initialized")
    yield
    logger.info("🛑 Shutting down %s gracefully", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="High-performance backend API for WattWise: Multi-utility bill decomposition & AI appliance intelligence.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# 1. Performance: GZip compression for payloads > 500 bytes (saves mobile data & increases speed)
app.add_middleware(GZipMiddleware, minimum_size=500)

# 2. Performance & Observability: Processing latency measurement
app.add_middleware(ProcessTimeMiddleware)

# 3. Security: Enterprise HTTP security headers
app.add_middleware(SecurityHeadersMiddleware)

# 4. Security: In-memory sliding window rate limiter
app.add_middleware(RateLimiterMiddleware, max_requests=settings.RATE_LIMIT_PER_MINUTE)

# 5. Security & Mobile: CORS configuration matching local simulators and LAN devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time-Ms", "Content-Length"],
)

# Global safe exception handler: prevents internal server traces leaking to client
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception at %s: %s", request.url.path, str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred. The incident has been logged securely.",
        },
    )

# Root status
@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "version": settings.VERSION,
    }

# Mount modular routers under /api
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(bills_router, prefix=settings.API_PREFIX)
app.include_router(chat_router, prefix=settings.API_PREFIX)
app.include_router(appliances_router, prefix=settings.API_PREFIX)
app.include_router(notifications_router, prefix=settings.API_PREFIX)
app.include_router(profile_router, prefix=settings.API_PREFIX)
app.include_router(database_router, prefix=settings.API_PREFIX)
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(onboarding_router, prefix=settings.API_PREFIX)
