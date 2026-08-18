<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PersonAvatar from '../../components/PersonAvatar.vue'
import TennisNavIcon from '../../components/compete/TennisNavIcon.vue'
import { useChallengeStore } from '../../stores/challenge'
import { usePlayerStore } from '../../stores/player'

const router = useRouter()
const challengeStore = useChallengeStore()
const playerStore = usePlayerStore()
const queue = ref('received')
const currentPlayer = computed(() => playerStore.currentPlayer)
const isLoading = computed(() => challengeStore.isLoading || playerStore.isLoading)
const error = computed(() => challengeStore.error || playerStore.error)
const receivedChallenges = computed(() =>
  challengeStore.challenges.filter((challenge) => challenge.defenderId === currentPlayer.value?.id),
)
const sentChallenges = computed(() =>
  challengeStore.challenges.filter(
    (challenge) => challenge.challengerId === currentPlayer.value?.id,
  ),
)
const visibleChallenges = computed(() =>
  queue.value === 'received' ? receivedChallenges.value : sentChallenges.value,
)

function otherPlayerId(challenge) {
  return queue.value === 'received' ? challenge.challengerId : challenge.defenderId
}
function otherPlayer(challenge) {
  return playerStore.players.find((player) => player.id === otherPlayerId(challenge)) || null
}
function otherPlayerName(challenge) {
  return (
    otherPlayer(challenge)?.name ||
    (queue.value === 'received' ? challenge.challengerName : challenge.defenderName) ||
    'Club player'
  )
}
function statusLine(challenge) {
  if (challenge.status === 'awaiting')
    return queue.value === 'received' ? 'response needed' : 'waiting for a response'
  if (challenge.status === 'accepted') return 'schedule needs to be agreed'
  if (challenge.status === 'scheduled') return 'match confirmed'
  if (challenge.status === 'ready') return 'ready to start'
  if (challenge.status === 'live') return 'match in progress'
  if (challenge.status === 'pending_review') return 'result ready for review'
  if (challenge.status === 'completed') return 'match completed'
  if (challenge.status === 'declined') return 'challenge declined'
  if (challenge.status === 'cancelled') return 'challenge cancelled'
  if (challenge.status === 'expired') return 'challenge expired'
  return String(challenge.status || 'challenge updated').replaceAll('_', ' ')
}
function openChallenge(challenge) {
  router.push({ name: 'ChallengeDetails', params: { challengeId: challenge.id } })
}
async function loadView() {
  await Promise.all([playerStore.loadPlayers(), challengeStore.loadChallenges()])
}
onMounted(loadView)
</script>

<template>
  <section class="challenge-queues">
    <div class="queue-topline">
      <p>Open a challenge to see its next action, schedule, score, and Ladder outcome.</p>
      <RouterLink class="button-primary" :to="{ name: 'CreateChallenge' }"
        >New challenge</RouterLink
      >
    </div>
    <div class="queue-toggle" role="tablist" aria-label="Challenge queue">
      <button
        type="button"
        role="tab"
        :class="{ active: queue === 'received' }"
        :aria-selected="queue === 'received'"
        @click="queue = 'received'"
      >
        Received
        <span v-if="receivedChallenges.length">{{ receivedChallenges.length }}</span>
      </button>
      <button
        type="button"
        role="tab"
        :class="{ active: queue === 'sent' }"
        :aria-selected="queue === 'sent'"
        @click="queue = 'sent'"
      >
        Sent
        <span v-if="sentChallenges.length">{{ sentChallenges.length }}</span>
      </button>
    </div>

    <div v-if="isLoading" class="queue-loading" aria-label="Loading challenges">
      <span v-for="index in 4" :key="index" class="skeleton-line"></span>
    </div>

    <section v-else-if="error" class="queue-error" role="alert">
      <div>
        <h2>We could not load your challenges</h2>
        <p>{{ error }}</p>
      </div>
      <button class="button-secondary" type="button" @click="loadView">Try again</button>
    </section>

    <div v-else-if="visibleChallenges.length" class="challenge-list">
      <article v-for="challenge in visibleChallenges" :key="challenge.id" class="challenge-row">
        <PersonAvatar
          :name="otherPlayerName(challenge)"
          :image="otherPlayer(challenge)?.imageUrl || ''"
          :size="42"
        />

        <div class="challenge-row__copy">
          <strong>{{ otherPlayerName(challenge) }}</strong>
          <span>{{ statusLine(challenge) }}</span>
        </div>

        <button
          class="button-secondary challenge-row__action"
          type="button"
          @click="openChallenge(challenge)"
        >
          View details
        </button>
      </article>
    </div>

    <section v-else class="queue-empty">
      <TennisNavIcon kind="challenge" :size="22" />
      <strong>No {{ queue }} challenges</strong>
      <p>
        {{
          queue === 'received'
            ? 'New challenges from nearby players will appear here.'
            : 'Challenges you send will stay here while you track them.'
        }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.challenge-queues {
  display: grid;
  gap: 18px;
}

.queue-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.queue-topline p {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
}

.queue-toggle {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(112px, 1fr));
  gap: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  background: transparent;
}

