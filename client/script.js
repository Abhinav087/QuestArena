const API_BASE_URL = window.location.origin;

const STORAGE = {
    username: "qa_username",
    token: "qa_token",
    sessionId: "qa_session_id",
    progress: "qa_progress",
};

const TAB_KEY = "qa_active_tab";
const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const TAB_HEARTBEAT_MS = 2000;
const TAB_STALE_MS = 15000;
const TAB_HANDOFF_WAIT_MS = 1200;

let gameState = {
    username: "",
    token: "",
    sessionId: null,
    level: 0,
    score: 0,
    statusPollInterval: null,
    heartbeatInterval: null,
    currentQuestions: [],
    currentQuestionIndex: 0,
    pathChoice: null,
    gameActive: false,
    isCompleted: false,
    ws: null,
    currentScreen: 'login',
};

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

function showScreen(screenName, options = {}) {
    const shouldPersist = options.persist !== false;
    Object.values(screens).forEach((section) => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');
    gameState.currentScreen = screenName;
    if (shouldPersist) {
        persistProgress();
    }
}

function persistProgress() {
    if (!gameState.username || !gameState.sessionId) {
        return;
    }
    const payload = {
        username: gameState.username,
        sessionId: gameState.sessionId,
        level: gameState.level,
        currentQuestionIndex: gameState.currentQuestionIndex,
        pathChoice: gameState.pathChoice,
        currentScreen: gameState.currentScreen,
        isCompleted: gameState.isCompleted,
        endMessage: document.getElementById('end-message')?.textContent || "",
        codeDraft: document.getElementById('code-editor')?.value || "",
        savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE.progress, JSON.stringify(payload));
}

function getStoredProgress() {
    const raw = localStorage.getItem(STORAGE.progress);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function clearProgress() {
    localStorage.removeItem(STORAGE.progress);
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gameState.token}`,
    };
}

function updateTimerDisplay(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    const m = Math.floor(value / 60);
    const s = value % 60;
    timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
}

function persistAuth() {
    localStorage.setItem(STORAGE.username, gameState.username);
    localStorage.setItem(STORAGE.token, gameState.token);
    localStorage.setItem(STORAGE.sessionId, String(gameState.sessionId || ""));
}

function clearAuth() {
    localStorage.removeItem(STORAGE.username);
    localStorage.removeItem(STORAGE.token);
    localStorage.removeItem(STORAGE.sessionId);
    clearProgress();
}

function startPolling(interval = 2500) {
    stopPolling();
    pollGameStatus();
    gameState.statusPollInterval = setInterval(pollGameStatus, interval);
}

function stopPolling() {
    if (gameState.statusPollInterval) {
        clearInterval(gameState.statusPollInterval);
        gameState.statusPollInterval = null;
    }
}

function startHeartbeat() {
    stopHeartbeat();
    gameState.heartbeatInterval = setInterval(async () => {
        if (!gameState.token) return;
        try {
            await fetch(`${API_BASE_URL}/api/player/heartbeat`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${gameState.token}` }
            });
        } catch (err) {
            console.error('Heartbeat failed:', err);
        }
    }, 60000);
}

function stopHeartbeat() {
    if (gameState.heartbeatInterval) {
        clearInterval(gameState.heartbeatInterval);
        gameState.heartbeatInterval = null;
    }
}

async function pollGameStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/game_status`);
        const data = await response.json();

        const waitingCount = document.getElementById('waiting-player-count');
        if (waitingCount) {
            waitingCount.textContent = Number(data.player_count || 0);
        }

        if (data.session_id) {
            gameState.sessionId = data.session_id;
        }
        updateTimerDisplay(data.remaining_seconds);

        if (data.status === 'running') {
            if (gameState.isCompleted) {
                return;
            }
            if (!gameState.username || !gameState.token) {
                showScreen('login');
                return;
            }
            if (!gameState.gameActive) {
                gameState.gameActive = true;
                hud.classList.remove('hidden');
                await restorePlayerProgress('running');
            }
        } else if (data.status === 'paused') {
            if (gameState.username) {
                gameState.gameActive = false;
                showScreen('waiting', { persist: false });
            }
        } else if (data.status === 'waiting') {
            if (gameState.username && !gameState.gameActive) {
                showScreen('waiting');
            }
        } else if (data.status === 'ended' && gameState.gameActive) {
            endGame('Session ended');
        }
    } catch (err) {
        console.error('Status poll failed:', err);
    }
}

function connectLiveSocket() {
    if (gameState.ws) {
        try {
            gameState.ws.close();
        } catch (err) {
            console.error(err);
        }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    gameState.ws = new WebSocket(`${protocol}://${window.location.host}/ws/live`);

    gameState.ws.onopen = () => {
        gameState.ws.send('subscribe');
    };

    gameState.ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'session_update') {
                const payload = data.payload || {};
                updateTimerDisplay(payload.remaining_seconds || 0);
                if (gameState.isCompleted) {
                    return;
                }
                if (!gameState.username || !gameState.token) {
                    showScreen('login');
                    return;
                }
                if (payload.status === 'running' && !gameState.gameActive && gameState.username) {
                    gameState.gameActive = true;
                    hud.classList.remove('hidden');
                    await restorePlayerProgress('running');
                }
                if (payload.status === 'paused' && gameState.username) {
                    gameState.gameActive = false;
                    showScreen('waiting', { persist: false });
                }
                if (payload.status === 'ended' && gameState.gameActive) {
                    endGame('Session ended');
                }
            }
        } catch (err) {
            console.error('WebSocket parse error:', err);
        }
    };

    gameState.ws.onclose = () => {
        setTimeout(connectLiveSocket, 2000);
    };
}

