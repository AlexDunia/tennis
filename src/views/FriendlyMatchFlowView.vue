<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { usePlayerStore } from '../stores/player'

const route = useRoute()
const router = useRouter()
const friendlyMatchStore = useFriendlyMatchStore()
const playerStore = usePlayerStore()
const inlineNote = ref('')
const searchQuery = ref('')

const step = computed(() => String(route.meta.friendlyStep || 'type'))
const isLadder = computed(() => friendlyMatchStore.draft.matchType === 'ladder')
const selectedOpponentId = computed(() => friendlyMatchStore.draft.opponent?.id || '')
const opponentName = computed(() => friendlyMatchStore.draft.opponent?.name || 'Opponent')
const pageTitle = computed(() => ({ type: 'New match', opponent: 'Choose opponent', format: 'Scoring format' }[step.value] || 'Match'))

const clubOpponents = computed(() => {
  const loadedPlayers = playerStore.players
    .filter((player) => player.id !== playerStore.currentPlayerId)
    .map((player) => ({
      id: player.id,
      name: player.name,
      rank: player.rank || null,
      division: player.category || player.division || 'Club Member',
    }))
  return loadedPlayers.length ? loadedPlayers : friendlyMatchStore.opponents
})

const availableOpponents = computed(() => {
  const source = isLadder.value ? friendlyMatchStore.ladderOpponents : clubOpponents.value
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return source
  return source.filter((player) =>
    [player.name, player.division, player.rank ? `rank ${player.rank}` : '']
      .some((value) => String(value || '').toLowerCase().includes(query)),
  )
})

const backRoute = computed(() => ({
  type: { name: 'Dashboard' },
  opponent: { name: 'FriendlyMatchType' },
  format: { name: 'FriendlyMatchOpponent' },
  live: { name: 'FriendlyMatchFormat' },
}[step.value]))

function guardStep() {
  if (step.value === 'opponent' && !['friendly', 'ladder'].includes(friendlyMatchStore.draft.matchType)) {
    router.replace({ name: 'FriendlyMatchType' })
  } else if (step.value === 'format' && !friendlyMatchStore.draft.opponent) {
    router.replace({ name: 'FriendlyMatchOpponent' })
  } else if (step.value === 'live' && !friendlyMatchStore.draft.format) {
    router.replace({ name: 'FriendlyMatchFormat' })
  }
}

