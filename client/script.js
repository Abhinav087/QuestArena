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
const STATUS_POLL_INTERVAL_MS = 10000;
const STATUS_POLL_BACKGROUND_MS = 20000;
const WS_RECONNECT_BASE_MS = 1500;
const WS_RECONNECT_MAX_MS = 15000;
const WS_RECONNECT_WARN_AFTER = 4;
const WS_RECONNECT_FAILSAFE_AFTER = 12;
const STATUS_POLL_FAIL_WARN_AFTER = 3;
const STATUS_POLL_FAIL_FAILSAFE_AFTER = 8;
const DEFAULT_WAITING_HINT = 'The game will begin automatically once the server admin starts the timer.';

const LEVEL_INTROS = {
    0: {
        title: 'Level 0 — College Gate',
        dialogue: 'Security: "Where is your ID card? No ID, no entry." Clear the General Knowledge questions to enter the campus.'
    },
    1: {
        title: 'Level 1 — Lobby',
        dialogue: 'Reception Aunty: "Why are you roaming during class hours?" Prove yourself with English questions.'
    },
    2: {
        title: 'Level 2 — Classroom',
        dialogue: 'Teacher: "Girlfriend, ah? First answer these Aptitude questions and show me your focus."'
    },
    3: {
        title: 'Level 3 — Lab',
        dialogue: 'Lab Incharge: "You skipped lab from day one! Solve reasoning questions or forget externals."'
    },
    4: {
        title: 'Level 4 — Server Room',
        dialogue: 'System Admin: "Students are not allowed to touch admin systems. Let us see your technical strength."'
    },
    5: {
        title: 'Level 5 — Top Floor',
        dialogue: 'Principal: "One final coding question. Clear it, and both of you walk free."'
    },
};

const ARENA_WIDTH = 1920;
const ARENA_HEIGHT = 1080;
const ARENA_TILE = 64;
const CHARACTER_SIZE = 32;
const CHARACTER_TILE_OFFSET = (ARENA_TILE - CHARACTER_SIZE) / 2;
const CAMERA_ZOOM = 1.5;
const PLAYER_SPEED = 3.2;
const PLAYER_ANIM_MS = 150;
const NPC_GUIDE_SPEED = 2.35;
const NPC_SNAP_DISTANCE = 1.2;
const NPC_REPATH_MS = 450;
const MOVEMENT_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'w', 'W', 'a', 'A', 's', 'S', 'd', 'D',
]);

function getArenaViewportSize() {
    return {
        width: ARENA_WIDTH,
        height: ARENA_HEIGHT,
    };
}

function createEmptyMap(width, height) {
    return Array.from({ length: height }, () => Array(width).fill('0'));
}

function addBorderWalls(map, width, height) {
    for (let x = 0; x < width; x++) {
        map[0][x] = '1';
        map[height - 1][x] = '1';
    }
    for (let y = 0; y < height; y++) {
        map[y][0] = '1';
        map[y][width - 1] = '1';
    }
}

function finalizeCollisions(level, solidTiles) {
    level.collisions = Array.from({ length: level.height }, () => Array(level.width).fill(false));
    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            level.collisions[y][x] = solidTiles.has(level.tiles[y][x]);
        }
    }
}

function getTileImageName(tileType, visualLevel) {
    const tileMap = {
        '0': `floor_l${visualLevel}.png`,
        '1': `wall_l${visualLevel}.png`,
        '2': 'door_l1.png',
        '3': 'portal_l1.png',
        '4': 'desk_l1.png',
        '5': 'computer_l1.png',
        '6': 'plant_l1.png',
        '7': 'bookshelf_l1.png',
        '8': 'lab_table_l2.png',
        '9': 'server_rack_l3.png',
        '10': 'chair_l4.png',
        '11': 'water_tank_l2.png',
        '12': 'caution_sign_l5.png',
        '13': 'stairs_up_l1.png',
        '14': 'lift_l1.png',
    };
    return tileMap[tileType] || `floor_l${visualLevel}.png`;
}

const ARENA_LEVELS = [
    {
        id: 0,
        name: 'College Gate',
        width: 15,
        height: 12,
        tiles: createEmptyMap(15, 12),
        npc: { spriteId: 1, x: 7, y: 5, name: 'Security', questionLevel: 0 },
        portal: { x: 7, y: 1, targetLevel: 1 },
        playerStart: { x: 7, y: 9 },
    },
    {
        id: 1,
        name: 'Lobby',
        width: 18,
        height: 14,
        tiles: createEmptyMap(18, 14),
        npc: { spriteId: 2, x: 9, y: 4, name: 'Reception Aunty', questionLevel: 1 },
        portal: { x: 9, y: 1, targetLevel: 2 },
        hiddenLift: { x: 14, y: 10, targetLevel: 3 },
        playerStart: { x: 9, y: 11 },
    },
    {
        id: 2,
        name: 'Classroom',
        width: 16,
        height: 12,
        tiles: createEmptyMap(16, 12),
        npc: { spriteId: 3, x: 8, y: 5, name: 'Teacher', questionLevel: 2 },
        portal: { x: 8, y: 1, targetLevel: 3 },
        playerStart: { x: 8, y: 9 },
    },
    {
        id: 3,
        name: 'Lab',
        width: 18,
        height: 14,
        tiles: createEmptyMap(18, 14),
        npc: { spriteId: 4, x: 9, y: 4, name: 'Lab Incharge', questionLevel: 3 },
        portal: { x: 9, y: 1, targetLevel: 4 },
        hiddenLift: { x: 3, y: 11, targetLevel: null },
        playerStart: { x: 9, y: 11 },
    },
    {
        id: 4,
        name: 'Server Room',
        width: 16,
        height: 12,
        tiles: createEmptyMap(16, 12),
        npc: { spriteId: 5, x: 8, y: 5, name: 'System Admin', questionLevel: 4 },
        portal: { x: 8, y: 3, targetLevel: 5 },
        playerStart: { x: 8, y: 9 },
    },
    {
        id: 5,
        name: 'Top Floor',
        width: 16,
        height: 12,
        tiles: createEmptyMap(16, 12),
        npc: { spriteId: 5, x: 8, y: 5, name: 'Principal', questionLevel: 5 },
        portal: { x: 8, y: 3, targetLevel: null },
        playerStart: { x: 8, y: 9 },
    },
];

addBorderWalls(ARENA_LEVELS[0].tiles, 15, 12);
ARENA_LEVELS[0].tiles[2][2] = '6';
ARENA_LEVELS[0].tiles[2][12] = '6';
ARENA_LEVELS[0].tiles[5][1] = '7';
ARENA_LEVELS[0].tiles[6][1] = '7';
ARENA_LEVELS[0].tiles[5][6] = '4';
ARENA_LEVELS[0].tiles[5][7] = '4';
ARENA_LEVELS[0].tiles[5][8] = '4';
ARENA_LEVELS[0].tiles[1][7] = '2';
finalizeCollisions(ARENA_LEVELS[0], new Set(['1', '7', '4', '6']));

addBorderWalls(ARENA_LEVELS[1].tiles, 18, 14);
ARENA_LEVELS[1].tiles[6][3] = '8';
ARENA_LEVELS[1].tiles[6][4] = '8';
ARENA_LEVELS[1].tiles[6][5] = '8';
ARENA_LEVELS[1].tiles[6][12] = '8';
ARENA_LEVELS[1].tiles[6][13] = '8';
ARENA_LEVELS[1].tiles[6][14] = '8';
ARENA_LEVELS[1].tiles[8][2] = '11';
ARENA_LEVELS[1].tiles[8][15] = '11';
ARENA_LEVELS[1].tiles[9][1] = '12';
ARENA_LEVELS[1].tiles[9][16] = '12';
ARENA_LEVELS[1].tiles[1][9] = '13';
ARENA_LEVELS[1].tiles[10][14] = '14';
finalizeCollisions(ARENA_LEVELS[1], new Set(['1', '8', '11']));

addBorderWalls(ARENA_LEVELS[2].tiles, 16, 12);
for (let y = 3; y <= 8; y++) {
    ARENA_LEVELS[2].tiles[y][2] = '9';
    ARENA_LEVELS[2].tiles[y][4] = '9';
    ARENA_LEVELS[2].tiles[y][11] = '9';
    ARENA_LEVELS[2].tiles[y][13] = '9';
}
ARENA_LEVELS[2].tiles[7][7] = '5';
ARENA_LEVELS[2].tiles[7][8] = '5';
ARENA_LEVELS[2].tiles[1][8] = '2';
finalizeCollisions(ARENA_LEVELS[2], new Set(['1', '9']));

