# QuestArena

QuestArena is a LAN-ready multiplayer challenge game with a FastAPI backend and a fullscreen vanilla JS runtime client.

## Runtime highlights

- Fullscreen overworld canvas that covers the entire webpage.
- Fixed arena render resolution: `1920 x 1080`.
- Tile scale: `64 x 64`.
- Character scale: `32 x 32`.
- Camera follow with smoothing, slight zoom-in, center follow, and world-border clamping.
- Large exploration-focused maps with NPC interactions, challenge modals, and portal transitions.

## Gameplay loop

1. Join game as player.
2. Wait until admin starts the session.
3. Enter mission and explore overworld.
4. Talk to NPC (`E` / `Enter`) to open challenge.
5. Clear challenge to unlock portal and progress.

## Controls

- Move: `WASD` or arrow keys
- Interact / Continue dialogue: `E` or `Enter`
- Submit MCQ: `Enter` (while question modal is active)

## Tech stack

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: HTML, CSS, vanilla JavaScript
- Realtime/Auth: WebSocket + JWT

## Setup

1. Install dependencies:

```bash
pip install -r server/requirements.txt
```

2. (Optional) Regenerate runtime assets (64px tiles / 32px sprites):

```bash
python tools/generate_assets.py
```

3. Start backend:

```bash
python server/main.py
```

## Run URLs

- Player: `http://localhost:8000/`
- Admin: `http://localhost:8000/admin`

For LAN play, replace `localhost` with the host machine IPv4 address.

## Configuration points

- Questions and level content: `server/questions.json`
- Admin password: `server/routes/auth.py` (`ADMIN_PASSWORD`)
- JWT secret: environment variable `QUESTARENA_JWT_SECRET`

## Project folders

- `client/` — runtime player client and generated assets
- `server/` — backend API, auth, session, admin, realtime services
- `tools/` — utility scripts such as asset generation