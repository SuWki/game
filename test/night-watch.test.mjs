import assert from "node:assert/strict";
import test from "node:test";
import {
  accrueOffline, accrueSand, answerOpening, canChallenge, canEarnSand, clueCount, combatStats, compareGear, cultivation, defeatSummary, earnDao, decode, forecastFight, gearRequirement, loadoutStats, newSave, trainingRoute,
  applyPreset, artDue, enableCombatTactics, equipArt, planWindows, previewOpening, recordedClues, recordPatrolKill, reforgeGear, reforgeState, rematchSpec, roundMoves, setBattlePlan, settleMirror, settleRematch, settleTrial, startCaseFight, startFight, startMirrorFight, startRematch, startTrial, storePreset, study, tickFight, tuneEngraving, weaponArts, win,
} from "../src/night-watch/game.ts";
import { mountainFirstReward, regions } from "../src/night-watch/content.ts";
import { equipment, gearEffect } from "../src/night-watch/equipment.ts";
import { clueTip, nextTip } from "../src/night-watch/guide.ts";

function stowThenPatrol(save, random) {
  save.newGear = [];
  return recordPatrolKill(save, random);
}

function fightToEnd(save, region) {
  const fight = startFight(save, region, true);
  fight.consult = false;
  while (fight.result === "fighting") tickFight(fight);
  return fight;
}

test("新档靠守式赢山君，首胜发镇山喝和一份教学道行", () => {
  const save = newSave(100);
  assert.equal(canChallenge(save, 0), false);
  for (let i = 0; i < regions[0].thresholds[2]; i++) stowThenPatrol(save, () => 1);
  assert.equal(canChallenge(save, 0), true);
  save.kit.stance = "attack";
  assert.equal(fightToEnd(save, 0).result, "lost");
  save.kit.stance = "guard";
  assert.equal(fightToEnd(save, 0).result, "won");
  assert.deepEqual(win(save, 0), { first: true, drop: true });
  assert.deepEqual(win(save, 0), { first: false, drop: false });
  assert.equal(save.dao, 24 + mountainFirstReward);
  assert.deepEqual(save.ownedGear, ["pineBlade", "tigerFang"]);
  assert.equal(save.autoPatrol, false);
  assert.equal(study(save, 0), true);
  assert.equal(save.dao, 0);
  assert.equal(save.ranks[0], 1);
});

test("河伯的回浪可被截断，基础配置也能走完首卷", () => {
  const save = newSave(100);
  earnDao(save, 130 - mountainFirstReward);
  save.kills = regions.map(region => region.thresholds[2]);
  win(save, 0);
  assert.equal(save.realm, 1);
  assert.equal(canChallenge(save, 1), true);
  assert.equal(fightToEnd(save, 1).result, "lost");
  save.kit.stance = "attack";
  assert.equal(fightToEnd(save, 1).result, "lost");
  assert.equal(study(save, 0), true);
  save.kit.shout = "windup";
  const river = playRounds(startFight(save, 1, true), 20, { 5: "risk", 11: "risk" });
  assert.equal(river.result, "won");
  assert.ok(river.log.some(line => line.includes("截断回浪")));
  win(save, 1, () => 0.9);
  earnDao(save, 300);
  assert.equal(canChallenge(save, 2), false);
  earnDao(save, 400);
  assert.equal(canChallenge(save, 2), true);
  save.kit.stance = "guard";
  save.kit.shout = "off";
  assert.equal(playRounds(startFight(save, 2, true), 20, { 2: "safe", 5: "safe" }).result, "won");
});

test("巡夜依次产出线索和破境道行，击退山君后可以立刻学招，随后靠巡夜逐层升级", () => {
  const save = newSave(100);
  for (let kill = 1; kill <= 12; kill++) {
    stowThenPatrol(save);
    assert.equal(canChallenge(save, 0), kill >= 7);
    assert.equal(clueCount(save), [3, 7, 12].filter(target => kill >= target).length);
  }
  win(save, 0);
  assert.equal(study(save, 0), true);
  assert.equal(save.realm, 0);
  assert.equal(save.lifetimeDao, 30);
  assert.equal(save.dao, 0);
  save.region = 1;
  for (let kill = 1; kill <= 100; kill++) stowThenPatrol(save);
  assert.equal(canChallenge(save, 1), true);
  assert.equal(save.realm, 1);
  win(save, 1, () => 0.9);
  save.region = 2;
  for (let kill = 1; kill <= 42; kill++) stowThenPatrol(save);
  assert.equal(save.realm, 2);
  assert.equal(canChallenge(save, 2), false);
});

