import json
import logging
import os

from fastapi import APIRouter, HTTPException
from openai import OpenAI

from api.database import get_connection, get_cursor
from api.helpers.composio_client import post_capa_to_slack
from api.helpers.mem0_client import search_precedents
from api.helpers.tavily_client import search_regulatory_context

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/api/draft-capa/{finding_id}")
def draft_capa(finding_id: str):
    conn = get_connection()
    try:
        cur = get_cursor(conn)

        cur.execute("""
            SELECT f.id, f.title, f.description, f.regulatory_refs, f.severity,
                   b.id  AS batch_id,  b.batch_number, b.line, b.parameter,
                   b.measured_value, b.spec_min, b.spec_max
            FROM findings f
            JOIN batch_records b ON f.batch_record_id = b.id
            WHERE f.id = %s
        """, (finding_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Finding not found")

        finding = dict(row)
        finding["id"] = str(finding["id"])
        finding["batch_id"] = str(finding["batch_id"])
        finding["measured_value"] = float(finding["measured_value"])
        finding["spec_min"] = float(finding["spec_min"])
        finding["spec_max"] = float(finding["spec_max"])

        # Step 1: mem0 precedent search
        precedent_summary = search_precedents(finding["parameter"], finding["line"])

        # Step 2: Tavily regulatory context
        regulatory_context = search_regulatory_context(
            "staple formation height deviation surgical stapler FDA guidance corrective action CAPA"
        )

        # Step 3: OpenAI CAPA draft
        context_parts = []
        if precedent_summary:
            context_parts.append(f"Prior CAPA Precedents:\n{precedent_summary}")
        if regulatory_context:
            context_parts.append(f"Recent Regulatory Context:\n{regulatory_context}")
        context_block = "\n\n".join(context_parts) or "No prior precedents found."

        prompt = f"""You are a medical device quality compliance expert. Draft a CAPA for this finding.

FINDING:
Title: {finding["title"]}
Description: {finding["description"]}
Batch: {finding["batch_number"]} | Line: {finding["line"]} | Parameter: {finding["parameter"]}
Measured: {finding["measured_value"]}mm vs Spec: {finding["spec_min"]}–{finding["spec_max"]}mm
Severity: {finding["severity"]}
Regulatory Refs: {", ".join(finding["regulatory_refs"] or [])}

CONTEXT:
{context_block}

Return a JSON object with exactly these fields:
- root_cause: specific root cause hypothesis (2-3 sentences, cite regulatory basis)
- containment_action: immediate containment steps (2-3 sentences)
- corrective_action: systemic corrective actions to prevent recurrence (3-4 sentences, reference 21 CFR 820.100 requirements)"""

        client = OpenAI(api_key=os.environ.get("OpenAI_API_Key"))
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        capa_data = json.loads(response.choices[0].message.content)

        # Step 4: Insert CAPA
        cur.execute("""
            INSERT INTO capas
                (finding_id, root_cause, containment_action, corrective_action,
                 regulatory_context, precedent_summary, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending_approval')
            RETURNING id, root_cause, containment_action, corrective_action,
                      regulatory_context, precedent_summary, status, drafted_at
        """, (
            finding_id,
            capa_data["root_cause"],
            capa_data["containment_action"],
            capa_data["corrective_action"],
            regulatory_context,
            precedent_summary,
        ))
        c = cur.fetchone()
        conn.commit()

        capa = {
            "id": str(c["id"]),
            "finding_id": finding_id,
            "root_cause": c["root_cause"],
            "containment_action": c["containment_action"],
            "corrective_action": c["corrective_action"],
            "regulatory_context": c["regulatory_context"],
            "precedent_summary": c["precedent_summary"],
            "status": c["status"],
            "drafted_at": c["drafted_at"].isoformat() if c["drafted_at"] else None,
        }

        # Step 5: Slack notification (non-blocking)
        try:
            post_capa_to_slack(capa, finding)
        except Exception as slack_err:
            logger.warning("Slack notification failed: %s", slack_err)

        return {"message": "CAPA drafted and submitted for QA approval", "capa": capa}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
