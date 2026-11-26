import test from "node:test";
import assert from "node:assert/strict";
import { bridgeRegion, courierRegion } from "../src/night-watch/content.ts";
import { decode, defeatSummary, earnDao, equipArt, newSave, settleRematch, startCaseFight, startRematch } from "../src/night-watch/game.ts";
import { applyBuildChange, battleBuildImproves, compareBattleBuilds, previewBattle, previewBuild } from "../src/night-watch/battle-preview.ts";

const horse = save => startCaseFight(save, courierRegion);

function arrival(dao = 1436) {
  const save = newSave(100);
  save.region = courierRegion;
  save.victories.fill(1, 0, courierRegion);
  save.kills[courierRegion] = 44;
  earnDao(save, dao);
  save.ownedGear = ["pineBlade", "tigerFang", "postSeal"];
  save.loadout = { weapon: "pineBlade", charm: "postSeal" };
  save.drops[0] = save.drops[3] = true;
  return save;
}

test("纸马首战错配会败，免费推演与确认修习分别记账", () => {
  const save = arrival();
  const before = previewBattle(horse(save));
  assert.deepEqual([before.result, before.round, before.links["压灯卸势"]], ["lost", 14, 1]);
  assert.deepEqual(before.horseImpact, { round: 5, damage: 29 });
  assert.match(defeatSummary(before), /第 5 回合.*共扣 29 点气血/);
  const snapshot = structuredClone(save);
  const choice = compareBattleBuilds(save, horse, before).find(build => build.changes.some(change => change.kind === "art" && change.id === 3));
  assert.ok(choice);
  assert.equal(choice.cost, 90);
  assert.deepEqual([choice.outcome.result, choice.outcome.round, choice.outcome.life], ["won", 13, 15]);
  assert.deepEqual(save, snapshot);
  assert.equal(applyBuildChange(save, choice.changes), true);
  assert.equal(save.dao, snapshot.dao - 90);
  assert.equal(save.lifetimeDao, snapshot.lifetimeDao);
  assert.equal(applyBuildChange(save, choice.changes), false);
  assert.deepEqual(previewBattle(horse(save)).log, choice.outcome.log);
});

test("取胜也能比较试配，未触发追斩的精通没有推荐价值", () => {
  const save = arrival();
  save.ownedGear.push("reedBlade", "ferryCoat");
  save.loadout.weapon = "reedBlade";
  save.loadout.armor = "ferryCoat";
  save.drops[1] = true;
  save.ranks[1] = save.ranks[3] = 1;
  save.kit.stance = "attack";
  equipArt(save, 1, true);
  equipArt(save, 3, true);
  const baseline = previewBattle(horse(save));
  const fold = previewBuild(save, horse, [{ kind: "mastery", id: 3 }]);
  const tide = previewBuild(save, horse, [{ kind: "mastery", id: 1 }]);
  assert.equal(baseline.result, "won");
  assert.equal(fold.cost, 400);
  assert.deepEqual(fold.outcome.log, baseline.log);
  assert.equal(battleBuildImproves(baseline, fold.outcome), false);
  assert.equal(tide.cost, 400);
  assert.equal(battleBuildImproves(baseline, tide.outcome), true);
  assert.ok(compareBattleBuilds(save, horse, baseline).every(build => !build.changes.some(change => change.kind === "mastery" && change.id === 3)));
  assert.equal(save.ranks[1], 1);
  assert.equal(save.dao, 1436);
});

test("纸马院扫清且无道行的旧档可用驿桥再战所得过关", () => {
  const old = arrival(2840);
  old.dao = 0;
  const restored = decode(JSON.stringify(old), 100);
  assert.equal(previewBattle(horse(restored)).result, "lost");
  const bridge = previewBattle(startRematch(restored, bridgeRegion));
  assert.equal(bridge.result, "won");
  settleRematch(restored, bridge);
  const upgrade = [{ kind: "gear", id: "postBlade" }, { kind: "gear", id: "postCoat" }];
  assert.equal(applyBuildChange(restored, upgrade), true);
  assert.equal(previewBattle(horse(restored)).result, "won");
  assert.equal(restored.dao, 0);
  assert.equal(restored.lifetimeDao, 2840);
});
