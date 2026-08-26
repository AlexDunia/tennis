<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAdminStore } from '../stores/admin'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { usePlayerStore } from '../stores/player'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { useNotificationStore } from '../stores/notification'
import { verifyLadderCreationAccess } from '../services/LadderAccessService'
import CompletedMatchResult from '../components/match/CompletedMatchResult.vue'
import {
  ACTIVE_LADDER_CHALLENGE_STATUSES,
  deadlineFromNow,
  getActiveLadderConfig,
  isEligibleLadderOpponent,
  ladderMatchConfig,
  ladderMovementFor,
  ladderWindowFor,
} from '../config/ladder'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import MatchResultModal from '../components/friendly/MatchResultModal.vue'
import LiveMatchControl from '../components/match/LiveMatchControl.vue'
import {
  buildTennisAnnouncement,
  buildTennisCorrectionAnnouncement,
  cancelTennisAnnouncements,
  speakTennisAnnouncement,
} from '../utils/tennisAnnouncements'
import {
  createCompletedScoreboardSnapshot,
  createLiveScoreboardSnapshot,
  getLiveScoreboardMatchId,
} from '../utils/liveScoreboardSnapshot'
import {
  createLiveOperationsSnapshot,
} from '../utils/liveOperationsSnapshot'
import { publishLiveMatchSnapshot, startLiveMatchHeartbeat } from '../services/liveMatchRealtime'
import {
  publishLiveOperationsSnapshot,
} from '../services/liveOperationsRegistry'
import {
  cancelPairingSession,
  createPairingSession,
  revokePairedDisplay,
  subscribeToPairingSession,
} from '../services/tvPairingService'
import { formatPairingCode } from '../utils/tvPairing'
import {
  cancelChairUmpireInvitation,
  chairUmpireScorerSessionCanControl,
  clearChairUmpireScorerSessionForThisTab,
  createChairUmpireInvitationSession,
  getActiveChairUmpireInvitationForMatch,
  grantChairUmpireScoringControl,
  readChairUmpireScorerSessionForThisTab,
  revokeChairUmpireScoringControl,
  subscribeToChairUmpireInvitation,
} from '../services/chairUmpireService'
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const friendlyMatchStore = useFriendlyMatchStore()
const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const notificationStore = useNotificationStore()
const inlineNote = ref('')
const searchQuery = ref('')
const qrDataUrl = ref('')
const copyStatus = ref('')
const joinMessage = ref('')
const joinedNotice = ref('')
const externalInvitation = ref(null)
const customFormatError = ref('')
const showTieBreakDetails = ref(false)
const resultModalOpen = ref(false)
const friendlyFinalizing = ref(false)

const chairUmpireOpen = ref(false)

const chairUmpireInvitation = ref(null)

const chairUmpireQrDataUrl = ref('')

const chairUmpireScorerSession =
  ref(
    readChairUmpireScorerSessionForThisTab(),
  )

let stopChairUmpireSubscription = () => {}

const tvPairingOpen = ref(false)

const tvPairingSession = ref(null)

const tvPairingMessage = ref('')

const tvPairingQrDataUrl =
  ref('')

let stopTvPairingSubscription =
  () => {}

const liveAnnouncement = ref('')

/*
 * Presentation-only feedback.
 *
 * This does NOT determine who won the point.
 * It only remembers which successful scoring
 * action should receive visual confirmation.
 */
const lastPointWinner = ref('')

const voiceAnnouncementsEnabled = ref(readVoiceAnnouncementPreference())

const voiceAnnouncementsSupported = computed(() => {
  if (typeof window === 'undefined') {
    return false
  }

  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
})

const ladderAccessChecking = ref(false)
const customFormatForm = reactive({
  id: '',
  name: '',
  mode: 'sets',
  setsToWin: 2,
  gamesPerSet: 6,
  tieBreakAt: 6,
  tieBreakPoints: 7,
  saveForLater: false,
})
let invitationTimer = null
let autoRouteTimer = null
let liveAnnouncementTimer = null
let pointFeedbackTimer = null
let stopScoreboardHeartbeat = () => {}

const VOICE_ANNOUNCEMENT_STORAGE_KEY = 'gorra.matchVoiceAnnouncements.v1'

function readVoiceAnnouncementPreference() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true
  }

  const stored = window.localStorage.getItem(VOICE_ANNOUNCEMENT_STORAGE_KEY)

  /*
   * Default is ON.
   *
   * Only an explicit stored "false"
   * turns announcements off.
   */
  return stored !== 'false'
}

const step = computed(() => String(route.meta.friendlyStep || 'type'))

const isChairUmpireControlRoute =
  computed(
    () =>
      route.meta.umpireControl ===
      true,
  )

const requestedLiveMatchId =
  computed(() => {
    if (
      step.value !== 'live'
    ) {
      return ''
    }

    const routeMatchId =
      String(
        route.params.matchId ||
          '',
      )
        .trim()
        .slice(0, 120)

    if (routeMatchId) {
      return routeMatchId
    }

    /*
     * Guest chair umpires may still arrive through
     * the migration-compatible route without a URL
     * parameter.
     *
     * Their scorer capability is tab-bound and already
     * identifies the exact match.
     */
    if (
      isChairUmpireControlRoute
        .value
    ) {
      return String(
        chairUmpireScorerSession
          .value?.matchId ||
          '',
      )
        .trim()
        .slice(0, 120)
    }

    return ''
  })

const currentLiveMatchId =
  computed(
    () =>
      requestedLiveMatchId.value ||
      friendlyMatchStore
        .liveMatchId ||
      getLiveScoreboardMatchId(
        friendlyMatchStore.draft,
      ),
  )

const isLadder = computed(() => friendlyMatchStore.draft.matchType === 'ladder')
const isFriendly = computed(() => friendlyMatchStore.draft.matchType === 'friendly')
const isPlayNow = computed(() => friendlyMatchStore.draft.timing === 'now')
const selectedOpponentId = computed(() => friendlyMatchStore.draft.opponent?.id || '')
const opponentName = computed(() => friendlyMatchStore.draft.opponent?.name || 'Opponent')
const authenticatedIdentity =
  computed(() => ({
    id:
      authStore.user?.playerId ||
      playerStore.currentPlayer?.id ||
      authStore.user?.id ||
      '',

    name:
      playerStore.currentPlayer?.name ||
      authStore.user?.name ||
      'Club player',

    rank:
      playerStore.currentPlayer?.rank ||
      null,

    category:
      playerStore.currentPlayer
        ?.category ||
      'Club Member',
  }))

const currentIdentity =
  computed(() => {
    const session =
      chairUmpireScorerSession.value

    if (
      isChairUmpireControlRoute.value &&
      chairUmpireScorerSessionCanControl(
        session,
        currentLiveMatchId.value,
      )
    ) {
      return {
        id: session.scorerId,

        name:
          session.scorerName ||
          'Chair umpire',

        rank: null,

        category: 'Chair umpire',
      }
    }

    return authenticatedIdentity.value
  })
const activeLadderConfig = computed(() => getActiveLadderConfig())
const ladderWindow = computed(() =>
  ladderWindowFor(currentIdentity.value, activeLadderConfig.value),
)
const activeLadderChallenges = computed(() =>
  challengeStore.challenges.filter(
    (challenge) =>
      ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
      [challenge.challengerId, challenge.defenderId].includes(currentIdentity.value.id),
  ),
)
const activeLadderChallenge = computed(() => activeLadderChallenges.value[0] || null)
const hasActiveChallengeBlock = computed(
  () => activeLadderChallenges.value.length >= activeLadderConfig.value.maxActiveChallenges,
)
const ladderAccessMessage = computed(() => {
  if (activeLadderConfig.value.seasonStatus !== 'active')
    return 'This Ladder is not accepting challenges right now.'
  if (!currentIdentity.value.rank)
    return 'You must be placed on the active Ladder before creating a challenge.'
  if (hasActiveChallengeBlock.value)
    return 'Finish your active challenge before creating another one.'
  return ''
})
const ladderMovement = computed(() =>
  ladderMovementFor(currentIdentity.value, friendlyMatchStore.draft.opponent),
)
const canManageDraft = computed(
  () =>
    !friendlyMatchStore.draft.ownerId ||
    friendlyMatchStore.draft.ownerId === currentIdentity.value.id,
)
const playNowReady = computed(() => friendlyMatchStore.opponentReady)
const canManageLiveMatch = computed(() => {
  return friendlyMatchStore.canManageMatch(currentIdentity.value.id)
})

const canEmergencyOverrideLiveMatch =
  computed(() => {
    const actorId =
      authenticatedIdentity.value.id

    const draft =
      friendlyMatchStore.draft

    if (
      !actorId ||
      isChairUmpireControlRoute.value
    ) {
      return false
    }

    /*
     * Admin override is for another authorized
     * administrator intervening.
     *
     * The owner already has the normal
     * reclaim-control path.
     */
    if (
      friendlyMatchStore.canManageMatch(
        actorId,
      )
    ) {
      return false
    }

    /*
     * Somebody who already controls scoring
     * obviously does not need an override.
     */
    if (
      friendlyMatchStore.canScoreMatch(
        actorId,
      )
    ) {
      return false
    }

    if (
      draft.status !== 'live' ||
      !draft.liveState ||
      draft.over
    ) {
      return false
    }

    /*
     * Critical club boundary.
     */
    if (
      !draft.clubId ||
      !adminStore.activeClubId ||
      draft.clubId !==
        adminStore.activeClubId
    ) {
      return false
    }

    /*
     * Use active-club membership permission,
     * NOT generic/global isAdmin.
     */
    return Boolean(
      adminStore.hasActiveClubPermission(
        'matches.live_score',
      ),
    )
  })

const acceptedChairUmpireScorerId =
  computed(
    () =>
      chairUmpireInvitation.value
        ?.acceptedIdentity?.userId ||
      chairUmpireInvitation.value
        ?.acceptedIdentity?.guestId ||
      '',
  )

const chairUmpireHasControl =
  computed(
    () =>
      Boolean(
        acceptedChairUmpireScorerId.value &&
          friendlyMatchStore.draft
            .scorerId ===
            acceptedChairUmpireScorerId.value,
      ),
  )

function initialsForName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function resolveClubMemberName(userId) {
  const player = playerStore.players.find((item) => item.id === userId)

  if (player?.name) {
    return player.name
  }

  const membershipSetup = adminStore.activeClub?.setup?.membership

  const setupMembers = [
    ...(membershipSetup?.importedMembers || []),

    ...(membershipSetup?.manualMembers || []),

    ...(membershipSetup?.roster || []),
  ]

  const setupMember = setupMembers.find((member) => member.userId === userId)

  return setupMember?.name || setupMember?.fullName || ''
}

