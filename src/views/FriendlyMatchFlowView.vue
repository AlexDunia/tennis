<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { usePlayerStore } from '../stores/player'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const friendlyMatchStore = useFriendlyMatchStore()
const playerStore = usePlayerStore()
const inlineNote = ref('')
const searchQuery = ref('')
const qrDataUrl = ref('')
const copyStatus = ref('')
const joinMessage = ref('')
const externalInvitation = ref(null)
let invitationTimer = null

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
const pageTitle = computed(
  () =>
    ({
      type: 'New match',
      timing: 'Friendly match',
      opponent: 'Choose opponent',
      join: 'Play now',
      format: isFriendly.value ? 'Match setup' : 'Scoring format',
      scheduled: 'Invitation sent',
      externalJoin: 'Join match',
    })[step.value] || 'Match',
)
const stepText = computed(() => {
  if (isLadder.value)
    return { type: '1 of 3', opponent: '2 of 3', format: '3 of 3' }[step.value] || ''
  return (
    { type: '1 of 4', timing: '2 of 4', opponent: '3 of 4', join: '3 of 4', format: '4 of 4' }[
      step.value
    ] || ''
  )
})
const joinUrl = computed(() => {
  if (!friendlyMatchStore.draft.joinToken || typeof window === 'undefined') return ''
  const href = router.resolve({
    name: 'FriendlyMatchJoinInvitation',
    params: { token: friendlyMatchStore.draft.joinToken },
  }).href
  return new URL(href, window.location.href).href
})
const activeInvitation = computed(() => friendlyMatchStore.activeInvitation)
const playNowReady = computed(() => friendlyMatchStore.opponentReady)
const canManageDraft = computed(
  () =>
    !friendlyMatchStore.draft.ownerId ||
    friendlyMatchStore.draft.ownerId === currentIdentity.value.id,
)
const invitationExpired = computed(() =>
  ['expired', 'cancelled'].includes(activeInvitation.value?.status),
)
const minDate = computed(() => new Date().toISOString().slice(0, 10))
const formattedSchedule = computed(() => {
  const { date, time } = friendlyMatchStore.draft.schedule
  if (!date || !time) return ''
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime())
    ? `${date} at ${time}`
    : value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})

const clubOpponents = computed(() => {
  const loadedPlayers = playerStore.players
    .filter((player) => player.id !== playerStore.currentPlayerId && player.status !== 'inactive')
    .map((player) => ({
      id: player.id,
      name: player.name,
      rank: player.rank || null,
      division: player.category || player.division || 'Club Member',
      status: player.status || 'active',
    }))
  return loadedPlayers.length ? loadedPlayers : friendlyMatchStore.opponents
})

