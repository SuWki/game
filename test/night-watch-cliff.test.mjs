import test from "node:test";
import assert from "node:assert/strict";
import { cliffRegion } from "../src/night-watch/content.ts";
import {
  accrueOffline, canChallenge, cultivationFor, decode, defeatSummary, earnDao, enableCombatTactics, equipArt, newSave,
  patrolRemaining, recordPatrolKill, recordedClues, rematchSpec, startCaseFight, study, surveyWind, tickFight, unlocked, win,
} from "../src/night-watch/game.ts";
import { compareBattleBuilds, previewBattle } from "../src/night-watch/battle-preview.ts";

function oldWatchSave(total = 2315) {
  const old = newSave(100);
  old.version = 4;
  old.region = 5;
  old.victories = [1, 1, 1, 1, 1, 1];
  for (const key of ["kills", "clues", "rematchRanks"]) old[key].pop();
  old.guide.defeats = [0, 1, 0, 1, 0, 2];
  old.drops = [true, true, false, true, true, true];
  old.ranks = [1, 1, 0, 1, 0, 0];
  old.ownedGear = ["pineBlade", "hillCoat", "watchBlade", "watchCoat", "watchSeal", "ferryCoat"];
  old.loadout = { weapon: "pineBlade", armor: "hillCoat", charm: "watchSeal" };
  old.newGear = ["ferryCoat"];
  old.mirror.sand = 17;
  old.rematchRanks[0] = 1;
  earnDao(old, total);
  return old;
}

function enterCliff(total) {
  const save = decode(JSON.stringify(oldWatchSave(total)), 101);
  save.newGear = [];
  save.region = cliffRegion;
  return save;
}

function caseFight(save) {
  const fight = startCaseFight(save, cliffRegion);
  enableCombatTactics(fight);
  return fight;
}

test("六图旧档开残栈，读回新档保留旧装备与养成", () => {
  const old = oldWatchSave();
  old.victories[5] = 0;
  assert.equal(unlocked(decode(JSON.stringify(old), 101), cliffRegion), false);
  old.victories[5] = 1;
  const migrated = decode(JSON.stringify(old), 101);
  assert.equal(unlocked(migrated, cliffRegion), true);
  assert.deepEqual(migrated.guide.defeats, [0, 1, 0, 1, 0, 2, 0]);
  assert.deepEqual(migrated.newGear, old.newGear);
  assert.deepEqual(migrated.ranks, old.ranks);
  assert.deepEqual(migrated.loadout, old.loadout);
  assert.equal(migrated.rematchRanks[0], 1);
  assert.equal(migrated.mirror.sand, 17);
  assert.deepEqual(decode(JSON.stringify(migrated), 102), migrated);
});

test("低档 25 杀查风灯入坐忘，消耗可用道行与回访不会重算一次性心得", () => {
  const save = enterCliff();
  assert.equal(cultivationFor(save).full, true);
  for (let i = 0; i < 24; i++) assert.equal(recordPatrolKill(save).reward, 24);
  assert.equal(surveyWind(save), false);
  recordPatrolKill(save);
  assert.equal(save.lifetimeDao, 2915);
  assert.equal(canChallenge(save, cliffRegion), false);
  assert.equal(surveyWind(save), true);
  assert.equal(save.lifetimeDao, 3600);
  assert.equal(cultivationFor(save).realm, 5);
  assert.equal(canChallenge(save, cliffRegion), true);
  assert.equal(study(save, 4), true);
  assert.equal(save.lifetimeDao, 3600);
  const reloaded = decode(JSON.stringify(save), 700);
  assert.equal(surveyWind(reloaded), false);
  assert.equal(win(reloaded, cliffRegion).first, true);
  assert.equal(reloaded.lifetimeDao, 4600);
  assert.equal(win(reloaded, cliffRegion).first, false);
  assert.equal(reloaded.lifetimeDao, 4600);
  assert.equal(cultivationFor(reloaded).layer, 10);
  assert.equal(rematchSpec(reloaded, cliffRegion), undefined);
});

test("离线扫清后能查风灯，实查第三条才给落地减伤", () => {
  const swept = enterCliff(3450);
  swept.autoPatrol = true;
  assert.equal(accrueOffline(swept, 200_000).earned, 1200);
  assert.equal(patrolRemaining(swept), 0);
  assert.equal(swept.autoPatrol, false);
  assert.equal(swept.kills[cliffRegion], 0);
  assert.equal(surveyWind(swept), true);
  assert.equal(recordedClues(swept), 0);
  assert.equal(caseFight(swept).preparation, undefined);
  assert.equal(recordPatrolKill(swept).reward, 0);

  const searched = enterCliff(2400);
  for (let i = 0; i < 40; i++) recordPatrolKill(searched);
  surveyWind(searched);
  searched.kit.stance = "attack";
  equipArt(searched, 0, true);
  const fight = previewBattle(caseFight(searched));
  assert.match(fight.log[2], /落地扣 60.*旧灯结扣.*镇山喝截断落爪/);
  assert.equal(fight.links["旧灯结扣"], 1);
});

test("回风鸮用旧装守式或闪避取胜，高面板攻式失配也会在落地时败阵", () => {
  const save = enterCliff(2315);
  for (let i = 0; i < 25; i++) recordPatrolKill(save);
  surveyWind(save);
  save.rematchRanks[0] = 0;
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  const guard = previewBattle(caseFight(save));
  assert.deepEqual([guard.result, guard.round, guard.links["扶索稳身"]], ["won", 10, 2]);
  assert.match(guard.log[8], /落地扣 84.*镇山喝截断落爪.*趁截断追斩/);

  const agile = structuredClone(save);
  agile.kit.stance = "attack";
  agile.loadout = { weapon: "watchBlade", armor: "ferryCoat", charm: "watchSeal" };
  equipArt(agile, 0, false);
  equipArt(agile, 3, false);
  equipArt(agile, 1, true);
  const dodge = previewBattle(caseFight(agile));
  assert.deepEqual([dodge.result, dodge.round, dodge.links["渡水蓑回血 +5"]], ["won", 9, 3]);
  assert.equal(dodge.links["掠栈踏空"], undefined);

  save.kit.stance = "attack";
  save.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  save.rematchRanks.fill(3, 0, 6);
  const lost = previewBattle(caseFight(save));
  assert.deepEqual([lost.result, lost.round, lost.links["落地败阵"]], ["lost", 6, 1]);
  assert.match(defeatSummary(lost), /第 5 回合踏空，第 6 回合落地扣了 84/);
  assert.doesNotMatch(lost.log[5], /镇山喝/);
  assert.ok(compareBattleBuilds(save, caseFight, lost).some(suggestion => suggestion.outcome.result === "won"));
  equipArt(save, 1, true);
  const live = caseFight(save);
  const preview = previewBattle(live);
  while (live.result === "fighting") tickFight(live);
  assert.deepEqual(live.log, preview.log);
  assert.deepEqual([live.result, live.round, live.life], ["won", 7, preview.life]);
});
