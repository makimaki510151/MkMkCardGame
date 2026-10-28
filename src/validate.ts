import { RuleError } from "./errors"
import { RULES } from "./rules"
import type { DeckList, PartnerCard, StyleCard, SupportCard } from "./types"

const ATTRIBUTES = ["星", "炎", "水", "風", "光", "闇"]
const ARCHETYPES = ["アタッカー", "テクニカル", "耐久", "スピード", "サポート"]
const CATEGORIES = ["武器", "コスチューム", "特技", "アクセサリ"]
const KEYWORDS = ["なし", "速攻", "守護", "貫通", "回避", "鼓舞"]
const TIMINGS = ["メイン", "即時", "スタート", "アタック時", "リアクション"]
const SUBTYPES = ["イベント", "アイテム", "オーラ", "トラップ"]
const TARGETS = ["自分のパートナー", "相手のパートナー", "両者のパートナー", "自分", "相手", "場全体"]
const LIVES = [15, 20, 25, 30]

const PARTNER_KEYS = [
  "kind",
  "name",
  "title",
  "attribute",
  "life",
  "atk",
  "def",
  "abilityName",
  "abilityText",
  "effects",
]
const STYLE_KEYS = [
  "kind",
  "name",
  "archetype",
  "category",
  "keyword",
  "soul",
  "atkMod",
  "defMod",
  "effect",
  "effects",
]
const SUPPORT_KEYS = ["kind", "name", "timing", "subtype", "soul", "target", "effect", "effects"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value)
  const extras = actual.filter((key) => !expected.includes(key))
  const missing = expected.filter((key) => !actual.includes(key))
  if (extras.length > 0) {
    throw new RuleError(`${label}に未定義のフィールドがあります: ${extras.join(",")}`)
  }
  if (missing.length > 0) {
    throw new RuleError(`${label}に必要なフィールドがありません: ${missing.join(",")}`)
  }
}

function assertString(value: unknown, field: string, allowEmpty = false): void {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new RuleError(`${field}が空です`)
  }
}

function assertEnum(value: unknown, allowed: readonly string[], field: string): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new RuleError(`${field}が範囲外です`)
  }
}

function assertInt(value: unknown, min: number, max: number, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new RuleError(`${field}が範囲外です`)
  }
}

function assertIntAtLeast(value: unknown, min: number, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new RuleError(`${field}が範囲外です`)
  }
}

function assertAnyInt(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new RuleError(`${field}が範囲外です`)
  }
}

function assertEffects(value: unknown, where: "partner" | "style" | "support"): void {
  if (!Array.isArray(value)) throw new RuleError("効果が配列ではありません")
  for (const effect of value) {
    if (!isRecord(effect) || typeof effect.type !== "string") {
      throw new RuleError("効果が不正です")
    }
    switch (effect.type) {
      case "passive":
        if (where === "support") throw new RuleError("サポートに常在修正は載せない")
        assertKeys(effect, ["type", "stat", "amount", "minStyles"], "常在修正")
        if (effect.stat !== "atk" && effect.stat !== "def") {
          throw new RuleError("常在修正の対象が範囲外です")
        }
        assertAnyInt(effect.amount, "常在修正の値")
        assertIntAtLeast(effect.minStyles, 0, "スタイル枚数の条件")
        break
      case "attackOption":
        if (where !== "style") throw new RuleError("攻撃時の支払いはスタイルに載せる")
        assertKeys(effect, ["type", "soul", "flag"], "攻撃時の支払い")
        assertInt(effect.soul, 0, 5, "攻撃時に払うソウル")
        if (effect.flag !== "unpreventable") throw new RuleError("攻撃時の支払いが範囲外です")
        break
      case "negateSupport":
        if (where !== "support") throw new RuleError("無効はサポートに載せる")
        assertKeys(effect, ["type"], "無効")
        break
      case "draw":
        if (where !== "support") throw new RuleError("ドローはサポートに載せる")
        assertKeys(effect, ["type", "count"], "ドロー")
        assertIntAtLeast(effect.count, 1, "ドロー枚数")
        break
      default:
        throw new RuleError(`未定義の効果です: ${effect.type}`)
    }
  }
}

export function validatePartner(card: unknown): asserts card is PartnerCard {
  if (!isRecord(card)) throw new RuleError("パートナーが不正です")
  assertKeys(card, PARTNER_KEYS, "パートナー")
  if (card.kind !== "partner") throw new RuleError("パートナーではありません")
  assertString(card.name, "カード名")
  assertString(card.title, "二つ名", true)
  assertEnum(card.attribute, ATTRIBUTES, "属性")
  if (!LIVES.includes(card.life as number)) throw new RuleError("ライフが範囲外です")
  assertInt(card.atk, 0, 5, "攻撃")
  assertInt(card.def, 0, 5, "防御")
  assertString(card.abilityName, "固有能力の名前")
  assertString(card.abilityText, "固有能力の文章")
  assertEffects(card.effects, "partner")
}

export function validateStyle(card: unknown): asserts card is StyleCard {
  if (!isRecord(card)) throw new RuleError("スタイルが不正です")
  assertKeys(card, STYLE_KEYS, "スタイル")
  if (card.kind !== "style") throw new RuleError("スタイルではありません")
  assertString(card.name, "カード名")
  assertEnum(card.archetype, ARCHETYPES, "戦い方")
  assertEnum(card.category, CATEGORIES, "種類")
  assertEnum(card.keyword, KEYWORDS, "キーワード")
  assertInt(card.soul, 0, 5, "ソウル")
  assertInt(card.atkMod, -2, 3, "攻撃修正")
  assertInt(card.defMod, -2, 3, "防御修正")
  assertString(card.effect, "効果文")
  assertEffects(card.effects, "style")
}

export function validateSupport(card: unknown): asserts card is SupportCard {
  if (!isRecord(card)) throw new RuleError("サポートが不正です")
  assertKeys(card, SUPPORT_KEYS, "サポート")
  if (card.kind !== "support") throw new RuleError("サポートではありません")
  assertString(card.name, "カード名")
  assertEnum(card.timing, TIMINGS, "タイミング")
  assertEnum(card.subtype, SUBTYPES, "種別")
  assertInt(card.soul, 0, 5, "ソウル")
  assertEnum(card.target, TARGETS, "対象")
  assertString(card.effect, "効果文")
  assertEffects(card.effects, "support")
}

export function validateDeck(deck: unknown): asserts deck is DeckList {
  if (!isRecord(deck)) throw new RuleError("デッキが不正です")
  assertKeys(deck, ["partner", "main"], "デッキ")
  validatePartner(deck.partner)
  if (!Array.isArray(deck.main) || deck.main.length !== RULES.mainDeckSize) {
    throw new RuleError(`メインデッキは${RULES.mainDeckSize}枚です`)
  }
  for (const card of deck.main) {
    if (!isRecord(card) || (card.kind !== "style" && card.kind !== "support")) {
      throw new RuleError("メインデッキに入れられるのはスタイルとサポートだけです")
    }
    if (card.kind === "style") validateStyle(card)
    else validateSupport(card)
  }
}
