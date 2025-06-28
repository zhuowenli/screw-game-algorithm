// =================================================================
// [NEW] 动态颜色分配系统 (Dynamic Color Allocation System)
// 负责游戏中所有动态颜色决策，将算法与游戏主逻辑解耦
// =================================================================

class AllocationInput {
    constructor() {
        /** @type {OnFieldScrewInfo[]} 当前在场螺丝信息 (包含无色螺丝) */
        this.currentOnFieldScrews = [];
        /** @type {ColorBoxInfo[]} 颜色盒子状态 (包含无色盒子) */
        this.colorBoxes = [];
        /** @type {TemporarySlotInfo[]} 临时槽位状态 */
        this.temporarySlots = [];
        /** @type {number} 当前难度K值 (0-1) */
        this.difficultyK = 0;
        /** @type {string[]} 关卡中所有可用颜色 */
        this.allAvailableColors = [];
        /** @type {number} 关卡总螺丝数 */
        this.totalScrewCount = 0;
        /** @type {number} 已消除螺丝数 */
        this.eliminatedScrewCount = 0;
    }
}

class OnFieldScrewInfo {
    constructor(screwId, color = null, componentId = null, isLocked = false) {
        this.screwId = screwId;
        this.color = color;
        this.componentId = componentId;
        this.isLocked = isLocked;
    }
}

class ColorBoxInfo {
    constructor(boxId, color = null, isEnabled = false, isAdunlocked = false) {
        this.boxId = boxId;
        this.color = color;
        this.isAdunlocked = isAdunlocked;
        this.isEnabled = isEnabled;
        /** @type {BoxSlotInfo[]} */
        this.slots = [];
    }
}

class BoxSlotInfo {
    constructor(slotId, isOccupied = false, screwId = null) {
        this.slotId = slotId;
        this.isOccupied = isOccupied;
        this.screwId = screwId;
    }
}

class TemporarySlotInfo {
    constructor(slotId, isOccupied = false, screwId = null, color = null) {
        this.slotId = slotId;
        this.isOccupied = isOccupied;
        this.screwId = screwId;
        this.color = color;
    }
}

class AllocationOutput {
    constructor() {
        /** @type {ScrewColorAssignment[]} */
        this.screwColorAssignments = [];
        /** @type {BoxColorAssignment[]} */
        this.boxColorAssignments = [];
    }
}

class ScrewColorAssignment {
    constructor(screwId, assignedColor) {
        this.screwId = screwId;
        this.assignedColor = assignedColor;
    }
}

class BoxColorAssignment {
    constructor(boxId, assignedColor) {
        this.boxId = boxId;
        this.assignedColor = assignedColor;
    }
}

class DynamicColorAllocationSystem {
    executeAllocation(input) {
        console.log('输入：', input);
        const output = new AllocationOutput();

        // [新增] 终局判断
        const remainingScrewsInLevel = input.totalScrewCount - input.eliminatedScrewCount;
        const isEndGame = remainingScrewsInLevel < 15;

        // [修复] 决策流程改为单向，先决定盒子颜色
        const boxesToAssign = input.colorBoxes.filter((b) => b.isEnabled && !b.color);
        if (boxesToAssign.length > 0) {
            this._assignBoxColors(input, boxesToAssign, output, isEndGame);
        }

        // 然后根据已决定的盒子颜色，来决策螺丝颜色
        const screwsToAssign = input.currentOnFieldScrews.filter((s) => !s.color);
        if (screwsToAssign.length > 0) {
            this._assignScrewColors(input, screwsToAssign, output, isEndGame);
        }

        console.log('输出：', output);

        return output;
    }

