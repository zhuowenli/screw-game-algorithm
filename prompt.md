# 关键提示词记录

<!-- 优化游戏难度 -->
帮我优化一下每局游戏的难度模式，一开始关卡应该是比较简单的，然后逐步增加难度，引导玩家点击解锁盒子或者解锁插槽从而进行付费行为。

### 阶段1: 正常状态（关卡进度<30%）

- **策略**: 保持基础难度，让玩家熟悉游戏
- **连线倍数**: 1.0x
- **用户感知**: 游戏很好玩，有成就感

### 阶段2: 紧张状态 （关卡进度<50%）

- **策略**: 轻微增加难度，制造轻微压力
- **连线倍数**: 1.2x
- **陷阱连线**: 1.5倍概率
- **用户感知**: 稍微有点难，但还能应付

### 阶段3: 危险状态（关卡进度<70%）

- **策略**: 大幅增加难度，强化付费意愿
- **连线倍数**: 1.5x
- **陷阱连线**: 2倍概率
- **额外连线**: 随机增加1-2条连线
- **用户感知**: 明显困难，开始考虑付费

### 阶段4: 付费引导（关卡进度>70%）

- **触发条件**: 自动检测并触发付费引导
- **引导内容**: 解锁更多盒子/孔位的提示
- **时机**: 玩家感到压力但还未完全绝望时

<!-- 优化游戏玩法 -->
把游戏的玩法重新设计一下，之前板块是随机出现的，现在不按照这种板块层级的方式来设计游戏，改成以部件的形式来展示游戏。

部件类型：
1、大部件：每个部件有5-10层的板块，每个板块上有3-8颗螺丝。
2、中型部件：每个部件有3-5层的板块，每个板块上有2-6颗螺丝。
3、小型部件：每个部件只有1-2层板块，每个板块上只有1 颗螺丝。

部件数量：
1、大部件：游戏中通常有且只有1个大部件。
2、中部件：游戏中通常有4-6个部件
3、小部件：游戏中剩余的螺丝全部用于创建小部件

部件层级：
1、以大部件为例，每个部件固定占一个区域，也就是板块所在的位置都是这个部件的区域。
2、每层部件的左上角有个编号，标识当前所处的层级是第几层。
3、解锁部件层级后，只会在当前区域继续生成新螺丝，并且改变层级标识，不会跳到其他地方。

其他规则：
1、当螺丝数量小于最低的15颗螺丝时，会产生新的中小型部件，保证螺丝的最低数量。

<!-- 调整游戏算法 -->
这个游戏的数据结构帮我调整下：

1、首先游戏会增加区域的概念：游戏场景分为多个区域，每个区域包含多个组件（模型），每个组件可能有一种或多种部件形态，每个形态上有多个螺丝孔位，在这些孔位上会插入螺丝。

然后初始化关卡的时候，假设这一关有5个区域，那么会从区域1开始显示，然后我们现在配置了场上最小螺丝数比如15，我们就需要在区域1里的所有部件的状态1的螺丝数里，找到一个最佳组合可以满足场上最小螺丝数15，然后让这些部件显示出来。

当区域1的没有新的组件可以解锁，且螺丝数小于15的时候，开始解锁区域2，以此类推。

区域、组件、部件、螺丝的数据结构改下以下这种。

// 区域 RegionComponentData
class RegionComponentData {
  constructor(regionController, regionName, regionIndex, parts = [], isActive = true) {
    this.regionController = regionController; // 区域控制器对象
    this.regionName = regionName;             // 区域名
    this.regionIndex = regionIndex;           // 区域索引
    this.parts = parts;                       // 区域下所有部件 PartComponentData[]
    this.isActive = isActive;                 // 区域是否激活
  }
}

// 部件 PartComponentData
class PartComponentData {
  constructor(partController, partName, states = [], totalScrewCount = 0, isActive = true, regionIndex = 0) {
    this.partController = partController;     // 部件控制器对象
    this.partName = partName;                 // 部件名
    this.states = states;                     // 部件下所有形态 StateComponentData[]
    this.totalScrewCount = totalScrewCount;   // 螺丝总数
    this.isActive = isActive;                 // 部件是否激活
    this.regionIndex = regionIndex;           // 所属区域索引
  }

