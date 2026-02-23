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
        title: 'Level 0 â€” College Gate',
        dialogue: 'Gate Security: "Stop there. No ID card, no entry." Clear the General Knowledge challenge and I will open the way to the college lobby.'
    },
    1: {
        title: 'Level 1 â€” Lobby',
        dialogue: 'Reception Aunty: "Why are you roaming during class hours?" Prove yourself with English questions.'
    },
    2: {
        title: 'Level 2 â€” Classroom',
        dialogue: 'Teacher: "Girlfriend, ah? First answer these Aptitude questions and show me your focus."'
    },
    3: {
        title: 'Level 3 â€” Lab',
        dialogue: 'Lab Incharge: "You skipped lab from day one! Solve reasoning questions or forget externals."'
    },
    4: {
        title: 'Level 4 â€” Server Room',
        dialogue: 'System Admin: "Students are not allowed to touch admin systems. Let us see your technical strength."'
    },
    5: {
        title: 'Level 5 â€” Top Floor',
        dialogue: 'Principal: "One final coding question. Clear it, and both of you walk free."'
    },
};

const ARENA_WIDTH = 1920;
const ARENA_HEIGHT = 1080;
const ARENA_TILE = 64;
const CHARACTER_SIZE = 64;
const CHARACTER_TILE_OFFSET = (ARENA_TILE - CHARACTER_SIZE) / 2;
const CAMERA_ZOOM = 1.2;
const TILE_OVERDRAW = 1 / CAMERA_ZOOM;
const PLAYER_SPEED = 4.2;
const PLAYER_ANIM_MS = 150;
const NPC_GUIDE_SPEED = 3.35;
const NPC_SNAP_DISTANCE = 1.2;
const NPC_REPATH_MS = 450;
const BASE_FRAME_MS = 1000 / 60;
function getMovementDirectionFromEvent(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            return 'up';
        case 'ArrowDown':
        case 'KeyS':
            return 'down';
        case 'ArrowLeft':
        case 'KeyA':
            return 'left';
        case 'ArrowRight':
        case 'KeyD':
            return 'right';
        default:
            break;
    }

    switch ((event.key || '').toLowerCase()) {
        case 'arrowup':
        case 'w':
            return 'up';
        case 'arrowdown':
        case 's':
            return 'down';
        case 'arrowleft':
        case 'a':
            return 'left';
        case 'arrowright':
        case 'd':
            return 'right';
        default:
            return null;
    }
}

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
        // outdoor / campus tiles (Level 0)
        'G': 'grass.png',
        'R': 'road.png',
        'RD': 'road_dash.png',
        'SW': 'sidewalk.png',
        'F': 'fence.png',
        'GP': 'gate_pillar.png',
        'T': 'tree.png',
        'PK': 'parking.png',
        'BL': 'building.png',
        'BW': 'building_window.png',
        'BD': 'building_door.png',
        'KS': 'kiosk.png',
        'FL': 'flower.png',
        'GO': 'gate_open.png',
        // lobby furniture tiles (Level 1)
        'SF': 'sofa.png',
        'NB': 'notice_board.png',
        'RC': 'reception_counter.png',
        'DF': 'diamond_floor.png',
        'BN': 'bench.png',
        // classroom tiles (Level 2)
        'CF': 'classroom_floor.png',
        'CW': 'classroom_wall.png',
        'CB': 'chalkboard.png',
        'SD': 'student_desk.png',
        'TD': 'teacher_desk.png',
        // lab tiles (Level 3)
        'LF': 'lab_floor.png',
        'LX': 'lab_wall.png',
        'LP': 'lab_partition.png',
        'LM': 'lab_monitor.png',
        'LI': 'lab_items.png',
        'LO': 'lab_office_chair.png',
        'LT': 'lab_teacher_desk.png',
        'LH': 'lab_shelf.png',
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

// â”€â”€ Level 1  Lobby (matching lobby sketch) â”€â”€
// (now handled by buildLevel1LobbyLayout below)

// (Level 2 - Classroom is now handled by buildLevel2ClassroomLayout below)

// (Level 3 - Lab is now handled by buildLevel3LabLayout below)

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

function fillTileRect(tiles, x1, y1, x2, y2, value) {
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            tiles[y][x] = value;
        }
    }
}

function strokeTileRect(tiles, x1, y1, x2, y2, value) {
    for (let x = x1; x <= x2; x++) {
        tiles[y1][x] = value;
        tiles[y2][x] = value;
    }
    for (let y = y1; y <= y2; y++) {
        tiles[y][x1] = value;
        tiles[y][x2] = value;
    }
}

