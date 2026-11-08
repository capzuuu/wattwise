from fastapi import APIRouter, HTTPException
from typing import List
from app.models.notification import NotificationItem
from app.db.sqlite_manager import sqlite_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationItem])
def list_notifications():
    """
    Get all household notifications from SQLite.
    """
    return sqlite_db.get_notifications()


@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: str):
    """
    Mark a specific notification as read in SQLite.
    """
    success = sqlite_db.mark_notification_read(notification_id)
    if success:
        return {"success": True, "id": notification_id, "read": True}
    raise HTTPException(status_code=404, detail="Notification not found")


@router.post("/read-all")
def mark_all_read():
    """
    Mark all notifications as read in SQLite.
    """
    updated_count = sqlite_db.mark_all_notifications_read()
    return {"success": True, "count": updated_count}

