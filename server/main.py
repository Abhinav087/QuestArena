import asyncio
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from database import Base, SessionLocal, engine, ensure_performance_indexes
from models import SessionModel
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.player import router as player_router
from routes.session import router as session_router
from services.timer import timer_loop

logging.getLogger("websockets.protocol").setLevel(logging.CRITICAL)
logging.getLogger("websockets.server").setLevel(logging.CRITICAL)

app = FastAPI(title="QuestArena v2", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(player_router)
app.include_router(session_router)

_timer_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup() -> None:
    global _timer_task

    Base.metadata.create_all(bind=engine)
    ensure_performance_indexes()
    db = SessionLocal()
    try:
        live = (
            db.query(SessionModel)
            .filter(SessionModel.status.in_(["waiting", "running", "paused"]))
            .order_by(SessionModel.created_at.desc())
            .first()
        )
        if not live:
            db.add(
                SessionModel(
                    name="Default Session",
                    duration_minutes=30,
                    remaining_seconds=30 * 60,
                    status="waiting",
                )
            )
            db.commit()
    finally:
        db.close()

    _timer_task = asyncio.create_task(timer_loop())


@app.on_event("shutdown")
async def shutdown() -> None:
    global _timer_task
    if _timer_task:
        _timer_task.cancel()
        _timer_task = None


@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    admin_path = os.path.join(os.path.dirname(__file__), "admin.html")
    if not os.path.exists(admin_path):
        raise HTTPException(status_code=404, detail="Admin page not found")
    with open(admin_path, "r", encoding="utf-8") as file:
        return HTMLResponse(content=file.read())


client_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "client")
if os.path.exists(client_path):
    app.mount("/", StaticFiles(directory=client_path, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