const chairUmpireCandidates = computed(() => {
  const clubId = adminStore.activeClubId

  if (!clubId) {
    return []
  }

  const participantIds = new Set(
    [
      friendlyMatchStore.draft.ownerId,

      friendlyMatchStore.draft.opponent?.id,

      currentIdentity.value.id,
    ].filter(Boolean),
  )

  return adminStore.memberships
    .filter(
      (membership) =>
        membership.clubId === clubId &&
        Boolean(membership.userId) &&
        !participantIds.has(membership.userId),
    )
    .map((membership) => {
      const name = resolveClubMemberName(membership.userId)

      /*
       * Membership identity exists but the current
       * frontend cannot display/resolve the person.
       *
       * Do not show raw internal IDs as humans.
       */
      if (!name) {
        return null
      }

      return {
        id: membership.userId,

        name,

        role: membership.role,

        roleLabel: ['admin', 'co-admin'].includes(membership.role)
          ? 'Club admin'
          : 'Club member',

        initials: initialsForName(name),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
})

const tvPairingCode = computed(() => {
  return formatPairingCode(tvPairingSession.value?.pairingCode || '')
})

const tvPairingInviteUrl =
  computed(() => {
    const session =
      tvPairingSession.value

    if (
      !session?.qrClaimToken ||
      session.status !== 'waiting' ||
      typeof window ===
        'undefined'
    ) {
      return ''
    }

    const href =
      router.resolve({
        name:
          'TvDisplayPairing',

        query: {
          ticket:
            session.qrClaimToken,
        },
      }).href

    return new URL(
      href,
      window.location.href,
    ).href
  })

const canScoreLiveMatch = computed(() => friendlyMatchStore.canScoreMatch(currentIdentity.value.id))

const canAccessLiveMatch = computed(() => canManageDraft.value || canScoreLiveMatch.value)

const completedResultId = computed(() => String(route.params.resultId || ''))

const completedResult = computed(() =>
  step.value === 'result' ? friendlyMatchStore.resultById(completedResultId.value) : null,
)

/*
 * ROUTE PRESENTATION GATE
 *
 * guardStep() decides where invalid routes should go.
 *
 * This computed controls whether the current route is even
 * allowed to paint the match UI before that redirect occurs.
 *
 * This is what prevents:
 *
 * /friendly-match/live
 *
 * from briefly flashing an old/empty scoreboard when there
 * is no real active match.
 */
const canViewCompletedResult = computed(() => {
  const result = completedResult.value
  const actorId = currentIdentity.value.id

  if (!result || !actorId) {
    return false
  }

  const participantIds = Array.isArray(result.participantIds) ? result.participantIds : []

  return participantIds.includes(actorId)
})

const canRenderCurrentRoute = computed(() => {
  /*
   * COMPLETED RESULT
   *
   * Only actual participants can paint the result.
   */
  if (step.value === 'result') {
    return canViewCompletedResult.value
  }

  /*
   * LIVE CONTROL
   *
   * A Live URL is not enough.
   * There must actually be a valid live match.
   */
  if (step.value === 'live') {
    const draft = friendlyMatchStore.draft

    const requestedId =
      requestedLiveMatchId.value

    if (
      !requestedId ||
      friendlyMatchStore
        .liveMatchId !==
        requestedId
    ) {
      return false
    }

    if (
      isChairUmpireControlRoute.value
    ) {
      const session =
        chairUmpireScorerSession.value

      const matchId =
        getLiveScoreboardMatchId(
          draft,
        )

      if (
        !chairUmpireScorerSessionCanControl(
          session,
          matchId,
        ) ||
        !session?.scorerId ||
        !friendlyMatchStore.canScoreMatch(
          session.scorerId,
        )
      ) {
        return false
      }
    }

    const hasScoring = Boolean(draft.format)
    const hasOpponent = Boolean(draft.opponent)
    const hasLiveState = Boolean(draft.liveState)

    if (!hasScoring || !hasOpponent || !hasLiveState) {
      return false
    }

    /*
     * Friendly Live exists ONLY while actively scoring.
     *
     * The instant the winner exists, Friendly is finalized
     * and moves to the immutable Result route.
     */
    if (draft.matchType === 'friendly') {
      return draft.status === 'live' && canAccessLiveMatch.value
    }

    /*
     * Ladder temporarily keeps its finished-live state
     * because its confirmation lifecycle is separate.
     */
    if (draft.matchType === 'ladder') {
      return ['live', 'finished'].includes(draft.status)
    }

    return false
  }

  /*
   * INVITATION RECIPIENT
   *
   * Do not briefly display the invited-player interface
   * before validating/loading its token.
   */
  if (step.value === 'externalJoin') {
    if (!externalInvitation.value) {
      return false
    }

    return externalInvitation.value.creator?.id !== currentIdentity.value.id
  }

  /*
   * CREATOR JOIN HUB
   *
   * It only belongs to Play Now.
   */
  if (step.value === 'join') {
    if (!['friendly', 'ladder'].includes(friendlyMatchStore.draft.matchType)) {
      return false
    }

    if (friendlyMatchStore.draft.timing !== 'now') {
      return false
    }

    if (isLadder.value && !friendlyMatchStore.draft.matchId) {
      return false
    }
  }

  return true
})

/*
 * The same fixed action area is used in two places:
 *
 * JOIN READY
 *   Opponent is connected.
 *   If setup is incomplete → Continue setup.
 *   If setup is already complete → Start match.
 *
 * FORMAT
 *   Rules are complete → Start match.
 */
const showReadyActionFooter = computed(() => {
  return Boolean(isFriendly.value && isPlayNow.value && step.value === 'join' && playNowReady.value)
})

const readyActionLabel = computed(() => {
  const hasScoring = Boolean(friendlyMatchStore.draft.format)

  const hasMatchFormat = Boolean(friendlyMatchStore.draft.matchFormat)

  return hasScoring && hasMatchFormat ? 'Start match' : 'Continue setup'
})
const readyActionDescription = computed(() => {
  if (!friendlyMatchStore.draft.format) {
    return 'Opponent joined · Choose scoring next'
  }

  if (!friendlyMatchStore.draft.matchFormat) {
    return `${friendlyMatchStore.formatLabel} · Choose match format next`
  }

  return `${friendlyMatchStore.formatLabel} · ${friendlyMatchStore.matchFormatLabel}`
})
const activeInvitation = computed(() => friendlyMatchStore.activeInvitation)
const invitationIsOpen = computed(() => activeInvitation.value?.audience === 'open')

const invitationTargetName = computed(
  () =>
    activeInvitation.value?.expectedOpponent?.name || friendlyMatchStore.draft.opponent?.name || '',
)
const invitationExpired = computed(() =>
  ['expired', 'cancelled'].includes(activeInvitation.value?.status),
)
const minDate = computed(() => new Date().toISOString().slice(0, 10))
const hasScheduleDetails = computed(() =>
  Boolean(
    friendlyMatchStore.draft.schedule.date ||
    friendlyMatchStore.draft.schedule.time ||
    friendlyMatchStore.draft.schedule.court,
  ),
)
const customMatchStyle = computed(() => {
  if (customFormatForm.mode === 'tiebreak') return 'match-tiebreak'
  return customFormatForm.setsToWin === 1 ? 'one-set' : 'best-of-3'
})
const playCustomTieBreaks = computed(
  () => customFormatForm.mode === 'tiebreak' || customFormatForm.tieBreakAt > 0,
)
const customFormatSummary = computed(() => describeCustomFormat(customFormatForm))
const pageTitle = computed(
  () =>
    ({
      type: 'New match',
      timing: isLadder.value ? 'Ladder challenge' : 'Friendly match',
      join: 'Play now',
      clubOpponent: 'Choose opponent from club',
      schedule: 'Match timing',
      opponent: 'Choose opponent',
      scoring: 'Scoring',
      format: isFriendly.value ? 'Match format' : 'Scoring format',
      customFormat: 'Custom format',
      scheduled: 'Invitation sent',
      externalJoin: 'Join match',
    })[step.value] || 'Match',
)
const stepText = computed(() => {
  if (isLadder.value) {
    if (isPlayNow.value) {
      return (
        {
          type: '1 of 5',
          timing: '2 of 5',
          join: '3 of 5',
          clubOpponent: '3 of 5',
          format: '4 of 5',
        }[step.value] || ''
      )
    }

    return (
      {
        type: '1 of 6',
        timing: '2 of 6',
        clubOpponent: '3 of 6',
        schedule: '4 of 6',
        format: '5 of 6',
        scheduled: '6 of 6',
      }[step.value] || ''
    )
  }

  return (
    {
      scoring: '1 of 3',
      format: '2 of 3',
      customFormat: '2 of 3',
      timing: '3 of 3',
    }[step.value] || ''
  )
})
const LADDER_FLOW_PATHS = Object.freeze({
  FriendlyMatchType: '/ladder-match/type',
  FriendlyMatchTiming: '/ladder-match/timing',
  FriendlyMatchJoin: '/ladder-match/join',
  FriendlyMatchClubOpponent: '/ladder-match/opponent',
  FriendlyMatchSchedule: '/ladder-match/schedule',
  FriendlyMatchScoring: '/ladder-match/scoring',
  FriendlyMatchFormat: '/ladder-match/format',
  FriendlyMatchScheduled: '/ladder-match/sent',
  FriendlyMatchJoinInvitation: '/ladder-match/join/:token',
  FriendlyMatchLive:
    '/ladder-match/live/:matchId',
})

function flowLocation(name, options = {}) {
  const params = options.params || {}
  const query = options.query || {}
  if (!isLadder.value) return { name, params, query }

  const template = LADDER_FLOW_PATHS[name]
  if (!template) return { name, params, query }
  const path = Object.entries(params).reduce(
    (value, [key, parameter]) => value.replace(':' + key, encodeURIComponent(String(parameter))),
    template,
  )
  return Object.keys(query).length ? { path, query } : { path }
}

function liveMatchLocation() {
  const matchId =
    friendlyMatchStore
      .liveMatchId

  if (!matchId) {
    return {
      name: 'Play',
    }
  }

  return flowLocation(
    'FriendlyMatchLive',
    {
      params: {
        matchId,
      },
    },
  )
}

const chairUmpireInviteUrl = computed(() => {
  const invitation = chairUmpireInvitation.value

  if (!invitation?.token || typeof window === 'undefined') {
    return ''
  }

  const routeName =
    invitation.audience === 'guest' ? 'ChairUmpireGuestInvite' : 'ChairUmpireInvite'

  const href = router.resolve({
    name: routeName,

    params: {
      token: invitation.token,
    },
  }).href

  return new URL(href, window.location.href).href
})

const liveScoreboardHref = computed(() => {
  const matchId = getLiveScoreboardMatchId(friendlyMatchStore.draft)

  if (!matchId) {
    return ''
  }

  return router.resolve({
    name: 'LiveScoreboard',
    params: {
      matchId,
    },
  }).href
})

const joinUrl = computed(() => {
  if (!friendlyMatchStore.draft.joinToken || typeof window === 'undefined') return ''
  const href = router.resolve(
    flowLocation('FriendlyMatchJoinInvitation', {
      params: { token: friendlyMatchStore.draft.joinToken },
    }),
  ).href
  return new URL(href, window.location.href).href
})
const formattedSchedule = computed(() => {
  const { date, time } = friendlyMatchStore.draft.schedule
  if (!date && !time) return 'Whenever you are both ready'
  if (date && !time)
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
  if (!date && time) return `At ${time}`
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime())
    ? `${date} at ${time}`
    : value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})

const clubOpponents = computed(() => {
  const loaded = playerStore.players
    .filter((player) => player.id !== playerStore.currentPlayerId && player.status !== 'inactive')
    .map((player) => ({
      id: player.id,
      name: player.name,
      rank: player.rank || null,
      division: player.category || player.division || 'Club Member',
      status: player.status || 'active',
    }))
  return loaded.length ? loaded : friendlyMatchStore.opponents
})
const availableOpponents = computed(() => {
  const source = isLadder.value
    ? playerStore.availableOpponents.map((player) => ({
        id: player.id,
        name: player.name,
        rank: player.rank || null,
        division: player.category || player.division || 'Club Member',
        status: player.status || 'active',
      }))
    : clubOpponents.value
  const recentIds = friendlyMatchStore.results.map((result) => result.opponentId).filter(Boolean)
  const ordered = [...source].sort((a, b) => {
    const ai = recentIds.indexOf(a.id)
    const bi = recentIds.indexOf(b.id)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const query = searchQuery.value.trim().toLowerCase()
  return query
    ? ordered.filter((player) =>
        [player.name, player.division, player.rank ? `rank ${player.rank}` : ''].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(query),
        ),
      )
    : ordered
})

const backRoute = computed(() => {
  if (isLadder.value) {
    const routeName =
      {
        clubOpponent: 'Play',
        timing: 'FriendlyMatchClubOpponent',
        join: 'FriendlyMatchTiming',
        schedule: 'FriendlyMatchTiming',
        format: isPlayNow.value ? 'FriendlyMatchJoin' : 'FriendlyMatchSchedule',
        customFormat: 'FriendlyMatchFormat',
        scheduled: 'Play',
        externalJoin: 'Play',
        live: 'FriendlyMatchFormat',
      }[step.value] || 'Play'

    return routeName.startsWith('FriendlyMatch') ? flowLocation(routeName) : { name: routeName }
  }

  const routeName =
    {
      scoring: 'Play',
      format: 'FriendlyMatchScoring',
      customFormat: 'FriendlyMatchFormat',
      timing: 'FriendlyMatchFormat',

      join: 'FriendlyMatchTiming',
      clubOpponent: 'FriendlyMatchJoin',
      opponent: 'FriendlyMatchJoin',
      schedule: 'FriendlyMatchTiming',

      scheduled: 'Play',
      externalJoin: 'Dashboard',
      live: 'FriendlyMatchFormat',

      type: 'Play',
    }[step.value] || 'Play'

  return routeName.startsWith('FriendlyMatch') ? flowLocation(routeName) : { name: routeName }
})

function guardStep() {
  /*
   * CHAIR UMPIRE MATCH CONTROL
   *
   * This route is public at the router level because
   * a guest umpire may not have a Gorra account.
   *
   * The route itself is NOT authority.
   *
   * It requires:
   *
   * - a valid tab-bound scorer capability
   * - matching live match
   * - matching authoritative scorerId
   */
  if (isChairUmpireControlRoute.value) {
    const session =
      refreshChairUmpireScorerSession()

    const matchId =
      requestedLiveMatchId.value

    const sessionValid =
      chairUmpireScorerSessionCanControl(
        session,
        matchId,
      )

    const correctLiveSession =
      Boolean(
        matchId &&
          friendlyMatchStore
            .liveMatchId ===
            matchId,
      )

    const matchExists =
      Boolean(
        friendlyMatchStore.draft
          .liveState &&
          ['live', 'finished'].includes(
            friendlyMatchStore.draft
              .status,
          ),
      )

    const stillAssigned =
      Boolean(
        session?.scorerId &&
          friendlyMatchStore.canScoreMatch(
            session.scorerId,
          ),
      )

    /*
     * Finished Ladder matches remain viewable so the
     * umpire sees the finished score.
     *
     * A completed Friendly match will have already
     * closed/reset the active draft.
     */
    if (
      !sessionValid ||
      !correctLiveSession ||
      !matchExists ||
      !stillAssigned
    ) {
      leaveChairUmpireControl()

      return
    }
  }

  /*
   * INVITED PLAYER ROUTE
   *
   * /friendly-match/join/:token belongs to the
   * person receiving the invitation.
   *
   * The creator must never claim their own invite.
   */
  if (step.value === 'externalJoin') {
    const token = String(route.params.token || '')

    const invitation = friendlyMatchStore.invitationByToken(token)

    if (invitation?.creator?.id && invitation.creator.id === currentIdentity.value.id) {
      router.replace(flowLocation('FriendlyMatchJoin'))
    }

    return
  }

  /*
   * COMPLETED FRIENDLY RESULT
   *
   * This check MUST happen before checking the
   * active draft.
   *
   * Why?
   * Once a Friendly match is finalized, endMatch()
   * closes and resets the live draft.
   *
   * The completed result now lives in `results`,
   * not inside `draft`.
   */
  if (step.value === 'result') {
    const result = completedResult.value

    if (!result) {
      router.replace({
        name: 'Dashboard',
      })

      return
    }

    const participantIds = Array.isArray(result.participantIds) ? result.participantIds : []

    /*
     * Frontend access boundary.
     *
     * Knowing the result URL is not enough.
     * The current authenticated player must
     * actually belong to this result.
     *
     * Laravel will enforce the same rule later
     * on the server.
     */
    if (!currentIdentity.value.id || !participantIds.includes(currentIdentity.value.id)) {
      router.replace({
        name: 'Dashboard',
      })

      return
    }

    return
  }

  /*
   * FRIENDLY DRAFT OWNERSHIP
   *
   * The creator owns setup.
   *
   * Live Match Control is slightly different:
   * an assigned scorer may control the score
   * without becoming the match owner.
   */
  if (isFriendly.value && friendlyMatchStore.draft.ownerId && !canManageDraft.value) {
    if (step.value !== 'live' || !canAccessLiveMatch.value) {
      router.replace({
        name: 'Dashboard',
      })

      return
    }
  }

  /*
   * Every active setup route needs a known
   * match type.
   *
   * The completed result route was already
   * handled above because a completed result
   * intentionally has no active draft.
   */
  if (!friendlyMatchStore.draft.matchType) {
    if (step.value === 'type') {
      return
    }

    router.replace({
      name: 'Play',
    })

    return
  }

  /*
   * FRIENDLY MATCH
   *
   * Current setup:
   *
   * Play
   * → Scoring
   * → Match format
   * → Timing
   * → Join / Schedule
   * → Ready
   * → Live
   */
  if (isFriendly.value) {
    /*
     * A terminal invitation belongs to history.
     *
     * It may remain in the invitation collection for audit/history,
     * but it must not remain attached to the active draft.
     *
     * This prevents a new Friendly flow from opening an old
     * "Waiting for someone to join" screen.
     */
    if (
      step.value === 'join' &&
      activeInvitation.value &&
      ['completed', 'cancelled', 'expired'].includes(activeInvitation.value.status)
    ) {
      friendlyMatchStore.cancelActiveInvitation()
    }
    /*
     * Old Friendly Type screen is no longer
     * part of the normal Play entry.
     */
    if (step.value === 'type') {
      router.replace(flowLocation('FriendlyMatchScoring'))

      return
    }

    /*
     * Format and Timing cannot exist before
     * the scoring rule has been selected.
     */
    if (
      ['format', 'customFormat', 'timing'].includes(step.value) &&
      !friendlyMatchStore.draft.format
    ) {
      router.replace(flowLocation('FriendlyMatchScoring'))

      return
    }

    /*
     * Join belongs after Timing.
     */
    if (step.value === 'join' && !friendlyMatchStore.draft.timing) {
      router.replace(flowLocation('FriendlyMatchTiming'))

      return
    }

    /*
     * Club opponent selection also belongs
     * to the Play Now invitation branch.
     */
    if (step.value === 'clubOpponent' && !friendlyMatchStore.draft.timing) {
      router.replace(flowLocation('FriendlyMatchTiming'))

      return
    }

    /*
     * Schedule screen only exists for the
     * Schedule Later branch.
     */
    if (step.value === 'schedule' && friendlyMatchStore.draft.timing !== 'later') {
      router.replace(flowLocation('FriendlyMatchTiming'))

      return
    }

    /*
     * LIVE MATCH
     *
     * /friendly-match/live means:
     *
     * "There is an ACTIVE scoring session."
     *
     * A configured match is not enough.
     * A finished match is not enough.
     *
     * We need:
     * - scoring rules
     * - opponent
     * - real liveState
     * - status === live
    */
    if (step.value === 'live') {
      if (
        !requestedLiveMatchId.value ||
        friendlyMatchStore
          .liveMatchId !==
          requestedLiveMatchId.value
      ) {
        router.replace({
          name: 'Dashboard',
        })

        return
      }

      const hasScoring = Boolean(friendlyMatchStore.draft.format)

      const hasOpponent = Boolean(friendlyMatchStore.draft.opponent)

      const hasLiveState = Boolean(friendlyMatchStore.draft.liveState)

      const isActuallyLive = friendlyMatchStore.draft.status === 'live'

      if (!hasScoring || !hasOpponent || !hasLiveState || !isActuallyLive) {
        router.replace({
          name: 'Dashboard',
        })

        return
      }
    }

    return
  }

  /*
   * LADDER
   *
   * Preserve the Ladder architecture:
   *
   * Opponent
   * → Timing
   * → Join / Schedule
   * → Format
   * → Live
  */
  if (isLadder.value) {
    if (
      step.value === 'live' &&
      (
        !requestedLiveMatchId.value ||
        friendlyMatchStore
          .liveMatchId !==
          requestedLiveMatchId.value
      )
    ) {
      router.replace({
        name: 'Dashboard',
      })

      return
    }

    if (step.value === 'timing' && !friendlyMatchStore.draft.opponent) {
      router.replace(flowLocation('FriendlyMatchClubOpponent'))

      return
    }

    if (step.value === 'opponent') {
      router.replace(flowLocation('FriendlyMatchClubOpponent'))

      return
    }

    if (step.value === 'schedule' && (isPlayNow.value || !friendlyMatchStore.draft.opponent)) {
      router.replace(flowLocation('FriendlyMatchClubOpponent'))

      return
    }

    if (step.value === 'join' && (!isPlayNow.value || !friendlyMatchStore.draft.matchId)) {
      router.replace(flowLocation('FriendlyMatchTiming'))

      return
    }

    if (step.value === 'scoring') {
      router.replace(flowLocation('FriendlyMatchFormat'))

      return
    }

    if (step.value === 'format' && !friendlyMatchStore.draft.opponent) {
      router.replace(flowLocation('FriendlyMatchClubOpponent'))

      return
    }

    if (step.value === 'format' && isPlayNow.value && !playNowReady.value) {
      router.replace(flowLocation('FriendlyMatchJoin'))

      return
    }

    if (step.value === 'customFormat') {
      router.replace(flowLocation('FriendlyMatchFormat'))

      return
    }

    /*
     * Ladder keeps its existing finished state
     * temporarily because Ladder result submission
     * still has its own confirmation lifecycle.
     */
    if (
      step.value === 'live' &&
      (!friendlyMatchStore.draft.format ||
        !friendlyMatchStore.draft.opponent ||
        !friendlyMatchStore.draft.liveState ||
        !['live', 'finished'].includes(friendlyMatchStore.draft.status))
    ) {
      router.replace(
        isPlayNow.value ? flowLocation('FriendlyMatchJoin') : flowLocation('FriendlyMatchFormat'),
      )

      return
    }
  }
}

function goBack() {
  /*
   * If the creator leaves an unclaimed Play Now invitation,
   * revoke that invitation first.
   */
  if (
    isFriendly.value &&
    step.value === 'join' &&
    activeInvitation.value?.status === 'waiting_for_opponent'
  ) {
    friendlyMatchStore.cancelActiveInvitation()
    qrDataUrl.value = ''
  }

  /*
   * /join/:token belongs to the invited participant,
   * not to the creator setup flow.
   */
  if (step.value === 'externalJoin') {
    router.push({ name: 'Dashboard' })
    return
  }

  router.push(backRoute.value)
}

function chooseMatchType(type) {
  inlineNote.value = ''
  friendlyMatchStore.chooseMatchType(type)

  router.push(
    flowLocation(type === 'ladder' ? 'FriendlyMatchClubOpponent' : 'FriendlyMatchScoring'),
  )
}
function showTournamentNotice() {
  inlineNote.value =
    'No tournament is running at Emerald Courts right now. You can still create a friendly match or ladder challenge.'
}
async function chooseTiming(timing) {
  /*
   * LADDER
   *
   * Preserve the existing Ladder order:
   * opponent → timing → join/schedule
   */
  if (isLadder.value) {
    ladderAccessChecking.value = true

    const access = await verifyLadderCreationAccess({
      player: playerStore.currentPlayer,
      challenges: challengeStore.challenges,
    })

    ladderAccessChecking.value = false

    if (!access.allowed) {
      inlineNote.value = access.message
      return
    }

    if (!friendlyMatchStore.draft.opponent) {
      router.replace(flowLocation('FriendlyMatchClubOpponent'))
      return
    }

    friendlyMatchStore.applyLadderRules()
    friendlyMatchStore.chooseTiming(timing, currentIdentity.value)

    if (timing === 'now') {
      await router.push(flowLocation('FriendlyMatchJoin'))
      await generateQrCode()
      return
    }

    router.push(flowLocation('FriendlyMatchSchedule'))
    return
  }

  /*
   * FRIENDLY
   *
   * The match format already exists.
   * Timing now decides which invitation branch comes next.
   */
  friendlyMatchStore.chooseTiming(timing, currentIdentity.value)

  if (timing === 'now') {
    router.push(flowLocation('FriendlyMatchJoin'))
    return
  }

  router.push(flowLocation('FriendlyMatchSchedule'))
}
function chooseOpponent(opponent) {
  friendlyMatchStore.chooseOpponent(opponent)
}
function openClubOpponents() {
  if (isFriendly.value) {
    friendlyMatchStore.cancelActiveInvitation()
    friendlyMatchStore.setInvitationAudience('targeted')
    qrDataUrl.value = ''
  }

  friendlyMatchStore.chooseOpponent(null)
  router.push(flowLocation('FriendlyMatchClubOpponent'))
}

async function createOpenFriendlyInvitation() {
  if (!isFriendly.value || !isPlayNow.value) {
    return
  }

  inlineNote.value = ''
  qrDataUrl.value = ''

  friendlyMatchStore.cancelActiveInvitation()
  friendlyMatchStore.chooseOpponent(null)
  friendlyMatchStore.setInvitationAudience('open')

  const invitation = friendlyMatchStore.createPlayNowInvitation(currentIdentity.value)

  if (!invitation) {
    inlineNote.value = 'The match invitation could not be created.'
    return
  }

  await generateQrCode()
}

async function continueWithClubOpponent() {
  if (!friendlyMatchStore.draft.opponent) return

  /*
   * LADDER
   */
  if (isLadder.value) {
    ladderAccessChecking.value = true

    const access = await verifyLadderCreationAccess({
      player: playerStore.currentPlayer,
      challenges: challengeStore.challenges,
    })

    ladderAccessChecking.value = false

    if (!access.allowed) {
      inlineNote.value = access.message
      return
    }

    router.push(flowLocation('FriendlyMatchTiming'))
    return
  }

  /*
   * FRIENDLY · PLAY NOW
   *
   * The player has been selected, but has NOT joined.
   * Create an invitation that only that player may claim.
   */
  if (isFriendly.value && isPlayNow.value) {
    friendlyMatchStore.setInvitationAudience('targeted')

    const invitation = friendlyMatchStore.createPlayNowInvitation(currentIdentity.value)

    if (!invitation) {
      inlineNote.value = 'The invitation could not be created.'
      return
    }

    await router.push(flowLocation('FriendlyMatchJoin'))
    await generateQrCode()
    return
  }

  /*
   * FRIENDLY · SCHEDULE LATER
   *
   * Leave the existing schedule branch for the later scheduling pass.
   */
  router.push(flowLocation('FriendlyMatchSchedule'))
}
function continueFromSchedule() {
  router.push(flowLocation(isLadder.value ? 'FriendlyMatchFormat' : 'FriendlyMatchScoring'))
}
function chooseFormat(format) {
  friendlyMatchStore.chooseFormat(format)
  if (isLadder.value) {
    friendlyMatchStore.startLiveMatch(
      currentIdentity.value.id,

      adminStore.activeClubId ||
        '',
    )
    router.push(
      liveMatchLocation(),
    )
  } else if (isFriendly.value) router.push(flowLocation('FriendlyMatchFormat'))
}
function chooseMatchFormat(matchFormat) {
  friendlyMatchStore.chooseMatchFormat(matchFormat)
}
function chooseSavedFormat(format) {
  friendlyMatchStore.selectCustomFormat(format)
}
function continueFromFriendlyFormat() {
  if (!friendlyMatchStore.draft.format) {
    router.replace(flowLocation('FriendlyMatchScoring'))
    return
  }

  router.push(flowLocation('FriendlyMatchTiming'))
}
function openCustomFormat() {
  customFormatError.value = ''
  router.push(flowLocation('FriendlyMatchCustomFormat'))
}
function describeCustomFormat(format) {
  if (format.mode === 'tiebreak')
    return `Match tie-break · First to ${format.tieBreakPoints} · Win by two`
  const matchStyle = format.setsToWin === 1 ? 'One set' : `Best of ${format.setsToWin * 2 - 1}`
  const tieBreak = Number(format.tieBreakAt)
    ? `Tie-break at ${format.tieBreakAt}–${format.tieBreakAt} (${format.tieBreakPoints} points)`
    : 'No tie-break'
  return `${matchStyle} · ${format.gamesPerSet} games per set · ${tieBreak}`
}
function invitationScoringLabel(invitation) {
  return invitation?.matchSetup?.scoring === 'noad' ? 'No-Ad' : 'Advantage'
}

function invitationMatchFormatLabel(invitation) {
  const setup = invitation?.matchSetup

  if (!setup) {
    return 'Friendly match'
  }

  if (setup.matchFormat === 'custom') {
    return setup.customFormat?.name || 'Custom format'
  }

  return (
    {
      'best-of-3': 'Best of 3 sets',
      'one-set': 'One set',
      'match-tiebreak': '10-point match tie-break',
    }[setup.matchFormat] || 'Friendly match'
  )
}
function selectCustomMatchStyle(style) {
  customFormatError.value = ''
  if (style === 'match-tiebreak') {
    customFormatForm.mode = 'tiebreak'
    customFormatForm.setsToWin = 1
    customFormatForm.tieBreakPoints = 10
    return
  }
  customFormatForm.mode = 'sets'
  customFormatForm.setsToWin = style === 'one-set' ? 1 : 2
  customFormatForm.gamesPerSet = 6
  customFormatForm.tieBreakAt = 6
  customFormatForm.tieBreakPoints = 7
}
function adjustCustomNumber(field, amount, min, max) {
  customFormatForm[field] = Math.min(max, Math.max(min, Number(customFormatForm[field]) + amount))
  if (field === 'gamesPerSet' && customFormatForm.tieBreakAt > customFormatForm.gamesPerSet) {
    customFormatForm.tieBreakAt = customFormatForm.gamesPerSet
  }
}
function setCustomTieBreaks(enabled) {
  customFormatForm.tieBreakAt = enabled ? customFormatForm.gamesPerSet : 0
  if (!enabled) showTieBreakDetails.value = false
}
function applyCustomFormat() {
  customFormatError.value = ''
  if (customFormatForm.saveForLater && !customFormatForm.name.trim()) {
    customFormatError.value = 'Add a name before saving this format for later.'
    return
  }
  const format = {
    id: customFormatForm.id || undefined,
    name: customFormatForm.name.trim() || 'Custom format',
    mode: customFormatForm.mode,
    setsToWin: customFormatForm.setsToWin,
    gamesPerSet: customFormatForm.gamesPerSet,
    tieBreakAt: customFormatForm.tieBreakAt,
    tieBreakPoints: customFormatForm.tieBreakPoints,
  }
  if (customFormatForm.saveForLater) friendlyMatchStore.saveCustomFormat(format)
  else friendlyMatchStore.selectCustomFormat(format)
  router.push(flowLocation('FriendlyMatchFormat'))
}
async function completeReview() {
  inlineNote.value = ''

  if (isLadder.value) {
    const challenger = playerStore.currentPlayer

    const defender = friendlyMatchStore.draft.opponent

    if (!challenger || !isEligibleLadderOpponent(challenger, defender)) {
      inlineNote.value = 'This opponent is no longer eligible. Choose another Ladder player.'

      return
    }

    friendlyMatchStore.applyLadderRules()

    const schedule = friendlyMatchStore.draft.schedule

    const scheduledAt = schedule.date
      ? new Date(`${schedule.date}T${schedule.time || '12:00'}`).toISOString()
      : null

    const challenge = await challengeStore.createChallenge({
      challengerId: challenger.id,

      defenderId: defender.id,

      scorerId: isPlayNow.value ? challenger.id : null,

      timing: friendlyMatchStore.draft.timing,

      scheduledAt,

      court: schedule.court || '',

      responseDeadline: deadlineFromNow(activeLadderConfig.value.responseHours),

      playDeadline: deadlineFromNow(activeLadderConfig.value.completionDays, 'days'),

      preMatchPositions: {
        challenger: challenger.rank,

        defender: defender.rank,
      },

      ladderConfigSnapshot: {
        ...activeLadderConfig.value,
      },

      matchConfig: ladderMatchConfig(activeLadderConfig.value),
    })

    if (!challenge) {
      inlineNote.value = challengeStore.error || 'The challenge could not be created.'

      return
    }

    friendlyMatchStore.linkLadderRecords(challenge)

    if (isPlayNow.value) {
      const accepted = await challengeStore.acceptChallenge(
        challenge.id,
        new Date().toISOString(),
        defender.id,
      )

      if (!accepted?.match) {
        inlineNote.value = challengeStore.error || 'The match could not be started.'

        return
      }

      friendlyMatchStore.linkLadderRecords(accepted.challenge, accepted.match)

      const started = friendlyMatchStore.startLiveMatch(
        currentIdentity.value.id,

        adminStore.activeClubId ||
          '',
      )

      if (!started) {
        inlineNote.value = 'This Ladder match could not be started.'

        return
      }

      publishCurrentLiveScoreboard({ type: 'start' })

      router.push(
        liveMatchLocation(),
      )

      return
    }

    router.push(flowLocation('FriendlyMatchScheduled'))

    return
  }

  /*
   * FRIENDLY MATCH
   */

  if (!friendlyMatchStore.draft.format) {
    inlineNote.value = 'Choose how deuce should be played before starting the match.'

    return
  }

  if (isPlayNow.value) {
    if (!playNowReady.value) {
      inlineNote.value = 'Your opponent needs to join before this match can start.'

      return
    }

    if (!friendlyMatchStore.draft.matchFormat) {
      inlineNote.value = 'Choose a match format before starting the match.'

      return
    }

    const started = friendlyMatchStore.startLiveMatch(
      currentIdentity.value.id,

      adminStore.activeClubId ||
        '',
    )

    if (!started) {
      inlineNote.value =
        'This match could not be started. Check that the match is still ready and that you have permission to manage it.'

      return
    }

    publishCurrentLiveScoreboard({ type: 'start' })

    router.push(
      liveMatchLocation(),
    )

    return
  }

  /*
   * FRIENDLY — SCHEDULE FOR LATER
   */

  const invitation = friendlyMatchStore.createScheduledInvitation(currentIdentity.value)

  if (!invitation) {
    inlineNote.value = 'The invitation could not be created.'

    return
  }

  router.push(flowLocation('FriendlyMatchScheduled'))
}

function handleReadyAction() {
  inlineNote.value = ''

  if (!isFriendly.value || !isPlayNow.value) {
    return
  }

  if (!playNowReady.value) {
    inlineNote.value = 'Your opponent needs to join before you can continue.'

    return
  }

  /*
   * Do not silently invent missing match rules.
   *
   * If this draft came from an older/incomplete
   * flow, guide the user to the missing decision.
   */
  if (!friendlyMatchStore.draft.format) {
    router.push(flowLocation('FriendlyMatchScoring'))

    return
  }

  if (!friendlyMatchStore.draft.matchFormat) {
    router.push(flowLocation('FriendlyMatchFormat'))

    return
  }

  /*
   * Once opponent + scoring + format exist,
   * completeReview owns the transition to live.
   *
   * One start path instead of multiple duplicate
   * start implementations.
   */
  completeReview()
}

function publicScoreboardSide(side) {
  if (side === 'you' || side === 'playerA') {
    return 'playerA'
  }

  if (side === 'opponent' || side === 'playerB') {
    return 'playerB'
  }

  return null
}

function buildCurrentLiveScoreboardSnapshot(
  event = {
    type: 'sync',
  },
) {
  return createLiveScoreboardSnapshot({
    draft:
      friendlyMatchStore.draft,

    playerAPoint:
      friendlyMatchStore.pointLabel(
        'you',
      ),

    playerBPoint:
      friendlyMatchStore.pointLabel(
        'opponent',
      ),

    matchFormatLabel:
      friendlyMatchStore
        .matchFormatLabel,

    scoringFormatLabel:
      friendlyMatchStore
        .formatLabel,

    event: {
      type:
        event?.type ||
        'sync',

      side:
        publicScoreboardSide(
          event?.side,
        ),
    },
  })
}

function liveOperationsScorerName() {
  const draft =
    friendlyMatchStore.draft

  const scorerId =
    draft.scorerId || ''

  if (!scorerId) {
    return ''
  }

  const playerAName =
    draft.liveState?.players
      ?.playerA ||
    authenticatedIdentity.value
      .name

  if (
    scorerId ===
    draft.ownerId
  ) {
    return playerAName
  }

  const accepted =
    chairUmpireInvitation.value
      ?.acceptedIdentity

  const acceptedId =
    accepted?.userId ||
    accepted?.guestId ||
    ''

  if (
    acceptedId &&
    acceptedId === scorerId
  ) {
    return (
      accepted?.name ||
      'Chair umpire'
    )
  }

  if (
    scorerId ===
    authenticatedIdentity.value
      .id
  ) {
    return (
      authenticatedIdentity.value
        .name ||
      'Club admin'
    )
  }

  if (
    scorerId ===
    currentIdentity.value.id
  ) {
    return (
      currentIdentity.value.name ||
      'Assigned scorer'
    )
  }

  return 'Assigned scorer'
}

function publishOperationsForScoreboard(
  scoreboard,
) {
  if (!scoreboard) {
    return false
  }

  const operations =
    createLiveOperationsSnapshot({
      scoreboard,

      draft:
        friendlyMatchStore.draft,

      scorerName:
        liveOperationsScorerName(),

      /*
       * Current TV controller code does not
       * yet maintain a reliable always-live
       * display connection state.
       *
       * Do not invent false.
       */
      displayConnected: null,

      eventType:
        scoreboard.event?.type ||
        'sync',
    })

  if (!operations) {
    return false
  }

  return publishLiveOperationsSnapshot(
    operations,
  )
}

function publishCurrentLiveOperations(
  event = {
    type: 'sync',
  },
) {
  const scoreboard =
    buildCurrentLiveScoreboardSnapshot(
      event,
    )

  return publishOperationsForScoreboard(
    scoreboard,
  )
}

function publishCurrentLiveScoreboard(
  event = {
    type: 'sync',
  },
) {
  const snapshot =
    buildCurrentLiveScoreboardSnapshot(
      event,
    )

  if (!snapshot) {
    return false
  }

  const delivered =
    publishLiveMatchSnapshot(
      snapshot,
    )

  /*
   * Operations receives a projection
   * of the same authoritative score.
   *
   * No second tennis calculation.
   */
  publishOperationsForScoreboard(
    snapshot,
  )

  return delivered
}

function syncLiveScoreboardHeartbeat() {
  stopScoreboardHeartbeat()
  stopScoreboardHeartbeat = () => {}

  const draft = friendlyMatchStore.draft

  if (step.value !== 'live' || draft.status !== 'live' || !draft.liveState) {
    return
  }

  const matchId = getLiveScoreboardMatchId(draft)

  if (!matchId) {
    return
  }

  stopScoreboardHeartbeat = startLiveMatchHeartbeat(matchId)
}

function captureLiveAnnouncementState() {
  const draft = friendlyMatchStore.draft

  const setScores = Array.isArray(draft.setScores) ? draft.setScores : []

  return {
    over: Boolean(draft.over),

    winner: draft.winner || '',

    pointsA: Number(draft.pointsA || 0),

    pointsB: Number(draft.pointsB || 0),

    gamesA: Number(draft.gamesA || 0),

    gamesB: Number(draft.gamesB || 0),

    setsA: Number(draft.setsA || 0),

    setsB: Number(draft.setsB || 0),

    format: draft.format || 'ad',

    isTiebreak: Boolean(draft.isTiebreak),

    isMatchTiebreak: Boolean(draft.isMatchTiebreak),

    standaloneTieBreak: draft.liveState?.config?.mode === 'tiebreak',

    currentServer: draft.liveState?.currentServer || 'playerA',

    playerAPoint: friendlyMatchStore.pointLabel('you'),

    playerBPoint: friendlyMatchStore.pointLabel('opponent'),

    setScoresLength: setScores.length,

    lastCompletedSet: setScores.length
      ? {
          ...setScores[setScores.length - 1],
        }
      : null,
  }
}

function showLiveAnnouncement(message) {
  if (!message) {
    return
  }

  liveAnnouncement.value = message

  if (liveAnnouncementTimer) {
    window.clearTimeout(liveAnnouncementTimer)
  }

  liveAnnouncementTimer = window.setTimeout(() => {
    if (liveAnnouncement.value === message) {
      liveAnnouncement.value = ''
    }

    liveAnnouncementTimer = null
  }, 2400)
}

function showPointConfirmation(side) {
  if (!['you', 'opponent'].includes(side)) {
    return
  }

  lastPointWinner.value = side

  if (pointFeedbackTimer) {
    window.clearTimeout(pointFeedbackTimer)
  }

  /*
   * Enough time for the scorer to perceive the
   * confirmation, but short enough that the UI
   * returns immediately to rest.
   */
  pointFeedbackTimer = window.setTimeout(() => {
    if (lastPointWinner.value === side) {
      lastPointWinner.value = ''
    }

    pointFeedbackTimer = null
  }, 520)
}

function announceLiveScore({ before, after, pointWinnerSide }) {
  const message = buildTennisAnnouncement({
    before,
    after,

    pointWinnerSide,

    playerAName: friendlyMatchStore.draft.liveState?.players?.playerA || currentIdentity.value.name,

    playerBName: friendlyMatchStore.draft.liveState?.players?.playerB || opponentName.value,
  })

  if (!message) {
    return
  }

  showLiveAnnouncement(message)

  speakTennisAnnouncement(message, {
    enabled: voiceAnnouncementsEnabled.value,
  })
}

function refreshChairUmpireScorerSession() {
  chairUmpireScorerSession.value =
    readChairUmpireScorerSessionForThisTab()

  return chairUmpireScorerSession.value
}

function chairUmpireInvitationLocation(
  session =
    chairUmpireScorerSession.value,
) {
  if (!session?.invitationToken) {
    return {
      name: 'Home',
    }
  }

  return {
    name:
      session.audience === 'guest'
        ? 'ChairUmpireGuestInvite'
        : 'ChairUmpireInvite',

    params: {
      token:
        session.invitationToken,
    },
  }
}

async function leaveChairUmpireControl() {
  const destination =
    chairUmpireInvitationLocation()

  clearChairUmpireScorerSessionForThisTab()

  chairUmpireScorerSession.value =
    null

  await router.replace(
    destination,
  )
}

function stopChairUmpireWatch() {
  stopChairUmpireSubscription()

  stopChairUmpireSubscription = () => {}
}

async function generateChairUmpireQrCode() {
  chairUmpireQrDataUrl.value = ''

  if (!chairUmpireInviteUrl.value || chairUmpireInvitation.value?.status !== 'waiting') {
    return
  }

  try {
    chairUmpireQrDataUrl.value = await QRCode.toDataURL(chairUmpireInviteUrl.value, {
      width: 248,

      margin: 2,

      color: {
        dark: '#172319',

        light: '#ffffff',
      },

      errorCorrectionLevel: 'M',
    })
  } catch {
    /*
     * Link remains usable if QR rendering fails.
     */
    chairUmpireQrDataUrl.value = ''
  }
}

function watchChairUmpireInvitation(invitationId) {
  stopChairUmpireWatch()

  stopChairUmpireSubscription = subscribeToChairUmpireInvitation(
    invitationId,

    async (nextInvitation) => {
      if (!nextInvitation) {
        return
      }

      chairUmpireInvitation.value = nextInvitation

      if (nextInvitation.status === 'waiting') {
        await generateChairUmpireQrCode()
      } else {
        chairUmpireQrDataUrl.value = ''
      }
    },
  )
}

async function activateChairUmpireInvitation(invitation) {
  chairUmpireInvitation.value = invitation

  watchChairUmpireInvitation(invitation.invitationId)

  await generateChairUmpireQrCode()
}

async function openChairUmpire() {
  if (!canManageLiveMatch.value) {
    inlineNote.value = 'You do not have permission to manage the chair umpire for this match.'

    return
  }

  try {
    await adminStore.loadClubs()
  } catch {
    /*
     * Guest invitation can still work.
     * Club-member list may simply remain empty.
     */
  }

  const matchId = getLiveScoreboardMatchId(friendlyMatchStore.draft)

  if (!matchId) {
    inlineNote.value = 'Gorra could not identify this live match.'

    return
  }

  const existing = getActiveChairUmpireInvitationForMatch(matchId, currentIdentity.value.id)

  chairUmpireInvitation.value = existing

  chairUmpireQrDataUrl.value = ''

  if (existing) {
    await activateChairUmpireInvitation(existing)
  }

  chairUmpireOpen.value = true
}

function closeChairUmpire() {
  chairUmpireOpen.value = false

  stopChairUmpireWatch()
}

function handoffChairUmpireControl() {
  inlineNote.value = ''

  if (!canManageLiveMatch.value) {
    inlineNote.value =
      'Only the match owner can hand over Match Control.'

    return
  }

  /*
   * Recover the newest score before changing authority.
   *
   * This reduces the chance of an older owner tab
   * writing an old score snapshot during handoff.
   */
  friendlyMatchStore.refreshDraft()

  const invitation =
    chairUmpireInvitation.value

  const scorerId =
    invitation?.acceptedIdentity
      ?.userId ||
    invitation?.acceptedIdentity
      ?.guestId ||
    ''

  if (
    !invitation ||
    invitation.status !==
      'accepted' ||
    !scorerId
  ) {
    inlineNote.value =
      'The chair umpire must accept the invitation before Match Control can be handed over.'

    return
  }

  /*
   * First move the authoritative scorerId.
   *
   * The recipient is not notified until that succeeds.
   */
  const transferred =
    friendlyMatchStore.transferScoringAuthority(
      {
        actorId:
          currentIdentity.value.id,

        scorerId,

        sourceId:
          invitation.invitationId,
      },
    )

  if (!transferred) {
    inlineNote.value =
      'Match Control could not be handed over.'

    return
  }

  /*
   * Now tell the accepted recipient that the owner
   * explicitly granted their already-existing
   * scorer authority.
   */
  const granted =
    grantChairUmpireScoringControl(
      invitation.invitationId,

      currentIdentity.value.id,
    )

  if (!granted) {
    /*
     * Fail closed.
     *
     * If the capability notification cannot be created,
     * immediately return scoring to the owner.
     */
    friendlyMatchStore.reclaimScoringAuthority(
      currentIdentity.value.id,
    )

    inlineNote.value =
      'The umpire could not receive Match Control. You still control scoring.'

    return
  }

  chairUmpireInvitation.value =
    granted

  publishCurrentLiveOperations({
    type: 'authority',
  })
}

function reclaimChairUmpireControl() {
  inlineNote.value = ''

  if (!canManageLiveMatch.value) {
    inlineNote.value =
      'Only the match owner can take Match Control back.'

    return
  }

  friendlyMatchStore.refreshDraft()

  const reclaimed =
    friendlyMatchStore.reclaimScoringAuthority(
      currentIdentity.value.id,
    )

  if (!reclaimed) {
    inlineNote.value =
      'Match Control could not be returned to you.'

    return
  }

  publishCurrentLiveOperations({
    type: 'authority',
  })

  const invitation =
    chairUmpireInvitation.value

  if (!invitation) {
    return
  }

  const revoked =
    revokeChairUmpireScoringControl(
      invitation.invitationId,

      currentIdentity.value.id,

      'owner_reclaimed',
    )

  if (revoked) {
    chairUmpireInvitation.value =
      revoked
  }
}

function emergencyTakeMatchControl() {
  inlineNote.value = ''

  /*
   * Reload immediately before authorization/mutation
   * so an older tab does not make the decision from
   * stale scorer state.
   */
  friendlyMatchStore.refreshDraft()

  const actorId =
    authenticatedIdentity.value.id

  const draft =
    friendlyMatchStore.draft

  const stillAuthorized =
    Boolean(
      actorId &&
        draft.status === 'live' &&
        !draft.over &&
        draft.clubId &&
        adminStore.activeClubId ===
          draft.clubId &&
        adminStore.hasActiveClubPermission(
          'matches.live_score',
        ) &&
        !friendlyMatchStore.canManageMatch(
          actorId,
        ) &&
        !friendlyMatchStore.canScoreMatch(
          actorId,
        ),
    )

  if (!stillAuthorized) {
    inlineNote.value =
      'You no longer have permission to take Match Control.'

    return
  }

  const overridden =
    friendlyMatchStore
      .emergencyOverrideScoringAuthority(
        {
          actorId,

          clubId:
            adminStore.activeClubId,

          authorized: true,
        },
      )

  if (!overridden) {
    inlineNote.value =
      'Match Control could not be changed.'

    return
  }

  publishCurrentLiveOperations({
    type: 'authority',
  })

  inlineNote.value =
    'You now have Match Control.'
}

function chairUmpireMatchSummary() {
  return {
    playerAName:
      friendlyMatchStore.draft.liveState?.players?.playerA || currentIdentity.value.name,

    playerBName: friendlyMatchStore.draft.liveState?.players?.playerB || opponentName.value,
  }
}

async function inviteClubChairUmpire(candidate) {
  if (!canManageLiveMatch.value || !candidate?.id) {
    return
  }

  const matchId = getLiveScoreboardMatchId(friendlyMatchStore.draft)

  const summary = chairUmpireMatchSummary()

  const invitation = createChairUmpireInvitationSession({
    matchId,

    matchType:
      friendlyMatchStore.draft.matchType,

    clubId: adminStore.activeClubId,

    createdBy: currentIdentity.value.id,

    createdByName: currentIdentity.value.name,

    audience: 'club_member',

    expectedUserId: candidate.id,

    expectedName: candidate.name,

    ...summary,
  })

  if (!invitation) {
    inlineNote.value = 'Gorra could not create the umpire invitation.'

    return
  }

  await activateChairUmpireInvitation(invitation)
}

async function inviteGuestChairUmpire() {
  if (!canManageLiveMatch.value) {
    return
  }

  const matchId = getLiveScoreboardMatchId(friendlyMatchStore.draft)

  const summary = chairUmpireMatchSummary()

  const invitation = createChairUmpireInvitationSession({
    matchId,

    matchType:
      friendlyMatchStore.draft.matchType,

    clubId: adminStore.activeClubId,

    createdBy: currentIdentity.value.id,

    createdByName: currentIdentity.value.name,

    audience: 'guest',

    ...summary,
  })

  if (!invitation) {
    inlineNote.value = 'Gorra could not create the guest umpire invitation.'

    return
  }

  await activateChairUmpireInvitation(invitation)
}

function removeChairUmpireInvitation() {
  const invitation = chairUmpireInvitation.value

  if (!invitation) {
    return
  }

  /*
   * Defense in depth:
   *
   * never remove a candidate while leaving them
   * as the active scorer.
   */
  if (chairUmpireHasControl.value) {
    const reclaimed =
      friendlyMatchStore.reclaimScoringAuthority(
        currentIdentity.value.id,
      )

    if (!reclaimed) {
      inlineNote.value =
        'Take Match Control back before removing this umpire.'

      return
    }

    revokeChairUmpireScoringControl(
      invitation.invitationId,

      currentIdentity.value.id,

      'umpire_removed',
    )
  }

  const cancelled = cancelChairUmpireInvitation(
    invitation.invitationId,

    currentIdentity.value.id,
  )

  if (!cancelled) {
    inlineNote.value = 'Gorra could not remove this umpire invitation.'

    return
  }

  stopChairUmpireWatch()

  chairUmpireInvitation.value = null

  chairUmpireQrDataUrl.value = ''
}

function stopTvPairingWatch() {
  stopTvPairingSubscription()

  stopTvPairingSubscription =
    () => {}
}

async function generateTvPairingQrCode() {
  tvPairingQrDataUrl.value =
    ''

  const session =
    tvPairingSession.value

  if (
    session?.status !==
      'waiting' ||
    !tvPairingInviteUrl.value
  ) {
    return
  }

  try {
    tvPairingQrDataUrl.value =
      await QRCode.toDataURL(
        tvPairingInviteUrl.value,

        {
          width: 248,

          margin: 2,

          color: {
            dark: '#172319',

            light: '#ffffff',
          },

          errorCorrectionLevel:
            'M',
        },
      )
  } catch {
    /*
     * Human pairing code remains
     * available if QR rendering fails.
     */
    tvPairingQrDataUrl.value =
      ''
  }
}

function watchTvPairingSession(
  sessionId,
) {
  stopTvPairingWatch()

  stopTvPairingSubscription =
    subscribeToPairingSession(
      sessionId,

      async (nextSession) => {
        if (!nextSession) {
          tvPairingSession.value =
            null

          tvPairingQrDataUrl.value =
            ''

          if (
            tvPairingOpen.value
          ) {
            tvPairingMessage.value =
              'This pairing has ended or expired.'
          }

          return
        }

        tvPairingSession.value =
          nextSession

        if (
          nextSession.status ===
          'waiting'
        ) {
          tvPairingMessage.value =
            ''

          await generateTvPairingQrCode()

          return
        }

        if (
          nextSession.status ===
          'claimed'
        ) {
          tvPairingQrDataUrl.value =
            ''

          tvPairingMessage.value =
            'Display connected.'
        }
      },
    )
}

async function activateTvPairing(
  session,
) {
  tvPairingSession.value =
    session

  watchTvPairingSession(
    session.sessionId,
  )

  if (
    session.status === 'waiting'
  ) {
    await generateTvPairingQrCode()
  }
}

async function openTvPairing() {
  if (!canManageLiveMatch.value) {
    inlineNote.value =
      'You do not have permission to pair a display for this match.'

    return
  }

  const matchId =
    getLiveScoreboardMatchId(
      friendlyMatchStore.draft,
    )

  if (!matchId) {
    inlineNote.value =
      'Gorra could not identify this live match.'

    return
  }

  const session =
    createPairingSession({
      matchId,

      createdBy:
        currentIdentity.value.id,

      clubId:
        friendlyMatchStore
          .draft.clubId ||
        adminStore.activeClubId ||
        '',
    })

  if (!session) {
    inlineNote.value =
      'Gorra could not create a display pairing session.'

    return
  }

  tvPairingMessage.value =
    ''

  tvPairingOpen.value =
    true

  await activateTvPairing(
    session,
  )
}

function closeTvPairing() {
  tvPairingOpen.value =
    false

  tvPairingMessage.value =
    ''

  tvPairingQrDataUrl.value =
    ''

  /*
   * Closing the sheet is NOT the same
   * thing as cancelling or disconnecting.
   */
  stopTvPairingWatch()
}

function cancelTvPairing() {
  const session =
    tvPairingSession.value

  if (
    !session ||
    session.status !==
      'waiting'
  ) {
    return
  }

  stopTvPairingWatch()

  const cancelled =
    cancelPairingSession(
      session.sessionId,

      currentIdentity.value.id,
    )

  if (!cancelled) {
    tvPairingMessage.value =
      'This pairing could not be cancelled.'

    return
  }

  tvPairingSession.value =
    null

  tvPairingQrDataUrl.value =
    ''

  tvPairingMessage.value =
    'Pairing cancelled.'
}

function revokeTvDisplay() {
  const session =
    tvPairingSession.value

  if (
    !session ||
    session.status !==
      'claimed'
  ) {
    return
  }

  stopTvPairingWatch()

  const revoked =
    revokePairedDisplay(
      session.sessionId,

      currentIdentity.value.id,
    )

  if (!revoked) {
    tvPairingMessage.value =
      'The display could not be disconnected.'

    return
  }

  tvPairingSession.value =
    null

  tvPairingQrDataUrl.value =
    ''

  tvPairingMessage.value =
    'Display disconnected.'
}

async function restartTvPairing() {
  const previous =
    tvPairingSession.value

  stopTvPairingWatch()

  if (
    previous?.status ===
    'waiting'
  ) {
    cancelPairingSession(
      previous.sessionId,

      currentIdentity.value.id,
    )
  }

  if (
    previous?.status ===
    'claimed'
  ) {
    revokePairedDisplay(
      previous.sessionId,

      currentIdentity.value.id,
    )
  }

  tvPairingSession.value =
    null

  tvPairingQrDataUrl.value =
    ''

  tvPairingMessage.value =
    ''

  await openTvPairing()
}

function toggleVoiceAnnouncements() {
  voiceAnnouncementsEnabled.value = !voiceAnnouncementsEnabled.value

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(
      VOICE_ANNOUNCEMENT_STORAGE_KEY,
      String(voiceAnnouncementsEnabled.value),
    )
  }

  if (!voiceAnnouncementsEnabled.value) {
    cancelTennisAnnouncements()
  }
}

async function recordLivePoint(side) {
  inlineNote.value = ''

  /*
   * Prevent a duplicate winning point while
   * Friendly completion is being committed.
   */
  if (friendlyFinalizing.value) {
    return
  }

  if (!canScoreLiveMatch.value) {
    inlineNote.value =
      'This match is view-only for your account. Only the assigned scorer can change the score.'

    return
  }

  /*
   * Snapshot BEFORE asking the tennis engine
   * to process the rally.
   */
  const before = captureLiveAnnouncementState()

  /*
   * AUTHORITATIVE STATE CHANGE.
   *
   * The announcement system does not calculate
   * this point.
   */
  const recorded = friendlyMatchStore.recordPoint(side, currentIdentity.value.id)

  if (!recorded) {
    inlineNote.value = 'The score did not change. Refresh the match and try again.'

    return
  }

  /*
   * Snapshot AFTER the tennis engine has
   * completely resolved:
   *
   * point
   * game
   * set
   * server
   * tie-break
   * match winner
   */
  const after = captureLiveAnnouncementState()

  /*
   * The engine accepted the point.
   *
   * Only now may the UI visually confirm the action.
   * A failed/rejected score mutation never receives
   * a successful-looking animation.
   */
  showPointConfirmation(side)

  publishCurrentLiveScoreboard({
    type: 'point',
    side,
  })

  announceLiveScore({
    before,
    after,
    pointWinnerSide: side,
  })

  /*
   * Friendly matches are committed immediately
   * when the scoring engine declares a winner.
   *
   * Voice/result presentation is not responsible
   * for deciding whether the match ended.
   */
  if (isFriendly.value && friendlyMatchStore.draft.over) {
    await finalizeFriendlyMatch()
  }
}

async function finalizeFriendlyMatch() {
  if (friendlyFinalizing.value) {
    return
  }

  if (!isFriendly.value) {
    return
  }

  if (!friendlyMatchStore.draft.over) {
    return
  }

  friendlyFinalizing.value = true

  const completedLiveMatchId = getLiveScoreboardMatchId(friendlyMatchStore.draft)

  /*
   * At this point the tennis engine has already
   * decided the match.
   *
   * endMatch() now performs the local equivalent
   * of the future backend completion transaction:
   *
   * - stores the result
   * - stores participant IDs
   * - stores winner/final score
   * - closes the invitation
   * - clears the active live draft
   */
  /*
   * Tell Live Operations that active scoring has ended
   * BEFORE endMatch() closes/removes the live session.
   *
   * The scoring engine has already declared the winner,
   * so this is now a terminal operational state.
   */
  publishCurrentLiveOperations({
    type: 'complete',
  })

  const result = friendlyMatchStore.endMatch(currentIdentity.value.id)

  if (!result) {
    friendlyFinalizing.value = false

    inlineNote.value = 'The match finished, but Gorra could not finalize the result.'

    return
  }

  const completedSnapshot = createCompletedScoreboardSnapshot({
    result,
    matchId: completedLiveMatchId,
  })

  if (completedSnapshot) {
    publishLiveMatchSnapshot(completedSnapshot)
  }

  stopScoreboardHeartbeat()
  stopScoreboardHeartbeat = () => {}

  /*
   * The result was already persisted.
   *
   * We are now changing only the presentation
   * destination.
   */
  resultModalOpen.value = false

  /*
   * A chair umpire can finish scoring but is not a
   * match participant.
   *
   * The participant result route deliberately rejects
   * non-participants, so do not send an umpire there.
   */
  if (
    isChairUmpireControlRoute.value
  ) {
    clearChairUmpireScorerSessionForThisTab()

    chairUmpireScorerSession.value =
      null

    friendlyFinalizing.value =
      false

    await router.replace({
      name: 'Home',
    })

    return
  }

  try {
    /*
     * replace() is intentional.
     *
     * Pressing browser Back should not resurrect
     * the completed live-control route.
     */
    await router.replace({
      name: 'FriendlyMatchResult',

      params: {
        resultId: result.id,
      },
    })
  } finally {
    friendlyFinalizing.value = false
  }
}

function undoLivePoint() {
  inlineNote.value = ''

  if (!canScoreLiveMatch.value) {
    inlineNote.value = 'Only the assigned scorer can undo a point.'

    return
  }

  if (!friendlyMatchStore.canUndo) {
    inlineNote.value = 'There is no recorded point to undo.'

    return
  }

  /*
   * Stop the previous score call before changing
   * what the official score now says.
   *
   * We must never have Gorra speaking an obsolete
   * score while the scorer is correcting it.
   */
  cancelTennisAnnouncements()

  const undone = friendlyMatchStore.undoPoint(currentIdentity.value.id)

  if (!undone) {
    inlineNote.value = 'The previous score could not be restored.'

    return
  }

  publishCurrentLiveScoreboard({
    type: 'undo',
  })

  /*
   * Any point-success animation now refers to a
   * state which has been corrected.
   */
  lastPointWinner.value = ''

  if (pointFeedbackTimer) {
    window.clearTimeout(pointFeedbackTimer)

    pointFeedbackTimer = null
  }

  liveAnnouncement.value = ''

  if (liveAnnouncementTimer) {
    window.clearTimeout(liveAnnouncementTimer)

    liveAnnouncementTimer = null
  }

  /*
   * Undo has already restored:
   *
   * - point score
   * - games
   * - sets
   * - server
   * - tie-break state
   *
   * from the engine history.
   *
   * We now merely announce that restored truth.
   */
  const correctedState = captureLiveAnnouncementState()

  const correctionMessage = buildTennisCorrectionAnnouncement({
    state: correctedState,

    playerAName: friendlyMatchStore.draft.liveState?.players?.playerA || currentIdentity.value.name,

    playerBName: friendlyMatchStore.draft.liveState?.players?.playerB || opponentName.value,
  })

  showLiveAnnouncement(correctionMessage)

  speakTennisAnnouncement(correctionMessage, {
    enabled: voiceAnnouncementsEnabled.value,
  })
}

function setLiveServer(side) {
  inlineNote.value = ''

  if (!['you', 'opponent'].includes(side)) {
    return
  }

  if (!canScoreLiveMatch.value) {
    inlineNote.value = 'Only the assigned scorer can correct the server.'

    return
  }

  if (friendlyMatchStore.draft.over) {
    return
  }

  const requestedPlayerKey = side === 'opponent' ? 'playerB' : 'playerA'

  const requestedName = side === 'opponent' ? opponentName.value : currentIdentity.value.name

  /*
   * Selecting the player who is already serving
   * is not an error.
   *
   * It simply means the requested correction is
   * already true.
   */
  if (friendlyMatchStore.draft.liveState?.currentServer === requestedPlayerKey) {
    showLiveAnnouncement(`${requestedName} is already serving.`)

    return
  }

  cancelTennisAnnouncements()

  const changed = friendlyMatchStore.setServer(side, currentIdentity.value.id)

  if (!changed) {
    inlineNote.value = 'The server could not be corrected.'

    return
  }

  publishCurrentLiveScoreboard({
    type: 'server',
    side,
  })

  const message = `Correction. ${requestedName} to serve.`

  showLiveAnnouncement(message)

  speakTennisAnnouncement(message, {
    enabled: voiceAnnouncementsEnabled.value,
  })
}

function reportCompletedResultIssue(message) {
  const result = completedResult.value

  if (!result) {
    notificationStore.addToast({
      message: 'This completed result could not be found.',

      type: 'warning',
    })

    return
  }

  const issue = friendlyMatchStore.reportResultIssue(result.id, currentIdentity.value.id, message)

  if (!issue) {
    notificationStore.addToast({
      message: 'Gorra could not create this review request.',

      type: 'warning',
    })

    return
  }

  notificationStore.addToast({
    message: 'Issue reported. The recorded result has not been changed.',

    type: 'success',
  })
}

async function finishMatch() {
  /*
   * FRIENDLY COMPLETED RESULT
   *
   * Nothing is saved here.
   *
   * The match was already committed the moment
   * the tennis engine declared a winner.
   *
   * This button is now navigation only.
   */

  if (step.value === 'result') {
    resultModalOpen.value = false

    await router.replace({
      name: 'Dashboard',
    })

    return
  }

  /*
   * LADDER
   *
   * Preserve the current Ladder confirmation
   * lifecycle for now.
   */
  if (isLadder.value) {
    const matchId = friendlyMatchStore.draft.ladderMatchId

    const winnerId =
      friendlyMatchStore.draft.winner === 'you'
        ? currentIdentity.value.id
        : friendlyMatchStore.draft.opponent?.id

    const submitted = await matchStore.submitResult(matchId, {
      score: friendlyMatchStore.scoreSummary,

      winnerId,

      submittedBy: currentIdentity.value.id,

      sets: friendlyMatchStore.draft.setScores.map((set) => ({
        ...set,
      })),
    })

    if (!submitted) {
      notificationStore.addToast({
        message: matchStore.error || 'The Ladder result could not be submitted.',

        type: 'warning',
      })

      return
    }

    friendlyMatchStore.endMatch(currentIdentity.value.id)

    resultModalOpen.value = false

    notificationStore.addToast({
      message: 'Result submitted. Your opponent must confirm it before rankings move.',

      type: 'success',
    })

    router.push({
      name: 'Challenges',
    })

    return
  }

  /*
   * Safety fallback for an old Friendly live
   * state created before this lifecycle change.
   */
  if (friendlyMatchStore.draft.matchType === 'friendly' && friendlyMatchStore.draft.over) {
    await finalizeFriendlyMatch()

    return
  }

  router.replace({
    name: 'Dashboard',
  })
}

function closeLadderResultModal() {
  resultModalOpen.value = false
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

async function generateQrCode() {
  if (!joinUrl.value) return
  try {
    qrDataUrl.value = await QRCode.toDataURL(joinUrl.value, {
      width: 248,
      margin: 2,
      color: { dark: '#172319', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch {
    qrDataUrl.value = ''
  }
}
async function copyJoinLink() {
  try {
    await navigator.clipboard.writeText(joinUrl.value)
    copyStatus.value = 'Match link copied'
  } catch {
    copyStatus.value = 'Select the link below to copy it'
  }
  window.setTimeout(() => {
    copyStatus.value = ''
  }, 2400)
}

function simulatePlayerJoining() {
  if (!friendlyMatchStore.draft.joinToken) {
    return
  }

  let simulated = null

  if (activeInvitation.value?.audience === 'targeted') {
    simulated = activeInvitation.value.expectedOpponent || friendlyMatchStore.draft.opponent
  } else {
    /*
     * Simulates a real GORRA account outside this club.
     * In production, this identity will come from the person
     * who authenticated before claiming the invitation.
     */
    simulated = {
      id: 'external-demo-player',
      name: 'External player',
      division: 'GORRA Player',
    }
  }

  if (!simulated) {
    return
  }

  const result = friendlyMatchStore.joinInvitation(friendlyMatchStore.draft.joinToken, simulated)

  if (!result.ok) {
    inlineNote.value = result.message || 'This player could not join the match.'
    return
  }

  const joinedPlayer = result.invitation?.opponent

  if (joinedPlayer?.name) {
    announceJoined(joinedPlayer.name)
  }
}

function announceJoined(name) {
  joinedNotice.value = `${name} joined the match.`

  if (autoRouteTimer) {
    window.clearTimeout(autoRouteTimer)
    autoRouteTimer = null
  }

  /*
   * Friendly matches now stay on the Ready state.
   *
   * Joining the invitation and starting the match
   * are two different real-world actions.
   *
   * Ladder keeps its current automatic continuation
   * for now because its flow is handled separately.
   */
  if (isLadder.value) {
    autoRouteTimer = window.setTimeout(() => {
      if (step.value === 'join' || step.value === 'clubOpponent') {
        router.push(flowLocation('FriendlyMatchFormat'))
      }
    }, 900)
  }
}

function refreshInvitation() {
  const wasReady = playNowReady.value
  friendlyMatchStore.refreshInvitations()
  if (!wasReady && playNowReady.value && step.value === 'join') announceJoined(opponentName.value)
  if (step.value === 'externalJoin')
    externalInvitation.value = friendlyMatchStore.invitationByToken(
      String(route.params.token || ''),
    )
}

function stopInvitationPolling() {
  if (!invitationTimer) {
    return
  }

  window.clearInterval(invitationTimer)

  invitationTimer = null
}

function syncInvitationPolling() {
  stopInvitationPolling()

  /*
   * Only invitation screens need polling.
   *
   * Once Match Control opens there is absolutely no
   * reason for a 1.2-second invitation timer to remain
   * alive in the background.
   */
  if (!['join', 'externalJoin'].includes(step.value)) {
    return
  }

  invitationTimer = window.setInterval(() => {
    refreshInvitation()
  }, 1200)
}

function joinAsCurrentUser() {
  const result = friendlyMatchStore.joinInvitation(
    String(route.params.token || ''),
    currentIdentity.value,
  )
  joinMessage.value = result.message || ''
  externalInvitation.value = result.invitation || externalInvitation.value
}

function handleStorage(event) {
  const key = String(event.key || '')

  if (!key) {
    return
  }

  /*
   * STORAGE EVENTS
   *
   * Refresh only the state collection that actually
   * changed.
   *
   * Previously every Friendly storage event caused:
   *
   * - draft refresh
   * - result refresh
   * - invitation refresh
   *
   * even when only one collection changed.
   *
   * That is harmless in a tiny demo but unnecessary
   * work during a real live match.
   */

  /*
   * SETUP DRAFT
   *
   * A live Match Control page does not care that
   * another tab is configuring the next match.
   */
  if (
    key.includes(
      'friendlyMatchDraft',
    )
  ) {
    if (
      step.value !== 'live'
    ) {
      friendlyMatchStore
        .refreshDraft()
    }

    return
  }

  /*
   * MATCH-SCOPED LIVE SESSION
   *
   * Court A ignores Court B's storage event.
   */
  if (
    key.includes(
      'friendlyMatchLive.v1.',
    )
  ) {
    if (
      step.value === 'live' &&
      friendlyMatchStore
        .isCurrentLiveStorageKey(
          key,
        )
    ) {
      friendlyMatchStore
        .refreshDraft()

      guardStep()

      syncLiveScoreboardHeartbeat()
    }

    return
  }

  if (key.includes('friendlyMatchResults')) {
    friendlyMatchStore.refreshResults()

    return
  }

  if (key.includes('friendlyMatchInvitations')) {
    refreshInvitation()
  }
}

function recoverCurrentMatchState() {
  if (
    isChairUmpireControlRoute.value
  ) {
    refreshChairUmpireScorerSession()
  }

  /*
   * Browser backgrounding is common during club play.
   *
   * On return, refresh from persisted state rather than
   * assuming the in-memory Vue state is still freshest.
   *
   * refreshDraft() already protects newer revisions from
   * being overwritten by older persisted snapshots.
   */
  if (
    step.value === 'live'
  ) {
    const requestedId =
      requestedLiveMatchId.value

    if (!requestedId) {
      return
    }

    /*
     * Opening Match A explicitly loads Match A.
     *
     * It does not matter which court this browser
     * happened to have open previously.
     */
    if (
      friendlyMatchStore
        .liveMatchId !==
      requestedId
    ) {
      friendlyMatchStore
        .loadLiveMatch(
          requestedId,
        )

      return
    }

    friendlyMatchStore
      .refreshDraft()

    return
  }

  if (['join', 'externalJoin'].includes(step.value)) {
    refreshInvitation()

    return
  }

  if (step.value === 'result') {
    friendlyMatchStore.refreshResults()
  }
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') {
    return
  }

  recoverCurrentMatchState()

  if (step.value === 'live') {
    guardStep()
  }
}

function handleWindowFocus() {
  recoverCurrentMatchState()

  if (step.value === 'live') {
    guardStep()
  }
}

function configureStep() {
  inlineNote.value = ''
  searchQuery.value = ''
  copyStatus.value = ''
  joinedNotice.value = ''
  customFormatError.value = ''
  showTieBreakDetails.value = false

  /*
   * Route changes can occur after another tab/device-side
   * action changed our persisted mock state.
   *
   * Recover the state relevant to the destination before
   * allowing guardStep() to judge the route.
   */
  recoverCurrentMatchState()

  syncInvitationPolling()

  if (step.value === 'customFormat') {
    const selected = friendlyMatchStore.draft.customFormat
    Object.assign(customFormatForm, {
      id: selected?.id || '',
      name: selected?.name === 'Custom format' ? '' : selected?.name || '',
      mode: selected?.mode || 'sets',
      setsToWin: selected?.setsToWin || 2,
      gamesPerSet: selected?.gamesPerSet || 6,
      tieBreakAt: selected?.tieBreakAt ?? 6,
      tieBreakPoints: selected?.tieBreakPoints || 7,
      saveForLater: Boolean(
        selected && friendlyMatchStore.savedFormats.some((format) => format.id === selected.id),
      ),
    })
  }
  refreshInvitation()
  guardStep()
  syncLiveScoreboardHeartbeat()
  if (step.value === 'join') generateQrCode()
}

onMounted(async () => {
  await Promise.all([
    !playerStore.players.length && !playerStore.isLoading ? playerStore.loadPlayers() : null,
    !challengeStore.challenges.length ? challengeStore.loadChallenges() : null,
    !matchStore.matches.length ? matchStore.loadMatches() : null,
  ])
  if (step.value === 'type' && route.query.mode === 'ladder') {
    friendlyMatchStore.chooseMatchType('ladder')
    await router.replace(flowLocation('FriendlyMatchClubOpponent'))
  }
})
configureStep()

window.addEventListener('storage', handleStorage)

window.addEventListener('focus', handleWindowFocus)

document.addEventListener('visibilitychange', handleVisibilityChange)
onUnmounted(() => {
  window.removeEventListener('storage', handleStorage)

  window.removeEventListener('focus', handleWindowFocus)

  document.removeEventListener('visibilitychange', handleVisibilityChange)

  stopInvitationPolling()

  if (autoRouteTimer) {
    window.clearTimeout(autoRouteTimer)
  }

  if (liveAnnouncementTimer) {
    window.clearTimeout(liveAnnouncementTimer)
  }

  if (pointFeedbackTimer) {
    window.clearTimeout(pointFeedbackTimer)
  }

  stopChairUmpireWatch()

  stopTvPairingWatch()

  stopScoreboardHeartbeat()
  stopScoreboardHeartbeat = () => {}

  cancelTennisAnnouncements()
})

watch(step, configureStep)
watch(
  [step, () => friendlyMatchStore.draft.over],

  ([currentStep, matchOver]) => {
    /*
     * Friendly completed matches have their own
     * dedicated immutable Result route now.
     *
     * Only Ladder temporarily retains the old modal
     * submission experience.
     */
    resultModalOpen.value = Boolean(currentStep === 'live' && isLadder.value && matchOver)
  },

  {
    immediate: true,
  },
)
</script>

<template>
  <div class="friendly-flow-route">
    <main
      v-if="canRenderCurrentRoute"
      class="friendly-flow"
      :class="{
        'friendly-flow--picker': step === 'clubOpponent',

        'friendly-flow--fixed-action': showReadyActionFooter,
      }"
    >
      <div v-if="joinedNotice" class="join-notification" role="status">
        <span aria-hidden="true">✓</span>{{ joinedNotice }}
      </div>
      <header v-if="!['live', 'result'].includes(step)" class="friendly-flow__header">
        <button type="button" class="friendly-flow__back" aria-label="Go back" @click="goBack">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
        </button>
        <h1 v-if="step !== 'live'">{{ pageTitle }}</h1>
        <span v-if="step !== 'live' && stepText" class="friendly-flow__step">{{ stepText }}</span>
      </header>

      <section
        v-if="step === 'type'"
        class="friendly-flow__screen"
        aria-labelledby="match-type-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">Choose one</p>
          <h2 id="match-type-title">What kind of match are you playing?</h2>
        </div>
        <p v-if="inlineNote" class="friendly-flow__notice" role="status">{{ inlineNote }}</p>
        <div class="friendly-flow__choices friendly-flow__choices--stacked">
          <button
            type="button"
            class="choice-card choice-card--friendly"
            @click="chooseMatchType('friendly')"
          >
            <span class="flow-choice-icon"><FlowIcon name="friendly" /></span>
            <span
              ><strong>Friendly match</strong
              ><small
                >Search any existing club member and play without affecting rankings.</small
              ></span
            ><span class="choice-card__arrow" aria-hidden="true">›</span>
          </button>
          <button type="button" class="choice-card" @click="chooseMatchType('ladder')">
            <span class="flow-choice-icon"><FlowIcon name="ladder" /></span>
            <span
              ><strong>Ladder challenge</strong
              ><small>{{
                currentIdentity.rank
                  ? `You are rank #${currentIdentity.rank}. See only eligible players.`
                  : 'Join the active Ladder to challenge ranked players.'
              }}</small></span
            ><span class="choice-card__arrow" aria-hidden="true">›</span>
          </button>
          <button
            type="button"
            class="choice-card choice-card--muted"
            @click="showTournamentNotice"
          >
            <span class="flow-choice-icon"><FlowIcon name="trophy" /></span>
            <span><strong>Tournament match</strong><small>Part of an organized event</small></span>
          </button>
        </div>
      </section>

      <section
        v-else-if="step === 'timing'"
        class="friendly-flow__screen"
        aria-labelledby="timing-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">
            {{ isLadder ? 'Ladder challenge' : 'Friendly match' }}
          </p>
          <h2 id="timing-title">When are you playing?</h2>
          <p v-if="isLadder">
            Play immediately with an eligible opponent, or send a challenge for later.
          </p>
          <p v-else>
            Your match setup is ready. Choose whether you are playing now or arranging it for later.
          </p>
          <p
            v-if="isLadder && ladderAccessMessage"
            class="friendly-flow__notice"
            :class="{ 'friendly-flow__notice--action': hasActiveChallengeBlock }"
            role="status"
          >
            <span>{{ ladderAccessMessage }}</span>
            <RouterLink
              v-if="hasActiveChallengeBlock"
              class="friendly-flow__notice-link"
              :to="{
                name: 'ChallengeDetails',
                params: { challengeId: activeLadderChallenge.id },
                query: { context: 'ladder-create' },
              }"
            >
              <span>View active challenge</span><FlowIcon name="arrow-right" />
            </RouterLink>
          </p>
        </div>
        <div class="friendly-flow__choices friendly-flow__choices--formats">
          <button
            type="button"
            class="format-card"
            :disabled="isLadder && (Boolean(ladderAccessMessage) || ladderAccessChecking)"
            @click="chooseTiming('now')"
          >
            <span class="flow-choice-icon"><FlowIcon name="play" /></span>
            <small>Continue with this setup and bring your opponent into the match.</small>
            <small>Show a QR code so the opponent can join immediately.</small>
          </button>
          <button
            type="button"
            class="format-card"
            :disabled="isLadder && (Boolean(ladderAccessMessage) || ladderAccessChecking)"
            @click="chooseTiming('later')"
          >
            <span class="flow-choice-icon"><FlowIcon name="calendar" /></span>
            <strong>{{ isLadder ? 'Challenge for later' : 'Schedule for later' }}</strong
            ><small>{{
              isLadder
                ? 'Use this setup for a match you want to arrange for another time.'
                : 'Choose a club member now. Match timing is optional.'
            }}</small>
          </button>
        </div>
      </section>

      <section
        v-else-if="step === 'opponent'"
        class="friendly-flow__screen"
        aria-labelledby="ladder-opponent-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">
            Rank #{{ friendlyMatchStore.currentLadderRank }} · Eligible players
          </p>
          <h2 id="ladder-opponent-title">Who are you playing?</h2>
          <p>You can challenge players up to three ladder positions above you.</p>
        </div>
        <p class="eligibility-context">
          Showing only ranks #3–#5 because they are within your challenge window.
        </p>
        <label class="opponent-search"
          ><svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" /></svg
          ><span class="sr-only">Search eligible players</span
          ><input
            v-model="searchQuery"
            type="search"
            placeholder="Search eligible players"
            autocomplete="off"
        /></label>
        <div class="opponent-list" role="radiogroup" aria-label="Choose opponent">
          <button
            v-for="opponent in availableOpponents"
            :key="opponent.id"
            type="button"
            class="opponent-row"
            :class="{ 'opponent-row--selected': selectedOpponentId === opponent.id }"
            role="radio"
            :aria-checked="selectedOpponentId === opponent.id"
            @click="chooseOpponent(opponent)"
          >
            <span class="opponent-row__avatar">{{ initials(opponent.name) }}</span
            ><span class="opponent-row__identity"
              ><strong>{{ opponent.name }}</strong
              ><small>Rank #{{ opponent.rank }} · {{ opponent.division }}</small></span
            ><span v-if="selectedOpponentId === opponent.id" class="opponent-row__check">✓</span>
          </button>
        </div>
        <button
          type="button"
          class="button-primary friendly-flow__continue"
          :disabled="!friendlyMatchStore.draft.opponent"
          @click="router.push(flowLocation('FriendlyMatchFormat'))"
        >
          <FlowIcon name="arrow-right" /><span>Continue</span>
        </button>
      </section>

      <section
        v-else-if="step === 'join'"
        class="friendly-flow__screen friendly-flow__screen--invitation"
        aria-labelledby="join-title"
      >
        <!-- FRIENDLY: no invitation exists yet -->
        <template v-if="isFriendly && !activeInvitation">
          <div class="friendly-flow__intro">
            <p class="friendly-flow__eyebrow">Play now</p>

            <h2 id="join-title">Who are you playing with?</h2>

            <p>Choose someone from your club, or share the match with someone else.</p>
          </div>

          <p v-if="inlineNote" class="friendly-flow__notice" role="status">
            {{ inlineNote }}
          </p>

          <div class="friendly-flow__choices friendly-flow__choices--formats">
            <button type="button" class="format-card" @click="openClubOpponents">
              <span class="flow-choice-icon">
                <FlowIcon name="users" />
              </span>

              <strong>Club member</strong>

              <small> Choose someone who already belongs to this club. </small>
            </button>

            <button type="button" class="format-card" @click="createOpenFriendlyInvitation">
              <span class="flow-choice-icon">
                <FlowIcon name="users" />
              </span>

              <strong>Someone else</strong>

              <small> Share a secure invitation with someone outside this club. </small>
            </button>
          </div>
        </template>

        <!-- LADDER or FRIENDLY invitation already created -->
        <template v-else>
          <div class="friendly-flow__intro">
            <p class="friendly-flow__eyebrow">
              {{ isLadder ? 'Ladder · Play now' : 'Friendly match · Play now' }}
            </p>

            <h2 id="join-title">
              {{
                invitationIsOpen ? 'Let your opponent join.' : `Let ${invitationTargetName} join.`
              }}
            </h2>

            <p v-if="invitationIsOpen">
              Share this QR code or match link with the person you're playing. Once they identify
              themselves and join, they'll become the opponent for this match.
            </p>

            <p v-else>
              This invitation is for {{ invitationTargetName }}. They can scan the QR code or open
              the same match link.
            </p>
          </div>

          <div class="invitation-action-row">
            <div>
              <strong>
                {{
                  invitationExpired
                    ? 'Invitation unavailable'
                    : playNowReady
                      ? `${opponentName} joined`
                      : invitationIsOpen
                        ? 'Waiting for someone to join'
                        : `Waiting for ${invitationTargetName}`
                }}
              </strong>

              <small>
                {{
                  playNowReady
                    ? 'Both players are connected. Start when you are together on court.'
                    : 'Keep this screen open while your opponent joins.'
                }}
              </small>
            </div>
          </div>

          <div v-if="!playNowReady" class="qr-panel qr-panel--single">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              :alt="`QR code for this ${isLadder ? 'Ladder challenge' : 'friendly match'} invitation`"
            />

            <div v-else class="qr-panel__placeholder" aria-label="QR code loading"></div>

            <button
              type="button"
              class="button-primary copy-link-action"
              :disabled="!joinUrl"
              @click="copyJoinLink"
            >
              <FlowIcon name="copy" />
              <span>Copy match link</span>
            </button>

            <p v-if="copyStatus" role="status">
              {{ copyStatus }}
            </p>

            <a class="join-link" :href="joinUrl">
              {{ joinUrl }}
            </a>
          </div>

          <button
            v-if="!playNowReady && !invitationExpired"
            type="button"
            class="simulate-join"
            @click="simulatePlayerJoining"
          >
            <FlowIcon name="spark" />

            <span>
              {{
                invitationIsOpen
                  ? 'Simulate someone joining'
                  : `Simulate ${invitationTargetName} joining`
              }}
            </span>
          </button>
          <div
            v-if="isFriendly && playNowReady"
            class="friendly-ready"
            aria-labelledby="friendly-ready-title"
          >
            <div class="friendly-ready__status">
              <span class="friendly-ready__check" aria-hidden="true"> ✓ </span>

              <div>
                <small>Ready to play</small>

                <strong id="friendly-ready-title">
                  {{ currentIdentity.name }}
                  <span aria-hidden="true">vs</span>
                  {{ opponentName }}
                </strong>

                <p>
                  Your opponent is connected. Start the match when both of you are ready for the
                  first point.
                </p>
              </div>
            </div>

            <div class="friendly-ready__setup" aria-label="Match setup">
              <div>
                <span>Scoring</span>
                <strong>
                  {{ friendlyMatchStore.formatLabel }}
                </strong>
              </div>

              <div>
                <span>Match format</span>
                <strong>
                  {{ friendlyMatchStore.matchFormatLabel }}
                </strong>
              </div>
            </div>

            <p v-if="inlineNote" class="friendly-flow__notice" role="status">
              {{ inlineNote }}
            </p>
          </div>
        </template>
      </section>

      <section
        v-else-if="step === 'clubOpponent'"
        class="friendly-flow__screen club-picker"
        aria-labelledby="club-opponent-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">
            {{
              isLadder && currentIdentity.rank
                ? 'Rank #' + currentIdentity.rank + ' · Eligible players'
                : 'Club members'
            }}
          </p>
          <h2 id="club-opponent-title">
            {{ isLadder ? 'Choose an eligible opponent.' : 'Choose opponent from club.' }}
          </h2>
          <p v-if="isLadder">
            Only active players within {{ activeLadderConfig.challengeRangeUp }} positions above you
            appear here.
          </p>
          <p v-else>
            Select an active member. Your action will stay available at the bottom of the screen.
          </p>
          <p v-if="isLadder && ladderWindow" class="eligibility-context">
            Your challenge window is rank #{{ ladderWindow.highest }}–#{{ ladderWindow.lowest }}.
          </p>
          <p
            v-if="isLadder && ladderAccessMessage"
            class="friendly-flow__notice"
            :class="{ 'friendly-flow__notice--action': hasActiveChallengeBlock }"
            role="status"
          >
            <span>{{ ladderAccessMessage }}</span>
            <RouterLink
              v-if="hasActiveChallengeBlock"
              class="friendly-flow__notice-link"
              :to="{
                name: 'ChallengeDetails',
                params: { challengeId: activeLadderChallenge.id },
                query: { context: 'ladder-create' },
              }"
            >
              <span>View active challenge</span><FlowIcon name="arrow-right" />
            </RouterLink>
          </p>
        </div>
        <label class="opponent-search"
          ><svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" /></svg
          ><span class="sr-only">Search club members</span
          ><input
            v-model="searchQuery"
            type="search"
            placeholder="Search club members"
            autocomplete="off"
        /></label>
        <div
          v-if="availableOpponents.length"
          class="opponent-list"
          role="radiogroup"
          aria-label="Choose club opponent"
        >
          <button
            v-for="opponent in availableOpponents"
            :key="opponent.id"
            type="button"
            class="opponent-row"
            :class="{ 'opponent-row--selected': selectedOpponentId === opponent.id }"
            role="radio"
            :aria-checked="selectedOpponentId === opponent.id"
            @click="chooseOpponent(opponent)"
          >
            <span class="opponent-row__avatar">{{ initials(opponent.name) }}</span
            ><span class="opponent-row__identity"
              ><strong>{{ opponent.name }}</strong
              ><small
                >{{ opponent.rank ? `Rank #${opponent.rank} · ` : ''
                }}{{ opponent.division }}</small
              ></span
            ><span v-if="selectedOpponentId === opponent.id" class="opponent-row__check">✓</span>
          </button>
        </div>
        <div v-else class="opponent-empty">
          <strong>{{ isLadder ? 'No eligible opponents right now' : 'No matching players' }}</strong
          ><span>{{
            isLadder
              ? 'Availability depends on your Ladder position and the club challenge rules.'
              : 'Try another name.'
          }}</span
          ><button type="button" class="button-secondary" @click="searchQuery = ''">
            <FlowIcon name="close" /><span>Clear search</span>
          </button>
        </div>
      </section>

      <footer
        v-if="
          step === 'clubOpponent' &&
          friendlyMatchStore.draft.opponent &&
          !(isLadder && ladderAccessMessage)
        "
        class="selection-footer"
      >
        <div>
          <span class="opponent-row__avatar">{{ initials(opponentName) }}</span>
          <p>
            <strong>{{ opponentName }}</strong
            ><small>Selected opponent</small>
          </p>
        </div>
        <button type="button" class="button-primary" @click="continueWithClubOpponent">
          <FlowIcon name="arrow-right" /><span>Continue</span>
        </button>
      </footer>

      <footer
        v-if="showReadyActionFooter"
        class="selection-footer selection-footer--match-ready"
        aria-label="Match ready action"
      >
        <div>
          <span class="opponent-row__avatar" aria-hidden="true">
            {{ initials(opponentName) }}
          </span>

          <p>
            <strong>
              {{ opponentName }}
            </strong>

            <small>
              {{ readyActionDescription }}
            </small>
          </p>
        </div>

        <button type="button" class="button-primary" @click="handleReadyAction">
          <FlowIcon :name="readyActionLabel === 'Start match' ? 'play' : 'arrow-right'" />

          <span>
            {{ readyActionLabel }}
          </span>
        </button>
      </footer>

      <section
        v-if="step === 'schedule'"
        class="friendly-flow__screen"
        aria-labelledby="schedule-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">Optional</p>
          <h2 id="schedule-title">Set a time if you have one.</h2>
          <p>You can send the invitation without a date, time or court.</p>
        </div>
        <div class="schedule-fields">
          <label
            ><span>Date <small>Optional</small></span
            ><input
              type="date"
              :min="minDate"
              :value="friendlyMatchStore.draft.schedule.date"
              @input="friendlyMatchStore.updateSchedule('date', $event.target.value)" /></label
          ><label
            ><span>Time <small>Optional</small></span
            ><input
              type="time"
              :value="friendlyMatchStore.draft.schedule.time"
              @input="friendlyMatchStore.updateSchedule('time', $event.target.value)" /></label
          ><label
            ><span>Court <small>Optional</small></span
            ><input
              type="text"
              placeholder="e.g. Court 2"
              :value="friendlyMatchStore.draft.schedule.court"
              @input="friendlyMatchStore.updateSchedule('court', $event.target.value)"
          /></label>
        </div>
        <button
          type="button"
          class="button-primary friendly-flow__continue"
          @click="continueFromSchedule"
        >
          <FlowIcon name="arrow-right" /><span>Continue</span>
        </button>
      </section>

      <section
        v-if="step === 'externalJoin'"
        class="friendly-flow__screen external-join"
        aria-labelledby="external-join-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">Friendly match</p>
          <h2 id="external-join-title">
            {{
              externalInvitation?.status === 'ready' &&
              externalInvitation?.opponent?.id === currentIdentity.id
                ? 'You are ready.'
                : 'Join this match.'
            }}
          </h2>
          <p v-if="externalInvitation">
            {{ externalInvitation.creator?.name }} invited you to a friendly match.
          </p>
          <p v-else>This match invitation is no longer available.</p>
        </div>
        <div v-if="externalInvitation" class="join-summary">
          <span>Match invitation</span
          ><strong
            >{{ externalInvitation.creator?.name }} vs
            {{ externalInvitation.opponent?.name || 'Waiting for opponent' }}</strong
          ><small>{{
            externalInvitation.status === 'waiting_for_opponent'
              ? 'Confirm your identity to join.'
              : externalInvitation.status === 'ready'
                ? 'Both players are ready.'
                : 'This invitation is not accepting players.'
          }}</small>
        </div>
        <div v-if="externalInvitation" class="review-list">
          <div class="review-row">
            <span>Match</span>
            <strong>Friendly match</strong>
          </div>

          <div class="review-row">
            <span>Format</span>
            <strong>
              {{ invitationMatchFormatLabel(externalInvitation) }}
            </strong>
          </div>

          <div class="review-row">
            <span>Scoring</span>
            <strong>
              {{ invitationScoringLabel(externalInvitation) }}
            </strong>
          </div>

          <div class="review-row">
            <span>Timing</span>
            <strong>Play now</strong>
          </div>
        </div>
        <p v-if="joinMessage" class="friendly-flow__notice" role="status">{{ joinMessage }}</p>
        <button
          v-if="externalInvitation?.status === 'waiting_for_opponent'"
          type="button"
          class="button-primary friendly-flow__continue friendly-flow__continue--left"
          @click="joinAsCurrentUser"
        >
          <FlowIcon name="login" /><span>Join match</span></button
        ><button
          v-else
          type="button"
          class="button-secondary friendly-flow__continue friendly-flow__continue--left"
          @click="router.push({ name: 'Dashboard' })"
        >
          <FlowIcon name="home" /><span>Back to dashboard</span>
        </button>
      </section>

      <section
        v-if="step === 'scoring'"
        class="friendly-flow__screen"
        aria-labelledby="scoring-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">Match setup</p>
          <h2 id="scoring-title">How should deuce be played?</h2>
          <p>
            Both formats use love, 15, 30 and 40. Choose what happens when the score reaches deuce.
          </p>
        </div>
        <div class="friendly-flow__choices friendly-flow__choices--formats">
          <button type="button" class="format-card" @click="chooseFormat('ad')">
            <span class="flow-choice-icon"><FlowIcon name="advantage" /></span>
            <strong>Advantage</strong
            ><small>At deuce, a player must win two consecutive points.</small></button
          ><button type="button" class="format-card" @click="chooseFormat('noad')">
            <span class="flow-choice-icon"><FlowIcon name="no-ad" /></span>
            <strong>No-Ad</strong><small>At deuce, the next point wins the game.</small>
          </button>
        </div>
      </section>

      <section
        v-if="step === 'format'"
        class="friendly-flow__screen"
        aria-labelledby="format-title"
      >
        <template v-if="isFriendly">
          <div class="friendly-flow__intro">
            <p class="friendly-flow__eyebrow">Match setup</p>
            <h2 id="format-title">Choose a match format.</h2>
            <p>Choose a standard format, one of your saved formats, or customise your own.</p>
          </div>
          <div
            class="friendly-flow__choices friendly-flow__choices--stacked match-format-list"
            role="radiogroup"
            aria-label="Match format"
          >
            <button
              v-for="option in [
                {
                  id: 'best-of-3',
                  icon: 'sets',
                  title: 'Best of 3 sets',
                  description: 'First player to win two full sets.',
                },
                {
                  id: 'one-set',
                  icon: 'one-set',
                  title: 'One set',
                  description: 'One full set with a tie-break at 6–6.',
                },
                {
                  id: 'match-tiebreak',
                  icon: 'tiebreak',
                  title: '10-point match tie-break',
                  description: 'First to 10 points, winning by two.',
                },
              ]"
              :key="option.id"
              type="button"
              class="choice-card match-format-choice"
              :class="{
                'match-format-choice--selected': friendlyMatchStore.draft.matchFormat === option.id,
              }"
              role="radio"
              :aria-checked="friendlyMatchStore.draft.matchFormat === option.id"
              @click="chooseMatchFormat(option.id)"
            >
              <span class="flow-choice-icon"><FlowIcon :name="option.icon" /></span>
              <span
                ><strong>{{ option.title }}</strong
                ><small>{{ option.description }}</small></span
              >
              <span class="choice-card__arrow" aria-hidden="true">{{
                friendlyMatchStore.draft.matchFormat === option.id ? '✓' : '›'
              }}</span>
            </button>
            <button
              v-for="format in friendlyMatchStore.savedFormats"
              :key="format.id"
              type="button"
              class="choice-card match-format-choice"
              :class="{
                'match-format-choice--selected':
                  friendlyMatchStore.draft.matchFormat === 'custom' &&
                  friendlyMatchStore.draft.customFormat?.id === format.id,
              }"
              role="radio"
              :aria-checked="
                friendlyMatchStore.draft.matchFormat === 'custom' &&
                friendlyMatchStore.draft.customFormat?.id === format.id
              "
              @click="chooseSavedFormat(format)"
            >
              <span class="flow-choice-icon"><FlowIcon name="bookmark" /></span>
              <span
                ><strong>{{ format.name }}</strong
                ><small>{{ describeCustomFormat(format) }}</small></span
              >
              <span class="choice-card__arrow" aria-hidden="true">{{
                friendlyMatchStore.draft.matchFormat === 'custom' &&
                friendlyMatchStore.draft.customFormat?.id === format.id
                  ? '✓'
                  : '›'
              }}</span>
            </button>
            <button type="button" class="choice-card match-format-choice" @click="openCustomFormat">
              <span class="flow-choice-icon"><FlowIcon name="sliders" /></span>
              <span
                ><strong>Customise</strong
                ><small>Set the number of sets, games and tie-break points.</small></span
              ><span class="choice-card__arrow" aria-hidden="true">›</span>
            </button>
          </div>
          <button
            type="button"
            class="button-primary friendly-flow__continue"
            @click="continueFromFriendlyFormat"
          >
            <FlowIcon name="arrow-right" />
            <span>Continue</span>
          </button>
        </template>
        <template v-else>
          <div class="friendly-flow__intro">
            <p class="friendly-flow__eyebrow">Ladder rules · Club controlled</p>
            <h2 id="format-title">Review your challenge.</h2>
            <p>The official Ladder format is applied automatically and cannot be changed here.</p>
          </div>
          <p v-if="inlineNote" class="friendly-flow__notice" role="status">{{ inlineNote }}</p>
          <div class="review-list">
            <div class="review-row">
              <span>Players</span>
              <strong
                >{{ currentIdentity.name }} (#{{ currentIdentity.rank }}) vs {{ opponentName }} (#{{
                  friendlyMatchStore.draft.opponent?.rank
                }})</strong
              >
            </div>
            <div class="review-row">
              <span>Movement</span><strong>{{ ladderMovement.label }}</strong>
            </div>
            <div class="review-row">
              <span>Scoring</span
              ><strong>{{ friendlyMatchStore.formatLabel }} <small>Club rule</small></strong>
            </div>
            <div class="review-row">
              <span>Match format</span
              ><strong>{{ activeLadderConfig.matchFormatLabel }} <small>Club rule</small></strong>
            </div>
            <div class="review-row">
              <span>Tie-break</span
              ><strong>{{ activeLadderConfig.tieBreakLabel }} <small>Club rule</small></strong>
            </div>
            <div class="review-row">
              <span>Timing</span><strong>{{ isPlayNow ? 'Play now' : formattedSchedule }}</strong>
            </div>
          </div>
          <div class="setup-default-note">
            <FlowIcon name="lock" /><span
              >Respond within {{ activeLadderConfig.responseHours }} hours · Play within
              {{ activeLadderConfig.completionDays }} days</span
            >
          </div>
          <button
            v-if="!isPlayNow"
            type="button"
            class="button-primary friendly-flow__continue"
            @click="completeReview"
          >
            <FlowIcon name="send" />
            <span>Send invitation</span>
          </button>
        </template>
      </section>

      <section
        v-if="step === 'customFormat'"
        class="friendly-flow__screen"
        aria-labelledby="custom-format-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">Custom format</p>
          <h2 id="custom-format-title">Set your match rules.</h2>
          <p>Start with the closest option. The usual tennis settings are already filled in.</p>
        </div>
        <form class="custom-format-form" @submit.prevent="applyCustomFormat">
          <div class="custom-format-summary" aria-live="polite">
            <span>Your match</span>
            <strong>{{ customFormatSummary }}</strong>
          </div>

          <div class="custom-format-section">
            <div class="custom-format-section__head">
              <strong>How are you playing?</strong>
              <small>Choose one. Best of 3 is the usual option.</small>
            </div>
            <div class="custom-style-chips" role="radiogroup" aria-label="Match style">
              <button
                v-for="option in [
                  { value: 'best-of-3', icon: 'sets', label: 'Best of 3', hint: 'Usual choice' },
                  { value: 'one-set', icon: 'one-set', label: 'One set', hint: 'Quicker match' },
                  {
                    value: 'match-tiebreak',
                    icon: 'tiebreak',
                    label: 'Match tie-break',
                    hint: 'First to 10',
                  },
                ]"
                :key="option.value"
                type="button"
                class="custom-style-chip"
                :class="{ 'custom-style-chip--selected': customMatchStyle === option.value }"
                role="radio"
                :aria-checked="customMatchStyle === option.value"
                @click="selectCustomMatchStyle(option.value)"
              >
                <span class="flow-choice-icon"><FlowIcon :name="option.icon" /></span>
                <strong>{{ option.label }}</strong
                ><small>{{ option.hint }}</small>
              </button>
            </div>
          </div>

          <div v-if="customFormatForm.mode === 'sets'" class="custom-setting-row">
            <span><strong>Games per set</strong><small>Standard tennis uses 6.</small></span>
            <div class="custom-stepper" aria-label="Games per set">
              <button
                type="button"
                aria-label="Decrease games per set"
                :disabled="customFormatForm.gamesPerSet <= 1"
                @click="adjustCustomNumber('gamesPerSet', -1, 1, 9)"
              >
                −
              </button>
              <strong>{{ customFormatForm.gamesPerSet }}</strong>
              <button
                type="button"
                aria-label="Increase games per set"
                :disabled="customFormatForm.gamesPerSet >= 9"
                @click="adjustCustomNumber('gamesPerSet', 1, 1, 9)"
              >
                +
              </button>
            </div>
          </div>

          <div v-if="customFormatForm.mode === 'sets'" class="custom-setting-row">
            <span
              ><strong>Play tie-breaks</strong><small>Recommended for a clear finish.</small></span
            >
            <button
              type="button"
              class="setting-toggle"
              :class="{ 'setting-toggle--active': playCustomTieBreaks }"
              :aria-pressed="playCustomTieBreaks"
              :aria-label="`Play tie-breaks: ${playCustomTieBreaks ? 'on' : 'off'}`"
              @click="setCustomTieBreaks(!playCustomTieBreaks)"
            >
              <span>{{ playCustomTieBreaks ? 'On' : 'Off' }}</span
              ><i aria-hidden="true"></i>
            </button>
          </div>

          <div v-if="playCustomTieBreaks" class="custom-disclosure">
            <button
              type="button"
              class="custom-disclosure__button"
              :aria-expanded="showTieBreakDetails"
              @click="showTieBreakDetails = !showTieBreakDetails"
            >
              <span
                ><strong>Customize tie-break</strong
                ><small>The standard points are already set.</small></span
              ><i :class="{ 'is-open': showTieBreakDetails }" aria-hidden="true">⌄</i>
            </button>
            <Transition name="soft-slide">
              <div v-if="showTieBreakDetails" class="custom-disclosure__body">
                <div v-if="customFormatForm.mode === 'sets'" class="custom-setting-row">
                  <span><strong>Start at</strong><small>When games reach this score.</small></span>
                  <div class="custom-stepper" aria-label="Tie-break trigger game">
                    <button
                      type="button"
                      aria-label="Decrease tie-break trigger"
                      :disabled="customFormatForm.tieBreakAt <= 1"
                      @click="adjustCustomNumber('tieBreakAt', -1, 1, customFormatForm.gamesPerSet)"
                    >
                      −
                    </button>
                    <strong
                      >{{ customFormatForm.tieBreakAt }}–{{ customFormatForm.tieBreakAt }}</strong
                    >
                    <button
                      type="button"
                      aria-label="Increase tie-break trigger"
                      :disabled="customFormatForm.tieBreakAt >= customFormatForm.gamesPerSet"
                      @click="adjustCustomNumber('tieBreakAt', 1, 1, customFormatForm.gamesPerSet)"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div class="custom-setting-row">
                  <span
                    ><strong>Points to win</strong><small>Always win by two points.</small></span
                  >
                  <div class="custom-stepper" aria-label="Tie-break points">
                    <button
                      type="button"
                      aria-label="Decrease tie-break points"
                      :disabled="customFormatForm.tieBreakPoints <= 1"
                      @click="adjustCustomNumber('tieBreakPoints', -1, 1, 21)"
                    >
                      −
                    </button>
                    <strong>{{ customFormatForm.tieBreakPoints }}</strong>
                    <button
                      type="button"
                      aria-label="Increase tie-break points"
                      :disabled="customFormatForm.tieBreakPoints >= 21"
                      @click="adjustCustomNumber('tieBreakPoints', 1, 1, 21)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <div class="custom-setting-row">
            <span
              ><strong>Save for later</strong
              ><small>Add this setup to your format choices.</small></span
            >
            <button
              type="button"
              class="setting-toggle"
              :class="{ 'setting-toggle--active': customFormatForm.saveForLater }"
              :aria-pressed="customFormatForm.saveForLater"
              :aria-label="`Save format for later: ${customFormatForm.saveForLater ? 'on' : 'off'}`"
              @click="customFormatForm.saveForLater = !customFormatForm.saveForLater"
            >
              <span>{{ customFormatForm.saveForLater ? 'On' : 'Off' }}</span
              ><i aria-hidden="true"></i>
            </button>
          </div>
          <Transition name="soft-slide">
            <label v-if="customFormatForm.saveForLater" class="custom-format-name">
              <span>Name this format</span>
              <input
                v-model="customFormatForm.name"
                type="text"
                maxlength="40"
                placeholder="e.g. Sunday quick match"
              />
            </label>
          </Transition>
          <p v-if="customFormatError" class="friendly-flow__notice" role="alert">
            {{ customFormatError }}
          </p>
          <button type="submit" class="button-primary friendly-flow__continue">
            <FlowIcon name="check" /><span>Use this format</span>
          </button>
        </form>
      </section>

      <section
        v-if="step === 'scheduled'"
        class="friendly-flow__screen"
        aria-labelledby="scheduled-title"
      >
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">
            {{ isLadder ? 'Challenge sent' : 'Invitation sent' }}
          </p>
          <h2 id="scheduled-title">
            {{ isLadder ? 'Your Ladder challenge is waiting.' : 'Your match is scheduled.' }}
          </h2>
          <p>
            {{ opponentName }} will receive an invitation{{
              hasScheduleDetails ? ` for ${formattedSchedule}` : ''
            }}.
          </p>
        </div>
        <div class="status-block status-block--confirmation">
          <span>Match status</span><strong>Waiting for acceptance</strong
          ><small>{{
            isLadder
              ? `They have ${activeLadderConfig.responseHours} hours to respond. Rankings move only after both players confirm the result.`
              : 'You can change the details or cancel the invitation before it is accepted.'
          }}</small>
        </div>
        <button
          type="button"
          class="button-primary friendly-flow__continue friendly-flow__continue--left"
          @click="router.push({ name: 'Dashboard' })"
        >
          <FlowIcon name="home" /><span>Back to dashboard</span>
        </button>
      </section>

      <CompletedMatchResult
        v-if="step === 'result' && completedResult"
        :result="completedResult"
        :current-player-id="currentIdentity.id"
        @done="finishMatch"
        @report-issue="reportCompletedResultIssue"
      />

      <LiveMatchControl
        v-if="step === 'live'"
        :player-a-name="
          friendlyMatchStore.draft.liveState?.players?.playerA || currentIdentity.name
        "
        :player-b-name="friendlyMatchStore.draft.liveState?.players?.playerB || opponentName"
        :player-a-point="friendlyMatchStore.pointLabel('you')"
        :player-b-point="friendlyMatchStore.pointLabel('opponent')"
        :sets-a="friendlyMatchStore.draft.setsA"
        :sets-b="friendlyMatchStore.draft.setsB"
        :games-a="friendlyMatchStore.draft.gamesA"
        :games-b="friendlyMatchStore.draft.gamesB"
        :set-scores="friendlyMatchStore.draft.setScores"
        :current-set-number="Number(friendlyMatchStore.draft.liveState?.currentSetIndex || 0) + 1"
        :match-format-label="friendlyMatchStore.matchFormatLabel"
        :scoring-format-label="friendlyMatchStore.formatLabel"
        :status-text="friendlyMatchStore.statusText"
        :current-server="friendlyMatchStore.draft.liveState?.currentServer || 'playerA'"
        :points-played="Number(friendlyMatchStore.draft.liveState?.pointsPlayed || 0)"
        :started-at="friendlyMatchStore.draft.startedAt"
        :can-score="canScoreLiveMatch"
        :can-undo="friendlyMatchStore.canUndo"
        :in-tie-break="Boolean(friendlyMatchStore.draft.liveState?.currentGame?.inTieBreak)"
        :is-match-tie-break="
          Boolean(friendlyMatchStore.draft.liveState?.currentGame?.isMatchTieBreak)
        "
        :standalone-tie-break="friendlyMatchStore.draft.liveState?.config?.mode === 'tiebreak'"
        :finished="friendlyMatchStore.draft.over"
        :announcement="liveAnnouncement"
        :announcements-enabled="voiceAnnouncementsEnabled"
        :announcements-supported="voiceAnnouncementsSupported"
        :scoreboard-href="liveScoreboardHref"
        :can-invite-chair-umpire="canManageLiveMatch"
        :chair-umpire-open="chairUmpireOpen"
        :chair-umpire-invitation="chairUmpireInvitation"
        :chair-umpire-candidates="chairUmpireCandidates"
        :chair-umpire-qr-data-url="chairUmpireQrDataUrl"
        :chair-umpire-invite-url="chairUmpireInviteUrl"
        :chair-umpire-current-scorer-id="
          friendlyMatchStore.draft.scorerId
        "
        :chair-umpire-can-handoff-control="
          canManageLiveMatch &&
          chairUmpireInvitation?.status ===
            'accepted'
        "
        :can-emergency-override-match="
          canEmergencyOverrideLiveMatch
        "
        :can-pair-display="canManageLiveMatch"
        :tv-pairing-open="tvPairingOpen"
        :tv-pairing-code="tvPairingCode"
        :tv-pairing-message="tvPairingMessage"
        :tv-pairing-status="
          tvPairingSession?.status || ''
        "
        :tv-pairing-qr-data-url="
          tvPairingQrDataUrl
        "
        :tv-pairing-expires-at="
          Number(
            tvPairingSession?.expiresAt ||
              0
          )
        "
        :tv-display-expires-at="
          Number(
            tvPairingSession
              ?.displayExpiresAt ||
              0
          )
        "
        :last-point-winner="lastPointWinner"
        @point="recordLivePoint"
        @undo="undoLivePoint"
        @set-server="setLiveServer"
        @toggle-announcements="toggleVoiceAnnouncements"
        @open-tv-pairing="openTvPairing"
        @close-tv-pairing="closeTvPairing"
        @cancel-tv-pairing="
          cancelTvPairing
        "
        @revoke-tv-display="
          revokeTvDisplay
        "
        @restart-tv-pairing="
          restartTvPairing
        "
        @open-chair-umpire="openChairUmpire"
        @close-chair-umpire="closeChairUmpire"
        @invite-chair-umpire-member="inviteClubChairUmpire"
        @invite-chair-umpire-guest="inviteGuestChairUmpire"
        @cancel-chair-umpire="removeChairUmpireInvitation"
        @handoff-chair-umpire-control="
          handoffChairUmpireControl
        "
        @reclaim-chair-umpire-control="
          reclaimChairUmpireControl
        "
        @emergency-override-match="
          emergencyTakeMatchControl
        "
      />
    </main>
    <MatchResultModal
      v-if="canRenderCurrentRoute && isLadder && step === 'live'"
      :open="resultModalOpen"
      :winner="friendlyMatchStore.draft.winner"
      :current-player-name="currentIdentity.name"
      :opponent-name="opponentName"
      :score="friendlyMatchStore.scoreSummary"
      :set-scores="friendlyMatchStore.draft.setScores"
      :match-format="friendlyMatchStore.matchFormatLabel"
      :scoring-format="friendlyMatchStore.formatLabel"
      primary-action-label="
    Submit result for confirmation
  "
      @close="closeLadderResultModal"
      @finish="finishMatch"
    />
  </div>
