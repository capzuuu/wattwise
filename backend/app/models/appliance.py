from pydantic import BaseModel, Field
from typing import Literal, List


class ApplianceTelemetry(BaseModel):
    id: str
    name: str
    monthlyCost: str
    costNumeric: float
    monthlyKwh: str
    kwhNumeric: float
    percentage: int
    meta: str
    icon: Literal["mode_fan", "kitchen", "payments", "bolt", "tv"]


class ThermostatOptimizationRequest(BaseModel):
    temperatureCelsius: int = Field(25, ge=16, le=30, description="Target cooling temperature in Celsius (16-30)")
    enabled: bool = True


class ThermostatOptimizationResponse(BaseModel):
    success: bool
    isScheduleApplied: bool
    estimatedMonthlySavings: str
    updatedAppliances: List[ApplianceTelemetry]
