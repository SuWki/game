import assert from 'node:assert/strict';
import test from 'node:test';
import { counterNotes, openCounter, outingPlan, ropeVisit, settleVisit } from '../src/counter.ts';
import { voyageOdds, voyageResult, voyageRoll } from '../src/outing.ts';
import { cutQuote, pickStone, stoneOdds, stoneResult, trialCut } from '../src/jade.ts';
import { board, crateInspection, cratePartPrice, currentVisit, harborPeriod, lantern, salvageCrate, salvageWindow, scheduledVisits, unpackCrate } from '../src/scenario.ts';
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
test('F2 约见必须到次日且交货时拥有合格机器，只入账一次', () => {
  const start = { ...openCounter(0), day: 6, economy: 'port', chapterTwoStarted: true, knowsMechanicRequest: true };
  const booked = settleVisit(start, { type: 'bookF2', day: 6 }).state;
  assert.equal(settleVisit(booked, { type: 'deliverF2', day: 6 }).state, booked);
  const due = { ...booked, day: 7 };
  assert.equal(settleVisit(due, { type: 'deliverF2', day: 7 }).state, due);
  const item = { ...currentVisit(2, 1).item, cost: 80 };
  const sale = { type: 'deliverF2', day: 7 };
  const sold = settleVisit({ ...due, inventory: [item] }, sale);
  assert.equal(sold.state.cash, 110);
  assert.deepEqual(sold.state.inventory, []);
  const restored = readSave(JSON.stringify({ version: saveVersion, ...sold })).state;
  assert.equal(settleVisit(restored, sale).state, restored);
});

test('介绍合格货主可从零现金入账，错配和重复提交不付费', () => {
  const start = { ...openCounter(0), day: 7, economy: 'port', chapterTwoStarted: true };
  const accepted = settleVisit(start, { type: 'acceptReferral', day: 7 }).state;
  const wrong = { type: 'referSupplier', supplier: 'boat', day: 7 };
  const right = { ...wrong, supplier: 'workshop' };
  assert.equal(settleVisit(accepted, wrong).state, accepted);
  const paid = settleVisit(accepted, right).state;
  assert.equal(paid.cash, 12);
  assert.deepEqual(paid.inventory, []);
  assert.equal(settleVisit(paid, right).state, paid);
  const expired = { ...accepted, day: 10 };
  assert.equal(settleVisit(expired, { ...right, day: 10 }).state, expired);
});
test('第十天旧存档可继续开轮，跨轮当票只能赎原件一次', () => {
  const summary = { ...openCounter(80), day: 11, economy: 'port', awaitingOpen: true, chapterTwoStarted: true };
  const restored = readSave(JSON.stringify({ version: saveVersion, state: summary, message: '', tone: 'neutral' })).state;
  assert.equal(settleVisit(restored, { type: 'open', day: 11 }).state, restored);
  const ready = settleVisit(restored, { type: 'continue', day: 11 }).state;
  const day15 = { ...ready, day: 15, awaitingOpen: false };
  const pledge = currentVisit(15, 0, 'port');
  const pawned = settleVisit(day15, { type: 'offer', visitId: pledge.id, attempt: 0, amount: 18 }).state;
  const nextSummary = settleVisit(pawned, { type: 'close', day: 15 }).state;
  assert.equal(nextSummary.tickets[0].status, 'held');
  const acceptance = settleVisit(nextSummary, { type: 'continue', day: 16 }).state;
  const day17 = { ...acceptance, day: 17, awaitingOpen: false };
  const visit = currentVisit(17, 0, 'port');
  const redeemed = settleVisit(day17, { type: 'redeem', visitId: visit.id }).state;
  assert.equal(redeemed.cash, 85);
  assert.equal(redeemed.tickets[0].status, 'redeemed');
  assert.equal(settleVisit(redeemed, { type: 'redeem', visitId: visit.id }).state, redeemed);
});

