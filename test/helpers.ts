import {
  createGame,
  hikari,
  RULES,
  type GameEvent,
  type GameState,
  type MainCard,
  type PartnerCard,
  type PlayerId,
  type StyleCard,
  type SupportCard,
} from "../src/index"

export const keepOrder = (): number => 0.999999

export function styleCard(overrides: Partial<StyleCard> = {}): StyleCard {
  return {
    kind: "style",
    name: "テストのスタイル",
    archetype: "アタッカー",
    category: "武器",
    keyword: "なし",
    soul: 0,
    atkMod: 0,
    defMod: 0,
    effect: "テスト用の効果文",
    effects: [],
    ...overrides,
  }
}

export function supportCard(overrides: Partial<SupportCard> = {}): SupportCard {
  return {
    kind: "support",
    name: "テストのサポート",
    timing: "メイン",
    subtype: "イベント",
    soul: 0,
    target: "自分",
    effect: "テスト用の効果文",
    effects: [],
    ...overrides,
  }
}

export function partnerCard(overrides: Partial<PartnerCard> = {}): PartnerCard {
  return {
    kind: "partner",
    name: "テスト",
    title: "",
    attribute: "星",
    life: 20,
    atk: 2,
    def: 2,
    abilityName: "テスト能力",
    abilityText: "テスト用の能力文",
    effects: [],
    ...overrides,
  }
}

export function fill(top: MainCard[], filler: MainCard): MainCard[] {
  if (top.length > RULES.mainDeckSize) {
    throw new Error(`先頭が${RULES.mainDeckSize}枚を超えている`)
  }
  return [...top, ...Array.from({ length: RULES.mainDeckSize - top.length }, () => filler)]
}

export function gameWith(
  p0: MainCard[] = [],
  p1: MainCard[] = [],
  options: { firstPlayer?: PlayerId; partner?: PartnerCard } = {},
): GameState {
  const filler = styleCard({ name: "埋め草" })
  return createGame({
    players: [
      { partner: options.partner ?? hikari, main: fill(p0, filler) },
      { partner: hikari, main: fill(p1, filler) },
    ],
    firstPlayer: options.firstPlayer,
    rng: keepOrder,
  })
}

export function handIndex(state: GameState, player: PlayerId, name: string): number {
  const index = state.players[player].hand.findIndex((card) => card.name === name)
  if (index < 0) throw new Error(`${name}がプレイヤー${player}の手札にない`)
  return index
}

export function eventsOf<T extends GameEvent["type"]>(
  state: GameState,
  type: T,
): Array<Extract<GameEvent, { type: T }>> {
  return state.events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type)
}

export function countDraws(state: GameState, player: PlayerId): number {
  return eventsOf(state, "draw").filter((event) => event.player === player).length
}
