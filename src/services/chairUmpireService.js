/*
 * GORRA — CHAIR UMPIRE INVITATION SERVICE
 *
 * DEVELOPMENT IMPLEMENTATION
 *
 * localStorage gives us the lifecycle shape required
 * by the frontend.
 *
 * Production Laravel must own:
 *
 * - authenticated creator identity
 * - active-club validation
 * - candidate membership validation
 * - atomic one-time acceptance
 * - invitation expiry
 * - rate limits
 * - audit events
 *
 * Accepting this invitation NEVER changes scorerId.
 */

import {
  chairUmpireAcceptedExpiry,
  chairUmpireAcceptedIdentityId,
  chairUmpireCandidateActive,
  chairUmpireInvitationCanBeAccepted,
  chairUmpireInvitationIsActive,
  CHAIR_UMPIRE_SCORER_SESSION_KIND,
  createChairUmpireCandidateId,
  createChairUmpireControlGrantId,
  createChairUmpireInvitation,
  createChairUmpireScorerSessionId,
  normalizeChairUmpireToken,
  sanitizeChairUmpireName,
  validChairUmpireName,
} from '../utils/chairUmpire'

const STORAGE_KEY = 'gorra.chairUmpireInvitations.v1'

const LOCAL_EVENT = 'gorra:chair-umpire-change'

const STORAGE_PROBE = 'gorra.chairUmpireStorageProbe'

const MAX_INVITATIONS = 50

const TAB_SCORER_SESSION_KEY =
  'gorra.chairUmpireScorerSession.current.v1'

const SESSION_STORAGE_PROBE =
  'gorra.chairUmpireScorerSessionProbe'

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
    window.localStorage.setItem(STORAGE_PROBE, '1')

    window.localStorage.removeItem(STORAGE_PROBE)

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
    window.sessionStorage.setItem(
      SESSION_STORAGE_PROBE,
      '1',
    )

    window.sessionStorage.removeItem(
      SESSION_STORAGE_PROBE,
    )

    return true
  } catch {
    return false
  }
}

function readInvitations() {
  if (!storageAvailable()) {
    return []
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')

    return Array.isArray(parsed) ? parsed.slice(0, MAX_INVITATIONS) : []
  } catch {
    return []
  }
}

function dispatchChange() {
  try {
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT))
  } catch {
    // same-tab notification is optional
  }
}

function writeInvitations(invitations) {
  if (!storageAvailable()) {
    return false
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,

      JSON.stringify(invitations.slice(0, MAX_INVITATIONS)),
    )

    dispatchChange()

    return true
  } catch {
    return false
  }
}

export function getChairUmpireInvitationByToken(token) {
  const normalized = normalizeChairUmpireToken(token)

  if (normalized.length !== 64) {
    return null
  }

  return (
    readInvitations().find(
      (invitation) => normalizeChairUmpireToken(invitation.token) === normalized,
    ) || null
  )
}

export function getChairUmpireInvitation(invitationId) {
  const id = String(invitationId || '')

  if (!id) {
    return null
  }

  return readInvitations().find((invitation) => invitation.invitationId === id) || null
}

export function getActiveChairUmpireInvitationForMatch(matchId, createdBy = '') {
  const id = String(matchId || '')

  const creator = String(createdBy || '')

  if (!id) {
    return null
  }

  return (
    readInvitations().find(
      (invitation) =>
        invitation.matchId === id &&
        (!creator || invitation.createdBy === creator) &&
        chairUmpireInvitationIsActive(invitation),
    ) || null
  )
}

export function createChairUmpireInvitationSession(input) {
  const invitations = readInvitations()

  /*
   * One active umpire candidate/invite per match.
   *
   * We do not create competing pending umpire roles.
   */
  const existing = invitations.find(
    (invitation) =>
      invitation.matchId === String(input.matchId || '') &&
      invitation.createdBy === String(input.createdBy || '') &&
      chairUmpireInvitationIsActive(invitation),
  )

  if (existing) {
    return existing
  }

  let invitation

  try {
    invitation = createChairUmpireInvitation(input)
  } catch {
    return null
  }

  const next = [invitation, ...invitations].slice(0, MAX_INVITATIONS)

  return writeInvitations(next) ? invitation : null
}

