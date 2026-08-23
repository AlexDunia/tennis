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
  chairUmpireInvitationCanBeAccepted,
  chairUmpireInvitationIsActive,
  createChairUmpireCandidateId,
  createChairUmpireInvitation,
  normalizeChairUmpireToken,
  sanitizeChairUmpireName,
  validChairUmpireName,
} from '../utils/chairUmpire'

const STORAGE_KEY = 'gorra.chairUmpireInvitations.v1'

const LOCAL_EVENT = 'gorra:chair-umpire-change'

const STORAGE_PROBE = 'gorra.chairUmpireStorageProbe'

const MAX_INVITATIONS = 50

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
