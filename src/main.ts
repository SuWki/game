import './style.css';
import { atFirstChapterSummary, heldTicket, nightlyWater, openCounter, ownedImitation, saleOffer, settleVisit, usablePurifier, waterCost, waterLedger, type Action, type Counter, type Result } from './counter';
import { currentVisit, falseTimerPrice, firstChapterEnd, harborNotice, harborPeriod, harborPeriods, honestTimerPrice, imitationPurchasePrice, lastDay, maxOffers, openingCash, scheduledVisits, secondChapterStart, waterPrice, waterReservePrice, waterStartDay, winchBuyers, type Item, type Visit } from './scenario';
import { readSave, saveVersion } from './save';
import { counterNotes, harborOpen, harborStock } from './counter';
import { consignmentPrices } from './scenario';
import { board, lateBoardPrice, wornWinch, wornWinchEarlyPrice, wornWinchLatePrice, wornWinchPrice } from './scenario';

const cashParam = new URLSearchParams(location.search).get('cash');
const sandboxCash = cashParam === '24' ? 24 : cashParam === '5' ? 5 : null;
const saveKey = sandboxCash === null ? 'tideline-counter' : `tideline-counter-cash-${sandboxCash}`;
const tutorialKey = 'tideline-counter-tutorial';
const openingStory = '那场风暴过后，旧船厂的汽笛沉寂了好几年。如今码头又能靠船了，船上的旧物也跟着人上了岸。你在船厂门口支起当铺：有人急着结工钱，肯把货卖断；有人只想押上心爱的东西，等船回来再赎。';
const newGame = () => openCounter(sandboxCash ?? openingCash);
const newSavedGame = (): Counter => Math.random() < 0.5 ? { ...newGame(), harborSchedule: 'late' } : newGame();
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
            <button id="show-harbor" class="quiet" hidden>港口货摊</button>
            <button id="show-consignment" class="quiet" hidden>寄售架</button>
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
    <p>${openingStory}</p>
    <p class="ration-slip">配给条上盖着蓝印：新户饮水领到第 4 天，到淡水驳船提桶。</p>
    <form method="dialog" class="actions"><button autofocus>掀帘开张</button></form>
  </dialog>
  <dialog id="inspect-dialog" aria-labelledby="inspect-title">
    <div class="dialog-head"><h2 id="inspect-title"></h2><form method="dialog"><button class="quiet" autofocus>返回柜台</button></form></div>
    <div id="inspect-content"></div>
  </dialog>
  <dialog id="guide-dialog" aria-labelledby="guide-title">
    <div class="dialog-head"><h2 id="guide-title">玩法提示</h2><form method="dialog"><button class="quiet">收起 <kbd>Esc</kbd></button></form></div>
    <p id="current-guide" aria-live="polite"></p>
    <details class="port-story"><summary>旧港的来历</summary><p>${openingStory}</p></details>
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
  <dialog id="menu-dialog" aria-labelledby="menu-title">
    <div class="dialog-head"><h2 id="menu-title">菜单</h2><form method="dialog"><button class="quiet">返回柜台</button></form></div>
    <button id="restart" class="quiet">重新开始</button>
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
  return item && illustrated.includes(item.id) ? `item-${item.id}` : undefined;
}

function waterLine() {
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
    const inspected = visit.id === 'day-8-winch' ? wornWinch : item;
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
        ? `成交并付今晚水费后${formatCash(afterTonight)} · 明晚水费 ${nightlyWater(state, state.day + 1).cost} 元，若无进账则${formatCash(afterTomorrow)}`
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
      visit.matchModel ? `${waterLine()} · 次日起常价 ${waterPrice} 元` : winchMargin);
    if (visit.matchModel && !state.installedPurifier) {
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
      : keepWinch ? `留绞盘到第 10 天，可卖 ${item?.condition === wornWinch.condition ? wornWinchLatePrice : 155} 元`
      : dismissLabel === '留货，谢客' ? `${waterLine()} · 次日起常价 ${waterPrice} 元` : undefined);
}

