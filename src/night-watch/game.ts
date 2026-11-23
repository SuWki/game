import { arts, mountainFirstReward, regions } from "./content.ts";
import { bossEquipment, equipment, knownGear, minionEquipment, slots, traits } from "./equipment.ts";
import type { GearId, GearLoadout, GearSlot } from "./equipment.ts";
import { decisionDue, encounters } from "./tactics.ts";
import type { Response } from "./tactics.ts";

export type Region = 0 | 1 | 2;
export type Strategy = "off" | "ready" | "windup";
export type Kit = {
  stance: "guard" | "attack";
  shout: Strategy;
  step: "basic" | "tide";
  reveal: boolean;
};
type GuideProgress = {
  enabled: boolean;
  dismissed: string[];
  defeats: [number, number, number];
};
export type Save = {
  version: 2;
  region: Region;
  realm: number;
  dao: number;
  lifetimeDao: number;
  newGear: GearId[];
  kills: [number, number, number];
  clues: [number, number, number];
  victories: [number, number, number];
  drops: [boolean, boolean, boolean];
  ranks: [number, number, number];
  guide: GuideProgress;
  ownedGear: GearId[];
  loadout: GearLoadout;
  autoPatrol: boolean;
  kit: Kit;
  time: number;
  report: string;
};

export const saveKey = "night-watch-v1";
export const frame = 100;
export const maxOffline = 8 * 60 * 60 * 1000;
export const maxRounds = 20;
const realmStarts = [0, 130, 430, 830];
const layerCosts = [0, 30, 40, 60];

export function cultivation(total: number) {
  let realm = 0;
  while (realm + 1 < realmStarts.length && total >= realmStarts[realm + 1]) realm++;
  let progress = total - realmStarts[realm];
  for (let layer = 1; layer <= 10; layer++) {
    const needed = realm === 0 ? 2 + 2 * layer : layerCosts[realm];
    const full = realm === 3 && layer === 10;
    if (progress < needed || full) return { realm, layer, progress: full ? needed : progress, needed, full };
    progress -= needed;
  }
  throw new Error("境界道行表不连续");
}

export function earnDao(save: Save, amount: number) {
  save.dao = Math.min(Number.MAX_SAFE_INTEGER, save.dao + amount);
  save.lifetimeDao = Math.min(Number.MAX_SAFE_INTEGER, save.lifetimeDao + amount);
  save.realm = cultivation(save.lifetimeDao).realm;
}

export function combatStats(realm: number, stance: Kit["stance"], loadout: GearLoadout = {}, layer = 1) {
  const weapon = loadout.weapon && equipment[loadout.weapon];
  const armor = loadout.armor && equipment[loadout.armor];
  const base = 12 + realm * 3 + (weapon && "damage" in weapon ? weapon.damage : 0);
  return {
    damage: stance === "attack" ? Math.round(base * 1.25) : base,
    life: 105 + layer - 1 + realm * 24 + (armor && "life" in armor ? armor.life : 0),
  };
}

function newGuide(): GuideProgress {
  return { enabled: true, dismissed: [], defeats: [0, 0, 0] };
}

export function newSave(now: number): Save {
  return {
    version: 2, region: 0, realm: 0, dao: 0, lifetimeDao: 0, newGear: [], kills: [0, 0, 0], clues: [0, 0, 0], victories: [0, 0, 0],
    drops: [false, false, false], ranks: [0, 0, 0], time: now,
    guide: newGuide(),
    ownedGear: [], loadout: {}, autoPatrol: false,
    kit: { stance: "guard", shout: "off", step: "basic", reveal: false },
    report: "师父把旧灯交给阿照。山道上，先听再走。",
  };
}

