import assert from 'node:assert/strict';
import test from 'node:test';
import { counterNotes, openCounter, settleVisit } from '../src/counter.ts';
import { board, currentVisit, harborPeriod, lantern, scheduledVisits } from '../src/scenario.ts';
import { readSave, saveVersion } from '../src/save.ts';

function offer(state, amount) {
  const visit = currentVisit(state.day, state.visitIndex);
  return settleVisit(state, { type: 'offer', visitId: visit.id, amount, attempt: state.attempts }).state;
}

test('到期日只按对应当票归还原物，同型号另一件仍代管', () => {
  const withWatch = offer({ ...openCounter(), visitIndex: 1 }, 60);
  const [original] = withWatch.tickets;
  const other = { ...original, id: 'other-ticket', item: { ...original.item, id: 'other-watch' } };
  const state = { ...withWatch, day: 3, visitIndex: 0, tickets: [other, original] };
  const action = { type: 'redeem', visitId: 'day-3-watchmaker' };
  const { state: redeemed } = settleVisit(state, action);
  assert.equal(redeemed.cash, state.cash + 75);
  assert.deepEqual(redeemed.tickets.map((ticket) => ticket.status), ['held', 'redeemed']);
  assert.equal(redeemed.ledger.at(-1).itemId, original.item.id);
  assert.equal(settleVisit(redeemed, action).state, redeemed);
  const late = { ...state, tickets: [{ ...original, dueDay: 2 }] };
  assert.equal(settleVisit(late, action).state, late);
});

test('代管物不能拿去兑现收购请求', () => {
  const state = {
    ...openCounter(), day: 2,
    tickets: [{
      id: 'held-lamp', borrower: '船工', item: lantern, principal: 25, redeemPrice: 32,
      dueDay: 2, status: 'held',
    }],
  };
  assert.equal(settleVisit(state, { type: 'sell', visitId: 'day-2-mechanic' }).state, state);
});

test('到期未赎按原放款成本归店，只留下零金额流水', () => {
  const pawned = offer({ ...openCounter(), day: 2, visitIndex: 1 }, 80);
  const early = { ...pawned, day: 3, visitIndex: 2 };
  const { state: next } = settleVisit(early, { type: 'close', day: 3 });
  assert.equal(next.tickets[0].status, 'held');
  assert.equal(next.inventory.length, 0);
  const closed = { type: 'close', day: 4 };
  assert.equal(settleVisit(next, closed).state, next);
  const { state: opened } = settleVisit(next, { type: 'open', day: 4 });
  const { state: expired } = settleVisit({ ...opened, visitIndex: scheduledVisits(4) }, closed);
  assert.equal(expired.cash, opened.cash);
  assert.equal(expired.inventory[0].cost, 80);
  assert.equal(expired.inventory[0].id, opened.tickets[0].item.id);
  assert.equal(expired.tickets[0].status, 'expired');
  assert.equal(expired.ledger.at(-1).change, 0);
  assert.equal(settleVisit(expired, closed).state, expired);
});

test('阶段二存档补全求购与货物属性，按已结算日期续玩', () => {
  const pawned = offer({ ...openCounter(), day: 2, visitIndex: 1 }, 80);
  const { state: closed } = settleVisit({ ...pawned, day: 4, visitIndex: scheduledVisits(4) }, { type: 'close', day: 4 });
  const oldItem = ({ authenticity, recyclePrice, ...item }) => item;
  const legacy = (base) => {
    const { knowsMechanicRequest, installedPurifier, waterShortfall, ...state } = base;
    return JSON.stringify({
      version: 1, message: '', tone: 'neutral',
      state: { ...state, inventory: state.inventory.map(oldItem),
        tickets: state.tickets.map((ticket) => ({ ...ticket, item: oldItem(ticket.item) })) },
    });
  };
  const migrated = readSave(legacy(closed));
  assert.equal(migrated.version, saveVersion);
  assert.equal(migrated.state.cash, closed.cash);
  assert.deepEqual(migrated.state.ledger, closed.ledger);
  assert.equal(migrated.state.knowsMechanicRequest, true);
  assert.equal(migrated.state.inventory[0].authenticity, 'genuine');
  assert.equal(migrated.state.day, 5);
  assert.equal(migrated.state.awaitingOpen, true);

  const day3 = readSave(legacy({ ...pawned, day: 3, visitIndex: 1 })).state;
  assert.equal(currentVisit(day3.day, day3.visitIndex).id, 'day-3-timer');
  const day4 = readSave(legacy({ ...pawned, day: 4, visitIndex: 0, awaitingOpen: true })).state;
  assert.equal(day4.day, 4);
  assert.equal(day4.tickets[0].status, 'held');
});

