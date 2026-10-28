// 対戦の手順は docs/短いルール.md。効果文の文字列はここでは読まない。
import { RuleError } from "./errors"
import { RULES } from "./rules"
import { attackPower, defensePower } from "./stats"
import type { DeckList, MainCard, PlayerId, PlayerState, SupportCard } from "./types"
import { validateDeck } from "./validate"

export type { PlayerId, PlayerState }

export type Phase =
  | { name: "turnStart" }
  | { name: "main" }
  | { name: "attack" }
  | { name: "response"; responder: PlayerId; followups: number }
  | { name: "gameOver" }

export type Action =
  | { type: "pass" }
  | { type: "endTurn" }
  | { type: "declareAttack" }
  | { type: "cancelAttack" }
  | { type: "confirmAttack"; payUnpreventable: boolean }
  | { type: "setStyle"; handIndex: number; replaceStyleIndex?: number }
  | { type: "playSupport"; handIndex: number }

export type GameEvent =
  | { type: "turn"; player: PlayerId; soul: number }
  | { type: "draw"; player: PlayerId; name: string }
  | { type: "setStyle"; player: PlayerId; name: string; replaced?: string }
  | { type: "play"; player: PlayerId; name: string }
  | { type: "negate"; player: PlayerId; target: string }
  | {
      type: "attack"
      attacker: PlayerId
      damage: number
      unpreventable: boolean
      atk: number
      def: number
      defenderLife: number
    }
  | { type: "win"; player: PlayerId }

type StackItem =
  | { kind: "support"; player: PlayerId; card: SupportCard; negated: boolean }
  | { kind: "attack"; player: PlayerId; unpreventable: boolean }

export type GameState = {
  players: [PlayerState, PlayerState]
  turnPlayer: PlayerId
  phase: Phase
  stack: StackItem[]
  returnPhase: "turnStart" | "main" | "attack" | null
  winner: PlayerId | null
  events: GameEvent[]
}

export type CreateGameInput = {
  players: [DeckList, DeckList]
  firstPlayer?: PlayerId
  rng?: () => number
}

function other(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0
}

function assertNever(value: never): never {
  throw new RuleError(`未対応の操作です: ${JSON.stringify(value)}`)
}

function withPlayer(state: GameState, player: PlayerId, nextPlayer: PlayerState): GameState {
  const players: [PlayerState, PlayerState] = [state.players[0], state.players[1]]
  players[player] = nextPlayer
  return { ...state, players }
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const next = items.slice()
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const current = next[i]
    next[i] = next[j] as T
    next[j] = current as T
  }
  return next
}

function freshPlayer(deck: DeckList, rng: () => number): PlayerState {
  return {
    partner: deck.partner,
    styles: [],
    deck: shuffle(deck.main, rng),
    hand: [],
    discard: [],
    soul: RULES.initialSoul,
    life: deck.partner.life,
  }
}

function actor(state: GameState): PlayerId {
  if (state.phase.name === "response") return state.phase.responder
  return state.turnPlayer
}

function drawCards(state: GameState, player: PlayerId, count: number): GameState {
  let next = state
  for (let n = 0; n < count; n += 1) {
    const current = next.players[player]
    const top = current.deck[0]
    if (top === undefined) break
    next = withPlayer(next, player, {
      ...current,
      deck: current.deck.slice(1),
      hand: [...current.hand, top],
    })
    next = { ...next, events: [...next.events, { type: "draw", player, name: top.name }] }
  }
  return next
}

function canPlayStart(state: GameState): boolean {
  const player = state.players[state.turnPlayer]
  return player.hand.some(
    (card) => card.kind === "support" && card.timing === "スタート" && card.soul <= player.soul,
  )
}

function settlePhase(state: GameState): GameState {
  if (state.winner !== null) return { ...state, phase: { name: "gameOver" } }
  if (state.phase.name === "turnStart" && !canPlayStart(state)) {
    return { ...state, phase: { name: "main" } }
  }
  return state
}

