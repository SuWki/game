import { arts, bookReadingDao, bridgeRegion, cliffRegion, courierRegion, freeDao, freeRealm, hallRegion, heartDao, heartRealm, lampPaper, mountainFirstReward, regions, ropeStep, skyRegion, stillDao, stillRealm, trialIds, trialRounds, trials, trialSand, trueDao, trueRealm, trueSigilBonus, watchRegion, windDao, windRealm, windSurveyDao } from "./content.ts";
import type { TrialId } from "./content.ts";
import { bossEquipment, charmPower, equipment, gearDamage, gearDisplayName, gearEffect, gearLife, gearRank, knownGear, minionEquipment, reforgeIds, reforging, slots, traitPower, traitText } from "./equipment.ts";
import type { GearId, GearLoadout, GearReforges, GearSlot, ReforgeId } from "./equipment.ts";
import { caseClues, decisionDue, encounters } from "./tactics.ts";
import type { Response } from "./tactics.ts";

export type OldRegion = 0 | 1 | 2 | 3 | 4 | 5;
export type ArtId = OldRegion | typeof ropeStep;
export type Region = ArtId | typeof skyRegion | typeof hallRegion;
type PerArt<T> = [T, T, T, T, T, T, T];
type PerRegion<T> = [...PerArt<T>, T, T];
type WeaponArt = 0 | 3 | 5;
export type Strategy = "off" | "ready" | "windup";
export type Kit = {
  stance: "guard" | "attack";
  shout: Strategy;
  step: "basic" | "tide" | "rope";
  inwardTide?: true;
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
  version: 7;
  region: Region;
  realm: number;
  dao: number;
  lifetimeDao: number;
  newGear: GearId[];
  kills: PerRegion<number>;
  clues: PerRegion<number>;
  victories: PerRegion<number>;
  drops: PerArt<boolean>;
  ranks: PerArt<number>;
  windSurveyed: boolean;
  booksCompared: boolean;
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
  reforges: GearReforges;
};

