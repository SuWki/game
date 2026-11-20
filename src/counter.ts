import { currentVisit, disputedPurifierPrice, emergencyWaterDay, emergencyWaterPrice, falseTimerPrice, honestTimerPrice, imitationPurchasePrice, lastDay, maxOffers, openingCash, purifierModel, secondChapterStart, waterPrice, waterReservePrice, waterStartDay, type Item, type Visit } from './scenario.ts';
import { board, consignmentBudget, consignmentPrices, harborGoods, lateBoardPrice, wornWinch, wornWinchEarlyPrice, wornWinchLatePrice, wornWinchPrice } from './scenario.ts';
import { harborNotice, itemDetails, mechanicRequest, onTimePortNotice, portItem, portMechanicRequest, portNotice, winchBuyers, winchOrderDay } from './scenario.ts';

export const waterLedger = {
  purchase: '买水', reservation: '预订用水', purifier: 'F2 集雨供水', ticket: '水票抵扣', unused: '水票到期未使用',
} as const;

type InventoryItem = Item & { cost: number };
type LedgerEntry = {
  day: number;
  itemId: string | null;
  description: string;
  change: number;
  balance: number;
};
export type Ticket = {
  id: string;
  borrower: string;
  item: Item;
  principal: number;
  redeemPrice: number;
  dueDay: number;
  status: 'held' | 'redeemed' | 'expired';
};
export type Counter = {
  day: number;
  awaitingOpen: boolean;
  visitIndex: number;
  cash: number;
  attempts: number;
  inventory: InventoryItem[];
  tickets: Ticket[];
  ledger: LedgerEntry[];
  knowsMechanicRequest: boolean;
  sawTimerClues?: boolean;
  timerAppraised?: boolean;
  misrepresentedTimer?: boolean;
  reservedWaterDay?: number;
  chapterTwoStarted?: boolean;
  harborSchedule?: 'late';
  economy?: 'port';
  consignment?: { itemId: string; price: number; listedDay: number };
  readNoteIds?: string[];
  installedPurifier: InventoryItem | null;
  waterShortfall: number;
};

export type Action =
  | { type: 'offer'; visitId: string; attempt: number; amount: number }
  | { type: 'dismiss' | 'sell' | 'redeem' | 'sellBoard'; visitId: string }
  | { type: 'appraiseTimer' | 'buyImitation' | 'sellTimerHonestly' | 'sellTimerAsGenuine' | 'reserveWater'; visitId: string }
  | { type: 'recycle' | 'install'; day: number; itemId: string }
  | { type: 'harborBuy'; day: number; itemId: string }
  | { type: 'harborSell'; day: number; itemId: string }
  | { type: 'listItem'; day: number; itemId: string; price: number }
  | { type: 'unlistItem'; day: number; itemId: string }
  | { type: 'readNotes'; day: number }
  | { type: 'open'; day: number }
  | { type: 'continue'; day: number; upgrade?: true }
  | { type: 'reclaimPurifier'; day: number }
  | { type: 'close'; day: number; confirmShortfall?: boolean };

export type Result = { state: Counter; message: string; tone: 'success' | 'warning' | 'neutral' };

export function openCounter(cash = openingCash): Counter {
  return {
    cash, day: 1, awaitingOpen: false, visitIndex: 0, attempts: 0, inventory: [], tickets: [], ledger: [],
    knowsMechanicRequest: false, installedPurifier: null, waterShortfall: 0,
  };
}

function notice(state: Counter, message: string, tone: Result['tone'] = 'neutral'): Result {
  return { state, message, tone };
}

function advance(state: Counter): Counter {
  const visitIndex = state.visitIndex + 1;
  return {
    ...state, visitIndex, attempts: 0,
    sawTimerClues: state.sawTimerClues || [state.visitIndex, visitIndex].some(
      (index) => currentVisit(state.day, index)?.id === 'day-3-timer',
    ),
  };
}

function record(state: Counter, item: Item | null, description: string, change: number): Counter {
  const cash = state.cash + change;
  const next = {
    ...state, cash,
    ledger: [...state.ledger, { day: state.day, itemId: item?.id ?? null, description, change, balance: cash }],
  };
  if (item && next.consignment?.itemId === item.id && !next.inventory.some((entry) => entry.id === item.id)) {
    delete next.consignment;
  }
  return next;
}

