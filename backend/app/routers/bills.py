import asyncio
import os
import re
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Optional, List
from app.models.bill import BillAnalysisResponse, BillAnalysisRequest
from app.services.bill_analyzer import bill_analyzer
from app.db.sqlite_manager import sqlite_db
from app.config import settings

router = APIRouter(prefix="/bills", tags=["Bills"])


def sanitize_filename(filename: Optional[str]) -> str:
    if not filename:
        return "statement.jpg"
    base = os.path.basename(filename)
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', base)
    return clean[:100] or "statement.jpg"


@router.post("/analyze", response_model=BillAnalysisResponse)
async def analyze_bill(
    file: Optional[UploadFile] = File(None),
    utilityType: Optional[str] = Form("electricity"),
):
    """
    Analyze uploaded statement image via AI OCR decomposition engine.
    Securely validates file size, MIME type, and processes asynchronously.
    """
    file_bytes = None
    clean_name = None

    if file:
        # 1. Security Check: Content Type Validation
        content_type = file.content_type or ""
        if content_type and content_type.lower() not in settings.ALLOWED_IMAGE_MIMES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported media type: '{content_type}'. Allowed types: JPEG, PNG, WEBP, HEIC, PDF.",
            )

        # 2. Security Check: Chunked Read with Max Size Guard (DoS prevention)
        chunks = []
        total_size = 0
        chunk_size = 1024 * 1024  # 1 MB chunks

        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > settings.MAX_UPLOAD_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.",
                )
            chunks.append(chunk)

        file_bytes = b"".join(chunks)
        clean_name = sanitize_filename(file.filename)

    # 3. Scalability: Offload CPU-bound image & OCR parsing to thread pool
    result = await asyncio.to_thread(
        bill_analyzer.analyze_bill,
        utility_type=utilityType or "electricity",
        file_bytes=file_bytes,
        file_name=clean_name,
    )
    return result


@router.post("/analyze-json", response_model=BillAnalysisResponse)
def analyze_bill_json(payload: BillAnalysisRequest):
    """
    JSON payload endpoint for clients transmitting metadata or base64.
    """
    result = bill_analyzer.analyze_bill(
        utility_type=payload.utilityType or "electricity",
        file_bytes=None,
        file_name=payload.fileName,
    )
    return result


@router.get("", response_model=List[dict])
def list_recent_bills():
    """
    List all recent statements with verification status from SQLite.
    """
    return sqlite_db.get_recent_bills()


@router.get("/current", response_model=dict)
def get_current_bill(utilityType: Optional[str] = None):
    """
    Get active verified statement with itemized charges from SQLite.
    Supports optional utilityType filter ('electricity', 'water', 'wifi').
    """
    try:
        stmt, charges = sqlite_db.get_current_statement(utility_type=utilityType)
        return {
            "statement": stmt,
            "charges": charges,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail="No statement records available")


@router.get("/all-utilities", response_model=dict)
def get_all_utility_bills():
    """
    Get current statements for electricity, water, and wifi in a single atomic payload.
    Preloads all utilities so client-side tab switching requires zero API requests.
    """
    res = {}
    for utype in ("electricity", "water", "wifi"):
        try:
            stmt, charges = sqlite_db.get_current_statement(utility_type=utype)
            res[utype] = {
                "statement": stmt,
                "charges": charges,
            }
        except Exception:
            pass
    return res


@router.get("/all-monthly", response_model=dict)
def get_all_monthly_history():
    """
    Get 10-month historical consumption and billing trends for all utilities from SQLite.
    """
    return sqlite_db.get_all_monthly_consumption()


@router.get("/telemetry", response_model=dict)
def get_utility_telemetry():
    """
    Get dynamic telemetry metrics (consumption stat, daily average, carbon footprint, forecast)
    computed directly from SQLite statements for electricity, water, and wifi.
    """
    return sqlite_db.get_utility_telemetry()


@router.get("/monthly", response_model=List[dict])
def get_monthly_history(utilityType: Optional[str] = None):
    """
    Get 10-month historical consumption and billing trends from SQLite.
    Supports optional utilityType filter ('elec', 'electricity', 'water', 'wifi').
    """
    return sqlite_db.get_monthly_consumption(utility_type=utilityType)


@router.get("/{bill_id}")
def get_bill_detail(bill_id: str):
    """
    Get specific bill detail by statement ID from SQLite.
    """
    safe_id = sanitize_filename(bill_id)
    bill_data = sqlite_db.get_statement_by_id(safe_id)
    if bill_data:
        stmt, charges = bill_data
        return {
            "statement": stmt,
            "charges": charges,
        }
    raise HTTPException(status_code=404, detail="Statement not found")
