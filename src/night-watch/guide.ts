import { arts, bridgeRegion, courierRegion, heartRealm, realms, regions, watchRegion } from "./content.ts";
import type { TrialId } from "./content.ts";
import { automaticPreparationText, canChallenge, challengeClues, challengeRealms, clueCount, equippedArts, masteryCost, paperSealActive, patrolRemaining, recordedClues, riverDrenchDamage, riverPursuitActive, wardSealActive } from "./game.ts";
import type { Fight, Region, Save } from "./game.ts";
import { caseClues } from "./tactics.ts";

export type Tab = "patrol" | "practice" | "skills" | "archive" | "mirror" | "rematch" | TrialId;
type Result = { region: Region; won: boolean; drop?: boolean; trialId?: TrialId; mirrorLevel?: number };
type Target = { tab: Tab; action?: string; label: string };
export type Tip = { id: string; title: string; text: string; target?: Target };
export type PrepFocus = "weapon" | "armor" | "stance" | `art:${Region}`;
export type RecoveryTip = { text: string; label: string; focus: PrepFocus };

const caseAdvice = [
  "守式能架住虎啸。穿戴松纹刀，能多打出几分伤害。",
  "镇山喝对上回浪时能借浪清水。守式也会找机会割缆。",
  "守式会在危险时挑灯照面。照影显形能让更多刀招打中真身。",
  "镇山喝能截住横篙，失足前换守式也可借墩稳身。",
  "守式会压灯卸势，听潮步可避开冲灯。",
  "寄灯符能借火破印。配挑灯诀可以持续引爆。",
] as const;

export function battleBrief(fight: Fight) {
  const threat = [
    "第 3、6、9… 回合，山君吹起虎啸。",
    riverPursuitActive(fight) ? "挨两次湿衣追篙就会落水。" : "河伯汲水三次便会覆舟。",
    paperSealActive(fight) ? "第二道纸痕会封灯，必须打进真身窗口。" : "连续斩中两次纸面，会遭反噬。",
    "第三次被横篙逼得失足，就会跌下驿桥。",
    "纸马提灯冲撞，马灯在时刀伤减半。",
    wardSealActive(fight) ? "连续三次敲更时没破印，就会被封阵。" : "敲更时更印若还在，会震伤阿照。",
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

export function clueTip(save: Save, showRead = false) {
  const region = save.region;
  if (save.victories[region]) return;
  const step = recordedClues(save);
  if (!step || !showRead && !save.guide.enabled) return;
  const available = canChallenge(save, region);
  const id = `clue-${region}-${step}${step >= challengeClues && !available ? "-locked" : ""}`;
  if (!showRead && save.guide.dismissed.includes(id)) return;
  const enemy = regions[region].boss;
  const advice = region === 2 && !save.drops[2] ? "守式会在危险时挑灯照面。" : caseAdvice[region];
  const unlock = available ? `现在可以挑战${enemy}。` : `进入${realms[challengeRealms[region]]}境后可挑战${enemy}。`;
  if (step === 1) return {
    id, step, title: `第一条线索 · ${regions[region].clues[0]}`, text: caseClues[region].danger, label: "查看首领招路",
  };
  if (step === challengeClues) return {
    id, step, title: "第二条线索 · 找到应对",
    text: `${unlock}${advice}第三条线索能为这场交锋再添一处准备。`, label: "查看应对办法",
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
    if (unlearned >= 0) return learnTip(unlearned as Region);
    const brought = equippedArts(save.kit);
    const learned = save.ranks.findIndex((rank, i) => rank > 0 && !brought[i] && !save.guide.dismissed.includes(`equip-${i}`));
    if (learned >= 0) return equipTip(learned as Region);
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

  if (result?.drop && !save.ranks[result.region] && !save.guide.dismissed.includes(`learn-${result.region}`)) return learnTip(result.region);
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
      id: "post-road", title: "随陆婆过河", text: "芦花渡对岸是纸马驿。跟陆婆过河，去查桥下传来的半声铃。",
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

function learnTip(art: Region): Tip {
  return {
    id: `learn-${art}`, title: `新传承 · ${arts[art].name}`,
    text: `花 ${arts[art].cost} 道行可修习${arts[art].name}。选「修习并装备」，阿照便会把它带进交锋。`,
    target: { tab: "skills", action: `art:${art}`, label: "查看招谱" },
  };
}

function equipTip(art: Region): Tip {
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
  ];
  const advice = [
    "用守式应战，虎啸原本要扣 36 点气血，架住后只扣 7 点。",
    "守式割缆能清水位。带松纹刀和镇山喝，截断时能多打伤害，也能借浪清水位。",
    "烛偏时能打中真身。守式挑灯后连续三回合能看到真身，照影还可以显形。",
    "装备镇山喝，每三回合截断横篙。用守式也有机会借墩稳住脚。",
    "试试守式。压灯可以减伤，让冲灯回合的刀招打实。",
    "装备寄灯符，借火能烧去更印。学会挑灯诀后，符火可以持续引爆。",
  ];
  return {
    id: `defeat-${region}-${precise ? 2 : 1}`, title: precise ? "再试一个解法" : "先看败在哪里",
    text: precise ? advice[region] : clues[region],
    target: { tab: "skills", action: "preview", label: `查看${regions[region].boss}招谱` },
  };
}
