import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.database import get_connection, get_cursor
from api.helpers.mem0_client import store_precedent

router = APIRouter()
logger = logging.getLogger(__name__)


class ApprovalRequest(BaseModel):
    approver: str
    decision: str
    notes: str = ""


@router.post("/api/approve/{capa_id}")
def approve_capa(capa_id: str, body: ApprovalRequest):
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'")

    conn = get_connection()
    try:
        cur = get_cursor(conn)

        cur.execute("""
            SELECT c.id, c.root_cause, c.corrective_action, c.status,
                   f.title, f.severity,
                   b.id AS batch_id, b.batch_number, b.parameter, b.line
            FROM capas c
            JOIN findings f ON c.finding_id = f.id
            JOIN batch_records b ON f.batch_record_id = b.id
            WHERE c.id = %s
        """, (capa_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="CAPA not found")

        cur.execute("""
            INSERT INTO approvals (capa_id, approver, decision, notes)
            VALUES (%s, %s, %s, %s)
            RETURNING id, decided_at
        """, (capa_id, body.approver, body.decision, body.notes))
        approval = cur.fetchone()

        cur.execute("UPDATE capas SET status = %s WHERE id = %s", (body.decision, capa_id))

        if body.decision == "approved":
            cur.execute(
                "UPDATE batch_records SET status = 'reviewed' WHERE id = %s",
                (row["batch_id"],),
            )

        conn.commit()

        if body.decision == "approved":
            try:
                summary = (
                    f"Approved CAPA for {row['parameter']} deviation on {row['line']} "
                    f"(batch {row['batch_number']}). Finding: {row['title']}. "
                    f"Root cause: {row['root_cause']}. "
                    f"Corrective action: {row['corrective_action']}."
                )
                store_precedent(summary, {
                    "parameter": row["parameter"],
                    "line": row["line"],
                    "batch": row["batch_number"],
                    "severity": row["severity"],
                })
            except Exception as mem_err:
                logger.warning("mem0 write failed: %s", mem_err)

        return {
            "message": f"CAPA {body.decision}",
            "capa_id": capa_id,
            "approval": {
                "id": str(approval["id"]),
                "approver": body.approver,
                "decision": body.decision,
                "notes": body.notes,
                "decided_at": approval["decided_at"].isoformat() if approval["decided_at"] else None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
