# QuestArena v2: Target Save the Partner

A robust, lightweight LAN-based multiplayer game designed for college fests and competitions. Built with FastAPI and Vanilla JS.

## ✅ v2 Architecture Highlights

- Single active session model (only one live session at a time).
- Persistent storage with SQLite + SQLAlchemy.
- JWT-based player/admin authentication.
- Player state persistence via browser localStorage.
- Backend-controlled timer with pause/resume and time adjustments.
- Real-time session + leaderboard updates through WebSockets.
- Admin controls for kick/ban/reset/move-level/score-adjust.
- Action logging and session analytics.

## 🚀 Key Features

- **Single Live Session**: One active event at a time; old sessions are retained as history.
- **Session Lifecycle Controls**: Create/start/pause/resume/end with +5/-5 minute adjustments.
- **Persistent Players**: Unique usernames, progress persistence, rejoin via token validation.
- **Leaderboard Freeze + CSV Export**: Admin can freeze ranking and export session results.
- **Anti-Cheat Basics**: Duplicate IP checks, multi-device login rejection, tab visibility logging.
- **Analytics**: Average score, fastest player, completion rate, and failed-level insights.
- **Dynamic Content**: 6 levels including technical MCQs and coding challenge.

## 🛠 Tech Stack

- **Backend**: FastAPI (Python), SQLAlchemy, SQLite
- **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JavaScript
- **Auth/Realtime**: JWT, WebSockets

## 📥 Installation

1.  **Clone the repository**:
    ```bash
    git clone <repo-url>
    cd QuestArena
    ```

2.  **Install Dependencies**:
    ```bash
    pip install -r server/requirements.txt
    ```

## 🎮 How to Run (LAN Setup)

### 1. Identify Server IP
Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) and find your **IPv4 Address** (e.g., `192.168.29.67`).

### 2. Start the Server
Run the batch file or use uvicorn directly:
```bash
python server/main.py
```
The server will start on port `8000` and host both the API and the game files.

### 3. Admin Access
Open the dashboard on the server machine or any device on the network:
- **URL**: `http://<your-ip>:8000/admin`
- **Password**: `arena2026` (Default)

### 4. v2 Admin Flow

1. Login to `/admin`
2. Create a session (name + duration)
3. Start session when all teams join
4. Use pause/resume/add/subtract/force-end as needed
5. Monitor live players + leaderboard
6. Export results CSV and review analytics

### 5. Player Access
Players connect by browsing to your server IP:
- **URL**: `http://<your-ip>:8000/`
- Players enter team name once.
- Token + username are persisted locally.
- On refresh, the client validates token and restores score/level/session automatically.

## ⚙️ Configuration

- **Questions**: Modify `server/questions.json`.
- **Admin Password**: Change `ADMIN_PASSWORD` in `server/routes/auth.py`.
- **JWT Secret**: Set env var `QUESTARENA_JWT_SECRET`.
- **Inactivity Timeout**: Tune timeout in `server/services/anti_cheat.py`.

## 📂 Project Structure
- `/client`: Frontend assets (served automatically by the backend).
- `/server`: FastAPI backend, questions, and admin panel logic.
- `run_server.bat`: Quick-start script for Windows.