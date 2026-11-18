function readEnv(name) {
  return String(import.meta.env?.[name] || '').trim()
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `club-delete-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function configuredEndpoint() {
  const explicit = readEnv('VITE_CLUB_DELETE_ENDPOINT')
  if (explicit) return explicit

  const baseUrl = readEnv('VITE_API_BASE_URL').replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}/api/clubs/:clubId` : ''
}

function endpointForClub(clubId) {
  const endpoint = configuredEndpoint()
  const encodedClubId = encodeURIComponent(String(clubId || '').trim())

  if (!endpoint || !encodedClubId) return ''
  if (endpoint.includes(':clubId')) {
    return endpoint.replace(':clubId', encodedClubId)
  }

  return `${endpoint.replace(/\/+$/, '')}/${encodedClubId}`
}

function apiError(message, code = 'CLUB_DELETE_FAILED', status = 0) {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

async function responsePayload(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Production adapter for the destructive club operation. It deliberately
 * sends no actor id or capability: the server must derive identity from the
 * authenticated session and make the final authorization decision.
 */
export function isClubDeletionApiEnabled() {
  return readEnv('VITE_CLUB_DELETE_API') === 'true' && Boolean(configuredEndpoint())
}

export async function deleteClubThroughApi({ clubId, confirmationName = '' } = {}) {
  const endpoint = endpointForClub(clubId)
  if (!isClubDeletionApiEnabled() || !endpoint) {
    throw apiError('Club deletion API is not configured.', 'API_NOT_CONFIGURED')
  }

  let response
  try {
    response = await fetch(endpoint, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': createIdempotencyKey(),
      },
      body: JSON.stringify({ confirmationName: String(confirmationName || '').trim() }),
    })
  } catch {
    throw apiError('We could not reach the server. Try again.', 'NETWORK_ERROR')
  }

  const payload = await responsePayload(response)
  if (!response.ok) {
    const problem = payload?.error || payload
    throw apiError(
      problem?.message || 'We could not delete this club. Try again.',
      problem?.code || `HTTP_${response.status}`,
      response.status,
    )
  }

  const data = payload?.data || payload
  if (!data || String(data.deletedClubId || data.clubId || '') !== String(clubId)) {
    throw apiError('The server returned an invalid club deletion response.', 'INVALID_RESPONSE', response.status)
  }

  return {
    clubId: String(data.deletedClubId || data.clubId),
    clubName: String(data.deletedClubName || data.clubName || ''),
    activeClubId: String(data.activeClubId || ''),
    directory: data.directory || null,
    deletedAt: String(data.deletedAt || ''),
    source: 'backend',
  }
}