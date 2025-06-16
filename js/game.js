// =================================================================
// 游戏核心配置 (Game Core Configuration)
// 策划可以在此调整游戏的核心数值和行为
// =================================================================
const gameConfig = {
    // --- 棋盘与布局 (Board & Layout) ---
    ROWS: 30, // 棋盘行数
    COLS: 20, // 棋盘列数
    MIN_ONBOARD_SCREWS: 15, // 场上螺丝数量下限，低于此值会尝试生成新板块

    // --- 核心玩法 (Core Gameplay) ---
    MAX_TEMP_SLOTS: 5, // 初始临时槽位数量
    MAX_CHAIN_LENGTH: 5, // 锁链的最大长度 (例如 5 表示 A->B->C->D->E)
    MAX_CONTROLLERS_PER_LOCK: 4, // 单个锁最多能控制的螺丝数量
    MAX_LOCK_GROUPS: 8, // 同一时间场上最多存在的锁定组数量
    MAX_INTER_COMPONENT_LOCK_DISTANCE: 12, // 跨板块锁定的最大距离(曼哈顿距离)
    CHAIN_LOCK_PROBABILITY: 0.4, // 在生成锁时，创建"链式锁" (A->B->C) 的概率，剩下的是"并联锁" (A->C, B->C)

    // --- 初始生成 (Initial Spawning) ---
    // 定义游戏开始时，默认生成的各类板块数量
    INITIAL_SPAWN_COUNTS: {
        LARGE: 1, // 初始生成的大型板块数量
        MEDIUM: 2, // 初始生成的中型板块数量 (会尝试生成这么多, 但不超过关卡计划的总数)
        SMALL: 4, // 初始生成的的小型板块数量
    },

    // --- 动态难度 (Dynamic Difficulty) ---
    // 根据游戏进度(progress)划分的难度阶梯
    DIFFICULTY_STAGES: {
        STAGE_0_PROGRESS: 0.1, // 阶段0: 新手期进度上限
        STAGE_1_PROGRESS: 0.2, // 阶段1: 普通期进度上限
        STAGE_2_PROGRESS: 0.4, // 阶段2: 紧张期进度上限
        STAGE_3_PROGRESS: 0.6, // 阶段3: 危险期进度上限

        // 每个阶段对应的具体难度修正值
        MODIFIERS: [
            // 阶段0 (新手): 极低的锁概率
            { lockProbFactor: 0.3, connectionMultiplier: 1.0, extraConnections: 0 },
            // 阶段1 (普通): 正常难度
            { lockProbFactor: 1.0, connectionMultiplier: 1.0, extraConnections: 0 },
            // 阶段2 (紧张): 难度略微提升
            { lockProbFactor: 1.5, connectionMultiplier: 1.2, extraConnections: 0 },
            // 阶段3 (危险): 难度显著提升
            { lockProbFactor: 2.0, connectionMultiplier: 1.5, extraConnections: 1 },
            // 阶段4 (最终): 最高难度，可用于触发提示
            { lockProbFactor: 2.5, connectionMultiplier: 1.5, extraConnections: 2 },
        ],
    },

    // --- "智能"盒子生成AI (Intelligent Box AI) ---
    BOX_AI_CHALLENGE_THRESHOLD: 0.5, // 游戏进度超过此值，盒子AI会从"帮助者"变为"挑战者"

    // --- 板块生成配置 (Component Generation) ---
    // 定义了关卡中总共会生成多少、以及如何生成各种尺寸的板块
    COMPONENT_CONFIG: {
        LARGE: {
            count: 1, // 关卡大型板块总数
            layers: () => 5 + Math.floor(Math.random() * 6), // 层数范围: 5-10
            screwsPerLayer: () => 3 + Math.floor(Math.random() * 6), // 每层螺丝数范围: 3-8
            size: { width: 10, height: 10 },
        },
        MEDIUM: {
            count: () => 4 + Math.floor(Math.random() * 3), // 关卡中型板块总数范围: 4-6
            layers: () => 3 + Math.floor(Math.random() * 3), // 层数范围: 3-5
            screwsPerLayer: () => 2 + Math.floor(Math.random() * 5), // 每层螺丝数范围: 2-6
            size: { width: 6, height: 6 },
        },
        SMALL: {
            count: () => 25 + Math.floor(Math.random() * 6), // 关卡小型板块总数范围: 25+
            layers: () => 1 + Math.floor(Math.random() * 2), // 层数范围: 1-2
            screwsPerLayer: () => 1, // 每层螺丝数范围: 1
            size: { width: 3, height: 3 },
        },
    },
};

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
const ROWS = gameConfig.ROWS;
const COLS = gameConfig.COLS;
const MAX_ACTIVATED_CELLS = 200;
const AUTO_PLAY_INTERVAL = 150; // 自动点击间隔
let TOTAL_BOXES = 50;
let TOTAL_SCREWS = TOTAL_BOXES * 3;
let MAX_VISIBLE_PLATES = 4; // 同时最多显示的板块数量
const MAX_CHAIN_LENGTH = gameConfig.MAX_CHAIN_LENGTH;
let MAX_LOCK_GROUPS = gameConfig.MAX_LOCK_GROUPS;
let MAX_CONTROLLERS_PER_LOCK = gameConfig.MAX_CONTROLLERS_PER_LOCK;
let MAX_TEMP_SLOTS = gameConfig.MAX_TEMP_SLOTS;
// 记录最近一次拔出螺丝的格子
let lastRemovedCell = null;
let selectedDifficulty = 25; // 默认难度

const DIFFICULTY_LEVELS = [];
const NUM_DIFFICULTY_LEVELS = 50;

const COMPONENT_CONFIG = gameConfig.COMPONENT_CONFIG;

// 全局状态
let components = [];
let nextComponentId = 0;

// Global scope for getColorTier so it can be used by generateComponents
const colorTiers = { tier1: [], tier2: [], tier3: [] };
const getColorTier = (color) => {
    if (colorTiers.tier1.includes(color)) return 1;
    if (colorTiers.tier2.includes(color)) return 2;
    if (colorTiers.tier3.includes(color)) return 3;
    return 4; // Should not happen
};

function interpolate(start, end, steps, step) {
    return Math.round(start + (end - start) * (step / (steps - 1)));
}

for (let i = 0; i < NUM_DIFFICULTY_LEVELS; i++) {
    const level = i + 1;
    DIFFICULTY_LEVELS.push({
        level: level,
        // --- 核心参数 ---
        colors: interpolate(5, 10, NUM_DIFFICULTY_LEVELS, i),
        boxes: interpolate(40, 60, NUM_DIFFICULTY_LEVELS, i),
        tempSlots: 5, // 临时槽位保持不变
        // --- 锁生成算法参数 ---
        maxLockGroups: interpolate(2, 8, NUM_DIFFICULTY_LEVELS, i), // 场上总锁组数量: 从2个平滑增加到8个
        maxControllers: interpolate(1, 4, NUM_DIFFICULTY_LEVELS, i), // 并联锁数量(广度): 从1个平滑增加到4个
        chainLockProbability: parseFloat((interpolate(30, 80, NUM_DIFFICULTY_LEVELS, i) / 100).toFixed(2)), // 链式锁概率(深度): 从30%平滑增加到80%
    });
}

let COLOR_TOTALS = {};
let COLOR_BOX_TOTALS = {};
let colorPool = {};
let boxColorQueue = [];

/**
 * 初始化颜色池和盒子池
 * 根据总螺丝数量分配各种颜色的螺丝数量
 */
function initPools() {
    COLOR_TOTALS = {};
    COLORS.forEach((c) => (COLOR_TOTALS[c] = 0));

    for (const component of components) {
        for (const plate of component.plates) {
            for (const screw of plate.screws) {
                if (COLOR_TOTALS[screw.color] !== undefined) {
                    COLOR_TOTALS[screw.color]++;
                }
            }
        }
    }

    COLOR_BOX_TOTALS = Object.fromEntries(Object.entries(COLOR_TOTALS).map(([c, n]) => [c, n / 3]));
    colorPool = {
        ...COLOR_TOTALS,
    };
}

function isAreaOverlapping(newArea, occupiedAreas) {
    for (const existing of occupiedAreas) {
        if (
            newArea.col < existing.col + existing.width &&
            newArea.col + newArea.width > existing.col &&
            newArea.row < existing.row + existing.height &&
            newArea.row + newArea.height > existing.row
        ) {
            return true;
        }
    }
    return false;
}

