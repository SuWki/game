import type { Counter, Ticket } from './counter.ts';
import { firstOutingDay } from './outing.ts';
import { roundStart, type Item } from './scenario.ts';
import { berthFee, cargoKind, shipStop } from './ship.ts';

export const mechanicTicket = 'acen-salinity';
export const saltPen: Item = {
  id: 'salinity-pen', name: '测盐笔', model: '浮田维修仪表', condition: '标线清楚，笔盖有锉痕',
  observations: ['笔盖锉出一道定位槽，戴湿手套也能单手打开。', '两道水位线刻在观察窗上，都是常用的位置。'],
  recyclePrice: 24,
};
export const careerLog = {
  met: '阿岑 · 初次登门', extend: '阿岑 · 展期先还款', redeemed: '阿岑 · 赎回测盐笔',
  reunion: '阿岑 · 浮田重逢', laundry: '浮田洗衣班 · 验收滤芯', referral: '阿岑 · 带买家上船',
  booking: '浮田洗衣班 · 预约验货', cancel: '浮田洗衣班 · 提前告知缺货', materialJob: '浮田维修班 · 船材工单',
  onboardBooking: '浮田洗衣班 · 预约登船',
  defer: '浮田洗衣班 · 今日改约',
  berth: '认领自有泊位', home: '搬进自有小船', mother: '搬回旧港号', tow: '小船拖航与系泊',
  guest: '补帆工 · 借宿两晚', transfer: '补帆工 · 转介救济站',
  farewell: '补帆工 · 告别', stay: '补帆工 · 自愿留下', mend: '补帆工 · 修补遮篷',
} as const;
export const boatMaterials = [
  { name: '船壳板', price: 24 }, { name: '龙骨', price: 28 }, { name: '旧货架', price: 16 }, { name: '铺盖', price: 10 },
] as const;
export const boatWorks = [
  { name: '安装船壳板', material: 0, fee: 0 }, { name: '安装龙骨', material: 1, fee: 0 },
  { name: '做出干铺位', material: -1, fee: 18 }, { name: '架起船上柜台', material: 2, fee: 12 },
  { name: '添一间客舱', material: 0, fee: 0, bedding: true },
] as const;
export const laundryPrice = 22;
export const materialJobPrice = 32;
export const dwelling = { ration: 2, tow: 5, guestFood: 2 } as const;
export const boatWorkLog = (choice: number) => '小船施工 · ' + boatWorks[choice].name;

export function materialKind(item: Item) {
  const match = /^boat-material-([0-3])-(?:yard|salvage)-\d+$/.exec(item.id);
  return match ? Number(match[1]) : undefined;
}

export function playerBoat(state: Counter) {
  const history = [...state.ledger].reverse();
  const has = (label: string) => history.some((entry) => entry.description === label);
  const complete = boatWorks.map((_, choice) => has(boatWorkLog(choice)));
  const residence = history.find((entry) => entry.description === careerLog.home || entry.description === careerLog.mother);
  const own = complete[2] && residence?.description === careerLog.home;
  const guest = history.find((entry) => entry.description === careerLog.guest);
  const guestEnd = guest && history.some((entry) => entry.day >= guest.day &&
    [careerLog.transfer, careerLog.farewell, careerLog.stay].some((label) => entry.description === label));
  const crew = history.find((entry) => entry.description === careerLog.stay || entry.description === careerLog.transfer)?.description === careerLog.stay;
  const hosting = own && (!!guest && !guestEnd && state.day < guest.day + 2 || crew);
  return { claimed: has(careerLog.berth), complete, own, guest, guestEnd, crew, hosting, mended: has(careerLog.mend) };
}

export function shipNight(state: Counter, day = state.day, boat = playerBoat(state)) {
  const tow = boat.own && !state.ledger.some((entry) => entry.day >= roundStart(day) && entry.day <= day && entry.description === careerLog.tow)
    ? dwelling.tow : 0;
  const hosting = boat.own && (boat.crew || !!boat.guest && !boat.guestEnd && day < boat.guest.day + 2);
  const food = hosting ? dwelling.guestFood : 0;
  return { own: boat.own, tow, food, water: 1 + Number(hosting), cash: (boat.own ? dwelling.ration : berthFee) + tow + food };
}

export function careerVisit(state: Counter) {
  if (!state.ship || state.ship.closed || state.awaitingOpen || state.day < firstOutingDay) return;
  const history = state.ledger;
  const farm = shipStop(state.day).stop.name === '浮田水站';
  const met = history.find((entry) => entry.description === careerLog.met);
  const ticket = state.tickets.find((entry) => entry.id === mechanicTicket);
  const extended = history.some((entry) => entry.description === careerLog.extend);
  if (farm && state.day === roundStart(state.day) && !met) return { kind: 'pawn' } as const;
  if (ticket?.status === 'held' && ticket.dueDay === state.day &&
    !history.some((entry) => entry.description === '阿岑 · 按原约处理')) return { kind: extended ? 'redeem' : 'extend', ticket } as const;
  if (farm && met && ticket?.status !== 'held' && state.day >= met.day + 15 &&
    !history.some((entry) => entry.description === careerLog.reunion)) return { kind: 'reunion', ticket } as const;
}

