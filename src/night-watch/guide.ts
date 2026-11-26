import { altarRegion, arts, bridgeRegion, cliffRegion, courierRegion, hallRegion, heartRealm, realms, regions, skyRegion, stillDao, trials, watchRegion } from "./content.ts";
import type { TrialId } from "./content.ts";
import { automaticPreparationText, canChallenge, challengeClues, challengeRealms, clueCount, equippedArts, fightWardStrength, masteryCost, paperHorseBurn, paperSealActive, patrolRemaining, recordedClues, riverDrenchDamage, riverPursuitActive, wardSealActive, windSurveyReward } from "./game.ts";
import type { ArtId, Fight, Region, Save } from "./game.ts";
import { caseClues } from "./tactics.ts";

export type Tab = "patrol" | "practice" | "skills" | "archive" | "mirror" | "rematch" | TrialId;
type Result = { region: Region; won: boolean; drop?: boolean; trialId?: TrialId; mirrorLevel?: number };
type Target = { tab: Tab; action?: string; label: string };
export type Tip = { id: string; title: string; text: string; target?: Target };
export type PrepFocus = "weapon" | "armor" | "stance" | "fusion" | `art:${ArtId}`;
export type RecoveryTip = { text: string; label: string; focus: PrepFocus };

const caseAdvice = [
  "守式能架住虎啸。穿戴松纹刀，能多打出几分伤害。",
  "镇山喝可在第 3、6、9… 回合截断回浪，借浪压水位。守式也会找机会割缆。",
  "守式会在危险时挑灯照面。照影显形能让更多刀招打中真身。",
  "镇山喝能截住横篙，失足前换守式也可借墩稳身。",
  "守式会压灯卸势，听潮步可避开冲灯。",
  "寄灯符能借火破印。配挑灯诀可以持续引爆。",
  "守式扶索两次，听潮步可闪避掠栈。带镇山喝可在下一回合截断落爪。",
  "踏缆步追上贴崖的鹞影。守式自动压灯两次，镇山喝截断落巢后下一轮仍能打实。",
  "守式自动护灯。寄灯符配挑灯诀能烧掉护纸。",
  "守式能减伤。每次催灯前还要破覆簿纸，才会有人应答。",
] as const;

