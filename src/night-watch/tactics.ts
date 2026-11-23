// 三处妖案的应对都来自阿照的身手与现场物件，首胜前即可尝试。
export const encounters = [
  {
    first: 3, every: 3, sign: "山君伏肩，喉间一震",
    read: "虎啸将至。看山君还剩多少气血，再决定要不要迎上去。",
    safe: { name: "伏身避啸", effect: "本轮虎啸至多扣 4 点气血。" },
    risk: { name: "迎啸进刀", effect: "本轮刀伤加 12。若虎啸仍能出手，承受完整重击。" },
  },
  {
    first: 2, every: 3, sign: "篙头一沉，水下绷起旧缆",
    read: "河伯正挥篙，下一轮才起回浪。看自己的镇山喝能否赶上。",
    safe: { name: "割缆泄浪", effect: "下一轮回浪的基础伤害从 34 降至 12，守式仍可减伤。" },
    risk: { name: "引浪撞舟", effect: "下一轮若截断回浪，借浪反伤 18。若被击中，按 46 点基础伤害结算。" },
  },
  {
    first: 2, every: 3, sign: "两张纸面同声唤灯",
    read: "听息能察觉下一轮的真身。看照影覆盖哪几轮，再决定灯往哪照。",
    safe: { name: "挑灯照面", effect: "本轮及后两轮照出真身，这三轮的刀招均可打实。" },
    risk: { name: "藏锋候影", effect: "本轮收刀。下一轮真身出现时，普攻刀伤加 28，可叠加身法与佩饰。" },
  },
] as const;

export type Response = "safe" | "risk" | "pass";
export function decisionDue(region: 0 | 1 | 2, round: number) {
  const { first, every } = encounters[region];
  return round >= first && (round - first) % every === 0;
}
