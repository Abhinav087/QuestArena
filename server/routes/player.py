from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Log, Player, PlayerQuestionClear, SessionModel
from schemas import PlayerEventRequest, SubmitAnswerRequest, SubmitCodeRequest
from services.security import get_current_player

router = APIRouter(prefix="/api", tags=["player"])

# Per-level scoring: maps (level, path_hint) -> points for correct answer
# path_hint is derived from question_id prefix: "e" for easy, "h" for hard, None for flat
SCORE_TABLE = {
    (0, None): 10,
    (1, None): 15,
    (2, None): 20,
    (3, "e"): 10,
    (3, "h"): 40,
    (4, "e"): 15,
    (4, "h"): 60,
}


def _path_hint_from_qid(question_id: str) -> str | None:
    """Detect easy/hard from question ID convention: q3_e1 -> 'e', q3_h1 -> 'h'."""
    parts = question_id.split("_")
    if len(parts) >= 2:
        tag = parts[1]
        if tag.startswith("e"):
            return "e"
        if tag.startswith("h"):
            return "h"
    return None


def _normalize_answer(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split()).casefold()


def _ensure_session_running(db: Session, player: Player) -> SessionModel:
    session = db.query(SessionModel).filter(SessionModel.id == player.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status not in ("running", "paused", "waiting"):
        raise HTTPException(status_code=403, detail="Session is not active")
    return session


def _get_question_by_id(level_data: dict, q_id: str):
    for key in ("questions", "easy", "hard"):
        if key in level_data:
            for q in level_data[key]:
                if q.get("id") == q_id:
                    return q
    if "hidden_route" in level_data:
        for q in level_data["hidden_route"].get("questions", []):
            if q.get("id") == q_id:
                return q
    return None


@router.post("/player/heartbeat")
async def heartbeat(player: Player = Depends(get_current_player), db: Session = Depends(get_db)):
    player.last_active = datetime.utcnow()
    player.is_active = True
    db.commit()
    return {"ok": True}


@router.post("/player/activity")
async def player_activity(
    body: PlayerEventRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
):
    player.last_active = datetime.utcnow()
    db.add(
        Log(
            session_id=player.session_id,
            player_id=player.id,
            action_type=f"player_event:{body.event_type}",
            details=body.details,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/submit_answer")
async def submit_answer(
    body: SubmitAnswerRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
):
    session = _ensure_session_running(db, player)
    if session.status != "running":
        raise HTTPException(status_code=403, detail="Session is not currently running")

    from routes.session import QUESTIONS

    level_key = str(body.level)
    if level_key not in QUESTIONS:
        raise HTTPException(status_code=404, detail="Level not found")

    question = _get_question_by_id(QUESTIONS[level_key], body.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    already_cleared = (
        db.query(PlayerQuestionClear)
        .filter(
            PlayerQuestionClear.player_id == player.id,
            PlayerQuestionClear.question_id == body.question_id,
        )
        .first()
    )

    if already_cleared:
        player.last_active = datetime.utcnow()
        db.commit()
        return {"status": "already_answered", "new_score": player.score}

    expected_answer = _normalize_answer(question.get("answer"))
    submitted_answer = _normalize_answer(body.answer)
    is_correct = expected_answer == submitted_answer
    player.last_active = datetime.utcnow()

    if is_correct:
        db.add(
            PlayerQuestionClear(
                player_id=player.id,
                session_id=player.session_id,
                question_id=body.question_id,
                level=body.level,
            )
        )
        hint = _path_hint_from_qid(body.question_id)
        points = SCORE_TABLE.get((body.level, hint), 10)
        player.score += points
        player.current_level = max(player.current_level, body.level)
        db.add(
            Log(
                session_id=player.session_id,
                player_id=player.id,
                action_type="level_complete",
                details=f"Level {body.level} question {body.question_id} solved",
            )
        )
        db.commit()
        return {"status": "correct", "new_score": player.score}

    db.commit()
    return {"status": "wrong", "new_score": player.score}


@router.post("/submit_code")
async def submit_code(
    body: SubmitCodeRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
):
    session = _ensure_session_running(db, player)
    if session.status != "running":
        raise HTTPException(status_code=403, detail="Session is not currently running")

    # Simple placeholder validation; replace with real evaluator if needed.
    correct = "return" in body.code and ("a + b" in body.code or "a+b" in body.code)

    player.last_active = datetime.utcnow()

    if player.completed_at is not None:
        db.commit()
        return {"status": "CORRECT", "new_score": player.score, "already_completed": True}

    if correct:
        player.score += 100
        player.current_level = max(player.current_level, 6)
        player.completed_at = datetime.utcnow()
        db.add(
            Log(
                session_id=player.session_id,
                player_id=player.id,
                action_type="final_challenge_complete",
                details="Coding challenge solved",
            )
        )
        db.commit()
        return {"status": "CORRECT", "new_score": player.score}

    db.commit()
    return {"status": "WRONG"}