export function battleBrief(fight: Fight) {
  if (fight.watchCase) return {
    threat: `更印强度 ${fightWardStrength(fight)}。第 3、6、9… 回合敲更，连续两次未破会封阵。`,
    hint: "守式可自动揭印一次。寄灯符能借灯烧印，也可用刀招直接打破。破印后驿卒敲更会伤到自己。",
  };
  if (fight.paperHorseCase) return {
    threat: `第 2、5、8… 回合冲灯。马灯亮着时，冲灯命中还会灼伤 ${paperHorseBurn} 点。`,
    hint: "守式每战自动压灯一次。听潮步能避开之后的冲灯；也可用护具承伤，带折篙刀与驿桥路引加快收尾。",
  };
  if (fight.cloudMirror) return {
    threat: "掠栈提前到第 1、4、7… 回合。踏空后，下一轮先扣落地伤。",
    hint: "守式可以扶索。听潮步赶上的是下一回合的落爪，落地伤仍会先结算。",
  };
  if (fight.trial?.id === "cloudRelay") return {
    threat: "第 2、5、8… 回合掠栈。连续稳住两次风灯，再击退余影。",
    hint: "守式扶索或听潮步闪避都能记一次。踏空会清掉尚未达成的连续记录。",
  };
  if (fight.trial?.id === "rollCall") return {
    threat: trials.rollCall.goal,
    hint: trials.rollCall.hint,
  };
  if (fight.templeReprise) return {
    threat: "第 4、7、10… 回合烛偏见真身。累计两次斩中纸面就会封灯。",
    hint: "照影或照灯断影可以更早显形。显形期间斩中真身会清掉纸痕，守式另能挑灯两次。",
  };
  if (fight.altarMirror) return {
    threat: "十二回合内破三页。第二页第 6 回合覆上，第 7 回合末还在就会合镜。",
    hint: "第二页窗口错开了挑灯诀和照灯断影。可用镇山喝截铃锋接折篙刀，或用两轮刀伤直接破纸。",
  };
  const threat = [
    "第 3、6、9… 回合，山君吹起虎啸。",
    riverPursuitActive(fight) ? "挨两次湿衣追篙就会落水。" : "河伯汲水三次便会覆舟。",
    paperSealActive(fight) ? "第二道纸痕会封灯，必须打进真身窗口。" : "连续斩中两次纸面，会遭反噬。",
    "第三次被横篙逼得失足，就会跌下驿桥。",
    "纸马提灯冲撞，马灯在时刀伤减半。",
    wardSealActive(fight) ? "连续三次敲更时没破印，就会被封阵。" : "敲更时更印若还在，会震伤阿照。",
    "第 2、5、8… 回合掠栈。未避开也未扶索，就会在下一回合落地受伤。",
    "衔灯鹞升空时刀招只能擦伤。贴崖能追及，落巢能截断。",
    "第 3、6、9… 回合催灯术。活过该轮且护住灯或破掉护纸，才记一次应答。",
    "催灯前破覆簿纸，活过催灯轮。三站答齐、击退守灯妖才算取胜。",
  ][fight.region];
  const hint = riverPursuitActive(fight)
    ? `听潮步可以避浪，守式配镇潮印也可把回浪伤害压到 ${riverDrenchDamage} 以下，免于沾衣。`
    : fight.region === 1 && fight.riverWave === 2
    ? "听潮步能避开提前到第 2 回合的回浪，水位由割缆处理。"
    : fight.region === 2 && !fight.kit.reveal && !fight.rematchRank && !fight.mirrorLevel && !fight.trial
      ? "用守式挑灯照见真身。快些收尾，可以少受一轮反噬。"
      : caseAdvice[fight.region];
  return { threat, hint };
}

