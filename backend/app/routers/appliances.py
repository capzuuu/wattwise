from fastapi import APIRouter
from typing import List
from app.models.appliance import (
    ApplianceTelemetry,
    ThermostatOptimizationRequest,
    ThermostatOptimizationResponse,
)
from app.db.sqlite_manager import sqlite_db

router = APIRouter(prefix="/appliances", tags=["Appliances"])


@router.get("", response_model=List[ApplianceTelemetry])
def list_appliances():
    """
    Get all household appliances with kWh consumption and cost breakdown from SQLite.
    """
    return sqlite_db.get_appliances()


@router.post("/optimize", response_model=ThermostatOptimizationResponse)
def optimize_thermostat(request: ThermostatOptimizationRequest):
    """
    Apply 25°C thermostat schedule to reduce cooling draw (persisted to SQLite).
    """
    updated = sqlite_db.update_thermostat(temp=request.temperatureCelsius, applied=True)
    return ThermostatOptimizationResponse(
        success=True,
        isScheduleApplied=True,
        estimatedMonthlySavings="₱520/month",
        updatedAppliances=updated,
    )


@router.post("/reset", response_model=ThermostatOptimizationResponse)
def reset_thermostat():
    """
    Reset thermostat schedule to default parameters (persisted to SQLite).
    """
    updated = sqlite_db.update_thermostat(applied=False)
    return ThermostatOptimizationResponse(
        success=True,
        isScheduleApplied=False,
        estimatedMonthlySavings="₱0/month",
        updatedAppliances=updated,
    )