test("短流程旧档的已得线索、已解锁挑战和真实击杀数一起保留", () => {
  const { clues, guide, ...old } = newSave(100);
  old.version = 1;
  old.kills = [10, 8, 0];
  old.victories = [0, 0, 0];
  old.drops = old.drops.slice(0, 3);
  old.ranks = old.ranks.slice(0, 3);
  const migrated = decode(JSON.stringify(old), 700);
  assert.deepEqual(migrated.clues, [3, 2, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(migrated.kills, [10, 8, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(nextTip(migrated, "patrol", null).id, "first-boss");
  assert.equal(canChallenge(migrated, 0), true);
  assert.equal(clueCount(migrated, 1), 2);
  migrated.region = 1;
  for (let kill = 9; kill <= 99; kill++) stowThenPatrol(migrated);
  assert.equal(clueCount(migrated, 1), 2);
  stowThenPatrol(migrated);
  assert.equal(clueCount(decode(JSON.stringify(migrated), 700), 1), 3);
});

test("已进渡口的旧档跳过开场，败阵提示逐次加深且可关闭", () => {
  const { guide, lifetimeDao, ...old } = newSave(100);
  old.region = 1;
  old.realm = 1;
  old.kills = [36, 100, 0, 0, 0, 0, 0, 0, 0];
  old.victories = [1, 0, 0, 0, 0, 0, 0, 0, 0];
  old.drops = [true, false, false, false, false, false, false];
  old.ranks = [1, 0, 0, 0, 0, 0, 0];
  old.kit.shout = "windup";
  const save = decode(JSON.stringify(old), 700);
  assert.equal(nextTip(save, "patrol", null).id, "auto-patrol");
  save.autoPatrol = true;
  assert.equal(nextTip(save, "patrol", null).id, "river-preview");
  const failed = { region: 1, won: false };
  save.guide.defeats[1] = 1;
  assert.equal(nextTip(save, "patrol", failed).id, "defeat-1-1");
  save.guide.dismissed.push("defeat-1-1");
  assert.equal(nextTip(save, "patrol", failed), undefined);
  save.guide.defeats[1] = 2;
  assert.equal(nextTip(save, "skills", failed).id, "defeat-1-2");
  save.guide.enabled = false;
  const reloaded = decode(JSON.stringify(save), 800);
  assert.deepEqual(reloaded.guide, save.guide);
  assert.equal(nextTip(reloaded, "patrol", failed), undefined);
});

test("第五胜保底按大妖独立记录，刷新后保持已得传承", () => {
  const save = newSave(100);
  for (let attempt = 0; attempt < 4; attempt++) assert.equal(win(save, 1, () => 0.9).drop, false);
  assert.equal(win(save, 2, () => 0.9).drop, false);
  assert.equal(win(save, 1, () => 0.9).drop, true);
  const loaded = decode(JSON.stringify(save), 700);
  assert.deepEqual(loaded.victories, [0, 5, 1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(loaded.drops, [false, true, false, false, false, false, false]);
  assert.equal(win(loaded, 1, () => 0).drop, false);
});

test("离线最多八小时，仅入账道行，同一时间点不会重复到账", () => {
  const save = newSave(1000);
  save.region = 1;
  const now = 1000 + 10 * 60 * 60 * 1000;
  assert.equal(accrueOffline(structuredClone(save), now).earned, 0);
  save.victories[0] = 1;
  save.autoPatrol = true;
  assert.equal(accrueOffline(save, now).earned, 400);
  const loaded = decode(JSON.stringify(save), now);
  assert.equal(accrueOffline(loaded, now).earned, 0);
  assert.equal(accrueOffline(loaded, 800).elapsed, 0);
  assert.equal(loaded.time, now);
  assert.deepEqual(loaded.kills, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(loaded.victories, [1, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(loaded.ownedGear, ["tigerFang"]);
});

test("夜行装备按地区分阶，第二只小妖必出教学装备且同款只收一份", () => {
  const save = newSave(0);
  assert.equal(stowThenPatrol(save, () => 0.9).found, undefined);
  assert.equal(stowThenPatrol(save, () => 0.9).found, "pineBlade");
  assert.equal(stowThenPatrol(save, () => 0).found, "hillCoat");
  assert.equal(stowThenPatrol(save, () => 0).found, undefined);
  save.region = 1;
  assert.equal(equipment[stowThenPatrol(save, () => 0).found].level, 2);
  save.region = 2;
  assert.equal(equipment[stowThenPatrol(save, () => 0).found].level, 3);
});

test("旧档补发首胜佩饰，兵刃护具和佩饰在大妖战中分别生效", () => {
  const { autoPatrol, ownedGear, loadout, ...old } = newSave(0);
  old.victories = [1, 1, 0, 0, 0, 0, 0, 0, 0];
  const save = decode(JSON.stringify(old), 10);
  assert.deepEqual(save.ownedGear, ["tigerFang", "tideSeal"]);
  assert.equal(save.autoPatrol, false);
  save.ownedGear.push("pineBlade", "hillCoat");
  save.loadout = { weapon: "pineBlade", armor: "hillCoat", charm: "tigerFang" };
  const loaded = decode(JSON.stringify(save), 10);
  assert.deepEqual(combatStats(0, "guard", loaded.loadout), { damage: 14, life: 117 });
  const f = fightToEnd(loaded, 0);
  assert.equal(f.maxLife, 117);
  assert.match(f.log[2], /(?:普攻刀伤|短刀伤) 17/);
});

test("巡夜各地小妖均在第一刀归零，整场没有反击", () => {
  for (const region of [0, 1, 2, 3]) {
    for (const index of [0, 1]) {
      const f = startFight(newSave(0), region, false, index);
      for (let i = 0; i < 3; i++) tickFight(f);
      assert.equal(f.hp, 0);
      while (f.result === "fighting") tickFight(f);
      assert.equal(f.result, "won");
      assert.equal(f.life, f.maxLife);
    }
  }
});

test("招式按回合循环，同轮照影先结算，身法与截招不争普攻", () => {
  const save = newSave(0);
  save.realm = 3;
  save.ranks = [2, 2, 2, 0, 0, 0, 0];
  save.kit = { stance: "attack", shout: "windup", step: "tide", reveal: true };
  const f = startFight(save, 1, true);
  f.hp = f.maxHp = 99999;
  f.consult = false;
  while (f.result === "fighting" && f.round < 9) tickFight(f);
  assert.deepEqual(f.log.map((line,i) => line.includes("镇山喝") ? i+1 : 0).filter(Boolean), [3,6,9]);
  assert.deepEqual(f.log.map((line,i) => line.includes("听潮步") ? i+1 : 0).filter(Boolean), [2,5,8]);
  assert.deepEqual(f.log.map((line,i) => line.includes("照影") ? i+1 : 0).filter(Boolean), [1,5,9]);
  assert.match(f.log[4], /照影.*听潮步.*(?:普攻刀伤|短刀伤) 49.*避过挥篙/);
  assert.match(f.log[8], /照影.*截断回浪.*(?:普攻|短刀)/);
});

function playRounds(f, count, decisions = {}) {
  for (let i = 0; i < 400 && f.round < count && f.result === "fighting"; i++) {
    if (f.waiting) assert.equal(answerOpening(f, decisions[f.round + 1] ?? "pass"), true);
    tickFight(f);
  }
  return f;
}

test("首战等人读招，留力免费，同一轮不能重复下令；重演也可读招", () => {
  const save = newSave(0);
  const f = startFight(save, 0, true);
  for (let i = 0; i < 150; i++) tickFight(f);
  assert.deepEqual([f.round, f.waiting, f.life, f.focus], [2, true, 87, 2]);
  assert.equal(answerOpening(f, "pass"), true);
  assert.equal(answerOpening(f, "safe"), false);
  assert.equal(f.focus, 2);
  save.victories[0] = 1;
  assert.equal(startFight(save, 0, true).consult, true);
  assert.equal(startFight(save, 1, true).consult, true);
});

test("同一套锻骨攻式，伏身能救命，迎啸可抢先斩杀；定神用尽自动续战", () => {
  const save = newSave(0);
  save.kit.stance = "attack";
  const duel = orders => playRounds(startFight(save, 0, true), 20, orders);
  assert.equal(duel({}).result, "lost");
  const safe = duel({ 3: "safe", 6: "safe" });
  assert.deepEqual([safe.result, safe.round, safe.focus], ["won", 7, 0]);
  assert.match(safe.log[2], /伏身避啸.*虎啸，(?:扣 4 点气血|失血 4)/);
  const finisher = duel({ 3: "safe", 6: "risk" });
  assert.deepEqual([finisher.result, finisher.round], ["won", 6]);
  assert.match(finisher.log[5], /迎啸进刀.*(?:普攻刀伤|短刀伤) 27/);
});

test("河伯上一轮的选择影响回浪，与截招是否对齐决定收益", () => {
  const save = newSave(0);
  save.realm = 1;
  save.kit.stance = "attack";
  const duel = choice => playRounds(startFight(save, 1, true), 3, { 2: choice });
  assert.match(duel("safe").log[2], /缆断浪浅.*回浪，(?:扣 12 点气血|失血 12)/);
  assert.match(duel("risk").log[2], /浪涌船高.*回浪，(?:扣 46 点气血|失血 46)/);
  save.kit.shout = "windup";
  save.ranks[0] = 1;
  assert.match(duel("risk").log[2], /截断回浪.*回浪撞舟，反伤 18.*(?:普攻|短刀)/);
});

test("挑灯覆盖三轮且不会冒用照影精通；藏锋收刀后仅在下一轮打实", () => {
  const save = newSave(0);
  save.realm = 3;
  save.ranks[2] = 2;
  const duel = choice => playRounds(startFight(save, 2, true), 5, { 2: choice });
  const lamp = duel("safe");
  assert.ok(lamp.log.slice(1, 4).every(line => /灯下见真身.*(?:普攻刀伤|短刀伤) 21/.test(line)));
  assert.match(lamp.log[4], /(?:普攻刀伤|短刀伤) 4/);
  const ambush = duel("risk");
  assert.doesNotMatch(ambush.log[1], /(?:普攻刀伤|短刀伤)/);
  assert.match(ambush.log[2], /候得真身.*(?:普攻刀伤|短刀伤) 49/);
  assert.match(ambush.log[3], /(?:普攻刀伤|短刀伤) 4/);
});

test("累计道行逐层自动升级，支出学费不回退，离线可跨境且封顶", () => {
  const save = newSave(0);
  earnDao(save, 3);
  assert.equal(cultivation(save.lifetimeDao).layer, 1);
  earnDao(save, 1);
  assert.equal(cultivation(save.lifetimeDao).layer, 2);
  assert.equal(cultivation(129).layer, 10);
  earnDao(save, 126);
  assert.deepEqual(cultivation(save.lifetimeDao), { realm: 1, layer: 1, progress: 0, needed: 30, full: false });
  save.drops[0] = true;
  study(save, 0);
  assert.equal(save.lifetimeDao, 130);
  save.region = 2;
  save.victories = [1, 1, 0, 0, 0, 0, 0, 0, 0];
  save.autoPatrol = true;
  accrueOffline(save, 8 * 3600000);
  assert.deepEqual(cultivation(save.lifetimeDao), { realm: 3, layer: 10, full: true, progress: 60, needed: 60 });
});

test("旧档补计学费和突破支出，已穿装备保留，掉落提醒刷新可续", () => {
  const { lifetimeDao, newGear, ...old } = newSave(0);
  Object.assign(old, { realm: 1, dao: 74, ranks: [1,0,0, 0, 0, 0, 0], ownedGear: ["pineBlade"], loadout: {weapon:"pineBlade"} });
  const save = decode(JSON.stringify(old), 0);
  assert.equal(save.lifetimeDao, 204);
  assert.equal(save.loadout.weapon, "pineBlade");
  save.region = 1;
  recordPatrolKill(save, () => 0);
  const restored = decode(JSON.stringify(save), 0);
  assert.deepEqual(restored.newGear, ["ferryCoat"]);
  assert.equal(restored.lifetimeDao, 207);
});

test("松纹刀须成功截招，山行衣须守式实际架住重击", () => {
  const save = newSave(0);
  save.loadout = { weapon: "pineBlade", armor: "hillCoat", charm: "tigerFang" };
  const duel = () => playRounds(startFight(save, 0, true), 3);
  assert.match(duel().log[2], /山行衣减伤 3.*虎啸，(?:扣 4 点气血|失血 4)/);
  save.ranks[0] = 1;
  save.kit.shout = "windup";
  const fight = duel();
  assert.match(fight.log[2], /松纹刀应喝，喝伤 \+12.*截断虎啸，(?:喝)?伤 17.*山君牙坠.*(?:普攻刀伤|短刀伤) 17/);
  assert.doesNotMatch(fight.log[2], /山行衣减伤/);
  assert.doesNotMatch(playRounds(startFight(save, 2, true), 3).log[2], /松纹刀应喝/);
});

test("听潮步回合斩芦刀借势，渡水蓑在真实避击后回血且不超过上限", () => {
  const save = newSave(0);
  earnDao(save, 130);
  save.kit.step = "tide";
  save.ranks[1] = 1;
  save.loadout = { weapon: "reedBlade", armor: "ferryCoat" };
  const fight = playRounds(startFight(save, 1, true), 1);
  const afterHit = fight.life;
  playRounds(fight, 2);
  assert.equal(fight.life, afterHit + 5);
  assert.match(fight.log[1], /斩芦刀，刀伤 \+8.*(?:普攻刀伤|短刀伤) 27.*避过挥篙.*渡水蓑回复 5/);
  const fresh = playRounds(startFight(save, 1, true), 1);
  fresh.life = fresh.maxLife - 1;
  playRounds(fresh, 2);
  assert.equal(fresh.life, fresh.maxLife);
  assert.match(fresh.log[1], /回复 1 气血/);
});

test("照影持续轮触发烛影刀和护灯袍，单靠听息辨真与挑灯不触发", () => {
  const save = newSave(0);
  earnDao(save, 830);
  save.loadout = { weapon: "templeBlade", armor: "templeCoat", charm: "mirrorPearl" };
  save.ranks[2] = 1;
  save.kit.reveal = true;
  const fight = playRounds(startFight(save, 2, true), 3);
  assert.match(fight.log[0], /烛影刀.*借面珠.*(?:普攻刀伤|短刀伤) 38.*护灯袍减伤 4.*(?:扣 3 点气血|失血 3)/);
  assert.match(fight.log[1], /烛影刀.*(?:普攻刀伤|短刀伤) 33.*护灯袍减伤 4/);
  assert.doesNotMatch(fight.log[2], /烛影刀|护灯袍/);
  save.kit.reveal = false;
  const lamp = playRounds(startFight(save, 2, true), 3, { 2: "safe" });
  assert.doesNotMatch(lamp.log.join(" "), /烛影刀|护灯袍/);
});

test("巡夜最后一刀只给剩余额度，学招、换回旧地图及刷新均不会重开收益", () => {
  for (const [region, cap] of [[0,108], [1,400], [2,1370]]) {
    const save = newSave(0);
    save.region = region;
    save.victories = [1, 1, 0, 0, 0, 0, 0, 0, 0];
    earnDao(save, cap - 1);
    save.autoPatrol = true;
    assert.equal(recordPatrolKill(save, () => 1).reward, 1);
    assert.equal(save.autoPatrol, false);
    assert.equal(clueCount(save), 3);
    assert.equal(recordedClues(save), 0);
    assert.equal(canChallenge(save, region), true);
    assert.equal(startCaseFight(save, region).preparation, undefined);
    save.drops[0] = true;
    study(save, 0);
    const restored = decode(JSON.stringify(save), 0);
    assert.equal(recordPatrolKill(restored, () => 0).reward, 0);
    assert.equal(restored.kills[region], 1);
    restored.region = 0;
    assert.equal(recordPatrolKill(restored).reward, 0);
    assert.equal(restored.lifetimeDao, cap);
  }
});
test("离线扫清可寻到首领，打赢后补获遗漏的本地装备", () => {
  const save = newSave(0);
  save.victories[0] = 1;
  save.region = 1;
  save.autoPatrol = true;
  earnDao(save, 395);
  assert.equal(accrueOffline(save, 3600000).earned, 5);
  assert.equal(save.autoPatrol, false);
  assert.equal(canChallenge(save, 1), true);
  assert.equal(win(save, 1).recovered, "ferryCoat");
  assert.equal(win(save, 1).recovered, "reedBlade");
  assert.equal(win(save, 1).recovered, undefined);
});

test("超出黑风岭上限的老存档保留境界和余额，载入后停止夜行", () => {
  const save = newSave(0);
  earnDao(save, 670);
  save.victories[0] = 1;
  save.autoPatrol = true;
  const restored = decode(JSON.stringify(save), 3600000);
  assert.equal(restored.autoPatrol, false);
  assert.equal(restored.realm, 2);
  assert.equal(accrueOffline(restored, 3600000).earned, 0);
  assert.equal(restored.dao, 670);
  assert.equal(restored.lifetimeDao, 670);
  assert.equal(restored.kills[0], 0);
});

test("新装备未处置前手动、沿路与离线停在同一刻，逐件收好后才恢复", () => {
  const save = newSave(0);
  save.victories[0] = 1;
  save.autoPatrol = true;
  assert.equal(recordPatrolKill(save, () => 0).found, "hillCoat");
  assert.equal(recordPatrolKill(save, () => 0).reward, 0);
  const restored = decode(JSON.stringify(save), 60000);
  assert.equal(accrueOffline(restored, 60000).earned, 0);
  assert.deepEqual(restored.kills, [1, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(restored.lifetimeDao, 2);
  assert.equal(restored.autoPatrol, true);
  restored.newGear = ["hillCoat", "tigerFang"];
  restored.newGear.shift();
  assert.equal(recordPatrolKill(restored).reward, 0);
  restored.newGear.shift();
  assert.equal(accrueOffline(restored, 64000).earned, 2);
});

test("换装对照使用实际架势刀伤，说明失去的招式联动和佩饰轮次", () => {
  const save = newSave(0);
  save.kit.stance = "attack";
  save.loadout.weapon = "pineBlade";
  const upgrade = compareGear(save, "reedBlade");
  assert.deepEqual([upgrade.before.damage, upgrade.after.damage], [18, 20]);
  assert.match(upgrade.added, /听潮步.*8/);
  assert.match(upgrade.lost, /镇山喝.*12/);
  save.loadout.weapon = "reedBlade";
  assert.equal(compareGear(save, "pineBlade").after.damage, 18);
  save.loadout.charm = "tigerFang";
  const charm = compareGear(save, "tideSeal");
  assert.deepEqual(charm.before, charm.after);
  assert.match(charm.added, /2、5、8/);
  assert.match(charm.lost, /3、6、9/);
  assert.equal(compareGear(save, "tigerFang").lost, "");
});

test("三地每项应变的余血预览与实际交锋一致，查看不会消耗机会", () => {
  const save = newSave(0);
  earnDao(save, 830);
  save.kit.shout = "windup";
  save.ranks[0] = 1;
  save.loadout.weapon = "pineBlade";
  for (const region of [0, 1, 2]) {
    const fight = startFight(save, region, true);
    while (!fight.waiting) tickFight(fight);
    const original = structuredClone(fight);
    for (const choice of ["safe", "risk", "pass"]) {
      const forecast = previewOpening(fight, choice);
      const real = structuredClone(fight);
      answerOpening(real, choice);
      playRounds(real, original.round + [1, 2, 3][region]);
      assert.deepEqual(forecast, { life: Math.max(0, real.life), hp: Math.max(0, real.hp), round: real.round, result: real.result, water: real.water, paperHits: real.paperHits,
        backlashes: (real.links["纸面反噬"] ?? 0) - (original.links["纸面反噬"] ?? 0) });
    }
    assert.deepEqual(fight, original);
  }
});

test("河伯按缆汲水，可割缆断水，也可用松纹刀和镇山喝翻浪", () => {
  const save = newSave(0);
  earnDao(save, 130);
  const trial = choice => playRounds(startFight(save, 1, true), 3, { 2: choice });
  assert.match(trial("pass").log[2], /河伯回血 24/);
  assert.doesNotMatch(trial("safe").log[2], /河伯回血/);
  assert.match(trial("risk").log[2], /河伯回血/);
  save.ranks[0] = 1;
  save.kit.shout = "windup";
  save.loadout.weapon = "pineBlade";
  const reversed = trial("risk");
  assert.doesNotMatch(reversed.log[2], /河伯回血/);
  assert.equal(reversed.links["回浪撞舟 +18"], 1);
  assert.equal(reversed.links["松纹刀 +12"], 1);
});

test("正常渡口装忽视船缆会覆舟，割缆能过，镇山喝引浪能更快取胜", () => {
  const save = newSave(0);
  earnDao(save, 330);
  save.loadout = { weapon: "reedBlade", armor: "ferryCoat", charm: "tigerFang" };
  const duel = choice => playRounds(startFight(save, 1, true), 20, { 2: choice, 5: choice });
  const flooded = duel("pass");
  assert.equal(flooded.result, "lost");
  assert.equal(flooded.round, 9);
  assert.match(flooded.lastThreat, /覆舟/);
  assert.equal(defeatSummary(flooded), "水位涨满三格，阿照落水败阵。");
  assert.equal(duel("safe").result, "won");
  assert.equal(duel("safe").round, 14);
  save.loadout.weapon = "pineBlade";
  save.kit.shout = "windup";
  save.ranks[0] = 1;
  assert.equal(duel("risk").result, "won");
  assert.equal(duel("risk").round, 10);
});

test("照妖镜首破结算旧速率之后才提升纪录，重演和重复提交不再给首破砂", () => {
  const hour = 3600000;
  const save = decode(JSON.stringify({ ...newSave(0), mirror: undefined }), 0);
  assert.equal(startMirrorFight(save, 1), undefined);
  save.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  earnDao(save, 1100);
  const startChapter = [...save.victories];
  const battle = startMirrorFight(save, 1);
  assert.equal(battle.limit, 12);
  assert.equal(startMirrorFight(save, 2), undefined);
  const winFirst = playRounds(battle, 12, { 2: "safe", 5: "safe" });
  assert.equal(winFirst.result, "won");
  assert.deepEqual(settleMirror(save, winFirst, hour), { idle: 0, reward: 12 });
  assert.deepEqual(settleMirror(save, winFirst, hour + hour / 4), { idle: 0, reward: 0 });
  const restored = decode(JSON.stringify(save), hour);
  assert.equal(accrueSand(restored, hour + hour / 2), 1);
  assert.equal(accrueSand(restored, hour + hour / 2), 0);
  assert.equal(accrueSand(restored, hour * 25), 16);
  assert.deepEqual(restored.victories, startChapter);
  assert.equal(restored.lifetimeDao, 1100);
  assert.equal(tuneEngraving(restored, "edge", "train"), true);
  assert.equal(tuneEngraving(restored, "step", "train"), true);
  assert.equal(restored.mirror.equipped, "edge");
  assert.equal(tuneEngraving(restored, "step", "equip"), true);
  assert.equal(restored.mirror.equipped, "step");
  assert.equal(restored.mirror.sand, 17);
});

test("第五重回浪提前，镇山喝赶不上，割缆仍能清空水位", () => {
  const save = newSave(0);
  save.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  save.mirror.best = 4;
  earnDao(save, 1100);
  save.kit.shout = "windup";
  save.ranks[0] = 1;
  const fight = startMirrorFight(save, 5);
  while (!fight.waiting) tickFight(fight);
  assert.equal(fight.round, 0);
  assert.equal(previewOpening(fight, "risk").water, 1);
  assert.equal(previewOpening(fight, "safe").water, 0);
  assert.deepEqual(roundMoves(1, fight.kit, 2, fight.riverWave), { names: [], enemy: "回浪", opening: false });
});

test("招式卡的亮格与河伯战前对照采用相同轮次，卸招后实时更新", () => {
  const save = newSave(0);
  save.kit = { stance: "guard", shout: "windup", step: "tide", reveal: true };
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => i + 1).filter(round => artDue(round, 0)), [3, 6, 9]);
  assert.deepEqual(roundMoves(1, save.kit, 3), { names: ["镇山喝"], enemy: "回浪", opening: false });
  assert.deepEqual(roundMoves(1, save.kit, 5).names, ["照影", "听潮步"]);
  save.kit.shout = "off";
  assert.deepEqual(roundMoves(1, save.kit, 3).names, []);
});

test("刻纹实际出手，断潮留到下一刀，回息只在成功避击且有伤时回复", () => {
  const save = newSave(0);
  save.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  save.mirror.sand = 12;
  earnDao(save, 1100);
  save.kit.shout = "windup";
  save.ranks[0] = 1;
  tuneEngraving(save, "edge", "train");
  tuneEngraving(save, "step", "train");
  const edge = playRounds(startFight(save, 1, true), 4, { 2: "risk" });
  assert.doesNotMatch(edge.log[2], /断潮纹/);
  assert.match(edge.log[3], /断潮纹，刀伤 \+4/);
  tuneEngraving(save, "step", "equip");
  const step = playRounds(startFight(save, 1, true), 4, { 2: "safe" });
  assert.doesNotMatch(step.log[0], /回息纹/);
  assert.match(step.log[3], /避过第一道浪.*回息纹回气 3/);
});

test("白烛庙常见配装盲打会反噬败阵，挑灯或藏锋都能首胜", () => {
  const save = newSave(0);
  earnDao(save, 1030);
  save.loadout = { weapon: "templeBlade", armor: "templeCoat", charm: "tigerFang" };
  const blindly = fightToEnd(save, 2);
  assert.equal(blindly.result, "lost");
  assert.equal(blindly.round, 11);
  assert.match(blindly.lastThreat, /纸面.*反噬/);
  const lamp = playRounds(startFight(save, 2, true), 20, { 2: "safe", 5: "safe" });
  assert.equal(lamp.result, "won");
  assert.equal(lamp.round, 9);
  const ambush = playRounds(startFight(save, 2, true), 20, { 2: "risk", 5: "risk" });
  assert.equal(ambush.result, "won");
  assert.match(ambush.log[2], /候得真身/);
});

test("第十二重遇到娘娘，照影能取代部分应变，镜战仍照原规则发放首破砂", () => {
  const save = newSave(0);
  earnDao(save, 1370);
  save.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  save.mirror.best = 11;
  save.loadout = { weapon: "templeBlade", armor: "templeCoat", charm: "tigerFang" };
  assert.equal(startMirrorFight(save, 11).region, 1);
  const battle = startMirrorFight(save, 12);
  assert.equal(battle.region, 2);
  const blind = playRounds(battle, 12);
  assert.equal(blind.result, "lost");
  save.kit.reveal = true;
  save.ranks[2] = 1;
  const revealed = playRounds(startMirrorFight(save, 12), 12, { 5: "safe" });
  assert.equal(revealed.result, "won");
  assert.match(revealed.log[0], /照影显形/);
  assert.equal(settleMirror(save, revealed, 0).reward, 34);
  assert.equal(settleMirror(save, revealed, 0).reward, 0);
  assert.equal(save.mirror.best, 12);
  assert.deepEqual(save.victories, [1, 1, 1, 0, 0, 0, 0, 0, 0]);
});

test("旧档按案补入异相纪录，首卷未平不能接托付", () => {
  const s = newSave(0);
  assert.equal(startTrial(s, "ferryTrial"), undefined);
  delete s.trialBest;
  s.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  s.mirror.best = 12;
  const old = decode(JSON.stringify(s), 100);
  assert.deepEqual(old.trialBest, { ferryTrial: 0, templeTrial: 0, lampTrial: 0 });
  assert.equal(old.mirror.best, 12);
  old.trialBest = { ferryTrial: 11, templeTrial: -1 };
  assert.deepEqual(decode(JSON.stringify(old), 100).trialBest, { ferryTrial: 11, templeTrial: 0, lampTrial: 0 });
});

test("回灯过渡的预览与护灯结算一致，踏步护灯仍要处理水位", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  earnDao(s, 1100);
  const f = startTrial(s, "ferryTrial");
  while (!f.waiting) tickFight(f);
  assert.equal(previewOpening(f, "safe").trialProgress, 1);
  assert.equal(previewOpening(f, "pass").trialProgress, 0);
  assert.equal(f.trial.progress, 0);
  playRounds(f, 16, { 1: "safe", 4: "safe" });
  assert.deepEqual([f.result, f.round, f.trial.progress], ["won", 13, 2]);
  s.kit.step = "tide";
  s.ranks[1] = 2;
  s.loadout = { weapon: "reedBlade", armor: "ferryCoat", charm: "tigerFang" };
  const flood = playRounds(startTrial(s, "ferryTrial"), 16);
  assert.deepEqual([flood.result, flood.water, flood.trial.progress], ["lost", 3, 2]);
  assert.equal(settleTrial(s, flood), 0);
  const quicker = playRounds(startTrial(s, "ferryTrial"), 16, { 4: "safe" });
  assert.equal(quicker.result, "won");
  assert.equal(settleTrial(s, quicker), 8);
  assert.equal(s.trialBest.ferryTrial, quicker.round);
  assert.equal(settleTrial(s, f), 0);
  assert.equal(s.trialBest.ferryTrial, quicker.round);
  assert.equal(startTrial(s, "ferryTrial"), undefined);
  assert.deepEqual([s.mirror.sand, s.mirror.best, s.lifetimeDao, s.victories], [8, 0, 1100, [1, 1, 1, 0, 0, 0, 0, 0, 0]]);
});

test("烛下还名反噬即失托，保底装备挑灯可胜；只杀妖不能交差", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  earnDao(s, 830);
  s.loadout = { weapon: "pineBlade", charm: "tigerFang" };
  s.kit.stance = "attack";
  const lost = playRounds(startTrial(s, "templeTrial"), 16);
  assert.deepEqual([lost.result, lost.round], ["lost", 2]);
  assert.match(lost.lastThreat, /纸面反噬/);
  const incomplete = startTrial(s, "templeTrial");
  incomplete.hp = 1;
  playRounds(incomplete, 1);
  assert.equal(incomplete.result, "lost");
  assert.match(incomplete.lastThreat, /连中真身只完成/);
  const won = playRounds(startTrial(s, "templeTrial"), 16, { 2: "safe", 5: "safe" });
  assert.deepEqual([won.result, won.round, won.trial.progress], ["won", 9, 3]);
  assert.equal(settleTrial(s, won), 8);
  const restored = decode(JSON.stringify(s), 100);
  assert.equal(settleTrial(restored, won), 0);
  assert.deepEqual(restored.trialBest, { ferryTrial: 0, templeTrial: 9, lampTrial: 0 });
});

test("首卷旧档过桥查案，首胜确定给路引与折篙刀，心斋同时检查道行和首胜", () => {
  const old = newSave(0);
  old.version = 2;
  old.region = 2;
  old.realm = 3;
  old.lifetimeDao = 1036;
  old.dao = 300;
  old.victories = [1, 1, 1];
  old.kills = [12, 100, 140];
  old.clues = [3, 3, 3];
  old.drops = [true, false, false];
  old.ranks = [1, 0, 0];
  old.guide.defeats = [0, 1, 2];
  old.mirror.best = 12;
  old.trialBest.ferryTrial = 9;
  const s = decode(JSON.stringify(old), 100);
  assert.deepEqual(s.clues, [3, 3, 3, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([s.mirror.best, s.trialBest.ferryTrial], [12, 9]);
  s.region = 3;
  for (let i = 0; i < 29; i++) stowThenPatrol(s, () => 1);
  assert.equal(canChallenge(s, 3), false);
  stowThenPatrol(s, () => 1);
  assert.equal(canChallenge(s, 3), true);
  for (let i = 30; i < 54; i++) stowThenPatrol(s, () => 1);
  assert.equal(s.lifetimeDao, 1414);
  assert.equal(s.realm, 3);
  assert.deepEqual(win(s, 3, () => 1), { first: true, drop: true });
  assert.ok(s.newGear.includes("postSeal"));
  assert.equal(study(s, 3), true);
  equipArt(s, 0, true);
  equipArt(s, 3, true);
  assert.deepEqual(weaponArts(s.kit), [3]);
  earnDao(s, 16);
  assert.equal(s.realm, 4);
  equipArt(s, 0, true);
  assert.deepEqual(weaponArts(s.kit), [3, 0]);
  assert.equal(win(s, 3, () => 1).drop, false);
  assert.deepEqual(weaponArts(decode(JSON.stringify(s), 120).kit), [3, 0]);
  const blocked = newSave(0);
  earnDao(blocked, 2230);
  assert.equal(blocked.realm, 3);
  const lateUnlock = newSave(0);
  lateUnlock.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  earnDao(lateUnlock, 1600);
  assert.equal(lateUnlock.realm, 3);
  win(lateUnlock, 3);
  assert.equal(lateUnlock.realm, 4);
});

test("驿桥低配硬接第三篙会落桥，预览与借墩结算一致", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  earnDao(s, 1414);
  s.loadout = { weapon: "pineBlade", charm: "tigerFang" };
  const lost = playRounds(startFight(s, 3, true), 20);
  assert.deepEqual([lost.result, lost.round, lost.footing], ["lost", 9, 3]);
  const fight = playRounds(startFight(s, 3, true), 5);
  while (!fight.waiting) tickFight(fight);
  const preview = previewOpening(fight, "safe");
  assert.equal(preview.footing, 0);
  playRounds(fight, 6, { 6: "safe" });
  assert.deepEqual([fight.life, fight.hp, fight.footing], [preview.life, preview.hp, preview.footing]);
  playRounds(fight, 20, { 9: "safe" });
  assert.deepEqual([fight.result, fight.round], ["won", 12]);
});

test("武学顺序驱动预览和实际追斩，松纹刀与路引按各自条件生效", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 1, 0, 0, 0, 0, 0];
  earnDao(s, 1600);
  s.ranks = [1, 0, 0, 1, 0, 0, 0];
  s.loadout = { weapon: "pineBlade", charm: "postSeal" };
  equipArt(s, 0, true);
  equipArt(s, 3, true);
  const ordered = playRounds(startFight(s, 3, true), 3);
  assert.deepEqual(roundMoves(3, s.kit, 3).names, ["镇山喝", "折篙刀"]);
  assert.match(ordered.log[2], /松纹刀应喝.*截断横篙.*折篙刀伤 14.*追斩，伤 12/);
  s.kit.firstWeapon = 3;
  const reversed = playRounds(startFight(s, 3, true), 3);
  assert.deepEqual(roundMoves(3, s.kit, 3).names, ["折篙刀", "镇山喝"]);
  assert.match(reversed.log[2], /折篙刀伤 14.*截断横篙/);
  assert.doesNotMatch(reversed.log[2], /追斩/);
  assert.equal(reversed.hp - ordered.hp, 12);
  assert.equal(ordered.life, reversed.life);
});

test("纸马院和守更楼沿主线开放，确定性装备可首胜，符火搭配能缩短再战", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 1, 0, 0, 0, 0, 0];
  s.region = 4;
  earnDao(s, 1900);
  s.kills[4] = 24;
  assert.equal(canChallenge(s, 4), false);
  recordPatrolKill(s, () => 1);
  assert.equal(canChallenge(s, 4), true);
  assert.equal(canChallenge(s, 5), false);
  s.ranks[0] = s.ranks[3] = 1;
  equipArt(s, 0, true);
  equipArt(s, 3, true);
  s.loadout = { weapon: "pineBlade", charm: "postSeal" };
  const horse = startFight(s, 4, true);
  while (!horse.waiting) tickFight(horse);
  assert.equal(previewOpening(horse, "pass").cover, true);
  assert.equal(previewOpening(horse, "safe").cover, false);
  assert.ok(previewOpening(horse, "risk").hp < previewOpening(horse, "safe").hp);
  assert.ok(previewOpening(horse, "risk").life < previewOpening(horse, "safe").life);
  assert.equal(playRounds(horse, 20, { 2: "safe", 5: "safe" }).result, "won");
  assert.deepEqual(win(s, 4, () => 1), { first: true, drop: true });
  assert.equal(study(s, 4), true);
  s.region = 5;
  s.kills[5] = 52;
  earnDao(s, 642);
  assert.equal(canChallenge(s, 5), true);
  assert.equal(fightToEnd(s, 5).result, "lost");
  const noFire = playRounds(startFight(s, 5, true), 20, { 2: "safe", 5: "safe" });
  assert.deepEqual([noFire.result, noFire.round], ["won", 18]);
  equipArt(s, 4, true);
  s.loadout.charm = "courierSeal";
  const watch = startFight(s, 5, true);
  while (!watch.waiting) tickFight(watch);
  const intent = previewOpening(watch, "risk");
  assert.equal(intent.ward, 0);
  playRounds(watch, 3, { 2: "risk" });
  assert.deepEqual([watch.ward, watch.life, watch.hp], [intent.ward, intent.life, intent.hp]);
  assert.match(watch.log[1], /符火烧去更印.*火伤 34/);
  playRounds(watch, 20, { 5: "risk" });
  assert.deepEqual([watch.result, watch.round], ["won", 15]);
  assert.deepEqual(win(s, 5, () => 1), { first: true, drop: true });
  assert.equal(study(s, 5), true);
  equipArt(s, 5, true);
  const replay = fightToEnd(s, 5);
  assert.deepEqual([replay.result, replay.round, replay.links["符火引爆"]], ["won", 11, 4]);
  assert.equal(win(s, 5, () => 1).drop, false);
});

test("寄灯符只能在有效窗口引爆，纸面假身上的挑灯诀不会消耗符印", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 1, 1, 1, 0, 0, 0];
  earnDao(s, 2000);
  s.ranks[2] = s.ranks[4] = s.ranks[5] = 1;
  equipArt(s, 2, true);
  equipArt(s, 4, true);
  equipArt(s, 5, true);
  assert.equal(s.kit.reveal, false);
  const f = playRounds(startFight(s, 2, true), 2);
  assert.equal(f.sigilThrough, 2);
  assert.equal(f.links["符火引爆"], undefined);
  assert.equal(playRounds(f, 3).links["符火引爆"], undefined);
  const lit = playRounds(startFight(s, 2, true), 2, { 2: "safe" });
  assert.equal(lit.sigilThrough, 0);
  assert.equal(lit.links["符火引爆"], 1);
});

test("迁移四图旧档保留折篙刀顺序，两套配装在刷新后原样还原", () => {
  const s = newSave(0);
  assert.equal(storePreset(s, 0, "未开放"), false);
  s.version = 3;
  for (const key of ["kills", "clues", "victories", "ranks", "drops"]) s[key] = s[key].slice(0, 4);
  s.guide.defeats = [0, 0, 0, 1];
  s.victories = [1, 1, 1, 1];
  s.ranks = [1, 0, 0, 1];
  s.kit = { stance: "guard", shout: "windup", step: "basic", reveal: false, fold: true, foldFirst: true };
  s.region = 3;
  s.lifetimeDao = 1800;
  s.ownedGear = ["pineBlade", "postSeal"];
  s.loadout = { weapon: "pineBlade", charm: "postSeal" };
  s.mirror.ranks.edge = 1;
  s.mirror.equipped = "edge";
  s.mirror.best = 7;
  s.trialBest.ferryTrial = 12;
  const migrated = decode(JSON.stringify(s), 0);
  assert.deepEqual(weaponArts(migrated.kit), [3, 0]);
  assert.deepEqual(migrated.presets, [null, null]);
  assert.equal(storePreset(migrated, 0, "  截势  "), true);
  migrated.victories[4] = migrated.victories[5] = 1;
  migrated.ranks[4] = migrated.ranks[5] = 1;
  migrated.kit.stance = "attack";
  equipArt(migrated, 4, true);
  equipArt(migrated, 5, true);
  migrated.loadout = { charm: "courierSeal" };
  migrated.ownedGear.push("courierSeal");
  migrated.mirror.equipped = undefined;
  assert.equal(storePreset(migrated, 1, "符火"), true);
  const reloaded = decode(JSON.stringify(migrated), 0);
  assert.equal(applyPreset(reloaded, 0), true);
  assert.equal(reloaded.presets[0].name, "截势");
  assert.deepEqual(weaponArts(reloaded.kit), [3, 0]);
  assert.deepEqual([reloaded.kit.stance, reloaded.loadout.weapon, reloaded.mirror.equipped], ["guard", "pineBlade", "edge"]);
  assert.equal(applyPreset(reloaded, 1), true);
  assert.deepEqual(weaponArts(reloaded.kit), [3, 5]);
  assert.deepEqual([reloaded.kit.stance, reloaded.kit.sigil, reloaded.loadout.charm, reloaded.mirror.equipped], ["attack", true, "courierSeal", undefined]);
  assert.deepEqual([reloaded.mirror.best, reloaded.trialBest.ferryTrial], [7, 12]);
});

test("第二条线索可首战，早打山君也能立刻修习镇山喝", () => {
  const save = newSave(0);
  for (let i = 0; i < 6; i++) stowThenPatrol(save, () => 1);
  assert.equal(clueCount(save), 1);
  assert.equal(startCaseFight(save, 0), undefined);
  stowThenPatrol(save, () => 1);
  assert.equal(clueCount(save), 2);
  const fight = playRounds(startCaseFight(save, 0), 20, { 3: "safe" });
  assert.equal(fight.result, "won");
  assert.equal(fight.preparation, undefined);
  assert.equal(save.dao, 14);
  win(save, 0);
  assert.equal(save.dao, 30);
  assert.equal(study(save, 0), true);
  assert.equal(canChallenge(save, 0), true);
  assert.equal(clueCount(save, 0), 2);
});

test("第三条线索在正篇首次割缆时追加伤害，预览不会消耗准备", () => {
  const save = newSave(0);
  save.victories = [1, 0, 0, 0, 0, 0, 0, 0, 0];
  save.kills[1] = 100;
  earnDao(save, 330);
  const f = startCaseFight(save, 1);
  while (!f.waiting) tickFight(f);
  const prepared = previewOpening(f, "safe");
  assert.equal(f.preparation, "ready");
  assert.equal(prepared.prepared, "水底铃扰阵");
  assert.equal(previewOpening(f, "pass").prepared, undefined);
  assert.equal(previewOpening(f, "risk").prepared, undefined);
  const plain = playRounds(startFight(save, 1, true), 3, { 2: "safe" });
  playRounds(f, 3, { 2: "safe" });
  assert.deepEqual([f.hp, f.life, f.water], [prepared.hp, prepared.life, prepared.water]);
  assert.equal(plain.hp - f.hp, 14);
  assert.equal(f.preparation, "used");
  playRounds(f, 6, { 5: "safe" });
  assert.equal(f.links["水底铃扰阵"], 1);
  save.victories[2] = 1;
  assert.equal(startMirrorFight(save, 1).preparation, undefined);
  assert.equal(startTrial(save, "ferryTrial").preparation, undefined);
});

test("线索指引随阶段出现，已读可持久化，境界达标会补上出战提示", () => {
  const s = newSave(0);
  assert.equal(clueTip(s), undefined);
  s.kills[0] = 3;
  const first = clueTip(s);
  assert.deepEqual([first.step, first.label], [1, "查看首领招路"]);
  s.guide.dismissed.push(first.id);
  assert.equal(clueTip(decode(JSON.stringify(s), 0)), undefined);
  s.kills[0] = 7;
  assert.match(clueTip(s).text, /现在可以挑战吊睛山君/);
  s.kills[0] = 12;
  assert.match(clueTip(s).text, /伏身避啸.*8 点伤害/);
  s.region = 2;
  s.victories = [1, 1, 0, 0, 0, 0, 0, 0, 0];
  s.kills[2] = 84;
  earnDao(s, 800);
  const locked = clueTip(s);
  assert.match(locked.text, /进入听息境后可挑战/);
  s.guide.dismissed.push(locked.id);
  earnDao(s, 30);
  assert.match(clueTip(s).text, /现在可以挑战借面娘娘/);
  s.guide.enabled = false;
  assert.equal(clueTip(s), undefined);
  assert.match(clueTip(s, true).text, /挑灯照面/);
});

test("战前指定时机后无停顿执行，线索准备与前六回合推演使用同一次结算", () => {
  const s = newSave(0);
  s.kills[0] = 12;
  s.kit.stance = "attack";
  const f = startCaseFight(s, 0);
  const orders = [{ round: 3, choice: "safe" }, { round: 6, choice: "risk" }];
  assert.equal(setBattlePlan(f, [{ round: 3, choice: "safe" }, { round: 3, choice: "risk" }]), false);
  assert.equal(setBattlePlan(f, [{ round: 2, choice: "safe" }]), false);
  assert.equal(setBattlePlan(f, orders), true);
  const forecast = forecastFight(f);
  assert.equal(f.round, 0);
  assert.equal(f.focus, 2);
  while (f.round < 6 && f.result === "fighting") {
    tickFight(f);
    assert.equal(f.waiting, false);
  }
  assert.deepEqual([f.life, Math.max(0, f.hp)], [forecast.life, forecast.hp]);
  assert.equal(f.links["伏身避啸"], 1);
  assert.equal(f.links["迎啸进刀"], 1);
  assert.equal(f.links["灯油引虎"], 1);
  assert.equal(setBattlePlan(f, []), false);
});

test("提前回浪试炼与普通河伯战有不同可排轮次，同档不割缆会败阵", () => {
  const save = newSave(0);
  save.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  earnDao(save, 1100);
  const trial = startTrial(save, "ferryTrial");
  assert.deepEqual(planWindows(trial).slice(0, 3), [1, 4, 7]);
  assert.equal(setBattlePlan(trial, [{ round: 1, choice: "risk" }]), false);
  assert.equal(setBattlePlan(trial, [{ round: 1, choice: "safe" }, { round: 4, choice: "safe" }]), true);
  assert.equal(forecastFight(trial, trial.limit).result, "won");
  const baseline = startTrial(save, "ferryTrial");
  assert.equal(setBattlePlan(baseline, []), true);
  assert.equal(forecastFight(baseline, baseline.limit).result, "lost");
});

test("舒筋渡口首战常规装会覆舟，预先割缆与截招能各自解题", () => {
  const save = newSave(0);
  save.victories[0] = 1;
  save.kills[1] = regions[1].thresholds[1];
  save.loadout = { weapon: "reedBlade", armor: "ferryCoat", charm: "tigerFang" };
  earnDao(save, 330);
  const withoutPlan = startCaseFight(save, 1);
  assert.equal(setBattlePlan(withoutPlan, []), true);
  const loss = forecastFight(withoutPlan, withoutPlan.limit);
  assert.equal(loss.result, "lost");
  assert.ok(loss.rounds.at(-1).marks.includes("覆舟"));
  const cutRope = startCaseFight(save, 1);
  assert.equal(setBattlePlan(cutRope, [{ round: 2, choice: "safe" }, { round: 5, choice: "safe" }]), true);
  const won = forecastFight(cutRope, cutRope.limit);
  assert.equal(won.result, "won");

  save.ranks[0] = 1;
  save.loadout.weapon = "pineBlade";
  equipArt(save, 0, true);
  const useWave = startCaseFight(save, 1);
  assert.equal(setBattlePlan(useWave, [{ round: 2, choice: "risk" }, { round: 5, choice: "risk" }]), true);
  const fast = forecastFight(useWave, useWave.limit);
  assert.equal(fast.result, "won");
  assert.ok(fast.rounds.length < won.rounds.length);
});

test("缺道行时优先给已解锁且额度足够的地点，分别识别未开路和额度耗尽", () => {
  const s = newSave(0);
  earnDao(s, 100);
  assert.deepEqual(trainingRoute(s, 8), { region: 0, accessible: true });
  assert.deepEqual(trainingRoute(s, 9), { region: 1, accessible: false });
  s.victories[0] = 1;
  assert.deepEqual(trainingRoute(s, 9), { region: 1, accessible: true });
  assert.deepEqual(trainingRoute(s, 310), { region: 2, accessible: false });
  earnDao(s, 3350);
  assert.deepEqual(trainingRoute(s, 1), { region: 6, accessible: false });
  earnDao(s, 1200);
  assert.deepEqual(trainingRoute(s, 1), { region: 7, accessible: false });
  earnDao(s, 1350);
  assert.deepEqual(trainingRoute(s, 1), { region: 8, accessible: false });
  earnDao(s, 400);
  assert.equal(trainingRoute(s, 1), undefined);
});

test("换装前可查回合词条缺哪一招，并区分寄灯符已经装备但尚无挑灯诀", () => {
  const s = newSave(0);
  assert.match(gearRequirement(s, "pineBlade"), /装备镇山喝/);
  s.ranks[0] = 1;
  equipArt(s, 0, true);
  assert.equal(gearRequirement(s, "pineBlade"), undefined);
  s.victories = [1, 1, 1, 1, 1, 1, 0, 0, 0];
  earnDao(s, 1500);
  s.ranks[4] = s.ranks[5] = 1;
  equipArt(s, 4, true);
  assert.match(gearRequirement(s, "courierSeal"), /可在驿卒战借灯引爆/);
  equipArt(s, 5, true);
  assert.equal(gearRequirement(s, "courierSeal"), undefined);
});

test("旧档强敌再战从零开始，通关只领取一次强化并找回遗漏装备", () => {
  const s = newSave(0);
  assert.equal(startRematch(s, 0), undefined);
  s.victories[0] = 5;
  s.drops[0] = true;
  s.ranks[0] = 1;
  s.ownedGear.push("pineBlade", "tigerFang");
  s.loadout = { weapon: "pineBlade", charm: "tigerFang" };
  earnDao(s, 30);
  equipArt(s, 0, true);
  delete s.rematchRanks;
  const old = decode(JSON.stringify(s), 0);
  assert.equal(old.rematchRanks[0], 0);
  const fight = startRematch(old, 0);
  assert.equal(fight.hp, regions[0].hp + 42);
  assert.equal(fight.preparation, undefined);
  assert.equal(settleRematch(old, fight), undefined);
  playRounds(fight, 20, { 3: "safe", 6: "safe" });
  assert.equal(fight.result, "won");
  assert.deepEqual(settleRematch(old, fight), { rank: 1, drop: false });
  assert.equal(settleRematch(old, fight), undefined);
  assert.deepEqual(old.newGear, ["hillCoat"]);
  assert.equal(old.victories[0], 5);
  const loaded = decode(JSON.stringify(old), 0);
  assert.equal(loaded.rematchRanks[0], 1);
  assert.equal(rematchSpec(loaded, 0).rank, 2);
  assert.equal(startRematch(loaded, 0).preparation, "ready");
  const failed = startRematch(loaded, 0);
  failed.result = "lost";
  assert.equal(settleRematch(loaded, failed), undefined);
  assert.equal(loaded.rematchRanks[0], 1);
  loaded.rematchRanks[0] = 3;
  assert.equal(startRematch(loaded, 0), undefined);
});

test("强化后的松纹刀和牙坠按真实数值生效，交锋锁定开场强化", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 1, 1, 1, 0, 0, 0];
  earnDao(s, 2500);
  s.loadout = { weapon: "pineBlade", armor: "hillCoat", charm: "tigerFang" };
  s.ranks[0] = 1;
  equipArt(s, 0, true);
  s.rematchRanks[0] = 3;
  const f = startFight(s, 3, true);
  const original = startFight({ ...s, rematchRanks: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, 3, true);
  assert.equal(f.maxLife - original.maxLife, 27);
  assert.equal(gearEffect("pineBlade", 3), "基础刀伤 +11");
  assert.match(gearEffect("tigerFang", 3), /\+12$/);
  assert.equal(compareGear(s, "watchBlade").after.damage - compareGear(s, "watchBlade").before.damage, 1);
  s.rematchRanks[0] = 0;
  playRounds(f, 3);
  assert.match(f.log[2], /松纹刀应喝，喝伤 \+18.*山君牙坠，刀伤 \+12/);
});

test("河伯强化关按实际回浪时机结算，首次取胜补悟听潮步", () => {
  const s = newSave(0);
  s.victories = [1, 1, 0, 0, 0, 0, 0, 0, 0];
  earnDao(s, 340);
  s.loadout = { weapon: "pineBlade", armor: "hillCoat", charm: "tideSeal" };
  s.ranks[0] = 1;
  equipArt(s, 0, true);
  const f = startRematch(s, 1);
  assert.equal(f.riverWave, 3);
  playRounds(f, 20, { 2: "risk", 5: "risk" });
  assert.equal(f.result, "won");
  assert.deepEqual(settleRematch(s, f), { rank: 1, drop: true });
  assert.equal(s.drops[1], true);
  assert.deepEqual(s.newGear, ["tideSeal", "ferryCoat", "reedBlade"]);
  const next = startRematch(s, 1);
  assert.equal(next.riverWave, 2);
  while (!next.waiting) tickFight(next);
  assert.equal(previewOpening(next, "safe").water, 0);
  assert.equal(previewOpening(next, "pass").water, 1);
  assert.equal(previewOpening(next, "safe").prepared, "水底铃扰阵");
});

test("河伯再战第三关的回浪追篙可用听潮步化解，也能用守式和割缆撑过去", () => {
  const save = duelFixture(730, 2);
  save.rematchRanks = [1, 2, 0, 0, 0, 0, 0, 0, 0];
  save.clues[1] = 3;
  save.drops[0] = save.drops[1] = true;
  save.ranks[0] = save.ranks[1] = 1;
  save.kit.stance = "attack";
  save.ownedGear = ["reedBlade", "ferryCoat", "hillCoat", "tideSeal"];
  save.loadout = { weapon: "reedBlade", armor: "ferryCoat", charm: "tideSeal" };
  const plan = [[4, "safe"], [10, "safe"]];
  const configured = startRematch(save, 1);
  assert.equal(setBattlePlan(configured, [{ round: 4, choice: "safe" }, { round: 10, choice: "safe" }]), true);
  const wavePreview = forecastFight(configured, 2);
  assert.equal(wavePreview.riverDrenched, true);
  assert.ok(wavePreview.rounds[1].marks.includes("回浪沾衣"));
  const pursuitPreview = forecastFight(configured, 3);
  assert.equal(pursuitPreview.riverDrenched, false);
  assert.ok(pursuitPreview.rounds[2].marks.includes("湿衣追篙"));
  const lost = playRounds(configured, configured.limit);
  assert.equal(lost.result, "lost");
  assert.equal(lost.round, 9);
  assert.match(defeatSummary(lost), /两次湿衣追篙.*落水/);
  assert.doesNotMatch(lost.log[4], /湿了衣衫/);

  equipArt(save, 1, true);
  const swift = automaticDuel(startRematch(save, 1), plan);
  assert.equal(swift.result, "won");
  assert.equal(swift.round, 12);
  assert.ok(swift.links["听潮步避开沾衣"] > 0);
  assert.equal(swift.links["湿衣追篙"], undefined);
  assert.equal(swift.links["渡水蓑回血 +7"], 4);

  equipArt(save, 1, false);
  save.kit.stance = "guard";
  save.loadout.armor = "hillCoat";
  save.rematchRanks[0] = 3;
  readyArts(save, [0], 2);
  const sturdy = automaticDuel(startRematch(save, 1), plan);
  assert.equal(sturdy.result, "won");
  assert.equal(sturdy.round, 16);
  assert.ok(sturdy.links["山行衣护身"] > 0);
  assert.equal(sturdy.links["湿衣追篙"], undefined);

  save.rematchRanks[1] = 1;
  assert.equal(forecastFight(startRematch(save, 1), 2).riverDrenched, false);
});

test("异相已完成且线索实查完毕时，只给本案对应的镜中妖影一次准备", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  s.mirror.best = 12;
  s.kills[1] = 100;
  s.kills[2] = 140;
  assert.equal(startMirrorFight(s, 5).preparation, undefined);
  s.trialBest.ferryTrial = 9;
  const battle = startMirrorFight(s, 5);
  assert.equal(startMirrorFight(s, 12).preparation, undefined);
  while (!battle.waiting) tickFight(battle);
  assert.equal(previewOpening(battle, "safe").prepared, "水底铃扰阵");
  playRounds(battle, 4, { 1: "safe" });
  assert.equal(battle.links["水底铃扰阵"], 1);
  playRounds(battle, 6, { 4: "safe" });
  assert.equal(battle.links["水底铃扰阵"], 1);
  s.kills[1] = 0;
  earnDao(s, 1370);
  assert.equal(startMirrorFight(s, 5).preparation, undefined);
});

