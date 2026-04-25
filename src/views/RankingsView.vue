<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'

const router = useRouter()
const playerStore = usePlayerStore()

const sortedPlayers = computed(() => playerStore.sortedLadder)
const currentPlayer = computed(() => playerStore.currentPlayer)

const winRate = computed(() => {
  const p = currentPlayer.value
  if (!p) return '—'
  const total = p.wins + p.losses
  if (total === 0) return '—'
  return `${Math.round((p.wins / total) * 100)}%`
})

const initials = computed(() => {
  if (!currentPlayer.value?.name) return '??'
  const parts = currentPlayer.value.name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return currentPlayer.value.name.slice(0, 2).toUpperCase()
})

const nextTarget = computed(() => playerStore.availableOpponents[0] ?? null)

const challengeablePlayers = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'challengeable'),
)

const selfPlayer = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'self'),
)

const outOfRangePlayers = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'out-of-range'),
)

const handleChallenge = (playerId) => {
  router.push({ name: 'CreateChallenge', query: { opponent: playerId } })
}

const getInitials = (name) => {
  const parts = (name ?? '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name ?? '').slice(0, 2).toUpperCase()
}

const calcWinRate = (player) => {
  const total = player.wins + player.losses
  if (total === 0) return '—'
  return `${Math.round((player.wins / total) * 100)}%`
}

const loadRankings = async () => {
  await playerStore.loadPlayers()
}

onMounted(() => loadRankings())
</script>

<template>
  <section class="rankings">
    <!-- Loading -->
    <div v-if="playerStore.isLoading" class="rankings__loading">
      <p>Loading ladder…</p>
    </div>

    <!-- Error -->
    <div v-else-if="playerStore.error" class="rankings__error">
      <p class="rankings__error-title">Failed to load rankings</p>
      <p class="rankings__error-copy">{{ playerStore.error }}</p>
      <button class="rankings__retry" @click="loadRankings">Retry</button>
    </div>

    <template v-else>
      <!-- Top summary grid -->
      <div class="top">
        <!-- Your position card (green gradient) -->
        <div v-if="currentPlayer" class="card primary">
          <img
            class="ball"
            src="https://res.cloudinary.com/dnuhjsckk/image/upload/v1776969016/ujk_nf7ts1.png"
            alt=""
          />

          <div class="section-title">Your Position</div>

          <div class="identity">
            <div class="avatar">{{ initials }}</div>
            <div>
              <div class="name">{{ currentPlayer.name }}</div>
              <div class="rank-sub">Rank #{{ currentPlayer.rank }}</div>
            </div>
          </div>

          <div class="stats">
            <div class="stat">
              <strong>{{ currentPlayer.wins }}</strong>
              <span>Wins</span>
            </div>
            <div class="stat">
              <strong>{{ currentPlayer.losses }}</strong>
              <span>Losses</span>
            </div>
            <div class="stat">
              <strong>{{ winRate }}</strong>
              <span>Win Rate</span>
            </div>
            <div class="stat">
              <strong>{{ currentPlayer.matchesPlayed }}</strong>
              <span>Played</span>
            </div>
          </div>
        </div>

        <!-- Next target card -->
        <div class="card">
          <div class="section-title">Next Target</div>

          <template v-if="nextTarget">
            <div class="challenge-box">
              <div>
                <div class="rank-sub">Rank #{{ nextTarget.rank }}</div>
                <div class="name">{{ nextTarget.name }}</div>
              </div>
              <button class="btn" @click="handleChallenge(nextTarget.id)">Challenge</button>
            </div>

            <!-- Extra targets if more than one available -->
            <ul v-if="playerStore.availableOpponents.length > 1" class="extra-targets">
              <li
                v-for="opp in playerStore.availableOpponents.slice(1)"
                :key="opp.id"
                class="extra-target-row"
              >
                <span class="extra-badge">#{{ opp.rank }}</span>
                <span class="extra-name">{{ opp.name }}</span>
                <button class="btn btn--sm" @click="handleChallenge(opp.id)">Challenge</button>
              </li>
            </ul>
          </template>

          <p v-else class="no-targets">No open targets right now. Keep climbing.</p>
        </div>
      </div>

      <!-- Leaderboard -->
      <div v-if="sortedPlayers.length > 0" class="leaderboard-container">
        <div class="leaderboard-top">
          <div class="leaderboard-title">Leaderboard</div>
        </div>

        <div class="leaderboard-inner">
          <!-- Column headers -->
          <div class="leaderboard-header">
            <div>Rank</div>
            <div>Player</div>
            <div>W</div>
            <div>L</div>
            <div>WR</div>
            <div></div>
          </div>

          <!-- Zone: challengeable -->
          <template v-if="challengeablePlayers.length > 0">
            <div class="zone-bar zone-bar--green">
              <span class="zone-dot zone-dot--green" />
              <span class="zone-label zone-label--green">
                Challenge window —
                {{ challengeablePlayers.length }}
                {{ challengeablePlayers.length === 1 ? 'player' : 'players' }} above you
              </span>
            </div>
            <div
              v-for="player in challengeablePlayers"
              :key="player.id"
              class="leaderboard-row challengeable"
            >
              <div>#{{ player.rank }}</div>
              <div class="player">
                <div class="avatar">{{ getInitials(player.name) }}</div>
                {{ player.name }}
              </div>
              <div>{{ player.wins }}</div>
              <div>{{ player.losses }}</div>
              <div class="winrate">{{ calcWinRate(player) }}</div>
              <div class="action">
                <button class="btn" @click="handleChallenge(player.id)">Challenge</button>
              </div>
            </div>
          </template>

          <!-- Zone: self -->
          <template v-if="selfPlayer.length > 0">
            <div class="zone-bar zone-bar--amber">
              <span class="zone-dot zone-dot--amber" />
              <span class="zone-label zone-label--amber">Your position</span>
            </div>
            <div v-for="player in selfPlayer" :key="player.id" class="leaderboard-row you">
              <div>#{{ player.rank }}</div>
              <div class="player">
                <div class="avatar">{{ getInitials(player.name) }}</div>
                {{ player.name }}
                <span class="tag">YOU</span>
              </div>
              <div>{{ player.wins }}</div>
              <div>{{ player.losses }}</div>
              <div class="winrate">{{ calcWinRate(player) }}</div>
              <div></div>
            </div>
          </template>

          <!-- Zone: out of range -->
          <template v-if="outOfRangePlayers.length > 0">
            <div class="zone-bar">
              <span class="zone-dot" />
              <span class="zone-label">Out of challenge range</span>
            </div>
            <div v-for="player in outOfRangePlayers" :key="player.id" class="leaderboard-row">
              <div>#{{ player.rank }}</div>
              <div class="player">
                <div class="avatar">{{ getInitials(player.name) }}</div>
                {{ player.name }}
              </div>
              <div>{{ player.wins }}</div>
              <div>{{ player.losses }}</div>
              <div class="winrate">{{ calcWinRate(player) }}</div>
              <div></div>
            </div>
          </template>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="rankings__empty">
        <p class="rankings__empty-title">No players on the ladder yet.</p>
        <p class="rankings__empty-copy">Check back once players have been added.</p>
      </div>
    </template>
  </section>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

.rankings {
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  display: grid;
  gap: 32px;
}

/* LOADING */
.rankings__loading {
  padding: 3rem 1rem;
  text-align: center;
  color: #7b8794;
  font-size: 14px;
}

/* ERROR */
.rankings__error {
  padding: 18px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
  display: grid;
  gap: 8px;
}

.rankings__error-title {
  font-weight: 600;
  font-size: 14px;
  color: #0f1720;
}

.rankings__error-copy {
  color: #7b8794;
  font-size: 13px;
}

.rankings__retry {
  justify-self: start;
  background: #00c853;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
}

/* GRID */
.top {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
}

/* CARD */
.card {
  padding: 18px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
}

/* GREEN CARD */
.card.primary {
  position: relative;
  overflow: hidden;
  color: #f4fff7;
  border: none;
  box-shadow: 0 10px 24px rgba(0, 200, 83, 0.1);
}

.card.primary::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #00b84a 0%, #4cd964 50%, #c6f300 100%);
  opacity: 0.85;
  z-index: 0;
}