test('水费不足保留余额与差额，刷新后仍是中断结局', () => {
  const state = { ...openCounter(5), day: 5, visitIndex: 1 };
  const result = settleVisit(state, { type: 'close', day: 5 });
  assert.equal(result.state.cash, 5);
  assert.equal(result.state.waterShortfall, 5);
  assert.equal(result.state.ledger.length, 0);
  assert.deepEqual(readSave(JSON.stringify({ version: 2, ...result })).state, result.state);
});

test('玩家看过 T8 后即使谢客，线索也随进度保存', () => {
  const state = { ...openCounter(), day: 3 };
  assert.notEqual(state.sawTimerClues, true);
  const next = settleVisit(state, { type: 'dismiss', visitId: 'day-3-watchmaker' }).state;
  const dismissed = settleVisit(next, { type: 'dismiss', visitId: 'day-3-timer' });
  assert.equal(dismissed.state.tickets.length, 0);
  assert.equal(readSave(JSON.stringify({ version: 2, ...dismissed })).state.sawTimerClues, true);
});

test('窗景根据接待位置切换，开门前和空档也有确定时段', () => {
  assert.deepEqual([0, 1, 2].map((index) => harborPeriod(index, 3, false)),
    ['morning', 'noon', 'evening']);
  assert.deepEqual([0, 1, 2].map((index) => harborPeriod(index, scheduledVisits(1), false)),
    ['morning', 'noon', 'evening']);
  assert.equal(harborPeriod(0, scheduledVisits(4), true), 'morning');
  assert.equal(harborPeriod(0, scheduledVisits(4), false), 'morning');
  assert.equal(harborPeriod(0, scheduledVisits(5), false), 'morning');
  assert.equal(harborPeriod(1, scheduledVisits(5), false), 'evening');
});

test('指出疑点后才可低价买断，真假售价记账，冒充正品降低 F2 报价', () => {
  const atTimer = { ...openCounter(150), day: 3, visitIndex: 1 };
  const visitId = 'day-3-timer';
  const buy = { type: 'buyImitation', visitId };
  assert.equal(settleVisit(atTimer, buy).state, atTimer);
  const appraised = settleVisit(atTimer, { type: 'appraiseTimer', visitId });
  const restored = readSave(JSON.stringify({ version: 2, ...appraised })).state;
  assert.equal(settleVisit({ ...restored, cash: 4 }, buy).state.inventory.length, 0);
  const bought = settleVisit(restored, buy).state;
  assert.equal(bought.cash, 145);
  assert.equal(bought.inventory[0].cost, 5);
  assert.equal(bought.tickets.length, 0);
  const day4 = { ...bought, day: 4, visitIndex: 0 };
  const saleId = 'day-4-timer-buyer';
  const honest = settleVisit(day4, { type: 'sellTimerHonestly', visitId: saleId }).state;
  const falseSale = settleVisit(day4, { type: 'sellTimerAsGenuine', visitId: saleId }).state;
  assert.equal(honest.cash, 157);
  assert.equal(falseSale.cash, 171);
  assert.equal(falseSale.inventory.length, 0);
  assert.equal(settleVisit(falseSale, { type: 'sellTimerAsGenuine', visitId: saleId }).state, falseSale);
  const withF2 = { ...falseSale, day: 5, visitIndex: 0,
    inventory: [{ ...currentVisit(5, 0).item, cost: 80 }] };
  assert.equal(settleVisit(withF2, { type: 'sell', visitId: 'day-5-mechanic' }).state.cash, 271);
  const pawned = offer(atTimer, 20);
  const held = { ...pawned, day: 4, visitIndex: 0 };
  assert.equal(settleVisit(held, { type: 'sellTimerAsGenuine', visitId: saleId }).state, held);
});