test('续轮的同型货有独立编号，零现金介绍费每轮一次', () => {
  const first = currentVisit(11, 0, 'port');
  const third = currentVisit(21, 0, 'port');
  assert.equal(first.item.name, third.item.name);
  assert.notEqual(first.item.id, third.item.id);
  const start = { ...openCounter(0), day: 13, economy: 'port', chapterTwoStarted: true, activeRoundStart: 11 };
  const paid = settleVisit(start, { type: 'roundReferral', day: 13 }).state;
  assert.equal(paid.cash, 8);
  assert.equal(settleVisit(paid, { type: 'roundReferral', day: 13 }).state, paid);
  assert.equal(settleVisit({ ...paid, day: 18, activeRoundStart: 16 }, { type: 'roundReferral', day: 18 }).state.cash, 16);
});
test('维修和短租移出自有库存，到期开门归还并各自结账一次', () => {
  const purifier = { ...currentVisit(2, 1).item, cost: 80 };
  const start = { ...openCounter(150), day: 14, economy: 'port', activeRoundStart: 11, chapterTwoStarted: true,
    inventory: [purifier] };
  const stocked = settleVisit({ ...start, day: 11 }, { type: 'buyRepairStock', day: 11 }).state;
  const winch = stocked.inventory[1];
  const d14 = { ...stocked, day: 14, visitIndex: 1 };
  const repaired = settleVisit(d14, { type: 'sendRepair', day: 14, itemId: winch.id }).state;
  const rented = settleVisit(repaired, { type: 'rentF2', day: 14, itemId: purifier.id }).state;
  assert.equal(rented.cash, 33);
  assert.deepEqual(rented.inventory, []);
  assert.equal(settleVisit(rented, { type: 'sellRepairStock', day: 14 }).state, rented);
  const closed = settleVisit(rented, { type: 'close', day: 14 });
  const restored = readSave(JSON.stringify({ version: saveVersion, ...closed })).state;
  const ready = settleVisit(restored, { type: 'open', day: 15 }).state;
  assert.equal(ready.inventory[0].cost, 117);
  assert.equal(ready.inventory[0].condition, '可用');
  const sale = { type: 'sellRepairStock', day: 15 };
  const sold = settleVisit(ready, sale).state;
  assert.equal(sold.cash, 188);
  assert.equal(settleVisit(sold, sale).state, sold);
  const rentalReturn = { type: 'open', day: 17 };
  const returned = settleVisit({ ...sold, day: 17, activeRoundStart: 16, awaitingOpen: true }, rentalReturn).state;
  assert.equal(returned.cash, 200);
  assert.deepEqual(returned.inventory, [purifier]);
  assert.equal(settleVisit(returned, rentalReturn).state, returned);
});
test('混装货箱原封出售或拆成三件，拆封结果跨轮和刷新稳定', () => {
  for (const [day, split, expected] of [[16, false, 107], [16, true, 90], [26, true, 120]]) {
    const start = { ...openCounter(100), day, economy: 'port', activeRoundStart: day, chapterTwoStarted: true };
    const buy = { type: 'buyCrate', day };
    const stocked = settleVisit(start, buy).state;
    assert.equal(stocked.cash, 48);
    const crate = stocked.inventory[0];
    assert.equal(settleVisit(stocked, buy).state, stocked);
    assert.equal(settleVisit(stocked, { type: 'sellCrateGoods', day, itemId: crate.id }).state, stocked);
    const opened = split ? settleVisit(stocked, { type: 'openCrate', day, itemId: crate.id }).state : stocked;
    if (split) {
      assert.equal(opened.inventory.length, 3);
      assert.equal(opened.inventory.reduce((total, part) => total + part.cost, 0), 52);
      assert.equal(settleVisit(opened, { type: 'openCrate', day, itemId: crate.id }).state, opened);
      const later = settleVisit({ ...stocked, day: day + 5, activeRoundStart: day + 5 }, { type: 'openCrate', day: day + 5, itemId: crate.id }).state;
      assert.deepEqual(later.inventory, opened.inventory);
    }
    let state = readSave(JSON.stringify({ version: saveVersion, state: { ...opened, day: day + 3 }, message: '', tone: 'neutral' })).state;
    for (const item of state.inventory) {
      const sale = { type: 'sellCrateGoods', day: day + 3, itemId: item.id };
      state = settleVisit(state, sale).state;
      assert.equal(settleVisit(state, sale).state, state);
    }
    assert.equal(state.cash, expected);
    assert.deepEqual(state.inventory, []);
  }
});

test('两种船期的封箱线索与原批次相符，隔轮也能查到下一次货棚收购日', () => {
  for (const schedule of [undefined, 'late']) {
    const firstNight = schedule ? 11 : 16;
    for (let start = firstNight; start < firstNight + 60; start += 10) {
      const crate = salvageCrate(start, schedule);
      const damp = crate.observations[1].includes('盐花');
      assert.equal(damp || crate.observations[1].includes('干燥'), true);
      // 上一版入库的箱子带有旧货签，续玩后仍按原批次验货。
      const oldCrate = { ...crate, observations: ['旧货签'] };
      assert.deepEqual(crateInspection(oldCrate.id, schedule), crate.observations);
      const total = unpackCrate(oldCrate, schedule).reduce((sum, item) => sum + cratePartPrice(item), 0);
      assert.equal(total, damp ? 42 : 72);
      for (const day of [start, start + 3, start + 4]) {
        assert.deepEqual(salvageWindow(day, schedule), { first: start + 3, last: start + 4 });
      }
      assert.deepEqual(salvageWindow(start + 5, schedule), { first: start + 13, last: start + 14 });
    }
  }
});

test('差一元可日内筹钱再收箱，挂牌散件转交货棚后隔天不会再收寄售款', () => {
  const start = { ...openCounter(51), day: 18, economy: 'port', activeRoundStart: 16, chapterTwoStarted: true };
  const buy = { type: 'buyCrate', day: 18 };
  const short = settleVisit(start, buy);
  assert.equal(short.state, start);
  assert.match(short.message, /差 1 元/);
  const funded = settleVisit(start, { type: 'roundReferral', day: 18 }).state;
  const stocked = settleVisit(funded, buy).state;
  assert.equal(stocked.cash, 7);
  const split = settleVisit(stocked, { type: 'openCrate', day: 18, itemId: stocked.inventory[0].id }).state;
  const rope = split.inventory[0];
  const day19 = { ...split, day: 19, visitIndex: 1 };
  const listed = settleVisit(day19, { type: 'listItem', day: 19, itemId: rope.id, price: 6 }).state;
  assert.equal(listed.consignment.itemId, rope.id);
  const delivered = settleVisit(listed, { type: 'sellCrateGoods', day: 19, itemId: rope.id }).state;
  const closed = settleVisit(delivered, { type: 'close', day: 19 });
  const restored = readSave(JSON.stringify({ version: saveVersion, ...closed })).state;
  const next = settleVisit(restored, { type: 'open', day: 20 }).state;
  assert.equal(next.day, 20);
  assert.equal(next.cash, 17);
  assert.equal(next.inventory.length, 2);
  assert.equal(next.consignment, undefined);
});

function dockAt(cash, day = 20) {
  return { ...openCounter(cash), day, economy: 'port', activeRoundStart: day - 4,
    chapterTwoStarted: true, visitIndex: scheduledVisits(day, 'port') };
}