export function decode(raw: string | null, now: number): Save {
  if (raw === null) return newSave(now);
  const data = JSON.parse(raw) as Omit<Save, "version"> & { version: number };
  const count = (n: unknown, max = Number.MAX_SAFE_INTEGER) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= max;
  const triple = (value: unknown, test: (item: unknown) => boolean) =>
    Array.isArray(value) && value.length === 3 && value.every(test);
  if ((data?.version !== 1 && data?.version !== 2) || !count(data.region, 2) || !count(data.realm, 3) ||
      !count(data.dao) || !count(data.time) || !triple(data.kills, countValue => count(countValue)) ||
      !triple(data.victories, countValue => count(countValue)) ||
      !triple(data.drops, item => typeof item === "boolean") ||
      !triple(data.ranks, item => count(item, 2)) ||
      !["guard", "attack"].includes(data.kit?.stance) ||
      !["off", "ready", "windup"].includes(data.kit?.shout) ||
      !["basic", "tide"].includes(data.kit?.step) || typeof data.kit?.reveal !== "boolean" ||
      typeof data.report !== "string") {
    throw new Error("存档格式无法读取");
  }
  if (data.kit.shout === "ready") data.kit.shout = "windup";
  const guide = data.guide;
  if (typeof guide?.enabled !== "boolean" || !Array.isArray(guide.dismissed) ||
      !guide.dismissed.every(id => typeof id === "string") || !triple(guide.defeats, item => count(item, 2))) {
    data.guide = newGuide();
  }
  data.ownedGear = Array.isArray(data.ownedGear) ? [...new Set(data.ownedGear.filter(knownGear))] : [];
  for (const [region, id] of bossEquipment.entries()) {
    if (data.victories[region] > 0 && !data.ownedGear.includes(id)) data.ownedGear.push(id);
  }
  const storedLoadout = data.loadout;
  data.loadout = {};
  for (const slot of Object.keys(slots) as GearSlot[]) {
    const id = storedLoadout?.[slot];
    if (knownGear(id) && equipment[id].slot === slot && data.ownedGear.includes(id)) data.loadout[slot] = id;
  }
  data.autoPatrol = data.victories[0] > 0 && data.autoPatrol === true;
  data.newGear = Array.isArray(data.newGear) ? [...new Set(data.newGear.filter(id => data.ownedGear.includes(id)))] : [];
  if (data.lifetimeDao === undefined) {
    const previousCosts = [0, 70, 250, 580];
    const spent = data.ranks.reduce((sum, rank) => sum + [0, 60, 460][rank], 0);
    data.lifetimeDao = Math.min(Number.MAX_SAFE_INTEGER, Math.max(realmStarts[data.realm], data.dao + previousCosts[data.realm] + spent));
  }
  if (!count(data.lifetimeDao)) throw new Error("累计道行无法读取");
  data.realm = cultivation(data.lifetimeDao).realm;
  if (data.version === 1) {
    const earned = (region: Region, thresholds: readonly number[]) =>
      data.victories[region] > 0 ? 3 : thresholds.filter(target => data.kills[region] >= target).length;
    return { ...data, version: 2, clues: [earned(0, [2, 5, 10]), earned(1, [3, 8, 15]), earned(2, [3, 8, 15])] };
  }
  if (!triple(data.clues, item => count(item, 3))) throw new Error("线索进度无法读取");
  return { ...data, version: 2 };
}

export function clueCount(save: Save, region = save.region): number {
  return Math.max(save.clues[region], regions[region].thresholds.filter(threshold => save.kills[region] >= threshold).length);
}

export function recordPatrolKill(save: Save, random = Math.random) {
  const region = save.region;
  const id = minionEquipment[region][save.kills[region] % 2];
  save.kills[region]++;
  const reward = regions[region].reward;
  earnDao(save, reward);
  save.clues[region] = clueCount(save, region);
  const firstGear = region === 0 && save.kills[0] === 2;
  const found = (firstGear || random() < 0.25) && !save.ownedGear.includes(id) ? id : undefined;
  if (found) {
    save.ownedGear.push(found);
    save.newGear.unshift(found);
  }
  return { reward, found };
}

export function unlocked(save: Save, region: Region): boolean {
  return region === 0 || save.victories[region - 1] > 0;
}