const isLaundryBooking = (entry: Counter['ledger'][number]) =>
  entry.description === careerLog.booking || entry.description === careerLog.onboardBooking;

export function laundryWindow(state: Counter, start: number) {
  const last = start + 1;
  const entries = state.ledger.filter((entry) => entry.day >= start - 1 && entry.day <= last);
  const receipt = entries.find((entry) => entry.day >= start && entry.description === careerLog.laundry);
  const departure = entries.find((entry) => entry.day === last && entry.description === careerLog.defer);
  const booking = entries.reverse().find((entry) => isLaundryBooking(entry) || entry.description === careerLog.cancel);
  return { last, receipt, booking, departure };
}

export function laundryOrder(state: Counter) {
  if (!state.ship || state.ship.closed || state.day < firstOutingDay) return;
  const history = state.ledger;
  const isSupply = (entry: Counter['ledger'][number]) =>
    entry.description === careerLog.laundry || entry.description === careerLog.materialJob;
  const supplies = history.filter(isSupply);
  const certs = new Set(supplies.map((entry) => roundStart(entry.day)));
  const reunion = history.findIndex((entry) => entry.description === careerLog.reunion);
  const introduction = reunion < 0 ? -1
    : history.slice(0, reunion).some((entry) => entry.description === careerLog.redeemed) ? reunion
    : history.findIndex((entry, index) => index > reunion && isSupply(entry));
  const trusted = introduction >= 0;
  const ship = shipStop(state.day);
  const farm = ship.stop.name === '浮田水站';
  const start = farm ? roundStart(state.day) : ship.nextDay;
  const preview = !farm && ship.next.name === '浮田水站' && state.day + 1 === start && trusted;
  if (!farm && !preview) return;
  const { last, receipt, booking: latest, departure } = laundryWindow(state, start);
  const filled = Boolean(receipt);
  const bookedOnBoat = latest?.description === careerLog.onboardBooking;
  const booked = bookedOnBoat || latest?.description === careerLog.booking;
  const cancelled = latest?.description === careerLog.cancel;
  const deferred = history.some((entry) => entry.day === state.day && entry.description === careerLog.defer);
  const departed = Boolean(departure);
  const lastBooking = history.map((entry) => isLaundryBooking(entry) && entry.day < start - 1).lastIndexOf(true);
  const priorBooking = history[lastBooking];
  const previousWindowEnd = priorBooking && (shipStop(priorBooking.day).stop.name === '浮田水站'
    ? roundStart(priorBooking.day) + 1 : priorBooking.day + 2);
  const restored = !priorBooking || history.slice(lastBooking + 1).some((entry) =>
    isSupply(entry) || entry.description === careerLog.cancel && entry.day <= (previousWindowEnd ?? 0) &&
      !history.some((departure) => departure.day === previousWindowEnd && departure.description === careerLog.defer));
  const firstSupply = supplies[0];
  const priority = restored && (trusted || !!firstSupply && firstSupply.day < start);
  const endorsement = trusted ? history.find((entry, index) => index > introduction && isSupply(entry)) : undefined;
  const onBoat = priority && !!endorsement && endorsement.day < start && playerBoat(state).complete[3];
  return { start, last, certs: certs.size, priority, booked, bookedOnBoat, cancelled, deferred, departed, filled, onBoat, preview,
    introductionDay: history[introduction]?.day, endorsementDay: endorsement?.day, firstSupplyDay: firstSupply?.day,
    prioritySuspended: !restored, active: farm && !state.awaitingOpen && state.day <= last && !filled && !departed };
}

export function ticketExtension(state: Counter, ticket: Ticket) {
  if (ticket.id !== mechanicTicket) return;
  const extension = state.ledger.find((entry) => entry.description === careerLog.extend && entry.itemId === ticket.item.id);
  const loan = state.ledger.find((entry) => entry.description === careerLog.met && entry.itemId === ticket.item.id && entry.change < 0);
  if (!extension || !loan) return;
  const redemption = state.ledger.find((entry) => entry.description === careerLog.redeemed && entry.itemId === ticket.item.id);
  return {
    originalLoan: -loan.change, originalDue: loan.day + 2, currentDue: ticket.dueDay,
    paid: extension.change + (redemption?.change ?? 0), outstanding: ticket.status === 'held' ? ticket.redeemPrice : 0,
  };
}

export function boatBuildMaterials(state: Counter, choice: number) {
  const work = boatWorks[choice];
  if (!work) return [];
  const part = state.inventory.find((item) => work.material === -1 ? cargoKind(item.id) === 0 : materialKind(item) === work.material);
  const materials = [{ name: work.material === -1 ? '舱门密封条' : boatMaterials[work.material].name, item: part }];
  if ('bedding' in work) materials.push({ name: boatMaterials[3].name, item: state.inventory.find((item) => materialKind(item) === 3) });
  return materials;
}

export function boatBuildItems(state: Counter, choice: number) {
  const materials = boatBuildMaterials(state, choice);
  return materials.every(({ item }) => item) ? materials.flatMap(({ item }) => item ? [item] : []) : [];
}
