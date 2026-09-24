const MODES = new Set(['individual', 'bulk'])
const TIMINGS = new Set(['now', 'scheduled'])
const RULE_SOURCES = new Set(['ladder_default', 'admin_override'])

function cleanText(value, limit = 160) {
  return String(value || '').trim().slice(0, limit)
}

function cleanId(value) {
  return cleanText(value, 160)
}

function cleanCourt(value) {
  return cleanText(value, 80)
}

function validIso(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : null
}

export function createLadderMatchCommitRequestId({
  creationMode = 'individual',
  draftId = '',
} = {}) {
  const mode = MODES.has(creationMode)
    ? creationMode
    : 'individual'
  const safeDraftId = cleanText(draftId, 120)

  if (safeDraftId) return `ladder-${mode}-${safeDraftId}`

  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `ladder-${mode}-${uuid}`

  return `ladder-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function buildAdminLadderMatchCommitPayload({
  clubId,
  ladderId,
  challengerPlayerId,
  opponentPlayerId,
  actorId = '',
  timing,
  scheduledAt = null,
  courtId = null,
  matchRuleSource = 'ladder_default',
  rulesSnapshot,
  creationMode = 'individual',
  clientRequestId,
} = {}) {
  const safeClubId = cleanId(clubId)
  const safeLadderId = cleanId(ladderId)
  const challengerId = cleanId(challengerPlayerId)
  const opponentId = cleanId(opponentPlayerId)
  const safeTiming = TIMINGS.has(timing) ? timing : ''
  const safeMode = MODES.has(creationMode) ? creationMode : 'individual'
  const safeRuleSource = RULE_SOURCES.has(matchRuleSource) ? matchRuleSource : ''
  const safeRequestId = cleanText(clientRequestId, 200)

  if (!safeClubId) throw new Error('An active club is required.')
  if (!safeLadderId) throw new Error('An active Ladder is required.')
  if (!challengerId || !opponentId || challengerId === opponentId) throw new Error('Choose two different Ladder players.')
  if (!safeTiming) throw new Error('Choose whether to play or schedule this Ladder match.')
  if (!safeRuleSource) throw new Error('Choose a valid Ladder rule source.')
  if (!safeRequestId) throw new Error('A match request identity is required.')

  const normalizedScheduledAt = safeTiming === 'scheduled' ? validIso(scheduledAt) : null
  if (safeTiming === 'scheduled' && !normalizedScheduledAt) throw new Error('Choose a valid match date and time.')

  return {
    clubId: safeClubId,
    ladderId: safeLadderId,
    challengerPlayerId: challengerId,
    opponentPlayerId: opponentId,
    actorId: cleanId(actorId),
    timing: safeTiming,
    scheduledAt: normalizedScheduledAt,
    courtId: cleanCourt(courtId) || null,
    matchRuleSource: safeRuleSource,
    rulesSnapshot,
    creationMode: safeMode,
    clientRequestId: safeRequestId,
  }
}
