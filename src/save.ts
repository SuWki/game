import type { Counter, Result, Ticket } from './counter.ts';
import { consignmentPrices, emergencyWaterDay, emergencyWaterPrice, firstChapterEnd, itemDetails, lastDay, maxOffers, secondChapterStart, waterPrice, waterStartDay, type Item } from './scenario.ts';

export const saveVersion = 3;
type Save = Result & { version: typeof saveVersion };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const nonNegative = (value: unknown): value is number => integer(value) && value >= 0;

function isItem(value: unknown): value is Item {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.model === 'string' && typeof value.condition === 'string' &&
    Array.isArray(value.observations) && value.observations.every((line) => typeof line === 'string') &&
    (value.authenticity === undefined || value.authenticity === 'genuine' || value.authenticity === 'imitation') &&
    (value.reference === undefined || typeof value.reference === 'string') &&
    (value.recyclePrice === undefined || nonNegative(value.recyclePrice));
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
  const dayLimit = legacy ? firstChapterEnd : save.version === 2 ? secondChapterStart : lastDay + 1;
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
  if (listing !== undefined) {
    if (!isObject(listing) || !integer(listing.price) || !integer(listing.listedDay) ||
      listing.listedDay < secondChapterStart || listing.listedDay >= lastDay ||
      listing.listedDay !== state.day - Number(state.awaitingOpen) || !state.chapterTwoStarted || state.waterShortfall) {
      throw new Error('Invalid consignment');
    }
    const item = (state.inventory as Counter['inventory']).find((entry) => entry.id === listing.itemId);
    if (!item || !consignmentPrices(item)?.includes(listing.price)) throw new Error('Invalid consignment item');
  }
  return save as Save;
}
