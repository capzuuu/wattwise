import time
from fastapi import APIRouter
from datetime import datetime
from app.config import settings

router = APIRouter(tags=["Health"])

START_TIME = time.time()


@router.get("/health")
def health_check():
    """
    Lightweight, high-speed health check reporting uptime and supported utilities.
    Zero external OS metrics overhead for instantaneous responses.
    """
    uptime_seconds = int(time.time() - START_TIME)
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "databaseEngine": "SQLite WAL + Supabase Sync",
        "uptimeSeconds": uptime_seconds,
        "timestamp": datetime.now().isoformat(),
        "supportedUtilities": ["electricity", "water", "wifi"],
    }
