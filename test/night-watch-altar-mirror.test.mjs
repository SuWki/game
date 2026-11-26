import test from "node:test";
import assert from "node:assert/strict";
import { altarRegion, altarMirrorSand } from "../src/night-watch/content.ts";
import {
  altarMirrorUnlocked, decode, defeatSummary, earnDao, enableCombatTactics, equipArt, fuseLamp, newSave,
  reforgeGear, settleAltarMirror, settleTrial, startAltarMirror, startCaseFight, startTrial, tickFight,
} from "../src/night-watch/game.ts";
import { applyBuildChange, compareBattleBuilds, previewBattle } from "../src/night-watch/battle-preview.ts";

function completedSave() {
  const save = newSave(100);
  save.region = altarRegion;
  save.victories.fill(1, 0, 8);
  save.victories[altarRegion] = 1;
  save.windSurveyed = true;
  save.booksCompared = true;
  save.trialBest.lampTrial = 12;
  earnDao(save, 7872);
  save.ownedGear = ["watchBlade", "watchCoat", "watchSeal", "pineBlade"];
  save.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  save.drops.fill(true);
  save.ranks.fill(1);
  equipArt(save, 4, true);
  equipArt(save, 5, true);
  return save;
}

test("旧案胜配在错页卡第二页，切换一处架势实战翻盘", () => {
  const save = completedSave();
  const locked = structuredClone(save);
  locked.victories[altarRegion] = 0;
  assert.equal(altarMirrorUnlocked(locked), false);
  assert.equal(startAltarMirror(locked), undefined);
  assert.equal(previewBattle(startCaseFight(save, altarRegion)).result, "won");

  const failed = previewBattle(startAltarMirror(save));
  assert.deepEqual([failed.result, failed.round, failed.altarMirror.pages, failed.ward], ["lost", 7, 1, 6]);
  assert.match(defeatSummary(failed), /第 7 回合，第 2 页还剩 6 点护纸/);
  const suggestion = compareBattleBuilds(save, startAltarMirror, failed)
    .find(item => item.changes.length === 1 && item.changes[0].kind === "stance");
  assert.ok(suggestion);
  assert.equal(suggestion.cost, 0);
  assert.equal(applyBuildChange(save, suggestion.changes), true);
  const live = startAltarMirror(save);
  enableCombatTactics(live);
  while (live.result === "fighting") tickFight(live);
  assert.deepEqual(live.log, suggestion.outcome.log);
  assert.deepEqual([live.result, live.round, live.altarMirror.pages, live.life], ["won", 11, 3, 95]);
});

test("本命招破首末页，松纹刀按第六回合截断追斩补上中页", () => {
  const save = completedSave();
  save.ranks[2] = save.ranks[5] = 2;
  assert.equal(fuseLamp(save, true), true);
  const missing = previewBattle(startAltarMirror(save));
  assert.deepEqual([missing.result, missing.round, missing.altarMirror.pages], ["lost", 7, 1]);
  save.loadout.weapon = "pineBlade";
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  const won = previewBattle(startAltarMirror(save));
  assert.deepEqual([won.result, won.round, won.altarMirror.pages, won.links["照灯断影破纸"]], ["won", 12, 3, 2]);
  assert.match(won.log[5], /松纹刀应喝.*镇山喝截断铃锋.*趁截断追斩/);
  assert.match(won.log[6], /第 2 页已破/);
  const almostDead = startAltarMirror(save);
  almostDead.hp = 1;
  const stillNeedsPaper = previewBattle(almostDead);
  assert.equal(stillNeedsPaper.result, "won");
  assert.equal(stillNeedsPaper.altarMirror.pages, 3);
  assert.ok(stillNeedsPaper.round >= 9);
});

