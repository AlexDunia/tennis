export const ACCESS_ROLES = {
  player: {
    key: 'player',
    label: 'Player',
    permissions: [
      'tournaments.view',
      'matches.view',
      'rankings.view',
      'challenges.create',
    ],
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
  super_admin: {
    key: 'super_admin',
    label: 'Super Admin',
    permissions: ['*'],
  },
}

const LOCAL_ADMIN_PLAYER_IDS = new Set(['player-02'])

export function getDefaultRoleForIdentity(identity = {}) {
  if (LOCAL_ADMIN_PLAYER_IDS.has(identity.id)) {
    return ACCESS_ROLES.super_admin.key
  }

  return identity.roleKey || identity.role || ACCESS_ROLES.player.key
}

export function buildAccessProfile(identity = {}, roleKey = getDefaultRoleForIdentity(identity)) {
  const role = ACCESS_ROLES[roleKey] || ACCESS_ROLES.player
  const permissions = role.permissions.includes('*')
    ? ['*']
    : [...new Set([...(identity.permissions || []), ...role.permissions])]

  return {
    roleKey: role.key,
    roleLabel: role.label,
    roles: [role.key],
    permissions,
    isAdmin: role.key === ACCESS_ROLES.super_admin.key || role.key === ACCESS_ROLES.tournament_admin.key,
  }
}

export function hasPermission(identity = {}, permission) {
  const permissions = identity.permissions || []
  return permissions.includes('*') || permissions.includes(permission)
}
