from fastapi import APIRouter
from typing import List
from pydantic import BaseModel
from app.db.sqlite_manager import sqlite_db

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


class OnboardingSlideModel(BaseModel):
    id: str
    badge: str
    title: str
    description: str
    sort_order: int
    visual_type: str


@router.get("", response_model=List[OnboardingSlideModel])
def get_onboarding_slides():
    """
    Retrieve onboarding slides persisted in SQLite database.
    """
    return sqlite_db.get_onboarding_slides()