async function validateStoredToken() {
    const token = localStorage.getItem(STORAGE.token);
    const username = localStorage.getItem(STORAGE.username);
    const sessionId = localStorage.getItem(STORAGE.sessionId);

    if (!token || !username || !sessionId) {
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/validate-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            clearAuth();
            return false;
        }

        const data = await response.json();
        gameState.username = data.username;
        gameState.token = token;
        gameState.sessionId = data.session_id;
        gameState.score = data.score || 0;
        gameState.level = data.current_level || 0;
        scoreDisplay.textContent = gameState.score;
        levelDisplay.textContent = gameState.level;

        const waitingName = document.getElementById('waiting-team-name');
        if (waitingName) waitingName.textContent = gameState.username;
        document.getElementById('team-name').value = gameState.username;

        if (data.session_status === 'running') {
            gameState.gameActive = true;
            hud.classList.remove('hidden');
        }
        updateTimerDisplay(data.remaining_seconds);
        await restorePlayerProgress(data.session_status);
        return true;
    } catch (err) {
        console.error('Token validation failed:', err);
        clearAuth();
        return false;
    }
}

async function restorePlayerProgress(sessionStatus) {
    const progress = getStoredProgress();

    if (
        progress
        && progress.username === gameState.username
        && Number(progress.sessionId) === Number(gameState.sessionId)
        && progress.isCompleted
    ) {
        gameState.isCompleted = true;
        gameState.gameActive = false;
        stopPolling();
        stopHeartbeat();
        hud.classList.add('hidden');
        showScreen('end');
        document.getElementById('final-score').textContent = gameState.score;
        document.getElementById('end-message').textContent = progress.endMessage || 'MISSION COMPLETE';
        persistProgress();
        return;
    }

    if (sessionStatus !== 'running') {
        if (sessionStatus === 'paused') {
            showScreen('waiting', { persist: false });
            return;
        }
        showScreen('waiting');
        return;
    }

    if (!progress || progress.username !== gameState.username || Number(progress.sessionId) !== Number(gameState.sessionId)) {
        showScreen('story');
        return;
    }

    gameState.level = Number(progress.level || gameState.level || 0);
    gameState.pathChoice = progress.pathChoice || null;
    gameState.currentQuestionIndex = Number(progress.currentQuestionIndex || 0);

    const screen = progress.currentScreen || 'story';
    if (screen === 'coding' || screen === 'question' || screen === 'path') {
        await loadLevel(gameState.level, gameState.pathChoice, {
            restoreQuestionIndex: gameState.currentQuestionIndex,
            preferredScreen: screen,
            codeDraft: progress.codeDraft || "",
        });
        return;
    }

    showScreen('story');
}

