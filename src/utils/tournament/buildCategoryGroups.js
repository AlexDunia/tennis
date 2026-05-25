function createByePlayer(categoryId, groupId, byeIndex) {
  return {
    playerId: `bye-${categoryId}-${groupId.toLowerCase()}-${byeIndex}`,
    name: 'BYE',
    ladderRank: null,
    seed: 900 + byeIndex,
    categoryId,
    groupId,
    isBye: true,
    assignmentSource: 'system',
    assignmentWarning: 'Automatic BYE slot',
  }
}

function groupForSnakeSeed(seed, groupCount) {
  const zeroBasedSeed = seed - 1
  const block = Math.floor(zeroBasedSeed / groupCount)
  const position = zeroBasedSeed % groupCount
  const mirroredPosition = block % 2 === 0 ? position : groupCount - 1 - position
  return mirroredPosition
}

function getGroupId(index) {
  return String.fromCharCode(65 + index)
}

export function buildCategoryGroups({ tournamentId, category, players = [] }) {
  const groupCount = category.groupCount || 2
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: getGroupId(index),
    name: `Group ${getGroupId(index)}`,
    categoryId: category.id,
    tournamentId,
    players: [],
    fixtureIds: [],
  }))

  const seededPlayers = [...players].sort((playerOne, playerTwo) => {
    const firstSeed = Number(playerOne.seed || playerOne.ladderRank || 9999)
    const secondSeed = Number(playerTwo.seed || playerTwo.ladderRank || 9999)
    return firstSeed - secondSeed
  })

  seededPlayers.forEach((player, index) => {
    const groupIndex = groupForSnakeSeed(index + 1, groupCount)
    groups[groupIndex].players.push({
      ...player,
      groupId: groups[groupIndex].id,
    })
  })

  if (category.allowByes) {
    const targetSlots = category.targetPlayers || seededPlayers.length
    const byesNeeded = Math.max(0, targetSlots - seededPlayers.length)

    for (let index = 0; index < byesNeeded; index += 1) {
      const smallestGroupIndex = groups.reduce(
        (selectedIndex, group, groupIndex) =>
          group.players.length < groups[selectedIndex].players.length ? groupIndex : selectedIndex,
        0,
      )
      const group = groups[smallestGroupIndex]
      group.players.push(createByePlayer(category.id, group.id, index + 1))
    }
  }

  return groups
}

export function summarizeGroups(groups = []) {
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    playerCount: group.players.filter((player) => !player.isBye).length,
    byeCount: group.players.filter((player) => player.isBye).length,
    players: group.players,
  }))
}
