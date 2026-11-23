import assert from "node:assert/strict";
import test from "node:test";
import {
  accrueOffline, accrueSand, answerOpening, canChallenge, clueCount, combatStats, compareGear, cultivation, earnDao, decode, newSave,
  artDue, previewOpening, recordPatrolKill, roundMoves, settleMirror, startFight, startMirrorFight, study, tickFight, tuneEngraving, win,
} from "../src/night-watch/game.ts";
import { mountainFirstReward, regions } from "../src/night-watch/content.ts";
import { equipment } from "../src/night-watch/equipment.ts";
import { nextTip } from "../src/night-watch/guide.ts";

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
  assert.equal(fightToEnd(save, 2).result, "won");
});

test("巡夜依次产出线索和破境道行，击退山君后可以立刻学招，随后靠巡夜逐层升级", () => {
  const save = newSave(100);
  for (let kill = 1; kill <= 12; kill++) {
    stowThenPatrol(save);
    assert.equal(canChallenge(save, 0), kill === 12);
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
  const migrated = decode(JSON.stringify(old), 700);
  assert.deepEqual(migrated.clues, [3, 2, 0]);
  assert.deepEqual(migrated.kills, [10, 8, 0]);
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
  old.kills = [36, 100, 0];
  old.victories = [1, 0, 0];
  old.drops = [true, false, false];
  old.ranks = [1, 0, 0];
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
  assert.deepEqual(loaded.victories, [0, 5, 1]);
  assert.deepEqual(loaded.drops, [false, true, false]);
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
  assert.deepEqual(loaded.kills, [0, 0, 0]);
  assert.deepEqual(loaded.victories, [1, 0, 0]);
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
  old.victories = [1, 1, 0];
  const save = decode(JSON.stringify(old), 10);
  assert.deepEqual(save.ownedGear, ["tigerFang", "tideSeal"]);
  assert.equal(save.autoPatrol, false);
  save.ownedGear.push("pineBlade", "hillCoat");
  save.loadout = { weapon: "pineBlade", armor: "hillCoat", charm: "tigerFang" };
  const loaded = decode(JSON.stringify(save), 10);
  assert.deepEqual(combatStats(0, "guard", loaded.loadout), { damage: 14, life: 117 });
  const f = fightToEnd(loaded, 0);
  assert.equal(f.maxLife, 117);
  assert.match(f.log[2], /短刀伤 17/);
});

test("巡夜各地小妖均在第一刀归零，整场没有反击", () => {
  for (const region of [0, 1, 2]) {
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
  save.ranks = [2, 2, 2];
  save.kit = { stance: "attack", shout: "windup", step: "tide", reveal: true };
  const f = startFight(save, 1, true);
  f.hp = f.maxHp = 99999;
  f.consult = false;
  while (f.result === "fighting" && f.round < 9) tickFight(f);
  assert.deepEqual(f.log.map((line,i) => line.includes("镇山喝") ? i+1 : 0).filter(Boolean), [3,6,9]);
  assert.deepEqual(f.log.map((line,i) => line.includes("听潮步") ? i+1 : 0).filter(Boolean), [2,5,8]);
  assert.deepEqual(f.log.map((line,i) => line.includes("照影") ? i+1 : 0).filter(Boolean), [1,5,9]);
  assert.match(f.log[4], /照影.*听潮步.*短刀伤 49.*避过挥篙/);
  assert.match(f.log[8], /照影.*截断回浪.*短刀/);
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
  assert.match(safe.log[2], /伏身避啸.*虎啸，失血 4/);
  const finisher = duel({ 3: "safe", 6: "risk" });
  assert.deepEqual([finisher.result, finisher.round], ["won", 6]);
  assert.match(finisher.log[5], /迎啸进刀.*短刀伤 27/);
});

test("河伯上一轮的选择影响回浪，与截招是否对齐决定收益", () => {
  const save = newSave(0);
  save.realm = 1;
  save.kit.stance = "attack";
  const duel = choice => playRounds(startFight(save, 1, true), 3, { 2: choice });
  assert.match(duel("safe").log[2], /缆断浪浅.*回浪，失血 12/);
  assert.match(duel("risk").log[2], /浪涌船高.*回浪，失血 46/);
  save.kit.shout = "windup";
  save.ranks[0] = 1;
  assert.match(duel("risk").log[2], /截断回浪.*回浪撞舟，反伤 18.*短刀/);
});

test("挑灯覆盖三轮且不会冒用照影精通；藏锋收刀后仅在下一轮打实", () => {
  const save = newSave(0);
  save.realm = 3;
  save.ranks[2] = 2;
  const duel = choice => playRounds(startFight(save, 2, true), 5, { 2: choice });
  const lamp = duel("safe");
  assert.ok(lamp.log.slice(1, 4).every(line => /灯下见真身.*短刀伤 21/.test(line)));
  assert.match(lamp.log[4], /短刀伤 4/);
  const ambush = duel("risk");
  assert.doesNotMatch(ambush.log[1], /短刀伤/);
  assert.match(ambush.log[2], /候得真身.*短刀伤 49/);
  assert.match(ambush.log[3], /短刀伤 4/);
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
  save.victories = [1, 1, 0];
  save.autoPatrol = true;
  accrueOffline(save, 8 * 3600000);
  assert.deepEqual(cultivation(save.lifetimeDao), { realm: 3, layer: 10, full: true, progress: 60, needed: 60 });
});

test("旧档补计学费和突破支出，已穿装备保留，掉落提醒刷新可续", () => {
  const { lifetimeDao, newGear, ...old } = newSave(0);
  Object.assign(old, { realm: 1, dao: 74, ranks: [1,0,0], ownedGear: ["pineBlade"], loadout: {weapon:"pineBlade"} });
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
  assert.match(duel().log[2], /山行衣减伤 3.*虎啸，失血 4/);
  save.ranks[0] = 1;
  save.kit.shout = "windup";
  const fight = duel();
  assert.match(fight.log[2], /松纹刀应喝，喝伤 \+12.*截断虎啸，伤 17.*山君牙坠.*短刀伤 17/);
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
  assert.match(fight.log[1], /斩芦刀，刀伤 \+8.*短刀伤 27.*避过挥篙.*渡水蓑回复 5/);
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
  assert.match(fight.log[0], /烛影刀.*借面珠.*短刀伤 38.*护灯袍减伤 4.*失血 3/);
  assert.match(fight.log[1], /烛影刀.*短刀伤 33.*护灯袍减伤 4/);
  assert.doesNotMatch(fight.log[2], /烛影刀|护灯袍/);
  save.kit.reveal = false;
  const lamp = playRounds(startFight(save, 2, true), 3, { 2: "safe" });
  assert.doesNotMatch(lamp.log.join(" "), /烛影刀|护灯袍/);
});

test("巡夜最后一刀只给剩余额度，学招、换回旧地图及刷新均不会重开收益", () => {
  for (const [region, cap] of [[0,108], [1,400], [2,1370]]) {
    const save = newSave(0);
    save.region = region;
    save.victories = [1, 1, 0];
    earnDao(save, cap - 1);
    save.autoPatrol = true;
    assert.equal(recordPatrolKill(save, () => 1).reward, 1);
    assert.equal(save.autoPatrol, false);
    assert.equal(clueCount(save), 3);
    assert.equal(canChallenge(save, region), true);
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
  assert.deepEqual(restored.kills, [1, 0, 0]);
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
      assert.deepEqual(forecast, { life: Math.max(0, real.life), hp: Math.max(0, real.hp), round: real.round, result: real.result, water: real.water });
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
  save.victories = [1, 1, 1];
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
  save.victories = [1, 1, 1];
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
  assert.deepEqual(roundMoves(1, save.kit, 5).names, ["听潮步", "照影"]);
  save.kit.shout = "off";
  assert.deepEqual(roundMoves(1, save.kit, 3).names, []);
});

test("刻纹实际出手，断潮留到下一刀，回息只在成功避击且有伤时回复", () => {
  const save = newSave(0);
  save.victories = [1, 1, 1];
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
