import { arts, regions } from "./content.ts";
import { canChallenge, clueCount } from "./game.ts";
import type { Region, Save } from "./game.ts";

export type Tab = "patrol" | "practice" | "skills" | "gear" | "archive";
type Result = { region: Region; won: boolean; drop?: boolean };
type Target = { tab: Tab; action?: string; label: string };
export type Tip = { id: string; title: string; text: string; target?: Target };

export function nextTip(save: Save, tab: Tab, result: Result | null): Tip | undefined {
  if (!save.guide.enabled) return;
  const tip = candidate(save, tab, result);
  if (tip && !save.guide.dismissed.includes(tip.id)) return tip;
}

function candidate(save: Save, tab: Tab, result: Result | null): Tip | undefined {
  if (tab === "patrol" && result && !result.won) return defeatTip(save, result.region);
  if (tab === "gear" && save.ownedGear.length) return {
    id: "gear", title: "穿上第一件装备",
    text: "掉落会收进行囊。点装备才会获得属性，同一部位换下的物品还能重新穿回去。",
  };
  if (tab === "archive") {
    return save.victories[0] ? {
      id: "archive", title: "换路与重演",
      text: "从这里可以换巡夜地点。已平息的大妖也能免费重演，补悟传承或试一套新配招。",
    } : undefined;
  }
  if (tab === "skills" && result && !result.won) return defeatTip(save, result.region);
  if (tab === "skills") {
    const unlearned = arts.findIndex((art, i) => save.drops[i] && !save.ranks[i] && save.realm >= art.realm &&
      !save.guide.dismissed.includes(`learn-${i}`));
    if (unlearned >= 0) return learnTip(unlearned as Region);
    const brought = [save.kit.shout !== "off", save.kit.step === "tide", save.kit.reveal];
    const learned = save.ranks.findIndex((rank, i) => rank > 0 && !brought[i] && !save.guide.dismissed.includes(`equip-${i}`));
    if (learned >= 0) return equipTip(learned as Region);
    if (save.dao >= 400 && save.ranks.includes(1) && !save.guide.dismissed.includes("mastery")) {
      return {
        id: "mastery", title: "精通招式",
        text: "精通会增加招式效果，出招轮次照旧。学习消耗可用道行，累计道行照常保留。",
        target: { tab: "skills", action: `study:${save.ranks.indexOf(1)}`, label: "查看精通" },
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
      target: { tab: "patrol", action: "region:1", label: "返回巡夜手札" },
    };
    return;
  }
  if (tab !== "patrol") return;

  if (!save.victories[0]) {
    if (canChallenge(save, 0)) return {
      id: "first-boss", title: "初次问妖",
      text: "山君每三回合一啸。交锋时会停下来等你决定如何应对。想提前对照敌我轮次，可先翻「招式」。",
      target: { tab: "skills", action: "preview", label: "查看山君招谱" },
    };
    if (save.ownedGear.length && !Object.keys(save.loadout).length && !save.guide.dismissed.includes("first-gear")) {
      return { id: "first-gear", title: "拾到装备", text: "打开行囊穿戴。兵刃加刀伤，护具加气血。",
        target: { tab: "gear", label: "打开行囊" } };
    }
    return { id: "click-patrol", title: "提灯夜行", text: "点「夜行」找一只小妖。阿照会一刀斩落，攒下道行和线索。找齐三条即可挑战山君。",
      target: { tab: "patrol", action: "hunt", label: "找到夜行按钮" } };
  }
  if (!save.victories[1]) {
    if (!save.ranks[0] && save.drops[0] && !save.guide.dismissed.includes("learn-0")) return learnTip(0);
    if (save.ranks[0] && save.kit.shout === "off" && !save.guide.dismissed.includes("equip-0")) return equipTip(0);
    if (!save.autoPatrol && !save.guide.dismissed.includes("auto-patrol")) return {
      id: "auto-patrol", title: "自动夜行已解锁",
      text: "点一次即可持续寻妖、拾取掉落和推进线索。再点一次可切回手动。",
      target: { tab: "patrol", action: "auto-patrol", label: "找到自动夜行" },
    };
    if (save.region === 0 && !save.kills[1]) return {
      id: "ferry-road", title: "去芦花渡夜行", text: "渡口每只小妖给 3 道行。收集线索，准备挑战河伯。",
      target: { tab: "patrol", action: "region:1", label: "找到渡口入口" },
    };
    if (save.region === 1 && canChallenge(save, 1)) return {
      id: "river-preview", title: "看一眼回浪的轮次",
      text: "河伯每三轮发一次回浪。试着把敌招出现的轮次和你手里的招式对照。",
      target: { tab: "skills", action: "preview", label: "对照双方招谱" },
    };
    return;
  }
  if (!save.victories[2]) {
    if (result?.drop && result.region === 1 && !save.ranks[1] && !save.guide.dismissed.includes("learn-1")) {
      return learnTip(1);
    }
    if (save.region === 1 && !save.kills[2]) return {
      id: "temple-road", title: "去白烛庙查案",
      text: "河伯首胜已开庙街。到庙街斩妖可攒下入听息所需的道行，查齐线索后再挑战娘娘。",
      target: { tab: "patrol", action: "region:2", label: "找到庙街入口" },
    };
    if (save.realm === 3 && save.region === 2 && clueCount(save) < 3) return insightTip();
  }
  if (result?.drop && result.region === 2 && !save.ranks[2]) return learnTip(2);
  if (save.victories[2]) return {
    id: "replay", title: "旧案仍可再访",
    text: "首卷已平。可以在斩妖录重演大妖来补全传承，或换一套配招试试能否更早取胜。",
    target: { tab: "archive", label: "打开斩妖录" },
  };
}

function learnTip(art: Region): Tip {
  return {
    id: `learn-${art}`, title: `新传承 · ${arts[art].name}`,
    text: `花 ${arts[art].cost} 可用道行学习，再装备就能在战斗中自动释放。`,
    target: { tab: "skills", action: `study:${art}`, label: "找到学习入口" },
  };
}

function equipTip(art: Region): Tip {
  return {
    id: `equip-${art}`, title: `装上${arts[art].name}`,
    text: `这门${arts[art].kind}首发第 ${arts[art].first} 轮，每隔 ${arts[art].every} 轮自动施放。换招免费，下次交锋生效。`,
    target: { tab: "skills", action: ["kit:shout:windup", "kit:step:tide", "kit:reveal:true"][art], label: "找到装配入口" },
  };
}

function stepTip(): Tip {
  return {
    id: "first-step", title: "身法位已开启",
    text: "舒筋自带退步。学到其他身法后，可以在「招式」里替换它。芦花渡已开放巡夜。",
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
    "打开交锋详情，比较烛火偏转前后的刀伤，看看哪些回合能打到真身。",
  ];
  const advice = [
    "用守式应战，虎啸原伤害 36，架住后只扣 7 点气血。",
    "回浪在第 3、6、9…轮。镇山喝同轮可截断它，也可以用守式承伤。",
    "听息每三轮辨出真身。若气血先耗尽，可用守式扛住烛偏回合。",
  ];
  return {
    id: `defeat-${region}-${precise ? 2 : 1}`, title: precise ? "再试一个解法" : "先看败在哪里",
    text: precise ? advice[region] : clues[region],
    target: { tab: "skills", action: "preview", label: `查看${regions[region].boss}招谱` },
  };
}