export function battleRecovery(save: Save, fight: Fight): RecoveryTip {
  const marks = fight.lastExchange?.marks ?? [];
  if (fight.watchCase) {
    if (!fight.kit.sigil && save.drops[4]) return { text: "寄灯符第 1 回合贴符，第 2 回合借灯破印。佩戴纸马灯芯，火伤再加 8。", label: "查看寄灯符", focus: "art:4" };
    return { text: "借灯的机会有限。比较兵刃和武学伤害，争取在下一次敲更前打空更印。", label: "比较兵刃", focus: "weapon" };
  }
  if (fight.paperHorseCase && fight.horseImpact) {
    if (fight.kit.step !== "tide" && save.drops[1]) return { text: "听潮步在冲灯回合闪避，渡水蓑还能随闪避回气。", label: "查看听潮步", focus: "art:1" };
    if (!equippedArts(fight.kit)[3] && save.drops[3]) return { text: "配折篙刀和驿桥路引，每次出刀多打 6 点，可以少扛几次冲灯。", label: "查看折篙刀", focus: "art:3" };
    return { text: "用守式卸掉第一次冲撞，穿上气血更高的护具撑过后续冲灯。", label: "比较护具", focus: "armor" };
  }
  if (fight.cloudMirror) {
    if (fight.kit.stance === "attack" && fight.life <= 0) return {
      text: "掠栈提前了。切守式可在第 1、4 回合扶索，避免这两次踏空。", label: "调整架势", focus: "stance",
    };
    if (fight.life <= 0) return {
      text: "换护具可以多撑一次落地。完成风灯接力后，守住前两次的配装还能借结扣多扶索一次。",
      label: "比较护具", focus: "armor",
    };
    return { text: "可以对照兵刃伤害，在十二回合内收尾。", label: "比较兵刃", focus: "weapon" };
  }
  if (fight.trial?.id === "cloudRelay" && fight.trial.progress < trials.cloudRelay.target) {
    return fight.kit.stance === "attack"
      ? { text: "切到守式可连续扶索两次。想保持攻式，可带听潮步在掠栈回合闪避。", label: "调整架势", focus: "stance" }
      : { text: "在第 2、5、8… 回合装备听潮步会自动闪避，护住风灯。", label: "查看听潮步", focus: "art:1" };
  }
  if (fight.trial?.id === "rollCall") {
    if (fight.trial.progress < trials.rollCall.target && fight.lampMissedRound
      && !fight.kit.lampFusion && !(fight.kit.sigil && fight.kit.kindle)) {
      return { text: "寄灯符在第 1、4 回合贴符，挑灯诀在第 2、5 回合引爆，赶在两次催灯前烧去护纸。", label: "查看寄灯符", focus: "art:4" };
    }
    if (fight.life <= 0) return { text: "催灯术每三轮打一次。用守式或换上气血更高的护具，多留一轮答话的时间。", label: "比较护具", focus: "armor" };
    return { text: "两人答完后要击退纸影。比较兵刃的刀伤，争取在下次催灯前收尾。", label: "比较兵刃", focus: "weapon" };
  }
  if (fight.templeReprise) {
    if (marks.includes("纸面封灯")) {
      if (save.lampFusion && !fight.kit.lampFusion) return {
        text: "照灯断影在第 2 回合显形，斩中真身就能清掉第一道纸痕。", label: "查看照灯断影", focus: "fusion",
      };
      if (!fight.kit.reveal && !fight.kit.lampFusion) return {
        text: "自然见真身的第 4 回合来得太晚。带照影，在前两回合显形时清掉纸痕。", label: "查看照影", focus: "art:2",
      };
      return { text: "守式在第 3、6、9… 回合可补两次挑灯，接上显形之间的空当。", label: "调整架势", focus: "stance" };
    }
    if (fight.life > 0) return { text: "留意战报里的显形回合，换一把能多打实伤害的兵刃。", label: "比较兵刃", focus: "weapon" };
    return { text: "催纸是重击，守式与护具能让阿照撑过下一轮显形。", label: "比较护具", focus: "armor" };
  }
  if (fight.altarMirror) {
    if (fight.altarMirror.pages === 1 && marks.includes("护纸合镜")) return {
      text: "第二页只能赶第 6、7 回合。差少量伤害可切攻式。守式也可以用镇山喝截铃锋，再接折篙刀。",
      label: "查看镇山喝", focus: "art:0",
    };
    if (fight.altarMirror.pages < 3 && !fight.kit.lampFusion && !(fight.kit.sigil && fight.kit.kindle)) {
      return save.lampFusion
        ? { text: "照灯断影能赶上首页和末页。第二页另留武学或刀伤。", label: "查看照灯断影", focus: "fusion" }
        : { text: "寄灯符配挑灯诀能烧首页与末页。第二页需要预留刀伤。", label: "查看寄灯符", focus: "art:4" };
    }
    if (fight.life > 0) return { text: "三页破齐后，还要在第十二回合内击退妖影。换刀可以缩短收尾。", label: "比较兵刃", focus: "weapon" };
    return { text: "可以比较护具和守更牌，把气血留到末页收尾。", label: "比较护具", focus: "armor" };
  }
  if (fight.altarAnswers) {
    if (fight.altarAnswers.progress < 3 && !fight.kit.lampFusion && !(fight.kit.sigil && fight.kit.kindle)) {
      return save.lampFusion
        ? { text: "照灯断影会在第 2、5、8… 回合破纸，赶在催灯前照见需要应答的人。", label: "查看照灯断影", focus: "fusion" }
        : { text: "寄灯符配挑灯诀可以在催灯前烧去覆簿纸。守式帮你留出承伤余量。", label: "查看寄灯符", focus: "art:4" };
    }
    return { text: "用守式和守更牌压低催灯术伤害，留出气血等下一站应答。", label: "调整架势", focus: "stance" };
  }
  if (fight.trial?.id === "lampTrial") {
    if (fight.kit.stance !== "guard" && fight.trial.progress < 2) return {
      text: "守式在催灯轮自动护灯。想继续用攻式，可以先用寄灯符配挑灯诀烧去护纸。",
      label: "调整架势", focus: "stance",
    };
    return { text: "守更牌能压低催灯术伤害。也可以换上气血更高的护具，留出撑过两次催灯的余量。",
      label: "比较护具", focus: "armor" };
  }
  if (fight.region === skyRegion && fight.links["鹞影难及"] > 0) {
    if (fight.kit.step !== "rope") return {
      text: "踏缆步在第 2、5、8… 回合追上衔灯鹞，让同回合的刀招打实。", label: "查看踏缆步", focus: "art:6",
    };
    if (fight.kit.shout === "off") return {
      text: "镇山喝截断落巢后，下一回合还能近身，也会少吃一轮落巢重击。", label: "查看镇山喝", focus: "art:0",
    };
  }
  if (fight.region === cliffRegion && fight.life <= 0) {
    if (fight.kit.step !== "tide" && save.drops[1]) {
      return { text: "听潮步能闪避第 2、5、8… 回合的掠栈，避开就不会踏空。", label: "查看听潮步", focus: "art:1" };
    }
    if (fight.kit.stance !== "guard" && fight.kit.step !== "tide") {
      return { text: "切到守式，阿照能扶索稳住前两次被掠栈击中的脚步。", label: "调整架势", focus: "stance" };
    }
    if (fight.kit.shout === "off" && save.drops[0]) {
      return { text: "镇山喝可以截断第 3、6、9… 回合的落爪。若上一轮踏空，落地伤会先结算。", label: "查看镇山喝", focus: "art:0" };
    }
  }
  if (marks.includes("更印封阵") || marks.includes("更印震响") ||
    wardSealActive(fight) && (fight.links["更印震响"] > 0 || !fight.kit.sigil && fight.links["揭去更印"] > 0)) {
    if (fight.kit.sigil && !fight.kit.kindle && save.drops[5]) {
      return { text: "两次借火用完后，更印还会重结。带挑灯诀，把每道寄灯符都引爆。", label: "查看挑灯诀", focus: "art:5" };
    }
    if (fight.kit.sigil && fight.kit.kindle) {
      return { text: "符火已经在用。可比较兵刃的刀伤，赶在再次敲更前收尾。", label: "比较兵刃", focus: "weapon" };
    }
    return { text: "装备寄灯符，阿照就能借火破印。配上挑灯诀，每次贴符后还能接着引爆。", label: "查看寄灯符", focus: "art:4" };
  }
  if (riverPursuitActive(fight) && !marks.includes("覆舟") && (fight.links["湿衣追篙"] || fight.riverDrenched)) {
    return { text: `听潮步可以避浪。守式配镇潮印把回浪伤害压到 ${riverDrenchDamage} 以下，也能免于沾衣。`, label: "查看听潮步", focus: "art:1" };
  }
  if (marks.includes("覆舟") || fight.trial?.id === "ferryTrial") {
    if (!fight.loadout.weapon && save.ownedGear.some(id => id === "pineBlade" || id === "reedBlade")) {
      return { text: "先穿上行囊里的兵刃，争取在第三次汲水前收尾。", label: "换上兵刃", focus: "weapon" };
    }
    if (fight.riverWave === 3 && save.drops[0] && fight.kit.shout === "off") {
      return { text: "带镇山喝，在第 3 回合对上回浪，就能借浪清水。松纹刀还能借截断加伤。", label: "查看镇山喝", focus: "art:0" };
    }
    if (fight.riverWave === 2 && fight.kit.step !== "tide" && save.drops[1]) {
      return { text: "提前的回浪正好撞上听潮步。守式割缆对付水位，听潮步对付浪伤。", label: "查看听潮步", focus: "art:1" };
    }
    return fight.kit.stance === "guard"
      ? { text: "两次割缆换来的时间有限。比较兵刃的刀伤，在水位再涨满前收尾。", label: "比较兵刃", focus: "weapon" }
      : { text: "换守式，阿照会在水位开始上涨后尝试割缆。", label: "调整架势", focus: "stance" };
  }
  if (marks.includes("纸面封灯")) {
    return fight.kit.reveal
      ? { text: "提高真身窗口里的有效刀伤，赶在两道纸痕合拢前结束。守式可以挑灯多争取几轮。", label: "比较兵刃", focus: "weapon" }
      : { text: "照影显形时斩中真身能清纸痕。也可以用守式挑灯，把刀伤打进亮灯的几轮。", label: "查看照影", focus: "art:2" };
  }
  if (marks.includes("纸面反噬") || fight.trial?.id === "templeTrial") {
    return save.drops[2] && !fight.kit.reveal
      ? { text: "照影让接下来的刀招打中真身。照影没有覆盖时，守式会找机会挑灯。", label: "查看照影", focus: "art:2" }
      : fight.kit.stance === "attack"
        ? { text: "换成守式，阿照会在纸面干扰时挑灯。利用亮灯的几轮尽快收尾。", label: "调整架势", focus: "stance" }
        : { text: "挑灯的窗口有限，试试提高能打中真身的刀伤。", label: "比较兵刃", focus: "weapon" };
  }
  if (marks.includes("跌落驿桥")) {
    return { text: "镇山喝会在第 3、6、9… 回合截住横篙，帮阿照站稳。", label: "查看镇山喝", focus: "art:0" };
  }
  if (fight.life > 0) {
    return { text: `回合用尽时对手还剩 ${fight.hp} 气血。可以换刀或检查装备词条是否触发。`, label: "比较兵刃", focus: "weapon" };
  }
  if (fight.kit.stance === "attack") {
    return { text: "切到守式可以架住重击。换好后用战前预览检查少掉多少气血。", label: "调整架势", focus: "stance" };
  }
  return { text: "看看行囊里的护具能增加多少气血，再对照战报里伤害最高的回合。", label: "比较护具", focus: "armor" };
}

