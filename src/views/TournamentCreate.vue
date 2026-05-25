<script setup>
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { assignPlayersToCategories } from '../utils/tournament/assignPlayersToCategories'
import { buildCategoryGroups } from '../utils/tournament/buildCategoryGroups'
import { buildTournamentPayload } from '../utils/tournament/buildTournamentPayload'
import {
  RSP_CATEGORY_TEMPLATE,
  getEnabledCategoryTemplates,
} from '../utils/tournament/categoryTemplates'
import { validateTournamentSetup } from '../utils/tournament/validateTournamentSetup'

const router = useRouter()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

const steps = ['Basics', 'Format', 'Players', 'Review']

const form = reactive({
  step: 1,
  name: '2026 RSP Masters Tennis Tournament',
  description: 'Annual masters tournament for RSP Tennis Section members. Port Harcourt, Nigeria.',
  roundRobinStart: '',
  roundRobinEnd: '',
  knockoutStart: '',
  finalDate: '',
  officials: 'Igo, Harcourt, Zino, Dogiye, David',
  enabledCategories: RSP_CATEGORY_TEMPLATE.categories.map((category) => category.id),
  selectedPlayerIds: [],
  manualAssignments: {},
  showUnassignedPlayers: false,
  allowSpecialOverlap: true,
  veteranAge: 50,
  winPoints: 1,
  lossPoints: 0,
  qualifiersPerGroup: 4,
  tiebreakAt: 6,
  walkovertimeMinutes: 30,
  rescheduleNoticeHours: 24,
})

const activePlayers = computed(() =>
  playerStore.sortedLadder.filter((player) => player.status !== 'inactive'),
)
const selectedPlayerIdSet = computed(() => new Set(form.selectedPlayerIds))
const selectedPlayers = computed(() =>
  activePlayers.value.filter((player) => selectedPlayerIdSet.value.has(player.id)),
)
const enabledCategoryTemplates = computed(() => getEnabledCategoryTemplates(form.enabledCategories))
const allPlayersSelected = computed(
  () => activePlayers.value.length > 0 && form.selectedPlayerIds.length === activePlayers.value.length,
)

const assignmentResult = computed(() =>
  assignPlayersToCategories({
    players: selectedPlayers.value,
    categories: enabledCategoryTemplates.value,
    allowSpecialOverlap: form.allowSpecialOverlap,
    veteranAge: Number(form.veteranAge),
    manualAssignments: form.manualAssignments,
  }),
)

const categoryDrafts = computed(() =>
  assignmentResult.value.assignments.map((assignment) => {
    const groups = buildCategoryGroups({
      tournamentId: 'preview-tournament',
      category: assignment.category,
      players: assignment.players,
    })
    const players = groups.flatMap((group) => group.players)

    return {
      id: assignment.category.id,
      name: assignment.category.name,
      description: assignment.category.description,
      settings: assignment.category,
      assignmentPlayers: assignment.players,
      players,
      groups,
    }
  }),
)

const setupValidation = computed(() => validateTournamentSetup(categoryDrafts.value))
const setupWarnings = computed(() => [
  ...assignmentResult.value.warnings,
  ...setupValidation.value.warnings,
])
const setupBlockers = computed(() => setupValidation.value.blockers)

const playerRows = computed(() =>
  activePlayers.value.map((player) => {
    const assignmentLabel = assignedCategoryNames(player)

    return {
      player,
      assignmentLabel,
      isAssigned: assignmentLabel !== 'Not assigned',
      isSelected: selectedPlayerIdSet.value.has(player.id),
    }
  }),
)
const assignedPlayerRows = computed(() => playerRows.value.filter((row) => row.isAssigned))
const unassignedPlayerRows = computed(() => playerRows.value.filter((row) => !row.isAssigned))
const visibleUnassignedPlayerRows = computed(() =>
  form.showUnassignedPlayers || assignedPlayerRows.value.length === 0
    ? unassignedPlayerRows.value
    : [],
)
const enabledCategoryNames = computed(() =>
  enabledCategoryTemplates.value.map((category) => category.name).join(', '),
)

