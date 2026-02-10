# QuestArena: Target Save the Partner

A lightweight LAN-based college fest game.

## Overview
- **Client**: Single-page HTML/CSS/JS application.
- **Server**: FastAPI (Python) backend for game state and validation.

## Quick Start

1.  **Start Server**:
    - Run `run_server.bat` (Windows).
    - Ensure Python and dependencies are installed (`pip install -r server/requirements.txt`).

2.  **Play**:
    - Open `client/index.html` in your browser.
    - Enter a Team Name and start!

## Features
- **Levels 0-5**: GK, English, Aptitude, Reasoning, Technical, Coding.
- **Hidden Route**: Look for secrets in Level 1!
- **Timer**: 30-minute global countdown.
- **Real-time Scoring**: Instant feedback on answers.

## Configuration
- Modify `server/questions.json` to change questions.
- Add Google Gemini / Groq API key in `server/main.py` for real AI code evaluation.