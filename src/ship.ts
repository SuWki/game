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