test('第 4 天可单独预订第 5 天用水，预付只扣一次且打烊免现场水费', () => {
  const state = { ...openCounter(8), day: 4, visitIndex: 1 };
  const order = { type: 'reserveWater', visitId: 'day-4-water-reserve' };
  assert.equal(settleVisit(state, { type: 'close', day: 4 }).state, state);
  const paid = settleVisit(state, order).state;
  assert.equal(paid.cash, 0);
  assert.equal(settleVisit(paid, order).state, paid);
  const close = settleVisit({ ...paid, day: 5, visitIndex: 1 }, { type: 'close', day: 5 }).state;
  assert.equal(close.cash, 0);
  assert.equal(close.waterShortfall, 0);
  assert.equal(close.ledger.length, 1);
  assert.equal(close.reservedWaterDay, undefined);
});

test('版本 2 的五日小结、缺水中断和已付水票各自续接', () => {
  const old = (state) => readSave(JSON.stringify({ version: 2, state, message: '', tone: 'neutral' })).state;
  const summary = old({ ...openCounter(140), day: 6, awaitingOpen: true });
  const continueAction = { type: 'continue', day: 6 };
  const openAction = { type: 'open', day: 6 };
  assert.equal(settleVisit(summary, openAction).state, summary);
  const continued = settleVisit(summary, continueAction).state;
  assert.equal(continued.cash, 140);
  assert.equal(settleVisit(continued, continueAction).state, continued);
  assert.equal(settleVisit(continued, openAction).state.awaitingOpen, false);
  const interrupted = old({ ...summary, cash: 5, waterShortfall: 5 });
  assert.equal(settleVisit(interrupted, continueAction).state, interrupted);
  assert.equal(settleVisit(interrupted, openAction).state, interrupted);
  const prepaid = old({ ...openCounter(142), day: 4, visitIndex: 2, hasWaterReserve: true });
  const fifth = settleVisit(prepaid, { type: 'close', day: 4 }).state;
  assert.equal(fifth.reservedWaterDay, 5);
  const midVisit = old({ ...openCounter(142), day: 5, hasWaterReserve: true });
  assert.equal(midVisit.awaitingOpen, false);
  assert.equal(currentVisit(midVisit.day, midVisit.visitIndex).id, 'day-5-mechanic');
  const dismissed = settleVisit(midVisit, { type: 'dismiss', visitId: 'day-5-mechanic' }).state;
  const closed = settleVisit(dismissed, { type: 'close', day: 5 }).state;
  assert.equal(closed.cash, 142);
  assert.equal(closed.reservedWaterDay, undefined);
});

test('应急水按 18 元结算，差额可返回补救或确认中断', () => {
  const ready = { ...openCounter(18), chapterTwoStarted: true, day: 8, visitIndex: 1 };
  const close = { type: 'close', day: 8 };
  const paid = settleVisit(ready, close);
  assert.equal(paid.state.cash, 0);
  assert.equal(paid.state.waterShortfall, 0);
  assert.equal(paid.state.ledger.at(-1).change, -18);
  assert.equal(settleVisit(paid.state, close).state, paid.state);
  const broke = { ...ready, cash: 0 };
  assert.equal(settleVisit(broke, close).state, broke);
  const ended = settleVisit(broke, { ...close, confirmShortfall: true });
  assert.equal(ended.state.waterShortfall, 18);
  assert.equal(readSave(JSON.stringify({ version: saveVersion, ...ended })).state.waterShortfall, 18);
});

test('第二章水票只覆盖第 8 天，F2 优先供水且水票作废', () => {
  const day7 = { ...openCounter(40), chapterTwoStarted: true, day: 7, visitIndex: 1 };
  const reserve = { type: 'reserveWater', visitId: 'day-7-water' };
  const paid = settleVisit(day7, reserve).state;
  assert.equal(paid.cash, 32);
  assert.equal(settleVisit(paid, reserve).state, paid);
  const after7 = settleVisit(paid, { type: 'close', day: 7 }).state;
  assert.equal(after7.cash, 22);
  const ready = { ...after7, awaitingOpen: false, visitIndex: 1 };
  const close = { type: 'close', day: 8 };
  const used = settleVisit(ready, close).state;
  assert.equal(used.ledger.at(-1).description, '水票抵扣');
  assert.equal(used.cash, 22);
  assert.equal(used.reservedWaterDay, undefined);
  const installed = { ...ready, installedPurifier: { ...currentVisit(5, 0).item, cost: 80 } };
  const expired = settleVisit(installed, close).state;
  assert.equal(expired.cash, 22);
  assert.equal(expired.reservedWaterDay, undefined);
  assert.deepEqual(expired.ledger.slice(-2).map((entry) => entry.description), ['F2 集雨供水', '水票到期未使用']);
});