function generateComponents(screwColorPlan) {
    const plan = [...screwColorPlan];
    components = [];
    nextComponentId = 0;

    const createComponentFromPlan = (type, config) => {
        if (plan.length === 0) return null;

        const comp = {
            id: nextComponentId++,
            type: type,
            area: null, // Position is NOT determined here
            plates: [],
            currentPlateIndex: 0,
            isComplete: false,
            isSpawned: false, // NEW STATE
            priority: Infinity, // NEW: For sorting
            domElements: {},
        };

        const layersToCreate = config.layers();
        for (let i = 0; i < layersToCreate; i++) {
            if (plan.length === 0) break;
            const plateId = `${comp.id}-${i}`;
            const numScrews = Math.min(config.screwsPerLayer(), plan.length);
            const screws = [];
            for (let j = 0; j < numScrews; j++) {
                if (plan.length === 0) break;
                const color = plan.shift();
                screws.push({
                    color,
                    group: comp.id,
                    stage: 0,
                    id: nextScrewId++,
                    plateId,
                    componentId: comp.id,
                    cell: null,
                    dot: null,
                    locked: false,
                    controller: null,
                    control: null,
                    controllers: [],
                    overlay: null,
                });
            }
            if (screws.length > 0) {
                comp.plates.push({ id: plateId, screws });
            }
        }

        // Set component priority based on the earliest color tier it contains
        if (comp.plates.length > 0 && comp.plates[0].screws.length > 0) {
            const firstScrewColor = comp.plates[0].screws[0].color;
            comp.priority = getColorTier(firstScrewColor);
        }

        return comp.plates.length > 0 ? comp : null;
    };

    // 1. Create the Large Component
    const largeComp = createComponentFromPlan('LARGE', COMPONENT_CONFIG.LARGE);
    if (largeComp) components.push(largeComp);

    // 2. Create Medium Components
    const medConfig = COMPONENT_CONFIG.MEDIUM;
    const medCount = Math.max(1, medConfig.count() - (1 + Math.floor(Math.random() * 2))); // Create 1 or 2 fewer
    for (let i = 0; i < medCount; i++) {
        if (plan.length === 0) break;
        const medComp = createComponentFromPlan('MEDIUM', medConfig);
        if (medComp) components.push(medComp);
    }

    // 3. Create Small Components with ALL remaining screws. This is the "兜底".
    const smallConfig = COMPONENT_CONFIG.SMALL;
    while (plan.length > 0) {
        const smallComp = createComponentFromPlan('SMALL', smallConfig);
        if (smallComp) {
            components.push(smallComp);
        } else {
            break;
        }
    }

    // Sort components by priority to ensure staged rollout of colors
    components.sort((a, b) => a.priority - b.priority);

    if (plan.length > 0) {
        console.error('CRITICAL: generateComponents failed to consume the entire plan.', { remaining: plan.length });
        throw new Error('未能用完所有计划中的螺丝。');
    }
}

/**
 * 初始化游戏面板状态
 * 将生成的板块数据转换为游戏状态
 */
function initBoardState() {
    for (const k in screwMap) delete screwMap[k];
    for (const component of components) {
        for (const plate of component.plates) {
            for (const s of plate.screws) {
                screwMap[s.id] = s;
            }
        }
    }
}

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
const progressCountEl = document.getElementById('progress-count');
const remainingCountEl = document.getElementById('remaining-count');
const onboardCountEl = document.getElementById('onboard-count');
const onboardColorCountEl = document.getElementById('onboard-color-count');
const queueCountEl = document.getElementById('queue-count');
const colorCountEl = document.getElementById('color-count');
const colorStats = document.getElementById('color-stats');
const addTempSlotBtn = document.getElementById('add-temp-slot');
const difficultyCanvas = document.getElementById('difficulty-canvas');
let difficultyCtx = difficultyCanvas.getContext('2d');
let difficultyHistory = [];
const currentDifficultyEl = document.getElementById('current-difficulty');
const DIFFICULTY_NAMES = ['低', '中', '高'];

const cellMap = [];
let activeCells = [];
let usedBoxColors = new Set();
let plates = [];
let nextPlateIndex = 0; // 下一个需要显示的板块索引
let activePlates = [];
let isClickDot = false;
// 控制板块与螺丝的层级，每层之间相差 10，方便调试
let nextPlateZ = 1000; // 记录下一个板块的 zIndex，从大到小生成，确保新板块在下层

const eliminatedScrewIds = new Set();
let hintMessageShown = false;
let lastCompletedColor = null; // 用于防止连续出现相同颜色盒子的冷却机制

/**
 * 创建游戏网格
 * 在游戏面板上创建行列格子
 */
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

/**
 * 激活游戏格子
 * 随机激活指定数量的格子作为可放置螺丝的区域
 */
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

/**
 * 生成游戏面板数据
 * 随机生成所有板块及其螺丝位置，每块板上随机 1-9 颗螺丝
 */
function generateBoardData(screwColorPlan) {
    boardData = [];
    let remaining = TOTAL_SCREWS;
    let id = 0;
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
            const color = screwColorPlan.shift();
            screws.push({
                row: pos.row,
                col: pos.col,
                color,
                group: id,
                stage: 0,
                id: nextScrewId++,
            });
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

/**
 * 初始化临时槽位
 * 创建指定数量的临时槽位用于存放螺丝
 */
function initTempSlots() {
    tempSlotsState = Array(MAX_TEMP_SLOTS).fill(null);
    renderTempSlots();
}

/**
 * 渲染临时槽位
 * 在页面上显示临时槽位及其内容
 */
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

/**
 * 获取游戏面板信息
 * 返回当前面板的层级和状态数据
 */
function getBoardInfo() {
    return {
        layers: JSON.parse(JSON.stringify(boardData)),
        state: JSON.parse(JSON.stringify(boardState)),
    };
}

/**
 * 设置游戏难度
 * 根据参数调整临时槽位数量和颜色池
 */
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
    updateInfo();
}

/**
 * 在指定格子中生成螺丝点
 * @param {Object} screw 螺丝对象
 * @param {Element} cell 格子元素
 * @returns {Element} 生成的螺丝点元素
 */
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

/**
 * 移除螺丝点
 * @param {Element} dot 要移除的螺丝点元素
 */
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

    if (screw) {
        const component = components.find((c) => c.id === screw.componentId);
        if (component) {
            checkPlateCompletion(component);
        }
    }
    checkScrewCountAndReplenish();
}

function removePlateDOM(plate) {
    if (plate.domElement) {
        plate.domElement.remove();
        plate.domElement = null;
    }
    for (const screw of plate.screws) {
        if (screw.dot) {
            screw.dot.remove();
            screw.dot = null;
        }
        lockConnections.slice().forEach((conn) => {
            if (conn.controller === screw || conn.locked === screw) removeConnection(conn);
        });
        if (screw.cell) {
            screw.cell.dataset.plateId = '';
            screw.cell.dataset.componentId = '';
            screw.cell = null;
        }
    }
    cleanupOrphanLocks();
    updateInfo();
}

function updateDotBlockStates() {
    // This function is now deprecated as per new requirements.
    // Screws are always clickable unless logically locked.
    for (const id in screwMap) {
        const screw = screwMap[id];
        if (!screw.dot) continue;
        const blocked = screw.locked;
        screw.dot.dataset.blocked = blocked ? 'true' : 'false';
        screw.dot.classList.toggle('blocked', blocked);
    }
}

/**
 * 清理孤立的锁定连接
 * 移除无效的锁定关系，保持游戏状态一致性
 */
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
            if (conn.locked.cell) {
                const comp = components.find((c) => c.id === conn.locked.componentId);
                if (comp) checkPlateCompletion(comp);
            }
            if (conn.controller.cell) {
                const comp = components.find((c) => c.id === conn.controller.componentId);
                if (comp) checkPlateCompletion(comp);
            }
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
        if (conn.locked.cell) {
            const comp = components.find((c) => c.id === conn.locked.componentId);
            if (comp) checkPlateCompletion(comp);
        }
        if (conn.controller.cell) {
            const comp = components.find((c) => c.id === conn.controller.componentId);
            if (comp) checkPlateCompletion(comp);
        }
    }
    if (mutual.size > 0) {
        lockConnections = lockConnections.filter((c) => !mutual.has(c));
    }

    // NEW: Find and break longer cycles (e.g., A -> B -> C -> A)
    for (const conn of lockConnections) {
        let current = conn.controller;
        let depth = 0;
        while (current) {
            if (current === conn.locked) {
                // Cycle detected!
                console.warn(`检测到锁循环并自动断开: ${conn.controller.id} -> ${conn.locked.id}`);
                // removeConnection will call cleanupOrphanLocks again, so we just call it and exit.
                removeConnection(conn);
                return; // Exit and let the new cleanup run on the modified state.
            }
            current = current.controller;
            depth++;
            if (depth > 50) {
                // Safety break
                break;
            }
        }
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

/**
 * 获取螺丝点的中心坐标
 * @param {Element} dot 螺丝点元素
 * @returns {Object} 包含x,y坐标的对象
 */
function getDotCenter(dot) {
    const br = board.getBoundingClientRect();
    const dr = dot.getBoundingClientRect();
    return {
        x: dr.left - br.left + dr.width / 2,
        y: dr.top - br.top + dr.height / 2,
    };
}

/**
 * 在两个螺丝点之间绘制连线
 * @param {Element} fromDot 起始螺丝点
 * @param {Element} toDot 目标螺丝点
 * @returns {Element} SVG线条元素
 */
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

/**
 * 移除锁定连接
 * @param {Object} conn 要移除的连接对象
 */
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
    if (conn.locked.cell) {
        const comp = components.find((c) => c.id === conn.locked.componentId);
        if (comp) checkPlateCompletion(comp);
    }
    if (conn.controller.cell) {
        const comp = components.find((c) => c.id === conn.controller.componentId);
        if (comp) checkPlateCompletion(comp);
    }
}