test('搬运班按真实交付邀约，同日先赎当，短绳撤牌并只结一次', () => {
  let state = { ...dockAt(140), day: 16, visitIndex: 0 };
  state = settleVisit(state, { type: 'buyCrate', day: 16 }).state;
  state = settleVisit(state, { type: 'openCrate', day: 16, itemId: state.inventory[0].id }).state;
  const [rope, fuse] = state.inventory;
  assert.equal(ropeVisit({ ...state, day: 21, activeRoundStart: 21 }), undefined);
  state = settleVisit({ ...state, day: 19 }, { type: 'sellCrateGoods', day: 19, itemId: fuse.id }).state;
  const arrived = reloadState({ ...state, day: 21, activeRoundStart: 21, visitIndex: 0 });
  const book = { type: 'bookRopeVisit', day: 21 };
  assert.equal(counterNotes(arrived).filter(({ id }) => id === 'rope-visit-21').length, 1);
  assert.equal(ropeVisit({ ...arrived, day: 24 }).canBook, false);
  const booked = reloadState(settleVisit(arrived, book).state);
  assert.equal(settleVisit(booked, book).state, booked);
  const action = { type: 'deliverRope', day: 22, itemId: rope.id };
  const due = { ...booked, day: 22 };
  assert.equal(settleVisit(due, action).state, due);
  assert.equal(ropeVisit({ ...booked, day: 23 }).today, false);
  const ready = settleVisit({ ...due, visitIndex: 2 }, { type: 'listItem', day: 22, itemId: rope.id, price: 6 }).state;
  const missing = { ...ready, inventory: ready.inventory.filter(({ id }) => id !== rope.id) };
  assert.equal(settleVisit(missing, action).state, missing);
  const delivered = reloadState(settleVisit(ready, action).state);
  assert.equal(delivered.cash, ready.cash + 15);
  assert.equal(delivered.consignment, undefined);
  assert.equal(settleVisit(delivered, action).state, delivered);
});

function reloadState(state) {
  return readSave(JSON.stringify({ version: saveVersion, state, message: '', tone: 'neutral' })).state;
}

function voyageSeed(day, grade) {
  for (let seed = 0; ; seed++) {
    if (voyageResult(voyageRoll(seed, day, false), false) === grade) return seed;
  }
}

test('旧档打烊解锁打捞，船位按出发轮次计，32 元门槛和装备只扣一次', () => {
  const old = reloadState(dockAt(49));
  const closed = settleVisit(old, { type: 'close', day: 20 }).state;
  assert.equal(typeof closed.outingSeed, 'number');
  assert.equal(outingPlan(closed), undefined);
  const plan = settleVisit(reloadState(closed), { type: 'continue', day: 21 }).state;
  const book = { type: 'bookVoyage', day: 21 };
  assert.equal(outingPlan(plan).boatShortfall, 1);
  assert.equal(settleVisit(plan, book).state, plan);
  const gear = { type: 'buyOutingWinch', day: 21 };
  const poor = { ...plan, cash: 55 };
  assert.equal(settleVisit(poor, gear).state, poor);
  const equipped = settleVisit({ ...plan, cash: 56 }, gear).state;
  assert.equal(equipped.cash, 32);
  assert.equal(settleVisit(equipped, gear).state, equipped);
  const booked = settleVisit({ ...equipped, cash: 50 }, book).state;
  assert.equal(booked.cash, 32);
  assert.equal(booked.ledger.at(-1).day, 20);
  assert.equal(outingPlan(booked).remaining, 1);
  assert.equal(settleVisit(booked, book).state, booked);
  const revealed = settleVisit(reloadState(booked), { type: 'revealVoyage', day: 21, stage: 0 }).state;
  assert.equal(revealed.voyage.grade, booked.voyage.grade);
  const opened = settleVisit(reloadState(revealed), { type: 'open', day: 21 }).state;
  assert.equal(opened.voyage, undefined);
  assert.equal(settleVisit(opened, { type: 'open', day: 21 }).state, opened);
  const twice = settleVisit({ ...opened, cash: 50, day: 22, awaitingOpen: true }, { ...book, day: 22 }).state;
  assert.equal(outingPlan({ ...twice, day: 25, voyage: undefined }).remaining, 0);
  assert.equal(outingPlan({ ...twice, day: 26, activeRoundStart: 26, voyage: undefined }).remaining, 2);
  for (const equipped of [false, true]) {
    const results = Array.from({ length: 100 }, (_, roll) => voyageResult(roll, equipped));
    assert.deepEqual(['empty', 'worn', 'sound', 'long'].map((grade) => results.filter((result) => result === grade).length), voyageOdds(equipped));
  }
});

test('滤芯可换装、拆回按余次出售，制水每天一次且用尽时报废', () => {
  for (const grade of ['sound', 'worn']) {
    const start = { ...dockAt(124), day: 21, activeRoundStart: 21, awaitingOpen: true, outingSeed: voyageSeed(21, grade) };
    const booked = settleVisit(start, { type: 'bookVoyage', day: 21 }).state;
    const opened = settleVisit(reloadState(booked), { type: 'open', day: 21 }).state;
    assert.equal(opened.cash, 106);
    assert.equal(opened.inventory.length, 1);
    const itemId = opened.inventory[0].id;
    const mounted = settleVisit(opened, { type: 'mountFilter', day: 21, itemId }).state;
    const used = settleVisit(mounted, { type: 'takeWaterJob', day: 21 }).state;
    assert.equal(used.cash, 114);
    assert.equal(settleVisit(reloadState(used), { type: 'takeWaterJob', day: 21 }).state.cash, 114);
    assert.equal(settleVisit(used, { type: 'sellFilter', day: 21, itemId }).state, used);
    const day22 = settleVisit({ ...used, day: 22 }, { type: 'takeWaterJob', day: 22 }).state;
    assert.equal(day22.cash, 122);
    if (grade === 'worn') {
      assert.equal(day22.mountedFilter, undefined);
      assert.match(day22.ledger.at(-1).description, /报废/);
    } else {
      const withSpare = { ...day22, inventory: [{ ...opened.inventory[0], id: 'voyage-22-filter' }] };
      const swapped = settleVisit(withSpare, { type: 'mountFilter', day: 22, itemId: 'voyage-22-filter' }).state;
      assert.equal(swapped.inventory[0].filter.remaining, 3);
      assert.equal(settleVisit(swapped, { type: 'takeWaterJob', day: 22 }).state, swapped);
      const removed = settleVisit(swapped, { type: 'removeFilter', day: 22 }).state;
      assert.equal(removed.inventory.length, 2);
      const sold = settleVisit(removed, { type: 'sellFilter', day: 22, itemId }).state;
      assert.equal(sold.cash, 142);
      assert.equal(settleVisit(sold, { type: 'sellFilter', day: 22, itemId }).state, sold);
    }
  }
});

