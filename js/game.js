const ALL_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'cyan', 'gray'];
const COLOR_NAMES = {
    red: '红色',
    blue: '蓝色',
    green: '绿色',
    yellow: '黄色',
    purple: '紫色',
    orange: '橙色',
    pink: '粉色',
    brown: '棕色',
    cyan: '青色',
    gray: '灰色',
};
let COLORS = ALL_COLORS.slice(0, 7);
const ROWS = 30;
const COLS = 20;
const MAX_ACTIVATED_CELLS = 200;
const AUTO_PLAY_INTERVAL = 250; // 自动点击间隔
let TOTAL_BOXES = 50;
let TOTAL_SCREWS = TOTAL_BOXES * 3;
const MAX_VISIBLE_PLATES = 4; // 同时最多显示的板块数量
const MAX_CHAIN_LENGTH = 5; // 1对1连线最大节点数(5=4条线)
const MAX_LOCK_GROUPS = 4; // 同时最多锁定组数
const MAX_CONTROLLERS_PER_LOCK = 3; // 单个锁最多控制螺丝数量
let MAX_TEMP_SLOTS = 5;
// 记录最近一次拔出螺丝的格子
let lastRemovedCell = null;

let COLOR_TOTALS = {};
let COLOR_BOX_TOTALS = {};
let colorPool = {};
let boxPool = {};

function initPools() {
    COLOR_TOTALS = Array(TOTAL_SCREWS)
        .fill(0)
        .map((_, i) => i)
        .reduce((acc, i) => {
            if (i % 3 === 0) {
                const color = COLORS[Math.floor(Math.random() * COLORS.length)];
                acc[color] = acc[color] ? acc[color] + 3 : 3;
            }
            return acc;
        }, {});
    COLOR_BOX_TOTALS = Object.fromEntries(Object.entries(COLOR_TOTALS).map(([c, n]) => [c, n / 3]));
    colorPool = {
        ...COLOR_TOTALS,
    };
    boxPool = {
        ...COLOR_BOX_TOTALS,
    };
}

let boardData = [];
let boardState = [];

const board = document.getElementById('game-board');
let lineLayer = document.getElementById('line-layer');
const tempSlotsContainer = document.getElementById('temp-slots');
let tempSlots = null;
let tempSlotsState = [];
let lockConnections = [];
const screwMap = {};
let nextScrewId = 0;
let boxes = document.querySelectorAll('.box');
const initialBoxStates = Array.from(boxes).map((b) => b.dataset.enabled === 'true');
const message = document.getElementById('message');
const totalCountEl = document.getElementById('total-count');
const eliminatedCountEl = document.getElementById('eliminated-count');
const remainingCountEl = document.getElementById('remaining-count');
const onboardCountEl = document.getElementById('onboard-count');
const queueCountEl = document.getElementById('queue-count');
const colorCountEl = document.getElementById('color-count');
const colorStats = document.getElementById('color-stats');
const addTempSlotBtn = document.getElementById('add-temp-slot');

const cellMap = [];
let activeCells = [];
let usedBoxColors = new Set();
let plates = [];
let nextPlateIndex = 0; // 下一个需要显示的板块索引
let activePlates = [];
let isClickDot = false;
// 控制板块与螺丝的层级，每层之间相差 10，方便调试
let nextPlateZ = 1000; // 记录下一个板块的 zIndex，从大到小生成，确保新板块在下层

function createGrid() {
    for (let row = 0; row < ROWS; row++) {
        cellMap[row] = [];
        for (let col = 0; col < COLS; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            board.appendChild(cell);
            cellMap[row][col] = cell;
        }
    }
}

function activateCells() {
    const allCells = [];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            allCells.push(cellMap[row][col]);
        }
    }

    activeCells = [];
    const used = new Set();
    while (activeCells.length < MAX_ACTIVATED_CELLS) {
        const index = Math.floor(Math.random() * allCells.length);
        const cell = allCells[index];
        const key = `${cell.dataset.row}-${cell.dataset.col}`;
        if (!used.has(key)) {
            used.add(key);
            cell.style.backgroundColor = '#fff8dc';
            activeCells.push(cell);
        }
    }
}

