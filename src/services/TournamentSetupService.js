import { sanitizePlainText } from '../utils/formSafety.js'

const STORAGE_KEY = 'gorra.tournamentSetupWorkspace.v1'
const MAX_TEMPLATES_PER_CLUB = 50

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function createError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

function readWorkspace() {
  if (!canUseStorage()) return { drafts: {}, templates: [] }
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    return value?.version === 1
      ? {
          drafts: value.drafts || {},
          templates: Array.isArray(value.templates) ? value.templates : [],
        }
      : { drafts: {}, templates: [] }
  } catch {
    return { drafts: {}, templates: [] }
  }
}

function writeWorkspace(workspace) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...workspace }))
}

function assertContext(context = {}) {
  if (!context.userId) throw createError('Please sign in and try again.', 'AUTH_REQUIRED')
  if (!context.clubId) throw createError('Choose an active club first.', 'NO_ACTIVE_CLUB')
  if (!context.canManage)
    throw createError('You do not have permission to manage tournaments.', 'FORBIDDEN')
}

function draftKey(context) {
  return `${context.clubId}:${context.userId}`
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function reusableConfiguration(state) {
  return {
    version: 1,
    place: {
      venueId: state.place?.venueId || '',
      from: state.place?.from || '10:00',
      to: state.place?.to || '17:00',
      customByDay: false,
      dayHours: {},
      selectedCourtIds: [...(state.place?.selectedCourtIds || [])],
      courtRules: {},
    },
    events: (state.events || []).map((event) => ({
      id: event.custom ? '' : event.id,
      name: sanitizePlainText(event.name, 80),
      custom: Boolean(event.custom),
      type: event.type,
      capacity: Number(event.capacity),
      format: event.format,
      scoring: event.scoring,
      seeding: event.seeding,
      age: event.age,
      ability: event.ability,
      entryRule: event.entryRule,
    })),
  }
}

export async function loadTournamentDraft(context) {
  assertContext(context)
  return clone(readWorkspace().drafts[draftKey(context)]?.state || null)
}

export async function saveTournamentDraft(state, context) {
  assertContext(context)
  const workspace = readWorkspace()
  workspace.drafts[draftKey(context)] = {
    clubId: context.clubId,
    userId: context.userId,
    state: clone(state),
    updatedAt: new Date().toISOString(),
  }
  writeWorkspace(workspace)
  return clone(workspace.drafts[draftKey(context)])
}

export async function clearTournamentDraft(context) {
  assertContext(context)
  const workspace = readWorkspace()
  delete workspace.drafts[draftKey(context)]
  writeWorkspace(workspace)
}

export async function listTournamentSetups(context) {
  assertContext(context)
  return clone(readWorkspace().templates.filter((template) => template.clubId === context.clubId))
}

export async function saveTournamentSetup(name, state, context) {
  assertContext(context)
  const safeName = sanitizePlainText(name, 80)
  if (!safeName) throw createError('Name this reusable setup.', 'VALIDATION_ERROR')
  const workspace = readWorkspace()
  const clubTemplates = workspace.templates.filter((template) => template.clubId === context.clubId)
  if (clubTemplates.length >= MAX_TEMPLATES_PER_CLUB) {
    throw createError('This club has reached the saved setup limit.', 'LIMIT_REACHED')
  }
  const timestamp = new Date().toISOString()
  const template = {
    id: `setup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    clubId: context.clubId,
    createdBy: context.userId,
    name: safeName,
    configuration: reusableConfiguration(state),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  workspace.templates.push(template)
  writeWorkspace(workspace)
  return clone(template)
}

export async function deleteTournamentSetup(templateId, context) {
  assertContext(context)
  const workspace = readWorkspace()
  const index = workspace.templates.findIndex(
    (template) => template.id === templateId && template.clubId === context.clubId,
  )
  if (index === -1) throw createError('This saved setup could not be found.', 'NOT_FOUND')
  workspace.templates.splice(index, 1)
  writeWorkspace(workspace)
}

export function applyTournamentSetup(template, state, { venues, capabilities }) {
  if (!template?.configuration)
    throw createError('This saved setup is not valid.', 'INVALID_TEMPLATE')
  const config = clone(template.configuration)
  const venue = venues.find((item) => item.id === config.place?.venueId) || venues[0] || null
  const availableCourtIds = new Set(venue?.courts.map((court) => court.id) || [])
  const selectedCourtIds = (config.place?.selectedCourtIds || []).filter((courtId) =>
    availableCourtIds.has(courtId),
  )
  const allowedSeeding = new Set([
    ...(capabilities.hasClubLadder ? ['ladder'] : []),
    ...(capabilities.supportsPlayerRatings ? ['rating'] : []),
    'manual',
    'none',
  ])
  return {
    ...state,
    place: {
      ...state.place,
      venueId: venue?.id || '',
      from: config.place?.from || '10:00',
      to: config.place?.to || '17:00',
      customByDay: false,
      dayHours: {},
      selectedCourtIds: selectedCourtIds.length
        ? selectedCourtIds
        : venue?.courts.map((court) => court.id) || [],
      courtRules: {},
    },
    events: (config.events || []).map((event, index) => ({
      ...event,
      id: event.custom ? `custom-${Date.now()}-${index}` : event.id,
      seeding: allowedSeeding.has(event.seeding) ? event.seeding : capabilities.recommendedSeeding,
    })),
  }
}
