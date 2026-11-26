import "./style.css";
import { altarMirrorName, altarMirrorPages, altarMirrorSand, altarPaper, altarRegion, altarStations, arts, bridgeRegion, breakthrough, cliffRegion, cloudMirrorName, cloudMirrorSand, courierRegion, freeDao, freeRealm, fusionStrike, hallRegion, heartDao, heartRealm, homecoming, lampPaper, realms, regions, ropeStep, skyRegion, stillDao, stillRealm, templeRepriseName, templeRepriseRounds, trialIds, trialRounds, trials, trialSand, trueDao, trueRealm, trueSigilBonus, watchRegion, windDao, windRealm } from "./content.ts";
import type { TrialId } from "./content.ts";
import { altarMirrorPageStrength, ferryEvidence, firstVolumeAftermath, rollCallPaperCut, rollCallStations } from "./content.ts";
import { bossEquipment, equipment, gearDisplayName, gearEffect, gearRank, gearRegion, isReforgeId, knownGear, minionEquipment, reforgeIds, reforging, slots, traitText } from "./equipment.ts";
import type { GearId, GearSlot } from "./equipment.ts";
import { caseClues, encounters } from "./tactics.ts";
import { battleBrief, battleRecovery, clueTip, nextTip } from "./guide.ts";
import type { PrepFocus, RecoveryTip, Tab, Tip } from "./guide.ts";
import {
  accrueOffline, accrueSand, artDue, canChallenge, canCompareBooks, canEnterLampTrial, canFuseLamp, canPatrol, challengeRealms, clueCount, compareBooks, compareGear, cultivationFor, decode, defeatSummary, equipArt, equippedArts, equipLampFusion, footingLimit, frame, fuseLamp, engravingCost, engravingPower, engravings, gearRequirement, loadoutStats, masteryCost, maxEngravingRank, mirrorOpponent, mirrorRounds, mirrorUnlocked, paperHitLimit, newSave, trainingRoute, weaponArts,
  enableCombatTactics, patrolRemaining, rate, recordPatrolKill, roundMoves, riverFloodLimit, sandRate, saveKey, setInwardTide, settleMirror, settleTrial, startFight, startMirrorFight, startTrial, study, surveyWind, tickFight, tuneEngraving, unlocked, win,
} from "./game.ts";
import { altarMirrorUnlocked, applyPreset, automaticPreparationText, battleTiming, canEarnSand, challengeClues, cloudMirrorUnlocked, forecastFight, maxRematchRank, mirrorPreparation, paperSealActive, recordedClues, reforgeGear, reforgeState, rematchSpec, replacedArt, riverPursuitActive, riverPursuitDamage, riverPursuitLimit, settleAltarMirror, settleCloudMirror, settleRematch, settleTempleReprise, startAltarMirror, startCaseFight, startCloudMirror, startRematch, startTempleReprise, storePreset, templeRepriseUnlocked, wardSealActive, wardSealLimit, wardStrength } from "./game.ts";
import type { AltarMirrorAttempt, ArtId, CloudMirrorAttempt, Engraving, Fight, MirrorAttempt, OldRegion, PresetSlot, Region, Save, TempleRepriseAttempt } from "./game.ts";
import { canViewTrial } from "./game.ts";
import { applyBuildChange, availableBuildChanges, battleBuildImproves, changeLabel, compareBattleBuilds, previewBattle, previewBuild } from "./battle-preview.ts";
import type { BuildChange, BuildSuggestion } from "./battle-preview.ts";

const root = document.querySelector<HTMLDivElement>("#night-watch")!;
const assets = import.meta.env.BASE_URL + "night-watch/";
const zoneArt = ["mountain", "ferry", "temple", "post-bridge", "post-courtyard", "post-watch", "cloud-cliff", "cloud-sky", "lamp-hall", "lamp-altar"];
const tabs = { patrol: "巡夜", practice: "修行", skills: "招式", archive: "斩妖录", mirror: "照妖镜", rematch: "强敌再战", ferryTrial: trials.ferryTrial.name, templeTrial: trials.templeTrial.name, lampTrial: trials.lampTrial.name, cloudRelay: trials.cloudRelay.name, rollCall: trials.rollCall.name } as const;
const isTrial = (value: string): value is TrialId => Object.hasOwn(trials, value);
let tab: Tab = "patrol";
let rematchRegion: OldRegion = 0;
let mirrorSelection: number | undefined;
let save = newSave(Date.now());
let fight: Fight | null = null;
let journal = false;
let openSlot: GearSlot | undefined;
let ready = false;
let waiting = "正在载入巡簿";
let pending: { draft: Save; next?: () => void } | null = null;
type BattleResult = { trialId?: TrialId; trialProgress?: number; altarMirror?: boolean; cloudMirror?: boolean; templeReprise?: boolean; mirrorLevel?: number; previousMirror?: MirrorAttempt; rematchRank?: number; rematchPractice?: boolean; sand?: number; region: Region; won: boolean; report: string[]; reason?: string; recovery?: RecoveryTip; first?: boolean; drop?: boolean; daoReward?: number; horseImpact?: Fight["horseImpact"];
  recovered?: GearId; links: Record<string, number>; round: number; life: number; hp: number };
let result: BattleResult | null = null;
type Challenge = { mode: "case"; region: Region } | { mode: "rematch"; region: Region; practice?: boolean }
  | { mode: "mirror"; level: number } | { mode: "altar-mirror" } | { mode: "cloud-mirror" } | { mode: "temple-reprise" } | { mode: "trial"; id: TrialId };
let skillChallenge: Challenge | undefined;
type PageLocation = { tab: Tab; journal: boolean; result: BattleResult | null; scroll: number;
  skillChallenge: Challenge | undefined; rematchRegion: OldRegion; mirrorSelection: number | undefined };
const backTrail: PageLocation[] = [];
let battleOrigin: PageLocation | null = null;

function pageLocation(): PageLocation {
  return { tab, journal, result, scroll: window.scrollY, skillChallenge, rematchRegion, mirrorSelection };
}

function preparingChallenge() {
  return battleSheet.open || tab === "skills" && !!skillChallenge || tab === "mirror" || tab === "rematch" || isTrial(tab);
}

function mirrorPrepLevel() {
  return mirrorSelection ?? save.mirror.recent?.level ?? save.mirror.best + 1;
}

function pageName(page: PageLocation) {
  if (page.tab !== "patrol") return tabs[page.tab];
  return page.result ? "战果" : page.journal ? "本地妖案" : "巡夜";
}

function returnTo(page?: PageLocation) {
  tab = page?.tab ?? "patrol";
  journal = page?.journal ?? false;
  result = page?.result ?? null;
  skillChallenge = page?.skillChallenge;
  if (page) {
    rematchRegion = page.rematchRegion;
    mirrorSelection = page.mirrorSelection;
  }
  paintPanel();
  window.scrollTo(0, page?.scroll ?? 0);
}

function challengeOf(fight: { region: Region; rematchRank?: number; rematchPractice?: boolean; altarMirror?: boolean | Fight["altarMirror"]; cloudMirror?: boolean | Fight["cloudMirror"]; templeReprise?: boolean; mirrorLevel?: number; trialId?: TrialId; trial?: { id: TrialId } }): Challenge {
  if (fight.templeReprise) return { mode: "temple-reprise" };
  if (fight.cloudMirror) return { mode: "cloud-mirror" };
  if (fight.altarMirror) return { mode: "altar-mirror" };
  if (fight.mirrorLevel) return { mode: "mirror", level: fight.mirrorLevel };
  const trial = fight.trial?.id ?? fight.trialId;
  if (trial) return { mode: "trial", id: trial };
  return fight.rematchRank ? { mode: "rematch", region: fight.region, practice: fight.rematchPractice } : { mode: "case", region: fight.region };
}

function challengeFight(challenge: Challenge, state = save) {
  if (challenge.mode === "cloud-mirror") return startCloudMirror(state);
  if (challenge.mode === "temple-reprise") return startTempleReprise(state);
  if (challenge.mode === "altar-mirror") return startAltarMirror(state);
  if (challenge.mode === "mirror") return startMirrorFight(state, challenge.level);
  if (challenge.mode === "trial") return startTrial(state, challenge.id);
  if (challenge.mode === "rematch") return startRematch(state, challenge.region, challenge.practice);
  if (!state.victories[challenge.region] || challenge.region >= cliffRegion) return startCaseFight(state, challenge.region);
}

function challengeAction(challenge: Challenge) {
  if (challenge.mode === "cloud-mirror") return "cloud-mirror-fight";
  if (challenge.mode === "temple-reprise") return "temple-reprise-fight";
  if (challenge.mode === "altar-mirror") return "altar-mirror-fight";
  if (challenge.mode === "mirror") return `mirror-fight:${challenge.level}`;
  if (challenge.mode === "trial") return `trial-fight:${challenge.id}`;
  return `${challenge.mode === "case" ? "fight" : challenge.practice ? "rematch-test" : "rematch-fight"}:${challenge.region}`;
}

function rematchPracticeAvailable(region: Region) {
  return (region === 1 || region === 2 || region === watchRegion) && save.rematchRanks[region] === maxRematchRank;
}

function pageChallenge(): Challenge | undefined {
  if (tab === "mirror") return result?.cloudMirror ? { mode: "cloud-mirror" }
    : result?.altarMirror ? { mode: "altar-mirror" } : { mode: "mirror", level: mirrorPrepLevel() };
  if (tab === "rematch") {
    if (result?.templeReprise) return { mode: "temple-reprise" };
    const practice = rematchPracticeAvailable(rematchRegion);
    if (rematchSpec(save, rematchRegion, practice)) return { mode: "rematch", region: rematchRegion, practice };
  }
  if (isTrial(tab) && (tab === "lampTrial" || !save.trialBest[tab])) return { mode: "trial", id: tab };
  if (tab === "patrol") return { mode: "case", region: result?.region ?? save.region };
}

let notice = "";
let rest = regions[0].patrolInterval - 500;
let previousFrame = performance.now();
let previousWall = Date.now();
let lag = 0;
let renderedPanel = "";
let currentTip: Tip | undefined;
const layerNames = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const slotNotes = { weapon: "刀剑 · 增加刀伤", armor: "衣甲 · 增加气血", charm: "佩饰 · 回合特效" };
function realmLabel(state = save) {
  const { realm, layer } = cultivationFor(state);
  return realms[realm] + " · " + layerNames[layer - 1] + "层";
}

function cliffGateText() {
  if (!save.windSurveyed) return "去妖案查看风灯，认出它为何朝向断栈。";
  return `风灯已查明。再巡得 ${stillDao - save.lifetimeDao} 道行可入坐忘，挑战回风鸮。`;
}

function hallCase() {
  const region = regions[hallRegion];
  const clues = recordedClues(save, hallRegion);
  const swept = !patrolRemaining(save, hallRegion);
  const enough = canEnterLampTrial(save);
  const lines = ["原簿上只记了第一船。", "总簿却写成了全路都到齐。", automaticPreparationText(hallRegion)];
  return title(region.tag, region.title, save.trialBest.lampTrial ? region.cleared : region.intro) +
    `<ul class="clues evidence-list">${region.clues.map((clue, index) => `<li class="${index < clues ? "found" : ""}"><div>
      <strong>${index < clues || save.booksCompared && index < 2 ? clue : index === 2 ? "可选备战" : "待查巡簿"}</strong>
      <p>${index < clues || save.booksCompared && index < 2 ? lines[index] : swept ? "巡夜已收灯，仍可对读两册巡簿。" : `再斩 ${Math.max(0, region.thresholds[index] - save.kills[hallRegion])} 只小妖。`}</p></div></li>`).join("")}</ul>
    ${save.booksCompared ? '<p class="intro">同一笔到岸记录，竟变成了「全路人齐」。阿照听见总灯房又摇了一声铃，灯下无人开口。</p>' : ""}
    <div class="actions">${canCompareBooks(save) ? button("compare-books", "对读两册巡簿", !ready || !!fight, true) : ""}
    ${unlocked(save, altarRegion) ? button(`region:${altarRegion}`, "前往主灯台", !ready || !!fight, true) : ""}
    ${enough ? button("tab:lampTrial", save.trialBest.lampTrial ? "回看守灯试炼" : "前往内院守灯", !ready || !!fight, !save.trialBest.lampTrial) : ""}
    ${!enough && patrolRemaining(save, hallRegion) ? button("home", "回到巡夜", !ready || !!fight) : ""}</div>`;
}
const reducedDefault = matchMedia("(prefers-reduced-motion: reduce)").matches;
let quiet = reducedDefault;

root.innerHTML = `
  <header class="masthead">
    <div class="identity"><span class="seal" aria-hidden="true">夜</span><div><h1>夜行斩妖录</h1><div class="subtitle">卷一 · 青芦夜话</div></div></div>
    <div class="ledger"><button type="button" data-action="tab:practice" class="cultivation" aria-label="查看修行进度"><strong id="realm"></strong><progress id="xp" aria-label="本层修行进度"></progress><small id="xp-text"></small></button><span id="balance">可用道行 <strong id="dao"></strong></span>
      <button data-action="help" class="motion" type="button">指引</button>
      </div>
  </header>
  <main class="layout">
    <nav aria-label="巡夜手札目录" class="nav">${Object.entries(tabs).filter(([key]) => key === "patrol" || key === "skills" || key === "archive").map(([key, label]) => `<button data-action="tab:${key}">${label}</button>`).join("")}</nav>
    <div class="theatre">
      <div class="road"><section class="stage" aria-label="巡夜战场">
        <div class="scenery"></div><div class="shade"></div>
        <div class="stage-top"><div><small class="chapter">青芦夜话</small><div id="place" class="place"></div></div><span class="mode" id="mode"></span></div>
        <button class="case-link" data-action="journal"><small id="case-progress"></small><strong id="case-name"></strong><span aria-hidden="true"> ›</span></button>
        <button class="retreat" data-action="retreat" hidden>撤退</button>
        <img class="world-prop" alt="" hidden>
        <div class="actor player"><img src="${assets}hero.png" alt="阿照"><span class="blade"></span></div>
        <div class="actor enemy" hidden><img alt=""><span class="omen" aria-hidden="true">!</span></div>
        <div class="windup" id="windup" hidden></div>
        <div class="gauges">
          <div><div class="gauge-name"><strong>阿照</strong><span id="life-text"></span></div><progress id="life" aria-label="阿照气血"></progress></div>
          <div id="enemy-hud" hidden><div class="gauge-name"><strong id="enemy-name"></strong><span id="hp-text"></span></div><progress id="hp" aria-label="妖物气血"></progress></div>
        </div>
      </section>
      <section id="duel" class="duel" aria-label="大妖交锋" hidden></section>

      <div class="patrol-controls">
        <div class="task-note"><p id="objective"></p><progress id="clue-track" aria-label="下一条线索进度" hidden></progress><small id="rate"></small></div><div class="patrol-buttons"><button type="button" data-action="hunt">夜行</button>
        <button type="button" data-action="auto-patrol" aria-pressed="false" hidden>沿路巡夜</button>
        <button type="button" data-action="fight:0" id="challenge" hidden>挑战吊睛山君</button></div>
      </div>
      <div id="loot-strip" hidden><div id="gear-find" role="status"></div></div>
      <section id="clue-guide" aria-label="线索指引" hidden></section>
      <div class="field-note"><span>巡簿</span><div id="report"></div></div></div>
      <div class="satchel"><section id="outfit" aria-label="随身装备"></section>


      <div id="home-guide" class="paper" hidden></div></div>
    </div>
    <section id="book" hidden><button class="back" type="button" data-action="back">‹　返回巡夜</button>
    <aside id="panel" class="paper" aria-label="巡夜手札"></aside></section>

    <footer><span id="status">正在载入</span></footer>
  </main>
  <dialog id="pack-sheet" class="paper" aria-labelledby="pack-title"><div class="guide-head"><h2 id="pack-title"></h2><form method="dialog"><button>收起</button></form></div><div id="pack-list"></div></dialog>
  <dialog id="battle-sheet" class="paper" aria-labelledby="battle-title">
    <div class="guide-head"><h2 id="battle-title"></h2><form method="dialog"><button>返回</button></form></div>
    <form id="battle-start"><div id="battle-verdict" aria-live="polite"></div><div id="battle-brief"></div><div id="battle-builds"></div>
      <div class="actions"><button type="submit" class="primary">开始交锋</button><button type="button" data-action="battle-loadout">调整配装</button></div>
      <details class="battle-forecast"><summary>看前六回合</summary><div id="battle-preview"></div></details>
    </form>
  </dialog>
  <div id="flash" class="flash" role="status" hidden></div>
  <dialog id="help" class="paper help" aria-labelledby="help-title">
    <div class="guide-head"><h2 id="help-title">巡夜指引</h2><form method="dialog"><button type="submit">关闭</button></form></div>
    <button data-action="motion" class="motion" type="button">动效</button><p id="guide-current"></p>
    <button type="button" data-action="guide-toggle"></button>
    <div class="help-topics">
      <details><summary>想换个地方</summary><p>巡夜找小妖、看掉落。点场景里的案名看线索。首胜后可以直接前往下一地，想回已走过的地方可从斩妖录换路。</p></details>
      <details><summary>夜行与线索</summary><p>点「提灯夜行」出刀。第一条线索记下危险招路，第二条说明应对办法。第三条可为交锋增添一次准备，具体收益写在各地妖案里。胜过吊睛山君后，可开启「沿路巡夜」。</p></details>
      <details><summary>掉落与装备</summary><p>小妖有机会掉落本地兵刃或护具，大妖首胜会给专属佩饰。拾得新装备，阿照会停下来。箭头标出换装后的刀伤或气血变化，「获得」「失去」列出会换掉的本领。选「穿戴」或「收入行囊」，处理完最后一件才会继续。点行装里的槽位，随时都能再换。每个槽位可穿戴一件，属性和回合效果会带入下一场大妖战。</p></details>
      <details><summary>挑战与战报</summary><p>出战前看首领的关键招路，选好装备、招式和架势。开战后阿照会按配装出手，遇到危险最多借地形应对两次。败阵后可以按战报里的难点换装或换招，免费再试。</p></details>
      <details><summary>观化、学习与装备</summary><p>首次战胜山君会觉醒观化。悟得招谱后，可在战果或「招式」页修习。锻骨开武学位，舒筋开身法位，听息开神通位，心斋再开一个武学位。两门武学同一回合出手时，按槽位先后结算。点亮的回合就是出手的时机，精通会增强招式效果。</p></details>
      <details><summary>道行与破境</summary><p>每境十层，道行积满便升一层。修习只花可用道行。舒筋开启身法位，贯劲可在架住重击后反击，听息开启神通位。</p></details>
      <details><summary>强敌再战与强化</summary><p>首胜后从「斩妖录」进入强敌再战。每个首领有三关，每胜一关永久提升该地兵刃、护具与首领佩饰。首次胜利也会补齐遗漏的装备和传承。开打前可查看招路和强化数值。</p></details>
      <details><summary>照妖镜、刻纹与重铸</summary><p>首胜借面娘娘后，从「斩妖录」进入照妖镜。首次破重给淬纹砂，镜中也会按纪录积砂，最多计八小时。砂可以拿来温养刻纹，也能在推进纸马驿后重铸松纹刀和渡水蓑。重铸还需先打过对应再战首关。</p></details>
      <details><summary>卷末异相</summary><p>平定借面娘娘后，斩妖录会收到两桩托付。完成后可读后日谈，并让对应镜战带上实查第三条线索所得的准备。还有可温养的刻纹或可重铸的装备时，每案还给 ${trialSand} 淬纹砂。</p></details>
      <details><summary>配装与符火</summary><p>心斋可保存两套配装。各套同时记住装备、刻纹、架势和出招顺序。寄灯符在第 1、4、7… 回合贴符，挑灯诀紧接着在第 2、5、8… 回合引爆。神通位可带寄灯符或照影。</p></details>
      <details><summary>离线结算</summary><p>沿路巡夜时，离开最多可得八小时道行。若还有新装备待看，这段时间不会积攒道行。到本地修行上限便收灯。扫清时显出大妖踪迹，可直接挑战。</p></details>
    </div>
  </dialog>`;

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  return root.querySelector<T>(selector)!;
}