addBorderWalls(ARENA_LEVELS[3].tiles, 18, 14);
ARENA_LEVELS[3].tiles[6][3] = '4';
ARENA_LEVELS[3].tiles[6][4] = '4';
ARENA_LEVELS[3].tiles[6][5] = '4';
ARENA_LEVELS[3].tiles[6][12] = '4';
ARENA_LEVELS[3].tiles[6][13] = '4';
ARENA_LEVELS[3].tiles[6][14] = '4';
ARENA_LEVELS[3].tiles[5][4] = '5';
ARENA_LEVELS[3].tiles[5][13] = '5';
ARENA_LEVELS[3].tiles[7][4] = '10';
ARENA_LEVELS[3].tiles[7][13] = '10';
ARENA_LEVELS[3].tiles[2][2] = '6';
ARENA_LEVELS[3].tiles[2][15] = '6';
ARENA_LEVELS[3].tiles[1][9] = '13';
ARENA_LEVELS[3].tiles[11][3] = '14';
finalizeCollisions(ARENA_LEVELS[3], new Set(['1', '4', '6']));

function decorateRooftop(level) {
    addBorderWalls(level.tiles, 16, 12);
    level.tiles[2][2] = '12';
    level.tiles[2][13] = '12';
    for (let x = 6; x <= 10; x++) {
        for (let y = 4; y <= 6; y++) {
            if (x === 6 || x === 10 || y === 4 || y === 6) {
                level.tiles[y][x] = '1';
            }
        }
    }
    level.tiles[3][8] = '3';
    finalizeCollisions(level, new Set(['1']));
}

decorateRooftop(ARENA_LEVELS[4]);
decorateRooftop(ARENA_LEVELS[5]);

function applyLargeWorldLayout(level, targetWidth, targetHeight) {
    const oldTiles = level.tiles;
    const oldWidth = level.width;
    const oldHeight = level.height;
    const offsetX = Math.floor((targetWidth - oldWidth) / 2);
    const offsetY = Math.floor((targetHeight - oldHeight) / 2);

    const expanded = createEmptyMap(targetWidth, targetHeight);
    addBorderWalls(expanded, targetWidth, targetHeight);

    for (let y = 0; y < oldHeight; y++) {
        for (let x = 0; x < oldWidth; x++) {
            expanded[y + offsetY][x + offsetX] = oldTiles[y][x];
        }
    }

    const laneX1 = Math.floor(targetWidth * 0.28);
    const laneX2 = Math.floor(targetWidth * 0.68);
    const gapY = Math.floor(targetHeight * 0.54);
    for (let y = 2; y < targetHeight - 2; y++) {
        if (Math.abs(y - gapY) <= 1) continue;
        expanded[y][laneX1] = '1';
        expanded[y][laneX2] = '1';
    }

    for (let x = 3; x < targetWidth - 3; x += 7) {
        for (let y = 3; y < targetHeight - 3; y += 6) {
            if ((x + y + level.id) % 3 === 0) expanded[y][x] = '6';
            else if ((x + y + level.id) % 3 === 1) expanded[y][x] = '12';
        }
    }

    level.width = targetWidth;
    level.height = targetHeight;
    level.tiles = expanded;

    level.npc.x += offsetX;
    level.npc.y += offsetY;
    level.portal.x += offsetX;
    level.portal.y += offsetY;
    if (level.hiddenLift) {
        level.hiddenLift.x += offsetX;
        level.hiddenLift.y += offsetY;
    }
    level.playerStart.x += offsetX;
    level.playerStart.y += offsetY;

    const protectedPoints = [
        level.npc,
        level.portal,
        level.playerStart,
    ];

    if (level.hiddenLift) {
        protectedPoints.push(level.hiddenLift);
    }

    protectedPoints.forEach((point) => {
        for (let py = point.y - 1; py <= point.y + 1; py++) {
            for (let px = point.x - 1; px <= point.x + 1; px++) {
                if (py <= 0 || px <= 0 || py >= level.height - 1 || px >= level.width - 1) continue;
                if (level.tiles[py][px] === '1' || level.tiles[py][px] === '6' || level.tiles[py][px] === '12') {
                    level.tiles[py][px] = '0';
                }
            }
        }
    });

    if (level.id === 0) level.tiles[level.portal.y][level.portal.x] = '2';
    if (level.id === 4 || level.id === 5) level.tiles[level.portal.y][level.portal.x] = '3';
    if (level.hiddenLift) level.tiles[level.hiddenLift.y][level.hiddenLift.x] = '14';

    finalizeCollisions(level, new Set(['1', '4', '6', '7', '8', '9', '11']));
}

const LARGE_WORLD_SIZES = [
    { width: 86, height: 58 },
    { width: 92, height: 62 },
    { width: 88, height: 60 },
    { width: 96, height: 64 },
    { width: 84, height: 56 },
    { width: 84, height: 56 },
];

ARENA_LEVELS.forEach((level, index) => {
    const size = LARGE_WORLD_SIZES[index];
    applyLargeWorldLayout(level, size.width, size.height);
});

let gameState = {
    username: "",
    token: "",
    sessionId: null,
    level: 0,
    score: 0,
    statusPollInterval: null,
    statusPollInFlight: false,
    heartbeatInterval: null,
    currentQuestions: [],
    currentQuestionIndex: 0,
    pathChoice: null,
    gameActive: false,
    isCompleted: false,
    ws: null,
    wsReconnectAttempts: 0,
    wsReconnectTimer: null,
    wsIntentionalClose: false,
    wsWarningShown: false,
    statusPollFailures: 0,
    statusPollWarningShown: false,
    currentScreen: 'login',
    pendingAfterIntro: null,
    shownLevelIntros: {},
    hiddenRouteAttempted: false,
    hiddenRouteActive: false,
    hiddenRouteLiftReady: false,
    arena: {
        currentLevel: 0,
        playerX: 0,
        playerY: 0,
        facing: 'down',
        frame: 0,
        isMoving: false,
        lastFrameAt: 0,
        keys: new Set(),
        images: new Map(),
        imagesLoaded: false,
        cameraX: 0,
        cameraY: 0,
        targetCameraX: 0,
        targetCameraY: 0,
        activeModal: null,
        transitioning: false,
        challengeCleared: {},
        dialogue: {
            open: false,
            speaker: '',
            lines: [],
            index: 0,
            onComplete: null,
        },
        currentPrompt: null,
        interactionCandidates: [],
        promptSelectionIndex: 0,
        loopId: null,
        portalOverride: {},
        companion: {
            unlocked: false,
            visible: false,
            name: 'BackLog King',
            spriteId: 5,
            worldX: 0,
            worldY: 0,
            state: 'idle',
            path: [],
            pathIndex: 0,
            nextRepathAt: 0,
        },
    },
};

const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    story: document.getElementById('story-screen'),
    levelIntro: document.getElementById('level-intro-screen'),
    hiddenRoute: document.getElementById('hidden-route-screen'),
    arena: document.getElementById('arena-screen'),
    path: document.getElementById('path-selection'),
    question: document.getElementById('question-screen'),
    coding: document.getElementById('coding-screen'),
    end: document.getElementById('end-screen')
};

function getAvailableScreens() {
    return Object.values(screens).filter(Boolean);
}

const hud = document.getElementById('game-hud');
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');
const hudStatus = document.getElementById('hud-status');
const modalBackdrop = document.getElementById('modal-backdrop');
const fadeOverlay = document.getElementById('fade-overlay');

const arenaModals = {
    path: document.getElementById('path-selection'),
    question: document.getElementById('question-screen'),
    coding: document.getElementById('coding-screen'),
};

function showScreen(screenName, options = {}) {
    const shouldPersist = options.persist !== false;
    const availableScreens = getAvailableScreens();
    availableScreens.forEach((section) => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });

    const target = screens[screenName] || screens.login || availableScreens[0] || null;
    if (!target) {
        console.error('No screen nodes available to render');
        return;
    }

    target.classList.remove('hidden');
    target.classList.add('active');
    gameState.currentScreen = screenName in screens && screens[screenName] ? screenName : 'login';
    if (gameState.currentScreen !== 'arena') {
        clearMovementKeys();
        closeArenaModals();
    }
    if (shouldPersist) {
        persistProgress();
    }
}

function setHudStatus(text) {
    if (hudStatus) {
        hudStatus.textContent = text;
    }
}

function setWaitingHint(text = DEFAULT_WAITING_HINT) {
    const hintNode = document.querySelector('.waiting-hint');
    if (hintNode) {
        hintNode.textContent = text;
    }
}

function clearLiveSocketReconnectTimer() {
    if (gameState.wsReconnectTimer) {
        clearTimeout(gameState.wsReconnectTimer);
        gameState.wsReconnectTimer = null;
    }
}

function closeLiveSocket(intentional = false) {
    clearLiveSocketReconnectTimer();
    const socket = gameState.ws;
    if (!socket) {
        gameState.wsIntentionalClose = intentional;
        return;
    }

    gameState.wsIntentionalClose = intentional;
    gameState.ws = null;
    try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
    } catch (err) {
        console.warn('WebSocket close warning:', err);
    }
}

