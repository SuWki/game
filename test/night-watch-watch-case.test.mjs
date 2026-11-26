import test from "node:test";
import assert from "node:assert/strict";
import { bridgeRegion, watchRegion } from "../src/night-watch/content.ts";
import { decode, defeatSummary, earnDao, equipArt, newSave, settleRematch, startCaseFight, startRematch, wardSealLimitFor } from "../src/night-watch/game.ts";
import { applyBuildChange, compareBattleBuilds, previewBattle, previewBuild } from "../src/night-watch/battle-preview.ts";

const watch = save => startCaseFight(save, watchRegion);

function arrival(dao = 1766) {
  const save = newSave(100);
  save.region = watchRegion;
  save.victories.fill(1, 0, watchRegion);
  save.clues[watchRegion] = 2;
  earnDao(save, dao);
  save.ownedGear = ["pineBlade", "tigerFang", "postSeal", "courierSeal"];
  save.loadout = { weapon: "pineBlade", charm: "courierSeal" };
  save.drops[0] = save.drops[3] = save.drops[4] = true;
  return save;
}

test("守更首战连续两次没破印才封阵，入门寄灯符和灯芯可翻盘", () => {
  const save = arrival();
  const empty = previewBattle(watch(save));
  assert.deepEqual([empty.result, empty.round, empty.wardStreak, empty.links["揭去更印"]], ["lost", 9, 2, 1]);
  assert.match(defeatSummary(empty), /第 6 回合.*还剩 1 点更印.*第 9 回合.*封阵/);
  save.ranks[0] = save.ranks[3] = 1;
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  const before = previewBattle(watch(save));
  assert.deepEqual([before.result, before.round, before.hp], ["lost", 20, 33]);
  const learn = [{ kind: "art", id: 4, learn: true }];
  const planned = previewBuild(save, watch, learn);
  assert.equal(planned.cost, 110);
  assert.deepEqual([planned.outcome.result, planned.outcome.round, planned.outcome.life], ["won", 12, 87]);
  assert.match(planned.outcome.log[1], /符火烧去更印.*火伤 34/);
  assert.match(planned.outcome.log[2], /敲空更铃，反伤 22/);
  assert.equal(save.dao, 1766);
  assert.equal(applyBuildChange(save, learn), true);
  assert.equal(save.dao, 1656);
  assert.equal(save.lifetimeDao, 1766);
  assert.deepEqual(previewBattle(watch(save)).log, planned.outcome.log);
});

test("守更楼扫清的零道行档可用驿桥保底刀衣过关", () => {
  const old = arrival(3450);
  old.dao = 0;
  const save = decode(JSON.stringify(old), 100);
  assert.equal(previewBattle(watch(save)).result, "lost");
  const bridge = previewBattle(startRematch(save, bridgeRegion));
  assert.equal(bridge.result, "won");
  settleRematch(save, bridge);
  const options = compareBattleBuilds(save, watch);
  const pair = options.find(item => item.changes.length === 2 && item.changes[0].id === "postBlade" && item.changes[1].id === "postCoat");
  assert.ok(pair);
  assert.deepEqual([pair.cost, pair.outcome.round, pair.outcome.life], [0, 18, 81]);
  assert.equal(applyBuildChange(save, pair.changes), true);
  assert.equal(save.dao, 0);
  assert.equal(previewBattle(watch(save)).result, "won");
});

test("守更再战仍考持续破印，挑灯诀可在借灯次数之外引爆符火", () => {
  const save = arrival(3450);
  save.victories[watchRegion] = 1;
  save.rematchRanks[watchRegion] = 1;
  save.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "courierSeal" };
  save.drops[5] = true;
  save.ranks[4] = save.ranks[5] = 1;
  equipArt(save, 4, true);
  const first = startRematch(save, watchRegion);
  assert.equal(wardSealLimitFor(first), 3);
  const oneArt = previewBattle(first);
  assert.deepEqual([oneArt.result, oneArt.links["借灯引符"]], ["lost", 2]);
  equipArt(save, 5, true);
  const paired = previewBattle(startRematch(save, watchRegion));
  assert.deepEqual([paired.result, paired.round, paired.life], ["won", 11, 104]);
  assert.equal(paired.links["符火引爆"], 4);
  assert.equal(paired.links["敲空更铃"], undefined);
});