test('打捞和挑石共用船位及现钱门槛，透光灯永久生效', () => {
  const closed = settleVisit(dockAt(55), { type: 'close', day: 20 }).state;
  const first = settleVisit(closed, { type: 'continue', day: 21 }).state;
  const book = { type: 'bookStoneTrip', day: 21 };
  const lamp = { type: 'buyJadeLamp', day: 21 };
  assert.equal(outingPlan(first).stoneShortfall, 1);
  assert.equal(settleVisit(first, book).state, first);
  const lit = reloadState(settleVisit({ ...first, cash: 82 }, lamp).state);
  assert.equal(lit.cash, 56);
  assert.equal(settleVisit(lit, lamp).state, lit);
  const paid = reloadState(settleVisit(lit, book).state);
  assert.equal(paid.cash, 32);
  assert.deepEqual(paid.stoneTrip.jade, pickStone(lit.outingSeed, 21, true));
  assert.equal(settleVisit(paid, { type: 'bookVoyage', day: 21 }).state, paid);
  assert.equal(settleVisit(paid, book).state, paid);
  const opened = settleVisit(paid, { type: 'open', day: 21 }).state;
  assert.equal(opened.inventory.length, 1);
  assert.equal(opened.inventory[0].jade.opened, false);
  assert.equal(settleVisit(opened, { type: 'open', day: 21 }).state, opened);
  const second = settleVisit({ ...opened, day: 22, awaitingOpen: true, cash: 50 }, { type: 'bookVoyage', day: 22 }).state;
  assert.equal(outingPlan({ ...second, voyage: undefined, day: 23 }).remaining, 0);
  assert.equal(outingPlan({ ...second, voyage: undefined, day: 26, activeRoundStart: 26 }).remaining, 2);
  for (const equipped of [false, true]) {
    const results = Array.from({ length: 100 }, (_, roll) => stoneResult(roll, equipped));
    assert.deepEqual(['rough', 'plain', 'fine', 'rare'].map((grade) => results.filter((result) => result === grade).length), stoneOdds(equipped));
  }
});

test('工坊校验裂纹和重叠，净到手 42/48 元，跨轮开门只结算一次', () => {
  const edge = { grade: 'fine', face: 'edge', opened: true };
  const split = { ...edge, face: 'split' };
  assert.equal(cutQuote(split, 'seal', [{ anchor: 0, vertical: false }]), undefined);
  assert.equal(cutQuote(edge, 'pendants', [{ anchor: 3, vertical: false }]), undefined);
  assert.equal(cutQuote(edge, 'pendants', [{ anchor: 0, vertical: false }, { anchor: 1, vertical: false }]), undefined);
  assert.equal(cutQuote(split, 'pendants', trialCut(split, 'pendants')).cells, 12);
  for (const [kind, fee, payout] of [['pendants', 5, 47], ['seal', 8, 56]]) {
    const item = { id: 'outing-25-jade', name: '待开窗原石', model: '玉料', condition: '石皮完整', observations: [], jade: { ...edge, opened: false }, cost: 24 };
    const start = { ...dockAt(100, 25), outingSeed: 42, inventory: [item] };
    const target = { day: 25, itemId: item.id };
    assert.equal(settleVisit(start, { ...target, type: 'sellJade' }).state, start);
    const opened = reloadState(settleVisit(start, { ...target, type: 'openJade' }).state);
    assert.equal(settleVisit(opened, { ...target, type: 'sellJade' }).state.cash, 142);
    const action = { ...target, type: 'sendJade', kind, placements: trialCut(edge, kind) };
    const sent = settleVisit(opened, action).state;
    assert.equal(sent.cash, 100 - fee);
    assert.equal(sent.inventory.length, 0);
    assert.equal(settleVisit(sent, action).state, sent);
    const closed = reloadState(settleVisit(sent, { type: 'close', day: 25 }).state);
    const plan = settleVisit(closed, { type: 'continue', day: 26 }).state;
    assert.equal(outingPlan(plan).knownReceipts, payout);
    const ready = settleVisit(plan, { type: 'open', day: 26 }).state;
    assert.equal(ready.cash, 100 - fee + payout);
    assert.equal(ready.jadeOrders.length, 0);
    assert.equal(settleVisit(reloadState(ready), { type: 'open', day: 26 }).state.cash, ready.cash);
  }
});