  getFirstStateScrewCount() {
    const firstState = this.states.find(s => s.stateName.startsWith("1"));
    return firstState ? firstState.screws.length : (this.states.length > 0 ? this.states[0].screws.length : 0);
  }
}

// 形态/状态 StateComponentData
class StateComponentData {
  constructor(controller, stateName, screws = [], isActive = true) {
    this.controller = controller;     // 形态/状态控制器对象
    this.stateName = stateName;       // 形态/状态名
    this.screws = screws;             // 当前形态下的所有螺丝 ScrewController[]
    this.isActive = isActive;         // 当前形态是否激活
  }
}

// 螺丝 ScrewController
class ScrewController {
  constructor(screwId, screwColor, isLocked = false) {
    this.screwId = screwId;             // 螺丝唯一ID
    this.screwColor = screwColor;  // 颜色
    this.isLocked = isLocked;          // 是否被锁链锁住
    // 其他螺丝属性可自行补充
  }

  public setScrewColor(screwColor) {
    this.screwColor = screwColor;
  }
}

2、螺丝的初始化的生成算法调整：
之前是根据盒子总数来分配颜色并生成对应的螺丝，然后再插入组件中。现在要改成组件生成的时候，先不分配螺丝颜色。只有在组件形态要显示出来的时候，再动态分配颜色。

也就是初始化的时候，每个区域、每个组件里面的螺丝还是得先固定下来。至于螺丝颜色等形态解锁的时候，再动态分配。

3、增加一个方法，setupScrew，每次部件形态解锁的时候，要给里面的螺丝上色或者上锁链，通过这个方法来进行。

<!-- 优化算法 -->
把游戏的生成算法重构一下，移除之前所有的难度算法，改成新的难度控制系数 K，来控制难度。

螺丝生成算法：

1. 定义一个难度控制系数：K
2. 每一个关卡的K值可以由策划配置，K值应该是一条曲线，存储在一个数组中，K值的X轴是控制每一颗螺丝出现的难度。
3. K值越大游戏难度越高、K值越小游戏难度越简单。
4. 提示游戏难度的方式：
 a. 盒子：盒子颜色跟场上的螺丝颜色不匹配。当无法满足消除条件，玩家需要解锁新的组件才生成新螺丝，这种情况下难度特别高。当盒子的颜色，场上匹配的螺丝数量越多，越简单。
 b. 螺丝：目标螺丝被锁链锁住，需要拔除该锁链的控制螺丝进入插槽，需要操作的步数越多难度越高。
 c. 插槽：插槽越满，难度越高。例如只剩一格临时插槽，那么玩家就得保证每一步操作都不能出错，不然就会导致游戏失败。
5. 当玩家通过广告付费，可以适当降低K值，然后再逐步恢复到对应的难度。

关卡配置内容：
1、螺丝数：例如 150
2、关卡颜色数：例如 7
3、场上最少螺丝数：例如15
4、关卡K值：1-10的数组，例如 [1,1,1,2,1,1,1,2,1,3,4,5,2,2,4,5,2,3,2,4,6,4,5,7,8.9,...]

⸻

螺丝消除游戏 K 值难度关联算法文档

⸻

一、K 值含义与作用
 • K 值：关卡难度的主控参数，常规取值范围 1~10（可扩展）。
 • K 值越大，关卡难度越高，对应于：目标颜色螺丝稀缺、杂色多、锁链多、解锁步骤复杂、插槽易爆满等。
 • K 值越小，则目标颜色螺丝多、操作简单、解锁容易。

K 值的主要目标是数据驱动地控制“局面紧张程度”和“关键资源可用性”，让关卡难度可线性调节和曲线调节。

⸻

二、K 值与 setupBox 算法（生成盒子颜色）

1. 目标
 • 决定下一个生成盒子的颜色，使其难度和K值挂钩。
 • 控制“目标颜色”和“场上实际可拔出螺丝数量”的关系。

2. 算法核心思路
1. 收集当前场上每种颜色可用（未锁、可拔）螺丝数量。
2. 根据 K 值调整新盒子颜色选择的策略：
 • K 小（简单）： 优先选择场上可用螺丝多的颜色。
 • K 大（困难）： 增加“冷门颜色”被选中的概率，让盒子经常要求场上稀有螺丝，提升操作难度。