function replaceInvitation(invitationId, update) {
  const invitations = readInvitations()

  const index = invitations.findIndex((invitation) => invitation.invitationId === invitationId)

  if (index < 0) {
    return null
  }

  const current = invitations[index]

  const nextInvitation = typeof update === 'function' ? update(current) : update

  if (!nextInvitation) {
    return null
  }

  const next = [...invitations]

  next[index] = nextInvitation

  if (!writeInvitations(next)) {
    return null
  }

  return nextInvitation
}

/*
 * CLUB MEMBER ACCEPTANCE
 *
 * Requires both:
 *
 * - possession of invitation token
 * - matching targeted user identity
 *
 * Frontend guard only.
 * Laravel later performs this server-side.
 */
export function acceptChairUmpireAsClubMember({ token, actorId, actorName }) {
  const invitation = getChairUmpireInvitationByToken(token)

  if (
    !invitation ||
    invitation.audience !== 'club_member' ||
    !chairUmpireInvitationCanBeAccepted(invitation)
  ) {
    return null
  }

  if (String(invitation.expectedUserId || '') !== String(actorId || '')) {
    return null
  }

  const acceptedAt = Date.now()

  return replaceInvitation(
    invitation.invitationId,

    (current) => {
      if (!chairUmpireInvitationCanBeAccepted(current)) {
        return null
      }

      return {
        ...current,

        status: 'accepted',

        acceptedAt,

        acceptedExpiresAt: chairUmpireAcceptedExpiry(acceptedAt),

        acceptedIdentity: {
          kind: 'club_member',

          userId: String(actorId || ''),

          name: sanitizeChairUmpireName(actorName || current.expectedName || 'Club member'),
        },

        /*
         * Still not scorer.
         */
        scoringAuthority: false,
      }
    },
  )
}

export function acceptChairUmpireAsGuest({ token, name }) {
  const invitation = getChairUmpireInvitationByToken(token)

  if (
    !invitation ||
    invitation.audience !== 'guest' ||
    !chairUmpireInvitationCanBeAccepted(invitation) ||
    !validChairUmpireName(name)
  ) {
    return null
  }

  const acceptedAt = Date.now()

  return replaceInvitation(
    invitation.invitationId,

    (current) => {
      if (!chairUmpireInvitationCanBeAccepted(current)) {
        return null
      }

      return {
        ...current,

        status: 'accepted',

        acceptedAt,

        acceptedExpiresAt: chairUmpireAcceptedExpiry(acceptedAt),

        acceptedIdentity: {
          kind: 'guest',

          guestId: createChairUmpireCandidateId(),

          name: sanitizeChairUmpireName(name),
        },

        scoringAuthority: false,
      }
    },
  )
}

export function declineChairUmpireInvitation({ token, actorId = '' }) {
  const invitation = getChairUmpireInvitationByToken(token)

  if (!invitation || !chairUmpireInvitationCanBeAccepted(invitation)) {
    return false
  }

  if (
    invitation.audience === 'club_member' &&
    String(invitation.expectedUserId || '') !== String(actorId || '')
  ) {
    return false
  }

  return Boolean(
    replaceInvitation(
      invitation.invitationId,

      (current) => ({
        ...current,

        status: 'declined',

        declinedAt: Date.now(),

        scoringAuthority: false,
      }),
    ),
  )
}

