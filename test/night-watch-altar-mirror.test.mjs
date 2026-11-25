import test from "node:test";
import assert from "node:assert/strict";
import { altarRegion, altarMirrorSand } from "../src/night-watch/content.ts";
import {
  altarMirrorUnlocked, decode, defeatSummary, earnDao, enableCombatTactics, equipArt, fuseLamp, newSave,
  reforgeGear, settleAltarMirror, startAltarMirror, startCaseFight, tickFight,
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
