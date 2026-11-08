import logging
from fastapi import APIRouter
from app.models.database import DatabaseStatusResponse, DatabaseSyncResponse
from app.db.sync_service import sync_service

logger = logging.getLogger("wattwise.database_router")

router = APIRouter(prefix="/database", tags=["Database & Cloud Sync"])


@router.get("/status", response_model=DatabaseStatusResponse)
def get_database_status():
    """
    Get real-time operational status for both the local SQLite engine (WAL mode)
    and the online Supabase cloud replica.
    """
    return sync_service.get_database_status()


@router.post("/sync", response_model=DatabaseSyncResponse)
def sync_database():
    """
    Trigger manual or scheduled cloud sync from local SQLite to Supabase Cloud.
    If offline or Supabase credentials are not provided, gracefully queues changes.
    """
    return sync_service.synchronize()
