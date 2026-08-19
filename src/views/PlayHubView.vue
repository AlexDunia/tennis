<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const friendlyMatchStore = useFriendlyMatchStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()

const currentPlayerId = computed(() => playerStore.currentPlayerId)
const readyMatches = computed(() =>
  matchStore.matches
    .filter(
      (match) =>
        ['pending', 'scheduled', 'pending_review'].includes(match.status) &&
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

  router.push({ name: 'FriendlyMatchType' })
}

function continueMatch(match) {
  router.push({ name: 'PlayMatch', params: { matchId: match.id } })
}

onMounted(() => {
  Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
})
</script>

<template>
  <section class="play-hub" aria-labelledby="play-hub-title">
    <header class="play-hub__intro">
      <p class="play-hub__eyebrow">Ready when you are</p>
      <h1 id="play-hub-title">Get on court.</h1>
      <p>
        Choose the match you want to play. Each option continues into GORRA's existing match flow.
      </p>
    </header>

    <div class="play-hub__actions">
      <button
        type="button"
        class="play-option play-option--primary"
        @click="startMatch('friendly')"
      >
        <span class="play-option__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18" /></svg>
        </span>
        <span
          ><strong>Start friendly match</strong
          ><small>Play without changing the ladder.</small></span
        >
        <b aria-hidden="true">›</b>
      </button>

      <button type="button" class="play-option" @click="startMatch('ladder')">
        <span class="play-option__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 19V11M12 19V5M19 19v-6" /></svg>
        </span>
        <span
          ><strong>Start ladder match</strong
          ><small>Use the club ladder rules and eligible opponents.</small></span
        >
        <b aria-hidden="true">›</b>
      </button>
    </div>

    <section class="play-hub__ready" aria-labelledby="ready-matches-title">
      <div class="play-hub__section-heading">
        <div>
          <p class="play-hub__eyebrow">Your matches</p>
          <h2 id="ready-matches-title">Ready to continue</h2>
        </div>
        <span v-if="readyMatches.length">{{ readyMatches.length }}</span>
      </div>

      <div v-if="readyMatches.length" class="ready-list">
        <button
          v-for="match in readyMatches"
          :key="match.id"
          type="button"
          class="ready-match"
          @click="continueMatch(match)"
        >
          <span>
            <strong>
              {{ match.player1Name || match.challengerName || 'Player 1' }} vs
              {{ match.player2Name || match.defenderName || 'Player 2' }}
            </strong>
            <small>{{ match.statusLabel || match.status }}</small>
          </span>
          <b>Continue</b>
        </button>
      </div>

      <EmptyState
        v-else
        compact
        variant="quiet"
        illustration="matches"
        title="No match waiting"
        description="Scheduled and accepted matches will appear here when they are ready."
      />
    </section>
  </section>
</template>

<style scoped>
.play-hub {
  width: min(100%, 900px);
  display: grid;
  gap: 28px;
}

.play-hub__intro,
.play-hub__section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.play-hub__intro {
  display: grid;
  gap: 6px;
  max-width: 620px;
}

.play-hub__intro h1,
.play-hub__intro p,
.play-hub__section-heading h2,
.play-hub__section-heading p {
  margin: 0;
}

.play-hub__intro h1 {
  font-size: 22px;
}

.play-hub__intro > p:last-child {
  max-width: 58ch;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.65;
}

.play-hub__eyebrow {
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.play-hub__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.play-option {
  min-height: 120px;
  justify-content: flex-start;
  gap: 15px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  white-space: normal;
  box-shadow: var(--shadow-soft);
}

.play-option--primary {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.play-option__icon {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
}

.play-option__icon svg {
  width: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.play-option > span:nth-child(2) {
  display: grid;
  flex: 1;
  gap: 4px;
}

.play-option strong,
.play-option small {
  display: block;
}

.play-option strong {
  font-size: 14px;
}

.play-option small {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}

.play-option > b {
  color: var(--color-muted);
  font-size: 22px;
}

.play-hub__ready {
  display: grid;
  gap: 14px;
  padding-top: 6px;
}

.play-hub__section-heading h2 {
  font-size: 18px;
}

.play-hub__section-heading > span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-bold);
}

.ready-list {
  display: grid;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.ready-match {
  width: 100%;
  min-height: 72px;
  justify-content: space-between;
  padding: 14px 18px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.ready-match:last-child {
  border-bottom: 0;
}

.ready-match span {
  display: grid;
  gap: 3px;
}

.ready-match small {
  color: var(--color-muted);
}

.ready-match > b {
  color: var(--color-primary-strong);
  font-size: 12px;
}

@media (max-width: 640px) {
  .play-hub {
    gap: 24px;
  }

  .play-hub__actions {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .play-option {
    min-height: 104px;
    padding: 17px;
  }
}
</style>