const stage = element(".stage");
const foe = element(".enemy");
const foeImage = element<HTMLImageElement>(".enemy img");
const worldProp = element<HTMLImageElement>(".world-prop");
const panel = element("#panel");
const flash = element("#flash");
const help = element<HTMLDialogElement>("#help");
const hunt = element<HTMLButtonElement>("[data-action=hunt]");
const autoPatrol = element<HTMLButtonElement>("[data-action=auto-patrol]");
const number = new Intl.NumberFormat("zh-CN");
const integer = (value: number) => number.format(Math.max(0, Math.floor(value)));
const escape = (text: string) => text.replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const button = (action: string, label: string, disabled = false, primary = false) =>
  `<button type="button" data-action="${action}" ${disabled ? "disabled" : ""}${primary ? ' class="primary"' : ""}>${label}</button>`;

function recoveryBlock(outcome: BattleResult) {
  const action = outcome.recovery;
  if (!action) return "";
  const disabled = !ready || !!fight;
  const retry = challengeAction(challengeOf(outcome));
  const more = button(retry, "再试本场", disabled);
  return `<div class="recovery-note"><p>${escape(action.text)}</p><div class="choices">
    ${button("outcome-next", action.label, disabled, true)}${more}</div></div>`;
}

function focusReforge(id: string) {
  const target = document.getElementById("reforge-" + id);
  target?.scrollIntoView({ block: "center" });
  target?.focus({ preventScroll: true });
}

function title(kicker: string, heading: string, intro: string): string {
  return `<div class="paper-kicker">${kicker}</div><h2>${heading}</h2><p class="intro">${intro}</p>`;
}

function costText(cost: number): string {
  const missing = cost - save.dao;
  if (missing <= 0) return `修习后余 ${integer(-missing)} 道行。`;
  const short = `还差 ${integer(missing)} 道行。`;
  const route = trainingRoute(save, missing);
  if (!route) return short + "目前的巡夜额度不足以修习这一招。";
  const area = regions[route.region];
  if (!route.accessible) {
    const firstLocked = regions.findIndex((_, i) => !unlocked(save, i as Region));
    return short + `先击败${regions[firstLocked - 1].boss}开路。巡夜到${area.name}可攒够。`;
  }
  const kills = integer(Math.ceil(missing / area.reward));
  return short + (route.region === save.region ? `再斩 ${kills} 只小妖即可。` : `去${area.name}斩 ${kills} 只小妖即可。`);
}

const clueLabels = ["辨出招路", "找到对策", "备好应变"] as const;

function firstVolumeScene(id: Region) {
  const scene = firstVolumeAftermath.at(id);
  return scene ? `<aside class="case-turn"><h3>${scene.title}</h3><p>${scene.text}</p></aside>` : "";
}

function patrolPanel(): string {
  const location = regions[save.region];
  const clues = recordedClues(save);
  if (result) {
    const cleared = regions[result.region];
    const awakening = result.first && result.region === 0;
    const prize = result.region === cliffRegion
      ? result.first ? `守灯人已获救，取得风灯并踏入御风${result.daoReward ? `，另得 ${result.daoReward} 道行` : ""}。观化悟得《踏缆步》。` : ""
      : result.region === hallRegion || result.region === altarRegion ? ""
      : result.region === skyRegion ? result.first ? "取得第二册巡簿与续灯扣。两册巡簿已收入斩妖录。" : ""
      : result.drop ? `观化悟得《${arts[result.region].name}》${result.daoReward ? `，另得 ${result.daoReward} 道行` : ""}。`
        : save.drops[result.region] ? "" : `可在「强敌再战」第一关补悟《${arts[result.region].name}》。`;
    const clearedRegion = result.region;
    const nextRegion = clearedRegion + 1;
    const reforge = result.first && reforgeIds.find(id => reforging[id].chapter === clearedRegion);
    const practice = result.region >= cliffRegion && result.won && !result.first;
    return title(result.won ? practice ? "试招取胜" : "战胜大妖" : "败阵", cleared.boss,
      result.won ? practice ? `第 ${result.round} 回合取胜，阿照余 ${result.life} 气血。` : cleared.cleared : escape(result.reason ?? "")) +
      (result.first ? firstVolumeScene(result.region) : "") +
      (awakening ? `<p class="prize">道行 +${result.daoReward}。装备镇山喝后，第 3 回合就能截断芦花渡的回浪。</p>`
        : result.won && prize ? `<p class="prize">${prize}</p>` : "") +
      (result.first && result.region === bridgeRegion ? `<p>${save.realm >= heartRealm ? "已进入心斋，可同时带两门武学。" : `驿桥已通。累计道行达到 ${heartDao}，便进入心斋、开启第二武学位。`}</p>` : "") +
      (result.first && result.region === courierRegion ? "<p>迎战驿卒时，寄灯符第 1 回合贴符，第 2 回合可借灯引爆、烧去更印。纸马灯芯能再添 8 点火伤。</p>" : "") +
      (result.won && result.horseImpact ? `<p>第 ${result.horseImpact.round} 回合挨了冲灯与灼伤，共扣 ${result.horseImpact.damage} 点气血。</p>`
        : result.won && result.links["听潮步避开冲灯"] ? `<p>听潮步避开了 ${result.links["听潮步避开冲灯"]} 次冲灯。</p>` : "") +
      (result.drop && result.region !== skyRegion && result.region !== hallRegion && result.region !== altarRegion ? artCard(result.region, true) : "") +
      (save.newGear[0] ? lootCard(save.newGear[0], save.newGear[0] === result.recovered) : "") +
      (awakening ? '<p class="meta">回山道后可开启沿路巡夜，达到本地上限就会收灯。</p>' : "") +
      '<div class="actions outcome-actions">' +
      (result.first && nextRegion < regions.length && unlocked(save, nextRegion as Region) ? button(`region:${nextRegion}`, nextRegion === bridgeRegion ? "随陆婆过河" : `前往${regions[nextRegion].name}`, !!fight, true) : "") +
      (result.won && result.region < cliffRegion ? button(`rematch:${result.region}`, "强敌再战") : "") +
      (result.won && result.region === 2 ? button("tab:archive", "查看异相与照妖镜") : "") +
      (result.won && result.region >= bridgeRegion ? button("tab:skills", result.region === bridgeRegion ? "查看武学顺序" : "调整配装") : "") +
      (reforge ? button(`tab:mirror:${reforge}`, `查看${equipment[reforge].name}重铸`) : "") +
      (result.won && result.region === cliffRegion ? button("home", "回到残栈") : "") +
      (result.won && result.region === skyRegion ? button("tab:archive", "查看两册巡簿") : "") +
      (result.won && result.region === skyRegion ? button("tab:cloudRelay", "接风灯托付", !ready || !!fight) : "") +
      (result.won && result.region === altarRegion ? button("region:1", "回芦花渡送最后一程", !ready || !!fight, true) : "") +
      (result.won && result.region === altarRegion ? button("tab:rollCall", "查看总灯房托付", !ready || !!fight) : "") +
      (result.won && result.region === altarRegion ? button("tab:mirror:altar", "查看归山镜题", !ready || !!fight) : "") +
      `</div>${recoveryBlock(result)}<details data-remember="report"><summary>逐回合战报 · 第 ${result.round} 回合结束</summary>
      <p>阿照余 ${result.life} 气血 · 大妖余 ${result.hp} 气血</p>
      <div class="battle-links">${Object.entries(result.links).map(([name, times]) => `<span>${escape(name)} ×${times}</span>`).join("")}</div>
      <ul class="log">${result.report.map(line => `<li>${escape(line)}</li>`).join("")}</ul></details>`;

  }
  const id = save.region;
  if (id === hallRegion) return hallCase();
  const evidence = caseClues[id];
  const done = save.victories[save.region] > 0;
  const kills = save.kills[save.region];
  const swept = !patrolRemaining(save);
  const surveyReady = id === cliffRegion && !save.windSurveyed && clueCount(save) >= challengeClues;
  const sweptClueHint = id === cliffRegion ? "小妖已扫清。风灯仍可查看，结扣只在实查第三条线索后取得。"
    : id === skyRegion ? "小妖已扫清。已查到的线索和战前准备依然有效。"
    : done ? "强敌再战第一关可补齐剩余线索。" : "小妖已扫清，可以先去查案挑战大妖。";
  const effects = [evidence.danger, battleBrief(startFight(save, id, true)).hint, automaticPreparationText(id)];
  const known = location.clues.map((clue, i) => `<li id="case-clue-${i + 1}" tabindex="-1" class="${i < clues ? "found" : ""}">
      <span aria-hidden="true">${i < clues ? "◆" : "◇"}</span><div><strong>${clueLabels[i]}</strong>
      ${i < clues ? `<small>${clue}</small>${id === 1 ? `<p class="case-testimony">${ferryEvidence[i]}</p>` : ""}<p>${effects[i]}</p>` : i === clues ? `<p>${swept ? sweptClueHint : "再斩 " + (location.thresholds[i] - kills) + " 只小妖" + (i === 2 ? " · 可选准备" : "")}</p>
      ${i === 2 ? `<p>${effects[i]}</p>` : ""}` : ""}
      </div></li>`).join("");
  const open = canChallenge(save, id);
  const next = done && regions[id + 1] && unlocked(save, (id + 1) as Region) ? regions[id + 1] : undefined;
  const actions = (next ? button(`region:${id + 1}`, id === 2 ? "随陆婆过河" : "前往" + next.name, !ready || !!fight, true) : "") +
    (surveyReady ? button("survey-wind", "查看风灯", !ready || !!fight, true) : "") +
    (open && (!done || id < cliffRegion) ? button(done ? `rematch:${id}` : `fight:${id}`, done ? "查看强敌再战" : "挑战" + location.boss, !ready || !!fight, !next) : "") +
    (done && id >= cliffRegion ? button(`fight:${id}`, "用当前配装试招", !ready || !!fight) : "") +
    (clues || open ? button("show-preview", "对照前六回合") : "") +
    (!done && patrolRemaining(save) && !save.autoPatrol ? button("home", clues === challengeClues && open ? "继续巡夜备战" : "回去巡夜") : "");
  return title(location.tag, location.title, id === 1 && save.victories[altarRegion] ? homecoming : done ? location.cleared : location.intro) +
    (done ? firstVolumeScene(id) : "") +
    `<div class="clues-label"><strong>${location.boss} · 妖案</strong><span>${clues} / 3</span></div>
    <ul class="clues evidence-list">${known}</ul>
    ${!done && !open && clueCount(save) >= challengeClues ? `<p class="meta">${id === cliffRegion ? cliffGateText() : id === courierRegion ? paperHorseGateText() : `已找到大妖，进入${realms[challengeRealms[id]]}境后可挑战。`}</p>` : ""}
    <div class="actions">${actions}</div>`;
}

function practicePanel(): string {
  const next = breakthrough[save.realm];
  const state = cultivationFor(save);
  const heartRequirement = save.victories[bridgeRegion] ? `再得 ${heartDao - save.lifetimeDao} 道行可入心斋。`
    : `击败驿桥篙鬼，累计道行达到 ${heartDao}，即可进入心斋境。`;
  const remaining = patrolRemaining(save);
  const route = !remaining ? trainingRoute(save, 1) : undefined;
  const currentOpen = !save.victories[save.region] && canChallenge(save, save.region);
  const nextCase = regions.findIndex((_, i) => !save.victories[i] && unlocked(save, i as Region));
  const trainingAction = route?.accessible ? button(`region:${route.region}`, `前往${regions[route.region].name}继续修行`, !ready || !!fight, true)
    : remaining ? "" : currentOpen ? button(`fight:${save.region}`, `挑战${regions[save.region].boss}开路`, !ready || !!fight, true)
      : nextCase < 0 ? button("tab:archive", "查看后续挑战") : nextCase === save.region ? button("home", "回到巡夜")
        : button(`region:${nextCase}`, `前往${regions[nextCase].name}查案`, !ready || !!fight, true);
  const stillRequirement = !save.victories[watchRegion] ? "击败守更驿卒后，去残栈调查风灯。"
    : !save.windSurveyed ? "到残栈妖案查看风灯，即可核对坐忘条件。" : `再得 ${stillDao - save.lifetimeDao} 道行可入坐忘。`;
  const windRequirement = !save.victories[cliffRegion] ? "击退回风鸮，救回守灯人后可踏入御风。" : `再得 ${Math.max(0, windDao - save.lifetimeDao)} 道行可入御风。`;
  const trueRequirement = !save.booksCompared ? "去总灯房外院对读两册巡簿，查清铃声为何代人作答。"
    : `再巡得 ${Math.max(0, trueDao - save.lifetimeDao)} 道行即可入真人。`;
  const upgrade = state.full ? (save.realm === 3 ? heartRequirement : save.realm === heartRealm ? stillRequirement : save.realm === stillRealm ? windRequirement :
    save.realm === windRealm ? trueRequirement : save.realm === trueRealm ? "完成内院守灯试炼，累计道行满 " + freeDao + " 后入逍遥。" : "逍遥十层已圆满。")
    : `再得 ${state.needed - state.progress} 道行可升层。${state.layer < 10 ? "气血上限 +1。" : ""}`;
  return `<h2>灯下修行</h2><section class="realm-entry"><div class="section-title"><strong>${realmLabel()}</strong><span>${state.full ? "十层圆满" : `本层 ${state.progress} / ${state.needed}`}</span></div>
    <progress aria-label="本层道行" max="${state.needed}" value="${state.progress}"></progress>
    <p>${upgrade}</p></section>
    <dl class="dao-ledger"><div><dt>累计道行</dt><dd>${integer(save.lifetimeDao)}</dd><small>决定境界与层数</small></div>
    <div><dt>可用道行</dt><dd>${integer(save.dao)}</dd><small>可用于修习、精通招式</small></div></dl>
    ${next ? `<p>${save.realm === 3 && !state.full && !save.victories[bridgeRegion] ? heartRequirement + " " : ""}进入${realms[save.realm + 1]}境后，${next.gift}</p>` : ""}
    <div class="practice-route"><p>${remaining ? `${regions[save.region].name}还可巡得 ${integer(remaining)} 道行。` : `${regions[save.region].name}的小妖已扫清。`}</p>
    ${trainingAction}</div>
    ${save.drops.some((known, i) => known && !save.ranks[i]) ? button("tab:skills", "查看待修习的招谱") : ""}`;

}

const artStamps = ["武", "步", "术", "武", "术", "武", "步"] as const;

function techniqueStrip(id: ArtId) {
  const art = arts[id];
  return `<div class="technique-strip" aria-label="${art.name}前九回合出手时机">${Array.from({ length: 9 }, (_, i) => {
    const round = i + 1;
    return `<span class="${artDue(round, id) ? "is-due" : ""}">${round}</span>`;
  }).join("")}<small>每 ${art.every} 回合出手</small></div>`;
}

function artCard(id: ArtId, fromResult = false) {
  const art = arts[id];
  const rank = save.ranks[id];
  const known = save.drops[id];
  const worn = !!rank && equippedArts(save.kit)[id];
  const locked = save.realm < art.realm;
  const cost = rank ? masteryCost : art.cost;
  const inward = id === 1 && save.kit.inwardTide;
  const fused = save.lampFusion && (id === 2 || id === 5);
  const status = worn ? "已装备" : inward ? "已内化" : fused ? "已合入照灯断影" : rank ? "已修习 · 待装备" : known ? "已悟得 · 待修习" : "尚未悟得";
  const disabled = !ready || !!fight?.boss || locked;
  const requirement = locked ? `踏入${realms[art.realm]}后可装备。` : "";
  const replacement = replacedArt(save, id);
  const replacing = id === 4 && save.kit.lampFusion ? "照灯断影" : replacement === undefined ? "" : arts[replacement].name;
  const equip = rank && !locked && !fused ? button(`equip-art:${id}:${worn ? "off" : "on"}`,
    worn ? (art.kind === "身法" ? "换回退步" : "卸下") : inward ? "改为主动身法" : replacing ? `替换${replacing}` : art.kind === "身法" ? "替换退步" : "装备", disabled, !worn) : "";
  const learn = known && rank === 0 ? button(`learn-equip:${id}`, `修习并装备 · ${cost} 道行`, disabled || save.dao < cost, true) +
    (replacing || art.kind === "身法" ? button(`study:${id}`, "仅修习", disabled || save.dao < cost) : "") : "";
  const mastery = known && rank === 1 && !fromResult
    ? `<details class="art-mastery" data-remember="mastery-${id}"><summary>精通 · ${masteryCost} 道行</summary><p>${art.mastery}</p><p class="meta">${costText(cost)}</p>${button(`study:${id}`, "精通此招", disabled || save.dao < cost)}</details>` : "";
  const inner = id === 1 && save.realm >= stillRealm ? `<p class="meta">内化后，首次落地伤减半。可装备另一门主动身法。${rank < 2 ? "先精通听潮步以开启。" : ""}</p>
    ${rank === 2 ? button(`inward-tide:${inward ? "off" : "on"}`, inward ? "解除内化" : "内化听潮步", disabled) : ""}` : "";
  return `<section class="art technique" data-worn="${worn}" id="art-${id}" tabindex="-1" aria-labelledby="art-name-${id}">
    <header class="technique-head"><span class="art-stamp" aria-hidden="true">${artStamps[id]}</span><div><h3 id="art-name-${id}">${art.name}</h3><small>${art.kind}${rank ? (rank === 2 ? " · 精通" : " · 入门") : ""}</small></div><span class="art-status">${status}</span></header>
    <p>${art.description}${rank === 2 ? " " + art.mastery : ""}</p>${techniqueStrip(id)}
    ${id === 4 && save.realm >= trueRealm ? `<p class="meta">真人留息后，下一次按期贴符。该符引爆时火伤 +${trueSigilBonus}。</p>` : ""}
    ${requirement ? `<p class="meta">${requirement}</p>` : replacing && !worn ? `<p class="meta">装备后替换${replacing}。${save.realm < heartRealm && art.kind === "武学" ? "心斋后可同时带两门。" : ""}</p>` : ""}
    ${known && !rank && !locked ? `<p class="meta">${costText(cost)}</p>` : ""}
    ${learn || equip ? `<div class="actions technique-actions">${learn}${equip}</div>` : ""}${mastery}${inner}
  </section>`;
}

function lampFusionCard() {
  if (save.realm < freeRealm) return "";
  const disabled = !ready || !!fight?.boss;
  return `<section class="art technique" id="lamp-fusion" tabindex="-1">
    <header class="technique-head"><span class="art-stamp" aria-hidden="true">术</span><div><h3>照灯断影</h3><small>本命招 · 神通位</small></div></header>
    <p>第 2、5、8… 回合照出真身，灯锋伤害 ${fusionStrike}。遇到归山护纸时，会先破纸再出手。</p>
    ${save.lampFusion ? '<p class="meta">照影和挑灯诀已合入本命招。拆回免费，两门精通都保留。</p>'
      : `<p class="meta">精通照影与挑灯诀后可合成。照影和挑灯诀会卸下，本命招占用原神通位。${!save.drops[2] ? "可在借面娘娘的强敌再战首关补悟照影。" : ""}</p>`}
    <div class="actions">${save.lampFusion ? button(`equip-fusion:${save.kit.lampFusion ? "off" : "on"}`, save.kit.lampFusion ? "卸下本命招" : "装备照灯断影", disabled, !save.kit.lampFusion)
      + button("fuse-lamp:off", "拆回原招", disabled) : button("fuse-lamp:on", "合成并装备", disabled || !canFuseLamp(save), true)}</div>
  </section>`;
}

