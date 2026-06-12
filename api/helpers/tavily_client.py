import logging
import os

logger = logging.getLogger(__name__)


def search_regulatory_context(query: str) -> str | None:
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))
        response = client.search(query, search_depth="basic", max_results=3)
        results = response.get("results", [])
        snippets = [r["content"][:500] for r in results[:2] if r.get("content")]
        return " ".join(snippets) if snippets else None
    except Exception as exc:
        logger.warning("Tavily search failed: %s", exc)
        return None
