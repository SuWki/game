import { arts, heartRealm } from "./content.ts";
import { equipment, gearDisplayName, gearRank, knownGear } from "./equipment.ts";
import type { GearId } from "./equipment.ts";
import {
  applyPreset, enableCombatTactics, engravings, equipArt, equippedArts, equipLampFusion, masteryCost, replacedArt, study, tickFight, tuneEngraving, weaponArts,
} from "./game.ts";
import type { ArtId, Engraving, Fight, Kit, PresetSlot, Save } from "./game.ts";

export type BuildChange =
  | { kind: "gear"; id: GearId }
  | { kind: "stance"; stance: Kit["stance"] }
  | { kind: "art"; id: ArtId; learn: boolean }
  | { kind: "mastery"; id: ArtId }
  | { kind: "engraving"; id: Engraving }
  | { kind: "weapon-order" }
  | { kind: "lamp-fusion" }
  | { kind: "preset"; slot: PresetSlot };

export type BuildSuggestion = { changes: BuildChange[]; label: string; cost: number; outcome: Fight };

export function previewBattle(fight: Fight): Fight {
  const outcome = structuredClone(fight);
  if (enableCombatTactics(outcome)) {
    while (outcome.result === "fighting") tickFight(outcome);
  }
  return outcome;
}

function applyOne(save: Save, change: BuildChange) {
  switch (change.kind) {
    case "gear": {
      if (!knownGear(change.id) || !save.ownedGear.includes(change.id)) return false;
      const slot = equipment[change.id].slot;
      if (save.loadout[slot] === change.id) return false;
      save.loadout[slot] = change.id;
      save.newGear = save.newGear.filter(id => id !== change.id);
      return true;
    }
    case "stance":
      if (!["attack", "guard"].includes(change.stance) || save.kit.stance === change.stance) return false;
      save.kit.stance = change.stance;
      return true;
    case "art": {
      const id = change.id;
      if (!Object.hasOwn(arts, id) || equippedArts(save.kit)[id]) return false;
      if (change.learn) {
        if (save.ranks[id] !== 0 || !study(save, id)) return false;
      } else if (!save.ranks[id] || save.realm < arts[id].realm) return false;
      equipArt(save, id, true);
      return equippedArts(save.kit)[id];
    }
    case "mastery":
      return save.ranks[change.id] === 1 && equippedArts(save.kit)[change.id] && study(save, change.id);
    case "engraving":
      return Object.hasOwn(engravings, change.id) && save.mirror.equipped !== change.id && tuneEngraving(save, change.id, "equip");
    case "lamp-fusion":
      return equipLampFusion(save, true);
    case "weapon-order": {
      const second = weaponArts(save.kit)[1];
      if (save.realm < heartRealm || second === undefined) return false;
      save.kit.firstWeapon = second;
      return true;
    }
    case "preset":
      return (change.slot === 0 || change.slot === 1) && applyPreset(save, change.slot);
  }
}

export function changeLabel(save: Save, change: BuildChange) {
  switch (change.kind) {
    case "gear":
      return `换上${gearDisplayName(change.id, gearRank(change.id, save.rematchRanks), save.reforges)}`;
    case "stance":
      return change.stance === "guard" ? "切换守式" : "切换攻式";
    case "art": {
      const previous = replacedArt(save, change.id);
      return `${change.learn ? "修习并装备" : "装备"}${arts[change.id].name}${previous === undefined ? "" : `（替下${arts[previous].name}）`}`;
    }
    case "mastery":
      return `精通${arts[change.id].name}`;
    case "engraving":
      return `换上${engravings[change.id].name}`;
    case "lamp-fusion":
      return "装备照灯断影";
    case "weapon-order":
      return `让${arts[weaponArts(save.kit)[1]].name}先出手`;
    case "preset":
      return `换成配装「${save.presets[change.slot]?.name}」`;
  }
}

export function applyBuildChange(save: Save, changes: readonly BuildChange[]) {
  if (!changes.length || changes.length > 2) return false;
  const draft = structuredClone(save);
  if (!changes.every(change => applyOne(draft, change))) return false;
  save.kit = draft.kit;
  save.loadout = draft.loadout;
  save.newGear = draft.newGear;
  save.dao = draft.dao;
  save.ranks = draft.ranks;
  save.mirror.equipped = draft.mirror.equipped;
  return true;
}

