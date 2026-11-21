export const firstOutingDay = 21;
export const boatFee = 18;
export const winchUpgradeCost = 24;
export const cashReserve = 32;
export const outingLimit = 2;
export const waterJobPay = 8;
export const voyageExpense = '外出 · 拼船打捞';

export const filterGrades = {
  worn: { name: '旧芯', price: 14, uses: 2 },
  sound: { name: '完好芯', price: 34, uses: 5 },
  long: { name: '长寿命芯', price: 108, uses: 16 },
} as const;
export type FilterGrade = keyof typeof filterGrades;
export type FilterLife = { grade: FilterGrade; remaining: number };
export type Voyage = { day: number; grade: FilterGrade | 'empty'; stage: 0 | 1 | 2 };

export const voyageOdds = (equipped: boolean) => equipped ? [35, 33, 27, 5] : [45, 30, 22, 3];

export function voyageResult(roll: number, equipped: boolean): Voyage['grade'] {
  const [empty, worn, sound] = voyageOdds(equipped);
  if (roll < empty) return 'empty';
  if (roll < empty + worn) return 'worn';
  if (roll < empty + worn + sound) return 'sound';
  return 'long';
}

export function voyageRoll(seed: number, day: number, equipped: boolean) {
  let value = (seed ^ Math.imul(day, 0x9e3779b1) ^ (equipped ? 0x825bc40d : 0x6c8e9cf5)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) % 100;
}

export function filterOffer(filter: FilterLife) {
  const { price, uses } = filterGrades[filter.grade];
  return Math.floor(price * filter.remaining / uses);
}
