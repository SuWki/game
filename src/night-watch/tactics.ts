// 应对来自阿照的身手与现场物件，首胜前即可尝试。
export const encounters = [
  {
    first: 3, every: 3, sign: "山君伏肩，喉间一震",
    read: "虎啸将至。看山君还剩多少气血，再决定要不要迎上去。",
    safe: { name: "伏身避啸", effect: "本回合虎啸至多扣 4 点气血。" },
    risk: { name: "迎啸进刀", effect: "本回合刀伤 +12。若虎啸仍能出手，承受完整重击。" },
  },
  {
    first: 2, every: 3, sign: "篙头一沉，水下绷起旧缆",
    read: "河伯正挥篙，下一回合才起回浪。看自己的镇山喝能否赶上。",
    safe: { name: "割缆泄浪", effect: "下一回合回浪的基础伤害从 34 降至 12，守式仍可减伤。" },
    risk: { name: "引浪撞舟", effect: "下一回合若截断回浪，借浪反伤 18。若被击中，按 46 点基础伤害结算。" },
  },
  {
    first: 2, every: 3, sign: "两张纸面同声唤灯",
    read: "听息能察觉下一回合的真身。看照影覆盖哪几回合，再决定灯往哪照。",
    safe: { name: "挑灯照面", effect: "本回合及后两回合照出真身，这三回合的刀招均可打实。" },
    risk: { name: "藏锋候影", effect: "本回合收刀。下一回合真身出现时，普攻刀伤 +28，可叠加身法与佩饰。" },
  },
  {
    first: 3, every: 3, sign: "篙尖擦过石栏",
    read: "横篙将至。退到石墩边能稳住脚步。",
    safe: { name: "借墩稳身", effect: "清除失足，本回合横篙至多伤 8 点。" },
    risk: { name: "迎篙抢步", effect: "镇山喝截断后普攻刀伤 +18。截不住时承受横篙全伤。" },
  },
  {
    first: 2, every: 3, sign: "纸马提灯，踏步将撞",
    read: "举灯时纸马受到的刀伤减半。压灯可打实，迎灯可抢一刀。",
    safe: { name: "压灯卸势", effect: "放倒马灯，本回合冲灯至多扣 8 点气血。" },
    risk: { name: "迎灯进刀", effect: "放倒马灯，普攻刀伤 +20，承受冲灯全伤。" },
  },
  {
    first: 2, every: 3, sign: "驿卒抬手，准备敲更",
    read: "趁敲更前清掉更印。身上有寄灯符，可以借灯引燃。",
    safe: { name: "揭去更印", effect: "移除更印，阻止下一回合的震响。" },
    risk: { name: "借灯引符", effect: "引爆现存的寄灯符，烧去更印并造成火伤。" },
  },
  {
    first: 2, every: 3, sign: "回风牵起灯穗",
    read: "回风鸮即将掠栈。握紧横索可以站稳。",
    safe: { name: "扶索稳身", effect: "掠栈打中时扶住横索，避免本轮踏空。" },
    risk: { name: "依原招出手", effect: "掠栈打中且未扶索时会踏空。" },
  },
  {
    first: 2, every: 3, sign: "鹞影将擦过灯架",
    read: "趁它贴崖，跟上或压灯。落巢时还能截断它的下一次升空。",
    safe: { name: "压灯引鹞", effect: "本回合将衔灯鹞引至刀锋所及处。" },
    risk: { name: "依原招出手", effect: "下一回合落巢时可近身。" },
  },
] as const;

export type Response = "safe" | "risk" | "pass";
export function decisionDue(region: keyof typeof encounters & number, round: number) {
  const { first, every } = encounters[region];
  return round >= first && (round - first) % every === 0;
}

export const caseClues = [
  {
    danger: "第 3、6、9… 回合虎啸，攻式会吃满重击。",
    counter: "伏身避啸至多扣 4 点气血。守式也能架住虎啸。",
    aid: "灯油引虎", damage: 8,
  },
  {
    danger: "第 2、5、8… 回合绷缆，下一回合起回浪。三次汲水便会覆舟。",
    counter: "绷缆时割缆可清空水位。带镇山喝也可选引浪撞舟，截住回浪后借浪反伤。",
    aid: "水底铃扰阵", damage: 14,
  },
  {
    danger: "连续斩中两次纸面会反噬。第 3、6、9… 回合可凭听息认出真身。",
    counter: "借面时挑灯可连照三回合，藏锋则把刀伤留到下一回合。",
    aid: "旧名唤真", damage: 14,
  },
  {
    danger: "第 3、6、9… 回合横篙。第三次中招会落桥。",
    counter: "借墩稳身能清掉失足。镇山喝与横篙同回合，可以截招。",
    aid: "借栏绊篙", damage: 14,
  },
  {
    danger: "举灯时刀伤减半。第 2、5、8… 回合冲灯，顶着马灯中招还会灼伤。",
    counter: "压灯卸势能打落马灯，冲灯至多扣 8 点气血。迎灯进刀则要吃满冲灯。",
    aid: "顺缰绊蹄", damage: 16,
  },
  {
    danger: "第 1、4、7… 回合重结更印。敲更时若更印仍在，会多扣 28 点气血。",
    counter: "提槌时揭去更印。带寄灯符的人也可以借灯引符，烧印的同时打出火伤。",
    aid: "照簿破势", damage: 16,
  },
  {
    danger: "第 2、5、8… 回合掠栈。被击中且没有扶索时踏空，下回合先扣落地伤。",
    counter: "守式扶索两次，听潮步可闪避掠栈。镇山喝能截断下一回合的落爪。",
    aid: "旧灯结扣", damage: 24,
  },
  {
    danger: "升空和贴崖时，近刀只能擦伤。第 3、6、9… 回合落巢，可以打实。",
    counter: "踏缆步可在贴崖时追近。守式可压灯两次，镇山喝截断落巢后下一轮还能近身。",
    aid: "拴灯引鹞", damage: 18,
  },
] as const;

export function preparationText(region: keyof typeof encounters & number) {
  const clue = caseClues[region];
  if (region === 6) return `「${clue.aid}」· 首次落地少扣 ${clue.damage} 点气血。`;
  if (region === 7) return `「${clue.aid}」· 首次打实贴崖额外造成 ${clue.damage} 点伤害。`;
  return `「${clue.aid}」· 首次${encounters[region].safe.name}后，额外造成 ${clue.damage} 点伤害。`;
}
