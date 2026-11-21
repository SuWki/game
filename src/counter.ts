import { currentVisit, disputedPurifierPrice, emergencyWaterDay, emergencyWaterPrice, falseTimerPrice, honestTimerPrice, imitationPurchasePrice, lastDay, maxOffers, openingCash, purifierModel, secondChapterStart, waterPrice, waterReservePrice, waterStartDay, type Item, type Visit } from './scenario.ts';
import { board, consignmentBudget, consignmentPrices, harborGoods, lateBoardPrice, wornWinch, wornWinchEarlyPrice, wornWinchLatePrice, wornWinchPrice } from './scenario.ts';
import { harborNotice, itemDetails, mechanicRequest, onTimePortNotice, portItem, portMechanicRequest, portNotice, winchBuyers, winchOrderDay } from './scenario.ts';
import { baseItemId, portRound, repairedWinch, roundEnd, roundLength, roundRepairStock, roundStart } from './scenario.ts';
import { crateCost, cratePartId, cratePartPrice, salvageCrate, salvageWindow, sealedCrateId, sealedCratePrice, unpackCrate } from './scenario.ts';
import { boatFee, cashReserve, filterGrades, filterOffer, firstOutingDay, outingLimit, voyageExpense, voyageResult, voyageRoll, waterJobPay, winchUpgradeCost, type Voyage } from './outing.ts';
import { berthFee, boardingWater, cargoGoods, cargoId, cargoKind, cargoQuote, floatFarmOrder, shipSaleQuote, waterPacks } from './ship.ts';
import { shipStop } from './ship.ts';
import { boatBuildItems, boatMaterials, boatWorkLog, boatWorks, careerLog, careerVisit, dwelling, laundryOrder,
  laundryPrice, materialJobPrice, materialKind, mechanicTicket, playerBoat, saltPen, shipNight } from './career.ts';
import { cutOrders, cutQuote, jadeGrades, lampCost, pickStone, stoneExpense, stoneFee, type CutKind, type CutPlacement, type StoneTrip } from './jade.ts';

export const waterLedger = {
  purchase: '买水', reservation: '预订用水', purifier: 'F2 集雨供水', ticket: '水票抵扣', unused: '水票到期未使用',
} as const;

type InventoryItem = Item & { cost: number };
export type WorkshopOrder = { kind: 'repair' | 'rent'; item: InventoryItem; dueDay: number };
export type JadeOrder = { item: InventoryItem; kind: CutKind; dueDay: number; payout: number };
export const repairFee = 22;
export const rentalFee = 12;
export const rentalDays = 3;
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
  ship?: { water: number; reliefLeg?: number; closed?: true };
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
  activeRoundStart?: number;
  workshopOrders?: WorkshopOrder[];
  outingSeed?: number;
  hasOutingWinch?: true;
  voyage?: Voyage;
  stoneTrip?: StoneTrip;
  hasJadeLamp?: true;
  jadeOrders?: JadeOrder[];
  mountedFilter?: InventoryItem;
  waterJobDay?: number;
  f2Appointment?: { day: number; status: 'booked' | 'closed' };
  fuseReferral?: 'accepted' | 'paid';
  consignment?: { itemId: string; price: number; listedDay: number };
  readNoteIds?: string[];
  installedPurifier: InventoryItem | null;
  waterShortfall: number;
};

export type Action =
  | CareerAction
  | { type: 'boardShip' | 'shipRelief'; day: number }
  | { type: 'buyWater' | 'buyCargo'; day: number; choice: number }
  | { type: 'sellCargo'; day: number; itemId: string }
  | { type: 'deliverFloatFarmSeal'; day: number; itemId: string }
  | { type: 'offer'; visitId: string; attempt: number; amount: number }
  | { type: 'dismiss' | 'sell' | 'redeem' | 'sellBoard'; visitId: string }
  | { type: 'appraiseTimer' | 'buyImitation' | 'sellTimerHonestly' | 'sellTimerAsGenuine' | 'reserveWater'; visitId: string }
  | { type: 'recycle' | 'install'; day: number; itemId: string }
  | { type: 'harborBuy'; day: number; itemId: string }
  | { type: 'harborSell'; day: number; itemId: string }
  | { type: 'listItem'; day: number; itemId: string; price: number }
  | { type: 'unlistItem'; day: number; itemId: string }
  | { type: 'readNotes'; day: number }
  | { type: 'bookF2' | 'deliverF2' | 'declineF2' | 'acceptReferral' | 'referSupplier'; day: number; supplier?: 'workshop' | 'boat' }
  | { type: 'open'; day: number }
  | { type: 'continue'; day: number; upgrade?: true }
  | { type: 'reclaimPurifier'; day: number }
  | { type: 'roundReferral'; day: number }
  | { type: 'sendRepair'; day: number; itemId: string }
  | { type: 'rentF2'; day: number; itemId: string }
  | { type: 'buyRepairStock' | 'sellRepairStock'; day: number }
  | { type: 'buyCrate'; day: number }
  | { type: 'openCrate'; day: number; itemId: string }
  | { type: 'sellCrateGoods'; day: number; itemId: string }
  | { type: 'bookRopeVisit'; day: number }
  | { type: 'dismissRopeVisit'; day: number }
  | { type: 'deliverRope'; day: number; itemId: string }
  | { type: 'bookVoyage' | 'buyOutingWinch'; day: number }
  | { type: 'bookMaterialTrip'; day: number }
  | { type: 'bookStoneTrip' | 'buyJadeLamp'; day: number }
  | { type: 'openJade'; day: number; itemId: string }
  | { type: 'sellJade'; day: number; itemId: string }
  | { type: 'sendJade'; day: number; itemId: string; kind: CutKind; placements: CutPlacement[] }
  | { type: 'removeFilter' | 'takeWaterJob' | 'fillShipWater'; day: number }
  | { type: 'revealVoyage'; day: number; stage: 0 | 1 }
  | { type: 'mountFilter'; day: number; itemId: string }
  | { type: 'sellFilter'; day: number; itemId: string }
  | { type: 'close'; day: number; confirmShortfall?: boolean };

type CareerAction = { type: 'career'; day: number; task:
  'pawn' | 'pass' | 'extend' | 'refuse' | 'redeem' | 'reunion' | 'bookLaundry' | 'cancelLaundry' | 'laundry' | 'declineLaundry' | 'materialJob' |
  'claim' | 'buy' | 'build' | 'home' | 'mother' | 'host' | 'transfer' | 'farewell' | 'stay' | 'mend';
  choice?: number; itemId?: string; onBoat?: boolean };

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

function record(state: Counter, item: Item | null, description: string, change: number, day = state.day): Counter {
  const cash = state.cash + change;
  const next = {
    ...state, cash,
    ledger: [...state.ledger, { day, itemId: item?.id ?? null, description, change, balance: cash }],
  };
  if (item && next.consignment?.itemId === item.id && !next.inventory.some((entry) => entry.id === item.id)) {
    delete next.consignment;
  }
  return next;
}

