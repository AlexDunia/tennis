import { createEmptyKnockout } from '../../composables/useBracketBuilder'
import { buildCategoryGroups } from './buildCategoryGroups'
import { RSP_CATEGORY_TEMPLATE_ID } from './categoryTemplates'

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function createTournamentId(name) {
  const base = slugify(name || 'tournament')
  return `${base}-${Date.now()}`
}

export function buildTournamentPayload({
  basics,
  categoryAssignments = [],
  rules = {},
  templateId = RSP_CATEGORY_TEMPLATE_ID,
  assignmentMode = 'auto-with-admin-review',
} = {}) {
  const tournamentId = basics.id || createTournamentId(basics.name)

  const categories = categoryAssignments.map((assignment) => {
    const settings = assignment.category
    const groups = buildCategoryGroups({
      tournamentId,
      category: settings,
      players: assignment.players,
    })
    const players = groups.flatMap((group) => group.players)

    return {
      id: settings.id,
      tournamentId,
      name: settings.name,
      description: settings.description,
      status: 'round-robin',
      source: assignmentMode,
      settings: {
        assignmentMode: settings.assignmentMode,
        targetPlayers: settings.targetPlayers,
        minPlayers: settings.minPlayers,
        maxPlayers: settings.maxPlayers,
        groupCount: settings.groupCount,
        qualifiersPerGroup: settings.qualifiersPerGroup,
        allowByes: settings.allowByes,
        allowSpecialOverlap: settings.allowSpecialOverlap,
        eligibility: settings.eligibility,
      },
      players,
      groups,
      knockout: createEmptyKnockout(tournamentId, settings.id),
    }
  })

  return {
    id: tournamentId,
    name: basics.name,
    description: basics.description,
    status: basics.status || 'active',
    roundRobinStart: basics.roundRobinStart,
    roundRobinEnd: basics.roundRobinEnd,
    knockoutStart: basics.knockoutStart,
    finalDate: basics.finalDate,
    officials: basics.officials,
    categoryTemplateId: templateId,
    assignmentMode,
    rules,
    categories,
  }
}
