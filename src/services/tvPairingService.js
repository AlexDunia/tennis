/*
 * GORRA — TV PAIRING SERVICE
 *
 * FRONTEND DEVELOPMENT IMPLEMENTATION
 *
 * Responsibilities:
 *
 * - issue one active pairing per match
 * - ensure human codes are unique among active pairings
 * - claim by human code or high-entropy QR ticket
 * - convert one-time pairing into read-only display session
 * - store display capability in this display TAB
 * - support cancel / revoke
 * - publish pairing lifecycle changes across tabs
 *
 * IMPORTANT:
 *
 * localStorage is NOT the final security boundary.
 *
 * Production Laravel must own:
 *
 * - code uniqueness
 * - atomic one-time claims
 * - brute-force/rate-limit protection
 * - display credential signing
 * - revocation
 * - expiry
 * - authorization
 */

import {
  createTvDisplaySession,
  createTvPairingSession,
  displaySessionCanRead,
  normalizePairingCode,
  normalizeQrClaimToken,
  pairingSessionCanBeClaimed,
  TV_DISPLAY_SESSION_KIND,
  TV_PAIRING_SESSION_KIND,
} from '../utils/tvPairing'

const PAIRING_STORAGE_KEY = 'gorra.tvPairingSessions.v1'

const DISPLAY_STORAGE_KEY = 'gorra.tvDisplaySessions.v1'

const TAB_DISPLAY_SESSION_KEY = 'gorra.tvDisplaySession.current.v1'

const LOCAL_CHANGE_EVENT = 'gorra:tv-pairing-change'

const STORAGE_PROBE_KEY = 'gorra.tvPairingStorageProbe'

const MAX_PAIRING_SESSIONS = 30

const MAX_DISPLAY_SESSIONS = 30

const MAX_CREATE_ATTEMPTS = 8

let storageCapability = null

function browserAvailable() {
  return typeof window !== 'undefined'
}

function storageAvailable() {
  if (!browserAvailable()) {
    return false
  }

  if (storageCapability !== null) {
    return storageCapability
  }

  try {
    window.localStorage.setItem(STORAGE_PROBE_KEY, '1')

    window.localStorage.removeItem(STORAGE_PROBE_KEY)

    storageCapability = true
  } catch {
    storageCapability = false
  }

  return storageCapability
}

function sessionStorageAvailable() {
  if (!browserAvailable()) {
    return false
  }

  try {
    const key = `${STORAGE_PROBE_KEY}.session`

    window.sessionStorage.setItem(key, '1')

    window.sessionStorage.removeItem(key)

    return true
  } catch {
    return false
  }
}

