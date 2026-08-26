export const TV_PAIRING_SCHEMA_VERSION = 1

export const TV_PAIRING_SESSION_KIND = 'gorra.tv-pairing-session'

export const TV_DISPLAY_SESSION_KIND = 'gorra.tv-display-session'

export const TV_PAIRING_TTL_MS = 5 * 60 * 1000

export const TV_DISPLAY_SESSION_TTL_MS = 12 * 60 * 60 * 1000

const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function cleanText(value, maxLength = 120) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function randomBytes(length) {
  const bytes = new Uint8Array(length)

  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random generation is unavailable.')
  }

  crypto.getRandomValues(bytes)

  return bytes
}

function randomToken(byteLength = 32) {
  const bytes = randomBytes(byteLength)

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomPairingCode() {
  const bytes = randomBytes(6)

  return Array.from(bytes)
    .map((byte) => PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length])
    .join('')
}

export function normalizePairingCode(value) {
  return cleanText(value, 20)
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 6)
}

export function formatPairingCode(value) {
  const code = normalizePairingCode(value)

  if (code.length <= 3) {
    return code
  }

  return `${code.slice(0, 3)} ${code.slice(3)}`
}

export function normalizeQrClaimToken(value) {
  return cleanText(value, 96)
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '')
    .slice(0, 48)
}

export function createTvPairingSession({
  matchId,
  createdBy,
  clubId = '',
}) {
  const safeMatchId =
    cleanText(
      matchId,
      120,
    )

  const safeCreator =
    cleanText(
      createdBy,
      120,
    )

  const safeClubId =
    cleanText(
      clubId,
      120,
    )

  if (
    !safeMatchId ||
    !safeCreator
  ) {
    throw new Error(
      'Match and creator are required for TV pairing.',
    )
  }

  const now =
    Date.now()

  return {
    kind:
      TV_PAIRING_SESSION_KIND,

    schemaVersion:
      TV_PAIRING_SCHEMA_VERSION,

    sessionId:
      randomToken(18),

    matchId:
      safeMatchId,

    clubId:
      safeClubId,

    /*
     * Short human-entered pairing credential.
     */
    pairingCode:
      randomPairingCode(),

    /*
     * Separate high-entropy QR claim credential.
     *
     * This is intentionally not the human code and
     * is consumed only by the pairing claim flow.
     */
    qrClaimToken:
      randomToken(24),

    createdBy:
      safeCreator,

    createdAt:
      now,

    expiresAt:
      now +
      TV_PAIRING_TTL_MS,

    status:
      'waiting',

    claimedAt:
      null,

    displaySessionId:
      null,

    displayExpiresAt:
      null,
  }
}

export function pairingSessionExpired(session, now = Date.now()) {
  if (!session) {
    return true
  }

  return Number(session.expiresAt || 0) <= now
}

export function pairingSessionCanBeClaimed(session, now = Date.now()) {
  return Boolean(
    session &&
    session.kind === TV_PAIRING_SESSION_KIND &&
    session.status === 'waiting' &&
    !pairingSessionExpired(session, now),
  )
}

export function createTvDisplaySession({ pairingSession }) {
  if (!pairingSessionCanBeClaimed(pairingSession)) {
    throw new Error('This TV pairing session is no longer available.')
  }

  const now = Date.now()

  return {
    kind: TV_DISPLAY_SESSION_KIND,

    schemaVersion: TV_PAIRING_SCHEMA_VERSION,

    /*
     * This is the read-only capability identifier.
     *
     * Production should use a backend-issued,
     * signed/opaque credential instead.
     */
    displaySessionId: randomToken(32),

    matchId: cleanText(pairingSession.matchId, 120),

    scope: ['scoreboard:read'],

    createdAt: now,

    expiresAt: now + TV_DISPLAY_SESSION_TTL_MS,

    revokedAt: null,
  }
}

export function displaySessionCanRead(session, matchId, now = Date.now()) {
  if (!session || session.kind !== TV_DISPLAY_SESSION_KIND) {
    return false
  }

  if (Number(session.expiresAt || 0) <= now) {
    return false
  }

  if (session.revokedAt) {
    return false
  }

  if (cleanText(session.matchId, 120) !== cleanText(matchId, 120)) {
    return false
  }

  return Array.isArray(session.scope) && session.scope.includes('scoreboard:read')
}
