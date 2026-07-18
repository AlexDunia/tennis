<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { usePlayerStore } from '../stores/player'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { useNotificationStore } from '../stores/notification'
import { verifyLadderCreationAccess } from '../services/LadderAccessService'
import {
  ACTIVE_LADDER_CHALLENGE_STATUSES,
  LADDER_CONFIG,
  deadlineFromNow,
  isEligibleLadderOpponent,
  ladderMatchConfig,
  ladderMovementFor,
  ladderWindowFor,
} from '../config/ladder'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import MatchResultModal from '../components/friendly/MatchResultModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
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

const step = computed(() => String(route.meta.friendlyStep || 'type'))
const isLadder = computed(() => friendlyMatchStore.draft.matchType === 'ladder')
const isFriendly = computed(() => friendlyMatchStore.draft.matchType === 'friendly')
const isPlayNow = computed(() => friendlyMatchStore.draft.timing === 'now')
const selectedOpponentId = computed(() => friendlyMatchStore.draft.opponent?.id || '')
const opponentName = computed(() => friendlyMatchStore.draft.opponent?.name || 'Opponent')
const currentIdentity = computed(() => ({
  id: authStore.user?.playerId || playerStore.currentPlayer?.id || '',
  name: playerStore.currentPlayer?.name || authStore.user?.name || 'Club player',
  rank: playerStore.currentPlayer?.rank || null,
  category: playerStore.currentPlayer?.category || 'Club Member',
}))
const ladderWindow = computed(() => ladderWindowFor(currentIdentity.value))
const activeLadderChallenges = computed(() =>
  challengeStore.challenges.filter(
    (challenge) =>
      ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
      [challenge.challengerId, challenge.defenderId].includes(currentIdentity.value.id),
  ),
)
const hasActiveChallengeBlock = computed(
  () => activeLadderChallenges.value.length >= LADDER_CONFIG.maxActiveChallenges,
)
const ladderAccessMessage = computed(() => {
  if (LADDER_CONFIG.seasonStatus !== 'active')
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
const activeInvitation = computed(() => friendlyMatchStore.activeInvitation)
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
    if (isPlayNow.value)
      return (
        {
          type: '1 of 5',
          timing: '2 of 5',
          join: '3 of 5',
          clubOpponent: '3 of 5',
          format: '4 of 5',
        }[step.value] || ''
      )
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
  if (isPlayNow.value)
    return (
      {
        type: '1 of 5',
        timing: '2 of 5',
        join: '3 of 5',
        clubOpponent: '3 of 5',
        scoring: '4 of 5',
        format: '5 of 5',
        customFormat: '5 of 5',
      }[step.value] || ''
    )
  return (
    {
      type: '1 of 6',
      timing: '2 of 6',
      clubOpponent: '3 of 6',
      schedule: '4 of 6',
      scoring: '5 of 6',
      format: '6 of 6',
      customFormat: '6 of 6',
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
  FriendlyMatchLive: '/ladder-match/live',
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
  const routeName =
    {
      type: 'Dashboard',
      timing: 'FriendlyMatchType',
      join: 'FriendlyMatchTiming',
      clubOpponent: isPlayNow.value ? 'FriendlyMatchJoin' : 'FriendlyMatchTiming',
      schedule: 'FriendlyMatchClubOpponent',
      opponent: 'FriendlyMatchTiming',
      scoring: isPlayNow.value ? 'FriendlyMatchJoin' : 'FriendlyMatchSchedule',
      format: isLadder.value
        ? isPlayNow.value
          ? 'FriendlyMatchJoin'
          : 'FriendlyMatchSchedule'
        : 'FriendlyMatchScoring',
      customFormat: 'FriendlyMatchFormat',
      scheduled: 'Dashboard',
      externalJoin: 'Dashboard',
      live: 'FriendlyMatchFormat',
    }[step.value] || 'Dashboard'
  return routeName.startsWith('FriendlyMatch') ? flowLocation(routeName) : { name: routeName }
})

function guardStep() {
  if (step.value === 'externalJoin') return
  if (isFriendly.value && friendlyMatchStore.draft.ownerId && !canManageDraft.value) {
    router.replace({ name: 'Dashboard' })
    return
  }
  if (step.value === 'timing' && !friendlyMatchStore.draft.matchType)
    router.replace(flowLocation('FriendlyMatchType'))
  else if (step.value === 'opponent') router.replace(flowLocation('FriendlyMatchClubOpponent'))
  else if (step.value === 'clubOpponent' && !friendlyMatchStore.draft.timing)
    router.replace(flowLocation('FriendlyMatchTiming'))
  else if (step.value === 'schedule' && (isPlayNow.value || !friendlyMatchStore.draft.opponent))
    router.replace(flowLocation('FriendlyMatchClubOpponent'))
  else if (step.value === 'join' && (!isPlayNow.value || !friendlyMatchStore.draft.matchId))
    router.replace(flowLocation('FriendlyMatchTiming'))
  else if (step.value === 'scoring' && isLadder.value)
    router.replace(flowLocation('FriendlyMatchFormat'))
  else if (step.value === 'scoring' && isPlayNow.value && !playNowReady.value)
    router.replace(flowLocation('FriendlyMatchJoin'))
  else if (step.value === 'scoring' && !isPlayNow.value && !friendlyMatchStore.draft.opponent)
    router.replace(flowLocation('FriendlyMatchClubOpponent'))
  else if (step.value === 'format' && isLadder.value && !friendlyMatchStore.draft.opponent)
    router.replace(flowLocation('FriendlyMatchClubOpponent'))
  else if (step.value === 'format' && isLadder.value && isPlayNow.value && !playNowReady.value)
    router.replace(flowLocation('FriendlyMatchJoin'))
  else if (step.value === 'format' && isFriendly.value && isPlayNow.value && !playNowReady.value)
    router.replace(flowLocation('FriendlyMatchJoin'))
  else if (
    step.value === 'format' &&
    isFriendly.value &&
    !isPlayNow.value &&
    !friendlyMatchStore.draft.opponent
  )
    router.replace(flowLocation('FriendlyMatchClubOpponent'))
  else if (step.value === 'format' && isFriendly.value && !friendlyMatchStore.draft.format)
    router.replace(flowLocation('FriendlyMatchScoring'))
  else if (step.value === 'customFormat' && !isFriendly.value)
    router.replace(flowLocation('FriendlyMatchType'))
  else if (step.value === 'customFormat' && isPlayNow.value && !playNowReady.value)
    router.replace(flowLocation('FriendlyMatchJoin'))
  else if (step.value === 'customFormat' && !isPlayNow.value && !friendlyMatchStore.draft.opponent)
    router.replace(flowLocation('FriendlyMatchClubOpponent'))
  else if (step.value === 'customFormat' && !friendlyMatchStore.draft.format)
    router.replace(flowLocation('FriendlyMatchScoring'))
  else if (
    step.value === 'live' &&
    (!friendlyMatchStore.draft.format || !friendlyMatchStore.draft.opponent)
  )
    router.replace(flowLocation('FriendlyMatchFormat'))
}

function goBack() {
  router.push(backRoute.value)
}
function chooseMatchType(type) {
  inlineNote.value = ''
  friendlyMatchStore.chooseMatchType(type)
  router.push(flowLocation('FriendlyMatchTiming'))
}
function showTournamentNotice() {
  inlineNote.value =
    'No tournament is running at Emerald Courts right now. You can still create a friendly match or ladder challenge.'
}
async function chooseTiming(timing) {
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
    friendlyMatchStore.applyLadderRules()
  }
  friendlyMatchStore.chooseTiming(timing, currentIdentity.value)
  if (timing === 'now') {
    await router.push(flowLocation('FriendlyMatchJoin'))
    await generateQrCode()
  } else router.push(flowLocation('FriendlyMatchClubOpponent'))
}
function chooseOpponent(opponent) {
  friendlyMatchStore.chooseOpponent(opponent)
}
function openClubOpponents() {
  friendlyMatchStore.chooseOpponent(null)
  router.push(flowLocation('FriendlyMatchClubOpponent'))
}
function continueWithClubOpponent() {
  if (!friendlyMatchStore.draft.opponent) return
  if (isPlayNow.value) {
    const joined = friendlyMatchStore.addOpponentToPlayNow(friendlyMatchStore.draft.opponent)
    if (joined) announceJoined(joined.name)
    else
      inlineNote.value = isLadder.value
        ? 'That player is outside your eligible Ladder challenge window.'
        : 'That player could not be added to this match.'
  } else router.push(flowLocation('FriendlyMatchSchedule'))
}
function continueFromSchedule() {
  router.push(flowLocation(isLadder.value ? 'FriendlyMatchFormat' : 'FriendlyMatchScoring'))
}
function chooseFormat(format) {
  friendlyMatchStore.chooseFormat(format)
  if (isLadder.value) {
    friendlyMatchStore.startLiveMatch(currentIdentity.value.id)
    router.push(flowLocation('FriendlyMatchLive'))
  } else if (isFriendly.value) router.push(flowLocation('FriendlyMatchFormat'))
}
function chooseMatchFormat(matchFormat) {
  friendlyMatchStore.chooseMatchFormat(matchFormat)
}
function chooseSavedFormat(format) {
  friendlyMatchStore.selectCustomFormat(format)
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
  if (isLadder.value) {
    inlineNote.value = ''
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
      responseDeadline: deadlineFromNow(LADDER_CONFIG.responseHours),
      playDeadline: deadlineFromNow(LADDER_CONFIG.completionDays, 'days'),
      preMatchPositions: { challenger: challenger.rank, defender: defender.rank },
      ladderConfigSnapshot: { ...LADDER_CONFIG },
      matchConfig: ladderMatchConfig(),
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
      if (friendlyMatchStore.startLiveMatch(currentIdentity.value.id))
        router.push(flowLocation('FriendlyMatchLive'))
      return
    }
    router.push(flowLocation('FriendlyMatchScheduled'))
    return
  }
  if (!friendlyMatchStore.draft.format) friendlyMatchStore.chooseFormat('ad')
  if (isPlayNow.value) {
    if (!playNowReady.value) return
    friendlyMatchStore.startLiveMatch(currentIdentity.value.id)
    router.push(flowLocation('FriendlyMatchLive'))
  } else {
    const invitation = friendlyMatchStore.createScheduledInvitation(currentIdentity.value)
    if (invitation) router.push(flowLocation('FriendlyMatchScheduled'))
  }
}
async function finishMatch() {
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
      sets: friendlyMatchStore.draft.setScores.map((set) => ({ ...set })),
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
    router.push({ name: 'Challenges' })
    return
  }
  const result = friendlyMatchStore.endMatch(currentIdentity.value.id)
  if (!result) return
  resultModalOpen.value = false
  router.push({ name: 'Dashboard' })
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
  const simulated = availableOpponents.value.find(
    (player) => player.id !== currentIdentity.value.id,
  )
  if (!simulated) return
  const joined = friendlyMatchStore.addOpponentToPlayNow(simulated)
  if (joined) announceJoined(joined.name)
}
function announceJoined(name) {
  joinedNotice.value = `${name} joined the match.`
  if (autoRouteTimer) window.clearTimeout(autoRouteTimer)
  autoRouteTimer = window.setTimeout(() => {
    if (step.value === 'join' || step.value === 'clubOpponent')
      router.push(flowLocation(isLadder.value ? 'FriendlyMatchFormat' : 'FriendlyMatchScoring'))
  }, 1100)
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
function joinAsCurrentUser() {
  const result = friendlyMatchStore.joinInvitation(
    String(route.params.token || ''),
    currentIdentity.value,
  )
  joinMessage.value = result.message || ''
  externalInvitation.value = result.invitation || externalInvitation.value
}
function handleStorage(event) {
  if (!event.key || event.key.includes('friendlyMatch')) refreshInvitation()
}
function configureStep() {
  inlineNote.value = ''
  searchQuery.value = ''
  copyStatus.value = ''
  joinedNotice.value = ''
  customFormatError.value = ''
  showTieBreakDetails.value = false
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
    await router.replace(flowLocation('FriendlyMatchTiming'))
  }
  configureStep()
  window.addEventListener('storage', handleStorage)
  invitationTimer = window.setInterval(() => {
    if (['join', 'externalJoin'].includes(step.value)) refreshInvitation()
  }, 1200)
})
onUnmounted(() => {
  window.removeEventListener('storage', handleStorage)
  if (invitationTimer) window.clearInterval(invitationTimer)
  if (autoRouteTimer) window.clearTimeout(autoRouteTimer)
})
watch(step, configureStep)
watch(
  [step, () => friendlyMatchStore.draft.over],
  ([currentStep, matchOver]) => {
    if (currentStep === 'live') resultModalOpen.value = Boolean(matchOver)
    else resultModalOpen.value = false
  },
  { immediate: true },
)
</script>