function scheduleLiveSocketReconnect(reason = 'closed') {
    if (gameState.wsIntentionalClose || gameState.wsReconnectTimer) {
        return;
    }

    gameState.wsReconnectAttempts += 1;
    const attempt = gameState.wsReconnectAttempts;
    const exponentialDelay = Math.min(
        WS_RECONNECT_MAX_MS,
        WS_RECONNECT_BASE_MS * (2 ** Math.min(attempt - 1, 6))
    );
    const jitter = Math.floor(Math.random() * 500);
    const delay = exponentialDelay + jitter;

    if (attempt === WS_RECONNECT_WARN_AFTER) {
        setWaitingHint('Realtime connection is unstable. Reconnecting automatically...');
        if (gameState.currentScreen === 'arena') {
            setHudStatus('Connection unstable. Reconnecting...');
        }
    }

    if (attempt >= WS_RECONNECT_FAILSAFE_AFTER && !gameState.wsWarningShown) {
        gameState.wsWarningShown = true;
        setWaitingHint('Realtime connection is unavailable. Auto-sync mode is active.');
        if (gameState.currentScreen === 'arena') {
            setHudStatus('Realtime unavailable. Auto-sync mode active.');
        }
        alert('Live updates are temporarily unstable. The game will continue in auto-sync mode. Please keep this tab open.');
    }

    gameState.wsReconnectTimer = setTimeout(() => {
        gameState.wsReconnectTimer = null;
        connectLiveSocket();
    }, delay);

    if (attempt >= WS_RECONNECT_WARN_AFTER) {
        console.warn(`WebSocket reconnect scheduled (${reason}) in ${delay}ms (attempt ${attempt})`);
    }
}

function closeArenaModals() {
    Object.values(arenaModals).forEach((modal) => {
        if (modal) modal.classList.add('hidden');
    });
    if (modalBackdrop) modalBackdrop.classList.add('hidden');
    gameState.arena.activeModal = null;
}

function openArenaModal(type) {
    closeArenaModals();
    clearMovementKeys();
    const modal = arenaModals[type];
    if (modal) {
        modal.classList.remove('hidden');
        if (modalBackdrop) modalBackdrop.classList.remove('hidden');
        gameState.arena.activeModal = type;
    }
}

function isArenaModalOpen() {
    return gameState.arena.activeModal !== null;
}

function isArenaModalActuallyVisible() {
    if (!gameState.arena.activeModal) return false;
    const modal = arenaModals[gameState.arena.activeModal];
    if (!modal) {
        gameState.arena.activeModal = null;
        return false;
    }
    const visible = !modal.classList.contains('hidden');
    if (!visible) {
        gameState.arena.activeModal = null;
    }
    return visible;
}

function isArenaDialogueActuallyVisible() {
    const dialogueBox = document.getElementById('arena-dialogue');
    if (!dialogueBox) {
        gameState.arena.dialogue.open = false;
        return false;
    }
    const visible = gameState.arena.dialogue.open && !dialogueBox.classList.contains('hidden');
    if (!visible && gameState.arena.dialogue.open) {
        hideArenaDialogue();
    }
    return visible;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fadeTo(opacity) {
    if (!fadeOverlay) return;
    fadeOverlay.style.opacity = String(opacity);
    await sleep(340);
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
        hiddenRouteAttempted: gameState.hiddenRouteAttempted,
        hiddenRouteActive: gameState.hiddenRouteActive,
        hiddenRouteLiftReady: gameState.hiddenRouteLiftReady,
        companionUnlocked: gameState.arena.companion.unlocked,
        companionVisible: gameState.arena.companion.visible,
        companionState: gameState.arena.companion.state,
        shownLevelIntros: gameState.shownLevelIntros,
        arenaChallengeCleared: gameState.arena.challengeCleared,
        arenaPortalOverride: gameState.arena.portalOverride,
        arenaModal: gameState.arena.activeModal,
        isCompleted: gameState.isCompleted,
        endMessage: document.getElementById('end-message')?.textContent || "",
        codeDraft: document.getElementById('code-editor')?.value || "",
        savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE.progress, JSON.stringify(payload));
}

function showLevelIntro(level) {
    const intro = LEVEL_INTROS[level];
    if (!intro) {
        return false;
    }
    if (gameState.shownLevelIntros[String(level)]) {
        return false;
    }

    gameState.shownLevelIntros[String(level)] = true;
    const titleNode = document.getElementById('level-intro-title');
    const dialogueNode = document.getElementById('level-intro-dialogue');
    if (!titleNode || !dialogueNode) {
        console.error('Level intro nodes missing in DOM');
        return false;
    }

    titleNode.textContent = intro.title;
    dialogueNode.textContent = intro.dialogue;
    showScreen('levelIntro');
    persistProgress();
    return true;
}

function continueLevelIntro() {
    const next = gameState.pendingAfterIntro;
    if (!next) {
        showScreen('story');
        return;
    }

    if (next.screen === 'question') {
        showScreen('question');
        renderQuestion();
        return;
    }

    if (next.screen === 'coding') {
        showScreen('coding');
        persistProgress();
        return;
    }

    if (next.screen === 'path') {
        showScreen('path');
        persistProgress();
        return;
    }

    showScreen('story');
}

function startMission() {
    gameState.pendingAfterIntro = null;
    enterArenaLevel(gameState.level || 0);
}

function handleHiddenRoute(choice) {
    if (choice === 'investigate') {
        gameState.hiddenRouteAttempted = true;
        gameState.hiddenRouteActive = true;
        gameState.hiddenRouteLiftReady = false;
        loadLevel(1, 'backlog_king', null, { skipIntro: true });
        return;
    }

    gameState.hiddenRouteAttempted = true;
    gameState.hiddenRouteActive = false;
    gameState.hiddenRouteLiftReady = false;
    enterArenaLevel(1, { preservePlayerPosition: true });
}

function currentArenaLevel() {
    return ARENA_LEVELS[gameState.arena.currentLevel];
}

function updateArenaLevelTitle() {
    const level = currentArenaLevel();
    const titleNode = document.getElementById('arena-level-title');
    if (level && titleNode) {
        titleNode.textContent = `Level ${level.id} — ${level.name}`;
    }
}

function placePlayerAtStart(levelIndex) {
    const level = ARENA_LEVELS[levelIndex];
    gameState.arena.playerX = level.playerStart.x * ARENA_TILE + CHARACTER_TILE_OFFSET;
    gameState.arena.playerY = level.playerStart.y * ARENA_TILE + CHARACTER_TILE_OFFSET;
    gameState.arena.facing = 'down';
    gameState.arena.frame = 0;
}

function placePlayerAtTile(tileX, tileY) {
    gameState.arena.playerX = tileX * ARENA_TILE + CHARACTER_TILE_OFFSET;
    gameState.arena.playerY = tileY * ARENA_TILE + CHARACTER_TILE_OFFSET;
    gameState.arena.frame = 0;
}

function hideArenaDialogue() {
    gameState.arena.dialogue.open = false;
    gameState.arena.dialogue.lines = [];
    gameState.arena.dialogue.index = 0;
    gameState.arena.dialogue.onComplete = null;
    const dialogueBox = document.getElementById('arena-dialogue');
    if (dialogueBox) dialogueBox.classList.add('hidden');
}

function openArenaDialogue(speaker, lines, onComplete = null) {
    closeArenaModals();
    clearMovementKeys();
    const dialogueBox = document.getElementById('arena-dialogue');
    const speakerNode = document.getElementById('arena-dialogue-speaker');
    const textNode = document.getElementById('arena-dialogue-text');
    if (!dialogueBox || !speakerNode || !textNode) return;

    gameState.arena.dialogue.open = true;
    gameState.arena.dialogue.speaker = speaker;
    gameState.arena.dialogue.lines = lines;
    gameState.arena.dialogue.index = 0;
    gameState.arena.dialogue.onComplete = onComplete;

    speakerNode.textContent = speaker;
    textNode.textContent = lines[0] || '';
    setHudStatus(`Dialogue: ${speaker}`);
    dialogueBox.classList.remove('hidden');
}

function continueArenaDialogue() {
    if (!gameState.arena.dialogue.open) return;
    const textNode = document.getElementById('arena-dialogue-text');
    const state = gameState.arena.dialogue;

    if (state.index < state.lines.length - 1) {
        state.index += 1;
        if (textNode) textNode.textContent = state.lines[state.index];
        return;
    }

    const onComplete = state.onComplete;
    hideArenaDialogue();
    setHudStatus('Explore the area and interact.');
    if (typeof onComplete === 'function') {
        onComplete();
    }
}

