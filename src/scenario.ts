export const openingCash = 200;
export const maxOffers = 2;
export const firstChapterEnd = 5;
export const secondChapterStart = firstChapterEnd + 1;
export const lastDay = 10;
export const waterStartDay = 5;
export const waterPrice = 10;
export const purifierModel = 'F2';
export const mechanicRequest = '给维修间找一台正品、可用的 F2 净水机，出价 120 元。';
export const imitationPurchasePrice = 5;
export const honestTimerPrice = 12;
export const falseTimerPrice = 26;
export const disputedPurifierPrice = 100;
export const waterReservePrice = 8;
export const emergencyWaterDay = 8;
export const emergencyWaterPrice = 18;
export const harborNotice = '第 8 天淡水驳船晚到一天。第 7 天可花 8 元订水，否则第 8 天应急水 18 元。第 9 天恢复 10 元。';
export const winchBuyers = '第 9 天船工出 108 元，第 10 天修理匠出 155 元。';
export const lateBoardPrice = 72;
export const wornWinchPrice = 95;
export const wornWinchEarlyPrice = 88;
export const wornWinchLatePrice = 115;

export type Item = {
  id: string;
  name: string;
  model: string;
  condition: string;
  observations: string[];
  authenticity?: 'genuine' | 'imitation';
  reference?: string;
  recyclePrice?: number;
};

const resaleBands: Record<string, readonly [number, number, number]> = {
  'old-lantern-1': [22, 30, 38],
  'watch-1': [36, 49, 62],
  'purifier-1': [62, 88, 108],
  'timer-1': [9, 12, 16],
  'board-1': [24, 38, 46],
  'winch-1': [93, 114, 132],
  'harbor-rope': [18, 24, 29],
  'harbor-fuses': [22, 30, 38],
};

export function consignmentPrices(item: Item) {
  if (item.id === 'winch-1' && item.condition === wornWinch.condition) return [78, 92, 104] as const;
  return resaleBands[item.id];
}

export function consignmentBudget(item: Item, day: number, lateSchedule: boolean) {
  const prices = consignmentPrices(item);
  const itemOffset = Object.keys(resaleBands).indexOf(item.id);
  return prices?.[(day + itemOffset + (lateSchedule ? 1 : 0)) % prices.length];
}

export const harborGoods: { item: Item; asks: Partial<Record<number, number>>; bids: Partial<Record<number, number>> }[] = [
  {
    item: { id: 'harbor-rope', name: '防潮缆绳', model: '船具', condition: '干燥可用',
      observations: ['码头换下的备用缆绳，各收购点报价随出船安排变动。'], recyclePrice: 12 },
    asks: { 6: 22, 7: 25 },
    bids: { 7: 23, 8: 31, 9: 27, 10: 19 },
  },
  {
    item: { id: 'harbor-fuses', name: '密封保险丝', model: '电料', condition: '原封',
      observations: ['民用配电盒备件，维修间在淡水船靠岸后批量收。'], recyclePrice: 16 },
    asks: { 7: 32, 8: 28 },
    bids: { 8: 24, 9: 43, 10: 39 },
  },
];

export const lantern: Item = {
  id: 'old-lantern-1',
  name: '旧航灯',
  model: '船用照明',
  condition: '可点亮',
  observations: ['灯罩有盐霜和细划痕。', '灯芯能点亮，提手铆钉稳固。'],
  recyclePrice: 18,
};

const watch: Item = {
  id: 'watch-1',
  name: '怀表',
  model: '机械怀表',
  condition: '走时正常',
  observations: ['表壳边缘有磕碰。', '上弦后秒针走动均匀。'],
  recyclePrice: 30,
};

const purifier: Item = {
  id: 'purifier-1',
  name: 'F2 净水机',
  model: purifierModel,
  condition: '可用',
  observations: ['铭牌上刻着 F2 · 雨水净化用。', '启动后泵声平稳，接口无漏水。'],
  authenticity: 'genuine',
  recyclePrice: 50,
};

const timer: Item = {
  id: 'timer-1', name: '船用计时器', model: 'T8', condition: '走时正常',
  observations: ['铭牌标为 T8。', '底盖钢印的出厂批次为 T8-07。'],
  reference: '聚落鉴定手册记载，正厂 T8 的出厂批次从 T8-12 开始。',
  authenticity: 'imitation', recyclePrice: 8,
};

export const board: Item = {
  id: 'board-1', name: '旧电路板', model: '控制板', condition: '可用',
  observations: ['接脚有氧化痕迹，通电测试正常。'], recyclePrice: 18,
};

const winch: Item = {
  id: 'winch-1', name: '码头绞盘', model: '船用绞盘', condition: '可用',
  observations: ['齿轮能转动，刹车能锁住。', '修理匠留条：第 10 天，能用的绞盘收 155 元。'],
};

export const wornWinch: Item = {
  ...winch, condition: '齿轮磨损',
  observations: ['空转能用，但齿轮有缺口，重载前需要返修。', '船工第 9 天愿出 88 元，修理匠第 10 天按待修件出 115 元。'],
};

export function itemDetails(id: string): Item | undefined {
  return [lantern, watch, purifier, timer, board, winch].find((item) => item.id === id);
}

type Visitor = {
  id: string;
  person: string;
  portrait: 'boatman' | 'watchmaker' | 'mechanic' | 'diver' | 'deckhand';
  dialogue: string;
};
type Offers = { item: Item; offers: number[]; minimumPrice: number };
export type Visit = Visitor & (
  | ({ kind: 'purchase' } & Offers)
  | ({ kind: 'pawn'; redeemPrice: number; dueDay: number } & Offers)
  | { kind: 'sale'; item: Item; price: number; missing: string; matchModel?: boolean }
  | { kind: 'redeem'; ticketId: string; missing: string }
  | { kind: 'timerBuyer'; item: Item }
  | { kind: 'waterReserve'; supplyDay: number }
);