function buildLevel0CampusLayout(level) {
    // â”€â”€ dimensions â”€â”€
    const W = 90;
    const H = 60;
    const CX = Math.floor(W / 2); // gate center X = 45

    // â”€â”€ vertical zone boundaries â”€â”€
    const BLDG_TOP     = 4;   // college building top
    const BLDG_BOT     = 16;  // college building bottom
    const YARD_TOP     = BLDG_BOT + 1; // 17  campus yard start
    const FENCE_Y      = 38;  // campus boundary fence row
    const ROAD_TOP     = 42;  // road zone start
    const ROAD_BOT     = H - 2; // road zone end
    const SPAWN_Y      = H - 4; // player spawn row

    // â”€â”€ horizontal zones â”€â”€
    const PARK_L = 4;  const PARK_R = 26;  // parking area
    const GARDEN_L = 54; const GARDEN_R = 86; // garden/tree area
    const GATE_HALF = 3; // gate opening half-width

    // â”€â”€ 1. Fill everything with grass â”€â”€
    const t = [];
    for (let y = 0; y < H; y++) {
        t.push(Array(W).fill('G'));
    }

    // â”€â”€ 2. Road zone (bottom) â”€â”€
    for (let y = ROAD_TOP; y <= ROAD_BOT; y++) {
        for (let x = 0; x < W; x++) {
            t[y][x] = 'R';
        }
    }
    // road center dashes
    const roadMidY = Math.floor((ROAD_TOP + ROAD_BOT) / 2);
    for (let x = 0; x < W; x++) {
        if (x % 4 < 2) {
            t[roadMidY][x] = 'RD';
        }
    }
    // sidewalk strips at road edges
    for (let x = 0; x < W; x++) {
        t[ROAD_TOP][x] = 'SW';
        t[ROAD_BOT][x] = 'SW';
    }
    // vertical entry road from road zone to gate
    for (let y = FENCE_Y + 1; y < ROAD_TOP; y++) {
        for (let x = CX - 2; x <= CX + 2; x++) {
            t[y][x] = 'SW';
        }
    }

    // â”€â”€ 3. Campus boundary fence â”€â”€
    for (let x = 1; x < W - 1; x++) {
        if (Math.abs(x - CX) <= GATE_HALF) continue; // gate opening
        t[FENCE_Y][x] = 'F';
    }
    // side fences
    for (let y = BLDG_TOP; y <= FENCE_Y; y++) {
        t[y][1] = 'F';
        t[y][W - 2] = 'F';
    }
    // top fence
    for (let x = 1; x < W - 1; x++) {
        t[BLDG_TOP - 1][x] = 'F';
    }

    // â”€â”€ 4. Gate pillars + kiosks â”€â”€
    t[FENCE_Y][CX - GATE_HALF - 1] = 'GP';
    t[FENCE_Y][CX + GATE_HALF + 1] = 'GP';
    // gate opening tiles (walkable)
    for (let x = CX - GATE_HALF; x <= CX + GATE_HALF; x++) {
        t[FENCE_Y][x] = 'GO';
    }
    // watchman kiosks flanking the gate
    t[FENCE_Y - 2][CX - GATE_HALF - 3] = 'KS';
    t[FENCE_Y - 1][CX - GATE_HALF - 3] = 'KS';
    t[FENCE_Y - 2][CX + GATE_HALF + 3] = 'KS';
    t[FENCE_Y - 1][CX + GATE_HALF + 3] = 'KS';

    // â”€â”€ 5. College building â”€â”€
    for (let y = BLDG_TOP; y <= BLDG_BOT; y++) {
        for (let x = 28; x <= 62; x++) {
            t[y][x] = 'BL';
        }
    }
    // windows on building
    for (let y = BLDG_TOP + 1; y <= BLDG_BOT - 1; y += 2) {
        for (let x = 30; x <= 60; x += 3) {
            if (Math.abs(x - CX) <= 2) continue; // skip entrance column
            t[y][x] = 'BW';
        }
    }
    // entrance (protruding section)
    for (let y = BLDG_BOT - 3; y <= BLDG_BOT + 1; y++) {
        for (let x = CX - 3; x <= CX + 3; x++) {
            t[y][x] = 'BL';
        }
    }
    // lobby entrance door (this is the portal to Level 1)
    t[BLDG_BOT + 1][CX] = 'BD';

    // â”€â”€ 6. Parking area (left side) â”€â”€
    for (let y = YARD_TOP + 2; y <= FENCE_Y - 3; y++) {
        for (let x = PARK_L; x <= PARK_R; x++) {
            t[y][x] = 'PK';
        }
    }
    // parking lot border (sidewalk)
    for (let x = PARK_L - 1; x <= PARK_R + 1; x++) {
        t[YARD_TOP + 1][x] = 'SW';
        t[FENCE_Y - 2][x] = 'SW';
    }
    for (let y = YARD_TOP + 1; y <= FENCE_Y - 2; y++) {
        t[y][PARK_L - 1] = 'SW';
        t[y][PARK_R + 1] = 'SW';
    }

    // â”€â”€ 7. Garden area with trees (right side) â”€â”€
    for (let y = YARD_TOP + 1; y <= FENCE_Y - 2; y += 3) {
        for (let x = GARDEN_L; x <= GARDEN_R; x += 4) {
            t[y][x] = 'T';
        }
    }
    // flower patches between trees
    for (let y = YARD_TOP + 2; y <= FENCE_Y - 3; y += 3) {
        for (let x = GARDEN_L + 2; x <= GARDEN_R - 2; x += 6) {
            t[y][x] = 'FL';
        }
    }

    // â”€â”€ 8. Campus walkway (center path from gate to building) â”€â”€
    for (let y = BLDG_BOT + 2; y < FENCE_Y; y++) {
        for (let x = CX - 2; x <= CX + 2; x++) {
            t[y][x] = 'SW';
        }
    }

    // â”€â”€ 9. Tree rows along walkway â”€â”€
    for (let y = BLDG_BOT + 3; y < FENCE_Y - 1; y += 3) {
        t[y][CX - 4] = 'T';
        t[y][CX + 4] = 'T';
    }

    // â”€â”€ 10. Protect key points (clear 3x3 area around NPC, portal, spawn) â”€â”€
    const npcPos   = { x: CX, y: FENCE_Y - 4 };
    const portalPos = { x: CX, y: BLDG_BOT + 1 };
    const spawnPos  = { x: CX, y: SPAWN_Y };

    [npcPos, portalPos, spawnPos].forEach((pt) => {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const py = pt.y + dy;
                const px = pt.x + dx;
                if (px <= 0 || py <= 0 || px >= W - 1 || py >= H - 1) continue;
                const cur = t[py][px];
                // only clear blocking tiles, keep grass/road/sidewalk
                if (['F', 'GP', 'KS', 'BL', 'BW', 'T', 'PK'].includes(cur)) {
                    t[py][px] = pt === spawnPos ? 'R' : 'SW';
                }
            }
        }
    });
    // restore portal door
    t[portalPos.y][portalPos.x] = 'BD';

    // â”€â”€ 11. World border (invisible collision wall) â”€â”€
    for (let x = 0; x < W; x++) { t[0][x] = 'F'; t[H - 1][x] = 'F'; }
    for (let y = 0; y < H; y++) { t[y][0] = 'F'; t[y][W - 1] = 'F'; }

    // â”€â”€ Assign to level â”€â”€
    level.width = W;
    level.height = H;
    level.tiles = t;
    level.npc = {
        spriteId: 1,
        x: npcPos.x,
        y: npcPos.y,
        name: 'Gate Security',
        questionLevel: 0,
    };
    level.portal = {
        x: portalPos.x,
        y: portalPos.y,
        targetLevel: 1,
    };
    level.playerStart = {
        x: spawnPos.x,
        y: spawnPos.y,
    };

    // solid tiles: fence, gate pillar, kiosk, building, tree, parking edges
    finalizeCollisions(level, new Set([
        'F', 'GP', 'KS', 'BL', 'BW', 'T',
        // keep original indoor solids for other levels that share this fn
        '1', '4', '6', '7', '8', '9', '11'
    ]));
}

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