function goBack() { router.push(backRoute.value) }
function chooseMatchType(type) {
  inlineNote.value = ''
  friendlyMatchStore.chooseMatchType(type)
  router.push({ name: 'FriendlyMatchOpponent' })
}
function showTournamentNotice() {
  inlineNote.value = 'No tournament is running at Emerald Courts right now. You can still create a friendly match or ladder challenge.'
}
function chooseOpponent(opponent) { friendlyMatchStore.chooseOpponent(opponent) }
function continueToFormat() {
  if (friendlyMatchStore.draft.opponent) router.push({ name: 'FriendlyMatchFormat' })
}
function chooseFormat(format) {
  friendlyMatchStore.chooseFormat(format)
  router.push({ name: 'FriendlyMatchLive' })
}
function finishMatch() {
  friendlyMatchStore.endMatch()
  router.push({ name: 'Dashboard' })
}
function initials(name) {
  return name.split(/s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

onMounted(() => {
  guardStep()
  if (!playerStore.players.length && !playerStore.isLoading) playerStore.loadPlayers()
})
watch(step, () => {
  inlineNote.value = ''
  searchQuery.value = ''
  guardStep()
})
</script>

<template>
  <main class="friendly-flow">
    <header class="friendly-flow__header">
      <button type="button" class="friendly-flow__back" aria-label="Go back" @click="goBack">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
      </button>
      <h1 v-if="step !== 'live'">{{ pageTitle }}</h1>
      <span v-if="step !== 'live'" class="friendly-flow__step">
        {{ { type: '1 of 3', opponent: '2 of 3', format: '3 of 3' }[step] }}
      </span>
    </header>

    <section v-if="step === 'type'" class="friendly-flow__screen" aria-labelledby="match-type-title">
      <div class="friendly-flow__intro">
        <p class="friendly-flow__eyebrow">Choose one</p>
        <h2 id="match-type-title">What kind of match are you playing?</h2>
      </div>

      <p v-if="inlineNote" class="friendly-flow__notice" role="status">{{ inlineNote }}</p>

      <div class="friendly-flow__choices friendly-flow__choices--stacked">
        <button type="button" class="choice-card choice-card--friendly" @click="chooseMatchType('friendly')">
          <span><strong>Friendly match</strong><small>Search any existing club member and play without affecting rankings.</small></span>
          <span class="choice-card__arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="choice-card" @click="chooseMatchType('ladder')">
          <span><strong>Ladder challenge</strong><small>You are rank #6. See only the players you are eligible to challenge.</small></span>
          <span class="choice-card__arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="choice-card choice-card--muted" @click="showTournamentNotice">
          <span><strong>Tournament match</strong><small>Part of an organized event</small></span>
        </button>
      </div>
    </section>

    <section v-else-if="step === 'opponent'" class="friendly-flow__screen" aria-labelledby="opponent-title">
      <div class="friendly-flow__intro">
        <p class="friendly-flow__eyebrow">{{ isLadder ? `Rank #${friendlyMatchStore.currentLadderRank} · Eligible players` : 'Club members' }}</p>
        <h2 id="opponent-title">Who are you playing?</h2>
        <p>{{ isLadder ? 'You can challenge players up to three ladder positions above you.' : 'Search for an existing member of Emerald Courts.' }}</p>
      </div>

      <p v-if="isLadder" class="eligibility-context">
        Showing only ranks #3–#5 because they are within your challenge window.
      </p>

      <label class="opponent-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <span class="sr-only">Search {{ isLadder ? 'eligible players' : 'club members' }}</span>
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="isLadder ? 'Search eligible players' : 'Search club members'"
          autocomplete="off"
        />
      </label>

      <div v-if="availableOpponents.length" class="opponent-list" role="radiogroup" aria-label="Choose opponent">
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
          <span class="opponent-row__identity">
            <strong>{{ opponent.name }}</strong>
            <small>{{ opponent.rank ? `Rank #${opponent.rank} · ` : '' }}{{ opponent.division }}</small>
          </span>
          <span v-if="selectedOpponentId === opponent.id" class="opponent-row__check" aria-hidden="true">✓</span>
        </button>
      </div>
      <div v-else class="opponent-empty" role="status">
        <strong>No matching players</strong>
        <span>Try another name{{ isLadder ? ' within your eligible challenge window' : '' }}.</span>
        <button type="button" class="button-secondary" @click="searchQuery = ''">Clear search</button>
      </div>

      <button
        type="button"
        class="button-primary friendly-flow__continue"
        :disabled="!friendlyMatchStore.draft.opponent"
        @click="continueToFormat"
      >Continue</button>
    </section>

    <section v-else-if="step === 'format'" class="friendly-flow__screen" aria-labelledby="format-title">
      <div class="friendly-flow__intro">
        <p class="friendly-flow__eyebrow">{{ friendlyMatchStore.matchTypeLabel }}</p>
        <h2 id="format-title">How should deuce be played?</h2>
        <p>Both formats use love, 15, 30 and 40. Choose what happens when the score reaches deuce.</p>
      </div>

      <div class="friendly-flow__choices friendly-flow__choices--formats">
        <button type="button" class="format-card" @click="chooseFormat('ad')">
          <strong>Advantage</strong>
          <small>At deuce, a player must win two consecutive points.</small>
        </button>
        <button type="button" class="format-card" @click="chooseFormat('noad')">
          <strong>No-Ad</strong>
          <small>At deuce, the next point wins the game.</small>
        </button>
      </div>
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
        <strong>{{ friendlyMatchStore.statusText }}</strong>
        <span>{{ friendlyMatchStore.formatLabel }}</span>
        <button
          type="button"
          aria-label="Undo last point"
          title="Undo last point"
          :disabled="!friendlyMatchStore.canUndo"
          @click="friendlyMatchStore.undoPoint"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" /></svg>
        </button>
      </div>

      <div class="friendly-live__players">
        <button
          type="button"
          class="friendly-live__player friendly-live__player--you"
          :disabled="friendlyMatchStore.draft.over"
          aria-label="Add point for you"
          @click="friendlyMatchStore.recordPoint('you')"
        >
          <span>You</span>
          <strong>{{ friendlyMatchStore.pointLabel('you') }}</strong>
          <small>Tap when you win the rally</small>
        </button>
        <button
          type="button"
          class="friendly-live__player"
          :disabled="friendlyMatchStore.draft.over"
          :aria-label="`Add point for ${opponentName}`"
          @click="friendlyMatchStore.recordPoint('opponent')"
        >
          <span>{{ opponentName }}</span>
          <strong>{{ friendlyMatchStore.pointLabel('opponent') }}</strong>
          <small>Tap when {{ opponentName }} wins</small>
        </button>
      </div>

      <p class="friendly-live__count">Points played: {{ friendlyMatchStore.draft.pointHistory.length }}</p>
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
.friendly-flow__header h1 { margin: 0; font-size: 18px; line-height: 1.2; }
.friendly-flow__back {
  width: 44px; height: 44px; padding: 0;
  border: var(--app-hairline); background: var(--color-surface);
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04); color: var(--color-text-soft);
}
.friendly-flow__back svg,
.friendly-live__status button svg,
.opponent-search svg {
  width: 20px; height: 20px; fill: none; stroke: currentColor;
  stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
}
.friendly-flow__step { color: var(--color-muted); font-size: 11px; font-weight: 700; opacity: 0.7; }

.friendly-flow__screen { display: grid; gap: 22px; padding-top: clamp(30px, 7vw, 58px); }
.friendly-flow__intro { max-width: 720px; }
.friendly-flow__eyebrow,
.friendly-flow__intro h2,
.friendly-flow__intro > p:last-child { margin: 0; }
.friendly-flow__eyebrow {
  color: var(--color-primary-strong); font-size: 10px; font-weight: 800;
  letter-spacing: 0.09em; text-transform: uppercase; opacity: 0.76;
}
.friendly-flow__intro h2 {
  margin-top: 5px; color: var(--color-text-soft);
  font-size: clamp(22px, 5vw, 30px); line-height: 1.24;
}
.friendly-flow__intro > p:last-child:not(.friendly-flow__eyebrow) {
  margin-top: 7px; color: var(--color-muted); font-size: 13px; line-height: 1.55;
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
.eligibility-context { background: var(--color-surface-soft); color: var(--color-text-soft); }

.friendly-flow__choices { display: grid; gap: 12px; }
.choice-card,
.format-card,
.opponent-row {
  border: var(--app-hairline); background: var(--color-surface);
  box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
  color: var(--color-text-soft); text-align: left;
  transition: transform 180ms var(--motion-curve), box-shadow 180ms var(--motion-curve), border-color 180ms ease;
}
.choice-card {
  display: flex; min-height: 86px; align-items: center; justify-content: space-between;
  padding: 17px 18px; border-radius: var(--app-card-radius);
}
.choice-card--friendly { background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-surface)); }
.choice-card--muted { opacity: 0.58; }
.choice-card strong,
.choice-card small,
.format-card strong,
.format-card small { display: block; }
.choice-card strong,
.format-card strong { font-size: 14px; }
.choice-card small,
.format-card small { margin-top: 3px; color: var(--color-muted); font-size: 12px; line-height: 1.5; }
.choice-card__arrow { color: var(--color-primary-strong); font-size: 22px; opacity: 0.68; }