function beginTurn(state: GameState, player: PlayerId): GameState {
  const current = state.players[player]
  const soul = Math.min(RULES.soulMax, current.soul + RULES.soulGain)
  let next = withPlayer(state, player, { ...current, soul })
  next = {
    ...next,
    turnPlayer: player,
    stack: [],
    returnPhase: null,
    phase: { name: "turnStart" },
    events: [...next.events, { type: "turn", player, soul }],
  }
  next = drawCards(next, player, RULES.drawPerTurn)
  return settlePhase(next)
}

export function createGame(input: CreateGameInput): GameState {
  const first = input.firstPlayer ?? 0
  if (first !== 0 && first !== 1) throw new RuleError("先攻が不正です")
  validateDeck(input.players[0])
  validateDeck(input.players[1])
  const rng = input.rng ?? Math.random
  const state: GameState = {
    players: [freshPlayer(input.players[0], rng), freshPlayer(input.players[1], rng)],
    turnPlayer: first,
    phase: { name: "main" },
    stack: [],
    returnPhase: null,
    winner: null,
    events: [],
  }
  return beginTurn(drawCards(drawCards(state, first, RULES.initialHand), other(first), RULES.initialHand), first)
}

function unpreventableCost(player: PlayerState): number | null {
  let found = false
  let cost = 0
  for (const style of player.styles) {
    for (const effect of style.effects) {
      if (effect.type === "attackOption" && effect.flag === "unpreventable") {
        found = true
        cost += effect.soul
      }
    }
  }
  return found ? cost : null
}

function payUnpreventableReason(player: PlayerState): string | null {
  const cost = unpreventableCost(player)
  if (cost === null) return "防げない攻撃にするための効果がない"
  if (player.soul < cost) return "ソウルが足りません"
  return null
}

function timingAllows(state: GameState, card: SupportCard): boolean {
  switch (state.phase.name) {
    case "turnStart":
      return card.timing === "スタート"
    case "main":
      return card.timing === "メイン" || card.timing === "即時"
    case "attack":
      return card.timing === "アタック時"
    case "response":
      return card.timing === "即時" || card.timing === "リアクション"
    case "gameOver":
      return false
    default:
      return assertNever(state.phase)
  }
}

function indexedCard(state: GameState, handIndex: number): { card: MainCard } | string {
  if (!Number.isInteger(handIndex) || handIndex < 0) return "そのカードはない"
  const card = state.players[actor(state)].hand[handIndex]
  if (card === undefined) return "そのカードはない"
  return { card }
}

function setStyleReason(state: GameState, handIndex: number, replaceStyleIndex: number | undefined): string | null {
  if (state.phase.name !== "main") return "その操作は今はできない"
  const found = indexedCard(state, handIndex)
  if (typeof found === "string") return found
  if (found.card.kind !== "style") return "スタイルではない"
  const player = state.players[state.turnPlayer]
  if (player.soul < found.card.soul) return "ソウルが足りません"
  if (player.styles.length >= RULES.maxStyles) {
    if (replaceStyleIndex === undefined) return "外すスタイルを選んでください"
    if (!Number.isInteger(replaceStyleIndex) || player.styles[replaceStyleIndex] === undefined) {
      return "外すスタイルがありません"
    }
    return null
  }
  if (replaceStyleIndex !== undefined) return "まだスタイルを外さなくてよい"
  return null
}

function playSupportReason(state: GameState, handIndex: number): string | null {
  const found = indexedCard(state, handIndex)
  if (typeof found === "string") return found
  if (found.card.kind !== "support") return "サポートではない"
  if (!timingAllows(state, found.card)) return "そのカードは今は使えません"
  if (state.players[actor(state)].soul < found.card.soul) return "ソウルが足りません"
  return null
}

export function rejectionReason(state: GameState, action: Action): string | null {
  if (state.winner !== null || state.phase.name === "gameOver") return "対戦は終わっている"
  if (state.phase.name !== "response" && state.stack.length > 0) return "解決中です"
  switch (action.type) {
    case "pass":
      if (state.phase.name !== "turnStart" && state.phase.name !== "response") {
        return "その操作は今はできない"
      }
      return null
    case "endTurn":
      if (state.phase.name !== "main") return "その操作は今はできない"
      return null
    case "declareAttack":
      if (state.phase.name !== "main") return "その操作は今はできない"
      return null
    case "cancelAttack":
      if (state.phase.name !== "attack") return "その操作は今はできない"
      return null
    case "confirmAttack":
      if (state.phase.name !== "attack") return "その操作は今はできない"
      if (!action.payUnpreventable) return null
      return payUnpreventableReason(state.players[state.turnPlayer])
    case "setStyle":
      return setStyleReason(state, action.handIndex, action.replaceStyleIndex)
    case "playSupport":
      return playSupportReason(state, action.handIndex)
    default:
      return assertNever(action)
  }
}