/**
 * 应用锁定关系
 * @param {Object} controller 控制螺丝
 * @param {Object} locked 被锁定的螺丝
 * @returns {boolean} 是否成功应用锁定
 */
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

/**
 * 检查螺丝是否可以控制目标螺丝
 * @param {Object} controller 控制螺丝
 * @param {Object} target 目标螺丝
 * @returns {boolean} 是否可以控制
 */
function canControl(controller, target) {
    // if (controller.componentId !== target.componentId) return false; // DEPRECATED: Allow inter-component locking
    if (controller.control) return false;
    if (!controller.cell || !target.cell) return false; // Screws must be on board to lock

    // NEW: Inter-component distance check
    const dist = Math.abs(controller.cell.dataset.row - target.cell.dataset.row) + Math.abs(controller.cell.dataset.col - target.cell.dataset.col);
    if (dist > gameConfig.MAX_INTER_COMPONENT_LOCK_DISTANCE) {
        return false;
    }

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

/**
 * 获取螺丝的锁定深度
 * @param {Object} screw 螺丝对象
 * @returns {number} 锁定深度
 */
function getLockDepth(screw) {
    let depth = 1;
    let cur = screw.controller;
    while (cur) {
        depth++;
        cur = cur.controller;
    }
    return depth;
}

/**
 * 获取指定颜色螺丝的最大锁定深度
 * @param {string} color 颜色
 * @returns {number} 最大锁定深度
 */
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

/**
 * 获取当前游戏进度
 * @returns {number} 游戏进度 (0-1)
 */
function getProgress() {
    return TOTAL_SCREWS > 0 ? eliminatedScrewIds.size / TOTAL_SCREWS : 0;
}

/**
 * 根据游戏进度获取难度调整参数
 * @returns {Object} 难度调整参数
 */
function getStageModifiers() {
    const progress = getProgress();
    const stages = gameConfig.DIFFICULTY_STAGES;

    if (progress < stages.STAGE_0_PROGRESS) {
        return { ...stages.MODIFIERS[0], hint: '' };
    }
    if (progress < stages.STAGE_1_PROGRESS) {
        return { ...stages.MODIFIERS[1], hint: '' };
    }
    if (progress < stages.STAGE_2_PROGRESS) {
        return { ...stages.MODIFIERS[2], hint: '' };
    }
    if (progress < stages.STAGE_3_PROGRESS) {
        return { ...stages.MODIFIERS[3], hint: '' };
    }
    // Stage 4: Monetization Hook
    return {
        ...stages.MODIFIERS[4],
        // hint: '场上太复杂了！试试解锁新盒子或临时槽位来降低难度吧！',
    };
}

/**
 * 规划关卡中的颜色分布，实现颜色随进度递增
 * @param {number} totalBoxes - 盒子总数
 * @param {Array<string>} allColors - 当前关卡可用的所有颜色
 * @returns {Array<string>} 一个包含所有螺丝颜色的打乱数组
 */
function planColorDistribution(boxColorPlan, allColorsForLevel) {
    const screwColorPlan = [];
    for (const color of boxColorPlan) {
        screwColorPlan.push(color, color, color);
    }

    // Staged color introduction logic
    const colorTiers = {
        tier1: allColorsForLevel.slice(0, 4),
        tier2: allColorsForLevel.slice(4, 7),
        tier3: allColorsForLevel.slice(7),
    };

    const getColorTier = (color) => {
        if (colorTiers.tier1.includes(color)) return 1;
        if (colorTiers.tier2.includes(color)) return 2;
        if (colorTiers.tier3.includes(color)) return 3;
        return 4; // Should not happen
    };

    screwColorPlan.sort((a, b) => {
        const tierA = getColorTier(a);
        const tierB = getColorTier(b);
        if (tierA !== tierB) {
            return tierA - tierB;
        }
        return Math.random() - 0.5; // Shuffle within the same tier
    });

    return screwColorPlan;
}

function planBoxes(totalBoxes, availableColors) {
    const boxPlan = [];
    for (let i = 0; i < totalBoxes; i++) {
        const color = availableColors[i % availableColors.length];
        boxPlan.push(color);
    }
    // Shuffle the box plan for randomness
    for (let i = boxPlan.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [boxPlan[i], boxPlan[j]] = [boxPlan[j], boxPlan[i]];
    }
    return boxPlan;
}

/**
 * 设置锁定关系
 * @param {Array} newScrews 新螺丝数组（可选）
 */
function setupLocks(newScrews) {
    const free = tempSlotsState.filter((d) => d === null).length;
    const { lockProbFactor, connectionMultiplier, extraConnections, hint } = getStageModifiers();

    if (hint && !hintMessageShown) {
        showMessage(hint);
        hintMessageShown = true; // Ensure message is shown only once per game
    }

    const baseProb = Math.min(0.8, 0.2 + free * 0.1);

    const screwsByComponent = {};
    if (!newScrews) return;
    for (const screw of newScrews) {
        if (!screwsByComponent[screw.componentId]) {
            screwsByComponent[screw.componentId] = [];
        }
        screwsByComponent[screw.componentId].push(screw);
    }

    // NEW: Get all screws on board to act as potential controllers
    const allOnBoardScrews = Object.values(screwMap).filter((s) => s.dot && s.cell);

    // --- “卡点颜色”锁定继承逻辑 (已根据最新需求优化) ---
    // 目标：如果场上存在一个未满的盒子（比如蓝色），那么任何新生成的对应颜色（蓝色）的螺丝，
    // 都应该被自动锁定，以防止玩家通过刷板块来轻松完成三消。
    const needyColors = new Set();
    document.querySelectorAll('.box[data-enabled="true"]').forEach((box) => {
        const filledSlots = box.querySelectorAll('.slot[data-filled="true"]').length;
        if (filledSlots < 3) {
            needyColors.add(box.dataset.color);
        }
    });

    if (needyColors.size > 0) {
        console.warn('检测到有未满的盒子，将对新生成的对应颜色螺丝应用继承锁定:', [...needyColors]);
        for (const screw of newScrews) {
            if (needyColors.has(screw.color) && !screw.locked) {
                const potentialControllers = allOnBoardScrews.filter((c) => c.id !== screw.id && canControl(c, screw));

                if (potentialControllers.length > 0) {
                    // 简单起见，用第一个找到的控制器来锁定它
                    const controller = potentialControllers[0];
                    console.log(`为新的 ${screw.color} 螺丝 #${screw.id} 应用继承锁定，由 #${controller.id} 控制。`);
                    applyLock(controller, screw);
                } else {
                    console.warn(`想为 ${screw.color} 螺丝 #${screw.id} 应用继承锁定，但找不到合适的控制器。`);
                }
            }
        }
    }
    // --- “卡点颜色”逻辑结束 ---

    for (const componentId in screwsByComponent) {
        const componentScrews = screwsByComponent[componentId]; // These are the NEW screws
        let currentGroups = new Set(lockConnections.map((c) => c.locked.id));

        for (const locked of componentScrews) {
            if (locked.locked) continue; // Already locked, skip.

            // A screw that is already acting as a controller for a multi-lock
            if (locked.control && !locked.locked) {
                continue;
            }

            if (currentGroups.size >= getLockGroupLimit()) break;

            // --- Gate 1: The Master Switch for Locking ---
            // This is the primary difficulty control. If this fails, the screw remains unlocked.
            const finalProb = Math.min(baseProb * lockProbFactor, 0.95);
            console.log('finalProb:', finalProb);
            if (Math.random() > finalProb) {
                continue;
            }

            // --- Gate 2: Lock Type Selection (only runs if Gate 1 passes) ---
            const allPotentialControllers = allOnBoardScrews.filter((c) => c.id !== locked.id && canControl(c, locked));
            console.log('allPotentialControllers', allPotentialControllers);
            if (allPotentialControllers.length === 0) continue;

            const chainableControllers = allPotentialControllers.filter((c) => c.locked); // Controllers that are ALREADY locked
            const multiLockControllers = allPotentialControllers.filter((c) => !c.locked); // Controllers that are FREE

            const preferChainLock = Math.random() < gameConfig.CHAIN_LOCK_PROBABILITY;

            if (preferChainLock && chainableControllers.length > 0) {
                // --- A) Create a CHAIN LOCK ---
                chainableControllers.sort((a, b) => getLockDepth(b) - getLockDepth(a));
                applyLock(chainableControllers[0], locked);
                currentGroups.add(locked.id);
            } else if (multiLockControllers.length > 0) {
                // --- B) Create a MULTI-LOCK (or fallback for chain lock) ---
                multiLockControllers.sort((a, b) => {
                    const da = Math.abs(a.cell.dataset.row - locked.cell.dataset.row) + Math.abs(a.cell.dataset.col - locked.cell.dataset.col);
                    const db = Math.abs(b.cell.dataset.row - locked.cell.dataset.row) + Math.abs(b.cell.dataset.col - locked.cell.dataset.col);
                    return da - db;
                });

                const limit = Math.min(getLockControllerLimit(), multiLockControllers.length);
                let count = limit > 1 ? 1 + Math.floor(Math.random() * limit) : 1;
                count = Math.round(count * connectionMultiplier);
                count += extraConnections;
                count = Math.min(count, multiLockControllers.length, MAX_CONTROLLERS_PER_LOCK);

                for (let i = 0; i < count; i++) {
                    applyLock(multiLockControllers[i], locked);
                }
                if (count > 0) currentGroups.add(locked.id);
            } else if (chainableControllers.length > 0) {
                // --- C) Fallback: If multi-lock was preferred but not possible, create a chain lock ---
                chainableControllers.sort((a, b) => getLockDepth(b) - getLockDepth(a));
                applyLock(chainableControllers[0], locked);
                currentGroups.add(locked.id);
            }
        }

        // Deadlock prevention logic
        const totalScrewsInComponent = componentScrews.length;
        const lockedScrewsInComponent = componentScrews.filter((s) => s.locked).length;

        if (totalScrewsInComponent > 0 && lockedScrewsInComponent === totalScrewsInComponent) {
            // Deadlock detected! Unlock one screw.
            const screwToUnlock = componentScrews.find((s) => s.locked); // Find any locked screw
            if (screwToUnlock) {
                // Find all connections locking this screw and remove them.
                const connectionsToUnlock = lockConnections.filter((conn) => conn.locked === screwToUnlock);
                for (const conn of connectionsToUnlock) {
                    removeConnection(conn);
                }
                console.warn(`Deadlock prevented in component ${componentId}. Unlocked screw ${screwToUnlock.id}.`);
            }
        }
    }
}

function checkPlateCompletion(component) {
    const currentPlate = component.plates[component.currentPlateIndex];
    if (!currentPlate) return;

    const remainingScrews = currentPlate.screws.filter((s) => s.dot);

    if (remainingScrews.length === 0) {
        removePlateDOM(currentPlate);
        component.currentPlateIndex++;

        if (component.currentPlateIndex < component.plates.length) {
            spawnComponentPlate(component);
        } else {
            if (component.domElements && component.domElements.area) {
                component.domElements.area.remove();
            }
            component.isComplete = true;

            // Spawn the next available component from the queue
            const nextUnspawned = components.find((c) => !c.isSpawned);
            if (nextUnspawned) {
                spawnComponent(nextUnspawned);
            }

            checkVictory();
            checkAndReplenishScrews();
        }
    }
}

function spawnComponentPlate(component) {
    if (component.isComplete || component.currentPlateIndex >= component.plates.length) {
        return;
    }

    const plate = component.plates[component.currentPlateIndex];
    if (!component.domElements.area) {
        const areaDiv = document.createElement('div');
        areaDiv.className = 'component-area';
        areaDiv.style.left = component.area.col * 32 + 'px';
        areaDiv.style.top = component.area.row * 32 + 'px';
        areaDiv.style.width = component.area.width * 32 + 'px';
        areaDiv.style.height = component.area.height * 32 + 'px';
        board.appendChild(areaDiv);
        component.domElements.area = areaDiv;

        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'layer-indicator';
        areaDiv.appendChild(indicatorDiv);
        component.domElements.indicator = indicatorDiv;
    }

    component.domElements.indicator.textContent = `${component.currentPlateIndex + 1}/${component.plates.length}`;

    // Create plate DOM
    const area = component.area;
    const plateOverlay = document.createElement('div');
    plateOverlay.className = 'plate';
    plateOverlay.style.backgroundColor = `rgba(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(
        Math.random() * 256
    )},0.2)`;
    plateOverlay.style.left = area.col * 32 + 'px';
    plateOverlay.style.top = area.row * 32 + 'px';
    plateOverlay.style.width = area.width * 32 - 2 + 'px';
    plateOverlay.style.height = area.height * 32 - 2 + 'px';
    plateOverlay.style.zIndex = 10;
    board.appendChild(plateOverlay);
    plate.domElement = plateOverlay;

    const availableCells = [];
    for (let r = area.row; r < area.row + area.height; r++) {
        for (let c = area.col; c < area.col + area.width; c++) {
            // Check if the cell exists and is not occupied BY ANOTHER component's plate
            if (cellMap[r] && cellMap[r][c] && !cellMap[r][c].dataset.plateId) {
                availableCells.push(cellMap[r][c]);
            }
        }
    }

    for (let i = availableCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
    }

    for (const screw of plate.screws) {
        const cell = availableCells.pop();
        if (!cell) {
            console.error('在组件区域内找不到可用单元格来放置螺丝。');
            continue;
        }
        screw.cell = cell;
        cell.dataset.plateId = plate.id;
        cell.dataset.componentId = String(component.id);
        const dot = spawnDot(screw, cell);
        dot.style.zIndex = 20;
        screw.dot = dot;
    }

    setupLocks(plate.screws);
    updateInfo();
}

function generateSingleComponent(type, colorPlan) {
    const config = COMPONENT_CONFIG[type];
    const newComponent = {
        id: nextComponentId++,
        type: type,
        plates: [],
        currentPlateIndex: 0,
        isComplete: false,
        domElements: {},
    };

    // Find a free area
    const occupiedAreas = components.filter((c) => !c.isComplete).map((c) => c.area);
    let area;
    let attempts = 0;
    do {
        const width = config.size.width;
        const height = config.size.height;
        const row = Math.floor(Math.random() * (ROWS - height));
        const col = Math.floor(Math.random() * (COLS - width));
        area = { row, col, width, height };
        attempts++;
    } while (isAreaOverlapping(area, occupiedAreas) && attempts < 100);

    if (isAreaOverlapping(area, occupiedAreas)) return null;
    newComponent.area = area;

    let remainingScrews = colorPlan.length;
    let layerIndex = 0;
    while (remainingScrews > 0) {
        const plateId = `${newComponent.id}-${layerIndex++}`;
        const numScrewsThisLayer = Math.min(config.screwsPerLayer(), remainingScrews);
        const screws = [];
        for (let j = 0; j < numScrewsThisLayer; j++) {
            const color = colorPlan.shift();
            screws.push({
                color,
                group: newComponent.id,
                stage: 0,
                id: nextScrewId++,
                plateId: plateId,
                componentId: newComponent.id,
                cell: null,
                dot: null,
                locked: false,
                controller: null,
                control: null,
                controllers: [],
                overlay: null,
            });
        }

        if (screws.length > 0) {
            newComponent.plates.push({ id: plateId, screws });
        }
        remainingScrews -= numScrewsThisLayer;
        if (layerIndex > 20) break; // Safety break to prevent infinite loops
    }
    return newComponent;
}

/**
 * 检查是否点击了螺丝点
 * 设置点击状态标记
 */
function checkClickDot() {
    isClickDot = true;
    setTimeout(() => {
        isClickDot = false;
    }, 1000);
}

/**
 * 处理螺丝点击事件
 * @param {Element} dot 被点击的螺丝点元素
 */
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
            newDot.dataset.sid = screw.id;
            emptySlot.replaceWith(newDot);
            dot.remove();

            if (screw) {
                const component = components.find((c) => c.id === screw.componentId);
                if (component) checkPlateCompletion(component);
            }
            lastRemovedCell = fromCell;
            updateInfo();
            checkVictory();
            checkAndReplenishScrews();

            if (checkAndProcessBoxMatch(box)) {
                return;
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

        if (screw) {
            const component = components.find((c) => c.id === screw.componentId);
            if (component) checkPlateCompletion(component);
        }

        lastRemovedCell = fromCell;
        updateInfo();
        checkVictory();
        checkTempSlotLimit();
        checkAndReplenishScrews();
        return;
    }

    showMessage('💥 游戏失败！临时槽已满！');
    disableGame();
}

