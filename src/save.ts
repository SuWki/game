import { rentalDays, usablePurifier, type Counter, type Result, type Ticket } from './counter.ts';
import { filterGrades, firstOutingDay, type FilterGrade } from './outing.ts';
import { cutQuote, trialCut, type Jade } from './jade.ts';
import { consignmentPrices, emergencyWaterDay, emergencyWaterPrice, firstChapterEnd, itemDetails, lastDay, maxOffers, roundStart, secondChapterStart, waterPrice, waterStartDay, type Item } from './scenario.ts';

export const saveVersion = 3;
type Save = Result & { version: typeof saveVersion };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const nonNegative = (value: unknown): value is number => integer(value) && value >= 0;
const isFilterGrade = (value: unknown): value is FilterGrade =>
  value === 'worn' || value === 'sound' || value === 'long';
const isJade = (value: unknown): value is Jade => isObject(value) &&
  (value.grade === 'rough' || value.grade === 'plain' || value.grade === 'fine' || value.grade === 'rare') &&
  (value.face === 'edge' || value.face === 'split') && typeof value.opened === 'boolean';

function isItem(value: unknown): value is Item {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.model === 'string' && typeof value.condition === 'string' &&
    Array.isArray(value.observations) && value.observations.every((line) => typeof line === 'string') &&
    (value.authenticity === undefined || value.authenticity === 'genuine' || value.authenticity === 'imitation') &&
    (value.reference === undefined || typeof value.reference === 'string') &&
    (value.recyclePrice === undefined || nonNegative(value.recyclePrice)) &&
    (value.jade === undefined || (value.filter === undefined && isJade(value.jade))) &&
    (value.filter === undefined || (isObject(value.filter) && isFilterGrade(value.filter.grade) &&
      integer(value.filter.remaining) && value.filter.remaining > 0 && value.filter.remaining <= filterGrades[value.filter.grade].uses));
}

function isInventoryItem(value: unknown): value is Item & { cost: number } {
  return isObject(value) && nonNegative(value.cost) && isItem(value);
}

function isTicket(value: unknown): value is Ticket {
  return isObject(value) && typeof value.id === 'string' && typeof value.borrower === 'string' &&
    isItem(value.item) && nonNegative(value.principal) && nonNegative(value.redeemPrice) &&
    integer(value.dueDay) && (value.status === 'held' || value.status === 'redeemed' || value.status === 'expired');
}

function isLedgerEntry(value: unknown): value is Counter['ledger'][number] {
  return isObject(value) && integer(value.day) && (typeof value.itemId === 'string' || value.itemId === null) &&
    typeof value.description === 'string' && integer(value.change) && nonNegative(value.balance);
}

