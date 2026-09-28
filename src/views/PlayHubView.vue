
<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useAdminStore } from '../stores/admin'
import { useChallengeStore } from '../stores/challenge'
import { useNotificationStore } from '../stores/notification'
import { startOrResumeLadderMatch } from '../services/LadderLiveMatchService.js'
import { startOrResumeMatch } from '../services/LiveMatchService.js'
import {
  PERSONAL_PLAY_ACTIONS,
  PERSONAL_PLAY_GROUPS,
  buildPersonalPlayItems,
} from '../domain/playMatchItems.js'
import EmptyState from '../components/EmptyState.vue'
import PlayMatchItemRow from '../components/play/PlayMatchItemRow.vue'

const router = useRouter()
const friendlyMatchStore = useFriendlyMatchStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const adminStore = useAdminStore()
const challengeStore = useChallengeStore()
const notificationStore = useNotificationStore()

const activeMode = ref('play')
const hasLoaded = ref(false)
const now = ref(Date.now())
const pendingActionKey = ref('')
let minuteTimer = null

const currentPlayerId = computed(() => playerStore.currentPlayerId)

const personalMatches = computed(() =>
  buildPersonalPlayItems({
    challenges: challengeStore.challenges,
    matches: matchStore.matches,
    players: playerStore.players,
    actorId: currentPlayerId.value,
    activeClubId: adminStore.activeClubId || '',
    now: now.value,
  }),
)

const matchGroups = computed(() => [
  {
    key: PERSONAL_PLAY_GROUPS.NOW,
    label: 'Now',
    items: personalMatches.value.filter((item) => item.group === PERSONAL_PLAY_GROUPS.NOW),
  },
  {
    key: PERSONAL_PLAY_GROUPS.NEEDS_YOU,
    label: 'Needs you',
    items: personalMatches.value.filter(
      (item) => item.group === PERSONAL_PLAY_GROUPS.NEEDS_YOU,
    ),
  },
  {
    key: PERSONAL_PLAY_GROUPS.UPCOMING,
    label: 'Upcoming',
    items: personalMatches.value.filter(
      (item) => item.group === PERSONAL_PLAY_GROUPS.UPCOMING,
    ),
  },
].filter((group) => group.items.length))

const isLoadingMatches = computed(
  () =>
    !hasLoaded.value &&
    (playerStore.isLoading || challengeStore.isLoading || matchStore.isLoading),
)

function actionKey(item, actionId) {
  return `${item?.id || 'match'}:${actionId || 'action'}`
}

function setMode(mode) {
  activeMode.value = mode === 'matches' ? 'matches' : 'play'
}

function startMatch(mode) {
  if (mode === 'ladder') {
    router.push({ name: 'PlayLadderMatch' })
    return
  }

  friendlyMatchStore.beginMatch()
  friendlyMatchStore.chooseMatchType('friendly')
  router.push({ name: 'FriendlyMatchScoring' })
}

function openChallenge(item) {
  if (!item?.challengeId) return
  router.push({
    name: 'ChallengeDetails',
    params: { challengeId: item.challengeId },
  })
}

function openMatch(item) {
  if (!item?.matchId) {
    openChallenge(item)
    return
  }

  router.push({
    name: 'MatchDetails',
    params: { matchId: item.matchId },
  })
}

async function refreshMatchState() {
  await Promise.all([challengeStore.loadChallenges(), matchStore.loadMatches()])
  now.value = Date.now()
}

async function runChallengeAction(item, actionId, action, successMessage) {
  const key = actionKey(item, actionId)
  if (pendingActionKey.value) return

  pendingActionKey.value = key
  try {
    const result = await action()
    if (!result) {
      throw new Error(challengeStore.error || 'Unable to update this challenge.')
    }

    if (successMessage) {
      notificationStore.addToast({ message: successMessage, type: 'success' })
    }

    await refreshMatchState()
  } catch (error) {
    notificationStore.addToast({
      message: error?.message || 'Unable to update this challenge.',
      type: 'warning',
    })
  } finally {
    pendingActionKey.value = ''
  }
}

async function startLadderMatch(item) {
  if (!item?.match?.id) {
    openChallenge(item)
    return
  }

  const key = actionKey(item, PERSONAL_PLAY_ACTIONS.START_MATCH)
  if (pendingActionKey.value) return
  pendingActionKey.value = key

  try {
    const result = await startOrResumeLadderMatch({
      match: item.match,
      actorId: currentPlayerId.value,
      clubId: adminStore.activeClubId || '',
      explicitStart: true,
    })

    if (!result.ok) {
      notificationStore.addToast({
        message: result.message || 'This Ladder Match cannot be started yet.',
        type: 'warning',
      })
      return
    }

    router.push({
      name: 'LiveMatch',
      params: { matchId: result.match.id },
    })
  } finally {
    pendingActionKey.value = ''
  }
}