test('母船每日收一次船籍费并耗一日水，缺额可值班或确认停业', () => {
  const start = { ...openCounter(25), day: 1, economy: 'port', visitIndex: 2 };
  const act = (s, type, extra = {}) => settleVisit(s, { type, day: s.day, ...extra }).state;
  const aboard = act(start, 'boardShip');
  assert.equal(aboard.ship.water, 3);
  assert.equal(act(aboard, 'boardShip'), aboard);
  for (const [choice, days, price] of [[0,1,4],[1,3,10],[2,5,15]]) {
    const stocked = act(aboard, 'buyWater', {choice});
    assert.equal(stocked.cash, 25-price);
    assert.equal(stocked.ship.water, 3+days);
  }
  const closed = reloadState(act(aboard, 'close'));
  assert.equal(closed.cash, 19);
  assert.equal(closed.ship.water, 2);
  assert.equal(act(closed, 'close'), closed);
  const poor = { ...aboard, cash: 2, ship: { water: 0 } };
  assert.equal(act(poor, 'close'), poor);
  const helped = act(poor, 'shipRelief');
  assert.equal(helped.cash, 8);
  assert.equal(act(helped, 'shipRelief'), helped);
  const paid = act(helped, 'close');
  assert.equal(paid.cash, 2);
  assert.equal(paid.ship.water, 0);
  const tomorrow = { ...act(paid, 'open'), visitIndex: 2 };
  assert.equal(act(tomorrow, 'shipRelief'), tomorrow);
  const ended = reloadState(act(tomorrow, 'close', {confirmShortfall:true}));
  assert.equal(ended.ship.closed, true);
  assert.equal(act(ended, 'buyWater', {choice:0}), ended);
  assert.equal(reloadState(start).ship, undefined);
});

test('母船跨站沿用实物成本，密封条只进一批，岸市收购一次', () => {
  const start = { ...openCounter(100), day: 5, economy:'port', ship:{water:2}, visitIndex:1 };
  const buy = {type:'buyCargo', day:5, choice:0};
  const bought = settleVisit(start,buy).state;
  assert.equal(bought.cash,86);
  assert.equal(settleVisit(bought,buy).state,bought);
  const itemId=bought.inventory[0].id;
  assert.equal(settleVisit(bought,{type:'sellCargo',day:5,itemId}).state.cash,98);
  const closed=reloadState(settleVisit(bought,{type:'close',day:5}).state);
  const continued=settleVisit(closed,{type:'continue',day:6}).state;
  const opened=settleVisit(continued,{type:'open',day:6}).state;
  const sale={type:'sellCargo',day:6,itemId};
  const paid=settleVisit(opened,sale).state;
  assert.equal(paid.cash,107);
  assert.equal(paid.inventory.length,0);
  assert.equal(settleVisit(paid,sale).state,paid);
});

test('母船打捞滤芯可给自己制三日水，占用当天制水机会', () => {
  const start = { ...dockAt(124), day:21, activeRoundStart:21, awaitingOpen:true,
    outingSeed:voyageSeed(21,'worn'), ship:{water:0} };
  const trip = settleVisit(start,{type:'bookVoyage',day:21}).state;
  const open = settleVisit(trip,{type:'open',day:21}).state;
  const mounted = settleVisit(open,{type:'mountFilter',day:21,itemId:open.inventory[0].id}).state;
  const filled = reloadState(settleVisit(mounted,{type:'fillShipWater',day:21}).state);
  assert.equal(filled.ship.water,3);
  assert.equal(filled.mountedFilter.filter.remaining,1);
  assert.equal(filled.cash,106);
  assert.equal(settleVisit(filled,{type:'takeWaterJob',day:21}).state,filled);
});

test('浮田加购只在首站限收一件，现货与柜台工单照原价结算', () => {
  const start = { ...openCounter(140), day: 4, economy: 'port', ship: { water: 2 } };
  const stocked = settleVisit(start, { type: 'buyCargo', day: 4, choice: 0 }).state;
  const [seal] = stocked.inventory;
  const deliver = (state, itemId = seal.id) => settleVisit(state, { type: 'deliverFloatFarmSeal', day: state.day, itemId });
  assert.match(counterNotes(stocked).at(-1).text, /第 6–7 天.*34 元.*27 元/);
  assert.equal(deliver(stocked).state, stocked);
  const opened = { ...stocked, day: 7, chapterTwoStarted: true };
  const ready = settleVisit(opened, { type: 'buyCargo', day: 7, choice: 0 }).state;
  const second = ready.inventory.at(-1);
  assert.equal(deliver({ ...ready, awaitingOpen: true }).state.cash, ready.cash);
  for (const day of [8, 11, 21]) {
    const expired = { ...ready, day };
    assert.equal(deliver(expired).state, expired);
  }
  const delivered = reloadState(deliver(ready).state);
  assert.equal(delivered.cash - ready.cash, 34);
  assert.equal(deliver(delivered, second.id).state, delivered);
  const ordinary = settleVisit(delivered, { type: 'sellCargo', day: 7, itemId: second.id }).state;
  assert.equal(ordinary.cash - delivered.cash, 27);
  const withBoard = { ...ordinary, inventory: [{ ...board, cost: 30 }] };
  const visit = currentVisit(7, 0, 'port');
  const contract = settleVisit(withBoard, { type: 'sell', visitId: visit.id }).state;
  assert.equal(contract.cash - ordinary.cash, 55);
});

test('航程预算按最低补水组合算缺口，靠岸日重置剩余夜数', async () => {
  const { crossingBudget } = await import('../src/ship.ts');
  assert.deepEqual(crossingBudget(1, 200, 3), {
    nights: 5, missingWater: 2, waterSpend: 8, total: 38, gap: 0, tonightGap: 0,
  });
  assert.equal(crossingBudget(1, 30, 1).waterSpend, 14);
  assert.deepEqual(crossingBudget(15, 5, 0), {
    nights: 1, missingWater: 1, waterSpend: 4, total: 10, gap: 5, tonightGap: 5,
  });
  assert.equal(crossingBudget(16, 10, 0).total, 45);
});

