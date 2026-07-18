import {
  ADMIN_SETUP_STEPS,
  CLUB_SETUP_STORAGE_KEY,
  CLUB_SETUP_SCHEMA_VERSION,
  createDefaultClubSetup,
} from '../config/admin'
import { hasPermission } from '../utils/auth/accessControl'
import { normalizeClubSetup, validateCompleteClubSetup } from '../utils/admin/clubSetup'

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function assertClubManager(actor = {}) {
  if (!hasPermission(actor, 'club.manage')) {
    const error = new Error('You do not have permission to manage club configuration.')
    error.code = 'FORBIDDEN'
    throw error
  }
}

export async function getClubSetup() {
  if (!canUseStorage()) return createDefaultClubSetup()
  try {
    const stored = JSON.parse(window.localStorage.getItem(CLUB_SETUP_STORAGE_KEY) || 'null')
    if (!stored || stored.schemaVersion !== CLUB_SETUP_SCHEMA_VERSION)
      return createDefaultClubSetup()
    const normalized = normalizeClubSetup(stored.setup)
    const isUntouchedLegacyDraft =
      normalized.status === 'draft' &&
      normalized.completedStep === 0 &&
      !normalized.workspace.name &&
      normalized.membership.selectedPlayerIds.length === 0
    return isUntouchedLegacyDraft ? createDefaultClubSetup() : normalized
  } catch {
    return createDefaultClubSetup()
  }
}

export async function saveClubSetup(input, actor) {
  assertClubManager(actor)
  const normalized = normalizeClubSetup(input)
  const validation = validateCompleteClubSetup(normalized)
  if (!validation.valid) {
    const error = new Error(
      validation.errors[0]?.message || 'Review the club setup before publishing it.',
    )
    error.code = 'VALIDATION_ERROR'
    error.details = validation.errors
    throw error
  }

  const now = new Date().toISOString()
  const setup = {
    ...normalized,
    status: 'active',
    completedStep: ADMIN_SETUP_STEPS.length,
    createdAt: normalized.createdAt || now,
    updatedAt: now,
  }

  if (canUseStorage()) {
    window.localStorage.setItem(
      CLUB_SETUP_STORAGE_KEY,
      JSON.stringify({ schemaVersion: CLUB_SETUP_SCHEMA_VERSION, setup }),
    )
  }
  return setup
}

export async function saveClubSetupDraft(input, actor) {
  assertClubManager(actor)
  const normalized = normalizeClubSetup(input)
  const now = new Date().toISOString()
  const setup = {
    ...normalized,
    status: 'draft',
    updatedAt: now,
  }
  if (canUseStorage()) {
    window.localStorage.setItem(
      CLUB_SETUP_STORAGE_KEY,
      JSON.stringify({ schemaVersion: CLUB_SETUP_SCHEMA_VERSION, setup }),
    )
  }
  return setup
}
