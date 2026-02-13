from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models import Player


def mark_inactive_players(db: Session, timeout_minutes: int = 5) -> int:
    threshold = datetime.utcnow() - timedelta(minutes=timeout_minutes)
    stale_players = (
        db.query(Player)
        .filter(Player.is_active.is_(True), Player.last_active < threshold)
        .all()
    )
    for player in stale_players:
        player.is_active = False
    if stale_players:
        db.commit()
    return len(stale_players)


def duplicate_ip_map(players: list[Player]) -> dict[str, int]:
    ips = [player.ip_address for player in players if player.ip_address]
    return dict(Counter(ips))