const availableOpponents = computed(() => {
  const source = isLadder.value ? friendlyMatchStore.ladderOpponents : clubOpponents.value
  const recentIds = friendlyMatchStore.results.map((result) => result.opponentId).filter(Boolean)
  const ordered = [...source].sort((a, b) => {
    const aIndex = recentIds.indexOf(a.id)
    const bIndex = recentIds.indexOf(b.id)
    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return ordered
  return ordered.filter((player) =>
    [player.name, player.division, player.rank ? `rank ${player.rank}` : ''].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(query),
    ),
  )
})

const backRoute = computed(
  () =>
    ({
      type: { name: 'Dashboard' },
      timing: { name: 'FriendlyMatchType' },
      opponent: isLadder.value ? { name: 'FriendlyMatchType' } : { name: 'FriendlyMatchTiming' },
      join: { name: 'FriendlyMatchTiming' },
      format: isLadder.value
        ? { name: 'FriendlyMatchOpponent' }
        : isPlayNow.value
          ? { name: 'FriendlyMatchJoin' }
          : { name: 'FriendlyMatchOpponent' },
      scheduled: { name: 'Dashboard' },
      externalJoin: { name: 'Dashboard' },
      live: { name: 'FriendlyMatchFormat' },
    })[step.value] || { name: 'Dashboard' },
)

function guardStep() {
  if (step.value === 'externalJoin') return
  if (isFriendly.value && friendlyMatchStore.draft.ownerId && !canManageDraft.value) {
    router.replace({ name: 'Dashboard' })
    return
  }
  if (step.value === 'timing' && !isFriendly.value) router.replace({ name: 'FriendlyMatchType' })
  else if (
    step.value === 'opponent' &&
    !['friendly', 'ladder'].includes(friendlyMatchStore.draft.matchType)
  )
    router.replace({ name: 'FriendlyMatchType' })
  else if (
    step.value === 'opponent' &&
    isFriendly.value &&
    friendlyMatchStore.draft.timing !== 'later'
  )
    router.replace({ name: 'FriendlyMatchTiming' })
  else if (
    step.value === 'join' &&
    (!isFriendly.value || !isPlayNow.value || !friendlyMatchStore.draft.matchId)
  )
    router.replace({ name: 'FriendlyMatchTiming' })
  else if (step.value === 'format' && isLadder.value && !friendlyMatchStore.draft.opponent)
    router.replace({ name: 'FriendlyMatchOpponent' })
  else if (step.value === 'format' && isFriendly.value && isPlayNow.value && !playNowReady.value)
    router.replace({ name: 'FriendlyMatchJoin' })
  else if (
    step.value === 'format' &&
    isFriendly.value &&
    !isPlayNow.value &&
    !friendlyMatchStore.scheduleComplete
  )
    router.replace({ name: 'FriendlyMatchOpponent' })
  else if (
    step.value === 'live' &&
    (!friendlyMatchStore.draft.format || !friendlyMatchStore.draft.opponent)
  )
    router.replace({ name: 'FriendlyMatchFormat' })
}

function goBack() {
  router.push(backRoute.value)
}

function chooseMatchType(type) {
  inlineNote.value = ''
  friendlyMatchStore.chooseMatchType(type)
  router.push({ name: type === 'friendly' ? 'FriendlyMatchTiming' : 'FriendlyMatchOpponent' })
}

function showTournamentNotice() {
  inlineNote.value =
    'No tournament is running at Emerald Courts right now. You can still create a friendly match or ladder challenge.'
}

async function chooseTiming(timing) {
  friendlyMatchStore.chooseTiming(timing, currentIdentity.value)
  if (timing === 'now') {
    await router.push({ name: 'FriendlyMatchJoin' })
    await generateQrCode()
  } else {
    router.push({ name: 'FriendlyMatchOpponent' })
  }
}

function chooseOpponent(opponent) {
  friendlyMatchStore.chooseOpponent(opponent)
}

function continueToFormat() {
  if (isLadder.value && friendlyMatchStore.draft.opponent)
    router.push({ name: 'FriendlyMatchFormat' })
  else if (friendlyMatchStore.scheduleComplete) router.push({ name: 'FriendlyMatchFormat' })
}

function chooseFormat(format) {
  friendlyMatchStore.chooseFormat(format)
  if (isLadder.value) {
    friendlyMatchStore.startLiveMatch(currentIdentity.value.id)
    router.push({ name: 'FriendlyMatchLive' })
  }
}

function completeReview() {
  if (!friendlyMatchStore.draft.format) friendlyMatchStore.chooseFormat('ad')
  if (isPlayNow.value) {
    if (!playNowReady.value) return
    friendlyMatchStore.startLiveMatch(currentIdentity.value.id)
    router.push({ name: 'FriendlyMatchLive' })
    return
  }
  const invitation = friendlyMatchStore.createScheduledInvitation(currentIdentity.value)
  if (invitation) router.push({ name: 'FriendlyMatchScheduled' })
}

function finishMatch() {
  const result = friendlyMatchStore.endMatch(currentIdentity.value.id)
  if (result) router.push({ name: 'Dashboard' })
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
    copyStatus.value = 'Link copied'
  } catch {
    copyStatus.value = 'Select the link below to copy it'
  }
  window.setTimeout(() => {
    copyStatus.value = ''
  }, 2400)
}