test('阿岑展期沿用原当票，部分还款、到期处理与重逢均唯一', async () => {
  const { careerVisit, mechanicTicket, ticketExtension } = await import('../src/career.ts');
  const make = (state, day) => ({ ...state, day, activeRoundStart: (Math.floor((day - 1) / 5) * 5 + 1),
    awaitingOpen: false, visitIndex: scheduledVisits(day, 'port') });
  const act = (state, task) => settleVisit(state, { type: 'career', day: state.day, task }).state;
  const start = make({ ...dockAt(80), ship: { water: 8 } }, 21);
  const pawned = act(start, 'pawn');
  assert.equal(pawned.cash, 50);
  assert.equal(pawned.tickets[0].id, mechanicTicket);
  assert.equal(act(pawned, 'pawn'), pawned);
  const due = make(pawned, 23);
  const extended = reloadState(act(due, 'extend'));
  assert.equal(extended.cash, 62);
  assert.equal(extended.tickets[0].principal, 18);
  assert.equal(extended.tickets[0].dueDay, 25);
  assert.deepEqual(ticketExtension(extended, extended.tickets[0]),
    { originalLoan: 30, originalDue: 23, currentDue: 25, paid: 12, outstanding: 24 });
  assert.equal(act(extended, 'extend'), extended);
  const redeemed = reloadState(act(make(extended, 25), 'redeem'));
  assert.equal(redeemed.cash, 86);
  assert.equal(redeemed.tickets[0].status, 'redeemed');
  assert.equal(ticketExtension(redeemed, redeemed.tickets[0]).paid, 36);
  assert.equal(ticketExtension(redeemed, redeemed.tickets[0]).outstanding, 0);
  assert.equal(careerVisit(make(redeemed, 36)).kind, 'reunion');
  const refused = act(due, 'refuse');
  const expired = settleVisit(refused, { type: 'close', day: 23 }).state;
  assert.equal(expired.inventory[0].cost, 30);
  assert.equal(expired.tickets[0].status, 'expired');
});

test('从船坞买料造船，住船跨航段与借宿独立结算', async () => {
  const { careerLog, playerBoat, shipNight } = await import('../src/career.ts');
  const day = 31;
  let state = { ...dockAt(160, 35), day, ship: { water: 6 }, visitIndex: scheduledVisits(day, 'port') };
  const act = (task, choice) => { state = settleVisit(state, { type: 'career', day: state.day, task, choice }).state; };
  act('claim'); act('buy', 0); act('build', 0); act('buy', 1); act('build', 1);
  state = settleVisit(state, { type: 'buyCargo', day, choice: 0 }).state;
  act('build', 2);
  assert.equal(state.cash, 76);
  assert.equal(shipNight(state).cash, 6);
  act('home');
  assert.equal(shipNight(state).cash, 7);
  const before = state;
  state = settleVisit(state, { type: 'close', day }).state;
  assert.equal(state.cash, 69);
  assert.equal(settleVisit(state, { type: 'close', day }).state, state);
  assert.equal(shipNight(reloadState(state)).cash, 2);
  assert.equal(shipNight(state, 36).cash, 7);
  state = { ...before, day: 32, visitIndex: scheduledVisits(32, 'port') };
  act('buy', 2); act('build', 3); act('buy', 0); act('buy', 3); act('build', 4);
  assert.deepEqual(playerBoat(state).complete, [true, true, true, true, true]);
  act('host');
  assert.equal(shipNight(state).water, 2);
  assert.equal(shipNight(state).food, 2);
  state = { ...state, ship: { water: 1 } };
  assert.equal(settleVisit(state, { type: 'close', day: 32 }).state, state);
  act('transfer');
  assert.equal(shipNight(state).water, 1);
  assert.equal(state.ledger.filter((entry) => entry.description === careerLog.transfer).length, 1);
});

test('洗衣班验实物余次，母船交货与受邀登船共用一件额度', async () => {
  const { boatWorkLog, careerLog, laundryOrder } = await import('../src/career.ts');
  const day = 51;
  const item = { id: 'filter-test', name: '旧芯', model: '滤芯', condition: '旧芯', observations: [],
    cost: 18, filter: { grade: 'worn', remaining: 2 } };
  const entry = (description, refDay) => ({ description, day: refDay, itemId: null, change: 0, balance: 100 });
  const cashDesk = { ...dockAt(100, 40), day: 36, ship: { water: 5 }, inventory: [item], visitIndex: scheduledVisits(36, 'port'),
    ledger: [entry(careerLog.met, 21), entry(careerLog.laundry, 21), entry(boatWorkLog(3), 31)] };
  assert.equal(laundryOrder(cashDesk).priority, true);
  const reunited = { ...cashDesk, ledger: [...cashDesk.ledger, entry(careerLog.reunion, 36)] };
  assert.equal(laundryOrder(reunited).onBoat, false);
  const publicSell = { type: 'career', day: 36, task: 'laundry', itemId: item.id };
  const firstAfterReunion = settleVisit(reunited, publicSell).state;
  assert.equal(laundryOrder(firstAfterReunion).introductionDay, 36);
  const startedByRedemption = { ...reunited, ledger: [...cashDesk.ledger, entry(careerLog.redeemed, 25), entry(careerLog.reunion, 36)] };
  assert.equal(laundryOrder(startedByRedemption).introductionDay, 36);
  assert.equal(laundryOrder(startedByRedemption).onBoat, false);
  const supplied = settleVisit(startedByRedemption, publicSell).state;
  assert.equal(laundryOrder(supplied).endorsementDay, 36);
  const start = { ...supplied, cash: 100, inventory: [item], day, activeRoundStart: day, visitIndex: scheduledVisits(day, 'port') };
  assert.equal(laundryOrder(start).onBoat, true);
  const book = { type: 'career', day, task: 'bookLaundry', onBoat: true };
  const fromPreview = settleVisit({ ...start, day: 50 }, { ...book, day: 50 }).state;
  assert.equal(laundryOrder({ ...fromPreview, day }).booked, true);
  const booked = settleVisit(start, book).state;
  const sell = { type: 'career', day, task: 'laundry', itemId: item.id, onBoat: true };
  const wrongLocation = { ...sell, onBoat: false };
  assert.equal(settleVisit(booked, wrongLocation).state, booked);
  const cancelled = settleVisit(booked, { type: 'career', day, task: 'cancelLaundry' }).state;
  assert.equal(settleVisit(cancelled, wrongLocation).state.cash, 122);
  const missed = { ...booked, day: 66, activeRoundStart: 66 };
  assert.equal(laundryOrder(missed).priority, false);
  const madeGood = settleVisit(missed, { ...wrongLocation, day: 66 }).state;
  assert.equal(laundryOrder(madeGood).priority, true);
  const worn = { ...booked, inventory: [{ ...item, filter: { ...item.filter, remaining: 1 } }] };
  assert.equal(settleVisit(worn, sell).state, worn);
  const sold = reloadState(settleVisit(booked, sell).state);
  assert.equal(sold.cash, 122);
  assert.equal(settleVisit(sold, { ...sell, onBoat: false }).state, sold);
  assert.ok(sold.ledger.some(({ description }) => description === careerLog.referral));
});