// Only test pairs that go together in battle. This keeps the alternatives readable
// and avoids trying every possible combination of stash items.
const compatible = [
  ["pineBlade", 0], ["reedBlade", 1], ["templeBlade", 2], ["ferryCoat", 1],
  ["templeCoat", 2], ["postSeal", 3], ["courierSeal", 4], ["lampKnot", 0],
] as const;
const pairedArts = [[0, 3], [1, 2], [4, 5], [0, 6]] as const;

export function availableBuildChanges(save: Save) {
  const stance: BuildChange = { kind: "stance", stance: save.kit.stance === "guard" ? "attack" : "guard" };
  const worn = equippedArts(save.kit);
  const gear = [...new Set(save.ownedGear)].filter(id => knownGear(id) && save.loadout[equipment[id].slot] !== id)
    .map(id => ({ kind: "gear", id }) as const);
  const moves = arts.flatMap((art, index) => {
    const id = index as ArtId;
    if (save.lampFusion && (id === 2 || id === 5)) return [];
    return !worn[id] && save.realm >= art.realm && (save.ranks[id] || save.drops[id] && save.dao >= art.cost)
      ? [{ kind: "art", id, learn: !save.ranks[id] } as const] : [];
  });
  const singles: BuildChange[] = [...moves, stance, ...gear];
  if (save.dao >= masteryCost) {
    for (const [id, equipped] of worn.entries()) {
      if (equipped && save.ranks[id] === 1) singles.push({ kind: "mastery", id: id as ArtId });
    }
  }
  if (save.lampFusion && !save.kit.lampFusion) singles.push({ kind: "lamp-fusion" });
  if (weaponArts(save.kit).length === 2) singles.push({ kind: "weapon-order" });
  for (const id of Object.keys(engravings) as Engraving[]) {
    if (save.mirror.ranks[id] && save.mirror.equipped !== id) singles.push({ kind: "engraving", id });
  }
  return { singles, stance, gear, moves };
}

export function previewBuild(save: Save, createFight: (draft: Save) => Fight | undefined, changes: BuildChange[]): BuildSuggestion | undefined {
  const draft = structuredClone(save);
  const labels: string[] = [];
  for (const change of changes) {
    const label = changeLabel(draft, change);
    if (!applyOne(draft, change)) return;
    labels.push(label);
  }
  const encounter = createFight(draft);
  if (encounter) return { changes, label: labels.join("，"), cost: save.dao - draft.dao, outcome: previewBattle(encounter) };
}

export function battleBuildImproves(current: Fight, outcome: Fight) {
  if (outcome.result !== "won" || outcome.life <= 0) return false;
  if (current.result === "lost") return true;
  const lifeGain = outcome.life / outcome.maxLife - current.life / current.maxLife;
  const roundsSaved = current.round - outcome.round;
  return lifeGain >= 0.10 && roundsSaved >= 0 || roundsSaved >= 2 && lifeGain >= 0;
}

export function compareBattleBuilds(save: Save, createFight: (draft: Save) => Fight | undefined, current?: Fight): BuildSuggestion[] {
  if (!current) {
    const encounter = createFight(save);
    if (!encounter) return [];
    current = previewBattle(encounter);
  }
  if (current.result === "fighting") return [];
  const { singles, stance, gear, moves } = availableBuildChanges(save);
  const tryChanges = (changes: BuildChange[]) => {
    const build = previewBuild(save, createFight, changes);
    if (build && battleBuildImproves(current, build.outcome)) return build;
  };
  const winners = singles.map(change => tryChanges([change])).filter((item): item is BuildSuggestion => !!item);
  if (!winners.length) {
    const addPair = (first: BuildChange | undefined, second: BuildChange | undefined) => {
      if (!first || !second) return;
      const win = tryChanges([first, second]);
      if (win) winners.push(win);
    };
    for (const [id, move] of compatible) addPair(gear.find(item => item.id === id), moves.find(item => item.id === move));
    for (const [first, second] of pairedArts) addPair(moves.find(item => item.id === first), moves.find(item => item.id === second));
    for (const move of moves) addPair(stance, move);
    for (const item of gear) addPair(stance, item);
    for (const slot of [0, 1] as const) {
      if (!save.presets[slot]) continue;
      const win = tryChanges([{ kind: "preset", slot }]);
      if (win) winners.push(win);
    }
  }
  return winners.sort((a, b) => a.cost - b.cost || a.changes.length - b.changes.length
    || a.outcome.round - b.outcome.round || b.outcome.life / b.outcome.maxLife - a.outcome.life / a.outcome.maxLife).slice(0, 2);
}