/**
 * 重置所有盒子状态
 * 恢复盒子到初始状态
 */
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

/**
 * 初始化所有盒子
 * 设置盒子的初始状态和事件监听器
 */
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
            box.addEventListener(
                'click',
                () => {
                    setupBox(box, true); // Pass true for isHint/isManualAdd
                    const hintElement = box.querySelector('.hint');
                    if (hintElement) hintElement.remove();
                },
                { once: true }
            ); // Ensure this only fires once
        }
    });
}

/**
 * 检查临时槽位限制
 * 当临时槽位满时游戏失败
 */
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

/**
 * 显示消息
 * @param {string} msg 要显示的消息
 */
function showMessage(msg) {
    message.textContent = msg;
}

// New helper function to get detailed stats for all colors
function getColorStats() {
    const stats = {};
    COLORS.forEach((c) => {
        stats[c] = {
            onBoardUnlocked: 0,
            onBoardLocked: 0,
            inTemp: 0,
            inBox: 0,
            unspawned: 0,
            total: 0,
        };
    });

    const tempScrewIds = new Set(tempSlotsState.filter((d) => d).map((d) => String(d.dataset.sid)));
    const boxScrewIds = new Set();
    document.querySelectorAll('.box .slot[data-sid]').forEach((s) => boxScrewIds.add(String(s.dataset.sid)));

    for (const id in screwMap) {
        const screw = screwMap[id];
        const s = stats[screw.color];
        if (!s || eliminatedScrewIds.has(id)) {
            continue;
        }

        s.total++;

        if (screw.dot) {
            if (screw.locked) {
                s.onBoardLocked++;
            } else {
                s.onBoardUnlocked++;
            }
        } else if (tempScrewIds.has(id)) {
            s.inTemp++;
        } else if (boxScrewIds.has(id)) {
            s.inBox++;
        } else {
            s.unspawned++;
        }
    }
    return stats;
}