    _assignScrewColors(input, screwsToAssign, output, isEndGame) {
        if (isEndGame) {
            // --- 终局收官模式 ---
            console.log('--- [Endgame] Screw Color Assignment ---');

            // 1. 最高优先级：找出能直接帮助三消的颜色 (盒子里已有1或2个)
            const boxCompletionColors = new Set();
            for (const box of input.colorBoxes) {
                if (box.isEnabled && box.color) {
                    const filledSlots = box.slots.filter((s) => s.isOccupied).length;
                    if (filledSlots > 0 && filledSlots < 3) {
                        boxCompletionColors.add(box.color);
                    }
                }
            }

            // 2. 次要优先级：找出场上不成套的颜色，帮玩家凑齐3个
            const onBoardScrewCounts = {};
            input.allAvailableColors.forEach((c) => (onBoardScrewCounts[c] = 0));
            input.currentOnFieldScrews.forEach((s) => {
                if (s.color) onBoardScrewCounts[s.color]++;
            });
            const fieldReplenishColors = [];
            for (const color in onBoardScrewCounts) {
                if (onBoardScrewCounts[color] > 0 && onBoardScrewCounts[color] % 3 !== 0) {
                    fieldReplenishColors.push(color);
                }
            }

            // 3. 合并优先级列表 (Set确保了boxCompletionColors的独一无二)
            const priorityEndgameColors = [...boxCompletionColors, ...fieldReplenishColors.filter((c) => !boxCompletionColors.has(c))];

            if (priorityEndgameColors.length > 0) {
                for (const screw of screwsToAssign) {
                    const assignedColor = priorityEndgameColors[Math.floor(Math.random() * priorityEndgameColors.length)];
                    console.log(`[Endgame] Prioritized color: ${assignedColor}`);
                    output.screwColorAssignments.push(new ScrewColorAssignment(screw.screwId, assignedColor));
                }
                return; // 终局模式下，分配完优先颜色后即返回
            }
        }

        // --- 常规模式 ---
        const K = input.difficultyK;

        // 直接读取 output 中已确定的盒子颜色，不再模拟
        const assignedBoxColors = new Set(output.boxColorAssignments.map((a) => a.assignedColor));
        const existingBoxColors = new Set(input.colorBoxes.filter((b) => b.isEnabled && b.color).map((b) => b.color));
        const boxColors = [...new Set([...assignedBoxColors, ...existingBoxColors])];

        const otherColors = input.allAvailableColors.filter((c) => !boxColors.includes(c));

        // [核心修改] 根据场上螺丝情况，动态调整颜色生成策略
        const onBoardScrewCounts = {};
        input.allAvailableColors.forEach((c) => (onBoardScrewCounts[c] = 0));
        input.currentOnFieldScrews
            .filter((s) => s.color)
            .forEach((s) => {
                onBoardScrewCounts[s.color]++;
            });

        // 1. 动态调整基础概率：场上目标颜色螺丝占比越高，就越倾向于出其他颜色
        const baseTargetColorProb = 1 - K * 0.8;
        const targetColorScrewCount = boxColors.reduce((sum, color) => sum + (onBoardScrewCounts[color] || 0), 0);
        const totalOnBoardScrews = input.currentOnFieldScrews.filter((s) => s.color).length;
        const targetRatio = totalOnBoardScrews > 0 ? targetColorScrewCount / totalOnBoardScrews : 0;
        const targetColorProb = baseTargetColorProb * (1 - targetRatio * 0.8); // 乘0.8作为调节因子，避免降得过快

        console.log('baseTargetColorProb', baseTargetColorProb);
        console.log('targetColorProb', targetColorProb);

        for (const screw of screwsToAssign) {
            let assignedColor;
            if (boxColors.length > 0 && Math.random() < targetColorProb) {
                // 2. 加权选择目标颜色：优先出场上数量少的颜色
                const weights = {};
                boxColors.forEach((color) => {
                    const count = onBoardScrewCounts[color] || 0;
                    weights[color] = 1 / (count + 1); // 权重与数量成反比
                });
                assignedColor = this._weightedRandom(boxColors, weights);
            } else if (otherColors.length > 0) {
                assignedColor = otherColors[Math.floor(Math.random() * otherColors.length)];
            } else {
                assignedColor = input.allAvailableColors[Math.floor(Math.random() * input.allAvailableColors.length)];
            }
            output.screwColorAssignments.push(new ScrewColorAssignment(screw.screwId, assignedColor));

            // 更新计数，以便影响下一个螺丝的分配
            onBoardScrewCounts[assignedColor]++;
        }
    }

