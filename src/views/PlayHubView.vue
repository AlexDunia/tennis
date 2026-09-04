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
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const friendlyMatchStore = useFriendlyMatchStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()
const hasLoaded = ref(false)

const currentPlayerId = computed(() => playerStore.currentPlayerId)
const readyMatches = computed(() =>
  matchStore.matches
    .filter(
      (match) =>
        (match.type === 'ladder'
          ? ['accepted', 'scheduled', 'ready', 'live'].includes(match.status)
          : ['pending', 'scheduled', 'live'].includes(match.status)) &&
        [match.player1Id, match.player2Id, match.challengerId, match.defenderId].includes(
          currentPlayerId.value,
        ),
    )
    .slice(0, 3),
)

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

async function continueMatch(match) {
  if (match.type === 'ladder') {
    const result = await startOrResumeLadderMatch({
      match,
      actorId: currentPlayerId.value,
      clubId: adminStore.activeClubId || '',
      explicitStart: true,
    })
    if (!result.ok) {
      notificationStore.addToast({
        message: result.message || 'This Ladder Match cannot be continued yet.',
        type: 'warning',
      })
      return
    }
    router.push({ name: 'LiveMatch', params: { matchId: result.match.id } })
    return
  }
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
    router.push({ name: 'LiveMatch', params: { matchId: result.match.id } })
    return
  }
  router.push({ name: 'MatchDetails', params: { matchId: match.id } })
}

function matchName(match) {
  return `${match.player1Name || match.challengerName || 'Player 1'} vs ${
    match.player2Name || match.defenderName || 'Player 2'
  }`
}

function matchTypeLabel(match) {
  if (match.type === 'tournament') return 'Tournament match'
  if (match.type === 'ladder') return 'Ladder match'
  return 'Match'
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

        <button type="button" class="play-option" @click="startMatch('ladder')">
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
          <p>Matches ready for your next action.</p>
        </div>
        <span v-if="readyMatches.length" class="match-count">{{ readyMatches.length }}</span>
      </header>

      <div v-if="matchStore.isLoading && !hasLoaded" class="match-loading" aria-label="Loading your matches">
        <span v-for="row in 3" :key="row" class="match-loading__row"></span>
      </div>

      <div v-else-if="readyMatches.length" class="match-list">
        <article v-for="match in readyMatches" :key="match.id" class="match-row">
          <span class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M5.7 6.4c2.8 1.9 4.1 4.4 4.5 7.4M18.3 17.6c-2.8-1.9-4.1-4.4-4.5-7.4" />
            </svg>
          </span>
          <div class="match-row__copy">
            <span>{{ match.statusLabel || match.status }}</span>
            <strong>{{ matchName(match) }}</strong>
            <small>{{ matchTypeLabel(match) }}</small>
          </div>
          <button type="button" class="match-row__action" @click="continueMatch(match)">
            Continue
          </button>
        </article>
      </div>

      <EmptyState
        v-else
        compact
        variant="quiet"
        illustration="matches"
        title="No matches yet"
        description="Matches involving you will appear here."
      />
    </section>
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.play-option {
  display: grid;
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

.play-option__copy,
.match-row__copy {
  display: grid;
  min-width: 0;
}

.play-option__copy {
  gap: 4px;
}

.play-option__copy strong,
.match-row__copy strong {
  color: var(--color-text);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.play-option__copy small,
.match-row__copy small {
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

.match-row {
  display: grid;
  min-height: 86px;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.match-row:first-child {
  border-top: 0;
}

.match-row__copy {
  gap: 2px;
}

.match-row__copy > span {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  line-height: 1.4;
  text-transform: uppercase;
}

.match-row__action {
  min-height: 42px;
  padding: 0 15px;
  border: 1px solid var(--color-border-strong);
  border-radius: 9px;
  background: var(--color-surface);
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.match-row__action:hover {
  border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border));
  background: var(--color-surface-softest);
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

  .match-row {
    grid-template-columns: 38px minmax(0, 1fr);
    padding: 16px;
  }

  .match-row__action {
    grid-column: 2;
    justify-self: start;
  }
}

@media (max-width: 360px) {
  .play-option,
  .match-row {
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
</style>
