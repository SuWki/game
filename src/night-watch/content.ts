export const realms = ["锻骨", "舒筋", "贯劲", "听息"] as const;
export const mountainFirstReward = 6;
export const breakthrough = [
  { gift: "开身法位。基础退步在第 1、4、7… 回合避开第一道浪。", verse: "起如山鸟，落似老熊。" },
  { gift: "成功架住重击后反击 6 点。", verse: "一箭入石，满弓余声未歇。" },
  { gift: "开神通位。每逢第 3、6、9… 回合自然辨出真身。", verse: "芦花无风动，水底有呼吸。" },
] as const;

export const arts = [
  { name: "镇山喝", first: 3, every: 3, kind: "武学", cost: 30, description: "第 3、6、9… 回合出招，伤害 5，截断当轮可打断的重击。", mastery: "截招成功时追加 12 点伤害。", realm: 0 },
  { name: "听潮步", first: 2, every: 3, kind: "身法", cost: 60, description: "第 2、5、8… 回合踏步，闪避当轮敌方攻击。", mastery: "踏步回合的普攻增伤 50%。", realm: 1 },
  { name: "照影", first: 1, every: 4, kind: "神通", cost: 60, description: "第 1、5、9… 回合照影，当轮与下一轮破除假身。", mastery: "照影持续期间普攻增伤 25%。", realm: 3 },
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
] as const;
