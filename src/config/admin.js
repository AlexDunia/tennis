import { LADDER_CONFIG } from './ladder.js'

export const CLUB_SETUP_STORAGE_KEY = 'gorra.admin.clubSetup.v1'
export const CLUB_SETUP_SCHEMA_VERSION = 1

export const ADMIN_SETUP_STEPS = Object.freeze([
  { key: 'name', label: 'Club name', eyebrow: 'About your club' },
  { key: 'location', label: 'Club location', eyebrow: 'About your club' },
  { key: 'play', label: 'Ladder matches', eyebrow: 'How you play' },
  { key: 'groups', label: 'Ladder groups', eyebrow: 'Who can join' },
  { key: 'members', label: 'Add members', eyebrow: 'Bring your club' },
  { key: 'review', label: 'Review', eyebrow: 'Ready to finish' },
])

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
  { id: 'intermediate', name: 'Intermediate Division', matchType: 'singles' },
])

export const PLACEMENT_METHODS = Object.freeze([
  {
    id: 'import',
    label: 'Import current rankings',
    description: "Use the club's real ladder positions as the starting order.",
    recommended: true,
    available: true,
  },
  {
    id: 'manual',
    label: 'Arrange players manually',
    description: 'An administrator sets the complete starting order.',
  },
  {
    id: 'club-level',
    label: 'Use known club levels',
    description: 'Seed broad levels, then review every position before publishing.',
  },
  {
    id: 'placement-matches',
    label: 'Run placement matches',
    description: 'Keep positions provisional until placement results are complete.',
  },
  {
    id: 'bottom-provisional',
    label: 'Start at the bottom',
    description: 'New members enter at the bottom with provisional status.',
  },
])

export const MOVEMENT_SYSTEMS = Object.freeze([
  {
    id: 'position-swap',
    label: 'Position swap',
    description: 'If the challenger wins, the two players exchange positions.',
    recommended: true,
  },
  {
    id: 'leapfrog',
    label: 'Leapfrog',
    description: 'The winner takes the challenged position and intervening players move down.',
    available: true,
  },
  {
    id: 'points',
    label: 'Points ladder',
    description: 'Positions are ordered from competition points.',
    available: false,
  },
  {
    id: 'rating',
    label: 'Rating based',
    description: 'A rating formula recalculates positions after confirmed results.',
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
  },
  {
    id: 'time-smart',
    label: 'Time-Smart Club Match',
    description: 'Two tie-break sets, then a 10-point match tie-break.',
    matchFormat: 'match-tiebreak-third',
    decidingSet: 'match-tiebreak',
    tieBreakPoints: 7,
  },
])

export function createDefaultClubSetup() {
  const seasonYear = new Date().getFullYear()
  return {
    schemaVersion: CLUB_SETUP_SCHEMA_VERSION,
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
      administratorIds: ['player-02'],
      notifications: {
        email: true,
        sms: false,
        challengeReminders: true,
      },
    },
    membership: {
      source: 'later',
      selectedPlayerIds: [],
      inviteEmails: '',
      invitePhones: '',
      privateLinkEnabled: true,
      invitationToken: '',
      allowManualEntry: true,
    },
    ladders: [
      {
        id: LADDER_CONFIG.id,
        name: 'Open Singles',
        matchType: 'singles',
        enabled: true,
      },
    ],
    primaryLadderId: LADDER_CONFIG.id,
    placement: {
      method: 'import',
      provisionalMatches: 3,
      newMemberPolicy: 'bottom-provisional',
      rankingOrder: [],
    },
    rules: {
      challengeRangeUp: LADDER_CONFIG.challengeRangeUp,
      allowDownwardChallenges: LADDER_CONFIG.allowDownwardChallenges,
      maxActiveChallenges: LADDER_CONFIG.maxActiveChallenges,
      responseHours: LADDER_CONFIG.responseHours,
      completionDays: LADDER_CONFIG.completionDays,
      rematchCooldownDays: 14,
      repeatedDeclineLimit: 3,
      inactivityDays: 30,
      noShowPolicy: 'walkover-after-review',
      movementSystem: LADDER_CONFIG.movementSystem,
      matchPreset: 'time-smart',
      scoring: LADDER_CONFIG.scoring,
    },
    createdAt: '',
    updatedAt: '',
  }
}