function candidates(state: GameState): Action[] {
  if (state.winner !== null || state.phase.name === "gameOver") return []
  const actions: Action[] = []
  if (state.phase.name === "turnStart" || state.phase.name === "response") {
    actions.push({ type: "pass" })
  }
  if (state.phase.name === "main") {
    actions.push({ type: "endTurn" }, { type: "declareAttack" })
  }
  if (state.phase.name === "attack") {
    actions.push(
      { type: "cancelAttack" },
      { type: "confirmAttack", payUnpreventable: false },
      { type: "confirmAttack", payUnpreventable: true },
    )
  }
  const hand = state.players[actor(state)].hand
  const styles = state.players[actor(state)].styles
  for (let handIndex = 0; handIndex < hand.length; handIndex += 1) {
    const card = hand[handIndex]
    if (card === undefined) continue
    if (card.kind === "support") actions.push({ type: "playSupport", handIndex })
    if (card.kind === "style" && state.phase.name === "main") {
      if (styles.length >= RULES.maxStyles) {
        for (let replaceStyleIndex = 0; replaceStyleIndex < styles.length; replaceStyleIndex += 1) {
          actions.push({ type: "setStyle", handIndex, replaceStyleIndex })
        }
      } else {
        actions.push({ type: "setStyle", handIndex })
      }
    }
  }
  return actions
}

export function legalActions(state: GameState): Action[] {
  return candidates(state).filter((action) => rejectionReason(state, action) === null)
}

function negateLatest(state: GameState, player: PlayerId): GameState {
  const stack = state.stack.slice()
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const item = stack[i]
    if (item !== undefined && item.kind === "support" && item.player !== player && !item.negated) {
      stack[i] = { ...item, negated: true }
      return {
        ...state,
        stack,
        events: [...state.events, { type: "negate", player, target: item.card.name }],
      }
    }
  }
  return state
}

function applySpell(state: GameState, player: PlayerId, card: SupportCard): GameState {
  let next = state
  for (const effect of card.effects) {
    if (effect.type === "negateSupport") next = negateLatest(next, player)
    else next = drawCards(next, player, effect.count)
  }
  return next
}

function moveToDiscard(state: GameState, player: PlayerId, card: MainCard): GameState {
  const current = state.players[player]
  return withPlayer(state, player, { ...current, discard: [...current.discard, card] })
}

function resolveAttack(state: GameState, item: Extract<StackItem, { kind: "attack" }>): GameState {
  const defender = other(item.player)
  const atk = attackPower(state.players[item.player])
  const def = defensePower(state.players[defender])
  const damage = item.unpreventable ? Math.max(0, atk) : Math.max(0, atk - def)
  const life = Math.max(0, state.players[defender].life - damage)
  let next = withPlayer(state, defender, { ...state.players[defender], life })
  next = {
    ...next,
    events: [
      ...next.events,
      {
        type: "attack",
        attacker: item.player,
        damage,
        unpreventable: item.unpreventable,
        atk,
        def,
        defenderLife: life,
      },
    ],
  }
  if (life === 0) {
    next = {
      ...next,
      winner: item.player,
      events: [...next.events, { type: "win", player: item.player }],
    }
  }
  return next
}

function resolveStack(state: GameState): GameState {
  let next = state
  let resolvedAttack = false
  while (next.stack.length > 0 && next.winner === null) {
    const item = next.stack[next.stack.length - 1]
    if (item === undefined) break
    next = { ...next, stack: next.stack.slice(0, -1) }
    if (item.kind === "support") {
      if (!item.negated) next = applySpell(next, item.player, item.card)
      next = moveToDiscard(next, item.player, item.card)
    } else {
      next = resolveAttack(next, item)
      resolvedAttack = true
    }
  }
  if (next.winner !== null) {
    return { ...next, phase: { name: "gameOver" }, stack: [], returnPhase: null }
  }
  if (resolvedAttack) return beginTurn(next, other(next.turnPlayer))
  if (next.returnPhase === null) throw new RuleError("内部状態が壊れている")
  return settlePhase({ ...next, phase: { name: next.returnPhase }, returnPhase: null })
}