export function cliffGateText(save: Save) {
  if (!save.windSurveyed) {
    const reward = windSurveyReward(save);
    return `去妖案查看风灯${reward ? `，预计获得 ${reward} 道行` : ""}。查明风灯且累计道行达到 ${stillDao} 可入坐忘。`;
  }
  const needed = Math.max(0, stillDao - save.lifetimeDao);
  return needed ? `风灯已查明。离坐忘还差 ${needed} 道行，约再巡 ${Math.ceil(needed / regions[cliffRegion].reward)} 只小妖。`
    : "风灯已查明，已入坐忘。可以挑战回风鸮。";
}

export function clueTip(save: Save, showRead = false) {
  const region = save.region;
  if (region === hallRegion) return;
  if (save.victories[region]) return;
  const step = recordedClues(save);
  if (!step || !showRead && !save.guide.enabled) return;
  const available = canChallenge(save, region);
  const id = `clue-${region}-${step}${step >= challengeClues && !available ? "-locked" : ""}`;
  if (!showRead && save.guide.dismissed.includes(id)) return;
  const enemy = regions[region].boss;
  const advice = region === 2 && !save.drops[2] ? "守式会在危险时挑灯照面。" : caseAdvice[region];
  const unlock = available ? `现在可以挑战${enemy}。` : region === cliffRegion
    ? cliffGateText(save) : `进入${realms[challengeRealms[region]]}境后可挑战${enemy}。`;
  if (step === 1) return {
    id, step, title: `第一条线索 · ${regions[region].clues[0]}`, text: caseClues[region].danger, label: "查看首领招路",
  };
  if (step === challengeClues) return {
    id, step, title: region === 1 ? "第二条线索 · 第三声来自船底" : "第二条线索 · 找到应对",
    text: `${unlock}${advice}第三条线索能为这场交锋再添一处准备。`, label: region === 1 ? "查看水下应铃" : "查看应对办法",
  };
  return {
    id, step, title: "第三条线索 · 应变已备好",
    text: `${automaticPreparationText(region)}${available ? "出战前可查看这次准备。" : unlock}`,
    label: "查看备战效果",
  };
}

