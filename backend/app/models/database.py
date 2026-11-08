from pydantic import BaseModel
from typing import Optional, Dict, Any


class SQLiteStatus(BaseModel):
    status: str
    journalMode: str
    concurrency: str
    unsyncedItems: int
    databasePath: str
    totalStatements: Optional[int] = 0
    totalAppliances: Optional[int] = 0
    totalNotifications: Optional[int] = 0


class SupabaseStatus(BaseModel):
    configured: bool
    connected: bool
    cloudProvider: str
    url: str


class DatabaseStatusResponse(BaseModel):
    mode: str
    sqlite: SQLiteStatus
    supabase: SupabaseStatus
    lastSyncedAt: str


class DatabaseSyncResponse(BaseModel):
    success: bool
    status: str
    message: str
    pendingSyncCount: int
    syncedRecords: int
    timestamp: str

