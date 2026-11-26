import test from "node:test";
import assert from "node:assert/strict";
import { cloudMirrorSand, cliffRegion, skyRegion } from "../src/night-watch/content.ts";
import {
  battleTiming, decode, defeatSummary, earnDao, enableCombatTactics, equipArt, newSave, roundMoves, setBattlePlan,
  settleCloudMirror, settleTrial, startCloudMirror, startTrial, tickFight,
} from "../src/night-watch/game.ts";
import { previewBattle } from "../src/night-watch/battle-preview.ts";

function cloudSave() {
  const save = newSave(100);
  save.region = skyRegion;
  save.victories.fill(1, 0, skyRegion + 1);
  save.windSurveyed = true;
  earnDao(save, 5140);
  save.drops.fill(true);
  save.ranks.fill(1);
  save.ownedGear = ["watchBlade", "watchSeal", "watchCoat", "ferryCoat", "hillCoat"];
  save.loadout = { weapon: "watchBlade", charm: "watchSeal" };
  return save;
}

function finish(fight) {
  while (fight.result === "fighting") tickFight(fight);
  return fight;
}

test("天栈首胜后开放风灯接力，守式和闪避都能连续护灯", () => {
  const save = cloudSave();
  const locked = structuredClone(save);
  locked.victories[skyRegion] = 0;
  assert.equal(startTrial(locked, "cloudRelay"), undefined);
  assert.equal(startCloudMirror(locked), undefined);

  save.loadout.armor = "hillCoat";
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  const guard = previewBattle(startTrial(save, "cloudRelay"));
  assert.deepEqual([guard.result, guard.round, guard.trial.progress, guard.links["护住风灯"]], ["won", 8, 2, 2]);
  assert.match(guard.log[1], /扶索稳身.*连续 1 \/ 2 次/);

  save.kit.stance = "attack";
  save.loadout.armor = "ferryCoat";
  equipArt(save, 0, false);
  equipArt(save, 3, false);
  const wrong = previewBattle(startTrial(save, "cloudRelay"));
  assert.deepEqual([wrong.result, wrong.trial.progress], ["lost", 0]);
  assert.equal(settleTrial(save, wrong), 0);
  assert.equal(save.trialBest.cloudRelay, 0);
  equipArt(save, 1, true);
  const live = startTrial(save, "cloudRelay");
  const preview = previewBattle(live);
  enableCombatTactics(live);
  finish(live);
  assert.deepEqual(live.log, preview.log);
  assert.deepEqual([live.result, live.round, live.trial.progress], ["won", 8, 2]);
  assert.match(live.log[4], /闪避过掠栈.*连续 2 \/ 2 次/);
});

test("断开的连续记录要重来，气血见底也要先完成托付", () => {
  const save = cloudSave();
  save.loadout.armor = "watchCoat";
  const trial = startTrial(save, "cloudRelay");
  trial.hp = 1;
  assert.equal(setBattlePlan(trial, [{ round: 2, choice: "safe" }, { round: 8, choice: "safe" }]), true);
  finish(trial);
  assert.equal(trial.result, "lost");
  assert.match(trial.log[1], /连续 1 \/ 2 次/);
  assert.match(trial.log[4], /连续记录重新计算/);
  assert.match(trial.log[7], /连续 1 \/ 2 次/);
  assert.ok(trial.hp >= 1);
});

test("同一套守式行装送灯后翻盘，风灯结扣在镜题第七回合只用一次", () => {
  const save = cloudSave();
  const bare = startCloudMirror(save);
  assert.equal(roundMoves(cliffRegion, save.kit, 1, bare.riverWave, battleTiming(bare)).enemy, "掠栈");
  assert.equal(roundMoves(cliffRegion, save.kit, 2, bare.riverWave, battleTiming(bare)).enemy, "落爪");
  const before = previewBattle(bare);
  assert.deepEqual([before.result, before.round, before.cloudMirror.falls], ["lost", 11, 2]);
  assert.match(defeatSummary(before), /第 10 回合踏空，第 11 回合先扣 84/);
  assert.match(before.log[7], /第 7 回合踏空，落地扣 84/);
  assert.equal(settleCloudMirror(save, before, 100).reward, 0);

  const relay = previewBattle(startTrial(save, "cloudRelay"));
  assert.equal(relay.result, "won");
  assert.equal(settleTrial(save, relay), 0);
  assert.equal(settleTrial(save, relay), 0);
  assert.equal(save.mirror.sand, 0);
  const reopened = decode(JSON.stringify(save), 101);
  assert.equal(reopened.trialBest.cloudRelay, relay.round);
  assert.equal(startTrial(reopened, "cloudRelay"), undefined);
  const prepared = previewBattle(startCloudMirror(reopened));
  assert.deepEqual([prepared.result, prepared.round, prepared.life, prepared.cloudMirror.falls], ["won", 12, 79, 1]);
  assert.match(prepared.log[0], /风灯照出备用结扣/);
  assert.match(prepared.log[6], /借备用结扣扶索/);
  assert.doesNotMatch(prepared.log[7], /落地扣 84/);
  assert.match(prepared.log[10], /第 10 回合踏空，落地扣 84/);
  assert.equal(prepared.links["风灯结扣"], 1);
  assert.equal(settleCloudMirror(reopened, prepared, 101).reward, cloudMirrorSand);
  assert.equal(settleCloudMirror(reopened, prepared, 101).reward, 0);
  assert.equal(reopened.mirror.sand, cloudMirrorSand);
  assert.equal(reopened.mirror.best, 0);

  const oldRecord = decode(JSON.stringify(save), 100);
  assert.equal(settleCloudMirror(oldRecord, prepared, 100).reward, cloudMirrorSand);
  const loaded = decode(JSON.stringify(oldRecord), 101);
  assert.equal(loaded.mirror.cloud.previous.falls, 2);
  assert.equal(loaded.mirror.cloud.recent.usedLamp, true);
  assert.equal(loaded.mirror.cloud.recent.falls, 1);
  const independent = cloudSave();
  independent.loadout.armor = "hillCoat";
  assert.equal(previewBattle(startCloudMirror(independent)).result, "won");
});
