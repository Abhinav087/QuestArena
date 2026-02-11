import time
import uuid
from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
import json
import os
import requests
from typing import List, Optional

app = FastAPI()

# --- Configuration ---
LLM_API_KEY = "YOUR_API_KEY_HERE"
LLM_PROVIDER = "gemini"  # or "groq"

# --- CORS for LAN ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Game Session State (Server-controlled) ---
game_session = {
    "status": "waiting",  # "waiting" | "active" | "finished"
    "start_time": None,  # epoch when admin starts the game
    "duration": 30 * 60,  # 30 minutes in seconds
}

# --- Data Storage (In-Memory) ---
players = {}  # {player_id: {name, level, score, start_time, questions_cleared, last_checkpoint, reported}}
questions_data = {}

# --- Load Questions ---
questions_path = os.path.join(os.path.dirname(__file__), "questions.json")
try:
    with open(questions_path, "r") as f:
        questions_data = json.load(f)
except FileNotFoundError:
    print("Error: questions.json not found.")


# --- Models ---
class RegisterModel(BaseModel):
    team_name: str


class SubmitAnswerModel(BaseModel):
    player_id: str
    level: int
    question_id: str
    answer: str


class SubmitCodeModel(BaseModel):
    player_id: str
    code: str


class ReportModel(BaseModel):
    player_id: str


# --- Helper Functions ---
def get_remaining_seconds():
    """Calculate remaining seconds in the game session."""
    if game_session["status"] != "active" or game_session["start_time"] is None:
        if game_session["status"] == "finished":
            return 0
        return game_session["duration"]

    elapsed = time.time() - game_session["start_time"]
    remaining = game_session["duration"] - elapsed

    if remaining <= 0:
        game_session["status"] = "finished"
        return 0
    return int(remaining)


def get_question_by_id(q_id, level_data):
    if "questions" in level_data:
        for q in level_data["questions"]:
            if q["id"] == q_id:
                return q
    if "easy" in level_data:
        for q in level_data["easy"]:
            if q["id"] == q_id:
                return q
    if "hard" in level_data:
        for q in level_data["hard"]:
            if q["id"] == q_id:
                return q
    if "hidden_route" in level_data:
        for q in level_data["hidden_route"]["questions"]:
            if q["id"] == q_id:
                return q
    return None


async def verify_with_llm(code: str):
    if LLM_API_KEY == "YOUR_API_KEY_HERE":
        print("Warning: No API Key provided. Mocking response.")
        if "return a + b" in code or "return a+b" in code:
            return "CORRECT"
        return "WRONG"
    return "CORRECT"


# ==============================================================
# GAME SESSION ENDPOINTS (new)
# ==============================================================


@app.post("/start_game")
async def start_game():
    """Admin starts the 30-minute game timer. All waiting clients will begin."""
    if game_session["status"] == "active":
        remaining = get_remaining_seconds()
        return {"message": "Game already active", "remaining_seconds": remaining}

    game_session["status"] = "active"
    game_session["start_time"] = time.time()

    # Reset all player start times to NOW so time_taken is measured from game start
    for pid in players:
        players[pid]["start_time"] = game_session["start_time"]
        players[pid]["reported"] = False

    return {
        "message": "Game started!",
        "status": "active",
        "duration": game_session["duration"],
    }


@app.get("/game_status")
async def get_game_status():
    """Clients poll this to know if the game has started / is active / has finished."""
    remaining = get_remaining_seconds()
    return {
        "status": game_session["status"],
        "remaining_seconds": remaining,
        "total_duration": game_session["duration"],
        "player_count": len(players),
    }


@app.post("/report")
async def report(data: ReportModel):
    """Client submits final data when the game ends."""
    pid = data.player_id
    if pid not in players:
        raise HTTPException(status_code=404, detail="Player not found")

    p = players[pid]
    # Calculate time taken from game start to now (or to game end)
    if game_session["start_time"]:
        end_time = game_session["start_time"] + game_session["duration"]
        time_taken = min(time.time(), end_time) - p["start_time"]
    else:
        time_taken = 0

    p["time_taken"] = round(time_taken, 2)
    p["reported"] = True

    return {
        "message": "Report received",
        "score": p["score"],
        "time_taken": p["time_taken"],
    }


@app.post("/reset_game")
async def reset_game():
    """Admin resets the game back to waiting state."""
    game_session["status"] = "waiting"
    game_session["start_time"] = None
    players.clear()
    return {"message": "Game reset to waiting state", "status": "waiting"}


# ==============================================================
# EXISTING ENDPOINTS (modified where needed)
# ==============================================================


