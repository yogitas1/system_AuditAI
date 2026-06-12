from fastapi import APIRouter, HTTPException
from api.database import get_connection, get_cursor

router = APIRouter()


@router.get("/api/dashboard")
def get_dashboard():
    conn = get_connection()
    try:
        cur = get_cursor(conn)

        cur.execute("""
            SELECT id, batch_number, line, parameter, measured_value,
                   spec_min, spec_max, recorded_at, status
            FROM batch_records
            ORDER BY recorded_at
        """)
        batch_rows = cur.fetchall()

        result = []
        for b in batch_rows:
            batch = {
                "id": str(b["id"]),
                "batch_number": b["batch_number"],
                "line": b["line"],
                "parameter": b["parameter"],
                "measured_value": float(b["measured_value"]),
                "spec_min": float(b["spec_min"]),
                "spec_max": float(b["spec_max"]),
                "recorded_at": b["recorded_at"].isoformat() if b["recorded_at"] else None,
                "status": b["status"],
                "findings": [],
            }

            cur.execute("""
                SELECT id, title, description, regulatory_refs, severity, created_at
                FROM findings WHERE batch_record_id = %s ORDER BY created_at
            """, (b["id"],))

            for f in cur.fetchall():
                finding = {
                    "id": str(f["id"]),
                    "title": f["title"],
                    "description": f["description"],
                    "regulatory_refs": f["regulatory_refs"] or [],
                    "severity": f["severity"],
                    "created_at": f["created_at"].isoformat() if f["created_at"] else None,
                    "capas": [],
                }

                cur.execute("""
                    SELECT id, root_cause, containment_action, corrective_action,
                           regulatory_context, precedent_summary, status, drafted_at
                    FROM capas WHERE finding_id = %s ORDER BY drafted_at
                """, (f["id"],))

                for c in cur.fetchall():
                    capa = {
                        "id": str(c["id"]),
                        "root_cause": c["root_cause"],
                        "containment_action": c["containment_action"],
                        "corrective_action": c["corrective_action"],
                        "regulatory_context": c["regulatory_context"],
                        "precedent_summary": c["precedent_summary"],
                        "status": c["status"],
                        "drafted_at": c["drafted_at"].isoformat() if c["drafted_at"] else None,
                        "approvals": [],
                    }

                    cur.execute("""
                        SELECT id, approver, decision, notes, decided_at
                        FROM approvals WHERE capa_id = %s ORDER BY decided_at
                    """, (c["id"],))

                    for a in cur.fetchall():
                        capa["approvals"].append({
                            "id": str(a["id"]),
                            "approver": a["approver"],
                            "decision": a["decision"],
                            "notes": a["notes"],
                            "decided_at": a["decided_at"].isoformat() if a["decided_at"] else None,
                        })

                    finding["capas"].append(capa)

                batch["findings"].append(finding)

            result.append(batch)

        return {"batch_records": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