test("战前推演照实际规则触发装备和招式，镜战记录用开场配装且满纹后停止发砂", () => {
  const s = newSave(0);
  s.victories = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  s.mirror.ranks = { edge: 8, step: 8 };
  s.mirror.equipped = "edge";
  s.mirror.sand = 41;
  earnDao(s, 1200);
  s.ranks[0] = 1;
  s.loadout = { weapon: "pineBlade" };
  s.ownedGear = ["pineBlade", "reedBlade"];
  equipArt(s, 0, true);
  const f = startMirrorFight(s, 1);
  const before = forecastFight(f);
  assert.equal(f.round, 0);
  assert.ok(before.rounds[2].marks.includes("松纹刀 +12"));
  const identical = playRounds(structuredClone(f), 6);
  assert.deepEqual(before.rounds[5], identical.lastExchange);
  assert.deepEqual([before.life, before.hp], [identical.life, identical.hp]);
  s.loadout.weapon = "reedBlade";
  playRounds(f, 12, { 2: "safe", 5: "safe" });
  assert.equal(f.result, "won");
  assert.deepEqual(settleMirror(s, f, 3600000), { idle: 0, reward: 0 });
  assert.equal(s.mirror.best, 1);
  assert.equal(accrueSand(s, 7200000), 0);
  const loaded = decode(JSON.stringify(s), 7200000);
  assert.equal(loaded.mirror.sand, 41);
  assert.match(loaded.mirror.recent.build, /松纹刀.*镇山喝.*断潮纹/);
  assert.doesNotMatch(loaded.mirror.recent.build, /斩芦刀/);
});

