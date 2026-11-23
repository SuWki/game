import assert from "node:assert/strict";
import test from "node:test";
import {
  accrueOffline, answerOpening, canChallenge, clueCount, combatStats, cultivation, earnDao, decode, newSave,
  recordPatrolKill, startFight, study, tickFight, win,
} from "../src/night-watch/game.ts";
import { mountainFirstReward, regions } from "../src/night-watch/content.ts";
import { equipment } from "../src/night-watch/equipment.ts";
import { nextTip } from "../src/night-watch/guide.ts";

function fightToEnd(save, region) {
  const fight = startFight(save, region, true);
  fight.consult = false;
  while (fight.result === "fighting") tickFight(fight);
  return fight;
}

test("新档靠守式赢山君，首胜发镇山喝和一份教学道行", () => {
  const save = newSave(100);
  assert.equal(canChallenge(save, 0), false);
  for (let i = 0; i < regions[0].thresholds[2]; i++) recordPatrolKill(save, () => 1);
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
  assert.equal(fightToEnd(save, 1).result, "won");
  save.kit.stance = "attack";
  assert.equal(fightToEnd(save, 1).result, "lost");
  assert.equal(study(save, 0), true);
  save.kit.shout = "windup";
  const river = fightToEnd(save, 1);
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
    recordPatrolKill(save);
    assert.equal(canChallenge(save, 0), kill === 12);
    assert.equal(clueCount(save), [3, 7, 12].filter(target => kill >= target).length);
  }
  win(save, 0);
  assert.equal(study(save, 0), true);
  assert.equal(save.realm, 0);
  assert.equal(save.lifetimeDao, 30);
  assert.equal(save.dao, 0);
  save.region = 1;
  for (let kill = 1; kill <= 100; kill++) recordPatrolKill(save);
  assert.equal(canChallenge(save, 1), true);
  assert.equal(save.realm, 1);
  win(save, 1, () => 0.9);
  save.region = 2;
  for (let kill = 1; kill <= 42; kill++) recordPatrolKill(save);
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
  for (let kill = 9; kill <= 99; kill++) recordPatrolKill(migrated);
  assert.equal(clueCount(migrated, 1), 2);
  recordPatrolKill(migrated);
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
  assert.equal(accrueOffline(save, now).earned, 27000);
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
  assert.equal(recordPatrolKill(save, () => 0.9).found, undefined);
  assert.equal(recordPatrolKill(save, () => 0.9).found, "pineBlade");
  assert.equal(recordPatrolKill(save, () => 0).found, "hillCoat");
  assert.equal(recordPatrolKill(save, () => 0).found, undefined);
  save.region = 1;
  assert.equal(equipment[recordPatrolKill(save, () => 0).found].level, 2);
  save.region = 2;
  assert.equal(equipment[recordPatrolKill(save, () => 0).found].level, 3);
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

test("首战等人读招，留力免费，同一轮不能重复下令；重演直接照谱", () => {
  const save = newSave(0);
  const f = startFight(save, 0, true);
  for (let i = 0; i < 150; i++) tickFight(f);
  assert.deepEqual([f.round, f.waiting, f.life, f.focus], [2, true, 87, 2]);
  assert.equal(answerOpening(f, "pass"), true);
  assert.equal(answerOpening(f, "safe"), false);
  assert.equal(f.focus, 2);
  save.victories[0] = 1;
  assert.equal(startFight(save, 0, true).consult, false);
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
  recordPatrolKill(save, () => 0);
  const restored = decode(JSON.stringify(save), 0);
  assert.deepEqual(restored.newGear, ["hillCoat"]);
  assert.equal(restored.lifetimeDao, 206);
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
