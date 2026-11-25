import test from "node:test";
import assert from "node:assert/strict";
import { altarRegion, altarStations, freeRealm, hallRegion } from "../src/night-watch/content.ts";
import {
  applyPreset, canChallenge, decode, defeatSummary, earnDao, enableCombatTactics, equipArt, equipLampFusion, fuseLamp, newSave,
  recordPatrolKill, startCaseFight, storePreset, study, tickFight, unlocked, win,
} from "../src/night-watch/game.ts";
import { compareBattleBuilds, previewBattle } from "../src/night-watch/battle-preview.ts";

function innerSave(passed = true) {
  const old = newSave(100);
  old.version = 7;
  old.region = hallRegion;
  for (const key of ["kills", "clues", "victories", "rematchRanks"]) old[key] = old[key].slice(0, 9);
  old.guide.defeats = old.guide.defeats.slice(0, 9);
  old.victories.fill(1, 0, 8);
  old.windSurveyed = true;
  old.booksCompared = true;
  old.trialBest.lampTrial = passed ? 12 : 0;
  old.ranks = [1, 1, 1, 1, 1, 1, 1];
  old.drops.fill(true);
  old.ownedGear = ["watchBlade", "watchCoat", "watchSeal", "lampKnot"];
  old.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  earnDao(old, 7200);
  return old;
}

function readyAltar() {
  const save = decode(JSON.stringify(innerSave()), 101);
  save.region = altarRegion;
  for (let i = 0; i < 14; i++) recordPatrolKill(save);
  return save;
}

test("内院 v7 首胜档接上主灯台，巡夜门槛和回访记录可重读", () => {
  const locked = decode(JSON.stringify(innerSave(false)), 101);
  assert.equal(unlocked(locked, altarRegion), false);
  const save = decode(JSON.stringify(innerSave()), 101);
  assert.equal(save.version, 8);
  assert.equal(save.realm, freeRealm);
  assert.equal(save.trialBest.lampTrial, 12);
  assert.equal(unlocked(save, altarRegion), true);
  save.region = altarRegion;
  for (let i = 0; i < 13; i++) recordPatrolKill(save);
  assert.equal(canChallenge(save, altarRegion), false);
  recordPatrolKill(save);
  assert.equal(canChallenge(save, altarRegion), true);
  assert.equal(save.lifetimeDao, 7872);
  assert.equal(win(save, altarRegion).first, true);
  const reopened = decode(JSON.stringify(save), 102);
  assert.equal(reopened.victories[altarRegion], 1);
  assert.equal(reopened.ownedGear.includes("lampKnot"), true);
  assert.equal(startCaseFight(reopened, altarRegion).casePractice, true);
});

test("本命招占原神通位，合拆、读档和预设保留原招精通", () => {
  const save = readyAltar();
  equipArt(save, 2, true);
  equipArt(save, 5, true);
  assert.equal(fuseLamp(save, true), false);
  assert.equal(study(save, 2), true);
  assert.equal(study(save, 5), true);
  assert.equal(storePreset(save, 0, "原招"), true);
  const dao = save.dao;
  assert.equal(fuseLamp(save, true), true);
  assert.equal(save.kit.lampFusion, true);
  assert.equal(save.kit.reveal, false);
  assert.equal(save.kit.kindle, false);
  assert.equal(save.dao, dao);
  equipArt(save, 5, true);
  assert.equal(save.kit.kindle, false);
  equipArt(save, 4, true);
  assert.equal(save.kit.lampFusion, undefined);
  assert.equal(save.lampFusion, true);
  assert.equal(equipLampFusion(save, true), true);
  assert.equal(save.kit.sigil, false);
  const restored = decode(JSON.stringify(save), 102);
  assert.equal(restored.kit.lampFusion, true);
  assert.equal(applyPreset(restored, 0), true);
  assert.equal(!!restored.kit.kindle, false);
  assert.equal(restored.kit.reveal, false);
  assert.equal(fuseLamp(restored, false), true);
  assert.equal(applyPreset(restored, 0), true);
  assert.equal(restored.kit.reveal, true);
  assert.equal(restored.kit.kindle, true);
  assert.deepEqual([restored.ranks[2], restored.ranks[5], restored.dao], [2, 2, dao]);
});

test("三站应答按次序兑现，符火与本命两条胜路都用实战验收", () => {
  const save = readyAltar();
  const start = state => startCaseFight(state, altarRegion);
  const overpower = start(save);
  overpower.hp = 1;
  const failed = previewBattle(overpower);
  assert.deepEqual([failed.result, failed.hp, failed.altarAnswers.progress], ["lost", 1, 0]);
  assert.match(defeatSummary(failed), /第 18 回合覆簿纸未破，芦花渡 · 陆婆未能作答/);
  assert.ok(compareBattleBuilds(save, start, failed).some(candidate => candidate.outcome.altarAnswers.progress === 3));

  equipArt(save, 4, true);
  equipArt(save, 5, true);
  const oldArts = previewBattle(start(save));
  assert.deepEqual([oldArts.result, oldArts.round, oldArts.altarAnswers.progress, oldArts.links["符火破纸"]], ["won", 10, 3, 3]);
  altarStations.forEach((name, i) => assert.ok(oldArts.log[i * 3 + 2].includes(`${name}亲口应答`)));

  assert.equal(study(save, 2), true);
  assert.equal(study(save, 5), true);
  fuseLamp(save, true);
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  const live = start(save);
  const forecast = previewBattle(live);
  enableCombatTactics(live);
  while (live.result === "fighting") tickFight(live);
  assert.deepEqual(live.log, forecast.log);
  assert.deepEqual([live.result, live.round, live.altarAnswers.progress, live.links["照灯断影破纸"]], ["won", 10, 3, 3]);
  assert.equal(live.links["符火破纸"], undefined);
  assert.match(live.log[7], /照灯断影照开护纸/);

  const blade = readyAltar();
  blade.kit.stance = "attack";
  blade.rematchRanks.fill(3, 0, 6);
  blade.ranks.fill(2);
  const panelOnly = previewBattle(start(blade));
  assert.deepEqual([panelOnly.result, panelOnly.altarAnswers.progress], ["lost", 0]);
  for (const art of [1, 3, 5]) equipArt(blade, art, true);
  const timed = previewBattle(start(blade));
  assert.deepEqual([timed.result, timed.round, timed.life, timed.altarAnswers.progress], ["won", 10, 84, 3]);
  assert.equal(timed.links["符火破纸"], undefined);
  assert.equal(timed.links["照灯断影破纸"], undefined);
});