test('按现状收绞盘后按成色销售，船工同时收电路板且每件只结一次', () => {
  const day8 = { ...openCounter(120), day: 8, chapterTwoStarted: true, inventory: [{ ...board, cost: 30 }] };
  const bought = offer(day8, 95);
  assert.equal(bought.cash, 25);
  assert.equal(bought.inventory[1].condition, '齿轮磨损');
  const day9 = { ...bought, day: 9, visitIndex: 0 };
  const sellWinch = { type: 'sell', visitId: 'day-9-winch' };
  const sellBoard = { type: 'sellBoard', visitId: 'day-9-winch' };
  const firstSale = settleVisit(day9, sellWinch).state;
  assert.equal(firstSale.cash, 113);
  assert.equal(settleVisit(firstSale, sellWinch).state, firstSale);
  const both = settleVisit(firstSale, sellBoard).state;
  assert.equal(both.cash, 185);
  assert.equal(settleVisit(both, sellBoard).state, both);
  const boardOnly = settleVisit(day9, sellBoard).state;
  const nextDay = { ...boardOnly, day: 10 };
  assert.equal(settleVisit(nextDay, { type: 'sell', visitId: 'day-10-winch' }).state.cash, 212);
});

test('港口货摊独立于接待进度，刷新保留船期与单件库存', () => {
  const start = { ...openCounter(140), day: 6, chapterTwoStarted: true, harborSchedule: 'late' };
  const buy = { type: 'harborBuy', day: 6, itemId: 'harbor-rope' };
  const bought = settleVisit(start, buy);
  assert.equal(bought.state.cash, 118);
  assert.equal(bought.state.visitIndex, start.visitIndex);
  assert.equal(settleVisit(bought.state, buy).state, bought.state);
  const restored = readSave(JSON.stringify({ version: saveVersion, ...bought })).state;
  const day9 = { ...restored, day: 9 };
  const sale = { type: 'harborSell', day: 9, itemId: 'harbor-rope' };
  const sold = settleVisit(day9, sale);
  assert.equal(sold.state.cash, 149);
  assert.equal(settleVisit(sold.state, sale).state, sold.state);
  assert.equal(settleVisit({ ...day9, awaitingOpen: true }, sale).state.cash, 118);
});

test('寄售次日开门只结算一次，高报价流拍后货仍在库', () => {
  const item = { ...board, cost: 30 };
  const day6 = { ...openCounter(140), day: 6, chapterTwoStarted: true, harborSchedule: 'late', inventory: [item] };
  for (const [price, expectedCash, remaining] of [[24, 154, 0], [46, 130, 1]]) {
    const listed = settleVisit(day6, { type: 'listItem', day: 6, itemId: item.id, price }).state;
    assert.equal(listed.visitIndex, 0);
    const closed = settleVisit({ ...listed, visitIndex: 1 }, { type: 'close', day: 6 });
    const waiting = readSave(JSON.stringify({ version: saveVersion, ...closed })).state;
    assert.equal(waiting.cash, 130);
    const open = { type: 'open', day: 7 };
    const next = settleVisit(waiting, open).state;
    assert.equal(next.cash, expectedCash);
    assert.equal(next.inventory.length, remaining);
    assert.equal(next.consignment, undefined);
    assert.equal(settleVisit(next, open).state, next);
  }
});

