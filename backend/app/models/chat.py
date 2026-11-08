from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import re


class ChatMessage(BaseModel):
    id: Optional[str] = None
    sender: Literal["user", "assistant"]
    text: str = Field(..., max_length=3000)
    time: Optional[str] = None
    showBreakdown: Optional[bool] = False
    savingsEstimate: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=1500,
        description="User query regarding bills, appliances, water, or Wi-Fi"
    )
    history: List[ChatMessage] = Field(
        default_factory=list,
        max_length=30,
        description="Recent chat history context"
    )
    utilityFilter: Optional[Literal["all", "elec", "water", "wifi"]] = "all"

    @field_validator("message")
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        # Strip dangerous null-bytes and excessive whitespace
        cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', v).strip()
        if not cleaned:
            raise ValueError("Message cannot be empty or purely control characters")
        return cleaned


class SuggestedPrompt(BaseModel):
    id: str
    text: str
    category: Literal["electricity", "water", "wifi", "appliances", "history"]


class ChatResponse(BaseModel):
    reply: str
    showBreakdown: bool = False
    savingsEstimate: Optional[str] = None
    suggestions: List[str] = Field(default_factory=list)
    timestamp: str