// 随机生成所有板块及其螺丝位置，每块板上随机 1-9 颗螺丝
function generateBoardData() {
    boardData = [];
    let remaining = TOTAL_SCREWS;
    let id = 0;
    const tempPool = {
        ...COLOR_TOTALS,
    };
    while (remaining > 0) {
        const screwCount = Math.min(remaining, Math.floor(Math.random() * 9) + 1);
        const width = Math.floor(Math.random() * 6) + 3;
        const height = Math.floor(Math.random() * 6) + 3;
        const row = Math.floor(Math.random() * (ROWS - height));
        const col = Math.floor(Math.random() * (COLS - width));
        const cells = [];
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                cells.push({
                    row: r,
                    col: c,
                });
            }
        }
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
        }
        const plateCells = cells.slice(0, screwCount);
        const screws = [];
        for (const pos of plateCells) {
            const colorsCanUse = COLORS.filter((c) => tempPool[c] > 0);
            const color = colorsCanUse[Math.floor(Math.random() * colorsCanUse.length)];
            screws.push({
                row: pos.row,
                col: pos.col,
                color,
                group: id,
                stage: 0,
                id: nextScrewId++,
            });
            tempPool[color]--;
            remaining--;
        }
        boardData.push({
            id: id++,
            row,
            col,
            width,
            height,
            screws,
        });
    }
}

function initBoardState() {
    nextPlateZ = 1000;
    plates = boardData.map((p) => {
        const plate = {
            id: p.id,
            row: p.row,
            col: p.col,
            width: p.width,
            height: p.height,
            color: `rgba(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},0.6)`,
            screws: p.screws.map((s) => ({
                id: s.id,
                row: s.row,
                col: s.col,
                color: s.color,
                group: s.group,
                stage: s.stage,
                cell: null,
                dot: null,
                locked: false,
                controller: null,
                control: null,
                controllers: [],
                overlay: null,
                plateId: p.id,
            })),
            zIndex: nextPlateZ,
        };
        nextPlateZ -= 10;
        return plate;
    });
    boardState = plates;
    for (const k in screwMap) delete screwMap[k];
    for (const p of plates) {
        for (const s of p.screws) {
            screwMap[s.id] = s;
        }
    }
    nextPlateIndex = 0;
    failedPlates = [];
}

function initTempSlots() {
    tempSlotsState = Array(MAX_TEMP_SLOTS).fill(null);
    renderTempSlots();
}

function renderTempSlots() {
    tempSlotsContainer.innerHTML = '';
    for (let i = 0; i < MAX_TEMP_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'temp-slot';
        if (tempSlotsState[i]) {
            slot.appendChild(tempSlotsState[i]);
            tempSlotsState[i].style.position = 'absolute';
        }
        tempSlotsContainer.appendChild(slot);
    }
    tempSlots = document.querySelectorAll('.temp-slot');
}

function getBoardInfo() {
    return {
        layers: JSON.parse(JSON.stringify(boardData)),
        state: JSON.parse(JSON.stringify(boardState)),
    };
}

function setDifficulty(opts) {
    if (opts.tempSlots !== undefined) {
        MAX_TEMP_SLOTS = opts.tempSlots;
        initTempSlots();
    }
    if (opts.colorPool) {
        for (const c in opts.colorPool) {
            if (colorPool[c] !== undefined) {
                colorPool[c] = opts.colorPool[c];
            }
        }
    }
    if (opts.boxPool) {
        for (const c in opts.boxPool) {
            if (boxPool[c] !== undefined) {
                boxPool[c] = opts.boxPool[c];
            }
        }
    }
    updateInfo();
}

function spawnDot(screw, cell) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.backgroundColor = screw.color;
    dot.dataset.color = screw.color;
    dot.dataset.sid = screw.id;
    dot.dataset.blocked = 'false';
    dot.addEventListener('click', () => handleDotClick(dot));
    cell.appendChild(dot);
    colorPool[screw.color]--;
    return dot;
}

function removeDot(dot) {
    const color = dot.dataset.color;
    const cell = dot.parentElement;
    const screw = screwMap[dot.dataset.sid];
    if (screw) screw.dot = null;
    lockConnections.slice().forEach((conn) => {
        cleanupOrphanLocks();
        if (conn.controller.id === screw.id || conn.locked.id === screw.id) removeConnection(conn);
    });
    const idx = tempSlotsState.findIndex((d) => d === dot);
    if (idx !== -1) {
        tempSlotsState[idx] = null;
        renderTempSlots();
    }
    dot.remove();
    if (cell) checkPlateRemoval(cell);
}