function duelFixture(dao, cleared) {
  const save = newSave(0);
  save.victories = regions.map((_, i) => Number(i < cleared));
  save.kills = regions.map(region => region.thresholds[1]);
  earnDao(save, dao);
  return save;
}

function readyArts(save, arts, rank = 1) {
  for (const art of arts) {
    save.drops[art] = true;
    save.ranks[art] = rank;
    equipArt(save, art, true);
  }
}

function automaticDuel(fight, pairs = []) {
  assert.ok(fight);
  assert.equal(setBattlePlan(fight, pairs.map(([round, choice]) => ({ round, choice }))), true);
  return playRounds(fight, fight.limit);
}

function duelWithTactics(fight) {
  assert.equal(enableCombatTactics(fight), true);
  while (fight.result === "fighting") {
    tickFight(fight);
    assert.equal(fight.waiting, false);
  }
  return fight;
}

test("六案首战可以直接用正式配装交锋，河伯、纸马和驿卒的低进度空装档会败阵", () => {
  const route = [
    [14, undefined, []],
    [204, "tigerFang", [0]],
    [830, "tigerFang", [0]],
    [1284, "tigerFang", [0]],
    [1545, "postSeal", [0, 3]],
    [2315, "courierSeal", [0, 3, 4]],
  ];
  for (const [region, [dao, charm, arts]] of route.entries()) {
    const save = duelFixture(dao, region);
    const blind = duelWithTactics(startCaseFight(save, region));
    assert.equal(blind.result, [1, 4, 5].includes(region) ? "lost" : "won", regions[region].boss);
    save.loadout = charm ? { weapon: "pineBlade", charm } : { weapon: "pineBlade" };
    readyArts(save, arts);
    const fight = duelWithTactics(startCaseFight(save, region));
    assert.equal(fight.result, "won", regions[region].boss);
    if (region === 1) assert.deepEqual([fight.round, fight.links["引浪撞舟"]], [10, 2]);
  }
});

