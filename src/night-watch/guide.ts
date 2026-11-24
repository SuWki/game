import { arts, regions } from "./content.ts";
import type { TrialId } from "./content.ts";
import { canChallenge, clueCount, equippedArts, masteryCost, patrolRemaining } from "./game.ts";
import type { Region, Save } from "./game.ts";

export type Tab = "patrol" | "practice" | "skills" | "archive" | "mirror" | TrialId;
type Result = { region: Region; won: boolean; drop?: boolean; trialId?: TrialId; mirrorLevel?: number };
type Target = { tab: Tab; action?: string; label: string };
export type Tip = { id: string; title: string; text: string; target?: Target };

export function nextTip(save: Save, tab: Tab, result: Result | null): Tip | undefined {
  if (!save.guide.enabled) return;
  const tip = candidate(save, tab, result);
  if (tip && !save.guide.dismissed.includes(tip.id)) return tip;
}

function candidate(save: Save, tab: Tab, result: Result | null): Tip | undefined {
  if (tab === "patrol" && result && !result.won) return defeatTip(save, result.region);
  if (tab === "archive") {
    if (save.victories[2]) return { id: "archive-after-chapter", title: "卷末去处",
      text: "两桩托付各有胜法，点地名可看详情。进照妖镜能挑战妖影、温养刻纹。要换回从前的巡夜地，展开「首卷旧案」。" };
    return save.victories[0] ? {
      id: "archive", title: "换路与重演",
      text: "标着「当前地点」的是阿照所在的山道。点地名旁的「前往」换路，点「重演」再会大妖。",
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
    if (save.dao >= masteryCost && save.ranks.includes(1) && !save.guide.dismissed.includes("mastery")) {
      return {
        id: "mastery", title: "精通招式",
        text: "精通会增加招式效果，出招轮次照旧。学习消耗可用道行，累计道行照常保留。",
        target: { tab: "skills", action: `mastery:${save.ranks.indexOf(1)}`, label: "查看精通" },
      };
    }
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
  if (save.victories[2]) return {
    id: "after-chapter", title: "渡口又点起了灯",
    text: "翻开斩妖录，护送渡灯、替失名人守烛，或入照妖镜积砂养纹。",
    target: { tab: "archive", label: "查看卷末去处" },
  };

  if (!patrolRemaining(save)) {
    const next = save.region + 1;
    const won = save.victories[save.region] > 0;
    return { id: `swept-${save.region}-${won}`, title: "小妖已扫清",
      text: won && next < regions.length ? `该往${regions[next].name}走了。` : won ? "旧案可重演，还能寻回漏下的装备。" : `${regions[save.region].boss}的踪迹已经找齐。`,
      target: { tab: "patrol", action: won && next < regions.length ? `region:${next}` : `fight:${save.region}`, label: won && next < regions.length ? "前往" + regions[next].name : (won ? "重演" : "挑战") + regions[save.region].boss } };
  }
  if (!save.victories[0]) {
    if (canChallenge(save, 0)) return {
      id: "first-boss", title: "初次问妖",
      text: "山君每三回合一啸。交锋时会停下来等你决定如何应对。想提前对照敌我轮次，可先翻「招式」。",
      target: { tab: "skills", action: "preview", label: "查看山君招谱" },
    };
    if (save.ownedGear.length && !Object.keys(save.loadout).length && !save.guide.dismissed.includes("first-gear")) {
      return { id: "first-gear", title: "拾到装备", text: "阿照停下来查看行装。想用就穿戴，想留着就收入行囊。",
        target: { tab: "patrol", action: "slot:" + (save.ownedGear.includes("pineBlade") ? "weapon" : "armor"), label: "查看装备槽" } };
    }
    return { id: "click-patrol", title: "提灯夜行", text: "提灯上山。斩满十二只小妖，就能找到山君。",
      target: { tab: "patrol", action: "hunt", label: "提灯夜行" } };
  }
  if (!save.victories[1]) {
    if (!save.ranks[0] && save.drops[0] && !save.guide.dismissed.includes("learn-0")) return learnTip(0);
    if (save.ranks[0] && save.kit.shout === "off" && !save.guide.dismissed.includes("equip-0")) return equipTip(0);
    if (!save.autoPatrol && !save.guide.dismissed.includes("auto-patrol")) return {
      id: "auto-patrol", title: "山路已熟",
      text: "阿照记住了山路。点「沿路巡夜」，她便会一路寻妖；拾得新装备时，会停下来等你查看。",
      target: { tab: "patrol", action: "auto-patrol", label: "沿路巡夜" },
    };
    if (save.region === 0 && !save.kills[1]) return {
      id: "ferry-road", title: "去芦花渡夜行", text: "渡口的路已开。点「前往芦花渡」换路，每斩一只小妖可得 3 道行。",
      target: { tab: "patrol", action: "region:1", label: "前往芦花渡" },
    };
    if (save.region === 1 && canChallenge(save, 1)) return {
      id: "river-preview", title: "看一眼回浪的轮次",
      text: "河伯每次汲水会涨一格，涨满三格就会覆舟。绷缆时割缆可以清空水位，带镇山喝还可引浪撞舟。",
      target: { tab: "skills", action: "preview", label: "对照双方招谱" },
    };
    return;
  }
  if (!save.victories[2]) {
    if (save.region === 1 && !save.kills[2]) return {
      id: "temple-road", title: "去白烛庙查案",
      text: "河伯首胜已开庙街。到庙街斩妖可攒下入听息所需的道行，查齐线索后再挑战娘娘。",
      target: { tab: "patrol", action: "region:2", label: "前往白烛庙" },
    };
    if (save.realm === 3 && save.region === 2 && clueCount(save) < 3) return insightTip();
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
    id: `equip-${art}`, title: `装上${arts[art].name}`,
    text: `这门${arts[art].kind}在第 ${arts[art].first} 回合出手，此后每隔 ${arts[art].every} 回合再出一招。换招免费，下次交锋生效。`,
    target: { tab: "skills", action: `art:${art}`, label: "查看招式" },
  };
}

function stepTip(): Tip {
  return {
    id: "first-step", title: "身法位已开启",
    text: "舒筋可带一门身法，阿照先用退步。修习听潮步后，可以在「招式」里换上。",
  };
}

function insightTip(): Tip {
  return {
    id: "first-insight", title: "神通位已开启",
    text: "听息让阿照在烛火偏转时辨出娘娘真身。悟得神通后，可以在「招式」页修习和装备。",
  };
}

function defeatTip(save: Save, region: Region): Tip {
  const precise = save.guide.defeats[region] >= 2;
  const clues = [
    "打开交锋详情，找出虎啸在哪一轮命中，再看看自己的架势。",
    "打开交锋详情，找出回浪在哪一轮命中。招式页能对照敌我回合。",
    "接连斩中两次纸面会受到反噬。打开交锋详情，看看反噬发生在哪一轮。",
  ];
  const advice = [
    "用守式应战，虎啸原伤害 36，架住后只扣 7 点气血。",
    "留心水位。到了两格，下一道回浪就可能覆舟。绷缆时割缆可以清空水位。",
    "烛偏时能打中真身。上轮可收刀等候，或挑灯连续三轮见到真身。已学照影时，也可提前显形。",
  ];
  return {
    id: `defeat-${region}-${precise ? 2 : 1}`, title: precise ? "再试一个解法" : "先看败在哪里",
    text: precise ? advice[region] : clues[region],
    target: { tab: "skills", action: "preview", label: `查看${regions[region].boss}招谱` },
  };
}
