<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import TennisNavIcon from '../../components/compete/TennisNavIcon.vue'
import PersonAvatar from '../../components/PersonAvatar.vue'
import { useAdminStore } from '../../stores/admin'
import { usePlayerStore } from '../../stores/player'

const router = useRouter()
const adminStore = useAdminStore()
const playerStore = usePlayerStore()

const players = computed(() => playerStore.sortedLadder)
const currentPlayer = computed(() => playerStore.currentPlayer)
const canCreateChallenge = computed(() => adminStore.hasActiveClubPermission('challenges.create'))

function pointsFor(player) {
  return Math.max(0, Number(player?.points ?? player?.ladderPoints ?? 0))
}

function isCurrentPlayer(player) {
  return player?.id === playerStore.currentPlayerId
}

function displayPlayerName(player) {
  return isCurrentPlayer(player) ? currentPlayer.value?.name || player.name : player.name
}

function canChallenge(player) {
  return canCreateChallenge.value && playerStore.getPlayerZone(player?.id) === 'challengeable'
}

function challenge(player) {
  router.push({ name: 'CreateChallenge', query: { opponent: player.id } })
}

onMounted(() => playerStore.loadPlayers())
</script>

<template>
  <section class="ladder-view">
    <div v-if="playerStore.isLoading" class="ladder-loading" aria-label="Loading ladder">
      <div class="skeleton-card">
        <span class="skeleton-line"></span>
        <span class="skeleton-line"></span>
      </div>
      <div class="skeleton-card">
        <span v-for="index in 5" :key="index" class="skeleton-line"></span>
      </div>
    </div>

    <section v-else-if="playerStore.error" class="ladder-error" role="alert">
      <div>
        <h2>We could not load the ladder</h2>
        <p>{{ playerStore.error }}</p>
      </div>
      <button class="button-secondary" type="button" @click="playerStore.loadPlayers">
        Try again
      </button>
    </section>

    <template v-else>
      <section v-if="currentPlayer" class="position-summary" aria-label="Your ladder position">
        <div>
          <span class="position-summary__label"
            ><TennisNavIcon kind="ladder" :size="16" />Rank</span
          >
          <strong>#{{ currentPlayer.rank }}</strong>
        </div>
        <div class="position-summary__you">
          <span>You</span>
          <strong>{{ currentPlayer.name }}</strong>
        </div>
        <div class="position-summary__points">
          <span>Points</span>
          <strong>{{ pointsFor(currentPlayer) }}</strong>
        </div>
      </section>

      <section v-if="players.length" class="ladder-list" aria-label="Club ladder">
        <div
          v-for="player in players"
          :key="player.id"
          class="ladder-row"
          :class="{ 'ladder-row--you': isCurrentPlayer(player) }"
        >
          <strong class="ladder-row__rank">#{{ player.rank }}</strong>
          <PersonAvatar :name="displayPlayerName(player)" :image="player.imageUrl" :size="40" />
          <div class="ladder-row__player">
            <strong>{{ displayPlayerName(player) }}</strong>
            <span v-if="isCurrentPlayer(player)">You</span>
          </div>
          <span class="ladder-row__points">{{ pointsFor(player) }} pts</span>
          <button
            v-if="canChallenge(player)"
            class="button-primary ladder-row__action"
            type="button"
            :aria-label="`Challenge ${player.name}`"
            @click="challenge(player)"
          >
            Challenge
          </button>
        </div>
      </section>

      <EmptyState
        v-else
        illustration="ladder"
        title="The ladder is waiting for players"
        description="Club members will appear here once they are added to the active ladder."
      />
    </template>
  </section>
</template>

<style scoped>
.ladder-view,
.ladder-loading {
  display: grid;
  gap: 18px;
}

.ladder-loading .skeleton-card {
  display: grid;
  gap: 12px;
}

.position-summary {
  position: relative;
  display: grid;
  overflow: hidden;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  min-height: 148px;
  padding: 24px 26px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--app-card-radius);
  background:
    linear-gradient(rgba(5, 16, 10, 0.68), rgba(5, 16, 10, 0.68)),
    url('https://res.cloudinary.com/dnuhjsckk/image/upload/v1777007467/tennis-ball-field_ayz5iv.jpg')
      center/cover no-repeat;
  box-shadow: 0 6px 18px rgba(15, 34, 24, 0.06);
}

.position-summary > div {
  display: grid;
  gap: 2px;
}

.position-summary > div > span {
  color: rgba(255, 255, 255, 0.84);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.position-summary strong {
  color: #fff;
  font-size: 19px;
}

.position-summary__label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.position-summary__you {
  min-width: 0;
  padding-inline: 24px;
  border-inline: 1px solid rgba(255, 255, 255, 0.22);
}

.position-summary__you strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.position-summary__points {
  text-align: right;
}

.ladder-list {
  display: grid;
  gap: 12px;
  overflow: visible;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.ladder-row {
  display: grid;
  grid-template-columns: 44px 40px minmax(0, 1fr) 80px auto;
  min-height: 68px;
  align-items: center;
  gap: 12px;
  padding: 11px 15px;
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  border-radius: var(--app-card-radius);
  background: rgba(249, 252, 249, 0.68);
  box-shadow: 0 2px 8px rgba(15, 34, 24, 0.02);
  backdrop-filter: blur(6px);
}

.ladder-row {
  transition:
    background var(--motion-short) ease,
    border-color var(--motion-short) ease;
}

.ladder-row:hover {
  background: color-mix(in srgb, var(--color-primary) 2%, rgba(249, 252, 249, 0.72));
}

.ladder-row:last-child {
  border-bottom: 0;
}

.ladder-row--you {
  background: color-mix(in srgb, var(--color-primary) 8%, rgba(249, 252, 249, 0.8));
}

.ladder-row__rank {
  color: var(--color-text-soft);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  text-align: center;
}

.ladder-row__player {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.ladder-row__player strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladder-row__player span {
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
}

.ladder-row__points {
  color: var(--color-muted);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  text-align: right;
  white-space: nowrap;
}

.ladder-row__action {
  min-height: 38px;
  padding: 8px 12px;
}

.ladder-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.ladder-error h2,
.ladder-error p {
  margin: 0;
}

.ladder-error h2 {
  font-size: 15px;
}

.ladder-error p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 13px;
}

@media (max-width: 640px) {
  .position-summary {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    min-height: 136px;
    padding: 18px 16px;
  }
  .position-summary__you {
    padding-inline: 12px;
  }
  .position-summary strong {
    font-size: 17px;
  }
  .position-summary__you strong {
    font-size: 13px;
  }
  .ladder-list {
    gap: 12px;
  }
  .ladder-row {
    grid-template-columns: 32px 36px minmax(0, 1fr) auto;
    min-height: 68px;
    gap: 10px;
    padding: 11px 12px;
  }
  .ladder-row :deep(.person-avatar) {
    width: 36px !important;
    height: 36px !important;
  }
  .ladder-row__points {
    grid-column: 4;
    grid-row: 1;
  }
  .ladder-row__action {
    grid-column: 4;
    grid-row: 1;
    min-height: 36px;
    font-size: 11px;
  }
  .ladder-row:has(.ladder-row__action) .ladder-row__points {
    display: none;
  }
  .ladder-row__player span {
    display: none;
  }
  .ladder-error {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
