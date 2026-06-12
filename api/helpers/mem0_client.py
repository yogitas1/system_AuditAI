import logging
import os

logger = logging.getLogger(__name__)
USER_ID = "auditai-veridian-medtech"


def _client():
    from mem0 import MemoryClient
    return MemoryClient(api_key=os.environ.get("MEM0_API_KEY"))


def search_precedents(parameter: str, line: str) -> str | None:
    try:
        results = _client().search(
            f"CAPA precedent for {parameter} deviation on {line}",
            user_id=USER_ID,
        )
        memories = [r["memory"] for r in (results or [])[:3] if "memory" in r]
        return "\n".join(memories) if memories else None
    except Exception as exc:
        logger.warning("mem0 search failed: %s", exc)
        return None


def store_precedent(summary: str, metadata: dict) -> None:
    try:
        _client().add(
            [{"role": "user", "content": summary}],
            user_id=USER_ID,
            metadata=metadata,
        )
    except Exception as exc:
        logger.warning("mem0 store failed: %s", exc)
