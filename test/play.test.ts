import { describe, expect, it } from "vitest"
import {
  applyAction,
  attackPower,
  createGame,
  defensePower,
  encore,
  hikari,
  legalActions,
  starlightBlade,
  statParts,
  type GameState,
  type StyleCard,
} from "../src/index"
import { countDraws, eventsOf, fill, gameWith, handIndex, keepOrder, partnerCard, styleCard, supportCard } from "./helpers"

function play(state: GameState, player: 0 | 1, name: string): GameState {
  return applyAction(state, { type: "playSupport", handIndex: handIndex(state, player, name) })
}

function set(state: GameState, player: 0 | 1, name: string, replaceStyleIndex?: number): GameState {
  return applyAction(state, {
    type: "setStyle",
    handIndex: handIndex(state, player, name),
    replaceStyleIndex,
  })
}

function swing(state: GameState, pay: boolean): GameState {
  const declared = applyAction(state, { type: "declareAttack" })
  const confirmed = applyAction(declared, { type: "confirmAttack", payUnpreventable: pay })
  if (confirmed.phase.name !== "response") {
    throw new Error(`応答の窓が開いていない: ${confirmed.phase.name}`)
  }
  return applyAction(confirmed, { type: "pass" })
}

function lastAttack(state: GameState) {
  const attacks = eventsOf(state, "attack")
  const last = attacks[attacks.length - 1]
  if (last === undefined) throw new Error("攻撃していない")
  return last
}

describe("開始", () => {
  it("パートナーは場にいて、先攻だけターン開始の増加とドローを終えている", () => {
    const state = gameWith(
      [styleCard({ name: "先" })],
      [styleCard({ name: "後" })],
    )
    expect(state.turnPlayer).toBe(0)
    expect(state.phase).toEqual({ name: "main" })
    expect(state.winner).toBeNull()
    expect(state.players[0].partner.name).toBe("星咲 ひかり")
    expect(state.players[1].partner.name).toBe("星咲 ひかり")
    expect(state.players[0].styles).toEqual([])
    expect(state.players[1].styles).toEqual([])
    expect(state.players[0].life).toBe(20)
    expect(state.players[1].life).toBe(20)
    expect(state.players[0].soul).toBe(3)
    expect(state.players[1].soul).toBe(2)
    expect(state.players[0].hand).toHaveLength(5)
    expect(state.players[1].hand).toHaveLength(4)
    expect(state.players[0].hand[0]?.name).toBe("先")
    expect(state.players[1].hand[0]?.name).toBe("後")
    expect(state.players[0].hand.some((card) => card.name === state.players[0].partner.name)).toBe(false)
    expect(state.players[1].hand.some((card) => card.name === state.players[1].partner.name)).toBe(false)
    expect(attackPower(state.players[0])).toBe(2)
    expect(statParts(state.players[0], "atk")).toEqual({ base: 2, mods: 0, passive: 0, total: 2 })
    expect(defensePower(state.players[0])).toBe(2)
  })

  it("先攻を指定すると、そのプレイヤーから始まる", () => {
    const state = gameWith([styleCard({ name: "先" })], [styleCard({ name: "後" })], { firstPlayer: 1 })
    expect(state.turnPlayer).toBe(1)
    expect(state.players[1].hand).toHaveLength(5)
    expect(state.players[0].hand).toHaveLength(4)
    expect(state.players[1].soul).toBe(3)
    expect(state.players[0].soul).toBe(2)
    expect(state.players[1].hand[0]?.name).toBe("後")
  })

  it("山札の順番は渡した乱数に従う", () => {
    const named = (index: number) => styleCard({ name: `刃${index}` })
    const main = Array.from({ length: 20 }, (_, index) => named(index))
    const ordered = createGame({
      players: [
        { partner: hikari, main },
        { partner: hikari, main },
      ],
      rng: keepOrder,
    })
    expect(ordered.players[0].hand.map((card) => card.name)).toEqual(["刃0", "刃1", "刃2", "刃3", "刃4"])

    const shuffled = createGame({
      players: [
        { partner: hikari, main },
        { partner: hikari, main },
      ],
      rng: () => 0,
    })
    expect(shuffled.players[0].hand[0]?.name).not.toBe("刃0")
  })

  it("ライフの初期値はパートナーに書かれた値で、同名カードは20枚入れてよい", () => {
    const sturdy = partnerCard({ name: "厚い", life: 30, atk: 0, def: 5 })
    const state = gameWith([], [], { partner: sturdy })
    expect(state.players[0].life).toBe(30)
    expect(attackPower(state.players[0])).toBe(0)
    expect(defensePower(state.players[0])).toBe(5)

    const blades = fill([], starlightBlade)
    const sameName = createGame({
      players: [
        { partner: hikari, main: blades },
        { partner: hikari, main: blades },
      ],
      rng: keepOrder,
    })
    expect(sameName.players[0].hand.every((card) => card.name === starlightBlade.name)).toBe(true)
  })
})

