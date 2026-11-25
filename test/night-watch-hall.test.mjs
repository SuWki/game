import test from "node:test";
import assert from "node:assert/strict";
import { freeDao, freeRealm, hallRegion, trueDao, trueRealm, windRealm } from "../src/night-watch/content.ts";
import {
  accrueOffline, canChallenge, canCompareBooks, canEnterLampTrial, compareBooks, cultivationFor, decode, defeatSummary,
  earnDao, enableCombatTactics, equipArt, newSave, recordPatrolKill, recordedClues, settleTrial, startTrial, tickFight, unlocked,
} from "../src/night-watch/game.ts";
import { previewBattle } from "../src/night-watch/battle-preview.ts";

function skySave(total = 5140) {
  const old = newSave(100);
  old.version = 6;
  old.region = 7;
  for (const key of ["kills", "clues", "victories", "rematchRanks"]) old[key].pop();
  old.guide.defeats.pop();
  old.victories.fill(1);
  old.windSurveyed = true;
  old.ranks = [1, 1, 0, 1, 1, 1, 1];
  old.drops = old.ranks.map(Boolean);
  old.ownedGear = ["pineBlade", "hillCoat", "watchSeal", "watchBlade", "watchCoat", "ferryCoat"];
  old.loadout = { weapon: "pineBlade", armor: "hillCoat", charm: "watchSeal" };
  earnDao(old, total);
  return old;
}

function enterHall(total) {
  const save = decode(JSON.stringify(skySave(total)), 101);
  save.region = hallRegion;
  return save;
}

function readyTrial() {
  const save = enterHall();
  for (let i = 0; i < 16; i++) recordPatrolKill(save);
  compareBooks(save);
  return save;
}

test("天栈旧档开外院，对读与道行同时满足才入真人", () => {
  const old = skySave(6400);
  old.victories[7] = 0;
  assert.equal(unlocked(decode(JSON.stringify(old), 101), hallRegion), false);
  const capped = enterHall(6400);
  assert.equal(cultivationFor(capped).realm, windRealm);
  assert.equal(canCompareBooks(capped), true);
  assert.equal(compareBooks(capped), true);
  assert.equal(capped.realm, trueRealm);
  assert.equal(capped.lifetimeDao, 6400);
  assert.equal(recordedClues(capped), 0);
  assert.equal(startTrial(capped, "lampTrial").preparation, undefined);
  assert.equal(canChallenge(capped, hallRegion), false);

  const entrant = enterHall();
  for (let i = 0; i < 15; i++) recordPatrolKill(entrant);
  assert.equal(compareBooks(entrant), false);
  recordPatrolKill(entrant);
  assert.equal(entrant.lifetimeDao, 5716);
  assert.equal(canEnterLampTrial(entrant), false);
  compareBooks(entrant);
  assert.equal(entrant.lifetimeDao, trueDao);
  assert.equal(entrant.realm, trueRealm);
  assert.equal(compareBooks(entrant), false);
  assert.deepEqual(decode(JSON.stringify(entrant), 102), entrant);

  const behind = enterHall(4800);
  for (let i = 0; i < 16; i++) recordPatrolKill(behind);
  compareBooks(behind);
  assert.equal(behind.booksCompared, true);
  assert.equal(behind.realm, windRealm);
  assert.equal(canEnterLampTrial(behind), false);
  behind.autoPatrol = true;
  accrueOffline(behind, 200_000);
  assert.equal(canEnterLampTrial(behind), true);
});

test("守式和符火护住两声应答，纯输出的失配档看得见哪轮没破纸", () => {
  const save = readyTrial();
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  const guard = previewBattle(startTrial(save, "lampTrial"));
  assert.deepEqual([guard.result, guard.round, guard.trial.progress], ["won", 12, 2]);
  assert.match(guard.log[2], /守式护灯，记第 1 次应答/);
  assert.match(guard.log[5], /两声应答齐全/);
  assert.doesNotMatch(guard.log[6], /护纸覆上/);
  const nearlyDefeated = startTrial(save, "lampTrial");
  nearlyDefeated.hp = 1;
  const held = previewBattle(nearlyDefeated);
  assert.deepEqual([held.result, held.round, held.trial.progress], ["won", 7, 2]);
  assert.match(held.log[0], /等两次应答后才能击退/);

  const attack = structuredClone(save);
  attack.kit.stance = "attack";
  attack.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  equipArt(attack, 0, false);
  equipArt(attack, 3, false);
  const failed = previewBattle(startTrial(attack, "lampTrial"));
  assert.deepEqual([failed.result, failed.trial.progress, failed.links["真人留息"]], ["lost", 0, 1]);
  assert.match(defeatSummary(failed), /第 12 回合护纸未破/);
  assert.equal(settleTrial(attack, failed), 0);
  assert.equal(attack.trialBest.lampTrial, 0);
  equipArt(attack, 4, true);
  equipArt(attack, 5, true);
  const live = startTrial(attack, "lampTrial");
  const forecast = previewBattle(live);
  enableCombatTactics(live);
  while (live.result === "fighting") tickFight(live);
  assert.deepEqual(live.log, forecast.log);
  assert.deepEqual([live.result, live.round, live.trial.progress, live.links["符火破纸"]], ["won", 7, 2, 2]);
  assert.ok(live.life < guard.life);
  const sand = attack.mirror.sand;
  settleTrial(attack, live);
  assert.equal(attack.lifetimeDao, freeDao);
  assert.equal(attack.realm, freeRealm);
  assert.equal(attack.autoPatrol, false);
  assert.equal(attack.mirror.sand, sand);
  settleTrial(attack, live);
  assert.equal(attack.lifetimeDao, freeDao);
  assert.equal(decode(JSON.stringify(attack), 102).trialBest.lampTrial, 7);
});

test("留息只抵一次妖术，下一次按期贴符才使符火多打 18", () => {
  const save = readyTrial();
  save.kit.stance = "attack";
  save.loadout.armor = "ferryCoat";
  for (const art of [1, 4, 5]) equipArt(save, art, true);
  const trial = startTrial(save, "lampTrial");
  trial.life = 25;
  const outcome = previewBattle(trial);
  assert.match(outcome.log[2], /真人留息，保住 1 点气血/);
  assert.match(outcome.log[3], /真人余息入符.*\+18/);
  assert.match(outcome.log[4], /火伤 44/);
  assert.deepEqual([outcome.result, outcome.round, outcome.links["真人留息"], outcome.links["真人符火"]], ["lost", 6, 1, 1]);

  equipArt(save, 1, false);
  const noSpell = startTrial(save, "lampTrial");
  noSpell.life = 8;
  const hit = previewBattle(noSpell);
  assert.deepEqual([hit.result, hit.round, hit.trueGuardUsed], ["lost", 2, undefined]);
});
