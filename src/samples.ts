import type { PartnerCard, StyleCard, SupportCard } from "./types"
import { validatePartner, validateStyle, validateSupport } from "./validate"

function freeze<T extends { effects: readonly object[] }>(card: T): T {
  for (const effect of card.effects) Object.freeze(effect)
  Object.freeze(card.effects)
  return Object.freeze(card)
}

const hikariCard: PartnerCard = {
  kind: "partner",
  name: "星咲 ひかり",
  title: "一番星のエース",
  attribute: "星",
  life: 20,
  atk: 2,
  def: 2,
  abilityName: "スターライト",
  abilityText: "スタイルが1枚以上ついているなら、このパートナーの攻撃は+1される。",
  effects: [{ type: "passive", stat: "atk", amount: 1, minStyles: 1 }],
}

// 効果文の「攻撃+2」は atkMod と同じ加算なので、effects には入れない。
const bladeCard: StyleCard = {
  kind: "style",
  name: "スターライト・ブレード",
  archetype: "アタッカー",
  category: "武器",
  keyword: "貫通",
  soul: 2,
  atkMod: 2,
  defMod: 0,
  effect: "このパートナーの攻撃+2。アタック時、ソウルを1支払うと、その攻撃は防げない。",
  effects: [{ type: "attackOption", soul: 1, flag: "unpreventable" }],
}

const encoreCard: SupportCard = {
  kind: "support",
  name: "アンコール",
  timing: "即時",
  subtype: "イベント",
  soul: 1,
  target: "相手",
  effect: "相手がたった今使ったサポート1枚の効果を無効にする。その後、自分はカードを1枚引く。",
  effects: [{ type: "negateSupport" }, { type: "draw", count: 1 }],
}

validatePartner(hikariCard)
validateStyle(bladeCard)
validateSupport(encoreCard)

export const hikari = freeze(hikariCard)
export const starlightBlade = freeze(bladeCard)
export const encore = freeze(encoreCard)
