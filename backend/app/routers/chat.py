from fastapi import APIRouter
from typing import List
from app.models.chat import ChatRequest, ChatResponse, SuggestedPrompt
from app.services.ai_assistant import ai_assistant

from app.db.sqlite_manager import sqlite_db

router = APIRouter(prefix="/chat", tags=["AI Assistant"])


@router.post("", response_model=ChatResponse)
def chat_with_assistant(request: ChatRequest):
    """
    Query the Multi-Utility AI Assistant regarding bills, electric appliances, water leaks, or Wi-Fi draw.
    """
    response = ai_assistant.answer_query(
        query=request.message,
        utility_filter=request.utilityFilter,
    )
    return response


@router.get("/history", response_model=List[dict])
def get_chat_history(limit: int = 50):
    """
    Get chat history persisted in SQLite.
    """
    return sqlite_db.get_chat_history(limit=limit)


@router.get("/suggested-prompts", response_model=List[SuggestedPrompt])
def get_suggested_prompts():
    """
    Get recommended query pills for quick tap-to-ask.
    """
    return ai_assistant.get_suggested_prompts()

