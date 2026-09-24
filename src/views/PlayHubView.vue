<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { startOrResumeLadderMatch } from '../services/LadderLiveMatchService.js'
import { startOrResumeMatch } from '../services/LiveMatchService.js'
import {
  PLAY_MATCH_ACTIONS,
  compareOperationalPlayMatches,
  getPlayMatchActions,
  isOperationalPlayMatch,
} from '../domain/playMatchActions.js'
import EmptyState from '../components/EmptyState.vue'
import PlayMatchRow from '../components/play/PlayMatchRow.vue'
import LadderMatchManageDialog from '../components/play/LadderMatchManageDialog.vue'

const router = useRouter()
const friendlyMatchStore = useFriendlyMatchStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()
const hasLoaded = ref(false)
const managedMatch = ref(null)
const manageMode = ref('')

const currentPlayerId = computed(() => playerStore.currentPlayerId)
const courts = computed(() => adminStore.activeClub?.setup?.workspace?.courts || [])
const canManageClub = computed(() => adminStore.hasActiveClubPermission('club.manage'))
const canControlLive = computed(() => adminStore.hasActiveClubPermission('matches.live_score'))

const ladderOperationalMatches = computed(() =>
  matchStore.matches
    .filter((match) =>
      isOperationalPlayMatch(match, {
        actorId: currentPlayerId.value,
        activeClubId: adminStore.activeClubId || '',
        canManage: canManageClub.value,
      }),
    )
    .sort(compareOperationalPlayMatches),
)

const otherOperationalMatches = computed(() =>
  matchStore.matches.filter(
    (match) =>
      match.type !== 'ladder' &&
      ['pending', 'scheduled', 'live'].includes(match.status) &&
      [match.player1Id, match.player2Id, match.challengerId, match.defenderId].includes(
        currentPlayerId.value,
      ),
  ),
)

const operationalMatches = computed(() =>
  [...ladderOperationalMatches.value, ...otherOperationalMatches.value].sort(
    compareOperationalPlayMatches,
  ),
)

function actionsForMatch(match) {
  if (match.type === 'ladder') {
    return getPlayMatchActions(match, {
      actorId: currentPlayerId.value,
      canManage: canManageClub.value,
      canLiveControl: canControlLive.value,
    })
  }

  return [
    {
      id: 'continue_non_ladder',
      label: 'Continue',
      tone: 'primary',
    },
  ]
}

function startMatch(mode) {
  friendlyMatchStore.beginMatch()

  if (mode === 'ladder') {
    friendlyMatchStore.chooseMatchType('ladder')
    router.push('/ladder-match/opponent')
    return
  }

  friendlyMatchStore.chooseMatchType('friendly')
  router.push({ name: 'FriendlyMatchScoring' })
}

async function continueNonLadderMatch(match) {
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
      params: {
        matchId: result.match.id,
      },
    })

    return
  }

  router.push({
    name: 'MatchDetails',
    params: {
      matchId: match.id,
    },
  })
}

function ladderActionStillAllowed(match, actionId) {
  return getPlayMatchActions(match, {
    actorId: currentPlayerId.value,
    canManage: canManageClub.value,
    canLiveControl: canControlLive.value,
  }).some((action) => action.id === actionId)
}

async function startLadderMatch(match) {
  if (!ladderActionStillAllowed(match, PLAY_MATCH_ACTIONS.START_MATCH)) {
    notificationStore.addToast({
      message: 'This match is no longer ready to start.',
      type: 'warning',
    })
    return
  }

  const result = await startOrResumeLadderMatch({
    match,
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
    params: {
      matchId: result.match.id,
    },
  })
}

function openManageDialog(match, mode) {
  managedMatch.value = match
  manageMode.value = mode
}

function closeManageDialog() {
  managedMatch.value = null
  manageMode.value = ''
}

function handleManagedResult() {
  closeManageDialog()
}