export function readSave(raw: string): Save {
  const save: unknown = JSON.parse(raw);
  if (!isObject(save) || (save.version !== 1 && save.version !== 2 && save.version !== saveVersion) || !isObject(save.state) ||
    typeof save.message !== 'string' || (save.tone !== 'success' && save.tone !== 'warning' && save.tone !== 'neutral')) {
    throw new Error('Unsupported save');
  }
  const { state } = save;
  const legacy = save.version === 1;
  const dayLimit = legacy ? firstChapterEnd : save.version === 2 ? secondChapterStart :
    state.economy === 'port' ? Number.MAX_SAFE_INTEGER - 10 : lastDay + 1;
  if (!integer(state.day) || state.day < 1 || state.day > dayLimit ||
    typeof state.awaitingOpen !== 'boolean' ||
    !nonNegative(state.visitIndex) || !nonNegative(state.cash) ||
    !nonNegative(state.attempts) || state.attempts > maxOffers ||
    !Array.isArray(state.inventory) || !state.inventory.every(isInventoryItem) ||
    !Array.isArray(state.tickets) || !state.tickets.every(isTicket) ||
    !Array.isArray(state.ledger) || !state.ledger.every(isLedgerEntry)) {
    throw new Error('Invalid counter state');
  }
  if (legacy) {
    const enrich = <T extends Item>(item: T): T => ({ ...itemDetails(item.id), ...item });
    const migrated: Counter = {
      day: state.day, awaitingOpen: state.awaitingOpen, visitIndex: state.visitIndex, cash: state.cash,
      attempts: state.attempts, inventory: state.inventory.map(enrich),
      tickets: state.tickets.map((ticket) => ({ ...ticket, item: enrich(ticket.item) })),
      ledger: state.ledger,
      knowsMechanicRequest: state.day > 2 || (state.day === 2 && !state.awaitingOpen),
      installedPurifier: null, waterShortfall: 0,
    };
    return { version: saveVersion, state: migrated, message: save.message, tone: save.tone };
  }
  if (typeof state.knowsMechanicRequest !== 'boolean' ||
    (state.sawTimerClues !== undefined && typeof state.sawTimerClues !== 'boolean') ||
    [state.timerAppraised, state.misrepresentedTimer, state.hasWaterReserve, state.chapterTwoStarted]
      .some((value) => value !== undefined && typeof value !== 'boolean') ||
    (state.installedPurifier !== null && !isInventoryItem(state.installedPurifier)) ||
    !nonNegative(state.waterShortfall) || state.waterShortfall > (save.version === 2 ? waterPrice : emergencyWaterPrice) ||
    (state.reservedWaterDay !== undefined && state.reservedWaterDay !== waterStartDay && state.reservedWaterDay !== emergencyWaterDay) ||
    (state.readNoteIds !== undefined && (!Array.isArray(state.readNoteIds) ||
      !state.readNoteIds.every((id) => typeof id === 'string'))) ||
    (state.economy !== undefined && state.economy !== 'port') ||
    (state.activeRoundStart !== undefined && (!integer(state.activeRoundStart) || state.economy !== 'port' ||
      state.activeRoundStart <= lastDay || state.activeRoundStart > state.day ||
      state.activeRoundStart !== roundStart(state.activeRoundStart))) ||
    (state.fuseReferral !== undefined && state.fuseReferral !== 'accepted' && state.fuseReferral !== 'paid') ||
    (state.f2Appointment !== undefined && (!isObject(state.f2Appointment) ||
      !integer(state.f2Appointment.day) || state.f2Appointment.day <= secondChapterStart ||
      state.f2Appointment.day > lastDay ||
      (state.f2Appointment.status !== 'booked' && state.f2Appointment.status !== 'closed'))) ||
    (state.harborSchedule !== undefined && state.harborSchedule !== 'late')) {
    throw new Error('Invalid shelter state');
  }
  if (save.version === 2) {
    const { hasWaterReserve, ...persisted } = state;
    const migrated = persisted as Counter;
    if (hasWaterReserve && state.day <= waterStartDay) migrated.reservedWaterDay = waterStartDay;
    return { version: saveVersion, state: migrated, message: save.message, tone: save.tone };
  }
  const listing = state.consignment;
  if (state.ship !== undefined && (state.economy !== 'port' || !isObject(state.ship) ||
    !nonNegative(state.ship.water) || (state.ship.closed !== undefined && state.ship.closed !== true) ||
    (state.ship.reliefLeg !== undefined && (!integer(state.ship.reliefLeg) || state.ship.reliefLeg < 1 ||
      state.ship.reliefLeg > state.day || state.ship.reliefLeg !== roundStart(state.ship.reliefLeg))))) throw new Error('Invalid ship provisions');
  if (listing !== undefined) {
    if (!isObject(listing) || !integer(listing.price) || !integer(listing.listedDay) ||
      listing.listedDay < secondChapterStart || (state.economy !== 'port' && listing.listedDay >= lastDay) ||
      listing.listedDay !== state.day - Number(state.awaitingOpen) || !state.chapterTwoStarted || state.waterShortfall) {
      throw new Error('Invalid consignment');
    }
    const item = (state.inventory as Counter['inventory']).find((entry) => entry.id === listing.itemId);
    if (!item || !consignmentPrices(item)?.includes(listing.price)) throw new Error('Invalid consignment item');
  }
  const orders = state.workshopOrders;
  if (orders !== undefined) {
    const day = state.day;
    if (!Array.isArray(orders) || state.economy !== 'port' || orders.length > 2 ||
      !orders.every((order) => isObject(order) && (order.kind === 'repair' || order.kind === 'rent') &&
        isInventoryItem(order.item) && integer(order.dueDay) && order.dueDay >= day &&
        order.dueDay <= day + rentalDays && (order.dueDay > day || state.awaitingOpen) &&
        (order.kind === 'rent' ? usablePurifier(order.item) : /^((round-\d+-)?winch-1)$/.test(order.item.id) &&
          order.item.condition === '齿轮磨损') &&
        !(state.inventory as Counter['inventory']).some((item) => item.id === (order.item as Item).id)) ||
      new Set(orders.map((order) => order.kind)).size !== orders.length) throw new Error('Invalid workshop orders');
  }
  const { outingSeed, hasOutingWinch, voyage, mountedFilter, waterJobDay } = state;
  if ((outingSeed !== undefined && (state.economy !== 'port' || state.day < firstOutingDay ||
        !nonNegative(outingSeed) || outingSeed > 0xffffffff)) ||
      (hasOutingWinch !== undefined && (outingSeed === undefined || hasOutingWinch !== true)) ||
      (voyage !== undefined && (outingSeed === undefined || !state.awaitingOpen || !isObject(voyage) ||
        voyage.day !== state.day || (voyage.target !== undefined && (voyage.target !== 'materials' || state.ship === undefined)) ||
        (voyage.grade !== 'empty' && !isFilterGrade(voyage.grade)) ||
        (voyage.stage !== 0 && voyage.stage !== 1 && (voyage.stage !== 2 || voyage.grade === 'empty')))) ||
      (mountedFilter !== undefined && (outingSeed === undefined || !isInventoryItem(mountedFilter) ||
        !mountedFilter.filter || (state.inventory as Counter['inventory']).some((item) => item.id === mountedFilter.id))) ||
      (waterJobDay !== undefined && (outingSeed === undefined || !integer(waterJobDay) ||
        waterJobDay < firstOutingDay || waterJobDay > state.day))) throw new Error('Invalid outing state');
  const { hasJadeLamp, stoneTrip, jadeOrders } = state;
  if ((hasJadeLamp !== undefined && (outingSeed === undefined || hasJadeLamp !== true)) ||
      (stoneTrip !== undefined && (outingSeed === undefined || !state.awaitingOpen || voyage !== undefined ||
        !isObject(stoneTrip) || stoneTrip.day !== state.day || !isJade(stoneTrip.jade) || stoneTrip.jade.opened))) {
    throw new Error('Invalid stone trip');
  }
  if (jadeOrders !== undefined) {
    const ids = new Set((state.inventory as Counter['inventory']).map((item) => item.id));
    const dueDay = state.day + Number(!state.awaitingOpen);
    if (outingSeed === undefined || !Array.isArray(jadeOrders) || !jadeOrders.every((order) => {
      if (!isObject(order) || !isInventoryItem(order.item) || !order.item.jade?.opened ||
        (order.kind !== 'pendants' && order.kind !== 'seal') || order.dueDay !== dueDay || !nonNegative(order.payout) ||
        ids.has(order.item.id)) return false;
      const max = cutQuote(order.item.jade, order.kind, trialCut(order.item.jade, order.kind));
      ids.add(order.item.id);
      return max !== undefined && order.payout > 0 && order.payout <= max.payout;
    })) throw new Error('Invalid jade orders');
  }
  return save as Save;
}