async function loadArenaAssets() {
    const spriteUrls = [];
    ['down', 'up', 'left', 'right'].forEach((direction) => {
        [0, 1, 2].forEach((frame) => {
            spriteUrls.push(`/assets/sprites/player_${direction}_${frame}.png`);
        });
    });
    for (let i = 1; i <= 5; i++) {
        spriteUrls.push(`/assets/sprites/npc_${i}.png`);
    }

    const tileNames = [
        'floor', 'wall', 'door', 'portal', 'stairs_up', 'desk',
        'computer', 'plant', 'bookshelf', 'lab_table', 'server_rack', 'lift',
        'chair', 'water_tank', 'caution_sign'
    ];
    const tileUrls = [];
    tileNames.forEach((name) => {
        for (let level = 1; level <= 5; level++) {
            tileUrls.push(`/assets/tiles/${name}_l${level}.png`);
        }
    });

    const allUrls = [...new Set([...spriteUrls, ...tileUrls])];

    await Promise.all(allUrls.map((url) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            gameState.arena.images.set(url, img);
            resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
    })));

    gameState.arena.imagesLoaded = true;
}

function isBlocked(level, x, y) {
    const collisionPadding = 4;
    const corners = [
        { x: x + collisionPadding, y: y + collisionPadding },
        { x: x + CHARACTER_SIZE - collisionPadding, y: y + collisionPadding },
        { x: x + collisionPadding, y: y + CHARACTER_SIZE - collisionPadding },
        { x: x + CHARACTER_SIZE - collisionPadding, y: y + CHARACTER_SIZE - collisionPadding },
    ];

    for (const point of corners) {
        const tx = Math.floor(point.x / ARENA_TILE);
        const ty = Math.floor(point.y / ARENA_TILE);
        if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return true;
        if (level.collisions[ty][tx]) return true;
    }
    return false;
}

function distanceToTile(x, y, tileX, tileY) {
    const cx = x + CHARACTER_SIZE / 2;
    const cy = y + CHARACTER_SIZE / 2;
    const tx = tileX * ARENA_TILE + ARENA_TILE / 2;
    const ty = tileY * ARENA_TILE + ARENA_TILE / 2;
    return Math.hypot(cx - tx, cy - ty);
}

function distanceToPoint(x, y, targetX, targetY) {
    const cx = x + CHARACTER_SIZE / 2;
    const cy = y + CHARACTER_SIZE / 2;
    return Math.hypot(cx - targetX, cy - targetY);
}

function tileToWorldX(tileX) {
    return tileX * ARENA_TILE + CHARACTER_TILE_OFFSET;
}

function tileToWorldY(tileY) {
    return tileY * ARENA_TILE + CHARACTER_TILE_OFFSET;
}

function getEntityTilePosition(worldX, worldY) {
    const x = worldX + CHARACTER_SIZE / 2;
    const y = worldY + CHARACTER_SIZE / 2;
    return {
        tileX: Math.round((x - ARENA_TILE / 2) / ARENA_TILE),
        tileY: Math.round((y - ARENA_TILE / 2) / ARENA_TILE),
    };
}

function getPlayerTilePosition() {
    return getEntityTilePosition(gameState.arena.playerX, gameState.arena.playerY);
}

function isWalkableTile(level, tileX, tileY) {
    return tileX >= 0
        && tileY >= 0
        && tileX < level.width
        && tileY < level.height
        && !level.collisions[tileY][tileX];
}

function findNearestWalkableTile(level, tileX, tileY, maxRadius = 6) {
    for (let radius = 0; radius <= maxRadius; radius++) {
        for (let y = tileY - radius; y <= tileY + radius; y++) {
            for (let x = tileX - radius; x <= tileX + radius; x++) {
                const onRing = Math.abs(x - tileX) === radius || Math.abs(y - tileY) === radius;
                if (!onRing) continue;
                if (isWalkableTile(level, x, y)) {
                    return { x, y };
                }
            }
        }
    }
    return null;
}

function setCompanionPositionFromTile(tileX, tileY) {
    gameState.arena.companion.worldX = tileToWorldX(tileX);
    gameState.arena.companion.worldY = tileToWorldY(tileY);
}

function getCompanionTilePosition() {
    return getEntityTilePosition(gameState.arena.companion.worldX, gameState.arena.companion.worldY);
}

function buildTilePath(level, startTile, endTile) {
    const key = (x, y) => `${x},${y}`;
    const queue = [{ x: startTile.x, y: startTile.y }];
    const visited = new Set([key(startTile.x, startTile.y)]);
    const parent = new Map();
    const moves = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
    ];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.x === endTile.x && current.y === endTile.y) {
            const path = [];
            let walk = key(current.x, current.y);
            while (walk) {
                const [px, py] = walk.split(',').map(Number);
                path.push({ x: px, y: py });
                walk = parent.get(walk);
            }
            return path.reverse();
        }

        for (const move of moves) {
            const nx = current.x + move.x;
            const ny = current.y + move.y;
            if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
            if (level.collisions[ny][nx]) continue;
            const nKey = key(nx, ny);
            if (visited.has(nKey)) continue;
            visited.add(nKey);
            parent.set(nKey, key(current.x, current.y));
            queue.push({ x: nx, y: ny });
        }
    }

    return [];
}

function buildPathFromCompanionToTile(level, targetTile) {
    const companionTile = getCompanionTilePosition();
    let startTile = companionTile;
    if (!isWalkableTile(level, startTile.tileX, startTile.tileY)) {
        const fallback = findNearestWalkableTile(level, startTile.tileX, startTile.tileY, 8);
        if (!fallback) return [];
        startTile = { tileX: fallback.x, tileY: fallback.y };
        setCompanionPositionFromTile(fallback.x, fallback.y);
    }
    return buildTilePath(
        level,
        { x: startTile.tileX, y: startTile.tileY },
        { x: targetTile.x, y: targetTile.y }
    );
}

function startCompanionFollowing() {
    if (!gameState.arena.companion.unlocked) return;
    gameState.arena.companion.visible = true;
    gameState.arena.companion.state = 'following';
    gameState.arena.companion.path = [];
    gameState.arena.companion.pathIndex = 0;
    gameState.arena.companion.nextRepathAt = 0;
}

function syncCompanionForCurrentLevel() {
    const level = currentArenaLevel();
    if (!gameState.arena.companion.unlocked) {
        gameState.arena.companion.visible = false;
        return;
    }

    const playerTile = getPlayerTilePosition();
    const spawnTile = findNearestWalkableTile(level, playerTile.tileX + 1, playerTile.tileY, 8)
        || findNearestWalkableTile(level, playerTile.tileX, playerTile.tileY + 1, 8)
        || findNearestWalkableTile(level, playerTile.tileX, playerTile.tileY, 8);

    if (spawnTile) {
        setCompanionPositionFromTile(spawnTile.x, spawnTile.y);
    } else {
        setCompanionPositionFromTile(level.npc.x, level.npc.y);
    }

    gameState.arena.companion.visible = true;
    gameState.arena.companion.path = [];
    gameState.arena.companion.pathIndex = 0;
    if (level.id === 1 && gameState.hiddenRouteLiftReady) {
        gameState.arena.companion.state = 'guiding';
        startBacklogKingGuideToLift();
    } else {
        gameState.arena.companion.state = 'following';
    }
}

function startBacklogKingGuideToLift() {
    const level = currentArenaLevel();
    if (level.id !== 1 || !level.hiddenLift || !gameState.arena.companion.unlocked) return;

    gameState.arena.companion.visible = true;
    gameState.arena.companion.state = 'guiding';

    const playerTile = getPlayerTilePosition();
    let companionTile = getCompanionTilePosition();
    const tileDistance = Math.hypot(playerTile.tileX - companionTile.tileX, playerTile.tileY - companionTile.tileY);
    if (tileDistance > 8) {
        const spawnTile = findNearestWalkableTile(level, playerTile.tileX + 1, playerTile.tileY, 8)
            || findNearestWalkableTile(level, playerTile.tileX, playerTile.tileY + 1, 8)
            || findNearestWalkableTile(level, playerTile.tileX, playerTile.tileY, 8);
        if (spawnTile) {
            setCompanionPositionFromTile(spawnTile.x, spawnTile.y);
            companionTile = { tileX: spawnTile.x, tileY: spawnTile.y };
        }
    }

    const path = buildPathFromCompanionToTile(level, { x: level.hiddenLift.x, y: level.hiddenLift.y });

    if (!path.length) {
        setHudStatus('BackLog King unlocked the lift. Follow him there.');
        startCompanionFollowing();
        return;
    }

    if (path.length === 1) {
        setHudStatus('BackLog King reached the lift. Press E near the lift.');
        startCompanionFollowing();
        return;
    }

    gameState.arena.companion.path = path;
    gameState.arena.companion.pathIndex = 1;
    gameState.arena.companion.nextRepathAt = performance.now() + NPC_REPATH_MS;
    setHudStatus('BackLog King is moving to the hidden lift. Follow him.');
}

