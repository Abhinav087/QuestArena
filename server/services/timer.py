import asyncio
from datetime import datetime

from database import SessionLocal
from models import Log, SessionModel
from services.anti_cheat import mark_inactive_players
from services.leaderboard import get_leaderboard
from services.realtime import manager


async def timer_loop() -> None:
    while True:
        try:
            db = SessionLocal()
            running_session = (
                db.query(SessionModel)
                .filter(SessionModel.status == "running")
                .order_by(SessionModel.created_at.desc())
                .first()
            )

            pushed_update = False
            if running_session:
                running_session.remaining_seconds = max(0, running_session.remaining_seconds - 1)
                if running_session.remaining_seconds <= 0:
                    running_session.status = "ended"
                    running_session.end_time = datetime.utcnow()
                    db.add(
                        Log(
                            session_id=running_session.id,
                            player_id=None,
                            action_type="session_ended",
                            details="Timer reached zero",
                        )
                    )
                db.commit()
                db.refresh(running_session)
                pushed_update = True

            marked = mark_inactive_players(db, timeout_minutes=5)
            if marked:
                pushed_update = True

            if pushed_update and running_session:
                await manager.broadcast(
                    "session_update",
                    {
                        "session_id": running_session.id,
                        "status": running_session.status,
                        "remaining_seconds": running_session.remaining_seconds,
                        "duration_minutes": running_session.duration_minutes,
                    },
                )
                await manager.broadcast(
                    "leaderboard_update",
                    {
                        "session_id": running_session.id,
                        "frozen": running_session.leaderboard_frozen,
                        "rows": get_leaderboard(running_session),
                    },
                )
        except Exception:
            pass
        finally:
            try:
                db.close()
            except Exception:
                pass

        await asyncio.sleep(1)
