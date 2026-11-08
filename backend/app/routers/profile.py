from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.db.sqlite_manager import sqlite_db

router = APIRouter(prefix="/profile", tags=["Profile"])


class BudgetUpdateRequest(BaseModel):
    targetBudget: str = Field(
        ...,
        max_length=20,
        pattern=r"^[₱$]?[0-9,]+(\.[0-9]{1,2})?$",
        description="Target monthly household budget (e.g. ₱4,500)"
    )


@router.get("")
def get_profile():
    """
    Get household user profile from SQLite.
    """
    return sqlite_db.get_profile()


@router.put("/budget")
def update_budget(payload: BudgetUpdateRequest):
    """
    Update target budget in SQLite database.
    """
    updated_budget = sqlite_db.update_budget(payload.targetBudget)
    return {
        "success": True,
        "targetBudget": updated_budget,
    }