function updateCompanionMovement() {
    const companion = gameState.arena.companion;
    if (!companion.unlocked || !companion.visible) return;

    const level = currentArenaLevel();
    const now = performance.now();

    if (companion.state === 'guiding') {
        if (level.id !== 1 || !level.hiddenLift || !gameState.hiddenRouteLiftReady) {
            startCompanionFollowing();
            return;
        }
        if (now >= companion.nextRepathAt || !companion.path.length || companion.pathIndex >= companion.path.length) {
            const liftPath = buildPathFromCompanionToTile(level, { x: level.hiddenLift.x, y: level.hiddenLift.y });
            companion.path = liftPath;
            companion.pathIndex = liftPath.length > 1 ? 1 : liftPath.length;
            companion.nextRepathAt = now + NPC_REPATH_MS;
        }
    } else if (companion.state === 'following') {
        const playerTile = getPlayerTilePosition();
        const companionTile = getCompanionTilePosition();
        const tileGap = Math.hypot(playerTile.tileX - companionTile.tileX, playerTile.tileY - companionTile.tileY);

        if (tileGap <= 2) {
            companion.path = [];
            companion.pathIndex = 0;
            return;
        }

        if (now >= companion.nextRepathAt || !companion.path.length || companion.pathIndex >= companion.path.length) {
            const followPath = buildPathFromCompanionToTile(level, { x: playerTile.tileX, y: playerTile.tileY });
            companion.path = followPath;
            companion.pathIndex = followPath.length > 1 ? 1 : followPath.length;
            companion.nextRepathAt = now + NPC_REPATH_MS;
        }
    } else {
        return;
    }

    if (!companion.path.length || companion.pathIndex >= companion.path.length) {
        if (companion.state === 'guiding') {
            setHudStatus('BackLog King reached the lift. Press E near the lift.');
        }
        return;
    }

    const targetTile = companion.path[companion.pathIndex];
    const targetX = tileToWorldX(targetTile.x);
    const targetY = tileToWorldY(targetTile.y);

    const dx = targetX - companion.worldX;
    const dy = targetY - companion.worldY;
    const distance = Math.hypot(dx, dy);

    if (distance <= NPC_SNAP_DISTANCE) {
        companion.worldX = targetX;
        companion.worldY = targetY;
        companion.pathIndex += 1;
        return;
    }

    const step = Math.min(NPC_GUIDE_SPEED, distance);
    companion.worldX += (dx / distance) * step;
    companion.worldY += (dy / distance) * step;
}