function skillRack() {
  const equipped = equippedArts(save.kit);
  const weapons = weaponArts(save.kit);
  const twoWeapons = save.realm >= heartRealm;
  const open = 1 + Number(twoWeapons) + Number(save.realm >= 1) + Number(save.realm >= 3);
  const filled = weapons.length + Number(save.realm >= 1) + Number(equipped[2] || equipped[4] || save.kit.lampFusion === true);
  const divine: ArtId = equipped[4] || !equipped[2] && save.drops[4] ? 4 : 2;
  const step = equipped[ropeStep] ? ropeStep : equipped[1] || !save.drops[ropeStep] ? 1 : ropeStep;
  const choices = [...weapons, ...([0, 3, 5] as const).filter(id => save.drops[id] && !weapons.includes(id) && !(id === 5 && save.lampFusion))];
  const slot = (id: ArtId | undefined, title: string, label: string, locked = false) => {
    const body = `<span>${title}</span><strong>${label}</strong>`;
    return id !== undefined && save.drops[id]
      ? `<button type="button" class="skill-slot" data-action="art:${id}">${body}</button>`
      : `<div class="skill-slot" data-static data-locked="${locked}">${body}</div>`;
  };
  return `<section class="skill-rack" aria-labelledby="skill-rack-title">
    <div class="section-title"><h2 id="skill-rack-title">阿照所带招式</h2><span>已带 ${filled} / ${open} 门</span></div>
    <div class="skill-slots">
    ${slot(choices[0], twoWeapons ? "武学一 · 先出手" : "武学位", weapons[0] === undefined ? choices[0] === undefined ? "暂无武学" : "选武学" : arts[weapons[0]].name)}
    ${twoWeapons ? slot(choices[1], "武学二 · 后出手", weapons[1] === undefined ? choices[1] === undefined ? "暂无其他武学" : "选武学" : arts[weapons[1]].name) : ""}
    ${slot(step, "身法位", save.realm < 1 ? "舒筋开启" : equipped[step] ? arts[step].name : "退步", save.realm < 1)}
    ${save.kit.lampFusion ? '<button type="button" class="skill-slot" data-action="fusion-card"><span>神通位</span><strong>照灯断影</strong></button>'
      : slot(divine, "神通位", save.realm < 3 ? "听息开启" : equipped[divine] ? arts[divine].name : save.drops[divine] ? "选神通" : "暂无神通", save.realm < 3)}
    ${save.realm >= stillRealm ? slot(1, "内化位", save.kit.inwardTide ? "听潮步" : "空位") : ""}
    </div>
    ${twoWeapons && weapons.length === 2 ? button("swap-weapons", "互换武学顺序", !ready || !!fight?.boss) : ""}
    ${save.realm >= arts[1].realm && save.kit.step === "basic" ? '<p class="meta">退步占一个身法位，第 1、4、7… 回合可避第一道浪。</p>' : ""}
  </section>`;
}

const presetLabels = ["配装一", "配装二"] as const;
const kitNames = (kit: Save["kit"]) => [
  kit.stance === "guard" ? "守式" : "攻式", ...weaponArts(kit).map(id => arts[id].name),
  kit.step === "tide" ? arts[1].name : kit.step === "rope" ? arts[ropeStep].name : "", kit.sigil ? arts[4].name : kit.reveal ? arts[2].name : "",
  kit.inwardTide ? "内化听潮步" : "", kit.lampFusion ? "照灯断影" : "",
].filter(Boolean);

function presetPanel() {
  if (save.realm < heartRealm) return "";
  const disabled = !ready || !!fight?.boss;
  const activeMoves = kitNames(save.kit).join(" · ");
  const quick = save.presets.map((preset, i) => {
    if (!preset) return "";
    const active = kitNames(preset.kit).join(" · ") === activeMoves && preset.engraving === save.mirror.equipped &&
      (Object.keys(slots) as GearSlot[]).every(slot => preset.loadout[slot] === save.loadout[slot]);
    return `<button type="button" data-action="preset-apply:${i}" aria-pressed="${active}" ${disabled ? "disabled" : ""}>${escape(preset.name)}</button>`;
  }).join("");
  return `<section class="preset-panel" aria-label="两套配装">
    ${quick ? `<div class="preset-quick">${quick}</div>` : ""}
    <details data-remember="presets"><summary>${quick ? "保存与命名" : "两套配装"}</summary>
    <div class="preset-slots">${save.presets.map((preset, i) => {
      const label = presetLabels[i];
      const summary = preset ? [...kitNames(preset.kit), ...Object.values(preset.loadout).map(id => equipment[id].name),
        preset.engraving ? engravings[preset.engraving].name : ""].filter(Boolean).join(" · ") : "空位";
      return `<form class="preset-slot" data-preset="${i}"><label><small>${label}</small>
        <input name="label" aria-label="${label}名称" maxlength="16" required value="${escape(preset?.name ?? label)}" ${disabled ? "disabled" : ""}></label>
        <p>${summary}</p><div class="choices"><button type="submit" ${disabled ? "disabled" : ""}>${preset ? "覆盖为当前" : "保存当前"}</button></div></form>`;
    }).join("")}</div></details></section>`;
}

function skillsPanel(): string {
  const controlsDisabled = !ready || !!fight?.boss;
  const stats = loadoutStats(save);
  const currentRegion = result?.region ?? save.region;
  const target: Challenge = skillChallenge ?? (currentRegion === hallRegion && canEnterLampTrial(save)
    ? { mode: "trial", id: "lampTrial" } : { mode: "case", region: currentRegion });
  const live = challengeFight(target);
  const opponent = live?.region ?? (target.mode === "case" ? target.region : result?.region ?? save.region);
  const alternate = !!live && target.mode !== "case";
  const intel = alternate ? 3 : Math.max(recordedClues(save, opponent), live ? challengeClues : 0);
  const scenario = live ?? (intel && target.mode === "case" && opponent !== hallRegion ? startFight(save, opponent, true) : undefined);
  if (scenario) enableCombatTactics(scenario);
  const fullPreview = scenario?.altarMirror || scenario?.cloudMirror || scenario?.templeReprise;
  const simulation = scenario ? forecastFight(scenario, fullPreview ? scenario.limit : 6) : undefined;
  const verdict = live ? battleVerdict(previewBattle(live)) : "";
  const rematch = live?.rematchRank ? rematchSpec(save, opponent, live.rematchPractice) : undefined;
  const heading = target.mode === "cloud-mirror" ? cloudMirrorName : target.mode === "temple-reprise" ? templeRepriseName : target.mode === "altar-mirror" ? altarMirrorName : target.mode === "trial" ? trials[target.id].name : target.mode === "mirror" && live
    ? `${live.name} · 第 ${integer(target.level)} 重`
    : rematch ? `${regions[opponent].boss} · 第 ${rematch.rank} 关` : regions[opponent].boss;
  const unlearned = arts.filter((_, index) => save.drops[index] && !save.ranks[index]).length;
  const order = arts.map((_, i) => i as ArtId).filter(id => save.drops[id]);
  order.sort((a, b) => Number(save.ranks[a] > 0) - Number(save.ranks[b] > 0));
  const missing = arts.map((_, i) => i as ArtId).filter(id => save.victories[id] && !save.drops[id]);
  const recovery = missing.length ? `<section class="missing-arts"><h3>可补悟的传承</h3>${missing.map(id =>
    `<div id="art-missing-${id}" tabindex="-1"><span><b>${arts[id].name}</b> · 强敌再战胜利可悟得</span>
    ${button(`rematch:${id}`, `查看${regions[id].boss}的再战`, controlsDisabled || !!fight)}</div>`).join("")}</section>` : "";
  const retry = live ? `<div class="rematch"><strong>${heading}</strong>
    ${button(challengeAction(target), "返回备战", controlsDisabled || !!fight, true)}</div>` : "";
  const stancePanel = `<section class="stance-panel" tabindex="-1"><div class="section-title"><h2>架势</h2><span>刀伤 ${stats.damage} · 气血 ${stats.life}</span></div>
    <div class="choices">${(["guard", "attack"] as const).map(stance =>
      `<button type="button" data-action="kit:stance:${stance}" aria-pressed="${save.kit.stance === stance}" ${controlsDisabled ? "disabled" : ""}>${stance === "guard" ? "守式" : "攻式"}</button>`).join("")}</div>
    <p class="meta">守式架住重击时承受 18% 伤害，还会尝试伏身、割缆等应对。攻式提升 25% 基础刀伤。</p></section>`;
  const preview = scenario ? `<details data-remember="preview" id="round-preview"><summary>${heading} · ${fullPreview ? "对照全部回合" : "对照前六回合"}</summary>
      ${fullPreview ? `<p>${battleBrief(scenario).hint}</p>` : rematch ? `<p>${rematch.detail}</p>` : alternate ? "" : `<p>${caseClues[opponent].danger}</p>${intel >= challengeClues ? `<p>${battleBrief(scenario).hint}</p>` : ""}`}
      <p class="meta">按当前装备、招式和架势推演。</p>
      <ol class="match-rounds">${Array.from({ length: simulation?.rounds.length ?? 0 }, (_, i) => {
        const { names, enemy } = roundMoves(opponent, save.kit, i + 1, scenario.riverWave, battleTiming(scenario));
        const round = simulation?.rounds[i];
        const effect = round ? `<small class="round-effect">阿照气血 ${signed(round.life)} · 敌方气血 ${signed(round.hp)}${round.marks.length ? " · " + round.marks.map(escape).join("、") : ""}</small>` : "";
        return `<li><b>第 ${i + 1} 回合</b><span>${names.length ? `<strong>${names.join(" · ")}</strong>` : "普攻"}</span><span>${enemy}</span>${effect}</li>`;
      }).join("")}</ol>
      ${simulation ? `<p class="meta">第 ${simulation.rounds.length} 回合末 · 阿照余 ${simulation.life} · 对手余 ${simulation.hp}${simulation.result === "lost" ? " · 会败阵" : simulation.result === "won" ? " · 可取胜" : ""}</p>` : ""}
    </details>` : opponent === hallRegion ? '<p class="meta">对读两册巡簿并入真人后，可查看守灯试炼的配装推演。</p>'
      : '<p class="meta">找到本地第一条线索后，可对照大妖的前六回合。</p>';
  const library = `<div class="section-title technique-list-title"><h2>招谱</h2><span>可用道行 ${integer(save.dao)}${unlearned ? ` · ${unlearned} 门待修习` : ""}</span></div>` +
    lampFusionCard() + (order.length ? order.map(id => artCard(id)).join("") : '<p class="meta">首胜吊睛山君，即可悟得镇山喝。</p>') + recovery +
    (currentTip && !skillChallenge && !/^(learn|equip|mastery)/.test(currentTip.id) ? guideCard(currentTip) : "");
  const outfit = retry ? `<section class="mirror-outfit">${outfitPanel(false)}</section>` : "";
  return retry + verdict + outfit + skillRack() + presetPanel() + (unlearned && !retry ? library + preview + stancePanel : preview + stancePanel + library);
}

const iconOrder: GearId[] = ["pineBlade", "reedBlade", "templeBlade", "hillCoat", "ferryCoat", "templeCoat", "tigerFang", "tideSeal", "mirrorPearl"];

function itemIcon(slot: GearSlot, id?: GearId) {
  const variations: Partial<Record<GearId, GearId>> = {
    postBlade: "templeBlade", postCoat: "hillCoat", postSeal: "tideSeal",
    courierBlade: "reedBlade", courierCoat: "templeCoat", courierSeal: "mirrorPearl",
    watchBlade: "pineBlade", watchCoat: "ferryCoat", watchSeal: "tigerFang", lampKnot: "mirrorPearl",
  };
  const icon = id && (variations[id] ?? id);
  return icon ? `<i aria-hidden="true" class="item-art" style="background-image:url('${assets}equipment.png');background-position:${iconOrder.indexOf(icon) * 12.5}% center"></i>`
    : `<i aria-hidden="true" class="icon empty ${slot}"></i>`;
}

function gearHint(id: GearId) {
  const hint = gearRequirement(save, id);
  return hint ? `<small class="gear-hint">${hint}</small>` : "";
}

function outfitPanel(showMoves = true) {
  const stats = loadoutStats(save);
  const rack = (Object.keys(slots) as GearSlot[]).map(slot => {
    const id = save.loadout[slot];
    const item = id && equipment[id];
    return `<button class="outfit-slot" type="button" data-action="slot:${slot}" aria-expanded="${openSlot === slot}">
      ${itemIcon(slot, id)}<span><small>${slots[slot]}${item ? " · " + item.level + " 阶" : ""}</small><b>${id ? gearName(id) : "空槽位"}</b></span></button>`;
  }).join("");
  const moves = kitNames(save.kit);
  const header = `<header><strong>阿照的行装</strong><span>刀伤 ${stats.damage} · 气血 ${stats.life}</span></header>
    <div class="outfit-slots">${rack}</div>`;
  if (!showMoves) return header;
  return header + (clueCount(save, 0) > 0 ? `<div class="outfit-moves"><span>${moves.join(" · ")}</span>${button("tab:skills", save.drops.some((known, i) => known && !save.ranks[i]) ? "有招待修习 ›" : "查看招谱 ›")}</div>` : "") + presetPanel();
}

function gearName(id: GearId) {
  return gearDisplayName(id, gearRank(id, save.rematchRanks), save.reforges);
}

function gearChanges(id: GearId) {
  const { before, after, added, lost } = compareGear(save, id);
  const rows: string[] = [];
  for (const [key, label] of [["damage", "刀伤"], ["life", "气血上限"]] as const) {
    const delta = after[key] - before[key];
    if (delta) rows.push(`<p class="${delta > 0 ? "gain" : "loss"}">${label}　${before[key]} → ${after[key]}　<b>${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)}</b></p>`);
  }
  if (added) rows.push(`<p class="gain">＋ 获得　${added}</p>`);
  if (lost) rows.push(`<p class="loss">－ 失去　${lost}</p>`);
  return `<div class="gear-changes">${rows.join("")}</div>${gearHint(id)}`;
}

function lootCard(id: GearId, recovered = false) {
  const item = equipment[id];
  const current = save.loadout[item.slot];
  const count = save.newGear.length;
  const after = count > 1 ? `还有 ${count - 1} 件待看` : !patrolRemaining(save) ? "此地小妖已扫清" : save.autoPatrol ? "选好后接着巡夜" : "选好后可再提灯";
  return `<section class="loot-card" aria-label="新得装备"><header>${itemIcon(item.slot, id)}<div><small>${recovered ? "寻回本地装备" : "拾得"} · ${slots[item.slot]} · ${item.level} 阶</small><strong>${gearName(id)}</strong></div></header>
    <small>${current ? "原装备 · " + gearName(current) : slots[item.slot] + "尚空"}</small>
    ${gearChanges(id)}<div class="loot-choices">${button("equip:" + id, "穿戴", false, true)}${button("collect:" + id, "收入行囊")}</div><small>${after}</small></section>`;
}

function slotContents(slot: GearSlot) {
  const active = save.loadout[slot];
  const items = save.ownedGear.filter(id => equipment[id].slot === slot).sort((a,b) => equipment[b].level - equipment[a].level);
  const list = items.map(id => {
    const item = equipment[id];
    const rank = gearRank(id, save.rematchRanks);
    const trait = traitText(id, rank);
    return `<li>${itemIcon(slot, id)}<div><b>${gearName(id)}</b><small>${item.level} 阶${active === id ? " · 已穿戴" : ""}</small>
      ${active === id ? `<p>${gearEffect(id, rank, save.reforges)}</p>${trait ? `<small>${trait}</small>` : ""}${gearHint(id)}` : gearChanges(id)}</div>
      ${active === id ? button("unequip:" + id, "卸下") : button("equip:" + id, "穿戴")}</li>`;
  }).join("");
  return `<div class="outfit-picker"><small>${slotNotes[slot]}</small>${list ? `<ul>${list}</ul>` : `<p>${slot === "charm" ? "击败吊睛山君，取得第一枚佩饰。" : "夜行时，小妖有机会掉落这个槽位的装备。"}</p>`}</div>`;
}

const storyChapters = [
  { name: "卷一 · 青芦夜话", stops: [0, 1, 2] },
  { name: "卷二 · 纸马驿", stops: [bridgeRegion, courierRegion, watchRegion] },
  { name: "卷三 · 云栈", stops: [cliffRegion, skyRegion] },
  { name: "卷四 · 归山", stops: [hallRegion, altarRegion] },
] as const;

function storyRecord() {
  return `<details class="story-record" data-remember="story"><summary>沿途故事</summary>
    <p>阿照替师父守一夜灯。巡簿第一页留着他的笔迹：「听见第三声，数一数岸上还有几个人。」</p>
    ${storyChapters.map(({ name, stops }, chapter) => {
      const known = stops.filter(id => unlocked(save, id) || save.victories[id]);
      if (!known.length) return "";
      return `<details data-remember="story-${chapter}"><summary>${name}</summary><ol>${known.map(id => {
        const region = regions[id];
        const resolved = id === hallRegion ? !!save.trialBest.lampTrial : !!save.victories[id];
        const testimony = id === 1 && recordedClues(save, 1) >= challengeClues ? `<p>${ferryEvidence[1]}</p>` : "";
        const aftermath = resolved ? firstVolumeAftermath.at(id) : undefined;
        return `<li><strong>${region.title}</strong><p>${region.intro}</p>${testimony}${resolved ? `<p>${region.cleared}</p>` : ""}
          ${aftermath ? `<p>${aftermath.text}</p>` : ""}${id === altarRegion && resolved ? `<p>${homecoming}</p>` : ""}</li>`;
      }).join("")}</ol></details>`;
    }).join("")}
  </details>`;
}

