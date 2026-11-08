import logging
from typing import Optional, Dict, Any, List
from app.config import settings

logger = logging.getLogger("wattwise.supabase")


class SupabaseManager:
    """
    Cloud synchronization manager powered by Supabase Python SDK.
    Gracefully handles offline environments, network timeouts, and unconfigured credentials.
    """

    def __init__(self):
        self.client = None
        self.is_configured = bool(settings.SUPABASE_URL and settings.SUPABASE_KEY)
        self.is_connected = False
        self._init_client()

    def _init_client(self):
        if not self.is_configured:
            logger.info("Supabase credentials not configured. Running in Local SQLite Offline-First Mode.")
            return

        try:
            from supabase import create_client, Client
            self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            self.is_connected = True
            logger.info("Connected successfully to Supabase Cloud at: %s", settings.SUPABASE_URL)
        except Exception as e:
            self.is_connected = False
            logger.warning("Failed to connect to Supabase Cloud: %s. Operating offline with SQLite.", str(e))

    def get_status(self) -> Dict[str, Any]:
        """Returns the real-time cloud connection telemetry."""
        return {
            "configured": self.is_configured,
            "connected": self.is_connected,
            "cloudProvider": "Supabase PostgreSQL",
            "url": settings.SUPABASE_URL[:25] + "..." if settings.SUPABASE_URL else "Not Configured",
        }

    def sync_record_to_cloud(self, table_name: str, record: Dict[str, Any]) -> bool:
        """
        Upserts a single record to the corresponding Supabase cloud table.
        Returns True if successful, False if offline or error.
        """
        if not self.is_connected or not self.client:
            return False

        try:
            # Upsert into cloud table
            response = self.client.table(table_name).upsert(record).execute()
            return bool(response.data)
        except Exception as e:
            logger.warning("Supabase sync failed for table '%s': %s", table_name, str(e))
            return False

    def fetch_from_cloud(self, table_name: str, limit: int = 10) -> Optional[List[Dict[str, Any]]]:
        """Fetch records from Supabase cloud table."""
        if not self.is_connected or not self.client:
            return None

        try:
            res = self.client.table(table_name).select("*").limit(limit).execute()
            return res.data
        except Exception as e:
            logger.warning("Supabase fetch failed for table '%s': %s", table_name, str(e))
            return None


supabase_client = SupabaseManager()
