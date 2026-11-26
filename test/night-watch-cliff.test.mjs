import test from "node:test";
import assert from "node:assert/strict";
import { bridgeRegion, cliffRegion, ropeStep, skyRegion, windRealm } from "../src/night-watch/content.ts";
import {
  accrueOffline, canChallenge, cultivationFor, decode, defeatSummary, earnDao, enableCombatTactics, equipArt, newSave,
  patrolRemaining, recordPatrolKill, recordedClues, rematchSpec, setInwardTide, settleRematch, startCaseFight, startRematch, study, surveyWind, tickFight, unlocked, win, windSurveyReward,
} from "../src/night-watch/game.ts";
import { applyBuildChange, availableBuildChanges, compareBattleBuilds, previewBattle, previewBuild } from "../src/night-watch/battle-preview.ts";
import { cliffGateText } from "../src/night-watch/guide.ts";

function oldWatchSave(total = 2315) {
  const old = newSave(100);
  old.version = 4;
  old.region = 5;
  old.victories = [1, 1, 1, 1, 1, 1];
  for (const key of ["kills", "clues", "rematchRanks"]) old[key] = old[key].slice(0, 6);
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
  assert.deepEqual(migrated.guide.defeats, [0, 1, 0, 1, 0, 2, 0, 0, 0, 0]);
  assert.deepEqual(migrated.newGear, old.newGear);
  assert.deepEqual(migrated.ranks, [...old.ranks, 0]);
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
  assert.equal(cultivationFor(reloaded).realm, windRealm);
  assert.equal(cultivationFor(reloaded).layer, 1);
  assert.equal(rematchSpec(reloaded, cliffRegion), undefined);
});

test("早到残栈查灯后仍差 514 道行，提示的巡夜次数与破境相符", () => {
  const save = enterCliff(1766);
  for (let i = 0; i < 25; i++) recordPatrolKill(save);
  assert.equal(windSurveyReward(save), 720);
  assert.match(cliffGateText(save), /预计获得 720 道行/);
  assert.equal(surveyWind(save), true);
  assert.equal(save.lifetimeDao, 3086);
  assert.match(cliffGateText(save), /还差 514 道行，约再巡 22 只/);
  for (let i = 0; i < 21; i++) recordPatrolKill(save);
  assert.equal(canChallenge(save, cliffRegion), false);
  recordPatrolKill(save);
  assert.equal(save.lifetimeDao, 3614);
  assert.equal(canChallenge(save, cliffRegion), true);
});

test("残栈 v5 首胜档补悟踏缆步，同一首胜开御风与天栈", () => {
  const old = enterCliff(3450);
  for (let i = 0; i < 25; i++) recordPatrolKill(old);
  assert.equal(surveyWind(old), true);
  earnDao(old, 600);
  assert.equal(old.lifetimeDao, 4650);
  assert.equal(unlocked(old, skyRegion), false);

  old.version = 5;
  for (const key of ["kills", "clues", "victories", "rematchRanks"]) old[key] = old[key].slice(0, 7);
  old.drops.pop();
  old.ranks.pop();
  old.guide.defeats = old.guide.defeats.slice(0, 7);
  old.victories[cliffRegion] = 1;
  const migrated = decode(JSON.stringify(old), 100);
  assert.equal(migrated.realm, windRealm);
  assert.equal(migrated.drops[ropeStep], true);
  assert.equal(migrated.ranks[ropeStep], 0);
  assert.equal(migrated.lifetimeDao, old.lifetimeDao);
  assert.equal(unlocked(migrated, skyRegion), true);
  assert.equal(win(migrated, cliffRegion).drop, false);
  assert.equal(study(migrated, ropeStep), true);
  assert.deepEqual(decode(JSON.stringify(migrated), 100), migrated);
});

test("内化听潮步与主动互斥，可和踏缆步同带，首次落地先减线索再减半", () => {
  const save = enterCliff(2400);
  for (let i = 0; i < 40; i++) recordPatrolKill(save);
  surveyWind(save);
  assert.equal(setInwardTide(save, true), false);
  assert.equal(study(save, 1), true);
  equipArt(save, 1, true);
  assert.equal(setInwardTide(save, true), true);
  assert.equal(save.kit.step, "basic");
  win(save, cliffRegion);
  assert.equal(study(save, ropeStep), true);
  equipArt(save, ropeStep, true);
  const reloaded = decode(JSON.stringify(save), 100);
  assert.equal(reloaded.kit.step, "rope");
  assert.equal(reloaded.kit.inwardTide, true);
  reloaded.kit.stance = "attack";
  const fight = previewBattle(caseFight(reloaded));
  assert.match(fight.log[2], /落地扣 30.*旧灯结扣减 24.*内化听潮步减半/);
  assert.match(fight.log[5], /落地扣 84/);
  assert.equal(fight.links["内化听潮步"], 1);
  equipArt(reloaded, 1, true);
  assert.equal(reloaded.kit.step, "tide");
  assert.equal(reloaded.kit.inwardTide, undefined);
  assert.equal(reloaded.ranks[1], 2);
});