test('撤下、当日出货或缺水终止时不会再结算寄售', () => {
  const item = { ...board, cost: 30 };
  const day7 = { ...openCounter(9), day: 7, chapterTwoStarted: true, inventory: [item] };
  const list = { type: 'listItem', day: 7, itemId: item.id, price: 24 };
  const listed = settleVisit(day7, list).state;
  assert.ok(listed.consignment);
  assert.equal(settleVisit(listed, { ...list, type: 'unlistItem' }).state.consignment, undefined);
  const sold = settleVisit(listed, { type: 'sell', visitId: 'day-7-board' }).state;
  assert.equal(sold.cash, 64);
  assert.equal(sold.consignment, undefined);
  const ready = { ...listed, visitIndex: 2 };
  assert.equal(settleVisit(ready, { type: 'close', day: 7 }).state, ready);
  const failed = settleVisit(ready, { type: 'close', day: 7, confirmShortfall: true }).state;
  assert.equal(failed.waterShortfall, 1);
  assert.equal(failed.inventory.length, 1);
  assert.equal(failed.consignment, undefined);
  const empty = { ...day7, inventory: [] };
  assert.equal(settleVisit(empty, list).state, empty);
});

test('柜台字条接待后仍可查看，已读保存且次日新字条仍未读', () => {
  const day6 = { ...openCounter(140), day: 6, chapterTwoStarted: true, awaitingOpen: true };
  assert.deepEqual(counterNotes(day6).map((note) => note.id), ['water']);
  const opened = settleVisit(day6, { type: 'open', day: 6 }).state;
  const dismissed = settleVisit(opened, { type: 'dismiss', visitId: 'day-6-board' }).state;
  assert.deepEqual(counterNotes(dismissed).map((note) => note.id), ['water', 'board']);
  const read = settleVisit(dismissed, { type: 'readNotes', day: 6 });
  const restored = readSave(JSON.stringify({ version: saveVersion, ...read })).state;
  const day8 = { ...restored, day: 8, visitIndex: 0 };
  assert.deepEqual(counterNotes(day8).filter((note) => !day8.readNoteIds.includes(note.id)).map((note) => note.id), ['winch']);
  assert.equal(restored.visitIndex, dismissed.visitIndex);
  assert.equal(restored.cash, 140);
});
test('新版零现金可拒绝所有交易走完十天，旧版合同照常结算', () => {
  let state = { ...openCounter(0), economy: 'port', harborSchedule: 'late' };
  for (let day = 1; day <= 10; day++) {
    if (day === 6) state = settleVisit(state, { type: 'continue', day }).state;
    if (day > 1) state = settleVisit(state, { type: 'open', day }).state;
    let visit;
    while ((visit = currentVisit(day, state.visitIndex, state.economy, state.harborSchedule))) {
      assert.notEqual(visit.kind, 'waterReserve');
      state = settleVisit(state, { type: 'dismiss', visitId: visit.id }).state;
    }
    state = settleVisit(state, { type: 'close', day }).state;
    assert.equal(state.day, day + 1);
  }
  assert.equal(state.cash, 0);
  assert.equal(state.waterShortfall, 0);
  assert.deepEqual(state.ledger, []);
  assert.equal(currentVisit(7, 1).kind, 'waterReserve');
});

test('船期真的移动采购，老档在五日小结可切换并原样取回 F2', () => {
  assert.equal(currentVisit(9, 1, 'port')?.price, 155);
  assert.equal(currentVisit(10, 0, 'port'), undefined);
  assert.equal(currentVisit(9, 1, 'port', 'late'), undefined);
  assert.equal(currentVisit(10, 0, 'port', 'late')?.price, 155);
  const installedPurifier = { ...currentVisit(2, 1).item, cost: 80 };
  const old = { ...openCounter(150), day: 6, awaitingOpen: true, installedPurifier };
  const upgraded = settleVisit(old, { type: 'continue', upgrade: true, day: 6 }).state;
  const opened = settleVisit(upgraded, { type: 'open', day: 6 }).state;
  const action = { type: 'reclaimPurifier', day: 6 };
  const reclaimed = settleVisit(opened, action);
  assert.equal(reclaimed.state.cash, 150);
  assert.deepEqual(reclaimed.state.inventory, [installedPurifier]);
  assert.equal(reclaimed.state.installedPurifier, null);
  const restored = readSave(JSON.stringify({ version: saveVersion, ...reclaimed })).state;
  assert.equal(settleVisit(restored, action).state, restored);
});
