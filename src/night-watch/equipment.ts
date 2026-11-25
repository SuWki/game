import { bridgeRegion, courierRegion, skyRegion } from "./content.ts";

export const slots = { weapon: "兵刃", armor: "护具", charm: "佩饰" } as const;
export type GearSlot = keyof typeof slots;

type Gear = { name: string; slot: GearSlot; level: number; effect: string; damage?: number; life?: number };

export const equipment = {
  pineBlade: { name: "松纹刀", slot: "weapon", level: 1, effect: "基础刀伤 +2", damage: 2 },
  hillCoat: { name: "山行衣", slot: "armor", level: 1, effect: "气血上限 +12", life: 12 },
  reedBlade: { name: "斩芦刀", slot: "weapon", level: 2, effect: "基础刀伤 +4", damage: 4 },
  ferryCoat: { name: "渡水蓑", slot: "armor", level: 2, effect: "气血上限 +22", life: 22 },
  templeBlade: { name: "烛影刀", slot: "weapon", level: 3, effect: "基础刀伤 +6", damage: 6 },
  templeCoat: { name: "护灯袍", slot: "armor", level: 3, effect: "气血上限 +34", life: 34 },
  tigerFang: { name: "山君牙坠", slot: "charm", level: 1, effect: "第 3、6、9… 回合普攻伤害 +3" },
  tideSeal: { name: "河伯镇潮印", slot: "charm", level: 2, effect: "第 2、5、8… 回合受到的伤害 -4，最低 1 点" },
  mirrorPearl: { name: "借面珠", slot: "charm", level: 3, effect: "第 1、5、9… 回合普攻伤害 +5" },
  postBlade: { name: "青石刀", slot: "weapon", level: 4, effect: "基础刀伤 +8", damage: 8 },
  postCoat: { name: "驿衣", slot: "armor", level: 4, effect: "气血上限 +42", life: 42 },
  postSeal: { name: "驿桥路引", slot: "charm", level: 4, effect: "第 3、6、9… 回合折篙刀首斩伤害 +6" },
  courierBlade: { name: "刻灯刀", slot: "weapon", level: 5, effect: "基础刀伤 +10", damage: 10 },
  courierCoat: { name: "挡风衣", slot: "armor", level: 5, effect: "气血上限 +49", life: 49 },
  courierSeal: { name: "纸马灯芯", slot: "charm", level: 5, effect: "引爆寄灯符时，火伤 +8" },
  watchBlade: { name: "夜更刀", slot: "weapon", level: 6, effect: "基础刀伤 +12", damage: 12 },
  watchCoat: { name: "巡驿甲", slot: "armor", level: 6, effect: "气血上限 +56", life: 56 },
  watchSeal: { name: "守更牌", slot: "charm", level: 6, effect: "第 3、6、9… 回合受到的攻击伤害 -6，最低 1 点" },
  lampKnot: { name: "续灯扣", slot: "charm", level: 8, effect: "截断重击后，下一回合普攻全额命中可回气 +12" },
} as const satisfies Record<string, Gear>;

export type GearId = keyof typeof equipment;
export const reforging = {
  pineBlade: { chapter: bridgeRegion, cost: 18, bonus: 3 },
  ferryCoat: { chapter: courierRegion, cost: 22, bonus: 9 },
} as const;
export type ReforgeId = keyof typeof reforging;
export const reforgeIds = Object.keys(reforging) as ReforgeId[];
export type GearReforges = Partial<Record<ReforgeId, true>>;

export function isReforgeId(id: string): id is ReforgeId {
  return Object.hasOwn(reforging, id);
}

// 佩饰按回合直接生效；兵刃和护具另有可与招式组合的特性。
export const traits = {
  pineBlade: { trigger: "镇山喝截断敌招", effect: "喝伤", amount: 12 },
  reedBlade: { trigger: "听潮步发动时", effect: "刀伤", amount: 8 },
  templeBlade: { trigger: "照影持续时", effect: "刀伤", amount: 6 },
  hillCoat: { trigger: "守式挡下重击", effect: "减伤", amount: 3 },
  ferryCoat: { trigger: "身法成功闪避", effect: "回血", amount: 5 },
  templeCoat: { trigger: "照影期间受击", effect: "减伤", amount: 4 },
} as const;

export function traitPower(id: keyof typeof traits, rank = 0) {
  return traits[id].amount + rank * (equipment[id].slot === "weapon" ? 2 : 1);
}

export function traitText(id: GearId, rank = 0) {
  if (!(id in traits)) return "";
  const key = id as keyof typeof traits;
  const trait = traits[key];
  return `${trait.trigger} · ${trait.effect} +${traitPower(key, rank)}`;
}

export type GearLoadout = Partial<Record<GearSlot, GearId>>;
export const bossEquipment = ["tigerFang", "tideSeal", "mirrorPearl", "postSeal", "courierSeal", "watchSeal"] as const;
export const minionEquipment = [
  ["hillCoat", "pineBlade"], ["ferryCoat", "reedBlade"], ["templeCoat", "templeBlade"], ["postCoat", "postBlade"],
  ["courierCoat", "courierBlade"], ["watchCoat", "watchBlade"],
] as const;

export function gearRegion(id: GearId) {
  if (id === "lampKnot") return skyRegion;
  return minionEquipment.findIndex((pair, i) => id === bossEquipment[i] || pair.some(item => item === id));
}

export function gearRank(id: GearId, ranks: readonly number[]) {
  return ranks[gearRegion(id)] ?? 0;
}

function reforgeBonus(id: GearId, reforges: GearReforges) {
  return isReforgeId(id) && reforges[id] ? reforging[id].bonus : 0;
}

export function gearDamage(id: GearId, rank: number, reforges: GearReforges = {}) {
  const item: Gear = equipment[id];
  return item.slot === "weapon" ? (item.damage ?? 0) + rank * 3 + reforgeBonus(id, reforges) : 0;
}

export function gearLife(id: GearId, rank: number, reforges: GearReforges = {}) {
  const item: Gear = equipment[id];
  return item.slot === "armor" ? (item.life ?? 0) + rank * 9 + reforgeBonus(id, reforges) : 0;
}

const charmBase = { tigerFang: 3, tideSeal: 4, mirrorPearl: 5, postSeal: 6, courierSeal: 8, watchSeal: 6, lampKnot: 12 };
export type CharmId = keyof typeof charmBase;
export function charmPower(id: CharmId, rank: number) {
  return charmBase[id] + rank * (id === "tideSeal" || id === "watchSeal" ? 2 : 3);
}

export function gearEffect(id: GearId, rank = 0, reforges: GearReforges = {}) {
  const item = equipment[id];
  if (item.slot === "weapon") return `基础刀伤 +${gearDamage(id, rank, reforges)}`;
  if (item.slot === "armor") return `气血上限 +${gearLife(id, rank, reforges)}`;
  const charm = id as CharmId;
  return item.effect.replace(/[+-]\d+/, symbol => symbol[0] + charmPower(charm, rank));
}

export function gearDisplayName(id: GearId, rank: number, reforges: GearReforges) {
  return equipment[id].name + (rank ? ` +${rank}` : "") + (reforgeBonus(id, reforges) ? " · 已重铸" : "");
}

export function knownGear(id: unknown): id is GearId {
  return typeof id === "string" && Object.hasOwn(equipment, id);
}