export function outingPlan(state: Counter) {
  if (!state.awaitingOpen || state.economy !== 'port' || state.outingSeed === undefined || atRoundSummary(state)) return;
  const first = roundStart(state.day);
  const used = state.ledger.filter((entry) => (entry.description === voyageExpense || entry.description === stoneExpense) &&
    entry.day + 1 >= first && entry.day + 1 <= state.day).length;
  const rent = state.workshopOrders?.some((order) => order.kind === 'rent' && order.dueDay === state.day) ? rentalFee : 0;
  const listed = state.inventory.find((item) => item.id === state.consignment?.itemId);
  const guaranteedSale = listed && consignmentPrices(listed)?.[0] === state.consignment?.price ? state.consignment?.price ?? 0 : 0;
  const jadePayout = (state.jadeOrders ?? []).filter((order) => order.dueDay === state.day)
    .reduce((sum, order) => sum + order.payout, 0);
  return { remaining: Math.max(0, outingLimit - used), knownReceipts: rent + guaranteedSale + jadePayout,
    boatShortfall: Math.max(0, boatFee + cashReserve - state.cash),
    gearShortfall: Math.max(0, winchUpgradeCost + cashReserve - state.cash),
    stoneShortfall: Math.max(0, stoneFee + cashReserve - state.cash),
    lampShortfall: Math.max(0, lampCost + cashReserve - state.cash) };
}

function planOuting(state: Counter, action: Extract<Action, { type: 'bookVoyage' | 'bookMaterialTrip' | 'buyOutingWinch' | 'revealVoyage' | 'bookStoneTrip' | 'buyJadeLamp' }>): Result {
  const plan = outingPlan(state);
  if (state.day !== action.day || !plan || state.outingSeed === undefined) return notice(state, '请在打烊后规划出海。', 'warning');
  if (action.type === 'revealVoyage') {
    const voyage = state.voyage;
    if (!voyage || voyage.stage !== action.stage || (voyage.grade === 'empty' && action.stage === 1)) return notice(state, '');
    return notice({ ...state, voyage: { ...voyage, stage: action.stage === 0 ? 1 : 2 } }, '船已返港。');
  }
  if (state.voyage || state.stoneTrip) return notice(state, '明早的行程已订好。', 'warning');
  if (action.type === 'buyJadeLamp') {
    if (state.hasJadeLamp) return notice(state, '店里已有透光灯。', 'warning');
    if (plan.lampShortfall) return notice(state, `留足周转金还差 ${plan.lampShortfall} 元。`, 'warning');
    return notice(record({ ...state, hasJadeLamp: true }, null, '装备 · 挑料透光灯', -lampCost, state.day - 1),
      '透光灯已买下，之后挑石都可使用。', 'success');
  }
  if (action.type === 'buyOutingWinch') {
    if (state.hasOutingWinch) return notice(state, '店里已有定位绞具。', 'warning');
    if (plan.gearShortfall) return notice(state, `留足周转金还差 ${plan.gearShortfall} 元。`, 'warning');
    return notice(record({ ...state, hasOutingWinch: true }, null, '装备 · 定位绞具', -winchUpgradeCost, state.day - 1),
      '定位绞具已买下，之后出海都可使用。', 'success');
  }
  if (!plan.remaining) return notice(state, '本轮船位已用完。', 'warning');
  if (action.type === 'bookStoneTrip') {
    if (plan.stoneShortfall) return notice(state, `留足周转金还差 ${plan.stoneShortfall} 元。`, 'warning');
    const stoneTrip = { day: state.day, jade: pickStone(state.outingSeed, state.day, state.hasJadeLamp === true) };
    return notice(record({ ...state, stoneTrip }, null, stoneExpense, -stoneFee, state.day - 1),
      `已付 ${stoneFee} 元。第 ${state.day} 天清晨带原石回店。`, 'success');
  }
  if (plan.boatShortfall) return notice(state, `留足周转金还差 ${plan.boatShortfall} 元。`, 'warning');
  if (action.type === 'bookMaterialTrip' && (!state.ship || !playerBoat(state).claimed)) return notice(state, '先在船坞认领泊位。', 'warning');
  const equipped = state.hasOutingWinch === true;
  const grade = voyageResult(voyageRoll(state.outingSeed, state.day, equipped), equipped);
  const voyage: Voyage = { day: state.day, grade, stage: 0, ...(action.type === 'bookMaterialTrip' ? { target: 'materials' as const } : {}) };
  return notice(record({ ...state, voyage }, null, voyageExpense, -boatFee, state.day - 1),
    `已付 ${boatFee} 元船费。第 ${state.day} 天清晨返港。`, 'success');
}

function handleJade(state: Counter, action: Extract<Action, { type: 'openJade' | 'sellJade' | 'sendJade' }>): Result {
  if (state.day !== action.day || !workshopOpen(state)) return notice(state, '请在营业中处理原石。', 'warning');
  const item = state.inventory.find((entry) => entry.id === action.itemId);
  if (!item?.jade) return notice(state, '这块料已离开库存。', 'warning');
  const grade = jadeGrades[item.jade.grade];
  if (action.type === 'openJade') {
    if (item.jade.opened) return notice(state, '这块料已经开过窗。', 'warning');
    const opened = { ...item, name: `明料 · ${grade.name}`, condition: grade.name, jade: { ...item.jade, opened: true } };
    return notice({ ...state, inventory: state.inventory.map((entry) => entry.id === item.id ? opened : entry) },
      `开窗见${grade.name}，石铺出 ${grade.price} 元。`, 'success');
  }
  if (!item.jade.opened) return notice(state, '开窗验料后可出售或加工。', 'warning');
  const next = { ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) };
  if (action.type === 'sellJade') {
    return notice(record(next, item, '售货 · 明料', grade.price), `明料已售，到账 ${grade.price} 元。`, 'success');
  }
  const quote = cutQuote(item.jade, action.kind, action.placements);
  if (!quote) return notice(state, '样式不能越界、压裂格或互相重叠。', 'warning');
  if (state.cash < quote.fee) return notice(state, `工钱还差 ${quote.fee - state.cash} 元。`, 'warning');
  const order = { item, kind: action.kind, dueDay: state.day + 1, payout: quote.payout };
  const name = cutOrders[order.kind].name;
  return notice(record({ ...next, jadeOrders: [...(state.jadeOrders ?? []), order] }, item, `加工 · ${name}`, -quote.fee),
    `已付工钱 ${quote.fee} 元，第 ${order.dueDay} 天开门到账 ${order.payout} 元。`, 'success');
}

