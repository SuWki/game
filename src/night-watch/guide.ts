import { arts, bridgeRegion, heartRealm, regions } from "./content.ts";
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
      text: "随陆婆过河去纸马驿。想接青芦的托付、重演旧案或去照妖镜，也可从此处进入。" };
    return save.victories[0] ? {
      id: "archive", title: "换路与重演",
      text: "标着「当前地点」的，就是阿照现在所在的地方。点地名旁的「前往」换路，点「重演」再会大妖。",
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
      text: won && next < regions.length ? `该往${regions[next].name}走了。` : won ? "旧案可重演，漏掉的装备也能找回。" : `${regions[save.region].boss}的踪迹已经找齐。`,
      target: { tab: "patrol", action: won && next < regions.length ? `region:${next}` : `fight:${save.region}`, label: won && next < regions.length ? "前往" + regions[next].name : (won ? "重演" : "挑战") + regions[save.region].boss } };
  }
  if (!save.victories[0]) {
    if (canChallenge(save, 0)) return {
      id: "first-boss", title: "初次问妖",
      text: "山君每三回合一啸。交锋时会停下来，等你决定怎么应对。想提前对照敌我回合，可先翻看「招式」页。",
      target: { tab: "skills", action: "preview", label: "查看山君招谱" },
    };
    if (save.ownedGear.length && !Object.keys(save.loadout).length && !save.guide.dismissed.includes("first-gear")) {
      return { id: "first-gear", title: "拾到装备", text: "阿照停下来查看随身装备。想用就穿戴，想留着就收入行囊。",
        target: { tab: "patrol", action: "slot:" + (save.ownedGear.includes("pineBlade") ? "weapon" : "armor"), label: "查看槽位" } };
    }
    return { id: "click-patrol", title: "提灯夜行", text: "提灯上山。斩满十二只小妖，就能找到山君。",
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
      text: "胜过河伯，去庙街的路就通了。到庙街斩妖可攒下升入听息境所需的道行，线索齐后再去挑战娘娘。",
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
    "打开交锋详情，找出回浪在哪一回合命中。招式页能对照敌我回合。",
    "接连斩中两次纸面会受到反噬。打开交锋详情，看看反噬发生在哪一回合。",
    "横篙命中三次会掉下桥。看第 3、6、9 回合的失足变化。",
  ];
  const advice = [
    "用守式应战，虎啸原本要扣 36 点气血，架住后只扣 7 点。",
    "留心水位。到了两格，下一道回浪就可能覆舟。绷缆时割缆可以清空水位。",
    "烛偏时能打中真身。前一回合可收刀等候，或挑灯连续三回合见到真身。已修习照影时，也可提前显形。",
    "先留两次应变，失足后选「借墩稳身」清空。也可以提前装备镇山喝，每三回合截断一次横篙。",
  ];
  return {
    id: `defeat-${region}-${precise ? 2 : 1}`, title: precise ? "再试一个解法" : "先看败在哪里",
    text: precise ? advice[region] : clues[region],
    target: { tab: "skills", action: "preview", label: `查看${regions[region].boss}招谱` },
  };
}
