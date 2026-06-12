import json
import os

from fastapi import APIRouter, HTTPException
from openai import OpenAI

from api.database import get_connection, get_cursor

router = APIRouter()


@router.post("/api/detect")
def detect_deviations():
    conn = get_connection()
    try:
        cur = get_cursor(conn)
        cur.execute("""
            SELECT id, batch_number, line, parameter, measured_value, spec_min, spec_max
            FROM batch_records
            WHERE status = 'pending'
              AND (measured_value < spec_min OR measured_value > spec_max)
        """)
        deviations = cur.fetchall()

        if not deviations:
            return {"message": "No deviations found", "findings": []}

        client = OpenAI(api_key=os.environ.get("OpenAI_API_Key"))
        created = []

        for b in deviations:
            measured = float(b["measured_value"])
            spec_max = float(b["spec_max"])
            spec_min = float(b["spec_min"])
            pct_over = ((measured - spec_max) / spec_max * 100) if measured > spec_max else 0

            prompt = f"""You are a medical device quality compliance expert (FDA 21 CFR Part 820, ISO 13485).

Analyze this batch deviation and return a JSON object with exactly these fields:
- title: concise finding title (max 100 chars)
- description: 2-3 sentence description of the deviation and its patient-safety significance
- severity: one of "low", "medium", "high", "critical"
- regulatory_refs: array of relevant citations from ["21 CFR 820.100", "ISO 13485:8.5.2", "21 CFR 820.30"]

Batch: {b["batch_number"]}
Production Line: {b["line"]}
Parameter: {b["parameter"]}
Measured: {measured}mm  |  Spec: {spec_min}–{spec_max}mm
Deviation: {pct_over:.1f}% over upper tolerance (Class II medical device — surgical stapler cartridge)"""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            data = json.loads(response.choices[0].message.content)

            cur.execute("""
                INSERT INTO findings (batch_record_id, title, description, regulatory_refs, severity)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, title, description, regulatory_refs, severity, created_at
            """, (
                b["id"],
                data["title"],
                data["description"],
                data["regulatory_refs"],
                data["severity"],
            ))
            f = cur.fetchone()

            cur.execute("UPDATE batch_records SET status = 'flagged' WHERE id = %s", (b["id"],))
            conn.commit()

            created.append({
                "id": str(f["id"]),
                "batch_number": b["batch_number"],
                "title": f["title"],
                "description": f["description"],
                "regulatory_refs": f["regulatory_refs"],
                "severity": f["severity"],
                "created_at": f["created_at"].isoformat() if f["created_at"] else None,
            })

        return {"message": f"Created {len(created)} finding(s)", "findings": created}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