const isBasicsValid = computed(
  () =>
    form.name &&
    form.roundRobinStart &&
    form.roundRobinEnd &&
    form.knockoutStart &&
    form.finalDate,
)
const isPlayersStepValid = computed(
  () => form.enabledCategories.length > 0 && form.selectedPlayerIds.length > 0,
)
const canGenerate = computed(
  () => isBasicsValid.value && isPlayersStepValid.value && setupValidation.value.canGenerate,
)

function goNext() {
  if (form.step < steps.length) form.step += 1
}

function goBack() {
  if (form.step > 1) form.step -= 1
}

function toggleCategory(categoryId) {
  form.showUnassignedPlayers = false

  if (form.enabledCategories.includes(categoryId)) {
    form.enabledCategories = form.enabledCategories.filter((id) => id !== categoryId)
    return
  }

  form.enabledCategories = [...form.enabledCategories, categoryId]
}

function togglePlayer(playerId) {
  if (selectedPlayerIdSet.value.has(playerId)) {
    form.selectedPlayerIds = form.selectedPlayerIds.filter((id) => id !== playerId)
    delete form.manualAssignments[playerId]
    return
  }

  form.selectedPlayerIds = [...form.selectedPlayerIds, playerId]
}

function toggleAllPlayers() {
  if (allPlayersSelected.value) {
    form.selectedPlayerIds = []
    resetManualAssignments()
    return
  }

  form.selectedPlayerIds = activePlayers.value.map((player) => player.id)
}

function assignPlayerManually(playerId, categoryId) {
  if (!categoryId) {
    delete form.manualAssignments[playerId]
    return
  }

  form.manualAssignments[playerId] = categoryId
}

function resetManualAssignments() {
  Object.keys(form.manualAssignments).forEach((playerId) => {
    delete form.manualAssignments[playerId]
  })
}

function autoAssign() {
  resetManualAssignments()
  if (!form.selectedPlayerIds.length) {
    form.selectedPlayerIds = activePlayers.value.map((player) => player.id)
  }
}

function assignedCategoryNames(player) {
  const names = assignmentResult.value.assignments
    .filter((assignment) =>
      assignment.players.some((assignedPlayer) => assignedPlayer.playerId === player.id),
    )
    .map((assignment) => assignment.category.name)

  return names.length ? names.join(', ') : 'Not assigned'
}

function realPlayerCount(categoryDraft) {
  return categoryDraft.players.filter((player) => !player.isBye).length
}

function byeCount(categoryDraft) {
  return categoryDraft.players.filter((player) => player.isBye).length
}

function categoryWarnings(categoryDraft) {
  return setupWarnings.value.filter((warning) => warning.categoryId === categoryDraft.id)
}

function categoryBlockers(categoryDraft) {
  return setupBlockers.value.filter((blocker) => blocker.categoryId === categoryDraft.id)
}

function buildRules() {
  return {
    winPoints: Number(form.winPoints),
    lossPoints: Number(form.lossPoints),
    qualifiersPerGroup: Number(form.qualifiersPerGroup),
    tiebreakAt: Number(form.tiebreakAt),
    knockoutFormat: 'top4-crossover',
    rankingOrder: ['points', 'setDiff', 'gameDiff', 'wins', 'name'],
    walkovertimeMinutes: Number(form.walkovertimeMinutes),
    rescheduleNoticeHours: Number(form.rescheduleNoticeHours),
    veteranAge: Number(form.veteranAge),
    allowSpecialOverlap: form.allowSpecialOverlap,
  }
}

function parseOfficials() {
  return form.officials
    .split(',')
    .map((official) => official.trim())
    .filter(Boolean)
}

async function submitTournament() {
  if (!canGenerate.value || tournamentStore.loading) {
    return
  }

  const payload = buildTournamentPayload({
    basics: {
      name: form.name,
      description: form.description,
      roundRobinStart: form.roundRobinStart,
      roundRobinEnd: form.roundRobinEnd,
      knockoutStart: form.knockoutStart,
      finalDate: form.finalDate,
      officials: parseOfficials(),
      status: 'active',
    },
    categoryAssignments: assignmentResult.value.assignments,
    rules: buildRules(),
  })

  const tournament = await tournamentStore.createTournament(payload)

  if (tournament) {
    for (const category of tournament.categories) {
      await tournamentStore.generateFixtures(tournament.id, category.id)
    }

    router.push(`/tournaments/${tournament.id}`)
  }
}

