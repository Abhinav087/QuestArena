import json
import re
from datetime import datetime

from models import Player, SessionModel


def _session_total_seconds(session: SessionModel) -> int:
    return max(0, int((session.duration_minutes or 0) * 60))


def _clamp_remaining(session: SessionModel, remaining_seconds: int | None) -> int:
    total = _session_total_seconds(session)
    if remaining_seconds is None:
        return max(0, min(total, int(session.remaining_seconds or 0)))
    return max(0, min(total, int(remaining_seconds)))


def _extract_completion_remaining_from_logs(player: Player, session: SessionModel) -> int | None:
    # Expected details format (new): "Coding challenge solved; remaining_seconds=1234"
    for log in sorted(player.logs or [], key=lambda row: row.timestamp or datetime.min, reverse=True):
        if log.session_id != session.id:
            continue
        if log.action_type != "final_challenge_complete":
            continue
        details = log.details or ""
        match = re.search(r"remaining_seconds\s*=\s*(\d+)", details)
        if match:
            return int(match.group(1))
    return None


def compute_time_taken_seconds(player: Player, session: SessionModel) -> int:
    total = _session_total_seconds(session)
    if total <= 0:
        return 0

    if player.completed_at:
        completion_remaining = _extract_completion_remaining_from_logs(player, session)
        if completion_remaining is not None:
            return max(0, total - _clamp_remaining(session, completion_remaining))

    # Fallback for active players (and legacy completed rows without snapshot):
    # Time spent = configured session total - current remaining.
    return max(0, total - _clamp_remaining(session, None))


def _serialize_player(player: Player, session: SessionModel) -> dict:
    time_taken_seconds = compute_time_taken_seconds(player, session)

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
            "leaderboard": [],
            "generated_at": datetime.utcnow().isoformat(),
        }

    ranked = [
        {
            "username": player.username,
            "score": player.score,
            "time_taken_seconds": compute_time_taken_seconds(player, session),
        }
        for player in players
    ]
    ranked.sort(key=lambda item: (-item["score"], item["time_taken_seconds"], item["username"].lower()))
    top = ranked[0] if ranked else None

    return {
        "session_name": session.name,
        "total_participants": len(players),
        "top_player": top,
        "leaderboard": ranked,
        "generated_at": datetime.utcnow().isoformat(),
    }
