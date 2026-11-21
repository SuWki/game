import type { Item } from './scenario.ts';

export const berthFee = 6;
export const boardingWater = 3;
export const waterPacks = [
  { name: '散装饮水', days: 1, price: 4 },
  { name: '密封水壶', days: 3, price: 10 },
  { name: '储水桶', days: 5, price: 15 },
] as const;

export const cargoGoods = [
  { name: '舱门密封条', model: '船体耗材', clue: '橡胶弯折无裂口。修船坞能硫化新胶，受潮的浮田舱正等着换条。' },
  { name: '育苗芯绳', model: '种植耗材', clue: '编绳能把水引到苗盘。浮田站常有余料，拆船工用它养船上的菜苗。' },
  { name: '手摇机铜线圈', model: '发电备件', clue: '线漆完整，端头已测通。拆船场常拆出线圈，修船坞拿来绕应急发电机。' },
] as const;

export const floatFarmOrder = {
  id: 'float-farm-seal-order',
  announce: 4,
  first: 6,
  last: 7,
  kind: 0,
  price: 34,
  receipt: '浮田水站加购 · 舱门密封条',
  reason: '浮田站有一片种植舱漏水，维修班要在开工前多备一件舱门密封条。',
} as const;

const stops = [
  { name: '避风修船坞', reason: '船坞自产密封条，急收铜线圈修应急电机。', prices: [12, 20, 35] },
  { name: '浮田水站', reason: '苗床出产芯绳，种植舱正漏水，高价收密封条。', prices: [27, 11, 24] },
  { name: '废船拆解场', reason: '拆船件里铜线圈多，工班菜圃缺引水芯绳。', prices: [19, 26, 16] },
];

export function shipStop(day: number) {
  const leg = Math.floor((day - 1) / 5);
  return { leg, stop: stops[leg % stops.length], next: stops[(leg + 1) % stops.length], nextDay: (leg + 1) * 5 + 1 };
}

export const cargoId = (day: number, good: number) => `ship-${shipStop(day).leg}-cargo-${good}`;
export function cargoKind(id: string) {
  const match = /^ship-\d+-cargo-([012])$/.exec(id);
  return match ? Number(match[1]) : undefined;
}
export function cargoQuote(day: number, good: number) {
  const { stop, next } = shipStop(day);
  return { ask: stop.prices[good] + 2, bid: stop.prices[good], nextBid: next.prices[good] };
}

function waterCosts(missingWater: number) {
  const waterCost = [0];
  for (let needed = 1; needed <= missingWater; needed++) {
    waterCost.push(Math.min(...waterPacks.map((pack) => pack.price + waterCost[Math.max(0, needed - pack.days)])));
  }
  return waterCost;
}

export function nightBudget(cash: number, water: number, night: { cash: number; water: number }, payment = 0) {
  const missingWater = Math.max(0, night.water - water);
  const waterSpend = waterCosts(missingWater)[missingWater];
  const balance = cash - payment;
  return { missingWater, waterSpend, balance, gap: Math.max(0, night.cash + waterSpend - balance) };
}

export function crossingBudget(day: number, cash: number, water: number,
  livingCosts?: { cash: number; water: number }[]) {
  const { nextDay } = shipStop(day);
  const nights = nextDay - day;
  const missingWater = Math.max(0, (livingCosts?.reduce((sum, night) => sum + night.water, 0) ?? nights) - water);
  const waterCost = waterCosts(missingWater);
  const waterSpend = waterCost[missingWater];
  const total = (livingCosts?.reduce((sum, night) => sum + night.cash, 0) ?? nights * berthFee) + waterSpend;
  const tonight = (livingCosts?.[0]?.cash ?? berthFee) + waterCost[Math.max(0, (livingCosts?.[0]?.water ?? 1) - water)];
  return { nights, missingWater, waterSpend, total, gap: Math.max(0, total - cash), tonightGap: Math.max(0, tonight - cash) };
}

export function shipSaleQuote(day: number, item: Item) {
  const kind = cargoKind(item.id);
  if (kind !== undefined) return cargoQuote(day, kind);
  const bid = shoreOffer(day, item);
  if (bid === undefined) return;
  return { bid, nextBid: shoreOffer(shipStop(day).nextDay, item)! };
}

// 岸商按用途给现货报价，已签工单和当票照合同价结算。
export function shoreOffer(day: number, item: Item) {
  if (item.recyclePrice === undefined) return undefined;
  const leg = shipStop(day).leg % stops.length;
  const rates = /灯|保险丝|电路板/.test(item.name) ? [135, 105, 85]
    : /绳|绞盘/.test(item.name) ? [100, 85, 130]
    : /净水/.test(item.name) ? [95, 140, 100] : [110, 95, 120];
  const rate = rates[leg];
  return Math.max(1, Math.round(item.recyclePrice * rate / 100));
}