function handleFilter(state: Counter, action: Extract<Action, { type: 'mountFilter' | 'sellFilter' | 'removeFilter' | 'takeWaterJob' | 'fillShipWater' }>): Result {
  if (state.day !== action.day || !workshopOpen(state)) return notice(state, '请在营业中处理滤芯。', 'warning');
  const mounted = state.mountedFilter;
  if (action.type === 'fillShipWater' || action.type === 'takeWaterJob' || action.type === 'removeFilter') {
    if (!mounted?.filter) return notice(state, '机架上没有滤芯。', 'warning');
    if (action.type === 'removeFilter') {
      const next = { ...state, inventory: [...state.inventory, mounted] };
      delete next.mountedFilter;
      return notice(next, '滤芯已拆回库存。', 'success');
    }
    if (state.waterJobDay === state.day || (action.type === 'fillShipWater' && !state.ship)) return notice(state, '今天无法再用机架制水。', 'warning');
    const remaining = mounted.filter.remaining - 1;
    const next = { ...state, waterJobDay: state.day };
    if (remaining) next.mountedFilter = { ...mounted, filter: { ...mounted.filter, remaining } };
    else delete next.mountedFilter;
    const ownWater = action.type === 'fillShipWater' && state.ship;
    if (ownWater) next.ship = { ...ownWater, water: ownWater.water + 3 };
    const paid = ownWater ? record(next, mounted, '淡化自用 · 三日饮水', 0) : record(next, mounted, '制水服务 · 船厂订单', waterJobPay);
    return notice(remaining ? paid : record(paid, mounted, '滤芯用尽 · 报废', 0),
      `${ownWater ? '三日饮水已入柜。' : `制水到账 ${waterJobPay} 元。`}${remaining ? `滤芯还可用 ${remaining} 次。` : '滤芯已用尽并报废。'}`, 'success');
  }
  const itemId = 'itemId' in action ? action.itemId : undefined;
  const item = state.inventory.find((entry) => entry.id === itemId);
  if (!item?.filter) return notice(state, '自有库存里没有这枚滤芯。', 'warning');
  const next = { ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) };
  if (action.type === 'mountFilter') {
    if (mounted) next.inventory.push(mounted);
    return notice({ ...next, mountedFilter: item }, mounted ? '新滤芯已装好，旧芯已保留余次并拆回库存。' : '滤芯已装好，可在淡化机架接制水单。', 'success');
  }
  const price = filterOffer(item.filter);
  return notice(record(next, item, `售货 · ${item.name}`, price), `滤芯已售，到账 ${price} 元。`, 'success');
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
    const item = state.inventory.find((item) => item.id === visit.item.id) ??
      (visit.sameKind ? state.inventory.find((item) => baseItemId(item.id) === baseItemId(visit.item.id) &&
        item.condition === visit.item.condition) : undefined);
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

export function atRoundSummary(state: Counter) {
  return state.economy === 'port' && state.day > lastDay && state.awaitingOpen &&
    state.day === roundStart(state.day) && state.activeRoundStart !== state.day;
}

export function pastLastDay(state: Counter) {
  return state.day > lastDay && state.economy !== 'port';
}

export function consignmentOpen(state: Counter) {
  return !state.awaitingOpen && state.chapterTwoStarted && state.day >= secondChapterStart &&
    (state.economy === 'port' || state.day < lastDay) && !state.waterShortfall;
}

export function workshopOpen(state: Counter) {
  return state.economy === 'port' && consignmentOpen(state);
}

export function workshopEligibility(state: Counter, item: InventoryItem) {
  if (!workshopOpen(state)) return undefined;
  const repair = baseItemId(item.id) === 'winch-1' && item.condition === wornWinch.condition;
  const rentedThisRound = state.ledger.some((entry) => entry.day >= roundStart(state.day) && entry.description === '设备借出 · F2 净水机');
  const kind = repair ? 'repair' : usablePurifier(item) && !rentedThisRound ? 'rent' : undefined;
  return kind && !state.workshopOrders?.some((order) => order.kind === kind) ? kind : undefined;
}

export function repairMarket(state: Counter) {
  if (!workshopOpen(state) || state.day <= lastDay || portRound(roundStart(state.day), state.harborSchedule).title !== '岸电检修') return;
  const stock = roundRepairStock(state.day);
  const start = roundStart(state.day);
  const owned = state.inventory.find((item) => baseItemId(item.id) === 'winch-1');
  return {
    stock, owned,
    canBuy: state.day < start + 3 && !state.ledger.some((entry) => entry.itemId === stock.id),
    canSell: state.day >= start + 3 && !state.ledger.some((entry) => entry.day >= start && entry.description === '工班收购 · 码头绞盘'),
    price: owned?.condition === wornWinch.condition ? wornWinchLatePrice : 155,
  };
}

export function salvageMarket(state: Counter) {
  const start = roundStart(state.day);
  if (!workshopOpen(state) || state.day <= lastDay || portRound(start, state.harborSchedule).title !== '夜航补给') return;
  const stock = salvageCrate(state.day, state.harborSchedule);
  const window = salvageWindow(state.day, state.harborSchedule);
  const bought = state.ledger.some((entry) => entry.itemId === stock.id);
  return {
    stock, window, bought,
    canBuy: state.day < window.first && !bought,
    canSell: state.day >= window.first,
    buyers: state.inventory.filter((item) => sealedCrateId.test(item.id) || cratePartId.test(item.id))
      .map((item) => ({ item, price: sealedCrateId.test(item.id) ? sealedCratePrice : cratePartPrice(item) })),
  };
}

const salvageSalePrefix = '货棚收购 · ';
const ropeBooking = '约见 · 搬运班';
const ropeDelivery = '搬运班收购 · 盐霜短绳';
const ropeDismissal = '搬运班回访 · 未交货';
const ropeLead = '货棚伙计说：“下趟搬运班要捆菜筐。带盐霜的短绳也能用，有的话给他们留一盘。”';
export const ropeVisitPrice = 15;
export const isShortRope = (item: Item) => /^round-\d+-crate-harbor-rope$/.test(item.id) && item.condition === '有盐霜，仅能截短用';

function salvageDelivery(state: Counter, start: number) {
  return state.ledger.find((entry) => entry.day >= start && entry.day <= roundEnd(start) && entry.change > 0 &&
    entry.description.startsWith(salvageSalePrefix) && entry.itemId &&
    (sealedCrateId.test(entry.itemId) || cratePartId.test(entry.itemId)));
}

export function ropeVisit(state: Counter) {
  if (state.ship?.closed || !workshopOpen(state) || state.day <= lastDay) return;
  const start = roundStart(state.day);
  const source = start - roundLength;
  if (source <= lastDay || !salvageDelivery(state, source)) return;
  const history = state.ledger.filter((entry) => entry.day >= start);
  const bookingDeadline = start + 2;
  const booking = history.find((entry) => entry.description === ropeBooking);
  const dueDay = booking ? booking.day + 1 : undefined;
  const item = state.inventory.find(isShortRope);
  const canBook = !booking && state.day <= bookingDeadline;
  const done = history.some((entry) => entry.description === ropeDelivery || entry.description === ropeDismissal);
  const today = dueDay === state.day && !done;
  const terms = `搬运班拿带盐霜的短绳捆菜筐，一盘出 ${ropeVisitPrice} 元。第 ${start}–${bookingDeadline} 天可联系，约好后次日到柜台验货。`;
  const status = history.some((entry) => entry.description === ropeDelivery) ? '已交货。'
    : done ? '搬运班已离开。'
    : dueDay !== undefined ? `约在第 ${dueDay} 天验货。${state.day > dueDay ? '已错过约见。' : ''}`
    : canBook ? '' : '已过联系日期。';
  return { start, item, canBook, dueDay, today, terms, status };
}