function archivePanel(): string {
  const unlockedEnd = mirrorUnlocked(save);
  const destinations = [...trialIds.filter(id => id === "ferryTrial" || id === "templeTrial").map(id => ({
    tab: id, title: trials[id].name, art: zoneArt[trials[id].region], label: "异相 · " + regions[trials[id].region].name,
    detail: save.trialBest[id] ? "已完成 · 妖案准备可带入对应镜战" : trials[id].goal,
  })), { tab: "mirror", title: "照妖镜", art: "mountain", label: "积砂养纹",
    detail: save.mirror.best ? `已破 ${integer(save.mirror.best)} 重 · 继续挑战` : "十二回合破一重，取淬纹砂养纹或重铸。" }];
  const cases = "<ol class=\"route-list\">" +
    regions.slice(0, bridgeRegion).map((region, i) => {
      const id = i as 0 | 1 | 2;
      const here = id === save.region;
      const access = unlocked(save, id);
      const wins = save.victories[id];
      const swept = !patrolRemaining(save, id);
      const state = !access ? "未通行" : here ? "当前地点" : wins ? "已平息" : "可前往";
      const progress = !access ? `胜过${regions[i - 1].boss}后开启` :
        [swept ? "小妖已扫清" : `线索 ${recordedClues(save, id)} / 3`,
         wins ? (save.drops[id] ? "传承已悟得" : "可在强敌再战补悟传承") : region.boss].join(" · ");
      return `<li class="route-stop" data-here="${here}" data-locked="${!access}">
        <div class="section-title"><strong>${region.name}</strong><span>${state}</span></div><p>${progress}</p>
        ${access ? `<div class="choices">${here ? button("home", "回到巡夜") : button(`region:${id}`, `前往${region.name}`, !ready || !!fight)}
        ${wins ? button(`rematch:${id}`, "查看再战", !ready || !!fight) : ""}</div>` : ""}</li>`;
    }).join("") + "</ol>";
  const nextCase = ([bridgeRegion, courierRegion, watchRegion] as const).find(id => !save.victories[id]);
  const postCases = ([bridgeRegion, courierRegion, watchRegion] as const).filter(id => unlocked(save, id));
  postCases.sort((a, b) => Number(b === nextCase) - Number(a === nextCase));
  const postRoutes = postCases.map(id => {
    const region = regions[id];
    const here = save.region === id;
    const won = !!save.victories[id];
    const label = here ? "回到巡夜" : id === bridgeRegion ? "随陆婆过河" : `前往${region.name}`;
    const progress = patrolRemaining(save, id) ? `线索 ${recordedClues(save, id)} / 3` : "小妖已扫清";
    return `<section class="post-route"><img src="${assets + zoneArt[id]}.webp" alt=""><div><small>${here ? "当前地点" : won ? "已平息" : "待查案"}</small>
      <h3>${id === bridgeRegion ? "纸马驿 · 驿桥" : region.name}</h3><p>${won ? `${arts[id].name}已悟得` : `${progress} · ${region.boss}`}</p><div class="choices">
      ${button(here ? "home" : `region:${id}`, label, !ready || !!fight, id === nextCase)}
      ${won ? button(`rematch:${id}`, "查看再战", !ready || !!fight) : canChallenge(save, id) ? button(`fight:${id}`, "挑战" + region.boss, !ready || !!fight) : ""}</div></div></section>`;
  }).join("");
  const rebattle = save.victories[0] ? `<section class="mirror-entry"><div><h3>强敌再战</h3><p>挑战强化首领，提升当地兵刃、护具和佩饰。</p></div>
    ${button("rematch", "选择首领", !ready || !!fight, true)}</section>` : "";
  const cloudRoute = unlocked(save, cliffRegion) ? `<h3>卷三 · 云栈</h3><section class="post-route"><img src="${assets}cloud-cliff.webp" alt=""><div>
    <small>${save.victories[cliffRegion] ? "守灯人已获救" : "山门已开"}</small><h3>残栈</h3><p>${save.victories[cliffRegion] ? "风灯已转正。" : "沿下层栈道查清风灯为何倒向。"}</p>
    ${button(save.region === cliffRegion ? "home" : `region:${cliffRegion}`, save.region === cliffRegion ? "回到巡夜" : "前往残栈", !ready || !!fight, !unlocked(save, skyRegion))}</div></section>` : "";
  const skyRoute = unlocked(save, skyRegion) ? `<section class="post-route"><img src="${assets}cloud-sky.webp" alt=""><div>
    <small>${save.victories[skyRegion] ? "两站灯火已相照" : "御风可达"}</small><h3>天栈</h3><p>${save.victories[skyRegion] ? "师父交来了第二册巡簿。" : "夺回上站灯芯，让两座风灯相照。"}</p>
    ${button(save.region === skyRegion ? "home" : `region:${skyRegion}`, save.region === skyRegion ? "回到巡夜" : "前往天栈", !ready || !!fight, true)}
    ${cloudMirrorUnlocked(save) ? `<div class="choices">${button("tab:cloudRelay", save.trialBest.cloudRelay ? "回看风灯接力" : "风灯接力", !ready || !!fight)}
    ${button("tab:mirror:cloud", "查看逆风镜题", !ready || !!fight)}</div>` : ""}</div></section>` : "";
  const books = save.victories[skyRegion] ? '<details data-remember="cloud-books"><summary>云栈两册巡簿</summary><p>渡口原簿记「第一船已到」。总灯房抄本却写了「全路人齐」。阿照收好两册巡簿，准备带回总灯房对读。</p></details>' : "";
  const hallRoute = unlocked(save, hallRegion) ? `<h3>卷四 · 归山</h3><section class="post-route"><img src="${assets}lamp-hall.webp" alt=""><div>
    <small>${save.trialBest.lampTrial ? "内院已点灯" : "两册巡簿可对读"}</small><h3>总灯房</h3><p>${save.trialBest.lampTrial ? "两声应答已经记入巡簿。" : "循旧灯入外院，查清铃声为何替人作答。"}</p>
    ${button(save.region === hallRegion ? "home" : `region:${hallRegion}`, save.region === hallRegion ? "回外院巡夜" : "前往总灯房外院", !ready || !!fight, true)}
    ${canEnterLampTrial(save) ? button("tab:lampTrial", "内院守灯试炼", !ready || !!fight) : ""}</div></section>` : "";
  const altarRoute = unlocked(save, altarRegion) ? `<section class="post-route"><img src="${assets}lamp-altar.webp" alt=""><div>
    <small>${save.victories[altarRegion] ? "三站已应答" : "逍遥可达"}</small><h3>主灯台</h3>
    <p>${save.victories[altarRegion] ? "总灯房已恢复逐站点名。" : "让陆婆、云栈守灯人和驿卒亲口应答。"}</p>
    ${button(save.region === altarRegion ? "home" : `region:${altarRegion}`, save.region === altarRegion ? "回主灯台" : "前往主灯台", !ready || !!fight, !save.victories[altarRegion])}</div></section>` : "";
  const ending = save.victories[altarRegion] ? `<details data-remember="homecoming"><summary>归山结局 · 第三声铃之后</summary><p>${homecoming}</p>
    ${button("region:1", "回芦花渡", !ready || !!fight)} ${button("tab:mirror:altar", "查看归山镜题", !ready || !!fight)}
    ${button("temple-reprise", "查看白烛庙错烛", !ready || !!fight)}</details>` : "";
  const rollCall = canViewTrial(save, "rollCall") ? `<section class="mirror-entry"><div><h3>${trials.rollCall.name}</h3>
    <p>${save.trialBest.rollCall ? "陆婆和驿卒已补齐名字。巡簿能削弱错页的末页。" : "归山结局后，陆婆和驿卒带来了两个人的消息。"}</p></div>
    ${button("tab:rollCall", save.trialBest.rollCall ? "回看托付" : "查看托付", !ready || !!fight)}</section>` : "";
  return `<h2>斩妖录</h2><p class="meta">今夜在${regions[save.region].name}</p>${storyRecord()}${rebattle}` + (unlockedEnd ?
    `${hallRoute}${altarRoute}${ending}${rollCall}${cloudRoute}${skyRoute}${books}<h3>卷二 · 纸马驿</h3>${postRoutes}<h3>青芦卷末</h3><div class="after-roads">${destinations.map(road =>
      `<button type="button" data-action="tab:${road.tab}" class="after-road"><img alt="" src="${assets + road.art}.webp"><span><small>${road.label}</small><strong>${road.title}</strong><span>${road.detail}</span></span><b aria-hidden="true">›</b></button>`).join("")}</div>
      <details data-remember="old-roads"><summary>首卷旧案 · 换路与再战</summary>${cases}</details>` : cases);
}

