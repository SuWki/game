export const realms = ["锻骨", "舒筋", "贯劲", "听息", "心斋", "坐忘"] as const;
export const bridgeRegion = 3;
export const courierRegion = 4;
export const watchRegion = 5;
export const cliffRegion = 6;
export const heartRealm = 4;
export const heartDao = 1430;
export const stillRealm = 5;
export const stillDao = 3600;
export const windDao = 4600;
export const windSurveyDao = 720;
export const mountainFirstReward = 6;
export const trials = {
  ferryTrial: {
    name: "回灯过渡", region: 1, hp: 238, wave: 2, target: 2, counter: "护灯",
    goal: "护住两次回浪，再斩退河伯。", hint: "守式割缆能护灯断水。听潮步可在第 2、5、8… 回合避浪护灯，避浪时水位仍会涨。",
    opening: "末班渡船载着两盏归家的灯。陆婆把篙交给阿照，自己俯身护住灯芯。",
    ending: "两点灯火一前一后上了岸。陆婆这才放下篙，朝对岸喊了一声：明早照旧开船。",
  },
  templeTrial: {
    name: "烛下还名", region: 2, hp: 220, wave: 3, target: 3, counter: "连中真身",
    goal: "连续三回合出刀命中真身，斩退娘娘。全程不得触发纸面反噬。", hint: "守式挑灯能照出连续三回合真身。带照影时，阿照也会靠神通显形，并在照影没覆盖时挑灯。",
    opening: "最后三块木牌摆在灯下。石生求阿照守住这簇火，让失名的人一个个应声。",
    ending: "第三个名字落笔时，庙门外有人应了一声。石生把余蜡裹好，留作明年的灯。",
  },
} as const;
export type TrialId = keyof typeof trials;
export const trialIds = Object.keys(trials) as TrialId[];
export const trialRounds = 16;
export const trialSand = 8;
export const breakthrough = [
  { gift: "开启身法位。基础退步本身就能在第 1、4、7… 回合闪避第一道浪。", verse: "起如山鸟，落似老熊。" },
  { gift: "成功架住重击后反击 6 点。", verse: "一箭入石，满弓余声未歇。" },
  { gift: "开启神通位。每逢第 3、6、9… 回合自然辨出真身。", verse: "芦花无风动，水底有呼吸。" },
  { gift: "再开启一个武学位。两门武学同回合出手时，可调换先后。", verse: "听见铃声落下，才知桥上风静。" },
] as const;

export const arts = [
  { name: "镇山喝", first: 3, every: 3, kind: "武学", cost: 30, description: "第 3、6、9… 回合出招，伤害 5，截断当回合可打断的重击。", mastery: "截断成功时追加 12 点伤害。", realm: 0 },
  { name: "听潮步", first: 2, every: 3, kind: "身法", cost: 60, description: "第 2、5、8… 回合踏步，闪避当回合敌方攻击。", mastery: "踏步回合的普攻伤害 +50%。", realm: 1 },
  { name: "照影", first: 1, every: 4, kind: "神通", cost: 60, description: "第 1、5、9… 回合照影，当回合与下一回合破除假身。", mastery: "照影持续期间普攻伤害 +25%。", realm: 3 },
  { name: "折篙刀", first: 3, every: 3, kind: "武学", cost: 90, description: "第 3、6、9… 回合斩一刀，伤害 8。同回合先用镇山喝截断，便追斩 12 点。", mastery: "追斩伤害由 12 提升至 22。", realm: 3 },
  { name: "寄灯符", first: 1, every: 3, kind: "神通", cost: 110, description: "第 1、4、7… 回合贴符，维持到下一回合结束。挑灯诀命中即可引爆，火伤 26，也能烧去更印。", mastery: "符火伤害由 26 提升至 38。", realm: 4 },
  { name: "挑灯诀", first: 2, every: 3, kind: "武学", cost: 130, description: "第 2、5、8… 回合出手，刀伤 10。击中带符的真身，可引爆符火。", mastery: "刀伤由 10 提升至 16。", realm: 4 },
] as const;

