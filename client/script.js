// --- Configuration ---
// IMPORTANT: Change this to your server's IP address for LAN play.
// If clients open the page via the server (http://server-ip:8000/), use "" for auto-detect.
const SERVER_IP = "";  // Leave empty to auto-detect from current URL
const API_BASE_URL = SERVER_IP ? `http://${SERVER_IP}:8000` : window.location.origin;

let gameState = {
    playerId: null,
    teamName: "",
    level: 0,
    score: 0,
    timerInterval: null,
    statusPollInterval: null,
    currentQuestions: [],
    currentQuestionIndex: 0,
    pathChoice: null,
    gameActive: false,
};

// --- DOM Elements ---
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    story: document.getElementById('story-screen'),
    path: document.getElementById('path-selection'),
    question: document.getElementById('question-screen'),
    coding: document.getElementById('coding-screen'),
    end: document.getElementById('end-screen')
};

const hud = document.getElementById('game-hud');
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');

// --- Navigation ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');
}

// ==============================================================
// GAME STATUS POLLING
// ==============================================================

function startPolling(interval = 2000) {
    stopPolling();
    pollGameStatus(); // immediate first poll
    gameState.statusPollInterval = setInterval(pollGameStatus, interval);
}

function stopPolling() {
    if (gameState.statusPollInterval) {
        clearInterval(gameState.statusPollInterval);
        gameState.statusPollInterval = null;
    }
}

async function pollGameStatus() {
    try {
        const res = await fetch(`${API_BASE_URL}/game_status`);
        const data = await res.json();

        // Update player count on waiting screen
        const countEl = document.getElementById('waiting-player-count');
        if (countEl) countEl.textContent = data.player_count;

        if (data.status === "active" && !gameState.gameActive) {
            // Game just started — transition from waiting to playing
            gameState.gameActive = true;
            stopPolling();
            hud.classList.remove('hidden');
            updateTimerDisplay(data.remaining_seconds);
            showScreen('story');
            // Switch to slower polling during gameplay (for timer sync)
            startPolling(10000);
        } else if (data.status === "active" && gameState.gameActive) {
            // Still active — sync the timer
            updateTimerDisplay(data.remaining_seconds);

            // If time ran out server-side
            if (data.remaining_seconds <= 0) {
                endGameAndReport("TIME UP — Game Over");
            }
        } else if (data.status === "finished" && gameState.gameActive) {
            // Game finished by server
            endGameAndReport("TIME UP — Game Over");
        }
    } catch (e) {
        console.error("Poll error:", e);
    }
}

function updateTimerDisplay(seconds) {
    if (seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ==============================================================
// REGISTRATION & GAME START
// ==============================================================

async function startGame() {
    const nameInput = document.getElementById('team-name');
    if (!nameInput.value.trim()) return alert("Enter team name!");

    try {
        const res = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team_name: nameInput.value.trim() })
        });
        if (!res.ok) throw new Error("Registration failed");

        const data = await res.json();
        gameState.playerId = data.player_id;
        gameState.teamName = nameInput.value.trim();

        // Show team name on waiting screen
        const waitingName = document.getElementById('waiting-team-name');
        if (waitingName) waitingName.textContent = gameState.teamName;

        if (data.game_status === "active") {
            // Game already in progress — jump in
            gameState.gameActive = true;
            hud.classList.remove('hidden');
            updateTimerDisplay(data.remaining_seconds);
            showScreen('story');
            startPolling(10000); // slow poll for timer sync
        } else {
            // Game hasn't started — go to waiting lobby
            showScreen('waiting');
            startPolling(2000); // fast poll waiting for game start
        }
    } catch (e) {
        console.error(e);
        alert("Cannot connect to server. Make sure the server is running.");
    }
}

// ==============================================================
// GAME END & REPORT
// ==============================================================