function renderInventory() {
  const items = saveBlocked ? [] : state.inventory;
  inventory.innerHTML = records(items.map((item) => {
    const authenticity = item.authenticity === 'imitation' ? ' · 仿品' : item.authenticity === 'genuine' ? ' · 正品' : '';
    const detail = item.id === 'winch-1' ? `<small>${item.condition === wornWinch.condition ? wornWinch.observations[1] : winchBuyers}</small>`
      : item.id === board.id && state.day <= 9 ? `<small>第 7 天卖 55 元，第 9 天船工出 ${lateBoardPrice} 元。</small>`
      : usablePurifier(item) ? '<small>接集雨池 · 净化雨水</small>' : '';
    return `<li><span>${escapeText(item.name)}<small>${escapeText(item.condition)}${authenticity}</small>${detail}</span>
      <span>成本 ${item.cost} 元</span></li>`;
  }), '库存为空');
  if (state.day < waterStartDay || state.day > lastDay || state.awaitingOpen || saveBlocked) return;

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
    if (!state.installedPurifier && usablePurifier(item)) add('安装 F2 净水机', 'install');
    if (item.recyclePrice !== undefined) add(`回收${item.name} ${item.recyclePrice} 元`, 'recycle');
    row.append(buttons);
  });
}

function renderHarbor() {
  const available = !saveBlocked && harborOpen(state);
  harborEntry.hidden = !available;
  if (!available) { if (harborDialog.open) harborDialog.close(); return; }
  harborCash.textContent = `第 ${state.day} 天 · 手头 ${state.cash} 元 · 今晚水费 ${waterCost(state)} 元`;
  harborList.replaceChildren();
  for (const { item, held, bought, asks, bids } of harborStock(state)) {
    const row = document.createElement('section');
    row.className = 'harbor-good';
    const currentAsk = asks[state.day];
    const currentBid = bids[state.day];
    const future = Object.entries(bids).filter(([day]) => Number(day) > state.day)
      .map(([day, price]) => `第 ${day} 天 ${price} 元`).join(' · ');
    row.innerHTML = `<h3>${item.name}</h3><p>${held ? `在库 · 成本 ${held.cost} 元` : bought ? '已处理' : currentAsk === undefined ? '今天无货' : '今天有货'}</p>
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
  const available = !saveBlocked && harborOpen(state) && state.day < lastDay;
  consignmentEntry.hidden = !available;
  consignmentEntry.textContent = state.consignment ? '寄售架 · 1 件' : '寄售架';
  if (!available) {
    if (consignmentDialog.open) consignmentDialog.close();
    return;
  }
  consignmentSchedule.textContent = `第 ${state.day + 1} 天开门结算 · 今晚水费 ${waterCost(state)} 元`;
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

function stockOutlook(item: Counter['inventory'][number]) {
  const entries: string[] = [];
  if (item.id === board.id && state.day <= 9 && (state.day < 9 || state.visitIndex === 0)) {
    entries.push(`第 9 天船工收 ${lateBoardPrice} 元`);
  }
  if ((item.id === board.id || item.id === 'winch-1' || usablePurifier(item))) {
    for (let date = state.day; date <= lastDay; date++) {
      if (usablePurifier(item) && date !== 5) continue;
      const firstVisit = date === state.day ? state.visitIndex : 0;
      for (let index = firstVisit; index < scheduledVisits(date); index++) {
        const visit = currentVisit(date, index);
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
    ${records(outlook.map((line) => `<li>${escapeText(line)}</li>`), '暂无线索显示有约定买家。')}`;
  if (state.day < waterStartDay || state.day > lastDay || state.awaitingOpen) return;
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
  if (!state.installedPurifier && usablePurifier(item)) add('安装自用', { ...target, type: 'install' });
  if (item.recyclePrice !== undefined) add(`立即回收 ${item.recyclePrice} 元`, { ...target, type: 'recycle' });
  if (harborOpen(state)) {
    const marketPrice = harborStock(state).find((good) => good.item.id === item.id)?.bids[state.day];
    if (marketPrice !== undefined) add(`立即卖给货摊 ${marketPrice} 元`, { ...target, type: 'harborSell' });
    if (state.day < lastDay) {
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
  }
  if (actions.childElementCount) stockDetail.append(actions);
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
      stockResult.textContent = '';
      stockDialog.showModal();
      renderStockDetail();
    });
    deskItems.append(chip);
  }
  const held = state.tickets.filter((ticket) => ticket.status === 'held');
  deskHeld.textContent = held.length ? `代管 ${held.length} 件 · 尚未归店` : '';
}

