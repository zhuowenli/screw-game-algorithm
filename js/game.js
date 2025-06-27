// =================================================================
// 游戏核心配置 (Game Core Configuration)
// 策划可以在此调整游戏的核心数值和行为
// =================================================================

// =================================================================
// [新系统] K值难度系统代码
// =================================================================

// 默认K值曲线 (前松后紧)
const NEW_DEFAULT_K_VALUES = Array.from({ length: 200 }, (_, i) => {
    const progress = i / 199;
    // 使用三次方曲线来模拟 "前松后紧" 的难度增长
    const k = 1 + progress ** 3 * 9;
    return parseFloat(k.toFixed(1));
});

const gameConfig = {
    // --- 棋盘与布局 (Board & Layout) ---
    ROWS: 36,
    COLS: 20,
    MIN_ONBOARD_SCREWS: 15, // 场上螺丝数量下限

    // --- 核心玩法 (Core Gameplay) ---
    MAX_TEMP_SLOTS: 5, // 初始临时槽位数量
    MAX_CHAIN_LENGTH: 5, // 锁链的最大长度 (K值会影响实际达到的长度)
    MAX_INTER_COMPONENT_LOCK_DISTANCE: 12, // 跨板块锁定的最大距离(曼哈顿距离)
    MAX_CONTROLLERS: 4, // 最大并联锁数量

    // --- 关卡配置 (Level Configuration) ---
    SCREW_COUNT: 150, // 目标螺丝总数
    COLOR_COUNT: 7, // 颜色数量
    K_VALUES: NEW_DEFAULT_K_VALUES, // 难度K值曲线

    // --- 部件生成配置 (Component Generation) ---
    COMPONENT_CONFIG: {
        LARGE: {
            count: 1,
            layers: () => 4 + Math.floor(Math.random() * 4), // 4-7
            screwsPerLayer: () => 5 + Math.floor(Math.random() * 5), // 5-9
            size: { width: 7, height: 7 },
        },
        MEDIUM: {
            count: () => 3 + Math.floor(Math.random() * 4), // 3-6
            layers: () => 2 + Math.floor(Math.random() * 3), // 2-4
            screwsPerLayer: () => 2 + Math.floor(Math.random() * 4), // 2-5
            size: { width: 4, height: 4 },
        },
        SMALL: {
            layers: () => 1 + Math.floor(Math.random() * 2), // 1-2
            screwsPerLayer: () => 1,
            size: { width: 2, height: 2 },
        },
    },
};

// =================================================================
// 新数据结构 (New Data Structures)
// =================================================================

class ScrewController {
    constructor(screwId, screwColor = null, isLocked = false) {
        this.screwId = screwId; // 螺丝唯一ID
        this.screwColor = screwColor; // 颜色
        this.isLocked = isLocked; // 是否被锁链锁住

        // 从旧的螺丝对象中继承的属性，以便复用逻辑
        this.group = null;
        this.stage = 0;
        this.id = screwId;
        this.plateId = null; // Maybe map to stateId
        this.componentId = null; // Maybe map to partId
        this.cell = null;
        this.dot = null;
        this.locked = isLocked;
        this.controller = null;
        this.control = null;
        this.controllers = [];
        this.overlay = null;
        this.color = screwColor; // 兼容旧代码
    }

    setScrewColor(screwColor) {
        this.screwColor = screwColor;
        this.color = screwColor;
    }
}

class StateComponentData {
    constructor(controller, stateName, screws = [], isActive = false) {
        this.controller = controller; // 形态/状态控制器对象
        this.stateName = stateName; // 形态/状态名
        this.screws = screws; // 当前形态下的所有螺丝 ScrewController[]
        this.isActive = isActive; // 当前形态是否激活
        this.id = `state-${Math.random().toString(36).substr(2, 9)}`; // Simple unique ID
        this.domElement = null;
    }
}

class PartComponentData {
    constructor(partController, partName, states = [], isActive = false, regionIndex = 0) {
        this.partController = partController; // 部件控制器对象
        this.partName = partName; // 部件名
        this.states = states; // 部件下所有形态 StateComponentData[]
        this.totalScrewCount = states.reduce((sum, state) => sum + state.screws.length, 0); // 螺丝总数
        this.isActive = isActive; // 部件是否激活
        this.isComplete = false; // 新增：部件是否已完成所有状态
        this.regionIndex = regionIndex; // 所属区域索引
        this.id = `part-${Math.random().toString(36).substr(2, 9)}`; // Simple unique ID
        this.activeStateIndex = -1;
        this.area = null; // 占据的棋盘区域
        this.domElements = {};
    }

    getFirstStateScrewCount() {
        const firstState = this.states.find((s) => s.stateName.startsWith('1'));
        return firstState ? firstState.screws.length : this.states.length > 0 ? this.states[0].screws.length : 0;
    }

