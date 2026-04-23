<script setup>
// 1. IMPORTS
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import RankingRow from '../components/RankingRow.vue'
import PersonAvatar from '../components/PersonAvatar.vue'

// 4. ROUTER
const router = useRouter()

// 5. STORES
const playerStore = usePlayerStore()

// 7. COMPUTED
const sortedPlayers = computed(() => playerStore.sortedLadder)
const currentPlayer = computed(() => playerStore.currentPlayer)

const winRate = computed(() => {
  const p = currentPlayer.value
  if (!p) return '—'
  const total = p.wins + p.losses
  if (total === 0) return '—'
  return `${Math.round((p.wins / total) * 100)}%`
})

const challengeablePlayers = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'challengeable'),
)

const selfPlayer = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'self'),
)

const outOfRangePlayers = computed(() =>
  sortedPlayers.value.filter((p) => playerStore.getPlayerZone(p.id) === 'out-of-range'),
)

// 8. METHODS
const handleChallenge = (playerId) => {
  router.push({ name: 'CreateChallenge', query: { opponent: playerId } })
}

const loadRankings = async () => {
  await playerStore.loadPlayers()
}

// 10. LIFECYCLE
onMounted(() => loadRankings())
</script>

<template>
  <section class="rankings">
    <!-- ── Loading ── -->
    <div v-if="playerStore.isLoading" class="rankings__loading">
      <p>Loading ladder…</p>
    </div>

    <!-- ── Error ── -->
    <div v-else-if="playerStore.error" class="rankings__error section-card">
      <p class="rankings__error-title">Failed to load rankings</p>
      <p class="rankings__error-copy">{{ playerStore.error }}</p>
      <button class="rankings__retry" @click="loadRankings">Retry</button>
    </div>

    <template v-else>
      <!-- ══ TOP SUMMARY ROW ══ -->
      <div class="rankings__summary-grid">
        <!-- Your standing -->
        <article v-if="currentPlayer" class="rankings__card">
          <p class="rankings__eyebrow">Your standing</p>

          <div class="rankings__self-row">
            <PersonAvatar :image="currentPlayer.imageUrl" :name="currentPlayer.name" size="44" />
            <div>
              <p class="rankings__self-name">{{ currentPlayer.name }}</p>
              <p class="rankings__self-sub">Rank #{{ currentPlayer.rank }} · Active</p>
            </div>
          </div>

          <div class="rankings__stat-strip">
            <div class="rankings__stat">
              <span class="rankings__stat-n">{{ currentPlayer.wins }}</span>
              <span class="rankings__stat-l">Wins</span>
            </div>
            <div class="rankings__stat">
              <span class="rankings__stat-n">{{ currentPlayer.losses }}</span>
              <span class="rankings__stat-l">Losses</span>
            </div>
            <div class="rankings__stat">
              <span class="rankings__stat-n">{{ winRate }}</span>
              <span class="rankings__stat-l">Win rate</span>
            </div>
            <div class="rankings__stat">
              <span class="rankings__stat-n">{{ currentPlayer.matchesPlayed }}</span>
              <span class="rankings__stat-l">Played</span>
            </div>
          </div>
        </article>

        <!-- Challenge window -->
        <article class="rankings__card">
          <p class="rankings__eyebrow">Challenge window</p>

          <p class="rankings__win-big">
            {{ playerStore.availableOpponents.length }}
            <span class="rankings__win-unit">
              open {{ playerStore.availableOpponents.length === 1 ? 'target' : 'targets' }}
            </span>
          </p>

          <p class="rankings__win-sub">
            Beat any of these players to swap positions on the ladder. Challenges lock once
            accepted.
          </p>

          <ul v-if="playerStore.availableOpponents.length > 0" class="rankings__opp-list">
            <li
              v-for="opp in playerStore.availableOpponents"
              :key="opp.id"
              class="rankings__opp-row"
            >
              <span class="rankings__opp-badge">#{{ opp.rank }}</span>
              <span class="rankings__opp-name">{{ opp.name }}</span>
              <button class="rankings__opp-btn" @click="handleChallenge(opp.id)">Challenge</button>
            </li>
          </ul>

          <p v-else class="rankings__no-opps">No open targets right now. Keep climbing.</p>
        </article>
      </div>

      <!-- ══ LADDER TABLE ══ -->
      <div v-if="sortedPlayers.length > 0" class="rankings__ladder">
        <!-- Table column headers -->
        <div class="rankings__thead">
          <span class="rankings__th"></span>
          <span class="rankings__th">Rank</span>
          <span class="rankings__th">Player</span>
          <span class="rankings__th rankings__th--r">Record</span>
          <span class="rankings__th rankings__th--r">Win rate</span>
          <span class="rankings__th rankings__th--r">Action</span>
        </div>

        <!-- Zone: challengeable -->
        <template v-if="challengeablePlayers.length > 0">
          <div class="rankings__zone-bar rankings__zone-bar--green">
            <span class="rankings__zone-dot rankings__zone-dot--green" />
            <span class="rankings__zone-label rankings__zone-label--green">
              Challenge window — {{ challengeablePlayers.length }}
              {{ challengeablePlayers.length === 1 ? 'player' : 'players' }} above you
            </span>
          </div>
          <RankingRow
            v-for="player in challengeablePlayers"
            :key="player.id"
            :player="player"
            zone="challengeable"
            @challenge="handleChallenge"
          />
        </template>

        <!-- Zone: self -->
        <template v-if="selfPlayer.length > 0">
          <div class="rankings__zone-bar rankings__zone-bar--amber">
            <span class="rankings__zone-dot rankings__zone-dot--amber" />
            <span class="rankings__zone-label rankings__zone-label--amber">Your position</span>
          </div>
          <RankingRow
            v-for="player in selfPlayer"
            :key="player.id"
            :player="player"
            zone="self"
            @challenge="handleChallenge"
          />
        </template>

        <!-- Zone: out of range -->
        <template v-if="outOfRangePlayers.length > 0">
          <div class="rankings__zone-bar">
            <span class="rankings__zone-dot" />
            <span class="rankings__zone-label">Out of challenge range</span>
          </div>
          <RankingRow
            v-for="player in outOfRangePlayers"
            :key="player.id"
            :player="player"
            zone="out-of-range"
            @challenge="handleChallenge"
          />
        </template>
      </div>

      <!-- Empty -->
      <div v-else class="rankings__empty section-card">
        <p class="rankings__empty-title">No players on the ladder yet.</p>
        <p class="rankings__empty-copy">Check back once players have been added.</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* ── Root ── */