.card.primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.08);
  z-index: 0;
}

.card.primary .ball {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);
  width: 220px;
  opacity: 0.35;
  filter: blur(1px);
  z-index: 1;
}

.card.primary * {
  position: relative;
  z-index: 2;
}

/* TITLES */
.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #7b8794;
  margin-bottom: 14px;
}

.card.primary .section-title {
  color: rgba(255, 255, 255, 0.75);
}

/* IDENTITY */
.identity {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-bottom: 14px;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #eef2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 13px;
}

.card.primary .avatar {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.name {
  font-size: 14px;
  font-weight: 500;
}

.rank-sub {
  font-size: 12px;
  color: #7b8794;
}

.card.primary .rank-sub {
  color: rgba(255, 255, 255, 0.75);
}

/* STATS */
.stats {
  display: flex;
  margin-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.card.primary .stats {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.stat {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  position: relative;
}

.stat:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 24px;
  background: rgba(0, 0, 0, 0.06);
}

.card.primary .stat:not(:last-child)::after {
  background: rgba(255, 255, 255, 0.25);
}

.stat strong {
  display: block;
  font-size: 14px;
  font-weight: 500;
}

.stat span {
  display: block;
  font-size: 11px;
  color: #7b8794;
}

.card.primary .stat span {
  color: rgba(255, 255, 255, 0.7);
}

/* CHALLENGE BOX */
.challenge-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 10px;
  background: rgba(0, 200, 83, 0.04);
}

.btn {
  background: #00c853;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
}

/* EXTRA TARGETS (Vue-only addition for multiple opponents) */
.extra-targets {
  list-style: none;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  padding-top: 10px;
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.extra-target-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extra-badge {
  font-size: 11px;
  font-weight: 600;
  background: rgba(0, 200, 83, 0.12);
  color: #00843a;
  border-radius: 5px;
  padding: 2px 6px;
  min-width: 28px;
  text-align: center;
}

.extra-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #0f1720;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-targets {
  font-size: 13px;
  color: #7b8794;
  padding: 12px 0;
}

/* LEADERBOARD */
.leaderboard-container {
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
}

.leaderboard-top {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.leaderboard-title {
  font-size: 14px;
  font-weight: 500;
}

.leaderboard-inner {
  padding: 12px 16px 6px;
}

.leaderboard-header {
  display: grid;
  grid-template-columns: 60px 1fr 60px 60px 80px 120px;
  font-size: 12px;
  color: #7b8794;
}

.leaderboard-row {
  display: grid;
  grid-template-columns: 60px 1fr 60px 60px 80px 120px;
  align-items: center;
  padding: 14px 0;
}

.leaderboard-row:not(:last-child) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.leaderboard-row.you {
  background: rgba(255, 211, 61, 0.08);
}

.leaderboard-row.challengeable {
  background: rgba(0, 200, 83, 0.04);
}

.player {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.leaderboard-row .avatar {
  width: 32px;
  height: 32px;
  font-size: 11px;
  flex-shrink: 0;
}

.tag {
  font-size: 10px;
  background: #ffd33d;
  padding: 2px 6px;
  border-radius: 4px;
}

.winrate {
  color: #00c853;
  font-size: 13px;
}

.action {
  display: flex;
  justify-content: flex-end;
}

/* ZONE BARS */
.zone-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  margin: 4px -16px;
}

.zone-bar--green {
  background: rgba(0, 200, 83, 0.04);
}
.zone-bar--amber {
  background: rgba(255, 211, 61, 0.08);
}

.zone-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.zone-dot--green {
  background: #00c853;
}
.zone-dot--amber {
  background: #f5a623;
}

.zone-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #7b8794;
}

.zone-label--green {
  color: #00843a;
}
.zone-label--amber {
  color: #845f00;
}

/* EMPTY */
.rankings__empty {
  padding: 2rem 1.5rem;
  text-align: center;
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.rankings__empty-title {
  font-weight: 600;
  font-size: 14px;
  color: #0f1720;
}

.rankings__empty-copy {
  margin-top: 0.4rem;
  color: #7b8794;
  font-size: 13px;
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .top {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .leaderboard-header {
    display: none;
  }
}
</style>