function endingView(chapterTwo: boolean) {
  const installed = state.installedPurifier !== null;
  const waterEntries = state.ledger.filter((entry) => entry.itemId === null && (entry.day >= secondChapterStart) === chapterTwo);
  const spent = -waterEntries.filter((entry) => entry.description === waterLedger.purchase || entry.description === waterLedger.reservation)
    .reduce((total, entry) => total + entry.change, 0);
  const title = state.waterShortfall ? '经营中断' : chapterTwo ? '第二章完成 · 迟到的淡水船' : '五日试玩完成';
  const summary = state.waterShortfall
    ? `当天无力买水，差 ${state.waterShortfall} 元。余额 ${state.cash} 元。`
    : `现金结余 ${state.cash} 元 · 自有库存 ${state.inventory.length} 件 · ${chapterTwo ? '本章' : '本局'}水费 ${spent} 元`;
  const savings = installed && !state.waterShortfall ? Math.max(0, waterPrice - spent) : 0;
  const waterSummary = chapterTwo
    ? `${state.waterShortfall ? '本章已付水费' : '五晚实际水支出'}（含买票） ${spent} 元 · F2 供水 ${waterEntries.filter((entry) => entry.description === waterLedger.purifier).length} 晚 · 水票抵扣 ${waterEntries.filter((entry) => entry.description === waterLedger.ticket).length} 晚`
    : `本局已省水费 ${savings} 元 · 今后每天可省 ${installed ? waterPrice : 0} 元`;
  const stock = chapterTwo ? `<p class="terms">自有库存 · ${state.inventory.map((item) => escapeText(item.name)).join('、') || '空'}</p>` : '';
  return `<div class="visitor"><h2>${title}</h2><p class="terms">${summary}</p>
    <p class="terms">${waterSummary}</p>${stock}</div>`;
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

function render(message = '船工在等你的报价。', tone: Result['tone'] = 'neutral') {
  const firstSummary = atFirstChapterSummary(state);
  const finished = state.day > lastDay || state.waterShortfall > 0 || firstSummary;
  const visit = !state.awaitingOpen ? currentVisit(state.day, state.visitIndex) : undefined;
  const hints = {
    purchase: '当前在收货。先看看成色，再决定愿意给多少。',
    pawn: '当前在收当。对照货物线索，再看放款、赎回金额和到期日。',
    sale: '当前有人来买货。可从线索记录核对熟客的需求。',
    redeem: '当前是原主赎回。确认当票后收钱，把原物还给客人。',
    timerBuyer: '可以把已归店的 T8 卖给来客。说明真伪会改变成交价。',
    waterReserve: '订水立即扣款，水票只覆盖指定晚。F2 装好后优先使用集雨池的水。',
  };
  currentGuide.textContent = saveBlocked ? '' : visit ? hints[visit.kind] :
    state.chapterTwoStarted && !finished ? '打烊时结算饮水。现金不足时，可返回账本回收自有库存或安装 F2。' : '';
  const phase = harborPeriod(state.visitIndex, scheduledVisits(state.day), state.awaitingOpen && !finished);
  const lightLabel = { morning: '早晨', noon: '日间', evening: '傍晚' }[phase];
  document.documentElement.dataset.phase = phase;
  setSprite(guestArt, !saveBlocked && !atTitle ? visit?.portrait : undefined, visit?.id);
  if (saveBlocked || !visit || atTitle) {
    setSprite(itemArt);
    setSprite(inspectThumb);
  }
  inspectionEntry.hidden = true;
  if (inspectDialog.open) inspectDialog.close();
  const dayStatus = state.awaitingOpen ? '尚未营业' : '柜台营业';
  day.textContent = finished ? `第 ${state.day - 1} 天 · 已打烊` : `第 ${state.day} 天 · ${lightLabel} · ${dayStatus}`;
  cash.value = saveBlocked ? '—' : String(state.cash);
  const latest = saveBlocked ? undefined : state.ledger.slice().reverse().find((entry) => entry.change !== 0);
  cashChange.textContent = latest
    ? `第 ${latest.day} 天 · ${latest.description} ${latest.change > 0 ? '+' : '−'}${Math.abs(latest.change)} 元` : '';
  cashChange.dataset.direction = latest && latest.change > 0 ? 'income' : 'expense';
  count.textContent = saveBlocked ? '—' : `${state.inventory.length} 件`;
  renderInventory();
  renderHarbor();
  renderConsignment();
  shelter.textContent = saveBlocked ? '等待恢复存档' :
    finished ? (state.installedPurifier ? 'F2 已安装，接集雨池供水。' : '庇护所尚未安装 F2。') : waterLine();
  if (!saveBlocked && !finished && state.reservedWaterDay && state.reservedWaterDay > state.day) {
    shelter.textContent += `。第 ${state.reservedWaterDay} 天的用水已预订。`;
  }
  shelter.className = 'empty';
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
  } else if (finished) {
    scene.innerHTML = endingView(state.chapterTwoStarted === true);
    if (firstSummary) addAction('继续营业', { type: 'continue', day: state.day });
  } else if (state.awaitingOpen) {
    scene.innerHTML = `<div class="visitor"><h2>第 ${state.day} 天</h2></div>`;
    addAction('开门营业', { type: 'open', day: state.day });
  } else if (visit) {
    renderVisit(visit);
  } else {
    const due = state.tickets.some((ticket) => ticket.status === 'held' && ticket.dueDay === state.day);
    const text = due ? '今天仍可赎，打烊后才归店。' : '今天的客人都接待完了。';
    const shortfall = Math.max(0, waterCost(state) - state.cash);
    scene.innerHTML = `<div class="visitor"><h2>准备打烊</h2><p class="terms">${text}</p>
      ${state.day >= firstChapterEnd ? `<p class="terms">手头 ${state.cash} 元 · ${shortfall ? `差 ${shortfall} 元` : '足够支付今晚水费'}</p>` : ''}</div>`;
    if (state.day >= secondChapterStart && shortfall) {
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
  if (!saveBlocked && !finished && state.day > 1) {
    const paper = document.createElement('p');
    paper.className = 'first-tip';
    paper.textContent = waterLine();
    scene.append(paper);
    if (state.day === secondChapterStart) {
      const notice = document.createElement('p');
      notice.className = 'terms';
      notice.textContent = `港务告示 · ${harborNotice}`;
      scene.append(notice);
    }
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
  if (sandboxCash === null && !saveBlocked) rationDialog.showModal();
}

function renderTitle() {
  titleContinue.hidden = savedRaw === null && !saveBlocked;
  titleContinue.textContent = saveBlocked ? '查看存档' : '继续营业';
  titleNew.textContent = titleContinue.hidden ? '开始营业' : '开始新游戏';
  titleSave.textContent = saveBlocked ? '存档读取失败' : savedRaw === null ? '' :
    `本地存档 · 第 ${state.awaitingOpen && (atFirstChapterSummary(state) || state.waterShortfall || state.day > lastDay) ? state.day - 1 : state.day} 天 · 现金 ${state.cash} 元`;
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