// 在场景中生成一个板块及其螺丝
function spawnPlate(plate) {
    const overlay = document.createElement('div');
    overlay.className = 'plate';
    overlay.style.backgroundColor = plate.color;
    overlay.style.left = plate.col * 32 + 'px';
    overlay.style.top = plate.row * 32 + 'px';
    overlay.style.width = plate.width * 32 - 2 + 'px';
    overlay.style.height = plate.height * 32 - 2 + 'px';
    overlay.style.zIndex = plate.zIndex;
    board.appendChild(overlay);
    const used = new Set();
    let placed = 0;
    for (const screw of plate.screws) {
        let cell = cellMap[screw.row][screw.col];
        if (cell.querySelector('.dot')) {
            const candidates = [];
            for (let r = plate.row; r < plate.row + plate.height; r++) {
                for (let c = plate.col; c < plate.col + plate.width; c++) {
                    const candidate = cellMap[r][c];
                    const key = `${r}-${c}`;
                    if (!candidate.querySelector('.dot') && !used.has(key)) {
                        candidates.push(candidate);
                    }
                }
            }
            if (candidates.length === 0) continue;
            cell = candidates[Math.floor(Math.random() * candidates.length)];
        }
        used.add(`${cell.dataset.row}-${cell.dataset.col}`);
        screw.cell = cell;
        cell.dataset.plateId = plate.id;
        const dot = spawnDot(screw, cell);
        dot.style.zIndex = plate.zIndex + 1;
        screw.dot = dot;
        placed++;
    }
    if (placed === 0) {
        overlay.remove();
        return false;
    }
    plate.overlay = overlay;
    activePlates.push(plate);
    updateDotBlockStates();
    updateInfo();
    return true;
}

function removePlate(plate) {
    plate.overlay && plate.overlay.remove();
    for (const screw of plate.screws) {
        if (screw.dot) screw.dot.remove();
        lockConnections.slice().forEach((conn) => {
            if (conn.controller === screw || conn.locked === screw) removeConnection(conn);
        });
        if (screw.cell) {
            // checkPlateRemoval(screw.cell);
            screw.cell.dataset.plateId = '';
        }
    }
    activePlates = activePlates.filter((p) => p !== plate);
    cleanupOrphanLocks();
    updateDotBlockStates();
    updateInfo();
}

// 根据当前板块层级，控制螺丝的可点击状态
function updateDotBlockStates() {
    const topMap = {};
    // 计算每个格子上方覆盖的最高板块
    const sorted = [...activePlates].sort((a, b) => a.zIndex - b.zIndex);
    for (const plate of sorted) {
        for (let r = plate.row; r < plate.row + plate.height; r++) {
            for (let c = plate.col; c < plate.col + plate.width; c++) {
                const key = `${r}-${c}`;
                topMap[key] = plate;
            }
        }
    }

    // 设置螺丝是否可点击
    for (const plate of activePlates) {
        for (const screw of plate.screws) {
            if (!screw.dot || !screw.cell) continue;
            const key = `${screw.cell.dataset.row}-${screw.cell.dataset.col}`;
            const top = topMap[key];
            const blocked = !(top && top.id === plate.id) || screw.locked;
            screw.dot.dataset.blocked = blocked ? 'true' : 'false';
            screw.dot.classList.toggle('blocked', blocked);
        }
    }
}

function cleanupOrphanLocks() {
    // Remove connections that reference missing screws or dots
    lockConnections = lockConnections.filter((conn) => {
        const valid = conn.controller && conn.locked && conn.controller.dot && conn.locked.dot;
        if (!valid) {
            conn.line && conn.line.remove();
            if (conn.locked.overlay) {
                conn.locked.overlay.remove();
                conn.locked.overlay = null;
            }
            if (conn.locked.dot) {
                conn.locked.dot.dataset.blocked = 'false';
                conn.locked.dot.classList.remove('blocked');
            }
            conn.locked.locked = false;
            conn.locked.controller = null;
            conn.locked.controllers = conn.locked.controllers.filter((c) => c !== conn.controller);
            conn.controller.control = null;
            if (conn.locked.cell) checkPlateRemoval(conn.locked.cell);
            if (conn.controller.cell) checkPlateRemoval(conn.controller.cell);
        }
        return valid;
    });

    // Break pairs of screws locked to each other
    const mutual = new Set();
    for (const conn of lockConnections) {
        const partner = lockConnections.find((c) => c.controller === conn.locked && c.locked === conn.controller);
        if (partner) {
            mutual.add(conn);
            mutual.add(partner);
        }
    }
    for (const conn of mutual) {
        conn.line && conn.line.remove();
        if (conn.locked.overlay) {
            conn.locked.overlay.remove();
            conn.locked.overlay = null;
        }
        if (conn.locked.dot) {
            conn.locked.dot.dataset.blocked = 'false';
            conn.locked.dot.classList.remove('blocked');
        }
        conn.locked.controllers = conn.locked.controllers.filter((c) => c !== conn.controller);
        if (conn.locked.controllers.length === 0) {
            conn.locked.locked = false;
            conn.locked.controller = null;
            if (conn.locked.dot) {
                conn.locked.dot.dataset.blocked = 'false';
                conn.locked.dot.classList.remove('blocked');
            }
            if (conn.locked.overlay) {
                conn.locked.overlay.remove();
                conn.locked.overlay = null;
            }
        } else if (conn.locked.controller === conn.controller) {
            conn.locked.controller = conn.locked.controllers[0];
        }
        conn.controller.control = null;
        if (conn.locked.cell) checkPlateRemoval(conn.locked.cell);
        if (conn.controller.cell) checkPlateRemoval(conn.controller.cell);
    }
    if (mutual.size > 0) {
        lockConnections = lockConnections.filter((c) => !mutual.has(c));
    }

    const connectedControllers = new Set();
    const connectedLocked = new Set();
    lockConnections.forEach((conn) => {
        connectedControllers.add(conn.controller.id);
        connectedLocked.add(conn.locked.id);
    });

    for (const id in screwMap) {
        const s = screwMap[id];
        if (s.locked && !connectedLocked.has(s.id) && !connectedControllers.has(s.id)) {
            s.locked = false;
            s.controller = null;
            s.controllers = [];
            if (s.overlay) {
                s.overlay.remove();
                s.overlay = null;
            }
            if (s.dot) {
                s.dot.dataset.blocked = 'false';
                s.dot.classList.remove('blocked');
            }
        }
        if (s.control && !connectedControllers.has(s.id)) {
            s.control = null;
        }
    }
    updateDotBlockStates();
}