test("错页首破给现有重铸，两次配装记录与普通镜层各自保存", () => {
  const save = completedSave();
  save.mirror.best = 5;
  save.mirror.recent = { level: 5, round: 9, life: 104, maxLife: 140, hp: 0, won: true, build: "此前镜战" };
  save.rematchRanks[0] = 1;
  const decoded = decode(JSON.stringify(save), 100);
  const fail = previewBattle(startAltarMirror(decoded));
  assert.equal(settleAltarMirror(decoded, fail, 100).reward, 0);
  decoded.kit.stance = "attack";
  const won = previewBattle(startAltarMirror(decoded));
  assert.equal(settleAltarMirror(decoded, won, 100).reward, altarMirrorSand);
  const restored = decode(JSON.stringify(decoded), 101);
  assert.deepEqual([restored.mirror.altar.previous.pages, restored.mirror.altar.recent.pages], [1, 3]);
  assert.match(restored.mirror.altar.previous.build, /守式/);
  assert.match(restored.mirror.altar.recent.build, /攻式/);
  assert.equal(restored.mirror.best, 5);
  assert.deepEqual(restored.mirror.recent, save.mirror.recent);
  assert.equal(restored.victories[altarRegion], 1);
  assert.equal(reforgeGear(restored, "pineBlade"), true);
  assert.equal(restored.mirror.sand, 4);
  const replay = previewBattle(startAltarMirror(restored));
  assert.equal(settleAltarMirror(restored, replay, 101).reward, 0);
  assert.equal(restored.mirror.sand, 4);
});

test("代为报人沿用 v8 存档，答话要先破护纸并活过催灯轮", () => {
  const old = completedSave();
  delete old.trialBest.rollCall;
  const save = decode(JSON.stringify(old), 100);
  const locked = structuredClone(save);
  locked.victories[altarRegion] = 0;
  assert.equal(startTrial(locked, "rollCall"), undefined);

  const noArts = structuredClone(save);
  equipArt(noArts, 4, false);
  equipArt(noArts, 5, false);
  const lost = previewBattle(startTrial(noArts, "rollCall"));
  assert.deepEqual([lost.result, lost.round, lost.trial.progress], ["lost", 16, 0]);
  assert.match(defeatSummary(lost), /第 15 回合护纸未破，陆婆没能答话/);
  settleTrial(noArts, lost);
  assert.equal(noArts.trialBest.rollCall, 0);

  const attempt = startTrial(save, "rollCall");
  const forecast = previewBattle(attempt);
  enableCombatTactics(attempt);
  while (attempt.result === "fighting") tickFight(attempt);
  assert.deepEqual(attempt.log, forecast.log);
  assert.deepEqual([attempt.result, attempt.round, attempt.trial.progress], ["won", 8, 2]);
  assert.match(attempt.log[2], /陆婆亲口应答（1 \/ 2）/);
  assert.match(attempt.log[5], /驿卒亲口应答（2 \/ 2）/);
  const sand = save.mirror.sand;
  const dao = save.lifetimeDao;
  settleTrial(save, attempt);
  settleTrial(save, attempt);
  assert.deepEqual([save.trialBest.rollCall, save.mirror.sand, save.lifetimeDao], [8, sand, dao]);
  const restored = decode(JSON.stringify(save), 101);
  assert.equal(restored.trialBest.rollCall, 8);
  assert.equal(startTrial(restored, "rollCall"), undefined);
});

test("补名巡簿只削末页，配装相同可比较破页和收尾回合", () => {
  const save = completedSave();
  save.rematchRanks[0] = 1;
  const guardBefore = previewBattle(startAltarMirror(save));
  save.kit.stance = "attack";
  const before = previewBattle(startAltarMirror(save));
  assert.deepEqual([before.result, before.round, before.life, before.altarMirror.lastPageStrength], ["won", 11, 95, 150]);
  settleAltarMirror(save, before, 100);

  save.kit.stance = "guard";
  const trial = previewBattle(startTrial(save, "rollCall"));
  assert.equal(trial.result, "won");
  settleTrial(save, trial);
  const guardAfter = previewBattle(startAltarMirror(save));
  assert.deepEqual(guardAfter.log, guardBefore.log);
  assert.deepEqual([guardAfter.result, guardAfter.round, guardAfter.ward], ["lost", 7, 6]);

  save.kit.stance = "attack";
  const after = previewBattle(startAltarMirror(save));
  assert.deepEqual(after.log.slice(0, 8), before.log.slice(0, 8));
  assert.deepEqual([after.result, after.round, after.life, after.altarMirror.lastPageStrength], ["won", 10, 111, 72]);
  assert.match(after.log[8], /补名巡簿削去末页 78 点护纸/);
  assert.equal(settleAltarMirror(save, after, 100).reward, 0);
  const restored = decode(JSON.stringify(save), 101);
  assert.deepEqual([restored.mirror.altar.previous.lastPageStrength, restored.mirror.altar.recent.lastPageStrength], [150, 72]);
  assert.equal(restored.mirror.sand, altarMirrorSand);
});