export function nextTip(save: Save, tab: Tab, result: Result | null): Tip | undefined {
  if (!save.guide.enabled) return;
  const tip = candidate(save, tab, result);
  if (tip && !save.guide.dismissed.includes(tip.id)) return tip;
}

function candidate(save: Save, tab: Tab, result: Result | null): Tip | undefined {
  if (tab === "patrol" && result && !result.won) return defeatTip(save, result.region);
  if (tab === "archive") {
    if (save.victories[2]) return { id: "archive-after-chapter", title: "卷末去处",
      text: "随陆婆过河去纸马驿。也可以挑战强化后的首领，或去照妖镜。" };
    return save.victories[0] ? {
      id: "archive", title: "换路与强敌再战",
      text: "点地名旁的「前往」换路。「强敌再战」可以挑战强化后的大妖，提升当地装备。",
    } : undefined;
  }
  if (tab === "skills" && result && !result.won && !result.trialId && !result.mirrorLevel) return defeatTip(save, result.region);
  if (tab === "skills") {
    const unlearned = arts.findIndex((art, i) => save.drops[i] && !save.ranks[i] && save.realm >= art.realm &&
      !save.guide.dismissed.includes(`learn-${i}`));
    if (unlearned >= 0) return learnTip(unlearned as ArtId);
    const brought = equippedArts(save.kit);
    const learned = save.ranks.findIndex((rank, i) => rank > 0 && !brought[i] && !(save.lampFusion && (i === 2 || i === 5))
      && !save.guide.dismissed.includes(`equip-${i}`));
    if (learned >= 0) return equipTip(learned as ArtId);
    if (save.ranks[5] && save.ranks[4] && !save.guide.dismissed.includes("preset-fire")) return {
      id: "preset-fire", title: "一轮贴符，下一轮引爆",
      text: "寄灯符在第 1、4、7 回合贴符，挑灯诀紧接着引爆。把它们配好后，可在「两套配装」里和截断搭配各存一套。",
    };
    if (save.dao >= masteryCost && save.ranks.includes(1) && !save.guide.dismissed.includes("mastery")) {
      return {
        id: "mastery", title: "精通招式",
        text: "精通会强化招式效果，出招回合照旧。精通只花可用道行，累计道行照常保留。",
        target: { tab: "skills", action: `mastery:${save.ranks.indexOf(1)}`, label: "查看精通" },
      };
    }
    if (save.realm >= heartRealm) return { id: "second-weapon", title: "心斋 · 第二武学位",
      text: "镇山喝与折篙刀都在第三回合出手。把镇山喝排在前，截断后折篙刀会多追一斩。" };
    if (save.realm >= 3) return insightTip();
    if (save.realm >= 1) return stepTip();
    return;
  }
  if (tab === "practice") {
    if (save.realm === 3) return insightTip();
    if (save.realm === 1 && !save.kills[1]) return {
      ...stepTip(),
      target: { tab: "patrol", action: "region:1", label: "前往芦花渡" },
    };
    return;
  }
  if (tab !== "patrol") return;

  if (result?.drop && result.region !== skyRegion && result.region !== hallRegion && result.region !== altarRegion && !save.ranks[result.region] && !save.guide.dismissed.includes(`learn-${result.region}`)) return learnTip(result.region);
  if (save.region === courierRegion && !save.victories[courierRegion] && canChallenge(save, courierRegion)) {
    return { id: "courier-preview", title: "纸马的灯罩着它", text: "第二回合冲灯前，压灯可放倒马灯并减伤。迎灯进刀伤害更高，也会挨完整一撞。",
      target: { tab: "skills", action: "preview", label: "查看纸马招路" } };
  }
  if (save.region === watchRegion && !save.victories[watchRegion] && canChallenge(save, watchRegion)) {
    return { id: "watch-preview", title: "赶在敲更前破印", text: "带寄灯符出战。第二回合可「借灯引符」，趁第三回合敲更前烧去更印。",
      target: { tab: "skills", action: "preview", label: "查看驿卒招路" } };
  }
  if (save.victories[2] && !save.victories[bridgeRegion]) {
    if (save.region !== bridgeRegion) return {
      id: "post-road", title: "随陆婆过河", text: "芦花渡的铃已经收了，纸马驿却也应了第三声。陆婆在渡口等阿照上船。",
      target: { tab: "patrol", action: "region:3", label: "随陆婆过河" },
    };
    if (canChallenge(save, bridgeRegion)) return {
      id: "post-duel", title: "留意桥边", text: "篙鬼每三回合横扫。借墩稳身能消掉失足，镇山喝能截断横篙。",
      target: { tab: "skills", action: "preview", label: "查看篙鬼招谱" },
    };
  }

  if (!patrolRemaining(save)) {
    const next = save.region + 1;
    const won = save.victories[save.region] > 0;
    return { id: `swept-${save.region}-${won}`, title: "小妖已扫清",
      text: won && next < regions.length ? `该往${regions[next].name}走了。` : won ? "强敌再战能强化旧装备，也能找回遗漏的本地掉落。" : `${regions[save.region].boss}的踪迹已经找齐。`,
      target: won && next >= regions.length ? { tab: "archive", label: "打开斩妖录" } :
        { tab: "patrol", action: won ? `region:${next}` : `fight:${save.region}`, label: won ? "前往" + regions[next].name : "挑战" + regions[save.region].boss } };
  }
  if (!save.victories[0]) {
    if (canChallenge(save, 0)) return {
      id: "first-boss", title: "初次问妖",
      text: "点挑战山君，看看虎啸是在第几回合。穿上刚捡的松纹刀，守式能帮你架住虎啸。",
      target: { tab: "patrol", action: "fight:0", label: "挑战山君" },
    };
    if (save.ownedGear.length && !Object.keys(save.loadout).length && !save.guide.dismissed.includes("first-gear")) {
      return { id: "first-gear", title: "拾到装备", text: "阿照停下来查看随身装备。想用就穿戴，想留着就收入行囊。",
        target: { tab: "patrol", action: "slot:" + (save.ownedGear.includes("pineBlade") ? "weapon" : "armor"), label: "查看槽位" } };
    }
    return { id: "click-patrol", title: "提灯夜行", text: "提灯上山。斩到第三只会看见山君的招路，第七只后就能挑战。",
      target: { tab: "patrol", action: "hunt", label: "提灯夜行" } };
  }
  if (!save.victories[1]) {
    if (!save.ranks[0] && save.drops[0] && !save.guide.dismissed.includes("learn-0")) return learnTip(0);
    if (save.ranks[0] && save.kit.shout === "off" && !save.guide.dismissed.includes("equip-0")) return equipTip(0);
    if (!save.autoPatrol && !save.guide.dismissed.includes("auto-patrol")) return {
      id: "auto-patrol", title: "山路已熟",
      text: "阿照记住了山路。点「沿路巡夜」，她就会一路寻妖；拾到新装备时会停下来等你查看。",
      target: { tab: "patrol", action: "auto-patrol", label: "沿路巡夜" },
    };
    if (save.region === 0 && !save.kills[1]) return {
      id: "ferry-road", title: "去芦花渡夜行", text: "去芦花渡的路已经通了。点「前往芦花渡」换路，每斩一只小妖可得 3 道行。",
      target: { tab: "patrol", action: "region:1", label: "前往芦花渡" },
    };
    if (save.region === 1 && canChallenge(save, 1)) return {
      id: "river-preview", title: "看一眼回浪的来路",
      text: "河伯每次汲水会涨一格，涨满三格就会覆舟。绷缆时割缆可以清空水位，带镇山喝还可引浪撞舟。",
      target: { tab: "skills", action: "preview", label: "对照敌我招谱" },
    };
    return;
  }
  if (!save.victories[2]) {
    if (save.region === 1 && !save.kills[2]) return {
      id: "temple-road", title: "去白烛庙查案",
      text: "胜过河伯，去庙街的路就通了。到庙街斩妖攒道行，进入听息境并找到两条线索后便可挑战娘娘。",
      target: { tab: "patrol", action: "region:2", label: "前往白烛庙" },
    };
    if (save.realm === 3 && save.region === 2 && clueCount(save) < challengeClues) return insightTip();
  }
}

