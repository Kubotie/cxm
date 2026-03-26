import os
import json
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Kocoro NocoDB Write Proxy", version="1.0.0")

NOCODB_BASE_URL = os.getenv("NOCODB_BASE_URL", "https://odtable.ptmind.ai/api/v2")
NOCODB_API_TOKEN = os.getenv("NOCODB_API_TOKEN", "")

SUPPORT_ALERTS_TABLE_ID = os.getenv("SUPPORT_ALERTS_TABLE_ID", "")
SUPPORT_CASE_AI_STATE_TABLE_ID = os.getenv("SUPPORT_CASE_AI_STATE_TABLE_ID", "")

if not NOCODB_API_TOKEN:
    print("WARNING: NOCODB_API_TOKEN is not set")
if not SUPPORT_ALERTS_TABLE_ID:
    print("WARNING: SUPPORT_ALERTS_TABLE_ID is not set")
if not SUPPORT_CASE_AI_STATE_TABLE_ID:
    print("WARNING: SUPPORT_CASE_AI_STATE_TABLE_ID is not set")


def nocodb_headers() -> Dict[str, str]:
    return {
        "xc-token": NOCODB_API_TOKEN,
        "Content-Type": "application/json",
    }


def nocodb_records_url(table_id: str) -> str:
    return f"{NOCODB_BASE_URL}/tables/{table_id}/records"


def post_records_to_nocodb(table_id: str, records: List[Dict[str, Any]]) -> Any:
    if not table_id:
        raise HTTPException(status_code=500, detail="Target table ID is not configured")
    if not isinstance(records, list) or len(records) == 0:
        raise HTTPException(status_code=400, detail="records must be a non-empty list")

    url = nocodb_records_url(table_id)

    # NocoDB には配列そのものを送る
    response = requests.post(
        url,
        headers=nocodb_headers(),
        data=json.dumps(records),
        timeout=30,
    )

    if not response.ok:
        raise HTTPException(
            status_code=response.status_code,
            detail={
                "message": "NocoDB write failed",
                "response_text": response.text,
                "url": url,
            },
        )

    try:
        return response.json()
    except Exception:
        return {"message": "Created, but response was not JSON", "raw": response.text}


class SupportAlert(BaseModel):
    support_alert_id: str
    source_queue: str
    source_record_id: str
    company_uid: str
    alert_type: str
    priority: str
    status: str
    title: str
    why_this_matters: Optional[str] = None
    suggested_action: Optional[str] = None
    created_at: str
    resolved_at: Optional[str] = None
    owner_internal_user_id: Optional[str] = None
    ai_generated: bool = True


class SupportCaseAIState(BaseModel):
    case_ai_id: str
    source_queue: str
    source_record_id: str
    company_uid: str
    ai_summary: Optional[str] = None
    triage_note: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    customer_intent: Optional[str] = None
    product_area: Optional[str] = None
    similar_case_ids: Optional[str] = None
    suggested_action: Optional[str] = None
    escalation_needed: Optional[bool] = None
    draft_reply: Optional[str] = None
    last_ai_updated_at: str
    human_review_status: Optional[str] = "pending"


class SupportAlertCreateRequest(BaseModel):
    records: List[SupportAlert] = Field(..., min_length=1)


class SupportCaseAIStateCreateRequest(BaseModel):
    records: List[SupportCaseAIState] = Field(..., min_length=1)


@app.get("/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "nocodb_base_url": NOCODB_BASE_URL,
        "support_alerts_table_id_configured": bool(SUPPORT_ALERTS_TABLE_ID),
        "support_case_ai_state_table_id_configured": bool(SUPPORT_CASE_AI_STATE_TABLE_ID),
    }


@app.post("/support-alerts/create")
def create_support_alerts(payload: SupportAlertCreateRequest) -> Dict[str, Any]:
    created = post_records_to_nocodb(
        SUPPORT_ALERTS_TABLE_ID,
        [record.model_dump(exclude_none=True) for record in payload.records],
    )
    return {
        "message": "support_alerts created",
        "count": len(payload.records),
        "nocodb_response": created,
    }


@app.post("/support-case-ai-state/create")
def create_support_case_ai_state(payload: SupportCaseAIStateCreateRequest) -> Dict[str, Any]:
    created = post_records_to_nocodb(
        SUPPORT_CASE_AI_STATE_TABLE_ID,
        [record.model_dump(exclude_none=True) for record in payload.records],
    )
    return {
        "message": "support_case_ai_state created",
        "count": len(payload.records),
        "nocodb_response": created,
    }