function handleRopeVisit(state: Counter, action: Extract<Action, { type: 'bookRopeVisit' | 'deliverRope' | 'dismissRopeVisit' }>): Result {
  const visit = ropeVisit(state);
  if (!visit || action.day !== state.day) return notice(state, '今天没有这笔搬运班委托。', 'warning');
  if (action.type === 'bookRopeVisit') {
    if (!visit.canBook) return notice(state, '已约见或已过联系日期。', 'warning');
    return notice(record(state, null, ropeBooking, 0), `已联系搬运班，第 ${state.day + 1} 天到柜台验货。`);
  }
  if (!visit.today || currentVisit(state.day, state.visitIndex, state.economy, state.harborSchedule)) {
    return notice(state, '请在约见当天接待完前面的客人。', 'warning');
  }
  if (action.type === 'dismissRopeVisit') {
    return notice(record(state, null, ropeDismissal, 0), visit.item ? '搬运班告辞，短绳仍在库存。' : '柜台没有合用的短绳，搬运班空手离开。');
  }
  const item = state.inventory.find((entry) => entry.id === action.itemId && isShortRope(entry));
  if (!item) return notice(state, '柜台没有合用的自有短绳。', 'warning');
  const next = { ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) };
  return notice(record(next, item, ropeDelivery, ropeVisitPrice), `搬运班收下一盘短绳，到账 ${ropeVisitPrice} 元。`, 'success');
}

function handleSalvage(state: Counter, action: Extract<Action, { type: 'buyCrate' | 'openCrate' | 'sellCrateGoods' }>): Result {
  if (action.day !== state.day || !workshopOpen(state)) return notice(state, '请在营业时处理拆船货。', 'warning');
  if (action.type === 'openCrate') {
    const crate = state.inventory.find((item) => item.id === action.itemId && sealedCrateId.test(item.id));
    if (!crate) return notice(state, '这只封箱已经不在自有库存。', 'warning');
    const parts = unpackCrate(crate, state.harborSchedule);
    const next = { ...state, inventory: [...state.inventory.filter((item) => item.id !== crate.id), ...parts] };
    return notice(record(next, crate, '拆封 · 旧船混装货箱', 0), `已验出三件散货，货棚按成色合计出 ${parts.reduce((sum, part) => sum + cratePartPrice(part), 0)} 元。`, 'success');
  }
  const market = salvageMarket(state);
  if (!market) return notice(state, '今天货棚没有开这档买卖。', 'warning');
  if (action.type === 'buyCrate') {
    if (!market.canBuy) return notice(state, market.bought ? '本轮这箱已经收过了。' : '这批货的收货期已过。', 'warning');
    if (state.cash < crateCost) return notice(state, `收箱还差 ${crateCost - state.cash} 元。`, 'warning');
    const item = market.stock;
    return notice(record({ ...state, inventory: [...state.inventory, { ...item, cost: crateCost }] },
      item, '收购 · 旧船混装货箱', -crateCost), '封箱已入库。保留铅封可整箱转手，也可以开箱查成色。', 'success');
  }
  const sale = market.buyers.find(({ item }) => item.id === action.itemId);
  if (!market.canSell || !sale) return notice(state, '今天没有可结算的这笔货棚收购。', 'warning');
  const lead = salvageDelivery(state, roundStart(state.day)) ? '' : ropeLead;
  return notice(record({ ...state, inventory: state.inventory.filter((item) => item.id !== sale.item.id) },
    sale.item, `${salvageSalePrefix}${sale.item.name}`, sale.price), `成交，到账 ${sale.price} 元。${lead}`, 'success');
}

function sendToWorkshop(state: Counter, action: Extract<Action, { type: 'sendRepair' | 'rentF2' }>): Result {
  const item = state.inventory.find((entry) => entry.id === action.itemId);
  const kind = action.type === 'sendRepair' ? 'repair' : 'rent';
  if (action.day !== state.day || !item || workshopEligibility(state, item) !== kind) {
    return notice(state, '当前无法办理这件货的委托。', 'warning');
  }
  if (kind === 'repair' && state.cash < repairFee) return notice(state, `修理费还差 ${repairFee - state.cash} 元。`, 'warning');
  const dueDay = state.day + (kind === 'repair' ? 1 : rentalDays);
  const order: WorkshopOrder = { kind, item, dueDay };
  const next = {
    ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id),
    workshopOrders: [...(state.workshopOrders ?? []), order],
  };
  const description = kind === 'repair' ? '支付维修费 · 码头绞盘' : '设备借出 · F2 净水机';
  return notice(record(next, item, description, kind === 'repair' ? -repairFee : 0),
    `已交出${item.name}。第 ${dueDay} 天开门归还。`, 'success');
}

function settleWorkshop(next: Counter): Result {
  const due = next.workshopOrders?.filter((order) => order.dueDay <= next.day) ?? [];
  if (!due.length) return notice(next, '');
  let state: Counter = { ...next, workshopOrders: next.workshopOrders?.filter((order) => order.dueDay > next.day) };
  const messages: string[] = [];
  for (const { kind, item } of due) {
    const returned = kind === 'repair' ? repairedWinch({ ...item, cost: item.cost + repairFee }) : item;
    state = record({ ...state, inventory: [...state.inventory, returned] }, returned,
      kind === 'repair' ? '维修归还 · 码头绞盘' : '设备短租 · F2 净水机', kind === 'rent' ? rentalFee : 0);
    messages.push(kind === 'repair' ? '绞盘已修好归库。' : `F2 已归库，到账租金 ${rentalFee} 元。`);
  }
  return notice(state, messages.join(''), 'success');
}

export function roundReferral(state: Counter) {
  if (state.day <= lastDay || state.economy !== 'port' || !consignmentOpen(state)) return undefined;
  const start = roundStart(state.day);
  const repair = portRound(start, state.harborSchedule).title === '岸电检修';
  return {
    paid: state.ledger.some((entry) => entry.day >= start && entry.description === '港口介绍费'),
    available: state.day >= start + 2,
    text: repair ? '修理匠找有放线工具的电工。把货棚的老电工介绍过去。' : '系泊班缺一个通宵看缆的人。把等下一班船的跑船客介绍过去。',
  };
}