function getDotCenter(dot) {
    const br = board.getBoundingClientRect();
    const dr = dot.getBoundingClientRect();
    return {
        x: dr.left - br.left + dr.width / 2,
        y: dr.top - br.top + dr.height / 2,
    };
}

function drawLine(fromDot, toDot) {
    const p1 = getDotCenter(fromDot);
    const p2 = getDotCenter(toDot);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.classList.add('line');
    lineLayer.appendChild(line);
    return line;
}

function removeConnection(conn) {
    conn.line && conn.line.remove();
    conn.locked.controllers = conn.locked.controllers.filter((c) => c !== conn.controller);
    if (conn.locked.controllers.length === 0) {
        if (conn.locked.overlay) {
            conn.locked.overlay.remove();
            conn.locked.overlay = null;
        }
        if (conn.locked.dot) {
            conn.locked.dot.dataset.blocked = 'false';
            conn.locked.dot.classList.remove('blocked');
        }
        conn.locked.locked = false;
        conn.locked.controller = null;
    } else {
        if (conn.locked.controller === conn.controller) {
            conn.locked.controller = conn.locked.controllers[0];
        }
    }
    conn.controller.control = null;
    lockConnections = lockConnections.filter((c) => c !== conn);
    cleanupOrphanLocks();
    if (conn.locked.cell) checkPlateRemoval(conn.locked.cell);
    if (conn.controller.cell) checkPlateRemoval(conn.controller.cell);
}

function applyLock(controller, locked) {
    if (!locked.controllers.includes(controller)) locked.controllers.push(controller);
    controller.control = locked;
    if (!locked.controller) locked.controller = controller;
    locked.locked = true;
    if (locked.dot) {
        locked.dot.dataset.blocked = 'true';
        locked.dot.classList.add('blocked');
        if (!locked.overlay) {
            const ov = document.createElement('div');
            ov.className = 'lock-overlay';
            ov.textContent = '🔒';
            locked.dot.appendChild(ov);
            locked.overlay = ov;
        }
    }
    if (controller.dot && locked.dot) {
        const line = drawLine(controller.dot, locked.dot);
        lockConnections.push({
            controller,
            locked,
            line,
        });
    }
    cleanupOrphanLocks();
    return true;
}

function canControl(controller, target) {
    if (controller.plateId !== target.plateId) return false;
    if (controller.control) return false;
    let c = controller;
    let depth = 1;
    while (c) {
        if (c === target) return false;
        c = c.controller;
        depth++;
        if (depth > MAX_CHAIN_LENGTH) return false;
    }
    return true;
}

function getLockDepth(screw) {
    let depth = 1;
    let cur = screw.controller;
    while (cur) {
        depth++;
        cur = cur.controller;
    }
    return depth;
}

function maxColorLockDepth(color) {
    let max = 0;
    for (const id in screwMap) {
        const s = screwMap[id];
        if (s.locked && s.color === color) {
            max = Math.max(max, getLockDepth(s));
        }
    }
    return max;
}

