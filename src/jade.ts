import { voyageRoll } from './outing.ts';

export const stoneFee = 24;
export const lampCost = 26;
export const stoneExpense = '外出 · 旧仓挑石';
export const jadeGrades = {
  rough: { name: '石性重', price: 7 },
  plain: { name: '普通料', price: 19 },
  fine: { name: '好料', price: 42 },
  rare: { name: '精品', price: 120 },
} as const;
export type JadeGrade = keyof typeof jadeGrades;
export type JadeFace = 'edge' | 'split';
export type Jade = { grade: JadeGrade; face: JadeFace; opened: boolean };
export type StoneTrip = { day: number; jade: Jade };
export type CutKind = 'pendants' | 'seal';
export type CutPlacement = { anchor: number; vertical: boolean };

export const cutOrders = {
  pendants: { name: '配对挂坠', limit: 6, fee: 5, rate: 15 },
  seal: { name: '整面印章', limit: 1, fee: 8, rate: 24 },
} as const;

export const stoneOdds = (equipped: boolean) => equipped ? [36, 34, 26, 4] : [45, 32, 20, 3];

export function stoneResult(roll: number, equipped: boolean): JadeGrade {
  const [rough, plain, fine] = stoneOdds(equipped);
  if (roll < rough) return 'rough';
  if (roll < rough + plain) return 'plain';
  if (roll < rough + plain + fine) return 'fine';
  return 'rare';
}

export function pickStone(seed: number, day: number, equipped: boolean): Jade {
  return {
    grade: stoneResult(voyageRoll(seed ^ 0x4e783f29, day, equipped), equipped),
    face: voyageRoll(seed ^ 0x5bf036a1, day, false) < 50 ? 'edge' : 'split',
    opened: false,
  };
}

export function usableCell(face: JadeFace, cell: number) {
  return face === 'edge' ? cell < 12 : cell % 4 !== 1;
}

export function cutCells(kind: CutKind, { anchor, vertical }: CutPlacement) {
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= 16) return [];
  const [width, height] = kind === 'seal' ? [3, 3] : vertical ? [1, 2] : [2, 1];
  if (anchor % 4 + width > 4 || Math.floor(anchor / 4) + height > 4) return [];
  return Array.from({ length: width * height }, (_, index) =>
    anchor + Math.floor(index / width) * 4 + index % width);
}

export function cutQuote(jade: Jade, kind: CutKind, placements: CutPlacement[]) {
  const order = cutOrders[kind];
  if (placements.length === 0 || placements.length > order.limit) return undefined;
  const occupied = new Set<number>();
  for (const placement of placements) {
    const cells = cutCells(kind, placement);
    if (!cells.length || cells.some((cell) => !usableCell(jade.face, cell) || occupied.has(cell))) return undefined;
    for (const cell of cells) occupied.add(cell);
  }
  const payout = Math.floor(jadeGrades[jade.grade].price * occupied.size * order.rate / 160);
  return { cells: occupied.size, fee: order.fee, payout };
}

export function trialCut(jade: Jade, kind: CutKind): CutPlacement[] {
  // On the split face, horizontal pairs leave the isolated column idle.
  const vertical = jade.face === 'split';
  if (kind === 'seal') return jade.face === 'edge' ? [{ anchor: 0, vertical: false }] : [];
  const anchors = vertical ? [0, 2, 3, 8, 10, 11] : [0, 2, 4, 6, 8, 10];
  return anchors.map((anchor) => ({ anchor, vertical }));
}
