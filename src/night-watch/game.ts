import { arts, mountainFirstReward, regions, trialIds, trialRounds, trials, trialSand } from "./content.ts";
import type { TrialId } from "./content.ts";
import { bossEquipment, equipment, knownGear, minionEquipment, slots, traits, traitText } from "./equipment.ts";
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
  mirror: MirrorProgress;
  trialBest: Record<TrialId, number>;
};

export const saveKey = "night-watch-v1";
export const frame = 100;
export const maxOffline = 8 * 60 * 60 * 1000;
export const maxRounds = 20;
export const riverFloodLimit = 3;
export const mirrorRounds = 12;
export const paperHitLimit = 2;
const paperBacklashDamage = 34;
export const engravings = {
  edge: { name: "断潮纹", trigger: "成功截招后的下一刀", effect: "刀伤" },
  step: { name: "回息纹", trigger: "成功避击时", effect: "回气" },
} as const;
export type Engraving = keyof typeof engravings;
type MirrorProgress = {
  best: number;
  sand: number;
  time: number;
  remainder: number;
  ranks: Record<Engraving, number>;
  equipped?: Engraving;
};
export const maxEngravingRank = 8;
const sandHour = 3600000;

function newMirror(time: number): MirrorProgress {
  return { best: 0, sand: 0, time, remainder: 0, ranks: { edge: 0, step: 0 } };
}

export function mirrorUnlocked(save: Save) {
  return save.victories[2] > 0;
}

export function sandRate(best: number) {
  return best > 0 ? Math.min(12, 2 + Math.floor((best - 1) / 3)) : 0;
}

export function accrueSand(save: Save, now: number) {
  const mirror = save.mirror;
  const elapsed = Math.min(maxOffline, Math.max(0, now - mirror.time));
  const total = elapsed * (mirrorUnlocked(save) ? sandRate(mirror.best) : 0) + mirror.remainder;
  const earned = Math.floor(total / sandHour);
  mirror.sand = Math.min(Number.MAX_SAFE_INTEGER, mirror.sand + earned);
  mirror.remainder = total % sandHour;
  mirror.time = Math.max(now, mirror.time);
  return earned;
}

export function engravingCost(rank: number) { return 6 + 4 * rank; }

export function engravingPower(id: Engraving, rank: number) {
  return rank === 0 ? 0 : id === "edge" ? 2 + 2 * rank : 2 + rank;
}

export function tuneEngraving(save: Save, id: Engraving, action: "train" | "equip") {
  if (!mirrorUnlocked(save)) return false;
  const { ranks } = save.mirror;
  if (action === "equip") {
    if (!ranks[id]) return false;
    save.mirror.equipped = save.mirror.equipped === id ? undefined : id;
    return true;
  }
  const cost = engravingCost(ranks[id]);
  if (ranks[id] >= maxEngravingRank || save.mirror.sand < cost) return false;
  save.mirror.sand -= cost;
  ranks[id]++;
  save.mirror.equipped ??= id;
  return true;
}

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

export function compareGear(save: Save, id: GearId) {
  const { slot } = equipment[id];
  const current = save.loadout[slot];
  const layer = cultivation(save.lifetimeDao).layer;
  const before = combatStats(save.realm, save.kit.stance, save.loadout, layer);
  const after = combatStats(save.realm, save.kit.stance, { ...save.loadout, [slot]: id }, layer);
  const effect = (gear: GearId) => equipment[gear].slot === "charm" ? equipment[gear].effect : traitText(gear);
  const oldEffect = current ? effect(current) : "";
  const newEffect = effect(id);
  return { before, after, added: newEffect !== oldEffect ? newEffect : "", lost: oldEffect !== newEffect ? oldEffect : "" };
}

function newGuide(): GuideProgress {
  return { enabled: true, dismissed: [], defeats: [0, 0, 0] };
}

