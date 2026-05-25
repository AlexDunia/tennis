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
        message: `${draft.name} has no real players. Add players or disable this category before generating.`,
      })
    }

    if (realPlayers.length < Number(category.minPlayers || 1)) {
      warnings.push({
        categoryId: draft.id,
        message: `${draft.name} has ${realPlayers.length} player${
          realPlayers.length === 1 ? '' : 's'
        }. Recommended minimum is ${category.minPlayers}.`,
      })
    }

    if (realPlayers.length > Number(category.maxPlayers || Infinity)) {
      blockers.push({
        categoryId: draft.id,
        message: `${draft.name} has ${realPlayers.length} players. Maximum is ${category.maxPlayers}. Move players out or increase the limit.`,
      })
    }

    if (requiredKnockoutPlayers > 0 && realPlayers.length < requiredKnockoutPlayers) {
      blockers.push({
        categoryId: draft.id,
        message: `${draft.name} needs at least ${requiredKnockoutPlayers} real players for ${category.qualifiersPerGroup}/group knockout qualification. Add players or lower the qualifier count.`,
      })
    }

    if (!category.allowByes && byeCount > 0) {
      blockers.push({
        categoryId: draft.id,
        message: `${draft.name} does not allow BYEs, but ${byeCount} BYE slot${
          byeCount === 1 ? '' : 's'
        } were added.`,
      })
    }

    if (category.allowByes && byeCount > 0) {
      warnings.push({
        categoryId: draft.id,
        message: `${draft.name} will use ${byeCount} BYE slot${byeCount === 1 ? '' : 's'}.`,
      })
    }
  })

  return {
    warnings,
    blockers,
    canGenerate: blockers.length === 0,
  }
}