describe("スタイル", () => {
  it("同じパートナーでも、セットしたスタイルで攻撃と防御が変わる", () => {
    const guard = styleCard({
      name: "テストの守り",
      archetype: "耐久",
      atkMod: -1,
      defMod: 3,
    })
    const asBlade = set(gameWith([starlightBlade]), 0, starlightBlade.name).players[0]
    const asGuard = set(gameWith([guard]), 0, guard.name).players[0]

    expect(asBlade.partner.name).toBe(asGuard.partner.name)
    expect(starlightBlade.archetype).toBe("アタッカー")
    expect(guard.archetype).toBe("耐久")
    expect(statParts(asBlade, "atk")).toEqual({ base: 2, mods: 2, passive: 1, total: 5 })
    expect(statParts(asBlade, "def")).toEqual({ base: 2, mods: 0, passive: 0, total: 2 })
    expect(statParts(asGuard, "atk")).toEqual({ base: 2, mods: -1, passive: 1, total: 2 })
    expect(statParts(asGuard, "def")).toEqual({ base: 2, mods: 3, passive: 0, total: 5 })
  })

  it("効果文は実行しない", () => {
    const liar = styleCard({
      name: "嘘",
      effect: "相手のライフを0にする。",
      effects: [],
    })
    let state = set(gameWith([liar]), 0, "嘘")
    const before = state
    state = swing(state, false)
    expect(before.players[1].life).toBe(20)
    expect(lastAttack(state)).toMatchObject({ damage: 1, atk: 3, def: 2, defenderLife: 19 })
    expect(state.winner).toBeNull()
  })

  it("4枚目は付いている1枚を捨て札へ置いてからセットする", () => {
    const plus = styleCard({ name: "加算", atkMod: 1 })
    const zero = styleCard({ name: "ゼロ", atkMod: 0 })
    let state = gameWith([plus, plus, plus, zero])
    state = set(state, 0, "加算")
    expect(() =>
      applyAction(state, { type: "setStyle", handIndex: handIndex(state, 0, "加算"), replaceStyleIndex: 0 }),
    ).toThrow(/外さなくてよい/)
    state = set(state, 0, "加算")
    state = set(state, 0, "加算")
    expect(state.players[0].styles).toHaveLength(3)
    expect(statParts(state.players[0], "atk").mods).toBe(3)
    expect(() => set(state, 0, "ゼロ")).toThrow(/外すスタイルを選んでください/)
    state = set(state, 0, "ゼロ", 0)
    expect(state.players[0].styles).toHaveLength(3)
    expect(state.players[0].discard.map((card) => card.name)).toEqual(["加算"])
    expect(statParts(state.players[0], "atk")).toEqual({ base: 2, mods: 2, passive: 1, total: 5 })
    expect(state.players[0].partner.name).toBe("星咲 ひかり")
  })
})

