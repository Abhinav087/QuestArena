import json
import os

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database import get_db
from models import Player, SessionModel
from services.leaderboard import get_leaderboard
from services.realtime import manager

router = APIRouter(tags=["session"])

_questions_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "questions.json")
with open(_questions_path, "r", encoding="utf-8") as file:
    QUESTIONS = json.load(file)


def get_current_session(db: Session) -> SessionModel | None:
    return (
        db.query(SessionModel)
        .filter(SessionModel.status.in_(["waiting", "running", "paused"]))
        .order_by(SessionModel.created_at.desc())
        .first()
    )


@router.get("/api/game_status")
async def game_status(db: Session = Depends(get_db)):
    session = get_current_session(db)
    if not session:
        latest = db.query(SessionModel).order_by(SessionModel.created_at.desc()).first()
        if latest:
            player_count = (
                db.query(Player)
                .filter(Player.session_id == latest.id, Player.is_banned.is_(False))
                .count()
            )
            return {
                "session_id": latest.id,
                "name": latest.name,
                "status": latest.status,
                "remaining_seconds": latest.remaining_seconds,
                "duration_minutes": latest.duration_minutes,
                "player_count": player_count,
            }
        return {
            "session_id": None,
            "name": None,
            "status": "waiting",
            "remaining_seconds": 0,
            "duration_minutes": 0,
            "player_count": 0,
        }

    player_count = (
        db.query(Player)
        .filter(Player.session_id == session.id, Player.is_banned.is_(False))
        .count()
    )

    return {
        "session_id": session.id,
        "name": session.name,
        "status": session.status,
        "remaining_seconds": session.remaining_seconds,
        "duration_minutes": session.duration_minutes,
        "player_count": player_count,
    }


@router.get("/api/questions/{level}")
async def get_questions(level: int, path: str | None = None):
    key = str(level)
    if key not in QUESTIONS:
        raise HTTPException(status_code=404, detail="Level not found")

    level_data = QUESTIONS[key]

    if level in (2, 3):
        if path in ("easy", "hard"):
            return {"questions": level_data[path], "title": level_data["title"]}
        return {
            "message": "Choose path",
            "paths": ["easy", "hard"],
            "title": level_data["title"],
        }

    if level == 1 and path == "backlog_king":
        return {"questions": level_data["hidden_route"]["questions"], "title": "Backlog King Route"}

    if "questions" in level_data:
        return {"questions": level_data["questions"], "title": level_data["title"]}

    if "question" in level_data:
        return {"question": level_data["question"], "title": level_data["title"]}

    return level_data


@router.get("/api/leaderboard")
async def leaderboard(db: Session = Depends(get_db)):
    session = get_current_session(db)
    if not session:
        return []
    return get_leaderboard(session)


@router.websocket("/ws/live")
async def live_ws(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
