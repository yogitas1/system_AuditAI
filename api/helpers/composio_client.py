import logging
import os

logger = logging.getLogger(__name__)

_SEVERITY_EMOJI = {"low": "🟡", "medium": "🟠", "high": "🔴", "critical": "🚨"}


def post_capa_to_slack(capa: dict, finding: dict) -> None:
    from composio_client import Composio

    emoji = _SEVERITY_EMOJI.get(finding.get("severity", ""), "⚠️")
    refs = ", ".join(finding.get("regulatory_refs") or [])

    text = (
        f"🔔 *AuditAI CAPA Draft — Pending QA Approval*\n\n"
        f"{emoji} *Severity:* {finding.get('severity', '').upper()}\n"
        f"*Batch:* {finding.get('batch_number')}  |  "
        f"*Line:* {finding.get('line')}  |  "
        f"*Parameter:* {finding.get('parameter')}\n"
        f"*Deviation:* Measured {finding.get('measured_value')}mm "
        f"vs spec {finding.get('spec_min')}–{finding.get('spec_max')}mm\n\n"
        f"*📋 Finding:* {finding.get('title')}\n\n"
        f"*🔍 Root Cause:* {capa.get('root_cause')}\n\n"
        f"*🛡️ Containment:* {capa.get('containment_action')}\n\n"
        f"*✅ Corrective Action:* {capa.get('corrective_action')}\n\n"
        f"*Regulatory Refs:* {refs}\n\n"
        f"👉 Open the AuditAI Dashboard to review and approve this CAPA.\n"
        f"_Human approval required before corrective action is initiated._"
    )

    client = Composio(api_key=os.environ.get("COMPOSIO_API_KEY"))
    client.tools.execute(
        tool_slug="SLACK_SENDS_A_MESSAGE_AS_THE_APP",
        arguments={"channel": "general", "text": text},
        connected_account_id=os.environ.get("COMPOSIO_SLACK_CONNECTION_ID"),
    )
