from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from models import Log, Player, PlayerQuestionClear, SessionModel
from schemas import AdminLoginRequest, RegisterRequest, ValidateTokenRequest
from services.security import create_admin_token, create_player_token, decode_token

router = APIRouter(prefix="/api", tags=["auth"])
ADMIN_PASSWORD = "arena2026"


def _get_live_session(db: Session) -> SessionModel | None:
    return (
        db.query(SessionModel)
        .filter(SessionModel.status.in_(["waiting", "running", "paused"]))
        .order_by(SessionModel.created_at.desc())
        .first()
    )


@router.post("/admin_login")
async def admin_login(body: AdminLoginRequest):
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"token": create_admin_token()}


@router.post("/player/register")
async def register_player(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    active_session = _get_live_session(db)
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session. Ask admin to create one.")

    ip_address = request.client.host if request.client else "unknown"
    baseline_join_time = (
        active_session.start_time
        if active_session.status == "running" and active_session.start_time
        else datetime.utcnow()
    )
    existing = db.query(Player).filter(Player.username == username).first()

    if existing:
        if existing.is_banned:
            raise HTTPException(status_code=403, detail="Player is banned")

        if existing.session_id != active_session.id:
            db.query(PlayerQuestionClear).filter(PlayerQuestionClear.player_id == existing.id).delete()
            existing.session_id = active_session.id
            existing.score = 0
            existing.current_level = 0
            existing.join_time = baseline_join_time
            existing.completed_at = None
            existing.is_active = False
            existing.auth_token = None

        if existing.is_active and existing.auth_token:
            raise HTTPException(status_code=409, detail="Username already active on another device")

        token = create_player_token(existing.id, existing.session_id, existing.username)
        existing.auth_token = token
        existing.last_active = datetime.utcnow()
        existing.is_active = True
        existing.ip_address = ip_address
        db.add(
            Log(
                session_id=active_session.id,
                player_id=existing.id,
                action_type="player_rejoin",
                details=f"Rejoined from {ip_address}",
            )
        )
        db.commit()
        db.refresh(existing)

        return {
            "token": token,
            "session_id": active_session.id,
            "username": existing.username,
            "score": existing.score,
            "current_level": existing.current_level,
            "remaining_seconds": active_session.remaining_seconds,
            "status": active_session.status,
        }

    player = Player(
        username=username,
        session_id=active_session.id,
        score=0,
        current_level=0,
        join_time=baseline_join_time,
        last_active=datetime.utcnow(),
        ip_address=ip_address,
        is_active=True,
        is_banned=False,
    )
    db.add(player)
    db.flush()

    token = create_player_token(player.id, player.session_id, player.username)
    player.auth_token = token

    db.add(
        Log(
            session_id=active_session.id,
            player_id=player.id,
            action_type="player_join",
            details=f"Joined from {ip_address}",
        )
    )
    db.commit()
    db.refresh(player)

    return {
        "token": token,
        "session_id": active_session.id,
        "username": player.username,
        "score": player.score,
        "current_level": player.current_level,
        "remaining_seconds": active_session.remaining_seconds,
        "status": active_session.status,
    }


@router.post("/validate-token")
async def validate_token(body: ValidateTokenRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.token)
    if payload.get("role") != "player":
        raise HTTPException(status_code=401, detail="Invalid token role")

    player_id = payload.get("sub")
    if not player_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    player = db.query(Player).filter(Player.id == int(player_id)).first()
    if not player:
        raise HTTPException(status_code=401, detail="Player not found")
    if player.is_banned:
        raise HTTPException(status_code=403, detail="Player is banned")
    if player.auth_token != body.token:
        raise HTTPException(status_code=401, detail="Token expired due to another login")

    session = db.query(SessionModel).filter(SessionModel.id == player.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "ended":
        player.auth_token = None
        player.is_active = False
        db.commit()
        raise HTTPException(status_code=401, detail="Session ended. Please join the current session.")

    player.last_active = datetime.utcnow()
    player.is_active = True
    db.commit()

    return {
        "valid": True,
        "username": player.username,
        "session_id": player.session_id,
        "score": player.score,
        "current_level": player.current_level,
        "remaining_seconds": session.remaining_seconds,
        "session_status": session.status,
    }