function setupLocks(newScrews) {
    const free = tempSlotsState.filter((d) => d === null).length;
    const baseProb = Math.min(0.8, 0.2 + free * 0.1);
    const platesToCheck = newScrews ? [...new Set(newScrews.map((s) => activePlates.find((p) => p.id === s.plateId)))] : activePlates;
    let currentGroups = new Set(lockConnections.map((c) => c.locked.id));
    for (const plate of platesToCheck) {
        const all = plate.screws;
        const candidates = (newScrews ? newScrews : all).filter((s) => all.includes(s) && s.controllers.length === 0);
        for (const locked of candidates) {
            if (!locked.controllers.length && currentGroups.size >= getLockGroupLimit()) break;
            const requiredDepth = maxColorLockDepth(locked.color);
            if (requiredDepth === 0 && Math.random() > baseProb) continue;
            let controllers = all.filter((c) => c !== locked && canControl(c, locked));
            if (controllers.length === 0) continue;
            controllers.sort((a, b) => {
                const da = Math.abs(a.row - locked.row) + Math.abs(a.col - locked.col);
                const db = Math.abs(b.row - locked.row) + Math.abs(b.col - locked.col);
                return da - db;
            });
            controllers = controllers.filter((c) => getLockDepth(c) >= Math.max(1, requiredDepth - 1));
            if (controllers.length === 0) continue;
            const limit = Math.min(getLockControllerLimit(), controllers.length);
            const count = limit > 1 ? 1 + Math.floor(Math.random() * limit) : 1;
            for (let i = 0; i < count; i++) {
                applyLock(controllers[i], locked);
            }
            currentGroups.add(locked.id);
            if (currentGroups.size >= getLockGroupLimit()) break;
        }
        if (currentGroups.size >= getLockGroupLimit()) break;
    }
}

let failedPlates = [];

function spawnNextPlate() {
    if (activePlates.length >= MAX_VISIBLE_PLATES) return;

    let attempts = 0;
    while (failedPlates.length > 0 && activePlates.length < MAX_VISIBLE_PLATES && attempts < failedPlates.length) {
        const plate = failedPlates.shift();
        if (spawnPlate(plate)) {
            setupLocks(plate.screws);
        } else {
            failedPlates.push(plate);
        }
        attempts++;
    }

    while (nextPlateIndex < plates.length && activePlates.length < MAX_VISIBLE_PLATES) {
        const next = plates[nextPlateIndex++];
        if (spawnPlate(next)) {
            setupLocks(next.screws);
        } else {
            failedPlates.push(next);
        }
        if (activePlates.length >= MAX_VISIBLE_PLATES) break;
    }
}

function checkPlateRemoval(cell) {
    activePlates.forEach((plate) => {
        const dots = plate.screws.filter((s) => s.cell && s.cell.querySelector('.dot') && s.dot);
        if (dots.length === 0) {
            removePlate(plate);
            spawnNextPlate();
        } else {
            const locked = plate.screws.filter((s) => s.locked);
            if (dots.length === locked.length) {
                const s = locked[0];
                s.locked = false;
                s.controller = null;
                s.controllers = [];
                if (s.overlay) {
                    s.overlay.remove();
                    s.overlay = null;
                }
                if (s.dot) {
                    s.dot.dataset.blocked = 'false';
                    s.dot.classList.remove('blocked');
                }
            }
        }
    });
}

function setupBox(box, isHint = false) {
    const tempCounts = Object.fromEntries(COLORS.map((c) => [c, 0]));
    if (isHint) {
        tempSlotsState.forEach((d) => {
            if (d) tempCounts[d.dataset.color]++;
        });
    }
    const boardCounts = countBoardColors();

    let candidateColors = COLORS.filter((c) => boxPool[c] > 0 && tempCounts[c] > 0);
    let weights = {};
    if (candidateColors.length > 0) {
        let available = candidateColors.filter((c) => !usedBoxColors.has(c));
        if (available.length === 0) available = candidateColors;
        candidateColors = available;
        weights = Object.fromEntries(candidateColors.map((c) => [c, Math.pow(tempCounts[c], 2)]));
    } else {
        candidateColors = COLORS.filter((c) => boxPool[c] > 0 && boardCounts[c] > 0);
        let available = candidateColors.filter((c) => !usedBoxColors.has(c));
        if (available.length === 0) available = candidateColors;
        candidateColors = available;
        weights = Object.fromEntries(candidateColors.map((c) => [c, Math.pow(boardCounts[c] + 1, 2)]));
    }

    if (candidateColors.length === 0) {
        box.dataset.enabled = 'false';
        box.classList.remove('enabled');
        box.style.borderColor = '#ccc';
        box.innerHTML = '';
        return;
    }

    const color = weightedRandom(candidateColors, weights);
    boxPool[color]--;

    box.dataset.color = color;
    box.dataset.enabled = 'true';
    box.classList.add('enabled');
    box.style.borderColor = color;
    box.innerHTML = '';
    usedBoxColors.add(color);

    for (let i = 0; i < 3; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        box.appendChild(slot);
    }

    absorbTempDots(color, box);
    updateInfo();
}