function learnTip(art: ArtId): Tip {
  return {
    id: `learn-${art}`, title: `新传承 · ${arts[art].name}`,
    text: `花 ${arts[art].cost} 道行可修习${arts[art].name}。选「修习并装备」，阿照便会把它带进交锋。`,
    target: { tab: "skills", action: `art:${art}`, label: "查看招谱" },
  };
}

function equipTip(art: ArtId): Tip {
  return {
    id: `equip-${art}`, title: `装备${arts[art].name}`,
    text: `这门${arts[art].kind}在第 ${arts[art].first} 回合出手，此后每隔 ${arts[art].every} 回合再出一招。换招免费，下次交锋生效。`,
    target: { tab: "skills", action: `art:${art}`, label: "查看招谱" },
  };
}

function stepTip(): Tip {
  return {
    id: "first-step", title: "身法位已开启",
    text: "舒筋可带一门身法，阿照先用退步。修习听潮步后，可以在「招式」页换上。",
  };
}

function insightTip(): Tip {
  return {
    id: "first-insight", title: "神通位已开启",
    text: "听息让阿照在烛偏时辨出娘娘真身。悟得神通后，可以在「招式」页修习和装备。",
  };
}

function defeatTip(save: Save, region: Region): Tip {
  const precise = save.guide.defeats[region] >= 2;
  const clues = [
    "打开交锋详情，找出虎啸在哪一回合命中，再看看自己的架势。",
    "先穿好兵刃和护具。守式会找机会割缆，镇山喝也能截住按期到来的回浪。",
    "接连斩中两次纸面会受到反噬。打开交锋详情，看看反噬发生在哪一回合。",
    "横篙命中三次会掉下桥。看第 3、6、9 回合的失足变化。",
    "马灯还亮时，冲灯命中会灼伤。用守式压灯减伤，或用听潮步避开冲撞。",
    "驿卒会重复结更印。看战报里哪几回合出现震响，确认破印的时机。",
    "先看第几回合踏空，再看下一回合的落地伤。",
    "先看哪些回合刀招只能擦伤，哪些回合可以打实。",
    "催灯前查看护纸是否打破，活过该回合才有应答。",
    "看是哪一站卡在覆簿纸后，再调整催灯前一回合的招式。",
  ];
  const advice = [
    "用守式应战，虎啸原本要扣 36 点气血，架住后只扣 7 点。",
    "守式割缆能清水位。带松纹刀和镇山喝，截断时能多打伤害，也能借浪清水位。",
    "烛偏时能打中真身。守式挑灯后连续三回合能看到真身，照影还可以显形。",
    "装备镇山喝，每三回合截断横篙。用守式也有机会借墩稳住脚。",
    "试试守式。压灯可以减伤，让冲灯回合的刀招打实。",
    "装备寄灯符，借火能烧去更印。学会挑灯诀后，符火可以持续引爆。",
    "听潮步能避掠栈。守式能扶索两次，镇山喝可截断落爪。",
    "第 2 回合可用踏缆步追及，第 3 回合可用镇山喝截断落巢。两者改变的回合不同。",
    "守式自动护灯，攻式可以用符火破纸。",
    "先用符火或照灯断影破纸，再用守式度过催灯。三站各需要一次。",
  ];
  return {
    id: `defeat-${region}-${precise ? 2 : 1}`, title: precise ? "再试一个解法" : "先看败在哪里",
    text: precise ? advice[region] : clues[region],
    target: { tab: "skills", action: "preview", label: `查看${regions[region].boss}招谱` },
  };
}
