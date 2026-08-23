/*
 * GORRA — CHAIR UMPIRE INVITATION DOMAIN
 *
 * IMPORTANT:
 *
 * An accepted umpire invitation represents:
 *
 *   "This person is willing to umpire."
 *
 * It does NOT represent:
 *
 *   "This person may score the match."
 *
 * Scoring authority is granted separately in 4D.
 */

export const CHAIR_UMPIRE_SCHEMA_VERSION = 1

export const CHAIR_UMPIRE_INVITATION_KIND = 'gorra.chair-umpire-invitation'

export const CHAIR_UMPIRE_SCORER_SESSION_KIND =
  'gorra.chair-umpire-scorer-session'

export const CHAIR_UMPIRE_INVITATION_TTL_MS = 10 * 60 * 1000

export const CHAIR_UMPIRE_CANDIDATE_TTL_MS = 12 * 60 * 60 * 1000

const VALID_AUDIENCES = new Set(['club_member', 'guest'])

function cleanText(value, maxLength = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function secureRandomHex(byteLength) {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random generation is unavailable.')
  }

  const bytes = new Uint8Array(byteLength)

  crypto.getRandomValues(bytes)

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createChairUmpireControlGrantId() {
  return `grant-${secureRandomHex(18)}`
}

export function createChairUmpireScorerSessionId() {
  return `scorer-${secureRandomHex(24)}`
}

export function chairUmpireAcceptedIdentityId(invitation = {}) {
  return cleanText(
    invitation.acceptedIdentity?.userId ||
      invitation.acceptedIdentity?.guestId ||
      '',
    120,
  )
}

export function normalizeChairUmpireToken(value) {
  return cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '')
    .slice(0, 64)
}

export function sanitizeChairUmpireName(value) {
  return cleanText(value, 60)
}

export function validChairUmpireName(value) {
  const name = sanitizeChairUmpireName(value)

  return name.length >= 2 && name.length <= 60
}

export function createChairUmpireCandidateId() {
  return `guest-${secureRandomHex(12)}`
}

export function createChairUmpireInvitation({
  matchId,
  matchType = 'friendly',
  clubId = '',
  createdBy,
  createdByName = '',
  audience,
  expectedUserId = '',
  expectedName = '',
  playerAName = '',
  playerBName = '',
}) {
  const safeMatchId = cleanText(matchId, 120)

  const safeCreator = cleanText(createdBy, 120)

  if (!safeMatchId || !safeCreator || !VALID_AUDIENCES.has(audience)) {
    throw new Error('A valid match, creator and invitation type are required.')
  }

  const safeExpectedUserId = cleanText(expectedUserId, 120)

  if (audience === 'club_member' && !safeExpectedUserId) {
    throw new Error('A club member must be selected.')
  }

  const now = Date.now()

  return {
    kind: CHAIR_UMPIRE_INVITATION_KIND,

    schemaVersion: CHAIR_UMPIRE_SCHEMA_VERSION,

    invitationId: secureRandomHex(18),

    /*
     * High-entropy one-time invitation ticket.
     *
     * This is not scorer authority.
     */
    token: secureRandomHex(32),

    matchId: safeMatchId,

    matchType: matchType === 'ladder' ? 'ladder' : 'friendly',

    clubId: cleanText(clubId, 120),

    audience,

    createdBy: safeCreator,

    createdByName: cleanText(createdByName, 80),

    expectedUserId: safeExpectedUserId,

    expectedName: cleanText(expectedName, 80),

    matchSummary: {
      playerAName: cleanText(playerAName, 80),

      playerBName: cleanText(playerBName, 80),
    },

    status: 'waiting',

    createdAt: now,

    expiresAt: now + CHAIR_UMPIRE_INVITATION_TTL_MS,

    acceptedAt: null,

    acceptedExpiresAt: null,

    acceptedIdentity: null,

    cancelledAt: null,

    declinedAt: null,

    /*
     * Acceptance remains different from Match Control.
     *
     * This stays false even when a handoff exists.
     * Actual scoring authority lives on match.scorerId.
     */
    scoringAuthority: false,

    /*
     * Notification/capability bridge only.
     *
     * This does NOT itself authorize a score mutation.
     */
    controlHandoff: null,
  }
}

export function chairUmpireInvitationExpired(invitation, now = Date.now()) {
  if (!invitation) {
    return true
  }

  return Number(invitation.expiresAt || 0) <= now
}

export function chairUmpireInvitationCanBeAccepted(invitation, now = Date.now()) {
  return Boolean(
    invitation &&
    invitation.kind === CHAIR_UMPIRE_INVITATION_KIND &&
    invitation.status === 'waiting' &&
    !chairUmpireInvitationExpired(invitation, now),
  )
}

export function chairUmpireCandidateActive(invitation, now = Date.now()) {
  return Boolean(
    invitation &&
    invitation.status === 'accepted' &&
    Number(invitation.acceptedExpiresAt || 0) > now,
  )
}

export function chairUmpireInvitationIsActive(invitation, now = Date.now()) {
  return (
    chairUmpireInvitationCanBeAccepted(invitation, now) ||
    chairUmpireCandidateActive(invitation, now)
  )
}

export function chairUmpireAcceptedExpiry(acceptedAt = Date.now()) {
  return Number(acceptedAt) + CHAIR_UMPIRE_CANDIDATE_TTL_MS
}
