# QuestArena: Target Save the Partner

A robust, lightweight LAN-based multiplayer game designed for college fests and competitions. Built with FastAPI and Vanilla JS.

## 🚀 Key Features

- **LAN Multiplayer**: Central server hosts game state for all connected players.
- **Admin Control**: Secure dashboard to start, monitor, and reset the game.
- **Waiting Lobby**: Players wait in a lobby until the admin initiates the countdown.
- **Synced Timer**: Global 30-minute timer synchronized across all clients via the server.
- **Auto-Stop**: Games automatically lock and report final data when time expires.
- **Leaderboard**: Real-time ranking on the admin dashboard based on score and time taken.
- **Dynamic Content**: 6 levels including Technical/Coding challenges and a Hidden Route.

## 🛠 Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JavaScript
- **AI Judging**: Ready for Ollama (local) or Google Gemini API.

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

### 4. Player Access
Players connect by browsing to your server IP:
- **URL**: `http://<your-ip>:8000/`
- Players enter their Team Name and will wait in the lobby until you click **"Start Game"** on the Admin Dashboard.

## ⚙️ Configuration

- **Questions**: Modify `server/questions.json`.
- **Admin Password**: Change `ADMIN_PASSWORD` in `server/main.py`.
- **Timer Duration**: Change `duration` in the `game_session` dict in `server/main.py`.
- **AI Judging**: Set your `LLM_API_KEY` or integrate Ollama in `server/main.py`.

## 📂 Project Structure
- `/client`: Frontend assets (served automatically by the backend).
- `/server`: FastAPI backend, questions, and admin panel logic.
- `run_server.bat`: Quick-start script for Windows.