test('船材打捞共用外出名额，保存后按指定目标回港入库', () => {
  const day = 32;
  const state = { ...dockAt(80, 35), day, awaitingOpen: true, ship: { water: 3 },
    outingSeed: voyageSeed(day, 'worn'),
    ledger: [{ day: 31, itemId: null, description: '认领自有泊位', change: 0, balance: 80 }] };
  const booked = reloadState(settleVisit(state, { type: 'bookMaterialTrip', day }).state);
  assert.equal(booked.cash, 62);
  assert.equal(booked.voyage.target, 'materials');
  assert.equal(outingPlan(booked).remaining, 1);
  const restored = settleVisit(booked, { type: 'open', day }).state;
  assert.equal(restored.inventory[0].name, '船壳板');
  assert.equal(settleVisit(restored, { type: 'open', day }).state, restored);
});

test('施工预览把付款、缺水和当晚应付计入同一个现金缺口', async () => {
  const { nightBudget } = await import('../src/ship.ts');
  assert.deepEqual(nightBudget(21, 0, { cash: 6, water: 1 }, 18),
    { missingWater: 1, waterSpend: 4, balance: 3, gap: 7 });
  assert.deepEqual(nightBudget(32, 0, { cash: 9, water: 2 }, 18),
    { missingWater: 2, waterSpend: 8, balance: 14, gap: 3 });
  assert.deepEqual(nightBudget(24, 1, { cash: 6, water: 1 }, 18),
    { missingWater: 0, waterSpend: 0, balance: 6, gap: 0 });
});

test('洗衣班首日可改约，末日送客后两个柜台都不能再交货', async () => {
  const { careerLog, laundryOrder } = await import('../src/career.ts');
  const initial = reviewState(51, [reviewFilter], [careerLog.onboardBooking]);
  const career = (state, task, onBoat) => settleVisit(state,
    { type: 'career', day: state.day, task, onBoat, itemId: reviewFilter.id }).state;
  assert.equal(career(initial, 'laundry', false), initial);
  const cancelled = reloadState(career(initial, 'cancelLaundry'));
  const motherSale = reloadState(career(cancelled, 'laundry', false));
  assert.equal(motherSale.cash, 122);
  assert.equal(career(motherSale, 'laundry', false), motherSale);

  const deferred = reloadState(career(initial, 'declineLaundry'));
  assert.equal(career(deferred, 'laundry', true), deferred);
  const next = reloadState({ ...deferred, day: 52, visitIndex: scheduledVisits(52, 'port') });
  const boatSale = reloadState(career(next, 'laundry', true));
  assert.equal(boatSale.cash, 122);
  assert.equal(career(boatSale, 'laundry', true), boatSale);
  const departed = reloadState(career(next, 'declineLaundry'));
  assert.equal(laundryOrder(departed).active, false);
  for (const [task, onBoat] of [['declineLaundry', true], ['cancelLaundry', false], ['laundry', false], ['laundry', true]]) {
    assert.equal(career(departed, task, onBoat), departed);
  }
  assert.equal(laundryOrder({ ...departed, day: 66 }).priority, false);
});

test('失约后公开交船壳板或滤芯恢复预约，卖给普通岸商不恢复', async () => {
  const { careerLog, laundryOrder } = await import('../src/career.ts');
  const hull = { ...reviewFilter, id: 'boat-material-0-yard-31', name: '船壳板', cost: 24, filter: undefined, recyclePrice: 18 };
  const otherHull = { ...hull, id: 'boat-material-0-yard-32' };
  const state = reviewState(66, [hull, otherHull, reviewFilter], [careerLog.onboardBooking]);
  assert.equal(laundryOrder(state).priority, false);
  const deliver = { type: 'career', task: 'materialJob', day: 66, itemId: hull.id };
  const paid = reloadState(settleVisit(state, deliver).state);
  assert.equal(paid.cash, 132);
  assert.equal(settleVisit(paid, { ...deliver, itemId: otherHull.id }).state, paid);
  assert.equal(laundryOrder(paid).priority, true);
  const filterSale = settleVisit(state, { ...deliver, task: 'laundry', itemId: reviewFilter.id }).state;
  assert.equal(laundryOrder(filterSale).priority, true);
  const shoreSale = settleVisit(state, { ...deliver, type: 'sellCargo' }).state;
  assert.ok(shoreSale.cash > state.cash);
  assert.equal(laundryOrder(shoreSale).priority, false);
});

