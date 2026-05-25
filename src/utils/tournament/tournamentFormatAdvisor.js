const FORMAT_DEFINITIONS = {
  'round-robin-only': {
    id: 'round-robin-only',
    name: 'Table decides',
    summary: 'Everyone plays. Best record wins.',
    playerTitle: 'Play everyone. Best record wins.',
    playerSummary: 'No knockout. The table decides.',
    playerPills: ['Play everyone', 'No knockout', 'Best record wins'],
    knockoutFormat: 'round-robin-only',
    groupCount: 1,
    qualifiersPerGroup: 0,
    knockoutSize: 0,
    requiresGroupStage: true,
  },
  'one-group-final': {
    id: 'one-group-final',
    name: 'Top 2 final',
    summary: 'Everyone plays. Top 2 play the final.',
    playerTitle: 'Play everyone. Top 2 reach final.',
    playerSummary: 'You can lose and still reach the final.',
    playerPills: ['Play everyone', 'Lose and continue', 'Final decides'],
    knockoutFormat: 'one-group-final',
    groupCount: 1,
    qualifiersPerGroup: 2,
    knockoutSize: 2,
    requiresGroupStage: true,
  },
  'one-group-semifinals': {
    id: 'one-group-semifinals',
    name: 'Top 4 semifinals',
    summary: 'Everyone plays. Top 4 reach semifinals.',
    playerTitle: 'Play everyone. Top 4 go through.',
    playerSummary: 'You can lose and still qualify.',
    playerPills: ['Play everyone', 'Lose and continue', 'Semis + Final'],
    knockoutFormat: 'one-group-semifinals',
    groupCount: 1,
    qualifiersPerGroup: 4,
    knockoutSize: 4,
    requiresGroupStage: true,
  },
  'two-groups-semifinals': {
    id: 'two-groups-semifinals',
    name: 'Top 2 per group',
    summary: 'Play your group. Top 2 reach semifinals.',
    playerTitle: 'Play your group. Top 2 go through.',
    playerSummary: 'One loss is not fatal. Finish top 2.',
    playerPills: ['Group matches', 'Lose and continue', 'Semis + Final'],
    knockoutFormat: 'two-groups-semifinals',
    groupCount: 2,
    qualifiersPerGroup: 2,
    knockoutSize: 4,
    requiresGroupStage: true,
  },
  'two-groups-quarterfinals': {
    id: 'two-groups-quarterfinals',
    name: 'Top 4 per group',
    summary: 'Play your group. Top 4 reach knockout.',
    playerTitle: 'Play your group. Top 4 go through.',
    playerSummary: 'Most players still get a knockout chance.',
    playerPills: ['Group matches', 'Lose and continue', 'QF + SF + Final'],
    knockoutFormat: 'top4-crossover',
    groupCount: 2,
    qualifiersPerGroup: 4,
    knockoutSize: 8,
    requiresGroupStage: true,
  },
  'four-groups-quarterfinals': {
    id: 'four-groups-quarterfinals',
    name: 'Small groups',
    summary: 'Play a small group. Top 2 reach knockout.',
    playerTitle: 'Play a small group. Top 2 go through.',
    playerSummary: 'Good for a large field.',
    playerPills: ['Small groups', 'Lose and continue', 'QF + SF + Final'],
    knockoutFormat: 'four-groups-quarterfinals',
    groupCount: 4,
    qualifiersPerGroup: 2,
    knockoutSize: 8,
    requiresGroupStage: true,
  },
  'direct-knockout': {
    id: 'direct-knockout',
    name: 'Straight knockout',
    summary: 'Lose once and you are out.',
    playerTitle: 'Straight knockout. Lose once and you are out.',
    playerSummary: 'Fastest path. No guaranteed second match.',
    playerPills: ['Fast draw', 'No second chance', 'Final decides'],
    knockoutFormat: 'direct-knockout',
    groupCount: 0,
    qualifiersPerGroup: 0,
    knockoutSize: 8,
    requiresGroupStage: false,
  },
}