    _weightedRandom(items, weights) {
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

    _assignBoxColors(input, boxesToAssign, output, isEndGame) {
        // --- 1. 初始化状态 ---
        const existingBoxColors = new Set(input.colorBoxes.filter((b) => b.isEnabled && b.color).map((b) => b.color));
        const onBoardScrews = input.currentOnFieldScrews.filter((s) => s.color && !s.isLocked);
        const tempScrews = input.temporarySlots.filter((s) => s.isOccupied);

        // 这是所有理论上可用的颜色池
        let masterColorPool = [...new Set([...onBoardScrews, ...tempScrews].map((s) => s.color))];
        if (masterColorPool.length === 0) {
            masterColorPool = [...input.allAvailableColors]; // 开局时，从所有颜色里选
        }

        // --- [新增] 终局模式判断 ---
        if (isEndGame) {
            const onBoardScrewCounts = {};
            masterColorPool.forEach((c) => (onBoardScrewCounts[c] = 0));
            onBoardScrews.forEach((s) => {
                if (s.color) onBoardScrewCounts[s.color]++;
            });

            let bestColorForEndGame = null;
            let maxCount = 0;
            // 优先选择数量 >=3 的，其次是 >=2 的，以此类推
            for (let targetCount = 3; targetCount >= 1; targetCount--) {
                for (const color in onBoardScrewCounts) {
                    if (onBoardScrewCounts[color] >= targetCount && onBoardScrewCounts[color] > maxCount) {
                        // 同时要确保这个颜色的盒子不在场上
                        if (!existingBoxColors.has(color)) {
                            bestColorForEndGame = color;
                            maxCount = onBoardScrewCounts[color];
                        }
                    }
                }
                if (bestColorForEndGame) break;
            }

            if (bestColorForEndGame) {
                for (const boxInfo of boxesToAssign) {
                    // 终局时，所有新盒子都出最需要的颜色
                    output.boxColorAssignments.push(new BoxColorAssignment(boxInfo.boxId, bestColorForEndGame));
                }
                return;
            }
        }

        // --- 2. 常规模式 ---
        const remainingOnFieldScrews = input.currentOnFieldScrews.filter((s) => s.color).length;
        const allowDuplicate = !isEndGame ? false : remainingOnFieldScrews < 15 && remainingOnFieldScrews > 1;

        const assignedColorsInThisBatch = new Set();

        for (const boxInfo of boxesToAssign) {
            // a. 计算当前所有禁用的颜色
            const forbiddenColors = new Set([...existingBoxColors, ...assignedColorsInThisBatch]);

            // b. 生成候选颜色列表
            let candidateColors;
            if (allowDuplicate) {
                candidateColors = [...masterColorPool]; // 允许重复时，候选是所有颜色
            } else {
                candidateColors = masterColorPool.filter((c) => !forbiddenColors.has(c));
            }

            // c. 死锁兜底：如果严格不重复导致没颜色可选，必须放开限制
            if (candidateColors.length === 0 && masterColorPool.length > 0) {
                candidateColors = [...masterColorPool];
            }

            // 如果最终还是没有候选颜色，无法为这个盒子分配
            if (candidateColors.length === 0) {
                continue;
            }

            // d. 特殊逻辑：广告解锁的盒子
            if (boxInfo.isAdunlocked) {
                let adColor = input.temporarySlots.find((s) => s.isOccupied)?.color;
                if (!adColor) {
                    adColor =
                        masterColorPool.length > 0
                            ? masterColorPool[Math.floor(Math.random() * masterColorPool.length)]
                            : input.allAvailableColors[0];
                }
                output.boxColorAssignments.push(new BoxColorAssignment(boxInfo.boxId, adColor));
                assignedColorsInThisBatch.add(adColor);
                continue; // 处理完这个盒子，进入下一个
            }

            // e. K值加权，选出最佳颜色
            const K = input.difficultyK;
            const onBoardUnlockedStats = {};
            input.allAvailableColors.forEach((c) => (onBoardUnlockedStats[c] = 0));
            onBoardScrews.forEach((s) => {
                if (onBoardUnlockedStats[s.color] !== undefined) {
                    onBoardUnlockedStats[s.color]++;
                }
            });

            const totalOnboardUnlockedScrews = Object.values(onBoardUnlockedStats).reduce((a, b) => a + b, 0);
            const weights = {};
            candidateColors.forEach((color) => {
                const count = onBoardUnlockedStats[color] || 0;
                const weight = count * (1 - K) + (1 / (count + 1)) * totalOnboardUnlockedScrews * K;
                weights[color] = Math.max(0.1, weight);
            });

            let bestColor = this._weightedRandom(candidateColors, weights);

            // f. 应用决策并更新状态，为下一个盒子做准备
            output.boxColorAssignments.push(new BoxColorAssignment(boxInfo.boxId, bestColor));
            assignedColorsInThisBatch.add(bestColor);
        }
    }
}