@app.post("/register")
async def register(data: RegisterModel):
    player_id = str(uuid.uuid4())
    players[player_id] = {
        "name": data.team_name,
        "level": 0,
        "score": 0,
        "start_time": game_session["start_time"]
        if game_session["start_time"]
        else time.time(),
        "questions_cleared": [],
        "last_checkpoint": 0,
        "reported": False,
        "time_taken": 0,
    }
    return {
        "player_id": player_id,
        "message": "Registered successfully",
        "game_status": game_session["status"],
        "remaining_seconds": get_remaining_seconds(),
    }


@app.get("/questions/{level}")
async def get_questions(level: int, path: Optional[str] = None):
    # Block if game is not active
    if game_session["status"] != "active":
        raise HTTPException(status_code=403, detail="Game is not active yet")

    level_str = str(level)
    if level_str not in questions_data:
        raise HTTPException(status_code=404, detail="Level not found")

    data = questions_data[level_str]

    if level == 2 or level == 3:
        if path == "easy":
            return {"questions": data["easy"], "title": data["title"]}
        elif path == "hard":
            return {"questions": data["hard"], "title": data["title"]}
        else:
            return {
                "message": "Choose path",
                "paths": ["easy", "hard"],
                "title": data["title"],
            }

    if level == 1 and path == "backlog_king":
        return {
            "questions": data["hidden_route"]["questions"],
            "title": "Backlog King Route",
        }

    if "questions" in data:
        return {"questions": data["questions"], "title": data["title"]}

    if "question" in data:  # Level 5
        return {"question": data["question"], "title": data["title"]}

    return data


@app.post("/submit_answer")
async def submit_answer(data: SubmitAnswerModel):
    if game_session["status"] != "active":
        raise HTTPException(status_code=403, detail="Game is not active")

    pid = data.player_id
    if pid not in players:
        raise HTTPException(status_code=404, detail="Player not found")

    level_str = str(data.level)
    q = get_question_by_id(data.question_id, questions_data[level_str])

    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    correct = q["answer"] == data.answer
    if correct:
        p = players[pid]
        p["score"] += 10
        if data.question_id not in p["questions_cleared"]:
            p["questions_cleared"].append(data.question_id)
        p["last_checkpoint"] = max(p["last_checkpoint"], data.level)
        return {"status": "correct", "new_score": p["score"]}
    else:
        return {"status": "wrong", "new_score": players[pid]["score"]}


@app.post("/submit_code")
async def submit_code(data: SubmitCodeModel):
    if game_session["status"] != "active":
        raise HTTPException(status_code=403, detail="Game is not active")

    pid = data.player_id
    if pid not in players:
        raise HTTPException(status_code=404, detail="Player not found")

    result = await verify_with_llm(data.code)

    if result == "CORRECT":
        p = players[pid]
        p["score"] += 50
        p["level"] = 6
        p["last_checkpoint"] = 6
        return {"status": "CORRECT", "new_score": p["score"]}
    else:
        return {"status": "WRONG"}


@app.post("/update_level")
async def update_level(player_id: str = Body(...), level: int = Body(...)):
    if player_id not in players:
        raise HTTPException(status_code=404, detail="Player not found")
    players[player_id]["level"] = level
    return {"status": "updated"}


@app.get("/leaderboard")
async def leaderboard():
    results = []
    for pid, p in players.items():
        # Use stored time_taken if reported, otherwise calculate live
        if p.get("reported") and p.get("time_taken"):
            time_taken = p["time_taken"]
        else:
            time_taken = (
                round(time.time() - p["start_time"], 2) if p["start_time"] else 0
            )

        results.append(
            {
                "name": p["name"],
                "score": p["score"],
                "level": p["last_checkpoint"],
                "time_taken": time_taken,
                "questions_cleared": len(p["questions_cleared"]),
                "reported": p.get("reported", False),
            }
        )

    sorted_players = sorted(results, key=lambda x: (-x["score"], x["time_taken"]))
    return sorted_players


# ==============================================================
# ADMIN DASHBOARD
# ==============================================================


@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    admin_path = os.path.join(os.path.dirname(__file__), "admin.html")
    if not os.path.exists(admin_path):
        raise HTTPException(status_code=404, detail="Admin page not found")
    with open(admin_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


# --- Serve Static Files (Client) — MUST be last ---
client_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "client")
if os.path.exists(client_path):
    app.mount("/", StaticFiles(directory=client_path, html=True), name="static")
else:
    print("Warning: 'client' directory not found. Static files will not be served.")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
