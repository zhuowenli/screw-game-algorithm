const autoBtn = document.getElementById('auto-btn');

function tryClickDot(dot, reason) {
    const screw = screwMap[dot.dataset.sid];
    const chain = getChain(screw);
    const free = tempSlotsState.filter((d) => d === null).length;
    if (free < chain.length) {
        return false;
    }
    for (const s of chain) {
        if (!s.dot || s.dot.dataset.blocked === 'true') {
            return false;
        }
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

    let bestPlate = null;
    let bestDots = null;
    let bestCount = Infinity;
    const freeSlots = tempSlotsState.filter((d) => d === null).length;
    for (const plate of activePlates) {
        const dots = plate.screws.map((s) => s.dot).filter(Boolean);
        if (dots.length === 0) {
            continue;
        }
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
                if (tryClickDot(dot, 'min plate ' + bestCount)) {
                    return;
                }
            }
        }
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
