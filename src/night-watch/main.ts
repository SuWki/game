import "./style.css";
import { arts, breakthrough, mountainFirstReward, realms, regions } from "./content.ts";
import { equipment, knownGear, slots, traitText } from "./equipment.ts";
import type { GearId, GearSlot } from "./equipment.ts";
import type { Response } from "./tactics.ts";
import { encounters } from "./tactics.ts";
import { nextTip } from "./guide.ts";
import type { Tab, Tip } from "./guide.ts";
import {
  accrueOffline, accrueSand, answerOpening, artDue, canChallenge, canPatrol, challengeRealms, clueCount, combatStats, compareGear, cultivation, decode, equippedArts, frame, engravingCost, engravingPower, engravings, masteryCost, maxEngravingRank, mirrorOpponent, mirrorRounds, mirrorUnlocked, paperHitLimit, newSave,
  patrolRemaining, previewOpening, rate, recordPatrolKill, roundMoves, riverFloodLimit, sandRate, saveKey, settleMirror, startFight, startMirrorFight, study, tickFight, tuneEngraving, unlocked, win,
} from "./game.ts";
import type { Engraving, Fight, Region, Save } from "./game.ts";

const root = document.querySelector<HTMLDivElement>("#night-watch")!;
const assets = import.meta.env.BASE_URL + "night-watch/";
const zoneArt = ["mountain", "ferry", "temple"];
const tabs = { patrol: "巡夜", practice: "修行", skills: "招式", archive: "斩妖录", mirror: "照妖镜" } as const;
let tab: Tab = "patrol";
let save = newSave(Date.now());
let fight: Fight | null = null;
let journal = false;
let openSlot: GearSlot | undefined;
let ready = false;
let waiting = "正在载入巡簿";
let pending: { draft: Save; next?: () => void } | null = null;
type BattleResult = { mirrorLevel?: number; sand?: number; region: Region; won: boolean; report: string[]; reason?: string; first?: boolean; drop?: boolean;
  recovered?: GearId; links: Record<string, number>; round: number; life: number; hp: number; turningPoint?: string };
let result: BattleResult | null = null;
type PageLocation = { tab: Tab; journal: boolean; result: BattleResult | null; scroll: number };
const backTrail: PageLocation[] = [];
let battleOrigin: PageLocation | null = null;

function pageLocation(): PageLocation {
  return { tab, journal, result, scroll: window.scrollY };
}

function pageName(page: PageLocation) {
  if (page.tab !== "patrol") return tabs[page.tab];
  return page.result ? "战果" : page.journal ? "本地妖案" : "巡夜";
}