function rematchPanel() {
  const id = rematchRegion;
  const spec = rematchSpec(save, id);
  const practice = rematchPracticeAvailable(id) ? rematchSpec(save, id, true) : undefined;
  const rank = save.rematchRanks[id];
  const last = result?.rematchRank && result.region === id ? result : undefined;
  const boss = regions[id].boss;
  const selectors = regions.slice(0, cliffRegion).map((region, index) => save.victories[index]
    ? `<button type="button" data-action="rematch-select:${index}" aria-pressed="${id === index}">${region.boss}<small>强化 +${save.rematchRanks[index]} / ${maxRematchRank}</small></button>` : "").join("");
  const rewards = [bossEquipment[id], ...minionEquipment[id]].map(gear => {
    const next = spec ? spec.rank : rank;
    const before = [gearEffect(gear, rank, save.reforges), traitText(gear, rank)].filter(Boolean);
    const after = [gearEffect(gear, next, save.reforges), traitText(gear, next)].filter(Boolean);
    return `<li>${itemIcon(equipment[gear].slot, gear)}<div><strong>${equipment[gear].name}</strong>
      ${after.map((value, i) => `<small>${spec ? before[i] + " → " : ""}<b>${value}</b></small>`).join("")}</div></li>`;
  }).join("");
  const reforge = reforgeIds.find(gear => gear !== "templeBlade" && gearRegion(gear) === id);
  const reforgeLink = reforge && !save.reforges[reforge] && mirrorUnlocked(save) ? `<p class="meta">
    ${rank ? `${equipment[reforge].name}已通过再战考验，可去查看重铸进度。` : `通过首关可开启${equipment[reforge].name}的重铸资格。`}
    ${button(`tab:mirror:${reforge}`, "查看重铸")}</p>` : "";
  return `<h2>强敌再战</h2><div class="rematch-list" aria-label="已击败的首领">${selectors}</div>
    <div class="trial-layout"><section>
      <div class="trial-scene"><img src="${assets + zoneArt[id]}.webp" alt=""><div>
        <small>${regions[id].name}</small><h2>${boss}</h2></div></div>
      ${id === 2 ? templeReprisePanel() : ""}
      ${last ? `<section class="mirror-outcome"><h3>${last.won ? last.rematchPractice ? "试招取胜" : "强化成功" : "败阵"}</h3>
        <p>${last.won ? last.rematchPractice ? `第 ${last.round} 回合取胜 · 阿照余 ${last.life} 气血。` : `该地装备已升至 +${last.rematchRank}，下次出战生效。` : escape(last.reason ?? "")}</p>
        ${recoveryBlock(last)}<details data-remember="rematch-report"><summary>逐回合战报</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
      ${spec ? `<div class="trial-goal"><strong>第 ${spec.rank} 关</strong><p>${spec.detail}</p><small>气血 ${spec.hp} · 每次攻击基础伤害 +${spec.attack}</small>
        <p class="meta">${spec.prepared ? automaticPreparationText(id) : "实查第三条线索可带入准备，首关胜利也会补齐线索。"}</p></div>
        ${!last || last.won ? `<div class="actions">${button(`rematch-fight:${id}`, "挑战第 " + spec.rank + " 关", !ready || !!fight, true)}</div>` : ""}`
        : `<p>本地装备已强化至 +3。</p>${practice ? `<p class="meta">${practice.detail}</p>
          ${!last || last.won ? `<div class="actions">${button(`rematch-test:${id}`, "用当前配装试第 3 关", !ready || !!fight, true)}</div>` : ""}` : ""}`}
      ${reforgeLink}${last?.drop ? artCard(id, true) : ""}
      <div class="mirror-outfit">${outfitPanel()}</div>
    </section><section class="rematch-rewards">
      <h3>${spec ? "通关后自动强化" : "当前装备效果"}</h3><ul>${rewards}</ul>
      ${spec?.rank === 1 ? '<p class="meta">初胜同时找回漏掉的本地装备和传承。</p>' : ""}
    </section></div>`;
}

function templeReprisePanel() {
  if (!templeRepriseUnlocked(save)) return "";
  const record = save.templeReprise;
  const last = result?.templeReprise ? result : undefined;
  const rewardReady = reforgeState(save, "templeBlade") === "ready";
  return `<section class="altar-mirror-entry" id="temple-reprise-entry" tabindex="-1">
    <div class="section-title"><h3>${templeRepriseName}</h3><span>${record?.cleared ? "已通过" : "结卷再战"}</span></div>
    <p>第 4、7、10… 回合烛偏见真身。打中两次纸面会封灯，显形命中能清掉纸痕。</p>
    <p class="meta">最多 ${templeRepriseRounds} 回合。首胜解锁烛影刀重铸，基础刀伤 +${reforging.templeBlade.bonus}。</p>
    ${!last || last.won ? `<div class="actions">${button("temple-reprise-fight", record?.cleared ? "用当前配装试招" : "挑战错烛", !ready || !!fight, true)}
      ${button("temple-reprise-setup", "对照招路", !ready || !!fight)}</div>` : ""}
    ${last ? `<section class="mirror-outcome" role="status"><h3>${last.won ? last.first ? "烛影刀重铸已解锁" : "试招取胜" : "败阵"}</h3>
      ${last.won ? last.recovered && save.newGear.includes(last.recovered) ? lootCard(last.recovered, true) : "" : `<p>${escape(last.reason ?? "")}</p>`}
      ${recoveryBlock(last)}
      <details data-remember="temple-reprise-report"><summary>逐回合战报</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
    ${rewardReady ? button("tab:mirror:templeBlade", "去照妖镜重铸烛影刀", !ready || !!fight) : ""}
    ${record ? mirrorComparison(record.recent, record.previous) : ""}</section>`;
}

function trialPanel(id: TrialId) {
  const spec = trials[id];
  const best = save.trialBest[id];
  const last = result?.trialId === id ? result : null;
  if (id === "cloudRelay") {
    return `<div class="trial-layout"><section>
      <div class="trial-scene"><img src="${assets}cloud-cliff.webp" alt=""><div><small>云栈 · 守灯人托付</small><h2>${spec.name}</h2></div></div>
      <p>${best ? spec.ending : spec.opening}</p>
      ${last ? `<section class="mirror-outcome" role="status"><h3>${last.won ? "风灯已送达" : "风灯未送达"}</h3>
        ${last.won ? "" : `<p>${escape(last.reason ?? "")}</p>`}
        <small>第 ${last.round} 回合 · 连续稳住 ${last.trialProgress} / ${spec.target}</small>
        ${recoveryBlock(last)}<details data-remember="cloud-relay-report"><summary>逐回合战报</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
      ${best ? '<p class="meta">逆风镜题中，第一次扶索会借风灯照出备用结扣。前两次扶索用完后，结扣再帮你避开一次踏空。</p>'
        : `<div class="trial-goal"><strong>连续稳住两次风灯</strong><p>${spec.goal}</p><p>${spec.hint}</p><small>${trialRounds} 回合为限</small></div>`}
      <div class="actions">${best ? button("tab:mirror:cloud", "用风灯准备挑战逆风", !ready || !!fight, true)
        : last ? "" : button("trial-fight:cloudRelay", "接下托付", !ready || !!fight, true)}</div>
      </section>${best ? "" : `<section>${outfitPanel()}</section>`}</div>`;
  }
  if (id === "lampTrial") {
    return `<div class="trial-layout"><section>
      <div class="trial-scene"><img src="${assets}lamp-hall.webp" alt=""><div><small>归山 · 总灯房</small><h2>${spec.name}</h2></div></div>
      <p>${best ? spec.ending : spec.opening}</p>
      ${last ? `<section class="mirror-outcome" role="status"><h3>${last.won ? best && last.daoReward ? "两声应答已记入巡簿" : "守灯通过" : "守灯未成"}</h3>
        <p>${last.won ? last.daoReward ? `已入逍遥 · 道行 +${integer(last.daoReward)}` : "两次应答已护住。" : escape(last.reason ?? "")}</p>
        <small>第 ${last.round} 回合 · 应答 ${last.trialProgress} / ${spec.target}</small>
        ${recoveryBlock(last)}<details data-remember="trial-report"><summary>交锋详情</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
      <div class="trial-goal"><strong>护住 2 次应答</strong><p>${spec.goal}</p><p>${spec.hint}</p>${best ? `<small>首次完成用 ${best} 回合</small>` : ""}</div>
      <div class="actions">${unlocked(save, altarRegion) ? button(`region:${altarRegion}`, "前往主灯台", !ready || !!fight, true) : ""}
      ${!last || last.won ? button("trial-fight:lampTrial", best ? "用当前配装试招" : "开始守灯试炼", !ready || !!fight, !best) : ""}
      ${button("home", "回总灯房外院", !ready || !!fight)}</div>
      </section><section>${outfitPanel()}</section></div>`;
  }
  if (id === "rollCall") {
    return `<div class="trial-layout"><section>
      <div class="trial-scene"><img src="${assets}lamp-hall.webp" alt=""><div><small>归山 · 总灯房</small><h2>${spec.name}</h2></div></div>
      <p>${spec.opening}</p>
      ${best ? `<p>${spec.ending}</p>` : `<div class="trial-goal"><strong>${spec.goal}</strong><p>${spec.hint}</p><small>${trialRounds} 回合为限</small></div>`}
      ${last ? `<section class="mirror-outcome" role="status"><h3>${last.won ? "名字已补入巡簿" : "托付未成"}</h3>
        ${last.won ? "" : `<p>${escape(last.reason ?? "")}</p>`}<small>第 ${last.round} 回合 · 应答 ${last.trialProgress} / ${spec.target}</small>
        ${recoveryBlock(last)}<details data-remember="roll-call-report"><summary>逐回合战报</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
      <p class="meta">${best ? "补名巡簿已带入错页" : "完成托付后可带补名巡簿进入错页"}，第 9 回合的末页少 ${rollCallPaperCut} 点护纸。</p>
      <div class="actions">${best ? button("tab:mirror:altar", "带巡簿去错页", !ready || !!fight, true)
        : !last ? button("trial-fight:rollCall", "接下托付", !ready || !!fight, true) : ""}</div>
      </section>${best ? "" : `<section>${outfitPanel()}</section>`}</div>`;
  }
  const help = `此案完成后，对应镜中妖影可以借用妖案准备。查齐第三条线索后生效。 ${automaticPreparationText(spec.region)}`;
  return `<div class="trial-layout"><section>
    <div class="trial-scene"><img src="${assets + zoneArt[spec.region]}.webp" alt=""><div><small>${regions[spec.region].name} · 异相</small><h2>${spec.name}</h2></div></div>
    <p>${best ? spec.ending : spec.opening}</p>
    ${last ? `<section class="mirror-outcome" role="status"><h3>${last.won ? "托付已成" : "托付未成"}</h3><p>${last.won ? (last.sand ? `初成得 ${last.sand} 淬纹砂` : "已解锁对应镜战的妖案准备") : escape(last.reason ?? "")}</p>
      <small>第 ${last.round} 回合 · ${spec.counter} ${last.trialProgress} / ${spec.target}</small>
      ${recoveryBlock(last)}<details data-remember="trial-report"><summary>交锋详情</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
    ${best ? `<p class="meta">完成用 ${best} 回合</p><p>${help}</p>`
      : `<div class="trial-goal"><strong>此行所托</strong><p>${spec.goal}</p><small>${trialRounds} 回合为限${canEarnSand(save) ? ` · 初成得 ${trialSand} 淬纹砂` : ""}</small></div><p>${help}</p>`}
    ${!last || best ? `<div class="actions">${best ? button("tab:mirror", "去照妖镜", !ready, true)
      : button("trial-fight:" + id, "接下托付", !ready || !!fight, true)}</div>` : ""}
    </section>${best ? "" : `<section><h3>临行整装</h3><p>${spec.hint}</p><div class="mirror-outfit">${outfitPanel()}</div></section>`}</div>`;

}

type ComparisonAttempt = MirrorAttempt | AltarMirrorAttempt | CloudMirrorAttempt | TempleRepriseAttempt;

function mirrorComparison(current: ComparisonAttempt, previous?: ComparisonAttempt) {
  const rows = previous ? [previous, current] : [current];
  return `<div class="mirror-comparison">${rows.map((attempt, i) => `<div>
    <strong>${previous ? i === 0 ? "上次" : "本次" : "最近一战"} · ${attempt.won ? "取胜" : "败阵"} · 第 ${attempt.round} 回合</strong>
    <p>${"pages" in attempt ? `破纸 ${attempt.pages} / ${altarMirrorPages.length} · ` : ""}阿照余 ${attempt.life} / ${attempt.maxLife} 气血 · 对手余 ${attempt.hp} 气血</p>
    ${"pages" in attempt && attempt.pages >= altarMirrorPages.length - 1 && attempt.round >= altarMirrorPages[altarMirrorPages.length - 1].start ? `<p>末页护纸 ${attempt.lastPageStrength ?? altarMirrorPageStrength(altarMirrorPages.length - 1, false)}</p>` : ""}
    ${"falls" in attempt ? `<p>落地 ${attempt.falls} 次 · 备用结扣${attempt.usedLamp ? "已用" : "未触发"}</p>` : ""}
    ${"candleHits" in attempt && attempt.candleHits > 0 ? `<p>烛影刀显形加伤 ${attempt.candleHits} 次</p>` : ""}<small>${escape(attempt.build)}</small></div>`).join("")}</div>`;
}

function altarMirrorPanel() {
  if (!altarMirrorUnlocked(save)) return "";
  const history = save.mirror.altar;
  const prepared = !!save.trialBest.rollCall;
  const last = result?.altarMirror ? result : undefined;
  const nextReforge = reforgeIds.find(id => reforgeState(save, id) === "ready");
  const rewardLink = nextReforge ? button(`reforge-focus:${nextReforge}`, `查看${equipment[nextReforge].name}重铸`)
    : button("engraving-focus", "去刻纹");
  return `<section class="altar-mirror-entry" id="altar-mirror-entry" tabindex="-1">
    <div class="section-title"><h3>${altarMirrorName}</h3><span>${history?.cleared ? "已首破" : "归山终战后开放"}</span></div>
    <p>十二回合内破掉三页并击退妖影。第二页的两轮窗口留给刀招。</p>
    <ol class="altar-stations" aria-label="破纸时机">${altarMirrorPages.map((page, index) =>
      `<li><strong>第 ${index + 1} 页</strong><small>第 ${page.start}–${page.deadline} 回合</small><small>强度 ${altarMirrorPageStrength(index, prepared)}</small></li>`).join("")}</ol>
    <p class="meta">${prepared ? `补名巡簿已带入，末页护纸 −${rollCallPaperCut}。` : `完成代为报人，末页可少 ${rollCallPaperCut} 点护纸。`}</p>
    ${!last || last.won ? `<div class="actions">${button("altar-mirror-fight", history?.cleared ? "用当前配装试招" : "挑战错页", !ready || !!fight, true)}
    ${button("altar-mirror-setup", "对照招路", !ready || !!fight)}</div>` : ""}
    ${prepared ? "" : button("tab:rollCall", "查看代为报人", !ready || !!fight)}
    ${!history?.cleared && canEarnSand(save) ? `<p class="meta">首破得 ${altarMirrorSand} 淬纹砂，供现有刻纹与重铸使用。</p>` : ""}
    ${last ? `<section class="mirror-outcome" role="status"><h3>${last.won ? "击破错页" : "合镜败阵"}</h3>
    <p>${last.won ? last.sand ? `首破获得 ${last.sand} 淬纹砂。` : "试招记录已保存。" : escape(last.reason ?? "")}</p>
    ${last.sand ? rewardLink : ""}${recoveryBlock(last)}
    <details data-remember="altar-mirror-report"><summary>逐回合战报</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
    ${history ? mirrorComparison(history.recent, history.previous) : ""}
    </section>`;
}

function cloudMirrorPanel() {
  if (!cloudMirrorUnlocked(save)) return "";
  const history = save.mirror.cloud;
  const last = result?.cloudMirror ? result : undefined;
  const reward = !history?.cleared && canEarnSand(save);
  const nextReforge = reforgeIds.find(id => reforgeState(save, id) === "ready");
  return `<section class="altar-mirror-entry" id="cloud-mirror-entry" tabindex="-1">
    <div class="section-title"><h3>${cloudMirrorName}</h3><span>${history?.cleared ? "已首破" : "天栈首胜后开放"}</span></div>
    <p>十二回合内击退鸮影。第 1、4、7… 回合掠栈，踏空就在下一回合先扣落地伤。</p>
    <p class="meta">${save.trialBest.cloudRelay ? "风灯准备已带入。守式首次扶索会找到备用结扣，可再护住一次踏空。" : "做完风灯接力，守式可以多扶索一次。"}${reward ? `首破得 ${cloudMirrorSand} 淬纹砂。` : ""}</p>
    <div class="actions">${!last || last.won ? button("cloud-mirror-fight", history?.cleared ? "用当前配装试招" : "挑战逆风", !ready || !!fight, true) : ""}
    ${!save.trialBest.cloudRelay ? button("tab:cloudRelay", "查看风灯接力", !ready || !!fight) : ""}</div>
    ${last ? `<section class="mirror-outcome" role="status"><h3>${last.won ? "击破逆风鸮影" : "败阵"}</h3>
      <p>${last.won ? last.sand ? `首破获得 ${last.sand} 淬纹砂。` : "试招记录已保存。" : escape(last.reason ?? "")}</p>
      ${last.sand ? nextReforge ? button(`reforge-focus:${nextReforge}`, `查看${equipment[nextReforge].name}重铸`) : button("engraving-focus", "去刻纹") : ""}
      ${recoveryBlock(last)}
      <details data-remember="cloud-mirror-report"><summary>逐回合战报</summary><ol class="log">${last.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : ""}
    ${history ? mirrorComparison(history.recent, history.previous) : ""}
    </section>`;
}

function reforgePanel() {
  const cards = reforgeIds.filter(id => id !== "templeBlade" || templeRepriseUnlocked(save)).map(id => {
    const { chapter, cost } = reforging[id];
    const region = gearRegion(id) as Region;
    const state = reforgeState(save, id);
    const rank = gearRank(id, save.rematchRanks);
    const current = gearEffect(id, rank, save.reforges);
    const reforged = gearEffect(id, rank, { [id]: true });
    const trait = traitText(id, rank);
    const missing = Math.max(0, cost - save.mirror.sand);
    const path = state === "story" ? regions.findIndex((_, i) => i <= chapter && !save.victories[i] && unlocked(save, i as Region)) : -1;
    const goal = state === "story" ? `需要击败${regions[chapter].boss}。${path >= 0 && path !== chapter ? `先平${regions[path].name}的妖案，再沿路前往。` : ""}` : state === "rematch"
      ? `先通过${regions[region].boss}的再战首关，可同时补齐本地装备。`
      : state === "reprise" ? "通过白烛庙错烛再战后开放，可同时找回烛影刀。"
      : state === "gear" ? `先取得${equipment[id].name}。` : state === "ready" && missing ? `还差 ${integer(missing)} 砂。` : "";
    const disabled = !ready || !!fight;
    const action = state === "done" ? button(`slot:${equipment[id].slot}`, "查看装备", disabled)
      : state === "ready" ? button(`reforge:${id}`, `重铸 · ${cost} 砂`, disabled || !!missing, true)
      : state === "rematch" ? button(`rematch:${region}`, "查看再战首关", disabled)
      : state === "reprise" ? button("temple-reprise", "查看错烛再战", disabled)
      : path >= 0 ? button(`region:${path}`, `前往${path === bridgeRegion ? "驿桥" : regions[path].name}`, disabled) : "";
    return `<article class="engraving reforge-card" id="reforge-${id}" tabindex="-1"><div class="section-title"><h3>${gearName(id)}</h3></div>
      <p>${current}${state === "done" ? "" : " → " + reforged}</p><small>${trait}</small>
      ${goal ? `<p class="meta">${goal}</p>` : ""}${action ? `<div class="choices">${action}</div>` : ""}</article>`;
  }).join("");
  return `<section class="mirror-engraving"><h2>旧装重铸</h2><p class="meta">每件可重铸一次，提升基础属性，保留原有词条。</p>${cards}</section>`;
}

function mirrorPanel() {
  const { best, sand, ranks, equipped, recent } = save.mirror;
  const next = best + 1;
  const chosen = mirrorPrepLevel();
  const opponent = mirrorOpponent(next);
  const wave = opponent.riverWave;
  const rhythm = opponent.region === 2 ? "第 3、6、9… 回合见真身" : `第 ${wave}、${wave + 3}、${wave + 6}… 回合起回浪`;
  const advice = opponent.region === 2 ? "连斩两次纸面会反噬。守式会找机会挑灯，照影能显形。"
    : wave === 2 ? "回浪提前。听潮步能避浪，割缆可以断水。" : "河伯汲水三次会覆舟。割缆或引浪倒撞能清空水位。";
  const outcome = result?.mirrorLevel ? `<section class="mirror-outcome"><h3>第 ${integer(result.mirrorLevel)} 重 · ${mirrorOpponent(result.mirrorLevel).name} · ${result.won ? "击破妖影" : "败阵"}</h3>
    <p>${result.won ? (result.sand ? `首破获得 ${integer(result.sand)} 淬纹砂` : result.mirrorLevel === best && !result.previousMirror?.won ? "已破此重" : "试招完成") : escape(result.reason ?? "")}</p>
    ${recoveryBlock(result)}
    ${recent?.level === result.mirrorLevel ? mirrorComparison(recent, result.previousMirror) : ""}
    <details data-remember="mirror-report"><summary>交锋详情</summary><ol class="log">${result.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : "";
  const runes = (Object.keys(engravings) as Engraving[]).map(id => {
    const engraving = engravings[id];
    const rank = ranks[id];
    const cost = engravingCost(rank);
    const power = engravingPower(id, rank);
    const nextPower = rank < maxEngravingRank ? engravingPower(id, rank + 1) : power;
    const effect = !rank ? `启纹后${engraving.effect} +${nextPower}` : `${engraving.effect} +${power}`;
    return `<section class="engraving"><header><strong>${engraving.name}</strong><span>${rank ? `第 ${rank} 纹${equipped === id ? " · 已装备" : ""}` : "未启纹"}</span></header>
      <p>${engraving.trigger}，${effect}。</p><div class="choices">
      ${rank < maxEngravingRank ? button(`engraving:train:${id}`, `${rank ? "温养至 +" + nextPower : "启纹"} · ${cost} 砂`, sand < cost, !rank) : ""}
      ${rank ? button(`engraving:equip:${id}`, equipped === id ? "卸下" : "装备") : ""}</div>
      ${rank < maxEngravingRank && sand < cost ? `<small>还差 ${integer(cost - sand)} 砂</small>` : ""}</section>`;
  }).join("");
  const prep = mirrorOpponent(chosen).region;
  const reforgeAvailable = reforgeIds.find(id => reforgeState(save, id) === "ready");
  const trial = prep === 1 ? "ferryTrial" : "templeTrial";
  const prepInfo = mirrorPreparation(save, prep) ? automaticPreparationText(prep) : save.trialBest[trial]
    ? `已完成${trials[trial].name}。查齐${regions[prep].name}的第三条线索可带入准备。`
    : `完成「${trials[trial].name}」后，可把当地妖案准备带入这一类镜战。`;
  return `<div class="mirror-layout"><section><div class="section-title"><h2>照妖镜</h2><span>淬纹砂 <b>${integer(sand)}</b></span></div><p class="meta">${!canEarnSand(save)
    ? `已破第 ${integer(best)} 重 · 当前可用的刻纹与重铸已完成` : best ? `已破第 ${integer(best)} 重 · 每小时积攒 ${sandRate(best)} 砂` : "击破第一重后，镜中开始积砂。"}</p>
    ${reforgeAvailable ? `<div class="choices">${button(`reforge-focus:${reforgeAvailable}`, "查看可重铸的装备")}</div>` : ""}
    ${cloudMirrorPanel()}${altarMirrorPanel()}${outcome}<article class="mirror-entry"><div><h3>第 ${integer(next)} 重 · ${opponent.name}</h3><p>最多 ${mirrorRounds} 回合 · ${rhythm}</p><p class="meta">${advice}</p></div>
    ${button(`mirror-fight:${next}`, result?.mirrorLevel === next ? "再试此重" : "照见妖影", !ready || !!fight, true)}</article>
    ${best ? `<form id="mirror-practice"><label>试招重数 <input type="number" min="1" max="${best}" step="1" value="${chosen <= best ? chosen : best}" required name="level"></label>
      ${button("mirror-setup", "对照招路", !ready || !!fight)}<button type="submit" ${!ready || !!fight ? "disabled" : ""}>试招出战</button></form>` : ""}
    <p class="meta">第 ${integer(chosen)} 重备战 · ${prepInfo}
      ${mirrorPreparation(save, prep) ? "" : save.trialBest[trial] ? button(`rematch:${prep}`, "查看补线索途径") : button(`tab:${trial}`, "查看异相")}</p>
    ${!result?.mirrorLevel && recent ? `<details data-remember="recent-mirror"><summary>第 ${recent.level} 重 · 最近的配装与结果</summary>${mirrorComparison(recent)}</details>` : ""}
    <div class="mirror-outfit">${outfitPanel()}</div></section>
    <div><section class="mirror-engraving"><h2>刻纹</h2><p class="meta">一次可带一条，切换免费。离线最多积八小时。</p>${runes}</section>${reforgePanel()}</div></div>`;
}

function paintHelp() {
  const toggle = help.querySelector<HTMLButtonElement>("[data-action=guide-toggle]")!;
  toggle.textContent = save.guide.enabled ? "收起巡夜指引" : "显示巡夜指引";
  toggle.disabled = !ready || !!pending;
  const tip = (tab === "patrol" && !result ? clueTip(save, true) : undefined)
    ?? nextTip({ ...save, guide: { ...save.guide, enabled: true, dismissed: [] } }, tab, result);
  changedText("#guide-current", fight?.trial ? trials[fight.trial.id].goal : fight?.boss ? "阿照会按上场的配装出手。战果中可以查看哪一回合打断了敌招、触发了词条或败阵。" : isTrial(tab) ? trials[tab].hint : save.newGear.length ? "阿照停下来查看新拾的装备。穿在身上或收入行囊后，再继续巡夜。" : tip?.text ?? "点境界看道行，点行装槽位换装。");
}

function guideCard(tip: Tip) {
  const target = tip.target;
  return `<section class="guide-card" aria-label="当前指引">
    <div class="guide-head"><strong>${tip.title}</strong>${button("guide-dismiss", "知道了")}</div>
    <p>${tip.text}</p>${target ? button("guide-jump", target.label) : ""}
  </section>`;
}

function paintPanel() {
  const active = document.activeElement as HTMLElement | null;
  const focused = active?.dataset.action;
  const focusedArt = active?.closest(".technique")?.id;
  panel.dataset.tab = tab;
  currentTip = ready && !pending && !fight?.boss && (save.victories[0] || tab !== "patrol") ? nextTip(save, tab, result) : undefined;
  const body = pending ? title("存档待写入", "巡簿暂存", "刚才的结果已暂存。恢复写入后可继续巡夜。") + button("retry", "重试写入", false, true)
    : !ready && waiting !== "另一页正在巡夜，此页可查阅巡簿" ? title("青芦夜话", "巡簿", waiting)
      : isTrial(tab) ? trialPanel(tab) : { patrol: patrolPanel, practice: practicePanel, skills: skillsPanel, archive: archivePanel, mirror: mirrorPanel, rematch: rematchPanel }[tab]();
  const inBook = !!pending || !ready || tab !== "patrol" || journal || !!result;
  const lead = !inBook && !fight?.boss ? clueTip(save) : undefined;
  const clueGuide = element("#clue-guide");
  clueGuide.hidden = !lead;
  const clueMarkup = lead ? `<div role="status"><strong>${lead.title}</strong><p>${lead.text}</p></div>
    <div class="clue-actions">${button("clue-guide-open", lead.label)}${button("clue-guide-dismiss", "知道了")}</div>` : "";
  if (clueGuide.dataset.markup !== clueMarkup) {
    clueGuide.innerHTML = clueMarkup;
    clueGuide.dataset.markup = clueMarkup;
  }
  const repeatsClue = currentTip?.target?.action === "preview" && clueCount(save) > 0;
  const homeTip = !lead && !repeatsClue && !inBook && patrolRemaining(save) > 0 && !save.newGear.length && currentTip;
  const repeatsControl = homeTip && (homeTip.target?.action === "auto-patrol" || homeTip.target?.action?.startsWith("region:") || homeTip.id.startsWith("learn-") || homeTip.id === "after-chapter" && save.region === 2);
  const outfit = element("#outfit");
  outfit.hidden = inBook || !!fight?.boss;
  if (!outfit.hidden) {
    const markup = outfitPanel();
    if (outfit.dataset.markup !== markup) {
      const action = outfit.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.action : undefined;
      const presetsOpen = !!outfit.querySelector(".preset-panel details[open]");
      outfit.innerHTML = markup;
      outfit.dataset.markup = markup;
      const details = outfit.querySelector<HTMLDetailsElement>(".preset-panel details");
      if (details) details.open = presetsOpen;
      if (action) (outfit.querySelector<HTMLElement>(`[data-action="${action}"]`) ?? outfit.querySelector<HTMLElement>(`[data-action="slot:${openSlot}"]`))?.focus({ preventScroll: true });
    }
  }
  if (openSlot && (!outfit.hidden || tab === "mirror" || tab === "rematch" || tab === "skills" || isTrial(tab)) && !fight?.boss && !pending) {
    changedText("#pack-title", slots[openSlot]);
    const list = element("#pack-list");
    const markup = slotContents(openSlot);
    if (list.dataset.html !== markup) { list.innerHTML = markup; list.dataset.html = markup; }
  } else if (packSheet.open) packSheet.close();
  const guide = element("#home-guide");
  guide.hidden = !homeTip;
  const tipHtml = homeTip ? `<div class="margin-note"><p>${homeTip.text}</p>
    ${homeTip.target && !repeatsControl ? button("guide-jump", homeTip.target.label) : ""}${button("guide-dismiss", "知道了")}</div>` : "";
  if (guide.dataset.tip !== tipHtml) { guide.innerHTML = tipHtml; guide.dataset.tip = tipHtml; }
  element(".theatre").hidden = inBook;
  element("#book").hidden = !inBook;
  const parent = backTrail[backTrail.length - 1];
  element(".back").hidden = !!pending || !ready || (!parent && tab !== "patrol" && tab !== "practice");
  changedText(".back", "‹　返回" + (parent ? pageName(parent) : "巡夜"));
  element<HTMLButtonElement>(".cultivation").disabled = !!fight?.boss || !ready || !!pending;
  const bookLoot = inBook && ready && !pending && !fight?.boss && !(result && tab === "patrol") && save.newGear[0];
  const drop = bookLoot ? lootCard(bookLoot) : "";
  const html =
    (inBook && !journal && tab !== "skills" && tab !== "archive" && currentTip && !(result && tab === "patrol") ? guideCard(currentTip) : "") +
    body + drop;
  if (html !== renderedPanel) {
    const scroll = panel.scrollTop;
    const edits = [...panel.querySelectorAll<HTMLInputElement>(".preset-slot input")].map(input => ({
      value: input.value, changed: input.value !== input.defaultValue, focused: input === active,
      start: input.selectionStart, end: input.selectionEnd,
    }));
    const openDetails = [...panel.querySelectorAll<HTMLDetailsElement>("details[open][data-remember]")].map(item => item.dataset.remember);
    panel.innerHTML = html;
    for (const details of panel.querySelectorAll<HTMLDetailsElement>("details[data-remember]")) {
      details.open = openDetails.includes(details.dataset.remember);
    }
    panel.querySelectorAll<HTMLInputElement>(".preset-slot input").forEach((input, i) => {
      const edit = edits[i];
      if (edit?.changed) input.value = edit.value;
      if (edit?.focused) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(edit.start, edit.end);
      }
    });
    panel.scrollTop = scroll;
    renderedPanel = html;
  }
  if (help.open) paintHelp();
  const firstClue = clueCount(save, 0) > 0;
  for (const item of root.querySelectorAll<HTMLButtonElement>(".nav button")) {
    const key = item.dataset.action?.split(":")[1];
    item.hidden = !!fight?.boss || !(save.victories[0] || firstClue || key === "patrol");
    if (key === "skills") item.textContent = save.drops.some((known, index) => known && !save.ranks[index]) ? "招式 · 待修习" : "招式";
    if (key === "patrol") item.textContent = save.newGear.length && inBook ? "巡夜 · 待整装" : "巡夜";
    if (key === tab || key === "archive" && (tab === "mirror" || tab === "rematch" || isTrial(tab))) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  if (focused && !root.contains(document.activeElement)) {
    const control = [...panel.querySelectorAll<HTMLButtonElement>("button")].find(item => item.dataset.action === focused);
    const destination = control ?? (focusedArt ? panel.querySelector<HTMLElement>(`#${focusedArt}`) : null);
    destination?.focus({ preventScroll: true });
    if (focusedArt) destination?.scrollIntoView({ block: "nearest" });
  }
  element("#dao").textContent = integer(save.dao);
  element(".nav").hidden = root.querySelectorAll(".nav button:not([hidden])").length < 2;
  element("#balance").hidden = !save.victories[0];
  element("#realm").textContent = realmLabel();
  const xp = cultivationFor(save);
  const bar = element<HTMLProgressElement>("#xp");
  bar.max = xp.needed;
  bar.value = xp.progress;
  changedText("#xp-text", xp.full ? "十层圆满" : `本层道行 ${xp.progress} / ${xp.needed}`);
  changedText(".subtitle", save.region >= bridgeRegion ? regions[save.region].chapter : "卷一 · 青芦夜话");
  element("#status").textContent = pending ? "存档待写入" : ready ? "本地存档" : waiting;
  paintPatrolControls();
}

function paperHorseGateText() {
  const needed = Math.max(0, heartDao - save.lifetimeDao);
  return `线索已齐。距心斋还差 ${needed} 道行，约再巡 ${Math.ceil(needed / regions[courierRegion].reward)} 只小妖。入心斋后可同时带两门武学。`;
}

function paintPatrolControls() {
  const locked = !ready || !!pending || document.hidden;
  hunt.disabled = locked || !!fight || save.autoPatrol;
  autoPatrol.hidden = !save.victories[0] || !patrolRemaining(save);
  autoPatrol.disabled = locked || !!fight?.boss;
  autoPatrol.setAttribute("aria-pressed", String(save.autoPatrol));
  const region = regions[save.region];
  const done = save.victories[save.region] > 0;
  const clues = recordedClues(save);
  changedText("#case-progress", done ? "已平息 · 查看妖案" : clues ? clueLabels[clues - 1] : "寻找线索");
  changedText("#case-name", region.title);
  element(".case-link").hidden = !!fight?.boss || !done && !clues && patrolRemaining(save) > 0;
  element(".retreat").hidden = !fight?.boss;
  element(".gauges").hidden = !fight?.boss;
  element(".patrol-controls").hidden = !!fight?.boss || save.newGear.length > 0;
  changedText("[data-action=auto-patrol]", save.autoPatrol ? "收灯歇脚" : "沿路巡夜");
  const challenge = element<HTMLButtonElement>("#challenge");
  const swept = patrolRemaining(save) === 0;
  const track = element<HTMLProgressElement>("#clue-track");
  track.hidden = swept || clues >= 3 || !save.kills[save.region];
  if (!track.hidden) {
    const from = clues ? region.thresholds[clues - 1] : 0;
    track.max = region.thresholds[clues] - from;
    track.value = Math.max(0, save.kills[save.region] - from);
  }
  const onward = done && save.region < regions.length - 1 && unlocked(save, (save.region + 1) as Region);
  const challengeOpen = !done && canChallenge(save, save.region);
  const surveyReady = save.region === cliffRegion && !save.windSurveyed && clueCount(save) >= challengeClues;
  const bookReady = canCompareBooks(save);
  const lampReady = save.region === hallRegion && canEnterLampTrial(save);
  const altarReady = save.region === hallRegion && unlocked(save, altarRegion);
  const homecomingReady = save.region === altarRegion && done;
  challenge.hidden = !!fight?.boss || !onward && !surveyReady && !challengeOpen && !bookReady && !lampReady && !homecomingReady;
  challenge.dataset.action = onward ? "region:" + (save.region + 1) : altarReady ? `region:${altarRegion}`
    : homecomingReady ? "region:1" : surveyReady || bookReady ? "journal" : lampReady ? "tab:lampTrial" : "fight:" + save.region;
  changedText("#challenge", onward ? save.region === 2 ? "随陆婆过河" : "前往" + regions[save.region + 1].name
    : altarReady ? "前往主灯台" : homecomingReady ? "回芦花渡" : surveyReady ? "去妖案查风灯" : bookReady ? "去妖案对读巡簿"
      : lampReady ? "前往内院守灯" : "挑战" + region.boss);
  challenge.disabled = locked || !!fight;
  hunt.hidden = !!fight?.boss || save.autoPatrol || swept;
  hunt.classList.toggle("secondary", !challenge.hidden);
  changedText("[data-action=hunt]", challenge.hidden ? "提灯夜行" : !done && clues === challengeClues ? "继续巡夜备战" : "继续夜行");
  const objective = element("#objective");
  objective.hidden = !save.guide.enabled && !swept && !onward && save.region === 0 && save.kills[0] === 0;
  if (!objective.hidden) {
    const remainingKills = clues < 3 ? region.thresholds[clues] - save.kills[save.region] : 0;
    const hallObjective = lampReady ? save.trialBest.lampTrial ? "两声应答已记下。阿照正准备前往主灯台。" : "已入真人，可以到内院守灯。"
      : bookReady ? "两册巡簿的记法对不上。到妖案把它们并排对读。"
        : save.booksCompared ? `巡簿已对读。再巡得 ${Math.max(0, trueDao - save.lifetimeDao)} 道行即可入真人。` : `巡查外院，再斩 ${remainingKills} 只查下一条证据。`;
    changedText("#objective", save.region === hallRegion ? (swept ? "外院已扫清。" : "") + hallObjective
      : onward && save.region === 2 ? "纸马驿也响起第三声铃。陆婆在渡口等阿照上船。"
      : onward ? (swept ? "此地小妖已扫清。" : region.boss + "已退。") + "可前往" + regions[save.region + 1].name + "。"
      : done ? (swept ? "此地小妖已扫清。" : "") + (save.region === altarRegion ? "三站已逐个应答。回芦花渡看看最后一程。"
        : save.region === skyRegion ? "两站灯火已相照。两册巡簿可在斩妖录回看。" : "守灯人安全了，风灯照见向上的索路。")
      : challengeOpen ? (swept ? "此地小妖已扫清，可以挑战" + region.boss + "。" : clues === challengeClues ? `可挑战${region.boss}。再斩 ${remainingKills} 只，备好应变。` : "应变已备好，可以挑战" + region.boss + "。")
      : clues >= challengeClues || swept ? save.region === cliffRegion ? cliffGateText() : save.region === courierRegion ? paperHorseGateText() : `已找到${region.boss}，进入${realms[challengeRealms[save.region]]}境后可挑战。`
      : save.region === cliffRegion && !save.kills[cliffRegion] ? "提灯巡栈，追查倒向山外的风灯。"
      : save.region === 0 && save.kills[0] === 0 && save.guide.enabled ? "提灯上山找失踪的挑油人。斩到第三只小妖，就能查山君招路。" : `再斩 ${remainingKills} 只，${clueLabels[clues]}。`);
  }
  const drop = element("#gear-find");
  const id = save.newGear[0];
  element("#loot-strip").hidden = !id || !!fight?.boss || locked;
  if (id && !fight?.boss && !locked && !element(".theatre").hidden) {
    const markup = lootCard(id);
    if (drop.dataset.markup !== markup) { drop.innerHTML = markup; drop.dataset.markup = markup; }
  }
}

const packSheet = element<HTMLDialogElement>("#pack-sheet");
packSheet.addEventListener("close", () => { openSlot = undefined; paintPanel(); });
function showSlot(slot: GearSlot) {
  openSlot = slot;
  paintPanel();
  if (!packSheet.open) packSheet.showModal();
}

const battleSheet = element<HTMLDialogElement>("#battle-sheet");
const battleStart = element<HTMLFormElement>("#battle-start");
let pendingBattle: Challenge | undefined;
let battleBuilds: BuildSuggestion[] = [];
let manualChanges: BuildChange[] = [];
let manualBuild: BuildSuggestion | undefined;
let battleAdvice: RecoveryTip | undefined;
battleSheet.addEventListener("close", () => {
  if (battleSheet.open) return;
  pendingBattle = undefined;
  battleBuilds = [];
  manualChanges = [];
  manualBuild = undefined;
  battleAdvice = undefined;
});

function battleVerdict(projected: Fight) {
  if (projected.result === "fighting") return "<p>暂时无法推演整场。</p>";
  const won = projected.result === "won";
  const close = won && projected.life / projected.maxLife < 0.25;
  const reason = won ? "" : defeatSummary(projected);
  const detail = won ? `第 ${projected.round} 回合取胜 · 阿照余 ${projected.life} / ${projected.maxLife} 气血`
    : reason.startsWith("第 ") ? reason : `第 ${projected.round} 回合 · ${reason}`;
  return `<section class="battle-verdict" data-verdict="${projected.result}" data-close="${close}">
    <strong>${won ? close ? "低余血取胜" : "推演可过" : "推演败阵"}</strong>
    <p>${escape(detail)}</p>
  </section>`;
}

function battleBuildText(before: Fight, after: Fight) {
  const same = before.result === after.result && before.life === after.life && before.round === after.round && before.hp === after.hp;
  if (same) return "这项调整在本场的胜负、回合和余血均无变化。";
  const outcome = (fight: Fight) => `${fight.round} 回合${fight.result === "won" ? "取胜" : "败阵"}`;
  const dodge = after.log.findIndex((line, index) => line.includes("闪避过冲灯") && !before.log[index]?.includes("闪避过冲灯"));
  const writ = after.log.findIndex((line, index) => line.includes("路引 +") && !before.log[index]?.includes("路引 +"));
  const effect = dodge >= 0 ? ` · 第 ${dodge + 1} 回合避开冲灯${after.log[dodge].includes("渡水蓑回复") ? "并由渡水蓑回气" : ""}`
    : writ >= 0 ? ` · 第 ${writ + 1} 回合折篙刀吃到路引加伤` : "";
  return `${outcome(before)} → ${outcome(after)} · 余血 ${Math.max(0, before.life)} → ${Math.max(0, after.life)}${effect}`;
}

root.addEventListener("change", event => {
  const input = event.target;
  if (!(input instanceof HTMLSelectElement) || input.id !== "battle-trial-change" || !battleSheet.open || !pendingBattle) return;
  const output = element("#battle-trial-result");
  const challenge = pendingBattle;
  const current = challengeFight(challenge);
  const choice = manualChanges[Number(input.value) - 1];
  const build = current && choice ? previewBuild(save, draft => challengeFight(challenge, draft), [choice]) : undefined;
  manualBuild = undefined;
  output.innerHTML = "";
  if (!current || !build) return;
  const before = previewBattle(current);
  const applies = !build.cost || battleBuildImproves(before, build.outcome);
  if (applies) manualBuild = build;
  output.innerHTML = `<p>${escape(battleBuildText(before, build.outcome))}</p>${applies
    ? button("battle-build:trial", build.cost ? `确认应用 · ${build.cost} 道行` : "应用调整")
    : `<p class="meta">预计花费 ${build.cost} 道行，当前试配未扣费。</p>`}`;
});

function renderBattleBrief(encounter: Fight, challenge: Challenge) {
  changedText("#battle-title", "迎战" + encounter.name);
  const projected = previewBattle(encounter);
  const won = projected.result === "won";
  element("#battle-verdict").innerHTML = battleVerdict(projected);
  const start = element<HTMLButtonElement>("#battle-start button[type=submit]");
  start.classList.toggle("primary", won);
  start.textContent = won ? "开始交锋" : "仍以当前配装出战";
  const brief = battleBrief(encounter);
  battleAdvice = projected.result === "lost" ? battleRecovery(save, projected) : undefined;
  const paper = !!encounter.paperHorseCase;
  battleBuilds = battleAdvice || paper ? compareBattleBuilds(save, draft => challengeFight(challenge, draft), projected) : [];
  manualChanges = paper ? availableBuildChanges(save).singles : [];
  manualBuild = undefined;
  const loadoutButton = element<HTMLButtonElement>("#battle-start [data-action=battle-loadout]");
  loadoutButton.classList.toggle("primary", !!battleAdvice && !battleBuilds.length);
  const stage = encounter.cloudMirror ? cloudMirrorName : encounter.templeReprise ? templeRepriseName
    : encounter.rematchRank ? `强敌再战 · 第 ${encounter.rematchRank} 关${encounter.rematchPractice ? "试招" : ""}`
    : encounter.altarMirror ? altarMirrorName : encounter.mirrorLevel ? `照妖镜 · 第 ${integer(encounter.mirrorLevel)} 重` : "";
  element("#battle-brief").innerHTML = `${stage ? `<small>${stage}</small>` : ""}
    <p class="battle-threat"><strong>${escape(brief.threat)}</strong></p>
    ${battleAdvice ? `<p>${escape(battleAdvice.text)}</p>` : paper ? `<p>${escape(brief.hint)}</p>` : ""}
    ${encounter.trial ? `<p class="battle-objective">${trials[encounter.trial.id].goal}</p>` : ""}
    <p class="meta">${kitNames(encounter.kit).join(" · ")} · ${Object.values(encounter.loadout).map(gearName).join("、") || "未穿戴装备"}</p>`;
  const suggestions = battleBuilds.length
    ? `<details class="battle-build-list"${paper ? " open" : ""}><summary>${won ? "对照更合适的配装" : "对照可过的配装"}</summary>${battleBuilds.map((build, i) => {
      const effect = ["风灯结扣", "护住风灯", "照灯断影破纸", "符火破纸", "踏缆步追及", "压灯引鹞", "截断升空", "听潮步避开掠栈", "扶索稳身", "听潮步避开沾衣", "照影清纸痕", "符火引爆", "照影显形", "折篙刀追斩", "割缆断流", "伏身避啸"]
        .find(mark => build.outcome.links[mark] > (projected.links[mark] ?? 0));
      return `<section class="battle-build">
        <div><strong>${escape(build.label)}</strong><p>${paper ? escape(battleBuildText(projected, build.outcome)) : `第 ${build.outcome.round} 回合取胜 · 余 ${build.outcome.life} 气血${effect ? ` · ${effect} ×${build.outcome.links[effect]}` : ""}`}</p></div>
        ${button(`battle-build:${i}`, build.cost ? `修习并应用 · ${build.cost} 道行` : "应用这套", false, i === 0)}
      </section>`;
    }).join("")}</details>`
    : battleAdvice ? '<p class="meta">试过的单项和常见组合里，暂时没找到能过的配装。</p>' : "";
  const fallback = paper && !won && !battleBuilds.some(build => build.cost === 0) && !save.rematchRanks[bridgeRegion]
    ? `<p class="meta">强敌再战的驿桥首关可补齐青石刀和驿衣。${button(`rematch:${bridgeRegion}`, "查看驿桥再战")}</p>` : "";
  const manual = manualChanges.length ? `<details class="battle-forecast"><summary>免费试配一项</summary>
    <label for="battle-trial-change">选择要试的调整</label><select id="battle-trial-change"><option value="0">选择装备或招式</option>
    ${manualChanges.map((change, i) => `<option value="${i + 1}">${escape(changeLabel(save, change))}</option>`).join("")}</select><div id="battle-trial-result" aria-live="polite"></div></details>` : "";
  element("#battle-builds").innerHTML = suggestions + fallback + manual;

  const simulation = forecastFight(encounter, encounter.region === skyRegion || encounter.altarAnswers || encounter.altarMirror || encounter.cloudMirror || encounter.templeReprise || encounter.trial?.id === "lampTrial" || encounter.trial?.id === "cloudRelay" || encounter.trial?.id === "rollCall" ? encounter.limit : 6);
  const ending = simulation.result === "won" ? " · 取胜" : simulation.result === "lost" ? " · 败阵" : "";
  const pursuits = simulation.rounds.filter(round => round.marks.includes("湿衣追篙")).length;
  const clue = caseClues[encounter.region];
  const assisted = simulation.rounds.find(round => round.marks.includes(clue.aid));
  const { safe, risk } = encounters[encounter.region];
  const response = simulation.rounds.find(round => round.marks.includes(safe.name) || round.marks.includes(risk.name));
  const used = response?.marks.includes(safe.name) ? safe.name : risk.name;
  const pressure = encounter.region === 1
    ? `水位 ${simulation.water} / ${riverFloodLimit}${riverPursuitActive(encounter) && pursuits ? ` · 遭追篙 ${pursuits} 次` : ""}`
    : projected.cloudMirror ? `预计落地 ${projected.cloudMirror.falls} 次${projected.links["风灯结扣"] ? " · 风灯结扣护住一次踏空" : ""}`
    : projected.trial?.id === "cloudRelay" ? `预计连续稳住 ${projected.trial.progress} / ${trials.cloudRelay.target} 次`
    : projected.templeReprise && projected.loadout.weapon === "templeBlade" ? `预计烛影刀显形加伤 ${projected.links["烛影刀显形加伤"] ?? 0} 次`
    : projected.altarMirror ? `预计破纸 ${projected.altarMirror.pages} / ${altarMirrorPages.length} 页${projected.altarMirror.lastPageStrength ? ` · 末页护纸 ${projected.altarMirror.lastPageStrength}` : ""}`
    : projected.altarAnswers ? `预计应答 ${projected.altarAnswers.progress} / 3 · ${altarStations.slice(0, projected.altarAnswers.progress).join("、") || "尚无应答"}`
    : projected.trial?.id === "rollCall" ? `预计应答 ${projected.trial.progress} / ${rollCallStations.length} · ${rollCallStations.slice(0, projected.trial.progress).join("、") || "尚无应答"}`
    : encounter.trial?.id === "lampTrial" ? `预计应答 ${projected.trial?.progress ?? 0} / 2 · ${projected.trueGuardUsed ? "本场会触发真人留息" : "本场无须触发真人留息"}`
    : encounter.region === skyRegion ? `普攻打实 ${projected.links["普攻打实"] ?? 0} 次 · 单回合最多掉 ${Math.max(0, ...simulation.rounds.map(round => -round.life))} 气血`
    : wardSealActive(encounter) ? `连续未破印 ${simulation.wardStreak} / ${wardSealLimit}` : "";
  element("#battle-preview").innerHTML = `<p>推演至第 ${simulation.rounds.length} 回合${ending}</p>
    <div class="battle-preview-gauges">
      <div><span>阿照 · ${simulation.life} / ${encounter.maxLife}</span><progress aria-label="阿照预计气血" value="${simulation.life}" max="${encounter.maxLife}"></progress></div>
      <div><span>对手 · ${simulation.hp} / ${encounter.maxHp}</span><progress aria-label="对手预计气血" value="${simulation.hp}" max="${encounter.maxHp}"></progress></div>
    </div>${pressure ? `<p>${pressure}</p>` : ""}
    ${assisted ? `<p>第 ${assisted.round} 回合 · ${clue.aid}${encounter.region === cliffRegion ? `少扣 ${clue.damage} 落地伤` : encounter.region >= hallRegion ? "减轻催灯术伤害" : `追加 ${clue.damage} 伤害`}</p>`
      : response ? `<p>第 ${response.round} 回合 · ${used}</p>` : ""}`;
}

function changedText(selector: string, value: string) {
  const node = element(selector);
  if (node.textContent !== value) node.textContent = value;
}

const duel = element("#duel");
let duelMarkup = "";
let quickBattle = true;
const signed = (value: number) => value === 0 ? "0" : (value > 0 ? "+" : "−") + Math.abs(value);

function paintDuel() {
  const f = fight;
  duel.hidden = !f?.boss;
  if (!f?.boss) return;
  const round = f.round + 1;
  const beats = [
    ["扑咬", "扫尾", "虎啸"], f.riverWave === 2 ? ["绷缆", "回浪", "挥篙"] : ["起浪", "绷缆", "回浪"], ["纸面", "借面", "烛偏见真身"], ["点篙", "击栏", "横篙"],
    ["举灯", "冲灯", "回蹄"], ["立更印", "提槌", "敲更"], f.cloudMirror ? ["掠栈", "落爪", "回风"] : ["回风", "掠栈", "落爪"], [f.skyDelayRound === round ? "仍可近身" : "升空", "贴崖", "落巢"],
    ["覆纸", "询铃", "催灯术 · 妖术"],
    ["覆簿纸", "询铃", "催灯术 · 妖术"],
  ][f.region];
  const phase = (round - 1) % 3;
  const track = f.altarMirror ? "" : f.templeReprise ? '<div class="boss-beats" aria-label="错烛招路"><span>第 4、7、10… 回合烛偏见真身</span><span>显形命中可清纸痕</span></div>'
    : `<div class="boss-beats" aria-label="三回合招路">${beats.map((beat, i) => `<span ${i === phase ? 'aria-current="step"' : ""}>${beat}</span>`).join("<i>›</i>")}</div>`;
  const last = f.lastExchange;
  const lastLine = last ? `<div class="exchange"><b>第 ${last.round} 回合</b>　阿照 ${signed(last.life)}　大妖 ${signed(last.hp)}${last.marks.length ? `<div class="battle-links">${last.marks.map(mark => `<span>${escape(mark)}</span>`).join("")}</div>` : ""}</div>` : "";
  const { names } = roundMoves(f.region, f.kit, round, f.riverWave, battleTiming(f));
  const nextMoves = names.length ? `<p class="duel-moves">本回合出手 · ${names.join(" · ")}</p>` : "";
  const water = f.region === 1 ? `<div class="water-gauge" data-flood="${f.water >= riverFloodLimit - 1}"><b>水位</b>
    <meter aria-label="覆舟水位" min="0" max="${riverFloodLimit}" value="${f.water}">${f.water}/${riverFloodLimit}</meter>
    <span>${f.water}/${riverFloodLimit} · ${f.water >= riverFloodLimit - 1 ? "再汲一次就会覆舟" : "汲水三次便会覆舟"}</span></div>` : "";
  const pursuit = riverPursuitActive(f) ? `<div class="water-gauge" data-flood="${f.riverDrenched || f.riverPursuits > 0}">
    <b>追篙命中</b><meter aria-label="追篙落水进度" max="${riverPursuitLimit}" value="${f.riverPursuits}"></meter>
    <span>${f.riverPursuits}/${riverPursuitLimit} · ${f.riverDrenched ? `衣已沾水 · 挥篙基础伤害 +${riverPursuitDamage}` : "满格落水"}</span></div>` : "";
  const sealing = paperSealActive(f);
  const paper = f.region === 2 ? `<div class="water-gauge" data-flood="${f.paperHits > 0}"><b>${sealing ? "纸痕" : "斩中纸面"}</b>
    <meter aria-label="纸面反噬进度" min="0" max="${paperHitLimit}" value="${f.paperHits}"></meter>
    <span>${f.paperHits}/${paperHitLimit} · ${sealing ? "两道纸痕封灯 · 照影显形时斩中真身可清除" : f.paperHits ? "再斩一次纸面就会反噬" : "击中真身可消除累计"}</span></div>` : "";
  const trial = f.trial && trials[f.trial.id];
  const footing = f.region === bridgeRegion ? `<div class="water-gauge" data-flood="${f.footing >= footingLimit - 1}"><b>失足</b>
    <meter aria-label="失足" min="0" max="${footingLimit}" value="${f.footing}"></meter>
    <span>${f.footing}/${footingLimit} · ${f.footing >= footingLimit - 1 ? "再中横篙就会跌落驿桥" : "三次失足便会跌落驿桥"}</span></div>` : "";
  const lamps = trial && f.trial ? `<div class="trial-meter"><b>${trial.counter}</b><span aria-hidden="true">${"◆".repeat(f.trial.progress)}${"◇".repeat(trial.target - f.trial.progress)}</span><small>${f.trial.progress} / ${trial.target}</small></div>` : "";
  const horse = f.region === courierRegion ? '<div class="water-gauge"><b>马灯</b><span>马灯护身时，普通刀伤减半。</span></div>' : "";
  const maxWard = wardStrength(f.rematchRank);
  const ward = f.region === watchRegion ? `<div class="water-gauge" data-flood="${round % 3 === 0 && f.ward > 0}"><b>更印</b>
    <meter aria-label="更印" min="0" max="${maxWard}" value="${f.ward}"></meter>
    <span>${f.ward}/${maxWard} · ${wardSealActive(f) ? `连续未破 ${f.wardStreak}/${wardSealLimit}，满格封阵` : "敲更前未破，震响扣 28 气血"}</span></div>` : "";
  const sigil = f.sigilThrough >= round ? `<div class="trial-meter"><b>寄灯符</b><span>可引爆 · 第 ${f.sigilThrough} 回合末消散</span></div>` : "";
  const speed = `<button type="button" data-action="battle-speed" aria-pressed="${quickBattle}" aria-label="切换加速交锋">战速 ×${quickBattle ? 2 : 1}</button>`;
  const cliff = f.region === cliffRegion ? `<div class="water-gauge" data-flood="${f.cliffStepRound !== undefined}"><b>${f.cliffStepRound !== undefined ? "踏空" : "落脚"}</b>
    <span>${f.cliffStepRound !== undefined ? "下一回合先结算落地伤" : f.kit.stance === "guard" ? `扶索剩 ${f.focus} 次${f.cloudMirror?.spareBrace ? " · 另有备用结扣" : ""}` : f.cloudMirror ? "掠栈提前一回合" : "闪避掠栈可避免踏空"}</span></div>` : "";
  const sky = f.region === skyRegion ? `<div class="water-gauge" data-flood="${phase === 0 && f.skyDelayRound !== round}"><b>刀锋距离</b>
    <span>${f.skyDelayRound === round || phase === 2 ? "可以近身" : phase === 1 ? "踏缆步或守式压灯可以近身" : "升空时刀招只能擦伤"}</span></div>` : "";
  const maxPaper = f.altarAnswers ? altarPaper : lampPaper;
  const rollCall = f.trial?.id === "rollCall" ? f.trial : undefined;
  const hall = f.altarAnswers || rollCall || f.trial?.id === "lampTrial" ? `<div class="water-gauge"><b>护纸</b>
    <meter aria-label="护纸强度" max="${maxPaper}" value="${f.ward}"></meter><span>${f.ward} / ${maxPaper} · 真人留息${f.trueGuardUsed ? "已用" : "可用一次"}</span></div>` : "";
  const altarProgress = f.altarAnswers?.progress ?? rollCall?.progress;
  const answerStations = rollCall ? rollCallStations : altarStations;
  const stations = altarProgress === undefined ? "" : `<ol class="altar-stations" aria-label="应答 ${altarProgress} / ${answerStations.length}">${answerStations.map((station, index) =>
    `<li data-answered="${index < altarProgress}" ${index === altarProgress ? 'aria-current="step"' : ""}>${station}<small>${index < altarProgress ? "已应答" : index === altarProgress ? "等候应答" : "候场"}</small></li>`).join("")}</ol>`;
  const brokenPages = f.altarMirror?.pages;
  const pages = brokenPages === undefined ? "" : `<ol class="altar-stations" aria-label="已破 ${brokenPages} / ${altarMirrorPages.length} 页">${altarMirrorPages.map((page, index) =>
    `<li data-answered="${index < brokenPages}" ${index === brokenPages ? 'aria-current="step"' : ""}>第 ${index + 1} 页
    <small>${index < brokenPages ? "已破" : index === brokenPages && round > page.start ? `余 ${f.ward} · 限第 ${page.deadline} 回合` : `第 ${page.start}–${page.deadline} 回合`}</small></li>`).join("")}</ol>`;
  const body = `<div class="duel-head"><strong>交锋</strong><span class="round-cap">第 ${round} / ${f.limit} 回合</span>${speed}</div>${track}${lamps}${water}${pursuit}${paper}${footing}${horse}${ward}${sigil}${cliff}${sky}${hall}${stations}${pages}${nextMoves}${lastLine}`;
  if (duelMarkup !== body) {
    duel.innerHTML = body;
    duelMarkup = body;
  }
}

function paintStage() {
  const region = fight?.region ?? save.region;
  stage.dataset.zone = zoneArt[region];
  stage.dataset.altarMirror = String(!!fight?.altarMirror);
  stage.dataset.cloudMirror = String(!!fight?.cloudMirror);
  stage.dataset.cue = fight?.cue ?? "idle";
  stage.dataset.boss = String(!!fight?.boss);
  stage.dataset.warning = String(!!fight?.windup);
  stage.dataset.slain = String(!!fight && !fight.boss && fight.hp === 0);
  stage.dataset.footing = fight?.cliffStepRound !== undefined ? "slip" : "ground";
  stage.dataset.flying = String(fight?.region === skyRegion && fight.boss && fight.round % 3 === 0 && fight.skyDelayRound !== fight.round + 1);
  if (stage.dataset.scenery !== zoneArt[region]) {
    stage.dataset.scenery = zoneArt[region];
    element(".scenery").style.backgroundImage = `url("${assets + zoneArt[region]}.webp")`;
  }
  worldProp.hidden = !save.victories[region] || region >= bridgeRegion;
  if (!worldProp.hidden) {
    const prop = assets + (region === 1 ? "boat.png" : "shrine.png");
    if (worldProp.getAttribute("src") !== prop) worldProp.src = prop;
  }
  foe.hidden = !fight;
  if (fight) {
    if (foeImage.getAttribute("src") !== assets + fight.sprite + ".png") foeImage.src = assets + fight.sprite + ".png";
    if (foeImage.alt !== fight.name) foeImage.alt = fight.name;
  }
  element("#windup").hidden = !fight?.windup;
  changedText("#windup", fight?.windup ?? "");
  const guardingLamps = fight?.trial?.id === "lampTrial" || fight?.trial?.id === "rollCall";
  changedText(".stage .chapter", fight?.cloudMirror ? cloudMirrorName : fight?.templeReprise ? "强敌再战 · 错烛" : fight?.altarMirror ? altarMirrorName : fight?.rematchRank ? `强敌再战 · 第 ${fight.rematchRank} 关` : guardingLamps ? "卷四 · 归山"
    : fight?.trial ? "异相 · " + trials[fight.trial.id].name : fight?.mirrorLevel ? `第 ${integer(fight.mirrorLevel)} 重` : region >= bridgeRegion ? regions[region].place : "青芦夜话");
  changedText("#place", fight?.mirrorLevel || fight?.altarMirror || fight?.cloudMirror ? "照妖镜" : guardingLamps ? "总灯房内院" : regions[region].name);
  changedText("#mode", pending || !ready || document.hidden ? "暂停" : fight?.boss ? "问妖" : save.newGear.length ? "驻足整装" : save.autoPatrol ? "巡夜中" : fight ? "寻妖中" : !patrolRemaining(save) ? "已扫清" : "待提灯");
  const human = element<HTMLProgressElement>("#life");
  human.max = fight?.maxLife ?? loadoutStats(save).life;
  human.value = Math.max(0, fight?.life ?? human.max);
  changedText("#life-text", `${human.value} / ${human.max}`);
  element("#enemy-hud").hidden = !fight?.boss;
  if (fight) {
    const health = element<HTMLProgressElement>("#hp");
    health.max = fight.maxHp;
    health.value = Math.max(0, fight.hp);
    changedText("#hp-text", `${health.value} / ${health.max}`);
    changedText("#enemy-name", fight.name);
  }
  element(".field-note").hidden = !!fight?.boss;
  if (!fight?.boss) {
    changedText("#report", fight?.event || save.report);
    const remaining = patrolRemaining(save);
    const rateText = save.autoPatrol ? `每分钟约 ${integer(rate(save))} 道行` : `每只 +${regions[region].reward} 道行`;
    changedText("#rate", remaining ? `${rateText} · 本地还可得 ${integer(remaining)} 道行` : "");
  }
  paintPatrolControls();
  paintDuel();
}

function notify(message: string) {
  notice = message;
  flash.textContent = message;
  flash.hidden = !message;
  setTimeout(() => {
    if (notice === message) {
      flash.hidden = true;
      notice = "";
    }
  }, 3000);
}

function commit(draft: Save, next?: () => void): boolean {
  const now = Date.now();
  accrueSand(draft, now);
  draft.time = Math.max(now, draft.time);
  try {
    localStorage.setItem(saveKey, JSON.stringify(draft));
  } catch {
    pending = { draft, next };
    paintPanel();
    return false;
  }
  pending = null;
  save = draft;
  next?.();
  paintPanel();
  return true;
}

function resetPatrol() {
  fight = null;
  rest = regions[save.region].patrolInterval - 500;
}

function settleBoss(current: Fight) {
  const draft = structuredClone(save);
  const won = current.result === "won";
  const recent = save.mirror.recent;
  const previousMirror = recent?.level === current.mirrorLevel ? recent : undefined;
  const mirror = current.cloudMirror ? settleCloudMirror(draft, current, Date.now())
    : current.altarMirror ? settleAltarMirror(draft, current, Date.now())
    : current.mirrorLevel ? settleMirror(draft, current, Date.now()) : undefined;
  const trial = current.trial;
  const upgraded = current.rematchRank ? settleRematch(draft, current) : undefined;
  const reprise = current.templeReprise ? settleTempleReprise(draft, current, Date.now()) : undefined;
  const sand = trial ? settleTrial(draft, current) : mirror?.reward;
  const story = !mirror && !trial && !current.rematchRank && !current.templeReprise && !current.casePractice;
  const reason = won ? "" : defeatSummary(current);
  if (story) draft.report = won ? `阿照战胜了${current.name}。` : reason;
  const loot = won && story ? win(draft, current.region) : undefined;
  const aftermath = loot?.first ? firstVolumeAftermath.at(current.region) : undefined;
  if (aftermath) draft.report = aftermath.text;
  const daoReward = draft.dao - save.dao;
  if (!won && story) draft.guide.defeats[current.region] = Math.min(2, draft.guide.defeats[current.region] + 1);
  commit(draft, () => {
    panel.scrollTop = 0;
    const archive = battleOrigin?.tab === "archive" ? battleOrigin : backTrail.find(page => page.tab === "archive");
    backTrail.length = 0;
    if (archive) backTrail.push(archive);
    battleOrigin = null;
    window.scrollTo(0, 0);
    result = { trialId: trial?.id, trialProgress: trial?.progress, rematchRank: current.rematchRank, rematchPractice: current.rematchPractice, mirrorLevel: current.mirrorLevel, altarMirror: !!current.altarMirror, cloudMirror: !!current.cloudMirror, templeReprise: current.templeReprise, previousMirror, sand, daoReward, region: current.region, won, report: current.log, reason,
      recovery: won ? undefined : battleRecovery(save, current), horseImpact: current.paperHorseCase ? current.horseImpact : undefined,
      drop: upgraded?.drop,
      links: current.links, round: current.round, life: Math.max(0, current.life), hp: Math.max(0, current.hp), ...loot, ...reprise };
    if (current.templeReprise) rematchRegion = 2;
    tab = current.rematchRank || current.templeReprise ? "rematch" : trial?.id ?? (mirror ? "mirror" : "patrol");
    skillChallenge = undefined;

    resetPatrol();
  });
}

function finishPatrol(current: Fight) {
  const draft = structuredClone(save);
  const { reward, found } = recordPatrolKill(draft);
  const clues = recordedClues(draft);
  const foundClue = clues > recordedClues(save);
  draft.report = `一刀斩落${current.name}，道行 +${reward}` +
    (realmLabel(draft) !== realmLabel() ? ` · 升至${realmLabel(draft)}` : "") +
    (foundClue ? ` · ${clueLabels[clues - 1]}「${regions[draft.region].clues[clues - 1]}」` : "") + "。";
  commit(draft, () => {
    if (foundClue && (tab !== "patrol" || journal || !save.guide.enabled)) {
      const line = clues === 1 ? "点场景上的妖案看招路" : clues === 2 ? "应对办法已记入妖案" : `「${caseClues[draft.region].aid}」已备好`;
      notify(`${clueLabels[clues - 1]} · ${line}`);
    } else if (found && tab !== "patrol") notify(`拾得${equipment[found].name} · ${slots[equipment[found].slot]}`);
    resetPatrol();
  });
}

function advance() {
  const now = performance.now();
  const wall = Date.now();
  const pausedLong = wall - previousWall > 15000;
  previousWall = wall;
  lag += Math.min(300, now - previousFrame);
  previousFrame = now;
  if (!ready || pending || document.hidden) {
    lag = 0;
    paintStage();
    return;
  }
  if (pausedLong) {
    lag = 0;
    resume();
    paintStage();
    return;
  }
  while (lag >= frame && !pending) {
    lag -= frame;
    if (!fight) {
      if (result || preparingChallenge() || !save.autoPatrol || !canPatrol(save)) break;
      rest = Math.max(0, rest - frame);
      if (!rest) {
        fight = startFight(save, save.region, false, save.kills[save.region]);
        paintPanel();
      }
    }
    if (!fight) continue;
    tickFight(fight);
    if (quickBattle && fight.boss) tickFight(fight);
    if (fight.result !== "fighting") {
      if (fight.boss) settleBoss(fight);
      else finishPatrol(fight);
    }
  }
  paintStage();
}

function faceChallenge(challenge: Challenge) {
  const encounter = challengeFight(challenge);
  if (!encounter || !ready || pending || fight) return;
  if (encounter.mirrorLevel) mirrorSelection = encounter.mirrorLevel;
  pendingBattle = challenge;
  enableCombatTactics(encounter);
  renderBattleBrief(encounter, challenge);
  battleSheet.showModal();
}

function beginBattle(encounter: Fight) {
  battleOrigin = pageLocation();
  result = null;
  journal = false;
  tab = "patrol";
  resetPatrol();
  fight = encounter;
  window.scrollTo(0, 0);
  paintPanel();
  paintStage();
}

function openPreparation(challenge: Challenge | undefined, focus?: PrepFocus | "preview") {
  if (tab !== "skills") backTrail.push(pageLocation());
  tab = "skills";
  journal = false;
  skillChallenge = challenge;
  paintPanel();
  if (focus === "weapon" || focus === "armor") {
    showSlot(focus);
    return;
  }
  const preview = panel.querySelector<HTMLDetailsElement>("#round-preview");
  const art = focus?.startsWith("art:") ? Number(focus.split(":")[1]) : undefined;
  const anchor = art !== undefined ? panel.querySelector<HTMLElement>(`#art-${art}, #art-missing-${art}`)
    : focus === "stance" ? panel.querySelector<HTMLElement>(".stance-panel") : focus === "fusion" ? panel.querySelector<HTMLElement>("#lamp-fusion") : preview?.querySelector<HTMLElement>("summary");
  if (focus === "preview" && preview) preview.open = true;
  if (focus && anchor) {
    anchor.scrollIntoView({ block: "nearest" });
    anchor.focus({ preventScroll: true });
  } else window.scrollTo(0, 0);
}

function openClueView(step?: number) {
  if (step === 1) {
    openPreparation({ mode: "case", region: save.region }, "preview");
    return;
  }
  backTrail.push(pageLocation());
  tab = "patrol";
  journal = true;
  paintPanel();
  window.scrollTo(0, 0);
  if (step) {
    const row = panel.querySelector<HTMLElement>(`#case-clue-${step}`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  }
}

root.addEventListener("submit", event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form === battleStart) {
    event.preventDefault();
    if (!battleSheet.open || !ready || pending || fight) return;
    const encounter = pendingBattle && challengeFight(pendingBattle);
    if (!encounter || !enableCombatTactics(encounter)) return;
    battleSheet.close();
    beginBattle(encounter);
  } else if (form.id === "mirror-practice") {
    event.preventDefault();
    const level = Number(new FormData(form).get("level"));
    if (tab === "mirror") faceChallenge({ mode: "mirror", level });
  } else if (form.dataset.preset === "0" || form.dataset.preset === "1") {
    event.preventDefault();
    if (!ready || pending || fight?.boss) return;
    const draft = structuredClone(save);
    const slot = Number(form.dataset.preset) as PresetSlot;
    if (storePreset(draft, slot, String(new FormData(form).get("label") ?? ""))) {
      commit(draft, () => notify(`已保存配装「${draft.presets[slot]?.name}」`));
    }
  }
});

root.addEventListener("click", event => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]")?.dataset.action;
  if (!action) return;
  const [name, value, option] = action.split(":");
  const id = Number(value) as Region;
  const art = Number.isInteger(id) && id >= 0 && id < arts.length ? id as ArtId : undefined;
  if (name === "slot" && Object.hasOwn(slots, value) && ready && !pending && !fight?.boss) {
    showSlot(value as GearSlot);
  } else if (name === "back") {
    returnTo(backTrail.pop());
  } else if (name === "home" || name === "tab" && value === "patrol") {
    backTrail.length = 0;
    skillChallenge = undefined;
    journal = false;
    result = null;
    tab = "patrol";
    paintPanel();
    window.scrollTo(0, 0);
  } else if ((name === "journal" || name === "clue-guide-open" || name === "clue-guide-dismiss") && !fight?.boss) {
    const tip = clueTip(save);
    const open = () => {
      if (name === "journal") openClueView();
      else if (name === "clue-guide-open") openClueView(tip?.step);
      else {
        paintPanel();
        element(".case-link").focus({ preventScroll: true });
      }
    };
    if (tip && ready && !pending) {
      const draft = structuredClone(save);
      draft.guide.dismissed.push(tip.id);
      commit(draft, open);
    } else if (name === "journal") open();
  } else if (name === "show-preview" && journal && (recordedClues(save) > 0 || canChallenge(save, save.region))) {
    openClueView(1);
  } else if (name === "motion") {
    quiet = !quiet;
    applyMotion();
  } else if (name === "help") {
    paintHelp();
    help.showModal();
  } else if (name === "guide-jump" && currentTip?.target) {
    const target = currentTip.target;
    if (tab !== target.tab) { backTrail.push(pageLocation()); panel.scrollTop = 0; }
    if (target.tab === "skills" && tab !== "skills") skillChallenge = pageChallenge();
    tab = target.tab;
    journal = tab === "patrol" && target.action?.startsWith("region:") === true && patrolRemaining(save) > 0;
    if (tab === "patrol" && !journal) result = null;
    paintPanel();
    const preview = panel.querySelector<HTMLDetailsElement>("#round-preview");
    if (target.action === "preview" && preview) preview.open = true;
    const [kind, targetId] = (target.action ?? "").split(":");
    const art = kind === "art" || kind === "mastery" ? panel.querySelector<HTMLElement>(`#art-${targetId}`) : null;
    const mastery = kind === "mastery" ? art?.querySelector<HTMLDetailsElement>(".art-mastery") : null;
    if (mastery) mastery.open = true;
    const anchor = art ?? (target.action === "preview" ? preview?.querySelector("summary")
      : [...root.querySelectorAll<HTMLButtonElement>("[data-action]")].find(item => item.dataset.action === target.action && item.getClientRects().length));
    if (anchor instanceof HTMLButtonElement && !anchor.disabled &&
      (target.action === "auto-patrol" || target.action?.startsWith("region:") || target.action?.startsWith("slot:") || kind === "fight")) {
      anchor.click();
      return;
    }
    const destination = anchor ?? panel;
    destination.scrollIntoView({ block: "nearest" });
    destination.focus({ preventScroll: true });
    if (anchor) {
      anchor.classList.add("guide-focus");
      setTimeout(() => anchor.classList.remove("guide-focus"), 2500);
    }
  } else if (name === "art" && tab === "skills") {
    const card = panel.querySelector<HTMLElement>(`#art-${id}`);
    card?.scrollIntoView({ block: "nearest" });
    card?.focus({ preventScroll: true });
  } else if (name === "outcome-next" && result?.recovery && ready && !pending && !fight) {
    openPreparation(challengeOf(result), result.recovery.focus);
  } else if (name === "battle-build" && battleSheet.open && pendingBattle && ready && !pending && !fight) {
    const challenge = pendingBattle;
    const build = value === "trial" ? manualBuild : battleBuilds[Number(value)];
    const draft = structuredClone(save);
    if (!build || !applyBuildChange(draft, build.changes) || save.dao - draft.dao !== build.cost) return;
    const trial = challengeFight(challenge, draft);
    const baseline = challengeFight(challenge);
    if (!trial || !baseline || (value !== "trial" || build.cost > 0) && !battleBuildImproves(previewBattle(baseline), previewBattle(trial))) {
      const current = challengeFight(challenge);
      if (current) renderBattleBrief(current, challenge);
      return;
    }
    const stored = commit(draft, () => {
      if (!battleSheet.open) {
        faceChallenge(challenge);
        return;
      }
      const current = challengeFight(challenge);
      if (current) renderBattleBrief(current, challenge);
      element<HTMLButtonElement>("#battle-start button[type=submit]").focus();
    });
    if (!stored) battleSheet.close();
  } else if (name === "battle-loadout" && battleSheet.open) {
    const target = pendingBattle;
    if (!target) return;
    const focus = battleAdvice?.focus;
    battleSheet.close();
    openPreparation(target, focus);
  } else if (name === "mirror-fight" && (tab === "mirror" || tab === "skills")) {
    faceChallenge({ mode: "mirror", level: Number(value) });
  } else if (name === "altar-mirror-fight" && (tab === "mirror" || tab === "skills")) {
    faceChallenge({ mode: "altar-mirror" });
  } else if (name === "cloud-mirror-fight" && (tab === "mirror" || tab === "skills")) {
    faceChallenge({ mode: "cloud-mirror" });
  } else if (name === "altar-mirror-setup" && tab === "mirror" && ready && !pending && !fight) {
    openPreparation({ mode: "altar-mirror" }, "preview");
  } else if (name === "temple-reprise" && ready && !pending && !fight?.boss && templeRepriseUnlocked(save)) {
    if (tab !== "rematch") backTrail.push(pageLocation());
    result = null;
    rematchRegion = 2;
    tab = "rematch";
    journal = false;
    paintPanel();
    element("#temple-reprise-entry").scrollIntoView({ block: "start" });
  } else if (name === "temple-reprise-fight" && (tab === "rematch" || tab === "skills")) {
    faceChallenge({ mode: "temple-reprise" });
  } else if (name === "temple-reprise-setup" && tab === "rematch" && ready && !pending && !fight) {
    openPreparation({ mode: "temple-reprise" }, "preview");
  } else if (name === "mirror-setup" && tab === "mirror" && ready && !pending && !fight) {
    const form = element<HTMLFormElement>("#mirror-practice");
    if (!form.reportValidity()) return;
    mirrorSelection = Number(new FormData(form).get("level"));
    openPreparation({ mode: "mirror", level: mirrorSelection }, "preview");
  } else if (name === "trial-fight" && isTrial(value) && (tab === value || tab === "skills")) {
    faceChallenge({ mode: "trial", id: value });
  } else if ((name === "rematch" || name === "rematch-select") && ready && !pending && !fight?.boss) {
    const chosen = value === undefined ? rematchRegion : id;
    if (chosen === cliffRegion || chosen === skyRegion || chosen === hallRegion || chosen === altarRegion || !save.victories[chosen]) return;
    if (battleSheet.open) battleSheet.close();
    if (tab !== "rematch") backTrail.push(pageLocation());
    if (tab !== "rematch" || chosen !== rematchRegion) result = null;
    rematchRegion = chosen;
    tab = "rematch";
    journal = false;
    paintPanel();
    if (name === "rematch") window.scrollTo(0, 0);
  } else if ((name === "rematch-fight" || name === "rematch-test") && (tab === "rematch" || tab === "skills")) {
    if (art === undefined || art === ropeStep) return;
    rematchRegion = art;
    faceChallenge({ mode: "rematch", region: id, practice: name === "rematch-test" });
  } else if (name === "reforge-focus" && tab === "mirror" && isReforgeId(value)) {
    focusReforge(value);
  } else if (name === "engraving-focus" && tab === "mirror") {
    element(".mirror-engraving").scrollIntoView({ block: "start" });
  } else if (name === "tab") {
    if (isTrial(value) ? !canViewTrial(save, value) : value === "mirror" && !mirrorUnlocked(save)) return;
    if (tab === value) return;
    const fromDetail = journal || tab === "mirror" || tab === "rematch" || isTrial(tab) || (tab === "patrol" && !!result);
    const fromNav = !!(event.target as HTMLElement).closest(".nav");
    if (value === "skills" && (!fromNav || fromDetail)) {
      openPreparation(pageChallenge());
      return;
    }
    const parent = backTrail[backTrail.length - 1];
    if (parent?.tab === value && !fromNav) {
      returnTo(backTrail.pop());
      if (value === "mirror" && isReforgeId(option)) focusReforge(option);
      if (value === "mirror" && option === "altar") panel.querySelector("#altar-mirror-entry")?.scrollIntoView({ block: "start" });
      if (value === "mirror" && option === "cloud") panel.querySelector("#cloud-mirror-entry")?.scrollIntoView({ block: "start" });
      return;
    }
    if (fromNav && value === "archive") {
      backTrail.length = 0;
      result = null;
    } else if (!fromNav || fromDetail) backTrail.push(pageLocation());
    else backTrail.length = 0;
    panel.scrollTop = 0;
    if (value === "skills") skillChallenge = undefined;
    tab = value as Tab;
    journal = false;
    window.scrollTo(0, 0);
    if (tab === "mirror" && ready && !pending) {
      commit(structuredClone(save));
      if (isReforgeId(option)) focusReforge(option);
      if (option === "altar" && altarMirrorUnlocked(save)) element("#altar-mirror-entry").scrollIntoView({ block: "start" });
      if (option === "cloud" && cloudMirrorUnlocked(save)) element("#cloud-mirror-entry").scrollIntoView({ block: "start" });
    } else paintPanel();
  } else if (name === "retry" && pending) {
    commit(pending.draft, pending.next);
  } else if (ready && !pending) {
    const draft = structuredClone(save);
    if (name === "engraving" && tab === "mirror" && (option === "edge" || option === "step") && (value === "train" || value === "equip")) {
      accrueSand(draft, Date.now());
      if (tuneEngraving(draft, option, value)) commit(draft);
    } else if (name === "reforge" && tab === "mirror" && !fight && isReforgeId(value)) {
      accrueSand(draft, Date.now());
      if (reforgeGear(draft, value)) commit(draft, () => notify(`${equipment[value].name}重铸完成，穿戴后生效。`));
    } else if (name === "guide-toggle") {
      draft.guide.enabled = !draft.guide.enabled;
      commit(draft);
    } else if (name === "guide-dismiss" && currentTip) {
      draft.guide.dismissed.push(currentTip.id);
      commit(draft);
    } else if (name === "battle-speed" && fight?.boss) {
      quickBattle = !quickBattle;
    } else if (name === "retreat" && fight?.boss) {
      resetPatrol();
      returnTo(battleOrigin ?? undefined);
      battleOrigin = null;
    } else if (!fight?.boss) {
      if (name === "preset-apply" && (value === "0" || value === "1")) {
        const slot = Number(value) as PresetSlot;
        if (applyPreset(draft, slot)) commit(draft, () => notify(`已换上「${draft.presets[slot]?.name}」`));
      } else if (name === "hunt" && canPatrol(save) && !fight && !save.autoPatrol && !document.hidden) {
        if (result?.won) result = null;
        fight = startFight(save, save.region, false, save.kills[save.region]);
        paintPanel();
      } else if (name === "auto-patrol" && canPatrol(save) && save.victories[0] > 0) {
        draft.autoPatrol = !save.autoPatrol;
        if (draft.autoPatrol && !draft.guide.dismissed.includes("auto-patrol")) draft.guide.dismissed.push("auto-patrol");
        commit(draft, () => { if (!fight) rest = draft.autoPatrol ? frame : regions[save.region].patrolInterval - 500; });
      } else if ((name === "equip" || name === "unequip" || name === "collect") && knownGear(value) && draft.ownedGear.includes(value)) {
        const slot = equipment[value].slot;
        if (name === "equip") draft.loadout[slot] = value;
        else if (name === "unequip" && draft.loadout[slot] === value) delete draft.loadout[slot];
        draft.newGear = draft.newGear.filter(id => id !== value);
        commit(draft, () => { if (packSheet.open) packSheet.close(); notify(name === "equip" ? `已穿戴 · ${equipment[value].name}` : name === "collect" ? "已收好，可点对应槽位查看" : "已卸下装备"); });
      } else if (name === "survey-wind" && journal && !fight && surveyWind(draft)) {
        draft.autoPatrol = false;
        const gain = draft.lifetimeDao - save.lifetimeDao;
        draft.report = "风灯被回风吹向断索。阿照将灯转回石壁，终于看清落脚处。";
        commit(draft, () => notify(`已查明风灯${gain ? ` · 道行 +${gain}` : ""}${draft.realm >= stillRealm ? " · 已入坐忘" : ""}`));
      } else if (name === "compare-books" && journal && !fight && compareBooks(draft)) {
        draft.autoPatrol = false;
        const gain = draft.lifetimeDao - save.lifetimeDao;
        draft.report = "铃声替人作答的事已查明。阿照合上巡簿，往内院去。";
        commit(draft, () => notify(`两册巡簿已对读${gain ? ` · 道行 +${gain}` : ""}${draft.realm >= trueRealm ? " · 已入真人" : ""}`));
      } else if (name === "region" && regions[id] && unlocked(save, id) && !fight) {
        draft.region = id;
        if (id === 1 && draft.victories[altarRegion]) draft.report = homecoming;
        else if (id <= bridgeRegion && id !== save.region) draft.report = draft.victories[id] ? regions[id].cleared : regions[id].intro;
        if (!patrolRemaining(draft)) draft.autoPatrol = false;
        commit(draft, () => { backTrail.length = 0; resetPatrol(); returnTo(); });
      } else if (name === "fight" && (!save.victories[id] || id >= cliffRegion) && canChallenge(save, id) && !fight) {
        faceChallenge({ mode: "case", region: id });
      } else if (name === "learn-equip" && art !== undefined && draft.ranks[art] === 0 && study(draft, art)) {
        equipArt(draft, art, true);
        commit(draft, () => notify(`已修习并装备${arts[art].name} · 第 ${arts[art].first} 回合出手`));
      } else if (name === "study" && art !== undefined && study(draft, art)) {
        commit(draft, () => {
          notify(`《${arts[art].name}》已${save.ranks[art] === 1 ? "入门，可在当前页装备" : "精通"}。`);
        });
      } else if (name === "equip-art" && art !== undefined && (option === "on" || option === "off")) {
        equipArt(draft, art, option === "on");
        if (JSON.stringify(draft.kit) !== JSON.stringify(save.kit)) {
          const tip = `equip-${id}`;
          if (option === "on" && !draft.guide.dismissed.includes(tip)) draft.guide.dismissed.push(tip);
          commit(draft);
        }
      } else if (name === "fusion-card") {
        const card = element("#lamp-fusion");
        card.scrollIntoView({ block: "nearest" });
        card.focus({ preventScroll: true });
      } else if (name === "fuse-lamp" && (value === "on" || value === "off")) {
        if (fuseLamp(draft, value === "on")) commit(draft, () => notify(value === "on" ? "已合成并装备照灯断影" : "已拆回照影与挑灯诀，精通保留"));
      } else if (name === "equip-fusion" && (value === "on" || value === "off")) {
        if (equipLampFusion(draft, value === "on")) commit(draft);
      } else if (name === "inward-tide" && (value === "on" || value === "off")) {
        if (setInwardTide(draft, value === "on")) commit(draft, () => notify(value === "on" ? "已内化听潮步 · 首次落地伤减半" : "已解除内化 · 听潮步精通保留"));
      } else if (name === "swap-weapons" && save.realm >= heartRealm && weaponArts(save.kit).length === 2) {
        draft.kit.firstWeapon = weaponArts(save.kit)[1];
        commit(draft);
      } else if (name === "kit" && value === "stance" && (option === "guard" || option === "attack") && option !== save.kit.stance) {
        draft.kit.stance = option;
        commit(draft);
      }
    }
  }
  paintStage();
});

function applyMotion() {
  root.classList.toggle("quiet", quiet);
  const control = element("[data-action=motion]");
  control.textContent = quiet ? "动效关" : "动效开";
  control.setAttribute("aria-pressed", String(!quiet));
}

function resume() {
  previousWall = Date.now();
  lag = 0;
  const draft = structuredClone(save);
  const sand = accrueSand(draft, previousWall);
  const offline = fight?.boss || result || preparingChallenge() ? null : accrueOffline(draft, previousWall);
  commit(draft, () => {
    if (!ready || (fight && !fight.boss && !canPatrol(save))) resetPatrol();
    ready = true;
    if (offline?.earned) {
      const minutes = Math.max(1, Math.floor(offline.credited / 60000));
      const period = offline.credited < 60000 ? "不足 1 分钟" : `${minutes} 分钟`;
      notify(`离线${period}，计入 ${integer(offline.earned)} 道行。${!patrolRemaining(save) ? "此地小妖已扫清。" : ""}${sand ? `镜中另积 ${integer(sand)} 淬纹砂。` : ""}`);
    } else if (sand) notify(`照妖镜积得 ${integer(sand)} 淬纹砂。`);
  });
}

function checkpoint() {
  if (ready && !pending) commit(structuredClone(save));
}

async function init() {
  applyMotion();
  paintPanel();
  const readerMessage = "另一页正在巡夜，此页可查阅巡簿";
  try {
    save = decode(localStorage.getItem(saveKey), Date.now());
    if (!navigator.locks) {
      waiting = "当前浏览器环境无法锁定存档。请使用受支持的浏览器，通过 HTTPS 或本地地址打开。";
      paintPanel();
      return;
    }
    waiting = readerMessage;
    paintPanel();
    await navigator.locks.request(saveKey, async () => {
      save = decode(localStorage.getItem(saveKey), Date.now());
      if (!document.hidden) resume();
      else ready = true;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) checkpoint();
        else if (!pending) resume();
      });
      window.addEventListener("pagehide", () => { if (!document.hidden) checkpoint(); });
      await new Promise<void>(() => undefined);
    });
  } catch {
    waiting = "无法读取本地巡簿。请检查浏览器存储权限，或在保留旧档后使用新的浏览器配置。";
    paintPanel();
  }
}

window.addEventListener("storage", event => {
  if (ready || event.key !== saveKey || waiting !== "另一页正在巡夜，此页可查阅巡簿") return;
  try {
    save = decode(event.newValue, Date.now());
    paintPanel();
  } catch {
    waiting = "另一页写入了无法读取的巡簿。";
    paintPanel();
  }
});

void init();
setInterval(advance, frame);