// ---------------------------------------------------------------------------
//  Level 1 â€“ Lobby  (refined lobby / reception layout)
// ---------------------------------------------------------------------------
function buildLevel1LobbyLayout(level) {
    const W = 40;
    const H = 24;

    // â”€â”€ 1. Fill with lobby floor â”€â”€
    const t = [];
    for (let y = 0; y < H; y++) {
        t.push(Array(W).fill('0'));
    }

    // â”€â”€ 2. Border walls â”€â”€
    for (let x = 0; x < W; x++) { t[0][x] = '1'; t[H - 1][x] = '1'; }
    for (let y = 0; y < H; y++) { t[y][0] = '1'; t[y][W - 1] = '1'; }

    // â”€â”€ 3. Upper section (rows 1â€“4) â€” behind divider wall â”€â”€

    // Lift (elevator) at top-center wall (single tile)
    t[1][19] = '14';

    // Sofas along upper-left wall (waiting area)
    t[2][2] = 'SF';  t[2][4] = 'SF';  t[2][6] = 'SF';
    // Plant at end of sofa row
    t[2][8] = '6';

    // Notice boards on upper wall (between sofas and lift)
    t[1][10] = 'NB';
    t[1][13] = 'NB';

    // â”€â”€ 4. Divider wall (row 5) â”€â”€
    // Left section
    for (let x = 1; x <= 16; x++) t[5][x] = '1';
    // Gap opening at x = 17â€“22 (walk-through to upper area)
    // Right section
    for (let x = 23; x <= 35; x++) t[5][x] = '1';
    // Door + stairs to classroom on far right
    t[5][36] = '2';
    t[5][37] = '13';

    // â”€â”€ 5. Reception area (right side, rows 6â€“9) â”€â”€
    // Reception counter â€” horizontal desk in front of Aunty
    t[8][26] = 'RC';  t[8][27] = 'RC';  t[8][28] = 'RC';  t[8][29] = 'RC';  t[8][30] = 'RC';
    // Side returns of desk
    t[7][26] = 'RC';  t[7][30] = 'RC';
    // Plant flanking reception desk
    t[7][25] = '6';
    t[7][31] = '6';

    // â”€â”€ 6. Main lobby open area (rows 6â€“22) â”€â”€

    // Diamond decorative floor (centre of lobby)
    t[12][18] = 'DF'; t[12][19] = 'DF'; t[12][20] = 'DF';
    t[13][18] = 'DF'; t[13][19] = 'DF'; t[13][20] = 'DF';
    t[14][18] = 'DF'; t[14][19] = 'DF'; t[14][20] = 'DF';

    // Waiting chairs â€” left side (two pairs)
    t[10][5] = '10';  t[10][6] = '10';
    t[14][5] = '10';  t[14][6] = '10';

    // Bench along bottom wall
    t[21][18] = 'BN'; t[21][19] = 'BN';

    // Sofa on bottom-left area
    t[19][3] = 'SF';

    // Plants â€” sparse, natural placement
    t[6][1]  = '6';   // upper-left corner
    t[16][1] = '6';   // lower-left corner
    t[6][38] = '6';   // upper-right corner
    t[19][37] = '6';  // lower-right corner

    // Door on right wall (lower area exit)
    t[17][W - 1] = '2';

    // â”€â”€ 7. Hidden lift â€” elevator in upper area â”€â”€
    // (single tile already placed at t[1][19])

    // â”€â”€ 8. Assign to level â”€â”€
    level.width  = W;
    level.height = H;
    level.tiles  = t;

    // Reception Aunty â€” behind the counter desk
    level.npc = {
        spriteId: 2,
        x: 28,
        y: 7,
        name: 'Reception Aunty',
        questionLevel: 1,
    };

    // Portal â€” stairs on far right of divider wall
    level.portal = {
        x: 36,
        y: 5,
        targetLevel: 2,
    };

    // Hidden lift â€” elevator in upper area
    level.hiddenLift = {
        x: 19,
        y: 1,
        targetLevel: 3,
    };

    // Player spawn â€” lower lobby
    level.playerStart = {
        x: 19,
        y: 18,
    };

    // Decorative NPCs â€” students placed naturally
    level.decorativeNpcs = [
        { spriteId: 6, x: 2,  y: 10, name: 'npc' },   // boy near left chairs
        { spriteId: 7, x: 8,  y: 16, name: 'npc' },   // girl, lower-left
        { spriteId: 8, x: 9,  y: 17, name: 'npc' },   // boy, near her
        { spriteId: 9, x: 30, y: 14, name: 'npc' },   // girl, right side
        { spriteId: 6, x: 30, y: 16, name: 'npc' },   // boy, right side
        { spriteId: 7, x: 36, y: 15, name: 'npc' },   // girl, near right door
    ];

    // Solid tiles for collision
    finalizeCollisions(level, new Set([
        '1', 'SF', 'NB', 'RC', 'BN', '6', '10',
    ]));
}