function getInteractionCandidates() {
    const level = currentArenaLevel();
    const playerX = gameState.arena.playerX;
    const playerY = gameState.arena.playerY;
    const companion = gameState.arena.companion;
    const staticNpcCenterX = tileToWorldX(level.npc.x) + CHARACTER_SIZE / 2;
    const staticNpcCenterY = tileToWorldY(level.npc.y) + CHARACTER_SIZE / 2;

    const targetLimit = ARENA_TILE * 1.28;
    const npcDistance = distanceToPoint(playerX, playerY, staticNpcCenterX, staticNpcCenterY);
    const portalDistance = distanceToTile(playerX, playerY, level.portal.x, level.portal.y);
    const liftDistance = level.hiddenLift
        ? distanceToTile(playerX, playerY, level.hiddenLift.x, level.hiddenLift.y)
        : Number.POSITIVE_INFINITY;

    const candidates = [];

    if (npcDistance < targetLimit) {
        candidates.push({
            type: 'npc',
            distance: npcDistance,
            tileX: level.npc.x,
            tileY: level.npc.y,
            worldX: staticNpcCenterX,
            worldY: staticNpcCenterY,
            prompt: `Press E to talk to ${level.npc.name}`,
        });
    }

    if (portalDistance < targetLimit) {
        const portalUnlocked = Boolean(gameState.arena.challengeCleared[level.npc.questionLevel]);
        candidates.push({
            type: 'portal',
            distance: portalDistance,
            tileX: level.portal.x,
            tileY: level.portal.y,
            prompt: portalUnlocked ? 'Press E to enter portal' : 'Portal locked. Clear challenge first',
        });
    }

    if (level.hiddenLift && liftDistance < targetLimit) {
        const liftActive = level.id === 1 ? gameState.hiddenRouteLiftReady : level.id === 3;
        candidates.push({
            type: 'lift',
            distance: liftDistance,
            tileX: level.hiddenLift.x,
            tileY: level.hiddenLift.y,
            prompt: liftActive ? 'Press E to use lift' : 'Lift inactive',
        });
    }

    if (companion.unlocked && companion.visible) {
        const companionCenterX = companion.worldX + CHARACTER_SIZE / 2;
        const companionCenterY = companion.worldY + CHARACTER_SIZE / 2;
        const companionDistance = distanceToPoint(playerX, playerY, companionCenterX, companionCenterY);
        if (companionDistance < targetLimit) {
            const companionTile = getCompanionTilePosition();
            candidates.push({
                type: 'companion',
                distance: companionDistance,
                tileX: companionTile.tileX,
                tileY: companionTile.tileY,
                worldX: companionCenterX,
                worldY: companionCenterY,
                prompt: `Press E to talk to ${companion.name}`,
            });
        }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates;
}

function getSelectedInteractionTarget() {
    const candidates = gameState.arena.interactionCandidates;
    if (!candidates.length) return null;
    const index = Math.max(0, Math.min(gameState.arena.promptSelectionIndex, candidates.length - 1));
    gameState.arena.promptSelectionIndex = index;
    return candidates[index];
}

function cyclePromptSelection(direction = 1) {
    const candidates = gameState.arena.interactionCandidates;
    if (!candidates.length) return;
    const total = candidates.length;
    const step = direction >= 0 ? 1 : -1;
    gameState.arena.promptSelectionIndex = (gameState.arena.promptSelectionIndex + step + total) % total;
    updateInteractionPrompt();
}

function updateInteractionPrompt() {
    const promptNode = document.getElementById('arena-interact-prompt');
    const promptListNode = document.getElementById('arena-interact-prompt-list');
    if (!promptNode) return;

    const hidePromptList = () => {
        if (!promptListNode) return;
        promptListNode.classList.add('hidden');
        promptListNode.innerHTML = '';
    };

    const dialogueBlocking = isArenaDialogueActuallyVisible();
    const modalBlocking = isArenaModalActuallyVisible();

    if (gameState.currentScreen !== 'arena' || dialogueBlocking || modalBlocking || gameState.arena.transitioning) {
        promptNode.classList.add('hidden');
        hidePromptList();
        gameState.arena.currentPrompt = null;
        gameState.arena.interactionCandidates = [];
        return;
    }

    const candidates = getInteractionCandidates();
    gameState.arena.interactionCandidates = candidates;

    if (!candidates.length) {
        promptNode.classList.add('hidden');
        hidePromptList();
        gameState.arena.currentPrompt = null;
        gameState.arena.promptSelectionIndex = 0;
        return;
    }

    if (gameState.arena.promptSelectionIndex >= candidates.length) {
        gameState.arena.promptSelectionIndex = 0;
    }

    const target = getSelectedInteractionTarget();
    gameState.arena.currentPrompt = target;
    if (!target) {
        promptNode.classList.add('hidden');
        hidePromptList();
        return;
    }

    if (candidates.length === 1 || !promptListNode) {
        const anchorX = target.worldX ?? (target.tileX * ARENA_TILE + ARENA_TILE / 2);
        const anchorY = target.worldY ?? (target.tileY * ARENA_TILE + ARENA_TILE / 2);
        const screenX = (anchorX - gameState.arena.cameraX) * CAMERA_ZOOM;
        const screenY = (anchorY - CHARACTER_SIZE / 2 - gameState.arena.cameraY) * CAMERA_ZOOM - 10;

        promptNode.textContent = target.prompt;
        promptNode.style.left = `${Math.round(screenX)}px`;
        promptNode.style.top = `${Math.round(screenY)}px`;
        promptNode.classList.remove('hidden');

        hidePromptList();
        return;
    }

    const anchorX = target.worldX ?? (target.tileX * ARENA_TILE + ARENA_TILE / 2);
    const anchorY = target.worldY ?? (target.tileY * ARENA_TILE + ARENA_TILE / 2);
    const rawScreenX = (anchorX - gameState.arena.cameraX) * CAMERA_ZOOM;
    const rawScreenY = (anchorY - CHARACTER_SIZE / 2 - gameState.arena.cameraY) * CAMERA_ZOOM - 10;

    promptNode.classList.add('hidden');
    promptListNode.innerHTML = `${candidates.map((candidate, index) => {
        const activeClass = index === gameState.arena.promptSelectionIndex ? ' active' : '';
        const marker = index === gameState.arena.promptSelectionIndex ? '▶' : '•';
        return `<div class="arena-prompt-item${activeClass}">${marker} ${candidate.prompt}</div>`;
    }).join('')}<div class="arena-prompt-hint">Tab / Shift+Tab to switch interaction</div>`;

    const viewportPadding = 16;
    const listWidth = promptListNode.offsetWidth || 360;
    const listHeight = promptListNode.offsetHeight || 140;
    const clampedX = Math.max(
        viewportPadding + listWidth / 2,
        Math.min(window.innerWidth - viewportPadding - listWidth / 2, rawScreenX)
    );
    const clampedY = Math.max(
        viewportPadding + listHeight,
        Math.min(window.innerHeight - viewportPadding, rawScreenY)
    );

    promptListNode.style.left = `${Math.round(clampedX)}px`;
    promptListNode.style.top = `${Math.round(clampedY)}px`;
    promptListNode.classList.remove('hidden');
}

function getCameraTarget(level, canvas) {
    const cameraViewWidth = canvas.width / CAMERA_ZOOM;
    const cameraViewHeight = canvas.height / CAMERA_ZOOM;
    const worldWidth = level.width * ARENA_TILE;
    const worldHeight = level.height * ARENA_TILE;
    let targetX = gameState.arena.playerX + CHARACTER_SIZE / 2 - cameraViewWidth / 2;
    let targetY = gameState.arena.playerY + CHARACTER_SIZE / 2 - cameraViewHeight / 2;

    if (worldWidth <= cameraViewWidth) {
        targetX = -(cameraViewWidth - worldWidth) / 2;
    } else {
        targetX = Math.max(0, Math.min(targetX, worldWidth - cameraViewWidth));
    }

    if (worldHeight <= cameraViewHeight) {
        targetY = -(cameraViewHeight - worldHeight) / 2;
    } else {
        targetY = Math.max(0, Math.min(targetY, worldHeight - cameraViewHeight));
    }

    return { targetX, targetY };
}

function resetCameraToPlayer() {
    const canvas = document.getElementById('arena-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const level = currentArenaLevel();
    const { targetX, targetY } = getCameraTarget(level, canvas);
    gameState.arena.cameraX = targetX;
    gameState.arena.cameraY = targetY;
    gameState.arena.targetCameraX = targetX;
    gameState.arena.targetCameraY = targetY;
}

function interactInArena() {
    if (gameState.currentScreen !== 'arena') return;
    if (gameState.arena.dialogue.open) {
        continueArenaDialogue();
        return;
    }

    const level = currentArenaLevel();
    const target = gameState.arena.currentPrompt || getSelectedInteractionTarget();
    if (!target) {
        setHudStatus('Move closer to an NPC, portal, or lift and press E.');
        return;
    }

    if (target.type === 'npc') {
        if (gameState.arena.challengeCleared[level.npc.questionLevel]) {
            openArenaDialogue(level.npc.name, ['You already cleared this floor. The portal is active.']);
            setHudStatus('Portal unlocked. Press E near the portal to enter.');
            return;
        }

        openArenaDialogue(level.npc.name, [
            `You reached ${level.name}.`,
            'Clear my challenge to unlock the portal.'
        ], () => {
            loadLevel(level.npc.questionLevel, null, null, { skipIntro: true });
        });
        return;
    }

    if (target.type === 'portal') {
        if (!gameState.arena.challengeCleared[level.npc.questionLevel]) {
            setHudStatus('Portal locked. Clear this floor challenge first.');
            return;
        }

        if (level.id === 1 && !gameState.hiddenRouteAttempted) {
            showScreen('hiddenRoute');
            setHudStatus('A strange voice echoes from nearby...');
            persistProgress();
            return;
        }

        const forcedTarget = gameState.arena.portalOverride[level.id];
        const portalTarget = forcedTarget ?? level.portal.targetLevel;
        void transitionToLevel(portalTarget);
        return;
    }

    if (target.type === 'lift') {
        if (level.id === 1) {
            if (!gameState.hiddenRouteLiftReady) {
                setHudStatus('Lift inactive. Investigate and clear the hidden challenge first.');
                return;
            }

            gameState.hiddenRouteLiftReady = false;
            setHudStatus('Hidden lift engaged. Skipping ahead...');
            void transitionToLevelWithOptions(3, { spawnAtLift: true });
            return;
        }

        if (level.id === 3) {
            openArenaDialogue('BackLog King', [
                'You have arrived through the hidden route.',
                'Continue your mission from this floor.'
            ]);
            setHudStatus('Hidden route complete.');
            return;
        }
    }

    if (target.type === 'companion') {
        openArenaDialogue(gameState.arena.companion.name, [
            gameState.hiddenRouteLiftReady
                ? 'Stay close. The hidden lift is ready.'
                : 'I am with you. Let us keep moving floor by floor.'
        ]);
        return;
    }
}

function isFacingTarget(tileX, tileY) {
    const playerCx = gameState.arena.playerX + CHARACTER_SIZE / 2;
    const playerCy = gameState.arena.playerY + CHARACTER_SIZE / 2;
    const targetCx = tileX * ARENA_TILE + ARENA_TILE / 2;
    const targetCy = tileY * ARENA_TILE + ARENA_TILE / 2;
    const dx = targetCx - playerCx;
    const dy = targetCy - playerCy;

    if (gameState.arena.facing === 'up') return dy < 0 && Math.abs(dy) >= Math.abs(dx) - 4;
    if (gameState.arena.facing === 'down') return dy > 0 && Math.abs(dy) >= Math.abs(dx) - 4;
    if (gameState.arena.facing === 'left') return dx < 0 && Math.abs(dx) >= Math.abs(dy) - 4;
    return dx > 0 && Math.abs(dx) >= Math.abs(dy) - 4;
}

async function transitionToLevel(targetLevel) {
    if (gameState.arena.transitioning) return;
    gameState.arena.transitioning = true;
    await fadeTo(1);

    if (targetLevel === null || targetLevel === undefined) {
        await fadeTo(0);
        gameState.arena.transitioning = false;
        endGame('YOU SAVED THE PARTNER!', true);
        return;
    }

    enterArenaLevel(targetLevel);
    await fadeTo(0);
    gameState.arena.transitioning = false;
}

async function transitionToLevelWithOptions(targetLevel, options = {}) {
    if (gameState.arena.transitioning) return;
    gameState.arena.transitioning = true;
    await fadeTo(1);

    if (targetLevel === null || targetLevel === undefined) {
        await fadeTo(0);
        gameState.arena.transitioning = false;
        endGame('YOU SAVED THE PARTNER!', true);
        return;
    }

    enterArenaLevel(targetLevel, options);
    await fadeTo(0);
    gameState.arena.transitioning = false;
}

function drawArena() {
    const canvas = document.getElementById('arena-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const level = currentArenaLevel();
    const visualLevel = Math.min(level.id + 1, 5);
    const cameraX = gameState.arena.cameraX;
    const cameraY = gameState.arena.cameraY;
    const cameraViewWidth = canvas.width / CAMERA_ZOOM;
    const cameraViewHeight = canvas.height / CAMERA_ZOOM;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(CAMERA_ZOOM, 0, 0, CAMERA_ZOOM, 0, 0);

    const startX = Math.max(0, Math.floor(cameraX / ARENA_TILE) - 1);
    const startY = Math.max(0, Math.floor(cameraY / ARENA_TILE) - 1);
    const endX = Math.min(level.width - 1, Math.ceil((cameraX + cameraViewWidth) / ARENA_TILE) + 1);
    const endY = Math.min(level.height - 1, Math.ceil((cameraY + cameraViewHeight) / ARENA_TILE) + 1);

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            const px = x * ARENA_TILE;
            const py = y * ARENA_TILE;
            const screenX = px - cameraX;
            const screenY = py - cameraY;
            const tileType = level.tiles[y][x];
            const tileName = getTileImageName(tileType, visualLevel);
            const tileImage = gameState.arena.images.get(`/assets/tiles/${tileName}`);
            if (tileImage) {
                ctx.drawImage(tileImage, screenX, screenY, ARENA_TILE, ARENA_TILE);
            } else {
                ctx.fillStyle = level.collisions[y][x] ? '#2d233d' : '#14181f';
                ctx.fillRect(screenX, screenY, ARENA_TILE, ARENA_TILE);
            }
        }
    }

    const portalUnlocked = Boolean(gameState.arena.challengeCleared[level.npc.questionLevel]);
    const portalImage = gameState.arena.images.get('/assets/tiles/portal_l1.png');
    const portalX = level.portal.x * ARENA_TILE - cameraX;
    const portalY = level.portal.y * ARENA_TILE - cameraY;
    if (portalUnlocked && portalImage) {
        ctx.drawImage(portalImage, portalX, portalY, ARENA_TILE, ARENA_TILE);
    } else if (portalUnlocked) {
        ctx.fillStyle = '#00d4ff';
        ctx.fillRect(portalX + 8, portalY + 8, ARENA_TILE - 16, ARENA_TILE - 16);
    }

    const npcImage = gameState.arena.images.get(`/assets/sprites/npc_${level.npc.spriteId}.png`);
    const npcX = level.npc.x * ARENA_TILE + CHARACTER_TILE_OFFSET - cameraX;
    const npcY = level.npc.y * ARENA_TILE + CHARACTER_TILE_OFFSET - cameraY;
    if (npcImage) {
        ctx.drawImage(npcImage, npcX, npcY, CHARACTER_SIZE, CHARACTER_SIZE);
    } else {
        ctx.fillStyle = '#ff5ea8';
        ctx.fillRect(npcX + 8, npcY + 8, CHARACTER_SIZE - 16, CHARACTER_SIZE - 16);
    }

    const playerImage = gameState.arena.images.get(
        `/assets/sprites/player_${gameState.arena.facing}_${gameState.arena.frame}.png`
    );
    const playerScreenX = gameState.arena.playerX - cameraX;
    const playerScreenY = gameState.arena.playerY - cameraY;
    if (playerImage) {
        ctx.drawImage(playerImage, playerScreenX, playerScreenY, CHARACTER_SIZE, CHARACTER_SIZE);
    } else {
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(playerScreenX + 8, playerScreenY + 8, CHARACTER_SIZE - 16, CHARACTER_SIZE - 16);
    }

    ctx.fillStyle = '#f2f2f2';
    ctx.font = '14px Arial';
    if (npcX > -80 && npcX < cameraViewWidth + 20 && npcY > -40 && npcY < cameraViewHeight + 20) {
        ctx.fillText(level.npc.name, npcX - 16, npcY - 6);
    }

    const companion = gameState.arena.companion;
    if (companion.unlocked && companion.visible) {
        const companionImage = gameState.arena.images.get(`/assets/sprites/npc_${companion.spriteId}.png`);
        const companionX = companion.worldX - cameraX;
        const companionY = companion.worldY - cameraY;
        if (companionImage) {
            ctx.drawImage(companionImage, companionX, companionY, CHARACTER_SIZE, CHARACTER_SIZE);
        } else {
            ctx.fillStyle = '#ffd300';
            ctx.fillRect(companionX + 8, companionY + 8, CHARACTER_SIZE - 16, CHARACTER_SIZE - 16);
        }

        ctx.fillStyle = '#ffe98b';
        ctx.font = '14px Arial';
        if (companionX > -100 && companionX < cameraViewWidth + 20 && companionY > -40 && companionY < cameraViewHeight + 20) {
            ctx.fillText(companion.name, companionX - 22, companionY - 6);
        }
    }

    if (level.hiddenLift) {
        const liftX = level.hiddenLift.x * ARENA_TILE - cameraX;
        const liftY = level.hiddenLift.y * ARENA_TILE - cameraY;
        ctx.fillStyle = '#d2e3ff';
        ctx.font = '13px Arial';
        if (liftX > -80 && liftX < cameraViewWidth + 20 && liftY > -40 && liftY < cameraViewHeight + 20) {
            ctx.fillText('Lift', liftX + 10, liftY - 6);
        }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function resizeArenaCanvas() {
    const canvas = document.getElementById('arena-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const { width, height } = getArenaViewportSize();
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
}

function tickArena() {
    if (gameState.currentScreen !== 'arena') {
        gameState.arena.loopId = null;
        return;
    }

    const dialogueBlocking = isArenaDialogueActuallyVisible();
    const modalBlocking = isArenaModalActuallyVisible();

    if (!dialogueBlocking && !modalBlocking && !gameState.arena.transitioning) {
        const level = currentArenaLevel();
        let dx = 0;
        let dy = 0;
        let moving = false;

        if (gameState.arena.keys.has('ArrowUp') || gameState.arena.keys.has('w') || gameState.arena.keys.has('W')) {
            dy -= PLAYER_SPEED;
            gameState.arena.facing = 'up';
            moving = true;
        }
        if (gameState.arena.keys.has('ArrowDown') || gameState.arena.keys.has('s') || gameState.arena.keys.has('S')) {
            dy += PLAYER_SPEED;
            gameState.arena.facing = 'down';
            moving = true;
        }
        if (gameState.arena.keys.has('ArrowLeft') || gameState.arena.keys.has('a') || gameState.arena.keys.has('A')) {
            dx -= PLAYER_SPEED;
            gameState.arena.facing = 'left';
            moving = true;
        }
        if (gameState.arena.keys.has('ArrowRight') || gameState.arena.keys.has('d') || gameState.arena.keys.has('D')) {
            dx += PLAYER_SPEED;
            gameState.arena.facing = 'right';
            moving = true;
        }

        const nextX = gameState.arena.playerX + dx;
        const nextY = gameState.arena.playerY + dy;

        if (!isBlocked(level, nextX, gameState.arena.playerY)) gameState.arena.playerX = nextX;
        if (!isBlocked(level, gameState.arena.playerX, nextY)) gameState.arena.playerY = nextY;

        if (moving) {
            const now = performance.now();
            if (now - gameState.arena.lastFrameAt > PLAYER_ANIM_MS) {
                gameState.arena.frame = (gameState.arena.frame + 1) % 3;
                gameState.arena.lastFrameAt = now;
            }
        } else {
            gameState.arena.frame = 0;
        }

        const canvas = document.getElementById('arena-canvas');
        if (canvas instanceof HTMLCanvasElement) {
            const { targetX, targetY } = getCameraTarget(level, canvas);
            gameState.arena.targetCameraX = targetX;
            gameState.arena.targetCameraY = targetY;
        }
    }

    if (!dialogueBlocking && !modalBlocking && !gameState.arena.transitioning) {
        updateCompanionMovement();
    }

    if (!dialogueBlocking && !modalBlocking && !gameState.arena.transitioning) {
        gameState.arena.cameraX += (gameState.arena.targetCameraX - gameState.arena.cameraX) * 0.18;
        gameState.arena.cameraY += (gameState.arena.targetCameraY - gameState.arena.cameraY) * 0.18;
    }

    drawArena();
    updateInteractionPrompt();
    gameState.arena.loopId = requestAnimationFrame(tickArena);
}

function startArenaLoop() {
    if (gameState.arena.loopId) cancelAnimationFrame(gameState.arena.loopId);
    gameState.arena.loopId = requestAnimationFrame(tickArena);
}

function enterArenaLevel(levelIndex, options = {}) {
    if (!ARENA_LEVELS[levelIndex]) return;
    const preservePlayerPosition = Boolean(options.preservePlayerPosition);
    const spawnAtLift = Boolean(options.spawnAtLift);
    const previousLevel = gameState.arena.currentLevel;
    gameState.arena.currentLevel = levelIndex;
    gameState.level = levelIndex;
    levelDisplay.textContent = levelIndex;
    resizeArenaCanvas();
    if (spawnAtLift && ARENA_LEVELS[levelIndex].hiddenLift) {
        placePlayerAtTile(ARENA_LEVELS[levelIndex].hiddenLift.x, ARENA_LEVELS[levelIndex].hiddenLift.y);
    } else if (!preservePlayerPosition || previousLevel !== levelIndex) {
        placePlayerAtStart(levelIndex);
    }
    closeArenaModals();
    resetCameraToPlayer();
    updateArenaLevelTitle();
    hideArenaDialogue();
    clearMovementKeys();
    gameState.arena.promptSelectionIndex = 0;
    gameState.arena.interactionCandidates = [];
    syncCompanionForCurrentLevel();
    setHudStatus(`Talk to ${ARENA_LEVELS[levelIndex].npc.name}`);
    showScreen('arena');
    startArenaLoop();
}

function clearMovementKeys() {
    gameState.arena.keys.clear();
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

function startPolling(interval = STATUS_POLL_INTERVAL_MS) {
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
    if (gameState.statusPollInFlight) {
        return;
    }

    gameState.statusPollInFlight = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/game_status`);
        if (!response.ok) {
            throw new Error(`Status poll failed (${response.status})`);
        }
        const data = await response.json();
        if (gameState.statusPollFailures >= STATUS_POLL_FAIL_WARN_AFTER) {
            setWaitingHint(DEFAULT_WAITING_HINT);
            if (gameState.currentScreen === 'arena') {
                setHudStatus('Connection restored.');
            }
        }
        gameState.statusPollFailures = 0;
        gameState.statusPollWarningShown = false;

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
        gameState.statusPollFailures += 1;
        if (gameState.statusPollFailures === STATUS_POLL_FAIL_WARN_AFTER) {
            setWaitingHint('Temporary network issue detected. Retrying automatically...');
            if (gameState.currentScreen === 'arena') {
                setHudStatus('Network issue detected. Retrying...');
            }
        }
        if (
            gameState.statusPollFailures >= STATUS_POLL_FAIL_FAILSAFE_AFTER
            && !gameState.statusPollWarningShown
        ) {
            gameState.statusPollWarningShown = true;
            setWaitingHint('Connection to server is unstable. We are retrying in the background.');
            alert('Connection is unstable. The game keeps retrying automatically. If this continues, check local network and keep this tab open.');
        }
        console.warn('Status poll failed:', err);
    } finally {
        gameState.statusPollInFlight = false;
    }
}

function connectLiveSocket() {
    if (gameState.ws && (gameState.ws.readyState === WebSocket.OPEN || gameState.ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let socket;
    try {
        socket = new WebSocket(`${protocol}://${window.location.host}/ws/live`);
    } catch (err) {
        console.warn('WebSocket init failed:', err);
        scheduleLiveSocketReconnect('init_failed');
        return;
    }

    gameState.wsIntentionalClose = false;
    gameState.ws = socket;

    socket.onopen = () => {
        clearLiveSocketReconnectTimer();
        const recovered = gameState.wsReconnectAttempts >= WS_RECONNECT_WARN_AFTER || gameState.wsWarningShown;
        gameState.wsReconnectAttempts = 0;
        gameState.wsWarningShown = false;
        setWaitingHint(DEFAULT_WAITING_HINT);
        if (recovered && gameState.currentScreen === 'arena') {
            setHudStatus('Live connection restored.');
        }

        try {
            socket.send('subscribe');
        } catch (err) {
            console.warn('WebSocket subscribe failed:', err);
            scheduleLiveSocketReconnect('subscribe_failed');
        }
    };

    socket.onmessage = async (event) => {
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
            console.warn('WebSocket parse warning:', err);
        }
    };

    socket.onerror = () => {
        console.warn('WebSocket transport warning. Reconnect will be attempted automatically.');
    };

    socket.onclose = (event) => {
        if (gameState.ws === socket) {
            gameState.ws = null;
        }
        if (gameState.wsIntentionalClose) {
            return;
        }
        const closeReason = event && event.reason ? event.reason : `code_${event.code || 'unknown'}`;
        scheduleLiveSocketReconnect(closeReason);
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

    if (!Object.prototype.hasOwnProperty.call(progress, 'arenaChallengeCleared')) {
        showScreen('story');
        return;
    }

    gameState.level = Number(progress.level || gameState.level || 0);
    gameState.pathChoice = progress.pathChoice || null;
    gameState.currentQuestionIndex = Number(progress.currentQuestionIndex || 0);
    gameState.hiddenRouteAttempted = Boolean(progress.hiddenRouteAttempted);
    gameState.hiddenRouteActive = Boolean(progress.hiddenRouteActive);
    gameState.hiddenRouteLiftReady = Boolean(progress.hiddenRouteLiftReady);
    gameState.arena.companion.unlocked = Boolean(progress.companionUnlocked);
    gameState.arena.companion.visible = Boolean(progress.companionVisible) || gameState.arena.companion.unlocked;
    gameState.arena.companion.state = progress.companionState || (gameState.arena.companion.unlocked ? 'following' : 'idle');
    gameState.shownLevelIntros = progress.shownLevelIntros || {};

    const screen = progress.currentScreen || 'story';
    if (screen === 'coding' || screen === 'question' || screen === 'path') {
        await loadLevel(gameState.level, gameState.pathChoice, {
            restoreQuestionIndex: gameState.currentQuestionIndex,
            preferredScreen: screen,
            codeDraft: progress.codeDraft || "",
        });
        return;
    }

    if (screen === 'arena') {
        gameState.arena.challengeCleared = progress.arenaChallengeCleared || {};
        gameState.arena.portalOverride = progress.arenaPortalOverride || {};
        enterArenaLevel(gameState.level || 0);
        if (progress.arenaModal && ['path', 'question', 'coding'].includes(progress.arenaModal)) {
            openArenaModal(progress.arenaModal);
        }
        return;
    }

    if (screen === 'hiddenRoute') {
        showScreen('hiddenRoute');
        return;
    }

    if (screen === 'levelIntro') {
        showScreen('story');
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

async function loadLevel(level, path = null, restoreOptions = null, options = {}) {
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
    gameState.pendingAfterIntro = null;
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
            gameState.pendingAfterIntro = { screen: 'path' };
            document.getElementById('path-title').textContent = data.title;
            openArenaModal('path');
            setHudStatus('Choose your path.');
            persistProgress();
            return;
        }

        if (data.question) {
            gameState.pendingAfterIntro = { screen: 'coding' };
            document.getElementById('coding-problem-text').textContent = data.question.text;
            document.getElementById('code-editor').value = restoreOptions?.codeDraft || data.question.template;
            openArenaModal('coding');
            setHudStatus('Boss challenge active.');
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
            gameState.pendingAfterIntro = { screen: 'question' };
            openArenaModal('question');
            setHudStatus(`Answer ${currentArenaLevel().npc.name}'s challenge.`);
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
        gameState.score = Math.max(0, gameState.score - 5);
        scoreDisplay.textContent = gameState.score;
        setHudStatus('Wrong answer. -5 score.');
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

    closeArenaModals();

    if (gameState.hiddenRouteActive && gameState.level === 1) {
        gameState.hiddenRouteActive = false;
        gameState.hiddenRouteAttempted = true;
        gameState.hiddenRouteLiftReady = true;
        gameState.arena.challengeCleared[1] = true;
        gameState.arena.companion.unlocked = true;
        gameState.arena.companion.visible = true;
        gameState.arena.companion.state = 'guiding';
        setHudStatus('BackLog King: follow me to the hidden lift.');
        enterArenaLevel(1, { preservePlayerPosition: true });
        startBacklogKingGuideToLift();
        openArenaDialogue('BackLog King', [
            'Good. You passed my test.',
            'Follow me. I unlocked a hidden lift on this floor.',
            'Use that lift to skip ahead.'
        ]);
        return;
    }

    if (gameState.level >= 5) {
        endGame('Mission complete!', true);
        return;
    }

    gameState.arena.challengeCleared[gameState.level] = true;
    setHudStatus('Challenge cleared. Portal unlocked (press E near portal).');
    enterArenaLevel(gameState.level, { preservePlayerPosition: true });
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
            closeArenaModals();
            gameState.arena.challengeCleared[5] = true;
            setHudStatus('Final challenge cleared. Enter portal to finish.');
            return;
        }

        const resultDiv = document.getElementById('code-result');
        resultDiv.textContent = 'OUTPUT: WRONG ANSWER';
        resultDiv.style.color = 'red';
        gameState.score = Math.max(0, gameState.score - 10);
        scoreDisplay.textContent = gameState.score;
        setHudStatus('Wrong code. -10 score.');
    } catch (err) {
        console.error(err);
        button.disabled = false;
        button.textContent = 'COMPILE & EXECUTE';
    }
}

function choosePath(path) {
    closeArenaModals();
    loadLevel(gameState.level, path, null, { skipIntro: true });
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
        closeLiveSocket(true);
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
        if (document.hidden) {
            clearMovementKeys();
            startPolling(STATUS_POLL_BACKGROUND_MS);
        } else {
            startPolling(STATUS_POLL_INTERVAL_MS);
        }
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
    await loadArenaAssets();
    const editor = document.getElementById('code-editor');
    if (editor) {
        editor.addEventListener('input', () => persistProgress());
    }
    connectLiveSocket();
    const restored = await validateStoredToken();
    if (!restored) {
        showScreen('login');
    }

    window.addEventListener('keydown', (event) => {
        const targetTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
        const typingInInput = targetTag === 'input' || targetTag === 'textarea';

        if (gameState.currentScreen !== 'arena') {
            return;
        }

        if (event.key === 'Enter') {
            if (gameState.arena.dialogue.open) {
                event.preventDefault();
                continueArenaDialogue();
                return;
            }

            if (gameState.arena.activeModal === 'question' && !typingInInput) {
                event.preventDefault();
                submitAnswer();
                return;
            }

            if (!isArenaModalActuallyVisible()) {
                event.preventDefault();
                interactInArena();
                return;
            }
        }

        if (event.key === 'e' || event.key === 'E') {
            if (!isArenaModalActuallyVisible()) {
                event.preventDefault();
                interactInArena();
            }
            return;
        }

        if (event.key === 'Tab' && !typingInInput && !isArenaModalActuallyVisible()) {
            event.preventDefault();
            cyclePromptSelection(event.shiftKey ? -1 : 1);
            return;
        }

        if (!typingInInput && !isArenaModalActuallyVisible() && MOVEMENT_KEYS.has(event.key)) {
            gameState.arena.keys.add(event.key);
        }
    });

    window.addEventListener('keyup', (event) => {
        if (gameState.currentScreen === 'arena') {
            gameState.arena.keys.delete(event.key);
        }
    });

    window.addEventListener('blur', () => {
        clearMovementKeys();
    });

    window.addEventListener('resize', () => {
        if (gameState.currentScreen === 'arena') {
            resizeArenaCanvas();
            resetCameraToPlayer();
        }
    });

    startPolling(STATUS_POLL_INTERVAL_MS);
    startHeartbeat();
}

window.startLevel = loadLevel;
window.startMission = startMission;
window.continueLevelIntro = continueLevelIntro;
window.startGame = startGame;
window.submitAnswer = submitAnswer;
window.submitCode = submitCode;
window.choosePath = choosePath;
window.handleHiddenRoute = handleHiddenRoute;
window.continueArenaDialogue = continueArenaDialogue;

boot();