export function heldTicket(state: Counter, visit: Extract<Visit, { kind: 'redeem' }>): Ticket | undefined {
  return state.tickets.find((ticket) =>
    ticket.id === visit.ticketId && ticket.borrower === visit.person &&
    ticket.status === 'held' && state.day <= ticket.dueDay);
}

export function usablePurifier(item: Item): boolean {
  return item.model === purifierModel && item.authenticity === 'genuine' && item.condition === '可用';
}

export function saleOffer(state: Counter, visit: Extract<Visit, { kind: 'sale' }>) {
  if (!visit.matchModel) {
    const soldEarly = visit.id === 'day-10-winch' && state.ledger.some((entry) =>
      entry.day === 9 && entry.itemId === visit.item.id && entry.description === `售出${visit.item.name}`);
    const soldAtConsignment = visit.id === 'day-10-winch' && state.ledger.some((entry) =>
      entry.itemId === visit.item.id && entry.description === `寄售成交 · ${visit.item.name}`);
    const item = state.inventory.find((item) => item.id === visit.item.id);
    const price = item?.id === wornWinch.id && item.condition === wornWinch.condition
      ? (visit.id === 'day-9-winch' ? wornWinchEarlyPrice : wornWinchLatePrice)
      : visit.price;
    const issue = soldEarly ? `船工说${state.day === 9 ? '今天' : '昨天'}已把绞盘买走了。下回有货再给我留吧。` :
      soldAtConsignment ? '那台绞盘已经通过寄售出了？下回有货再给我留吧。' : visit.missing;
    return { item, issue, price };
  }
  const candidates = state.inventory.filter((item) => item.model === visit.item.model);
  return {
    item: candidates.find(usablePurifier),
    issue: candidates.length ? '这台设备的真伪或成色不符合修理匠的收购条件。' : visit.missing,
    price: state.misrepresentedTimer ? disputedPurifierPrice : visit.price,
  };
}

export function ownedImitation(state: Counter, item: Item) {
  return state.inventory.find((entry) => entry.id === item.id && entry.authenticity === 'imitation');
}

export function cashWaterPrice(day: number): number {
  if (day < waterStartDay) return 0;
  return day === emergencyWaterDay ? emergencyWaterPrice : waterPrice;
}

export function nightlyWater(state: Counter, day = state.day) {
  if (state.economy === 'port') return { source: '水站居民配给', cost: 0 };
  if (day < waterStartDay) return { source: '新户饮水配给', cost: 0 };
  if (state.installedPurifier) return { source: 'F2 净化集雨池原水', cost: 0 };
  if (state.reservedWaterDay === day) return { source: '已预订的饮水', cost: 0 };
  return { source: day === emergencyWaterDay ? '码头应急水' : '淡水驳船', cost: cashWaterPrice(day) };
}

export function waterCost(state: Counter): number {
  return nightlyWater(state).cost;
}

export function atFirstChapterSummary(state: Counter) {
  return state.day === secondChapterStart && !state.chapterTwoStarted && !state.waterShortfall;
}

export function portBulletin(state: Counter) {
  if (state.economy !== 'port') return harborNotice;
  return state.harborSchedule === 'late' ? portNotice : onTimePortNotice;
}

export function winchBulletin(state: Counter) {
  if (state.economy !== 'port') return `换好齿轮：${winchBuyers}${wornWinch.observations[1]}`;
  const orderDay = winchOrderDay(state.economy, state.harborSchedule);
  return `第 9 天留港船工收，换好齿轮 108 元，待修 88 元。第 ${orderDay} 天船厂采购收，换好齿轮 155 元，待修 115 元。`;
}

export function counterNotes(state: Counter) {
  const notes: { id: string; day: number; title: string; text: string }[] = [];
  const visit = !state.awaitingOpen ? currentVisit(state.day, state.visitIndex) : undefined;
  const timerItem = itemDetails('timer-1')!;
  const timer = state.economy === 'port' ? portItem(timerItem) : timerItem;
  if (state.knowsMechanicRequest) {
    notes.push({ id: 'mechanic', day: 2, title: '修理匠留下的求购字条', text: state.economy === 'port' ? portMechanicRequest : mechanicRequest });
  }
  if (state.sawTimerClues || visit?.id === 'day-3-timer' || state.tickets.some((ticket) => ticket.item.id === timer.id)) {
    notes.push({ id: 'timer', day: 3, title: '跑船客的计时器线索', text: timer.observations.join('') + (timer.reference ?? '') });
  }
  if (state.chapterTwoStarted) {
    notes.push({ id: state.economy === 'port' ? 'port' : 'water', day: 6, title: '港务告示', text: portBulletin(state) });
    if (state.day > 6 || (state.day === 6 && !state.awaitingOpen)) {
      notes.push({ id: 'board', day: 6, title: '旧电路板的买家字条', text: `第 7 天${state.economy === 'port' ? '检修工' : '钟表师'}出 55 元，第 9 天船工出 ${lateBoardPrice} 元。` });
    }
    if (state.day > 8 || (state.day === 8 && !state.awaitingOpen)) {
      notes.push({ id: 'winch', day: 8, title: '绞盘买家留条', text: winchBulletin(state) });
    }
  }
  return notes;
}