function evaluateDifficultyForColor(color, allColorStats) {
    const stats = allColorStats[color];
    if (!stats) return 3; // Hard if no stats

    const accessibleTotal = stats.onBoardUnlocked + stats.inTemp + stats.inBox;
    const availableTotal = accessibleTotal + stats.onBoardLocked;

    if (accessibleTotal >= 3) return 1; // Easy
    if (availableTotal >= 3) return 2; // Medium
    return 3; // Hard
}

function evaluateOverallDifficulty() {
    let minLevel = 3;
    const allColorStats = getColorStats(); // Calculate once
    boxes.forEach((box) => {
        if (box.dataset.enabled === 'true') {
            const lvl = evaluateDifficultyForColor(box.dataset.color, allColorStats);
            if (lvl < minLevel) minLevel = lvl;
        }
    });
    return minLevel;
}

/**
 * 绘制难度图表
 * 在画布上绘制难度变化趋势
 */
function drawDifficultyChart() {
    if (!difficultyCtx) return;
    const w = difficultyCanvas.width;
    const h = difficultyCanvas.height;
    difficultyCtx.clearRect(0, 0, w, h);
    difficultyCtx.strokeStyle = '#000';
    difficultyCtx.beginPath();
    const left = 40;
    const top = 20;
    const bottom = h - 30;
    difficultyCtx.moveTo(left, top);
    difficultyCtx.lineTo(left, bottom);
    difficultyCtx.lineTo(w - 10, bottom);
    difficultyCtx.stroke();

    difficultyCtx.font = '14px sans-serif';
    difficultyCtx.fillStyle = '#000';
    difficultyCtx.textAlign = 'right';
    difficultyCtx.fillText('高', left - 5, top + 5);
    difficultyCtx.fillText('中', left - 5, top + (bottom - top) / 2 + 5);
    difficultyCtx.fillText('低', left - 5, bottom + 5);

    if (difficultyHistory.length === 0) return;
    const step = (w - left - 10) / Math.max(1, difficultyHistory.length - 1);
    difficultyCtx.strokeStyle = '#f00';
    difficultyCtx.beginPath();
    difficultyHistory.forEach((lvl, idx) => {
        const x = left + idx * step;
        const y = bottom - (lvl - 1) * ((bottom - top) / 2);
        if (idx === 0) difficultyCtx.moveTo(x, y);
        else difficultyCtx.lineTo(x, y);
    });
    difficultyCtx.stroke();
    difficultyCtx.fillStyle = '#f00';
    difficultyHistory.forEach((lvl, idx) => {
        const x = left + idx * step;
        const y = bottom - (lvl - 1) * ((bottom - top) / 2);
        difficultyCtx.beginPath();
        difficultyCtx.arc(x, y, 3, 0, Math.PI * 2);
        difficultyCtx.fill();
    });
}

/**
 * 记录难度
 * @param {number} level 难度级别
 */
function recordDifficulty(level) {
    difficultyHistory.push(level);
    drawDifficultyChart();
    if (currentDifficultyEl) currentDifficultyEl.textContent = DIFFICULTY_NAMES[level - 1];
}

/**
 * 更新游戏信息面板
 */
function updateInfo() {
    const stats = {
        onBoard: Object.fromEntries(COLORS.map((c) => [c, 0])),
        inTemp: Object.fromEntries(COLORS.map((c) => [c, 0])),
        inBox: Object.fromEntries(COLORS.map((c) => [c, 0])),
        eliminated: Object.fromEntries(COLORS.map((c) => [c, 0])),
        unspawned: Object.fromEntries(COLORS.map((c) => [c, 0])),
    };

    const tempScrewIds = new Set(tempSlotsState.filter((d) => d).map((d) => String(d.dataset.sid)));
    const boxScrewIds = new Set();
    document.querySelectorAll('.box .slot[data-sid]').forEach((s) => boxScrewIds.add(String(s.dataset.sid)));

    for (const id in screwMap) {
        const screw = screwMap[id];
        if (eliminatedScrewIds.has(id)) {
            stats.eliminated[screw.color]++;
        } else if (screw.dot) {
            stats.onBoard[screw.color]++;
        } else if (tempScrewIds.has(id)) {
            stats.inTemp[screw.color]++;
        } else if (boxScrewIds.has(id)) {
            stats.inBox[screw.color]++;
        } else {
            stats.unspawned[screw.color]++;
        }
    }

    const onBoardTotal = Object.values(stats.onBoard).reduce((a, b) => a + b, 0);
    const inTempTotal = Object.values(stats.inTemp).reduce((a, b) => a + b, 0);
    const inBoxTotal = Object.values(stats.inBox).reduce((a, b) => a + b, 0);
    const eliminatedTotal = Object.values(stats.eliminated).reduce((a, b) => a + b, 0);
    const unspawnedTotal = Object.values(stats.unspawned).reduce((a, b) => a + b, 0);

    const remainingTotal = onBoardTotal + inTempTotal + inBoxTotal + unspawnedTotal;
    const onBoardColors = Object.keys(stats.onBoard).filter((c) => stats.onBoard[c] > 0).length;

    const boxesInQueue = Object.fromEntries(COLORS.map((c) => [c, 0]));
    for (const color of boxColorQueue) {
        boxesInQueue[color]++;
    }

    totalCountEl.textContent = TOTAL_SCREWS;
    remainingCountEl.textContent = remainingTotal;
    eliminatedCountEl.textContent = eliminatedTotal;
    progressCountEl.textContent = TOTAL_SCREWS > 0 ? ((eliminatedTotal / TOTAL_SCREWS) * 100).toFixed(2) + '%' : '0.00%';
    onboardCountEl.textContent = onBoardTotal;
    queueCountEl.textContent = inTempTotal + inBoxTotal;
    onboardColorCountEl.textContent = onBoardColors;
    colorCountEl.textContent = onBoardColors;

    colorStats.innerHTML = COLORS.map((c) => {
        const screwsInPlay = stats.onBoard[c] + stats.inTemp[c] + stats.inBox[c] + stats.unspawned[c];
        const boxesCreated = COLOR_BOX_TOTALS[c] - boxesInQueue[c];
        return `<div style="color:${c}">${COLOR_NAMES[c]}螺丝:<span>${screwsInPlay}</span>/${COLOR_TOTALS[c]} 盒子:<span>${boxesCreated}</span>/${COLOR_BOX_TOTALS[c]}</div>`;
    }).join('');
}