export function canChallenge(save: Save, region: Region): boolean {
  return unlocked(save, region) && clueCount(save, region) === 3 && save.realm >= [0, 1, 3][region];
}

export function accrueOffline(save: Save, now: number) {
  const elapsed = Math.max(0, now - save.time);
  const credited = Math.min(maxOffline, elapsed);
  const earned = save.autoPatrol ? Math.floor(credited * rate(save) / 60000) : 0;
  earnDao(save, earned);
  save.time = Math.max(save.time, now);
  return { elapsed, credited, earned };
}

export function rate(save: Save): number {
  const region = regions[save.region];
  return 60000 * region.reward / region.patrolInterval;
}

export function win(save: Save, region: Region, random = Math.random) {
  const first = save.victories[region]++ === 0;
  if (first) {
    if (region === 0) earnDao(save, mountainFirstReward);
    const id = bossEquipment[region];
    if (!save.ownedGear.includes(id)) {
      save.ownedGear.push(id);
      save.newGear.unshift(id);
    }
  }
  const drop = !save.drops[region] && (region === 0 || save.victories[region] >= 5 || random() < 0.25);
  if (drop) save.drops[region] = true;
  return { first, drop };
}

export function study(save: Save, art: Region): boolean {
  const rank = save.ranks[art];
  const cost = rank === 0 ? arts[art].cost : 400;
  if (!save.drops[art] || rank >= 2 || save.dao < cost || save.realm < arts[art].realm) return false;
  save.ranks[art]++;
  save.dao -= cost;
  return true;
}

type Move = { name: string; damage: number; heavy?: boolean; interruptible?: boolean; wave?: boolean };
const patterns: Move[][] = [
  [{ name: "扑咬", damage: 9 }, { name: "扫尾", damage: 9 }, { name: "虎啸", damage: 36, heavy: true, interruptible: true }],
  [{ name: "第一道浪", damage: 15, wave: true }, { name: "挥篙", damage: 10 }, { name: "回浪", damage: 34, heavy: true, interruptible: true }],
  [{ name: "纸面", damage: 7 }, { name: "借面", damage: 15 }, { name: "烛偏", damage: 16, heavy: true }],
];

export type Fight = {
  region: Region; boss: boolean; name: string; sprite: string;
  maxHp: number; hp: number; maxLife: number; life: number;
  time: number; round: number; revealedThrough: number;
  kit: Kit; realm: number; ranks: Save["ranks"];
  loadout: GearLoadout;
  cue: "idle" | "slash" | "stagger" | "guard" | "strike";
  consult: boolean; waiting: boolean; focus: number;
  order?: { round: number; choice: Response };
  turningPoint?: string;
  windup: string; event: string; lastThreat: string; log: string[];
  result: "fighting" | "won" | "lost";
};

export function startFight(save: Save, region: Region, boss: boolean, foeIndex = 0): Fight {
  const data = regions[region];
  const actor = boss ? { name: data.boss, sprite: data.sprite } : data.foes[foeIndex % data.foes.length];
  const hp = boss ? data.hp : 1;
  const life = combatStats(save.realm, save.kit.stance, save.loadout, cultivation(save.lifetimeDao).layer).life;
  return {
    ...actor, region, boss, maxHp: hp, hp, maxLife: life, life, time: 0, round: 0,
    kit: { ...save.kit }, realm: save.realm, ranks: [...save.ranks], loadout: { ...save.loadout }, revealedThrough: 0,
    consult: boss && save.victories[region] === 0, waiting: false, focus: 2,
    cue: "idle", windup: "", event: "", lastThreat: "", log: [], result: "fighting",
  };
}

function moveFor(region: Region, round: number) {
  return patterns[region][(round - 1) % patterns[region].length];
}

function artDue(round: number, art: Region) {
  const { first, every } = arts[art];
  return round >= first && (round - first) % every === 0;
}