// ---------------------------------------------------------------------------
//  Level 2 â€“ Classroom  (matching classroom reference image)
// ---------------------------------------------------------------------------
function buildLevel2ClassroomLayout(level) {
    const W = 30;
    const H = 20;

    // â”€â”€ 1. Fill with classroom floor â”€â”€
    const t = [];
    for (let y = 0; y < H; y++) {
        t.push(Array(W).fill('CF'));
    }

    // â”€â”€ 2. Border walls (classroom wall tiles) â”€â”€
    for (let x = 0; x < W; x++) { t[0][x] = 'CW'; t[H - 1][x] = 'CW'; }
    for (let y = 0; y < H; y++) { t[y][0] = 'CW'; t[y][W - 1] = 'CW'; }

    // â”€â”€ 3. Top interior wall (rows 1â€“2) â€” classroom front â”€â”€
    for (let x = 1; x < W - 1; x++) { t[1][x] = 'CW'; }
    // Row 2 wall behind chalkboard area (x=3..10) â€” keeps collision solid
    for (let x = 3; x <= 10; x++) { t[2][x] = 'CW'; }

    // â”€â”€ 4. Chalkboard rendered as a single combined overlay (8w Ã— 2h) â”€â”€
    // (tiles stay as CW; chalkboard_large.png drawn on top in drawArena)

    // â”€â”€ 5. Teacher desk at center-top â”€â”€
    t[3][14] = 'TD';
    t[3][15] = 'TD';

    // â”€â”€ 6. Computer desk at top right â”€â”€
    t[1][23] = '5';

    // â”€â”€ 7. Door at top right (portal to next level) â”€â”€
    t[1][26] = '2';

    // â”€â”€ 8. Student desks: 8 columns Ã— 6 rows â”€â”€
    const deskCols = [3, 6, 10, 13, 17, 20, 24, 27];
    const deskRows = [5, 7, 9, 11, 13, 15];

    for (const dy of deskRows) {
        for (const dx of deskCols) {
            t[dy][dx] = 'SD';
        }
    }

    // â”€â”€ 9. Bottom entrance (gap in bottom wall) â”€â”€
    for (let x = 13; x <= 16; x++) {
        t[H - 1][x] = 'CF';
    }
    // Small entrance corridor extending one row below bottom wall
    t[H - 2][14] = 'CF';
    t[H - 2][15] = 'CF';

    // â”€â”€ 10. Assign to level â”€â”€
    level.width = W;
    level.height = H;
    level.tiles = t;

    // Chalkboard overlay metadata (rendered as single image in drawArena)
    level.chalkboard = { x: 3, y: 1, width: 8, height: 2 };

    // Background tile codes for overlay rendering
    level.backgroundFloor = 'CF';
    level.backgroundWall = 'CW';

    // Teacher NPC â€” behind the teacher desk
    level.npc = {
        spriteId: 3,
        x: 15,
        y: 4,
        name: 'Teacher',
        questionLevel: 2,
    };

    // Portal â€” door at top right of classroom
    level.portal = {
        x: 26,
        y: 1,
        targetLevel: 3,
    };

    // Player spawn â€” bottom center (in front of entrance)
    level.playerStart = {
        x: 14,
        y: 17,
    };

    // Decorative student NPCs (seated around the room)
    level.decorativeNpcs = [
        { spriteId: 6, x: 4,  y: 6,  name: 'npc' },   // boy, front-left
        { spriteId: 7, x: 11, y: 8,  name: 'npc' },   // girl, second row
        { spriteId: 8, x: 21, y: 10, name: 'npc' },   // boy, middle-right
        { spriteId: 9, x: 7,  y: 12, name: 'npc' },   // girl, fourth row
        { spriteId: 6, x: 25, y: 14, name: 'npc' },   // boy, back-right
        { spriteId: 7, x: 14, y: 14, name: 'npc' },   // girl, back-center
    ];

    // Solid tiles for collision
    finalizeCollisions(level, new Set([
        'CW', 'SD', 'TD', '5',
    ]));
}