export function portBulletin(state: Counter) {
  if (state.economy !== 'port') return harborNotice;
  const bulletin = state.harborSchedule === 'late' ? portNotice : onTimePortNotice;
  return state.ship ? bulletin.replace('水站照常发放居民饮水。', '船上水柜照常营业。') : bulletin;
}

export function winchBulletin(state: Counter) {
  if (state.economy !== 'port') return `换好齿轮：${winchBuyers}${wornWinch.observations[1]}`;
  const orderDay = winchOrderDay(state.economy, state.harborSchedule);
  return `第 9 天留港船工收，换好齿轮 108 元，待修 88 元。第 ${orderDay} 天船厂采购收，换好齿轮 155 元，待修 115 元。`;
}

export function floatFarmRequest(state: Counter) {
  const order = floatFarmOrder;
  if (!state.ship || state.ship.closed || state.day < order.announce) return;
  const filled = state.ledger.some((entry) => entry.description === order.receipt);
  const active = !filled && state.day >= order.first && state.day <= order.last && !state.awaitingOpen;
  const ordinary = cargoQuote(order.first, order.kind).bid;
  const terms = `${order.reason} 第 ${order.first}–${order.last} 天在浮田水站验收一件，现结 ${order.price} 元。普通岸商收 ${ordinary} 元。`;
  const status = filled ? '维修班已收齐。'
    : state.day > order.last ? '加购已截止。'
    : state.day < order.first ? '到站后才可交付。'
    : '本批只收一件。';
  return { active, terms, status };
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
    if (state.economy === 'port' && state.day >= 7) {
      notes.push({ id: 'fuse-referral', day: 7, title: '岸电检修班的代寻委托',
        text: '第 9 天打烊前介绍持有原封 15A 保险丝的货主。两边直接交接，当铺收 12 元介绍费。' });
    }
    if (state.economy === 'port' && state.day > lastDay && !atRoundSummary(state)) {
      const start = roundStart(state.day);
      const round = portRound(start, state.harborSchedule);
      notes.push({ id: `round-${start}`, day: start, title: round.title, text: round.notice });
      const delivery = salvageDelivery(state, start);
      if (delivery) notes.push({ id: `rope-lead-${start}`, day: delivery.day, title: '货棚伙计提到搬运班', text: ropeLead });
      const appointment = ropeVisit(state);
      const noteId = `rope-visit-${start}`;
      if (appointment && (appointment.canBook || appointment.dueDay !== undefined || state.readNoteIds?.includes(noteId))) {
        notes.push({ id: noteId, day: appointment.start, title: '搬运班的短绳委托',
        text: appointment.terms + appointment.status });
      }
    }
  }
  const farm = floatFarmRequest(state);
  if (farm && (state.day <= floatFarmOrder.last || state.readNoteIds?.includes(floatFarmOrder.id))) {
    notes.push({ id: floatFarmOrder.id, day: floatFarmOrder.announce, title: '船员捎来 · 浮田水站加购', text: farm.terms + farm.status });
  }
  const acquainted = state.ledger.find((entry) => entry.description === careerLog.met);
  if (acquainted) notes.push({ id: 'acen-mechanic', day: acquainted.day, title: '浮田机修工阿岑',
    text: '阿岑常搭旧港号去检修种植舱。下次靠浮田时，他会回来看看。' });
  const laundry = laundryOrder(state);
  if (laundry && (laundry.preview || laundry.active)) notes.push({ id: `laundry-${laundry.start}`,
    day: laundry.preview ? laundry.start - 1 : laundry.start, title: laundry.preview ? '阿岑捎来 · 洗衣班采购' : '浮田洗衣班采购',
    text: `第 ${laundry.start}–${laundry.last} 天收一枚至少余两次的滤芯，现场付 ${laundryPrice} 元。` });
  return notes;
}

export function harborOpen(state: Counter) {
  return state.day >= secondChapterStart && state.day <= lastDay && state.chapterTwoStarted &&
    !state.awaitingOpen && !state.waterShortfall;
}

export function portJobs(state: Counter) {
  return state.economy === 'port' && harborOpen(state);
}

export function contactPrice(state: Counter) {
  return state.misrepresentedTimer ? 90 : 110;
}

function handlePortJob(state: Counter, action: Extract<Action, { type: 'bookF2' | 'deliverF2' | 'declineF2' | 'acceptReferral' | 'referSupplier' }>): Result {
  if (!portJobs(state) || action.day !== state.day) return notice(state, '请在新版港口营业时联系。', 'warning');
  if (action.type === 'acceptReferral' || action.type === 'referSupplier') {
    if (state.day < 7 || state.day > 9 || state.fuseReferral === 'paid') return notice(state, '这张委托已结清或过期。', 'warning');
    if (action.type === 'acceptReferral') {
      if (state.fuseReferral) return notice(state, '已接下委托。', 'warning');
      return notice({ ...state, fuseReferral: 'accepted' }, '已接委托。先对照工单和两位货主的封签。');
    }
    if (state.fuseReferral !== 'accepted' || action.supplier !== 'workshop') {
      return notice(state, '检修班只收原封 15A。货主和买家都还在等你核对。', 'warning');
    }
    return notice(record({ ...state, fuseReferral: 'paid' }, null, '岸电检修 · 介绍费', 12),
      '电工交验原封 15A，两边直接成交。你收到介绍费 12 元。', 'success');
  }
  if (action.type === 'bookF2') {
    if (!state.knowsMechanicRequest || state.day >= lastDay || state.f2Appointment) {
      return notice(state, '今天没有可预约的 F2 工单。', 'warning');
    }
    return notice({ ...state, f2Appointment: { day: state.day + 1, status: 'booked' } },
      `已约第 ${state.day + 1} 天验货。届时从「字条与委托」交货。`, 'success');
  }
  const appointment = state.f2Appointment;
  if (appointment?.status !== 'booked' || appointment.day !== state.day) return notice(state, '今天没有这笔验货预约。', 'warning');
  const next = { ...state, f2Appointment: { day: state.day, status: 'closed' as const } };
  if (action.type === 'declineF2') return notice(next, '已告知修理匠本次不交货。');
  const item = state.inventory.find(usablePurifier);
  if (!item) return notice(state, '今天没有可交验的自有 F2。可以先回柜台找货，或告知修理匠没货。', 'warning');
  const price = contactPrice(state);
  next.inventory = state.inventory.filter((entry) => entry.id !== item.id);
  return notice(record(next, item, '预约交货 · F2 净水机', price), `修理匠验过接口，付了 ${price} 元。`, 'success');
}