export function roundPreview(region: Region, kit: Kit, round: number) {
  const slots = [kit.shout !== "off", kit.step === "tide", kit.reveal];
  const names = arts.filter((_, i) => slots[i] && artDue(round, i as Region)).map(art => art.name);
  return `第 ${round} 轮 · ${[...names, "短刀"].join("、")} / ${moveFor(region, round).name}${decisionDue(region, round) ? " · 可应变" : ""}`;
}

export function answerOpening(f: Fight, choice: Response) {
  if (!f.waiting || f.result !== "fighting" || f.focus < 1) return false;
  f.order = { round: f.round + 1, choice };
  if (choice !== "pass") f.focus--;
  f.waiting = false;
  return true;
}

function resolveRound(f: Fight) {
  const round = ++f.round;
  const move = moveFor(f.region, round);
  const actions: string[] = [];
  const order = f.order;
  const elapsed = order ? round - order.round : -1;
  const choice = order?.choice;
  if (order && elapsed === 0) {
    actions.push(order.choice === "pass" ? "正常出招，保留应变次数" : encounters[f.region][order.choice].name);
  }
  const stats = combatStats(f.realm, f.kit.stance, f.loadout);
  const reveal = f.kit.reveal && f.ranks[2] > 0 && artDue(round, 2);
  if (reveal) {
    f.revealedThrough = round + 1;
    actions.push("照影显形两轮");
  }
  const lamp = f.region === 2 && choice === "safe" && elapsed >= 0 && elapsed <= 2;
  if (lamp) actions.push("灯下见真身");
  const exposed = lamp || f.region !== 2 || f.revealedThrough >= round || f.realm >= 3 && round % 3 === 0;
  const hurt = (damage: number) => Math.max(1, Math.round(damage * (exposed ? 1 : 0.2)));
  const tide = f.kit.step === "tide" && f.ranks[1] > 0 && artDue(round, 1);
  if (tide) actions.push("听潮步避击");
  const shout = f.kit.shout !== "off" && f.ranks[0] > 0 && artDue(round, 0);
  const interrupted = shout && move.interruptible;
  if (shout) {
    const extra = interrupted && f.ranks[0] === 2 ? 12 : 0;
    const echo = interrupted && f.loadout.weapon === "pineBlade" ? traits.pineBlade.amount : 0;
    if (echo) actions.push(`松纹刀应喝，喝伤 +${echo}`);
    const damage = hurt(5 + extra + echo);
    f.hp -= damage;
    actions.push(`镇山喝${interrupted ? "截断" + move.name : "出手"}，伤 ${damage}`);
    if (interrupted && f.region === 1 && elapsed === 1 && choice === "risk") {
      f.hp -= 18;
      actions.push("回浪撞舟，反伤 18");
    }
  }
  f.cue = interrupted ? "stagger" : "slash";
  const holding = f.region === 2 && choice === "risk" && elapsed === 0;
  const charge = f.region === 0 && choice === "risk" && elapsed === 0;
  if (f.hp > 0 && !holding) {
    const flank = tide && f.ranks[1] === 2 ? 1.5 : 1;
    const seal = f.revealedThrough >= round && f.ranks[2] === 2 ? 1.25 : 1;
    const charm = f.loadout.charm;
    const bonus = charm === "tigerFang" && round % 3 === 0 ? 3
      : charm === "mirrorPearl" && (round - 1) % 4 === 0 ? 5 : 0;
    let bladeBonus = 0;
    if (tide && f.loadout.weapon === "reedBlade") bladeBonus = traits.reedBlade.amount;
    if (f.revealedThrough >= round && f.loadout.weapon === "templeBlade") bladeBonus = traits.templeBlade.amount;
    if (bladeBonus && f.loadout.weapon) actions.push(`${equipment[f.loadout.weapon].name}，刀伤 +${bladeBonus}`);
    if (bonus && charm) actions.push(`${equipment[charm].name}，刀伤 +${bonus}`);
    const ambush = f.region === 2 && choice === "risk" && elapsed === 1 && exposed;
    if (ambush) actions.push("候得真身，刀伤加 28");
    const damage = hurt((stats.damage + bladeBonus + bonus + (charge ? 12 : ambush ? 28 : 0)) * flank * seal);
    f.hp -= damage;
    actions.push(`短刀伤 ${damage}`);
  }
  if (f.hp > 0 && !interrupted) {
    if (tide || f.realm >= 1 && f.kit.step === "basic" && move.wave && round % 3 === 1) {
      actions.push(`避过${move.name}`);
      if (f.loadout.armor === "ferryCoat" && f.life < f.maxLife) {
        const heal = Math.min(f.maxLife - f.life, traits.ferryCoat.amount);
        f.life += heal;
        actions.push(`渡水蓑回复 ${heal} 气血`);
      }
      f.cue = "guard";
    } else {
      const guard = move.heavy && f.kit.stance === "guard" && !charge;
      let power = move.damage;
      if (f.region === 1 && elapsed === 1 && choice && choice !== "pass") {
        power = choice === "safe" ? 12 : 46;
        actions.push(choice === "safe" ? "缆断浪浅" : "浪涌船高");
      }
      const braced = f.region === 0 && elapsed === 0 && choice === "safe";
      const received = guard ? Math.ceil(power * 0.18) : power;
      const rawDamage = braced ? Math.min(received, 4) : received;
      let damage = rawDamage;
      const reduce = (id: "hillCoat" | "templeCoat" | "tideSeal", amount: number) => {
        const blocked = Math.min(amount, damage - 1);
        if (blocked > 0) actions.push(`${equipment[id].name}减伤 ${blocked}`);
        damage -= blocked;
      };
      if (guard && f.loadout.armor === "hillCoat") reduce("hillCoat", traits.hillCoat.amount);
      if (f.revealedThrough >= round && f.loadout.armor === "templeCoat") reduce("templeCoat", traits.templeCoat.amount);
      if (round % 3 === 2 && f.loadout.charm === "tideSeal") reduce("tideSeal", 4);
      f.life -= damage;
      actions.push(`${guard ? "架住" : ""}${move.name}，失血 ${damage}`);
      f.cue = guard || braced ? "guard" : "strike";
      if (guard && f.life > 0 && f.realm >= 2) {
        f.hp -= hurt(6);
        actions.push(`反击伤 ${hurt(6)}`);
      }
    }
  }
  f.event = `第 ${round} 回合 · ${actions.join(" → ")}。`;
  f.log.push(f.event);
  if (order && order.choice !== "pass" && (elapsed === 0 || f.region !== 0 && elapsed === 1)) {
    f.turningPoint = elapsed === 0 ? f.event : `第 ${order.round} 回合${encounters[f.region][order.choice].name}。 ${f.event}`;
  }
  if (f.hp <= 0) f.result = "won";
  else if (f.life <= 0 || round === maxRounds) {
    f.result = "lost";
    f.lastThreat = f.life <= 0 ? f.event : "二十回合已尽，大妖仍未伏诛。";
  }
}

export function tickFight(f: Fight) {
  if (f.result !== "fighting" || f.waiting) return;
  f.time += frame;
  if (!f.boss) {
    if (f.time === 300) {
      f.hp = 0;
      f.cue = "slash";
      f.event = `阿照一刀斩落${f.name}。`;
    }
    if (f.time === 600) f.result = "won";
    return;
  }
  // 一轮 1.8 秒展示。所有机制按回合号结算。
  const phase = f.time % 1800;
  if (phase === 100) {
    f.cue = "idle";
    f.windup = `第 ${f.round + 1} 回合 · ${moveFor(f.region, f.round + 1).name}`;
    if (f.consult && f.focus > 0 && decisionDue(f.region, f.round + 1)) f.waiting = true;
  }
  if (phase === 1000) {
    f.windup = "";
    resolveRound(f);
  }
}