onMounted(async () => {
  if (!playerStore.players.length) {
    await playerStore.loadPlayers()
  }

  if (!form.selectedPlayerIds.length) {
    form.selectedPlayerIds = activePlayers.value.map((player) => player.id)
  }
})
</script>

<template>
  <section class="tournament-create">
    <header class="t-hero">
      <div class="t-hero__top">
        <div>
          <span class="t-section-kicker">Tournament Wizard</span>
          <h2 class="t-hero__title">Create Tournament</h2>
          <p class="t-hero__copy">
            Pick the format, select players, review the category split, then generate the full
            tournament in one click.
          </p>
        </div>
        <RouterLink class="t-button t-button--secondary" to="/tournaments">Back</RouterLink>
      </div>
    </header>

    <main class="t-shell-card tournament-create__workspace">
      <ol class="tournament-create__steps">
        <li
          v-for="(step, index) in steps"
          :key="step"
          :class="{
            'tournament-create__step--done': index + 1 < form.step,
            'tournament-create__step--active': index + 1 === form.step,
          }"
        >
          <span>{{ index + 1 < form.step ? 'OK' : index + 1 }}</span>
          <strong>{{ step }}</strong>
        </li>
      </ol>

      <section v-if="form.step === 1" class="tournament-create__panel tournament-create__panel--animated">
        <div>
          <h3 class="t-section-title">Tournament Basics</h3>
          <p class="t-muted">Name the event and set the group-stage and knockout windows.</p>
        </div>
        <label>
          <span>Tournament Name *</span>
          <input v-model="form.name" placeholder="e.g. 2026 RSP Masters Tournament" required />
        </label>
        <label>
          <span>Description</span>
          <textarea v-model="form.description" rows="3" placeholder="Brief description of the tournament" />
        </label>
        <div class="tournament-create__form-row">
          <label>
            <span>Group Stage Start *</span>
            <input v-model="form.roundRobinStart" type="date" />
          </label>
          <label>
            <span>Group Stage End *</span>
            <input v-model="form.roundRobinEnd" type="date" />
          </label>
        </div>
        <div class="tournament-create__form-row">
          <label>
            <span>Knockout Start *</span>
            <input v-model="form.knockoutStart" type="date" />
          </label>
          <label>
            <span>Final Date *</span>
            <input v-model="form.finalDate" type="date" />
          </label>
        </div>
        <label>
          <span>Tournament Officials</span>
          <input v-model="form.officials" placeholder="Igo, Harcourt, Zino" />
          <small>Enter names separated by commas.</small>
        </label>
      </section>

      <section v-else-if="form.step === 2" class="tournament-create__panel tournament-create__panel--animated">
        <div class="t-section-header">
          <div>
            <h3 class="t-section-title">Format</h3>
            <p class="t-muted">RSP Masters defaults are selected. Admins can turn categories on or off.</p>
          </div>
          <span
            class="tournament-create__tooltip"
            tabindex="0"
            data-tooltip="Categories decide who plays who. Ladder rank only decides seeding inside the category."
          >
            ?
          </span>
        </div>

        <article class="tournament-create__template-note">
          <span class="tournament-create__pulse"></span>
          <div>
            <strong>{{ RSP_CATEGORY_TEMPLATE.name }}</strong>
            <p>{{ RSP_CATEGORY_TEMPLATE.description }}</p>
          </div>
        </article>

        <div class="tournament-create__categories">
          <button
            v-for="category in RSP_CATEGORY_TEMPLATE.categories"
            :key="category.id"
            type="button"
            class="tournament-create__category-toggle"
            :class="{ 'tournament-create__category-toggle--active': form.enabledCategories.includes(category.id) }"
            @click="toggleCategory(category.id)"
          >
            <span>
              <strong>{{ category.name }}</strong>
              <small>{{ category.description }}</small>
            </span>
            <em>
              {{ category.groupCount }} groups -
              {{ category.allowByes ? 'BYEs allowed' : 'No BYEs' }}
            </em>
          </button>
        </div>

        <div class="tournament-create__form-row">
          <label class="tournament-create__switch">
            <input v-model="form.allowSpecialOverlap" type="checkbox" />
            <span>
              <strong>Allow Ladies/Veterans overlap</strong>
              <small>Eligible players can also appear in their skill category.</small>
            </span>
          </label>
          <label>
            <span>Veterans Age</span>
            <input v-model.number="form.veteranAge" min="35" type="number" />
          </label>
        </div>
      </section>

      <section v-else-if="form.step === 3" class="tournament-create__panel tournament-create__panel--animated">
        <div class="t-section-header">
          <div>
            <h3 class="t-section-title">Players</h3>
            <p class="t-muted">
              Current format: {{ enabledCategoryNames }}. Matching players are shown first.
            </p>
          </div>
          <div class="tournament-create__toolbar">
            <button class="t-button t-button--secondary" type="button" @click="toggleAllPlayers">
              {{ allPlayersSelected ? 'Clear Players' : 'Select All' }}
            </button>
            <button class="t-button t-button--primary" type="button" @click="autoAssign">
              Auto Assign
            </button>
          </div>
        </div>

        <article class="tournament-create__assignment-summary">
          <div>
            <strong>{{ assignedPlayerRows.length }} player{{ assignedPlayerRows.length === 1 ? '' : 's' }} matched</strong>
            <span>
              {{ unassignedPlayerRows.length }} selected player{{ unassignedPlayerRows.length === 1 ? '' : 's' }}
              do not match the enabled categories.
            </span>
          </div>
          <button
            v-if="unassignedPlayerRows.length"
            class="t-button t-button--ghost"
            type="button"
            @click="form.showUnassignedPlayers = !form.showUnassignedPlayers"
          >
            {{ form.showUnassignedPlayers ? 'Hide Not Assigned' : 'Show Not Assigned' }}
          </button>
        </article>

        <div class="tournament-create__player-list">
          <div v-if="assignedPlayerRows.length" class="tournament-create__player-section-title">
            Assigned by current format
          </div>
          <article
            v-for="row in assignedPlayerRows"
            :key="row.player.id"
            class="tournament-create__player-row"
            :class="{ 'tournament-create__player-row--selected': row.isSelected }"
          >
            <label class="tournament-create__player-check">
              <input
                :checked="row.isSelected"
                type="checkbox"
                @change="togglePlayer(row.player.id)"
              />
              <span>#{{ row.player.rank }}</span>
            </label>
            <div class="tournament-create__player-main">
              <strong>{{ row.player.name }}</strong>
              <small>
                {{ row.player.category }} -
                {{ row.player.gender || 'unknown' }}
                <span v-if="row.player.isVeteran">- veteran</span>
              </small>
            </div>
            <span class="tournament-create__assigned">{{ row.assignmentLabel }}</span>
            <select
              :value="form.manualAssignments[row.player.id] || ''"
              :disabled="!row.isSelected"
              @change="assignPlayerManually(row.player.id, $event.target.value)"
            >
              <option value="">Auto</option>
              <option
                v-for="category in enabledCategoryTemplates"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
          </article>

          <div
            v-if="unassignedPlayerRows.length"
            class="tournament-create__player-section-title tournament-create__player-section-title--muted"
          >
            Not assigned by current format
          </div>
          <article
            v-for="row in visibleUnassignedPlayerRows"
            :key="row.player.id"
            class="tournament-create__player-row tournament-create__player-row--unassigned"
            :class="{ 'tournament-create__player-row--selected': row.isSelected }"
          >
            <label class="tournament-create__player-check">
              <input
                :checked="row.isSelected"
                type="checkbox"
                @change="togglePlayer(row.player.id)"
              />
              <span>#{{ row.player.rank }}</span>
            </label>
            <div class="tournament-create__player-main">
              <strong>{{ row.player.name }}</strong>
              <small>
                {{ row.player.category }} -
                {{ row.player.gender || 'unknown' }}
                <span v-if="row.player.isVeteran">- veteran</span>
              </small>
            </div>
            <span class="tournament-create__assigned tournament-create__assigned--empty">
              {{ row.assignmentLabel }}
            </span>
            <select
              :value="form.manualAssignments[row.player.id] || ''"
              :disabled="!row.isSelected"
              @change="assignPlayerManually(row.player.id, $event.target.value)"
            >
              <option value="">Auto</option>
              <option
                v-for="category in enabledCategoryTemplates"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
          </article>
        </div>
      </section>

      <section v-else class="tournament-create__panel tournament-create__panel--animated">
        <div class="t-section-header">
          <div>
            <h3 class="t-section-title">Review & Generate</h3>
            <p class="t-muted">Check player counts, BYEs, groups, and warnings before creating fixtures.</p>
          </div>
          <span
            class="tournament-create__tooltip"
            tabindex="0"
            data-tooltip="Generate creates category groups, round-robin fixtures, standings inputs, and empty knockout brackets."
          >
            ?
          </span>
        </div>

        <div v-if="setupBlockers.length" class="tournament-create__blockers">
          <strong>Fix before generating</strong>
          <span v-for="blocker in setupBlockers" :key="blocker.message">{{ blocker.message }}</span>
        </div>

        <div class="tournament-create__review-grid">
          <article
            v-for="categoryDraft in categoryDrafts"
            :key="categoryDraft.id"
            class="tournament-create__review-card"
          >
            <header>
              <div>
                <h4>{{ categoryDraft.name }}</h4>
                <p>{{ categoryDraft.description }}</p>
              </div>
              <strong>{{ realPlayerCount(categoryDraft) }} players</strong>
            </header>

            <div class="tournament-create__review-stats">
              <span>{{ categoryDraft.groups.length }} groups</span>
              <span>{{ byeCount(categoryDraft) }} BYEs</span>
              <span>Top {{ categoryDraft.settings.qualifiersPerGroup }}/group</span>
            </div>

            <div class="tournament-create__groups-preview">
              <div v-for="group in categoryDraft.groups" :key="group.id">
                <strong>{{ group.name }}</strong>
                <span
                  v-for="player in group.players"
                  :key="player.playerId"
                  :class="{ 'tournament-create__bye': player.isBye }"
                >
                  {{ player.isBye ? 'BYE' : `${player.seed}. ${player.name}` }}
                </span>
              </div>
            </div>

            <div
              v-if="categoryWarnings(categoryDraft).length || categoryBlockers(categoryDraft).length"
              class="tournament-create__review-alerts"
            >
              <span
                v-for="blocker in categoryBlockers(categoryDraft)"
                :key="blocker.message"
                class="tournament-create__review-alert tournament-create__review-alert--blocker"
              >
                {{ blocker.message }}
              </span>
              <span
                v-for="warning in categoryWarnings(categoryDraft)"
                :key="warning.message"
                class="tournament-create__review-alert"
              >
                {{ warning.message }}
              </span>
            </div>
          </article>
        </div>

        <section class="tournament-create__rules">
          <div>
            <span>Win Points</span>
            <strong>{{ form.winPoints }}</strong>
          </div>
          <div>
            <span>Qualifiers</span>
            <strong>{{ form.qualifiersPerGroup }}/group</strong>
          </div>
          <div>
            <span>Knockout</span>
            <strong>Top 4/group crossover</strong>
          </div>
          <div>
            <span>Tiebreak</span>
            <strong>Points, set diff, game diff, wins</strong>
          </div>
        </section>
      </section>

      <footer class="tournament-create__footer">
        <button class="t-button t-button--secondary" type="button" :disabled="form.step === 1" @click="goBack">
          Back
        </button>
        <button
          v-if="form.step < steps.length"
          class="t-button t-button--primary"
          type="button"
          :disabled="
            (form.step === 1 && !isBasicsValid) ||
            (form.step === 3 && !isPlayersStepValid)
          "
          @click="goNext"
        >
          Next
        </button>
        <button
          v-else
          class="t-button t-button--primary"
          type="button"
          :disabled="!canGenerate || tournamentStore.loading"
          @click="submitTournament"
        >
          {{ tournamentStore.loading ? 'Generating...' : 'Generate Tournament' }}
        </button>
      </footer>
    </main>
  </section>
