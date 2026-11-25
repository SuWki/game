import test from "node:test";
import assert from "node:assert/strict";
import { altarRegion } from "../src/night-watch/content.ts";
import { gearDamage, traitPower } from "../src/night-watch/equipment.ts";
import {
  battleTiming, canEarnSand, decode, defeatSummary, earnDao, enableCombatTactics, equipArt, fuseLamp, maxEngravingRank,
  newSave, reforgeGear, reforgeState, roundMoves, settleTempleReprise, startRematch, startTempleReprise, tickFight,
} from "../src/night-watch/game.ts";
import { compareBattleBuilds, previewBattle } from "../src/night-watch/battle-preview.ts";

function completedSave() {
  const save = newSave(100);
  save.region = 2;
  save.victories.fill(1, 0, 8);
  save.victories[altarRegion] = 1;
  save.windSurveyed = true;
  save.booksCompared = true;
  save.trialBest.lampTrial = 12;
  earnDao(save, 7872);
  save.drops.fill(true);
  save.ranks.fill(1);
  save.ownedGear = ["watchBlade", "watchCoat", "watchSeal", "templeBlade"];
  save.loadout = { weapon: "watchBlade", armor: "watchCoat", charm: "watchSeal" };
  return save;
}

test("旧档结卷才开错烛，旧再战保留招路，高强化失配也会封灯", () => {
  const save = completedSave();
  const beforeEnding = structuredClone(save);
  beforeEnding.victories[altarRegion] = 0;
  assert.equal(startTempleReprise(beforeEnding), undefined);
  assert.equal(reforgeState(beforeEnding, "templeBlade"), "story");
  save.rematchRanks[5] = 3;
  save.rematchRanks[2] = 2;
  const ordinary = startRematch(save, 2);
  assert.equal(roundMoves(2, ordinary.kit, 3, ordinary.riverWave, battleTiming(ordinary)).enemy, "烛偏");
  const shifted = startTempleReprise(save);
  assert.equal(roundMoves(2, shifted.kit, 3, shifted.riverWave, battleTiming(shifted)).enemy, "催纸");
  assert.equal(roundMoves(2, shifted.kit, 4, shifted.riverWave, battleTiming(shifted)).enemy, "烛偏见真身");

  const lost = previewBattle(shifted);
  assert.deepEqual([lost.result, lost.round, lost.paperHits], ["lost", 2, 2]);
  assert.match(defeatSummary(lost), /第二道纸痕/);
  const suggestion = compareBattleBuilds(save, startTempleReprise, lost).find(item =>
    item.changes.some(change => change.kind === "art" && change.id === 2));
  assert.ok(suggestion);
  equipArt(save, 2, true);
  const replay = startTempleReprise(save);
  enableCombatTactics(replay);
  while (replay.result === "fighting") tickFight(replay);
  assert.deepEqual(replay.log, suggestion.outcome.log);
  assert.equal(replay.result, "won");
});

test("烛影刀显形伤害适配本命招，首胜恢复遗漏装备并开启已有的淬纹砂用途", () => {
  const save = completedSave();
  save.ranks[2] = save.ranks[5] = 2;
  fuseLamp(save, true);
  equipArt(save, 0, true);
  equipArt(save, 3, true);
  save.ownedGear = save.ownedGear.filter(id => id !== "templeBlade");
  save.mirror.best = 8;
  save.mirror.ranks = { edge: maxEngravingRank, step: maxEngravingRank };
  assert.equal(canEarnSand(save), false);
  assert.equal(reforgeState(save, "templeBlade"), "reprise");
  const won = previewBattle(startTempleReprise(save));
  assert.equal(won.result, "won");
  assert.deepEqual(settleTempleReprise(save, won, 3_600_100), { first: true, recovered: "templeBlade" });
  assert.deepEqual(save.newGear, ["templeBlade"]);
  assert.equal(save.rematchRanks[2], 0);
  assert.equal(save.mirror.sand, 0);
  assert.equal(canEarnSand(save), true);
  assert.deepEqual(settleTempleReprise(save, won, 3_600_100), { first: false });
  assert.deepEqual(save.newGear, ["templeBlade"]);
  const loaded = decode(JSON.stringify(save), 3_600_101);
  loaded.loadout.weapon = "templeBlade";
  const withBlade = previewBattle(startTempleReprise(loaded));
  assert.equal(withBlade.result, "won");
  assert.ok(withBlade.links["烛影刀显形加伤"] > 0);
  assert.match(withBlade.log[1], /照灯断影显形.*烛影刀，刀伤 \+6/);
});

test("照影守式同境界重铸少打一轮，记录可刷新回看，词条与原再战保持各自效果", () => {
  const save = completedSave();
  save.loadout.weapon = "templeBlade";
  save.mirror.sand = 22;
  equipArt(save, 2, true);
  const before = previewBattle(startTempleReprise(save));
  assert.deepEqual([before.result, before.round, before.life], ["won", 13, 165]);
  assert.equal(reforgeGear(save, "templeBlade"), false);
  assert.deepEqual(settleTempleReprise(save, before, 100), { first: true });
  assert.equal(reforgeGear(save, "templeBlade"), true);
  assert.equal(save.mirror.sand, 0);
  assert.equal(gearDamage("templeBlade", 0, save.reforges), 10);
  assert.equal(traitPower("templeBlade", 0), 6);
  const after = previewBattle(startTempleReprise(save));
  settleTempleReprise(save, after, 101);
  assert.deepEqual([after.result, after.round, after.life], ["won", 12, 168]);
  assert.match(before.log[0], /烛影刀，刀伤 \+6.*普攻刀伤 48/);
  assert.match(after.log[0], /烛影刀，刀伤 \+6.*普攻刀伤 52/);
  const reloaded = decode(JSON.stringify(save), 102);
  assert.equal(reloaded.templeReprise.previous.round, 13);
  assert.equal(reloaded.templeReprise.recent.round, 12);
  assert.match(reloaded.templeReprise.recent.build, /已重铸/);
  assert.equal(reforgeState(reloaded, "templeBlade"), "done");
  assert.equal(startRematch(reloaded, 2).rematchRank, 1);
});