</template>

<style scoped>
.friendly-flow-route {
  width: 100%;
  min-height: 100%;
}

.friendly-flow {
  width: min(1140px, 100%);
  min-height: 100svh;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 34px) clamp(20px, 3.5vw, 40px) 44px;
  color: var(--color-text);
  font-family: inherit;
}
.friendly-flow--picker {
  padding-bottom: 120px;
}

.friendly-flow--fixed-action {
  padding-bottom: 120px;
}
.friendly-flow__header {
  display: grid;
  width: min(100%, var(--flow-content-width));
  margin-inline: auto;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding-bottom: 18px;
  border-bottom: var(--app-hairline);
}
.friendly-flow__header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
  line-height: 1.3;
}
.friendly-flow__back {
  width: 44px;
  height: 44px;
  padding: 0;
  border: var(--app-hairline);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
  color: var(--color-text-soft);
}
.friendly-flow__back svg,
.friendly-live__status button svg,
.opponent-search svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.friendly-flow__step {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.01em;
  opacity: 0.78;
}
.friendly-flow__screen {
  display: grid;
  width: min(100%, var(--flow-content-width));
  margin-inline: auto;
  gap: 22px;
  padding-top: clamp(30px, 7vw, 58px);
}
.friendly-flow__screen > *,
.friendly-flow__intro {
  width: 100%;
}
.friendly-flow__intro {
  max-width: 720px;
  margin-bottom: 18px;
}
.friendly-flow__eyebrow,
.friendly-flow__intro h2,
.friendly-flow__intro > p:last-child {
  margin: 0;
}
.friendly-flow__eyebrow {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.82;
}
.friendly-flow__intro h2 {
  max-width: 760px;
  margin-top: 7px;
  color: var(--color-text-soft);
  font-size: clamp(20px, 4vw, 26px);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
  line-height: 1.2;
}
.friendly-flow__intro > p:last-child:not(.friendly-flow__eyebrow) {
  max-width: 68ch;
  margin-top: 10px;
  color: var(--color-muted);
  font-size: 14px;
  font-weight: var(--font-weight-regular);
  line-height: 1.65;
}
.friendly-flow__notice,
.eligibility-context {
  margin: 0;
  padding: 13px 15px;
  border: 0;
  border-radius: var(--app-inner-radius);
  background: #fff7e6;
  box-shadow: 0 7px 20px rgba(87, 61, 8, 0.045);
  color: #725413;
  font-size: 12.5px;
  font-weight: var(--font-weight-medium);
  line-height: 1.55;
}
.eligibility-context {
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
}
.friendly-flow__notice--action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 14px;
}
.friendly-flow__notice-link {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  color: inherit;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 38%, transparent);
  text-underline-offset: 3px;
}
.friendly-flow__notice-link .flow-icon {
  width: 15px;
  height: 15px;
}
.friendly-flow__choices {
  display: grid;
  gap: 12px;
}
.choice-card,
.format-card,
.opponent-row {
  border: var(--app-hairline);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
  color: var(--color-text-soft);
  text-align: left;
  transition:
    transform 180ms var(--motion-curve),
    box-shadow 180ms var(--motion-curve),
    border-color 180ms ease;
}
.choice-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  min-height: 90px;
  align-items: center;
  column-gap: 15px;
  padding: 18px;
  border-radius: var(--app-card-radius);
}
.choice-card > span:not(.flow-choice-icon):not(.choice-card__arrow) {
  min-width: 0;
}
.flow-choice-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 13px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
}
.flow-choice-icon .flow-icon {
  width: 22px;
  height: 22px;
}
.choice-card--muted .flow-choice-icon {
  color: var(--color-muted);
}
.choice-card--friendly {
  background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-surface));
}
.choice-card--muted {
  opacity: 0.58;
}
.choice-card strong,
.choice-card small,
.format-card strong,
.format-card small {
  display: block;
}
.choice-card strong,
.format-card strong {
  font-size: 14.5px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.008em;
  line-height: 1.35;
}
.choice-card small,
.format-card small {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 1.55;
}
.choice-card__arrow {
  color: var(--color-primary-strong);
  font-size: 22px;
  opacity: 0.68;
}
.choice-card:hover,
.format-card:hover,
.opponent-row:hover {
  transform: translateY(-1px);
  border-color: var(--color-border-strong);
  box-shadow: var(--flow-shadow-hover);
}
.friendly-flow input::placeholder,
.friendly-flow textarea::placeholder {
  color: var(--color-muted);
  opacity: 0.62;
}
.friendly-flow__choices--formats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.format-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  grid-template-rows: auto auto;
  min-height: 160px;
  align-items: center;
  align-content: center;
  column-gap: 16px;
  row-gap: 4px;
  padding: 24px;
  border-radius: var(--app-card-radius);
  text-align: left;
}
.format-card .flow-choice-icon {
  grid-row: 1 / span 2;
  align-self: center;
}
.format-card:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  filter: saturate(0.5);
  box-shadow: 0 6px 18px rgba(15, 34, 24, 0.025);
}
.format-card:disabled strong {
  opacity: 0.52;
}
.format-card:disabled small {
  opacity: 0.42;
}
.format-card:disabled .flow-choice-icon {
  opacity: 0.48;
}
.format-card:disabled:hover {
  transform: none;
  border-color: var(--color-border);
  box-shadow: 0 6px 18px rgba(15, 34, 24, 0.025);
}
.format-card strong,
.format-card small {
  grid-column: 2;
  margin-top: 0;
}
.match-format-list {
  width: 100%;
  max-width: none;
}
.match-format-choice--selected {
  border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-surface));
}
.match-format-choice--selected .choice-card__arrow {
  font-size: 15px;
  opacity: 1;
}
.opponent-search {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 0 14px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  color: var(--color-muted);
  box-shadow: 0 7px 20px rgba(15, 34, 24, 0.035);
}
.opponent-search input {
  width: 100%;
  min-height: 48px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--color-text);
}
.opponent-list {
  display: grid;
  gap: 9px;
}
.opponent-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 13px;
  min-height: 72px;
  padding: 11px 14px;
  border-radius: var(--app-card-radius);
}
.opponent-row--selected {
  border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-surface));
}
.opponent-row__avatar {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 9%, var(--color-surface));
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.opponent-row__identity {
  display: grid;
  min-width: 0;
}
.opponent-row__identity strong {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}
.opponent-row__identity small {
  color: var(--color-muted);
  font-size: 11.5px;
  font-weight: var(--font-weight-regular);
  line-height: 1.45;
}
.opponent-row__check {
  color: var(--color-primary-strong);
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  text-align: center;
}
.opponent-empty {
  display: grid;
  justify-items: center;
  gap: 5px;
  min-height: 150px;
  align-content: center;
  padding: 24px;
  text-align: center;
}
.opponent-empty strong {
  font-size: 15px;
  font-weight: var(--font-weight-semibold);
}
.opponent-empty span {
  color: var(--color-muted);
  font-size: 12.5px;
  font-weight: var(--font-weight-regular);
}
.friendly-flow .button-primary,
.friendly-flow .button-secondary,
.simulate-join {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: var(--font-weight-semibold);
}
.friendly-flow .button-primary .flow-icon,
.friendly-flow .button-secondary .flow-icon,
.simulate-join .flow-icon {
  width: 18px;
  height: 18px;
}
.friendly-flow__continue {
  width: min(220px, 100%);
  min-height: 48px;
  justify-self: end;
}
.friendly-flow__continue--left {
  justify-self: start;
}
.friendly-flow__continue:disabled {
  opacity: 0.4;
}
.selection-footer {
  position: fixed;
  z-index: 35;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  width: 100%;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 13px max(16px, calc((100vw - 1060px) / 2));
  transform: none;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  background: #14271b;
  color: #fff;
  box-shadow: 0 -14px 38px rgba(9, 24, 15, 0.16);
  animation: footerArrive 220ms var(--motion-curve) both;
}
.selection-footer > div {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.selection-footer p {
  display: grid;
  margin: 0;
}
.selection-footer p strong {
  color: #fff;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}
.selection-footer p small {
  color: rgba(255, 255, 255, 0.66);
  font-size: 10px;
  font-weight: var(--font-weight-regular);
}
.selection-footer .opponent-row__avatar {
  background: rgba(255, 255, 255, 0.11);
  color: #c9f5d5;
}
.selection-footer button {
  min-width: 150px;
  box-shadow: 0 9px 24px rgba(0, 0, 0, 0.2);
}
.schedule-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.schedule-fields label {
  display: grid;
  gap: 7px;
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.schedule-fields label small {
  color: var(--color-muted);
  font-weight: var(--font-weight-regular);
}
.schedule-fields input {
  width: 100%;
  min-height: 50px;
  border: var(--app-hairline);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  padding: 0 13px;
  color: var(--color-text);
  box-shadow: 0 7px 20px rgba(15, 34, 24, 0.035);
}
.custom-format-form {
  display: grid;
  width: 100%;
  max-width: none;
  gap: 18px;
}
.custom-format-summary {
  display: grid;
  gap: 7px;
  padding: 16px 18px;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 8px 22px rgba(15, 34, 24, 0.035);
}
.custom-format-summary span,
.custom-format-section__head small,
.custom-setting-row small,
.custom-disclosure__button small {
  color: var(--color-muted);
  font-size: 11px;
}
.custom-format-summary span {
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.custom-format-summary strong {
  color: var(--color-text-soft);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  line-height: 1.45;
}
.custom-format-section {
  display: grid;
  gap: 14px;
  padding-top: 4px;
}
.custom-format-section__head,
.custom-format-section__head strong,
.custom-format-section__head small,
.custom-setting-row > span,
.custom-disclosure__button > span {
  display: grid;
  gap: 4px;
}
.custom-format-section__head strong,
.custom-setting-row > span > strong,
.custom-disclosure__button strong {
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}
.custom-format-section__head small,
.custom-setting-row small,
.custom-disclosure__button small {
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}
.custom-style-chips {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.custom-style-chip {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  min-height: 84px;
  align-content: center;
  column-gap: 14px;
  row-gap: 4px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  color: var(--color-text-soft);
  text-align: left;
  padding: 16px 17px;
  box-shadow: 0 8px 22px rgba(15, 34, 24, 0.035);
  transition:
    transform 180ms var(--motion-curve),
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}
.custom-style-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 11px 26px rgba(15, 34, 24, 0.055);
}
.custom-style-chip--selected {
  border-color: rgba(35, 183, 88, 0.34);
  background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-surface));
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.045);
}
.custom-style-chip .flow-choice-icon {
  grid-row: 1 / span 2;
  align-self: center;
  margin-right: 0;
}
.custom-style-chip strong {
  font-size: 12.5px;
  font-weight: var(--font-weight-semibold);
}
.custom-style-chip small {
  color: var(--color-muted);
  font-size: 10.5px;
  font-weight: var(--font-weight-regular);
}
.custom-setting-row {
  display: flex;
  min-height: 74px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 18px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 7px 20px rgba(15, 34, 24, 0.025);
}
.custom-stepper {
  display: grid;
  grid-template-columns: 40px minmax(48px, auto) 40px;
  align-items: center;
  overflow: hidden;
  border: var(--app-hairline);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 6px 16px rgba(15, 34, 24, 0.035);
}
.custom-stepper button {
  min-height: 40px;
  border: 0;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
}
.custom-stepper button:hover:not(:disabled) {
  background: var(--color-primary-soft);
}
.custom-stepper button:disabled {
  color: var(--color-muted);
  opacity: 0.35;
}
.custom-stepper > strong {
  color: var(--color-text);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-align: center;
}
.setting-toggle {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 10.5px;
  font-weight: var(--font-weight-semibold);
}
.setting-toggle i {
  position: relative;
  display: block;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(105, 120, 111, 0.22);
  transition: background 180ms ease;
}
.setting-toggle i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 7px rgba(15, 34, 24, 0.18);
  transition: transform 180ms var(--motion-curve);
}
.setting-toggle--active {
  color: var(--color-primary-strong);
}
.setting-toggle--active i {
  background: var(--color-primary);
}
.setting-toggle--active i::after {
  transform: translateX(16px);
}
.custom-disclosure {
  overflow: hidden;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 8px 22px rgba(15, 34, 24, 0.03);
}
.custom-disclosure__button {
  display: flex;
  width: 100%;
  min-height: 70px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 0;
  background: transparent;
  padding: 15px 18px;
  text-align: left;
}
.custom-disclosure__button > i {
  color: var(--color-muted);
  font-size: 16px;
  font-style: normal;
  transition: transform 180ms var(--motion-curve);
}
.custom-disclosure__button > i.is-open {
  transform: rotate(180deg);
}
.custom-disclosure__body {
  display: grid;
  gap: 1px;
  padding: 1px;
}
.custom-disclosure__body .custom-setting-row {
  border-radius: 0;
  background: var(--color-surface);
  box-shadow: none;
}
.custom-format-name {
  display: grid;
  gap: 9px;
  padding-top: 2px;
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.custom-format-name input {
  width: 100%;
  min-height: 50px;
  border: var(--app-hairline);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  padding: 0 13px;
  color: var(--color-text);
  box-shadow: 0 7px 20px rgba(15, 34, 24, 0.035);
}
.soft-slide-enter-active,
.soft-slide-leave-active {
  overflow: hidden;
  transition:
    opacity 180ms ease,
    transform 180ms var(--motion-curve),
    max-height 220ms ease;
}
.soft-slide-enter-from,
.soft-slide-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-5px);
}
.soft-slide-enter-to,
.soft-slide-leave-from {
  max-height: 220px;
}
.friendly-flow__screen--invitation {
  width: 100%;
  max-width: none;
  margin-inline: 0;
}
.invitation-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 16px;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 8px 22px rgba(15, 34, 24, 0.035);
}
.invitation-action-row > div {
  display: grid;
}
.invitation-action-row strong {
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}
.invitation-action-row small {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-regular);
}
.qr-panel {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  padding: 22px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: 0 10px 28px rgba(15, 34, 24, 0.04);
}
.qr-panel--single {
  width: 100%;
  justify-self: stretch;
}
.qr-panel img,
.qr-panel__placeholder {
  display: block;
  width: min(248px, 100%);
  aspect-ratio: 1;
  border-radius: 8px;
}
.qr-panel__placeholder {
  background: var(--color-surface-soft);
}
.qr-panel p {
  margin: 0;
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.copy-link-action {
  width: min(248px, 100%);
}
.join-link {
  width: 100%;
  overflow: hidden;
  color: var(--color-muted);
  font-size: 9px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.simulate-join {
  justify-self: center;
  min-height: 38px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  text-decoration: underline;
  text-underline-offset: 4px;
}
.join-notification {
  position: fixed;
  z-index: 60;
  top: 20px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 16px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #173f26;
  color: white;
  box-shadow: 0 14px 38px rgba(15, 34, 24, 0.18);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  animation: noticeArrive 220ms var(--motion-curve) both;
}
.join-notification span {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
}
.join-summary,
.review-list {
  display: grid;
  overflow: hidden;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: 0 10px 28px rgba(15, 34, 24, 0.04);
}
.join-summary {
  width: 100%;
  gap: 5px;
  max-width: none;
  padding: 20px;
}
.join-summary span,
.review-row > span,
.review-row > label,
.status-block span {
  color: var(--color-muted);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.join-summary strong,
.status-block strong {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}
.join-summary small,
.status-block small {
  color: var(--color-muted);
  font-size: 11.5px;
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}
.external-join {
  width: 100%;
  max-width: none;
}
.review-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 66px;
  padding: 12px 18px;
  border-bottom: var(--app-hairline);
}
.review-row:last-child {
  border-bottom: 0;
}
.review-row > strong {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  line-height: 1.5;
}
.review-row > strong small {
  display: inline-block;
  margin-left: 7px;
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
}
.segmented-options {
  display: flex;
  gap: 7px;
}
.segmented-options button {
  min-height: 38px;
  padding: 8px 14px;
  border: var(--app-hairline);
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.segmented-options button.active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface));
  color: var(--color-primary-strong);
}
.setup-default-note {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 9px 18px 11px 176px;
  color: var(--color-muted);
  font-size: 11px;
}
.setup-default-note small {
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.status-block {
  display: grid;
  gap: 4px;
}

.friendly-ready {
  display: grid;
  gap: 18px;
  margin-top: 20px;
}

.friendly-ready__status {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 18px;
  border: 1px solid #e2e9e4;
  border-radius: 12px;
  background: #f8fbf9;
}

.friendly-ready__check {
  display: grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: #e7f7eb;
  color: #087d19;
  font-size: 14px;
  font-weight: 700;
}

.friendly-ready__status small {
  display: block;
  color: #77857c;
  font-size: 11px;
  font-weight: 650;
}

.friendly-ready__status strong {
  display: block;
  margin-top: 4px;
  color: #172319;
  font-size: 18px;
  font-weight: 680;
  letter-spacing: -0.025em;
}

.friendly-ready__status strong span {
  margin: 0 5px;
  color: #89958e;
  font-size: 12px;
  font-weight: 550;
}

.friendly-ready__status p {
  max-width: 520px;
  margin: 6px 0 0;
  color: #748078;
  font-size: 12px;
  line-height: 1.55;
}

.friendly-ready__setup {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid #e4eae6;
  border-radius: 12px;
  background: #fff;
}

.friendly-ready__setup > div {
  padding: 15px 17px;
}

.friendly-ready__setup > div + div {
  border-left: 1px solid #e8ede9;
}

.friendly-ready__setup span,
.friendly-ready__setup strong {
  display: block;
}

.friendly-ready__setup span {
  color: #8b9690;
  font-size: 10px;
}

.friendly-ready__setup strong {
  margin-top: 4px;
  color: #28372f;
  font-size: 12px;
  font-weight: 650;
}

@media (max-width: 560px) {
  .friendly-ready__setup {
    grid-template-columns: 1fr;
  }

  .friendly-ready__setup > div + div {
    border-top: 1px solid #e8ede9;
    border-left: 0;
  }
}
.status-block--confirmation {
  width: 100%;
  max-width: none;
  padding: 20px;
  border: 0;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
}
.friendly-live {
  display: grid;
  gap: 18px;
  padding-top: 18px;
}

.friendly-live__foundation-tools {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 11px 13px;
  border: 1px solid rgba(24, 63, 41, 0.1);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
}

.friendly-live__foundation-tools > div {
  display: grid;
  gap: 3px;
}

.friendly-live__foundation-tools span {
  color: var(--color-muted);
  font-size: 10px;
}

.friendly-live__foundation-tools strong {
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.friendly-live__foundation-tools button {
  min-height: 38px;
}

.friendly-live__authority-note {
  margin: 0;
  padding: 11px 13px;
  border-radius: var(--app-inner-radius);
  background: #f5f7f5;
  color: var(--color-text-soft);
  font-size: 11px;
  line-height: 1.5;
}

.friendly-live__player:disabled {
  cursor: default;
  opacity: 0.58;
}
.friendly-live__title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 0 4px;
}
.friendly-live__title-row h1 {
  margin: 5px 0 0;
  font-size: clamp(24px, 5vw, 32px);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
  line-height: 1.2;
}
.friendly-live__live {
  padding: 5px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.friendly-live__live--finished {
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
}
.friendly-live__scoreline {
  display: flex;
  gap: 8px;
}
.friendly-live__scoreline > div {
  display: grid;
  min-width: 104px;
  gap: 2px;
  padding: 10px 13px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
}
.friendly-live__scoreline span {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.friendly-live__scoreline strong {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}
.friendly-live__scoreline--finished > div:last-child {
  min-width: min(280px, 55vw);
}
.friendly-live__status {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 42px;
  align-items: center;
  gap: 10px;
  min-height: 60px;
  padding: 9px 10px 9px 16px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
}
.friendly-live__status strong {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}
.friendly-live__status > span {
  padding: 4px 7px;
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
}
.friendly-live__status button {
  width: 42px;
  height: 42px;
  min-height: 42px;
  padding: 0;
  border-color: transparent;
  background: transparent;
  color: var(--color-text-soft);
}
.friendly-live__players {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.friendly-live__player {
  display: grid;
  min-height: 230px;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 24px 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: 0 12px 30px rgba(15, 34, 24, 0.045);
  color: var(--color-text-soft);
}
.friendly-live__player--you {
  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
}
.friendly-live__player > span {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}
.friendly-live__player > strong {
  font-size: clamp(44px, 10vw, 68px);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.035em;
  line-height: 1;
}
.friendly-live__player > small {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-regular);
  opacity: 0.68;
}
.friendly-live__count {
  margin: -5px 0 0;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  text-align: center;
}
.friendly-live__finished {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 18px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
}
.friendly-live__finished-copy,
.friendly-live__finished-facts span {
  display: grid;
  gap: 3px;
}
.friendly-live__finished-copy > span,
.friendly-live__finished-facts small {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.friendly-live__finished-copy > strong {
  font-size: 17px;
  font-weight: var(--font-weight-semibold);
}
.friendly-live__finished-copy > small {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-regular);
}
.friendly-live__finished-facts {
  display: flex;
  gap: 18px;
}
.friendly-live__finished-facts strong {
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}
.friendly-live__finished-undo {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 12px;
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.friendly-live__finished-undo svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
.friendly-live__result {
  display: inline-flex;
  min-width: 220px;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  justify-self: center;
  gap: 9px;
}
.friendly-live__result .flow-icon {
  width: 18px;
  height: 18px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes footerArrive {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes noticeArrive {
  from {
    opacity: 0;
    transform: translate(-50%, -8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
@media (max-width: 700px) {
  .schedule-fields {
    grid-template-columns: 1fr;
  }
  .review-row {
    grid-template-columns: 1fr;
    gap: 7px;
  }
  .custom-style-chips {
    grid-template-columns: 1fr;
  }
  .custom-style-chip {
    min-height: 70px;
    padding: 14px 15px;
  }
  .custom-setting-row {
    min-height: 68px;
    padding: 14px 15px;
  }
  .setup-default-note {
    padding-left: 18px;
  }
  .invitation-action-row {
    align-items: stretch;
    flex-direction: column;
  }
  .friendly-live__scoreline {
    overflow-x: auto;
  }
  .selection-footer {
    bottom: 0;
  }
  .selection-footer button {
    min-width: 120px;
  }
}
@media (max-width: 560px) {
  .friendly-flow {
    padding: 12px 16px 34px;
  }
  .friendly-flow--picker {
    padding-bottom: 116px;
  }
  .friendly-flow__choices--formats,
  .friendly-live__players {
    grid-template-columns: 1fr;
  }
  .format-card {
    min-height: 118px;
  }
  .friendly-flow__continue {
    width: 100%;
  }
  .friendly-live__player {
    min-height: 170px;
  }
  .friendly-live__status {
    grid-template-columns: minmax(0, 1fr) 42px;
  }
  .friendly-live__finished {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .friendly-live__finished-facts {
    justify-content: space-between;
  }
  .friendly-live__finished-undo {
    justify-content: center;
    width: 100%;
  }
  .friendly-live__status > span {
    display: none;
  }
  .selection-footer {
    width: 100%;
    min-height: 72px;
    padding: 11px 16px;
  }
  .selection-footer .opponent-row__avatar {
    display: grid;
  }
  .join-notification {
    top: 12px;
    width: max-content;
    max-width: calc(100% - 24px);
  }
}
</style>
