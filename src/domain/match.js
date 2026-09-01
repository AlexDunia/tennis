import { freezeMatchRulesSnapshot, validateMatchRulesSnapshot } from './matchRules.js'

export const MATCH_CONTRACT_SCHEMA_VERSION = 1
export const MATCH_SOURCES = Object.freeze(['friendly', 'ladder', 'tournament'])
export const MATCH_LIFECYCLE_STATUSES = Object.freeze([
  'draft',
  'pending',
  'awaiting',
  'accepted',
  'scheduled',
  'ready',
  'live',
  'pending_review',
  'completed',
  'cancelled',
])

function text(value) {
  return String(value || '').trim()
}

function side(key, id, name, participantIds) {
  const ids = (Array.isArray(participantIds) ? participantIds : [id]).map(text).filter(Boolean)
  return {
    key,
    id: text(id) || null,
    name: text(name) || null,
    participantIds: [...new Set(ids)],
  }
}

function scheduleFor(input) {
  if (!input.scheduledAt) return { value: null, issue: null }
  const parsed = new Date(input.scheduledAt)
  if (!Number.isFinite(parsed.getTime())) {
    return {
      value: null,
      issue: {
        path: 'schedule.scheduledAt',
        code: 'invalid_date',
        message: 'Scheduled time must be a valid date.',
      },
    }
  }
  return { value: { scheduledAt: parsed.toISOString() }, issue: null }
}

/*
 * Initial source-neutral Match contract.
 *
 * This helper does not replace existing persistence. It lets migration code
 * normalize today's common Match fields without inventing a second score.
 */
export function toCanonicalMatch(input = {}, options = {}) {
  const issues = []
  const source = text(options.source || input.source || input.type).toLowerCase()
  if (!MATCH_SOURCES.includes(source)) {
    issues.push({
      path: 'source',
      code: 'invalid_source',
      message: 'Match source must be friendly, ladder, or tournament.',
    })
  }

  const id = text(input.id)
  if (!id) {
    issues.push({ path: 'id', code: 'required', message: 'Match ID is required.' })
  }

  const rulesSnapshot = options.rulesSnapshot || input.rulesSnapshot || null
  const rulesValidation = rulesSnapshot ? validateMatchRulesSnapshot(rulesSnapshot) : null
  if (rulesValidation && !rulesValidation.valid) {
    issues.push(
      ...rulesValidation.errors.map((item) => ({ ...item, path: `rulesSnapshot.${item.path}` })),
    )
  }

  const status = text(input.lifecycleStatus || input.status || 'draft')
  if (!MATCH_LIFECYCLE_STATUSES.includes(status)) {
    issues.push({
      path: 'lifecycleStatus',
      code: 'invalid_status',
      message: 'Match lifecycle status is not supported by the canonical contract.',
    })
  }

  const sides = input.sides?.length
    ? input.sides.map((item, index) =>
        side(index === 0 ? 'sideA' : 'sideB', item.id, item.name, item.participantIds),
      )
    : [
        side(
          'sideA',
          input.player1Id || input.challengerId,
          input.player1Name || input.challengerName,
          input.player1ParticipantIds,
        ),
        side(
          'sideB',
          input.player2Id || input.defenderId,
          input.player2Name || input.defenderName,
          input.player2ParticipantIds,
        ),
      ]
  if (sides.length !== 2) {
    issues.push({
      path: 'sides',
      code: 'invalid_sides',
      message: 'A tennis Match must contain exactly two sides.',
    })
  }

  const sourceRefId =
    text(options.sourceRefId || input.sourceRef?.id) ||
    (source === 'ladder'
      ? text(input.challengeId)
      : source === 'tournament'
        ? text(input.tournamentId)
        : null)
  const schedule = scheduleFor(input)
  if (schedule.issue) {
    issues.push(schedule.issue)
  }

  const match = {
    schemaVersion: MATCH_CONTRACT_SCHEMA_VERSION,
    id: id || null,
    clubId: text(input.clubId) || null,
    source,
    sourceRef: sourceRefId ? { type: source, id: sourceRefId } : null,
    sides,
    court:
      input.court || input.courtId
        ? {
            id: text(input.courtId) || null,
            label: text(input.court?.name || input.court?.label || input.court) || null,
          }
        : null,
    schedule: schedule.value,
    rulesSnapshot:
      rulesSnapshot && rulesValidation?.valid ? freezeMatchRulesSnapshot(rulesSnapshot) : null,
    rulesState: rulesSnapshot && rulesValidation?.valid ? 'resolved' : 'legacy_unresolved',
    lifecycleStatus: status,
    liveSessionId: text(input.liveSessionId) || null,
    resultId: text(input.resultId) || null,
  }

  if (!rulesSnapshot) {
    issues.push({
      path: 'rulesSnapshot',
      code: 'legacy_unresolved',
      message: 'Legacy Match has no canonical immutable rules snapshot.',
    })
  }

  return {
    ok: issues.length === 0,
    match,
    issues,
  }
}