/**
 * 获取当前锁定组数限制
 * @returns {number} 限制数量
 */
function getLockGroupLimit() {
    const progress = getProgress();
    if (progress < 0.3) return Math.min(MAX_LOCK_GROUPS, 3);
    if (progress < 0.7) return Math.min(MAX_LOCK_GROUPS, 4);
    return MAX_LOCK_GROUPS;
}

/**
 * 获取单个锁的控制器数量限制
 * @returns {number} 限制数量
 */
function getLockControllerLimit() {
    const progress = getProgress();
    if (progress < 0.3) return 2;
    if (progress < 0.7) return Math.min(MAX_CONTROLLERS_PER_LOCK, 3);
    return MAX_CONTROLLERS_PER_LOCK;
}

/**
 * 禁用游戏
 * 游戏结束时调用
 */
function disableGame() {
    document.querySelectorAll('.dot').forEach((d) => (d.style.pointerEvents = 'none'));
    boxes.forEach((b) => (b.style.pointerEvents = 'none'));
    stopAutoPlay();
}

function checkVictory() {
    const boardDots = document.querySelectorAll('#game-board .dot').length;
    const boxDots = [...boxes].reduce((s, b) => s + [...b.children].filter((el) => el.dataset.filled).length, 0);
    const tempDots = tempSlotsState.filter((d) => d).length;

    const allComponentsComplete = components.every((c) => c.isComplete);
    if (allComponentsComplete && boardDots === 0 && boxDots === 0 && tempDots === 0 && totalRemainingPool() === 0) {
        showMessage('🏆 游戏胜利！');
        disableGame();
        return;
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
                console.log('当前有匹配盒子颜色，自动点击:', dot.dataset.sid, 'color:', color, dot.dataset.color);
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
    const emptySlots = tempSlotsState.filter((d) => d === null).length;

    if (bestPlate && emptySlots > 1) {
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

/**
 * 开始游戏
 * 初始化游戏状态并开始新一局游戏
 */
function startGame() {
    stopAutoPlay();
    // The 50-level slider is the primary source of truth for difficulty settings
    const settings = DIFFICULTY_LEVELS.find((d) => d.level === selectedDifficulty);

    if (settings) {
        // --- 应用关卡配置 ---
        TOTAL_BOXES = settings.boxes;
        COLORS = ALL_COLORS.slice(0, Math.min(settings.colors, ALL_COLORS.length));
        MAX_TEMP_SLOTS = settings.tempSlots;

        // --- 应用锁算法配置 ---
        MAX_LOCK_GROUPS = settings.maxLockGroups;
        MAX_CONTROLLERS_PER_LOCK = settings.maxControllers;
        gameConfig.CHAIN_LOCK_PROBABILITY = settings.chainLockProbability;

        // --- 同步UI输入框 (可选, 但保持一致性是好习惯) ---
        document.getElementById('box-count').value = settings.boxes;
        document.getElementById('color-count-input').value = settings.colors;
        document.getElementById('temp-count').value = settings.tempSlots;
        document.getElementById('chain-lock-prob-input').value = settings.chainLockProbability;
    } else {
        // Fallback to manual UI config if something goes wrong
        TOTAL_BOXES = parseInt(document.getElementById('box-count').value) || 50;
        const colorCnt = parseInt(document.getElementById('color-count-input').value) || 7;
        MAX_TEMP_SLOTS = parseInt(document.getElementById('temp-count').value) || 5;
        COLORS = ALL_COLORS.slice(0, Math.min(colorCnt, ALL_COLORS.length));
        gameConfig.MIN_ONBOARD_SCREWS = parseInt(document.getElementById('min-onboard-screws').value, 10);
    }

    hintMessageShown = false; // Reset hint message flag for new game

    // Setup global color tiers based on the current level's colors
    colorTiers.tier1 = COLORS.slice(0, 4);
    colorTiers.tier2 = COLORS.slice(4, 7);
    colorTiers.tier3 = COLORS.slice(7);

    const localBoxColorPlan = planBoxes(TOTAL_BOXES, COLORS);
    boxColorQueue = [...localBoxColorPlan];
    const screwColorPlan = planColorDistribution(localBoxColorPlan, COLORS);
    TOTAL_SCREWS = screwColorPlan.length;

    console.log(screwColorPlan);
    console.log(TOTAL_SCREWS);

    // Clear board and state
    board.innerHTML = '<svg id="line-layer"></svg>';
    lineLayer = document.getElementById('line-layer');
    cellMap.length = 0;
    lockConnections = [];
    usedBoxColors.clear();
    eliminatedScrewIds.clear();
    tempSlotsState = [];
    nextScrewId = 0;
    for (const k in screwMap) delete screwMap[k];
    components = [];
    nextComponentId = 0;

    // Setup game
    createGrid();
    initTempSlots();
    generateComponents(screwColorPlan);
    initPools();
    initBoardState();

    // Spawn initial components
    const initialSpawn = gameConfig.INITIAL_SPAWN_COUNTS;
    const availableMedium = components.filter((c) => c.type === 'MEDIUM').length;

    // Spawn Large
    let spawnedCount = 0;
    for (const comp of components) {
        if (comp.type === 'LARGE' && spawnedCount < initialSpawn.LARGE) {
            if (spawnComponent(comp)) spawnedCount++;
        }
    }

    // Spawn Medium
    spawnedCount = 0;
    for (const comp of components) {
        if (comp.type === 'MEDIUM' && spawnedCount < Math.min(initialSpawn.MEDIUM, availableMedium)) {
            if (spawnComponent(comp)) spawnedCount++;
        }
    }

    // Spawn Small
    spawnedCount = 0;
    for (const comp of components) {
        if (comp.type === 'SMALL' && spawnedCount < initialSpawn.SMALL) {
            if (spawnComponent(comp)) spawnedCount++;
        }
    }

    // NEW: Intelligent initial box setup
    resetBoxes();

    // 1. Get total counts of all screws for each color (spawned or not)
    const totalColorCounts = Object.fromEntries(COLORS.map((c) => [c, 0]));
    for (const id in screwMap) {
        if (!eliminatedScrewIds.has(id)) {
            totalColorCounts[screwMap[id].color]++;
        }
    }

    // 2. Filter for colors that have at least 3 screws in total (ensuring they are solvable)
    const solvableColors = Object.keys(totalColorCounts).filter((c) => totalColorCounts[c] >= 3);

    // 3. Of the solvable colors, find their current counts on the board to prioritize
    const initialBoardColors = countBoardColors();
    const sortedSolvableColors = solvableColors.sort((a, b) => {
        const countA = initialBoardColors[a] || 0;
        const countB = initialBoardColors[b] || 0;
        return countB - countA;
    });

    // 4. Override the start of the queue with these prioritized, solvable colors
    for (let i = 0; i < sortedSolvableColors.length; i++) {
        const color = sortedSolvableColors[i];
        const indexInQueue = boxColorQueue.indexOf(color);
        if (indexInQueue !== -1) {
            boxColorQueue.splice(indexInQueue, 1);
            boxColorQueue.unshift(color);
        }
    }

    difficultyHistory = [];
    drawDifficultyChart();
    if (currentDifficultyEl) currentDifficultyEl.textContent = '-';
    initBoxes();
    updateInfo();
    showMessage('');
}

const autoBtn = document.getElementById('auto-btn');
const difficultyButtonsContainer = document.getElementById('difficulty-buttons');

function updateInputsWithDifficulty(difficulty) {
    const settings = DIFFICULTY_LEVELS.find((d) => d.level === difficulty);
    if (settings) {
        document.getElementById('box-count').value = settings.boxes;
        document.getElementById('color-count-input').value = settings.colors;
        document.getElementById('temp-count').value = settings.tempSlots;
        document.getElementById('min-onboard-screws').value = gameConfig.MIN_ONBOARD_SCREWS;
        // 新增：同步链式锁概率输入框
        if (document.getElementById('chain-lock-prob-input')) {
            document.getElementById('chain-lock-prob-input').value = settings.chainLockProbability;
        }
    }
}

function createDifficultyButtons() {
    difficultyButtonsContainer.innerHTML = '';
    for (const difficulty of DIFFICULTY_LEVELS) {
        const button = document.createElement('button');
        button.className = 'difficulty-btn';
        button.textContent = difficulty.level;
        button.dataset.level = difficulty.level;

        if (difficulty.level === selectedDifficulty) {
            button.classList.add('selected');
        }

        button.addEventListener('click', () => {
            selectedDifficulty = difficulty.level;

            const allButtons = difficultyButtonsContainer.querySelectorAll('.difficulty-btn');
            allButtons.forEach((btn) => btn.classList.remove('selected'));
            button.classList.add('selected');

            updateInputsWithDifficulty(selectedDifficulty);
            updateDifficultyInfoDisplay(selectedDifficulty);
        });
        difficultyButtonsContainer.appendChild(button);
    }
}

document.getElementById('start-btn').addEventListener('click', () => {
    stopAutoPlay();
    // Update config from UI before starting
    gameConfig.MIN_ONBOARD_SCREWS = parseInt(document.getElementById('min-onboard-screws').value, 10);
    if (document.getElementById('chain-lock-prob-input')) {
        gameConfig.CHAIN_LOCK_PROBABILITY = parseFloat(document.getElementById('chain-lock-prob-input').value);
    }
    startGame();
});
document.getElementById('reset-btn').addEventListener('click', () => {
    stopAutoPlay();
    // Update config from UI before starting
    gameConfig.MIN_ONBOARD_SCREWS = parseInt(document.getElementById('min-onboard-screws').value, 10);
    if (document.getElementById('chain-lock-prob-input')) {
        gameConfig.CHAIN_LOCK_PROBABILITY = parseFloat(document.getElementById('chain-lock-prob-input').value);
    }
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
createDifficultyButtons();
updateInputsWithDifficulty(selectedDifficulty);
startGame();

function weightedRandom(colors, weights) {
    const total = colors.reduce((s, c) => s + (weights[c] || 0), 0);
    let r = Math.random() * total;
    for (const c of colors) {
        if (weights[c]) {
            r -= weights[c];
            if (r <= 0) return c;
        }
    }
    const validColors = colors.filter((c) => weights[c] > 0);
    return validColors.length > 0 ? validColors[validColors.length - 1] : colors[colors.length - 1];
}

function setupBox(box, isManualAdd = false) {
    const allColorStats = getColorStats();

    // 1. Permanent Purge: Remove boxes for colors that are completely extinct from the game.
    const originalQueueCount = boxColorQueue.length;
    boxColorQueue = boxColorQueue.filter((color) => {
        const stats = allColorStats[color];
        return stats && stats.total > 0;
    });

    if (boxColorQueue.length < originalQueueCount) {
        console.log(`队列净化：永久移除了 ${originalQueueCount - boxColorQueue.length} 个已耗尽颜色的盒子。`);
    }

    if (boxColorQueue.length === 0) {
        box.dataset.enabled = 'false';
        box.classList.remove('enabled');
        box.style.borderColor = '#ccc';
        box.innerHTML = '<div class="hint">无</div>';
        return;
    }

    // 2. Dynamic Candidate Pool: A color is only a candidate if its screws are ON THE BOARD now.
    const onBoardScrewStats = countBoardColors();
    const onBoardColors = new Set(Object.keys(onBoardScrewStats).filter((c) => onBoardScrewStats[c] > 0));

    let turnCandidates = boxColorQueue.filter((c) => onBoardColors.has(c));

    // Fallback: If no on-board screw colors are in the queue, the game could get stuck.
    // In this case, use the entire (purged) queue as candidates to prevent a deadlock.
    if (turnCandidates.length === 0) {
        turnCandidates = [...boxColorQueue]; // Use a copy
        if (boxColorQueue.length > 0) {
            console.warn('场上无螺丝颜色匹配盒子队列，使用完整队列作为候选以避免卡关。');
        }
    }

    if (turnCandidates.length === 0) {
        // This can happen if the queue is now empty after filtering.
        box.dataset.enabled = 'false';
        box.classList.remove('enabled');
        box.style.borderColor = '#ccc';
        box.innerHTML = '<div class="hint">无</div>';
        return;
    }

    // --- 新增：防止立即重复出现刚消除的颜色 ---
    if (lastCompletedColor && turnCandidates.length > 1 && !isManualAdd) {
        const colorStats = allColorStats[lastCompletedColor];
        const onBoardCount = colorStats ? colorStats.onBoardLocked + colorStats.onBoardUnlocked : 0;
        const HIGH_COUNT_THRESHOLD = 9; // 定义一个阈值，超过此数量则可忽略冷却

        // 仅当场上该颜色螺丝数量不多时，才应用冷却
        if (onBoardCount < HIGH_COUNT_THRESHOLD) {
            const filteredCandidates = turnCandidates.filter((c) => c !== lastCompletedColor);
            // 确保过滤后仍有候选，否则强制使用原列表
            if (filteredCandidates.length > 0) {
                console.log(`冷却机制：上一个完成的颜色是 ${lastCompletedColor}，本次优先选择其他颜色。`);
                turnCandidates = filteredCandidates;
            }
        }
    }
    // 这是一个一次性效果，立即重置
    lastCompletedColor = null;
    // --- 冷却逻辑结束 ---

    // 3. Prioritized Selection: Choose the best color from the dynamic candidates.
    const progress = getProgress();
    let bestColor = null;

    let strategicColors = [];
    if (isManualAdd) {
        const tempSlotColors = tempSlotsState.filter((d) => d).map((d) => d.dataset.color);
        strategicColors = [...new Set(tempSlotColors)].filter((c) => turnCandidates.includes(c));
    } else if (progress < gameConfig.BOX_AI_CHALLENGE_THRESHOLD) {
        // Early Game: Helpful colors
        strategicColors = turnCandidates.filter((c) => {
            const stats = allColorStats[c];
            return stats && stats.onBoardUnlocked + stats.inTemp >= 3;
        });
    } else {
        // Late Game: Challenging colors ("严师") - REFINED LOGIC
        // 优先选择那些"可解但被锁住"的颜色
        // 条件1: 场上该颜色总数 >= 3 (保证可解性)
        // 条件2: 场上该颜色至少有1个被锁住 (保证挑战性)
        strategicColors = turnCandidates.filter((c) => {
            const stats = allColorStats[c];
            return (
                stats &&
                stats.onBoardLocked > 0 &&
                stats.onBoardUnlocked + stats.inTemp + stats.inBox < 3 &&
                stats.onBoardUnlocked + stats.onBoardLocked + stats.inTemp + stats.inBox >= 3
            );
        });
    }

    // Priority 1: A strategic color that is not a duplicate on the board.
    const p1 = strategicColors.find((c) => !usedBoxColors.has(c));
    if (p1) bestColor = p1;

    // Priority 2: Any color that is not a duplicate.
    if (!bestColor) {
        const p2 = turnCandidates.find((c) => !usedBoxColors.has(c));
        if (p2) bestColor = p2;
    }

    // Priority 3: A strategic color that IS a duplicate (forced choice).
    if (!bestColor) {
        if (strategicColors.length > 0) bestColor = strategicColors[0];
    }

    // Priority 4: Ultimate fallback, just take the first available candidate.
    if (!bestColor) {
        bestColor = turnCandidates[0];
    }

    // 4. Final Processing
    const indexInMainQueue = boxColorQueue.indexOf(bestColor);
    if (indexInMainQueue === -1) {
        // This is a logic error, but handle it gracefully. The box will appear empty.
        console.error('逻辑错误：选择的颜色不在主队列中。', {
            bestColor: bestColor,
            turnCandidates: turnCandidates,
            mainQueue: boxColorQueue,
        });
        box.dataset.enabled = 'false';
        box.classList.remove('enabled');
        box.style.borderColor = '#ccc';
        box.innerHTML = '<div class="hint">错误</div>';
        return;
    }

    const color = boxColorQueue.splice(indexInMainQueue, 1)[0];

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

    const level = evaluateOverallDifficulty();
    recordDifficulty(level);

    absorbTempDots(color, box);
    updateInfo();
}

function absorbTempDots(color, box) {
    const matchingDots = [];
    tempSlotsState.forEach((d, i) => {
        if (d && d.dataset.color === color) {
            matchingDots.push({ dot: d, index: i });
        }
    });

    for (const item of matchingDots) {
        const emptySlot = [...box.children].find((s) => s.className === 'slot' && !s.dataset.filled);
        if (emptySlot) {
            // Move dot from temp to box
            tempSlotsState[item.index] = null;

            const newDot = document.createElement('div');
            newDot.className = 'slot';
            newDot.style.backgroundColor = color;
            newDot.dataset.color = color;
            newDot.dataset.filled = 'true';
            newDot.dataset.sid = item.dot.dataset.sid;
            emptySlot.replaceWith(newDot);
            item.dot.remove();
        } else {
            break; // Box is full
        }
    }
    renderTempSlots();

    if (checkAndProcessBoxMatch(box)) {
        // Match was processed
    } else {
        updateInfo();
        checkVictory();
        checkAndReplenishScrews();
    }
}

function checkAndProcessBoxMatch(box) {
    if (!box || !box.dataset.color) return false;

    const color = box.dataset.color;
    const filledSlots = [...box.children].filter((s) => s.dataset.filled === 'true');

    if (filledSlots.length === 3) {
        setTimeout(() => {
            filledSlots.forEach((slot) => {
                if (slot.dataset.sid) {
                    eliminatedScrewIds.add(slot.dataset.sid);
                }
            });

            usedBoxColors.delete(color);
            lastCompletedColor = color; // 在分配新盒子前，记录刚刚完成的颜色
            setupBox(box);
            showMessage('🎉 三消成功！');
            setTimeout(() => showMessage(''), 1500);
            updateInfo();
            checkVictory();
        }, 100);
        return true;
    }
    return false;
}

/**
 * 计算剩余颜色池总数
 * @returns {number} 剩余螺丝总数
 */
function totalRemainingPool() {
    return COLORS.reduce((s, c) => s + (colorPool[c] || 0), 0);
}

/**
 * 统计游戏面板上各颜色螺丝数量
 * @returns {Object} 各颜色的数量统计
 */
function countBoardColors() {
    const counts = Object.fromEntries(COLORS.map((c) => [c, 0]));
    if (!components) return counts;

    for (const component of components) {
        if (component.isComplete) continue;

        const currentPlate = component.plates[component.currentPlateIndex];
        if (!currentPlate) continue;

        for (const screw of currentPlate.screws) {
            if (screw.dot && counts[screw.color] !== undefined) {
                counts[screw.color]++;
            }
        }
    }
    return counts;
}

function spawnComponent(component) {
    if (!component || component.isSpawned) return false;

    const config = gameConfig.COMPONENT_CONFIG[component.type];
    const neededWidth = config.size.width;
    const neededHeight = config.size.height;
    let foundSpot = false;
    let area;

    const occupiedGrid = Array(ROWS)
        .fill(null)
        .map(() => Array(COLS).fill(false));
    for (const c of components) {
        if (c.isSpawned && c.area) {
            for (let r = c.area.row; r < c.area.row + c.area.height; r++) {
                for (let col = c.area.col; col < c.area.col + c.area.width; col++) {
                    if (r < ROWS && col < COLS) occupiedGrid[r][col] = true;
                }
            }
        }
    }

    // --- Plan A: Try to find a perfect rectangular spot ---
    const startRow = Math.floor(Math.random() * (ROWS - neededHeight + 1));
    const startCol = Math.floor(Math.random() * (COLS - neededWidth + 1));

    for (let r_offset = 0; r_offset < ROWS; r_offset++) {
        const r = (startRow + r_offset) % (ROWS - neededHeight + 1);
        for (let c_offset = 0; c_offset < COLS; c_offset++) {
            const c = (startCol + c_offset) % (COLS - neededWidth + 1);
            let canPlace = true;
            for (let y = r; y < r + neededHeight; y++) {
                for (let x = c; x < c + neededWidth; x++) {
                    if (occupiedGrid[y][x]) {
                        canPlace = false;
                        break;
                    }
                }
                if (!canPlace) break;
            }
            if (canPlace) {
                area = { row: r, col: c, width: neededWidth, height: neededHeight };
                foundSpot = true;
                break;
            }
        }
        if (foundSpot) break;
    }

    // --- Plan B: Emergency fallback if no perfect spot is found ---
    if (!foundSpot) {
        console.warn(`无法为组件 ${component.id} (${component.type}) 找到标准矩形位置。启动紧急随机放置模式。`);

        // Collect all empty cells from the entire board.
        const allEmptyCells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!occupiedGrid[r][c]) {
                    allEmptyCells.push(cellMap[r][c]);
                }
            }
        }

        const neededScrews = component.plates[0]?.screws.length || 0;
        if (allEmptyCells.length >= neededScrews) {
            // Pick a random empty cell as an anchor for our new component area.
            const anchorCell = allEmptyCells[Math.floor(Math.random() * allEmptyCells.length)];
            const anchorR = parseInt(anchorCell.dataset.row);
            const anchorC = parseInt(anchorCell.dataset.col);

            // Define a standard-sized area centered around the anchor as much as possible.
            // Try to make the anchor cell not be at the very edge of the new area.
            let r = anchorR - Math.floor(Math.random() * neededHeight);
            let c = anchorC - Math.floor(Math.random() * neededWidth);

            // Clamp the area to be within the board boundaries.
            r = Math.max(0, Math.min(r, ROWS - neededHeight));
            c = Math.max(0, Math.min(c, COLS - neededWidth));

            area = { row: r, col: c, width: neededWidth, height: neededHeight };
            foundSpot = true;
        } else {
            console.error(`紧急放置失败：没有足够的空单元格 (${allEmptyCells.length}) 来放置 ${neededScrews} 个螺丝。`);
            return false;
        }
    }

    component.area = area;
    component.isSpawned = true;
    spawnComponentPlate(component);
    return true;
}

function checkAndReplenishScrews() {
    const minOnboard = gameConfig.MIN_ONBOARD_SCREWS;
    let currentOnBoard = Object.values(countBoardColors()).reduce((a, b) => a + b, 0);

    let safetyBreak = 0;
    while (currentOnBoard < minOnboard && safetyBreak < 20) {
        const nextUnspawned = components.find((c) => !c.isSpawned);
        if (nextUnspawned) {
            if (spawnComponent(nextUnspawned)) {
                // Recalculate current number of screws after spawning
                currentOnBoard = Object.values(countBoardColors()).reduce((a, b) => a + b, 0);
            } else {
                // Could not spawn, probably board is full, break the loop
                break;
            }
        } else {
            // No more unspawned small components left to replenish
            break;
        }
        safetyBreak++;
    }
}

// ===============================================
// RESTORED AND IMPROVED Spawning Logic
// ===============================================

function getBoundingBox(cells) {
    if (!cells || cells.length === 0) {
        return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, width: 1, height: 1 };
    }
    let minRow = Infinity,
        maxRow = -Infinity,
        minCol = Infinity,
        maxCol = -Infinity;
    cells.forEach((cell) => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
    });
    return {
        row: minRow,
        col: minCol,
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1,
    };
}

