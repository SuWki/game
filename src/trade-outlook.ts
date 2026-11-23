import { floatFarmRequest, isShortRope, nextRopeContact, ropeVisit, ropeVisitPrice, salvageMarket, workshopOpen,
  type Action, type Counter } from './counter.ts';
import { laundryOrder, laundryPrice } from './career.ts';
import { filterOffer } from './outing.ts';
import { cratePartPrice, waterStartDay, type Item } from './scenario.ts';
import { cargoKind, floatFarmOrder, shipSaleQuote, shipStop } from './ship.ts';

export function tradeOutlook(state: Counter, item: Item) {
  if (!state.ship || state.ship.closed || state.awaitingOpen) return;
  const shore = shipSaleQuote(state.day, item);
  const cargo = cargoKind(item.id);
  const shortRope = isShortRope(item);
  const farm = cargo === floatFarmOrder.kind && floatFarmRequest(state);
  const laundry = item.filter && laundryOrder(state);
  const rope = shortRope && ropeVisit(state);
  const nextContact = shortRope && nextRopeContact(state);
  const target = { day: state.day, itemId: item.id };
  const cashOffers: { buyer: string; price: number; action: Action }[] = [];
  if (shore) cashOffers.push({ buyer: '岸商', price: shore.bid, action: { ...target, type: 'sellCargo' } });
  if (state.day >= waterStartDay && item.recyclePrice !== undefined) {
    cashOffers.push({ buyer: '回收商', price: item.recyclePrice, action: { ...target, type: 'recycle' } });
  }
  if (item.filter && workshopOpen(state)) {
    cashOffers.push({ buyer: '设备货商', price: filterOffer(item.filter), action: { ...target, type: 'sellFilter' } });
  }
  if (shortRope && salvageMarket(state)?.canSell) {
    cashOffers.push({ buyer: '货棚', price: cratePartPrice(item), action: { ...target, type: 'sellCrateGoods' } });
  }
  const cash = cashOffers.sort((a, b) => b.price - a.price)[0];
  let buyer: { name: string; price: number; when: string; reason: string; action?: Action; blocked?: boolean } | undefined;
  if (farm && state.day <= floatFarmOrder.last && (state.day < floatFarmOrder.first || farm.active)) {
    buyer = { name: '浮田维修班', price: floatFarmOrder.price, when: farm.active ? '今天可交' : `第 ${floatFarmOrder.first} 天起`,
      reason: `种植舱漏水，需换一件密封条。第 ${floatFarmOrder.last} 天截止。`,
      action: farm.active ? { ...target, type: 'deliverFloatFarmSeal' } : undefined };
  } else if (rope && (rope.canBook || rope.today || rope.pending)) {
    const due = rope.dueDay;
    buyer = { name: '搬运班', price: ropeVisitPrice, when: rope.today ? '今天验货'
      : due ? `第 ${due} 天验货` : `现在可约第 ${state.day + 1} 天`,
      reason: '盐霜短绳能截开捆菜筐。约好后在柜台验一盘。',
      action: rope.canBook ? { type: 'bookRopeVisit', day: state.day } : undefined };
  } else if (nextContact) {
    buyer = { name: '搬运班', price: ropeVisitPrice, when: `第 ${nextContact} 天起可联系`,
      reason: `伙计提过他们缺捆菜筐的短绳。最早第 ${nextContact + 1} 天验货。` };
  } else if (laundry && (laundry.active || laundry.preview)) {
    const eligible = (item.filter?.remaining ?? 0) >= 2;
    const nextVisit = laundry.preview ? laundry.start : laundry.deferred && laundry.bookedOnBoat ? state.day + 1 : state.day;
    buyer = { name: '浮田洗衣班', price: laundryPrice, blocked: !eligible,
      when: !eligible ? '余次不足' : nextVisit > state.day ? `第 ${nextVisit} 天起` : '今天收货',
      reason: `洗两趟衣物，限收一枚至少余两次的滤芯。第 ${laundry.last} 天截止。${laundry.bookedOnBoat ? '已约在自有船验货。' : ''}`,
      action: eligible && laundry.active && !laundry.bookedOnBoat
        ? { ...target, type: 'career', task: 'laundry' } : undefined };
  } else if (shore && cargo !== undefined && shore.nextBid > shore.bid) {
    const { next, nextDay } = shipStop(state.day);
    buyer = { name: next.name, price: shore.nextBid, when: `第 ${nextDay} 天靠泊`,
      reason: `等 ${nextDay - state.day} 晚，期间仍要备齐生活开销。` };
  }
  return { cash, buyer };
}