async function handleMatchAction({ action, match }) {
  const actionId =
    typeof action === 'string' ? action : action?.id || action?.key || action?.type || ''

  if (!match || !actionId) {
    return
  }

  if (match.type !== 'ladder') {
    if (actionId === 'continue_non_ladder') {
      await continueNonLadderMatch(match)
    }

    return
  }

  if (!ladderActionStillAllowed(match, actionId)) {
    notificationStore.addToast({
      message: 'That action is no longer available for this match.',
      type: 'warning',
    })
    return
  }

  switch (actionId) {
    case PLAY_MATCH_ACTIONS.VIEW_MATCH:
      router.push({
        name: 'MatchDetails',
        params: {
          matchId: match.id,
        },
      })
      return

    case PLAY_MATCH_ACTIONS.START_MATCH:
      await startLadderMatch(match)
      return

    case PLAY_MATCH_ACTIONS.RESUME_SCORING:
      router.push({
        name: 'LiveMatch',
        params: {
          matchId: match.id,
        },
      })
      return

    case PLAY_MATCH_ACTIONS.VIEW_LIVE_SCORE:
      router.push({
        name: 'LiveScoreboard',
        params: {
          matchId: match.id,
        },
      })
      return

    case PLAY_MATCH_ACTIONS.OPEN_MATCH_CONTROL:
      router.push({
        name: 'LiveOperationDetail',
        params: {
          matchId: match.id,
        },
      })
      return

    case PLAY_MATCH_ACTIONS.RESCHEDULE:
      openManageDialog(match, 'reschedule')
      return

    case PLAY_MATCH_ACTIONS.CANCEL:
      openManageDialog(match, 'cancel')
      return

    default:
      return
  }
}

onMounted(async () => {
  try {
    await Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
  } finally {
    hasLoaded.value = true
  }
})
</script>

<template>
  <section class="play-hub" aria-label="Personal match hub">
    <section class="play-section" aria-labelledby="start-match-title">
      <header class="section-heading">
        <h2 id="start-match-title">Start a match</h2>
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

    <section class="play-section play-section--matches" aria-labelledby="your-matches-title">
      <header class="section-heading section-heading--split">
        <div>
          <h2 id="your-matches-title">Your matches</h2>
          <p>Active matches and the actions available to you.</p>
        </div>
        <span v-if="operationalMatches.length" class="match-count">{{ operationalMatches.length }}</span>
      </header>

      <div v-if="matchStore.isLoading && !hasLoaded" class="match-loading" aria-label="Loading your matches">
        <span v-for="row in 3" :key="row" class="match-loading__row"></span>
      </div>

      <div v-else-if="operationalMatches.length" class="match-list">
        <PlayMatchRow
          v-for="match in operationalMatches"
          :key="match.id"
          :match="match"
          :actions="actionsForMatch(match)"
          @action="handleMatchAction"
        />
      </div>

      <EmptyState
        v-else
        compact
        variant="quiet"
        illustration="matches"
        title="No active matches"
        description="Scheduled, ready, and live matches will appear here when there is something to do or follow."
      />
    </section>

    <LadderMatchManageDialog
      :open="Boolean(managedMatch)"
      :match="managedMatch"
      :mode="manageMode"
      :courts="courts"
      @close="closeManageDialog"
      @saved="handleManagedResult"
      @cancelled="handleManagedResult"
    />
  </section>
</template>

<style scoped>
.play-hub {
  display: grid;
  width: 100%;
  gap: clamp(42px, 5vw, 52px);
  padding: 4px 0 42px;
}

.play-section {
  display: grid;
  gap: 16px;
}

.section-heading {
  display: grid;
  gap: 4px;
}

.section-heading--split {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
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
  gap: 16px;
}

.play-option {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 112px;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  justify-content: start;
  gap: 14px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  white-space: normal;
}

.play-option:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}

.feature-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 10px;
  background: var(--color-surface-soft);
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
  gap: 4px;
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

.match-count {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 9px;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.match-list {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.match-loading {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.match-loading__row {
  height: 86px;
  border-top: 1px solid var(--color-border);
  background: linear-gradient(100deg, #f1f5f2 20%, #fbfcfb 44%, #f1f5f2 68%);
  background-size: 220% 100%;
  animation: play-shimmer 1.2s ease-in-out infinite;
}

.match-loading__row:first-child {
  border-top: 0;
}

@keyframes play-shimmer {
  to { background-position: -120% 0; }
}

@media (max-width: 640px) {
  .play-hub {
    gap: 40px;
    padding-bottom: 30px;
  }

  .play-options {
    grid-template-columns: 1fr;
  }

  .play-option {
    min-height: 104px;
    padding: 18px;
  }
}

@media (max-width: 360px) {
  .play-option {
    gap: 11px;
    padding-inline: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .play-option,
  .match-loading__row {
    animation: none;
    transition: none;
  }
}

.play-option--ladder {
  border-color: #163d2b;
  background: #163d2b;
}

.play-option--ladder .play-option__copy strong,
.play-option--ladder .play-option__copy small {
  color: #fff;
}

.play-option--ladder .feature-icon {
  background: rgba(216, 255, 71, 0.12);
  color: #d8ff47;
}

@media (hover: hover) and (pointer: fine) {
  .play-option:not(.play-option--ladder):hover {
    background: #f4f8f5;
    border-color: var(--color-border);
  }

  .play-option--ladder:hover {
    background: #1d4432;
    border-color: #163d2b;
  }
}
</style>
