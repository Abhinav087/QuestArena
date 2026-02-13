import json
from datetime import datetime

from models import Player, SessionModel


def _player_time_taken_seconds(player: Player, session: SessionModel) -> int:
    if not session.start_time:
        return 0

    end_time = player.completed_at if player.completed_at else datetime.utcnow()
    return max(0, int((end_time - session.start_time).total_seconds()))


def _serialize_player(player: Player, session: SessionModel) -> dict:
    time_taken_seconds = _player_time_taken_seconds(player, session)

    return {
        "player_id": player.id,
        "username": player.username,
        "score": player.score,
        "current_level": player.current_level,
        "time_taken_seconds": time_taken_seconds,
        "is_completed": bool(player.completed_at),
    }


def get_leaderboard(session: SessionModel) -> list[dict]:
    if session.leaderboard_frozen and session.frozen_snapshot:
        try:
            return json.loads(session.frozen_snapshot)
        except json.JSONDecodeError:
            return []

    rows = [_serialize_player(player, session) for player in session.players if not player.is_banned]
    rows.sort(
        key=lambda item: (
            -item["score"],
            item["time_taken_seconds"],
            item["username"].lower(),
        )
    )
    return rows


def set_leaderboard_freeze(session: SessionModel, frozen: bool) -> None:
    session.leaderboard_frozen = frozen
    if frozen:
        session.frozen_snapshot = json.dumps(get_leaderboard(session))
    else:
        session.frozen_snapshot = None


def analytics_for_session(session: SessionModel) -> dict:
    players = [p for p in session.players if not p.is_banned]
    if not players:
        return {
            "session_name": session.name,
            "total_participants": 0,
            "top_player": None,
            "generated_at": datetime.utcnow().isoformat(),
        }

    ranked = [
        {
            "username": player.username,
            "score": player.score,
            "time_taken_seconds": _player_time_taken_seconds(player, session),
        }
        for player in players
    ]
    ranked.sort(key=lambda item: (-item["score"], item["time_taken_seconds"], item["username"].lower()))
    top = ranked[0] if ranked else None

    return {
        "session_name": session.name,
        "total_participants": len(players),
        "top_player": top,
        "generated_at": datetime.utcnow().isoformat(),
    }