describe("ソウル", () => {
  it("自分のターン開始にだけ増え、5で止まる", () => {
    let state = gameWith()
    expect(state.players[0].soul).toBe(3)
    expect(state.players[1].soul).toBe(2)
    state = applyAction(state, { type: "endTurn" })
    state = applyAction(state, { type: "endTurn" })
    expect(state.players[0].soul).toBe(4)
    expect(state.players[1].soul).toBe(3)
    state = applyAction(state, { type: "endTurn" })
    state = applyAction(state, { type: "endTurn" })
    expect(state.players[0].soul).toBe(5)
    expect(state.players[1].soul).toBe(4)
    state = applyAction(state, { type: "endTurn" })
    state = applyAction(state, { type: "endTurn" })
    expect(state.players[0].soul).toBe(5)
    expect(state.players[1].soul).toBe(5)
  })

  it("足りないソウルではスタイルも防げない支払いもできない", () => {
    const expensive = styleCard({ name: "高額", soul: 5 })
    let state = gameWith([expensive])
    expect(() => set(state, 0, "高額")).toThrow(/ソウルが足りません/)
    expect(state.players[0].soul).toBe(3)

    const pricey = styleCard({
      name: "高い刃",
      effects: [{ type: "attackOption", soul: 5, flag: "unpreventable" }],
    })
    state = set(gameWith([pricey]), 0, "高い刃")
    state = applyAction(state, { type: "declareAttack" })
    expect(() => applyAction(state, { type: "confirmAttack", payUnpreventable: true })).toThrow(/ソウルが足りません/)
    expect(state.players[0].soul).toBe(3)
    expect(eventsOf(state, "attack")).toHaveLength(0)
  })
})

describe("アンコール", () => {
  it("対象が無いときは無効が起きず、ドローだけ解決する", () => {
    let state = gameWith([encore])
    const hand = state.players[0].hand.length
    const deck = state.players[0].deck.length
    state = play(state, 0, encore.name)
    expect(legalActions(state).map((action) => action.type)).toEqual(["pass"])
    state = applyAction(state, { type: "pass" })
    expect(eventsOf(state, "negate")).toHaveLength(0)
    expect(state.players[0].hand).toHaveLength(hand)
    expect(state.players[0].deck).toHaveLength(deck - 1)
    expect(state.players[0].soul).toBe(2)
    expect(state.players[0].discard.map((card) => card.name)).toEqual([encore.name])
    expect(state.phase).toEqual({ name: "main" })
  })

  it("応答のアンコールは相手の効果を消し、払ったソウルは戻さない", () => {
    let state = gameWith([encore, starlightBlade], [encore, starlightBlade])
    const draws0 = countDraws(state, 0)
    const draws1 = countDraws(state, 1)
    state = play(state, 0, encore.name)
    expect(state.phase).toEqual({ name: "response", responder: 1, followups: 1 })
    expect(legalActions(state).map((action) => action.type)).toEqual(["pass", "playSupport"])
    state = play(state, 1, encore.name)
    expect(state.phase).toEqual({ name: "response", responder: 0, followups: 0 })
    state = applyAction(state, { type: "pass" })

    expect(eventsOf(state, "negate")).toEqual([{ type: "negate", player: 1, target: encore.name }])
    expect(countDraws(state, 0)).toBe(draws0)
    expect(countDraws(state, 1)).toBe(draws1 + 1)
    expect(state.players[0].soul).toBe(2)
    expect(state.players[1].soul).toBe(1)
    expect(state.players[0].discard.map((card) => card.name)).toEqual([encore.name])
    expect(state.players[1].discard.map((card) => card.name)).toEqual([encore.name])
    expect(state.phase).toEqual({ name: "main" })
  })

  it("元のプレイヤーの切り返しで、間のアンコールだけが無効になる", () => {
    let state = gameWith([encore, encore], [encore])
    state = play(state, 0, encore.name)
    state = play(state, 1, encore.name)
    expect(state.phase).toEqual({ name: "response", responder: 0, followups: 0 })
    const draws0 = countDraws(state, 0)
    const draws1 = countDraws(state, 1)
    state = play(state, 0, encore.name)

    expect(state.phase).toEqual({ name: "main" })
    expect(state.stack).toEqual([])
    expect(eventsOf(state, "negate")).toHaveLength(1)
    expect(countDraws(state, 0)).toBe(draws0 + 2)
    expect(countDraws(state, 1)).toBe(draws1)
    expect(state.players[0].soul).toBe(1)
    expect(state.players[1].soul).toBe(1)
    expect(state.players[0].discard).toHaveLength(2)
    expect(state.players[1].discard).toHaveLength(1)
  })
})

