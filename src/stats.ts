import type { PartnerCard, PlayerState, StyleCard } from "./types"

export type StatParts = {
  base: number
  mods: number
  passive: number
  total: number
}

function sources(player: PlayerState): Array<PartnerCard | StyleCard> {
  return [player.partner, ...player.styles]
}

export function statParts(player: PlayerState, stat: "atk" | "def"): StatParts {
  const base = stat === "atk" ? player.partner.atk : player.partner.def
  const mods = player.styles.reduce(
    (sum, style) => sum + (stat === "atk" ? style.atkMod : style.defMod),
    0,
  )
  let passive = 0
  for (const source of sources(player)) {
    for (const effect of source.effects) {
      if (effect.type === "passive" && effect.stat === stat && player.styles.length >= effect.minStyles) {
        passive += effect.amount
      }
    }
  }
  return { base, mods, passive, total: base + mods + passive }
}

export function attackPower(player: PlayerState): number {
  return statParts(player, "atk").total
}

export function defensePower(player: PlayerState): number {
  return statParts(player, "def").total
}
