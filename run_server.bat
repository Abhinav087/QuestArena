@echo off
echo Starting QuestArena Server...
cd server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
pause
