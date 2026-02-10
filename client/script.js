const API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "") ? "http://localhost:8000" : `http://${window.location.hostname}:8000`;

let gameState = {
    playerId: null,
    teamName: "",
    level: 0,
    score: 0,
    startTime: null,
    timerInterval: null,
    currentQuestions: [],
    currentQuestionIndex: 0,
    pathChoice: null
};

// --- DOM Elements ---
const screens = {
    login: document.getElementById('login-screen'),
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

// --- Game Loop ---
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

        startTimer();
        hud.classList.remove('hidden');
        showScreen('story');
    } catch (e) {
        console.error(e);
        alert("Server error. Check console.");
    }
}

function startTimer() {
    let timeLeft = 30 * 60;
    gameState.timerInterval = setInterval(() => {
        timeLeft--;
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (timeLeft <= 0) endGame("TIME UP");
    }, 1000);
}

// --- Level Logic ---
async function loadLevel(level, path = null) {
    gameState.level = level;
    gameState.pathChoice = path;
    levelDisplay.textContent = level;
    gameState.currentQuestionIndex = 0;

    let url = `${API_BASE_URL}/questions/${level}`;
    if (path) url += `?path=${path}`;

    try {
        const res = await fetch(url);
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
    if (!currentSelection) return alert("Select an option!");

    const q = gameState.currentQuestions[gameState.currentQuestionIndex];

    // Optimistic UI update or wait? Let's wait.
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
            endGame("MISSION COMPLETE");
        } else {
            loadLevel(gameState.level + 1);
        }
    }
}

async function submitCode() {
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

        const data = await res.json();
        btn.textContent = "COMPILE & EXECUTE";
        btn.disabled = false;

        if (data.status === 'CORRECT') {
            gameState.score = data.new_score;
            endGame("YOU SAVED THE PARTNER!");
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

function endGame(msg) {
    clearInterval(gameState.timerInterval);
    showScreen('end');
    document.getElementById('end-message').textContent = msg;
    document.getElementById('final-score').textContent = gameState.score;
    hud.classList.add('hidden');
}

// Initial binding for Start Level 0 button (from Story screen)
window.startLevel = loadLevel; 