test('已读洗衣班字条跨成交、撤约、送客、过期、换泊和旧档留存', async () => {
  const { careerLog, laundryOrder } = await import('../src/career.ts');
  const id = 'laundry-51';
  const note = (state) => counterNotes(state).find((entry) => entry.id === id);
  const at = (state, day) => reloadState({ ...state, day, visitIndex: scheduledVisits(day, 'port') });
  const read = (state) => settleVisit(state, { type: 'readNotes', day: state.day }).state;
  const act = (state, task) => settleVisit(state,
    { type: 'career', day: state.day, task, itemId: reviewFilter.id }).state;

  const initial = reviewState(51, [reviewFilter], [careerLog.onboardBooking]);
  const seen = reloadState(read(initial));
  assert.deepEqual(seen.readNoteIds.filter((key) => key === id), [id]);
  assert.equal(read(seen), seen);
  const cancelled = reloadState(act(seen, 'cancelLaundry'));
  assert.match(note(cancelled).text, /第 51 天已撤约/);
  const delivered = at(act(cancelled, 'laundry'), 66);
  assert.match(note(delivered).text, /第 51–52 天.*第 51 天已验收，实收 22 元/);
  assert.equal(delivered.cash, 122);
  assert.equal(laundryOrder(delivered).active, true);
  assert.equal(counterNotes(delivered).filter((entry) => entry.id === 'laundry-66').length, 1);
  assert.ok(!delivered.readNoteIds.includes('laundry-66'));

  const sentAway = reloadState(act(at(seen, 52), 'declineLaundry'));
  assert.match(note(sentAway).text, /第 52 天买手已离开/);
  assert.equal(laundryOrder(sentAway).active, false);
  assert.match(note(at(cancelled, 56)).text, /已撤约。验货期已结束/);
  assert.equal(note(at(initial, 56)), undefined);

  const old = reloadState({ ...reviewState(56), ledger: [], readNoteIds: [id, 'laundry-49', 'laundry-66'] });
  assert.match(note(old).text, /第 51–52 天.*验货期已结束/);
  assert.doesNotMatch(note(old).text, /阿岑|已验收|撤约|买手已离开/);
  assert.deepEqual(counterNotes(old).filter((entry) => entry.id.startsWith('laundry-')).map((entry) => entry.id), [id]);

  const trusted = [careerLog.redeemed, careerLog.reunion]
    .map((description) => ({ day: 36, itemId: null, description, change: 0, balance: 100 }));
  const previewRead = read({ ...reviewState(50), ledger: trusted });
  const previewArchive = note(at(previewRead, 56));
  assert.equal(previewArchive.day, 50);
  assert.match(previewArchive.title, /阿岑捎来/);
  assert.match(previewArchive.text, /验货期已结束/);
});

test('零水可用机架时保留水柜报价，先制水后只付固定夜费', async () => {
  const { shipProvisions } = await import('../src/counter.ts');
  const { boatWorkLog, careerLog } = await import('../src/career.ts');
  const state = reloadState({ ...reviewState(32), cash: 6, ship: { water: 0, reliefLeg: 31 },
    outingSeed: 42, mountedFilter: reviewFilter });
  const before = shipProvisions(state);
  assert.deepEqual([before.fixedCash, before.missingWater, before.waterSpend, before.gap, before.canDistill], [6, 1, 4, 0, true]);
  assert.equal(shipProvisions({ ...state, waterJobDay: 32 }).gap, 4);
  assert.equal(shipProvisions({ ...state, cash: 10 }).waterSpend, 4);
  assert.equal(shipProvisions({ ...state, cash: 24 }, 18).gap, 0);
  const filled = reloadState(settleVisit(state, { type: 'fillShipWater', day: 32 }).state);
  assert.equal(filled.mountedFilter.filter.remaining, 1);
  assert.equal(shipProvisions(filled).missingWater, 0);
  assert.equal(shipProvisions(filled).canDistill, false);
  const closed = reloadState(settleVisit(filled, { type: 'close', day: 32 }).state);
  assert.deepEqual([closed.day, closed.cash, closed.ship.water], [33, 0, 2]);

  const hosted = reloadState({ ...state, cash: 9, ledger: [boatWorkLog(2), careerLog.home, careerLog.guest]
    .map((description) => ({ description, day: 32, itemId: null, change: 0, balance: 9 })) });
  const guestBudget = shipProvisions(hosted);
  assert.deepEqual([guestBudget.fixedCash, guestBudget.missingWater, guestBudget.waterSpend, guestBudget.gap], [9, 2, 8, 0]);
  const guestWater = settleVisit(hosted, { type: 'fillShipWater', day: 32 }).state;
  const guestClosed = reloadState(settleVisit(guestWater, { type: 'close', day: 32 }).state);
  assert.deepEqual([guestClosed.cash, guestClosed.ship.water], [0, 1]);
});

const reviewFilter = { id: 'voyage-22-filter', name: '旧芯', model: '滤芯', condition: '旧芯', observations: [],
  cost: 18, filter: { grade: 'worn', remaining: 2 } };

function reviewState(day, inventory = [], booking = []) {
  const entry = (day, description) => ({ day, description, itemId: null, change: 0, balance: 100 });
  return { ...dockAt(100, day), day, activeRoundStart: day - (day - 1) % 5, visitIndex: scheduledVisits(day, 'port'), ship: { water: 5 }, inventory,
    ledger: [entry(21, '浮田洗衣班 · 验收滤芯'), entry(36, '浮田洗衣班 · 验收滤芯'),
      ...booking.map((description) => entry(51, description))] };
}
