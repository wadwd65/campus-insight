/**
 * 行动地图 —— 地点数据。
 *
 * 这是方向 6 的「采集界面」本体：问卷是**一次性**的（答完就没了），
 * 地图是**可反复**的（同一个地点可以再去，但第二次的增量衰减）。
 * 两者写进同一本账（useGameStore.applyChoice），所以档案页不关心数据从哪来。
 *
 * 设计约束（继承自问卷矩阵的三条）：
 *   1. 每个地点是一个 8 维增量向量，允许负数 —— 「宿舍躺平」不是"什么都不做"，
 *      它明确地给 night +2 / academic -1，这样地点之间才有取舍。
 *   2. 增量的量级比问卷大（问卷选项是个位数，地点是 2~5），
 *      因为地图是刻意设计成"玩几下就能看出形状"的。
 *   3. 地点之间要有**互斥的稀缺性**：一次行动只能花掉一个时段，
 *      所以「图书馆」和「操场」是竞争关系，不是叠加关系。
 *
 * ⚠️ 这里的地点**不进 matrix.json**。理由：matrix.json 是问卷契约，
 * 与 Python 生成端共享（基准人群 CSV 的列必须与它对齐）。
 * 地图数据前端独用，塞进去会让生成端多出 8 个它不需要的题。
 */

/**
 * 一天有四个时段。行动消耗时段，时段用完这一天就过去了。
 * 这是地图的"约束"来源 —— 没有约束，玩家会把所有地点都点一遍，形状就失去意义。
 */
export const SLOTS_PER_DAY = 4;

/**
 * 地点。
 *
 * 字段：
 *   id       唯一键，进账本的 flags
 *   name     显示名
 *   zone     所属区域（决定在地图的哪一片）
 *   line     一句话氛围描写 —— 这是"游戏层"，不参与计算
 *   cost     消耗几个时段（重的行动花 2 个）
 *   once     是否只能去一次（一次性事件类地点）
 *   vec      8 维增量，键名与 matrix.json 的 attributes 一致
 */
export const PLACES = [
  {
    id: 'library',
    name: '图书馆',
    zone: 'north',
    line: '第三自习室的灯永远亮着，靠窗那排有插座。',
    cost: 1,
    vec: { academic: 4, plan: 2, night: -1, sport: -1, social: -1 },
  },
  {
    id: 'lab',
    name: '实验楼',
    zone: 'north',
    line: '编译到凌晨三点，报错信息比论文还长。',
    cost: 1,
    vec: { academic: 3, novelty: 2, resilience: 1, social: -1 },
  },
  {
    id: 'late_class',
    name: '阶梯教室',
    zone: 'north',
    line: '早八的空调坏了，后排趴倒一片。',
    cost: 1,
    vec: { academic: 2, resilience: 1, night: -2, plan: 1 },
  },
  {
    id: 'court',
    name: '操场',
    zone: 'east',
    line: '跑道上有人在拉单杠，有人在等天黑。',
    cost: 1,
    vec: { sport: 4, resilience: 2, social: 1, night: -1 },
  },
  {
    id: 'gym',
    name: '体育馆',
    zone: 'east',
    line: '羽毛球场地要提前一周抢。',
    cost: 1,
    vec: { sport: 3, social: 2, plan: 1 },
  },
  {
    id: 'field',
    name: '足球场',
    zone: 'east',
    line: '傍晚六点到八点，球门边永远有人。',
    cost: 1,
    vec: { sport: 3, social: 3, resilience: 1, academic: -1 },
  },
  {
    id: 'canteen',
    name: '食堂',
    zone: 'south',
    line: '二楼那个窗口的阿姨会多给一勺。',
    cost: 1,
    vec: { food: 4, social: 2, novelty: 1 },
  },
  {
    id: 'nightmarket',
    name: '小吃街',
    zone: 'south',
    line: '十一点后才开的那家烧烤，塑料凳子坐不满。',
    cost: 1,
    vec: { food: 3, social: 3, night: 2, plan: -2, academic: -1 },
  },
  {
    id: 'convenience',
    name: '便利店',
    zone: 'south',
    line: '凌晨的关东煮和热咖啡，是一个人也能吃的那种热闹。',
    cost: 1,
    vec: { food: 2, night: 2, resilience: 1, academic: -1 },
  },
  {
    id: 'dorm',
    name: '宿舍',
    zone: 'west',
    line: '上铺的被子没叠过，下铺在打游戏。',
    cost: 1,
    vec: { night: 2, social: 1, academic: -2, sport: -1, plan: -1 },
  },
  {
    id: 'rooftop',
    name: '天台',
    zone: 'west',
    line: '门锁坏了很多年，谁都知道怎么推开。',
    cost: 1,
    vec: { resilience: 3, novelty: 2, social: -1, plan: -1 },
  },
  {
    id: 'club',
    name: '社团活动室',
    zone: 'west',
    line: '墙上贴着十年前的话剧海报。',
    cost: 1,
    vec: { social: 4, novelty: 2, plan: 1 },
  },
  {
    id: 'printshop',
    name: '打印店',
    zone: 'south',
    line: '老板娘记得你论文封面的颜色。',
    cost: 1,
    vec: { academic: 2, plan: 2, resilience: 1 },
  },
  {
    id: 'lake',
    name: '湖边',
    zone: 'east',
    line: '有人在背书，有人在喂鸭子，互不打扰。',
    cost: 1,
    vec: { resilience: 2, academic: 1, social: -1, novelty: 1 },
  },
  {
    id: 'station',
    name: '校门口车站',
    zone: 'west',
    line: '末班车 22:40，赶不上就得走回来。',
    cost: 2,
    vec: { novelty: 4, social: 2, plan: -1, night: 1 },
  },
  {
    id: 'intern',
    name: '实习公司',
    zone: 'west',
    line: '工位上贴着一张"再坚持一下"。',
    cost: 2,
    vec: { academic: 2, resilience: 3, plan: 2, social: 1, sport: -1 },
  },
];

/** 四个区域，用于地图分区与配色。 */
export const ZONES = [
  { key: 'north', label: '北区 · 教学', hint: '课表上最常出现的地方' },
  { key: 'east', label: '东区 · 运动', hint: '流汗和散步都算' },
  { key: 'south', label: '南区 · 生活', hint: '一天里最放松的两小时' },
  { key: 'west', label: '西区 · 自由', hint: '不属于任何课表的地方' },
];

/** id → 地点，避免每次渲染都 find。 */
export const PLACE_INDEX = new Map(PLACES.map((p) => [p.id, p]));

/** 取某区域的全部地点。 */
export function placesInZone(zone) {
  return PLACES.filter((p) => p.zone === zone);
}