function readCollection(key) {
  if (!storageAvailable()) {
    return []
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function dispatchChange(key) {
  try {
    window.dispatchEvent(
      new CustomEvent(LOCAL_CHANGE_EVENT, {
        detail: {
          key,
        },
      }),
    )
  } catch {
    // Same-tab notification is an enhancement.
  }
}

function writeCollection(key, value) {
  if (!storageAvailable()) {
    return false
  }

  try {
    const serialized =
      JSON.stringify(value)

    /*
     * IMPORTANT:
     *
     * Getters such as getPairingSession()
     * pass through loadCleanCollections().
     *
     * Without this no-op guard:
     *
     * subscriber
     * → getter
     * → cleanup
     * → write
     * → local event
     * → subscriber
     *
     * can recursively call itself.
     */
    if (
      window.localStorage.getItem(
        key,
      ) === serialized
    ) {
      return true
    }

    window.localStorage.setItem(
      key,
      serialized,
    )

    dispatchChange(key)

    return true
  } catch {
    return false
  }
}

function currentPairingSessions() {
  return readCollection(PAIRING_STORAGE_KEY)
}

function currentDisplaySessions() {
  return readCollection(DISPLAY_STORAGE_KEY)
}

function cleanDisplaySessions(sessions) {
  const now = Date.now()

  return sessions
    .filter(
      (session) =>
        session?.kind === TV_DISPLAY_SESSION_KIND &&
        !session.revokedAt &&
        Number(session.expiresAt || 0) > now,
    )
    .slice(0, MAX_DISPLAY_SESSIONS)
}

function activeDisplayForPairing(pairing, displays) {
  if (pairing?.status !== 'claimed' || !pairing.displaySessionId) {
    return null
  }

  const display = displays.find((session) => session.displaySessionId === pairing.displaySessionId)

  if (!display) {
    return null
  }

  return displaySessionCanRead(display, pairing.matchId) ? display : null
}

function cleanPairingSessions(sessions, displays) {
  const now = Date.now()

  return sessions
    .filter((session) => {
      if (session?.kind !== TV_PAIRING_SESSION_KIND) {
        return false
      }

      if (session.status === 'waiting') {
        /*
         * Old 4A sessions without the new QR credential
         * are deliberately discarded.
         */
        return Boolean(
          pairingSessionCanBeClaimed(session, now) && normalizeQrClaimToken(session.qrClaimToken),
        )
      }

      if (session.status === 'claimed') {
        return Boolean(activeDisplayForPairing(session, displays))
      }

      return false
    })
    .slice(0, MAX_PAIRING_SESSIONS)
}

function loadCleanCollections() {
  const displays = cleanDisplaySessions(currentDisplaySessions())

  const pairings = cleanPairingSessions(currentPairingSessions(), displays)

  writeCollection(DISPLAY_STORAGE_KEY, displays)

  writeCollection(PAIRING_STORAGE_KEY, pairings)

  return {
    pairings,
    displays,
  }
}

function activePairingForMatch(pairings, matchId, createdBy) {
  const id = String(matchId || '')

  const creator = String(createdBy || '')

  return (
    pairings.find(
      (session) =>
        session.matchId === id &&
        session.createdBy === creator &&
        ['waiting', 'claimed'].includes(session.status),
    ) || null
  )
}

function pairingCredentialsUnique(candidate, sessions) {
  const code = normalizePairingCode(candidate.pairingCode)

  const qr = normalizeQrClaimToken(candidate.qrClaimToken)

  return !sessions.some(
    (session) =>
      normalizePairingCode(session.pairingCode) === code ||
      normalizeQrClaimToken(session.qrClaimToken) === qr,
  )
}

export function createPairingSession({ matchId, createdBy }) {
  const { pairings } = loadCleanCollections()

  /*
   * Separation Four supports one active paired display
   * per match.
   *
   * Multi-display management belongs to Separation Five.
   */
  const existing = activePairingForMatch(pairings, matchId, createdBy)

  if (existing) {
    return existing
  }

  let candidate = null

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const proposed = createTvPairingSession({
      matchId,
      createdBy,
    })

    if (pairingCredentialsUnique(proposed, pairings)) {
      candidate = proposed

      break
    }
  }

  if (!candidate) {
    return null
  }

  const next = [candidate, ...pairings].slice(0, MAX_PAIRING_SESSIONS)

  if (!writeCollection(PAIRING_STORAGE_KEY, next)) {
    return null
  }

  return candidate
}

function pairingByCode(code) {
  const normalized = normalizePairingCode(code)

  if (normalized.length !== 6) {
    return null
  }

  const { pairings } = loadCleanCollections()

  return (
    pairings.find(
      (session) =>
        session.status === 'waiting' &&
        pairingSessionCanBeClaimed(session) &&
        normalizePairingCode(session.pairingCode) === normalized,
    ) || null
  )
}

function pairingByQrToken(token) {
  const normalized = normalizeQrClaimToken(token)

  if (normalized.length !== 48) {
    return null
  }

  const { pairings } = loadCleanCollections()

  return (
    pairings.find(
      (session) =>
        session.status === 'waiting' &&
        pairingSessionCanBeClaimed(session) &&
        normalizeQrClaimToken(session.qrClaimToken) === normalized,
    ) || null
  )
}

/*
 * navigator.locks gives same-origin tabs a much better
 * development-time claim race boundary.
 *
 * It still does NOT replace an atomic backend transaction.
 */
async function withClaimLock(key, action) {
  if (
    browserAvailable() &&
    window.navigator?.locks?.request
  ) {
    return window.navigator.locks.request(
      `gorra-tv-pairing-${key}`,

      {
        mode: 'exclusive',
      },

      action,
    )
  }

  return action()
}

function commitClaim(pairing) {
  /*
   * Re-read immediately before committing.
   *
   * The session may have been claimed while this tab
   * was waiting for the lock.
   */
  const {
    pairings,
    displays,
  } = loadCleanCollections()

  const fresh =
    pairings.find(
      (session) =>
        session.sessionId ===
        pairing.sessionId,
    )

  if (
    !fresh ||
    !pairingSessionCanBeClaimed(
      fresh,
    )
  ) {
    return null
  }

  const displaySession =
    createTvDisplaySession({
      pairingSession: fresh,
    })

  const now =
    Date.now()

  const claimedPairing = {
    ...fresh,

    status: 'claimed',

    claimedAt: now,

    displaySessionId: displaySession.displaySessionId,

    displayExpiresAt: displaySession.expiresAt,
  }

  const nextPairings =
    pairings.map(
      (session) =>
        session.sessionId ===
        fresh.sessionId
          ? claimedPairing
          : session,
    )

  const nextDisplays = [
    displaySession,
    ...displays,
  ].slice(
    0,
    MAX_DISPLAY_SESSIONS,
  )

  /*
   * localStorage cannot make a true
   * cross-key transaction.
   *
   * Write the display capability FIRST.
   *
   * Why?
   *
   * Once the Pairing record says "claimed",
   * cleanPairingSessions() requires its
   * display session to already exist.
   *
   * Writing Pairing first creates a small
   * window where cleanup can incorrectly
   * delete the new claim.
   */
  if (
    !writeCollection(
      DISPLAY_STORAGE_KEY,
      nextDisplays,
    )
  ) {
    return null
  }

  if (
    !writeCollection(
      PAIRING_STORAGE_KEY,
      nextPairings,
    )
  ) {
    /*
     * Best-effort rollback.
     *
     * Laravel will later perform the
     * equivalent operation atomically.
     */
    writeCollection(
      DISPLAY_STORAGE_KEY,
      displays,
    )

    return null
  }

  return {
    pairingSession: claimedPairing,

    displaySession,
  }
}

export async function claimPairingCode(code) {
  const normalized = normalizePairingCode(code)

  if (normalized.length !== 6) {
    return null
  }

  return withClaimLock(
    `code-${normalized}`,

    () => {
      const pairing = pairingByCode(normalized)

      return pairing ? commitClaim(pairing) : null
    },
  )
}

export async function claimPairingQrToken(token) {
  const normalized = normalizeQrClaimToken(token)

  if (normalized.length !== 48) {
    return null
  }

  return withClaimLock(
    `qr-${normalized}`,

    () => {
      const pairing = pairingByQrToken(normalized)

      return pairing ? commitClaim(pairing) : null
    },
  )
}

export function getPairingSession(sessionId) {
  const id = String(sessionId || '')

  if (!id) {
    return null
  }

  const { pairings } = loadCleanCollections()

  return pairings.find((session) => session.sessionId === id) || null
}

export function getReadableDisplaySession(displaySessionId) {
  const id = String(displaySessionId || '')

  if (!id) {
    return null
  }

  const { displays } = loadCleanCollections()

  const session = displays.find((item) => item.displaySessionId === id)

  if (!session) {
    return null
  }

  return displaySessionCanRead(session, session.matchId) ? session : null
}

export function cancelPairingSession(sessionId, actorId) {
  const pairings = currentPairingSessions()

  const target = pairings.find((session) => session.sessionId === String(sessionId || ''))

  if (!target || target.status !== 'waiting') {
    return false
  }

  /*
   * Development guard only.
   *
   * Laravel must later derive the actor from the
   * authenticated request rather than browser input.
   */
  if (target.createdBy !== String(actorId || '')) {
    return false
  }

  const next = pairings.map((session) =>
    session.sessionId === target.sessionId
      ? {
          ...session,

          status: 'cancelled',

          cancelledAt: Date.now(),
        }
      : session,
  )

  return writeCollection(PAIRING_STORAGE_KEY, next)
}

export function revokePairedDisplay(pairingSessionId, actorId) {
  const pairings = currentPairingSessions()

  const displays = currentDisplaySessions()

  const pairing = pairings.find((session) => session.sessionId === String(pairingSessionId || ''))

  if (
    !pairing ||
    pairing.status !== 'claimed' ||
    pairing.createdBy !== String(actorId || '') ||
    !pairing.displaySessionId
  ) {
    return false
  }

  const display = displays.find((session) => session.displaySessionId === pairing.displaySessionId)

  if (!display) {
    return false
  }

  const now = Date.now()

  const nextDisplays = displays.map((session) =>
    session.displaySessionId === display.displaySessionId
      ? {
          ...session,

          revokedAt: now,
        }
      : session,
  )

  const nextPairings = pairings.map((session) =>
    session.sessionId === pairing.sessionId
      ? {
          ...session,

          status: 'revoked',

          revokedAt: now,
        }
      : session,
  )

  if (!writeCollection(DISPLAY_STORAGE_KEY, nextDisplays)) {
    return false
  }

  if (!writeCollection(PAIRING_STORAGE_KEY, nextPairings)) {
    return false
  }

  return true
}

/*
 * The capability is deliberately stored in sessionStorage.
 *
 * This means:
 *
 * - refresh in the paired tab survives
 * - another unrelated tab does not automatically inherit it
 * - the capability does not appear in the URL
 */
export function storeDisplaySessionForThisTab(displaySessionId) {
  if (!sessionStorageAvailable()) {
    return false
  }

  const id = String(displaySessionId || '')

  if (!id) {
    return false
  }

  try {
    window.sessionStorage.setItem(TAB_DISPLAY_SESSION_KEY, id)

    return true
  } catch {
    return false
  }
}

export function readDisplaySessionForThisTab() {
  if (!sessionStorageAvailable()) {
    return ''
  }

  try {
    return String(window.sessionStorage.getItem(TAB_DISPLAY_SESSION_KEY) || '')
  } catch {
    return ''
  }
}

export function clearDisplaySessionForThisTab() {
  if (!sessionStorageAvailable()) {
    return
  }

  try {
    window.sessionStorage.removeItem(TAB_DISPLAY_SESSION_KEY)
  } catch {
    // no-op
  }
}

export function subscribeToPairingSession(sessionId, onChange) {
  if (!browserAvailable() || typeof onChange !== 'function') {
    return () => {}
  }

  const id = String(sessionId || '')

  if (!id) {
    return () => {}
  }

  function emit() {
    onChange(getPairingSession(id))
  }

  function handleStorage(event) {
    if ([PAIRING_STORAGE_KEY, DISPLAY_STORAGE_KEY].includes(event.key)) {
      emit()
    }
  }

  function handleLocal(event) {
    if ([PAIRING_STORAGE_KEY, DISPLAY_STORAGE_KEY].includes(event.detail?.key)) {
      emit()
    }
  }

  window.addEventListener('storage', handleStorage)

  window.addEventListener(LOCAL_CHANGE_EVENT, handleLocal)

  emit()

  return () => {
    window.removeEventListener('storage', handleStorage)

    window.removeEventListener(LOCAL_CHANGE_EVENT, handleLocal)
  }
}

export function subscribeToDisplaySession(displaySessionId, onChange) {
  if (!browserAvailable() || typeof onChange !== 'function') {
    return () => {}
  }

  const id = String(displaySessionId || '')

  if (!id) {
    return () => {}
  }

  let expiryTimer = null

  function clearExpiryTimer() {
    if (!expiryTimer) {
      return
    }

    window.clearTimeout(expiryTimer)

    expiryTimer = null
  }

  function emit() {
    clearExpiryTimer()

    const session = getReadableDisplaySession(id)

    onChange(session)

    if (!session) {
      return
    }

    const remaining = Math.max(0, Number(session.expiresAt || 0) - Date.now())

    expiryTimer = window.setTimeout(
      emit,

      Math.min(remaining + 50, 2_147_000_000),
    )
  }

  function handleStorage(event) {
    if (event.key === DISPLAY_STORAGE_KEY) {
      emit()
    }
  }

  function handleLocal(event) {
    if (event.detail?.key === DISPLAY_STORAGE_KEY) {
      emit()
    }
  }

  window.addEventListener('storage', handleStorage)

  window.addEventListener(LOCAL_CHANGE_EVENT, handleLocal)

  emit()

  return () => {
    clearExpiryTimer()

    window.removeEventListener('storage', handleStorage)

    window.removeEventListener(LOCAL_CHANGE_EVENT, handleLocal)
  }
}
