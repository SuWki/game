import { arts, bridgeRegion, courierRegion, heartDao, heartRealm, mountainFirstReward, regions, trialIds, trialRounds, trials, trialSand, watchRegion } from "./content.ts";
import type { TrialId } from "./content.ts";
import { bossEquipment, charmPower, equipment, gearDamage, gearEffect, gearLife, gearRank, knownGear, minionEquipment, slots, traitPower, traitText } from "./equipment.ts";
import type { GearId, GearLoadout, GearSlot } from "./equipment.ts";
import { caseClues, decisionDue, encounters } from "./tactics.ts";
import type { Response } from "./tactics.ts";

export type Region = 0 | 1 | 2 | 3 | 4 | 5;
type PerRegion<T> = [T, T, T, T, T, T];
type WeaponArt = 0 | 3 | 5;
export type Strategy = "off" | "ready" | "windup";
export type Kit = {
  stance: "guard" | "attack";
  shout: Strategy;
  step: "basic" | "tide";
  reveal: boolean;
  fold?: boolean;
  foldFirst?: boolean;
  firstWeapon?: WeaponArt;
  sigil?: boolean;
  kindle?: boolean;
};
export type PresetSlot = 0 | 1;
type Preset = { name: string; kit: Kit; loadout: GearLoadout; engraving?: Engraving };
type GuideProgress = {
  enabled: boolean;
  dismissed: string[];
  defeats: PerRegion<number>;
};
export type Save = {
  version: 4;
  region: Region;
  realm: number;
  dao: number;
  lifetimeDao: number;
  newGear: GearId[];
  kills: PerRegion<number>;
  clues: PerRegion<number>;
  victories: PerRegion<number>;
  drops: PerRegion<boolean>;
  ranks: PerRegion<number>;
  guide: GuideProgress;
  ownedGear: GearId[];
  loadout: GearLoadout;
  autoPatrol: boolean;
  kit: Kit;
  time: number;
  report: string;
  mirror: MirrorProgress;
  trialBest: Record<TrialId, number>;
  presets: [Preset | null, Preset | null];
  rematchRanks: PerRegion<number>;
};

