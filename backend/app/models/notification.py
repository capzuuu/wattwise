from pydantic import BaseModel
from typing import Literal, Optional


class NotificationItem(BaseModel):
    id: str
    category: Literal["bills", "usage", "appliances"]
    title: str
    body: str
    timestamp: str
    section: Literal["Today", "Earlier"]
    icon: str
    read: bool
    actionLabel: Optional[str] = None
    actionTab: Optional[Literal["breakdown", "insights", "profile", "scan"]] = None

