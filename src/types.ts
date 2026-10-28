export type Attribute = "星" | "炎" | "水" | "風" | "光" | "闇"
export type Archetype = "アタッカー" | "テクニカル" | "耐久" | "スピード" | "サポート"
export type StyleCategory = "武器" | "コスチューム" | "特技" | "アクセサリ"
export type Keyword = "なし" | "速攻" | "守護" | "貫通" | "回避" | "鼓舞"
export type Timing = "メイン" | "即時" | "スタート" | "アタック時" | "リアクション"
export type SupportSubtype = "イベント" | "アイテム" | "オーラ" | "トラップ"
export type SupportTarget =
  | "自分のパートナー"
  | "相手のパートナー"
  | "両者のパートナー"
  | "自分"
  | "相手"
  | "場全体"

export type PassiveEffect = {
  type: "passive"
  stat: "atk" | "def"
  amount: number
  minStyles: number
}

export type AttackOptionEffect = {
  type: "attackOption"
  soul: number
  flag: "unpreventable"
}

export type NegateSupportEffect = {
  type: "negateSupport"
}

export type DrawEffect = {
  type: "draw"
  count: number
}

export type Effect = PassiveEffect | AttackOptionEffect | NegateSupportEffect | DrawEffect

export type PartnerCard = {
  kind: "partner"
  name: string
  title: string
  attribute: Attribute
  life: number
  atk: number
  def: number
  abilityName: string
  abilityText: string
  effects: PassiveEffect[]
}

export type StyleCard = {
  kind: "style"
  name: string
  archetype: Archetype
  category: StyleCategory
  keyword: Keyword
  soul: number
  atkMod: number
  defMod: number
  effect: string
  effects: Array<PassiveEffect | AttackOptionEffect>
}

export type SupportCard = {
  kind: "support"
  name: string
  timing: Timing
  subtype: SupportSubtype
  soul: number
  target: SupportTarget
  effect: string
  effects: Array<NegateSupportEffect | DrawEffect>
}

export type MainCard = StyleCard | SupportCard

export type DeckList = {
  partner: PartnerCard
  main: MainCard[]
}

export type PlayerId = 0 | 1

export type PlayerState = {
  partner: PartnerCard
  styles: StyleCard[]
  deck: MainCard[]
  hand: MainCard[]
  discard: MainCard[]
  soul: number
  life: number
}