.choice-card:hover,
.format-card:hover,
.opponent-row:hover {
  transform: translateY(-1px); border-color: var(--color-border-strong);
  box-shadow: 0 12px 28px rgba(15, 34, 24, 0.055);
}

.opponent-search {
  display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center;
  gap: 10px; min-height: 50px; padding: 0 14px;
  border: var(--app-hairline); border-radius: var(--app-card-radius);
  background: var(--color-surface); color: var(--color-muted);
  box-shadow: 0 7px 20px rgba(15, 34, 24, 0.035);
}
.opponent-search input {
  width: 100%; min-height: 48px; padding: 0; border: 0; border-radius: 0;
  background: transparent; box-shadow: none; color: var(--color-text);
}
.opponent-search input:focus { box-shadow: none; }

.opponent-list { display: grid; gap: 9px; }
.opponent-row {
  display: grid; grid-template-columns: 42px minmax(0, 1fr) 28px;
  align-items: center; gap: 13px; min-height: 72px;
  padding: 11px 14px; border-radius: var(--app-card-radius);
}
.opponent-row--selected {
  border: 2px solid var(--color-primary); padding: 10px 13px;
  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
}
.opponent-row__avatar {
  display: grid; width: 40px; height: 40px; place-items: center; border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 9%, var(--color-surface));
  color: var(--color-primary-strong); font-size: 11px; font-weight: 800;
}
.opponent-row__identity { display: grid; min-width: 0; }
.opponent-row__identity strong { font-size: 14px; }
.opponent-row__identity small { color: var(--color-muted); font-size: 11.5px; }
.opponent-row__check { color: var(--color-primary-strong); font-size: 16px; font-weight: 900; text-align: center; }

