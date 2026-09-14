export const LADDER_IMPORT_ORIGINS = Object.freeze({
  LADDER: 'ladder',
  SETUP_MEMBERS: 'setup-members',
})

export function normalizeLadderImportOrigin(value) {
  return value === LADDER_IMPORT_ORIGINS.SETUP_MEMBERS
    ? LADDER_IMPORT_ORIGINS.SETUP_MEMBERS
    : LADDER_IMPORT_ORIGINS.LADDER
}

export function ladderImportBackRoute({
  origin,
  ladderId,
} = {}) {
  const safeOrigin = normalizeLadderImportOrigin(origin)
  const safeLadderId = String(ladderId || '').trim()

  if (
    safeOrigin === LADDER_IMPORT_ORIGINS.SETUP_MEMBERS &&
    safeLadderId
  ) {
    return {
      name: 'LadderSetup',
      params: {
        ladderId: safeLadderId,
        step: 'members',
      },
    }
  }

  if (safeLadderId) {
    return {
      name: 'Rankings',
      query: {
        ladder: safeLadderId,
      },
    }
  }

  return {
    name: 'Rankings',
  }
}
