import {
  createEmptyKnockout,
  generateDirectKnockout,
  progressKnockout,
} from '../../composables/useBracketBuilder'
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
  if (!categoryAssignments.length) {
    throw new Error('Create at least one tournament category before generating.')
  }

  const tournamentId = basics.id || createTournamentId(basics.name)

  const categories = categoryAssignments.map((assignment) => {
    const settings = assignment.category
    const groups = buildCategoryGroups({
      tournamentId,
      category: settings,
      players: assignment.players,
    })
    const players = groups.flatMap((group) => group.players)
    const allPlayers = settings.requiresGroupStage === false ? assignment.players : players
    const emptyKnockout = createEmptyKnockout(
      tournamentId,
      settings.id,
      settings.knockoutFormat || settings.settings?.knockoutFormat,
    )
    const seededDirectKnockout =
      settings.requiresGroupStage === false
        ? progressKnockout({
            id: settings.id,
            tournamentId,
            status: 'knockout',
            knockout: generateDirectKnockout(
              {
                ...settings,
                tournamentId,
              },
              assignment.players,
            ),
          }).knockout
        : emptyKnockout

    return {
      id: settings.id,
      tournamentId,
      name: settings.name,
      description: settings.description,
      status: settings.requiresGroupStage === false ? 'knockout' : 'round-robin',
      source: assignmentMode,
      settings: {
        ...(settings.settings || {}),
        assignmentMode: settings.assignmentMode,
        targetPlayers: settings.targetPlayers,
        minPlayers: settings.minPlayers,
        maxPlayers: settings.maxPlayers,
        groupCount: settings.groupCount,
        qualifiersPerGroup: settings.qualifiersPerGroup,
        knockoutFormat: settings.knockoutFormat,
        formatId: settings.formatId,
        formatName: settings.formatName,
        formatSummary: settings.formatSummary,
        knockoutSize: settings.knockoutSize,
        requiresGroupStage: settings.requiresGroupStage,
        allowByes: settings.allowByes,
        allowSpecialOverlap: settings.allowSpecialOverlap,
        eligibility: settings.eligibility,
      },
      players: allPlayers,
      groups,
      knockout: seededDirectKnockout,
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