function absorbTempDots(color, box) {
    const matchingDots = [];
    tempSlotsState.forEach((d) => {
        if (d && d.dataset.color === color) {
            matchingDots.push(d);
        }
    });

    if (matchingDots.length >= 3) {
        for (let i = 0; i < 3; i++) {
            removeDot(matchingDots[i]);
        }
        setTimeout(() => {
            usedBoxColors.delete(color);
            setupBox(box);
            showMessage('🎉 自动三消！');
            setTimeout(() => showMessage(''), 1500);
            updateInfo();
            checkVictory();
        }, 300);
    } else {
        for (let dot of matchingDots) {
            const emptySlot = [...box.children].find((s) => s.className === 'slot' && !s.dataset.filled);
            if (emptySlot) {
                const newDot = document.createElement('div');
                newDot.className = 'slot';
                cleanupOrphanLocks();
                newDot.style.backgroundColor = color;
                newDot.dataset.color = color;
                newDot.dataset.filled = 'true';
                emptySlot.replaceWith(newDot);
                removeDot(dot);
            }
        }
        updateInfo();
        checkVictory();
    }
}

function totalRemainingPool() {
    return COLORS.reduce((s, c) => s + colorPool[c], 0);
}

function countBoardColors() {
    const counts = Object.fromEntries(COLORS.map((c) => [c, 0]));
    for (const plate of activePlates) {
        for (const screw of plate.screws) {
            if (screw.dot) counts[screw.color]++;
        }
    }
    return counts;
}

function countSceneColors() {
    const counts = countBoardColors();
    tempSlotsState.forEach((d) => {
        if (d) counts[d.dataset.color]++;
    });
    boxes.forEach((box) => {
        [...box.children].forEach((slot) => {
            if (slot.dataset.filled && slot.dataset.color) {
                counts[slot.dataset.color]++;
            }
        });
    });
    return counts;
}

function weightedRandom(colors, weights) {
    const total = colors.reduce((s, c) => s + weights[c], 0);
    let r = Math.random() * total;
    for (const c of colors) {
        r -= weights[c];
        if (r <= 0) return c;
    }
    return colors[colors.length - 1];
}

function checkClickDot() {
    isClickDot = true;
    setTimeout(() => {
        isClickDot = false;
    }, 1000);
}

function handleDotClick(dot) {
    if (dot.dataset.blocked === 'true') return;
    const color = dot.dataset.color;
    for (const box of boxes) {
        if (box.dataset.enabled !== 'true') continue;
        if (box.dataset.color !== color) continue;
        const emptySlot = [...box.children].find((el) => el.className === 'slot' && !el.dataset.filled);
        if (emptySlot) {
            const fromCell = dot.parentElement;
            const screw = screwMap[dot.dataset.sid];
            if (screw) screw.dot = null;
            lockConnections.slice().forEach((conn) => {
                if (conn.controller === screw || conn.locked === screw) removeConnection(conn);
            });
            const newDot = document.createElement('div');
            newDot.className = 'slot';
            newDot.style.backgroundColor = color;
            newDot.dataset.color = color;
            newDot.dataset.filled = 'true';
            emptySlot.replaceWith(newDot);
            dot.remove();
            checkPlateRemoval(fromCell);
            // 记录本次拔出的格子，供生成算法使用
            lastRemovedCell = fromCell;
            updateInfo();
            checkVictory();

            const filled = [...box.children].filter((s) => s.dataset.color === color).length;
            if (filled === 3) {
                setTimeout(() => {
                    usedBoxColors.delete(box.dataset.color);
                    setupBox(box);
                    showMessage('🎉 三消成功！');
                    setTimeout(() => showMessage(''), 1500);
                    updateInfo();
                    checkVictory();
                }, 10);
            }
            return;
        }
    }

    const emptyIndex = tempSlotsState.findIndex((s) => s === null);
    if (emptyIndex !== -1) {
        const fromCell = dot.parentElement;
        const screw = screwMap[dot.dataset.sid];
        if (screw) screw.dot = null;
        lockConnections.slice().forEach((conn) => {
            if (conn.controller === screw || conn.locked === screw) removeConnection(conn);
        });
        tempSlotsState[emptyIndex] = dot;
        renderTempSlots();
        dot.style.position = 'absolute';
        // 记录本次拔出的格子，供生成算法使用
        lastRemovedCell = fromCell;
        checkPlateRemoval(fromCell);
        updateInfo();
        checkVictory();
        // checkClickDot();
        checkTempSlotLimit();
        return;
    }

    showMessage('💥 游戏失败！临时槽已满！');
    disableGame();
}