export function harborOpen(state: Counter) {
  return state.day >= secondChapterStart && state.day <= lastDay && state.chapterTwoStarted &&
    !state.awaitingOpen && !state.waterShortfall;
}

function updateConsignment(state: Counter, action: Extract<Action, { type: 'listItem' | 'unlistItem' }>): Result {
  if (!harborOpen(state) || state.day !== action.day || state.day === lastDay) {
    return notice(state, '今天已无法登记明日寄售。', 'warning');
  }
  if (action.type === 'unlistItem') {
    if (state.consignment?.itemId !== action.itemId) return notice(state, '这件货当前没有挂售。', 'warning');
    const next = { ...state };
    delete next.consignment;
    return notice(next, '已撤下寄售，货物仍在自有库存。');
  }
  if (state.consignment) return notice(state, '寄售架已有一件货，可以撤下后换货或改价。', 'warning');
  const item = state.inventory.find((entry) => entry.id === action.itemId);
  if (!item || !consignmentPrices(item)?.includes(action.price)) return notice(state, '这件货或报价无法寄售。', 'warning');
  return notice({ ...state, consignment: { itemId: item.id, price: action.price, listedDay: state.day } },
    `已挂售${item.name} ${action.price} 元，第 ${state.day + 1} 天开门时有结果。`, 'success');
}

function settleOpening(state: Counter): Result {
  const next = { ...state, awaitingOpen: false, knowsMechanicRequest: state.knowsMechanicRequest || state.day === 2 };
  const greeting = `第 ${state.day} 天开始营业。`;
  const listing = next.consignment;
  if (!listing || listing.listedDay >= state.day) return notice(next, greeting);
  delete next.consignment;
  const item = next.inventory.find((entry) => entry.id === listing.itemId);
  if (!item) return notice(next, greeting);
  const budget = consignmentBudget(item, state.day, state.harborSchedule === 'late');
  if (budget === undefined || budget < listing.price) {
    return notice(record(next, item, `寄售未成交 · ${item.name}`, 0),
      `${greeting}${item.name}报价 ${listing.price} 元，买家最多出 ${budget ?? 0} 元，货仍在库。`);
  }
  next.inventory = next.inventory.filter((entry) => entry.id !== item.id);
  return notice(record(next, item, `寄售成交 · ${item.name}`, listing.price),
    `${greeting}寄售的${item.name}成交，到账 ${listing.price} 元。`, 'success');
}

export function harborStock(state: Counter) {
  return harborGoods.map((good) => {
    const peak = good.item.id === 'harbor-rope' ? 8 : 9;
    const bids = state.harborSchedule === 'late'
      ? { ...good.bids, [peak]: good.bids[peak + 1], [peak + 1]: good.bids[peak] }
      : good.bids;
    return {
      ...good, bids,
      held: state.inventory.find((item) => item.id === good.item.id),
      bought: state.ledger.some((entry) => entry.itemId === good.item.id && entry.description.startsWith('货摊购入')),
    };
  });
}

function tradeAtHarbor(state: Counter, action: Extract<Action, { type: 'harborBuy' | 'harborSell' }>): Result {
  if (!harborOpen(state) || state.day !== action.day) return notice(state, '货摊当前未营业。', 'warning');
  const good = harborStock(state).find(({ item }) => item.id === action.itemId);
  if (!good) return notice(state, '货摊没有这件货。', 'warning');
  const { item, held, bought, asks, bids } = good;
  if (action.type === 'harborBuy') {
    const cost = asks[state.day];
    if (cost === undefined || bought || held) return notice(state, '这件货当前买不到。', 'warning');
    if (state.cash < cost) return notice(state, `现金不足，还差 ${cost - state.cash} 元。`, 'warning');
    return notice(record({ ...state, inventory: [...state.inventory, { ...item, cost }] },
      item, `货摊购入 · ${item.name}`, -cost), `已花 ${cost} 元购入${item.name}。`, 'success');
  }
  const price = bids[state.day];
  if (!held || price === undefined) return notice(state, '手上没有这件货，或今天无人收。', 'warning');
  return notice(record({ ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) },
    item, `货摊售出 · ${item.name}`, price), `已卖出${item.name}，收到 ${price} 元。`, 'success');
}