async function continueNonLadderMatch(item) {
  const match = item?.match
  if (!match?.id) return

  if (match.type === 'tournament') {
    const result = await startOrResumeMatch({
      match,
      actorId: currentPlayerId.value,
      clubId: adminStore.activeClubId || '',
      authorized: adminStore.hasActiveClubPermission('tournaments.score.update'),
      explicitStart: true,
    })

    if (!result.ok) {
      notificationStore.addToast({
        message: result.message || 'This Tournament Match cannot be continued yet.',
        type: 'warning',
      })
      return
    }

    router.push({
      name: 'LiveMatch',
      params: { matchId: result.match.id },
    })
    return
  }

  openMatch(item)
}

async function handleMatchAction({ action, item }) {
  const actionId = action?.id || ''
  if (!item || !actionId) return

  switch (actionId) {
    case PERSONAL_PLAY_ACTIONS.VIEW_CHALLENGE:
    case PERSONAL_PLAY_ACTIONS.SCHEDULE_MATCH:
    case PERSONAL_PLAY_ACTIONS.REVIEW_RESULT:
      openChallenge(item)
      return

    case PERSONAL_PLAY_ACTIONS.ACCEPT_CHALLENGE:
      await runChallengeAction(
        item,
        actionId,
        () => challengeStore.acceptChallenge(item.challengeId, null, currentPlayerId.value),
        'Challenge accepted. Agree the match schedule next.',
      )
      return

    case PERSONAL_PLAY_ACTIONS.DECLINE_CHALLENGE:
      await runChallengeAction(
        item,
        actionId,
        () => challengeStore.declineChallenge(item.challengeId, currentPlayerId.value),
        'Challenge declined.',
      )
      return

    case PERSONAL_PLAY_ACTIONS.VIEW_MATCH:
      openMatch(item)
      return

    case PERSONAL_PLAY_ACTIONS.START_MATCH:
      await startLadderMatch(item)
      return

    case PERSONAL_PLAY_ACTIONS.RESUME_SCORING:
      if (item.matchId) {
        router.push({ name: 'LiveMatch', params: { matchId: item.matchId } })
      }
      return

    case PERSONAL_PLAY_ACTIONS.VIEW_LIVE_SCORE:
      if (item.matchId) {
        router.push({ name: 'LiveScoreboard', params: { matchId: item.matchId } })
      }
      return

    case PERSONAL_PLAY_ACTIONS.CONTINUE_NON_LADDER:
      await continueNonLadderMatch(item)
      return

    default:
      return
  }
}

onMounted(async () => {
  minuteTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 60_000)

  try {
    await Promise.all([
      playerStore.loadPlayers(),
      challengeStore.loadChallenges(),
      matchStore.loadMatches(),
    ])
  } finally {
    now.value = Date.now()
    hasLoaded.value = true
  }
})

onUnmounted(() => {
  if (minuteTimer) window.clearInterval(minuteTimer)
})
</script>

<template>
  <section class="play-hub" aria-label="Personal match hub">
    <nav class="play-mode-tabs" role="tablist" aria-label="Play mode">
      <button
        id="play-mode-tab"
        type="button"
        role="tab"
        :aria-selected="activeMode === 'play'"
        :tabindex="activeMode === 'play' ? 0 : -1"
        :class="{ active: activeMode === 'play' }"
        @click="setMode('play')"
      >
        Play
      </button>

      <button
        id="my-matches-mode-tab"
        type="button"
        role="tab"
        :aria-selected="activeMode === 'matches'"
        :tabindex="activeMode === 'matches' ? 0 : -1"
        :class="{ active: activeMode === 'matches' }"
        @click="setMode('matches')"
      >
        <span>My matches</span>
        <span v-if="personalMatches.length" class="play-mode-tabs__count">
          {{ personalMatches.length }}
        </span>
      </button>
    </nav>

    <section
      v-if="activeMode === 'play'"
      class="play-mode-panel"
      role="tabpanel"
      aria-labelledby="play-mode-tab"
    >
      <header class="section-heading">
        <h2>Start a match</h2>
        <p>Choose how you want to play.</p>
      </header>

      <div class="play-options">
        <button type="button" class="play-option" @click="startMatch('friendly')">
          <span class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" /></svg>
          </span>
          <span class="play-option__copy">
            <strong>Friendly match</strong>
            <small>Play without changing the ladder.</small>
          </span>
        </button>

        <button type="button" class="play-option play-option--ladder" @click="startMatch('ladder')">
          <span class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 19v-7M12 19V5M19 19v-10" /></svg>
          </span>
          <span class="play-option__copy">
            <strong>Ladder match</strong>
            <small>Play with your club's ladder rules.</small>
          </span>
        </button>
      </div>
    </section>

    <section
      v-else
      class="play-mode-panel play-mode-panel--matches"
      role="tabpanel"
      aria-labelledby="my-matches-mode-tab"
    >
      <div v-if="isLoadingMatches" class="match-loading" aria-label="Loading your matches">
        <span v-for="row in 3" :key="row" class="match-loading__row"></span>
      </div>

      <div v-else-if="matchGroups.length" class="match-groups">
        <section v-for="group in matchGroups" :key="group.key" class="match-group">
          <header class="match-group__heading">
            <h2>{{ group.label }}</h2>
            <span>{{ group.items.length }}</span>
          </header>

          <div class="match-list">
            <PlayMatchItemRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :busy="pendingActionKey.startsWith(`${item.id}:`)"
              @action="handleMatchAction"
            />
          </div>
        </section>
      </div>

      <EmptyState
        v-else
        compact
        variant="quiet"
        illustration="matches"
        title="No active matches"
        description="When a match needs you, is ready to play, or is scheduled, it will appear here."
        primary-action-label="Friendly match"
        secondary-action-label="Ladder match"
        @primary-action="startMatch('friendly')"
        @secondary-action="startMatch('ladder')"
      />
    </section>
  </section>
