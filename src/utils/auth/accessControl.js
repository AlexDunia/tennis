export const ACCESS_ROLES = {
  player: {
    key: 'player',
    label: 'Player',
    permissions: ['tournaments.view', 'matches.view', 'rankings.view', 'challenges.create'],
  },
  tournament_admin: {
    key: 'tournament_admin',
    label: 'Tournament Admin',
    permissions: [
      'tournaments.view',
      'tournaments.manage',
      'tournaments.score.update',
      'tournaments.fixtures.manage',
      'tournaments.knockout.manage',
      'tournaments.images.manage',
      'matches.view',
      'matches.live_score',
      'rankings.view',
      'challenges.create',
    ],
  },
  club_admin: {
    key: 'club_admin',
    label: 'Club Admin',
    permissions: [
      'club.manage',
      'tournaments.view',
      'tournaments.manage',
      'tournaments.score.update',
      'tournaments.fixtures.manage',
      'tournaments.knockout.manage',
      'tournaments.images.manage',
      'matches.view',
      'matches.live_score',
      'rankings.view',
      'challenges.create',
    ],
  },
  super_admin: {
    key: 'super_admin',
    label: 'Super Admin',
    permissions: ['*'],
  },
}

const CLUB_MEMBER_PERMISSIONS = Object.freeze([
  'tournaments.view',
  'matches.view',
  'rankings.view',
  'challenges.create',
])

const CLUB_MANAGER_PERMISSIONS = Object.freeze([
  'club.manage',
  'tournaments.manage',
  'tournaments.score.update',
  'tournaments.fixtures.manage',
  'tournaments.knockout.manage',
  'tournaments.images.manage',
  'matches.live_score',
])

const CLUB_MANAGER_ROLES = new Set(['admin', 'co-admin'])

const LOCAL_ADMIN_PLAYER_IDS = new Set(['player-02'])

export function getDefaultRoleForIdentity(identity = {}) {
  if (LOCAL_ADMIN_PLAYER_IDS.has(identity.id)) {
    return ACCESS_ROLES.super_admin.key
  }

  return identity.roleKey || identity.role || ACCESS_ROLES.player.key
}

export function buildAccessProfile(identity = {}, roleKey = getDefaultRoleForIdentity(identity)) {
  const role = ACCESS_ROLES[roleKey] || ACCESS_ROLES.player
  const permissions = role.permissions.includes('*') ? ['*'] : [...role.permissions]

  return {
    roleKey: role.key,
    roleLabel: role.label,
    roles: [role.key],
    permissions,
    isAdmin: [
      ACCESS_ROLES.club_admin.key,
      ACCESS_ROLES.super_admin.key,
      ACCESS_ROLES.tournament_admin.key,
    ].includes(role.key),
  }
}

export function hasPermission(identity = {}, permission) {
  const permissions = identity.permissions || []
  return permissions.includes('*') || permissions.includes(permission)
}

export function buildClubMembershipAccess(membership = {}) {
  const status = membership.status || 'active'
  const role = membership.role || 'player'
  const isActive = Boolean(membership.userId && membership.clubId && status === 'active')
  const isManager = isActive && CLUB_MANAGER_ROLES.has(role)
  const permissions = isActive
    ? [...CLUB_MEMBER_PERMISSIONS, ...(isManager ? CLUB_MANAGER_PERMISSIONS : [])]
    : []

  return {
    status,
    role,
    permissions,
    isManager,
  }
}

export function hasClubMembershipPermission(membership = {}, permission) {
  return buildClubMembershipAccess(membership).permissions.includes(permission)
}