function closeDay(state: Counter, { day, confirmShortfall }: Extract<Action, { type: 'close' }>): Result {
  if (day !== state.day || day > lastDay || state.awaitingOpen || currentVisit(day, state.visitIndex, state.economy, state.harborSchedule)) {
    return notice(state, '当前无法打烊。', 'warning');
  }
  const cost = waterCost(state);
  const waterShortfall = Math.max(0, cost - state.cash);
  if (day >= secondChapterStart && waterShortfall && !confirmShortfall) {
    return notice(state, `水费还差 ${waterShortfall} 元。`, 'warning');
  }
  let next = state;
  const expired = [];
  for (const ticket of state.tickets) {
    if (ticket.status !== 'held' || ticket.dueDay > day) continue;
    expired.push(ticket.item.name);
    next = record({
      ...next,
      tickets: next.tickets.map((entry) => entry.id === ticket.id ? { ...entry, status: 'expired' } : entry),
      inventory: [...next.inventory, { ...ticket.item, cost: ticket.principal }],
    }, ticket.item, `逾期入库 · ${ticket.item.name}`, 0);
  }
  let message = expired.length
    ? `第 ${day} 天已打烊。${expired.join('、')}逾期归店，现金无变动。`
    : `第 ${day} 天已打烊。`;
  if (!waterShortfall && cost) {
    next = record(next, null, waterLedger.purchase, -cost);
    message += `已支付水费 ${cost} 元。`;
  } else if (next.economy !== 'port' && day >= waterStartDay && next.installedPurifier) {
    if (day >= secondChapterStart) next = record(next, null, waterLedger.purifier, 0);
    message += '净水机供水，今晚无需现场买水。';
    if (next.reservedWaterDay === day) {
      if (day >= secondChapterStart) next = record(next, null, waterLedger.unused, 0);
      message += '当天的水票到期，预付款已计入支出。';
    }
  } else if (next.reservedWaterDay === day) {
    if (day >= secondChapterStart) next = record(next, null, waterLedger.ticket, 0);
    message += '使用昨天预订的水，今晚无需现场买水。';
  }
  const closed = { ...next, day: day + 1, awaitingOpen: true, visitIndex: 0, attempts: 0, waterShortfall };
  if (closed.reservedWaterDay === day) delete closed.reservedWaterDay;
  if (waterShortfall) {
    delete closed.consignment;
    return notice(closed, `无法支付水费，还差 ${waterShortfall} 元。经营中断。`, 'warning');
  }
  return notice(closed, message, 'success');
}

function disposeItem(state: Counter, action: Extract<Action, { type: 'recycle' | 'install' }>): Result {
  if (state.day !== action.day || state.day < waterStartDay || state.day > lastDay || state.awaitingOpen) {
    return notice(state, '当前无法处理库存。', 'warning');
  }
  const item = state.inventory.find((entry) => entry.id === action.itemId);
  if (!item) return notice(state, '只有归店的库存可以处理。', 'warning');
  const next = { ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) };
  if (action.type === 'install') {
    if (state.economy === 'port' || state.installedPurifier || !usablePurifier(item)) return notice(state, '当前无法安装这件设备。', 'warning');
    return notice(record({ ...next, installedPurifier: item }, item, `安装 · ${item.name}`, 0),
      'F2 净水机已装进庇护所，今天打烊可以免付水费。', 'success');
  }
  if (item.recyclePrice === undefined) return notice(state, '回收商不收这件物品。', 'warning');
  const profit = item.recyclePrice - item.cost;
  const outcome = profit < 0 ? `单件亏 ${-profit} 元` : `单件毛利 ${profit} 元`;
  return notice(record(next, item, `回收 · ${item.name}（${outcome}）`, item.recyclePrice),
    `${item.name}已回收，到账 ${item.recyclePrice} 元，${outcome}。`, 'success');
}