function refreshInvitation() {
  friendlyMatchStore.refreshInvitations()
  if (step.value === 'externalJoin') {
    externalInvitation.value = friendlyMatchStore.invitationByToken(
      String(route.params.token || ''),
    )
  }
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
  refreshInvitation()
  guardStep()
  if (step.value === 'format' && isFriendly.value && !friendlyMatchStore.draft.format)
    friendlyMatchStore.chooseFormat('ad')
  if (step.value === 'join') generateQrCode()
}

onMounted(() => {
  if (!playerStore.players.length && !playerStore.isLoading) playerStore.loadPlayers()
  configureStep()
  window.addEventListener('storage', handleStorage)
  invitationTimer = window.setInterval(() => {
    if (['join', 'externalJoin'].includes(step.value)) refreshInvitation()
  }, 1200)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorage)
  if (invitationTimer) window.clearInterval(invitationTimer)
})

watch(step, configureStep)
</script>

<template>
  <main class="friendly-flow">
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
          <span
            ><strong>Friendly match</strong
            ><small
              >Search any existing club member and play without affecting rankings.</small
            ></span
          >
          <span class="choice-card__arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="choice-card" @click="chooseMatchType('ladder')">
          <span
            ><strong>Ladder challenge</strong
            ><small
              >You are rank #6. See only the players you are eligible to challenge.</small
            ></span
          >
          <span class="choice-card__arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="choice-card choice-card--muted" @click="showTournamentNotice">
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
        <p class="friendly-flow__eyebrow">Friendly match</p>
        <h2 id="timing-title">When are you playing?</h2>
        <p>Use a quick QR join when both players are together, or send an invitation for later.</p>
      </div>
      <div class="friendly-flow__choices friendly-flow__choices--formats">
        <button type="button" class="format-card" @click="chooseTiming('now')">
          <strong>Play now</strong
          ><small>Show a QR code so the opponent can join immediately.</small>
        </button>
        <button type="button" class="format-card" @click="chooseTiming('later')">
          <strong>Schedule for later</strong
          ><small>Select a club member, date, time and optional court.</small>
        </button>
      </div>
    </section>

    <section
      v-else-if="step === 'opponent'"
      class="friendly-flow__screen"
      aria-labelledby="opponent-title"
    >
      <div class="friendly-flow__intro">
        <p class="friendly-flow__eyebrow">
          {{
            isLadder
              ? `Rank #${friendlyMatchStore.currentLadderRank} · Eligible players`
              : 'Schedule match'
          }}
        </p>
        <h2 id="opponent-title">
          {{ isLadder ? 'Who are you playing?' : 'Choose your opponent.' }}
        </h2>
        <p>
          {{
            isLadder
              ? 'You can challenge players up to three ladder positions above you.'
              : 'Only active club members appear here. Guest players can be added later if the club enables them.'
          }}
        </p>
      </div>
      <p v-if="isLadder" class="eligibility-context">
        Showing only ranks #3–#5 because they are within your challenge window.
      </p>
      <label class="opponent-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <span class="sr-only">Search {{ isLadder ? 'eligible players' : 'club members' }}</span>
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="isLadder ? 'Search eligible players' : 'Search club members'"
          autocomplete="off"
        />
      </label>
      <div
        v-if="availableOpponents.length"
        class="opponent-list"
        role="radiogroup"
        aria-label="Choose opponent"
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
          <span class="opponent-row__avatar">{{ initials(opponent.name) }}</span>
          <span class="opponent-row__identity"
            ><strong>{{ opponent.name }}</strong
            ><small
              >{{ opponent.rank ? `Rank #${opponent.rank} · ` : '' }}{{ opponent.division }}</small
            ></span
          >
          <span
            v-if="selectedOpponentId === opponent.id"
            class="opponent-row__check"
            aria-hidden="true"
            >✓</span
          >
        </button>
      </div>
      <div v-else class="opponent-empty" role="status">
        <strong>No matching players</strong
        ><span
          >Try another name{{ isLadder ? ' within your eligible challenge window' : '' }}.</span
        >
        <button type="button" class="button-secondary" @click="searchQuery = ''">
          Clear search
        </button>
      </div>
      <div v-if="!isLadder" class="schedule-fields">
        <label
          ><span>Date</span
          ><input
            type="date"
            :min="minDate"
            :value="friendlyMatchStore.draft.schedule.date"
            @input="friendlyMatchStore.updateSchedule('date', $event.target.value)"
        /></label>
        <label
          ><span>Time</span
          ><input
            type="time"
            :value="friendlyMatchStore.draft.schedule.time"
            @input="friendlyMatchStore.updateSchedule('time', $event.target.value)"
        /></label>
        <label
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
        :disabled="
          isLadder ? !friendlyMatchStore.draft.opponent : !friendlyMatchStore.scheduleComplete
        "
        @click="continueToFormat"
      >
        Continue
      </button>
    </section>

    <section
      v-else-if="step === 'join'"
      class="friendly-flow__screen friendly-flow__screen--join"
      aria-labelledby="join-title"
    >
      <div class="friendly-flow__intro">
        <p class="friendly-flow__eyebrow">Play now</p>
        <h2 id="join-title">Let your opponent join.</h2>
        <p>
          They scan this code and confirm their identity. The scoreboard stays locked until they
          join.
        </p>
      </div>
      <div class="join-layout">
        <div class="qr-panel">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code for this friendly match invitation" />
          <div v-else class="qr-panel__placeholder" aria-label="QR code loading"></div>
          <button type="button" class="button-secondary" :disabled="!joinUrl" @click="copyJoinLink">
            Copy match link
          </button>
          <p v-if="copyStatus" role="status">{{ copyStatus }}</p>
          <a class="join-link" :href="joinUrl">{{ joinUrl }}</a>
        </div>
        <div class="join-status">
          <div class="status-block">
            <span>Match status</span>
            <strong>{{
              playNowReady
                ? 'Both players are ready'
                : invitationExpired
                  ? 'Invitation unavailable'
                  : 'Waiting for opponent'
            }}</strong>
            <small>{{
              playNowReady
                ? `${opponentName} joined using the match link.`
                : invitationExpired
                  ? 'Return and create a new Play now invitation.'
                  : 'Keep this screen open while your opponent scans.'
            }}</small>
          </div>
          <div class="ready-player">
            <span class="opponent-row__avatar">{{ initials(currentIdentity.name) }}</span>
            <span
              ><strong>{{ currentIdentity.name }}</strong
              ><small
                >Match creator{{
                  currentIdentity.rank ? ` · Rank #${currentIdentity.rank}` : ' · Club member'
                }}</small
              ></span
            >
            <b>Ready</b>
          </div>
          <div class="ready-player" :class="{ 'ready-player--waiting': !playNowReady }">
            <span class="opponent-row__avatar">{{
              playNowReady ? initials(opponentName) : '?'
            }}</span>
            <span
              ><strong>{{ playNowReady ? opponentName : 'Waiting for opponent' }}</strong
              ><small>{{
                playNowReady
                  ? friendlyMatchStore.draft.opponent.rank
                    ? `Rank #${friendlyMatchStore.draft.opponent.rank}`
                    : 'Club member'
                  : 'Ask them to scan the QR code.'
              }}</small></span
            >
            <b>{{ playNowReady ? 'Ready' : 'Waiting' }}</b>
          </div>
        </div>
      </div>
      <button
        type="button"
        class="button-primary friendly-flow__continue"
        :disabled="!playNowReady"
        @click="router.push({ name: 'FriendlyMatchFormat' })"
      >
        Next
      </button>
    </section>

    <section
      v-else-if="step === 'externalJoin'"
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
        >
        <small>{{
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
        Join match
      </button>
      <button
        v-else
        type="button"
        class="button-secondary friendly-flow__continue friendly-flow__continue--left"
        @click="router.push({ name: 'Dashboard' })"
      >
        Back to dashboard
      </button>
    </section>

    <section
      v-else-if="step === 'format'"
      class="friendly-flow__screen"
      aria-labelledby="format-title"
    >
      <template v-if="isFriendly">
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">Match setup</p>
          <h2 id="format-title">Everything looks ready.</h2>
          <p>
            Gora has applied the club’s default format. Change it only when the players agree to
            something different.
          </p>
        </div>
        <div class="review-list">
          <div class="review-row">
            <span>Players</span><strong>{{ currentIdentity.name }} vs {{ opponentName }}</strong>
          </div>
          <div class="review-row review-row--options">
            <span>Scoring</span>
            <div class="segmented-options">
              <button
                type="button"
                :class="{ active: friendlyMatchStore.draft.format === 'ad' }"
                @click="chooseFormat('ad')"
              >
                Advantage
              </button>
              <button
                type="button"
                :class="{ active: friendlyMatchStore.draft.format === 'noad' }"
                @click="chooseFormat('noad')"
              >
                No-Ad
              </button>
            </div>
          </div>
          <div class="review-row"><span>Match format</span><strong>Best of 3 sets</strong></div>
          <div class="review-row">
            <span>Tie-break</span><strong>Played at 6–6 <small>Club default</small></strong>
          </div>
          <div v-if="!isPlayNow" class="review-row">
            <span>Schedule</span
            ><strong
              >{{ formattedSchedule
              }}{{
                friendlyMatchStore.draft.schedule.court
                  ? ` · ${friendlyMatchStore.draft.schedule.court}`
                  : ''
              }}</strong
            >
          </div>
        </div>
        <button
          type="button"
          class="button-primary friendly-flow__continue"
          @click="completeReview"
        >
          {{ isPlayNow ? 'Start match' : 'Send invitation' }}
        </button>
      </template>
      <template v-else>
        <div class="friendly-flow__intro">
          <p class="friendly-flow__eyebrow">{{ friendlyMatchStore.matchTypeLabel }}</p>
          <h2 id="format-title">How should deuce be played?</h2>
          <p>
            Both formats use love, 15, 30 and 40. Choose what happens when the score reaches deuce.
          </p>
        </div>
        <div class="friendly-flow__choices friendly-flow__choices--formats">
          <button type="button" class="format-card" @click="chooseFormat('ad')">
            <strong>Advantage</strong
            ><small>At deuce, a player must win two consecutive points.</small>
          </button>
          <button type="button" class="format-card" @click="chooseFormat('noad')">
            <strong>No-Ad</strong><small>At deuce, the next point wins the game.</small>
          </button>
        </div>
      </template>
    </section>

    <section
      v-else-if="step === 'scheduled'"
      class="friendly-flow__screen"
      aria-labelledby="scheduled-title"
    >
      <div class="friendly-flow__intro">
        <p class="friendly-flow__eyebrow">Invitation sent</p>
        <h2 id="scheduled-title">Your match is scheduled.</h2>
        <p>{{ opponentName }} will receive an invitation for {{ formattedSchedule }}.</p>
      </div>
      <div class="status-block status-block--confirmation">
        <span>Match status</span><strong>Waiting for acceptance</strong>
        <small>You can change the date or cancel the invitation before it is accepted.</small>
      </div>
      <button
        type="button"
        class="button-primary friendly-flow__continue friendly-flow__continue--left"
        @click="router.push({ name: 'Dashboard' })"
      >
        Back to dashboard
      </button>
    </section>

    <section v-else class="friendly-live" aria-labelledby="live-match-title">
      <div class="friendly-live__title-row">
        <div>
          <p class="friendly-flow__eyebrow">{{ friendlyMatchStore.matchTypeLabel }}</p>
          <h1 id="live-match-title">You vs {{ opponentName }}</h1>
        </div>
        <span class="friendly-live__live">Live</span>
      </div>
      <div class="friendly-live__status">
        <strong>{{ friendlyMatchStore.statusText }}</strong
        ><span>{{ friendlyMatchStore.formatLabel }}</span>
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
      <div class="friendly-live__players">
        <button
          type="button"
          class="friendly-live__player friendly-live__player--you"
          :disabled="friendlyMatchStore.draft.over"
          aria-label="Add point for you"
          @click="friendlyMatchStore.recordPoint('you', currentIdentity.id)"
        >
          <span>You</span><strong>{{ friendlyMatchStore.pointLabel('you') }}</strong
          ><small>Tap when you win the rally</small>
        </button>
        <button
          type="button"
          class="friendly-live__player"
          :disabled="friendlyMatchStore.draft.over"
          :aria-label="`Add point for ${opponentName}`"
          @click="friendlyMatchStore.recordPoint('opponent', currentIdentity.id)"
        >
          <span>{{ opponentName }}</span
          ><strong>{{ friendlyMatchStore.pointLabel('opponent') }}</strong
          ><small>Tap when {{ opponentName }} wins</small>
        </button>
      </div>
      <p class="friendly-live__count">
        Points played: {{ friendlyMatchStore.draft.pointHistory.length }}
      </p>
      <button type="button" class="friendly-live__end" @click="finishMatch">End match</button>
    </section>
  </main>
</template>

<style scoped>
.friendly-flow {
  width: min(1140px, 100%);
  min-height: 100svh;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 34px) clamp(20px, 3.5vw, 40px) 44px;
  color: var(--color-text);
  font-family: inherit;
}
.friendly-flow__header {
  display: grid;
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
  line-height: 1.2;
}
.friendly-flow__back {
  width: 44px;
  height: 44px;
  padding: 0;
  border: var(--app-hairline);
  background: var(--color-surface);
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
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
  font-weight: 700;
  opacity: 0.7;
}
.friendly-flow__screen {
  display: grid;
  gap: 22px;
  padding-top: clamp(30px, 7vw, 58px);
}
.friendly-flow__intro {
  max-width: 720px;
}
.friendly-flow__eyebrow,
.friendly-flow__intro h2,
.friendly-flow__intro > p:last-child {
  margin: 0;
}
.friendly-flow__eyebrow {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  opacity: 0.76;
}
.friendly-flow__intro h2 {
  margin-top: 5px;
  color: var(--color-text-soft);
  font-size: clamp(22px, 5vw, 30px);
  line-height: 1.24;
}
.friendly-flow__intro > p:last-child:not(.friendly-flow__eyebrow) {
  margin-top: 7px;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.55;
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
  font-weight: 600;
  line-height: 1.55;
}
.eligibility-context {
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
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
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
  color: var(--color-text-soft);
  text-align: left;
  transition:
    transform 180ms var(--motion-curve),
    box-shadow 180ms var(--motion-curve),
    border-color 180ms ease;
}
.choice-card {
  display: flex;
  min-height: 86px;
  align-items: center;
  justify-content: space-between;
  padding: 17px 18px;
  border-radius: var(--app-card-radius);
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
  font-size: 14px;
}
.choice-card small,
.format-card small {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
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
  box-shadow: 0 12px 28px rgba(15, 34, 24, 0.055);
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
.opponent-search input:focus {
  box-shadow: none;
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
  border: 2px solid var(--color-primary);
  padding: 10px 13px;
  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
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
  font-weight: 800;
}
.opponent-row__identity {
  display: grid;
  min-width: 0;
}
.opponent-row__identity strong {
  font-size: 14px;
}
.opponent-row__identity small {
  color: var(--color-muted);
  font-size: 11.5px;
}
.opponent-row__check {
  color: var(--color-primary-strong);
  font-size: 16px;
  font-weight: 900;
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
  color: var(--color-text-soft);
  font-size: 15px;
}
.opponent-empty span {
  color: var(--color-muted);
  font-size: 12.5px;
}
.opponent-empty button {
  margin-top: 8px;
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
  font-weight: 800;
}
.schedule-fields label span small {
  color: var(--color-muted);
  font-weight: 600;
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
.friendly-flow__choices--formats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.format-card {
  min-height: 160px;
  align-content: center;
  justify-items: start;
  padding: 24px;
  border-radius: var(--app-card-radius);
}
.format-card:hover,
.format-card:focus-visible {
  border-color: var(--color-primary);
  background: var(--color-surface-soft);
}
.join-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
  gap: 18px;
  align-items: stretch;
}
.qr-panel,
.join-status,
.join-summary,
.review-list {
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: 0 10px 28px rgba(15, 34, 24, 0.04);
}
.qr-panel {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  padding: 22px;
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
  font-weight: 800;
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
.join-status {
  display: grid;
  align-content: start;
  padding: 18px;
}
.status-block {
  display: grid;
  gap: 4px;
  padding: 2px 2px 17px;
  border-bottom: var(--app-hairline);
}
.status-block span,
.join-summary span,
.review-row > span {
  color: var(--color-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.status-block strong,
.join-summary strong {
  color: var(--color-text-soft);
  font-size: 16px;
}
.status-block small,
.join-summary small {
  color: var(--color-muted);
  font-size: 11.5px;
  line-height: 1.5;
}
.ready-player {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px 2px;
  border-bottom: var(--app-hairline);
}
.ready-player > span:nth-child(2) {
  display: grid;
}
.ready-player strong {
  font-size: 13px;
}
.ready-player small {
  color: var(--color-muted);
  font-size: 11px;
}
.ready-player b {
  color: var(--color-primary-strong);
  font-size: 10px;
}
.ready-player--waiting {
  opacity: 0.62;
}
.join-summary {
  display: grid;
  gap: 5px;
  max-width: 680px;
  padding: 20px;
}
.external-join {
  max-width: 780px;
}
.review-list {
  display: grid;
  overflow: hidden;
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
  color: var(--color-text-soft);
  font-size: 13px;
}
.review-row > strong small {
  display: inline-block;
  margin-left: 7px;
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 9px;
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
  font-weight: 800;
}
.segmented-options button.active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface));
  color: var(--color-primary-strong);
}
.status-block--confirmation {
  max-width: 680px;
  padding: 20px;
  border: 0;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
}
.friendly-live {
  display: grid;
  gap: 22px;
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
  color: var(--color-text-soft);
  font-size: clamp(24px, 5vw, 32px);
}
.friendly-live__live {
  padding: 5px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
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
  color: var(--color-text-soft);
  font-size: 14px;
}
.friendly-live__status > span {
  padding: 4px 7px;
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 10px;
  font-weight: 800;
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
.friendly-live__status button:disabled {
  opacity: 0.3;
}
.friendly-live__players {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.friendly-live__player {
  display: grid;
  min-height: 250px;
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
  font-weight: 800;
}
.friendly-live__player > strong {
  color: var(--color-text);
  font-size: clamp(44px, 10vw, 72px);
  line-height: 1;
}
.friendly-live__player > small {
  color: var(--color-muted);
  font-size: 11px;
  opacity: 0.68;
}
.friendly-live__player:disabled {
  opacity: 0.72;
}
.friendly-live__count {
  margin: -7px 0 0;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}
.friendly-live__end {
  justify-self: center;
  min-height: 44px;
  border-color: transparent;
  background: transparent;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 4px;
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
@media (max-width: 700px) {
  .join-layout {
    grid-template-columns: 1fr;
  }
  .qr-panel {
    padding: 18px;
  }
  .schedule-fields {
    grid-template-columns: 1fr;
  }
  .review-row {
    grid-template-columns: 1fr;
    gap: 7px;
  }
  .review-row--options {
    align-items: start;
  }
}
@media (max-width: 560px) {
  .friendly-flow {
    padding: 12px 16px 34px;
  }
  .friendly-flow__choices--formats,
  .friendly-live__players {
    grid-template-columns: 1fr;
  }
  .format-card {
    min-height: 120px;
  }
  .friendly-live__player {
    min-height: 180px;
  }
  .friendly-flow__continue {
    width: 100%;
  }
  .friendly-live__status {
    grid-template-columns: minmax(0, 1fr) 42px;
  }
  .friendly-live__status > span {
    display: none;
  }
  .ready-player {
    grid-template-columns: 40px minmax(0, 1fr);
  }
  .ready-player b {
    grid-column: 2;
  }
  .segmented-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
