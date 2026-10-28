// 数値の正本は docs/短いルール.md。ここを変えるときは文書とテストも揃える。
export const RULES = {
  mainDeckSize: 20,
  initialHand: 4,
  drawPerTurn: 1,
  initialSoul: 2,
  soulGain: 1,
  soulMax: 5,
  maxStyles: 3,
  extraResponseWindows: 1,
} as const