function resetBoxes() {
    boxes.forEach((box, i) => {
        const enabled = initialBoxStates[i];
        const newBox = document.createElement('div');
        newBox.className = 'box';
        newBox.dataset.enabled = enabled ? 'true' : 'false';
        box.replaceWith(newBox);
    });
    boxes = document.querySelectorAll('.box');
}

function initBoxes() {
    usedBoxColors.clear();
    boxes.forEach((box, i) => {
        box.innerHTML = '';
        if (box.dataset.enabled === 'true') {
            setupBox(box);
        } else {
            const hint = document.createElement('div');
            hint.className = 'hint';
            hint.textContent = '点击开启';
            box.appendChild(hint);
            box.style.borderColor = '#ccc';
            box.addEventListener('click', () => {
                setupBox(box, true);
                box.querySelector('.hint') && box.querySelector('.hint').remove();
            });
        }
    });
}

function checkTempSlotLimit() {
    if (isClickDot) return;
    setTimeout(() => {
        const tempDots = tempSlotsState.filter((d) => d).length;
        if (tempDots >= MAX_TEMP_SLOTS) {
            showMessage('💥 游戏失败！临时槽已满！');
            console.log('tempDots:', tempDots, 'MAX_TEMP_SLOTS:', MAX_TEMP_SLOTS);
            console.log('======================================');
            disableGame();
        }
    }, 1000);
}

function showMessage(msg) {
    message.textContent = msg;
}

function updateInfo() {
    totalCountEl.textContent = TOTAL_SCREWS;
    const queue = totalRemainingPool();
    const boardCounts = countBoardColors();
    const onBoard = Object.values(boardCounts).reduce((a, b) => a + b, 0);
    const boxDots = [...boxes].reduce((s, b) => s + [...b.children].filter((el) => el.dataset.filled).length, 0);
    const tempDots = tempSlotsState.filter((d) => d).length;
    const remaining = queue + boxDots + tempDots + onBoard;
    const eliminated = TOTAL_SCREWS - remaining;
    remainingCountEl.textContent = remaining;
    eliminatedCountEl.textContent = eliminated;
    onboardCountEl.textContent = onBoard;
    queueCountEl.textContent = queue;
    const dots = document.querySelectorAll('#game-board .dot');
    const colors = new Set();
    dots.forEach((d) => colors.add(d.dataset.color));
    colorCountEl.textContent = colors.size;
    colorStats.innerHTML = COLORS.map((c) => {
        const screws = colorPool[c] + boardCounts[c];
        const boxesCreated = COLOR_BOX_TOTALS[c] - boxPool[c];
        return `<div style="color:${c}">${COLOR_NAMES[c]}螺丝:<span>${screws}</span>/${COLOR_TOTALS[c]} 盒子:<span>${boxesCreated}</span>/${COLOR_BOX_TOTALS[c]}</div>`;
    }).join('');
}

function getLockGroupLimit() {
    const eliminated = parseInt(eliminatedCountEl.textContent || '0');
    const progress = eliminated / TOTAL_SCREWS;
    if (progress < 0.33) return 2;
    if (progress < 0.66) return 3;
    return MAX_LOCK_GROUPS;
}

function getLockControllerLimit() {
    const eliminated = parseInt(eliminatedCountEl.textContent || '0');
    const progress = eliminated / TOTAL_SCREWS;
    if (progress < 0.33) return 1;
    if (progress < 0.66) return 2;
    return MAX_CONTROLLERS_PER_LOCK;
}

function disableGame() {
    document.querySelectorAll('.dot').forEach((d) => (d.style.pointerEvents = 'none'));
    boxes.forEach((b) => (b.style.pointerEvents = 'none'));
    stopAutoPlay();
}

function checkVictory() {
    const boardDots = document.querySelectorAll('#game-board .dot').length;
    const boxDots = [...boxes].reduce((s, b) => s + [...b.children].filter((el) => el.dataset.filled).length, 0);
    const tempDots = tempSlotsState.filter((d) => d).length;
    if (boardDots === 0 && boxDots === 0 && tempDots === 0 && totalRemainingPool() === 0) {
        showMessage('🏆 游戏胜利！');
        disableGame();
    }
}