.rankings {
  display: grid;
  gap: 1.25rem;
}

/* ── Loading ── */
.rankings__loading {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.95rem;
}

/* ── Error ── */
.rankings__error {
  padding: 1.5rem;
  display: grid;
  gap: 0.5rem;
}

.rankings__error-title {
  font-weight: 700;
  color: var(--color-text);
}

.rankings__error-copy {
  color: var(--color-muted);
  font-size: 0.9rem;
}

.rankings__retry {
  justify-self: start;
  margin-top: 0.25rem;
  padding: 0.4rem 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}

.rankings__retry:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-soft);
}

/* ── Summary grid ── */
.rankings__summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.rankings__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
  box-shadow: var(--shadow-soft);
}

/* ── Eyebrow ── */
.rankings__eyebrow {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-muted);
}

/* ── Self row ── */
.rankings__self-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rankings__self-name {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--color-text);
  line-height: 1.1;
}

.rankings__self-sub {
  font-size: 0.82rem;
  color: var(--color-muted);
  margin-top: 3px;
}

/* ── Stat strip ── */
.rankings__stat-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--color-border);
  padding-top: 0.85rem;
}

.rankings__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rankings__stat + .rankings__stat {
  border-left: 1px solid var(--color-border);
  padding-left: 0.75rem;
}

.rankings__stat-n {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.rankings__stat-l {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

/* ── Win big ── */
.rankings__win-big {
  font-size: 2.1rem;
  font-weight: 800;
  color: var(--color-text);
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.rankings__win-unit {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-muted);
}

.rankings__win-sub {
  font-size: 0.82rem;
  color: var(--color-muted);
  line-height: 1.55;
}

/* ── Opponent quick list ── */
.rankings__opp-list {
  list-style: none;
  border-top: 1px solid var(--color-border);
  padding-top: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.rankings__opp-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.rankings__opp-badge {
  font-size: 0.72rem;
  font-weight: 800;
  background: rgba(0, 181, 26, 0.12);
  color: var(--color-primary-strong);
  border-radius: 5px;
  padding: 2px 6px;
  min-width: 30px;
  text-align: center;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.rankings__opp-name {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rankings__opp-btn {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 11px;
  border-radius: 6px;
  border: 1px solid rgba(0, 181, 26, 0.35);
  background: transparent;
  color: var(--color-primary-strong);
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: 0.02em;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}

.rankings__opp-btn:hover {
  background: rgba(0, 181, 26, 0.08);
  border-color: rgba(0, 181, 26, 0.6);
  box-shadow: 0 1px 4px rgba(0, 181, 26, 0.15);
}

.rankings__no-opps {
  font-size: 0.85rem;
  color: var(--color-muted);
  border-top: 1px solid var(--color-border);
  padding-top: 0.75rem;
}

/* ══ LADDER ══ */
.rankings__ladder {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-soft);
}

/* Column header row */
.rankings__thead {
  display: grid;
  grid-template-columns: 36px 44px 1fr 100px 80px 110px;
  align-items: center;
  gap: 0 10px;
  padding: 9px 16px 9px 14px;
  background: var(--color-bg-muted);
  border-bottom: 1px solid var(--color-border);
}

.rankings__th {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}

.rankings__th--r {
  text-align: right;
}

/* Zone separator bars */
.rankings__zone-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px 7px 14px;
  background: var(--color-bg-muted);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.rankings__zone-bar--green {
  background: rgba(0, 181, 26, 0.04);
}
.rankings__zone-bar--amber {
  background: rgba(255, 211, 61, 0.06);
}

.rankings__zone-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border-strong);
  flex-shrink: 0;
}

.rankings__zone-dot--green {
  background: var(--color-primary);
}
.rankings__zone-dot--amber {
  background: var(--color-accent);
}

.rankings__zone-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}

.rankings__zone-label--green {
  color: var(--color-primary-strong);
}
.rankings__zone-label--amber {
  color: #845f00;
}

/* ── Empty ── */
.rankings__empty {
  padding: 2rem 1.5rem;
  text-align: center;
}

.rankings__empty-title {
  font-weight: 700;
  color: var(--color-text);
}

.rankings__empty-copy {
  margin-top: 0.4rem;
  color: var(--color-muted);
  font-size: 0.9rem;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .rankings__summary-grid {
    grid-template-columns: 1fr;
  }

  .rankings__stat-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 0.75rem;
  }

  .rankings__stat:nth-child(3) {
    border-left: none;
    padding-left: 0;
  }

  .rankings__thead {
    display: none;
  }
}

@media (max-width: 480px) {
  .rankings__win-big {
    font-size: 1.7rem;
  }

  .rankings__ladder {
    border-radius: var(--radius);
  }
}
</style>