describe("攻撃と防御", () => {
  it("貫通の印だけでは防げなくならず、払ったときだけ防御を引かない", () => {
    expect(starlightBlade.keyword).toBe("貫通")
    let state = set(gameWith([starlightBlade]), 0, starlightBlade.name)
    const spent = state
    expect(state.players[0].soul).toBe(1)
    state = swing(state, false)
    expect(spent.players[1].life).toBe(20)
    expect(spent.players[0].soul).toBe(1)
    expect(lastAttack(state)).toMatchObject({
      damage: 3,
      unpreventable: false,
      atk: 5,
      def: 2,
      defenderLife: 17,
    })
    expect(state.players[0].soul).toBe(1)

    let paid = set(gameWith([starlightBlade]), 0, starlightBlade.name)
    paid = swing(paid, true)
    expect(lastAttack(paid)).toMatchObject({
      damage: 5,
      unpreventable: true,
      atk: 5,
      def: 2,
      defenderLife: 15,
    })
    expect(paid.players[0].soul).toBe(0)
  })

  it("防御修正は防御力へ足され、守護の印だけではダメージが減らない", () => {
    const ward = styleCard({ name: "守護の印だけ", keyword: "守護", defMod: 0 })
    const shield = styleCard({ name: "大盾", keyword: "なし", defMod: 3, archetype: "耐久" })

    const blockedByKeyword = attackInto(ward, false)
    expect(blockedByKeyword).toMatchObject({ damage: 3, def: 2, unpreventable: false, defenderLife: 17 })

    const addedDefense = attackInto(shield, false)
    expect(addedDefense).toMatchObject({ damage: 0, atk: 5, def: 5, unpreventable: false, defenderLife: 20 })

    const ignoredDefense = attackInto(shield, true)
    expect(ignoredDefense).toMatchObject({ damage: 5, atk: 5, def: 5, unpreventable: true, defenderLife: 15 })
  })

  it("属性はダメージを変えない", () => {
    const star = openingStrike(hikari)
    const flame = openingStrike({ ...hikari, attribute: "炎" })
    expect(star).toMatchObject({ damage: 3, atk: 5, def: 2 })
    expect(flame.damage).toBe(star.damage)
    expect(flame.atk).toBe(star.atk)
    expect(flame.def).toBe(star.def)
  })

  it("効果が無いスタイルでは、防げない支払いを選べない", () => {
    let state = set(gameWith([styleCard({ name: "無地" })]), 0, "無地")
    state = applyAction(state, { type: "declareAttack" })
    expect(() => applyAction(state, { type: "confirmAttack", payUnpreventable: true })).toThrow(/効果がない/)
    state = applyAction(state, { type: "cancelAttack" })
    expect(state.phase).toEqual({ name: "main" })
    expect(eventsOf(state, "attack")).toHaveLength(0)
    expect(state.players[1].life).toBe(20)
  })
})

function attackInto(defense: StyleCard, pay: boolean) {
  let state = set(gameWith([starlightBlade], [defense]), 0, starlightBlade.name)
  state = applyAction(state, { type: "endTurn" })
  state = set(state, 1, defense.name)
  state = applyAction(state, { type: "endTurn" })
  state = swing(state, pay)
  return lastAttack(state)
}

function openingStrike(partner: typeof hikari) {
  let state = set(gameWith([starlightBlade], [], { partner }), 0, starlightBlade.name)
  state = swing(state, false)
  return lastAttack(state)
}