export function settleVisit(state: Counter, action: Action): Result {
  if (action.type === 'readNotes') {
    const ids = counterNotes(state).map((note) => note.id);
    if (state.day !== action.day || ids.every((id) => state.readNoteIds?.includes(id))) return notice(state, '');
    return notice({ ...state, readNoteIds: [...new Set([...(state.readNoteIds ?? []), ...ids])] }, '');
  }
  if (action.type === 'listItem' || action.type === 'unlistItem') return updateConsignment(state, action);
  if (action.type === 'harborBuy' || action.type === 'harborSell') return tradeAtHarbor(state, action);
  if (action.type === 'close') return closeDay(state, action);
  if (action.type === 'continue') {
    if (action.day !== state.day || !state.awaitingOpen || !atFirstChapterSummary(state)) return notice(state, '当前无法继续营业。', 'warning');
    return notice({ ...state, chapterTwoStarted: true, ...(action.upgrade ? { economy: 'port' as const } : {}) }, '第二章 · 港务字条已送达');
  }
  if (action.type === 'reclaimPurifier') {
    const item = state.installedPurifier;
    if (action.day !== state.day || !harborOpen(state) || state.economy !== 'port' || !item ||
        state.inventory.some((entry) => entry.id === item.id)) return notice(state, '当前没有可拆回的净水机。', 'warning');
    return notice(record({ ...state, installedPurifier: null, inventory: [...state.inventory, item] },
      item, '拆回 · F2 净水机', 0), 'F2 已拆回自有库存。', 'success');
  }
  if (action.type === 'open') {
    if (state.day !== action.day || state.day > lastDay || !state.awaitingOpen || state.waterShortfall || atFirstChapterSummary(state)) {
      return notice(state, '当前无法开门。', 'warning');
    }
    return settleOpening(state);
  }
  if ('itemId' in action) return disposeItem(state, action);
  if (state.awaitingOpen) return notice(state, '请先开门。', 'warning');
  const visit = currentVisit(state.day, state.visitIndex, state.economy, state.harborSchedule);
  if (!visit || visit.id !== action.visitId) return notice(state, '这位客人已经离开。');

  if (action.type === 'sellBoard' && visit.id === 'day-9-winch') {
    const item = state.inventory.find((entry) => entry.id === board.id);
    if (!item) return notice(state, '库存里没有可出售的电路板。', 'warning');
    const next = record({ ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) },
      item, '售出旧电路板', lateBoardPrice);
    return notice(next, `船工为电路板付了 ${lateBoardPrice} 元，绞盘的报价也还有效。`, 'success');
  }

  if (action.type === 'dismiss') {
    if (visit.kind === 'timerBuyer' || visit.kind === 'waterReserve') {
      return notice(advance(state), `${visit.person}收起东西，向你道别。`);
    }
    if (visit.kind === 'sale' || visit.kind === 'redeem') {
      const available = visit.kind === 'sale'
        ? saleOffer(state, visit).item
        : heldTicket(state, visit);
      return notice(advance(state), available ? visit.id === 'day-10-winch'
        ? '修理匠说你可以先留着绞盘，他按约来过了。' : `${visit.person}离开了。` :
        visit.kind === 'sale' ? saleOffer(state, visit).issue : visit.missing);
    }
    return notice(advance(state), `你谢绝了这笔生意。${visit.person}带着${visit.item.name}离开了。`);
  }

  if (visit.kind === 'pawn' && visit.id === 'day-3-timer' && visit.item.authenticity === 'imitation') {
    if (action.type === 'appraiseTimer' && !state.timerAppraised) {
      return notice({ ...state, timerAppraised: true }, '你指出了批次不符。跑船客愿意把它按仿品卖断。');
    }
    if (action.type === 'buyImitation' && state.timerAppraised) {
      if (state.cash < imitationPurchasePrice) {
        return notice(state, `现金不足，还差 ${imitationPurchasePrice - state.cash} 元。`, 'warning');
      }
      const item = visit.item;
      const next = record({
        ...advance(state), inventory: [...state.inventory, { ...item, cost: imitationPurchasePrice }],
      }, item, '买断仿品 · 船用计时器', -imitationPurchasePrice);
      return notice(next, `付 ${imitationPurchasePrice} 元买断 T8，货已归店。`, 'success');
    }
  }

  if (visit.kind === 'timerBuyer' && (action.type === 'sellTimerHonestly' || action.type === 'sellTimerAsGenuine')) {
    const item = ownedImitation(state, visit.item);
    if (!item) return notice(state, '柜台没有可出售的仿制 T8。', 'warning');
    const misrepresented = action.type === 'sellTimerAsGenuine';
    const price = misrepresented ? falseTimerPrice : honestTimerPrice;
    const next = record({
      ...advance(state), inventory: state.inventory.filter((entry) => entry.id !== item.id),
      misrepresentedTimer: state.misrepresentedTimer || misrepresented,
    }, item, misrepresented ? '冒充正品售出 T8' : '如实售出仿制 T8', price);
    return notice(next, `船工付了 ${price} 元，带着 T8 离开。`, 'success');
  }

  if (visit.kind === 'waterReserve' && action.type === 'reserveWater') {
    if (state.reservedWaterDay === visit.supplyDay) return notice(state, '这一天的水已预订。', 'warning');
    if (state.cash < waterReservePrice) {
      return notice(state, `现金不足，还差 ${waterReservePrice - state.cash} 元。`, 'warning');
    }
    const next = record({ ...advance(state), reservedWaterDay: visit.supplyDay }, null, waterLedger.reservation, -waterReservePrice);
    return notice(next, `已付 ${waterReservePrice} 元，预订第 ${visit.supplyDay} 天的用水。`, 'success');
  }

  if (action.type === 'sell' && visit.kind === 'sale') {
    const { item, issue, price } = saleOffer(state, visit);
    if (!item) return notice(state, issue, 'warning');
    const stillBuyingBoard = visit.id === 'day-9-winch' && state.inventory.some((entry) => entry.id === board.id);
    const next = record({
      ...(stillBuyingBoard ? state : advance(state)), inventory: state.inventory.filter((entry) => entry.id !== item.id),
    }, item, `售出${item.name}`, price);
    return notice(next, `成交。${visit.person}支付 ${price} 元，带走了${item.name}。`, 'success');
  }

  if (action.type === 'redeem' && visit.kind === 'redeem') {
    const ticket = heldTicket(state, visit);
    if (!ticket) return notice(state, visit.missing, 'warning');
    const next = record({
      ...advance(state),
      tickets: state.tickets.map((entry) => entry.id === ticket.id ? { ...entry, status: 'redeemed' } : entry),
    }, ticket.item, `赎回${ticket.item.name}`, ticket.redeemPrice);
    return notice(next, `收到赎回款 ${ticket.redeemPrice} 元。${ticket.item.name}已归还，当票已结清。`, 'success');
  }

  if (action.type !== 'offer' || (visit.kind !== 'purchase' && visit.kind !== 'pawn')) {
    return notice(state, '当前无法执行这项交易。', 'warning');
  }

  const { amount } = action;
  if (!visit.offers.includes(amount) || state.attempts >= maxOffers || action.attempt !== state.attempts) {
    return notice(state, '当前无法提交这个报价。', 'warning');
  }
  if (amount > state.cash) {
    return notice(state, `现金不足，还差 ${amount - state.cash} 元。${visit.item.name}仍归${visit.person}。`, 'warning');
  }
  if (amount < visit.minimumPrice) {
    const attempts = state.attempts + 1;
    const nextStep = attempts < maxOffers ? '你还可以改报一次，或谢客。' : '报价次数已用完，可以谢客。';
    return notice({ ...state, attempts }, `${visit.person}拒绝了 ${amount} 元的报价。${nextStep}`, 'warning');
  }

  const next = advance(state);
  if (visit.kind === 'pawn') {
    const ticket: Ticket = {
      id: visit.id, borrower: visit.person, item: visit.item, principal: amount,
      redeemPrice: visit.redeemPrice, dueDay: visit.dueDay, status: 'held',
    };
    return notice(
      record({ ...next, tickets: [...state.tickets, ticket] }, visit.item, `典当放款 · ${visit.item.name}`, -amount),
      `放款 ${amount} 元。${visit.item.name}进入代管，最后赎回日为第 ${visit.dueDay} 天。` +
      (visit.item.authenticity === 'imitation' ? '入账复核显示这件货是仿品。' : ''), 'success',
    );
  }
  const item = visit.id === 'day-8-winch' && amount === wornWinchPrice
    ? state.economy === 'port' ? { ...wornWinch, observations: [...portItem(wornWinch).observations.slice(0, 1), wornWinch.observations[0]] } : wornWinch
    : visit.item;
  return notice(
    record({ ...next, inventory: [...state.inventory, { ...item, cost: amount }] }, item, `收购${item.name}`, -amount),
    `成交。支付 ${amount} 元，${item.name}已收入库存。`, 'success',
  );
}