test("照妖镜前十二重可用首卷装备连续打通，攻式的提前回浪和娘娘换相需要换招", () => {
  const save = duelFixture(1284, 3);
  save.rematchRanks = [1, 1, 1, 0, 0, 0, 0, 0, 0];
  save.loadout = { weapon: "pineBlade", armor: "ferryCoat", charm: "tigerFang" };
  readyArts(save, [0]);

  for (let level = 1; level <= 12; level++) {
    if (level === 5) {
      save.kit.stance = "attack";
      save.loadout = { weapon: "reedBlade", armor: "ferryCoat", charm: "tideSeal" };
      const blind = duelWithTactics(startMirrorFight(save, level));
      assert.equal(blind.result, "lost");
      assert.match(defeatSummary(blind), /水位涨满三格/);
      readyArts(save, [1]);
    }
    if (level === 10) {
      save.kit.stance = "guard";
      save.loadout = { weapon: "pineBlade", armor: "ferryCoat", charm: "tigerFang" };
      equipArt(save, 1, false);
    }
    if (level === 12) {
      save.kit.stance = "attack";
      save.loadout.charm = "tideSeal";
      const blind = duelWithTactics(startMirrorFight(save, level));
      assert.equal(blind.result, "lost");
      assert.match(defeatSummary(blind), /纸面反噬/);
      readyArts(save, [2]);
    }
    const fight = duelWithTactics(startMirrorFight(save, level));
    assert.equal(fight.result, "won", `第 ${level} 重`);
    assert.ok(settleMirror(save, fight, 0).reward > 0);
  }
  assert.equal(save.mirror.best, 12);
});