    getCurrentState() {
        if (this.activeStateIndex >= 0 && this.activeStateIndex < this.states.length) {
            return this.states[this.activeStateIndex];
        }
        return null;
    }
}

class RegionComponentData {
    constructor(regionController, regionName, regionIndex, parts = [], isActive = false) {
        this.regionController = regionController; // 区域控制器对象
        this.regionName = regionName; // 区域名
        this.regionIndex = regionIndex; // 区域索引
        this.parts = parts; // 区域下所有部件 PartComponentData[]
        this.isActive = isActive; // 区域是否激活
        this.id = `region-${regionIndex}`;
        this.isComplete = false; // 该区域是否已完成
        this.area = null; // 新增: 区域在棋盘上的物理范围 {row, col, width, height}
    }
}

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
const AUTO_PLAY_INTERVAL = 150; // 自动点击间隔
let TOTAL_BOXES = 50;
let TOTAL_SCREWS = 150; // Assuming a default value
let MAX_TEMP_SLOTS = 5; // Default, will be overridden

// 全局状态
let regions = [];
let activeRegionIndex = -1;
let nextComponentId = 0;
let currentScrewIndex = 0; // K值曲线指针
let lastRemovedCell = null;

let COLOR_TOTALS = {};
let boxesCompletedCount = 0;

// DOM 元素 & 核心状态变量
const board = document.getElementById('game-board');
let lineLayer = document.getElementById('line-layer');
const tempSlotsContainer = document.getElementById('temp-slots');
let tempSlots = null;
let tempSlotsState = [];
let lockConnections = [];
const screwMap = {};
let nextScrewId = 0;
let boxes = document.querySelectorAll('.box');
const message = document.getElementById('message');
const totalCountEl = document.getElementById('total-count');
const eliminatedCountEl = document.getElementById('eliminated-count');
const progressCountEl = document.getElementById('progress-count');
const remainingCountEl = document.getElementById('remaining-count');
const onboardCountEl = document.getElementById('onboard-count');
const onboardColorCountEl = document.getElementById('onboard-color-count');
const queueCountEl = document.getElementById('queue-count');
const colorStatsEl = document.getElementById('color-stats');
const addTempSlotBtn = document.getElementById('add-temp-slot');
const currentDifficultyEl = document.getElementById('current-difficulty');
const currentDifficultyIndexEl = document.getElementById('current-difficulty-index');
const difficultyCanvas = document.getElementById('difficulty-canvas');

const cellMap = [];
let usedBoxColors = new Set();
const eliminatedScrewIds = new Set();
let hintMessageShown = false;
let lastCompletedColor = null;

// =================================================================
// 核心算法 (Core Algorithms) - K值驱动
// =================================================================

/**
 * [新] 获取当前难度K值
 */
function getCurrentK() {
    const kCurve = gameConfig.K_VALUES;
    if (!kCurve || kCurve.length === 0) return 1; // Default to easy if not configured
    const index = Math.max(0, Math.min(currentScrewIndex, kCurve.length - 1));
    return kCurve[index];
}

/**
 * [重构] 根据K值为新生成的螺丝分配颜色和锁链状态
 */
