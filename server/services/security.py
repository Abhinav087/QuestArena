import os
from datetime import datetime, timedelta
from typing import Any, Dict

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import Player

JWT_SECRET = os.getenv("QUESTARENA_JWT_SECRET", "questarena-dev-secret")
JWT_ALGO = "HS256"
PLAYER_TOKEN_HOURS = 10
ADMIN_TOKEN_HOURS = 12

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/unused", auto_error=False)


def create_player_token(player_id: int, session_id: int, username: str) -> str:
    payload = {
        "sub": str(player_id),
        "session_id": session_id,
        "username": username,
        "role": "player",
        "exp": datetime.utcnow() + timedelta(hours=PLAYER_TOKEN_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def create_admin_token() -> str:
    payload = {
        "role": "admin",
        "exp": datetime.utcnow() + timedelta(hours=ADMIN_TOKEN_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def get_current_player(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Player:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    payload = decode_token(token)
    if payload.get("role") != "player":
        raise HTTPException(status_code=401, detail="Invalid player token")

    player_id = payload.get("sub")
    player = db.query(Player).filter(Player.id == int(player_id)).first() if player_id else None
    if not player:
        raise HTTPException(status_code=401, detail="Player not found")
    if player.is_banned:
        raise HTTPException(status_code=403, detail="Player is banned")
    if player.auth_token != token:
        raise HTTPException(status_code=401, detail="Token no longer valid")

    return player


def require_admin(token: str) -> Dict[str, Any]:
    payload = decode_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Admin token required")
    return payload
