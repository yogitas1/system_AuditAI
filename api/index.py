from dotenv import load_dotenv
load_dotenv()

# Inject Windows cert store so httpx/requests can reach external APIs
# (handles corporate SSL inspection proxies)
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import dashboard, detect, draft_capa, approve

app = FastAPI(title="AuditAI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(detect.router)
app.include_router(draft_capa.router)
app.include_router(approve.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