3. 算法实现（伪代码）

function setupBox(K, sceneScrewCountDict, availableColors) {
  // sceneScrewCountDict: { "red": 6, "blue": 2, "yellow": 1, ... }
  // availableColors: ["red", "blue", "yellow", ...]
  // K: 1（简单）~10（困难）

  // 1. 计算每种颜色的场上可用数量（N）
  // 2. 计算每种颜色的选择权重
  //    权重 = 可用数量权重 *(1-K归一化) + 稀缺惩罚* K归一化

  const totalScrews = Object.values(sceneScrewCountDict).reduce((a, b) => a + b, 0);
  const maxK = 10;
  const kRatio = K / maxK; // 0~1

  // 生成权重：K值越高，目标颜色越稀缺
  const weights = availableColors.map(color => {
    const count = sceneScrewCountDict[color] || 0;
    // 可用多时简单，K大则稀缺权重提升
    // 公式可微调
    return Math.max(
      1,
      count *(1 - kRatio) + (1 / (count + 1))* totalScrews * kRatio
    );
  });

  // 3. 根据权重随机选一个颜色
  const selectedColor = weightedRandomPick(availableColors, weights);
  return selectedColor;
}

说明：
 • K 越大，权重算法倾向于选择场上数量更少（稀缺）的颜色。
 • 你也可以设置一个“最小可用数量阈值”，避免绝对死局（如场上无该颜色时可强制规避）。

⸻

三、K 值与 setupScrew 算法（生成新螺丝颜色和锁链状态）

1. 目标
 • 动态分配新生成螺丝的颜色和锁链状态，难度随 K 值调整。
 • K 值高时，目标颜色螺丝少且更易上锁，杂色更多。

2. 算法核心思路
 • 颜色分配：K 值越大，目标颜色比例越低、杂色比例越高。
 • 锁链概率：K 值越大，锁链螺丝比例越高，甚至可提升锁链层数。

3. 颜色与锁链生成公式（伪代码）

function setupScrew(K, boxColors, allColors) {
  // boxColors: 当前所有盒子目标颜色（如["red", "blue"]）
  // allColors: 游戏所有可用颜色
  const maxK = 10;
  const kRatio = K / maxK; // 0~1

  // 目标颜色概率（K 小时多，K 大时少）
  const targetColorProb = Math.max(0.2, 1 - kRatio * 0.7); // 最低20%
  const otherColorProb = (1 - targetColorProb) / (allColors.length - boxColors.length);

  // 随机决定颜色
  let color;
  if (Math.random() < targetColorProb) {
    color = randomPick(boxColors);
  } else {
    color = randomPick(allColors.filter(c => !boxColors.includes(c)));
  }

  // 锁链概率（K 小时极少，K 大时极高）
  const lockProb = 0.1 + kRatio * 0.8; // 10% ~ 90%
  const isLocked = Math.random() < lockProb;

  // 如果要做多层锁链，可以设置锁链层数 = 1 + Math.floor(kRatio * MaxLockLayer)
  return { color, isLocked };
}

⸻

四、结合场上信息的动态自适应
 • K值只是一部分，实际生成时可引入更多实时信息：
 • 比如：如果某颜色场上/插槽/临时区螺丝接近为零，则可降低生成死局概率或动态下调K值影响权重，避免让玩家无解。
 • 可以根据连续失败、关卡进度等，临时调整K值（降低难度）。

⸻

五、应用建议

 1. K 值通过配置表/曲线灵活配置到每一关、每一批生成、每个阶段。
 2. setupBox、setupScrew 接口都接收当前 K 值，场上实时螺丝分布、盒子颜色，进行动态决策。
 3. 所有概率公式都可在实际测试时做调整，支持多种曲线形态（如前松后紧、波浪式难度等）。
 4. 算法支持热更新和在线A/B测试，只需调一条 K 曲线即可全局控制关卡难度。

⸻

六、主要公式总结

场景 公式关键逻辑
setupBox 权重 = 场上目标颜色数量 *(1-K归一化) + 稀缺惩罚* K归一化
setupScrew 目标颜色概率 = max(0.2, 1-K归一化×0.7)
 锁链概率 = 0.1 + K归一化×0.8
