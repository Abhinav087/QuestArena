import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Log, Player, SessionModel
from schemas import (
    AdjustScoreRequest,
    CreateSessionRequest,
    FreezeLeaderboardRequest,
    MoveLevelRequest,
    TimeAdjustRequest,
)
from services.anti_cheat import duplicate_ip_map
from services.leaderboard import (
    analytics_for_session,
    compute_time_taken_seconds,
    get_leaderboard,
    set_leaderboard_freeze,
)
from services.realtime import manager
from services.security import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _extract_admin_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing admin bearer token")
    return authorization.split(" ", 1)[1].strip()


def _verify_admin(authorization: str | None) -> None:
    token = _extract_admin_token(authorization)
    require_admin(token)


def _current_live_session(db: Session) -> SessionModel | None:
    return (
        db.query(SessionModel)
        .filter(SessionModel.status.in_(["waiting", "running", "paused"]))
        .order_by(SessionModel.created_at.desc())
        .first()
    )


def _log(db: Session, session_id: int, action_type: str, details: str, player_id: int | None = None):
    db.add(
        Log(
            session_id=session_id,
            player_id=player_id,
            action_type=action_type,
            details=details,
        )
    )


@router.post("/session/create")
async def create_session(
    body: CreateSessionRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)

    live = _current_live_session(db)
    if live:
        live.status = "ended"
        live.end_time = datetime.utcnow()
        _log(db, live.id, "session_ended", "Auto-ended due to new session creation")

    session = SessionModel(
        name=body.name.strip(),
        duration_minutes=body.duration_minutes,
        remaining_seconds=body.duration_minutes * 60,
        status="waiting",
        created_at=datetime.utcnow(),
    )
    db.add(session)
    db.flush()
    _log(db, session.id, "session_created", f"Session '{session.name}' created")
    db.commit()
    db.refresh(session)

    await manager.broadcast(
        "session_update",
        {
            "session_id": session.id,
            "status": session.status,
            "remaining_seconds": session.remaining_seconds,
            "duration_minutes": session.duration_minutes,
        },
    )

    return {
        "id": session.id,
        "name": session.name,
        "status": session.status,
        "duration_minutes": session.duration_minutes,
        "remaining_seconds": session.remaining_seconds,
    }


