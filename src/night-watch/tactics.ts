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
] as const;

export type Response = "safe" | "risk" | "pass";
export function decisionDue(region: keyof typeof encounters & number, round: number) {
  const { first, every } = encounters[region];
  return round >= first && (round - first) % every === 0;
}