function updateConsignment(state: Counter, action: Extract<Action, { type: 'listItem' | 'unlistItem' }>): Result {
  if (!consignmentOpen(state) || state.day !== action.day) {
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
  const returned = settleWorkshop({ ...state, awaitingOpen: false, knowsMechanicRequest: state.knowsMechanicRequest || state.day === 2 });
  let next = returned.state;
  let greeting = `第 ${state.day} 天开始营业。${returned.message}`;
  const voyage = state.voyage;
  if (state.stoneTrip) {
    const item = { id: `outing-${state.day}-jade`, name: '待开窗原石', model: '玉料',
      condition: '石皮完整', observations: [], jade: state.stoneTrip.jade, cost: stoneFee };
    next = record({ ...next, stoneTrip: undefined, inventory: [...next.inventory, item] }, item, '返港入库 · 待开窗原石', 0);
    greeting += '原石已放到自有库存，可开窗验料。';
  }
  if (voyage) {
    delete next.voyage;
    if (voyage.grade === 'empty') greeting += '打捞船空手返港。';
    else if (voyage.target === 'materials') {
      const kind = voyage.grade === 'worn' ? 0 : 1;
      const item = { id: `boat-material-${kind}-salvage-${voyage.day}`, name: boatMaterials[kind].name, model: '造船材料',
        condition: '船坞可用', observations: ['可转卖或装到自己的船上。'], recyclePrice: boatMaterials[kind].price - 6, cost: boatFee };
      next = record({ ...next, inventory: [...next.inventory, item] }, item, `返港入库 · ${item.name}`, 0);
      greeting += `${item.name}已入库，可用于造船。`;
    }
    else {
      const grade = filterGrades[voyage.grade];
      const item = {
        id: `voyage-${voyage.day}-filter`, name: `海水淡化滤芯 · ${grade.name}`, model: '海水淡化滤芯',
        condition: grade.name, observations: [state.ship ? '配套生活甲板的淡化机架，可以交制水单或储存自用饮水。' : '可装在船厂的岸上淡化机架，给船队交制水单。'],
        filter: { grade: voyage.grade, remaining: grade.uses }, cost: boatFee,
      };
      next = record({ ...next, inventory: [...next.inventory, item] }, item, `返港入库 · ${item.name}`, 0);
      greeting += `${item.name}已入库，可用 ${grade.uses} 次，货商出 ${grade.price} 元。`;
    }
  }
  if (next.jadeOrders?.length) {
    const orders = next.jadeOrders;
    next = { ...next, jadeOrders: orders.filter((order) => order.dueDay > state.day) };
    for (const order of orders) {
      if (order.dueDay > state.day) continue;
      const name = cutOrders[order.kind].name;
      next = record(next, order.item, `加工成品交付 · ${name}`, order.payout);
      greeting += `${name}交货，到账 ${order.payout} 元。`;
    }
  }
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
  if (day !== state.day || pastLastDay(state) || state.awaitingOpen || currentVisit(day, state.visitIndex, state.economy, state.harborSchedule)) {
    return notice(state, '当前无法打烊。', 'warning');
  }
  const cost = waterCost(state);
  const waterShortfall = Math.max(0, cost - state.cash);
  if (day >= secondChapterStart && waterShortfall && !confirmShortfall) {
    return notice(state, `水费还差 ${waterShortfall} 元。`, 'warning');
  }
  let next = state;
  if (state.ship) {
    const gap = shipGap(state);
    if (gap) {
      if (!confirmShortfall) return notice(state, gap, 'warning');
      return notice({ ...state, ship: { ...state.ship, closed: true } }, `第 ${day} 天离船停业。${gap}`, 'warning');
    }
    const night = shipNight(state);
    next = record({ ...state, ship: { ...state.ship, water: state.ship.water - night.water } }, null,
      night.own ? '自有船 · 口粮' : '船籍日费 · 住宿与口粮', -(night.own ? dwelling.ration : berthFee));
    if (night.tow) next = record(next, null, careerLog.tow, -night.tow);
    if (night.food) next = record(next, null, '船客 · 口粮', -night.food);
  }
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
  if (closed.economy === 'port' && closed.day >= firstOutingDay && closed.outingSeed === undefined) {
    closed.outingSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  }
  if (closed.f2Appointment?.status === 'booked' && closed.f2Appointment.day === day) {
    closed.f2Appointment = { day, status: 'closed' };
  }
  if (closed.reservedWaterDay === day) delete closed.reservedWaterDay;
  if (waterShortfall) {
    delete closed.consignment;
    return notice(closed, `无法支付水费，还差 ${waterShortfall} 元。经营中断。`, 'warning');
  }
  if (closed.ship) message += `今晚支出 ${shipNight(state).cash} 元，饮水余 ${closed.ship.water} 天。`;
  return notice(closed, message, 'success');
}

export function shipGap(state: Counter) {
  if (!state.ship) return '';
  const night = shipNight(state);
  return [state.cash < night.cash ? `${night.own ? '今晚开销' : '船籍费'}差 ${night.cash - state.cash} 元` : '',
    state.ship.water < night.water ? '缺今晚的饮水' : ''].filter(Boolean).join('，');
}

function shipTrade(state: Counter, action: Extract<Action, { type: 'boardShip' | 'shipRelief' | 'buyWater' | 'buyCargo' | 'sellCargo' | 'deliverFloatFarmSeal' }>): Result {
  if (state.economy !== 'port' || state.awaitingOpen || state.day !== action.day) return notice(state, '请在营业中办理。', 'warning');
  const ship = state.ship;
  if (action.type === 'boardShip' && !ship) return notice({ ...state, ship: { water: boardingWater } }, '已登船，领到三日饮水。今晚起结算船籍费。', 'success');
  if (!ship) return notice(state, '尚未登船。');
  if (action.type === 'shipRelief') {
    const leg = roundStart(state.day);
    if (!shipGap(state) || ship.reliefLeg === leg) return notice(state, '本航段应急值班仅在缺水或缺费时可领一次。', 'warning');
    return notice(record({ ...state, ship: { ...ship, water: ship.water + 1, reliefLeg: leg } }, null, '应急泵房值班', berthFee),
      '值班领到一日饮水和六元工钱。', 'success');
  }
  if (action.type === 'buyWater') {
    const pack = waterPacks[action.choice];
    if (!pack || state.cash < pack.price) return notice(state, '无法购买这份饮水。', 'warning');
    return notice(record({ ...state, ship: { ...ship, water: ship.water + pack.days } }, null, `补水 · ${pack.name}`, -pack.price), `存水增加 ${pack.days} 天。`, 'success');
  }
  if (action.type === 'buyCargo') {
    const good = cargoGoods[action.choice];
    if (!good) return notice(state, '没有这批货。');
    const id = cargoId(state.day, action.choice);
    const cost = cargoQuote(state.day, action.choice).ask;
    if (state.cash < cost || state.ledger.some((entry) => entry.itemId === id)) return notice(state, '这批货已收过或现钱不足。', 'warning');
    const item = { id, name: good.name, model: good.model, condition: '验收合格', observations: [good.clue], cost };
    return notice(record({ ...state, inventory: [...state.inventory, item] }, item, `靠岸进货 · ${good.name}`, -cost), `${good.name}已入库。`, 'success');
  }
  if (action.type === 'sellCargo' || action.type === 'deliverFloatFarmSeal') {
    const item = state.inventory.find((entry) => entry.id === action.itemId);
    if (!item) return notice(state, '手上没有这批货。', 'warning');
    if (action.type === 'deliverFloatFarmSeal') {
      const request = floatFarmRequest(state);
      if (!request?.active || cargoKind(item.id) !== floatFarmOrder.kind) {
        return notice(state, '这件货当前不能交给浮田维修班。', 'warning');
      }
      const next = { ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) };
      return notice(record(next, item, floatFarmOrder.receipt, floatFarmOrder.price),
        `浮田维修班验收一件密封条，到账 ${floatFarmOrder.price} 元。`, 'success');
    }
    const price = shipSaleQuote(state.day, item)?.bid;
    if (price === undefined) return notice(state, '岸商不收这件货。', 'warning');
    return notice(record({ ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) }, item, `靠岸售货 · ${item.name}`, price),
      `${item.name}到账 ${price} 元。`, 'success');
  }
  return notice(state, '');
}

