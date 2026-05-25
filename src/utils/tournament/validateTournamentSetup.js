export function validateTournamentSetup(categoryDrafts = []) {
  const warnings = []
  const blockers = []

  categoryDrafts.forEach((draft) => {
    const realPlayers = draft.players.filter((player) => !player.isBye)
    const byeCount = draft.players.filter((player) => player.isBye).length
    const category = draft.settings || draft
    const requiredKnockoutPlayers =
      Number(category.qualifiersPerGroup || 0) * Number(category.groupCount || 1)

    if (realPlayers.length === 0) {
      blockers.push({
        categoryId: draft.id,
        message: `${draft.name} has no players yet. Add players or turn this category off.`,
      })
    }

    if (realPlayers.length < Number(category.minPlayers || 1)) {
      warnings.push({
        categoryId: draft.id,
        message: `${draft.name} has ${realPlayers.length} player${
          realPlayers.length === 1 ? '' : 's'
        }. It can run, but ${category.minPlayers}+ feels better.`,
      })
    }

    if (realPlayers.length > Number(category.maxPlayers || Infinity)) {
      blockers.push({
        categoryId: draft.id,
        message: `${draft.name} has ${realPlayers.length} players. Keep ${category.maxPlayers} or fewer, or raise the limit.`,
      })
    }

    if (requiredKnockoutPlayers > 0 && realPlayers.length < requiredKnockoutPlayers) {
      blockers.push({
        categoryId: draft.id,
        message: `${draft.name} needs ${requiredKnockoutPlayers} players for this path. Add players or choose an easier path.`,
      })
    }

    if (!category.allowByes && byeCount > 0) {
      blockers.push({
        categoryId: draft.id,
        message: `${draft.name} does not allow BYEs, but ${byeCount} would be needed.`,
      })
    }

    if (category.allowByes && byeCount > 0) {
      warnings.push({
        categoryId: draft.id,
        message: `${draft.name} will use ${byeCount} BYE${byeCount === 1 ? '' : 's'} (free pass).`,
      })
    }
  })

  return {
    warnings,
    blockers,
    canGenerate: blockers.length === 0,
  }
}
