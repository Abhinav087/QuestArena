# QuestArena

QuestArena is a LAN-ready multiplayer challenge game with a FastAPI backend, SQLite persistence, and a fullscreen vanilla JavaScript client.

It supports player login, admin-controlled live sessions, real-time leaderboard updates, NPC-driven level challenges, and a final coding challenge.

## Highlights

- Fullscreen overworld exploration with modal-based challenges.
- Fixed arena render resolution: `1920 x 1080`.
- Tile scale: `64 x 64`.
- WebSocket realtime updates for timer/session/leaderboard.
- Session-managed multiplayer flow for college events / hackfest rounds.

## Gameplay Flow

1. Player joins using team name.
2. Player waits in lobby until admin starts session.
3. Intro cutscene and mission starts.
4. Player explores level, interacts with NPCs (`E` / `Enter`).
5. Player solves MCQs / coding challenge to unlock portals and progress.
6. Session ends on completion or timer expiry.

## Controls

- Move: `WASD` or arrow keys
- Interact / continue dialogue: `E` or `Enter`
- Submit selected MCQ: `Enter`
- Cycle interaction targets: `Tab`

## Tech Stack

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: HTML, CSS, vanilla JavaScript (Canvas)
- Auth: JWT
- Realtime: WebSocket

## Local Setup

1. Install Python dependencies:

```bash
pip install -r server/requirements.txt
```

2. (Optional) Regenerate sprites/tiles:

```bash
python tools/generate_assets.py
```

3. Start server:

```bash
python server/main.py
```

Alternative one-click Windows run:

```bash
run_server.bat
```

## URLs

- Player app: `http://localhost:8000/`
- Admin dashboard: `http://localhost:8000/admin`

For LAN play, replace `localhost` with host machine IPv4.

## Project Structure

- `client/` - Player runtime, arena engine, UI, assets
- `server/` - FastAPI app, routes, DB models, services
- `tools/` - Utility scripts (asset generation)

## Backend API Overview

### Auth & Player

- `POST /api/player/register` - Register or rejoin player
- `POST /api/validate-token` - Restore session from stored token
- `POST /api/player/heartbeat` - Keep activity alive
- `POST /api/player/activity` - Client activity events
- `POST /api/submit_answer` - Validate MCQ answer
- `POST /api/submit_code` - Validate final coding challenge

### Session & Realtime

- `GET /api/game_status` - Current session status/timer/player count
- `GET /api/questions/{level}` - Fetch level challenge payload
- `GET /api/leaderboard` - Ranked leaderboard for active session
- `GET /ws/live` - WebSocket channel for live updates

### Admin

- `POST /api/admin_login`
- `POST /api/admin/session/create|start|pause|resume|end`
- `POST /api/admin/session/add_time|subtract_time`
- `GET /api/admin/sessions`
- `DELETE /api/admin/sessions/{session_id}`
- `GET /api/admin/players/live`
- `POST /api/admin/player/{player_id}/kick|ban|reset|move-level|adjust-score`
- `POST /api/admin/leaderboard/freeze`
- `GET /api/admin/analytics/{session_id}`
- `GET /api/admin/export/{session_id}`

## Data & Configuration

- Questions and level content: `server/questions.json`
- DB file: `questarena.db` (SQLite)
- Admin password constant: `server/routes/auth.py` (`ADMIN_PASSWORD`)
- JWT secret env var: `QUESTARENA_JWT_SECRET`

## Chat Context File (for future sessions)

Use `CHAT_CONTEXT.md` as a persistent summary file for AI/chat handoff across sessions.

Whenever architecture, API contracts, or game flow changes, update:

- `README.md` (developer-facing docs)
- `CHAT_CONTEXT.md` (conversation context memory)