let autoPlayTimer = null;

function getChain(screw) {
    const chain = [];
    let cur = screw.controller;
    while (cur) {
        chain.unshift(cur);
        cur = cur.controller;
    }
    return chain;
}

function tryClickDot(dot, reason) {
    const screw = screwMap[dot.dataset.sid];
    const chain = getChain(screw);
    const free = tempSlotsState.filter((d) => d === null).length;
    if (free < chain.length) {
        return false;
    }
    for (const s of chain) {
        if (!s.dot || s.dot.dataset.blocked === 'true') return false;
    }
    if (chain.length > 0) {
    }
    for (const s of chain) {
        handleDotClick(s.dot);
    }
    handleDotClick(dot);
    return true;
}

function autoPlayStep() {
    if (message.textContent.includes('胜利') || message.textContent.includes('失败')) {
        stopAutoPlay();
        return;
    }

    for (const box of boxes) {
        if (box.dataset.enabled !== 'true') continue;
        const color = box.dataset.color;
        const dots = [...document.querySelectorAll('#game-board .dot')].filter((d) => d.dataset.color === color);
        for (const dot of dots) {
            if (dot.dataset.blocked !== 'true') {
                console.log('当前有匹配盒子颜色，自动点击:', dot.dataset.sid, 'color:', color);
                if (tryClickDot(dot, 'box ' + color)) return;
            }
        }
    }

    let bestPlate = null;
    let bestDots = null;
    let bestCount = Infinity;
    const freeSlots = tempSlotsState.filter((d) => d === null).length;
    for (const plate of activePlates) {
        const dots = plate.screws.map((s) => s.dot).filter(Boolean);
        if (dots.length === 0) continue;
        if (dots.length < freeSlots && dots.length < bestCount) {
            bestPlate = plate;
            bestDots = dots;
            bestCount = dots.length;
        }
    }
    if (bestPlate) {
        for (const dot of bestDots) {
            if (dot.dataset.blocked !== 'true') {
                console.log('没有匹配颜色螺丝，尝试解锁板块螺丝:', dot);
                if (tryClickDot(dot, 'min plate ' + bestCount)) return;
            }
        }
    }

    console.log('自动点击失败');
}

function startAutoPlay() {
    if (autoPlayTimer) return;
    autoPlayTimer = setInterval(autoPlayStep, AUTO_PLAY_INTERVAL);
    autoBtn.textContent = '停止自动';
}

function stopAutoPlay() {
    if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
    }
    autoBtn.textContent = '自动玩';
}

function startGame() {
    stopAutoPlay();
    TOTAL_BOXES = parseInt(document.getElementById('box-count').value) || 50;
    const colorCnt = parseInt(document.getElementById('color-count-input').value) || 7;
    MAX_TEMP_SLOTS = parseInt(document.getElementById('temp-count').value) || 5;
    COLORS = ALL_COLORS.slice(0, Math.min(colorCnt, ALL_COLORS.length));
    TOTAL_SCREWS = TOTAL_BOXES * 3;

    board.innerHTML = '<svg id="line-layer"></svg>';
    lineLayer = document.getElementById('line-layer');
    cellMap.length = 0;
    activeCells = [];
    plates = [];
    activePlates = [];
    lockConnections = [];
    usedBoxColors.clear();
    tempSlotsState = [];
    nextPlateIndex = 0;
    nextScrewId = 0;
    for (const k in screwMap) delete screwMap[k];

    createGrid();
    activateCells();
    initTempSlots();
    initPools();
    generateBoardData();
    initBoardState();
    for (let i = 0; i < MAX_VISIBLE_PLATES; i++) {
        spawnNextPlate();
    }
    resetBoxes();
    initBoxes();
    setupLocks();
    updateInfo();
    showMessage('');
}

const autoBtn = document.getElementById('auto-btn');

document.getElementById('start-btn').addEventListener('click', () => {
    stopAutoPlay();
    startGame();
});
document.getElementById('reset-btn').addEventListener('click', () => {
    stopAutoPlay();
    startGame();
});
autoBtn.addEventListener('click', () => {
    if (autoPlayTimer) {
        stopAutoPlay();
    } else {
        startAutoPlay();
    }
});
addTempSlotBtn.addEventListener('click', () => {
    MAX_TEMP_SLOTS++;
    tempSlotsState.push(null);
    renderTempSlots();
    updateInfo();
});
startGame();