@router.post("/session/start")
async def start_session(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session:
        raise HTTPException(status_code=404, detail="No session found")
    if session.status == "ended":
        raise HTTPException(status_code=400, detail="Cannot start an ended session")

    session.status = "running"
    if not session.start_time:
        session.start_time = datetime.utcnow()
    _log(db, session.id, "session_started", "Session started")
    db.commit()

    await manager.broadcast(
        "session_update",
        {
            "session_id": session.id,
            "status": session.status,
            "remaining_seconds": session.remaining_seconds,
            "duration_minutes": session.duration_minutes,
        },
    )
    return {"ok": True}


@router.post("/session/pause")
async def pause_session(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session or session.status != "running":
        raise HTTPException(status_code=400, detail="No running session to pause")
    session.status = "paused"
    _log(db, session.id, "session_paused", "Session paused")
    db.commit()

    await manager.broadcast(
        "session_update",
        {
            "session_id": session.id,
            "status": session.status,
            "remaining_seconds": session.remaining_seconds,
            "duration_minutes": session.duration_minutes,
        },
    )
    return {"ok": True}


@router.post("/session/resume")
async def resume_session(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session or session.status != "paused":
        raise HTTPException(status_code=400, detail="No paused session to resume")
    session.status = "running"
    _log(db, session.id, "session_resumed", "Session resumed")
    db.commit()

    await manager.broadcast(
        "session_update",
        {
            "session_id": session.id,
            "status": session.status,
            "remaining_seconds": session.remaining_seconds,
            "duration_minutes": session.duration_minutes,
        },
    )
    return {"ok": True}


@router.post("/session/add_time")
async def add_time(
    body: TimeAdjustRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session:
        raise HTTPException(status_code=404, detail="No active session")

    session.remaining_seconds += body.minutes * 60
    _log(db, session.id, "session_time_adjusted", f"+{body.minutes} minutes")
    db.commit()

    await manager.broadcast(
        "session_update",
        {
            "session_id": session.id,
            "status": session.status,
            "remaining_seconds": session.remaining_seconds,
            "duration_minutes": session.duration_minutes,
        },
    )
    return {"ok": True, "remaining_seconds": session.remaining_seconds}


@router.post("/session/subtract_time")
async def subtract_time(
    body: TimeAdjustRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session:
        raise HTTPException(status_code=404, detail="No active session")

    session.remaining_seconds = max(0, session.remaining_seconds - (body.minutes * 60))
    if session.remaining_seconds == 0:
        session.status = "ended"
        session.end_time = datetime.utcnow()
    _log(db, session.id, "session_time_adjusted", f"-{body.minutes} minutes")
    db.commit()

    await manager.broadcast(
        "session_update",
        {
            "session_id": session.id,
            "status": session.status,
            "remaining_seconds": session.remaining_seconds,
            "duration_minutes": session.duration_minutes,
        },
    )
    return {"ok": True, "remaining_seconds": session.remaining_seconds}


@router.post("/session/end")
async def force_end_session(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session:
        raise HTTPException(status_code=404, detail="No active session")

    session.status = "ended"
    session.end_time = datetime.utcnow()
    session.remaining_seconds = 0
    _log(db, session.id, "session_ended", "Force ended by admin")
    db.commit()

    await manager.broadcast(
        "session_update",
        {
            "session_id": session.id,
            "status": session.status,
            "remaining_seconds": session.remaining_seconds,
            "duration_minutes": session.duration_minutes,
        },
    )
    return {"ok": True}


@router.get("/sessions")
async def list_sessions(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    rows = db.query(SessionModel).order_by(SessionModel.created_at.desc()).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "status": row.status,
            "start_time": row.start_time.isoformat() if row.start_time else None,
            "end_time": row.end_time.isoformat() if row.end_time else None,
            "duration_minutes": row.duration_minutes,
            "remaining_seconds": row.remaining_seconds,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status in ("running", "paused", "waiting"):
        raise HTTPException(status_code=400, detail="Cannot delete live session")

    db.delete(session)
    db.commit()
    return {"ok": True}


@router.get("/players/live")
async def live_players(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session:
        return []

    players = db.query(Player).filter(Player.session_id == session.id).all()
    dup_map = duplicate_ip_map(players)
    now = datetime.utcnow()

    return [
        {
            "id": player.id,
            "username": player.username,
            "score": player.score,
            "current_level": player.current_level,
            "time_taken_seconds": compute_time_taken_seconds(player, session),
            "is_completed": bool(player.completed_at),
            "last_active_seconds_ago": (
                max(0, int((now - player.last_active).total_seconds()))
                if player.last_active
                else None
            ),
            "ip_address": player.ip_address,
            "is_active": player.is_active,
            "is_banned": player.is_banned,
            "duplicate_ip": bool(player.ip_address and dup_map.get(player.ip_address, 0) > 1),
        }
        for player in players
    ]


@router.post("/player/{player_id}/kick")
async def kick_player(
    player_id: int,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.is_active = False
    player.auth_token = None
    _log(db, player.session_id, "player_kick", f"Player {player.username} kicked", player_id=player.id)
    db.commit()
    return {"ok": True}


@router.post("/player/{player_id}/ban")
async def ban_player(
    player_id: int,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.is_banned = True
    player.is_active = False
    player.auth_token = None
    _log(db, player.session_id, "player_ban", f"Player {player.username} banned", player_id=player.id)
    db.commit()
    return {"ok": True}


@router.post("/player/{player_id}/reset")
async def reset_player_progress(
    player_id: int,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.score = 0
    player.current_level = 0
    player.completed_at = None
    _log(db, player.session_id, "player_reset", "Progress reset", player_id=player.id)
    db.commit()
    return {"ok": True}


@router.post("/player/{player_id}/move-level")
async def move_player_level(
    player_id: int,
    body: MoveLevelRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.current_level = body.level
    _log(db, player.session_id, "player_move_level", f"Moved to {body.level}", player_id=player.id)
    db.commit()
    return {"ok": True}


@router.post("/player/{player_id}/adjust-score")
async def adjust_player_score(
    player_id: int,
    body: AdjustScoreRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.score += body.delta
    _log(db, player.session_id, "player_score_adjust", f"Score delta {body.delta}", player_id=player.id)
    db.commit()
    return {"ok": True, "new_score": player.score}


@router.post("/leaderboard/freeze")
async def freeze_leaderboard(
    body: FreezeLeaderboardRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = _current_live_session(db)
    if not session:
        raise HTTPException(status_code=404, detail="No active session")

    set_leaderboard_freeze(session, body.frozen)
    _log(db, session.id, "leaderboard_freeze", f"Frozen={body.frozen}")
    db.commit()

    await manager.broadcast(
        "leaderboard_update",
        {
            "session_id": session.id,
            "frozen": session.leaderboard_frozen,
            "rows": get_leaderboard(session),
        },
    )

    return {"ok": True, "frozen": session.leaderboard_frozen}


@router.get("/analytics/{session_id}")
async def analytics(
    session_id: int,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return analytics_for_session(session)


@router.get("/export/{session_id}")
async def export_csv(
    session_id: int,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _verify_admin(authorization)
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = get_leaderboard(session)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["rank", "username", "score", "current_level", "time_taken_seconds"])
    for index, row in enumerate(rows, start=1):
        writer.writerow(
            [
                index,
                row["username"],
                row["score"],
                row["current_level"],
                row.get("time_taken_seconds"),
            ]
        )

    filename = f"questarena_session_{session_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