async function handleLockedSessionState() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/game_status`);
        const data = await response.json();
        if (data.status === 'paused') {
            gameState.gameActive = false;
            showScreen('waiting', { persist: false });
            alert('Game is paused by admin. Your progress is saved.');
            return;
        }
    } catch (err) {
        console.error('Failed to verify session state:', err);
    }
    endGame('Session paused or ended');
}

async function startGame() {
    const nameInput = document.getElementById('team-name');
    const username = nameInput.value.trim();
    if (!username) {
        alert('Enter team name!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/player/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || 'Registration failed');
        }

        const data = await response.json();
        gameState.username = data.username;
        gameState.token = data.token;
        gameState.sessionId = data.session_id;
        gameState.score = data.score || 0;
        gameState.level = data.current_level || 0;
        gameState.isCompleted = false;
        scoreDisplay.textContent = gameState.score;
        levelDisplay.textContent = gameState.level;
        persistAuth();

        const waitingName = document.getElementById('waiting-team-name');
        if (waitingName) waitingName.textContent = gameState.username;

        if (data.status === 'running') {
            gameState.gameActive = true;
            hud.classList.remove('hidden');
            await restorePlayerProgress('running');
        } else {
            showScreen('waiting');
        }
        updateTimerDisplay(data.remaining_seconds || 0);
        persistProgress();
    } catch (err) {
        console.error(err);
        alert(err.message || 'Cannot connect to server.');
    }
}

function endGame(message, lockCompleted = false) {
    gameState.gameActive = false;
    if (lockCompleted) {
        gameState.isCompleted = true;
    }
    stopPolling();
    stopHeartbeat();
    showScreen('end');
    document.getElementById('end-message').textContent = message;
    document.getElementById('final-score').textContent = gameState.score;
    hud.classList.add('hidden');
    persistProgress();
}

async function loadLevel(level, path = null, restoreOptions = null) {
    if (!gameState.token) {
        alert('Please join first.');
        return;
    }
    if (!gameState.gameActive) {
        alert('Session is not running yet.');
        return;
    }

    gameState.level = level;
    gameState.pathChoice = path;
    gameState.currentQuestionIndex = 0;
    levelDisplay.textContent = level;

    let url = `${API_BASE_URL}/api/questions/${level}`;
    if (path) {
        url += `?path=${encodeURIComponent(path)}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to load level');
        }
        const data = await response.json();

        if (data.message === 'Choose path') {
            showScreen('path');
            document.getElementById('path-title').textContent = data.title;
            persistProgress();
            return;
        }

        if (data.question) {
            showScreen('coding');
            document.getElementById('coding-problem-text').textContent = data.question.text;
            document.getElementById('code-editor').value = restoreOptions?.codeDraft || data.question.template;
            persistProgress();
            return;
        }

        if (data.questions) {
            gameState.currentQuestions = data.questions;
            if (restoreOptions?.preferredScreen === 'question') {
                gameState.currentQuestionIndex = Math.min(
                    Math.max(0, Number(restoreOptions.restoreQuestionIndex || 0)),
                    Math.max(0, gameState.currentQuestions.length - 1)
                );
            }
            showScreen('question');
            renderQuestion();
        }
    } catch (err) {
        console.error(err);
        alert('Error loading level.');
    }
}

function renderQuestion() {
    const question = gameState.currentQuestions[gameState.currentQuestionIndex];
    document.getElementById('question-title').textContent = `Level ${gameState.level} - Q${gameState.currentQuestionIndex + 1}`;

    const container = document.getElementById('question-container');
    container.innerHTML = `
        <h3>${question.text}</h3>
        <div class="options-container">
            ${question.options.map((option) => `<button class="option-btn" onclick="selectOption(this, '${option.replace(/'/g, "\\'")}')">${option}</button>`).join('')}
        </div>
    `;
    persistProgress();
}

let currentSelection = null;

function selectOption(button, answer) {
    document.querySelectorAll('.option-btn').forEach((btn) => btn.classList.remove('selected'));
    button.classList.add('selected');
    currentSelection = answer;
    persistProgress();
}

async function submitAnswer() {
    if (!currentSelection) {
        alert('Select an option!');
        return;
    }

    const question = gameState.currentQuestions[gameState.currentQuestionIndex];
    try {
        const response = await fetch(`${API_BASE_URL}/api/submit_answer`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                level: gameState.level,
                question_id: question.id,
                answer: currentSelection,
            }),
        });

        if (response.status === 403) {
            await handleLockedSessionState();
            return;
        }
        const data = await response.json();
        if (data.status === 'already_answered') {
            alert('You already solved this question. No extra points awarded.');
            nextQuestion();
            return;
        }
        if (data.status === 'correct') {
            gameState.score = data.new_score;
            scoreDisplay.textContent = gameState.score;
            persistProgress();
            nextQuestion();
            return;
        }
        alert('Incorrect! Try again.');
    } catch (err) {
        console.error(err);
    }
}

function nextQuestion() {
    currentSelection = null;
    gameState.currentQuestionIndex += 1;

    if (gameState.currentQuestionIndex < gameState.currentQuestions.length) {
        persistProgress();
        renderQuestion();
        return;
    }

    if (gameState.level >= 5) {
        endGame('Mission complete!', true);
        return;
    }

    loadLevel(gameState.level + 1);
}

async function submitCode() {
    const code = document.getElementById('code-editor').value;
    const button = document.querySelector('#coding-screen button');
    button.textContent = 'COMPILING...';
    button.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/submit_code`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ code }),
        });

        button.textContent = 'COMPILE & EXECUTE';
        button.disabled = false;

        if (response.status === 403) {
            await handleLockedSessionState();
            return;
        }

        const data = await response.json();
        if (data.status === 'CORRECT') {
            gameState.score = data.new_score;
            scoreDisplay.textContent = gameState.score;
            persistProgress();
            endGame('YOU SAVED THE PARTNER!', true);
            return;
        }

        const resultDiv = document.getElementById('code-result');
        resultDiv.textContent = 'OUTPUT: WRONG ANSWER';
        resultDiv.style.color = 'red';
    } catch (err) {
        console.error(err);
        button.disabled = false;
        button.textContent = 'COMPILE & EXECUTE';
    }
}