function openOrResolve(state: GameState, playedBy: PlayerId): GameState {
  if (state.phase.name === "response") {
    if (state.phase.followups > 0) {
      return {
        ...state,
        phase: {
          name: "response",
          responder: other(playedBy),
          followups: state.phase.followups - 1,
        },
      }
    }
    return resolveStack(state)
  }
  if (state.phase.name === "gameOver") throw new RuleError("内部状態が壊れている")
  return {
    ...state,
    returnPhase: state.phase.name,
    phase: {
      name: "response",
      responder: other(playedBy),
      followups: RULES.extraResponseWindows,
    },
  }
}

function pass(state: GameState): GameState {
  if (state.phase.name === "turnStart") return { ...state, phase: { name: "main" } }
  if (state.phase.name === "response") return resolveStack(state)
  throw new RuleError("内部状態が壊れている")
}

function setStyle(state: GameState, handIndex: number, replaceStyleIndex: number | undefined): GameState {
  const player = state.turnPlayer
  const current = state.players[player]
  const hand = current.hand.slice()
  const card = hand[handIndex]
  if (card === undefined || card.kind !== "style") throw new RuleError("内部状態が壊れている")
  hand.splice(handIndex, 1)
  const styles = current.styles.slice()
  let discard = current.discard
  let replaced: string | undefined
  if (replaceStyleIndex !== undefined) {
    const removed = styles[replaceStyleIndex]
    if (removed === undefined) throw new RuleError("内部状態が壊れている")
    styles.splice(replaceStyleIndex, 1)
    discard = [...discard, removed]
    replaced = removed.name
  }
  const nextPlayer: PlayerState = {
    ...current,
    hand,
    styles: [...styles, card],
    discard,
    soul: current.soul - card.soul,
  }
  const event: GameEvent = replaced
    ? { type: "setStyle", player, name: card.name, replaced }
    : { type: "setStyle", player, name: card.name }
  return { ...withPlayer(state, player, nextPlayer), events: [...state.events, event] }
}

function playSupport(state: GameState, handIndex: number): GameState {
  const player = actor(state)
  const current = state.players[player]
  const hand = current.hand.slice()
  const card = hand[handIndex]
  if (card === undefined || card.kind !== "support") throw new RuleError("内部状態が壊れている")
  hand.splice(handIndex, 1)
  let next = withPlayer(state, player, { ...current, hand, soul: current.soul - card.soul })
  next = {
    ...next,
    stack: [...next.stack, { kind: "support", player, card, negated: false }],
    events: [...next.events, { type: "play", player, name: card.name }],
  }
  return openOrResolve(next, player)
}

function confirmAttack(state: GameState, pay: boolean): GameState {
  const player = state.turnPlayer
  let next = state
  let unpreventable = false
  if (pay) {
    const cost = unpreventableCost(state.players[player])
    if (cost === null) throw new RuleError("内部状態が壊れている")
    const current = next.players[player]
    next = withPlayer(next, player, { ...current, soul: current.soul - cost })
    unpreventable = true
  }
  next = { ...next, stack: [...next.stack, { kind: "attack", player, unpreventable }] }
  return openOrResolve(next, player)
}

function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "pass":
      return pass(state)
    case "endTurn":
      return beginTurn(state, other(state.turnPlayer))
    case "declareAttack":
      return { ...state, phase: { name: "attack" } }
    case "cancelAttack":
      return { ...state, phase: { name: "main" } }
    case "confirmAttack":
      return confirmAttack(state, action.payUnpreventable)
    case "setStyle":
      return setStyle(state, action.handIndex, action.replaceStyleIndex)
    case "playSupport":
      return playSupport(state, action.handIndex)
    default:
      return assertNever(action)
  }
}

export function applyAction(state: GameState, action: Action): GameState {
  const reason = rejectionReason(state, action)
  if (reason !== null) throw new RuleError(reason)
  return reduce(state, action)
}
