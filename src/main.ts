import './style.css';
import { berthFee, boardingWater, cargoGoods, cargoId, cargoKind, cargoQuote, crossingBudget, floatFarmOrder, shipSaleQuote, shipStop, waterPacks } from './ship';
import { shipGap } from './counter';
import { outingPlan } from './counter';
import { boatFee, cashReserve, filterGrades, filterOffer, outingLimit, voyageOdds, waterJobPay, winchUpgradeCost } from './outing';
import { cutCells, cutOrders, cutQuote, jadeGrades, lampCost, stoneFee, stoneOdds, trialCut, usableCell, type CutKind, type CutPlacement, type Jade } from './jade';
import { atFirstChapterSummary, heldTicket, nightlyWater, openCounter, ownedImitation, saleOffer, settleVisit, usablePurifier, waterCost, waterLedger, type Action, type Counter, type Result } from './counter';
import { currentVisit, falseTimerPrice, firstChapterEnd, harborPeriod, harborPeriods, honestTimerPrice, imitationPurchasePrice, lastDay, maxOffers, openingCash, scheduledVisits, secondChapterStart, waterPrice, waterReservePrice, waterStartDay, type Item, type Visit } from './scenario';
import { readSave, saveVersion } from './save';
import { atRoundSummary, consignmentOpen, contactPrice, counterNotes, harborOpen, harborStock, pastLastDay, portBulletin, portJobs, rentalDays, rentalFee, repairFee, repairMarket, roundReferral, salvageMarket, winchBulletin, workshopEligibility, workshopOpen } from './counter';
import { floatFarmRequest, isShortRope, ropeVisit, ropeVisitPrice } from './counter';
import { baseItemId, consignmentPrices, crateCost, crateInspection, cratePartId, cratePartPrice, portItem, portRound, roundEnd, roundStart, salvageWindow, sealedCrateId, sealedCratePrice, winchOrderDay } from './scenario';
import { board, lateBoardPrice, wornWinch, wornWinchEarlyPrice, wornWinchLatePrice, wornWinchPrice } from './scenario';

const cashParam = new URLSearchParams(location.search).get('cash');
const sandboxCash = cashParam === '24' ? 24 : cashParam === '5' ? 5 : null;
const saveKey = sandboxCash === null ? 'tideline-counter' : `tideline-counter-cash-${sandboxCash}`;
const tutorialKey = 'tideline-counter-tutorial';
const openingStory = '那场风暴过后，旧船厂的汽笛沉寂了好几年。如今码头又能靠船了，船上的旧物也跟着人上了岸。你在船厂门口支起当铺：有人急着结工钱，肯把货卖断；有人只想押上心爱的东西，等船回来再赎。';
const shipStory = '陆上的城镇被咸潮切成了孤岛。「旧港号」把数百人接上船，你在面向栈桥的舷窗边开了一间当铺。船员押东西周转，岸上的人拿备件换船币。每五天母船换一个泊位，今天便宜的货，下站也许正缺。';
const newGame = () => openCounter(sandboxCash ?? openingCash);
const newSavedGame = (): Counter => ({ ...newGame(), economy: 'port', ship: { water: boardingWater }, harborSchedule: Math.random() < 0.5 ? 'late' : undefined });
let state = newGame();
let savedRaw: string | null = null;
let saveBlocked = false;
let busy = false;
let atTitle = true;
let tutorialStep: 'inspect' | 'trade' | null = null;
const artwork = (file: string) => `${import.meta.env.BASE_URL}pixel-shop/${file}.png`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="backdrop" aria-hidden="true">
    <div class="scenery">
      ${harborPeriods.map((name) => `<img class="harbor" data-light="${name}" src="${artwork(`harbor-${name}`)}" alt="">`).join('')}
      <img class="shop-room" src="${artwork('shop')}" alt="">
      <span id="dock-flag" hidden></span>
      <img id="guest-art" class="guest-art" alt="" hidden>
      <img class="shop-front" src="${artwork('shop')}" alt="">
      <img id="item-art" class="item-art" alt="" hidden>
    </div>
  </div>
  <header class="topbar">
    <div class="bar-inner">
      <div class="counter-heading"><div class="brand">旧港当铺</div>
        <span id="day" class="day"></span></div>
      <div class="cash">现金 <output id="cash"></output> 元 <span id="cash-change" role="status"></span></div>
      <div class="tools">
        <button id="show-guide" class="quiet">玩法提示 <kbd aria-hidden="true">H</kbd></button>
        <button id="show-notes" class="quiet">线索记录 <span id="note-count" class="note-count" hidden></span><kbd aria-hidden="true">J</kbd></button>
        <button id="show-ledger" class="quiet">账本</button>
        <button id="show-menu" class="quiet">菜单</button>
      </div>
    </div>
  </header>
  <main>
    <p id="ship-status" class="ship-status" hidden></p>
    ${sandboxCash === null ? '' : `<p class="test-note">验收模式 · 开局现金 ${sandboxCash} 元</p>`}
      <section class="counter" aria-label="柜台">
        <div class="scene-column">
          <div id="scene"></div>
          <div id="inspection-entry" hidden><button id="inspect-counter" class="quiet" aria-haspopup="dialog">
            <img id="inspect-thumb" alt="" hidden><span id="inspect-label">近看货物</span>
          </button></div>
        </div>
        <div class="worktop">
          <div class="side-trades">
            <button id="ship-store-button" class="quiet" hidden>船务与岸市</button>
            <button id="show-harbor" class="quiet" hidden>港口货摊</button>
            <button id="show-consignment" class="quiet" hidden>寄售架</button>
            <button id="show-jobs" class="quiet" hidden>字条与委托</button>
            <button id="show-filter-rack" class="quiet" hidden>淡化机架</button>
          </div>
          <div id="actions" class="actions" aria-label="柜台操作"></div>
          <p id="feedback" role="status"></p>
          <button id="retry" class="quiet" hidden>重试读取</button>
        </div>
        <div id="counter-desk" class="counter-desk">
          <button id="note-slip" class="note-slip" hidden></button>
          <div class="desk-stock"><span>自有库存</span><div id="desk-items" class="stock-chips"></div><small id="desk-held"></small></div>
        </div>
      </section>
  </main>
  <dialog id="title-dialog" aria-labelledby="title-heading">
    <div class="title-card">
      <h1 id="title-heading">旧港当铺</h1>
      <p id="title-save"></p>
      <div class="actions"><button id="title-continue" hidden>继续营业</button><button id="title-new">开始营业</button></div>
    </div>
  </dialog>
  <dialog id="filter-rack" aria-labelledby="filter-rack-title">
    <div class="dialog-head"><h2 id="filter-rack-title">船厂淡化机架</h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <p id="filter-rack-status"></p>
    <div id="filter-rack-actions" class="actions"></div>
    <p id="filter-rack-result" role="status"></p>
  </dialog>
  <dialog id="harbor-dialog" aria-labelledby="harbor-title">
    <div class="dialog-head"><h2 id="harbor-title">港口货摊</h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <p id="harbor-cash"></p>
    <p>营业时随时可以买卖。收购牌按这局船期报价，每样来货只有一份。</p>
    <div id="harbor-stock"></div>
    <p id="harbor-result" role="status"></p>
  </dialog>
  <dialog id="consignment-dialog" aria-labelledby="consignment-title">
    <div class="dialog-head"><h2 id="consignment-title">寄售架</h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <p id="consignment-schedule"></p>
    <p>挂一件自有库存，次日开门才回款。稳卖价一定能成交，另外两档要看买家预算。打烊前可撤下，或直接卖给来客。</p>
    <div id="consignment-stock"></div>
    <p id="consignment-result" role="status"></p>
  </dialog>
  <dialog id="stock-dialog" aria-labelledby="stock-title">
    <div class="dialog-head"><h2 id="stock-title"></h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <div id="stock-detail"></div>
    <p id="stock-result" role="status"></p>
  </dialog>
  <aside id="tutorial-tip" aria-label="新手引导" hidden>
    <p id="tutorial-copy"></p>
    <button id="skip-tutorial" class="quiet">跳过引导</button>
  </aside>
  <dialog id="ration-dialog" aria-labelledby="ration-title">
    <div class="dialog-head"><h2 id="ration-title">旧港 · 开张日</h2></div>
    <p id="opening-story">${openingStory}</p>
    <p id="opening-ration" class="ration-slip"></p>
    <form method="dialog" class="actions"><button autofocus>掀帘开张</button></form>
  </dialog>
  <dialog id="inspect-dialog" aria-labelledby="inspect-title">
    <div class="dialog-head"><h2 id="inspect-title"></h2><form method="dialog"><button class="quiet" autofocus>返回柜台</button></form></div>
    <div id="inspect-content"></div>
  </dialog>
  <dialog id="guide-dialog" aria-labelledby="guide-title">
    <div class="dialog-head"><h2 id="guide-title">玩法提示</h2><form method="dialog"><button class="quiet">收起 <kbd>Esc</kbd></button></form></div>
    <p id="current-guide" aria-live="polite"></p>
    <details class="port-story"><summary>旧港的来历</summary><p id="guide-story">${openingStory}</p></details>
    <dl class="guide-list">
      <div><dt>看货与出价</dt><dd>点击「近看」读成色和细节。收购价付给客人，成交的货会进自有库存。报价被拒还可以改报一次，或直接谢客。</dd></div>
      <div><dt>典当与赎回</dt><dd>放款是借给客人的钱。物品先留在代管栏，到期当天仍可赎回。打烊时才处理逾期的货。</dd></div>
      <div><dt>真假与买断</dt><dd>把实物批次与手册对照。能指出疑点时，可以试着把典当谈成低价买断。向买家隐瞒真伪可能影响下一位熟客的报价。</dd></div>
      <div><dt>查账、找线索</dt><dd>按 J 翻线索记录，查看熟客求购和已经看过的证据。「账本」里可以看库存、当票、流水和用水。按 Esc 回到柜台。</dd></div>
      <div><dt>处理手上的货</dt><dd>点击柜台下方的自有货物，可查看买家报价，或直接回收、寄售。代管货要等逾期归店才能处置。</dd></div>
    </dl>
  </dialog>
  <dialog id="notes-dialog" aria-labelledby="notes-title">
    <div class="dialog-head"><h2 id="notes-title">线索记录</h2><form method="dialog"><button class="quiet">收起 <kbd>Esc</kbd></button></form></div>
    <div id="requests"></div>
    <button id="notes-jobs" class="quiet" hidden>按字条联系</button>
  </dialog>
  <dialog id="jobs-dialog" aria-labelledby="jobs-title">
    <div class="dialog-head"><h2 id="jobs-title">字条与委托</h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <div id="jobs-content"></div>
    <p id="jobs-result" role="status"></p>
  </dialog>
  <dialog id="ledger-dialog" aria-labelledby="ledger-title">
    <div class="dialog-head"><h2 id="ledger-title">账本</h2><form method="dialog"><button class="quiet">收起 <kbd>Esc</kbd></button></form></div>
    <div class="ledger-grid">
        <section class="panel side-panel">
          <div class="side-heading"><h2>庇护所</h2></div>
          <div id="shelter"></div>
        </section>
        <section class="panel side-panel">
          <div class="side-heading"><h2>自有库存</h2><span id="count" class="tag"></span></div>
          <div id="inventory"></div>
          <div id="work-orders"></div>
        </section>
        <section class="panel side-panel">
          <div class="side-heading"><h2>当票与代管</h2></div>
          <div id="tickets"></div>
        </section>
        <section class="panel side-panel">
          <div class="side-heading"><h2>现金流水</h2></div>
          <div id="ledger"></div>
        </section>
    </div>
  </dialog>
  <dialog id="ship-store" aria-labelledby="ship-store-title">
    <div class="dialog-head"><h2 id="ship-store-title">船务与岸市</h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <div id="ship-offers"></div><p id="ship-result" role="status"></p>
  </dialog>
  <dialog id="menu-dialog" aria-labelledby="menu-title">
    <div class="dialog-head"><h2 id="menu-title">菜单</h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <button id="restart" class="quiet">重新开始</button>
    <button id="board-ship" class="quiet" hidden>带账本登上旧港号</button>
    <button id="return-title" class="quiet">返回主菜单</button>
  </dialog>
  <dialog id="water-shortfall" aria-labelledby="water-shortfall-title">
    <div class="dialog-head"><h2 id="water-shortfall-title">今晚的饮水还没备齐</h2></div>
    <p id="water-shortfall-detail"></p>
    <p>可以回柜台，从账本里安装自有 F2 或回收物品筹钱。</p>
    <form method="dialog" class="actions"><button class="quiet" autofocus>回柜台</button>
      <button id="confirm-water-shortfall" value="confirm">确认结束经营</button></form>
  </dialog>