export const saveKey = "night-watch-v1";
export const frame = 100;
export const maxOffline = 8 * 60 * 60 * 1000;
export const maxRounds = 20;
export const riverFloodLimit = 3;
export const riverPursuitDamage = 22;
export const riverPursuitLimit = 2;
export const riverDrenchDamage = 6;
export const mirrorRounds = 12;
export const paperHitLimit = 2;
export const footingLimit = 3;
export const watchWard = 58;
export const wardSealLimit = 3;
export const maxRematchRank = 3;
const rematchHealth = [0, 42, 92, 155];
const rematchAttack = [0, 4, 9, 15];
const paperBacklashDamage = 34;
export const engravings = {
  edge: { name: "断潮纹", trigger: "成功截断后的下一刀", effect: "刀伤" },
  step: { name: "回息纹", trigger: "成功闪避时", effect: "回气" },
} as const;
export type Engraving = keyof typeof engravings;
export type MirrorAttempt = { level: number; round: number; life: number; maxLife: number; hp: number; won: boolean; build: string };
type MirrorProgress = {
  best: number;
  sand: number;
  time: number;
  remainder: number;
  ranks: Record<Engraving, number>;
  equipped?: Engraving;
  recent?: MirrorAttempt;
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

export function reforgeState(save: Save, id: ReforgeId) {
  if (save.reforges[id]) return "done";
  if (!save.victories[reforging[id].chapter]) return "story";
  if (!gearRank(id, save.rematchRanks)) return "rematch";
  if (!save.ownedGear.includes(id)) return "gear";
  return "ready";
}

export function reforgeGear(save: Save, id: ReforgeId) {
  const cost = reforging[id].cost;
  if (!mirrorUnlocked(save) || reforgeState(save, id) !== "ready" || save.mirror.sand < cost) return false;
  save.mirror.sand -= cost;
  save.reforges[id] = true;
  return true;
}

export function canEarnSand(save: Save) {
  const ranks = save.mirror.ranks;
  return mirrorUnlocked(save) && (ranks.edge < maxEngravingRank || ranks.step < maxEngravingRank
    || reforgeIds.some(id => reforgeState(save, id) === "ready"));
}

export function accrueSand(save: Save, now: number) {
  const mirror = save.mirror;
  const elapsed = Math.min(maxOffline, Math.max(0, now - mirror.time));
  const total = canEarnSand(save) ? elapsed * sandRate(mirror.best) + mirror.remainder : 0;
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

const realmStarts = [0, 130, 430, 830, heartDao, stillDao, windDao, trueDao, freeDao];
const layerCosts = [0, 30, 40, 60, 80, 100, 120, 140, 160];

export function cultivation(total: number, heartOpened = false, stillOpened = false, windOpened = false, followingRealm: number = windRealm) {
  const lastRealm = heartOpened ? stillOpened ? windOpened ? followingRealm : stillRealm : heartRealm : heartRealm - 1;
  let realm = 0;
  while (realm < lastRealm && total >= realmStarts[realm + 1]) realm++;
  let progress = total - realmStarts[realm];
  for (let layer = 1; layer <= 10; layer++) {
    const needed = realm === 0 ? 2 + 2 * layer : layerCosts[realm];
    const full = layer === 10 && (progress >= needed || realm === lastRealm && realm < heartRealm);
    if (progress < needed || full) return { realm, layer, progress: full ? needed : progress, needed, full };
    progress -= needed;
  }
  throw new Error("境界道行表不连续");
}

export function cultivationFor(save: Pick<Save, "lifetimeDao" | "victories" | "windSurveyed" | "booksCompared" | "trialBest">) {
  const followingRealm = save.booksCompared && save.victories[skyRegion] ? save.trialBest.lampTrial ? freeRealm : trueRealm : windRealm;
  return cultivation(save.lifetimeDao, !!save.victories[bridgeRegion], save.windSurveyed && !!save.victories[watchRegion], !!save.victories[cliffRegion], followingRealm);
}

export function earnDao(save: Save, amount: number) {
  save.dao = Math.min(Number.MAX_SAFE_INTEGER, save.dao + amount);
  save.lifetimeDao = Math.min(Number.MAX_SAFE_INTEGER, save.lifetimeDao + amount);
  save.realm = cultivationFor(save).realm;
}

export function combatStats(realm: number, stance: Kit["stance"], loadout: GearLoadout = {}, layer = 1,
  upgrades: readonly number[] = [], reforges: GearReforges = {}) {
  const { weapon, armor } = loadout;
  const base = 12 + realm * 3 + (weapon ? gearDamage(weapon, gearRank(weapon, upgrades), reforges) : 0);
  return {
    damage: stance === "attack" ? Math.round(base * 1.25) : base,
    life: 105 + layer - 1 + realm * 24 + (armor ? gearLife(armor, gearRank(armor, upgrades), reforges) : 0),
  };
}

export function loadoutStats(save: Save, loadout = save.loadout) {
  return combatStats(save.realm, save.kit.stance, loadout, cultivationFor(save).layer, save.rematchRanks, save.reforges);
}

export function compareGear(save: Save, id: GearId) {
  const { slot } = equipment[id];
  const current = save.loadout[slot];
  const before = loadoutStats(save);
  const after = loadoutStats(save, { ...save.loadout, [slot]: id });
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
  const has = (art: ArtId) => active[art] && save.ranks[art] > 0;
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
  if (id === "lampKnot" && !has(0)) return "带镇山喝截断重击，下一回合普攻打实才会回气。";
}

function newGuide(): GuideProgress {
  return { enabled: true, dismissed: [], defeats: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
}

export function newSave(now: number): Save {
  return {
    version: 7, region: 0, realm: 0, dao: 0, lifetimeDao: 0, newGear: [], windSurveyed: false, booksCompared: false,
    kills: [0, 0, 0, 0, 0, 0, 0, 0, 0], clues: [0, 0, 0, 0, 0, 0, 0, 0, 0], victories: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    drops: [false, false, false, false, false, false, false], ranks: [0, 0, 0, 0, 0, 0, 0], time: now,
    guide: newGuide(), mirror: newMirror(now), trialBest: { ferryTrial: 0, templeTrial: 0, lampTrial: 0 }, presets: [null, null],
    rematchRanks: [0, 0, 0, 0, 0, 0, 0, 0, 0], reforges: {},
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
  if (kit?.step === "rope") equipArt(draft, ropeStep, true);
  if (kit?.inwardTide && clean.step !== "tide") setInwardTide(draft, true);
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
  const size = [0, 3, 3, 4, 6, 7, 8, 9][data?.version];
  const artSize = [0, 3, 3, 4, 6, 6, 7, 7][data?.version];
  const lastRealm = [0, 3, 3, heartRealm, heartRealm, stillRealm, windRealm, freeRealm][data?.version];
  const entries = (value: unknown, test: (item: unknown) => boolean) =>
    Array.isArray(value) && value.length === size && value.every(test);
  if (!size || !count(data.region, size - 1) || !count(data.realm, lastRealm) ||
      !count(data.dao) || !count(data.time) || !entries(data.kills, countValue => count(countValue)) ||
      !entries(data.victories, countValue => count(countValue)) ||
      !Array.isArray(data.drops) || data.drops.length !== artSize || !data.drops.every(item => typeof item === "boolean") ||
      !Array.isArray(data.ranks) || data.ranks.length !== artSize || !data.ranks.every(item => count(item, 2)) ||
      !["guard", "attack"].includes(data.kit?.stance) ||
      !["off", "ready", "windup"].includes(data.kit?.shout) ||
      !(data.version >= 6 ? ["basic", "tide", "rope"] : ["basic", "tide"]).includes(data.kit?.step) || typeof data.kit?.reveal !== "boolean" ||
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
    data.clues = [earned(0, [2, 5, 10]), earned(1, [3, 8, 15]), earned(2, [3, 8, 15]), 0, 0, 0, 0, 0, 0];
  } else if (!entries(data.clues, item => count(item, 3))) {
    throw new Error("线索进度无法读取");
  }
  for (let i = size; i < regions.length; i++) {
    data.kills[i] = data.victories[i] = data.clues[i] = data.guide.defeats[i] = 0;
  }
  for (let i = artSize; i < arts.length; i++) {
    const art = i as ArtId;
    data.ranks[art] = 0;
    data.drops[art] = false;
  }
  data.ownedGear = Array.isArray(data.ownedGear) ? [...new Set(data.ownedGear.filter(knownGear))] : [];
  for (const [region, id] of bossEquipment.entries()) {
    if (data.victories[region] > 0 && !data.ownedGear.includes(id)) data.ownedGear.push(id);
  }
  if (data.victories[cliffRegion]) data.drops[ropeStep] = true;
  if (data.victories[skyRegion] && !data.ownedGear.includes("lampKnot")) data.ownedGear.push("lampKnot");
  data.loadout = cleanLoadout(data.loadout, data.ownedGear);
  data.autoPatrol = data.victories[0] > 0 && data.autoPatrol === true;
  data.newGear = Array.isArray(data.newGear) ? [...new Set(data.newGear.filter(id => data.ownedGear.includes(id)))] : [];
  if (data.lifetimeDao === undefined) {
    const previousCosts = [0, 70, 250, 580, 580, 580, 580, 580, 580];
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
  const recent = data.mirror.recent;
  if (recent && (!count(recent.level) || recent.level < 1 || recent.level - 1 > data.mirror.best
    || !count(recent.round, mirrorRounds) || !count(recent.life) || !count(recent.maxLife) || recent.life > recent.maxLife
    || !count(recent.hp) || typeof recent.won !== "boolean" || typeof recent.build !== "string" || recent.build.length > 180)) {
    delete data.mirror.recent;
  }
  data.windSurveyed = data.version >= 5 && data.windSurveyed === true && !!data.victories[watchRegion];
  data.booksCompared = data.version >= 7 && data.booksCompared === true && !!data.victories[skyRegion];
  const best = data.trialBest;
  data.trialBest = { ferryTrial: 0, templeTrial: 0, lampTrial: 0 };
  for (const id of trialIds) {
    if (count(best?.[id], trialRounds) && (id !== "lampTrial" || data.booksCompared)) data.trialBest[id] = best[id];
  }
  data.realm = cultivationFor(data).realm;
  const save: Save = { ...data, version: 7 };
  const progress = data.rematchRanks;
  save.rematchRanks = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < bossEquipment.length; i++) {
    if (save.victories[i] && count(progress?.[i], maxRematchRank)) {
      save.rematchRanks[i] = progress[i];
      if (progress[i]) save.clues[i] = 3;
    }
  }
  save.reforges = {};
  for (const id of reforgeIds) {
    if (data.reforges?.[id] === true && reforgeState(save, id) === "ready") save.reforges[id] = true;
  }
  save.kit = cleanKit(data.kit, save);
  save.presets = [cleanPreset(data.presets?.[0], save), cleanPreset(data.presets?.[1], save)];
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

export function recordedClues(save: Save, region = save.region): number {
  return Math.max(save.clues[region], regions[region].thresholds.filter(threshold => save.kills[region] >= threshold).length);
}

export function clueCount(save: Save, region = save.region): number {
  return unlocked(save, region) && !patrolRemaining(save, region) ? 3 : recordedClues(save, region);
}

export function canPatrol(save: Save) {
  return save.newGear.length === 0 && patrolRemaining(save) > 0;
}

export function recordPatrolKill(save: Save, random = Math.random) {
  const region = save.region;
  if (!canPatrol(save)) return { reward: 0, found: undefined };
  const reward = earnPatrolDao(save, regions[region].reward);
  const id = region < cliffRegion ? minionEquipment[region as OldRegion][save.kills[region] % 2] : undefined;
  save.kills[region]++;
  save.clues[region] = recordedClues(save, region);
  const firstGear = region === 0 && save.kills[0] === 2;
  const found = id && (firstGear || random() < 0.25) && !save.ownedGear.includes(id) ? id : undefined;
  if (found) {
    save.ownedGear.push(found);
    save.newGear.unshift(found);
  }
  return { reward, found };
}

export function unlocked(save: Save, region: Region): boolean {
  if (region === skyRegion) return !!save.victories[cliffRegion] && save.realm >= windRealm;
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

export const challengeRealms = [0, 1, 3, 3, heartRealm, heartRealm, stillRealm, windRealm, trueRealm] as const;

export const challengeClues = 2;
export function surveyWind(save: Save) {
  if (save.region !== cliffRegion || !unlocked(save, cliffRegion) || save.windSurveyed || clueCount(save) < challengeClues) return false;
  save.windSurveyed = true;
  earnDao(save, Math.max(0, Math.min(windSurveyDao, stillDao - save.lifetimeDao)));
  return true;
}

export function canChallenge(save: Save, region: Region): boolean {
  if (region === hallRegion) return false;
  return unlocked(save, region) && (save.victories[region] > 0 || clueCount(save, region) >= challengeClues) &&
    save.realm >= challengeRealms[region];
}

export function canCompareBooks(save: Save) {
  return save.region === hallRegion && unlocked(save, hallRegion) && !save.booksCompared && clueCount(save) >= challengeClues;
}

export function compareBooks(save: Save) {
  if (!canCompareBooks(save)) return false;
  save.booksCompared = true;
  earnDao(save, Math.max(0, Math.min(bookReadingDao, trueDao - save.lifetimeDao)));
  return true;
}

export function canEnterLampTrial(save: Save) {
  return unlocked(save, hallRegion) && save.booksCompared && save.realm >= trueRealm;
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
  if (region === hallRegion) return { first: false, drop: false, recovered: undefined };
  const first = save.victories[region]++ === 0;
  if (region === cliffRegion) {
    const drop = !save.drops[ropeStep];
    save.drops[ropeStep] = true;
    if (first) earnDao(save, Math.max(0, windDao - save.lifetimeDao));
    return { first, drop, recovered: undefined };
  }
  if (region === skyRegion) {
    if (first && !save.ownedGear.includes("lampKnot")) {
      save.ownedGear.push("lampKnot");
      save.newGear.unshift("lampKnot");
    }
    return { first, drop: false, recovered: undefined };
  }
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

export function study(save: Save, art: ArtId): boolean {
  const rank = save.ranks[art];
  const cost = rank === 0 ? arts[art].cost : masteryCost;
  if (!save.drops[art] || rank >= 2 || save.dao < cost || save.realm < arts[art].realm) return false;
  save.ranks[art]++;
  save.dao -= cost;
  return true;
}

type Move = { name: string; damage: number; heavy?: boolean; interruptible?: boolean; wave?: boolean; backwash?: boolean; spell?: boolean };
const patterns: Move[][] = [
  [{ name: "扑咬", damage: 9 }, { name: "扫尾", damage: 9 }, { name: "虎啸", damage: 36, heavy: true, interruptible: true }],
  [{ name: "第一道浪", damage: 15, wave: true }, { name: "挥篙", damage: 10 }, { name: "回浪", damage: 34, heavy: true, interruptible: true, backwash: true }],
  [{ name: "纸面", damage: 7 }, { name: "借面", damage: 15 }, { name: "烛偏", damage: 16, heavy: true }],
  [{ name: "点篙", damage: 11 }, { name: "击栏", damage: 14 }, { name: "横篙", damage: 48, heavy: true, interruptible: true }],
  [{ name: "举灯", damage: 9 }, { name: "冲灯", damage: 36, heavy: true }, { name: "回蹄", damage: 14 }],
  [{ name: "立更印", damage: 12 }, { name: "提槌", damage: 13 }, { name: "敲更", damage: 29, heavy: true }],
  [{ name: "回风", damage: 8 }, { name: "掠栈", damage: 62, heavy: true }, { name: "落爪", damage: 50, heavy: true, interruptible: true }],
  [{ name: "升空", damage: 11 }, { name: "贴崖", damage: 19 }, { name: "落巢", damage: 43, heavy: true, interruptible: true }],
  [{ name: "覆纸", damage: 0 }, { name: "询铃", damage: 16 }, { name: "催灯术", damage: 94, heavy: true, spell: true }],
];
const cliffFallDamage = 84;

export type BattleOrder = { round: number; choice: Exclude<Response, "pass"> };

export type Fight = {
  region: Region; boss: boolean; name: string; sprite: string;
  limit: number; mirrorLevel?: number; water: number; paperHits: number; footing: number; riverWave: 2 | 3;
  riverDrenched: boolean; riverPursuits: number;
  cliffStepRound?: number;
  casePractice?: true;
  inwardTideUsed?: boolean;
  skyDelayRound?: number;
  lampKnotRound?: number;
  trueGuardUsed?: boolean;
  trueSigilReady?: boolean;
  sigilBoosted?: boolean;
  lampMissedRound?: number;
  trial?: { id: TrialId; progress: number };
  rematchRank?: number;
  rematchPractice?: boolean;
  engraving?: { id: Engraving; power: number }; cutRound?: number;
  maxHp: number; hp: number; maxLife: number; life: number;
  time: number; round: number; revealedThrough: number;
  sigilThrough: number; ward: number; wardStreak: number;
  preparation?: "ready" | "used";
  kit: Kit; realm: number; ranks: Save["ranks"];
  loadout: GearLoadout;
  gearUpgrades: Save["rematchRanks"];
  reforges: GearReforges;
  cue: "idle" | "slash" | "stagger" | "guard" | "strike";
  consult: boolean; waiting: boolean; focus: number;
  order?: { round: number; choice: Response };
  plan?: BattleOrder[];
  autoTactics?: boolean;
  lastExchange?: { round: number; life: number; hp: number; marks: string[] };
  links: Record<string, number>;
  windup: string; event: string; lastThreat: string; log: string[];
  result: "fighting" | "won" | "lost";
};

export function startFight(save: Save, region: Region, boss: boolean, foeIndex = 0): Fight {
  const data = regions[region];
  const actor = boss ? { name: data.boss, sprite: data.sprite } : data.foes[foeIndex % data.foes.length];
  const hp = boss ? data.hp : 1;
  const life = loadoutStats(save).life;
  const id = save.mirror.equipped;
  const engraving = id && mirrorUnlocked(save) ? { id, power: engravingPower(id, save.mirror.ranks[id]) } : undefined;
  return {
    ...actor, region, boss, limit: maxRounds, riverWave: 3, water: 0, paperHits: 0, footing: 0, engraving, maxHp: hp, hp, maxLife: life, life, time: 0, round: 0,
    riverDrenched: false, riverPursuits: 0,
    kit: { ...save.kit }, realm: save.realm, ranks: [...save.ranks], loadout: { ...save.loadout }, gearUpgrades: [...save.rematchRanks],
    reforges: { ...save.reforges },
    revealedThrough: 0, sigilThrough: 0, ward: 0, wardStreak: 0, links: {},
    consult: boss, waiting: false, focus: 2,
    cue: "idle", windup: "", event: "", lastThreat: "", log: [], result: "fighting",
  };
}

export function startCaseFight(save: Save, region: Region) {
  if (!canChallenge(save, region)) return;
  const fight = startFight(save, region, true);
  if (region >= cliffRegion && save.victories[region]) fight.casePractice = true;
  if (recordedClues(save, region) === 3) fight.preparation = "ready";
  return fight;
}

export function rematchSpec(save: Save, region: Region, practice = false) {
  if (region === cliffRegion || region === skyRegion || region === hallRegion) return;
  const progress = save.rematchRanks[region];
  const rank = practice ? maxRematchRank : progress + 1;
  if (!save.victories[region] || rank > maxRematchRank || practice && progress !== maxRematchRank) return;
  const riverWave = region === 1 && rank >= 2 ? 2 : 3;
  const detail = [
    `虎啸基础伤害额外 +${8 * rank}。守式能减伤，镇山喝能截断。`,
    `回浪在第 ${riverWave}、${riverWave + 3}、${riverWave + 6}… 回合。每次汲水最多回 ${24 + 8 * rank} 气血，割缆可清水位。${rank === 3
      ? `未割缆的回浪扣到 ${riverDrenchDamage} 气血会沾衣。下一轮追篙基础伤害 +${riverPursuitDamage}，第二次追篙命中会落水。闪避或把回浪伤害压低可免沾衣。` : ""}`,
    rank === 3 ? `累计两次斩中纸面会封灯。挑灯能开出一段真身，照影显形时命中真身可以清掉纸痕。`
      : `连斩纸面会反噬 ${paperBacklashDamage + 8 * rank} 点。挑灯或照影能找到真身。`,
    `横篙基础伤害额外 +${8 * rank}。第三次中招仍会落桥。`,
    `带着马灯撞中时，灼伤提高到 ${18 + 8 * rank} 点。冲灯前可压灯。`,
    `更印提高至 ${wardStrength(rank)} 点。${rank >= 2 ? "连续三次更印未破会封阵。敲更前揭印、引爆符火或打破更印，可清空封阵进度。" : "可揭去更印，或用符火烧掉。"}`,
  ][region];
  return { rank, hp: regions[region].hp + rematchHealth[rank], attack: rematchAttack[rank], detail, riverWave, prepared: recordedClues(save, region) === 3 } as const;
}

export function startRematch(save: Save, region: Region, practice = false) {
  const spec = rematchSpec(save, region, practice);
  if (!spec) return;
  const fight = startFight(save, region, true);
  fight.rematchRank = spec.rank;
  if (practice) fight.rematchPractice = true;
  if (spec.prepared) fight.preparation = "ready";
  fight.hp = fight.maxHp = spec.hp;
  fight.riverWave = spec.riverWave;
  return fight;
}

export function settleRematch(save: Save, fight: Fight) {
  const { rematchRank: rank, region } = fight;
  if (region === cliffRegion || region === skyRegion || region === hallRegion || !rank || fight.rematchPractice || fight.result !== "won" || rematchSpec(save, region)?.rank !== rank) return;
  save.rematchRanks[region] = rank;
  save.clues[region] = 3;
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
  if (!Object.hasOwn(trials, id) || (id === "lampTrial" ? !canEnterLampTrial(save) : !mirrorUnlocked(save) || save.trialBest[id])) return;
  const spec = trials[id];
  const fight = startFight(save, spec.region, true);
  fight.trial = { id, progress: 0 };
  fight.riverWave = spec.wave;
  fight.limit = trialRounds;
  fight.hp = fight.maxHp = spec.hp;
  if (id === "lampTrial" && recordedClues(save, hallRegion) === 3) fight.preparation = "ready";
  return fight;
}

export function settleTrial(save: Save, fight: Fight) {
  const trial = fight.trial;
  if (!trial || fight.result !== "won" || trial.progress < trials[trial.id].target) return 0;
  if (trial.id === "lampTrial") {
    if (canEnterLampTrial(save) && !save.trialBest.lampTrial) {
      save.trialBest.lampTrial = fight.round;
      earnDao(save, Math.max(0, freeDao - save.lifetimeDao));
      save.autoPatrol = false;
    }
    return 0;
  }
  if (!mirrorUnlocked(save)) return 0;
  const previous = save.trialBest[trial.id];
  if (previous) return 0;
  save.trialBest[trial.id] = fight.round;
  if (!canEarnSand(save)) return 0;
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
  if (mirrorPreparation(save, opponent.region)) fight.preparation = "ready";
  return fight;
}

export function mirrorPreparation(save: Save, region: 1 | 2) {
  return !!save.trialBest[region === 1 ? "ferryTrial" : "templeTrial"] && recordedClues(save, region) === 3;
}

function mirrorAttempt(fight: Fight, level: number): MirrorAttempt {
  const gear = Object.values(fight.loadout).map(id => gearDisplayName(id, gearRank(id, fight.gearUpgrades), fight.reforges));
  const active = equippedArts(fight.kit);
  const moves = [...weaponArts(fight.kit), 1, 2, 4].filter(id => active[id]).map(id => arts[id].name);
  const build = [...gear, ...moves, fight.kit.stance === "guard" ? "守式" : "攻式",
    ...(fight.engraving ? [engravings[fight.engraving.id].name + " +" + fight.engraving.power] : []),
    ...(fight.plan?.map(order => order.round + "回合" + encounters[fight.region][order.choice].name) ?? [])].join(" · ");
  return { level, round: fight.round, life: Math.max(0, fight.life), maxLife: fight.maxLife,
    hp: Math.max(0, fight.hp), won: fight.result === "won", build };
}

export function settleMirror(save: Save, fight: Fight, now: number) {
  const idle = accrueSand(save, now);
  const level = fight.mirrorLevel;
  if (!mirrorUnlocked(save) || fight.result === "fighting" || level === undefined || level - 1 > save.mirror.best) return { idle, reward: 0 };
  save.mirror.recent = mirrorAttempt(fight, level);
  if (fight.result !== "won" || level - 1 !== save.mirror.best) return { idle, reward: 0 };
  save.mirror.best = level;
  const reward = canEarnSand(save) ? 12 + Math.min(24, (level - 1) * 2) : 0;
  save.mirror.sand = Math.min(Number.MAX_SAFE_INTEGER, save.mirror.sand + reward);
  return { idle, reward };
}

function moveFor(region: Region, round: number, riverWave: 2 | 3 = 3) {
  const index = (round - 1) % 3;
  const position = region === 1 && riverWave === 2 && index > 0 ? 3 - index : index;
  return patterns[region][position];
}

function openingDue(region: Region, round: number, riverWave: 2 | 3) {
  if (region === hallRegion) return false;
  return region === 1 ? (round - 1) % 3 === riverWave - 2 : decisionDue(region, round);
}

export function artDue(round: number, art: ArtId) {
  const { first, every } = arts[art];
  return round >= first && (round - first) % every === 0;
}

export function equippedArts(kit: Kit) {
  return [kit.shout === "windup" || kit.shout === "ready", kit.step === "tide", !!kit.reveal, !!kit.fold, !!kit.sigil, !!kit.kindle, kit.step === "rope"] as const;
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

export function replacedArt(save: Save, art: ArtId) {
  if (art === 1 && save.kit.step === "rope") return ropeStep;
  if (art === ropeStep && save.kit.step === "tide") return 1;
  if (art === 2 && save.kit.sigil) return 4;
  if (art === 4 && save.kit.reveal) return 2;
  if (art === 0 || art === 3 || art === 5) {
    const weapons = weaponArts(save.kit);
    if (!weapons.includes(art) && weapons.length >= weaponCapacity(save.realm)) return weapons[weapons.length - 1];
  }
}

export function equipArt(save: Save, art: ArtId, equip: boolean) {
  if (!save.ranks[art] || save.realm < arts[art].realm) return;
  const kit = save.kit;
  if (art === 1 || art === ropeStep) {
    const step = art === 1 ? "tide" : "rope";
    if (equip) {
      kit.step = step;
      if (art === 1) delete kit.inwardTide;
    } else if (kit.step === step) kit.step = "basic";
  }
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

export function setInwardTide(save: Save, equip: boolean) {
  if (equip) {
    if (save.realm < stillRealm || save.ranks[1] !== 2 || save.kit.inwardTide) return false;
    if (save.kit.step === "tide") save.kit.step = "basic";
    save.kit.inwardTide = true;
  } else {
    if (!save.kit.inwardTide) return false;
    delete save.kit.inwardTide;
  }
  return true;
}

export function roundMoves(region: Region, kit: Kit, round: number, riverWave: 2 | 3 = 3) {
  const equipped = equippedArts(kit);
  return {
    names: ([2, 4, 1, ropeStep, ...weaponArts(kit)] as ArtId[]).filter(id => equipped[id] && artDue(round, id)).map(id => arts[id].name),
    enemy: moveFor(region, round, riverWave).name,
    opening: openingDue(region, round, riverWave),
  };
}

export function planWindows(fight: Fight) {
  return Array.from({ length: fight.limit }, (_, i) => i + 1)
    .filter(round => openingDue(fight.region, round, fight.riverWave));
}

export function planRiskRequirement(fight: Fight, round: number) {
  const hasShout = fight.kit.shout !== "off" && fight.ranks[0] > 0;
  if (fight.region === 1 && (!hasShout || !artDue(round + 1, 0))) return "下一回合需有镇山喝截浪";
  if (fight.region === bridgeRegion && (!hasShout || !artDue(round, 0))) return "本回合需有镇山喝截断横篙";
  if (fight.region === watchRegion && (!fight.kit.sigil || !fight.ranks[4])) return "需装备寄灯符";
}

export function setBattlePlan(fight: Fight, orders: BattleOrder[]) {
  const windows = planWindows(fight);
  if (!fight.boss || fight.round || fight.time || fight.result !== "fighting" || orders.length > fight.focus
    || new Set(orders.map(order => order.round)).size !== orders.length
    || orders.some(order => !windows.includes(order.round) || order.choice !== "safe" && order.choice !== "risk"
      || order.choice === "risk" && planRiskRequirement(fight, order.round))) return false;
  fight.consult = false;
  fight.autoTactics = false;
  fight.plan = orders.map(order => ({ ...order })).sort((left, right) => left.round - right.round);
  return true;
}

export function enableCombatTactics(fight: Fight) {
  if (!fight.boss || fight.round || fight.time || fight.result !== "fighting") return false;
  fight.consult = false;
  fight.autoTactics = true;
  delete fight.plan;
  return true;
}

function automaticTactic(fight: Fight, round: number): BattleOrder["choice"] | undefined {
  if (!openingDue(fight.region, round, fight.riverWave)) return;
  const guard = fight.kit.stance === "guard";
  const hasTide = fight.kit.step === "tide" && fight.ranks[1] > 0;
  const hasShout = fight.kit.shout !== "off" && fight.ranks[0] > 0 && artDue(round, 0);
  switch (fight.region) {
    case 0:
      return guard && !hasShout ? "safe" : undefined;
    case 1:
      if (!planRiskRequirement(fight, round)) return "risk";
      if (guard && fight.trial?.id === "ferryTrial" && !hasTide) return "safe";
      if ((guard || hasTide) && fight.water >= 1) return "safe";
      break;
    case 2: {
      if (!guard) break;
      // 提前照面与照影覆盖的回合都无需再次挑灯。
      const litThrough = fight.order?.choice === "safe" ? fight.order.round + 2 : 0;
      const reveals = fight.kit.reveal && fight.ranks[2] > 0;
      if (Math.max(litThrough, fight.revealedThrough) < round && !(reveals && artDue(round, 2))) return "safe";
      break;
    }
    case bridgeRegion:
      if (hasShout) return guard ? undefined : "risk";
      return guard && fight.footing > 0 ? "safe" : undefined;
    case courierRegion:
      return guard ? "safe" : undefined;
    case watchRegion:
      if (fight.ward <= 0) break;
      if (fight.sigilThrough >= round) return fight.kit.kindle && fight.ranks[5] > 0 ? undefined : "risk";
      return guard ? "safe" : undefined;
    case cliffRegion:
      return guard && !hasTide ? "safe" : undefined;
    case skyRegion:
      return guard && !(fight.kit.step === "rope" && fight.ranks[ropeStep]) ? "safe" : undefined;
  }
}

export function automaticPreparationText(region: Region) {
  const { aid, damage } = caseClues[region];
  if (region === cliffRegion) return `「${aid}」· 首次落地少扣 ${damage} 点气血。`;
  if (region === skyRegion) return `「${aid}」· 首次打实贴崖额外造成 ${damage} 点伤害。`;
  if (region === hallRegion) return `「${aid}」· 首次承受催灯术时少扣 ${damage} 点气血，最低 1 点。`;
  const trigger = [
    "伏身避啸或截断虎啸", "割缆断流或引浪倒撞", "挑灯照面或施放照影",
    "借墩稳身或截断横篙", "压灯卸势或以听潮步避开冲灯", "揭去更印或引爆符火",
  ][region];
  return `「${aid}」· 首次${trigger}额外造成 ${damage} 点伤害。`;
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
  return watchWard + 12 * rank + (rank >= 2 ? 18 : 0);
}

export function wardSealActive(fight: Fight) {
  return fight.region === watchRegion && (fight.rematchRank ?? 0) >= 2;
}

export function riverPursuitActive(fight: Fight) {
  return fight.region === 1 && fight.rematchRank === 3;
}

export function paperSealActive(fight: Fight) {
  return fight.region === 2 && fight.rematchRank === 3;
}

function resolveRound(f: Fight) {
  const startingLife = f.life, startingHp = f.hp;
  const marks: string[] = [];
  const round = ++f.round;
  const move = moveFor(f.region, round, f.riverWave);
  const trial = f.trial;
  const lampTrial = trial?.id === "lampTrial" ? trial : undefined;
  const chant = !!lampTrial && !!move.spell;
  const pursuit = riverPursuitActive(f);
  const drenched = f.riverDrenched;
  f.riverDrenched = false;
  const actions: string[] = [];
  const finishExchange = () => {
    f.lastExchange = { round, life: Math.max(0, f.life) - startingLife, hp: Math.max(0, f.hp) - startingHp, marks };
    for (const mark of marks) f.links[mark] = (f.links[mark] ?? 0) + 1;
    f.event = `第 ${round} 回合 · ${actions.join(" → ")}。`;
    f.log.push(f.event);
  };
  if (f.cliffStepRound !== undefined) {
    const stepRound = f.cliffStepRound;
    delete f.cliffStepRound;
    const aid = f.preparation === "ready" ? caseClues[cliffRegion] : undefined;
    if (aid) {
      f.preparation = "used";
      marks.push(aid.aid);
    }
    let damage = cliffFallDamage - (aid?.damage ?? 0);
    const inward = f.kit.inwardTide && f.kit.step !== "tide" && f.ranks[1] === 2 && !f.inwardTideUsed;
    if (inward) {
      f.inwardTideUsed = true;
      damage = Math.max(1, Math.ceil(damage / 2));
      marks.push("内化听潮步");
    }
    f.life -= damage;
    marks.push("踏空落地");
    actions.push(`第 ${stepRound} 回合踏空，落地扣 ${damage} 点气血${aid ? `（旧灯结扣减 ${aid.damage}）` : ""}${inward ? "，内化听潮步减半" : ""}`);
    if (f.life <= 0) {
      f.result = "lost";
      f.cue = "strike";
      marks.push("落地败阵");
      f.lastThreat = `第 ${stepRound} 回合踏空，第 ${round} 回合落地扣了 ${damage} 点气血，阿照败阵。`;
      finishExchange();
      return;
    }
  }
  const tactic = f.autoTactics && f.focus > 0 ? automaticTactic(f, round) : undefined;
  const planned = tactic ? { round, choice: tactic } : f.plan?.find(order => order.round === round);
  if (planned && f.focus > 0) {
    if (f.region === watchRegion && planned.choice === "risk" && f.sigilThrough < round) {
      actions.push("没有可引爆的寄灯符，依原招出手");
      marks.push("借灯引符未生效");
    } else {
      f.order = planned;
      f.focus--;
      if (planned.choice !== "safe" || f.region !== 2 && f.region !== bridgeRegion) {
        marks.push(encounters[f.region][planned.choice].name);
      }
    }
  }
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
  if (lampTrial && lampTrial.progress < trials.lampTrial.target && round % 3 === 1) {
    f.ward = lampPaper;
    actions.push(`护纸覆上灯影，强度 ${lampPaper}`);
  }
  const deal = (damage: number) => {
    const blocked = Math.min(f.ward, lampTrial ? Math.ceil(damage * 0.6) : damage);
    f.ward -= blocked;
    f.hp -= damage - blocked;
    if (blocked) actions.push(`${lampTrial ? "护纸" : "更印"}吸收 ${blocked}`);
    return damage - blocked;
  };
  const ignite = () => {
    f.sigilThrough = 0;
    if (f.ward) {
      f.ward = 0;
      actions.push(lampTrial ? "符火烧去护纸" : "符火烧去更印");
      if (lampTrial) marks.push("符火破纸");
    }
    const fuel = f.loadout.charm === "courierSeal" ? charmPower("courierSeal", upgrade("courierSeal")) : 0;
    const damage = (f.ranks[4] === 2 ? 38 : 26) + fuel + (f.sigilBoosted ? trueSigilBonus : 0);
    if (f.sigilBoosted) marks.push("真人符火");
    f.sigilBoosted = false;
    f.hp -= damage;
    marks.push("符火引爆");
    if (fuel) marks.push("纸马灯芯 +" + fuel);
    actions.push(`符火引爆，火伤 ${damage}`);
  };
  if (f.kit.sigil && f.ranks[4] > 0 && artDue(round, 4)) {
    f.sigilThrough = round + 1;
    f.sigilBoosted = !!f.trueSigilReady;
    if (f.trueSigilReady) {
      f.trueSigilReady = false;
      actions.push(`真人余息入符，下次引爆火伤 +${trueSigilBonus}`);
    }
    marks.push("寄灯符已贴");
    actions.push("寄灯符贴印两回合");
  }
  if (watching && elapsed === 0) {
    if (choice === "safe") f.ward = 0;
    if (choice === "risk" && f.sigilThrough >= round) ignite();
  }
  const stats = combatStats(f.realm, f.kit.stance, f.loadout, 1, f.gearUpgrades, f.reforges);
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
  const sky = f.region === skyRegion;
  const nearCliff = sky && round % 3 === 2;
  const chasing = nearCliff && f.kit.step === "rope" && f.ranks[ropeStep] > 0 && artDue(round, ropeStep);
  const skyHeld = sky && f.skyDelayRound === round;
  const skyOpen = !sky || skyHeld || round % 3 === 0 || nearCliff && (chasing || choice === "safe" && elapsed === 0);
  if (chasing) {
    marks.push("踏缆步追及");
    actions.push("踏缆步追上贴崖鹞影");
  }
  if (skyHeld) actions.push("落巢被截断，衔灯鹞来不及升空");
  if (!skyOpen) {
    marks.push("鹞影难及");
    actions.push("刀锋够不到，只能擦伤");
  }
  const hurt = (damage: number) => Math.max(1, Math.round(damage * (cover ? 0.5 : exposed && skyOpen ? 1 : 0.2)));
  const tide = f.kit.step === "tide" && f.ranks[1] > 0 && artDue(round, 1);
  if (tide) marks.push("听潮步起势");
  if (tide) actions.push("听潮步闪避");
  const shout = f.kit.shout !== "off" && f.ranks[0] > 0 && artDue(round, 0);
  let interrupted = false;
  const cut = move.backwash && elapsed === 1 && choice === "safe";
  const reversed = move.backwash && elapsed === 1 && choice === "risk" && shout && move.interruptible;
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
      if (f.hp > 0 && exposed && skyOpen && f.sigilThrough >= round) ignite();
      continue;
    }
    if (art === 3) {
      const seal = f.loadout.charm === "postSeal" ? charmPower("postSeal", upgrade("postSeal")) : 0;
      if (seal) marks.push("驿桥路引 +" + seal);
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
  const responsePrep = (choice === "safe" || f.autoTactics && choice === "risk") && elapsed === (f.region === 1 ? 1 : 0);
  const artPrep = f.autoTactics && (interrupted && (f.region === 0 || f.region === bridgeRegion)
    || f.region === 2 && reveal || horseCharge && tide || watching && marks.includes("符火引爆"));
  const canPrepare = sky ? nearCliff && skyOpen : f.region < cliffRegion && (responsePrep || artPrep);
  if (f.hp > 0 && f.preparation === "ready" && canPrepare) {
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
    const ropeBonus = chasing && f.ranks[ropeStep] === 2 ? 10 : 0;
    const damage = deal(hurt((stats.damage + engraved + bladeBonus + bonus + rush + ropeBonus + (charge ? 12 : ambush ? 28 : 0)) * flank * seal));
    actions.push(`普攻刀伤 ${damage}`);
    if (sky && skyOpen) marks.push("普攻打实");
    if (damage > 0 && skyOpen && exposed && !cover && f.lampKnotRound === round && f.life < f.maxLife) {
      const heal = Math.min(f.maxLife - f.life, charmPower("lampKnot", upgrade("lampKnot")));
      f.life += heal;
      marks.push("续灯扣回气");
      actions.push(`续灯扣回气 ${heal}`);
    }
    if (f.region === 2) {
      struckTrue = exposed;
      const sealing = paperSealActive(f);
      if (!exposed) f.paperHits++;
      else if (!sealing || f.revealedThrough >= round) {
        if (sealing && f.paperHits) {
          marks.push("照影清纸痕");
          actions.push("照影显形，斩真身清掉纸痕");
        }
        f.paperHits = 0;
      }
      if (f.hp > 0 && f.paperHits === paperHitLimit) {
        if (sealing) {
          f.life = 0;
          marks.push("纸面封灯");
          actions.push("两道纸痕合拢，灯被纸面封住");
        } else {
          f.paperHits = 0;
          const damage = paperBacklashDamage + 8 * rank;
          f.life -= damage;
          backlash = true;
          marks.push("纸面反噬");
          actions.push(`连斩纸面招来反噬，扣 ${damage} 点气血`);
        }
      }
    }
  }
  if (interrupted && f.engraving?.id === "edge") f.cutRound = round;
  if (interrupted && sky) {
    f.skyDelayRound = round + 1;
    marks.push("截断升空");
    actions.push("落巢被截断，下一回合仍可近身");
  }
  if (interrupted && f.loadout.charm === "lampKnot") f.lampKnotRound = round + 1;
  if (trial?.id === "templeTrial" && trial.progress < trials.templeTrial.target) {
    trial.progress = struckTrue ? trial.progress + 1 : 0;
    if (trial.progress === trials.templeTrial.target) actions.push("三个名字都已写下");
  }
  if (lampTrial && lampTrial.progress < trials.lampTrial.target && f.hp <= 0) {
    f.hp = 1;
    actions.push("守灯影退到灯后，等两次应答后才能击退");
  }
  if (f.hp > 0 && flood) {
    f.life = 0;
    f.cue = "strike";
    actions.push("水满覆舟，阿照落水败阵");
    marks.push("覆舟");
  } else if (f.hp > 0 && f.life > 0 && !interrupted) {
    if (watching && round % 3 === 0) {
      f.wardStreak = f.ward > 0 ? f.wardStreak + 1 : 0;
      if (f.ward > 0) {
        f.life -= 28;
        marks.push("更印震响");
        actions.push("更印未破，震响扣 28 点气血");
      }
      if (wardSealActive(f) && f.wardStreak >= wardSealLimit) {
        f.life = 0;
        marks.push("更印封阵");
        actions.push("连续三次未破更印，阿照被困在印阵中");
      }
    }
    if (f.life <= 0) f.cue = "strike";
    else if (lampTrial && move.damage === 0) actions.push("守灯影整理灯纸，这轮没有攻击");
    else if (tide || f.realm >= 1 && f.kit.step === "basic" && move.wave && round % 3 === 1) {
      if (move.backwash) protectedLamp = true;
      actions.push(`闪避过${move.name}`);
      if (f.region === cliffRegion && move.name === "掠栈") marks.push("听潮步避开掠栈");
      if (pursuit && move.backwash && !cut) marks.push("听潮步避开沾衣");
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
      if (drenched) {
        power += riverPursuitDamage;
        marks.push("湿衣追篙");
        actions.push(`河伯趁衣湿赶上一篙，基础伤害 +${riverPursuitDamage}`);
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
      if (chant && f.preparation === "ready") {
        const aid = caseClues[hallRegion];
        const blocked = Math.min(aid.damage, damage - 1);
        damage -= blocked;
        f.preparation = "used";
        marks.push(aid.aid);
        actions.push(`${aid.aid}减伤 ${blocked}`);
      }
      if (chant && damage >= f.life && f.realm >= trueRealm && !f.trueGuardUsed) {
        f.trueGuardUsed = true;
        f.trueSigilReady = !!f.kit.sigil && f.ranks[4] > 0;
        damage = f.life - 1;
        marks.push("真人留息");
        actions.push("真人留息，保住 1 点气血");
      }
      f.life -= damage;
      actions.push(`${guard ? "架住" : ""}${move.name}，扣 ${damage} 点气血`);
      if (f.region === cliffRegion && move.name === "掠栈" && !(elapsed === 0 && choice === "safe")) {
        f.cliffStepRound = round;
        marks.push("掠栈踏空");
        actions.push("掠栈击中，下一回合落地受伤");
      }
      if (pursuit && move.backwash && !cut && damage >= riverDrenchDamage) {
        f.riverDrenched = true;
        marks.push("回浪沾衣");
        actions.push("回浪湿了衣衫，下一回合提防挥篙");
      }
      if (drenched && ++f.riverPursuits >= riverPursuitLimit) {
        f.life = 0;
        marks.push("追篙落水");
        actions.push("第二次被湿衣追篙击中，阿照落水");
      }
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
      if (guard && f.life > 0 && f.realm >= 2 && (!lampTrial || f.hp > 1 || lampTrial.progress >= trials.lampTrial.target)) {
        actions.push(`反击伤 ${deal(hurt(6))}`);
      }
    }
  }
  if (trial?.id === "ferryTrial" && protectedLamp && trial.progress < trials.ferryTrial.target) {
    trial.progress++;
    marks.push("渡灯未熄");
    actions.push("护住渡灯");
  }
  if (lampTrial && chant && f.life > 0 && lampTrial.progress < trials.lampTrial.target) {
    if (f.kit.stance === "guard" || f.ward <= 0) {
      lampTrial.progress++;
      marks.push("灯下应答");
      actions.push(`${f.kit.stance === "guard" ? "守式护灯" : "护纸已破"}，记第 ${lampTrial.progress} 次应答`);
      if (lampTrial.progress === trials.lampTrial.target) {
        f.ward = 0;
        marks.push("应答齐全");
        actions.push("两声应答齐全，守灯影的护纸散开");
      }
    } else {
      f.lampMissedRound = round;
      marks.push("应答被护纸挡住");
      actions.push(`护纸尚余 ${f.ward}，灯下这一声未能作答`);
    }
  }
  if (lampTrial && f.hp <= 0 && (lampTrial.progress < trials.lampTrial.target || f.life <= 0)) f.hp = 1;
  finishExchange();
  if (trial?.id === "templeTrial" && backlash) {
    f.result = "lost";
    f.lastThreat = f.autoTactics ? "纸面反噬吹熄了烛火。守式可挑灯，带照影可增加显形的回合。"
      : "纸面反噬吹熄了烛火。挑灯照出真身，或收刀等烛偏。";
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

export function forecastFight(fight: Fight, rounds = 6) {
  const f = structuredClone(fight);
  if (!f.autoTactics) f.order = undefined;
  const result: NonNullable<Fight["lastExchange"]>[] = [];
  for (let i = 0; i < rounds && f.result === "fighting"; i++) {
    resolveRound(f);
    if (f.lastExchange) result.push(f.lastExchange);
  }
  return { rounds: result, life: Math.max(0, f.life), hp: Math.max(0, f.hp), result: f.result,
    wardStreak: f.wardStreak, water: f.water, riverDrenched: f.riverDrenched, riverPursuits: f.riverPursuits,
    paperHits: f.paperHits, tacticsUsed: fight.focus - f.focus };
}

export function defeatSummary(fight: Fight) {
  if (fight.trial?.id === "lampTrial") {
    const missed = fight.lampMissedRound ? `第 ${fight.lampMissedRound} 回合护纸未破。` : "";
    return fight.life <= 0 ? `第 ${fight.round} 回合气血耗尽，已护住 ${fight.trial.progress} / 2 次应答。${missed}`
      : `第 ${fight.round} 回合试炼结束，已护住 ${fight.trial.progress} / 2 次应答，守灯影还剩 ${fight.hp} 气血。${missed}`;
  }
  if (fight.trial && fight.life > 0 && (fight.hp <= 0 || fight.round < fight.limit)) return fight.lastThreat;
  if (fight.region === skyRegion && fight.life > 0) return `第 ${fight.round} 回合交锋结束，衔灯鹞还剩 ${fight.hp} 气血。近刀在 ${fight.links["鹞影难及"] ?? 0} 个回合只能擦伤。`;
  if (fight.life > 0) return `回合已用尽，对手还剩 ${fight.hp} 点气血。`;
  const marks = fight.lastExchange?.marks ?? [];
  if (fight.region === cliffRegion) {
    if (marks.includes("落地败阵")) return fight.lastThreat;
    if (marks.includes("掠栈踏空")) return `第 ${fight.round} 回合被掠栈击倒。守式可以扶索减伤，听潮步可以闪避。`;
    return `第 ${fight.round} 回合气血耗尽。听潮步可避掠栈，落爪可用镇山喝截断。`;
  }
  if (fight.region === skyRegion) return `第 ${fight.round} 回合气血耗尽。踏缆步可追及贴崖的鹞影，镇山喝可截断落巢。`;
  if (marks.includes("覆舟")) return "水位涨满三格，阿照落水败阵。";
  if (marks.includes("追篙落水")) return `累计挨了两次湿衣追篙，阿照被打落水。避开回浪，或把回浪伤压到 ${riverDrenchDamage} 以下可以免沾衣。`;
  if (marks.includes("湿衣追篙")) return fight.autoTactics ? "回浪沾衣，下一回合被河伯追篙击倒。听潮步可以避浪，守式可在水位上涨后自动割缆。"
    : "回浪沾衣，下一回合被河伯追篙击倒。听潮步能避浪，也可在绷缆时提前割缆。";
  if (marks.includes("回浪沾衣")) return fight.autoTactics ? "阿照被回浪击倒。可带听潮步避浪，或换守式减轻重击。"
    : "阿照被回浪击倒。可带听潮步避浪，或提前割缆后用守式架住。";
  if (marks.includes("跌落驿桥")) return "第三次被横篙扫中，阿照跌落驿桥。";
  if (marks.includes("更印封阵")) return "三次敲更时更印都还在。第 3、6、9… 回合前用符火、揭印或刀伤破印。";
  if (marks.includes("纸面封灯")) return "两道纸痕合拢，封住了灯。照影期间斩中真身能清掉纸痕，也可趁挑灯尽早击退娘娘。";
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