export function grantChairUmpireScoringControl(
  invitationId,
  actorId,
) {
  const invitation =
    getChairUmpireInvitation(invitationId)

  const actor = String(actorId || '')

  if (
    !invitation ||
    invitation.status !== 'accepted' ||
    invitation.createdBy !== actor ||
    !chairUmpireCandidateActive(invitation)
  ) {
    return null
  }

  const scorerId =
    chairUmpireAcceptedIdentityId(invitation)

  if (!scorerId) {
    return null
  }

  const currentGrant =
    invitation.controlHandoff

  /*
   * Idempotent:
   *
   * pressing the handoff button twice must not
   * mint competing control grants.
   */
  if (
    currentGrant?.status === 'granted' &&
    currentGrant.scorerId === scorerId &&
    Number(currentGrant.expiresAt || 0) >
      Date.now()
  ) {
    return invitation
  }

  const now = Date.now()

  return replaceInvitation(
    invitation.invitationId,

    (current) => {
      if (
        current.status !== 'accepted' ||
        current.createdBy !== actor ||
        !chairUmpireCandidateActive(current)
      ) {
        return null
      }

      const currentScorerId =
        chairUmpireAcceptedIdentityId(current)

      if (!currentScorerId) {
        return null
      }

      return {
        ...current,

        controlHandoff: {
          grantId:
            createChairUmpireControlGrantId(),

          status: 'granted',

          scorerId: currentScorerId,

          grantedBy: actor,

          grantedAt: now,

          expiresAt: Number(
            current.acceptedExpiresAt || 0,
          ),

          revokedAt: null,

          revokeReason: '',
        },

        /*
         * Still deliberately false.
         *
         * The match's scorerId remains the actual
         * score-authority boundary.
         */
        scoringAuthority: false,
      }
    },
  )
}

export function revokeChairUmpireScoringControl(
  invitationId,
  actorId,
  reason = 'owner_reclaimed',
) {
  const invitation =
    getChairUmpireInvitation(invitationId)

  const actor = String(actorId || '')

  if (
    !invitation ||
    invitation.createdBy !== actor
  ) {
    return null
  }

  if (!invitation.controlHandoff) {
    return invitation
  }

  const now = Date.now()

  return replaceInvitation(
    invitation.invitationId,

    (current) => ({
      ...current,

      controlHandoff: {
        ...current.controlHandoff,

        status: 'revoked',

        revokedAt: now,

        revokeReason: String(reason || '')
          .trim()
          .slice(0, 80),
      },

      scoringAuthority: false,
    }),
  )
}

/*
 * The invitation holder claims the already-approved
 * handoff into this browser tab.
 *
 * This does NOT decide who the scorer is.
 *
 * friendlyMatch.draft.scorerId already did that.
 */
export function claimChairUmpireScoringControl({
  token,
  actorId,
}) {
  const invitation =
    getChairUmpireInvitationByToken(token)

  if (
    !invitation ||
    invitation.status !== 'accepted' ||
    !chairUmpireCandidateActive(invitation)
  ) {
    return null
  }

  const handoff =
    invitation.controlHandoff

  if (
    !handoff ||
    handoff.status !== 'granted' ||
    Number(handoff.expiresAt || 0) <= Date.now()
  ) {
    return null
  }

  const scorerId =
    chairUmpireAcceptedIdentityId(invitation)

  const actor = String(actorId || '')

  if (
    !scorerId ||
    !actor ||
    scorerId !== actor ||
    handoff.scorerId !== scorerId
  ) {
    return null
  }

  if (
    invitation.audience === 'club_member' &&
    String(invitation.expectedUserId || '') !==
      actor
  ) {
    return null
  }

  const now = Date.now()

  return {
    kind:
      CHAIR_UMPIRE_SCORER_SESSION_KIND,

    schemaVersion: 1,

    sessionId:
      createChairUmpireScorerSessionId(),

    invitationId:
      invitation.invitationId,

    /*
     * This token is already known by this recipient.
     * It stays in sessionStorage only after control
     * begins and is never used as the score authority.
     */
    invitationToken:
      normalizeChairUmpireToken(token),

    audience:
      invitation.audience,

    matchId:
      String(invitation.matchId || ''),

    matchType:
      invitation.matchType === 'ladder'
        ? 'ladder'
        : 'friendly',

    scorerId,

    scorerName:
      sanitizeChairUmpireName(
        invitation.acceptedIdentity?.name ||
          'Chair umpire',
      ),

    grantId:
      handoff.grantId,

    scope: ['match:score'],

    createdAt: now,

    expiresAt: Math.min(
      Number(
        invitation.acceptedExpiresAt || 0,
      ),

      Number(handoff.expiresAt || 0),
    ),
  }
}

