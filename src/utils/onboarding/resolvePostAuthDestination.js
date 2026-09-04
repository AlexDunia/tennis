const INTERNAL_REDIRECT_BASE = 'https://gorra.local'

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

export function safeInternalRedirect(value) {
  const candidate = String(firstQueryValue(value) || '').trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return ''
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return ''

  try {
    const parsed = new URL(candidate, INTERNAL_REDIRECT_BASE)
    if (parsed.origin !== INTERNAL_REDIRECT_BASE) return ''
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return ''
  }
}

function invitationValue(value) {
  return String(firstQueryValue(value) || '').trim().slice(0, 2048)
}

function uniqueActiveClubs(activeClubs) {
  const seen = new Set()
  return activeClubs.filter((club) => {
    const id = String(club?.id || '').trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function resolvePostAuthDestination({ redirect, invite, activeClubs } = {}) {
  const safeRedirect = safeInternalRedirect(redirect)
  if (safeRedirect) {
    return {
      destination: safeRedirect,
      activeClubId: '',
      reason: 'explicit-redirect',
    }
  }

  const clubInvite = invitationValue(invite)
  if (clubInvite) {
    return {
      destination: { name: 'Clubs', query: { view: 'join', invite: clubInvite } },
      activeClubId: '',
      reason: 'club-invitation',
    }
  }

  if (!Array.isArray(activeClubs)) return null

  const clubs = uniqueActiveClubs(activeClubs)
  if (clubs.length === 1) {
    return {
      destination: { name: 'Club' },
      activeClubId: String(clubs[0].id),
      reason: 'single-active-club',
    }
  }

  return {
    destination: { name: 'Clubs' },
    activeClubId: '',
    reason: clubs.length === 0 ? 'zero-active-clubs' : 'multiple-active-clubs',
  }
}
