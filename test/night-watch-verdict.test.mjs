import assert from "node:assert/strict";
import test from "node:test";
import { applyBuildChange, compareBattleBuilds, previewBattle } from "../src/night-watch/battle-preview.ts";
import { defeatSummary, earnDao, enableCombatTactics, newSave, settleRematch, startRematch, startTrial, tickFight } from "../src/night-watch/game.ts";

function lateSave() {
  const save = newSave(0);
  save.victories.fill(1);
  save.drops.fill(true);
  save.clues.fill(3);
  save.rematchRanks.fill(2);
  save.ownedGear = ["watchBlade", "watchCoat", "watchSeal", "tideSeal", "pineBlade", "courierSeal"];
  save.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  earnDao(save, 3450);
  return save;
}

test("成套后期装备仍会被河伯追篙打落水，实算给出减伤和身法两条可过路", () => {
  const save = lateSave();
  const snapshot = structuredClone(save);
  const encounter = startRematch(save, 1);
  const forecast = previewBattle(encounter);
  assert.deepEqual([forecast.result, forecast.round, forecast.riverPursuits], ["lost", 9, 2]);
  assert.match(defeatSummary(forecast), /追篙.*落水/);
  assert.equal(encounter.round, 0);
  const candidates = compareBattleBuilds(save, draft => startRematch(draft, 1), forecast);
  assert.deepEqual(save, snapshot);
  assert.deepEqual(candidates.map(({ cost, changes, outcome }) => [cost, changes.length, outcome.result, outcome.round]),
    [[0, 1, "won", 11], [60, 1, "won", 11]]);
  assert.match(candidates[0].label, /镇潮印/);
  assert.match(candidates[1].label, /听潮步/);
  assert.equal(applyBuildChange(save, candidates[1].changes), true);
  assert.equal(save.dao, snapshot.dao - 60);
  assert.equal(save.kit.step, "tide");
  const real = startRematch(save, 1);
  assert.equal(enableCombatTactics(real), true);
  while (real.result === "fighting") tickFight(real);
  assert.deepEqual([real.result, real.round, real.life], ["won", candidates[1].outcome.round, candidates[1].outcome.life]);
});

test("娘娘第三关的纸痕封灯能以照影或挑灯期间的符火解决", () => {
  const save = lateSave();
  const forecast = previewBattle(startRematch(save, 2));
  assert.deepEqual([forecast.result, forecast.round, forecast.links["纸面封灯"]], ["lost", 8, 1]);
  const light = structuredClone(save);
  assert.equal(applyBuildChange(light, [{ kind: "art", id: 2, learn: true }]), true);
  const cleared = previewBattle(startRematch(light, 2));
  assert.deepEqual([cleared.result, cleared.round], ["won", 10]);
  assert.ok(cleared.links["照影清纸痕"] > 0);
  assert.equal(applyBuildChange(save, [{ kind: "art", id: 4, learn: true }, { kind: "art", id: 5, learn: true }]), true);
  const fire = previewBattle(startRematch(save, 2));
  assert.deepEqual([fire.result, fire.round], ["won", 7]);
  assert.ok(fire.links["符火引爆"] > 0);
  assert.equal(save.kit.reveal, false);
});

test("满阶旧档可以试第三关并保留实际强化，试胜不会重复发奖", () => {
  const save = lateSave();
  assert.equal(startRematch(save, 1, true), undefined);
  save.rematchRanks[1] = 3;
  save.loadout.charm = "tideSeal";
  assert.equal(startRematch(save, 1), undefined);
  const fight = startRematch(save, 1, true);
  assert.equal(fight.rematchPractice, true);
  assert.equal(fight.gearUpgrades[1], 3);
  const won = previewBattle(fight);
  assert.equal(won.result, "won");
  const before = structuredClone(save);
  assert.equal(settleRematch(save, won), undefined);
  assert.deepEqual(save, before);
});

test("打空对方气血仍可能输掉托付，失效组合不会扣除部分修习费用", () => {
  const save = lateSave();
  save.rematchRanks.fill(3);
  save.loadout = { weapon: "pineBlade", armor: "watchCoat", charm: "courierSeal" };
  save.kit.stance = "attack";
  assert.equal(applyBuildChange(save, [{ kind: "art", id: 0, learn: true }]), true);
  save.ranks[0] = 2;
  const trial = previewBattle(startTrial(save, "ferryTrial"));
  assert.equal(trial.result, "lost");
  assert.ok(trial.hp <= 0 && trial.life > 0);
  assert.match(defeatSummary(trial), /护灯只完成 0 \/ 2/);
  const before = structuredClone(save);
  assert.equal(applyBuildChange(save, [{ kind: "art", id: 1, learn: true }, { kind: "gear", id: "reedBlade" }]), false);
  assert.deepEqual(save, before);
});
