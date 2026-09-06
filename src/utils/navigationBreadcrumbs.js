// Structural breadcrumbs are stable on direct links, refresh, and browser back.
export function buildNavigationBreadcrumbs({ route, club, member, tournament, category, title, nestedCrumbs = [] }) {
  const name = String(route.name || '')
  const current = title || route.meta?.title || name
  const crumb = (label, routeName, params, query) => ({ label, ...(routeName ? { to: { name: routeName, ...(params ? { params } : {}), ...(query ? { query } : {}) } } : {}) })
  const clubRoot = crumb('Club', 'Clubs')
  const clubTrail = [clubRoot, crumb(club?.name || 'Current club', 'Club')]
  let items = []
  if (name === 'Clubs') {
    if (route.query?.view === 'create') items = [clubRoot, crumb('Create club')]
    if (route.query?.view === 'join') items = [clubRoot, crumb('Join a club')]
  } else if (name === 'Club') {
    items = clubTrail
  } else if (['ClubMembers', 'ClubMemberImport', 'ClubMemberManual', 'ClubMemberDetail'].includes(name)) {
    items = [...clubTrail, crumb('Members', 'ClubMembers')]
    if (name === 'ClubMemberDetail') items.push(crumb(member?.name || current))
    if (name === 'ClubMemberManual') items.push(crumb('Add member'))
    if (name === 'ClubMemberImport') {
      items.push(crumb('Import members', 'ClubMemberImport'))
      const scenario = { 'members-only': 'Members only', 'one-ladder': 'One ladder', 'multiple-ladders': 'Multiple ladders' }[route.query?.scenario]
      if (scenario) items.push(crumb(scenario))
      if (nestedCrumbs.at(-1)?.label === 'Review') items.push(crumb('Review'))
    }
  } else if (['ClubSettingsHub', 'Settings'].includes(name)) {
    items = [...clubTrail, crumb('Settings', 'ClubSettingsHub')]
    if (name === 'Settings') items.push(crumb(String(route.query?.section || 'Club details').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase())))
  } else if (name.startsWith('Tournament') && name !== 'Tournaments') {
    items = [crumb('Tournaments', 'Tournaments')]
    if (route.params?.tournamentId) {
      items.push(crumb(tournament?.name || 'Tournament', 'TournamentOverview', { tournamentId: route.params.tournamentId }))
      if (name !== 'TournamentOverview') items.push(crumb(category?.name || current.replace(/^Tournament /, '')))
    } else items.push(crumb('Create tournament'))
  } else if (name.startsWith('FriendlyMatch')) {
    items = [crumb('Play', 'Play'), crumb('New match', 'FriendlyMatchType')]
    if (name !== 'FriendlyMatchType') items.push(crumb(current))
  } else if (['ChallengeDetails', 'CreateChallenge'].includes(name)) {
    items = [crumb('Ladder', 'Rankings'), crumb('Challenges', 'Challenges'), crumb(current)]
  } else if (name === 'Challenges') {
    items = [crumb('Ladder', 'Rankings'), crumb('Challenges')]
  } else if (['MatchDetails', 'LiveOperationDetail'].includes(name)) {
    items = [crumb('Play', 'Play'), ...(name === 'LiveOperationDetail' ? [crumb('Live operations', 'LiveOperations')] : []), crumb(current)]
  } else if (['AccountSettings', 'History'].includes(name)) {
    items = [crumb('Profile', 'Profile'), crumb(current)]
  } else if (!['Dashboard', 'Play', 'Rankings', 'Tournaments'].includes(name) && !route.meta?.public) {
    items = [crumb('Home', 'Dashboard'), crumb(current)]
  }
  // The current location is text; ancestors remain navigable.
  return items.map((item, index) => index === items.length - 1 ? { label: item.label } : item)
}
