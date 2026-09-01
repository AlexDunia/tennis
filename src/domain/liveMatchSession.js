export const LIVE_MATCH_SESSION_SCHEMA_VERSION = 1
export const LIVE_MATCH_SESSION_STATUSES = Object.freeze([
  'ready',
  'live',
  'suspended',
  'completing',
  'completed',
])

function text(value) {
  return String(value || '').trim()
}

function clone(value) {
  return value === null || value === undefined ? null : JSON.parse(JSON.stringify(value))
}

/*
 * Initial contract only. Existing stores and scorer views are intentionally not
 * migrated onto it in this phase.
 */
export function createLiveMatchSessionContract(input = {}) {
  const issues = []
  const matchId = text(input.matchId)
  const id = text(input.id) || (matchId ? `live-${matchId}` : '')
  const status = text(input.status || 'ready')

  if (!matchId) {
    issues.push({ path: 'matchId', code: 'required', message: 'Match ID is required.' })
  }
  if (!LIVE_MATCH_SESSION_STATUSES.includes(status)) {
    issues.push({
      path: 'status',
      code: 'invalid_status',
      message: 'LiveMatchSession status is not supported.',
    })
  }

  const scoreRevision = Math.max(0, Number(input.scoreRevision) || 0)
  const authorityRevision = Math.max(0, Number(input.authorityRevision) || 0)

  const session = {
    schemaVersion: LIVE_MATCH_SESSION_SCHEMA_VERSION,
    id: id || null,
    matchId: matchId || null,
    status,
    engineState: clone(input.engineState),
    startedAt: input.startedAt || null,
    lastActivityAt: input.lastActivityAt || null,
    completedAt: input.completedAt || null,
    scorerAuthority: input.scorerAuthority
      ? {
          scorerId: text(input.scorerAuthority.scorerId) || null,
          capabilityId: text(input.scorerAuthority.capabilityId) || null,
          assignedBy: text(input.scorerAuthority.assignedBy) || null,
        }
      : null,
    scoreRevision,
    authorityRevision,
    resultId: text(input.resultId) || null,
    projection: {
      version: Math.max(0, Number(input.projection?.version) || 0),
      publishedAt: input.projection?.publishedAt || null,
    },
  }

  if (session.engineState) {
    const engineRevision = Math.max(0, Number(session.engineState.revision) || 0)
    if (scoreRevision !== engineRevision) {
      issues.push({
        path: 'scoreRevision',
        code: 'revision_mismatch',
        message: 'Session scoreRevision must match engineState.revision.',
      })
    }
  }
  if (status === 'completed' && (!session.completedAt || !session.resultId)) {
    issues.push({
      path: 'status',
      code: 'incomplete_completion',
      message: 'Completed sessions require completedAt and resultId.',
    })
  }

  return {
    ok: issues.length === 0,
    session,
    issues,
  }
}
