const autoBtn = document.getElementById('auto-btn');

function tryClickDot(dot, reason) {
    const screw = screwMap[dot.dataset.sid];
    if (!screw) return false;

    const chain = getChain(screw);
    const clicksNeeded = chain.length + 1;

    // 更智能地判断是否可点击：计算盒子和临时槽的总容量
    let potentialSlots = 0;
    const allScrewsToClick = [...chain, screw];

    // 1. 计算可用的颜色盒子槽位
    const boxSlotCounts = {};
    for (const box of boxes) {
        if (box.dataset.enabled === 'true' && box.dataset.color) {
            if (!boxSlotCounts[box.dataset.color]) {
                boxSlotCounts[box.dataset.color] = 0;
            }
            const freeSlotsInBox = 3 - [...box.children].filter((s) => s.dataset.filled).length;
            boxSlotCounts[box.dataset.color] += freeSlotsInBox;
        }
    }

    for (const s of allScrewsToClick) {
        if (boxSlotCounts[s.color] && boxSlotCounts[s.color] > 0) {
            potentialSlots++;
            boxSlotCounts[s.color]--; // 模拟占用一个槽位
        }
    }

    // 2. 加上可用的临时槽
    const freeTempSlots = tempSlotsState.filter((d) => d === null).length;
    potentialSlots += freeTempSlots;

    if (potentialSlots < clicksNeeded) {
        return false;
    }

    // 检查链上的所有螺丝是否真的在棋盘上
    for (const s of chain) {
        if (!s.dot || s.dot.dataset.blocked === 'true') {
            // 这个判断实际上在getChain的逻辑下有点冗余，因为被锁的才有controller, 但作为安全校验保留
            return false;
        }
    }

    // 按顺序点击解锁链和目标
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
        if (box.dataset.enabled !== 'true') {
            continue;
        }
        const color = box.dataset.color;
        const dots = [...document.querySelectorAll('#game-board .dot')].filter((d) => d.dataset.color === color);
        for (const dot of dots) {
            if (dot.dataset.blocked !== 'true') {
                console.log('当前有匹配盒子颜色，自动点击:', dot.dataset.sid, 'color:', color, dot.dataset.color);
                if (tryClickDot(dot, 'box ' + color)) {
                    return;
                }
            }
        }
    }
    const onBoardTotal = Object.values(screwMap).filter((s) => s.dot).length;
    if (onBoardTotal <= 0) {
        stopAutoPlay();
        return;
    }
    console.log('自动点击失败');
}

function startAutoPlay() {
    if (autoPlayTimer) {
        return;
    }
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

autoBtn.addEventListener('click', () => {
    if (autoPlayTimer) {
        stopAutoPlay();
    } else {
        startAutoPlay();
    }
});