const script: Record<number, Visit[]> = {
  1: [
    {
      id: 'day-1-boatman', kind: 'purchase', person: '船工', portrait: 'boatman', item: lantern,
      dialogue: '从旧船上拆下来的，擦一擦还能照亮一整间屋。我想换点现钱。',
      offers: [20, 25], minimumPrice: 25,
    },
    {
      id: 'day-1-watchmaker', kind: 'pawn', person: '钟表师', portrait: 'watchmaker', item: watch,
      dialogue: '我想先借 60 元。最迟后天，我带 75 元来赎这块表。',
      offers: [60], minimumPrice: 60, redeemPrice: 75, dueDay: 3,
    },
  ],
  2: [
    {
      id: 'day-2-mechanic', kind: 'sale', person: '修理匠', portrait: 'mechanic', item: lantern, price: 40,
      dialogue: '我缺一盏船灯，旧航灯我出 40 元。对了，要是遇到正品 F2 净水机，给我留一台，我拿去维修间用。',
      missing: '看来现在没货。下回我再问问。',
    },
    {
      id: 'day-2-diver', kind: 'pawn', person: '潜水员', portrait: 'diver', item: purifier,
      dialogue: '这台 F2 接后巷集雨池。海里的水可别往里灌。借我 80 元，第 4 天打烊前我带 96 元来赎。',
      offers: [80], minimumPrice: 80, redeemPrice: 96, dueDay: 4,
    },
  ],
  3: [
    {
      id: 'day-3-watchmaker', kind: 'redeem', person: '钟表师', portrait: 'watchmaker', ticketId: 'day-1-watchmaker',
      dialogue: '这是约好的 75 元。今天是最后一天，我来拿回我的怀表。',
      missing: '店里没有可赎回的这张当票。我再核对一下。',
    },
    {
      id: 'day-3-timer', kind: 'pawn', person: '跑船客', portrait: 'deckhand', item: timer,
      dialogue: '这枚 T8 还能走，想当 20 元。我有钱就回来赎。',
      offers: [20], minimumPrice: 20, redeemPrice: 24, dueDay: 4,
    },
  ],
  4: [
    {
      id: 'day-4-timer-buyer', kind: 'timerBuyer', person: '船工', portrait: 'boatman', item: timer,
      dialogue: '明早要出船，想找个能走的计时器。原厂的我多出一点。',
    },
    {
      id: 'day-4-water-reserve', kind: 'waterReserve', person: '修理匠', portrait: 'mechanic',
      dialogue: '新户的四天配给到今晚。我手上多一份水票，8 元给你，够你明晚用。',
      supplyDay: 5,
    },
  ],
  5: [
    {
      id: 'day-5-mechanic', kind: 'sale', person: '修理匠', portrait: 'mechanic', item: purifier, price: 120, matchModel: true,
      dialogue: '上回托你留的 F2 有消息吗？正品而且能用的话，我带了 120 元。',
      missing: '今天没找到可交货的 F2，我改天再来。',
    },
  ],
  6: [{
    id: 'day-6-board', kind: 'purchase', person: '修理匠', portrait: 'mechanic', item: board,
    dialogue: '这块旧电路板通电正常，30 元卖断。钟表师明天出 55，船工第 9 天出 72。你看想什么时候回款。',
    offers: [30], minimumPrice: 30,
  }],
  7: [
    {
      id: 'day-7-board', kind: 'sale', person: '钟表师', portrait: 'watchmaker', item: board, price: 55,
      dialogue: '修理匠说你这儿可能有块控制板。我出 55 元。', missing: '看来今天没板子，我去码头再找找。',
    },
    {
      id: 'day-7-water', kind: 'waterReserve', person: '船工', portrait: 'boatman', supplyDay: emergencyWaterDay,
      dialogue: '淡水船明天赶不上。码头还有应急桶，今天给 8 元，我替你留一桶，明晚用。',
    },
  ],
  8: [{
    id: 'day-8-winch', kind: 'purchase', person: '潜水员', portrait: 'diver', item: winch,
    dialogue: '绞盘的齿轮有磨损，按现状收 95。你出 125，我现场换好齿轮。修理匠第 10 天按成色收。',
    offers: [125, wornWinchPrice], minimumPrice: wornWinchPrice,
  }],
  9: [{
    id: 'day-9-winch', kind: 'sale', person: '船工', portrait: 'boatman', item: winch, price: 108,
    dialogue: '绞盘我今天就能带走，成色好的给 108 元。电路板要是还在，我也收。',
    missing: '柜台没绞盘啊，我去别家问问。',
  }],
  10: [{
    id: 'day-10-winch', kind: 'sale', person: '修理匠', portrait: 'mechanic', item: winch, price: 155,
    dialogue: '我按留条来了。换好齿轮的绞盘，我出 155 元。', missing: '原来那台绞盘没收到。我再托潜水员找找。',
  }],
};

export function currentVisit(day: number, index: number): Visit | undefined {
  return script[day]?.[index];
}

export const harborPeriods = ['morning', 'noon', 'evening'] as const;

export function harborPeriod(visitIndex: number, visitCount: number, awaitingOpen: boolean) {
  if (awaitingOpen) return 'morning';
  if (visitIndex >= visitCount) return 'evening';
  return harborPeriods[Math.floor(visitIndex * harborPeriods.length / visitCount)];
}

export function scheduledVisits(day: number) {
  return script[day]?.length ?? 0;
}
