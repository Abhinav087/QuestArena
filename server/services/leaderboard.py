import json
from datetime import datetime

from models import Player, SessionModel


def _serialize_player(player: Player) -> dict:
    completion_seconds = None
    if player.completed_at:
        completion_seconds = max(
            0,
            int((player.completed_at - player.join_time).total_seconds()),
        )

    return {
        "player_id": player.id,
        "username": player.username,
        "score": player.score,
        "current_level": player.current_level,
        "join_time": player.join_time.isoformat() if player.join_time else None,
        "last_active": player.last_active.isoformat() if player.last_active else None,
        "ip_address": player.ip_address,
        "is_active": player.is_active,
        "is_banned": player.is_banned,
        "completion_seconds": completion_seconds,
    }


def get_leaderboard(session: SessionModel) -> list[dict]:
    if session.leaderboard_frozen and session.frozen_snapshot:
        try:
            return json.loads(session.frozen_snapshot)
        except json.JSONDecodeError:
            return []

    rows = [_serialize_player(player) for player in session.players if not player.is_banned]
    rows.sort(
        key=lambda item: (
            -item["score"],
            item["completion_seconds"] if item["completion_seconds"] is not None else 10**9,
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
            "total_participants": 0,
            "average_score": 0,
            "fastest_player": None,
            "most_failed_level": None,
            "completion_rate": 0,
        }

    avg_score = sum(p.score for p in players) / len(players)
    completed = [p for p in players if p.completed_at]
    completion_rate = (len(completed) / len(players)) * 100

    fastest = None
    if completed:
        fastest = min(completed, key=lambda p: p.completed_at - p.join_time)

    level_attempts: dict[int, int] = {}
    for player in players:
        level_attempts[player.current_level] = level_attempts.get(player.current_level, 0) + 1

    most_failed_level = None
    if level_attempts:
        most_failed_level = max(level_attempts.items(), key=lambda item: item[1])[0]

    return {
        "total_participants": len(players),
        "average_score": round(avg_score, 2),
        "fastest_player": fastest.username if fastest else None,
        "most_failed_level": most_failed_level,
        "completion_rate": round(completion_rate, 2),
        "generated_at": datetime.utcnow().isoformat(),
    }
