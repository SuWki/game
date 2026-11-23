import "./style.css";
import { arts, breakthrough, mountainFirstReward, realms, regions } from "./content.ts";
import { bossEquipment, equipment, knownGear, slots } from "./equipment.ts";
import type { GearSlot } from "./equipment.ts";
import { encounters } from "./tactics.ts";
import { nextTip } from "./guide.ts";
import type { Tab, Tip } from "./guide.ts";
import {
  accrueOffline, answerOpening, canChallenge, clueCount, combatStats, cultivation, decode, frame, maxRounds, newSave,
  rate, recordPatrolKill, roundPreview, saveKey, startFight, study, tickFight, unlocked, win,
} from "./game.ts";
import type { Fight, Kit, Region, Save } from "./game.ts";

const root = document.querySelector<HTMLDivElement>("#night-watch")!;
const assets = import.meta.env.BASE_URL + "night-watch/";
const zoneArt = ["mountain", "ferry", "temple"];
const tabs = { patrol: "巡夜", practice: "修行", skills: "招式", gear: "行囊", archive: "斩妖录" } as const;
let tab: Tab = "patrol";
let save = newSave(Date.now());
let fight: Fight | null = null;
let journal = false;
let ready = false;
let waiting = "正在载入巡簿";
let pending: { draft: Save; next?: () => void } | null = null;
let result: { region: Region; won: boolean; report: string[]; reason?: string; first?: boolean; drop?: boolean;
  round: number; life: number; hp: number; turningPoint?: string } | null = null;
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
    <div class="theatre">
      <section class="stage" aria-label="巡夜战场">
        <div class="scenery"></div><div class="shade"></div>
        <div class="stage-top"><div><small class="chapter">青芦村 · 巡夜地</small><div id="place" class="place"></div></div><span class="mode" id="mode"></span></div>
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
        <button type="button" data-action="auto-patrol" aria-pressed="false" hidden>自动夜行</button>
        <button type="button" data-action="fight:0" id="challenge" hidden>挑战吊睛山君</button></div><div id="gear-find" role="status" hidden></div>
      </div>
      <div class="field-note"><span>战报</span><div id="report"></div></div>
      <div id="home-guide" class="paper" hidden></div>
    </div>
    <section id="book" hidden><button class="back" type="button" data-action="home">‹　返回巡夜</button>
    <aside id="panel" class="paper" aria-label="巡夜手札"></aside></section>
    <nav aria-label="巡夜手札目录" class="nav">${Object.entries(tabs).filter(([key]) => key !== "practice").map(([key, label]) => `<button data-action="tab:${key}">${label}</button>`).join("")}</nav>
    <footer><span id="status">正在载入</span></footer>
  </main>
  <div id="flash" class="flash" role="status" hidden></div>
  <dialog id="help" class="paper help" aria-labelledby="help-title">
    <div class="guide-head"><h2 id="help-title">巡夜指引</h2><form method="dialog"><button type="submit">关闭</button></form></div>
    <button data-action="motion" class="motion" type="button">动效</button><p id="guide-current"></p>
    <button type="button" data-action="guide-toggle"></button>
    <div class="help-topics">
      <details><summary>夜行与线索</summary><p>点「夜行」找一只小妖，一刀斩落。收齐三条线索并满足境界要求后，可挑战当地大妖。首次击败吊睛山君后可自行开启「自动夜行」。</p></details>
      <details><summary>掉落与装备</summary><p>小妖有机会掉落本地兵刃或护具，大妖首胜会给专属佩饰。掉落卡可以直接穿戴或先收好。行囊有兵刃、护具、佩饰三个槽，每槽可装一件，属性和回合效果会带入下一场大妖战。</p></details>
      <details><summary>挑战与战报</summary><p>在「招式」可查看前六轮招谱。山君第 3 回合放虎啸时会暂停。低头防守最多扣 4 点气血，抢先砍一刀能多打 12 点，正常出招会保留应变次数。每战能用两次特殊应对，也可以正常出招并保留次数。武学、身法与神通始终按谱释放。重演默认自动战斗，可在战场切换。败阵后可看逐轮战报，免费再战。</p></details>
      <details><summary>观化、学习与装备</summary><p>首次战胜山君会觉醒观化。此后击败大妖有机会悟得招谱。先花道行学到入门，再装备才会出招。精通增强效果，首发轮和间隔照旧。</p></details>
      <details><summary>道行与破境</summary><p>每境十层，累计获得道行就会自动升级。学招只花可用道行。舒筋开身法位，贯劲可在架住重击后反击，听息开神通位。</p></details>
      <details><summary>换路、重演与保底</summary><p>在「斩妖录」切换巡夜地，或重演已击败的大妖。河伯和娘娘各自最多第五胜悟得传承，败阵不计入。</p></details>
      <details><summary>离线结算</summary><p>开启自动夜行后，离开期间可按当前地点的速率积攒道行，最多八小时。装备、击杀与线索在在线夜行时结算。</p></details>
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
      : save.drops[result.region] ? "这段传承已记入巡簿。" : `距必得传承至多还需 ${remaining} 胜。`;
    const nextRegion = result.region + 1;
    return title(result.won ? "战胜大妖" : "败阵", cleared.boss,
      result.won ? (result.first ? cleared.cleared : "阿照在灯下重演了那一夜。") : escape(result.reason ?? "")) +
      (awakening ? '<p class="intro"><strong>天赋初醒 · 观化</strong><br>虎啸已经停了，阿照胸中却还留着山君开口前的那一顿。她提笔，把这一息记进巡簿。</p>' : "") +
      (result.won ? `<p class="prize">${prize}</p>` : "") +
      (result.first ? `<p class="prize">首胜佩饰 · ${equipment[bossEquipment[result.region]].name}</p>` : "") +
      (awakening ? '<p class="meta">已解锁自动夜行。点击战场下方「自动夜行」即可开启。</p>' : "") +
      (result.turningPoint ? `<p><strong>最后一次应变</strong><br>${escape(result.turningPoint)}</p>` : "") +
      `<p class="meta">第 ${result.round} 回合结束 · 阿照余 ${result.life} 气血 · 大妖余 ${result.hp} 气血</p>
      <details data-remember="report"><summary>交锋详情</summary><ul class="log">${result.report.map(line => `<li>${escape(line)}</li>`).join("")}</ul></details><div class="actions">` +
      (result.drop ? button("tab:skills", "查看传承", false, awakening || !result.first || nextRegion === 3) : "") +
      (result.first ? button("tab:gear", "查看首胜装备") : "") +
      (result.first && nextRegion < 3 ? button(`region:${nextRegion}`, `去${regions[nextRegion].name}`, !!fight, !awakening) : "") +
      (!result.won ? button(`fight:${result.region}`, "再战", !ready || !!fight, true) + button("tab:skills", "调整招式") : "") +
      button("dismiss", "回到巡夜") + "</div>";
  }
  if (!save.victories[0]) {
    return title(location.tag, location.title, location.intro) +
      `<p class="meta">山君踪迹 · ${Math.min(save.kills[0], 12)} / 12 只小妖</p>` +
      (clues ? `<p>最近线索 · ${location.clues[clues - 1]}</p>` : "");
  }
  const done = save.victories[save.region] > 0;
  let hint = "";
  if (clues < 3) hint = `继续巡夜，再斩 ${location.thresholds[clues] - save.kills[save.region]} 只小妖可找到下一条线索。`;
  else if (!canChallenge(save, save.region)) hint = `挑战须达${realms[save.region === 1 ? 1 : 3]}境，可在修行页查看破境条件。`;
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
    ${hint ? `<p class="meta">${hint}</p>` : ""}<p class="meta">本地掉落 · ${save.region + 1} 阶装备</p><div class="actions">` +
    (done && save.region < 2 ? button(`region:${save.region + 1}`, `去${regions[save.region + 1].name}`, !ready || !!fight, true) : "") +
    button(`fight:${save.region}`, `${done ? "重演" : "挑战"}${location.boss}`, !ready || !!fight || !canChallenge(save, save.region), !done || save.region === 2) +
    "</div>";
}

function practicePanel(): string {
  const next = breakthrough[save.realm];
  const state = cultivation(save.lifetimeDao);
  return title("灯下修行", realmLabel(save.lifetimeDao), "每境十层。获得道行会自动升级，每升一层增加气血。") +
    `<p>累计道行 ${integer(save.lifetimeDao)} · 可用道行 ${integer(save.dao)}</p>
    <p>${state.full ? "已达首卷最高层" : `再得 ${state.needed - state.progress} 道行升到下一层`}</p>
    ${next ? `<p>进入${realms[save.realm + 1]}境后，${next.gift}</p>` : ""}`;
}

function skillsPanel(): string {
  const controlsDisabled = !ready || !!fight?.boss;
  const stats = combatStats(save.realm, save.kit.stance, save.loadout, cultivation(save.lifetimeDao).layer);
  const choices = <K extends keyof Kit>(key: K, options: [string, Kit[K]][]) =>
    `<div class="choices">${options.map(([label, value]) => `<button data-action="kit:${key}:${value}" type="button" aria-pressed="${save.kit[key] === value}" ${controlsDisabled ? "disabled" : ""}>${label}</button>`).join("")}</div>`;
  const origin = save.victories[0] > 0
    ? "天赋「观化」已觉醒，可从妖魔身上悟得传承。"
    : "师父传了阿照一柄短刀，教她守式与攻式。";
  const opponent = fight?.boss ? fight.region : result?.region ?? save.region;
  return title("武学与神通", "案前配招", origin + "每回合出刀一次，已装备的招式按谱释放。") +
    `<div class="section-title"><strong>架势</strong><span>守重击 / 强刀伤</span></div>` +
    choices("stance", [["守式", "guard"], ["攻式", "attack"]]) +
    `<p class="meta">当前刀伤 ${stats.damage}，气血上限 ${stats.life}，含装备属性。守式架住重击时承受 18% 伤害，攻式提升 25% 基础刀伤。</p>` +
    `<details data-remember="preview" id="round-preview"><summary>${regions[opponent].boss} · 前六轮招谱</summary><ol class="log">${Array.from({ length: 6 }, (_, i) => `<li>${roundPreview(opponent, save.kit, i + 1)}</li>`).join("")}</ol></details>` +
    arts.map((art, i) => {
      const rank = save.ranks[i];
      const cost = rank ? 400 : art.cost;
      let controls = "";
      if (save.drops[i]) {
        controls = rank === 2 ? "" : `<p class="meta">${costText(cost)}</p>` +
          button(`study:${i}`, rank ? "精通 · 400" : `学习 · ${art.cost}`, controlsDisabled || save.realm < art.realm || save.dao < cost);
      }
      if (i === 0 && rank) controls += choices("shout", [["装备镇山喝", "windup"], ["卸下", "off"]]);
      if (i === 1 && save.realm >= 1) controls += choices("step", rank ? [["退步", "basic"], ["听潮步", "tide"]] : [["退步", "basic"]]);
      if (i === 2 && rank) controls += choices("reveal", [["装备照影", true], ["卸下", false]]);
      return `<section class="art"><div class="section-title"><strong>${art.name}</strong><span>${art.kind} · ${["未习得", "入门", "精通"][rank]}</span></div>
        <p>${art.description}</p><p class="meta">精通后，${art.mastery}${save.drops[i] ? "" : ` 传承见于${regions[i].boss}。`}</p>${controls}</section>`;
    }).join("") +
    (result && !result.won ? `<div class="actions rematch">${button(`fight:${result.region}`, `再战${regions[result.region].boss}`, !ready || !!fight, true)}${button("review", "返回交锋详情")}</div>` : "");
}

function gearPanel(): string {
  const locked = !ready || !!fight?.boss;
  return title("随身行囊", "装备", "兵刃、护具、佩饰各可穿戴一件。换装在下次大妖战生效。") +
    `<div class="slots">${(Object.keys(slots) as GearSlot[]).map(slot => {
      const id = save.loadout[slot];
      return `<div class="slot"><i class="icon ${slot}"></i><b>${slots[slot]}</b><span>${id ? equipment[id].name : "空槽"}</span><small>${slotNotes[slot]}</small></div>`;
    }).join("")}</div>` + Object.entries(slots).map(([slot, label]) => {
      const active = save.loadout[slot as keyof typeof slots];
      const owned = save.ownedGear.filter(id => equipment[id].slot === slot)
        .sort((a, b) => equipment[b].level - equipment[a].level);
      const items = owned.map(id => {
        const item = equipment[id];
        return `<li class="gear-item">
          <div><strong>${item.name}</strong> <span>${item.level} 阶${item.slot === "charm" ? " · 大妖首胜" : ""}</span>
          <p>${item.effect}</p></div>
          ${id === active ? button(`unequip:${id}`, "卸下", locked) : button(`equip:${id}`, "装备", locked)}
        </li>`;
      }).join("");
      return `<section class="art"><div class="section-title"><strong>${label}</strong><span>${active ? equipment[active].name : "未装备"}</span></div>
        ${owned.length ? `<ul class="gear-list">${items}</ul>` : `<p class="meta">${slot === "charm" ? "击败大妖可得首胜佩饰。" : "继续夜行，寻找本地掉落。"}</p>`}</section>`;
    }).join("");
}

function archivePanel(): string {
  return title("青芦夜话", "斩妖录", "从巡簿换一条夜路，也可在灯下重演已经平息的妖案。") +
    regions.map((region, i) => {
      const id = i as Region;
      const access = unlocked(save, id);
      const wins = save.victories[id];
      const progress = wins ? save.drops[id] ? "传承已悟得" : `距必得至多 ${5 - wins} 胜`
        : access ? `线索 ${clueCount(save, id)} / 3` : `先击败${regions[id - 1]?.boss}`;
      return `<section class="art"><div class="section-title"><strong>${region.name}</strong><span>${region.chapter}</span></div>
        <p class="meta">${progress}</p><div class="choices">${button(`region:${id}`, "去巡夜", !ready || !access || !!fight)}
        ${wins ? button(`fight:${id}`, `重演${region.boss}`, !ready || !!fight) : ""}</div></section>`;
    }).join("");
}

function paintHelp() {
  const toggle = help.querySelector<HTMLButtonElement>("[data-action=guide-toggle]")!;
  toggle.textContent = save.guide.enabled ? "关闭自动提示" : "开启自动提示";
  toggle.disabled = !ready || !!pending;
  changedText("#guide-current", save.guide.enabled ? "首次遇到新玩法时，手札会显示当前指引。" : "自动提示已关闭。这里的指引可以随时查看。");
}

function guideCard(tip: Tip) {
  const target = tip.target;
  return `<section class="guide-card" aria-label="当前指引">
    <div class="guide-head"><strong>${tip.title}</strong>${button("guide-dismiss", "知道了")}</div>
    <p>${tip.text}</p>${target ? button("guide-jump", target.label) : ""}
  </section>`;
}

function paintPanel() {
  const focused = (document.activeElement as HTMLElement | null)?.dataset.action;
  panel.dataset.tab = tab;
  currentTip = ready && !pending && !fight?.boss && (save.victories[0] || tab !== "patrol") ? nextTip(save, tab, result) : undefined;
  const body = pending ? title("存档待写入", "巡簿暂存", "刚才的结果已暂存。恢复写入后可继续巡夜。") + button("retry", "重试写入", false, true)
    : !ready && waiting !== "另一页正在巡夜，此页可查阅巡簿" ? title("青芦夜话", "巡簿", waiting)
      : { patrol: patrolPanel, practice: practicePanel, skills: skillsPanel, gear: gearPanel, archive: archivePanel }[tab]();
  const inBook = !!pending || !ready || tab !== "patrol" || journal || !!result;
  const homeTip = !inBook && currentTip;
  const guide = element("#home-guide");
  guide.hidden = !homeTip;
  const tipHtml = homeTip ? guideCard(homeTip) : "";
  if (guide.dataset.tip !== tipHtml) { guide.innerHTML = tipHtml; guide.dataset.tip = tipHtml; }
  element(".theatre").hidden = inBook;
  element("#book").hidden = !inBook;
  element(".back").hidden = !!pending || !ready;
  element<HTMLButtonElement>(".cultivation").disabled = !!fight?.boss || !ready || !!pending;
  const html = (inBook && currentTip ? guideCard(currentTip) : "") + body;
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
    item.hidden = !!fight?.boss || !(save.victories[0] || key === "patrol" || key === "gear" && save.ownedGear.length || key === "skills" && clueCount(save, 0) === 3);
    if (item.dataset.action === "tab:" + tab) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  if (focused && !root.contains(document.activeElement)) {
    [...panel.querySelectorAll<HTMLButtonElement>("button")].find(item => item.dataset.action === focused)?.focus({ preventScroll: true });
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
  autoPatrol.hidden = !save.victories[0];
  autoPatrol.disabled = locked || !!fight?.boss;
  autoPatrol.setAttribute("aria-pressed", String(save.autoPatrol));
  const region = regions[save.region];
  const done = save.victories[save.region] > 0;
  changedText("#case-progress", done ? "已平息 · 查看妖案" : `妖案线索　${clueCount(save)} / 3`);
  changedText("#case-name", region.title);
  element(".case-link").hidden = !!fight?.boss;
  element(".retreat").hidden = !fight?.boss;
  element(".gauges").hidden = !fight?.boss;
  element(".patrol-controls").hidden = !!fight?.boss;
  changedText("[data-action=auto-patrol]", save.autoPatrol ? "停止自动" : "自动夜行");
  const challenge = element<HTMLButtonElement>("#challenge");
  challenge.hidden = done || !canChallenge(save, save.region) || !!fight?.boss;
  challenge.dataset.action = "fight:" + save.region;
  changedText("#challenge", "挑战" + region.boss);
  challenge.disabled = locked || !!fight;
  hunt.hidden = !!fight?.boss || save.autoPatrol;
  hunt.classList.toggle("secondary", !challenge.hidden);
  changedText("[data-action=hunt]", challenge.hidden ? "提灯夜行" : "继续夜行");
  const objective = element("#objective");
  objective.hidden = !save.guide.enabled;
  if (!objective.hidden) changedText("#objective", !challenge.hidden ? "踪迹已齐，可以挑战" + region.boss + "。" :
    !save.kills[0] ? "点「提灯夜行」，寻找第一只小妖。" :
    done ? (save.region < 2 ? "此地已平息，可在斩妖录前往" + regions[save.region + 1].name + "。" : "首卷已平，可重演大妖补全传承。") :
    clueCount(save) < 3 ? `再斩 ${region.thresholds[clueCount(save)] - save.kills[save.region]} 只小妖，寻找下一条线索。` : "继续积累道行，提升境界后挑战大妖。");
  const drop = element("#gear-find");
  const id = save.newGear[0];
  drop.hidden = !id || !!fight?.boss;
  if (!drop.hidden) {
    const item = equipment[id];
    const equipped = save.loadout[item.slot];
    const markup = `<i class="icon ${item.slot}"></i><div><small>新装备 · ${slots[item.slot]} · ${item.level} 阶</small><strong>${item.name}</strong><span>${item.effect}</span>
      <small>当前 · ${equipped ? equipment[equipped].name : "空槽"}</small></div>
      <div>${button("equip:" + id, "立即穿戴", locked)} ${button("collect:" + id, "先收好", locked)}</div>`;
    if (drop.dataset.markup !== markup) { drop.innerHTML = markup; drop.dataset.markup = markup; }
  }
}

function changedText(selector: string, value: string) {
  const node = element(selector);
  if (node.textContent !== value) node.textContent = value;
}

const duel = element("#duel");
let duelMarkup = "";
function paintDuel() {
  const f = fight;
  duel.hidden = !f?.boss;
  if (!f?.boss) return;
  const encounter = encounters[f.region];
  const round = f.round + 1;
  const tutorial = f.region === 0 && round <= 3 && (!save.victories[0] || f.waiting);
  const toggle = !tutorial && f.focus > 0 ? button("consult", f.consult ? "剩余回合自动打" : "遇到危险时暂停") : "";
  const order = f.order;
  const ongoing = order && order.choice !== "pass" && round > order.round &&
    ((f.region === 1 && round === order.round + 1) ||
    (f.region === 2 && round <= order.round + (order.choice === "safe" ? 2 : 1)));
  const body = `<div class="duel-head"><strong>${f.waiting ? encounter.sign : "大妖交锋"}</strong><span>应变剩 ${f.focus} 次</span></div>` +
    (f.waiting ? `${tutorial ? "<p><b>师父提醒</b>　山君要吼了。第一次试试低头防守，只会掉 4 点气血。</p>" : `<p>${roundPreview(f.region, f.kit, round)}<br>${roundPreview(f.region, f.kit, round + 1)}</p>`}
      <p>${tutorial ? "选下面任一招会用掉一次应变。" : encounter.read + " 特殊应对各用一次。"}</p>
      <div class="duel-options">${(["safe", "risk"] as const).map(key =>
        button("respond:" + key, `<strong>${f.region === 0 ? (key === "safe" ? "低头防守" : "抢先砍一刀") : encounter[key].name}</strong><small>${encounter[key].effect}</small>`)).join("")}</div>
      ${button("respond:pass", "正常出招（保留次数）")} ${toggle}`
    : `<p>${ongoing && order.choice !== "pass" ? encounter[order.choice].name + " · " + encounter[order.choice].effect : f.consult && f.focus ? (tutorial ? "阿照会自己出刀。第 3 回合山君要放虎啸，到时你来选怎么应对。" : "遇到危险招式会暂停，等你选择。") : "阿照正在自动战斗。"} ${toggle}</p>`);
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
  if (fight && foeImage.getAttribute("src") !== assets + fight.sprite + ".png") {
    foeImage.src = assets + fight.sprite + ".png";
    foeImage.alt = fight.name;
  }
  element("#windup").hidden = !fight?.windup;
  changedText("#windup", fight?.windup ?? "");
  changedText("#place", regions[region].name);
  changedText("#mode", pending || !ready || document.hidden ? "暂停" : fight?.boss ? "问妖" : save.autoPatrol ? "自动夜行中" : fight ? "寻妖中" : "待命");
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
  changedText("#rate", fight?.boss ? `最多 ${maxRounds} 回合 · 已结算 ${fight.round} 回合`
    : save.autoPatrol ? `每分钟约 ${integer(rate(save))} 道行` : `每次夜行得 ${regions[region].reward} 道行`);
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
  }, 8500);
}

function commit(draft: Save, next?: () => void): boolean {
  draft.time = Math.max(Date.now(), draft.time);
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
  draft.report = won ? `阿照战胜了${current.name}。` : current.lastThreat || `败给了${current.name}。`;
  const loot = won ? win(draft, current.region) : {};
  if (!won) draft.guide.defeats[current.region] = Math.min(2, draft.guide.defeats[current.region] + 1);
  commit(draft, () => {
    panel.scrollTop = 0;
    result = { region: current.region, won, report: current.log, reason: current.lastThreat,
      round: current.round, life: Math.max(0, current.life), hp: Math.max(0, current.hp), turningPoint: current.turningPoint, ...loot };
    tab = "patrol";

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
      if (!save.autoPatrol) break;
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

root.addEventListener("click", event => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]")?.dataset.action;
  if (!action) return;
  const [name, value, option] = action.split(":");
  const id = Number(value) as Region;
  if (name === "home" || name === "tab" && value === "patrol") {
    journal = false;
    result = null;
    tab = "patrol";
    paintPanel();
    window.scrollTo(0, 0);
  } else if (name === "review" && result) {
    tab = "patrol";
    paintPanel();
    window.scrollTo(0, 0);
  } else if (name === "journal" && !fight?.boss) {
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
    if (tab !== target.tab) panel.scrollTop = 0;
    tab = target.tab;
    journal = tab === "patrol" && target.action?.startsWith("region:") === true;
    if (tab === "patrol" && !journal) result = null;
    paintPanel();
    const preview = panel.querySelector<HTMLDetailsElement>("#round-preview");
    if (target.action === "preview" && preview) preview.open = true;
    const anchor = target.action === "preview" ? preview?.querySelector("summary")
      : [...root.querySelectorAll<HTMLButtonElement>("[data-action]")].find(item => item.dataset.action === target.action && item.getClientRects().length);
    const destination = anchor ?? panel;
    destination.scrollIntoView({ block: "nearest" });
    destination.focus({ preventScroll: true });
    if (anchor) {
      anchor.classList.add("guide-focus");
      setTimeout(() => anchor.classList.remove("guide-focus"), 2500);
    }
  } else if (name === "tab") {
    if (tab !== value) panel.scrollTop = 0;
    tab = value as Tab;
    journal = false;
    window.scrollTo(0, 0);
    paintPanel();
  } else if (name === "dismiss") {
    result = null;
    journal = false;
    paintPanel();
  } else if (name === "retry" && pending) {
    commit(pending.draft, pending.next);
  } else if (ready && !pending) {
    const draft = structuredClone(save);
    if (name === "guide-toggle") {
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
      result = null;
      resetPatrol();
      paintPanel();
    } else if (!fight?.boss) {
      if (name === "hunt" && !fight && !save.autoPatrol && !document.hidden) {
        if (result?.won) result = null;
        fight = startFight(save, save.region, false, save.kills[save.region]);
        paintPanel();
      } else if (name === "auto-patrol" && save.victories[0] > 0) {
        draft.autoPatrol = !save.autoPatrol;
        if (draft.autoPatrol && !draft.guide.dismissed.includes("auto-patrol")) draft.guide.dismissed.push("auto-patrol");
        commit(draft, () => { if (!fight) rest = draft.autoPatrol ? frame : regions[save.region].patrolInterval - 500; });
      } else if ((name === "equip" || name === "unequip" || name === "collect") && knownGear(value) && draft.ownedGear.includes(value)) {
        const slot = equipment[value].slot;
        if (name === "equip") draft.loadout[slot] = value;
        else if (name === "unequip" && draft.loadout[slot] === value) delete draft.loadout[slot];
        draft.newGear = draft.newGear.filter(id => id !== value);
        commit(draft, () => notify(name === "equip" ? `已穿戴 · ${equipment[value].name}` : name === "collect" ? "已收进行囊" : "已卸下装备"));
      } else if (name === "region" && unlocked(save, id) && !fight) {
        draft.region = id;
        commit(draft, () => { result = null; journal = false; tab = "patrol"; resetPatrol(); });
      } else if (name === "fight" && canChallenge(save, id) && !fight) {
        result = null;
        journal = false;
        tab = "patrol";
        resetPatrol();
        fight = startFight(save, id, true);
        paintPanel();
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
  const offline = accrueOffline(draft, previousWall);
  commit(draft, () => {
    if (!ready) resetPatrol();
    ready = true;
    if (offline.earned) {
      const minutes = Math.max(1, Math.floor(offline.credited / 60000));
      const period = offline.credited < 60000 ? "不足 1 分钟" : `${minutes} 分钟`;
      notify(`离线计入${period}${offline.elapsed > offline.credited ? "（上限 8 小时）" : ""}，得 ${integer(offline.earned)} 道行。线索按在线击杀推进。`);
    }
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