export function chairUmpireScorerSessionCanControl(
  session,
  matchId = '',
  now = Date.now(),
) {
  if (
    !session ||
    session.kind !==
      CHAIR_UMPIRE_SCORER_SESSION_KIND
  ) {
    return false
  }

  if (
    Number(session.expiresAt || 0) <= now
  ) {
    return false
  }

  if (
    !Array.isArray(session.scope) ||
    !session.scope.includes('match:score')
  ) {
    return false
  }

  const expectedMatchId =
    String(matchId || '')

  if (
    expectedMatchId &&
    String(session.matchId || '') !==
      expectedMatchId
  ) {
    return false
  }

  return Boolean(
    session.scorerId &&
      session.invitationId &&
      session.grantId,
  )
}

export function storeChairUmpireScorerSessionForThisTab(
  session,
) {
  if (
    !sessionStorageAvailable() ||
    !chairUmpireScorerSessionCanControl(
      session,
    )
  ) {
    return false
  }

  try {
    window.sessionStorage.setItem(
      TAB_SCORER_SESSION_KEY,
      JSON.stringify(session),
    )

    return true
  } catch {
    return false
  }
}

export function readChairUmpireScorerSessionForThisTab() {
  if (!sessionStorageAvailable()) {
    return null
  }

  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(
        TAB_SCORER_SESSION_KEY,
      ) || 'null',
    )

    if (
      !chairUmpireScorerSessionCanControl(
        parsed,
      )
    ) {
      window.sessionStorage.removeItem(
        TAB_SCORER_SESSION_KEY,
      )

      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function clearChairUmpireScorerSessionForThisTab() {
  if (!sessionStorageAvailable()) {
    return
  }

  try {
    window.sessionStorage.removeItem(
      TAB_SCORER_SESSION_KEY,
    )
  } catch {
    // no-op
  }
}

/*
 * MATCH OWNER / MANAGER REMOVES THE INVITE OR
 * ACCEPTED CANDIDATE.
 *
 * This still does not modify scorerId.
 */
export function cancelChairUmpireInvitation(invitationId, actorId) {
  const invitation = getChairUmpireInvitation(invitationId)

  if (!invitation || !['waiting', 'accepted'].includes(invitation.status)) {
    return false
  }

  if (invitation.createdBy !== String(actorId || '')) {
    return false
  }

  return Boolean(
    replaceInvitation(
      invitation.invitationId,

      (current) => ({
        ...current,

        status: 'cancelled',

        cancelledAt: Date.now(),

        acceptedIdentity: null,

        controlHandoff: current.controlHandoff
          ? {
              ...current.controlHandoff,

              status: 'revoked',

              revokedAt: Date.now(),

              revokeReason:
                'invitation_cancelled',
            }
          : null,

        scoringAuthority: false,
      }),
    ),
  )
}

export function subscribeToChairUmpireInvitation(invitationId, onChange) {
  if (!browserAvailable() || typeof onChange !== 'function') {
    return () => {}
  }

  const id = String(invitationId || '')

  if (!id) {
    return () => {}
  }

  function emit() {
    onChange(getChairUmpireInvitation(id))
  }

  function handleStorage(event) {
    if (event.key === STORAGE_KEY) {
      emit()
    }
  }

  function handleLocal() {
    emit()
  }

  window.addEventListener('storage', handleStorage)

  window.addEventListener(LOCAL_EVENT, handleLocal)

  emit()

  return () => {
    window.removeEventListener('storage', handleStorage)

    window.removeEventListener(LOCAL_EVENT, handleLocal)
  }
}