.opponent-empty {
  display: grid; justify-items: center; gap: 5px; min-height: 150px;
  align-content: center; padding: 24px; text-align: center;
}
.opponent-empty strong { color: var(--color-text-soft); font-size: 15px; }
.opponent-empty span { color: var(--color-muted); font-size: 12.5px; }
.opponent-empty button { margin-top: 8px; }

.friendly-flow__continue { width: min(220px, 100%); min-height: 48px; justify-self: end; }
.friendly-flow__continue:disabled { opacity: 0.4; }
.friendly-flow__choices--formats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.format-card {
  min-height: 160px; align-content: center; justify-items: start;
  padding: 24px; border-radius: var(--app-card-radius);
}
.format-card:hover,
.format-card:focus-visible { border-color: var(--color-primary); background: var(--color-surface-soft); }

.friendly-live { display: grid; gap: 22px; padding-top: 18px; }
.friendly-live__title-row {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; padding: 18px 0 4px;
}
.friendly-live__title-row h1 { margin: 5px 0 0; color: var(--color-text-soft); font-size: clamp(24px, 5vw, 32px); }
.friendly-live__live {
  padding: 5px 9px; border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary-strong); font-size: 10px; font-weight: 900; text-transform: uppercase;
}
.friendly-live__status {
  display: grid; grid-template-columns: minmax(0, 1fr) auto 42px;
  align-items: center; gap: 10px; min-height: 60px; padding: 9px 10px 9px 16px;
  border: var(--app-hairline); border-radius: var(--app-card-radius);
  background: var(--color-surface-soft); box-shadow: 0 9px 24px rgba(15, 34, 24, 0.04);
}
.friendly-live__status strong { color: var(--color-text-soft); font-size: 14px; }
.friendly-live__status > span {
  padding: 4px 7px; border-radius: 999px; background: var(--color-surface);
  color: var(--color-muted); font-size: 10px; font-weight: 800;
}
.friendly-live__status button {
  width: 42px; height: 42px; min-height: 42px; padding: 0;
  border-color: transparent; background: transparent; color: var(--color-text-soft);
}
.friendly-live__status button:disabled { opacity: 0.3; }
.friendly-live__players { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.friendly-live__player {
  display: grid; min-height: 250px; place-items: center; align-content: center; gap: 8px;
  padding: 24px 18px; border: var(--app-hairline); border-radius: var(--app-card-radius);
  background: var(--color-surface); box-shadow: 0 12px 30px rgba(15, 34, 24, 0.045);
  color: var(--color-text-soft);
}
.friendly-live__player--you { background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface)); }
.friendly-live__player > span { font-size: 14px; font-weight: 800; }
.friendly-live__player > strong { color: var(--color-text); font-size: clamp(44px, 10vw, 72px); line-height: 1; }
.friendly-live__player > small { color: var(--color-muted); font-size: 11px; opacity: 0.68; }
.friendly-live__player:disabled { opacity: 0.72; }
.friendly-live__count { margin: -7px 0 0; color: var(--color-muted); font-size: 11px; font-weight: 700; text-align: center; }
.friendly-live__end {
  justify-self: center; min-height: 44px; border-color: transparent; background: transparent;
  color: var(--color-muted); font-size: 12px; font-weight: 800;
  text-decoration: underline; text-underline-offset: 4px;
}
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

@media (max-width: 560px) {
  .friendly-flow { padding: 12px 16px 34px; }
  .friendly-flow__choices--formats,
  .friendly-live__players { grid-template-columns: 1fr; }
  .format-card { min-height: 120px; }
  .friendly-live__player { min-height: 180px; }
  .friendly-flow__continue { width: 100%; }
  .friendly-live__status { grid-template-columns: minmax(0, 1fr) 42px; }
  .friendly-live__status > span { display: none; }
}
</style>