</template>

<style scoped>
.tournament-create__workspace {
  display: grid;
  gap: 24px;
  max-width: 980px;
  padding: 24px;
}

.tournament-create__steps {
  display: flex;
  gap: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.tournament-create__steps li {
  position: relative;
  flex: 1;
  display: grid;
  justify-items: center;
  gap: 6px;
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tournament-create__steps li::after {
  content: '';
  position: absolute;
  top: 14px;
  left: 50%;
  right: -50%;
  height: 2px;
  background: var(--tournament-line);
}

.tournament-create__steps li:last-child::after {
  display: none;
}

.tournament-create__steps span {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--tournament-line);
  color: var(--tournament-faint);
  font-size: 10px;
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.tournament-create__step--done span,
.tournament-create__step--active span {
  transform: translateY(-1px);
}

.tournament-create__step--done span {
  background: var(--tournament-green);
  color: #ffffff;
}

.tournament-create__step--active span {
  border: 2px solid var(--tournament-green);
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__step--active strong {
  color: var(--tournament-green-dark);
}

.tournament-create__panel {
  display: grid;
  gap: 16px;
}

.tournament-create__panel--animated {
  animation: panel-enter 0.22s ease both;
}

@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tournament-create label {
  display: grid;
  gap: 6px;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tournament-create input,
.tournament-create textarea,
.tournament-create select {
  min-height: 42px;
  border: 1.5px solid var(--tournament-line);
  border-radius: 10px;
  padding: 9px 12px;
  color: var(--tournament-ink);
  font-size: 14px;
  text-transform: none;
}

.tournament-create small {
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.tournament-create__form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.tournament-create__template-note {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(0, 181, 26, 0.22);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--tournament-green-soft);
}

.tournament-create__template-note p {
  margin: 2px 0 0;
  color: var(--tournament-muted);
  font-size: 12px;
}

.tournament-create__pulse {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--tournament-green);
  box-shadow: 0 0 0 0 rgba(0, 181, 26, 0.32);
  animation: pulse 1.8s ease infinite;
}

@keyframes pulse {
  70% {
    box-shadow: 0 0 0 9px rgba(0, 181, 26, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(0, 181, 26, 0);
  }
}

.tournament-create__categories,
.tournament-create__review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.tournament-create__category-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1.5px solid var(--tournament-line);
  border-radius: 10px;
  padding: 14px 16px;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.tournament-create__category-toggle:hover,
.tournament-create__review-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
}

.tournament-create__category-toggle--active {
  border-color: rgba(0, 181, 26, 0.35);
  background: var(--tournament-green-soft);
}

.tournament-create__category-toggle span {
  display: grid;
  gap: 2px;
}

.tournament-create__category-toggle strong {
  font-size: 14px;
}

.tournament-create__category-toggle em {
  color: var(--tournament-green-dark);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.tournament-create__switch {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  padding: 12px;
  text-transform: none;
}

.tournament-create__switch input {
  width: 18px;
  min-height: 18px;
}

.tournament-create__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tournament-create__assignment-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(0, 181, 26, 0.18);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--tournament-green-soft);
}

.tournament-create__assignment-summary div {
  display: grid;
  gap: 3px;
}

.tournament-create__assignment-summary strong {
  color: var(--tournament-green-dark);
  font-size: 13px;
}

.tournament-create__assignment-summary span {
  color: var(--tournament-muted);
  font-size: 12px;
}

.tournament-create__player-list {
  display: grid;
  gap: 8px;
  max-height: 520px;
  overflow: auto;
  padding-right: 4px;
}

.tournament-create__player-section-title {
  position: sticky;
  top: 0;
  z-index: 1;
  border-radius: 8px;
  padding: 8px 10px;
  background: #ffffff;
  color: var(--tournament-green-dark);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tournament-create__player-section-title--muted {
  color: var(--tournament-muted);
}

.tournament-create__player-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) minmax(150px, 220px) 150px;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.tournament-create__player-row:hover {
  transform: translateX(2px);
}

.tournament-create__player-row--selected {
  border-color: rgba(0, 181, 26, 0.28);
  background: rgba(0, 181, 26, 0.035);
}

.tournament-create__player-row--unassigned {
  opacity: 0.78;
}

.tournament-create__player-check {
  display: flex;
  align-items: center;
  gap: 8px;
  text-transform: none;
}

.tournament-create__player-check input {
  width: 17px;
  min-height: 17px;
}

.tournament-create__player-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.tournament-create__player-main strong,
.tournament-create__assigned {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-create__assigned {
  color: var(--tournament-green-dark);
  font-size: 12px;
  font-weight: 800;
}

.tournament-create__assigned--empty {
  color: var(--tournament-faint);
}

.tournament-create__blockers,
.tournament-create__review-alerts {
  display: grid;
  gap: 6px;
}

.tournament-create__blockers {
  border: 1px solid rgba(220, 53, 69, 0.22);
  border-radius: 10px;
  padding: 12px;
  background: rgba(220, 53, 69, 0.07);
  color: #991b1b;
  font-size: 12px;
}

.tournament-create__review-card {
  display: grid;
  gap: 14px;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  padding: 16px;
  background: #ffffff;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.tournament-create__review-card header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.tournament-create__review-card h4,
.tournament-create__review-card p {
  margin: 0;
}

.tournament-create__review-card h4 {
  color: var(--tournament-ink);
  font-size: 15px;
}

.tournament-create__review-card p {
  color: var(--tournament-muted);
  font-size: 12px;
}

.tournament-create__review-card header > strong {
  flex-shrink: 0;
  color: var(--tournament-green-dark);
  font-size: 12px;
}

.tournament-create__review-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tournament-create__review-stats span,
.tournament-create__review-alert {
  border-radius: 999px;
  padding: 4px 8px;
  background: var(--tournament-shell);
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 800;
}

.tournament-create__groups-preview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tournament-create__groups-preview div {
  display: grid;
  gap: 5px;
  border-radius: 8px;
  padding: 10px;
  background: var(--tournament-shell);
}

.tournament-create__groups-preview strong,
.tournament-create__groups-preview span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-create__groups-preview span {
  color: var(--tournament-muted);
  font-size: 12px;
}

.tournament-create__groups-preview .tournament-create__bye {
  color: var(--tournament-faint);
  font-style: italic;
}

.tournament-create__review-alert {
  width: fit-content;
  border: 1px solid rgba(29, 111, 181, 0.18);
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
}

.tournament-create__review-alert--blocker {
  border-color: rgba(220, 53, 69, 0.22);
  background: rgba(220, 53, 69, 0.07);
  color: #991b1b;
}

.tournament-create__rules {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.tournament-create__rules div {
  display: grid;
  gap: 3px;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  padding: 10px;
  background: var(--tournament-shell);
}

.tournament-create__rules span {
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 800;
}

.tournament-create__rules strong {
  color: var(--tournament-ink);
  font-size: 13px;
}

.tournament-create__tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(0, 181, 26, 0.24);
  border-radius: 50%;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 13px;
  font-weight: 900;
  cursor: help;
}

.tournament-create__tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  width: min(260px, 70vw);
  border-radius: 8px;
  padding: 8px 10px;
  background: #111827;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.tournament-create__tooltip:hover::after,
.tournament-create__tooltip:focus::after {
  opacity: 1;
  transform: translateY(0);
}

.tournament-create__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--tournament-line);
  padding-top: 18px;
}

@media (max-width: 860px) {
  .tournament-create__categories,
  .tournament-create__review-grid,
  .tournament-create__form-row,
  .tournament-create__groups-preview,
  .tournament-create__rules {
    grid-template-columns: 1fr;
  }

  .tournament-create__player-row {
    grid-template-columns: 80px minmax(0, 1fr);
  }

  .tournament-create__assigned,
  .tournament-create__player-row select {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .tournament-create__workspace {
    padding: 18px;
  }

  .tournament-create__steps strong {
    display: none;
  }

  .tournament-create__footer,
  .t-section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .tournament-create__toolbar {
    width: 100%;
  }

  .tournament-create__toolbar .t-button {
    flex: 1;
  }
}
</style>
