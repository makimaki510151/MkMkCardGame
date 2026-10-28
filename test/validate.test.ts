import { describe, expect, it } from "vitest"
import {
  encore,
  hikari,
  RULES,
  starlightBlade,
  validateDeck,
  validatePartner,
  validateStyle,
  validateSupport,
  type MainCard,
} from "../src/index"
import { partnerCard, styleCard, supportCard } from "./helpers"

describe("短いルールの数値", () => {
  it("文書に書いた数値と一致する", () => {
    expect(RULES).toEqual({
      mainDeckSize: 20,
      initialHand: 4,
      drawPerTurn: 1,
      initialSoul: 2,
      soulGain: 1,
      soulMax: 5,
      maxStyles: 3,
      extraResponseWindows: 1,
    })
  })
})

describe("カードデータ", () => {
  it("作例は構造化した語彙へ割り当てる", () => {
    expect(hikari.effects).toEqual([{ type: "passive", stat: "atk", amount: 1, minStyles: 1 }])
    expect(starlightBlade.effects).toEqual([{ type: "attackOption", soul: 1, flag: "unpreventable" }])
    expect(starlightBlade.atkMod).toBe(2)
    expect(encore.effects).toEqual([{ type: "negateSupport" }, { type: "draw", count: 1 }])
  })

  it("レアリティと特性はフィールドに戻せない", () => {
    expect(() => validatePartner({ ...hikari, rarity: "SSR" })).toThrow(/未定義のフィールド/)
    expect(() => validatePartner({ ...hikari, traits: ["エース"] })).toThrow(/未定義のフィールド/)
  })

  it("パートナーの数値は指示書の範囲だけを受ける", () => {
    expect(() => validatePartner({ ...hikari, title: "" })).not.toThrow()
    for (const life of [15, 20, 25, 30]) {
      expect(() => validatePartner({ ...hikari, life })).not.toThrow()
    }
    for (const life of [10, 18, 31]) {
      expect(() => validatePartner({ ...hikari, life })).toThrow(/ライフ/)
    }
    expect(() => validatePartner({ ...hikari, atk: 0, def: 5 })).not.toThrow()
    expect(() => validatePartner({ ...hikari, atk: 6 })).toThrow(/攻撃/)
    expect(() => validatePartner({ ...hikari, def: -1 })).toThrow(/防御/)
    expect(() => validatePartner({ ...hikari, attribute: "雷" })).toThrow(/属性/)
    expect(() => validatePartner({ ...hikari, name: "" })).toThrow(/カード名/)
    expect(() => validatePartner({ ...hikari, abilityName: "" })).toThrow(/固有能力/)
  })

  it("スタイルとサポートの範囲を外れた値は受けない", () => {
    expect(() => validateStyle({ ...starlightBlade, atkMod: 3, defMod: -2 })).not.toThrow()
    expect(() => validateStyle({ ...starlightBlade, atkMod: 4 })).toThrow(/攻撃修正/)
    expect(() => validateStyle({ ...starlightBlade, defMod: -3 })).toThrow(/防御修正/)
    expect(() => validateStyle({ ...starlightBlade, soul: 6 })).toThrow(/ソウル/)
    expect(() => validateStyle({ ...starlightBlade, keyword: "飛行" })).toThrow(/キーワード/)
    expect(() => validateSupport({ ...encore, timing: "常時" })).toThrow(/タイミング/)
  })

  it("語彙に無い効果と、カード種別に合わない効果は受けない", () => {
    expect(() => validateStyle({ ...starlightBlade, effects: [{ type: "text", text: "勝つ" }] })).toThrow(
      /未定義の効果/,
    )
    expect(() =>
      validateSupport({
        ...encore,
        effects: [{ type: "passive", stat: "atk", amount: 1, minStyles: 1 }],
      }),
    ).toThrow(/サポートに常在修正は載せない/)
    expect(() => validateStyle({ ...starlightBlade, effects: [{ type: "draw", count: 1 }] })).toThrow(
      /ドローはサポートに載せる/,
    )
    expect(() => validatePartner({ ...hikari, effects: [{ type: "negateSupport" }] })).toThrow(
      /無効はサポートに載せる/,
    )
  })

  it("メインデッキはスタイルとサポート20枚で、同名制限はしない", () => {
    const blades = Array.from({ length: 20 }, () => starlightBlade)
    expect(() => validateDeck({ partner: hikari, main: blades })).not.toThrow()
    expect(() => validateDeck({ partner: hikari, main: blades.slice(0, 19) })).toThrow(/20/)
    expect(() => validateDeck({ partner: hikari, main: [...blades, starlightBlade] })).toThrow(/20/)
    const mixed = [hikari, ...blades.slice(0, 19)] as unknown as MainCard[]
    expect(() => validateDeck({ partner: hikari, main: mixed })).toThrow(/スタイルとサポート/)
    expect(() => validateDeck({ partner: partnerCard({ life: 30, atk: 0, def: 5 }), main: blades })).not.toThrow()
  })

  it("テスト用の境界カードも範囲内なら通る", () => {
    expect(() =>
      validateStyle(styleCard({ atkMod: -2, defMod: 3, soul: 5, keyword: "守護", archetype: "耐久" })),
    ).not.toThrow()
    expect(() => validateSupport(supportCard({ timing: "リアクション", subtype: "トラップ", soul: 0 }))).not.toThrow()
  })
})