async function endGameAndReport(msg) {
    gameState.gameActive = false;
    stopPolling();

    // Report final data to server
    try {
        await fetch(`${API_BASE_URL}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: gameState.playerId })
        });
    } catch (e) {
        console.error("Report error:", e);
    }

    showScreen('end');
    document.getElementById('end-message').textContent = msg;
    document.getElementById('final-score').textContent = gameState.score;
    hud.classList.add('hidden');
}

// ==============================================================
// LEVEL LOGIC
// ==============================================================

async function loadLevel(level, path = null) {
    if (!gameState.gameActive) {
        alert("Game is not active!");
        return;
    }

    gameState.level = level;
    gameState.pathChoice = path;
    levelDisplay.textContent = level;
    gameState.currentQuestionIndex = 0;

    let url = `${API_BASE_URL}/questions/${level}`;
    if (path) url += `?path=${path}`;

    try {
        const res = await fetch(url);

        if (res.status === 403) {
            alert("Game is not active yet. Please wait for the server admin to start.");
            return;
        }

        const data = await res.json();

        // Handle Path Selection (Levels 2, 3)
        if (data.message === "Choose path") {
            showScreen('path');
            document.getElementById('path-title').textContent = data.title;
            return;
        }

        // Handle Coding Challenge (Level 5)
        if (data.question) {
            showScreen('coding');
            document.getElementById('coding-problem-text').textContent = data.question.text;
            document.getElementById('code-editor').value = data.question.template;
            return;
        }

        // Handle standard questions
        if (data.questions) {
            gameState.currentQuestions = data.questions;
            showScreen('question');
            renderQuestion();
        }

    } catch (e) {
        console.error(e);
        alert("Error loading level.");
    }
}

function renderQuestion() {
    const q = gameState.currentQuestions[gameState.currentQuestionIndex];
    document.getElementById('question-title').textContent = `Level ${gameState.level} - Q${gameState.currentQuestionIndex + 1}`;

    const container = document.getElementById('question-container');
    container.innerHTML = `
        <h3>${q.text}</h3>
        <div class="options-container">
             ${q.options.map(opt => `<button class="option-btn" onclick="selectOption(this, '${opt}')">${opt}</button>`).join('')}
        </div>
    `;

    // Level 1 Hidden Route Trigger
    if (gameState.level === 1 && !gameState.pathChoice) {
        const hiddenBtn = document.createElement('button');
        hiddenBtn.innerText = "???";
        hiddenBtn.className = "path-btn hidden-btn";
        hiddenBtn.style = "position:absolute; top:10px; right:10px; opacity:0.1;";
        hiddenBtn.onclick = () => loadLevel(1, 'backlog_king');
        document.getElementById('question-screen').appendChild(hiddenBtn);
    }
}

let currentSelection = null;
function selectOption(btn, ans) {
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentSelection = ans;
}

async function submitAnswer() {
    if (!gameState.gameActive) {
        alert("Game is over!");
        return;
    }
    if (!currentSelection) return alert("Select an option!");

    const q = gameState.currentQuestions[gameState.currentQuestionIndex];

    try {
        const res = await fetch(`${API_BASE_URL}/submit_answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_id: gameState.playerId,
                level: gameState.level,
                question_id: q.id,
                answer: currentSelection
            })
        });

        if (res.status === 403) {
            endGameAndReport("TIME UP — Game Over");
            return;
        }

        const data = await res.json();
        if (data.status === 'correct') {
            gameState.score = data.new_score;
            scoreDisplay.textContent = gameState.score;
            nextQuestion();
        } else {
            alert("Incorrect! Try again.");
        }
    } catch (e) { console.error(e); }
}

function nextQuestion() {
    currentSelection = null;
    gameState.currentQuestionIndex++;
    if (gameState.currentQuestionIndex < gameState.currentQuestions.length) {
        renderQuestion();
    } else {
        // Level Up
        if (gameState.level >= 5) {
            endGameAndReport("MISSION COMPLETE — Partner Saved!");
        } else {
            loadLevel(gameState.level + 1);
        }
    }
}

async function submitCode() {
    if (!gameState.gameActive) {
        alert("Game is over!");
        return;
    }

    const code = document.getElementById('code-editor').value;
    const btn = document.querySelector('#coding-screen button');

    btn.textContent = "COMPILING...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/submit_code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: gameState.playerId, code: code })
        });

        btn.textContent = "COMPILE & EXECUTE";
        btn.disabled = false;

        if (res.status === 403) {
            endGameAndReport("TIME UP — Game Over");
            return;
        }

        const data = await res.json();
        if (data.status === 'CORRECT') {
            gameState.score = data.new_score;
            endGameAndReport("YOU SAVED THE PARTNER!");
        } else {
            const resultDiv = document.getElementById('code-result');
            resultDiv.textContent = "OUTPUT: WRONG ANSWER";
            resultDiv.style.color = "red";
        }
    } catch (e) {
        console.error(e);
        btn.disabled = false;
    }
}

function choosePath(path) {
    loadLevel(gameState.level, path);
}

// Initial binding for Start Level 0 button (from Story screen)
window.startLevel = loadLevel;