`;

const day = document.querySelector<HTMLElement>('#day')!;
const cash = document.querySelector<HTMLOutputElement>('#cash')!;
const shipDialog = document.querySelector<HTMLDialogElement>('#ship-store')!;
const shipEntry = document.querySelector<HTMLButtonElement>('#ship-store-button')!;
const boardEntry = document.querySelector<HTMLButtonElement>('#board-ship')!;
shipEntry.onclick = () => { document.querySelector('#ship-result')!.textContent = ''; shipDialog.showModal(); };
boardEntry.onclick = () => {
  if (window.confirm('带现有现金和库存登船？领三日饮水，今晚起每天付 6 元船籍费并喝一日水。')) {
    menuDialog.close();
    void handle({ type: 'boardShip', day: state.day });
  }
};
const rackEntry = document.querySelector<HTMLButtonElement>('#show-filter-rack')!;
const rackDialog = document.querySelector<HTMLDialogElement>('#filter-rack')!;
const rackStatus = document.querySelector<HTMLElement>('#filter-rack-status')!;
const rackActions = document.querySelector<HTMLElement>('#filter-rack-actions')!;
const rackResult = document.querySelector<HTMLElement>('#filter-rack-result')!;
rackEntry.addEventListener('click', () => { rackResult.textContent = ''; rackDialog.showModal(); });
const count = document.querySelector<HTMLElement>('#count')!;
const shelter = document.querySelector<HTMLElement>('#shelter')!;
const requests = document.querySelector<HTMLElement>('#requests')!;
const inventory = document.querySelector<HTMLElement>('#inventory')!;
const tickets = document.querySelector<HTMLElement>('#tickets')!;
const ledger = document.querySelector<HTMLElement>('#ledger')!;
const scene = document.querySelector<HTMLElement>('#scene')!;
const actions = document.querySelector<HTMLElement>('#actions')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const restart = document.querySelector<HTMLButtonElement>('#restart')!;
const notesDialog = document.querySelector<HTMLDialogElement>('#notes-dialog')!;
const jobsEntry = document.querySelector<HTMLButtonElement>('#show-jobs')!;
const notesJobs = document.querySelector<HTMLButtonElement>('#notes-jobs')!;
const jobsDialog = document.querySelector<HTMLDialogElement>('#jobs-dialog')!;
const jobsContent = document.querySelector<HTMLElement>('#jobs-content')!;
const jobsResult = document.querySelector<HTMLElement>('#jobs-result')!;
const noteSlip = document.querySelector<HTMLButtonElement>('#note-slip')!;
const noteCount = document.querySelector<HTMLElement>('#note-count')!;
const desk = document.querySelector<HTMLElement>('#counter-desk')!;
const deskItems = document.querySelector<HTMLElement>('#desk-items')!;
const deskHeld = document.querySelector<HTMLElement>('#desk-held')!;
const stockDialog = document.querySelector<HTMLDialogElement>('#stock-dialog')!;
const stockTitle = document.querySelector<HTMLElement>('#stock-title')!;
const stockDetail = document.querySelector<HTMLElement>('#stock-detail')!;
const stockResult = document.querySelector<HTMLElement>('#stock-result')!;
let selectedStockId: string | undefined;
let showCutLayout = false;
const guideDialog = document.querySelector<HTMLDialogElement>('#guide-dialog')!;
const currentGuide = document.querySelector<HTMLElement>('#current-guide')!;
const ledgerDialog = document.querySelector<HTMLDialogElement>('#ledger-dialog')!;
const menuDialog = document.querySelector<HTMLDialogElement>('#menu-dialog')!;
const titleDialog = document.querySelector<HTMLDialogElement>('#title-dialog')!;
const titleSave = document.querySelector<HTMLElement>('#title-save')!;
const titleContinue = document.querySelector<HTMLButtonElement>('#title-continue')!;
const titleNew = document.querySelector<HTMLButtonElement>('#title-new')!;
const harborEntry = document.querySelector<HTMLButtonElement>('#show-harbor')!;
const harborDialog = document.querySelector<HTMLDialogElement>('#harbor-dialog')!;
const harborCash = document.querySelector<HTMLElement>('#harbor-cash')!;
const harborList = document.querySelector<HTMLElement>('#harbor-stock')!;
const harborResult = document.querySelector<HTMLElement>('#harbor-result')!;
const consignmentEntry = document.querySelector<HTMLButtonElement>('#show-consignment')!;
const consignmentDialog = document.querySelector<HTMLDialogElement>('#consignment-dialog')!;
const consignmentSchedule = document.querySelector<HTMLElement>('#consignment-schedule')!;
const consignmentStock = document.querySelector<HTMLElement>('#consignment-stock')!;
const consignmentResult = document.querySelector<HTMLElement>('#consignment-result')!;
const waterDialog = document.querySelector<HTMLDialogElement>('#water-shortfall')!;
const waterDetail = document.querySelector<HTMLElement>('#water-shortfall-detail')!;
const inspectCounter = document.querySelector<HTMLButtonElement>('#inspect-counter')!;
const inspectThumb = document.querySelector<HTMLImageElement>('#inspect-thumb')!;
const inspectLabel = document.querySelector<HTMLElement>('#inspect-label')!;
const inspectionEntry = document.querySelector<HTMLDivElement>('#inspection-entry')!;
const inspectDialog = document.querySelector<HTMLDialogElement>('#inspect-dialog')!;
const inspectTitle = document.querySelector<HTMLElement>('#inspect-title')!;
const inspectContent = document.querySelector<HTMLElement>('#inspect-content')!;
const rationDialog = document.querySelector<HTMLDialogElement>('#ration-dialog')!;
const dockFlag = document.querySelector<HTMLElement>('#dock-flag')!;
const openingRation = document.querySelector<HTMLElement>('#opening-ration')!;
const tutorialTip = document.querySelector<HTMLElement>('#tutorial-tip')!;
const tutorialCopy = document.querySelector<HTMLElement>('#tutorial-copy')!;
let tutorialTarget: HTMLElement | null = null;
const guestArt = document.querySelector<HTMLImageElement>('#guest-art')!;
const itemArt = document.querySelector<HTMLImageElement>('#item-art')!;
const cashChange = document.querySelector<HTMLElement>('#cash-change')!;

const escapeText = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const records = (rows: string[], empty: string) => rows.length
  ? `<ul class="records">${rows.join('')}</ul>`
  : `<p class="empty">${empty}</p>`;

const spriteKeys = new WeakMap<HTMLImageElement, string>();

function setSprite(image: HTMLImageElement, asset?: string, visitId?: string) {
  image.hidden = !asset;
  if (!asset) { spriteKeys.delete(image); return; }
  const key = `${visitId ?? ''}:${asset}`;
  if (spriteKeys.get(image) === key) return;
  spriteKeys.set(image, key);
  if (image.getAttribute('src') !== artwork(asset)) image.src = artwork(asset);
  image.getAnimations().forEach((animation) => animation.cancel());
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    image.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: image === guestArt ? 480 : 320, delay: image === itemArt ? 120 : 0, fill: 'backwards', easing: 'ease-out',
    });
  }
}

function itemSprite(item?: Item) {
  const illustrated = ['old-lantern-1', 'watch-1', 'purifier-1', 'timer-1', 'board-1', 'winch-1'];
  const id = item && baseItemId(item.id);
  return id && illustrated.includes(id) ? `item-${id}` : undefined;
}

function waterLine() {
  if (state.ship) return `今晚船籍费 ${berthFee} 元 · 存水 ${state.ship.water} 天`;
  if (state.economy === 'port') return '居民饮水由水站配给。';
  const water = nightlyWater(state);
  return `今晚用水 · ${water.source} · 实付 ${water.cost} 元`;
}

function appraisalView(item: Item) {
  const observations = item.observations.map((line) => `<li>${escapeText(line)}</li>`).join('');
  return `<section class="appraisal" aria-label="鉴定线索">
      <h3>鉴定线索</h3>
      <dl>
        <div><dt>实物观察</dt><dd><ul><li>${escapeText(item.condition)}。</li>${observations}</ul></dd></div>
        ${item.reference ? `<div><dt>手册对照</dt><dd>${escapeText(item.reference)}</dd></div>` : ''}
      </dl>
    </section>`;
}

function bindAction(button: HTMLButtonElement, action: Action) {
  button.addEventListener('click', (event) => {
    if (event.detail <= 1) void handle(action);
  });
}

function addAction(label: string, action: Action, quiet = false, disabled = false, detail?: string) {
  const button = document.createElement('button');
  button.textContent = label;
  button.classList.toggle('quiet', quiet);
  button.disabled = disabled;
  if (detail) {
    const description = document.createElement('small');
    description.textContent = detail;
    button.append(description);
  }
  bindAction(button, action);
  actions.append(button);
}

function renderVisit(visit: Visit) {
  const tags = { purchase: '卖断', pawn: '典当', sale: '收购', redeem: '赎回', timerBuyer: '收购', waterReserve: '预订用水' };
  const ticket = visit.kind === 'redeem' ? heldTicket(state, visit) : undefined;
  const offer = visit.kind === 'sale' ? saleOffer(state, visit) : undefined;
  const timer = visit.kind === 'timerBuyer' ? ownedImitation(state, visit.item) : undefined;
  const item = visit.kind === 'redeem' ? ticket?.item : visit.kind === 'sale' ? offer?.item :
    visit.kind === 'timerBuyer' ? timer : visit.kind === 'waterReserve' ? undefined : visit.item;
  const sprite = itemSprite(item);
  setSprite(itemArt, atTitle ? undefined : sprite, visit.id);
  setSprite(inspectThumb, atTitle ? undefined : sprite, visit.id);
  inspectionEntry.hidden = !item;
  if (item) {
    inspectLabel.textContent = `近看${item.name}`;
    inspectTitle.textContent = item.name;
    const inspected = visit.id === 'day-8-winch' ? state.economy === 'port'
      ? { ...portItem(item), condition: wornWinch.condition, observations: [...item.observations, wornWinch.observations[0]] }
      : wornWinch : item;
    inspectContent.innerHTML = `${sprite ? `<img class="inspect-art" src="${artwork(sprite)}" alt="">` : ''}${appraisalView(inspected)}`;
  }
  const appraised = visit.id === 'day-3-timer' && state.timerAppraised;
  const disputed = visit.kind === 'sale' && visit.matchModel && state.misrepresentedTimer;
  const dialogue = offer?.item?.condition === wornWinch.condition
    ? `齿轮磨损的这台我也收，只能出 ${offer.price} 元。`
    : disputed && offer
    ? `船工跟我说你卖的 T8 批次有问题。要是 F2 在，我最多出 ${offer.price} 元。`
    : appraised ? `你看出来了？我缺现钱，按仿品买断的话，${imitationPurchasePrice} 元也行。` : visit.dialogue;
  let terms = '';
  if (visit.kind === 'pawn') terms = `赎回额 ${visit.redeemPrice} 元 · 第 ${visit.dueDay} 天打烊前可赎`;
  const canSellBoard = visit.id === 'day-9-winch' && state.inventory.some((entry) => entry.id === board.id);
  if (offer && !offer.item) terms = canSellBoard ? `手上的电路板仍可卖 ${lateBoardPrice} 元。` : offer.issue;
  if (visit.kind === 'redeem') terms = ticket ? `第 ${ticket.dueDay} 天到期 · 收款 ${ticket.redeemPrice} 元` : visit.missing;
  if (visit.kind === 'timerBuyer') terms = timer ? '柜台有一枚已归店的仿制 T8。' : '船工没找到店里能卖的计时器。';
  if (visit.kind === 'waterReserve') terms = `现在付 ${waterReservePrice} 元，抵第 ${visit.supplyDay} 天一日用水。` +
    (state.installedPurifier ? '你已有 F2 供水，订票仍会扣款。' : '到时若装好 F2，水票费用也已经付出。');
  scene.innerHTML = `<div class="visitor"><div class="visitor-heading">
      <h2>${visit.person}</h2><span class="tag">${tags[visit.kind]}</span>
    </div><blockquote>“${dialogue}”</blockquote>
    ${terms ? `<p class="terms">${terms}</p>` : ''}</div>
    ${item?.reference ? appraisalView(item) : ''}`;

  const visitId = visit.id;
  if (visit.kind === 'purchase' || visit.kind === 'pawn') {
    for (const amount of visit.offers) {
      const afterTonight = state.cash - amount - waterCost(state);
      const afterTomorrow = afterTonight - nightlyWater(state, state.day + 1).cost;
      const formatCash = (cash: number) => cash < 0 ? `差 ${-cash} 元` : `剩 ${cash} 元`;
      const projection = visit.id === 'day-8-winch' && state.cash >= amount
        ? state.economy === 'port' ? `成交后${formatCash(state.cash - amount)}`
          : `成交并付今晚水费后${formatCash(afterTonight)} · 明晚水费 ${nightlyWater(state, state.day + 1).cost} 元，若无进账则${formatCash(afterTomorrow)}`
        : undefined;
      const winchOption = visitId === 'day-8-winch';
      const worn = amount === wornWinchPrice;
      const label = winchOption ? (worn ? '按现状收' : '报价') : visit.kind === 'purchase' ? '报价' : '放款';
      const resale = worn ? `待修 · 船工出 ${wornWinchEarlyPrice}，修理匠出 ${wornWinchLatePrice}` : '换好齿轮 · 船工出 108，修理匠出 155';
      const detail = winchOption ? `${resale}。 ${projection ?? `现金还差 ${amount - state.cash} 元`}` : undefined;
      addAction(`${label} ${amount} 元`,
        { type: 'offer', visitId, attempt: state.attempts, amount }, visit.kind === 'purchase', state.attempts >= maxOffers, detail);
    }
  }
  if (visit.id === 'day-3-timer') {
    if (appraised) addAction(`${imitationPurchasePrice} 元买断仿品`, { type: 'buyImitation', visitId });
    else addAction('指出批次不符', { type: 'appraiseTimer', visitId }, true);
  }
  if (visit.kind === 'timerBuyer' && timer) {
    addAction(`如实卖 ${honestTimerPrice} 元`, { type: 'sellTimerHonestly', visitId });
    addAction(`当正品卖 ${falseTimerPrice} 元`, { type: 'sellTimerAsGenuine', visitId }, true, false, '可能影响熟客报价');
  }
  if (visit.kind === 'waterReserve') addAction(`${waterReservePrice} 元预订用水`, { type: 'reserveWater', visitId });
  if (canSellBoard) addAction(`出售旧电路板 ${lateBoardPrice} 元`, { type: 'sellBoard', visitId });
  if (visit.kind === 'sale' && item && offer) {
    const winchMargin = visitId === 'day-9-winch' && offer.item
      ? `现在回款 · 单件亏 ${offer.item.cost - offer.price} 元`
      : undefined;
    addAction(`出售${item.name} ${offer.price} 元`, { type: 'sell', visitId }, Boolean(visit.matchModel), false,
      visit.matchModel && state.economy !== 'port' ? `${waterLine()} · 次日起常价 ${waterPrice} 元` : winchMargin);
    if (visit.matchModel && !state.installedPurifier && state.economy !== 'port') {
      addAction('安装自用', { type: 'install', day: state.day, itemId: item.id }, true, false,
        `今晚用 F2 净化的雨水，实付 0 元 · 往后每个常价日省 ${waterPrice} 元`);
    }
  }
  if (visit.kind === 'redeem' && ticket) addAction(`收款 ${ticket.redeemPrice} 元并归还${ticket.item.name}`, { type: 'redeem', visitId });
  const keepBoard = visitId === 'day-7-board' && Boolean(item);
  const keepWinch = visitId === 'day-9-winch' && Boolean(item);
  const dismissLabel = visit.kind === 'sale' && visit.matchModel && item ? '留货，谢客' : keepBoard ? '留板等船工' : '谢客';
  addAction(dismissLabel, { type: 'dismiss', visitId }, true, false,
    keepBoard ? `第 9 天可卖 ${lateBoardPrice} 元，今天无进账`
      : keepWinch ? `等第 ${winchOrderDay(state.economy, state.harborSchedule)} 天船厂采购，可卖 ${item?.condition === wornWinch.condition ? wornWinchLatePrice : 155} 元`
      : dismissLabel === '留货，谢客' && state.economy !== 'port' ? `${waterLine()} · 次日起常价 ${waterPrice} 元` : undefined);
}

function renderInventory() {
  const items = saveBlocked ? [] : state.inventory;
  const orders = saveBlocked ? [] : state.workshopOrders ?? [];
  const jadeOrders = saveBlocked ? [] : state.jadeOrders ?? [];
  const away = [
    ...orders.map(({ item, dueDay, kind }) =>
      `<li><span>${escapeText(item.name)} · ${kind === 'repair' ? '送修中' : '出租中'}</span><span>第 ${dueDay} 天开门归还</span></li>`),
    ...jadeOrders.map(({ item, dueDay, kind, payout }) =>
      `<li><span>${escapeText(item.name)} · ${cutOrders[kind].name}</span><span>第 ${dueDay} 天开门收 ${payout} 元</span></li>`),
  ];
  document.querySelector('#work-orders')!.innerHTML = away.length
    ? `<h3>离店货物</h3>${records(away, '')}`
    : '';
  inventory.innerHTML = records(items.map((item) => {
    const authenticity = item.authenticity === 'imitation' ? ' · 仿品' : item.authenticity === 'genuine' ? ' · 正品' : '';
    const detail = item.id === 'winch-1' ? `<small>${winchBulletin(state)}</small>`
      : item.id === board.id && state.day <= 9 ? `<small>第 7 天卖 55 元，第 9 天船工出 ${lateBoardPrice} 元。</small>`
      : usablePurifier(item) ? '<small>生活舱用 · 可接旧集雨箱</small>' : '';
    return `<li><span>${escapeText(item.name)}<small>${escapeText(item.condition)}${authenticity}</small>${detail}</span>
      <span>成本 ${item.cost} 元</span></li>`;
  }), '库存为空');
  if (state.day < waterStartDay || pastLastDay(state) || state.awaitingOpen || saveBlocked) return;

  inventory.querySelectorAll('li').forEach((row, index) => {
    const item = items[index];
    const buttons = document.createElement('div');
    buttons.className = 'actions stock-actions';
    const add = (label: string, type: 'install' | 'recycle') => {
      const button = document.createElement('button');
      const action = { type, day: state.day, itemId: item.id };
      button.textContent = label;
      button.className = 'quiet';
      bindAction(button, action);
      buttons.append(button);
    };
    if (state.economy !== 'port' && !state.installedPurifier && usablePurifier(item)) add('安装 F2 净水机', 'install');
    if (item.recyclePrice !== undefined) add(`回收${item.name} ${item.recyclePrice} 元`, 'recycle');
    row.append(buttons);
  });
}

function renderHarbor() {
  const available = !saveBlocked && harborOpen(state);
  harborEntry.hidden = !available;
  if (!available) { if (harborDialog.open) harborDialog.close(); return; }
  harborCash.textContent = `第 ${state.day} 天 · 手头 ${state.cash} 元${state.economy === 'port' ? '' : ` · 今晚水费 ${waterCost(state)} 元`}`;
  harborList.replaceChildren();
  for (const { item, held, bought, asks, bids } of harborStock(state)) {
    const row = document.createElement('section');
    row.className = 'harbor-good';
    const currentAsk = asks[state.day];
    const currentBid = bids[state.day];
    const future = Object.entries(bids).filter(([day]) => Number(day) > state.day)
      .map(([day, price]) => `第 ${day} 天 ${price} 元`).join(' · ');
    row.innerHTML = `<h3>${item.name}</h3><p>${held ? `在库 · 成本 ${held.cost} 元` : bought ? '已处理' : currentAsk === undefined ? '今天无货' : '今天有货'}</p>
      ${state.economy === 'port' ? `<p>${escapeText(item.observations.join(''))}</p>` : ''}
      <p>今天收购 ${currentBid === undefined ? '暂停' : `${currentBid} 元`}${future ? ` · 之后 ${future}` : ''}</p>`;
    const add = (type: 'harborBuy' | 'harborSell', label: string) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.dataset.goods = item.id;
      button.dataset.trade = type;
      bindAction(button, { type, day: state.day, itemId: item.id });
      row.append(button);
    };
    if (!bought && !held && currentAsk !== undefined) add('harborBuy', `购入${item.name} ${currentAsk} 元`);
    if (held && currentBid !== undefined) add('harborSell', `卖出${item.name} ${currentBid} 元`);
    harborList.append(row);
  }
}

function renderConsignment() {
  const available = !saveBlocked && consignmentOpen(state);
  consignmentEntry.hidden = !available;
  consignmentEntry.textContent = state.consignment ? '寄售架 · 1 件' : '寄售架';
  if (!available) {
    if (consignmentDialog.open) consignmentDialog.close();
    return;
  }
  consignmentSchedule.textContent = `第 ${state.day + 1} 天开门结算${state.economy === 'port' ? '' : ` · 今晚水费 ${waterCost(state)} 元`}`;
  consignmentStock.replaceChildren();
  const listing = state.consignment;
  const items = listing ? state.inventory.filter((item) => item.id === listing.itemId) : state.inventory;
  for (const item of items) {
    const prices = consignmentPrices(item);
    if (!prices) continue;
    const row = document.createElement('section');
    row.className = 'harbor-good';
    const authenticity = item.authenticity === 'imitation' ? ' · 标明仿品' : '';
    row.innerHTML = `<h3>${escapeText(item.name)}</h3><p>${escapeText(item.condition)}${authenticity} · 成本 ${item.cost} 元</p>`;
    const buttons = document.createElement('div');
    buttons.className = 'actions';
    const add = (text: string, action: Action) => {
      const button = document.createElement('button');
      button.textContent = text;
      bindAction(button, action);
      buttons.append(button);
    };
    if (listing) {
      row.insertAdjacentHTML('beforeend', `<p>挂牌 ${listing.price} 元 · 等待买家</p>`);
      add('撤下寄售', { type: 'unlistItem', day: state.day, itemId: item.id });
    } else {
      prices.forEach((price, index) => {
        const labels = ['稳卖', '试价', '等高价'];
        add(`${labels[index]} ${price} 元`, { type: 'listItem', day: state.day, itemId: item.id, price });
      });
    }
    row.append(buttons);
    consignmentStock.append(row);
  }
  if (!consignmentStock.childElementCount) consignmentStock.textContent = '目前没有可寄售的自有货物。';
}

function renderJobs() {
  const referral = roundReferral(state);
  const available = !saveBlocked && (referral || (portJobs(state) && (state.knowsMechanicRequest || state.day >= 7)));
  jobsEntry.hidden = notesJobs.hidden = !available;
  if (!available) {
    if (jobsDialog.open) jobsDialog.close();
    return;
  }
  const appointment = state.f2Appointment;
  const due = appointment?.status === 'booked' && appointment.day === state.day;
  const rope = ropeVisit(state);
  jobsEntry.textContent = due || rope?.today ? '字条与委托 · 今日验货' : '字条与委托';
  jobsContent.replaceChildren();
  const addJob = (title: string, description: string, choices: [string, Action][]) => {
    const section = document.createElement('section');
    section.className = 'harbor-good';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = description;
    const buttons = document.createElement('div');
    buttons.className = 'actions';
    for (const [label, action] of choices) {
      const button = document.createElement('button');
      button.textContent = label;
      bindAction(button, action);
      buttons.append(button);
    }
    section.append(heading, body, buttons);
    jobsContent.append(section);
  };
  const day = state.day;
  if (rope) {
    addJob('搬运班的短绳委托', rope.terms + rope.status,
      rope.canBook ? [['联系搬运班', { type: 'bookRopeVisit', day }]] : []);
  }
  const repairs = repairMarket(state);
  if (repairs) {
    const buttons: [string, Action][] = [];
    if (repairs.canBuy) buttons.push([`收待修绞盘 ${wornWinchPrice} 元`, { type: 'buyRepairStock', day }]);
    if (repairs.canSell && repairs.owned) {
      buttons.push([`交付绞盘 ${repairs.price} 元`, { type: 'sellRepairStock', day }]);
    }
    const start = roundStart(day);
    const sales = state.ledger.some((entry) => entry.day >= start && entry.description === '工班收购 · 码头绞盘');
    const detail = sales ? '本轮工班已收了一台。' : `货棚收进价 ${wornWinchPrice} 元。第 ${start + 3}–${start + 4} 天工班收一台，验收完好件 155 元，待修件 115 元。`;
    addJob('货棚绞盘工单', detail, buttons);
  }
  const salvage = salvageMarket(state);
  if (salvage) {
    const choices: [string, Action][] = [];
    const { first, last } = salvage.window;
    const terms = `第 ${first}–${last} 天货棚收购。原封卖 ${sealedCratePrice} 元，赚 ${sealedCratePrice - crateCost} 元。拆开分卖，三件合计 42–72 元。`;
    const status = salvage.bought ? '本轮这箱已收过。'
      : salvage.canSell ? '拆船队已收摊。'
      : `第 ${first - 1} 天打烊前可用 ${crateCost} 元收箱。${state.cash < crateCost ? `还差 ${crateCost - state.cash} 元。` : `收箱后手头剩 ${state.cash - crateCost} 元。`}`;
    if (salvage.canBuy && state.cash >= crateCost) choices.push([`收混装货箱 ${crateCost} 元`, { type: 'buyCrate', day }]);
    const details = salvage.canBuy ? [...salvage.stock.observations, status, terms] : [status, terms];
    addJob('旧货回港 · 混装货箱', details.join('\n'), choices);
    if (salvage.canSell) {
      for (const { item, price } of salvage.buyers) {
        addJob(item.name, `${item.condition} · 成本 ${item.cost} 元`,
          [[`货棚交付 ${price} 元`, { type: 'sellCrateGoods', day, itemId: item.id }]]);
      }
    }
  }
  if (referral) {
    const status = referral.paid ? '已领取 8 元介绍费。' : referral.available ? '双方直接结工钱，当铺收 8 元介绍费。' : '办事的人本轮第三天到港。';
    addJob('港口介绍', referral.text + status, referral.available && !referral.paid
      ? [['牵线介绍', { type: 'roundReferral', day }]] : []);
    return;
  }
  if (state.knowsMechanicRequest) {
    const terms = `修理匠补收可试机的原厂 F2，接口须符合旧集雨箱，出 ${contactPrice(state)} 元。`;
    const detail = appointment?.status === 'booked' ? `第 ${appointment.day} 天验货。`
      : appointment ? '本轮约见已结束。' : day === lastDay ? '本轮预约已截止。' : '可约次日验货，付款时才交出库存。';
    const choices: [string, Action][] = [];
    if (due) choices.push(['交验自有 F2', { type: 'deliverF2', day }], ['告知不交货', { type: 'declineF2', day }]);
    else if (!appointment && day < lastDay) choices.push(['预约明日验货', { type: 'bookF2', day }]);
    addJob('修理匠的 F2 补单', terms + detail, choices);
  }
  if (day >= 7) {
    const referral = state.fuseReferral;
    let detail = '第 9 天打烊前找一位持有原封 15A 保险丝的货主。货主和买家直接交易，介绍费 12 元。';
    const choices: [string, Action][] = [];
    if (referral === 'paid') detail = '工单已结清，介绍费 12 元已入账。';
    else if (day > 9) detail = '检修班已离港，工单过期。';
    else if (referral === 'accepted') {
      detail += ' 船工带来一盒拆封的 10A，电工的货签上写着原封 15A。';
      choices.push(['介绍船工', { type: 'referSupplier', day, supplier: 'boat' }],
        ['介绍电工', { type: 'referSupplier', day, supplier: 'workshop' }]);
    } else choices.push(['接下代寻', { type: 'acceptReferral', day }]);
    addJob('岸电检修班的代寻委托', detail, choices);
  }
}

function stockOutlook(item: Counter['inventory'][number]) {
  const entries: string[] = [];
  const kind = cargoKind(item.id);
  const shipQuote = state.ship && shipSaleQuote(state.day, item);
  if (shipQuote) {
    entries.push(`本站收 ${shipQuote.bid} 元 · 下站收 ${shipQuote.nextBid} 元`);
    if (kind !== undefined) entries.push(...item.observations);
    const difference = shipQuote.nextBid - shipQuote.bid;
    if (difference > 0) entries.push(`留到下站多收 ${difference} 元，期间要先备好船费和饮水。`);
  }
  if (kind === floatFarmOrder.kind && state.day <= floatFarmOrder.last) {
    const farm = floatFarmRequest(state);
    if (farm) entries.push(farm.terms + farm.status);
  }
  if (item.jade?.opened) entries.push(`石铺收明料 ${jadeGrades[item.jade.grade].price} 元 · 营业时可交付`);
  if (item.filter) entries.push(`设备货商收 ${filterOffer(item.filter)} 元 · 营业时可交付`);
  if (state.economy === 'port' && state.day > lastDay && (sealedCrateId.test(item.id) || cratePartId.test(item.id))) {
    const { first, last } = salvageWindow(state.day, state.harborSchedule);
    const price = sealedCrateId.test(item.id) ? sealedCratePrice : cratePartPrice(item);
    entries.push(`第 ${first}–${last} 天货棚收 ${price} 元${state.day >= first && !state.awaitingOpen ? ' · 今天可交付' : ''}`);
    const appointment = isShortRope(item) ? ropeVisit(state) : undefined;
    if (appointment) entries.push(appointment.terms + appointment.status);
  }
  if (item.id === board.id && state.day <= 9 && (state.day < 9 || state.visitIndex === 0)) {
    entries.push(`第 9 天船工收 ${lateBoardPrice} 元`);
  }
  if (state.day > lastDay || item.id === board.id || item.id === 'winch-1' || usablePurifier(item)) {
    const horizon = state.day > lastDay ? roundEnd(state.day) : lastDay;
    for (let date = state.day; date <= horizon; date++) {
      if (usablePurifier(item) && date !== 5) continue;
      const firstVisit = date === state.day ? state.visitIndex : 0;
      for (let index = firstVisit; index < scheduledVisits(date, state.economy, state.harborSchedule); index++) {
        const visit = currentVisit(date, index, state.economy, state.harborSchedule);
        if (visit?.kind !== 'sale') continue;
        const offer = saleOffer(state, visit);
        if (offer.item?.id === item.id) entries.push(`第 ${date} 天${visit.person}收 ${offer.price} 元`);
      }
    }
  }
  const market = harborStock(state).find((good) => good.item.id === item.id);
  if (market) {
    const bids = Object.entries(market.bids).filter(([date]) => Number(date) >= state.day)
      .map(([date, price]) => `第 ${date} 天 ${price} 元`);
    if (bids.length) entries.push(`港口收购 · ${bids.join('、')}`);
  }
  return entries;
}

function renderCutLayout(jade: Jade, target: { day: number; itemId: string }) {
  const section = document.createElement('section');
  section.className = 'jade-workbench';
  let kind: CutKind = 'pendants';
  let placements: CutPlacement[] = [];
  let history: CutPlacement[][] = [];
  let vertical = false;
  let selected = -1;
  let hint = '';
  const apply = (next: CutPlacement[]) => {
    history.push(placements);
    placements = next;
  };

  const draw = (focusCell?: number) => {
    section.replaceChildren();
    const makeButton = (label: string, onClick: () => void) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.className = 'quiet';
      button.addEventListener('click', onClick);
      return button;
    };
    const menu = document.createElement('div');
    menu.className = 'actions';
    for (const option of ['pendants', 'seal'] as const) {
      const button = makeButton(cutOrders[option].name, () => {
        if (kind === option) return;
        kind = option;
        placements = [];
        history = [];
        selected = -1;
        hint = '';
        draw();
      });
      button.setAttribute('aria-pressed', String(kind === option));
      menu.append(button);
    }
    const help = document.createElement('p');
    help.textContent = jade.face === 'edge' ? '最后一行有裂，前三行可用。' : '第二列有贯穿裂，摆不下整面印章。';
    const grid = document.createElement('div');
    grid.className = 'jade-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '原石料面');
    for (let cell = 0; cell < 16; cell++) {
      const owner = placements.findIndex((placement) => cutCells(kind, placement).includes(cell));
      const valid = usableCell(jade.face, cell);
      const square = makeButton(valid ? owner < 0 ? '·' : String(owner + 1) : '裂', () => {
        if (owner !== -1 && selected === -1) {
          selected = owner;
          hint = '已选中，点目标格移动。';
        } else if (owner !== -1 && owner === selected && placements[owner].anchor === cell) {
          selected = -1;
          hint = '';
        } else {
          const placement = { anchor: cell, vertical: selected < 0 ? vertical : placements[selected].vertical };
          const next = [...placements];
          if (selected < 0) next.push(placement);
          else next[selected] = placement;
          if (cutQuote(jade, kind, next)) {
            apply(next);
            selected = -1;
            hint = '';
          } else hint = '这里摆不下。检查裂格、边缘和已放入的样式。';
        }
        draw(cell);
      });
      square.disabled = !valid;
      square.dataset.cell = String(cell);
      square.dataset.tile = !valid ? 'crack' : owner < 0 ? 'free' : owner === selected ? 'selected' : 'occupied';
      square.setAttribute('aria-label', `第 ${Math.floor(cell / 4) + 1} 行第 ${cell % 4 + 1} 列${!valid ? ' · 裂格' : owner < 0 ? '' : ` · 样式 ${owner + 1}`}`);
      grid.append(square);
    }
    const edit = document.createElement('div');
    edit.className = 'actions';
    const orientation = selected < 0 ? vertical : placements[selected].vertical;
    if (kind === 'pendants') edit.append(makeButton(`旋转 · ${orientation ? '竖放' : '横放'}`, () => {
      if (selected < 0) vertical = !vertical;
      else {
        const next = placements.map((placement, index) => index === selected ? { ...placement, vertical: !placement.vertical } : placement);
        if (cutQuote(jade, kind, next)) { apply(next); hint = ''; }
        else hint = '当前格子无法旋转，可先移动样式。';
      }
      draw();
    }));
    edit.append(makeButton('试排', () => {
      apply(trialCut(jade, kind));
      selected = -1;
      hint = placements.length ? '' : '这块料没有连续的 3×3 净面。';
      draw();
    }));
    const undo = makeButton(selected >= 0 ? '撤下选中' : '撤回上一步', () => {
      if (selected >= 0) apply(placements.filter((_, index) => index !== selected));
      else placements = history.pop() ?? placements;
      selected = -1;
      hint = '';
      draw();
    });
    undo.disabled = selected < 0 && !history.length;
    edit.append(undo);
    const quote = cutQuote(jade, kind, placements);
    const price = jadeGrades[jade.grade].price;
    const net = quote ? quote.payout - quote.fee : 0;
    const difference = net - price;
    const preview = document.createElement('p');
    preview.setAttribute('aria-live', 'polite');
    preview.textContent = quote
      ? `占用 ${quote.cells}/16 格 · 利用率 ${quote.cells * 6.25}% · 工钱 ${quote.fee} 元 · 次日到账 ${quote.payout} 元。净到手 ${net} 元，${difference === 0 ? '与直接卖持平' : `比直售${difference > 0 ? '多' : '少'} ${Math.abs(difference)} 元`}。`
      : `直售 ${price} 元 · ${cutOrders[kind].name}工钱 ${cutOrders[kind].fee} 元。摆入样式后可查看报价。`;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = hint || (quote && state.cash < quote.fee ? `工钱还差 ${quote.fee - state.cash} 元。` : '');
    const send = document.createElement('button');
    send.textContent = '确认送工坊';
    send.disabled = !quote || state.cash < quote.fee;
    bindAction(send, { ...target, type: 'sendJade', kind, placements });
    section.append(menu, help, grid, edit, preview, status, send);
    if (focusCell !== undefined) grid.querySelector<HTMLButtonElement>(`[data-cell="${focusCell}"]`)?.focus();
  };
  draw();
  return section;
}

function renderStockDetail() {
  if (!stockDialog.open) return;
  const item = saveBlocked ? undefined : state.inventory.find((entry) => entry.id === selectedStockId);
  if (!item) { stockDialog.close(); return; }
  stockTitle.textContent = item.name;
  const sprite = itemSprite(item);
  const condition = item.authenticity === 'imitation' ? ' · 仿品' : '';
  const outlook = stockOutlook(item);
  stockDetail.innerHTML = `${sprite ? `<img class="inspect-art" src="${artwork(sprite)}" alt="">` : ''}
    <p>${escapeText(item.condition)}${condition} · 成本 ${item.cost} 元</p>
    ${records(outlook.map((line) => `<li>${escapeText(line)}</li>`), item.jade && !item.jade.opened ? '开窗后可询价。' : '暂无线索显示有约定买家。')}`;
  if ((state.day < waterStartDay && !state.ship) || pastLastDay(state) || state.awaitingOpen || state.ship?.closed) return;
  const actions = document.createElement('div');
  actions.className = 'actions stock-actions';
  const add = (label: string, action: Action) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'quiet';
    bindAction(button, action);
    actions.append(button);
  };
  const target = { day: state.day, itemId: item.id };
  const cargo = cargoKind(item.id);
  if (state.ship && cargo !== undefined) add(`卖给岸市 ${cargoQuote(state.day, cargo).bid} 元`, { ...target, type: 'sellCargo' });
  if (cargo === floatFarmOrder.kind && floatFarmRequest(state)?.active) {
    add(`交浮田维修班 ${floatFarmOrder.price} 元`, { ...target, type: 'deliverFloatFarmSeal' });
  }
  const shore = state.ship && cargo === undefined && shipSaleQuote(state.day, item);
  if (shore) add(`卖给岸商 ${shore.bid} 元`, { ...target, type: 'sellCargo' });
  if (item.jade && workshopOpen(state)) {
    if (!item.jade.opened) add('开窗验料', { ...target, type: 'openJade' });
    else {
      add(`直接卖明料 ${jadeGrades[item.jade.grade].price} 元`, { ...target, type: 'sellJade' });
      if (!showCutLayout) {
        const layout = document.createElement('button');
        layout.textContent = '看料面并排样';
        layout.className = 'quiet';
        layout.addEventListener('click', () => { showCutLayout = true; renderStockDetail(); });
        actions.append(layout);
      }
    }
  }
  if (item.filter && workshopOpen(state)) {
    const terms = document.createElement('p');
    terms.textContent = `可制水 ${item.filter.remaining}/${filterGrades[item.filter.grade].uses} 次。船厂每日收一单，净付 ${waterJobPay} 元。`;
    stockDetail.append(terms);
    add(`卖给设备货商 ${filterOffer(item.filter)} 元`, { ...target, type: 'sellFilter' });
    add(state.mountedFilter ? '换上这枚滤芯' : '装到淡化机架', { ...target, type: 'mountFilter' });
  }
  if (sealedCrateId.test(item.id)) {
    const manifest = document.createElement('p');
    manifest.textContent = crateInspection(item.id, state.harborSchedule).join('') + '拆封后三件分别入库，不能再按原封价交付。';
    stockDetail.append(manifest);
    if (workshopOpen(state)) add('拆封并验货', { ...target, type: 'openCrate' });
  }
  if (sealedCrateId.test(item.id) || cratePartId.test(item.id)) {
    const market = salvageMarket(state);
    const offer = market?.buyers.find((entry) => entry.item.id === item.id);
    if (market?.canSell && offer) add(`货棚交付 ${offer.price} 元`, { ...target, type: 'sellCrateGoods' });
  }
  const workshop = workshopEligibility(state, item);
  if (workshop) {
    const repair = workshop === 'repair';
    const terms = document.createElement('p');
    terms.textContent = repair
      ? `修理匠更换齿轮并验制动器，现在付 ${repairFee} 元，第 ${state.day + 1} 天开门取回。`
      : `驻港施工队借用集雨设备，第 ${state.day + rentalDays} 天开门归还，届时收 ${rentalFee} 元租金。`;
    stockDetail.append(terms);
    add(repair ? `付 ${repairFee} 元送修` : `短租 F2 · 到期收 ${rentalFee} 元`, { ...target, type: repair ? 'sendRepair' : 'rentF2' });
  }
  if (state.economy !== 'port' && !state.installedPurifier && usablePurifier(item)) add('安装自用', { ...target, type: 'install' });
  if (state.day >= waterStartDay && item.recyclePrice !== undefined) add(`立即回收 ${item.recyclePrice} 元`, { ...target, type: 'recycle' });
  if (harborOpen(state)) {
    const marketPrice = harborStock(state).find((good) => good.item.id === item.id)?.bids[state.day];
    if (marketPrice !== undefined) add(`立即卖给货摊 ${marketPrice} 元`, { ...target, type: 'harborSell' });
  }
  if (consignmentOpen(state)) {
      const prices = consignmentPrices(item);
      const listed = state.consignment?.itemId === item.id;
      if (listed) {
        const pending = document.createElement('p');
        pending.textContent = `已挂牌 ${state.consignment?.price} 元 · 次日开门结算`;
        stockDetail.append(pending);
        add('撤下寄售', { ...target, type: 'unlistItem' });
      } else if (!state.consignment && prices) {
        const notice = document.createElement('p');
        notice.textContent = '寄售次日回款。稳卖价可成交，试价和高价取决于买家预算。';
        stockDetail.append(notice);
        const labels = ['寄售稳卖', '寄售试价', '寄售等高价'];
        prices.forEach((price, index) => add(`${labels[index]} ${price} 元`, { ...target, type: 'listItem', price }));
      }
  }
  if (actions.childElementCount) stockDetail.append(actions);
  if (item.jade?.opened && showCutLayout && workshopOpen(state)) stockDetail.append(renderCutLayout(item.jade, target));
}

function renderDesk() {
  desk.hidden = saveBlocked;
  if (saveBlocked) return;
  deskItems.replaceChildren();
  if (!state.inventory.length) deskItems.textContent = '暂时空着';
  for (const item of state.inventory) {
    const chip = document.createElement('button');
    chip.className = 'quiet stock-chip';
    chip.setAttribute('aria-haspopup', 'dialog');
    const sprite = itemSprite(item);
    if (sprite) {
      const img = document.createElement('img');
      img.src = artwork(sprite);
      img.alt = '';
      chip.append(img);
    }
    chip.append(item.name, state.consignment?.itemId === item.id ? ' · 寄售中' : '');
    chip.addEventListener('click', () => {
      selectedStockId = item.id;
      showCutLayout = false;
      stockResult.textContent = '';
      stockDialog.showModal();
      renderStockDetail();
    });
    deskItems.append(chip);
  }
  const held = state.tickets.filter((ticket) => ticket.status === 'held');
  const custody = held.length ? [`代管 ${held.length} 件 · 尚未归店`] : [];
  for (const order of state.workshopOrders ?? []) {
    custody.push(`${order.item.name}${order.kind === 'repair' ? '送修中' : '出租中'} · 第 ${order.dueDay} 天归还`);
  }
  for (const order of state.jadeOrders ?? []) {
    custody.push(`${cutOrders[order.kind].name}加工中 · 第 ${order.dueDay} 天收 ${order.payout} 元`);
  }
  if (state.mountedFilter?.filter) custody.push(`${state.mountedFilter.name}已安装 · 余 ${state.mountedFilter.filter.remaining} 次`);
  deskHeld.textContent = custody.join(' / ');
}

function endingView(chapterTwo: boolean) {
  const installed = state.installedPurifier !== null;
  const waterEntries = state.ledger.filter((entry) => entry.itemId === null && (entry.day >= secondChapterStart) === chapterTwo);
  const spent = -waterEntries.filter((entry) => entry.description === waterLedger.purchase || entry.description === waterLedger.reservation)
    .reduce((total, entry) => total + entry.change, 0);
  const title = state.waterShortfall ? '经营中断' : chapterTwo ? '第二章完成 · 迟到的淡水船' : '五日试玩完成';
  const summary = state.waterShortfall
    ? `当天无力买水，差 ${state.waterShortfall} 元。余额 ${state.cash} 元。`
    : `现金结余 ${state.cash} 元 · 自有库存 ${state.inventory.length} 件${state.economy === 'port' ? '' : ` · ${chapterTwo ? '本章' : '本局'}水费 ${spent} 元`}`;
  const savings = installed && !state.waterShortfall ? Math.max(0, waterPrice - spent) : 0;
  const waterSummary = chapterTwo
    ? `${state.waterShortfall ? '本章已付水费' : '五晚实际水支出'}（含买票） ${spent} 元 · F2 供水 ${waterEntries.filter((entry) => entry.description === waterLedger.purifier).length} 晚 · 水票抵扣 ${waterEntries.filter((entry) => entry.description === waterLedger.ticket).length} 晚`
    : `本局已省水费 ${savings} 元 · 今后每天可省 ${installed ? waterPrice : 0} 元`;
  const stock = chapterTwo ? `<p class="terms">自有库存 · ${state.inventory.map((item) => escapeText(item.name)).join('、') || '空'}</p>` : '';
  return `<div class="visitor"><h2>${title}</h2><p class="terms">${summary}</p>
    ${state.economy === 'port' ? '' : `<p class="terms">${waterSummary}</p>`}${stock}</div>`;
}

function renderNotes() {
  const notes = saveBlocked ? [] : counterNotes(state).reverse();
  const unread = notes.filter((note) => !state.readNoteIds?.includes(note.id));
  const latest = unread[0];
  noteCount.hidden = unread.length === 0;
  noteCount.textContent = `${unread.length} 条未读`;
  noteSlip.hidden = !latest;
  if (latest) {
    noteSlip.innerHTML = `<strong>未读 · ${escapeText(latest.title)}</strong><span>${escapeText(latest.text)}</span>`;
  }
  requests.innerHTML = records(notes.map((note) => `<li><span class="note-day">第 ${note.day} 天</span>
    <div><strong>${escapeText(note.title)}</strong><p>${escapeText(note.text)}</p></div></li>`), '尚无提示');
}

function renderShip() {
  const ship = state.ship;
  const status = document.querySelector<HTMLElement>('#ship-status')!;
  boardEntry.hidden = saveBlocked || !!ship || state.economy !== 'port' || state.awaitingOpen;
  shipEntry.hidden = saveBlocked || !ship || !!ship.closed || state.awaitingOpen;
  status.hidden = saveBlocked || !ship;
  document.querySelector('#guide-story')!.textContent = ship ? shipStory : openingStory;
  if (shipEntry.hidden && shipDialog.open) shipDialog.close();
  if (!ship || saveBlocked) return;
  const { stop, next, nextDay } = shipStop(state.day);
  status.textContent = `旧港号 · ${stop.name}　｜　${waterLine()}　｜　第 ${nextDay} 天靠泊${next.name}`;
  const offers = document.querySelector<HTMLElement>('#ship-offers')!;
  offers.replaceChildren();
  const row = (heading: string, detail: string) => {
    const section = document.createElement('section');
    section.className = 'harbor-good';
    const title = document.createElement('h3');
    title.textContent = heading;
    const info = document.createElement('p');
    info.textContent = detail;
    section.append(title, info);
    offers.append(section);
    return section;
  };
  const action = (section: HTMLElement, label: string, command: Action, disabled = false) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'quiet';
    button.disabled = disabled;
    bindAction(button, command);
    section.append(button);
  };
  const water = row('生活甲板 · 水柜', `打烊付 ${berthFee} 元住宿口粮费，并消耗一日饮水。手上 ${state.cash} 元，水柜现存 ${ship.water} 天。`);
  waterPacks.forEach((pack, choice) => action(water, `${pack.name} · ${pack.days} 天 / ${pack.price} 元`,
    { type: 'buyWater', day: state.day, choice }, state.cash < pack.price));
  if (shipGap(state)) {
    const used = ship.reliefLeg === roundStart(state.day);
    action(water, used ? '本航段已值班' : '泵房应急值班 · 领 6 元和一日水', { type: 'shipRelief', day: state.day }, used);
  }
  const budget = crossingBudget(state.day, state.cash, ship.water);
  const farm = floatFarmRequest(state);
  const missing = budget.missingWater ? `还需补 ${budget.missingWater} 日水，至少 ${budget.waterSpend} 元` : '存水够用';
  row('撑到下一站', `第 ${nextDay} 天靠泊前，还要交 ${budget.nights} 晚船籍费（${budget.nights * berthFee} 元）。${missing}。按手头现钱算，${budget.gap ? `至少还差 ${budget.gap} 元` : `备齐后余 ${state.cash - budget.total} 元`}。`);
  if (budget.tonightGap) {
    const sales = state.inventory.flatMap((item) => {
      const quote = shipSaleQuote(state.day, item);
      return quote ? [{ item, quote }] : [];
    }).sort((a, b) => a.quote.bid - b.quote.bid);
    const help = row('今晚筹钱', `船费和最低补水合计还差 ${budget.tonightGap} 元。`);
    const addHint = (text: string) => {
      const hint = document.createElement('p');
      hint.textContent = text;
      help.append(hint);
    };
    const referral = roundReferral(state);
    if (referral?.available && !referral.paid) {
      addHint(referral.text);
      action(help, '牵线介绍 · 现在收 8 元', { type: 'roundReferral', day: state.day });
    }
    const visit = currentVisit(state.day, state.visitIndex, state.economy, state.harborSchedule);
    if (visit?.kind === 'sale') {
      const offer = saleOffer(state, visit);
      if (offer.item) addHint(`柜台上的${visit.person}正等着收${offer.item.name}，返回柜台成交可收 ${offer.price} 元。`);
    } else if (visit?.kind === 'redeem') {
      const ticket = heldTicket(state, visit);
      if (ticket) addHint(`柜台上的${visit.person}正等着赎${ticket.item.name}，返回柜台交还可收 ${ticket.redeemPrice} 元。`);
    }
    const tomorrowPayout = state.jadeOrders?.filter((order) => order.dueDay === state.day + 1)
      .reduce((sum, order) => sum + order.payout, 0) ?? 0;
    if (tomorrowPayout) addHint(`工坊明天开门结款 ${tomorrowPayout} 元，今晚仍需凑齐船费和饮水。`);
    if (!sales.length) addHint('手上没有岸商收的自有货。');
    for (const { item, quote } of sales) {
      action(help, `卖${item.name} ${quote.bid} 元 · 下站 ${quote.nextBid} 元`, { type: 'sellCargo', day: state.day, itemId: item.id });
      if (farm?.active && cargoKind(item.id) === floatFarmOrder.kind) {
        action(help, `交浮田维修班 ${floatFarmOrder.price} 元`, { type: 'deliverFloatFarmSeal', day: state.day, itemId: item.id });
      }
    }
  }
  row(stop.name, stop.reason + `第 ${nextDay} 天起换泊${next.name}。`);
  if (farm && state.day <= floatFarmOrder.last) {
    const seals = state.inventory.filter((item) => cargoKind(item.id) === floatFarmOrder.kind);
    const stock = farm.active && !seals.length ? '手上没有可交付的自有密封条。' : '';
    const request = row('浮田水站 · 临时加购', farm.terms + farm.status + stock);
    if (farm.active) {
      for (const item of seals) {
        action(request, `交密封条 · 成本 ${item.cost} / 收 ${floatFarmOrder.price} 元`,
          { type: 'deliverFloatFarmSeal', day: state.day, itemId: item.id });
      }
    }
  }
  cargoGoods.forEach((good, choice) => {
    const quote = cargoQuote(state.day, choice);
    const section = row(good.name, `${good.clue}　本站收 ${quote.bid} 元，下站收 ${quote.nextBid} 元。`);
    const bought = state.ledger.some((entry) => entry.itemId === cargoId(state.day, choice));
    action(section, bought ? '本批已收' : `收${good.name} ${quote.ask} 元`, { type: 'buyCargo', day: state.day, choice }, bought || state.cash < quote.ask);
    for (const item of state.inventory.filter((entry) => cargoKind(entry.id) === choice)) {
      action(section, `卖出 · 成本 ${item.cost} / 收 ${quote.bid} 元`, { type: 'sellCargo', day: state.day, itemId: item.id });
    }
  });
}

function render(message = '船工在等你的报价。', tone: Result['tone'] = 'neutral') {
  renderShip();
  const firstSummary = atFirstChapterSummary(state);
  const roundSummary = atRoundSummary(state);
  const finished = pastLastDay(state) || roundSummary || state.waterShortfall > 0 || firstSummary || state.ship?.closed;
  const visit = !state.awaitingOpen ? currentVisit(state.day, state.visitIndex, state.economy, state.harborSchedule) : undefined;
  const ropeGuest = !visit && !saveBlocked && !state.ship?.closed ? ropeVisit(state) : undefined;
  const hints = {
    purchase: '当前在收货。先看看成色，再决定愿意给多少。',
    pawn: '当前在收当。对照货物线索，再看放款、赎回金额和到期日。',
    sale: '当前有人来买货。可从线索记录核对熟客的需求。',
    redeem: '当前是原主赎回。确认当票后收钱，把原物还给客人。',
    timerBuyer: '可以把已归店的 T8 卖给来客。说明真伪会改变成交价。',
    waterReserve: '订水立即扣款，水票只覆盖指定晚。F2 装好后优先使用集雨池的水。',
  };
  currentGuide.textContent = saveBlocked ? '' : visit ? hints[visit.kind] :
    state.chapterTwoStarted && !finished ? state.economy === 'port' ? '港务字条会写上到港日和受影响的订单。' : '打烊时结算饮水。现金不足时，可返回账本回收自有库存或安装 F2。' : '';
  const plan = saveBlocked ? undefined : outingPlan(state);
  const planningOuting = plan && !state.voyage && !state.stoneTrip;
  const phase = planningOuting ? 'evening'
    : harborPeriod(state.visitIndex, scheduledVisits(state.day, state.economy, state.harborSchedule), state.awaitingOpen && !finished);
  const lightLabel = { morning: '早晨', noon: '日间', evening: '傍晚' }[phase];
  document.documentElement.dataset.phase = phase;
  dockFlag.hidden = atTitle || saveBlocked || state.economy !== 'port' || !state.chapterTwoStarted ||
    state.day < winchOrderDay(state.economy, state.harborSchedule);
  setSprite(guestArt, !saveBlocked && !atTitle ? visit?.portrait ?? (ropeGuest?.today ? 'deckhand' : undefined) : undefined,
    visit?.id ?? (ropeGuest?.today ? `rope-${ropeGuest.start}` : undefined));
  if (saveBlocked || !visit || atTitle) {
    setSprite(itemArt);
    setSprite(inspectThumb);
  }
  inspectionEntry.hidden = true;
  if (inspectDialog.open) inspectDialog.close();
  const dayStatus = state.awaitingOpen ? '尚未营业' : '柜台营业';
  day.textContent = state.ship?.closed ? `第 ${state.day} 天 · 已离船` : finished || planningOuting ? `第 ${state.day - 1} 天 · 已打烊` : `第 ${state.day} 天 · ${lightLabel} · ${dayStatus}`;
  cash.value = saveBlocked ? '—' : String(state.cash);
  const latest = saveBlocked ? undefined : state.ledger.slice().reverse().find((entry) => entry.change !== 0);
  cashChange.textContent = latest
    ? `第 ${latest.day} 天 · ${latest.description} ${latest.change > 0 ? '+' : '−'}${Math.abs(latest.change)} 元` : '';
  cashChange.dataset.direction = latest && latest.change > 0 ? 'income' : 'expense';
  count.textContent = saveBlocked ? '—' : `${state.inventory.length} 件`;
  renderInventory();
  renderHarbor();
  renderConsignment();
  renderJobs();
  const mounted = state.mountedFilter;
  const jobDone = state.waterJobDay === state.day;
  rackEntry.hidden = saveBlocked || !workshopOpen(state) ||
    (!mounted && !jobDone && !state.inventory.some((item) => item.filter));
  if (rackEntry.hidden && rackDialog.open) rackDialog.close();
  rackEntry.textContent = mounted?.filter ? `淡化机架 · 余 ${mounted.filter.remaining} 次` : '淡化机架';
  rackStatus.textContent = [
    mounted?.filter ? `${mounted.name} · 还能制水 ${mounted.filter.remaining} 次。` : '机架空着，可从自有库存装入滤芯。',
    jobDone ? '今天的机架班次已用完。' : `今天有一张制水单，净付 ${waterJobPay} 元。`,
  ].join('');
  rackActions.replaceChildren();
  if (mounted) {
    const use = document.createElement('button');
    use.textContent = `制水交单 · 收 ${waterJobPay} 元`;
    use.disabled = jobDone;
    bindAction(use, { type: 'takeWaterJob', day: state.day });
    const remove = document.createElement('button');
    remove.textContent = '拆回库存';
    remove.className = 'quiet';
    bindAction(remove, { type: 'removeFilter', day: state.day });
    if (state.ship) {
      const fill = document.createElement('button');
      fill.textContent = '制水自用 · 储三日饮水';
      fill.disabled = jobDone;
      bindAction(fill, { type: 'fillShipWater', day: state.day });
      rackActions.append(fill);
    }
    rackActions.append(use, remove);
  }
  shelter.textContent = saveBlocked ? '等待恢复存档' : state.ship ? waterLine() :
    finished ? (state.installedPurifier ? 'F2 已安装，接集雨池供水。' : '庇护所尚未安装 F2。') : waterLine();
  if (!saveBlocked && !finished && state.reservedWaterDay && state.reservedWaterDay > state.day) {
    shelter.textContent += `。第 ${state.reservedWaterDay} 天的用水已预订。`;
  }
  shelter.className = 'empty';
  if (state.economy === 'port' && state.installedPurifier && consignmentOpen(state)) {
    const reclaim = document.createElement('button');
    reclaim.className = 'quiet';
    reclaim.textContent = '把已安装的 F2 拆回库存';
    bindAction(reclaim, { type: 'reclaimPurifier', day: state.day });
    shelter.append(document.createElement('br'), reclaim);
  }
  renderNotes();
  renderDesk();
  renderStockDetail();
  tickets.innerHTML = records((saveBlocked ? [] : state.tickets).map((ticket) => {
    const status = { held: '代管中', redeemed: '已赎回', expired: '已逾期归店' }[ticket.status];
    const due = ticket.status === 'held' && ticket.dueDay === state.day ? ' · 今日打烊前仍可赎' : '';
    return `<li><span>${escapeText(ticket.item.name)}<small>${escapeText(ticket.borrower)} · 第 ${ticket.dueDay} 天到期${due}</small>
      <small>放款 ${ticket.principal} 元 · 赎回 ${ticket.redeemPrice} 元${ticket.item.authenticity === 'imitation' ? ' · 仿品' : ''}</small></span><span class="tag">${status}</span></li>`;
  }), '暂无当票');
  ledger.innerHTML = records((saveBlocked ? [] : state.ledger).map((entry) =>
    `<li><span>${escapeText(entry.description)}<small>第 ${entry.day} 天</small></span>
      <span>${entry.change > 0 ? '+' : ''}${entry.change} 元<small>余额 ${entry.balance} 元</small></span></li>`), '暂无交易流水');

  actions.replaceChildren();
  if (saveBlocked) {
    scene.innerHTML = '<div class="visitor"><h2>存档需要处理</h2></div>';
  } else if (state.ship?.closed) {
    scene.innerHTML = `<div class="visitor"><h2>离船停业</h2><p>第 ${state.day} 天 · ${shipGap(state)}。账本留存，现金 ${state.cash} 元。</p></div>`;
  } else if (finished) {
    if (roundSummary && state.day > lastDay + 1) {
      const start = state.day - 5;
      const result = state.ledger.filter((entry) => entry.day >= start && entry.day < state.day);
      const change = result.reduce((sum, entry) => sum + entry.change, 0);
      const held = state.tickets.filter((ticket) => ticket.status === 'held').length;
      scene.innerHTML = `<div class="visitor"><h2>${portRound(start, state.harborSchedule).title} · 收档</h2>
        <p class="terms">本轮净收支 ${change >= 0 ? '+' : ''}${change} 元 · 现金 ${state.cash} 元 · 自有库存 ${state.inventory.length} 件 · 代管 ${held} 件</p>
        ${mounted?.filter ? `<p class="terms">机架滤芯还能制水 ${mounted.filter.remaining} 次。</p>` : ''}
        ${state.jadeOrders?.length ? `<p class="terms">工坊有 ${state.jadeOrders.length} 件待交付 · 下一轮开门收 ${state.jadeOrders.reduce((sum, order) => sum + order.payout, 0)} 元。</p>` : ''}
        ${state.consignment ? '<p class="terms">寄售将在下一轮开门时结算。</p>' : ''}</div>`;
    } else scene.innerHTML = endingView(state.chapterTwoStarted === true);
    if (roundSummary) {
      addAction(`继续营业 · ${portRound(state.day, state.harborSchedule).title}`, { type: 'continue', day: state.day });
    }
    if (firstSummary) addAction('继续营业', { type: 'continue', day: state.day });
    if (firstSummary && state.economy !== 'port') {
      addAction('带账本进入新版港口', { type: 'continue', day: state.day, upgrade: true }, true, false, '保留现金、存货与当票，往后由水站配给');
    }
  } else if (state.awaitingOpen) {
    scene.innerHTML = `<div class="visitor"><h2>第 ${state.day} 天</h2>
      ${state.day > lastDay && state.day === roundStart(state.day) ? `<p class="terms">${portRound(state.day, state.harborSchedule).notice}</p>` : ''}</div>`;
    const voyage = state.voyage;
    if (planningOuting) {
      const odds = voyageOdds(state.hasOutingWinch === true);
      const jadeOdds = stoneOdds(state.hasJadeLamp === true);
      scene.querySelector('.visitor')?.insertAdjacentHTML('beforeend', `<div class="outing-slip">
        <h3>码头拼船单 · 第 ${state.day} 天出发</h3>
        <p>本轮船位剩 ${plan.remaining}/${outingLimit} · 手头 ${state.cash} 元 · 明早已知到账 ${plan.knownReceipts} 元</p>
        <details><summary>查看出货概率与装备</summary>
          <p>打捞 · 空船 ${odds[0]}% · 旧芯 ${odds[1]}% · 完好芯 ${odds[2]}% · 长寿命芯 ${odds[3]}%</p>
          <p>挑石 · 石性重 ${jadeOdds[0]}% · 普通料 ${jadeOdds[1]}% · 好料 ${jadeOdds[2]}% · 精品 ${jadeOdds[3]}%</p>
          <p>${state.hasOutingWinch ? '已装备定位绞具。' : '定位绞具永久使用，出货率 55% → 65%。'}
          ${state.hasJadeLamp ? '已装备透光灯。' : '透光灯永久使用，好料和精品合计 23% → 30%。'}</p>
        </details>
      </div>`);
      addAction('开门营业', { type: 'open', day: state.day });
      addAction(`随船打捞 ${boatFee} 元`, { type: 'bookVoyage', day: state.day }, true, !plan.remaining || !!plan.boatShortfall,
        !plan.remaining ? '本轮船位已用完' : plan.boatShortfall ? `留足 ${cashReserve} 元还差 ${plan.boatShortfall} 元` : `付费后剩 ${state.cash - boatFee} 元`);
      if (!state.hasOutingWinch) addAction(`买定位绞具 ${winchUpgradeCost} 元`, { type: 'buyOutingWinch', day: state.day },
        true, !!plan.gearShortfall, plan.gearShortfall ? `留足 ${cashReserve} 元还差 ${plan.gearShortfall} 元` : `付费后剩 ${state.cash - winchUpgradeCost} 元`);
      addAction(`去挑原石 ${stoneFee} 元`, { type: 'bookStoneTrip', day: state.day }, true, !plan.remaining || !!plan.stoneShortfall,
        !plan.remaining ? '本轮船位已用完' : plan.stoneShortfall ? `留足 ${cashReserve} 元还差 ${plan.stoneShortfall} 元` : `付费后剩 ${state.cash - stoneFee} 元`);
      if (!state.hasJadeLamp) addAction(`买透光灯 ${lampCost} 元`, { type: 'buyJadeLamp', day: state.day },
        true, !!plan.lampShortfall, plan.lampShortfall ? `留足 ${cashReserve} 元还差 ${plan.lampShortfall} 元` : `付费后剩 ${state.cash - lampCost} 元`);
    } else if (state.stoneTrip) {
      scene.querySelector('.visitor')?.insertAdjacentHTML('beforeend',
        '<div class="outing-slip"><h3>清晨返港</h3><p>带回一块封着石皮的原石。开门收入库存，再开窗看料。</p></div>');
      addAction('开门营业', { type: 'open', day: state.day });
    } else if (voyage) {
      const grade = voyage.grade === 'empty' ? undefined : filterGrades[voyage.grade];
      const line = voyage.stage === 0 ? '打捞船靠岸了，吊篮还在水里。'
        : !grade ? '收上来一篮碎壳和泥沙，船队空手返港。'
        : voyage.stage === 1 ? '吊篮里有一枚沾泥的滤芯。擦净铭牌，再看压力表。'
        : `${grade.name} · 可用 ${grade.uses} 次 · 货商出 ${grade.price} 元。`;
      scene.querySelector('.visitor')?.insertAdjacentHTML('beforeend', `<div class="outing-slip"><h3>清晨返港</h3><p>${line}</p></div>`);
      if (voyage.stage === 0) addAction('收绳看吊篮', { type: 'revealVoyage', day: state.day, stage: 0 });
      if (voyage.stage === 1 && grade) addAction('擦净铭牌', { type: 'revealVoyage', day: state.day, stage: 1 });
      addAction('开门营业', { type: 'open', day: state.day }, voyage.stage < 2 && !!grade);
    } else addAction('开门营业', { type: 'open', day: state.day });
  } else if (visit) {
    renderVisit(visit);
  } else if (ropeGuest?.today) {
    const item = ropeGuest.item;
    scene.innerHTML = `<div class="visitor"><div class="visitor-heading"><h2>搬运班伙计</h2><span class="tag">收购</span></div>
      <blockquote>“湿过的绳截短了照样能捆菜筐。带盐霜的那盘在吗？我出 ${ropeVisitPrice} 元。”</blockquote>
      <p class="terms">${item ? '柜台有合用的自有短绳。' : '手上没有合用的自有短绳。'}</p></div>`;
    const day = state.day;
    if (item) addAction(`交付短绳 ${ropeVisitPrice} 元`, { type: 'deliverRope', day, itemId: item.id });
    addAction(item ? '留货，谢客' : '说明缺货', { type: 'dismissRopeVisit', day }, true);
  } else {
    const due = state.tickets.some((ticket) => ticket.status === 'held' && ticket.dueDay === state.day);
    const text = due ? '今天仍可赎，打烊后才归店。' : '今天的客人都接待完了。';
    const shortfall = Math.max(0, waterCost(state) - state.cash);
    scene.innerHTML = `<div class="visitor"><h2>准备打烊</h2><p class="terms">${text}</p>
      ${state.economy !== 'port' && state.day >= firstChapterEnd ? `<p class="terms">手头 ${state.cash} 元 · ${shortfall ? `差 ${shortfall} 元` : '足够支付今晚水费'}</p>` : ''}</div>`;
    if (state.ship && shipGap(state)) {
      const button = document.createElement('button');
      button.textContent = '船费与饮水不足 · 查看办法';
      button.onclick = () => {
        shipDialog.showModal();
        document.querySelector('#ship-result')!.textContent = `${shipGap(state)}。可补水、卖货或申请应急值班。`;
      };
      actions.append(button);
      const leave = document.createElement('button');
      leave.className = 'quiet';
      leave.textContent = '离船停业';
      leave.onclick = () => { if (window.confirm('确认结束本局营业并离船？')) void handle({ type: 'close', day: state.day, confirmShortfall: true }); };
      actions.append(leave);
    } else if (state.day >= secondChapterStart && shortfall) {
      const closingDay = state.day;
      const button = document.createElement('button');
      button.textContent = '打烊';
      button.addEventListener('click', () => {
        waterDetail.textContent = `${waterLine()} · 手头 ${state.cash} 元 · 差 ${shortfall} 元`;
        waterDialog.returnValue = '';
        waterDialog.showModal();
        waterDialog.addEventListener('close', () => {
          if (waterDialog.returnValue === 'confirm') void handle({ type: 'close', day: closingDay, confirmShortfall: true });
        }, { once: true });
      });
      actions.append(button);
    } else addAction('打烊', { type: 'close', day: state.day });
  }
  if (!saveBlocked && !finished && state.day > 1 && state.economy !== 'port') {
    const paper = document.createElement('p');
    paper.className = 'first-tip';
    paper.textContent = waterLine();
    scene.append(paper);
  }
  if (!saveBlocked && !finished && state.day === secondChapterStart) {
    const notice = document.createElement('p');
    notice.className = 'terms';
    notice.textContent = `港务告示 · ${portBulletin(state)}`;
    scene.append(notice);
  }
  feedback.dataset.tone = tone;
  feedback.textContent = message;
  retry.hidden = !saveBlocked;
  if (tutorialStep && (saveBlocked || visit?.id !== 'day-1-boatman')) finishTutorial();
  else renderTutorial();
}

function restore() {
  try {
    savedRaw = localStorage.getItem(saveKey);
    const save = savedRaw === null ? null : readSave(savedRaw);
    state = save?.state ?? newGame();
    saveBlocked = false;
    render(save?.message, save?.tone);
  } catch {
    saveBlocked = true;
    render('无法读取存档。可以重试，或确认后重新开始。', 'warning');
  }
}

function persist(result: Result) {
  const raw = JSON.stringify({ version: saveVersion, ...result });
  localStorage.setItem(saveKey, raw);
  savedRaw = raw;
  state = result.state;
  saveBlocked = false;
  render(result.message, result.tone);
}

async function update(run: () => void) {
  if (busy) return;
  busy = true;
  try {
    await navigator.locks.request(saveKey, () => {
      if (localStorage.getItem(saveKey) !== savedRaw) {
        restore();
        if (!saveBlocked) feedback.textContent = '另一个页面更新了进度，已重新读取。请确认当前柜台后再操作。';
        if (atTitle) renderTitle();
        if (harborDialog.open) harborResult.textContent = feedback.textContent;
        if (consignmentDialog.open) consignmentResult.textContent = feedback.textContent;
        if (stockDialog.open) stockResult.textContent = feedback.textContent;
        return;
      }
      run();
    });
  } catch {
    feedback.dataset.tone = 'warning';
    feedback.textContent = '无法保存这次操作。请检查浏览器存储权限，再重试。';
    if (atTitle) titleSave.textContent = feedback.textContent;
    if (harborDialog.open) harborResult.textContent = feedback.textContent;
    if (consignmentDialog.open) consignmentResult.textContent = feedback.textContent;
    if (stockDialog.open) stockResult.textContent = feedback.textContent;
  } finally {
    busy = false;
  }
}

async function handle(action: Action) {
  if (saveBlocked) return;
  await update(() => {
    const result = settleVisit(state, action);
    const fromHarbor = action.type === 'harborBuy' || action.type === 'harborSell';
    const fromConsignment = action.type === 'listItem' || action.type === 'unlistItem';
    if (tutorialStep && (action.type === 'offer' || action.type === 'dismiss')) finishTutorial();
    if (result.state !== state) {
      persist(result);
    }
    else {
      feedback.dataset.tone = result.tone;
      feedback.textContent = result.message;
    }
    if (fromHarbor) {
      harborResult.textContent = result.message;
      if (harborDialog.open && !harborDialog.contains(document.activeElement)) {
        harborDialog.querySelector('button')?.focus();
      }
    }
    if (fromConsignment) {
      consignmentResult.textContent = result.message;
      if (consignmentDialog.open && !consignmentDialog.contains(document.activeElement)) {
        consignmentDialog.querySelector('button')?.focus();
      }
    }
    if (stockDialog.open) {
      stockResult.textContent = result.message;
      if (!stockDialog.contains(document.activeElement)) stockDialog.querySelector('button')?.focus();
    }
    if (jobsDialog.open) {
      jobsResult.textContent = result.message;
      if (!jobsDialog.contains(document.activeElement)) jobsDialog.querySelector('button')?.focus();
    }
    if (shipDialog.open) {
      document.querySelector('#ship-result')!.textContent = result.message;
      if (!shipDialog.contains(document.activeElement)) shipDialog.querySelector('button')?.focus();
    }
    if (rackDialog.open) {
      rackResult.textContent = result.message;
      if (!rackDialog.contains(document.activeElement)) rackDialog.querySelector('button')?.focus();
    }
  });
}

function positionTutorial() {
  if (!tutorialTarget || tutorialTip.hidden) return;
  const target = tutorialTarget.getBoundingClientRect();
  const { width, height } = tutorialTip.getBoundingClientRect();
  const gap = 14;
  const edge = 12;
  const preferredTop = target.top - height - gap;
  const top = preferredTop >= edge ? preferredTop : target.bottom + gap;
  tutorialTip.style.top = `${Math.max(edge, Math.min(top, window.innerHeight - height - edge))}px`;
  tutorialTip.style.left = `${Math.max(edge, Math.min(target.left, window.innerWidth - width - edge))}px`;
}

function renderTutorial() {
  tutorialTarget?.classList.remove('tutorial-target');
  tutorialTarget?.removeAttribute('aria-describedby');
  tutorialTarget = tutorialStep === 'inspect' ? inspectCounter : tutorialStep === 'trade' ? actions : null;
  tutorialTip.hidden = !tutorialTarget;
  if (!tutorialTarget) return;
  tutorialCopy.textContent = tutorialStep === 'inspect'
    ? '先点「近看旧航灯」，检查成色和细节。'
    : '看完货，可以报价，也可以谢客。按 H 随时查看玩法。';
  tutorialTarget.classList.add('tutorial-target');
  tutorialTarget.setAttribute('aria-describedby', 'tutorial-copy');
  positionTutorial();
}

function showTutorialStep(step: 'inspect' | 'trade') {
  tutorialStep = step;
  renderTutorial();
  const target = step === 'inspect' ? inspectCounter : actions.querySelector('button');
  target?.focus();
  positionTutorial();
}

function finishTutorial() {
  tutorialStep = null;
  renderTutorial();
  try { localStorage.setItem(tutorialKey, 'done'); } catch { /* 仍可关闭本次引导 */ }
}

function startTutorial() {
  if (sandboxCash !== null || saveBlocked || state.day !== 1 || state.visitIndex !== 0 || state.attempts !== 0) return;
  try {
    if (localStorage.getItem(tutorialKey) === 'done') return;
  } catch { return; }
  showTutorialStep('inspect');
}

function startOpening() {
  if (sandboxCash === null && !saveBlocked) {
    document.querySelector('#opening-story')!.textContent = state.ship ? shipStory : openingStory;
    document.querySelector('#ration-title')!.textContent = state.ship ? '旧港号 · 登船日' : '旧港 · 开张日';
    openingRation.textContent = state.ship ? '登船领三日饮水。每天打烊交 6 元船籍费并喝一日水。「船务与岸市」可补水、看下一站行情。' : state.economy === 'port' ? '水站名册已补上你这一户。等补给船到港，泊位上会挂起蓝旗。'
      : '配给条上盖着蓝印：新户饮水领到第 4 天，到淡水驳船提桶。';
    rationDialog.showModal();
  }
}

function renderTitle() {
  titleContinue.hidden = savedRaw === null && !saveBlocked;
  titleContinue.textContent = saveBlocked ? '查看存档' : '继续营业';
  titleNew.textContent = titleContinue.hidden ? '开始营业' : '开始新游戏';
  titleSave.textContent = saveBlocked ? '存档读取失败' : savedRaw === null ? '' :
    `本地存档 · 第 ${state.awaitingOpen && (atFirstChapterSummary(state) || atRoundSummary(state) || state.waterShortfall || pastLastDay(state)) ? state.day - 1 : state.day} 天 · 现金 ${state.cash} 元`;
}

function showTitle() {
  atTitle = true;
  document.documentElement.classList.add('at-title');
  restore();
  renderTitle();
  if (!titleDialog.open) titleDialog.showModal();
  (titleContinue.hidden ? titleNew : titleContinue).focus();
}

function enterGame() {
  atTitle = false;
  document.documentElement.classList.remove('at-title');
  titleDialog.close();
  restore();
}

function openNotes() {
  notesDialog.showModal();
  if (saveBlocked || noteCount.hidden) return;
  void update(() => {
    const result = settleVisit(state, { type: 'readNotes', day: state.day });
    if (result.state === state) return;
    const tone = feedback.dataset.tone;
    persist({
      ...result,
      message: feedback.textContent ?? '',
      tone: tone === 'success' || tone === 'warning' ? tone : 'neutral',
    });
  });
}

document.querySelector('#show-notes')!.addEventListener('click', openNotes);
noteSlip.addEventListener('click', openNotes);
function openJobs() {
  if (notesDialog.open) notesDialog.close();
  jobsResult.textContent = '';
  jobsDialog.showModal();
}
jobsEntry.addEventListener('click', openJobs);
notesJobs.addEventListener('click', openJobs);
document.querySelector('#show-guide')!.addEventListener('click', () => guideDialog.showModal());
document.querySelector('#show-ledger')!.addEventListener('click', () => ledgerDialog.showModal());
document.querySelector('#show-menu')!.addEventListener('click', () => menuDialog.showModal());
document.querySelector('#return-title')!.addEventListener('click', () => {
  menuDialog.close();
  showTitle();
});
harborEntry.addEventListener('click', () => {
  harborResult.textContent = '';
  harborDialog.showModal();
});
consignmentEntry.addEventListener('click', () => {
  consignmentResult.textContent = '';
  consignmentDialog.showModal();
});
titleDialog.addEventListener('cancel', (event) => event.preventDefault());
titleContinue.addEventListener('click', () => { enterGame(); startTutorial(); });
titleNew.addEventListener('click', () => {
  if (savedRaw !== null && !window.confirm('开始新游戏会覆盖当前存档。确定继续？')) return;
  void update(() => {
    persist({ state: newSavedGame(), message: '船工在等你的报价。', tone: 'neutral' });
    enterGame();
    startOpening();
  });
});
inspectCounter.addEventListener('click', () => { if (!inspectionEntry.hidden) inspectDialog.showModal(); });
inspectDialog.addEventListener('close', () => {
  if (tutorialStep === 'inspect') showTutorialStep('trade');
});
rationDialog.addEventListener('close', startTutorial);
document.querySelector('#skip-tutorial')!.addEventListener('click', () => {
  const focus = tutorialStep === 'inspect' ? inspectCounter : actions.querySelector('button');
  finishTutorial();
  focus?.focus();
});
window.addEventListener('resize', positionTutorial);
window.addEventListener('scroll', positionTutorial, { passive: true });
document.addEventListener('keydown', (event) => {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
  if (event.key === 'Escape' && tutorialStep && !document.querySelector('dialog[open]')) finishTutorial();
  const panel = event.code === 'KeyH' ? guideDialog : event.code === 'KeyJ' ? notesDialog : undefined;
  if (!panel || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (panel.open) panel.close();
  else if (!document.querySelector('dialog[open]')) {
    if (panel === notesDialog) openNotes();
    else panel.showModal();
  }
});

retry.addEventListener('click', restore);
restart.addEventListener('click', () => {
  if (savedRaw !== null && !window.confirm('重新开始会覆盖当前存档。确定继续？')) return;
  void update(() => {
    persist({ state: newSavedGame(), message: '船工在等你的报价。', tone: 'neutral' });
    menuDialog.close();
    startOpening();
  });
});
showTitle();