describe("タイミング", () => {
  it("スタートはドローのあとに使い、払えないなら窓を開かない", () => {
    const opening = supportCard({
      name: "開始",
      timing: "スタート",
      soul: 3,
      effects: [{ type: "draw", count: 1 }],
    })
    const filler = styleCard({ name: "ただの刃" })
    let state = gameWith([filler, filler, filler, filler, opening])
    expect(state.phase).toEqual({ name: "turnStart" })
    expect(state.players[0].hand.map((card) => card.name)).toContain("開始")
    expect(state.players[0].soul).toBe(3)
    const instant = supportCard({ name: "割込", timing: "即時" })
    const withInstant = gameWith([opening, instant])
    expect(withInstant.phase.name).toBe("turnStart")
    expect(() => play(withInstant, 0, "割込")).toThrow(/使えません/)

    state = play(state, 0, "開始")
    expect(state.phase).toEqual({ name: "response", responder: 1, followups: 1 })
    state = applyAction(state, { type: "pass" })
    expect(state.phase).toEqual({ name: "main" })
    expect(state.players[0].soul).toBe(0)
    expect(state.players[0].deck).toHaveLength(14)
    expect(state.players[0].discard.map((card) => card.name)).toEqual(["開始"])

    const tooCostly = supportCard({ name: "高すぎる", timing: "スタート", soul: 5 })
    const skipped = gameWith([tooCostly])
    expect(skipped.players[0].hand.some((card) => card.name === "高すぎる")).toBe(true)
    expect(skipped.phase).toEqual({ name: "main" })
  })

  it("スタートが残っているあいだは、解決後にターン開始へ戻る", () => {
    const opening = supportCard({ name: "開始", timing: "スタート" })
    let state = gameWith([opening, supportCard({ name: "開始2", timing: "スタート" })])
    expect(state.phase.name).toBe("turnStart")
    state = play(state, 0, "開始")
    state = applyAction(state, { type: "pass" })
    expect(state.phase).toEqual({ name: "turnStart" })
    state = applyAction(state, { type: "pass" })
    expect(state.phase).toEqual({ name: "main" })
    expect(() => play(state, 0, "開始2")).toThrow(/使えません/)
  })

  it("アタック時のサポートは確定前に解決し、攻撃の取り消しでは戻らない", () => {
    const shout = supportCard({
      name: "掛け声",
      timing: "アタック時",
      soul: 1,
      effects: [{ type: "draw", count: 1 }],
    })
    let state = gameWith([shout])
    expect(() => play(state, 0, "掛け声")).toThrow(/使えません/)
    state = applyAction(state, { type: "declareAttack" })
    state = play(state, 0, "掛け声")
    state = applyAction(state, { type: "pass" })
    expect(state.phase).toEqual({ name: "attack" })
    expect(state.players[0].soul).toBe(2)
    expect(state.players[0].discard.map((card) => card.name)).toEqual(["掛け声"])
    expect(eventsOf(state, "attack")).toHaveLength(0)
    state = applyAction(state, { type: "cancelAttack" })
    expect(state.phase).toEqual({ name: "main" })
    expect(state.players[0].soul).toBe(2)
    expect(state.players[1].life).toBe(20)
  })

  it("リアクションは応答だけで使え、メインは応答では使えない", () => {
    const mainCard = supportCard({ name: "本題", timing: "メイン" })
    const reaction = supportCard({
      name: "反応",
      timing: "リアクション",
      effects: [{ type: "draw", count: 1 }],
    })
    expect(() => play(gameWith([reaction]), 0, "反応")).toThrow(/使えません/)

    let state = gameWith([mainCard], [mainCard, reaction])
    state = play(state, 0, "本題")
    expect(() => play(state, 1, "本題")).toThrow(/使えません/)
    const draws = countDraws(state, 1)
    state = play(state, 1, "反応")
    state = applyAction(state, { type: "pass" })
    expect(countDraws(state, 1)).toBe(draws + 1)
    expect(state.phase).toEqual({ name: "main" })
  })

  it("種別が違っても、即時なら同じように使える", () => {
    for (const subtype of ["イベント", "アイテム", "オーラ", "トラップ"] as const) {
      const card = supportCard({
        name: subtype,
        timing: "即時",
        subtype,
        effects: [{ type: "draw", count: 1 }],
      })
      let state = gameWith([card])
      state = play(state, 0, subtype)
      expect(state.phase).toEqual({ name: "response", responder: 1, followups: 1 })
    }
  })
})

describe("山札が尽きても負けにしない", () => {
  it("引くカードが無くてもライフが残っていれば対戦は続く", () => {
    let state = gameWith()
    for (let turn = 0; turn < 15; turn += 1) {
      state = applyAction(state, { type: "endTurn" })
      state = applyAction(state, { type: "endTurn" })
    }
    expect(state.players[0].deck).toHaveLength(0)
    expect(state.winner).toBeNull()
    const draws = countDraws(state, 0)
    state = applyAction(state, { type: "endTurn" })
    state = applyAction(state, { type: "endTurn" })
    expect(state.players[0].deck).toHaveLength(0)
    expect(countDraws(state, 0)).toBe(draws)
    expect(state.winner).toBeNull()
    expect(state.players[0].life).toBe(20)
    expect(state.players[1].life).toBe(20)
  })
})