function choosePath(path) {
    loadLevel(gameState.level, path);
}

function parseTabLock(rawValue) {
    if (!rawValue) return null;
    try {
        const parsed = JSON.parse(rawValue);
        if (parsed && parsed.id) {
            return {
                id: String(parsed.id),
                ts: Number(parsed.ts || 0),
            };
        }
        return null;
    } catch {
        return {
            id: String(rawValue),
            ts: 0,
        };
    }
}

function writeTabLock() {
    localStorage.setItem(TAB_KEY, JSON.stringify({ id: tabId, ts: Date.now() }));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setupAntiCheat() {
    const existing = parseTabLock(localStorage.getItem(TAB_KEY));
    const now = Date.now();
    const isExistingActive = existing && (now - existing.ts) < TAB_STALE_MS;

    if (isExistingActive && existing.id !== tabId) {
        await sleep(TAB_HANDOFF_WAIT_MS);
        const lockAfterWait = parseTabLock(localStorage.getItem(TAB_KEY));
        const stillOtherActive = lockAfterWait && lockAfterWait.id !== tabId && (Date.now() - lockAfterWait.ts) < TAB_STALE_MS;

        if (stillOtherActive) {
            alert('Multiple tabs detected. Please use only one tab for the event.');
            document.body.innerHTML = '<h2 style="color:#ff3b3b;text-align:center;padding-top:80px;">Multiple tabs are not allowed.</h2>';
            throw new Error('Multiple tabs blocked');
        }
    }

    writeTabLock();
    const tabHeartbeat = setInterval(writeTabLock, TAB_HEARTBEAT_MS);

    window.addEventListener('beforeunload', () => {
        clearInterval(tabHeartbeat);
        const lock = parseTabLock(localStorage.getItem(TAB_KEY));
        if (lock && lock.id === tabId) {
            localStorage.removeItem(TAB_KEY);
        }
    });

    window.addEventListener('storage', (event) => {
        if (event.key !== TAB_KEY || !event.newValue) return;

        const lock = parseTabLock(event.newValue);
        if (!lock) return;

        const isOtherActive = lock.id !== tabId && (Date.now() - lock.ts) < TAB_STALE_MS;
        if (isOtherActive) {
            alert('Another active tab detected. This tab will stop.');
            endGame('Blocked: multiple tabs detected');
        }
    });

    document.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('keydown', (event) => {
        if (event.key === 'F12') event.preventDefault();
        if (event.ctrlKey && event.shiftKey && ['I', 'J', 'C'].includes(event.key.toUpperCase())) {
            event.preventDefault();
        }
    });

    document.addEventListener('visibilitychange', async () => {
        if (!gameState.token) return;
        const details = document.hidden ? 'tab_hidden' : 'tab_visible';
        try {
            await fetch(`${API_BASE_URL}/api/player/activity`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ event_type: 'visibility', details }),
            });
        } catch (err) {
            console.error(err);
        }
    });
}

async function boot() {
    await setupAntiCheat();
    const editor = document.getElementById('code-editor');
    if (editor) {
        editor.addEventListener('input', () => persistProgress());
    }
    connectLiveSocket();
    const restored = await validateStoredToken();
    if (!restored) {
        showScreen('login');
    }
    startPolling(2500);
    startHeartbeat();
}

window.startLevel = loadLevel;
window.startGame = startGame;
window.submitAnswer = submitAnswer;
window.submitCode = submitCode;
window.choosePath = choosePath;

boot();