function handleCareer(state: Counter, action: CareerAction): Result {
  const unavailable = () => notice(state, '当前无法办理这件事。', 'warning');
  if (!state.ship || state.awaitingOpen || state.day < firstOutingDay || action.day !== state.day) return unavailable();
  const { task, choice, itemId } = action;
  const history = state.ledger;
  const has = (label: string) => history.some((entry) => entry.description === label);
  const mark = (label: string, message: string) => notice(record(state, null, label, 0), message);
  const noQueue = !currentVisit(state.day, state.visitIndex, state.economy, state.harborSchedule) && !ropeVisit(state)?.today;
  const guest = noQueue ? careerVisit(state) : undefined;
  if (guest?.kind === 'pawn' && task === 'pass') return mark(careerLog.met, '阿岑收起测盐笔，说下趟浮田再见。');
  if (guest?.kind === 'pawn' && task === 'pawn' && state.cash >= 30) {
    const ticket: Ticket = { id: mechanicTicket, borrower: '阿岑', item: saltPen, principal: 30, redeemPrice: 36, dueDay: state.day + 2, status: 'held' };
    const next = record({ ...state, tickets: [...state.tickets, ticket] }, saltPen, careerLog.met, -30);
    return notice(next, `已放款 30 元。第 ${ticket.dueDay} 天可用 36 元赎回。`);
  }
  if (guest?.kind === 'extend' && task === 'refuse') return mark('阿岑 · 按原约处理', '阿岑把笔留在柜台。当票到今晚打烊才逾期。');
  if (guest?.kind === 'extend' && task === 'extend') {
    const tickets = state.tickets.map((ticket) => ticket.id === mechanicTicket
      ? { ...ticket, principal: ticket.principal - 12, redeemPrice: 24, dueDay: state.day + 2 } : ticket);
    return notice(record({ ...state, tickets }, saltPen, careerLog.extend, 12), `已收 12 元。第 ${state.day + 2} 天付余款 24 元。`, 'success');
  }
  if (guest?.kind === 'redeem' && task === 'redeem') {
    const tickets = state.tickets.map((ticket) => ticket.id === mechanicTicket ? { ...ticket, status: 'redeemed' as const } : ticket);
    return notice(record({ ...state, tickets }, saltPen, careerLog.redeemed, guest.ticket.redeemPrice), '阿岑结清 24 元，取回测盐笔。', 'success');
  }
  if (guest?.kind === 'reunion' && task === 'reunion') {
    return mark(careerLog.reunion, guest.ticket?.status === 'redeemed'
      ? '阿岑用那支笔取了水样，还留下洗衣班的采购消息。' : '阿岑拿班里的公用笔取了水样，也指了指浮田的公开采购牌。');
  }

  const order = laundryOrder(state);
  if (order && (order.active || order.preview) && !order.booked && task === 'bookLaundry' && order.priority && (!action.onBoat || order.onBoat)) {
    const location = action.onBoat ? '自有船' : '母船柜台';
    return notice(record(state, null, action.onBoat ? careerLog.onboardBooking : careerLog.booking, 0),
      `已约第 ${order.start}–${order.last} 天到${location}验货。`);
  }
  if (order?.active && order.booked && task === 'cancelLaundry') return mark(careerLog.cancel, '已告知洗衣班这次缺货。');
  if (order?.active && order.onBoat && order.bookedOnBoat && !order.deferred && task === 'declineLaundry' && noQueue && !guest) {
    return mark(careerLog.defer, state.day < order.last ? '领班明天还在泊位。' : '领班已经离开，本次未能交货。');
  }
  const item = state.inventory.find((entry) => entry.id === itemId);
  if (task === 'laundry' && order?.active && item?.filter && item.filter.remaining >= 2 &&
    (!action.onBoat || order.onBoat && order.bookedOnBoat && !order.deferred && noQueue && !guest)) {
    const next = record({ ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) }, item, careerLog.laundry, laundryPrice);
    return notice(action.onBoat ? record(next, null, careerLog.referral, 0) : next,
      action.onBoat ? '阿岑带洗衣班领班登船验货，现结 22 元。' : '洗衣班在柜台验收滤芯，现结 22 元。', 'success');
  }
  if (task === 'materialJob' && order && !order.preview && order.certs >= 2 && item && materialKind(item) === 0 &&
    !history.some((entry) => entry.day >= order.start && entry.description === careerLog.materialJob)) {
    return notice(record({ ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) }, item, careerLog.materialJob, materialJobPrice),
      '浮田维修班验收船壳板，现结 32 元。', 'success');
  }

  const boat = playerBoat(state);
  const yard = shipStop(state.day).stop.name === '避风修船坞';
  if (task === 'claim' && yard && !boat.claimed) return mark(careerLog.berth, '空泊位已挂上你的工料单。');
  if (!boat.claimed) return unavailable();
  if (task === 'buy' && yard && choice !== undefined) {
    const material = boatMaterials[choice];
    const id = `boat-material-${choice}-yard-${state.day}`;
    if (!material || state.cash < material.price || history.some((entry) => entry.itemId === id)) return unavailable();
    const part = { ...material, id, model: '造船材料', condition: '船坞验收合格',
      observations: ['可装到自己的船上。'], recyclePrice: material.price - 6, cost: material.price };
    return notice(record({ ...state, inventory: [...state.inventory, part] }, part, `船坞采购 · ${part.name}`, -material.price), '材料已入库。');
  }
  if (task === 'build' && choice !== undefined) {
    const work = boatWorks[choice];
    if (!work || boat.complete[choice] || (choice === 2 && !boat.complete.slice(0, 2).every(Boolean)) ||
      (choice > 2 && !boat.complete[2]) || state.cash < work.fee) return unavailable();
    const parts = boatBuildItems(state, choice);
    if (!parts.length) return unavailable();
    let next = { ...state, inventory: state.inventory.filter((entry) => !parts.includes(entry)) };
    if (parts.some((part) => part.id === next.consignment?.itemId)) delete next.consignment;
    next = record(next, parts[0], boatWorkLog(choice), -work.fee);
    return notice(next, `已完成「${work.name}」。`, 'success');
  }
  if (task === 'home' && boat.complete[2] && !boat.own) return mark(careerLog.home, '今晚起住自己的船。');
  if (task === 'mother' && boat.own && !boat.hosting) return mark(careerLog.mother, '今晚回旧港号住宿。');
  if (task === 'host' && boat.own && boat.complete[4] && !boat.guest && !has(careerLog.transfer)) {
    return mark(careerLog.guest, '补帆工借宿两晚，每晚多用一日水和 2 元口粮。');
  }
  if (task === 'transfer' && (boat.complete[4] && (!boat.guest || !boat.guestEnd) || boat.hosting) && !has(careerLog.transfer)) {
    return mark(careerLog.transfer, '救济站确认了铺位，补帆工已转介。');
  }
  if (boat.guest && !boat.guestEnd && state.day >= boat.guest.day + 2) {
    if (task === 'farewell') return mark(careerLog.farewell, '补帆工在下一段旅程找到了亲友，来道别。');
    if (task === 'stay' && boat.own) return mark(careerLog.stay, '补帆工愿意留下，想接些有报酬的活。');
  }
  if (task === 'mend' && boat.crew && !boat.mended && state.cash >= 6) {
    return notice(record(state, null, careerLog.mend, -6), '已付 6 元工钱，补帆工修好漏雨遮篷。');
  }
  return unavailable();
}

