<script setup>
import CategoryStatusBadge from './CategoryStatusBadge.vue'
import { formatAppDateWithTime } from '../../utils/dateFormat'

const props = defineProps({
  match: {
    type: Object,
    required: true,
  },
  canManage: {
    type: Boolean,
    default: false,
  },
  currentPlayerId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  live: (match) => Boolean(match),
  score: (match) => Boolean(match),
  view: (match) => Boolean(match),
})

function canScoreMatch(match) {
  return (
    props.canManage &&
    ['pending', 'scheduled', 'completed', 'walkover'].includes(match.status) &&
    match.player1Id &&
    match.player2Id
  )
}

function scoreActionLabel(match) {
  return ['completed', 'walkover'].includes(match.status) ? 'Edit Result' : 'Enter Score'
}

function isCurrentPlayer(playerId) {
  return Boolean(props.currentPlayerId && playerId === props.currentPlayerId)
}

function isCurrentPlayerMatch(match) {
  return isCurrentPlayer(match.player1Id) || isCurrentPlayer(match.player2Id)
}
</script>

<template>
  <article
    class="match-fixture-card t-fade-up"
    :class="{
      'match-fixture-card--bye': match.isBye,
      'match-fixture-card--current-player': isCurrentPlayerMatch(match),
    }"
  >
    <div class="match-fixture-card__top">
      <div class="match-fixture-card__badges">
        <span class="match-fixture-card__round">
          {{ match.groupId ? `Group ${match.groupId}` : match.matchCode || match.round }}
        </span>
        <span v-if="isCurrentPlayerMatch(match)" class="match-fixture-card__you">Your match</span>
        <CategoryStatusBadge :status="match.status" />
      </div>
      <strong v-if="match.score" class="match-fixture-card__score">{{ match.score }}</strong>
    </div>

    <div v-if="match.isBye" class="match-fixture-card__bye">
      {{ match.player1Name === 'BYE' ? match.player2Name : match.player1Name }} receives a BYE.
    </div>

    <div v-else class="match-fixture-card__body">
      <div
        class="match-fixture-card__player"
        :class="{ 'match-fixture-card__player--current': isCurrentPlayer(match.player1Id) }"
      >
        <span>{{ match.player1Seed || '-' }}</span>
        <strong>{{ match.player1Name || 'TBD' }}</strong>
        <small v-if="isCurrentPlayer(match.player1Id)">You</small>
      </div>
      <small>vs</small>
      <div
        class="match-fixture-card__player"
        :class="{ 'match-fixture-card__player--current': isCurrentPlayer(match.player2Id) }"
      >
        <span>{{ match.player2Seed || '-' }}</span>
        <strong>{{ match.player2Name || 'TBD' }}</strong>
        <small v-if="isCurrentPlayer(match.player2Id)">You</small>
      </div>
    </div>

    <footer class="match-fixture-card__footer">
      <div class="match-fixture-card__meta">
        <span>{{ formatAppDateWithTime(match.scheduledDate, match.scheduledTime, { fallback: 'Not yet scheduled' }) }}</span>
        <span>{{ match.court || 'No court' }}</span>
      </div>
      <div v-if="!match.isBye" class="match-fixture-card__actions">
        <button
          v-if="['pending', 'scheduled'].includes(match.status)"
          v-show="canManage"
          class="t-button t-button--secondary"
          type="button"
          @click="emit('live', match)"
        >
          Live Board
        </button>
        <button
          v-if="canScoreMatch(match)"
          class="t-button t-button--primary"
          type="button"
          @click="emit('score', match)"
        >
          {{ scoreActionLabel(match) }}
        </button>
        <button
          v-if="!canManage || match.status !== 'pending'"
          class="t-button t-button--secondary"
          type="button"
          @click="emit('view', match)"
        >
          View Match
        </button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.match-fixture-card {
  display: grid;
  gap: 12px;
  border: 0.5px solid var(--tournament-line);
  border-radius: 10px;
  background: #ffffff;
  padding: 14px 16px;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.match-fixture-card:hover {
  border-color: rgba(0, 181, 26, 0.28);
  box-shadow: none;
}

.match-fixture-card--bye {
  background: var(--tournament-shell);
  opacity: 0.78;
}

.match-fixture-card--current-player {
  border-color: rgba(0, 181, 26, 0.42);
  background: linear-gradient(180deg, #ffffff 0%, rgba(0, 181, 26, 0.045) 100%);
}

.match-fixture-card__top,
.match-fixture-card__footer,
.match-fixture-card__badges,
.match-fixture-card__actions,
.match-fixture-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.match-fixture-card__top,
.match-fixture-card__footer {
  justify-content: space-between;
}

.match-fixture-card__round {
  border-radius: 20px;
  padding: 3px 9px;
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
  font-size: 11px;
  font-weight: 800;
}

.match-fixture-card__score {
  color: var(--tournament-green-dark);
  font-size: 16px;
}

.match-fixture-card__you {
  border-radius: 999px;
  padding: 3px 9px;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 11px;
  font-weight: 900;
}

.match-fixture-card__body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.match-fixture-card__player {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
}

.match-fixture-card__player--current {
  border-radius: 999px;
  padding: 3px 7px 3px 3px;
  background: var(--tournament-green-soft);
}

.match-fixture-card__player span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--tournament-shell);
  color: var(--tournament-muted);
  font-size: 10px;
  font-weight: 800;
}

.match-fixture-card__player strong {
  min-width: 0;
  color: var(--tournament-ink);
  font-weight: 800;
}

.match-fixture-card__player small {
  border-radius: 999px;
  padding: 1px 6px;
  background: #ffffff;
  color: var(--tournament-green-dark);
  font-size: 10px;
  font-weight: 900;
}

.match-fixture-card__body small {
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.match-fixture-card__body .match-fixture-card__player small {
  border-radius: 999px;
  padding: 1px 6px;
  background: #ffffff;
  color: var(--tournament-green-dark);
  font-size: 10px;
  font-weight: 900;
  text-transform: none;
}

.match-fixture-card__meta {
  flex-wrap: wrap;
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 700;
}

.match-fixture-card__meta span + span::before {
  content: '.';
  margin-right: 8px;
}

.match-fixture-card__bye {
  color: var(--tournament-muted);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 640px) {
  .match-fixture-card__top,
  .match-fixture-card__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
