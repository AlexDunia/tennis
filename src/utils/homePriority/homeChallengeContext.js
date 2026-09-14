// Home must not attribute an unscoped or conflicting record to the current club.
export function belongsToHomeClub({ challenge, match, clubId }) {
  const activeClubId = String(clubId || '').trim()
  const clubs = [challenge?.clubId, match?.clubId]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return Boolean(
    activeClubId &&
    clubs.length &&
    clubs.every((value) => value === activeClubId) &&
    !['completed', 'cancelled', 'declined', 'expired'].includes(match?.status),
  )
}