// ---------------------------------------------------------------------------
//  Level 3 â€“ Lab  (computer lab matching reference image)
// ---------------------------------------------------------------------------
function buildLevel3LabLayout(level) {
    const W = 26;
    const H = 20;

    // â”€â”€ 1. Fill with lab floor â”€â”€
    const t = [];
    for (let y = 0; y < H; y++) {
        t.push(Array(W).fill('LF'));
    }

    // â”€â”€ 2. Border walls â”€â”€
    for (let x = 0; x < W; x++) { t[0][x] = 'LX'; t[H - 1][x] = 'LX'; }
    for (let y = 0; y < H; y++) { t[y][0] = 'LX'; t[y][W - 1] = 'LX'; }

    // â”€â”€ 3. Top interior wall (row 1) â”€â”€
    for (let x = 1; x < W - 1; x++) { t[1][x] = 'LX'; }

    // Bookshelf on far left of top wall
    t[1][1] = '7'; t[1][2] = '7';

    // Chalkboard area (wall tiles stay LX; overlay drawn on top)
    // â†’ chalkboard overlay at x=7..11, y=1 (5 tiles wide, 1 tile tall)

    // Teacher desk (instructorâ€™s desk with laptop) â€” row 3, center
    t[3][12] = 'LT';

    // Door / portal to next level â€” right side of top wall
    t[1][21] = '2';

    // Small shelf on far right of top wall
    t[1][23] = 'LH';

    // â”€â”€ 4. Workstation area (4 clusters, each 3 rows) â”€â”€
    const leftStart  = 1;
    const leftEnd    = 11;   // 11 tiles per side
    const rightStart = 14;
    const rightEnd   = 24;
    // Centre aisle: x = 12, 13

    const clusterYs = [4, 7, 10, 13];

    // Desk pattern per side (11 tiles): items/monitors alternating
    const deskRow = ['LI', 'LM', 'LM', 'LI', 'LM', 'LM', 'LI', 'LM', 'LM', 'LI', 'LI'];

    for (const sy of clusterYs) {
        // Row A â€” partition (back wall of cubicle)
        for (let x = leftStart; x <= leftEnd; x++) { t[sy][x] = 'LP'; }
        for (let x = rightStart; x <= rightEnd; x++) { t[sy][x] = 'LP'; }

        // Row B â€” desks with monitors / items
        for (let i = 0; i <= leftEnd - leftStart; i++) {
            t[sy + 1][leftStart + i]  = deskRow[i];
            t[sy + 1][rightStart + i] = deskRow[i];
        }

        // Row C â€” office chairs (every other tile)
        for (let i = 0; i <= leftEnd - leftStart; i++) {
            if (i % 2 === 1) {
                t[sy + 2][leftStart + i]  = 'LO';
                t[sy + 2][rightStart + i] = 'LO';
            }
        }
    }

    // â”€â”€ 5. Hidden lift tile (bottom-left area) â”€â”€
    t[17][1] = '14';

    // â”€â”€ 6. Bottom entrance (gap in bottom wall) â”€â”€
    for (let x = 11; x <= 14; x++) {
        t[H - 1][x] = 'LF';
    }

    // â”€â”€ 7. Assign to level â”€â”€
    level.width  = W;
    level.height = H;
    level.tiles  = t;

    // Chalkboard overlay (rendered by drawArena on top of wall tiles)
    level.chalkboard = { x: 7, y: 1, width: 5, height: 1 };
    level.chalkboardImage = '/assets/tiles/lab_chalkboard_large.png';

    level.backgroundFloor = 'LF';
    level.backgroundWall  = 'LX';

    // Lab Incharge NPC â€” behind the teacher desk
    level.npc = {
        spriteId: 4,
        x: 12,
        y: 2,
        name: 'Lab Incharge',
        questionLevel: 3,
    };

    // Portal â€” door at top-right
    level.portal = {
        x: 21,
        y: 1,
        targetLevel: 4,
    };

    // Hidden lift
    level.hiddenLift = {
        x: 1,
        y: 17,
        targetLevel: null,
    };

    // Player spawn â€” bottom centre
    level.playerStart = {
        x: 12,
        y: 17,
    };

    // Decorative NPCs (students seated at workstations)
    level.decorativeNpcs = [
        { spriteId: 6, x: 3,  y: 6,  name: 'npc' },
        { spriteId: 7, x: 8,  y: 9,  name: 'npc' },
        { spriteId: 8, x: 16, y: 6,  name: 'npc' },
        { spriteId: 9, x: 21, y: 12, name: 'npc' },
        { spriteId: 6, x: 5,  y: 15, name: 'npc' },
        { spriteId: 7, x: 19, y: 15, name: 'npc' },
    ];

    // Solid tiles for collision
    finalizeCollisions(level, new Set([
        'LX', 'LP', 'LM', 'LI', 'LT', 'LH', '7',
    ]));
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
    if (level.id === 0) {
        buildLevel0CampusLayout(level);
        return;
    }
    if (level.id === 1) {
        buildLevel1LobbyLayout(level);
        return;
    }
    if (level.id === 2) {
        buildLevel2ClassroomLayout(level);
        return;
    }
    if (level.id === 3) {
        buildLevel3LabLayout(level);
        return;
    }
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
        lastTickAt: 0,
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
        titleNode.textContent = `Level ${level.id} â€” ${level.name}`;
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
    for (let i = 1; i <= 9; i++) {
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

    // outdoor / campus tiles (no level suffix)
    const outdoorTiles = [
        'grass', 'road', 'road_dash', 'sidewalk', 'fence', 'gate_pillar',
        'tree', 'parking', 'building', 'building_window', 'building_door',
        'kiosk', 'flower', 'gate_open', 'buildingblock',
        // lobby furniture tiles
        'sofa', 'notice_board', 'reception_counter', 'diamond_floor', 'bench',
        // classroom tiles
        'classroom_floor', 'classroom_wall', 'chalkboard', 'student_desk', 'teacher_desk',
        'chalkboard_large',
        // lab tiles (Level 3)
        'lab_floor', 'lab_wall', 'lab_partition', 'lab_monitor', 'lab_items',
        'lab_office_chair', 'lab_teacher_desk', 'lab_shelf', 'lab_chalkboard_large'
    ];
    outdoorTiles.forEach((name) => {
        tileUrls.push(`/assets/tiles/${name}.png`);
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

function updateCompanionMovement(frameScale = 1) {
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

    const step = Math.min(NPC_GUIDE_SPEED * frameScale, distance);
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
        const marker = index === gameState.arena.promptSelectionIndex ? 'â–¶' : 'â€¢';
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

function getArenaObjective() {
    if (gameState.currentScreen !== 'arena') return null;

    const level = currentArenaLevel();
    const challengeCleared = Boolean(gameState.arena.challengeCleared[level.npc.questionLevel]);

    if (level.id === 1 && gameState.hiddenRouteLiftReady && level.hiddenLift) {
        return {
            label: 'Use the hidden lift',
            worldX: level.hiddenLift.x * ARENA_TILE + ARENA_TILE / 2,
            worldY: level.hiddenLift.y * ARENA_TILE + ARENA_TILE / 2,
        };
    }

    if (!challengeCleared) {
        return {
            label: `Talk to ${level.npc.name}`,
            worldX: level.npc.x * ARENA_TILE + ARENA_TILE / 2,
            worldY: level.npc.y * ARENA_TILE + ARENA_TILE / 2,
        };
    }

    return {
        label: 'Enter the portal',
        worldX: level.portal.x * ARENA_TILE + ARENA_TILE / 2,
        worldY: level.portal.y * ARENA_TILE + ARENA_TILE / 2,
    };
}

function drawObjectivePointer(ctx, canvas, cameraX, cameraY) {
    if (gameState.arena.dialogue.open || isArenaModalActuallyVisible() || gameState.arena.transitioning) {
        return;
    }

    const objective = getArenaObjective();
    if (!objective) return;

    const accent = '#61d9ff';
    const softBg = 'rgba(0, 0, 0, 0.58)';
    const safeTop = 138;
    const sideMargin = 56;
    const targetX = (objective.worldX - cameraX) * CAMERA_ZOOM;
    const targetY = (objective.worldY - cameraY) * CAMERA_ZOOM;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const title = `Objective: ${objective.label}`;
    ctx.font = '600 15px Orbitron, Arial';
    const textWidth = ctx.measureText(title).width;
    const boxWidth = textWidth + 22;
    const boxHeight = 32;
    const boxX = Math.round((canvas.width - boxWidth) / 2);
    const boxY = safeTop;
    ctx.fillStyle = softBg;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    ctx.fillStyle = accent;
    ctx.fillText(title, boxX + 11, boxY + 21);

    const margin = sideMargin;
    const onScreen = (
        targetX > margin
        && targetX < (canvas.width - margin)
        && targetY > (safeTop + boxHeight + 20)
        && targetY < (canvas.height - margin)
    );

    if (onScreen) {
        const pulse = 6 + Math.sin(performance.now() / 220) * 2.2;
        const markerX = targetX;
        const markerY = Math.max(safeTop + boxHeight + 24, targetY - 26);

        ctx.beginPath();
        ctx.moveTo(markerX, markerY - pulse);
        ctx.lineTo(markerX - 10, markerY + 8);
        ctx.lineTo(markerX + 10, markerY + 8);
        ctx.closePath();
        ctx.fillStyle = 'rgba(9, 23, 33, 0.95)';
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(markerX, markerY - pulse);
        ctx.lineTo(markerX - 10, markerY + 8);
        ctx.lineTo(markerX + 10, markerY + 8);
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(targetX, Math.max(safeTop + boxHeight + 32, targetY), 13, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const dx = targetX - cx;
        const dy = targetY - cy;
        const angle = Math.atan2(dy, dx);
        const radius = Math.min(cx, cy) - 72;
        const rawAx = cx + Math.cos(angle) * radius;
        const rawAy = cy + Math.sin(angle) * radius;
        const ax = Math.max(sideMargin + 18, Math.min(canvas.width - sideMargin - 18, rawAx));
        const ay = Math.max(safeTop + boxHeight + 28, Math.min(canvas.height - sideMargin, rawAy));

        ctx.translate(ax, ay);
        ctx.rotate(angle + Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(5, 14, 22, 0.75)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(-12, 10);
        ctx.lineTo(12, 10);
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.fill();

        ctx.strokeStyle = '#173040';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.restore();
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
    const renderCameraX = Math.round(cameraX * CAMERA_ZOOM) / CAMERA_ZOOM;
    const renderCameraY = Math.round(cameraY * CAMERA_ZOOM) / CAMERA_ZOOM;
    const cameraViewWidth = canvas.width / CAMERA_ZOOM;
    const cameraViewHeight = canvas.height / CAMERA_ZOOM;
    const useLargeLevel0Building = level.id === 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(CAMERA_ZOOM, 0, 0, CAMERA_ZOOM, 0, 0);

    const startX = Math.max(0, Math.floor(renderCameraX / ARENA_TILE) - 1);
    const startY = Math.max(0, Math.floor(renderCameraY / ARENA_TILE) - 1);
    const endX = Math.min(level.width - 1, Math.ceil((renderCameraX + cameraViewWidth) / ARENA_TILE) + 1);
    const endY = Math.min(level.height - 1, Math.ceil((renderCameraY + cameraViewHeight) / ARENA_TILE) + 1);

    // Tiles with transparent backgrounds that need floor/wall drawn underneath
    const OVERLAY_PROP_TILES = new Set([
        'SD', 'TD',                         // classroom props
        '4', '5', '6', '7',                 // desk, computer, plant, bookshelf
        '8', '9', '10', '11', '12',         // lab_table, server_rack, chair, water_tank, caution_sign
        'SF', 'NB', 'RC', 'BN',             // lobby furniture
        'LP', 'LM', 'LI', 'LO', 'LT', 'LH', // lab props (Level 3)
    ]);

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            const px = x * ARENA_TILE;
            const py = y * ARENA_TILE;
            const screenX = px - renderCameraX;
            const screenY = py - renderCameraY;
            const tileType = level.tiles[y][x];
            if (useLargeLevel0Building && (tileType === 'BL' || tileType === 'BW' || tileType === 'BD')) {
                continue;
            }

            const halfBleed = TILE_OVERDRAW / 2;

            // Draw background tile underneath transparent props
            if (OVERLAY_PROP_TILES.has(tileType)) {
                const onBorder = y <= 1 || y >= level.height - 1 || x === 0 || x === level.width - 1;
                const bgCode = onBorder
                    ? (level.backgroundWall || '1')
                    : (level.backgroundFloor || '0');
                const bgName = getTileImageName(bgCode, visualLevel);
                const bgImg = gameState.arena.images.get(`/assets/tiles/${bgName}`);
                if (bgImg) {
                    ctx.drawImage(bgImg, screenX - halfBleed, screenY - halfBleed, ARENA_TILE + TILE_OVERDRAW, ARENA_TILE + TILE_OVERDRAW);
                }
            }

            const tileName = getTileImageName(tileType, visualLevel);
            const tileImage = gameState.arena.images.get(`/assets/tiles/${tileName}`);
            if (tileImage) {
                ctx.drawImage(
                    tileImage,
                    screenX - halfBleed,
                    screenY - halfBleed,
                    ARENA_TILE + TILE_OVERDRAW,
                    ARENA_TILE + TILE_OVERDRAW,
                );
            } else {
                ctx.fillStyle = level.collisions[y][x] ? '#2d233d' : '#14181f';
                ctx.fillRect(screenX, screenY, ARENA_TILE, ARENA_TILE);
            }
        }
    }

    // â”€â”€ Chalkboard overlay (classroom / lab) â”€â”€
    if (level.chalkboard) {
        const cbPath = level.chalkboardImage || '/assets/tiles/chalkboard_large.png';
        const cbImg = gameState.arena.images.get(cbPath);
        if (cbImg) {
            const cbScreenX = level.chalkboard.x * ARENA_TILE - renderCameraX;
            const cbScreenY = level.chalkboard.y * ARENA_TILE - renderCameraY;
            const cbW = level.chalkboard.width * ARENA_TILE;
            const cbH = level.chalkboard.height * ARENA_TILE;
            ctx.drawImage(cbImg, cbScreenX, cbScreenY, cbW, cbH);
        }
    }

    if (useLargeLevel0Building) {
        const sourceBuildingImage = gameState.arena.images.get('/assets/tiles/buildingblock.png');
        const grassTileImage = gameState.arena.images.get('/assets/tiles/grass.png');
        if (sourceBuildingImage) {
            const buildingX = 28 * ARENA_TILE;
            const buildingY = 4 * ARENA_TILE;
            const buildingW = (62 - 28 + 1) * ARENA_TILE;
            const buildingH = (17 - 4 + 1) * ARENA_TILE;
            const screenBuildingX = buildingX - renderCameraX;
            const screenBuildingY = buildingY - renderCameraY;

            if (grassTileImage) {
                for (let gy = 0; gy < buildingH; gy += ARENA_TILE) {
                    for (let gx = 0; gx < buildingW; gx += ARENA_TILE) {
                        ctx.drawImage(
                            grassTileImage,
                            screenBuildingX + gx,
                            screenBuildingY + gy,
                            ARENA_TILE,
                            ARENA_TILE,
                        );
                    }
                }
            } else {
                ctx.fillStyle = '#4aa94a';
                ctx.fillRect(screenBuildingX, screenBuildingY, buildingW, buildingH);
            }

            let cleanBuildingImage = gameState.arena.level0BuildingImage;
            if (!cleanBuildingImage || gameState.arena.level0BuildingImageSource !== sourceBuildingImage) {
                const sourceWidth = sourceBuildingImage.naturalWidth || sourceBuildingImage.width;
                const sourceHeight = sourceBuildingImage.naturalHeight || sourceBuildingImage.height;
                const offscreen = document.createElement('canvas');
                offscreen.width = sourceWidth;
                offscreen.height = sourceHeight;
                const offscreenCtx = offscreen.getContext('2d');
                if (offscreenCtx) {
                    offscreenCtx.drawImage(sourceBuildingImage, 0, 0, sourceWidth, sourceHeight);
                    const imageData = offscreenCtx.getImageData(0, 0, sourceWidth, sourceHeight);
                    const pixels = imageData.data;
                    for (let i = 0; i < pixels.length; i += 4) {
                        const red = pixels[i];
                        const green = pixels[i + 1];
                        const blue = pixels[i + 2];
                        if (red <= 10 && green <= 10 && blue <= 10) {
                            pixels[i + 3] = 0;
                        }
                    }
                    offscreenCtx.putImageData(imageData, 0, 0);
                    cleanBuildingImage = offscreen;
                    gameState.arena.level0BuildingImage = offscreen;
                    gameState.arena.level0BuildingImageSource = sourceBuildingImage;
                }
            }

            const imageToDraw = cleanBuildingImage || sourceBuildingImage;
            ctx.drawImage(
                imageToDraw,
                screenBuildingX,
                screenBuildingY,
                buildingW,
                buildingH,
            );
        }
    }

    const portalUnlocked = Boolean(gameState.arena.challengeCleared[level.npc.questionLevel]);
    const portalImage = gameState.arena.images.get('/assets/tiles/portal_l1.png');
    const portalX = level.portal.x * ARENA_TILE - renderCameraX;
    const portalY = level.portal.y * ARENA_TILE - renderCameraY;
    if (portalUnlocked && portalImage) {
        ctx.drawImage(portalImage, portalX, portalY, ARENA_TILE, ARENA_TILE);
    } else if (portalUnlocked) {
        ctx.fillStyle = '#00d4ff';
        ctx.fillRect(portalX + 8, portalY + 8, ARENA_TILE - 16, ARENA_TILE - 16);
    }

    const npcImage = gameState.arena.images.get(`/assets/sprites/npc_${level.npc.spriteId}.png`);
    const npcX = level.npc.x * ARENA_TILE + CHARACTER_TILE_OFFSET - renderCameraX;
    const npcY = level.npc.y * ARENA_TILE + CHARACTER_TILE_OFFSET - renderCameraY;
    if (npcImage) {
        ctx.drawImage(npcImage, npcX, npcY, CHARACTER_SIZE, CHARACTER_SIZE);
    } else {
        ctx.fillStyle = '#ff5ea8';
        ctx.fillRect(npcX + 8, npcY + 8, CHARACTER_SIZE - 16, CHARACTER_SIZE - 16);
    }

    // â”€â”€ Decorative (non-interactive) NPCs â”€â”€
    if (level.decorativeNpcs) {
        for (const dnpc of level.decorativeNpcs) {
            const dImg = gameState.arena.images.get(`/assets/sprites/npc_${dnpc.spriteId}.png`);
            const dx = dnpc.x * ARENA_TILE + CHARACTER_TILE_OFFSET - renderCameraX;
            const dy = dnpc.y * ARENA_TILE + CHARACTER_TILE_OFFSET - renderCameraY;
            if (dx < -80 || dx > cameraViewWidth + 40 || dy < -80 || dy > cameraViewHeight + 40) continue;
            if (dImg) {
                ctx.drawImage(dImg, dx, dy, CHARACTER_SIZE, CHARACTER_SIZE);
            } else {
                ctx.fillStyle = '#aa88cc';
                ctx.fillRect(dx + 8, dy + 8, CHARACTER_SIZE - 16, CHARACTER_SIZE - 16);
            }
            if (dnpc.name) {
                ctx.fillStyle = '#c8c8c8';
                ctx.font = '12px Arial';
                ctx.fillText(dnpc.name, dx - 4, dy - 4);
            }
        }
    }

    const playerImage = gameState.arena.images.get(
        `/assets/sprites/player_${gameState.arena.facing}_${gameState.arena.frame}.png`
    );
    const playerScreenX = gameState.arena.playerX - renderCameraX;
    const playerScreenY = gameState.arena.playerY - renderCameraY;
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
        const companionX = companion.worldX - renderCameraX;
        const companionY = companion.worldY - renderCameraY;
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
        const liftX = level.hiddenLift.x * ARENA_TILE - renderCameraX;
        const liftY = level.hiddenLift.y * ARENA_TILE - renderCameraY;
        ctx.fillStyle = '#d2e3ff';
        ctx.font = '13px Arial';
        if (liftX > -80 && liftX < cameraViewWidth + 20 && liftY > -40 && liftY < cameraViewHeight + 20) {
            ctx.fillText('Lift', liftX + 10, liftY - 6);
        }
    }

    // "WAY TO CLASSROOM â†’" sign for lobby level
    if (level.id === 1) {
        const signX = level.portal.x * ARENA_TILE - renderCameraX;
        const signY = level.portal.y * ARENA_TILE - renderCameraY;
        if (signX > -120 && signX < cameraViewWidth + 40 && signY > -40 && signY < cameraViewHeight + 40) {
            ctx.fillStyle = '#8b6914';
            ctx.font = 'bold 13px Arial';
            ctx.fillText('WAY TO CLASSROOM â†’', signX - 60, signY - 8);
        }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawObjectivePointer(ctx, canvas, renderCameraX, renderCameraY);
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
        gameState.arena.lastTickAt = 0;
        gameState.arena.loopId = null;
        return;
    }

    const tickNow = performance.now();
    const deltaMs = gameState.arena.lastTickAt > 0 ? tickNow - gameState.arena.lastTickAt : BASE_FRAME_MS;
    gameState.arena.lastTickAt = tickNow;
    const frameScale = Math.max(0.5, Math.min(2, deltaMs / BASE_FRAME_MS));

    const dialogueBlocking = isArenaDialogueActuallyVisible();
    const modalBlocking = isArenaModalActuallyVisible();

    if (!dialogueBlocking && !modalBlocking && !gameState.arena.transitioning) {
        const level = currentArenaLevel();
        let dx = 0;
        let dy = 0;
        let moving = false;

        if (gameState.arena.keys.has('up')) {
            dy -= PLAYER_SPEED * frameScale;
            gameState.arena.facing = 'up';
            moving = true;
        }
        if (gameState.arena.keys.has('down')) {
            dy += PLAYER_SPEED * frameScale;
            gameState.arena.facing = 'down';
            moving = true;
        }
        if (gameState.arena.keys.has('left')) {
            dx -= PLAYER_SPEED * frameScale;
            gameState.arena.facing = 'left';
            moving = true;
        }
        if (gameState.arena.keys.has('right')) {
            dx += PLAYER_SPEED * frameScale;
            gameState.arena.facing = 'right';
            moving = true;
        }

        const nextX = gameState.arena.playerX + dx;
        const nextY = gameState.arena.playerY + dy;

        if (!isBlocked(level, nextX, gameState.arena.playerY)) gameState.arena.playerX = nextX;
        if (!isBlocked(level, gameState.arena.playerX, nextY)) gameState.arena.playerY = nextY;

        if (moving) {
            if (tickNow - gameState.arena.lastFrameAt > PLAYER_ANIM_MS) {
                gameState.arena.frame = (gameState.arena.frame + 1) % 3;
                gameState.arena.lastFrameAt = tickNow;
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
        updateCompanionMovement(frameScale);
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
    gameState.arena.lastTickAt = 0;
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
            ${question.options.map((option) => `<button type="button" class="option-btn" onclick="selectOption(this, '${option.replace(/'/g, "\\'")}')">${option}</button>`).join('')}
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

        const movementDirection = getMovementDirectionFromEvent(event);
        if (!typingInInput && !isArenaModalActuallyVisible() && movementDirection) {
            gameState.arena.keys.add(movementDirection);
        }
    });

    window.addEventListener('keyup', (event) => {
        const movementDirection = getMovementDirectionFromEvent(event);
        if (movementDirection) {
            gameState.arena.keys.delete(movementDirection);
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
