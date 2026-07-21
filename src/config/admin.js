export const CLUB_SETUP_STORAGE_KEY = 'gorra.admin.clubSetup.v1'
export const CLUB_DIRECTORY_STORAGE_KEY = 'gorra.admin.clubDirectory.v2'
export const CLUB_SETUP_SCHEMA_VERSION = 2
export const CLUB_DIRECTORY_SCHEMA_VERSION = 2

export const ADMIN_SETUP_STEPS = Object.freeze([
  { key: 'workspace', label: 'Club workspace', eyebrow: 'Step 1 of 5' },
  { key: 'members', label: 'Add members', eyebrow: 'Step 2 of 5' },
  { key: 'ladders', label: 'Create club ladders', eyebrow: 'Step 3 of 5' },
  { key: 'placement', label: 'Place players', eyebrow: 'Step 4 of 5' },
  { key: 'rules', label: 'Set the rules', eyebrow: 'Step 5 of 5' },
])

export const CLUB_MEMBERSHIP_ROLES = Object.freeze(['admin', 'co-admin', 'player'])

export const TIMEZONE_OPTIONS = Object.freeze([
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
])

export const LADDER_TEMPLATES = Object.freeze([
  { id: 'open-singles', name: 'Open Singles', matchType: 'singles' },
  { id: 'womens-singles', name: "Women's Singles", matchType: 'singles' },
  { id: 'mens-singles', name: "Men's Singles", matchType: 'singles' },
  { id: 'senior-singles', name: 'Senior Singles', matchType: 'singles' },
  { id: 'doubles', name: 'Doubles', matchType: 'doubles' },
  { id: 'intermediate', name: 'Beginner / Intermediate', matchType: 'singles' },
])

export const PLACEMENT_METHODS = Object.freeze([
  {
    id: 'bottom-provisional',
    label: 'Start at the bottom',
    description: 'New members start at the bottom while their position settles.',
    recommended: true,
    available: true,
  },
  {
    id: 'import',
    label: 'Import current rankings',
    description: "Keep the club's current ladder order.",
    available: true,
  },
  {
    id: 'manual',
    label: 'Arrange players manually',
    description: 'Put each player in the right starting position.',
    available: true,
  },
  {
    id: 'club-level',
    label: 'Use club levels',
    description: 'Start from the playing levels your club already uses.',
    available: true,
  },
  {
    id: 'placement-matches',
    label: 'Run placement matches',
    description: 'Use match results to set the first ladder order.',
    available: true,
  },
])

export const MOVEMENT_SYSTEMS = Object.freeze([
  {
    id: 'position-swap',
    label: 'Position swap',
    description: 'If the challenger wins, the two players swap places.',
    recommended: true,
    available: true,
  },
  {
    id: 'leapfrog',
    label: 'Leapfrog',
    description: 'The winner takes the challenged place and the players between them move down.',
    available: true,
  },
  {
    id: 'points',
    label: 'Points ladder',
    description: 'Match points decide the ladder order.',
    available: false,
  },
  {
    id: 'rating',
    label: 'Rating based',
    description: 'A rating decides the ladder order after each result.',
    available: false,
  },
])

export const MATCH_FORMAT_PRESETS = Object.freeze([
  {
    id: 'standard-club',
    label: 'Standard Club Match',
    description: 'Best of three tie-break sets with a normal final set.',
    matchFormat: 'best-of-3',
    decidingSet: 'full-set',
    tieBreakPoints: 7,
    scoring: 'ad',
  },
  {
    id: 'time-smart',
    label: 'Time-Smart Club Match',
    description: 'Two tie-break sets, then a 10-point match tie-break.',
    matchFormat: 'match-tiebreak-third',
    decidingSet: 'match-tiebreak',
    tieBreakPoints: 7,
    decidingTieBreakPoints: 10,
    scoring: 'ad',
  },
])

export function createDefaultClubSetup() {
  const seasonYear = new Date().getFullYear()
  return {
    schemaVersion: CLUB_SETUP_SCHEMA_VERSION,
    clubId: '',
    status: 'draft',
    completedStep: 0,
    workspace: {
      name: '',
      logoUrl: '',
      location: '',
      timezone: 'Africa/Lagos',
      courts: ['Main Court'],
      seasonStart: `${seasonYear}-01-01`,
      seasonEnd: `${seasonYear}-12-31`,
      administratorIds: [],
      notifications: {
        email: true,
        sms: false,
        challengeReminders: true,
      },
    },
    membership: {
      source: 'private-link',
      selectedPlayerIds: [],
      inviteEmails: '',
      invitePhones: '',
      privateLinkEnabled: true,
      invitationToken: '',
      invitationCode: '',
      inviteRole: 'player',
      importedMembers: [],
      manualMembers: [],
      roster: [],
      allowManualEntry: true,
    },
    ladders: [
      {
        id: 'open-singles',
        name: 'Open Singles',
        matchType: 'singles',
        enabled: true,
        archived: false,
      },
    ],
    primaryLadderId: 'open-singles',
    placement: {
      method: 'bottom-provisional',
      provisionalMatches: 3,
      newMemberPolicy: 'bottom-provisional',
      rankingOrder: [],
    },
    rules: {
      challengeRangeUp: 3,
      allowDownwardChallenges: false,
      maxActiveChallenges: 1,
      responseHours: 48,
      completionDays: 7,
      rematchCooldownDays: 7,
      repeatedDeclineLimit: 3,
      inactivityDays: 30,
      noShowPolicy: 'walkover-after-review',
      movementSystem: 'position-swap',
      matchPreset: 'time-smart',
      scoring: 'ad',
      resultConfirmation: 'both-players',
      disputeResolution: 'admin',
    },
    createdAt: '',
    updatedAt: '',
  }
}