function setupScrew(screw) {
    if (!screw) return;

    const K = getCurrentK();
    const maxK = 10;
    const kRatio = K / maxK;

    // 1. 颜色分配
    const boxColors = [...new Set([...document.querySelectorAll('.box[data-enabled="true"]')].map((b) => b.dataset.color))];
    const otherColors = COLORS.filter((c) => !boxColors.includes(c));
    const targetColorProb = Math.max(0.2, 1 - kRatio * 0.7);

    let assignedColor;
    if (boxColors.length > 0 && Math.random() < targetColorProb) {
        assignedColor = boxColors[Math.floor(Math.random() * boxColors.length)];
    } else if (otherColors.length > 0) {
        assignedColor = otherColors[Math.floor(Math.random() * otherColors.length)];
    } else {
        assignedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    screw.setScrewColor(assignedColor);

    // 2. 锁链状态分配
    const lockProb = 0.1 + kRatio * 0.8;
    screw.isLocked = Math.random() < lockProb;

    // 推进K值曲线指针
    currentScrewIndex++;
}

/**
 * [重构] 设置锁定关系
 * K值已在 setupScrew 中决定了哪些螺丝要被锁，这里只负责执行连接
 */
function setupLocks(newScrews) {
    if (!newScrews) return;

    const allOnBoardScrews = Object.values(screwMap).filter((s) => s.dot && s.cell);
    const screwsToLock = newScrews.filter((s) => s.isLocked && s.dot); // 确保螺丝在棋盘上

    for (const locked of screwsToLock) {
        const potentialControllers = allOnBoardScrews.filter(
            (c) =>
                c.id !== locked.id &&
                c.componentId !== locked.componentId && // 不能是同一部件的
                !c.control && // 控制器是自由的
                canControl(c, locked)
        );

        if (potentialControllers.length > 0) {
            // 简单点，随机选一个最近的
            potentialControllers.sort((a, b) => {
                const distA = Math.abs(a.cell.dataset.row - locked.cell.dataset.row) + Math.abs(a.cell.dataset.col - locked.cell.dataset.col);
                const distB = Math.abs(b.cell.dataset.row - locked.cell.dataset.row) + Math.abs(b.cell.dataset.col - locked.cell.dataset.col);
                return distA - distB;
            });
            applyLock(potentialControllers[0], locked);
        }
    }
}

/**
 * [重构] 设置盒子颜色，基于K值
 */
function setupBox(box) {
    const onBoardBoxCount = [...document.querySelectorAll('.box[data-enabled="true"][data-color]')].length;
    if (boxesCompletedCount + onBoardBoxCount >= TOTAL_BOXES) {
        box.dataset.enabled = 'false';
        box.classList.remove('enabled');
        box.style.borderColor = '#ccc';
        box.innerHTML = '<div class="hint">无</div>';
        return;
    }

    const onBoardBoxColors = new Set([...document.querySelectorAll('.box[data-enabled="true"][data-color]')].map((b) => b.dataset.color));
    const totalScrewsOnBoard = Object.values(screwMap).filter((s) => s.dot).length;

    let candidateColors;

    // [修复] 为初始化和游戏进行中设置不同的颜色选择逻辑
    if (totalScrewsOnBoard === 0) {
        // --- 初始化阶段 ---
        // 严格地从所有颜色中，选择一个不在场上的
        candidateColors = COLORS.filter((c) => !onBoardBoxColors.has(c));
    } else {
        // --- 游戏进行中阶段 ---
        // 1. 基于场上可用螺丝决定可选颜色
        const onBoardScrews = Object.values(screwMap).filter((s) => s.dot && !s.locked);
        const tempScrews = tempSlotsState.filter((d) => d).map((d) => screwMap[d.dataset.sid]);
        const availableScrews = [...onBoardScrews, ...tempScrews].filter(Boolean);
        const availableScrewColors = [...new Set(availableScrews.map((s) => s.color))];

        // 2. 优先选择不在场上的颜色
        candidateColors = availableScrewColors.filter((c) => !onBoardBoxColors.has(c));

        // 3. 兜底逻辑: 如果所有可用颜色都在场上了，则允许重复
        if (candidateColors.length === 0 && availableScrewColors.length > 0) {
            candidateColors = availableScrewColors;
        }
    }

    // 如果经过所有逻辑判断后，依然没有候选颜色，则不生成盒子
    if (candidateColors.length === 0) {
        box.dataset.enabled = 'false';
        box.classList.remove('enabled');
        box.style.borderColor = '#ccc';
        box.innerHTML = '<div class="hint">无</div>';
        return;
    }

    // K-value weighting logic
    const K = getCurrentK();
    const maxK = 10;
    const kRatio = K / maxK;
    const onBoardUnlockedStats = {};
    COLORS.forEach((c) => (onBoardUnlockedStats[c] = 0));
    Object.values(screwMap).forEach((s) => {
        if (s.dot && !s.locked) {
            if (onBoardUnlockedStats[s.color] !== undefined) {
                onBoardUnlockedStats[s.color]++;
            }
        }
    });
    const totalOnboardScrews = Object.values(onBoardUnlockedStats).reduce((a, b) => a + b, 0);
    const weights = {};
    candidateColors.forEach((color) => {
        const count = onBoardUnlockedStats[color] || 0;
        const weight = count * (1 - kRatio) + (1 / (count + 1)) * totalOnboardScrews * kRatio;
        weights[color] = Math.max(0.1, weight);
    });
    let bestColor = weightedRandom(candidateColors, weights);

    // Anti-repeat logic (for just-completed color)
    if (lastCompletedColor && candidateColors.length > 1 && bestColor === lastCompletedColor) {
        const filteredCandidates = candidateColors.filter((c) => c !== lastCompletedColor);
        if (filteredCandidates.length > 0) {
            bestColor = filteredCandidates[Math.floor(Math.random() * filteredCandidates.length)];
        }
    }
    lastCompletedColor = null;

    // Set box color
    const color = bestColor;
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

// =================================================================
// 游戏主流程 (Game Flow)
// =================================================================

function startGame() {
    // 1. 读取UI配置
    gameConfig.SCREW_COUNT = parseInt(document.getElementById('screw-count-input').value, 10);
    gameConfig.COLOR_COUNT = parseInt(document.getElementById('color-count-input').value, 10);
    gameConfig.MIN_ONBOARD_SCREWS = parseInt(document.getElementById('min-onboard-screws').value, 10);
    MAX_TEMP_SLOTS = parseInt(document.getElementById('temp-count').value, 10);
    COLORS = ALL_COLORS.slice(0, Math.min(gameConfig.COLOR_COUNT, ALL_COLORS.length));
    TOTAL_SCREWS = gameConfig.SCREW_COUNT;
    TOTAL_BOXES = Math.floor(TOTAL_SCREWS / 3);

    // 2. 清理棋盘和状态
    board.innerHTML = '<svg id="line-layer"></svg>';
    lineLayer = document.getElementById('line-layer');
    cellMap.length = 0;
    lockConnections = [];
    usedBoxColors.clear();
    eliminatedScrewIds.clear();
    tempSlotsState = [];
    nextScrewId = 0;
    for (const k in screwMap) delete screwMap[k];
    regions = [];
    activeRegionIndex = -1;
    window.currentScrewIndex = 0;
    COLOR_TOTALS = {};
    COLORS.forEach((c) => (COLOR_TOTALS[c] = 0));
    boxesCompletedCount = 0;

    // 3. 设置游戏环境
    createGrid();
    initTempSlots();

    // 4. 生成关卡数据结构（不带颜色）
    generateLevelData();

    // 5. 初始化螺丝映射表
    initBoardState();

    // 6. 初始化盒子
    initBoxes();

    // 7. 激活第一个区域并生成初始螺丝
    if (regions.length > 0) {
        activeRegionIndex = 0;
        regions[activeRegionIndex].isActive = true;
        console.log(`区域 ${regions[activeRegionIndex].regionName} 已激活`);
    }

    // 8. 检查并补充螺丝至最低数量
    checkAndReplenishScrews();

    // 9. 更新UI
    updateInfo();
    showMessage('');
}

/**
 * [重构] 为关卡生成区域和部件池
 */
function generateLevelData() {
    regions = [];
    nextScrewId = 0;
    let partIdCounter = 0;
    let screwsToGenerate = gameConfig.SCREW_COUNT;
    const { LARGE, MEDIUM, SMALL } = gameConfig.COMPONENT_CONFIG;

    // 创建3个物理区域
    const totalRegions = 3;
    const regionHeight = Math.floor(gameConfig.ROWS / totalRegions);
    for (let i = 0; i < totalRegions; i++) {
        const region = new RegionComponentData(null, `Region-${i}`, i, []);
        region.area = { row: i * regionHeight, col: 0, width: gameConfig.COLS, height: regionHeight };
        regions.push(region);
    }

    const allParts = [];

    const createPart = (config, partType) => {
        const states = [];
        const numLayers = config.layers();
        let totalScrewsInPart = 0;

        for (let i = 0; i < numLayers; i++) {
            const screws = [];
            const numScrews = config.screwsPerLayer();
            for (let j = 0; j < numScrews; j++) {
                if (screwsToGenerate <= 0) break;
                const screw = new ScrewController(nextScrewId++);
                screw.componentId = `part-${partIdCounter}`;
                screws.push(screw);
                screwsToGenerate--;
                totalScrewsInPart++;
            }
            if (screws.length > 0) {
                states.push(new StateComponentData(null, `${i + 1}`, screws));
            }
        }

        if (totalScrewsInPart > 0) {
            const part = new PartComponentData(null, `${partType}-${partIdCounter}`, states, false, 0);
            part.id = `part-${partIdCounter}`;
            partIdCounter++;
            return part;
        }
        return null;
    };

    // 1. 创建所有部件
    const largePart = createPart(LARGE, 'Large');
    if (largePart) allParts.push(largePart);

    const numMediumParts = MEDIUM.count();
    for (let i = 0; i < numMediumParts; i++) {
        if (screwsToGenerate <= 0) break;
        const mediumPart = createPart(MEDIUM, 'Medium');
        if (mediumPart) allParts.push(mediumPart);
    }

    while (screwsToGenerate > 0) {
        const smallPart = createPart(SMALL, 'Small');
        if (smallPart) {
            allParts.push(smallPart);
        } else {
            break;
        }
    }

    // 2. 将部件均匀分配到区域中
    allParts.forEach((part, index) => {
        const regionIndex = index % totalRegions;
        part.regionIndex = regionIndex;
        regions[regionIndex].parts.push(part);
    });
}

function spawnPartState(part, stateIndex) {
    if (!part || stateIndex >= part.states.length) {
        return false;
    }

    const stateToSpawn = part.states[stateIndex];
    const parentRegion = regions[part.regionIndex];

    if (!part.area) {
        // [修复] 根据部件名字判断类型，而不是区域索引
        let partTypeKey = 'SMALL'; // 默认为small
        if (part.partName.startsWith('Large')) {
            partTypeKey = 'LARGE';
        } else if (part.partName.startsWith('Medium')) {
            partTypeKey = 'MEDIUM';
        }

        const partConfig = gameConfig.COMPONENT_CONFIG[partTypeKey];

        const neededWidth = partConfig.size.width;
        const neededHeight = partConfig.size.height;
        let area;
        let foundSpot = false;

        // [修复] 如果父逻辑区域没有物理范围，则默认为整个棋盘
        let regionArea = parentRegion.area;
        if (!regionArea) {
            regionArea = { row: 0, col: 0, width: gameConfig.COLS, height: gameConfig.ROWS };
        }

        if (regionArea.width < neededWidth || regionArea.height < neededHeight) return false;

        const occupiedGridInRegion = Array(gameConfig.ROWS)
            .fill(null)
            .map(() => Array(gameConfig.COLS).fill(false));
        parentRegion.parts.forEach((p) => {
            if (p.isActive && p.area) {
                for (let row = p.area.row; row < p.area.row + p.area.height; row++) {
                    for (let col = p.area.col; col < p.area.col + p.area.width; col++) {
                        if (row < gameConfig.ROWS && col < gameConfig.COLS) occupiedGridInRegion[row][col] = true;
                    }
                }
            }
        });

        for (let attempts = 0; attempts < 100; attempts++) {
            const r = regionArea.row + Math.floor(Math.random() * (regionArea.height - neededHeight + 1));
            const c = regionArea.col + Math.floor(Math.random() * (regionArea.width - neededWidth + 1));

            let canPlace = true;
            for (let y = r; y < r + neededHeight; y++) {
                for (let x = c; x < c + neededWidth; x++) {
                    if (occupiedGridInRegion[y][x]) {
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

        if (!foundSpot) return false;
        part.area = area;
    }

    part.isActive = true;
    part.activeStateIndex = stateIndex;
    stateToSpawn.isActive = true;

    // [核心改动] 为螺丝动态分配颜色和锁定状态
    stateToSpawn.screws.forEach((screw) => {
        setupScrew(screw); // 调用新函数
        // 更新颜色统计
        if (COLOR_TOTALS[screw.color] !== undefined) {
            COLOR_TOTALS[screw.color]++;
        } else {
            COLOR_TOTALS[screw.color] = 1;
        }
    });

    // 4. 渲染到DOM
    // 创建区域和层级指示器 (如果不存在)
    if (!part.domElements.area) {
        const areaDiv = document.createElement('div');
        areaDiv.className = 'component-area';
        Object.assign(areaDiv.style, {
            left: `${part.area.col * 32}px`,
            top: `${part.area.row * 32}px`,
            width: `${part.area.width * 32}px`,
            height: `${part.area.height * 32}px`,
        });
        board.appendChild(areaDiv);
        part.domElements.area = areaDiv;

        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'layer-indicator';
        areaDiv.appendChild(indicatorDiv);
        part.domElements.indicator = indicatorDiv;
    }
    part.domElements.indicator.textContent = `${part.activeStateIndex + 1}/${part.states.length}`;

    const plateOverlay = document.createElement('div');
    plateOverlay.className = 'plate';
    Object.assign(plateOverlay.style, {
        backgroundColor: `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, 0.2)`,
        left: `${part.area.col * 32}px`,
        top: `${part.area.row * 32}px`,
        width: `${part.area.width * 32 - 2}px`,
        height: `${part.area.height * 32 - 2}px`,
        zIndex: 10,
    });
    board.appendChild(plateOverlay);
    stateToSpawn.domElement = plateOverlay;

    const availableCells = [];
    for (let r = part.area.row; r < part.area.row + part.area.height; r++) {
        for (let c = part.area.col; c < part.area.col + part.area.width; c++) {
            if (cellMap[r] && cellMap[r][c] && !cellMap[r][c].dataset.plateId) {
                availableCells.push(cellMap[r][c]);
            }
        }
    }
    // 打乱
    for (let i = availableCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
    }

    for (const screw of stateToSpawn.screws) {
        const cell = availableCells.pop();
        if (!cell) continue;
        screw.cell = cell;
        cell.dataset.plateId = stateToSpawn.id;
        cell.dataset.componentId = part.id;
        screw.dot = spawnDot(screw, cell);
        screw.dot.style.zIndex = 20;
    }

    // [核心改动] 颜色分配完后再设置锁
    setupLocks(stateToSpawn.screws);

    updateInfo();
    return true;
}

function checkAndReplenishScrews() {
    const minOnboard = gameConfig.MIN_ONBOARD_SCREWS;
    let currentOnBoard = Object.values(screwMap).filter((s) => s.dot).length;

    let safetyBreak = 0;
    while (currentOnBoard < minOnboard && safetyBreak < 50) {
        let partToSpawn = null;

        // [修复] 重写部件寻找和区域解锁的逻辑
        // 1. 尝试在当前激活区域找到一个可以生成的部件 (!isActive && !isComplete)
        let currentRegion = regions[activeRegionIndex];
        partToSpawn = currentRegion.parts.find((p) => !p.isActive && !p.isComplete);

        // 2. 如果没找到，说明当前区域已耗尽，尝试解锁并切换到下一个区域
        if (!partToSpawn) {
            currentRegion.isComplete = true;

            // 寻找下一个未完成的区域并激活
            let nextActiveRegionFound = false;
            for (let i = 0; i < regions.length; i++) {
                activeRegionIndex = (activeRegionIndex + 1) % regions.length;
                if (!regions[activeRegionIndex].isComplete) {
                    regions[activeRegionIndex].isActive = true;
                    console.log(`区域 ${regions[activeRegionIndex].regionName} 已激活`);
                    partToSpawn = regions[activeRegionIndex].parts.find((p) => !p.isActive && !p.isComplete);
                    nextActiveRegionFound = true;
                    break;
                }
            }
            // 如果转了一圈都没找到新区域，说明所有区域都完成了
            if (!nextActiveRegionFound) {
                checkVictory();
                break;
            }
        }

        if (partToSpawn) {
            if (spawnPartState(partToSpawn, 0)) {
                currentOnBoard = Object.values(screwMap).filter((s) => s.dot).length;
            } else {
                // 无法生成（比如棋盘满了），标记这个部件为完成，防止死循环
                partToSpawn.isComplete = true;
                partToSpawn.isActive = true; // 标记为激活以避免被重复选择
                break;
            }
        } else {
            // 所有区域的所有部件都已生成
            checkVictory();
            break;
        }
        safetyBreak++;
    }
}

// =================================================================
// 玩家交互与事件 (Player Interaction & Events)
// =================================================================

function handleDotClick(dot) {
    if (dot.dataset.blocked === 'true') return;

    const color = dot.dataset.color;

    // 1. 寻找所有匹配的、有空位的盒子
    const candidateBoxes = [...boxes].filter(
        (box) =>
            box.dataset.enabled === 'true' &&
            box.dataset.color === color &&
            [...box.children].some((el) => el.className === 'slot' && !el.dataset.filled)
    );

    if (candidateBoxes.length > 0) {
        let bestBox = null;
        if (candidateBoxes.length === 1) {
            bestBox = candidateBoxes[0];
        } else {
            // [修复] 使用更健壮的多重条件排序来选择最优盒子
            const dotRect = dot.getBoundingClientRect();
            candidateBoxes.sort((a, b) => {
                const filledA = [...a.children].filter((s) => s.dataset.filled).length;
                const filledB = [...b.children].filter((s) => s.dataset.filled).length;

                // 主要排序条件：填充数量多的优先 (降序)
                if (filledA !== filledB) {
                    return filledB - filledA;
                }

                // 次要排序条件：距离近的优先 (升序)
                const rectA = a.getBoundingClientRect();
                const rectB = b.getBoundingClientRect();
                const distA = Math.hypot(dotRect.x - rectA.x, dotRect.y - rectA.y);
                const distB = Math.hypot(dotRect.x - rectB.x, dotRect.y - rectB.y);
                return distA - distB;
            });
            bestBox = candidateBoxes[0];
        }

        moveScrewToBox(dot, bestBox);
        return;
    }

    const emptyIndex = tempSlotsState.findIndex((s) => s === null);
    if (emptyIndex !== -1) {
        moveScrewToTemp(dot, emptyIndex);
        return;
    }

    showMessage('💥 游戏失败！临时槽已满！');
    disableGame();
}

function moveScrewToBox(dot, box) {
    const screw = screwMap[dot.dataset.sid];
    const fromCell = dot.parentElement;

    // 清理
    cleanupScrew(screw);

    // 放入盒子
    const emptySlot = [...box.children].find((el) => el.className === 'slot' && !el.dataset.filled);
    const newSlot = document.createElement('div');
    newSlot.className = 'slot';
    newSlot.style.backgroundColor = screw.color;
    newSlot.dataset.color = screw.color;
    newSlot.dataset.filled = 'true';
    newSlot.dataset.sid = screw.id;
    emptySlot.replaceWith(newSlot);
    dot.remove();

    lastRemovedCell = fromCell;
    checkAndProcessBoxMatch(box);
    updateInfo();
    checkVictory();
    checkAndReplenishScrews();
}

function moveScrewToTemp(dot, tempIndex) {
    const screw = screwMap[dot.dataset.sid];
    const fromCell = dot.parentElement;

    // 清理
    cleanupScrew(screw);

    // 放入临时槽
    tempSlotsState[tempIndex] = dot;
    renderTempSlots();
    dot.style.position = 'absolute';

    lastRemovedCell = fromCell;
    updateInfo();
    checkVictory();
    checkTempSlotLimit();
    checkAndReplenishScrews();
}

function cleanupScrew(screw) {
    if (!screw) return;
    screw.dot = null;
    if (screw.cell) {
        screw.cell.dataset.plateId = '';
        screw.cell.dataset.componentId = '';
        screw.cell = null;
    }
    // 移除所有与此螺丝相关的锁链
    lockConnections.slice().forEach((conn) => {
        if (conn.controller === screw || conn.locked === screw) {
            removeConnection(conn);
        }
    });
    const part = findPartByScrewId(screw.id);
    if (part) {
        checkStateCompletion(part);
    }
}

// =================================================================
// 辅助函数与工具 (Helpers & Utilities)
// =================================================================

function weightedRandom(items, weights) {
    let totalWeight = 0;
    for (const item of items) {
        totalWeight += weights[item] || 0;
    }

    let random = Math.random() * totalWeight;
    for (const item of items) {
        const weight = weights[item] || 0;
        if (random < weight) {
            return item;
        }
        random -= weight;
    }

    return items[items.length - 1]; // Fallback
}

function createGrid() {
    for (let row = 0; row < gameConfig.ROWS; row++) {
        cellMap[row] = [];
        for (let col = 0; col < gameConfig.COLS; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            board.appendChild(cell);
            cellMap[row][col] = cell;
        }
    }
}

function initBoardState() {
    for (const k in screwMap) delete screwMap[k];
    for (const region of regions) {
        for (const part of region.parts) {
            for (const state of part.states) {
                for (const screw of state.screws) {
                    screwMap[screw.id] = screw;
                }
            }
        }
    }
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

function spawnDot(screw, cell) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.backgroundColor = screw.color;
    dot.dataset.color = screw.color;
    dot.dataset.sid = screw.id;
    dot.dataset.blocked = 'false';
    dot.addEventListener('click', () => handleDotClick(dot));
    cell.appendChild(dot);
    return dot;
}

function findPartByScrewId(screwId) {
    for (const region of regions) {
        for (const part of region.parts) {
            for (const state of part.states) {
                if (state.screws.some((s) => s.id === screwId)) {
                    return part;
                }
            }
        }
    }
    return null;
}

function checkStateCompletion(part) {
    const currentState = part.getCurrentState();
    if (!currentState) return;

    const remainingScrews = currentState.screws.filter((s) => s.dot);

    if (remainingScrews.length === 0) {
        if (currentState.domElement) {
            currentState.domElement.remove();
            currentState.domElement = null;
        }
        currentState.isActive = false;

        const nextStateIndex = part.activeStateIndex + 1;
        if (nextStateIndex < part.states.length) {
            spawnPartState(part, nextStateIndex);
        } else {
            part.isComplete = true;
            part.isActive = false;
            if (part.domElements.area) {
                part.domElements.area.remove();
                part.domElements = {};
            }
            checkAndReplenishScrews();
        }
        checkVictory();
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
            boxesCompletedCount++;

            usedBoxColors.delete(color);
            lastCompletedColor = color;
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
            tempSlotsState[item.index] = null;
            const screw = screwMap[item.dot.dataset.sid];
            cleanupScrew(screw); // Perform full cleanup

            const newSlot = document.createElement('div');
            newSlot.className = 'slot';
            Object.assign(newSlot.dataset, { color: color, filled: 'true', sid: item.dot.dataset.sid });
            newSlot.style.backgroundColor = color;
            emptySlot.replaceWith(newSlot);
            item.dot.remove();
        } else {
            break; // 盒子已满
        }
    }
    renderTempSlots();
    checkAndProcessBoxMatch(box);
}

function initBoxes() {
    usedBoxColors.clear();
    boxes.forEach((box) => {
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
                    setupBox(box);
                    const hintElement = box.querySelector('.hint');
                    if (hintElement) hintElement.remove();
                },
                { once: true }
            );
        }
    });
}

function resetBoxes() {
    const initialBoxStates = Array.from(document.querySelectorAll('.box')).map((b) => b.dataset.enabled === 'true');
    const container = document.querySelector('.boxes');
    container.innerHTML = '';
    initialBoxStates.forEach((enabled) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.dataset.enabled = enabled ? 'true' : 'false';
        container.appendChild(box);
    });
    boxes = document.querySelectorAll('.box');
}

function updateInfo() {
    const onBoardTotal = Object.values(screwMap).filter((s) => s.dot).length;
    const inTempTotal = tempSlotsState.filter((d) => d).length;
    const eliminatedTotal = eliminatedScrewIds.size;
    const remainingTotal = TOTAL_SCREWS - eliminatedTotal;
    const onBoardColors = new Set(
        Object.values(screwMap)
            .filter((s) => s.dot)
            .map((s) => s.color)
    ).size;
    const onBoardBoxes = [...document.querySelectorAll('.box[data-enabled="true"][data-color]')].length;
    const remainingBoxes = TOTAL_BOXES - (boxesCompletedCount + onBoardBoxes);

    totalCountEl.textContent = TOTAL_SCREWS;
    remainingCountEl.textContent = remainingTotal;
    eliminatedCountEl.textContent = eliminatedTotal;
    progressCountEl.textContent = TOTAL_SCREWS > 0 ? `${((eliminatedTotal / TOTAL_SCREWS) * 100).toFixed(2)}%` : '0.00%';
    onboardCountEl.textContent = onBoardTotal;
    queueCountEl.textContent = `槽:${inTempTotal} 剩:${remainingBoxes}`;
    onboardColorCountEl.textContent = onBoardColors;

    colorStatsEl.innerHTML = COLORS.map((c) => {
        const total = COLOR_TOTALS[c] || 0;
        const eliminated = [...eliminatedScrewIds].map((id) => screwMap[id]).filter((s) => s && s.color === c).length;
        return `<div style="color:${c}">${COLOR_NAMES[c]}螺丝:<span>${total - eliminated}</span>/${total}</div>`;
    }).join('');

    updateDifficultyDisplay();
}

/**
 * [新增] 获取一个螺丝的完整解锁链
 * @param {ScrewController} screw - 目标螺丝
 * @returns {ScrewController[]} - 返回需要按顺序移除的螺丝数组
 */
function getChain(screw) {
    const chain = [];
    let current = screw;
    while (current && current.controller) {
        current = current.controller;
        chain.unshift(current);
    }
    return chain;
}

// =================================================================
// 锁链相关函数 (Locking Logic)
// =================================================================

function canControl(controller, target) {
    if (controller.control) return false;
    if (!controller.cell || !target.cell) return false;

    const dist = Math.abs(controller.cell.dataset.row - target.cell.dataset.row) + Math.abs(controller.cell.dataset.col - target.cell.dataset.col);
    if (dist > gameConfig.MAX_INTER_COMPONENT_LOCK_DISTANCE) return false;

    let c = controller;
    let depth = 1;
    while (c) {
        if (c === target) return false;
        c = c.controller;
        depth++;
        if (depth > gameConfig.MAX_CHAIN_LENGTH) return false;
    }
    return true;
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
        lockConnections.push({ controller, locked, line });
    }
    return true;
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

function getDotCenter(dot) {
    const br = board.getBoundingClientRect();
    const dr = dot.getBoundingClientRect();
    return {
        x: dr.left - br.left + dr.width / 2,
        y: dr.top - br.top + dr.height / 2,
    };
}

// =================================================================
// 游戏状态检查 (Game State Checks)
// =================================================================

function disableGame() {
    document.querySelectorAll('.dot').forEach((d) => (d.style.pointerEvents = 'none'));
    boxes.forEach((b) => (b.style.pointerEvents = 'none'));
    stopAutoPlay();
}

function checkVictory() {
    if (eliminatedScrewIds.size === TOTAL_SCREWS) {
        showMessage('🏆 游戏胜利！');
        disableGame();
        return;
    }
}

function checkTempSlotLimit() {
    setTimeout(() => {
        const tempDots = tempSlotsState.filter((d) => d).length;
        if (tempDots >= MAX_TEMP_SLOTS) {
            showMessage('💥 游戏失败！临时槽已满！');
            disableGame();
        }
    }, 100);
}

function showMessage(msg) {
    message.textContent = msg;
}

// =================================================================
// 事件监听与初始化 (Event Listeners & Initialization)
// =================================================================

document.getElementById('reset-btn').addEventListener('click', () => {
    stopAutoPlay();
    startGame();
});

addTempSlotBtn.addEventListener('click', () => {
    MAX_TEMP_SLOTS++;
    tempSlotsState.push(null);
    renderTempSlots();
    updateInfo();
});

// 伪 `stopAutoPlay` 和 `autoPlayTimer`
let autoPlayTimer = null;
function stopAutoPlay() {
    if (autoPlayTimer) clearInterval(autoPlayTimer);
}

// 启动游戏
startGame();

function updateDifficultyDisplay() {
    if (!currentDifficultyEl) return;
    const currentK = getCurrentK();
    currentDifficultyEl.textContent = currentK.toFixed(2);
    currentDifficultyIndexEl.textContent = currentScrewIndex;
    drawKValueChart();
}

function drawKValueChart() {
    if (!difficultyCanvas) return;
    const ctx = difficultyCanvas.getContext('2d');
    const width = difficultyCanvas.width;
    const height = difficultyCanvas.height;
    const kCurve = gameConfig.K_VALUES;
    const maxK = 10;
    const totalScrews = gameConfig.SCREW_COUNT;

    ctx.clearRect(0, 0, width, height);

    // Draw background K-curve
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, height);
    for (let i = 0; i < kCurve.length; i++) {
        const x = (i / (kCurve.length - 1)) * width;
        const y = height - ((kCurve[i] - 1) / (maxK - 1)) * (height - 10) - 5;
        ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw current progress line
    if (totalScrews > 0) {
        const progressRatio = Math.min(currentScrewIndex / totalScrews, 1);
        const x = progressRatio * width;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
}