<template>
  <div class="friendly-flow-route">
    <main class="friendly-flow" :class="{ 'friendly-flow--picker': step === 'clubOpponent' }">
      <div v-if="joinedNotice" class="join-notification" role="status">
        <span aria-hidden="true">✓</span>{{ joinedNotice }}
      </div>
      <header class="friendly-flow__header">
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
            Use a quick QR join when both players are together, or send an invitation for later.
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
              :to="{ name: 'Challenges' }"
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
            <strong>Play now</strong
            ><small>Show a QR code so the opponent can join immediately.</small>
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
                ? 'Choose an eligible Ladder player. Match timing is optional.'
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
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">{{ isLadder ? 'Ladder · Play now' : 'Play now' }}</p>
          <h2 id="join-title">Let your opponent join.</h2>
          <p>
            They scan this code and confirm their identity. The scoreboard stays locked until they
            join.
          </p>
        </div>
        <div class="invitation-action-row">
          <div>
            <strong>{{
              invitationExpired
                ? 'Invitation unavailable'
                : playNowReady
                  ? `${opponentName} joined`
                  : 'Waiting for opponent'
            }}</strong
            ><small>{{
              playNowReady
                ? 'Opening match setup.'
                : 'Keep this screen open while your opponent scans.'
            }}</small>
          </div>
          <button
            v-if="!playNowReady && !invitationExpired"
            type="button"
            class="button-secondary"
            @click="openClubOpponents"
          >
            <FlowIcon name="users" /><span>{{
              isLadder ? 'Add eligible opponent' : 'Add opponent from club'
            }}</span>
          </button>
        </div>
        <div class="qr-panel qr-panel--single">
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
            <FlowIcon name="copy" /><span>Copy match link</span>
          </button>
          <p v-if="copyStatus" role="status">{{ copyStatus }}</p>
          <a class="join-link" :href="joinUrl">{{ joinUrl }}</a>
        </div>
        <button
          v-if="!playNowReady && !invitationExpired"
          type="button"
          class="simulate-join"
          @click="simulatePlayerJoining"
        >
          <FlowIcon name="spark" /><span>Simulate player joining</span>
        </button>
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
            Only active players within {{ LADDER_CONFIG.challengeRangeUp }} positions above you
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
              :to="{ name: 'Challenges' }"
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
        v-if="step === 'clubOpponent' && friendlyMatchStore.draft.opponent"
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
            <p>Select the club default, a shorter format or one of your saved custom rules.</p>
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
            @click="completeReview"
          >
            <FlowIcon :name="isPlayNow ? 'play' : 'send'" />
            <span>{{ isPlayNow ? 'Start match' : 'Send invitation' }}</span>
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
              ><strong>{{ LADDER_CONFIG.matchFormatLabel }} <small>Club rule</small></strong>
            </div>
            <div class="review-row">
              <span>Tie-break</span
              ><strong>{{ LADDER_CONFIG.tieBreakLabel }} <small>Club rule</small></strong>
            </div>
            <div class="review-row">
              <span>Timing</span><strong>{{ isPlayNow ? 'Play now' : formattedSchedule }}</strong>
            </div>
          </div>
          <div class="setup-default-note">
            <FlowIcon name="lock" /><span
              >Respond within {{ LADDER_CONFIG.responseHours }} hours · Play within
              {{ LADDER_CONFIG.completionDays }} days</span
            >
          </div>
          <button
            type="button"
            class="button-primary friendly-flow__continue"
            :disabled="challengeStore.isLoading"
            @click="completeReview"
          >
            <FlowIcon :name="isPlayNow ? 'play' : 'send'" />
            <span>{{
              challengeStore.isLoading
                ? 'Creating challenge…'
                : isPlayNow
                  ? 'Accept and start match'
                  : 'Send challenge'
            }}</span>
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
              ? `They have ${LADDER_CONFIG.responseHours} hours to respond. Rankings move only after both players confirm the result.`
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

      <section v-if="step === 'live'" class="friendly-live" aria-labelledby="live-match-title">
        <div class="friendly-live__title-row">
          <div>
            <p class="friendly-flow__eyebrow">{{ friendlyMatchStore.matchFormatLabel }}</p>
            <h1 id="live-match-title">You vs {{ opponentName }}</h1>
          </div>
          <span
            class="friendly-live__live"
            :class="{ 'friendly-live__live--finished': friendlyMatchStore.draft.over }"
            >{{ friendlyMatchStore.draft.over ? 'Finished' : 'Live' }}</span
          >
        </div>

        <div
          class="friendly-live__scoreline"
          :class="{ 'friendly-live__scoreline--finished': friendlyMatchStore.draft.over }"
        >
          <template v-if="friendlyMatchStore.draft.over">
            <div>
              <span>Sets won</span>
              <strong
                >{{ friendlyMatchStore.draft.setsA }}–{{ friendlyMatchStore.draft.setsB }}</strong
              >
            </div>
            <div>
              <span>Final score</span>
              <strong>{{ friendlyMatchStore.scoreSummary }}</strong>
            </div>
          </template>
          <template v-else>
            <div v-if="friendlyMatchStore.draft.matchFormat !== 'match-tiebreak'">
              <span>Sets</span>
              <strong
                >{{ friendlyMatchStore.draft.setsA }}–{{ friendlyMatchStore.draft.setsB }}</strong
              >
            </div>
            <div v-if="friendlyMatchStore.draft.matchFormat !== 'match-tiebreak'">
              <span
                >Games · Set
                {{ friendlyMatchStore.draft.setsA + friendlyMatchStore.draft.setsB + 1 }}</span
              >
              <strong
                >{{ friendlyMatchStore.draft.gamesA }}–{{ friendlyMatchStore.draft.gamesB }}</strong
              >
            </div>
            <div>
              <span>Points · Current game</span>
              <strong>{{ friendlyMatchStore.currentPointScore }}</strong>
            </div>
          </template>
        </div>

        <div v-if="!friendlyMatchStore.draft.over" class="friendly-live__status">
          <strong>{{ friendlyMatchStore.statusText }}</strong>
          <span>{{
            friendlyMatchStore.draft.matchFormat === 'match-tiebreak'
              ? 'Win by two'
              : friendlyMatchStore.formatLabel
          }}</span>
          <button
            type="button"
            aria-label="Undo last point"
            title="Undo last point"
            :disabled="!friendlyMatchStore.canUndo"
            @click="friendlyMatchStore.undoPoint(currentIdentity.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />
            </svg>
          </button>
        </div>

        <div v-else class="friendly-live__finished" aria-live="polite">
          <div class="friendly-live__finished-copy">
            <span>Match result</span>
            <strong>{{ friendlyMatchStore.statusText }}</strong>
            <small>{{ currentIdentity.name }} vs {{ opponentName }}</small>
          </div>
          <div class="friendly-live__finished-facts">
            <span
              ><small>Final set scores</small
              ><strong>{{ friendlyMatchStore.scoreSummary }}</strong></span
            >
            <span
              ><small>Total points played</small
              ><strong>{{ friendlyMatchStore.draft.pointHistory.length }}</strong></span
            >
          </div>
          <button
            type="button"
            class="friendly-live__finished-undo"
            aria-label="Undo last point"
            title="Undo last point"
            :disabled="!friendlyMatchStore.canUndo"
            @click="friendlyMatchStore.undoPoint(currentIdentity.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />
            </svg>
            <span>Undo last point</span>
          </button>
        </div>

        <div v-if="!friendlyMatchStore.draft.over" class="friendly-live__players">
          <button
            type="button"
            class="friendly-live__player friendly-live__player--you"
            aria-label="Add point for you"
            @click="friendlyMatchStore.recordPoint('you', currentIdentity.id)"
          >
            <span>You</span><strong>{{ friendlyMatchStore.pointLabel('you') }}</strong>
            <small>Tap when you win the rally</small>
          </button>
          <button
            type="button"
            class="friendly-live__player"
            :aria-label="`Add point for ${opponentName}`"
            @click="friendlyMatchStore.recordPoint('opponent', currentIdentity.id)"
          >
            <span>{{ opponentName }}</span>
            <strong>{{ friendlyMatchStore.pointLabel('opponent') }}</strong>
            <small>Tap when {{ opponentName }} wins</small>
          </button>
        </div>

        <p v-if="!friendlyMatchStore.draft.over" class="friendly-live__count">
          Points played: {{ friendlyMatchStore.draft.pointHistory.length }}
        </p>
        <button
          v-if="friendlyMatchStore.draft.over"
          type="button"
          class="button-primary friendly-live__result"
          @click="resultModalOpen = true"
        >
          <FlowIcon name="trophy" /><span>View final result</span>
        </button>
      </section>
    </main>
    <MatchResultModal
      :open="resultModalOpen"
      :winner="friendlyMatchStore.draft.winner"
      :current-player-name="currentIdentity.name"
      :opponent-name="opponentName"
      :score="friendlyMatchStore.scoreSummary"
      :set-scores="friendlyMatchStore.draft.setScores"
      :match-format="friendlyMatchStore.matchFormatLabel"
      :scoring-format="friendlyMatchStore.formatLabel"
      :primary-action-label="
        isLadder ? 'Submit result for confirmation' : 'Save result and return to dashboard'
      "
      @close="resultModalOpen = false"
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
  font-size: clamp(22px, 5vw, 30px);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
  line-height: 1.2;
}
.friendly-flow__intro > p:last-child:not(.friendly-flow__eyebrow) {
  max-width: 68ch;
  margin-top: 10px;
  color: var(--color-muted);
  font-size: 13px;
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