test("随阵自动出招的战前和中途推演与实战一致，已查线索仍由有效截招触发", () => {
  const save = duelFixture(1284, 3);
  save.clues[3] = 3;
  save.loadout.weapon = "pineBlade";
  readyArts(save, [0]);
  const bridge = duelWithTactics(startCaseFight(save, 3));
  assert.equal(bridge.links["借栏绊篙"], 1);
  assert.equal(bridge.focus, 2);

  const river = startMirrorFight(save, 1);
  assert.equal(enableCombatTactics(river), true);
  const start = forecastFight(river, 6);
  assert.equal(start.tacticsUsed, 2);
  assert.equal(river.round, 0);
  assert.equal(river.focus, 2);
  playRounds(river, 2);
  const next = forecastFight(river, 1);
  playRounds(river, 3);
  assert.equal(enableCombatTactics(river), false);
  assert.deepEqual(next.rounds[0], river.lastExchange);
  assert.deepEqual(start.rounds[2], river.lastExchange);
});

test("三关河伯和守更再战需要实际换招，两件异相可以用稳定所得完成", () => {
  const river = duelFixture(730, 2);
  river.rematchRanks = [1, 2, 0, 0, 0, 0, 0, 0, 0];
  river.clues[1] = 3;
  river.kit.stance = "attack";
  river.loadout = { weapon: "reedBlade", armor: "ferryCoat", charm: "tideSeal" };
  assert.equal(duelWithTactics(startRematch(river, 1)).result, "lost");
  readyArts(river, [1]);
  const tide = duelWithTactics(startRematch(river, 1));
  assert.deepEqual([tide.result, tide.round, tide.links["渡水蓑回血 +7"]], ["won", 12, 4]);

  const watch = duelFixture(3400, 6);
  watch.rematchRanks = [1, 1, 0, 0, 0, 1, 0, 0, 0];
  watch.ownedGear = ["pineBlade", "ferryCoat"];
  watch.mirror.sand = 40;
  watch.loadout = { weapon: "pineBlade", armor: "ferryCoat", charm: "courierSeal" };
  assert.equal(reforgeGear(watch, "pineBlade"), true);
  assert.equal(reforgeGear(watch, "ferryCoat"), true);
  assert.equal(duelWithTactics(startRematch(watch, 5)).result, "lost");
  readyArts(watch, [0, 4, 5]);
  const fire = duelWithTactics(startRematch(watch, 5));
  assert.deepEqual([fire.result, fire.round, fire.life], ["won", 12, 57]);

  const trial = duelFixture(830, 3);
  trial.rematchRanks[0] = 1;
  trial.loadout = { weapon: "pineBlade", charm: "tigerFang" };
  const lamps = duelWithTactics(startTrial(trial, "ferryTrial"));
  assert.deepEqual([lamps.result, lamps.trial.progress], ["won", 2]);
  const faces = duelWithTactics(startTrial(trial, "templeTrial"));
  assert.deepEqual([faces.result, faces.trial.progress], ["won", 3]);
});