// ===============================================
// NEW Difficulty Info Panel
// ===============================================
function setupDifficultyInfoPanel() {
    const container = document.getElementById('difficulty-buttons');
    if (!container) return;

    // Inject CSS for the panel
    const style = document.createElement('style');
    style.textContent = `
        #difficulty-info-panel {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: .25rem;
            padding: 1rem;
            margin-top: 1rem;
            font-family: sans-serif;
        }
        #difficulty-info-panel h4 {
            margin-top: 0;
            border-bottom: 1px solid #ccc;
            padding-bottom: 0.5rem;
        }
        #difficulty-info-panel ul {
            list-style-type: none;
            padding-left: 0;
            margin-bottom: 0;
        }
        #difficulty-info-panel li {
            padding: 0.25rem 0;
        }
    `;
    document.head.appendChild(style);

    const difficultyInfoPanel = document.createElement('div');
    difficultyInfoPanel.id = 'difficulty-info-panel';
    container.insertAdjacentElement('afterend', difficultyInfoPanel);
}

function updateDifficultyInfoDisplay(level) {
    const panel = document.getElementById('difficulty-info-panel');
    if (!panel) return;

    const settings = DIFFICULTY_LEVELS.find((d) => d.level === level);
    if (!settings) {
        panel.innerHTML = '未找到所选难度的配置信息。';
        return;
    }

    const infoHTML = `
        <h4>难度 ${level} 配置详情</h4>
        <ul>
            <li><strong>螺丝颜色种类:</strong> ${settings.colors}</li>
            <li><strong>螺丝盒子总数:</strong> ${settings.boxes}</li>
            <li><strong>最大锁定组数:</strong> ${settings.maxLockGroups} (场上总锁组)</li>
            <li><strong>最大并联锁数量:</strong> ${settings.maxControllers} (锁的广度)</li>
            <li><strong>锁生成概率:</strong> ${Math.round(settings.chainLockProbability * 100)}% (锁的深度)</li>
            <li><strong>最小在场螺丝数:</strong> ${gameConfig.MIN_ONBOARD_SCREWS} (低于此值则补充)</li>
        </ul>
    `;
    panel.innerHTML = infoHTML;
}

// Initial setup
createDifficultyButtons();
setupDifficultyInfoPanel();
updateDifficultyInfoDisplay(selectedDifficulty);
startGame();
