from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import os
import re


class ItemizedCharge(BaseModel):
    name: str
    amount: str
    amountNumeric: float
    tagalog: str
    desc: str
    percentage: int
    color: str
    rate: str
    category: Literal["generation", "transmission", "distribution", "system_loss", "subsidies"]


class StatementData(BaseModel):
    id: str
    provider: str
    accountNo: str
    period: str
    days: int
    dueDate: str
    amountDue: str
    amountDueNumeric: float
    consumptionKwh: float
    effectiveRate: str
    rateNumeric: float
    generationAdjustment: str
    utilityType: Literal["electricity", "water", "wifi"] = "electricity"


class BillAnalysisRequest(BaseModel):
    utilityType: Optional[Literal["electricity", "water", "wifi"]] = "electricity"
    fileName: Optional[str] = Field("statement.jpg", max_length=120)
    imageBase64: Optional[str] = Field(None, max_length=15_000_000)

    @field_validator("fileName")
    @classmethod
    def sanitize_file_name(cls, v: Optional[str]) -> str:
        if not v:
            return "statement.jpg"
        # Prevent directory traversal
        base = os.path.basename(v)
        cleaned = re.sub(r'[^a-zA-Z0-9_.-]', '_', base)
        return cleaned or "statement.jpg"


class BillAnalysisResponse(BaseModel):
    success: bool
    statement: StatementData
    charges: List[ItemizedCharge]
    anomalies: List[str] = Field(default_factory=list)
    coolingLoadEstimate: Optional[str] = None
    confidenceScore: float = 0.98
    processedAt: str
