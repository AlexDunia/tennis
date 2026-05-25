function getLadderRank(player) {
  return Number(player.ladderRank || player.rank || 9999)
}

function isVeteran(player, veteranAge = 50, currentYear = new Date().getFullYear()) {
  if (typeof player.isVeteran === 'boolean') {
    return player.isVeteran
  }

  return player.birthYear ? currentYear - Number(player.birthYear) >= veteranAge : false
}

function isEligibleForCategory(player, category, options = {}) {
  const eligibility = category.eligibility || {}

  if (eligibility.gender && eligibility.gender !== 'any' && player.gender !== eligibility.gender) {
    return false
  }

  if (eligibility.veteranOnly && !isVeteran(player, options.veteranAge)) {
    return false
  }

  return true
}

function isInLadderRange(player, category) {
  const rank = getLadderRank(player)
  return rank >= Number(category.ladderStart || 1) && rank <= Number(category.ladderEnd || 9999)
}

function toTournamentPlayer(player, category, seed) {
  return {
    playerId: player.id,
    name: player.name,
    ladderRank: getLadderRank(player),
    seed,
    categoryId: category.id,
    categoryName: category.name,
    gender: player.gender || 'unknown',
    birthYear: player.birthYear || null,
    isVeteran: Boolean(player.isVeteran),
    isBye: false,
    assignmentSource: 'auto',
    assignmentWarning: null,
  }
}

export function assignPlayersToCategories({
  players = [],
  categories = [],
  allowSpecialOverlap = true,
  veteranAge = 50,
  manualAssignments = {},
} = {}) {
  const sortedPlayers = [...players].sort((playerOne, playerTwo) => getLadderRank(playerOne) - getLadderRank(playerTwo))
  const usedPlayerIds = new Set()
  const manuallyAssignedPlayerIds = new Set(Object.keys(manualAssignments).filter((playerId) => manualAssignments[playerId]))
  const warnings = []

  const assignments = categories.map((category) => {
    const canOverlap =
      allowSpecialOverlap && category.allowSpecialOverlap && category.assignmentMode === 'eligibility'

    const manualPlayers = sortedPlayers.filter((player) => manualAssignments[player.id] === category.id)
    manualPlayers.forEach((player) => {
      if (!isEligibleForCategory(player, category, { veteranAge })) {
        warnings.push({
          type: 'manual-eligibility',
          categoryId: category.id,
          playerId: player.id,
          message: `${player.name} was manually placed in ${category.name}. Check eligibility before generating.`,
        })
      }

      if (!canOverlap) {
        usedPlayerIds.add(player.id)
      }
    })

    const candidates = sortedPlayers.filter((player) => {
      if (manualAssignments[player.id] === category.id) {
        return false
      }

      if (!canOverlap && usedPlayerIds.has(player.id)) {
        return false
      }

      if (!canOverlap && manuallyAssignedPlayerIds.has(player.id)) {
        return false
      }

      if (!isEligibleForCategory(player, category, { veteranAge })) {
        return false
      }

      if (category.assignmentMode === 'manual-only') {
        return false
      }

      if (category.assignmentMode === 'ladder-range') {
        return isInLadderRange(player, category)
      }

      return true
    })

    const autoSlots = Math.max(
      0,
      Number(category.maxPlayers || category.targetPlayers || candidates.length) - manualPlayers.length,
    )
    const selected = [...manualPlayers, ...candidates.slice(0, autoSlots)]
    const skippedEligibleCount = Math.max(0, candidates.length - autoSlots)

    if (skippedEligibleCount > 0) {
      warnings.push({
        type: 'eligible-overflow',
        categoryId: category.id,
        message: `${category.name} has ${manualPlayers.length + candidates.length} eligible players, but the limit is ${
          category.maxPlayers || category.targetPlayers
        }. Top ${selected.length} by ladder/manual choice are selected; ${skippedEligibleCount} remain unassigned.`,
      })
    }

    selected.forEach((player) => {
      if (!canOverlap) {
        usedPlayerIds.add(player.id)
      }
    })

    if (selected.length === 0) {
      warnings.push({
        type: 'empty-category',
        categoryId: category.id,
        message: `${category.name} has no eligible players yet. Add players, enable overlap, or turn this category off.`,
      })
    }

    return {
      categoryId: category.id,
      category,
      players: selected.map((player, index) => toTournamentPlayer(player, category, index + 1)),
    }
  })

  return {
    assignments,
    warnings,
  }
}

export function getPlayerAssignmentMap(assignments = []) {
  return assignments.reduce((lookup, assignment) => {
    assignment.players.forEach((player) => {
      const existing = lookup[player.playerId] || []
      lookup[player.playerId] = [...existing, assignment.categoryId]
    })
    return lookup
  }, {})
}