</template>

<style scoped>
.play-hub {
  display: grid;
  width: 100%;
  gap: 32px;
  padding: 8px 0 56px;
}

.play-mode-tabs {
  display: inline-flex;
  width: fit-content;
  align-items: flex-end;
  gap: 24px;
  border-bottom: 1px solid var(--color-border);
}

.play-mode-tabs button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 0 10px;
  border: 0;
  border-bottom: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 15px;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease;
}

.play-mode-tabs button.active {
  border-bottom-color: var(--color-primary-strong);
  background: transparent;
  box-shadow: none;
  color: var(--color-text);
}

.play-mode-tabs button:hover:not(.active) {
  background: transparent;
  color: var(--color-text);
}

.play-mode-tabs button:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.play-mode-tabs__count {
  color: currentColor;
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.play-mode-panel {
  display: grid;
  gap: 26px;
}

.section-heading {
  display: grid;
  gap: 8px;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading h2 {
  color: var(--color-text);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.015em;
  line-height: 1.35;
}

.section-heading p {
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.5;
}

.play-options {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.play-option {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 120px;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  justify-content: start;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  color: var(--color-text);
  text-align: left;
  white-space: normal;
  cursor: pointer;
}

.play-option:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-softest);
  box-shadow: var(--shadow-soft);
}

.play-option:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.feature-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: var(--app-inner-radius);
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}

.feature-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.play-option__copy {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.play-option__copy strong {
  color: var(--color-text);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.play-option__copy small {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}

.match-groups {
  display: grid;
  gap: 26px;
}

.match-group {
  display: grid;
  gap: 9px;
}

.match-group__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.match-group__heading h2,
.match-group__heading span {
  margin: 0;
}

.match-group__heading h2 {
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  line-height: 1.35;
  text-transform: uppercase;
}

.match-group__heading span {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
}

.match-list,
.match-loading {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

.match-list :deep(.play-match-item-row:last-child) {
  border-bottom: 0;
}

.match-loading {
  display: grid;
}

.match-loading__row {
  height: 88px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(
    100deg,
    var(--color-bg-muted) 20%,
    var(--color-surface) 44%,
    var(--color-bg-muted) 68%
  );
  background-size: 220% 100%;
  animation: play-shimmer 1.2s ease-in-out infinite;
}

.match-loading__row:last-child {
  border-bottom: 0;
}

@keyframes play-shimmer {
  to {
    background-position: -120% 0;
  }
}

@media (max-width: 640px) {
  .play-hub {
    gap: 26px;
    padding: 4px 0 36px;
  }

  .play-mode-tabs {
    max-width: 100%;
    gap: 18px;
  }

  .play-mode-tabs button {
    min-height: 40px;
    padding-bottom: 8px;
    font-size: 14px;
  }

  .play-options {
    grid-template-columns: 1fr;
  }

  .play-option {
    min-height: 108px;
    padding: 20px;
  }

  .match-groups {
    gap: 22px;
  }
}

@media (max-width: 360px) {
  .play-option {
    gap: 11px;
    padding-inline: 14px;
  }
}

.play-option--ladder {
  border-color: #163d2b;
  background: #163d2b;
  box-shadow: 0 7px 18px rgba(22, 61, 43, 0.16);
}

.play-option--ladder .play-option__copy strong,
.play-option--ladder .play-option__copy small {
  color: #fff;
}

.play-option--ladder .play-option__copy small {
  color: rgba(255, 255, 255, 0.78);
}

.play-option--ladder .feature-icon {
  background: rgba(216, 255, 71, 0.12);
  color: #d8ff47;
}

@media (hover: hover) and (pointer: fine) {
  .play-option--ladder:hover {
    border-color: #163d2b;
    background: #1d4432;
    box-shadow: 0 10px 22px rgba(22, 61, 43, 0.2);
  }
}
@media (prefers-reduced-motion: reduce) {
  .match-loading__row {
    animation: none;
  }
}

/* Play tabs need a deliberate pause before the panel content. */
.play-mode-tabs {
  gap: 32px;
  margin-bottom: 12px;
}

.play-mode-tabs button {
  min-height: 46px;
  padding: 2px 0 14px;
}

@media (max-width: 640px) {
  .play-mode-tabs {
    gap: 22px;
    margin-bottom: 8px;
  }

  .play-mode-tabs button {
    min-height: 44px;
    padding: 1px 0 11px;
  }
}</style>