function disposeItem(state: Counter, action: Extract<Action, { type: 'recycle' | 'install' }>): Result {
  if (state.day !== action.day || state.day < waterStartDay || pastLastDay(state) || state.awaitingOpen) {
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
  if (state.ship?.closed) return notice(state, '本局已离船停业。');
  if (action.type === 'career') return handleCareer(state, action);
  if (action.type === 'boardShip' || action.type === 'shipRelief' || action.type === 'buyWater' || action.type === 'buyCargo' ||
    action.type === 'sellCargo' || action.type === 'deliverFloatFarmSeal') return shipTrade(state, action);
  if (action.type === 'bookVoyage' || action.type === 'bookMaterialTrip' || action.type === 'buyOutingWinch' || action.type === 'revealVoyage' ||
      action.type === 'bookStoneTrip' || action.type === 'buyJadeLamp') return planOuting(state, action);
  if (action.type === 'openJade' || action.type === 'sellJade' || action.type === 'sendJade') return handleJade(state, action);
  if (action.type === 'mountFilter' || action.type === 'sellFilter' || action.type === 'removeFilter' || action.type === 'takeWaterJob' || action.type === 'fillShipWater') return handleFilter(state, action);
  if (action.type === 'buyCrate' || action.type === 'openCrate' || action.type === 'sellCrateGoods') return handleSalvage(state, action);
  if (action.type === 'bookRopeVisit' || action.type === 'deliverRope' || action.type === 'dismissRopeVisit') return handleRopeVisit(state, action);
  if (action.type === 'sendRepair' || action.type === 'rentF2') return sendToWorkshop(state, action);
  if (action.type === 'buyRepairStock' || action.type === 'sellRepairStock') {
    const market = repairMarket(state);
    if (!market || action.day !== state.day) return notice(state, '今天没有这笔拆船件生意。', 'warning');
    if (action.type === 'buyRepairStock') {
      if (!market.canBuy || state.cash < wornWinchPrice) return notice(state, '货已处理或现金不足。', 'warning');
      return notice(record({ ...state, inventory: [...state.inventory, { ...market.stock, cost: wornWinchPrice }] },
        market.stock, '收购待修绞盘', -wornWinchPrice), '待修绞盘已入库。', 'success');
    }
    const item = market.owned;
    if (!market.canSell || !item) return notice(state, '码头今天没有可交付的自有绞盘。', 'warning');
    return notice(record({ ...state, inventory: state.inventory.filter((entry) => entry.id !== item.id) },
      item, '工班收购 · 码头绞盘', market.price), `绞盘验收成交，到账 ${market.price} 元。`, 'success');
  }
  if (action.type === 'roundReferral') {
    const referral = roundReferral(state);
    if (action.day !== state.day || !referral?.available || referral.paid) return notice(state, '这笔介绍暂时无法结算。', 'warning');
    return notice(record(state, null, '港口介绍费', 8), '双方说定了工钱，当铺收到 8 元介绍费。', 'success');
  }
  if (action.type === 'bookF2' || action.type === 'deliverF2' || action.type === 'declineF2' ||
      action.type === 'acceptReferral' || action.type === 'referSupplier') return handlePortJob(state, action);
  if (action.type === 'readNotes') {
    const ids = counterNotes(state).map((note) => note.id);
    if (state.day !== action.day || ids.every((id) => state.readNoteIds?.includes(id))) return notice(state, '');
    return notice({ ...state, readNoteIds: [...new Set([...(state.readNoteIds ?? []), ...ids])] }, '');
  }
  if (action.type === 'listItem' || action.type === 'unlistItem') return updateConsignment(state, action);
  if (action.type === 'harborBuy' || action.type === 'harborSell') return tradeAtHarbor(state, action);
  if (action.type === 'close') return closeDay(state, action);
  if (action.type === 'continue') {
    if (action.day === state.day && atRoundSummary(state)) {
      return notice({ ...state, activeRoundStart: state.day }, `下轮港务 · ${portRound(state.day, state.harborSchedule).title}`);
    }
    if (action.day !== state.day || !state.awaitingOpen || !atFirstChapterSummary(state)) return notice(state, '当前无法继续营业。', 'warning');
    return notice({ ...state, chapterTwoStarted: true, ...(action.upgrade ? { economy: 'port' as const } : {}) }, '第二章 · 港务字条已送达');
  }
  if (action.type === 'reclaimPurifier') {
    const item = state.installedPurifier;
    if (action.day !== state.day || !consignmentOpen(state) || state.economy !== 'port' || !item ||
        state.inventory.some((entry) => entry.id === item.id)) return notice(state, '当前没有可拆回的净水机。', 'warning');
    return notice(record({ ...state, installedPurifier: null, inventory: [...state.inventory, item] },
      item, '拆回 · F2 净水机', 0), 'F2 已拆回自有库存。', 'success');
  }
  if (action.type === 'open') {
    if (state.day !== action.day || pastLastDay(state) || !state.awaitingOpen || state.waterShortfall ||
        atFirstChapterSummary(state) || atRoundSummary(state)) {
      return notice(state, '当前无法开门。', 'warning');
    }
    return settleOpening(state);
  }
  if ('itemId' in action) return disposeItem(state, action);
  if (state.awaitingOpen) return notice(state, '请先开门。', 'warning');
  const visit = currentVisit(state.day, state.visitIndex, state.economy, state.harborSchedule);
  if (!visit || !('visitId' in action) || visit.id !== action.visitId) return notice(state, '这位客人已经离开。');

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