describe("作例3枚", () => {
  it("開始、セット、攻撃、防御、即時の無効、ドロー、ライフ0まで通る", () => {
    const sample = fill(
      [starlightBlade, encore, starlightBlade, starlightBlade, starlightBlade],
      starlightBlade,
    )
    let state = createGame({
      players: [
        { partner: hikari, main: sample },
        { partner: hikari, main: sample },
      ],
      rng: keepOrder,
    })

    expect(state.players[0].life).toBe(20)
    expect(state.players[1].life).toBe(20)
    expect(state.players[0].styles).toEqual([])
    expect(state.phase).toEqual({ name: "main" })

    const draws0 = countDraws(state, 0)
    const draws1 = countDraws(state, 1)
    state = play(state, 0, encore.name)
    state = play(state, 1, encore.name)
    expect(state.phase).toEqual({ name: "response", responder: 0, followups: 0 })
    state = applyAction(state, { type: "pass" })
    expect(countDraws(state, 0)).toBe(draws0)
    expect(countDraws(state, 1)).toBe(draws1 + 1)
    expect(state.players[0].soul).toBe(2)
    expect(state.players[1].soul).toBe(1)
    expect(eventsOf(state, "negate")).toHaveLength(1)

    const beforeSet = state
    state = set(state, 0, starlightBlade.name)
    expect(beforeSet.players[0].styles).toEqual([])
    expect(statParts(state.players[0], "atk")).toEqual({ base: 2, mods: 2, passive: 1, total: 5 })
    expect(statParts(state.players[0], "def")).toEqual({ base: 2, mods: 0, passive: 0, total: 2 })
    expect(state.players[0].soul).toBe(0)

    const beforeAttack = state
    state = swing(state, false)
    expect(beforeAttack.players[1].life).toBe(20)
    expect(starlightBlade.keyword).toBe("貫通")
    expect(lastAttack(state)).toMatchObject({
      attacker: 0,
      damage: 3,
      unpreventable: false,
      atk: 5,
      def: 2,
      defenderLife: 17,
    })

    state = set(state, 1, starlightBlade.name)
    expect(statParts(state.players[1], "def")).toEqual({ base: 2, mods: 0, passive: 0, total: 2 })
    state = swing(state, false)
    expect(lastAttack(state)).toMatchObject({
      attacker: 1,
      damage: 3,
      unpreventable: false,
      atk: 5,
      def: 2,
      defenderLife: 17,
    })

    const paid = [
      { attacker: 0 as const, life: 12 },
      { attacker: 1 as const, life: 12 },
      { attacker: 0 as const, life: 7 },
      { attacker: 1 as const, life: 7 },
      { attacker: 0 as const, life: 2 },
      { attacker: 1 as const, life: 2 },
      { attacker: 0 as const, life: 0 },
    ]
    for (const step of paid) {
      expect(state.winner).toBeNull()
      expect(state.turnPlayer).toBe(step.attacker)
      state = swing(state, true)
      expect(lastAttack(state)).toMatchObject({
        attacker: step.attacker,
        damage: 5,
        unpreventable: true,
        atk: 5,
        def: 2,
        defenderLife: step.life,
      })
    }

    expect(state.winner).toBe(0)
    expect(state.phase).toEqual({ name: "gameOver" })
    expect(state.players[1].life).toBe(0)
    expect(state.players[0].life).toBe(2)
    expect(state.players[0].partner.name).toBe("星咲 ひかり")
    expect(state.players[1].partner.name).toBe("星咲 ひかり")
    expect(state.players[0].styles.map((card) => card.name)).toEqual([starlightBlade.name])
    expect(state.players[1].styles.map((card) => card.name)).toEqual([starlightBlade.name])
    expect(state.players[0].deck.length).toBeGreaterThan(0)
    expect(eventsOf(state, "win")).toEqual([{ type: "win", player: 0 }])
    expect(() => applyAction(state, { type: "endTurn" })).toThrow(/終わっている/)
  })
})
