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
  tigerFang: { name: "山君牙坠", slot: "charm", level: 1, effect: "第 3、6、9…轮普攻伤害 +3" },
  tideSeal: { name: "河伯镇潮印", slot: "charm", level: 2, effect: "第 2、5、8…轮受到的伤害 -4，最低 1 点" },
  mirrorPearl: { name: "借面珠", slot: "charm", level: 3, effect: "第 1、5、9…轮普攻伤害 +5" },
} as const satisfies Record<string, Gear>;

export type GearId = keyof typeof equipment;
export type GearLoadout = Partial<Record<GearSlot, GearId>>;
export const bossEquipment = ["tigerFang", "tideSeal", "mirrorPearl"] as const;
export const minionEquipment = [
  ["hillCoat", "pineBlade"], ["ferryCoat", "reedBlade"], ["templeCoat", "templeBlade"],
] as const;

export function knownGear(id: unknown): id is GearId {
  return typeof id === "string" && Object.hasOwn(equipment, id);
}