.queue-toggle button {
  position: relative;
  min-height: 46px;
  gap: 7px;
  overflow: hidden;
  padding: 8px 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}

.queue-toggle button.active {
  background: transparent;
  color: var(--color-primary-strong);
  box-shadow: none;
  animation: tennisFilterSwing 620ms var(--motion-spring);
}

.queue-toggle button.active::after {
  content: '';
  position: absolute;
  inset: auto 14% -1px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--color-primary);
}

@keyframes tennisFilterSwing {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  30% {
    transform: translate3d(-4px, 0, 0) rotate(-1deg);
  }
  58% {
    transform: translate3d(6px, -2px, 0) rotate(1deg);
  }
  78% {
    transform: translate3d(-1px, 0, 0);
  }
}

.queue-toggle button span {
  display: grid;
  min-width: 19px;
  height: 19px;
  padding-inline: 5px;
  place-items: center;
  border-radius: 999px;
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
  font-size: 9px;
}

.challenge-list {
  display: grid;
  gap: 10px;
}

.queue-loading {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.challenge-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  min-height: 72px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  border-radius: var(--app-card-radius);
  background: rgba(249, 252, 249, 0.78);
  box-shadow: 0 6px 18px rgba(15, 34, 24, 0.035);
}

.challenge-row:last-child {
  border-bottom: 0;
}

.challenge-row__copy {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.challenge-row__copy strong,
.challenge-row__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.challenge-row__copy strong {
  color: var(--color-text);
  font-size: 14px;
}

.challenge-row__copy span {
  color: var(--color-muted);
  font-size: 13px;
}

.challenge-row__icon-actions {
  display: flex;
  gap: 7px;
}

.icon-action {
  display: grid;
  width: 40px;
  min-width: 40px;
  min-height: 36px;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
}

.icon-action svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-action--neutral {
  background: var(--color-surface);
  color: var(--color-text-soft);
}

.icon-action--accept {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-light);
}

.challenge-row__action {
  min-height: 38px;
  padding: 8px 12px;
}

.queue-loading {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.queue-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.queue-error h2,
.queue-error p,
.queue-empty p {
  margin: 0;
}

.queue-error h2 {
  font-size: 14px;
}

.queue-error p,
.queue-empty p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 12px;
}

.queue-empty {
  display: grid;
  min-height: 220px;
  place-items: center;
  align-content: center;
  text-align: center;
}

.queue-empty :deep(.tennis-nav-icon) {
  margin-bottom: 8px;
}

.queue-empty strong {
  color: var(--color-text);
  font-size: 14px;
}

@media (max-width: 520px) {
  .queue-toggle {
    width: 100%;
  }
  .challenge-row {
    grid-template-columns: 38px minmax(0, 1fr) auto;
    min-height: 68px;
    gap: 9px;
    padding: 10px;
  }
  .challenge-row :deep(.person-avatar) {
    width: 38px !important;
    height: 38px !important;
  }
  .challenge-row__action {
    max-width: 104px;
    font-size: 11px;
  }
  .queue-error {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .queue-toggle button.active {
    animation: none;
  }
}
</style>
