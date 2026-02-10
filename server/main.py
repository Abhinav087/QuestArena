from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import requests
from typing import List, Optional

app = FastAPI()

# --- Configuration ---
# PLACEHOLDER: Replace with your actual API key
LLM_API_KEY = "YOUR_API_KEY_HERE"  
LLM_PROVIDER = "gemini" # or "groq"

# --- CORS for LAN ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for LAN simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Storage (In-Memory for simplicity) ---
players = {}  # {player_id: {name: str, level: int, score: int, startTime: float}}
questions_data = {}

# --- Load Questions ---
try:
    with open("questions.json", "r") as f:
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

# --- Helper Functions ---
def get_question_by_id(q_id, level_data):
    # Search through the level structure to find the question
    if "questions" in level_data:
        for q in level_data["questions"]:
            if q["id"] == q_id: return q
    if "easy" in level_data:
        for q in level_data["easy"]:
            if q["id"] == q_id: return q
    if "hard" in level_data:
        for q in level_data["hard"]:
            if q["id"] == q_id: return q 
    if "hidden_route" in level_data:
         for q in level_data["hidden_route"]["questions"]:
            if q["id"] == q_id: return q
    return None

async def verify_with_llm(code: str):
    if LLM_API_KEY == "YOUR_API_KEY_HERE":
        print("Warning: No API Key provided. Mocking response.")
        # comprehensive mock logic for testing
        if "return a + b" in code or "return a+b" in code:
             return "CORRECT"
        return "WRONG"

    # Gemini Example (using REST API to avoid extra dependencies if possible, or stick to mock)
    # real implementation would go here
    return "CORRECT" # Placeholder for now

# --- Endpoints ---

@app.post("/register")
async def register(data: RegisterModel):
    import uuid
    player_id = str(uuid.uuid4())
    players[player_id] = {
        "name": data.team_name,
        "level": 0,
        "score": 0
    }
    return {"player_id": player_id, "message": "Registered successfully"}

@app.get("/questions/{level}")
async def get_questions(level: int, path: Optional[str] = None):
    level_str = str(level)
    if level_str not in questions_data:
        raise HTTPException(status_code=404, detail="Level not found")
    
    data = questions_data[level_str]
    
    # Logic for different paths
    if level == 2 or level == 3:
        if path == "easy":
            return {"questions": data["easy"], "title": data["title"]}
        elif path == "hard":
            return {"questions": data["hard"], "title": data["title"]}
        else:
             return {"message": "Choose path", "paths": ["easy", "hard"], "title": data["title"]} # Client should handle this choice
             
    if level == 1 and path == "backlog_king":
        return {"questions": data["hidden_route"]["questions"], "title": "Backlog King Route"}

    if "questions" in data:
         return {"questions": data["questions"], "title": data["title"]}
    
    if "question" in data: # Level 5
        return {"question": data["question"], "title": data["title"]}

    return data

@app.post("/submit_answer")
async def submit_answer(data: SubmitAnswerModel):
    pid = data.player_id
    if pid not in players:
        raise HTTPException(status_code=404, detail="Player not found")
    
    level_str = str(data.level)
    q = get_question_by_id(data.question_id, questions_data[level_str])
    
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    
    correct = q["answer"] == data.answer
    if correct:
        players[pid]["score"] += 10
        return {"status": "correct", "new_score": players[pid]["score"]}
    else:
        return {"status": "wrong", "new_score": players[pid]["score"]}

@app.post("/submit_code")
async def submit_code(data: SubmitCodeModel):
    pid = data.player_id
    if pid not in players:
        raise HTTPException(status_code=404, detail="Player not found")

    result = await verify_with_llm(data.code)
    
    if result == "CORRECT":
        players[pid]["score"] += 50
        players[pid]["level"] = 6 # Game cleared
        return {"status": "CORRECT", "new_score": players[pid]["score"]}
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
    # Sort by score desc
    sorted_players = sorted(players.values(), key=lambda x: x["score"], reverse=True)
    return sorted_players

if __name__ == "__main__":
    import uvicorn
    # run on 0.0.0.0 for LAN access
    uvicorn.run(app, host="0.0.0.0", port=8000)