export const regions = [
  {
    name: "黑风岭", patrolCap: 108, place: "山路", tag: "青芦村北",
    title: "沾着灯油的虎毛", intro: "取灯油的挑夫三天没回村。师父把灯交给阿照时，只说了句：山道上，先听再走。",
    cleared: "挑油人提着两只木桶下了山。岭上那盏守路灯，今晚又亮了。",
    clues: ["石阶上的断爪印", "带血的夹齿", "虎毛上的灯油"], thresholds: [3, 7, 12],
    foes: [{ name: "灰毛山魈", sprite: "ape" }, { name: "松针精", sprite: "pine" }],
    boss: "吊睛山君", sprite: "tiger", hp: 102,
    reward: 2, patrolInterval: 4000, chapter: "山门灯",
  },
  {
    name: "芦花渡", patrolCap: 400, place: "渡口", tag: "青芦村东",
    title: "渡口的第三声铃", intro: "陆婆把断篙递来。她昨夜听见沉船底下，有人应了第三声。",
    cleared: "陆婆解开了系了七年的缆绳。村里的灯火，第一次随渡船过了河。",
    clues: ["断裂的篙头", "船板上的湿手印", "水底的铃声"], thresholds: [24, 58, 100],
    foes: [{ name: "芦偶", sprite: "reed" }, { name: "水耗子", sprite: "rat" }],
    boss: "沉舟河伯", sprite: "ferryman", hp: 228,
    reward: 3, patrolInterval: 3200, chapter: "水底铃",
  },
  {
    name: "白烛庙", patrolCap: 1370, place: "庙街", tag: "青芦村南",
    title: "没有名字的木牌", intro: "石生说，庙里供了七年的无字牌，近来学会了开口。它每晚换一副声音。",
    cleared: "陆婆提笔写下「阿满」。石生把借来的灯一盏一盏送回各家。",
    clues: ["借名帖", "倒流的蜡", "缺一角的无字牌"], thresholds: [36, 84, 140],
    foes: [{ name: "纸灯童", sprite: "lantern" }, { name: "铜镜妖", sprite: "mirror" }],
    boss: "借面娘娘", sprite: "mask", hp: 194,
    reward: 5, patrolInterval: 4000, chapter: "白烛还面",
  },
  {
    name: "纸马驿", patrolCap: 2230, place: "驿桥", tag: "芦花渡对岸",
    title: "桥下歇了半声铃", intro: "陆婆撑船送阿照到对岸。驿桥上的路引被雨泡软了，桥下那人却还站在旧水线里，拿一根断篙拦路。",
    cleared: "篙鬼把路引搁在桥栏上。阿照提灯走过桥心，又听见那口铃响了半声。",
    clues: ["湿透的驿牌", "石墩上的篙痕", "桥下半声铃"], thresholds: [12, 30, 54],
    foes: [{ name: "纸蹄", sprite: "reed" }, { name: "缆绳鬼", sprite: "rat" }],
    boss: "驿桥篙鬼", sprite: "post-ghost", hp: 302,
    reward: 7, patrolInterval: 3200, chapter: "卷二 · 纸马驿",
  },
  {
    name: "纸马院", patrolCap: 2840, place: "驿院", tag: "纸马驿内",
    title: "一盏灯等着收信", intro: "檐下拴着一匹纸马，脖子上挂的灯一直朝北。陆婆说，那是替远行人指路的灯。如今它一见行人便奔过去，像是怕又错过了谁。",
    cleared: "纸马低头，让阿照解下那盏灯。灯罩内侧写着归家的路，最后三字是一个久等的名字。",
    clues: ["凌乱的纸蹄印", "灯架上的家书", "夹在缰绳里的地址"], thresholds: [10, 25, 44],
    foes: [{ name: "飞笺", sprite: "lantern" }, { name: "纸缰", sprite: "reed" }],
    boss: "送灯纸马", sprite: "courier-horse", hp: 312,
    reward: 9, patrolInterval: 3200, chapter: "卷二 · 纸马驿",
  },
  {
    name: "守更楼", patrolCap: 3450, place: "更楼", tag: "纸马驿北门",
    title: "还差一声更响", intro: "驿墙下等信的人越来越多。守更驿卒每夜抱着旧更牌点名，那一袋家书从没被点到过。",
    cleared: "阿照照着灯上的地址送完家书。最后一封被老人按在膝头读了许久。他从门后取下云栈钥匙，说山道上也有人等灯。",
    clues: ["缺了一角的更牌", "北门驿簿", "一袋未送出的家书"], thresholds: [12, 30, 52],
    foes: [{ name: "更铃影", sprite: "mirror" }, { name: "过门纸卒", sprite: "pine" }],
    boss: "守更驿卒", sprite: "watch-guard", hp: 326,
    reward: 11, patrolInterval: 3200, chapter: "卷二 · 纸马驿",
  },
  {
    name: "残栈", patrolCap: 4650, place: "下层栈道", tag: "云栈山门",
    title: "灯朝断路亮", intro: "云栈钥匙拧开山门。栈道上的风灯全朝山外，隔着断索却有人喊：灯亮着，路该还通。",
    cleared: "阿照把守灯人拉过最后一截断栈。他转正手里的风灯，山壁上映出一条向上的旧索路。",
    clues: ["向山外翻的灯穗", "断索上新扎的扣", "旧灯下的结扣"], thresholds: [12, 25, 40],
    foes: [{ name: "缠绳雀", sprite: "reed" }, { name: "竹灯精", sprite: "lantern" }],
    boss: "回风鸮", sprite: "cliff-owl", hp: 418,
    reward: 24, patrolInterval: 3200, chapter: "卷三 · 云栈",
  },
] as const;