test("重铸分别检查主线、再战、装备与砂，保留原词条和旧档强化", () => {
  const oldSave = duelFixture(2500, 3);
  delete oldSave.reforges;
  oldSave.ownedGear = ["pineBlade", "ferryCoat"];
  oldSave.loadout = { weapon: "pineBlade", armor: "ferryCoat" };
  oldSave.mirror.best = 5;
  oldSave.mirror.ranks = { edge: 8, step: 8 };
  oldSave.mirror.sand = 17;
  const save = decode(JSON.stringify(oldSave), 0);
  assert.equal(reforgeState(save, "pineBlade"), "story");
  assert.equal(canEarnSand(save), false);
  save.victories[3] = 1;
  save.victories[4] = 1;
  assert.equal(reforgeState(save, "pineBlade"), "rematch");
  save.rematchRanks[0] = save.rematchRanks[1] = 1;
  assert.equal(reforgeGear(save, "pineBlade"), false);
  assert.equal(save.mirror.sand, 17);
  const before = loadoutStats(save);
  const inProgress = startMirrorFight(save, 5);
  assert.equal(canEarnSand(save), true);
  assert.equal(accrueSand(save, 3600000), 3);
  assert.equal(reforgeGear(save, "pineBlade"), true);
  assert.equal(reforgeGear(save, "pineBlade"), false);
  assert.equal(save.mirror.sand, 2);
  assert.equal(loadoutStats(save).damage, before.damage + 3);
  assert.equal(before.life, loadoutStats(save).life);
  assert.deepEqual(inProgress.reforges, {});
  save.mirror.sand = 22;
  assert.equal(reforgeGear(save, "ferryCoat"), true);
  assert.equal(loadoutStats(save).life, before.life + 9);
  assert.equal(canEarnSand(save), false);
  assert.equal(accrueSand(save, 7200000), 0);
  const restored = decode(JSON.stringify(save), 7200000);
  assert.deepEqual(restored.reforges, { pineBlade: true, ferryCoat: true });
  assert.deepEqual(restored.rematchRanks, save.rematchRanks);
  const fight = automaticDuel(startMirrorFight(restored, 5), [[1, "safe"], [4, "safe"]]);
  settleMirror(restored, fight, 7200000);
  assert.match(restored.mirror.recent.build, /松纹刀 \+1 · 已重铸.*渡水蓑 \+1 · 已重铸/);
});