function returnTo(page?: PageLocation) {
  tab = page?.tab ?? "patrol";
  journal = page?.journal ?? false;
  result = page?.result ?? null;
  paintPanel();
  window.scrollTo(0, page?.scroll ?? 0);
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
function realmLabel(total: number) {
  const { realm, layer } = cultivation(total);
  return realms[realm] + " · " + layerNames[layer - 1] + "层";
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
      <section id="duel" class="duel" aria-label="大妖应变" hidden></section>

      <div class="patrol-controls">
        <div class="task-note"><p id="objective"></p><small id="rate"></small></div><div class="patrol-buttons"><button type="button" data-action="hunt">夜行</button>
        <button type="button" data-action="auto-patrol" aria-pressed="false" hidden>沿路巡夜</button>
        <button type="button" data-action="fight:0" id="challenge" hidden>挑战吊睛山君</button></div>
      </div>
      <div id="loot-strip" hidden><div id="gear-find" role="status"></div></div>
      <div class="field-note"><span>巡簿</span><div id="report"></div></div></div>
      <div class="satchel"><section id="outfit" aria-label="随身装备"></section>


      <div id="home-guide" class="paper" hidden></div></div>
    </div>
    <section id="book" hidden><button class="back" type="button" data-action="back">‹　返回巡夜</button>
    <aside id="panel" class="paper" aria-label="巡夜手札"></aside></section>

    <footer><span id="status">正在载入</span></footer>
  </main>
  <dialog id="pack-sheet" class="paper" aria-labelledby="pack-title"><div class="guide-head"><h2 id="pack-title"></h2><form method="dialog"><button>收起</button></form></div><div id="pack-list"></div></dialog>
  <div id="flash" class="flash" role="status" hidden></div>
  <dialog id="help" class="paper help" aria-labelledby="help-title">
    <div class="guide-head"><h2 id="help-title">巡夜指引</h2><form method="dialog"><button type="submit">关闭</button></form></div>
    <button data-action="motion" class="motion" type="button">动效</button><p id="guide-current"></p>
    <button type="button" data-action="guide-toggle"></button>
    <div class="help-topics">
      <details><summary>怎么找回我要去的地方</summary><p>巡夜找小妖、看掉落。点场景里的线索看本地妖案。线索齐后点「挑战」，首胜后可以直接前往下一地。招式页管修习和配招，斩妖录管换路和重演。点顶栏境界查看道行，左上方的返回按钮会写明回到哪一页。</p></details>
      <details><summary>夜行与线索</summary><p>点「提灯夜行」出刀。收齐三条线索并满足境界要求后，可挑战当地大妖。胜过吊睛山君后，点「沿路巡夜」，阿照便会一路寻妖。想停下来时，点「收灯歇脚」。</p></details>
      <details><summary>掉落与装备</summary><p>小妖有机会掉落本地兵刃或护具，大妖首胜会给专属佩饰。拾得新装备，阿照会停下来。箭头标出换装后的刀伤或气血变化，「获得」「失去」列出会换掉的本领。选「穿戴」或「收入行囊」，处理完最后一件才会继续。点行装里的部位，随时都能再换。每个部位可穿戴一件，属性和回合效果会带入下一场大妖战。</p></details>
      <details><summary>挑战与战报</summary><p>在「招式」可查看前六轮招谱。初遇山君，第 3 回合见它伏肩，就要提防虎啸。伏身避啸至多损失 4 点气血，迎啸进刀则多打 12 点刀伤。每战可临场应变两次，依原招出手会保留机会。重演时也会在险招前停手。熟悉招路后，可选「余下险招不停手」。败阵后可看逐轮战报，免费再战。</p></details>
      <details><summary>观化、学习与装备</summary><p>首次战胜山君会觉醒观化。悟得招谱后，可在战果或「招式」页修习。武学、身法、神通各带一门，分别在锻骨、舒筋、听息开启。界面会写明当前能带几门。点亮的回合就是出手的时机，精通会增强招式效果。</p></details>
      <details><summary>道行与破境</summary><p>每境十层，道行积满便升一层。学招只花可用道行。舒筋开身法位，贯劲可在架住重击后反击，听息开神通位。</p></details>
      <details><summary>换路与重演</summary><p>在「斩妖录」切换巡夜地，或重演已击败的大妖。河伯和娘娘各自最多第五胜悟得传承，败阵不计入。</p></details>
      <details><summary>照妖镜与刻纹</summary><p>首胜借面娘娘后，从「斩妖录」进入照妖镜。前十一重是河伯妖影，第十二重起会遇见娘娘妖影。首次破重给淬纹砂，镜中也会按纪录积砂，最多计八小时。用砂温养刻纹，每次可带一条。</p></details>
      <details><summary>离线结算</summary><p>沿路巡夜时，离开最多可得八小时道行。若还有新装备待看，这段时间不会积攒道行。到本地修行上限便收灯。扫清时显出大妖踪迹，可直接挑战。重演已扫清的大妖能找回漏掉的本地装备。</p></details>
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

function title(kicker: string, heading: string, intro: string): string {
  return `<div class="paper-kicker">${kicker}</div><h2>${heading}</h2><p class="intro">${intro}</p>`;
}

function costText(cost: number): string {
  const missing = cost - save.dao;
  if (missing > patrolRemaining(save)) {
    const next = regions[save.region + 1];
    return next ? `还差 ${integer(missing)} 道行，需到${next.name}继续修行。` : `还差 ${integer(missing)} 道行，首卷剩余的巡夜道行不足。`;
  }
  if (save.dao < cost && !save.autoPatrol) {
    return `还差 ${integer(cost - save.dao)} 道行，至少再斩 ${Math.ceil((cost - save.dao) / regions[save.region].reward)} 只小妖`;
  }
  return save.dao >= cost
    ? `消耗 ${cost} 道行，余 ${integer(save.dao - cost)}`
    : `还差 ${integer(cost - save.dao)} 道行，约巡夜 ${Math.max(1, Math.ceil((cost - save.dao) / rate(save)))} 分钟`;
}

function patrolPanel(): string {
  const location = regions[save.region];
  const clues = clueCount(save);
  if (result) {
    const cleared = regions[result.region];
    const remaining = 5 - save.victories[result.region];
    const awakening = result.first && result.region === 0;
    const prize = result.drop ? `观化悟得《${arts[result.region].name}》${awakening ? `，另得 ${mountainFirstReward} 道行` : ""}。`
      : save.drops[result.region] ? "这段传承已记入巡簿。" : `再胜至多 ${remaining} 场，便能悟得这门传承。`;
    const nextRegion = result.region + 1;
    return title(result.won ? "战胜大妖" : "败阵", cleared.boss,
      result.won ? (result.first ? cleared.cleared : "阿照在灯下重演了那一夜。") : escape(result.reason ?? "")) +
      (awakening ? '<p class="intro"><strong>天赋初醒 · 观化</strong><br>虎啸已经停了，阿照胸中却还留着山君开口前的那一顿。她提笔，把这一息记进巡簿。</p>' : "") +
      (result.won ? `<p class="prize">${prize}</p>` : "") +
      (result.drop ? artCard(result.region, true) : "") +
      (save.newGear[0] ? lootCard(save.newGear[0]) : "") +
      (awakening ? '<p class="meta">回山道后可开启沿路巡夜，达到本地上限就会收灯。</p>' : "") +
      '<div class="actions outcome-actions">' +
      (result.first && nextRegion < regions.length ? button(`region:${nextRegion}`, `前往${regions[nextRegion].name}`, !!fight, true) : "") +
      (!result.won ? button("tab:skills", "调整招式", false, true) + button(`fight:${result.region}`, "再战", !ready || !!fight) : "") +
      `</div><details data-remember="report"><summary>交锋详情 · 第 ${result.round} 回合结束</summary>
      <p>阿照余 ${result.life} 气血 · 大妖余 ${result.hp} 气血</p>
      <div class="battle-links">${Object.entries(result.links).map(([name, times]) => `<span>${escape(name)} ×${times}</span>`).join("")}</div>
      ${result.turningPoint ? `<p>${escape(result.turningPoint)}</p>` : ""}<ul class="log">${result.report.map(line => `<li>${escape(line)}</li>`).join("")}</ul></details>`;

  }
  if (!save.victories[0]) {
    return title(location.tag, location.title, location.intro) +
      (patrolRemaining(save) ? `<p class="meta">山君踪迹 · ${Math.min(save.kills[0], 12)} / 12 只小妖</p>` : '<p>此地小妖已扫清，山君现身了。</p>') +
      (canChallenge(save, 0) ? button("fight:0", "挑战" + location.boss, !ready || !!fight, true) : "") +
      (clues ? `<p>最近线索 · ${location.clues[clues - 1]}</p>` : "");
  }
  const done = save.victories[save.region] > 0;
  let hint = "";
  if (clues < 3) hint = `继续巡夜，再斩 ${location.thresholds[clues] - save.kills[save.region]} 只小妖可找到下一条线索。`;
  else if (!canChallenge(save, save.region)) hint = `挑战须达${realms[challengeRealms[save.region]]}境，可在修行页查看破境条件。`;
  const known = location.clues.map((clue, i) =>
    `<li class="${i < clues ? "found" : ""}"><span aria-hidden="true">${i < clues ? "◆" : "◇"}</span>${i < clues ? clue : "尚未寻得的线索"}</li>`).join("");
  const kills = save.kills[save.region];
  const goal = location.thresholds[2];
  const killProgress = clues < 3
    ? `<div class="kill-progress"><span>本地斩妖</span><strong>${integer(kills)} / ${goal}</strong>
       <progress max="${goal}" value="${kills}" aria-label="首领线索的斩妖进度"></progress></div>`
    : `<p class="kill-progress">本地已斩妖 ${integer(kills)} 只</p>`;
  return title(location.tag, location.title, done ? location.cleared : location.intro) +
    `<div class="clues-label"><strong>线索</strong><span>${clues} / 3</span></div><ul class="clues">${known}</ul>${killProgress}
    ${hint ? `<p class="meta">${hint}</p>` : ""}<p class="meta">${patrolRemaining(save) ? "此地修行止于" + realmLabel(location.patrolCap) : "此地小妖已扫清"} · ${save.region + 1} 阶装备</p><div class="actions">` +
    (done && save.region < 2 ? button(`region:${save.region + 1}`, `去${regions[save.region + 1].name}`, !ready || !!fight, true) : "") +
    button(`fight:${save.region}`, `${done ? "重演" : "挑战"}${location.boss}`, !ready || !!fight || !canChallenge(save, save.region), !done || save.region === 2) +
    "</div>";
}

function practicePanel(): string {
  const next = breakthrough[save.realm];
  const state = cultivation(save.lifetimeDao);
  return `<h2>灯下修行</h2><section class="realm-entry"><div class="section-title"><strong>${realmLabel(save.lifetimeDao)}</strong><span>${state.full ? "首卷圆满" : `本层 ${state.progress} / ${state.needed}`}</span></div>
    <progress aria-label="本层道行" max="${state.needed}" value="${state.progress}"></progress>
    <p>${state.full ? "听息十层，首卷修行已圆满。" : `再得 ${state.needed - state.progress} 道行便可升层。`}</p></section>
    <dl class="dao-ledger"><div><dt>累计道行</dt><dd>${integer(save.lifetimeDao)}</dd><small>决定境界与层数</small></div>
    <div><dt>可用道行</dt><dd>${integer(save.dao)}</dd><small>可用于修习、精通招式</small></div></dl>
    ${next ? `<p>进入${realms[save.realm + 1]}境后，${next.gift}</p>` : ""}
    ${save.drops.some((known, i) => known && !save.ranks[i]) ? button("tab:skills", "查看待修习的招谱") : ""}`;

}

const artActions = ["kit:shout:windup", "kit:step:tide", "kit:reveal:true"] as const;
const removeArtActions = ["kit:shout:off", "kit:step:basic", "kit:reveal:false"] as const;
const artStamps = ["武", "步", "术"] as const;

function techniqueStrip(id: Region) {
  const art = arts[id];
  return `<div class="technique-strip" aria-label="${art.name}前九回合出手时机">${Array.from({ length: 9 }, (_, i) => {
    const round = i + 1;
    return `<span class="${artDue(round, id) ? "is-due" : ""}">${round}</span>`;
  }).join("")}<small>每 ${art.every} 回合出手</small></div>`;
}

function artCard(id: Region, fromResult = false) {
  const art = arts[id];
  const rank = save.ranks[id];
  const known = save.drops[id];
  const worn = !!rank && equippedArts(save.kit)[id];
  const locked = save.realm < art.realm;
  const cost = rank ? masteryCost : art.cost;
  const status = worn ? "已装备" : rank ? "已修习 · 待装备" : known ? "已悟得 · 待修习" : "尚未悟得";
  const disabled = !ready || !!fight?.boss || locked;
  const requirement = locked ? `踏入${realms[art.realm]}后可装备。` : "";
  const source = id === 0 ? "初胜吊睛山君可悟得。" : `胜过${regions[id].boss}后有机会悟得，至多五胜。`;
  const equip = rank && !locked ? button(worn ? removeArtActions[id] : artActions[id],
    worn ? (id === 1 ? "换回退步" : "卸下") : id === 1 ? "替换退步" : "装备", disabled, !worn) : "";
  const learn = known && rank === 0 ? button(`learn-equip:${id}`, `修习并装备 · ${cost} 道行`, disabled || save.dao < cost, true) +
    button(`study:${id}`, `仅修习 · ${cost} 道行`, disabled || save.dao < cost) : "";
  const mastery = known && rank === 1 && !fromResult
    ? `<details class="art-mastery" data-remember="mastery-${id}"><summary>精通 · ${masteryCost} 道行</summary><p>${art.mastery}</p><p class="meta">${costText(cost)}</p>${button(`study:${id}`, "精通此招", disabled || save.dao < cost)}</details>` : "";
  return `<section class="art technique" data-worn="${worn}" id="art-${id}" tabindex="-1" aria-labelledby="art-name-${id}">
    <header class="technique-head"><span class="art-stamp" aria-hidden="true">${artStamps[id]}</span><div><h3 id="art-name-${id}">${art.name}</h3><small>${art.kind}${rank ? (rank === 2 ? " · 精通" : " · 入门") : ""}</small></div><span class="art-status">${status}</span></header>
    ${known ? `<p>${art.description}${rank === 2 ? " " + art.mastery : ""}</p>${techniqueStrip(id)}` : `<p>${source}</p>`}
    ${requirement ? `<p class="meta">${requirement}</p>` : ""}
    ${known && !rank && !locked ? `<p class="meta">${costText(cost)}</p>` : ""}
    ${learn || equip ? `<div class="actions technique-actions">${learn}${equip}</div>` : ""}${mastery}
  </section>`;
}

function skillRack() {
  const equipped = equippedArts(save.kit);
  const filled = [equipped[0], save.realm >= arts[1].realm, equipped[2] && save.realm >= arts[2].realm];
  const open = arts.filter(art => save.realm >= art.realm).length;
  return `<section class="skill-rack" aria-labelledby="skill-rack-title">
    <div class="section-title"><h2 id="skill-rack-title">阿照所带招式</h2><span>已带 ${filled.filter(Boolean).length} / ${open} 门</span></div>
    <p class="meta">武学、身法、神通各可带一门。</p><div class="skill-slots">${arts.map((art, index) => {
      const locked = save.realm < art.realm;
      const label = locked ? `${realms[art.realm]}开启` : filled[index] ? (index === 1 && !equipped[1] ? "退步" : art.name) : "空位";
      return `<button type="button" class="skill-slot" data-action="art:${index}" data-locked="${locked}">
        <span>${art.kind}位</span><strong>${label}</strong></button>`;
    }).join("")}</div>
    ${save.realm >= arts[1].realm && !equipped[1] ? '<p class="meta">退步占一个身法位，第 1、4、7… 回合可避第一道浪。</p>' : ""}
  </section>`;
}

function skillsPanel(): string {
  const controlsDisabled = !ready || !!fight?.boss;
  const stats = combatStats(save.realm, save.kit.stance, save.loadout, cultivation(save.lifetimeDao).layer);
  const mirrorSource = backTrail.find(page => page.tab === "mirror");
  const mirrorLevel = mirrorSource ? save.mirror.best + 1 : result?.mirrorLevel;
  const reflection = mirrorLevel ? mirrorOpponent(mirrorLevel) : undefined;
  const opponent = fight?.boss ? fight.region : reflection?.region ?? result?.region ?? save.region;
  const unlearned = arts.filter((_, index) => save.drops[index] && !save.ranks[index]).length;
  const order: Region[] = [0, 1, 2];
  const priority = (id: Region) => !save.drops[id] ? 2 : save.ranks[id] ? 1 : 0;
  order.sort((a, b) => priority(a) - priority(b));
  const retry = result && !result.won && !result.mirrorLevel
    ? `<div class="rematch"><strong>调整后再战</strong>${button(`fight:${result.region}`, `再战${regions[result.region].boss}`, controlsDisabled || !!fight, true)}</div>` : "";
  return retry + skillRack() +
    `<div class="section-title technique-list-title"><h2>招谱</h2><span>可用道行 ${integer(save.dao)}${unlearned ? ` · ${unlearned} 门待修习` : ""}</span></div>` +
    order.map(id => artCard(id)).join("") +
    (currentTip && !/^(learn|equip|mastery)/.test(currentTip.id) ? guideCard(currentTip) : "") +
    `<section class="stance-panel"><div class="section-title"><h2>架势</h2><span>刀伤 ${stats.damage} · 气血 ${stats.life}</span></div>
    <div class="choices">${(["guard", "attack"] as const).map(stance =>
      `<button type="button" data-action="kit:stance:${stance}" aria-pressed="${save.kit.stance === stance}" ${controlsDisabled ? "disabled" : ""}>${stance === "guard" ? "守式" : "攻式"}</button>`).join("")}</div>
    <p class="meta">守式架住重击时承受 18% 伤害。攻式提升 25% 基础刀伤。阿照每回合照常出刀。</p></section>
    <details data-remember="preview" id="round-preview"><summary>${reflection && mirrorLevel ? `${reflection.name} · 第 ${integer(mirrorLevel)} 重` : regions[opponent].boss} · 对照前六回合</summary>
      ${opponent === 1 ? '<p>河伯回浪时汲水，水满三格便会覆舟。割缆可清空水位，配镇山喝引浪也能倒撞敌舟。</p>' : ""}
      <ol class="match-rounds">${Array.from({ length: 6 }, (_, i) => {
        const { names, enemy, opening } = roundMoves(opponent, save.kit, i + 1, reflection?.riverWave);
        return `<li><b>第 ${i + 1} 回合</b><span>${names.length ? `<strong>${names.join(" · ")}</strong>` : "短刀"}</span><span>${enemy}${opening ? " · 可应变" : ""}</span></li>`;
      }).join("")}</ol>
    </details>`;
}

const iconOrder: GearId[] = ["pineBlade", "reedBlade", "templeBlade", "hillCoat", "ferryCoat", "templeCoat", "tigerFang", "tideSeal", "mirrorPearl"];

function itemIcon(slot: GearSlot, id?: GearId) {
  return id ? `<i aria-hidden="true" class="item-art" style="background-image:url('${assets}equipment.png');background-position:${iconOrder.indexOf(id) * 12.5}% center"></i>`
    : `<i aria-hidden="true" class="icon empty ${slot}"></i>`;
}

function synergy(id: GearId) {
  const trait = traitText(id);
  if (!trait) return "";
  const enabled = id === "pineBlade" ? save.kit.shout !== "off" && save.ranks[0] > 0
    : id === "reedBlade" ? save.kit.step === "tide" && save.ranks[1] > 0
    : id === "hillCoat" ? save.kit.stance === "guard"
    : id === "ferryCoat" ? save.realm >= 1 : save.kit.reveal && save.ranks[2] > 0;
  return `<small class="affinity">${enabled ? "已配" : "待配"} · ${trait}</small>`;
}

function outfitPanel() {
  const stats = combatStats(save.realm, save.kit.stance, save.loadout, cultivation(save.lifetimeDao).layer);
  const rack = (Object.keys(slots) as GearSlot[]).map(slot => {
    const id = save.loadout[slot];
    const item = id && equipment[id];
    return `<button class="outfit-slot" type="button" data-action="slot:${slot}" aria-expanded="${openSlot === slot}">
      ${itemIcon(slot, id)}<span><small>${slots[slot]}${item ? " · " + item.level + " 阶" : ""}</small><b>${item ? item.name : "空槽"}</b></span></button>`;
  }).join("");
  const moves = [save.kit.stance === "guard" ? "守式" : "攻式", save.kit.shout !== "off" ? arts[0].name : "", save.kit.step === "tide" ? arts[1].name : "", save.kit.reveal ? arts[2].name : ""].filter(Boolean);
  const header = `<header><strong>阿照的行装</strong><span>刀伤 ${stats.damage}　气血 ${stats.life}</span></header>
    <div class="outfit-slots">${rack}</div>`;
  return header + (clueCount(save, 0) === 3 ? `<div class="outfit-moves"><span>${moves.join(" · ")}</span>${button("tab:skills", save.drops.some((known, i) => known && !save.ranks[i]) ? "有招待修习 ›" : "查看招式 ›")}</div>` : "");
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
  return `<div class="gear-changes">${rows.join("")}</div>`;
}

function lootCard(id: GearId) {
  const item = equipment[id];
  const current = save.loadout[item.slot];
  const count = save.newGear.length;
  const after = count > 1 ? `还有 ${count - 1} 件待看` : !patrolRemaining(save) ? "此地小妖已扫清" : save.autoPatrol ? "选好后接着巡夜" : "选好后可再提灯";
  return `<section class="loot-card" aria-label="新得装备"><header>${itemIcon(item.slot, id)}<div><small>拾得 · ${slots[item.slot]} · ${item.level} 阶</small><strong>${item.name}</strong></div></header>
    <small>${current ? "原装备 · " + equipment[current].name : slots[item.slot] + "尚空"}</small>
    ${gearChanges(id)}<div class="loot-choices">${button("equip:" + id, "穿戴", false, true)}${button("collect:" + id, "收入行囊")}</div><small>${after}</small></section>`;
}

function slotContents(slot: GearSlot) {
  const active = save.loadout[slot];
  const items = save.ownedGear.filter(id => equipment[id].slot === slot).sort((a,b) => equipment[b].level - equipment[a].level);
  const list = items.map(id => {
    const item = equipment[id];
    return `<li>${itemIcon(slot, id)}<div><b>${item.name}</b><small>${item.level} 阶${active === id ? " · 已穿戴" : ""}</small>${active === id ? `<p>${item.effect}</p>${synergy(id)}` : gearChanges(id)}</div>
      ${active === id ? button("unequip:" + id, "卸下") : button("equip:" + id, "穿戴")}</li>`;
  }).join("");
  return `<div class="outfit-picker"><small>${slotNotes[slot]}</small>${list ? `<ul>${list}</ul>` : `<p>${slot === "charm" ? "击败吊睛山君，取得第一枚佩饰。" : "夜行时，小妖有机会掉落这个部位的装备。"}</p>`}</div>`;
}

function archivePanel(): string {
  return `<h2>斩妖录</h2><p class="meta">今夜在${regions[save.region].name}</p><ol class="route-list">` +
    regions.map((region, i) => {
      const id = i as Region;
      const here = id === save.region;
      const access = unlocked(save, id);
      const wins = save.victories[id];
      const swept = !patrolRemaining(save, id);
      const state = !access ? "未通行" : here ? "当前地点" : wins ? "已平息" : "可前往";
      const progress = !access ? `胜过${regions[i - 1].boss}后开路` :
        [swept ? "小妖已扫清" : `线索 ${clueCount(save, id)} / 3`,
         wins ? (save.drops[id] ? "传承已悟得" : `至多再胜 ${5 - wins} 场可悟得传承`) : region.boss].join(" · ");
      return `<li class="route-stop" data-here="${here}" data-locked="${!access}">
        <div class="section-title"><strong>${region.name}</strong><span>${state}</span></div><p>${progress}</p>
        ${access ? `<div class="choices">${here ? button("home", "回到巡夜") : button(`region:${id}`, `前往${region.name}`, !ready || !!fight)}
        ${wins ? button(`fight:${id}`, `重演${region.boss}`, !ready || !!fight) : ""}</div>` : ""}</li>`;
    }).join("") + "</ol>" + `<section class="mirror-entry"><div><h3>照妖镜</h3><p>${mirrorUnlocked(save)
      ? (save.mirror.best ? `已破第 ${integer(save.mirror.best)} 重` : "挑战镜中妖影，积攒淬纹砂。")
      : "平定借面娘娘后开启。"}</p></div>${mirrorUnlocked(save) ? button("tab:mirror", "进入照妖镜", !ready || !!fight, true) : ""}</section>`;

}

function mirrorPanel() {
  const { best, sand, ranks, equipped } = save.mirror;
  const next = best + 1;
  const opponent = mirrorOpponent(next);
  const wave = opponent.riverWave;
  const rhythm = opponent.region === 2 ? "第 3、6、9… 回合见真身" : `第 ${wave}、${wave + 3}、${wave + 6}… 回合起回浪`;
  const advice = opponent.region === 2 ? "连斩两次纸面会反噬。挑灯照面，或收刀等真身。"
    : wave === 2 ? "回浪提前。听潮步能避浪，割缆可以断水。" : "河伯汲水三次会覆舟。割缆或引浪倒撞能清空水位。";
  const outcome = result?.mirrorLevel ? `<section class="mirror-outcome"><h3>第 ${integer(result.mirrorLevel)} 重 · ${mirrorOpponent(result.mirrorLevel).name} · ${result.won ? "击破妖影" : "败阵"}</h3>
    <p>${result.won ? (result.sand ? `首破获得 ${integer(result.sand)} 淬纹砂` : "试招完成") : escape(result.reason ?? "")}</p>
    <details data-remember="mirror-report"><summary>交锋详情</summary><ol class="log">${result.report.map(line => `<li>${escape(line)}</li>`).join("")}</ol></details></section>` : "";
  const runes = (Object.keys(engravings) as Engraving[]).map(id => {
    const engraving = engravings[id];
    const rank = ranks[id];
    const cost = engravingCost(rank);
    const power = engravingPower(id, rank || 1);
    return `<section class="engraving"><header><strong>${engraving.name}</strong><span>${rank ? `第 ${rank} 纹${equipped === id ? " · 已装备" : ""}` : "未启纹"}</span></header>
      <p>${engraving.trigger}，${engraving.effect} +${power}。</p><div class="choices">
      ${rank < maxEngravingRank ? button(`engraving:train:${id}`, `${rank ? "温养" : "启纹"} · ${cost} 砂`, sand < cost, !rank) : '<small>已温养至第 8 纹</small>'}
      ${rank ? button(`engraving:equip:${id}`, equipped === id ? "卸下" : "装备") : ""}</div></section>`;
  }).join("");
  return `<div class="mirror-layout"><section><div class="section-title"><h2>照妖镜</h2><span>淬纹砂 <b>${integer(sand)}</b></span></div><p class="meta">${best ? `已破第 ${integer(best)} 重 · 每小时积攒 ${sandRate(best)} 砂` : "击破第一重后，镜中开始积砂。"}</p>
    ${outcome}<article class="mirror-entry"><div><h3>第 ${integer(next)} 重 · ${opponent.name}</h3><p>最多 ${mirrorRounds} 回合 · ${rhythm}</p></div>
    ${button(`mirror-fight:${next}`, result?.mirrorLevel === next ? "再试此重" : "照见妖影", !ready || !!fight, true)}</article>
    ${best ? `<form id="mirror-practice"><label>试招重数 <input type="number" min="1" max="${best}" step="1" value="${best}" required name="level"></label><button type="submit" ${!ready || !!fight ? "disabled" : ""}>进入已破重数</button></form>` : ""}
    <p class="meta">${advice}</p>
    <div class="mirror-outfit">${outfitPanel()}</div></section>
    <section class="mirror-engraving"><h2>刻纹</h2><p class="meta">一次可带一条，切换免费。离线最多积八小时。</p>${runes}</section></div>`;
}

function paintHelp() {
  const toggle = help.querySelector<HTMLButtonElement>("[data-action=guide-toggle]")!;
  toggle.textContent = save.guide.enabled ? "收起巡夜指引" : "显示巡夜指引";
  toggle.disabled = !ready || !!pending;
  const tip = nextTip({ ...save, guide: { ...save.guide, enabled: true, dismissed: [] } }, tab, result);
  changedText("#guide-current", fight?.boss ? "敌招起手时看战场下方。可花一次应变，也可保留次数。" : save.newGear.length ? "阿照停下来查看新拾的装备。穿在身上或收入行囊后，再继续巡夜。" : tip?.text ?? "点境界看道行，点装备部位换装。");
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
      : { patrol: patrolPanel, practice: practicePanel, skills: skillsPanel, archive: archivePanel, mirror: mirrorPanel }[tab]();
  const inBook = !!pending || !ready || tab !== "patrol" || journal || !!result;
  const homeTip = !inBook && patrolRemaining(save) > 0 && !save.newGear.length && currentTip;
  const repeatsControl = homeTip && (homeTip.target?.action === "auto-patrol" || homeTip.target?.action?.startsWith("region:") || homeTip.id.startsWith("learn-"));
  const outfit = element("#outfit");
  outfit.hidden = inBook || !!fight?.boss;
  if (!outfit.hidden) {
    const markup = outfitPanel();
    if (outfit.dataset.markup !== markup) {
      const action = outfit.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.action : undefined;
      outfit.innerHTML = markup;
      outfit.dataset.markup = markup;
      if (action) (outfit.querySelector<HTMLElement>(`[data-action="${action}"]`) ?? outfit.querySelector<HTMLElement>(`[data-action="slot:${openSlot}"]`))?.focus({ preventScroll: true });
    }
  }
  if (openSlot && (!outfit.hidden || tab === "mirror") && !fight?.boss && !pending) {
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
    (inBook && tab !== "skills" && tab !== "archive" && currentTip && !(result?.won && tab === "patrol") ? guideCard(currentTip) : "") +
    body + drop;
  if (html !== renderedPanel) {
    const scroll = panel.scrollTop;
    const openDetails = [...panel.querySelectorAll<HTMLDetailsElement>("details[open][data-remember]")].map(item => item.dataset.remember);
    panel.innerHTML = html;
    for (const details of panel.querySelectorAll<HTMLDetailsElement>("details[data-remember]")) {
      details.open = openDetails.includes(details.dataset.remember);
    }
    panel.scrollTop = scroll;
    renderedPanel = html;
  }
  if (help.open) paintHelp();
  for (const item of root.querySelectorAll<HTMLButtonElement>(".nav button")) {
    const key = item.dataset.action?.split(":")[1];
    item.hidden = !!fight?.boss || !(save.victories[0] || key === "patrol" || key === "skills" && clueCount(save, 0) === 3);
    if (key === "skills") item.textContent = save.drops.some((known, index) => known && !save.ranks[index]) ? "招式 · 待修习" : "招式";
    if (key === "patrol") item.textContent = save.newGear.length && inBook ? "巡夜 · 待整装" : "巡夜";
    if (item.dataset.action === "tab:" + tab) item.setAttribute("aria-current", "page");
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
  element("#realm").textContent = realmLabel(save.lifetimeDao);
  const xp = cultivation(save.lifetimeDao);
  const bar = element<HTMLProgressElement>("#xp");
  bar.max = xp.needed;
  bar.value = xp.progress;
  changedText("#xp-text", xp.full ? "首卷圆满" : `本层道行 ${xp.progress} / ${xp.needed}`);
  element("#status").textContent = pending ? "存档待写入" : ready ? "本地存档" : waiting;
  paintPatrolControls();
}

function paintPatrolControls() {
  const locked = !ready || !!pending || document.hidden;
  hunt.disabled = locked || !!fight || save.autoPatrol;
  autoPatrol.hidden = !save.victories[0] || !patrolRemaining(save);
  autoPatrol.disabled = locked || !!fight?.boss;
  autoPatrol.setAttribute("aria-pressed", String(save.autoPatrol));
  const region = regions[save.region];
  const done = save.victories[save.region] > 0;
  const clues = clueCount(save);
  changedText("#case-progress", done ? "已平息 · 查看妖案" : `妖案线索　${clues} / 3`);
  changedText("#case-name", region.title);
  element(".case-link").hidden = !!fight?.boss || clues === 0;
  element(".retreat").hidden = !fight?.boss;
  element(".gauges").hidden = !fight?.boss;
  element(".patrol-controls").hidden = !!fight?.boss || save.newGear.length > 0;
  changedText("[data-action=auto-patrol]", save.autoPatrol ? "收灯歇脚" : "沿路巡夜");
  const challenge = element<HTMLButtonElement>("#challenge");
  const swept = patrolRemaining(save) === 0;
  const onward = done && save.region < regions.length - 1;
  challenge.hidden = (!swept && done && !onward) || !canChallenge(save, save.region) || !!fight?.boss;
  challenge.dataset.action = onward ? "region:" + (save.region + 1) : "fight:" + save.region;
  changedText("#challenge", onward ? "前往" + regions[save.region + 1].name : (done ? "重演" : "挑战") + region.boss);
  challenge.disabled = locked || !!fight;
  hunt.hidden = !!fight?.boss || save.autoPatrol || swept;
  hunt.classList.toggle("secondary", !challenge.hidden);
  changedText("[data-action=hunt]", challenge.hidden ? "提灯夜行" : "继续夜行");
  const objective = element("#objective");
  objective.hidden = !save.guide.enabled && !swept && !onward && save.region === 0 && save.kills[0] === 0;
  if (!objective.hidden) {
    const remainingKills = clues < 3 ? region.thresholds[clues] - save.kills[save.region] : 0;
    changedText("#objective", swept ? "此地小妖已扫清"
      : onward ? region.boss + "已退，通往" + regions[save.region + 1].name + "的路开了。"
      : done ? "首卷已平，可在斩妖录重演大妖。"
      : !challenge.hidden ? region.boss + "现身了。"
      : remainingKills ? (save.region === 0 && save.kills[0] === 0 ? "提灯上山，找出第一只小妖。" : `再斩 ${remainingKills} 只，寻得下一条线索。`)
      : `线索已齐。踏入${realms[challengeRealms[save.region]]}后可挑战${region.boss}。`);
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

function changedText(selector: string, value: string) {
  const node = element(selector);
  if (node.textContent !== value) node.textContent = value;
}

const duel = element("#duel");
let duelMarkup = "";
let previewFight: Fight | null = null;
let previewRound = -1;
let previewCards = "";
const signed = (value: number) => value === 0 ? "0" : (value > 0 ? "+" : "−") + Math.abs(value);
function forecastBar(label: string, before: number, after: number, max: number) {
  return `<span class="forecast-row"><span>${label}</span><i aria-hidden="true" class="forecast-track"><i style="width:${100 * Math.max(before, after) / max}%"></i><b style="width:${100 * Math.min(before, after) / max}%"></b></i><b>${before} → ${after}</b></span>`;
}
function openingCards(f: Fight) {
  if (previewFight === f && previewRound === f.round) return previewCards;
  const hasShout = f.kit.shout !== "off" && f.ranks[0] > 0 && artDue(f.round + 2, 0);
  const hints = [
    ["伏低，避开虎啸", "多砍 12 点，硬接虎啸", "依原架势接啸"],
    ["断缆清空水位，浪势减弱", hasShout ? "倒撞敌舟，清空水位" : "镇山喝赶不上，浪势加重", "船缆汲水，河伯回血"],
    ["提灯三轮，刀刀见真身", "本轮收刀，下轮刀伤 +28", "保留应变，照常出刀"],
  ][f.region];
  const labels = encounters[f.region];
  previewCards = (["safe", "risk", "pass"] as Response[]).map((choice, index) => {
    const outcome = previewOpening(f, choice);
    const name = choice === "pass" ? "依原招出手" : labels[choice].name;
    const timing = outcome.result === "won" ? "可斩杀" : outcome.result === "lost" ? (outcome.water >= riverFloodLimit ? "覆舟 · 会败阵" : "会败阵") : `第 ${outcome.round} 回合末`;
    return button("respond:" + choice, `<span class="choice-title"><strong>${name}</strong><small>${choice === "pass" ? "保留机会" : "应变 −1"}</small></span><span class="choice-effect">${hints[index]}</span>
      ${forecastBar("阿照", f.life, outcome.life, f.maxLife)}${forecastBar("大妖", f.hp, outcome.hp, f.maxHp)}${f.region === 1 ? `<span class="water-preview">水位 ${f.water} → ${outcome.water}</span>`
      : outcome.backlashes ? `<span class="water-preview danger">纸面反噬 ×${outcome.backlashes}</span>` : ""}<small>${timing}</small>`);
  }).join("");
  previewFight = f; previewRound = f.round;
  return previewCards;
}

function paintDuel() {
  const f = fight;
  duel.hidden = !f?.boss;
  if (!f?.boss) { previewFight = null; return; }
  const encounter = encounters[f.region];
  const round = f.round + 1;
  const beats = [
    ["扑咬", "扫尾", "虎啸"], f.riverWave === 2 ? ["绷缆", "回浪", "挥篙"] : ["起浪", "绷缆", "回浪"], ["纸面", "借面", "烛偏见真身"],
  ][f.region];
  const tutorial = f.region === 0 && round <= 3 && !save.victories[0];
  const toggle = !tutorial && !f.waiting && f.focus > 0 ? button("consult", f.consult ? "余下险招不停手" : "险招前停手") : "";
  const phase = (round - 1) % 3;
  const track = `<div class="boss-beats" aria-label="三回合招路">${beats.map((beat, i) => `<span ${i === phase ? 'aria-current="step"' : ""}>${beat}</span>`).join("<i>›</i>")}</div>`;
  const last = f.lastExchange;
  const lastLine = last ? `<div class="exchange"><b>第 ${last.round} 回合</b>　阿照 ${signed(last.life)}　大妖 ${signed(last.hp)}${last.marks.length ? `<div class="battle-links">${last.marks.map(mark => `<span>${escape(mark)}</span>`).join("")}</div>` : ""}</div>` : "";
  const pendingChoice = f.order && f.order.round === round && !f.waiting ? f.order.choice : undefined;
  const headline = f.waiting ? encounter.sign : pendingChoice ? (pendingChoice === "pass" ? "依原招出手" : encounter[pendingChoice].name) : "第 " + round + " 回合";
  const { names } = roundMoves(f.region, f.kit, round, f.riverWave);
  const nextMoves = names.length ? `<p class="duel-moves">本回合出手 · ${names.join(" · ")}</p>` : "";
  const water = f.region === 1 ? `<div class="water-gauge" data-flood="${f.water >= riverFloodLimit - 1}"><b>水位</b>
    <meter aria-label="覆舟水位" min="0" max="${riverFloodLimit}" value="${f.water}">${f.water}/${riverFloodLimit}</meter>
    <span>${f.water}/${riverFloodLimit} · ${f.water >= riverFloodLimit - 1 ? "再汲一次就会覆舟" : "汲水三次便会覆舟"}</span></div>` : "";
  const paper = f.region === 2 ? `<div class="water-gauge" data-flood="${f.paperHits > 0}"><b>斩中纸面</b>
    <meter aria-label="纸面反噬进度" min="0" max="${paperHitLimit}" value="${f.paperHits}"></meter>
    <span>${f.paperHits}/${paperHitLimit} · ${f.paperHits ? "再斩一次纸面就会反噬" : "击中真身可消除累计"}</span></div>` : "";
  const body = `<div class="duel-head"><strong>${headline}</strong><span>应变 ${f.focus} / 2</span></div>${track}${water}${paper}${nextMoves}` +
    (f.waiting ? `<div class="choice-caption">选一招 · 看双方余血</div><div class="duel-options">${openingCards(f)}</div>` :
      (!last && f.region === 1 ? "<p>河伯靠船缆汲水。看他绷缆，再决定割缆还是借浪。</p>" : !last && f.region === 2 ? "<p>留心烛火。挑灯可让真身现形，也可收刀等她自己露面。</p>" : "") + lastLine) + toggle;
  if (duelMarkup !== body) {
    duel.innerHTML = body;
    duelMarkup = body;
  }
}

function paintStage() {
  const region = fight?.region ?? save.region;
  stage.dataset.zone = zoneArt[region];
  stage.dataset.cue = fight?.cue ?? "idle";
  stage.dataset.boss = String(!!fight?.boss);
  stage.dataset.warning = String(!!fight?.windup);
  stage.dataset.slain = String(!!fight && !fight.boss && fight.hp === 0);
  if (stage.dataset.scenery !== zoneArt[region]) {
    stage.dataset.scenery = zoneArt[region];
    element(".scenery").style.backgroundImage = `url("${assets + zoneArt[region]}.webp")`;
  }
  worldProp.hidden = !save.victories[region];
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
  changedText(".stage .chapter", fight?.mirrorLevel ? `第 ${integer(fight.mirrorLevel)} 重` : "青芦夜话");
  changedText("#place", fight?.mirrorLevel ? "照妖镜" : regions[region].name);
  changedText("#mode", pending || !ready || document.hidden ? "暂停" : fight?.boss ? "问妖" : save.newGear.length ? "驻足整装" : save.autoPatrol ? "巡夜中" : fight ? "寻妖中" : !patrolRemaining(save) ? "已扫清" : "待提灯");
  const human = element<HTMLProgressElement>("#life");
  human.max = fight?.maxLife ?? combatStats(save.realm, save.kit.stance, save.loadout, cultivation(save.lifetimeDao).layer).life;
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
  changedText("#report", fight?.event || save.report);
  changedText("#rate", !patrolRemaining(save) ? "本地修行止于" + realmLabel(regions[save.region].patrolCap) : fight?.boss ? `最多 ${fight.limit} 回合 · 已结算 ${fight.round} 回合`
    : save.autoPatrol ? `每分钟约 ${integer(rate(save))} 道行 · 止于${realmLabel(regions[region].patrolCap)}` : `每只 +${regions[region].reward} 道行　·　止于${realmLabel(regions[region].patrolCap)}`);
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
  const mirror = current.mirrorLevel ? settleMirror(draft, current, Date.now()) : undefined;
  if (!mirror) draft.report = won ? `阿照战胜了${current.name}。` : current.lastThreat || `败给了${current.name}。`;
  const loot = won && !mirror ? win(draft, current.region) : {};
  if (!won && !mirror) draft.guide.defeats[current.region] = Math.min(2, draft.guide.defeats[current.region] + 1);
  commit(draft, () => {
    panel.scrollTop = 0;
    const archive = battleOrigin?.tab === "archive" ? battleOrigin : backTrail.find(page => page.tab === "archive");
    backTrail.length = 0;
    if (archive) backTrail.push(archive);
    battleOrigin = null;
    window.scrollTo(0, 0);
    result = { mirrorLevel: current.mirrorLevel, sand: mirror?.reward, region: current.region, won, report: current.log, reason: current.lastThreat,
      links: current.links, round: current.round, life: Math.max(0, current.life), hp: Math.max(0, current.hp), turningPoint: current.turningPoint, ...loot };
    tab = mirror ? "mirror" : "patrol";

    resetPatrol();
  });
}

function finishPatrol(current: Fight) {
  const draft = structuredClone(save);
  const { reward, found } = recordPatrolKill(draft);
  const clues = clueCount(draft);
  draft.report = `一刀斩落${current.name}，道行 +${reward}` +
    (realmLabel(draft.lifetimeDao) !== realmLabel(save.lifetimeDao) ? ` · 升至${realmLabel(draft.lifetimeDao)}` : "") +
    (clues > clueCount(save) ? ` · 发现线索「${regions[draft.region].clues[clues - 1]}」` : "") + "。";
  commit(draft, () => {
    if (found && tab !== "patrol") notify(`拾得${equipment[found].name} · ${slots[equipment[found].slot]}`);
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
      if (result || tab === "mirror" || !save.autoPatrol || !canPatrol(save)) break;
      rest = Math.max(0, rest - frame);
      if (!rest) {
        fight = startFight(save, save.region, false, save.kills[save.region]);
        paintPanel();
      }
    }
    if (!fight) continue;
    tickFight(fight);
    if (fight.result !== "fighting") {
      if (fight.boss) settleBoss(fight);
      else finishPatrol(fight);
    }
  }
  paintStage();
}

function faceMirror(level: number) {
  if (tab !== "mirror" || !ready || pending || fight) return;
  const encounter = startMirrorFight(save, level);
  if (!encounter) return;
  battleOrigin = pageLocation();
  result = null;
  journal = false;
  tab = "patrol";
  fight = encounter;
  window.scrollTo(0, 0);
  paintPanel();
  paintStage();
}

root.addEventListener("submit", event => {
  if (!(event.target instanceof HTMLFormElement) || event.target.id !== "mirror-practice") return;
  event.preventDefault();
  faceMirror(Number(new FormData(event.target).get("level")));
});

root.addEventListener("click", event => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]")?.dataset.action;
  if (!action) return;
  const [name, value, option] = action.split(":");
  const id = Number(value) as Region;
  if (name === "slot" && Object.hasOwn(slots, value) && ready && !pending && !fight?.boss) {
    showSlot(value as GearSlot);
  } else if (name === "back") {
    returnTo(backTrail.pop());
  } else if (name === "home" || name === "tab" && value === "patrol") {
    backTrail.length = 0;
    journal = false;
    result = null;
    tab = "patrol";
    paintPanel();
    window.scrollTo(0, 0);
  } else if (name === "journal" && !fight?.boss) {
    backTrail.push(pageLocation());
    journal = true;
    paintPanel();
    window.scrollTo(0, 0);
  } else if (name === "motion") {
    quiet = !quiet;
    applyMotion();
  } else if (name === "help") {
    paintHelp();
    help.showModal();
  } else if (name === "guide-jump" && currentTip?.target) {
    const target = currentTip.target;
    if (tab !== target.tab) { backTrail.push(pageLocation()); panel.scrollTop = 0; }
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
      (target.action === "auto-patrol" || target.action?.startsWith("region:") || target.action?.startsWith("slot:"))) {
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
  } else if (name === "mirror-fight") {
    faceMirror(Number(value));
  } else if (name === "tab") {
    if (value === "mirror" && !mirrorUnlocked(save)) return;
    if (tab === value) return;
    const fromDetail = journal || tab === "mirror" || (tab === "patrol" && !!result);
    const fromNav = !!(event.target as HTMLElement).closest(".nav");
    const parent = backTrail[backTrail.length - 1];
    if (parent?.tab === value && !fromNav) {
      returnTo(backTrail.pop());
      return;
    }
    if (fromNav && value === "archive") {
      backTrail.length = 0;
      result = null;
    } else if (!fromNav || fromDetail) backTrail.push(pageLocation());
    else backTrail.length = 0;
    panel.scrollTop = 0;
    tab = value as Tab;
    journal = false;
    window.scrollTo(0, 0);
    if (tab === "mirror" && ready && !pending) commit(structuredClone(save));
    else paintPanel();
  } else if (name === "retry" && pending) {
    commit(pending.draft, pending.next);
  } else if (ready && !pending) {
    const draft = structuredClone(save);
    if (name === "engraving" && tab === "mirror" && (option === "edge" || option === "step") && (value === "train" || value === "equip")) {
      accrueSand(draft, Date.now());
      if (tuneEngraving(draft, option, value)) commit(draft);
    } else if (name === "guide-toggle") {
      draft.guide.enabled = !draft.guide.enabled;
      commit(draft);
    } else if (name === "guide-dismiss" && currentTip) {
      draft.guide.dismissed.push(currentTip.id);
      commit(draft);
    } else if (name === "consult" && fight?.boss && fight.focus > 0) {
      if (fight.waiting) answerOpening(fight, "pass");
      fight.consult = !fight.consult;
    } else if (name === "respond" && fight?.boss && (value === "safe" || value === "risk" || value === "pass")) {
      answerOpening(fight, value);
    } else if (name === "retreat" && fight?.boss) {
      resetPatrol();
      returnTo(battleOrigin ?? undefined);
      battleOrigin = null;
    } else if (!fight?.boss) {
      if (name === "hunt" && canPatrol(save) && !fight && !save.autoPatrol && !document.hidden) {
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
        commit(draft, () => { if (packSheet.open) packSheet.close(); notify(name === "equip" ? `已穿戴 · ${equipment[value].name}` : name === "collect" ? "已收好，可点对应装备槽查看" : "已卸下装备"); });
      } else if (name === "region" && unlocked(save, id) && !fight) {
        draft.region = id;
        if (!patrolRemaining(draft)) draft.autoPatrol = false;
        commit(draft, () => { backTrail.length = 0; resetPatrol(); returnTo(); });
      } else if (name === "fight" && canChallenge(save, id) && !fight) {
        battleOrigin = pageLocation();
        window.scrollTo(0, 0);
        result = null;
        journal = false;
        tab = "patrol";
        resetPatrol();
        fight = startFight(save, id, true);
        paintPanel();
      } else if (name === "learn-equip" && draft.ranks[id] === 0 && study(draft, id)) {
        if (id === 0) draft.kit.shout = "windup";
        if (id === 1) draft.kit.step = "tide";
        if (id === 2) draft.kit.reveal = true;
        commit(draft, () => notify(`已修习并装备${arts[id].name} · 第 ${arts[id].first} 回合出手`));
      } else if (name === "study" && study(draft, id)) {
        commit(draft, () => {
          notify(`《${arts[id].name}》已${save.ranks[id] === 1 ? "入门，可在当前页装备" : "精通"}。`);
        });
      } else if (name === "kit") {
        const kit = draft.kit;
        if (value === "stance" && (option === "guard" || option === "attack")) kit.stance = option;
        if (value === "shout" && draft.ranks[0] && (option === "off" || option === "windup")) kit.shout = option;
        if (value === "step" && (option === "basic" || option === "tide" && draft.ranks[1])) kit.step = option;
        if (value === "reveal" && draft.ranks[2]) kit.reveal = option === "true";
        if (JSON.stringify(kit) !== JSON.stringify(save.kit)) {
          const equipped = kit.shout !== "off" && save.kit.shout === "off" ? "equip-0"
            : kit.step === "tide" && save.kit.step === "basic" ? "equip-1"
            : kit.reveal && !save.kit.reveal ? "equip-2" : undefined;
          if (equipped && !draft.guide.dismissed.includes(equipped)) draft.guide.dismissed.push(equipped);
          commit(draft);
        }
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
  const offline = fight?.boss || result || tab === "mirror" ? null : accrueOffline(draft, previousWall);
  commit(draft, () => {
    if (!ready || (fight && !fight.boss && !canPatrol(save))) resetPatrol();
    ready = true;
    if (offline?.earned) {
      const minutes = Math.max(1, Math.floor(offline.credited / 60000));
      const period = offline.credited < 60000 ? "不足 1 分钟" : `${minutes} 分钟`;
      notify(`离线计入${period}，得 ${integer(offline.earned)} 道行。${!patrolRemaining(save) ? "此地小妖已扫清。" : ""}${sand ? `镜中另积 ${integer(sand)} 淬纹砂。` : ""}`);
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