function choice(id, reason, recommended = false) {
  return {
    ...FORMAT_DEFINITIONS[id],
    reason,
    recommended,
  }
}

export function getFormatDefinition(formatId) {
  return FORMAT_DEFINITIONS[formatId] || FORMAT_DEFINITIONS['two-groups-quarterfinals']
}

export function getFormatChoicesForCount(playerCount) {
  if (playerCount <= 0) {
    return []
  }

  if (playerCount <= 3) {
    return [
      choice('round-robin-only', 'Best for very small fields.', true),
      choice('one-group-final', 'Use if the club wants a final.'),
    ]
  }

  if (playerCount === 4) {
    return [
      choice('one-group-final', 'Simple and fair.', true),
      choice('one-group-semifinals', 'Everyone gets a semifinal.'),
      choice('direct-knockout', 'Fastest option.'),
    ]
  }

  if (playerCount <= 7) {
    return [
      choice('one-group-semifinals', 'Best balance for this size.', true),
      choice('two-groups-semifinals', 'Works, but groups may be uneven.'),
      choice('direct-knockout', 'Fast, with BYEs if needed.'),
      choice('round-robin-only', 'Use if the table should decide.'),
    ]
  }

  if (playerCount === 8) {
    return [
      choice('two-groups-semifinals', 'Clean and balanced.', true),
      choice('one-group-semifinals', 'More matches, heavier schedule.'),
      choice('direct-knockout', 'Fast 8-player draw.'),
    ]
  }

  if (playerCount <= 10) {
    return [
      choice('two-groups-semifinals', 'Keeps qualification meaningful.', true),
      choice('two-groups-quarterfinals', 'More players get knockout matches.'),
      choice('direct-knockout', 'Fast, fewer guaranteed matches.'),
    ]
  }

  if (playerCount <= 12) {
    return [
      choice('two-groups-quarterfinals', 'RSP default.', true),
      choice('two-groups-semifinals', 'Shorter knockout.'),
      choice('direct-knockout', 'Fast bracket option.'),
    ]
  }

  if (playerCount <= 16) {
    return [
      choice('four-groups-quarterfinals', 'Best for larger fields.', true),
      choice('two-groups-quarterfinals', 'Works, but groups are larger.'),
      choice('direct-knockout', 'Fast bracket option.'),
    ]
  }

  return [
    choice('four-groups-quarterfinals', 'Best standard option here.', true),
    choice('direct-knockout', 'Fast option for a large field.'),
  ]
}

export function recommendFormatForCount(playerCount) {
  return getFormatChoicesForCount(playerCount).find((format) => format.recommended) || null
}

export function applyFormatToCategory(category, format, playerCount) {
  const definition = typeof format === 'string' ? getFormatDefinition(format) : format

  return {
    ...category,
    formatId: definition.id,
    formatName: definition.name,
    formatSummary: definition.summary,
    playerTitle: definition.playerTitle,
    playerSummary: definition.playerSummary,
    playerPills: definition.playerPills,
    knockoutFormat: definition.knockoutFormat,
    groupCount: definition.groupCount,
    qualifiersPerGroup: definition.qualifiersPerGroup,
    knockoutSize: definition.knockoutSize,
    requiresGroupStage: definition.requiresGroupStage,
    targetPlayers: playerCount,
    settings: {
      ...(category.settings || {}),
      formatId: definition.id,
      formatName: definition.name,
      formatSummary: definition.summary,
      playerTitle: definition.playerTitle,
      playerSummary: definition.playerSummary,
      playerPills: definition.playerPills,
      knockoutFormat: definition.knockoutFormat,
      groupCount: definition.groupCount,
      qualifiersPerGroup: definition.qualifiersPerGroup,
      knockoutSize: definition.knockoutSize,
      requiresGroupStage: definition.requiresGroupStage,
    },
  }
}