test("同境界下重铸旧装能靠截断或闪避胜出，新装备仍有稳定数值", () => {
  const save = duelFixture(2500, 6);
  save.ownedGear = ["pineBlade", "ferryCoat", "watchBlade", "watchCoat"];
  save.rematchRanks = [2, 1, 0, 0, 0, 0, 0, 0, 0];
  save.mirror.sand = 40;
  save.mirror.best = 10;
  save.loadout = { weapon: "pineBlade", armor: "ferryCoat", charm: "tideSeal" };
  readyArts(save, [0, 1]);
  assert.equal(reforgeGear(save, "pineBlade"), true);
  assert.equal(reforgeGear(save, "ferryCoat"), true);
  const highWave = [[2, "risk"], [5, "risk"]];
  const p = automaticDuel(startMirrorFight(save, 10), highWave);
  assert.ok(p.links["松纹刀 +16"]);
  save.loadout.weapon = "watchBlade";
  const w = automaticDuel(startMirrorFight(save, 10), highWave);
  assert.deepEqual([p.result, p.round, w.result, w.round], ["won", 6, "won", 7]);
  save.loadout.weapon = "pineBlade";
  save.rematchRanks[0] = 1;
  const tide = automaticDuel(startMirrorFight(save, 9), [[1, "safe"], [4, "safe"]]);
  save.loadout.armor = "watchCoat";
  const coat = automaticDuel(startMirrorFight(save, 9), [[1, "safe"], [4, "safe"]]);
  assert.ok(tide.links["渡水蓑回血 +6"]);
  assert.equal(tide.life - coat.life, 2);
});

test("守更再战高阶错过破印会封阵，神通连招和精通刀法都有胜路", () => {
  const save = duelFixture(3400, 6);
  save.rematchRanks = [1, 1, 0, 0, 0, 1, 0, 0, 0];
  save.ownedGear = ["pineBlade", "ferryCoat"];
  save.mirror.sand = 40;
  save.loadout = { weapon: "pineBlade", armor: "ferryCoat", charm: "courierSeal" };
  assert.equal(reforgeGear(save, "pineBlade"), true);
  assert.equal(reforgeGear(save, "ferryCoat"), true);
  const blind = automaticDuel(startRematch(save, 5));
  assert.equal(blind.round, 9);
  assert.equal(blind.result, "lost");
  assert.match(defeatSummary(blind), /三次敲更/);

  readyArts(save, [0, 4, 5]);
  const sigil = automaticDuel(startRematch(save, 5));
  assert.equal(sigil.result, "won");
  assert.ok(sigil.links["符火引爆"] > 0);

  equipArt(save, 4, false);
  save.loadout = { weapon: "courierBlade", armor: "ferryCoat", charm: "postSeal" };
  save.rematchRanks[3] = save.rematchRanks[4] = 3;
  readyArts(save, [0, 3], 2);
  const blade = automaticDuel(startRematch(save, 5), [[2, "safe"], [5, "safe"]]);
  assert.equal(blade.result, "won");
  assert.equal(blade.links["符火引爆"], undefined);
});