export function newSave(now: number): Save {
  return {
    version: 2, region: 0, realm: 0, dao: 0, lifetimeDao: 0, newGear: [], kills: [0, 0, 0], clues: [0, 0, 0], victories: [0, 0, 0],
    drops: [false, false, false], ranks: [0, 0, 0], time: now,
    guide: newGuide(), mirror: newMirror(now), trialBest: { ferryTrial: 0, templeTrial: 0 },
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
  const mirror = data.mirror;
  if (!count(mirror?.best) || !count(mirror?.sand) || !count(mirror?.time) || !count(mirror?.remainder, sandHour - 1)
    || !count(mirror?.ranks?.edge, maxEngravingRank) || !count(mirror?.ranks?.step, maxEngravingRank)) {
    data.mirror = newMirror(data.time);
  } else if ((mirror.equipped !== "edge" && mirror.equipped !== "step") || !mirror.ranks[mirror.equipped]) {
    delete mirror.equipped;
  }
  data.realm = cultivation(data.lifetimeDao).realm;
  const best = data.trialBest;
  data.trialBest = { ferryTrial: 0, templeTrial: 0 };
  for (const id of trialIds) {
    if (count(best?.[id], trialRounds)) data.trialBest[id] = best[id];
  }
  if (!patrolRemaining(data)) data.autoPatrol = false;
  if (data.version === 1) {
    const earned = (region: Region, thresholds: readonly number[]) =>
      data.victories[region] > 0 ? 3 : thresholds.filter(target => data.kills[region] >= target).length;
    return { ...data, version: 2, clues: [earned(0, [2, 5, 10]), earned(1, [3, 8, 15]), earned(2, [3, 8, 15])] };
  }
  if (!triple(data.clues, item => count(item, 3))) throw new Error("线索进度无法读取");
  return { ...data, version: 2 };
}

export function patrolRemaining(save: Pick<Save, "lifetimeDao" | "region">, region = save.region) {
  return Math.max(0, regions[region].patrolCap - save.lifetimeDao);
}

function earnPatrolDao(save: Save, amount: number) {
  const earned = Math.min(patrolRemaining(save), amount);
  earnDao(save, earned);
  if (patrolRemaining(save) === 0) save.autoPatrol = false;
  return earned;
}

export function clueCount(save: Save, region = save.region): number {
  if (unlocked(save, region) && !patrolRemaining(save, region)) return 3;
  return Math.max(save.clues[region], regions[region].thresholds.filter(threshold => save.kills[region] >= threshold).length);
}

export function canPatrol(save: Save) {
  return save.newGear.length === 0 && patrolRemaining(save) > 0;
}

export function recordPatrolKill(save: Save, random = Math.random) {
  const region = save.region;
  if (!canPatrol(save)) return { reward: 0, found: undefined };
  const reward = earnPatrolDao(save, regions[region].reward);
  const id = minionEquipment[region][save.kills[region] % 2];
  save.kills[region]++;
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

export const challengeRealms = [0, 1, 3] as const;

export function canChallenge(save: Save, region: Region): boolean {
  return unlocked(save, region) && clueCount(save, region) === 3 && save.realm >= challengeRealms[region];
}

export function accrueOffline(save: Save, now: number) {
  const elapsed = Math.max(0, now - save.time);
  const credited = save.autoPatrol && canPatrol(save) ? Math.min(maxOffline, elapsed, Math.ceil(patrolRemaining(save) * 60000 / rate(save))) : 0;
  const earned = earnPatrolDao(save, Math.floor(credited * rate(save) / 60000));
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
  if (!patrolRemaining(save)) save.autoPatrol = false;
  const recovered = !patrolRemaining(save, region) && minionEquipment[region].find(id => !save.ownedGear.includes(id));
  if (recovered) {
    save.ownedGear.push(recovered);
    save.newGear.unshift(recovered);
    return { first, drop, recovered };
  }
  return { first, drop };
}

export const masteryCost = 400;

export function study(save: Save, art: Region): boolean {
  const rank = save.ranks[art];
  const cost = rank === 0 ? arts[art].cost : masteryCost;
  if (!save.drops[art] || rank >= 2 || save.dao < cost || save.realm < arts[art].realm) return false;
  save.ranks[art]++;
  save.dao -= cost;
  return true;
}

type Move = { name: string; damage: number; heavy?: boolean; interruptible?: boolean; wave?: boolean; backwash?: boolean };
const patterns: Move[][] = [
  [{ name: "扑咬", damage: 9 }, { name: "扫尾", damage: 9 }, { name: "虎啸", damage: 36, heavy: true, interruptible: true }],
  [{ name: "第一道浪", damage: 15, wave: true }, { name: "挥篙", damage: 10 }, { name: "回浪", damage: 34, heavy: true, interruptible: true, backwash: true }],
  [{ name: "纸面", damage: 7 }, { name: "借面", damage: 15 }, { name: "烛偏", damage: 16, heavy: true }],
];

export type Fight = {
  region: Region; boss: boolean; name: string; sprite: string;
  limit: number; mirrorLevel?: number; water: number; paperHits: number; riverWave: 2 | 3;
  trial?: { id: TrialId; progress: number };
  engraving?: { id: Engraving; power: number }; cutRound?: number;
  maxHp: number; hp: number; maxLife: number; life: number;
  time: number; round: number; revealedThrough: number;
  kit: Kit; realm: number; ranks: Save["ranks"];
  loadout: GearLoadout;
  cue: "idle" | "slash" | "stagger" | "guard" | "strike";
  consult: boolean; waiting: boolean; focus: number;
  order?: { round: number; choice: Response };
  turningPoint?: string;
  lastExchange?: { round: number; life: number; hp: number; marks: string[] };
  links: Record<string, number>;
  windup: string; event: string; lastThreat: string; log: string[];
  result: "fighting" | "won" | "lost";
};

export function startFight(save: Save, region: Region, boss: boolean, foeIndex = 0): Fight {
  const data = regions[region];
  const actor = boss ? { name: data.boss, sprite: data.sprite } : data.foes[foeIndex % data.foes.length];
  const hp = boss ? data.hp : 1;
  const life = combatStats(save.realm, save.kit.stance, save.loadout, cultivation(save.lifetimeDao).layer).life;
  const id = save.mirror.equipped;
  const engraving = id && mirrorUnlocked(save) ? { id, power: engravingPower(id, save.mirror.ranks[id]) } : undefined;
  return {
    ...actor, region, boss, limit: maxRounds, riverWave: 3, water: 0, paperHits: 0, engraving, maxHp: hp, hp, maxLife: life, life, time: 0, round: 0,
    kit: { ...save.kit }, realm: save.realm, ranks: [...save.ranks], loadout: { ...save.loadout }, revealedThrough: 0, links: {},
    consult: boss, waiting: false, focus: 2,
    cue: "idle", windup: "", event: "", lastThreat: "", log: [], result: "fighting",
  };
}

export function mirrorWave(level: number): 2 | 3 {
  return Math.floor(level / 5) % 2 ? 2 : 3;
}

export function startTrial(save: Save, id: TrialId) {
  if (!mirrorUnlocked(save) || !Object.hasOwn(trials, id)) return;
  const spec = trials[id];
  const fight = startFight(save, spec.region, true);
  fight.trial = { id, progress: 0 };
  fight.riverWave = spec.wave;
  fight.limit = trialRounds;
  fight.hp = fight.maxHp = spec.hp;
  return fight;
}

export function settleTrial(save: Save, fight: Fight) {
  const trial = fight.trial;
  if (!trial || fight.result !== "won" || !mirrorUnlocked(save) || trial.progress < trials[trial.id].target) return 0;
  const previous = save.trialBest[trial.id];
  save.trialBest[trial.id] = previous ? Math.min(previous, fight.round) : fight.round;
  if (previous) return 0;
  save.mirror.sand = Math.min(Number.MAX_SAFE_INTEGER, save.mirror.sand + trialSand);
  return trialSand;
}

export function mirrorOpponent(level: number) {
  const mask = level >= 12 && Math.floor((level - 12) / 3) % 2 === 0;
  const growth = mask ? level - 12 : level - 1;
  return {
    region: mask ? 2 as const : 1 as const,
    name: mask ? "娘娘妖影" : "河伯妖影",
    riverWave: mirrorWave(level),
    hp: Math.min(Number.MAX_SAFE_INTEGER, mask ? 215 + growth * 10 : 188 + growth * 10),
    damageBonus: Math.floor(growth * 1.5),
  };
}

export function startMirrorFight(save: Save, level: number) {
  if (!mirrorUnlocked(save) || !Number.isSafeInteger(level) || level < 1 || level - 1 > save.mirror.best) return;
  const opponent = mirrorOpponent(level);
  const fight = startFight(save, opponent.region, true);
  fight.name = opponent.name;
  fight.limit = mirrorRounds;
  fight.mirrorLevel = level;
  fight.riverWave = opponent.riverWave;
  fight.maxHp = fight.hp = opponent.hp;
  return fight;
}

export function settleMirror(save: Save, fight: Fight, now: number) {
  const idle = accrueSand(save, now);
  const level = fight.mirrorLevel;
  if (!mirrorUnlocked(save) || fight.result !== "won" || level === undefined || level - 1 !== save.mirror.best) {
    return { idle, reward: 0 };
  }
  save.mirror.best = level;
  const reward = 12 + Math.min(24, (level - 1) * 2);
  save.mirror.sand = Math.min(Number.MAX_SAFE_INTEGER, save.mirror.sand + reward);
  return { idle, reward };
}

function moveFor(region: Region, round: number, riverWave: 2 | 3 = 3) {
  const index = (round - 1) % 3;
  const position = region === 1 && riverWave === 2 && index > 0 ? 3 - index : index;
  return patterns[region][position];
}

function openingDue(region: Region, round: number, riverWave: 2 | 3) {
  return region === 1 ? (round - 1) % 3 === riverWave - 2 : decisionDue(region, round);
}

export function artDue(round: number, art: Region) {
  const { first, every } = arts[art];
  return round >= first && (round - first) % every === 0;
}

export function equippedArts(kit: Kit) {
  return [kit.shout !== "off", kit.step === "tide", kit.reveal] as const;
}

export function roundMoves(region: Region, kit: Kit, round: number, riverWave: 2 | 3 = 3) {
  const equipped = equippedArts(kit);
  return {
    names: arts.filter((_, i) => equipped[i] && artDue(round, i as Region)).map(art => art.name),
    enemy: moveFor(region, round, riverWave).name,
    opening: openingDue(region, round, riverWave),
  };
}

export function answerOpening(f: Fight, choice: Response) {
  if (!f.waiting || f.result !== "fighting" || f.focus < 1) return false;
  f.order = { round: f.round + 1, choice };
  if (choice !== "pass") f.focus--;
  f.waiting = false;
  return true;
}

function resolveRound(f: Fight) {
  const startingLife = f.life, startingHp = f.hp;
  const marks: string[] = [];
  const round = ++f.round;
  const move = moveFor(f.region, round, f.riverWave);
  const actions: string[] = [];
  const order = f.order;
  const elapsed = order ? round - order.round : -1;
  const choice = order?.choice;
  if (order && elapsed === 0) {
    actions.push(order.choice === "pass" ? "依原招出手，留下一次应变机会" : encounters[f.region][order.choice].name);
  }
  const stats = combatStats(f.realm, f.kit.stance, f.loadout);
  const reveal = f.kit.reveal && f.ranks[2] > 0 && artDue(round, 2);
  if (reveal) {
    marks.push("照影显形");
    f.revealedThrough = round + 1;
    actions.push("照影显形两轮");
  }
  const lamp = f.region === 2 && choice === "safe" && elapsed >= 0 && elapsed <= 2;
  if (lamp && elapsed === 0) marks.push("挑灯照面");
  if (lamp) actions.push("灯下见真身");
  const exposed = lamp || f.region !== 2 || f.revealedThrough >= round || f.realm >= 3 && round % 3 === 0;
  const hurt = (damage: number) => Math.max(1, Math.round(damage * (exposed ? 1 : 0.2)));
  const tide = f.kit.step === "tide" && f.ranks[1] > 0 && artDue(round, 1);
  if (tide) marks.push("听潮步起势");
  if (tide) actions.push("听潮步避击");
  const shout = f.kit.shout !== "off" && f.ranks[0] > 0 && artDue(round, 0);
  const interrupted = shout && move.interruptible;
  const cut = move.backwash && elapsed === 1 && choice === "safe";
  const reversed = move.backwash && elapsed === 1 && choice === "risk" && interrupted;
  const trial = f.trial;
  let protectedLamp = cut || reversed;
  if (move.backwash) {
    if (cut || reversed) {
      f.water = 0;
      marks.push(cut ? "割缆断流" : "倒浪断流");
    } else {
      const healed = Math.min(24, f.maxHp - f.hp);
      f.hp += healed;
      f.water++;
      if (healed) actions.push(`船缆汲水，河伯回血 ${healed}`);
      marks.push(`汲水 · 水位 ${f.water}/${riverFloodLimit}`);
    }
  }
  if (shout) {
    marks.push(interrupted ? "镇山喝截" + move.name : "镇山喝出手");
    const extra = interrupted && f.ranks[0] === 2 ? 12 : 0;
    const echo = interrupted && f.loadout.weapon === "pineBlade" ? traits.pineBlade.amount : 0;
    if (echo) marks.push("松纹刀 +" + echo);
    if (echo) actions.push(`松纹刀应喝，喝伤 +${echo}`);
    const damage = hurt(5 + extra + echo);
    f.hp -= damage;
    actions.push(`镇山喝${interrupted ? "截断" + move.name : "出手"}，伤 ${damage}`);
    if (reversed) {
      f.hp -= 18;
      marks.push("回浪撞舟 +18");
      actions.push("回浪撞舟，反伤 18");
    }
  }
  const flood = f.water >= riverFloodLimit;
  f.cue = interrupted ? "stagger" : "slash";
  const holding = f.region === 2 && choice === "risk" && elapsed === 0;
  const charge = f.region === 0 && choice === "risk" && elapsed === 0;
  let struckTrue = false;
  let backlash = false;
  if (f.hp > 0 && !holding) {
    const flank = tide && f.ranks[1] === 2 ? 1.5 : 1;
    const seal = f.revealedThrough >= round && f.ranks[2] === 2 ? 1.25 : 1;
    const charm = f.loadout.charm;
    const bonus = charm === "tigerFang" && round % 3 === 0 ? 3
      : charm === "mirrorPearl" && (round - 1) % 4 === 0 ? 5 : 0;
    let bladeBonus = 0;
    if (tide && f.loadout.weapon === "reedBlade") bladeBonus = traits.reedBlade.amount;
    if (f.revealedThrough >= round && f.loadout.weapon === "templeBlade") bladeBonus = traits.templeBlade.amount;
    if (bladeBonus && f.loadout.weapon) marks.push(equipment[f.loadout.weapon].name + " +" + bladeBonus);
    if (bladeBonus && f.loadout.weapon) actions.push(`${equipment[f.loadout.weapon].name}，刀伤 +${bladeBonus}`);
    if (bonus && charm) marks.push(equipment[charm].name + " +" + bonus);
    if (bonus && charm) actions.push(`${equipment[charm].name}，刀伤 +${bonus}`);
    const ambush = f.region === 2 && choice === "risk" && elapsed === 1 && exposed;
    if (ambush) marks.push("候得真身 +28");
    if (ambush) actions.push("候得真身，刀伤加 28");
    const engraved = f.engraving?.id === "edge" && f.cutRound !== undefined && f.cutRound < round ? f.engraving.power : 0;
    if (engraved) {
      f.cutRound = undefined;
      actions.push(`断潮纹，刀伤 +${engraved}`);
      marks.push(`断潮纹 +${engraved}`);
    }
    const damage = hurt((stats.damage + engraved + bladeBonus + bonus + (charge ? 12 : ambush ? 28 : 0)) * flank * seal);
    f.hp -= damage;
    actions.push(`短刀伤 ${damage}`);
    if (f.region === 2) {
      struckTrue = exposed;
      f.paperHits = exposed ? 0 : f.paperHits + 1;
      if (f.hp > 0 && f.paperHits === paperHitLimit) {
        f.paperHits = 0;
        f.life -= paperBacklashDamage;
        backlash = true;
        marks.push("纸面反噬");
        actions.push(`连斩纸面招来反噬，失血 ${paperBacklashDamage}`);
      }
    }
  }
  if (interrupted && f.engraving?.id === "edge") f.cutRound = round;
  if (trial?.id === "templeTrial" && trial.progress < trials.templeTrial.target) {
    trial.progress = struckTrue ? trial.progress + 1 : 0;
    if (trial.progress === trials.templeTrial.target) actions.push("三个名字都已写下");
  }
  if (f.hp > 0 && flood) {
    f.life = 0;
    f.cue = "strike";
    actions.push("水满覆舟，阿照落水败阵");
    marks.push("覆舟");
  } else if (f.hp > 0 && f.life > 0 && !interrupted) {
    if (tide || f.realm >= 1 && f.kit.step === "basic" && move.wave && round % 3 === 1) {
      if (move.backwash) protectedLamp = true;
      actions.push(`避过${move.name}`);
      if (f.loadout.armor === "ferryCoat" && f.life < f.maxLife) {
        const heal = Math.min(f.maxLife - f.life, traits.ferryCoat.amount);
        f.life += heal;
        if (heal) marks.push("渡水蓑回血 +" + heal);
        actions.push(`渡水蓑回复 ${heal} 气血`);
      }
      if (f.engraving?.id === "step" && f.life < f.maxLife) {
        const heal = Math.min(f.maxLife - f.life, f.engraving.power);
        f.life += heal;
        actions.push(`回息纹回气 ${heal}`);
        marks.push(`回息纹 +${heal}`);
      }
      f.cue = "guard";
    } else {
      const guard = move.heavy && f.kit.stance === "guard" && !charge;
      let power = move.damage;
      if (move.backwash && elapsed === 1 && choice && choice !== "pass") {
        power = choice === "safe" ? 12 : 46;
        actions.push(choice === "safe" ? "缆断浪浅" : "浪涌船高");
      }
      const braced = f.region === 0 && elapsed === 0 && choice === "safe";
      if (f.mirrorLevel) power = Math.min(Number.MAX_SAFE_INTEGER, power + mirrorOpponent(f.mirrorLevel).damageBonus);
      const received = guard ? Math.ceil(power * 0.18) : power;
      const rawDamage = braced ? Math.min(received, 4) : received;
      let damage = rawDamage;
      const reduce = (id: "hillCoat" | "templeCoat" | "tideSeal", amount: number) => {
        const blocked = Math.min(amount, damage - 1);
        if (blocked > 0) actions.push(`${equipment[id].name}减伤 ${blocked}`);
        if (blocked) marks.push(equipment[id].name + "护身");
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
  if (trial?.id === "ferryTrial" && protectedLamp && trial.progress < trials.ferryTrial.target) {
    trial.progress++;
    marks.push("渡灯未熄");
    actions.push("护住渡灯");
  }
  f.lastExchange = { round, life: Math.max(0, f.life) - startingLife, hp: Math.max(0, f.hp) - startingHp, marks };
  for (const mark of marks) f.links[mark] = (f.links[mark] ?? 0) + 1;
  f.event = `第 ${round} 回合 · ${actions.join(" → ")}。`;
  f.log.push(f.event);
  if (order && order.choice !== "pass" && (elapsed === 0 || f.region !== 0 && elapsed === 1)) {
    f.turningPoint = elapsed === 0 ? f.event : `第 ${order.round} 回合${encounters[f.region][order.choice].name}。 ${f.event}`;
  }
  if (trial?.id === "templeTrial" && backlash) {
    f.result = "lost";
    f.lastThreat = "纸面反噬吹熄了烛火。挑灯照出真身，或收刀等烛偏。";
  } else if (trial && f.hp <= 0 && trial.progress < trials[trial.id].target) {
    f.result = "lost";
    f.lastThreat = `大妖已退，${trials[trial.id].counter}只完成 ${trial.progress} / ${trials[trial.id].target}。`;
  } else if (f.hp <= 0) f.result = "won";
  else if (f.life <= 0 || round === f.limit) {
    f.result = "lost";
    f.lastThreat = f.life <= 0 ? f.event : `已满 ${f.limit} 回合，妖影仍未伏诛。`;
  }
}

export function previewOpening(fight: Fight, choice: Response) {
  const trial = structuredClone(fight);
  if (!answerOpening(trial, choice)) throw new Error("此刻没有待决的险招");
  const end = Math.min(trial.limit, trial.round + [1, 2, 3][trial.region]);
  while (trial.round < end && trial.result === "fighting") resolveRound(trial);
  return { life: Math.max(0, trial.life), hp: Math.max(0, trial.hp), round: trial.round, result: trial.result, water: trial.water, paperHits: trial.paperHits, ...(trial.trial && { trialProgress: trial.trial.progress }),
    backlashes: (trial.links["纸面反噬"] ?? 0) - (fight.links["纸面反噬"] ?? 0) };
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
    f.windup = `第 ${f.round + 1} 回合 · ${moveFor(f.region, f.round + 1, f.riverWave).name}`;
    if (f.consult && f.focus > 0 && openingDue(f.region, f.round + 1, f.riverWave)) f.waiting = true;
  }
  if (phase === 1000) {
    f.windup = "";
    resolveRound(f);
  }
}