export const saveKey = "night-watch-v1";
export const frame = 100;
export const maxOffline = 8 * 60 * 60 * 1000;
export const maxRounds = 20;
export const riverFloodLimit = 3;
export const mirrorRounds = 12;
export const paperHitLimit = 2;
export const footingLimit = 3;
export const watchWard = 58;
export const maxRematchRank = 3;
const rematchHealth = [0, 42, 92, 155];
const rematchAttack = [0, 4, 9, 15];
const paperBacklashDamage = 34;
export const engravings = {
  edge: { name: "断潮纹", trigger: "成功截断后的下一刀", effect: "刀伤" },
  step: { name: "回息纹", trigger: "成功闪避时", effect: "回气" },
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

const realmStarts = [0, 130, 430, 830, heartDao];
const layerCosts = [0, 30, 40, 60, 80];

export function cultivation(total: number, heartOpened = false) {
  const lastRealm = heartOpened ? heartRealm : heartRealm - 1;
  let realm = 0;
  while (realm < lastRealm && total >= realmStarts[realm + 1]) realm++;
  let progress = total - realmStarts[realm];
  for (let layer = 1; layer <= 10; layer++) {
    const needed = realm === 0 ? 2 + 2 * layer : layerCosts[realm];
    const full = realm === lastRealm && layer === 10;
    if (progress < needed || full) return { realm, layer, progress: full ? needed : progress, needed, full };
    progress -= needed;
  }
  throw new Error("境界道行表不连续");
}

export function cultivationFor(save: Pick<Save, "lifetimeDao" | "victories">) {
  return cultivation(save.lifetimeDao, !!save.victories[bridgeRegion]);
}

export function earnDao(save: Save, amount: number) {
  save.dao = Math.min(Number.MAX_SAFE_INTEGER, save.dao + amount);
  save.lifetimeDao = Math.min(Number.MAX_SAFE_INTEGER, save.lifetimeDao + amount);
  save.realm = cultivationFor(save).realm;
}

export function combatStats(realm: number, stance: Kit["stance"], loadout: GearLoadout = {}, layer = 1, upgrades: readonly number[] = []) {
  const { weapon, armor } = loadout;
  const base = 12 + realm * 3 + (weapon ? gearDamage(weapon, gearRank(weapon, upgrades)) : 0);
  return {
    damage: stance === "attack" ? Math.round(base * 1.25) : base,
    life: 105 + layer - 1 + realm * 24 + (armor ? gearLife(armor, gearRank(armor, upgrades)) : 0),
  };
}

export function compareGear(save: Save, id: GearId) {
  const { slot } = equipment[id];
  const current = save.loadout[slot];
  const layer = cultivationFor(save).layer;
  const before = combatStats(save.realm, save.kit.stance, save.loadout, layer, save.rematchRanks);
  const after = combatStats(save.realm, save.kit.stance, { ...save.loadout, [slot]: id }, layer, save.rematchRanks);
  const effect = (gear: GearId) => {
    const rank = gearRank(gear, save.rematchRanks);
    return equipment[gear].slot === "charm" ? gearEffect(gear, rank) : traitText(gear, rank);
  };
  const oldEffect = current ? effect(current) : "";
  const newEffect = effect(id);
  return { before, after, added: newEffect !== oldEffect ? newEffect : "", lost: oldEffect !== newEffect ? oldEffect : "" };
}

export function gearRequirement(save: Save, id: GearId) {
  const active = equippedArts(save.kit);
  const has = (art: Region) => active[art] && save.ranks[art] > 0;
  if (id === "pineBlade" && !has(0)) return "装备镇山喝，截断敌招时才加喝伤。";
  if (id === "reedBlade" && !has(1)) return "装备听潮步，出招时才加刀伤。";
  if (id === "hillCoat" && save.kit.stance !== "guard") return "切到守式，架住重击时才减伤。";
  if (id === "ferryCoat" && !has(1)) return save.realm >= 1
    ? "退步可避河伯的第一道浪。装备听潮步可在更多交锋里触发回血。"
    : "进入舒筋后可用退步，成功闪避才会回血。";
  if ((id === "templeBlade" || id === "templeCoat") && !has(2)) return "装备照影，显形期间才触发。";
  if (id === "postSeal" && !has(3)) return "装备折篙刀，才增加首斩伤害。";
  if (id === "courierSeal" && !has(4)) return "装备寄灯符，引爆符印时才加火伤。";
  if (id === "courierSeal" && !has(5)) return "可在驿卒战借灯引爆，其他交锋可配挑灯诀引爆。";
}

function newGuide(): GuideProgress {
  return { enabled: true, dismissed: [], defeats: [0, 0, 0, 0, 0, 0] };
}

export function newSave(now: number): Save {
  return {
    version: 4, region: 0, realm: 0, dao: 0, lifetimeDao: 0, newGear: [], kills: [0, 0, 0, 0, 0, 0], clues: [0, 0, 0, 0, 0, 0], victories: [0, 0, 0, 0, 0, 0],
    drops: [false, false, false, false, false, false], ranks: [0, 0, 0, 0, 0, 0], time: now,
    guide: newGuide(), mirror: newMirror(now), trialBest: { ferryTrial: 0, templeTrial: 0 }, presets: [null, null],
    rematchRanks: [0, 0, 0, 0, 0, 0],
    ownedGear: [], loadout: {}, autoPatrol: false,
    kit: { stance: "guard", shout: "off", step: "basic", reveal: false },
    report: "师父把旧灯交给阿照。山道上，先听再走。",
  };
}

function cleanLoadout(stored: GearLoadout, owned: GearId[]): GearLoadout {
  const loadout: GearLoadout = {};
  for (const slot of Object.keys(slots) as GearSlot[]) {
    const id = stored?.[slot];
    if (knownGear(id) && equipment[id].slot === slot && owned.includes(id)) loadout[slot] = id;
  }
  return loadout;
}

function cleanKit(kit: Kit, save: Save): Kit {
  const clean: Kit = {
    stance: kit?.stance === "attack" ? "attack" : "guard",
    shout: "off", step: "basic", reveal: false,
  };
  const draft = { ...save, kit: clean };
  for (const art of weaponArts(kit ?? clean).filter(id => save.ranks[id] && save.realm >= arts[id].realm).slice(0, weaponCapacity(save.realm))) {
    equipArt(draft, art, true);
  }
  if (kit?.step === "tide") equipArt(draft, 1, true);
  if (kit?.sigil) equipArt(draft, 4, true);
  else if (kit?.reveal) equipArt(draft, 2, true);
  return clean;
}

function presetName(value: unknown) {
  return typeof value === "string" ? Array.from(value.trim()).slice(0, 16).join("") : "";
}

function cleanPreset(preset: Preset | null, save: Save): Preset | null {
  if (!preset?.kit || !presetName(preset.name)) return null;
  const engraving = preset.engraving;
  return {
    name: presetName(preset.name), kit: cleanKit(preset.kit, save),
    loadout: cleanLoadout(preset.loadout, save.ownedGear),
    engraving: (engraving === "edge" || engraving === "step") && save.mirror.ranks[engraving] > 0 ? engraving : undefined,
  };
}

export function storePreset(save: Save, slot: PresetSlot, name: string) {
  const label = presetName(name);
  if (save.realm < heartRealm || !label) return false;
  save.presets[slot] = {
    name: label, kit: { ...save.kit }, loadout: { ...save.loadout }, engraving: save.mirror.equipped,
  };
  return true;
}

export function applyPreset(save: Save, slot: PresetSlot) {
  const preset = cleanPreset(save.presets[slot], save);
  if (save.realm < heartRealm || !preset) return false;
  save.kit = preset.kit;
  save.loadout = preset.loadout;
  save.mirror.equipped = preset.engraving;
  return true;
}

export function decode(raw: string | null, now: number): Save {
  if (raw === null) return newSave(now);
  const data = JSON.parse(raw) as Omit<Save, "version"> & { version: number };
  const count = (n: unknown, max = Number.MAX_SAFE_INTEGER) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= max;
  const size = [0, 3, 3, 4, regions.length][data?.version];
  const entries = (value: unknown, test: (item: unknown) => boolean) =>
    Array.isArray(value) && value.length === size && value.every(test);
  if (!size || !count(data.region, size - 1) || !count(data.realm, size === 3 ? 3 : heartRealm) ||
      !count(data.dao) || !count(data.time) || !entries(data.kills, countValue => count(countValue)) ||
      !entries(data.victories, countValue => count(countValue)) ||
      !entries(data.drops, item => typeof item === "boolean") ||
      !entries(data.ranks, item => count(item, 2)) ||
      !["guard", "attack"].includes(data.kit?.stance) ||
      !["off", "ready", "windup"].includes(data.kit?.shout) ||
      !["basic", "tide"].includes(data.kit?.step) || typeof data.kit?.reveal !== "boolean" ||
      typeof data.report !== "string") {
    throw new Error("存档格式无法读取");
  }
  const guide = data.guide;
  if (typeof guide?.enabled !== "boolean" || !Array.isArray(guide.dismissed) ||
      !guide.dismissed.every(id => typeof id === "string") || !entries(guide.defeats, item => count(item, 2))) {
    data.guide = newGuide();
  }
  if (data.version === 1) {
    const earned = (region: Region, thresholds: readonly number[]) =>
      data.victories[region] > 0 ? 3 : thresholds.filter(target => data.kills[region] >= target).length;
    data.clues = [earned(0, [2, 5, 10]), earned(1, [3, 8, 15]), earned(2, [3, 8, 15]), 0, 0, 0];
  } else if (!entries(data.clues, item => count(item, 3))) {
    throw new Error("线索进度无法读取");
  }
  for (let i = size; i < regions.length; i++) {
    data.kills[i] = data.victories[i] = data.ranks[i] = data.clues[i] = data.guide.defeats[i] = 0;
    data.drops[i] = false;
  }
  data.ownedGear = Array.isArray(data.ownedGear) ? [...new Set(data.ownedGear.filter(knownGear))] : [];
  for (const [region, id] of bossEquipment.entries()) {
    if (data.victories[region] > 0 && !data.ownedGear.includes(id)) data.ownedGear.push(id);
  }
  data.loadout = cleanLoadout(data.loadout, data.ownedGear);
  data.autoPatrol = data.victories[0] > 0 && data.autoPatrol === true;
  data.newGear = Array.isArray(data.newGear) ? [...new Set(data.newGear.filter(id => data.ownedGear.includes(id)))] : [];
  if (data.lifetimeDao === undefined) {
    const previousCosts = [0, 70, 250, 580, 580];
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
  data.realm = cultivationFor(data).realm;
  const save: Save = { ...data, version: 4 };
  const progress = data.rematchRanks;
  save.rematchRanks = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < regions.length; i++) {
    if (save.victories[i] && count(progress?.[i], maxRematchRank)) save.rematchRanks[i] = progress[i];
  }
  save.kit = cleanKit(data.kit, save);
  save.presets = [cleanPreset(data.presets?.[0], save), cleanPreset(data.presets?.[1], save)];
  const best = data.trialBest;
  save.trialBest = { ferryTrial: 0, templeTrial: 0 };
  for (const id of trialIds) {
    if (count(best?.[id], trialRounds)) save.trialBest[id] = best[id];
  }
  if (!patrolRemaining(save)) save.autoPatrol = false;
  return save;
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

export function trainingRoute(save: Save, needed: number) {
  const current = save.region;
  if (patrolRemaining(save, current) >= needed) return { region: current, accessible: true };
  const choices = regions.map((_, i) => i as Region).filter(id => patrolRemaining(save, id) >= needed);
  const open = choices.find(id => unlocked(save, id));
  if (open !== undefined) return { region: open, accessible: true };
  if (choices.length) return { region: choices[0], accessible: false };
}

export const challengeRealms = [0, 1, 3, 3, heartRealm, heartRealm] as const;

export const challengeClues = 2;
export function canChallenge(save: Save, region: Region): boolean {
  return unlocked(save, region) && (save.victories[region] > 0 || clueCount(save, region) >= challengeClues) &&
    save.realm >= challengeRealms[region];
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
  if (region === bridgeRegion && first) save.realm = cultivationFor(save).realm;
  if (first) {
    if (region === 0) earnDao(save, Math.max(mountainFirstReward, arts[0].cost - save.dao));
    const id = bossEquipment[region];
    if (!save.ownedGear.includes(id)) {
      save.ownedGear.push(id);
      save.newGear.unshift(id);
    }
  }
  const drop = !save.drops[region] && (region === 0 || region >= bridgeRegion || save.victories[region] >= 5 || random() < 0.25);
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
  [{ name: "点篙", damage: 11 }, { name: "击栏", damage: 14 }, { name: "横篙", damage: 48, heavy: true, interruptible: true }],
  [{ name: "举灯", damage: 9 }, { name: "冲灯", damage: 36, heavy: true }, { name: "回蹄", damage: 14 }],
  [{ name: "立更印", damage: 12 }, { name: "提槌", damage: 13 }, { name: "敲更", damage: 29, heavy: true }],
];

export type Fight = {
  region: Region; boss: boolean; name: string; sprite: string;
  limit: number; mirrorLevel?: number; water: number; paperHits: number; footing: number; riverWave: 2 | 3;
  trial?: { id: TrialId; progress: number };
  rematchRank?: number;
  engraving?: { id: Engraving; power: number }; cutRound?: number;
  maxHp: number; hp: number; maxLife: number; life: number;
  time: number; round: number; revealedThrough: number;
  sigilThrough: number; ward: number;
  preparation?: "ready" | "used";
  kit: Kit; realm: number; ranks: Save["ranks"];
  loadout: GearLoadout;
  gearUpgrades: Save["rematchRanks"];
  cue: "idle" | "slash" | "stagger" | "guard" | "strike";
  consult: boolean; waiting: boolean; focus: number;
  order?: { round: number; choice: Response };
  lastExchange?: { round: number; life: number; hp: number; marks: string[] };
  links: Record<string, number>;
  windup: string; event: string; lastThreat: string; log: string[];
  result: "fighting" | "won" | "lost";
};

export function startFight(save: Save, region: Region, boss: boolean, foeIndex = 0): Fight {
  const data = regions[region];
  const actor = boss ? { name: data.boss, sprite: data.sprite } : data.foes[foeIndex % data.foes.length];
  const hp = boss ? data.hp : 1;
  const life = combatStats(save.realm, save.kit.stance, save.loadout, cultivationFor(save).layer, save.rematchRanks).life;
  const id = save.mirror.equipped;
  const engraving = id && mirrorUnlocked(save) ? { id, power: engravingPower(id, save.mirror.ranks[id]) } : undefined;
  return {
    ...actor, region, boss, limit: maxRounds, riverWave: 3, water: 0, paperHits: 0, footing: 0, engraving, maxHp: hp, hp, maxLife: life, life, time: 0, round: 0,
    kit: { ...save.kit }, realm: save.realm, ranks: [...save.ranks], loadout: { ...save.loadout }, gearUpgrades: [...save.rematchRanks],
    revealedThrough: 0, sigilThrough: 0, ward: 0, links: {},
    consult: boss, waiting: false, focus: 2,
    cue: "idle", windup: "", event: "", lastThreat: "", log: [], result: "fighting",
  };
}

export function startCaseFight(save: Save, region: Region) {
  if (!canChallenge(save, region)) return;
  const fight = startFight(save, region, true);
  if (clueCount(save, region) === 3) fight.preparation = "ready";
  return fight;
}

export function rematchSpec(save: Save, region: Region) {
  const rank = save.rematchRanks[region] + 1;
  if (!save.victories[region] || rank > maxRematchRank) return;
  const riverWave = region === 1 && rank >= 2 ? 2 : 3;
  const detail = [
    `虎啸基础伤害额外 +${8 * rank}。守式能减伤，镇山喝能截断。`,
    `回浪在第 ${riverWave}、${riverWave + 3}、${riverWave + 6}… 回合。每次汲水最多回 ${24 + 8 * rank} 气血，割缆可清水位。`,
    `连斩纸面会反噬 ${paperBacklashDamage + 8 * rank} 点。挑灯或照影能找到真身。`,
    `横篙基础伤害额外 +${8 * rank}。第三次中招仍会落桥。`,
    `带着马灯撞中时，灼伤提高到 ${18 + 8 * rank} 点。冲灯前可压灯。`,
    `更印提高至 ${wardStrength(rank)} 点。可揭去更印，或用符火烧掉。`,
  ][region];
  return { rank, hp: regions[region].hp + rematchHealth[rank], attack: rematchAttack[rank], detail, riverWave } as const;
}

export function startRematch(save: Save, region: Region) {
  const spec = rematchSpec(save, region);
  if (!spec) return;
  const fight = startFight(save, region, true);
  fight.rematchRank = spec.rank;
  fight.hp = fight.maxHp = spec.hp;
  fight.riverWave = spec.riverWave;
  return fight;
}

export function settleRematch(save: Save, fight: Fight) {
  const { rematchRank: rank, region } = fight;
  if (!rank || fight.result !== "won" || rematchSpec(save, region)?.rank !== rank) return;
  save.rematchRanks[region] = rank;
  const drop = !save.drops[region];
  if (drop) save.drops[region] = true;
  for (const id of [bossEquipment[region], ...minionEquipment[region]]) {
    if (save.ownedGear.includes(id)) continue;
    save.ownedGear.push(id);
    save.newGear.push(id);
  }
  return { rank, drop };
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
  return [kit.shout === "windup" || kit.shout === "ready", kit.step === "tide", !!kit.reveal, !!kit.fold, !!kit.sigil, !!kit.kindle] as const;
}

export function weaponArts(kit: Kit): WeaponArt[] {
  const equipped = equippedArts(kit);
  const first = kit.firstWeapon ?? (kit.foldFirst ? 3 : 0);
  return ([0, 3, 5] as WeaponArt[]).filter(id => equipped[id]).sort((a, b) => Number(b === first) - Number(a === first));
}

function setWeapon(kit: Kit, art: WeaponArt, equip: boolean) {
  if (art === 0) kit.shout = equip ? "windup" : "off";
  else if (art === 3) kit.fold = equip;
  else kit.kindle = equip;
}

function weaponCapacity(realm: number) {
  return realm >= heartRealm ? 2 : 1;
}

export function replacedArt(save: Save, art: Region) {
  if (art === 2 && save.kit.sigil) return 4;
  if (art === 4 && save.kit.reveal) return 2;
  if (art === 0 || art === 3 || art === 5) {
    const weapons = weaponArts(save.kit);
    if (!weapons.includes(art) && weapons.length >= weaponCapacity(save.realm)) return weapons[weapons.length - 1];
  }
}

export function equipArt(save: Save, art: Region, equip: boolean) {
  if (!save.ranks[art] || save.realm < arts[art].realm) return;
  const kit = save.kit;
  if (art === 1) kit.step = equip ? "tide" : "basic";
  else if (art === 2) {
    kit.reveal = equip;
    if (equip) kit.sigil = false;
  } else if (art === 4) {
    kit.sigil = equip;
    if (equip) kit.reveal = false;
  } else {
    const first = weaponArts(kit)[0];
    const replaced = equip ? replacedArt(save, art) : undefined;
    if (replaced === 0 || replaced === 3 || replaced === 5) setWeapon(kit, replaced, false);
    setWeapon(kit, art, equip);
    kit.firstWeapon = first !== undefined && equippedArts(kit)[first] ? first : weaponArts(kit)[0];
    delete kit.foldFirst;
  }
}

export function roundMoves(region: Region, kit: Kit, round: number, riverWave: 2 | 3 = 3) {
  const equipped = equippedArts(kit);
  return {
    names: ([2, 4, 1, ...weaponArts(kit)] as Region[]).filter(id => equipped[id] && artDue(round, id)).map(id => arts[id].name),
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

export function horseCovered(round: number, choice?: Response) {
  return round % 3 === 1 || round % 3 === 2 && (!choice || choice === "pass");
}

export function wardStrength(rank = 0) {
  return watchWard + 12 * rank;
}

function resolveRound(f: Fight) {
  const startingLife = f.life, startingHp = f.hp;
  const marks: string[] = [];
  const round = ++f.round;
  const move = moveFor(f.region, round, f.riverWave);
  const actions: string[] = [];
  const rank = f.rematchRank ?? 0;
  const upgrade = (id: GearId) => gearRank(id, f.gearUpgrades);
  const order = f.order;
  const elapsed = order ? round - order.round : -1;
  const choice = order?.choice;
  if (order && elapsed === 0) {
    actions.push(order.choice === "pass" ? "依原招出手，留下一次应变" : encounters[f.region][order.choice].name);
  }
  const horseCharge = f.region === courierRegion && !!move.heavy;
  const horseChoice = horseCharge && elapsed === 0 ? choice : undefined;
  const cover = f.region === courierRegion && horseCovered(round, horseChoice);
  const watching = f.region === watchRegion;
  if (watching && round % 3 === 1) {
    f.ward = wardStrength(rank);
    actions.push(`更印凝成，吸收 ${f.ward} 伤害`);
  }
  const deal = (damage: number) => {
    const blocked = Math.min(f.ward, damage);
    f.ward -= blocked;
    f.hp -= damage - blocked;
    if (blocked) actions.push(`更印吸收 ${blocked}`);
    return damage - blocked;
  };
  const ignite = () => {
    f.sigilThrough = 0;
    if (f.ward) {
      f.ward = 0;
      actions.push("符火烧去更印");
    }
    const damage = (f.ranks[4] === 2 ? 38 : 26) + (f.loadout.charm === "courierSeal" ? charmPower("courierSeal", upgrade("courierSeal")) : 0);
    f.hp -= damage;
    marks.push("符火引爆");
    actions.push(`符火引爆，火伤 ${damage}`);
  };
  if (f.kit.sigil && f.ranks[4] > 0 && artDue(round, 4)) {
    f.sigilThrough = round + 1;
    marks.push("寄灯符已贴");
    actions.push("寄灯符贴印两回合");
  }
  if (watching && elapsed === 0) {
    if (choice === "safe") f.ward = 0;
    if (choice === "risk" && f.sigilThrough >= round) ignite();
  }
  const stats = combatStats(f.realm, f.kit.stance, f.loadout, 1, f.gearUpgrades);
  const reveal = f.kit.reveal && f.ranks[2] > 0 && artDue(round, 2);
  if (reveal) {
    marks.push("照影显形");
    f.revealedThrough = round + 1;
    actions.push("照影显形两回合");
  }
  const lamp = f.region === 2 && choice === "safe" && elapsed >= 0 && elapsed <= 2;
  if (lamp && elapsed === 0) marks.push("挑灯照面");
  if (lamp) actions.push("灯下见真身");
  const exposed = lamp || f.region !== 2 || f.revealedThrough >= round || f.realm >= 3 && round % 3 === 0;
  const hurt = (damage: number) => Math.max(1, Math.round(damage * (cover ? 0.5 : exposed ? 1 : 0.2)));
  const tide = f.kit.step === "tide" && f.ranks[1] > 0 && artDue(round, 1);
  if (tide) marks.push("听潮步起势");
  if (tide) actions.push("听潮步闪避");
  const shout = f.kit.shout !== "off" && f.ranks[0] > 0 && artDue(round, 0);
  let interrupted = false;
  const cut = move.backwash && elapsed === 1 && choice === "safe";
  const reversed = move.backwash && elapsed === 1 && choice === "risk" && shout && move.interruptible;
  const trial = f.trial;
  let protectedLamp = cut || reversed;
  if (move.backwash) {
    if (cut || reversed) {
      f.water = 0;
      marks.push(cut ? "割缆断流" : "倒浪断流");
    } else {
      const healed = Math.min(24 + 8 * rank, f.maxHp - f.hp);
      f.hp += healed;
      f.water++;
      if (healed) actions.push(`船缆汲水，河伯回血 ${healed}`);
      marks.push(`汲水 · 水位 ${f.water}/${riverFloodLimit}`);
    }
  }
  for (const art of weaponArts(f.kit)) {
    if (f.hp <= 0 || !f.ranks[art] || !artDue(round, art)) continue;
    if (art === 5) {
      actions.push(`挑灯诀刀伤 ${deal(hurt(f.ranks[5] === 2 ? 16 : 10))}`);
      if (f.hp > 0 && exposed && f.sigilThrough >= round) ignite();
      continue;
    }
    if (art === 3) {
      const seal = f.loadout.charm === "postSeal" ? charmPower("postSeal", upgrade("postSeal")) : 0;
      const damage = deal(hurt(8 + seal));
      actions.push(`折篙刀伤 ${damage}${seal ? `（路引 +${seal}）` : ""}`);
      if (interrupted && f.hp > 0) {
        const follow = deal(hurt(f.ranks[3] === 2 ? 22 : 12));
        marks.push("折篙刀追斩");
        actions.push(`趁截断追斩，伤 ${follow}`);
      }
      continue;
    }
    interrupted = !!move.interruptible;
    marks.push(interrupted ? "镇山喝截断" + move.name : "镇山喝出手");
    const extra = interrupted && f.ranks[0] === 2 ? 12 : 0;
    const echo = interrupted && f.loadout.weapon === "pineBlade" ? traitPower("pineBlade", upgrade("pineBlade")) : 0;
    if (echo) marks.push("松纹刀 +" + echo);
    if (echo) actions.push(`松纹刀应喝，喝伤 +${echo}`);
    const damage = deal(hurt(5 + extra + echo));
    actions.push(`镇山喝${interrupted ? "截断" + move.name : "出手"}，喝伤 ${damage}`);
    if (reversed) {
      f.hp -= 18;
      marks.push("回浪撞舟 +18");
      actions.push("回浪撞舟，反伤 18");
    }
  }
  const sweep = f.region === bridgeRegion && !!move.heavy;
  const steady = sweep && elapsed === 0 && choice === "safe";
  const lunge = sweep && elapsed === 0 && choice === "risk";
  if (steady) {
    f.footing = 0;
    marks.push("借墩稳身");
  }
  if (f.hp > 0 && f.preparation === "ready" && choice === "safe" && elapsed === (f.region === 1 ? 1 : 0)) {
    const clue = caseClues[f.region];
    f.preparation = "used";
    marks.push(clue.aid);
    actions.push(`${clue.aid}，额外伤害 ${deal(clue.damage)}`);
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
    const bonus = charm === "tigerFang" && round % 3 === 0 || charm === "mirrorPearl" && (round - 1) % 4 === 0
      ? charmPower(charm, upgrade(charm)) : 0;
    let bladeBonus = 0;
    if (tide && f.loadout.weapon === "reedBlade") bladeBonus = traitPower("reedBlade", upgrade("reedBlade"));
    if (f.revealedThrough >= round && f.loadout.weapon === "templeBlade") bladeBonus = traitPower("templeBlade", upgrade("templeBlade"));
    if (bladeBonus && f.loadout.weapon) marks.push(equipment[f.loadout.weapon].name + " +" + bladeBonus);
    if (bladeBonus && f.loadout.weapon) actions.push(`${equipment[f.loadout.weapon].name}，刀伤 +${bladeBonus}`);
    if (bonus && charm) marks.push(equipment[charm].name + " +" + bonus);
    if (bonus && charm) actions.push(`${equipment[charm].name}，刀伤 +${bonus}`);
    const ambush = f.region === 2 && choice === "risk" && elapsed === 1 && exposed;
    if (ambush) marks.push("候得真身 +28");
    if (ambush) actions.push("候得真身，刀伤 +28");
    const engraved = f.engraving?.id === "edge" && f.cutRound !== undefined && f.cutRound < round ? f.engraving.power : 0;
    if (engraved) {
      f.cutRound = undefined;
      actions.push(`断潮纹，刀伤 +${engraved}`);
      marks.push(`断潮纹 +${engraved}`);
    }
    const rush = lunge && interrupted ? 18 : horseChoice === "risk" ? 20 : 0;
    if (rush) marks.push(horseChoice === "risk" ? "迎灯进刀 +20" : "迎篙抢步 +18");
    const damage = deal(hurt((stats.damage + engraved + bladeBonus + bonus + rush + (charge ? 12 : ambush ? 28 : 0)) * flank * seal));
    actions.push(`普攻刀伤 ${damage}`);
    if (f.region === 2) {
      struckTrue = exposed;
      f.paperHits = exposed ? 0 : f.paperHits + 1;
      if (f.hp > 0 && f.paperHits === paperHitLimit) {
        f.paperHits = 0;
        const damage = paperBacklashDamage + 8 * rank;
        f.life -= damage;
        backlash = true;
        marks.push("纸面反噬");
        actions.push(`连斩纸面招来反噬，扣 ${damage} 点气血`);
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
    if (watching && round % 3 === 0 && f.ward > 0) {
      f.life -= 28;
      marks.push("更印震响");
      actions.push("更印未破，震响扣 28 点气血");
    }
    if (f.life <= 0) f.cue = "strike";
    else if (tide || f.realm >= 1 && f.kit.step === "basic" && move.wave && round % 3 === 1) {
      if (move.backwash) protectedLamp = true;
      actions.push(`闪避过${move.name}`);
      if (f.loadout.armor === "ferryCoat" && f.life < f.maxLife) {
        const heal = Math.min(f.maxLife - f.life, traitPower("ferryCoat", upgrade("ferryCoat")));
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
      const guard = move.heavy && f.kit.stance === "guard" && !charge && !lunge && horseChoice !== "risk";
      let power = move.damage;
      if (move.backwash && elapsed === 1 && choice && choice !== "pass") {
        power = choice === "safe" ? 12 : 46;
        actions.push(choice === "safe" ? "缆断浪浅" : "浪涌船高");
      }
      const braced = f.region === 0 && elapsed === 0 && choice === "safe";
      if (f.mirrorLevel) power = Math.min(Number.MAX_SAFE_INTEGER, power + mirrorOpponent(f.mirrorLevel).damageBonus);
      power += rematchAttack[rank];
      if (move.heavy && (f.region === 0 || f.region === bridgeRegion)) power += 8 * rank;
      const received = guard ? Math.ceil(power * 0.18) : power;
      const rawDamage = steady || horseChoice === "safe" ? Math.min(received, 8) : braced ? Math.min(received, 4) : received;
      let damage = rawDamage;
      const reduce = (id: "hillCoat" | "templeCoat" | "tideSeal" | "watchSeal", amount: number) => {
        const blocked = Math.min(amount, damage - 1);
        if (blocked > 0) actions.push(`${equipment[id].name}减伤 ${blocked}`);
        if (blocked) marks.push(equipment[id].name + "护身");
        damage -= blocked;
      };
      if (guard && f.loadout.armor === "hillCoat") reduce("hillCoat", traitPower("hillCoat", upgrade("hillCoat")));
      if (f.revealedThrough >= round && f.loadout.armor === "templeCoat") reduce("templeCoat", traitPower("templeCoat", upgrade("templeCoat")));
      if (round % 3 === 2 && f.loadout.charm === "tideSeal") reduce("tideSeal", charmPower("tideSeal", upgrade("tideSeal")));
      if (round % 3 === 0 && f.loadout.charm === "watchSeal") reduce("watchSeal", charmPower("watchSeal", upgrade("watchSeal")));
      f.life -= damage;
      actions.push(`${guard ? "架住" : ""}${move.name}，扣 ${damage} 点气血`);
      if (horseCharge && cover) {
        const burn = 18 + 8 * rank;
        f.life -= burn;
        marks.push("马灯灼伤");
        actions.push(`马灯灼伤，另扣 ${burn} 点气血`);
      }
      if (sweep && !steady) {
        f.footing++;
        actions.push(`被逼向桥边，失足 ${f.footing}/${footingLimit}`);
        if (f.footing >= footingLimit) {
          f.life = 0;
          marks.push("跌落驿桥");
          actions.push("跌落驿桥");
        }
      }
      f.cue = guard || braced ? "guard" : "strike";
      if (guard && f.life > 0 && f.realm >= 2) {
        actions.push(`反击伤 ${deal(hurt(6))}`);
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
  const end = Math.min(trial.limit, trial.round + [1, 2, 3, 1, 1, 2][trial.region]);
  while (trial.round < end && trial.result === "fighting") resolveRound(trial);
  return { life: Math.max(0, trial.life), hp: Math.max(0, trial.hp), round: trial.round, result: trial.result, water: trial.water, paperHits: trial.paperHits, ...(trial.trial && { trialProgress: trial.trial.progress }),
    ...(fight.preparation === "ready" && trial.preparation === "used" && { prepared: caseClues[fight.region].aid }),
    ...(trial.region === bridgeRegion && { footing: trial.footing }),
    ...(trial.region === watchRegion && { ward: trial.ward }),
    ...(trial.region === courierRegion && { cover: horseCovered(fight.round + 1, choice) }),
    backlashes: (trial.links["纸面反噬"] ?? 0) - (fight.links["纸面反噬"] ?? 0) };
}

export function defeatSummary(fight: Fight) {
  if (fight.trial && fight.life > 0 && (fight.hp <= 0 || fight.round < fight.limit)) return fight.lastThreat;
  if (fight.life > 0) return `回合已用尽，对手还剩 ${fight.hp} 点气血。`;
  const marks = fight.lastExchange?.marks ?? [];
  if (marks.includes("覆舟")) return "水位涨满三格，阿照落水败阵。";
  if (marks.includes("跌落驿桥")) return "第三次被横篙扫中，阿照跌落驿桥。";
  if (marks.includes("纸面反噬")) return `第 ${fight.round} 回合遭到纸面反噬，气血耗尽。`;
  if (marks.includes("更印震响")) return `第 ${fight.round} 回合更印未破，敲更后气血耗尽。`;
  return `第 ${fight.round} 回合气血耗尽。`;
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