test("衔灯鹞的近身回合改变胜负，首胜的续灯扣进旧装备循环", () => {
  const save = enterCliff(2315);
  for (let i = 0; i < 25; i++) recordPatrolKill(save);
  surveyWind(save);
  win(save, cliffRegion);
  save.region = skyRegion;
  save.rematchRanks[0] = 0;
  for (let i = 0; i < 17; i++) recordPatrolKill(save);
  assert.equal(canChallenge(save, skyRegion), false);
  recordPatrolKill(save);
  const start = state => {
    const fight = startCaseFight(state, skyRegion);
    enableCombatTactics(fight);
    return fight;
  };
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  const stable = previewBattle(start(save));
  assert.deepEqual([stable.result, stable.round, stable.links["压灯引鹞"], stable.links["截断升空"]], ["won", 13, 2, 4]);
  assert.match(stable.log[3], /来不及升空.*普攻刀伤 32/);
  assert.doesNotMatch(stable.log[3], /擦伤/);

  const attack = structuredClone(save);
  attack.kit.stance = "attack";
  attack.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  equipArt(attack, 0, false);
  equipArt(attack, 3, false);
  const lost = previewBattle(start(attack));
  assert.deepEqual([lost.result, lost.round], ["lost", 15]);
  assert.equal(study(attack, ropeStep), true);
  assert.ok(compareBattleBuilds(attack, start, lost).some(({ changes }) => changes.some(change => change.id === ropeStep)));
  equipArt(attack, ropeStep, true);
  const live = start(attack);
  const verdict = previewBattle(live);
  while (live.result === "fighting") tickFight(live);
  assert.deepEqual(live.log, verdict.log);
  assert.deepEqual([live.result, live.round, live.links["踏缆步追及"]], ["won", 12, 4]);
  assert.ok(live.life < stable.life);

  win(save, skyRegion);
  win(save, skyRegion);
  assert.equal(save.ownedGear.filter(id => id === "lampKnot").length, 1);
  assert.deepEqual(save.newGear, ["lampKnot"]);
  const loaded = decode(JSON.stringify(save), 100);
  loaded.loadout.charm = "lampKnot";
  const withKnot = previewBattle(start(loaded));
  assert.equal(withKnot.links["续灯扣回气"], 4);
  assert.equal(withKnot.life - stable.life, 48);
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

test("残栈试配可免费把听潮步移入内化位，首次落地减伤照实结算", () => {
  const save = enterCliff(2315);
  for (let i = 0; i < 25; i++) recordPatrolKill(save);
  surveyWind(save);
  save.kit.stance = "attack";
  save.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  save.rematchRanks.fill(3, 0, 6);
  save.ranks[1] = 2;
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  equipArt(save, 1, true);
  assert.deepEqual(previewBattle(caseFight(save)).cliffFalls ?? [], []);
  assert.ok(availableBuildChanges(save, true).singles.some(change => change.kind === "inward-tide"));
  const change = [{ kind: "inward-tide" }];
  const simulated = previewBuild(save, caseFight, change);
  assert.match(simulated.label, /主动身法换为退步/);
  assert.equal(simulated.cost, 0);
  assert.equal(save.kit.step, "tide");
  assert.deepEqual(simulated.outcome.cliffFalls, [{ stepRound: 2, damage: 42 }, { stepRound: 5, damage: 84 }]);
  assert.equal(applyBuildChange(save, change), true);
  assert.equal(save.kit.step, "basic");
  assert.equal(save.kit.inwardTide, true);
  save.kills[cliffRegion] = 40;
  assert.deepEqual(previewBattle(caseFight(save)).cliffFalls, [{ stepRound: 2, damage: 30 }, { stepRound: 5, damage: 84 }]);
});

test("离线扫清且无道行时，驿桥补发的青石刀能通过残栈", () => {
  const save = enterCliff(4650);
  save.dao = 0;
  save.loadout = { weapon: "pineBlade", charm: "watchSeal" };
  save.ownedGear = ["pineBlade", "watchSeal", "postSeal"];
  save.rematchRanks[0] = 0;
  assert.equal(surveyWind(save), true);
  assert.equal(recordedClues(save), 0);
  assert.equal(previewBattle(caseFight(save)).result, "lost");
  const battle = previewBattle(startRematch(save, bridgeRegion));
  assert.equal(battle.result, "won");
  settleRematch(save, battle);
  const change = [{ kind: "gear", id: "postBlade" }];
  assert.equal(applyBuildChange(save, change), true);
  const won = previewBattle(caseFight(save));
  assert.deepEqual([won.result, won.round, won.life], ["won", 11, 73]);
  assert.equal(save.dao, 0);
});
