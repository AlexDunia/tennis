<script setup>
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { assignPlayersToCategories } from '../utils/tournament/assignPlayersToCategories'
import { buildCategoryGroups } from '../utils/tournament/buildCategoryGroups'
import { buildTournamentPayload } from '../utils/tournament/buildTournamentPayload'
import { RSP_CATEGORY_TEMPLATE } from '../utils/tournament/categoryTemplates'
import {
  applyFormatToCategory,
  getFormatChoicesForCount,
  getFormatDefinition,
  recommendFormatForCount,
} from '../utils/tournament/tournamentFormatAdvisor'
import { validateTournamentSetup } from '../utils/tournament/validateTournamentSetup'

const router = useRouter()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

const steps = ['Basics', 'Categories', 'Players', 'Review']

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
  customCategories: [],
  customCategoryDraft: {
    name: '',
    assignmentRule: 'manual-only',
    ladderStart: 1,
    ladderEnd: 12,
    maxPlayers: 12,
  },
  selectedPlayerIds: [],
  manualAssignments: {},
  showUnassignedPlayers: false,
  categoryFormatModes: {},
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
const allCategoryTemplates = computed(() => [
  ...RSP_CATEGORY_TEMPLATE.categories,
  ...form.customCategories,
])
const enabledCategoryTemplates = computed(() => {
  const enabled = new Set(form.enabledCategories)
  return allCategoryTemplates.value.filter((category) => enabled.has(category.id))
})
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
    const playerCount = assignment.players.length
    const formatChoices = getFormatChoicesForCount(playerCount)
    const recommendedFormat = recommendFormatForCount(playerCount)
    const selectedFormatId = form.categoryFormatModes[assignment.category.id] || recommendedFormat?.id
    const selectedFormat =
      formatChoices.find((format) => format.id === selectedFormatId) ||
      recommendedFormat ||
      formatChoices[0] ||
      getFormatDefinition('two-groups-quarterfinals')
    const effectiveCategory = applyFormatToCategory(assignment.category, selectedFormat, playerCount)
    const groups = buildCategoryGroups({
      tournamentId: 'preview-tournament',
      category: effectiveCategory,
      players: assignment.players,
    })
    const players = effectiveCategory.requiresGroupStage === false
      ? assignment.players
      : groups.flatMap((group) => group.players)

    return {
      id: effectiveCategory.id,
      name: effectiveCategory.name,
      description: effectiveCategory.description,
      settings: effectiveCategory,
      formatChoices,
      recommendedFormat,
      selectedFormat,
      assignmentPlayers: assignment.players,
      players,
      groups,
    }
  }),
)
const finalCategoryAssignments = computed(() =>
  categoryDrafts.value.map((draft) => ({
    categoryId: draft.id,
    category: draft.settings,
    players: draft.assignmentPlayers,
  })),
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

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function buildCustomCategoryDescription(rule) {
  switch (rule) {
    case 'ladies':
      return 'Custom female category'
    case 'veterans':
      return 'Custom age-eligible category'
    case 'ladder-range':
      return `Custom ladder range ${form.customCategoryDraft.ladderStart}-${form.customCategoryDraft.ladderEnd}`
    case 'manual-only':
    default:
      return 'Custom category managed by admin'
  }
}

function buildCustomCategoryEligibility(rule) {
  if (rule === 'ladies') {
    return { gender: 'female', veteranOnly: false }
  }

  if (rule === 'veterans') {
    return { gender: 'any', veteranOnly: true }
  }

  return { gender: 'any', veteranOnly: false }
}

function createCustomCategory() {
  const name = form.customCategoryDraft.name.trim()
  if (!name) {
    return
  }

  const id = `custom-${slugify(name)}-${Date.now()}`
  const assignmentRule = form.customCategoryDraft.assignmentRule
  const maxPlayers = Number(form.customCategoryDraft.maxPlayers || 12)

  const category = {
    id,
    name,
    description: buildCustomCategoryDescription(assignmentRule),
    assignmentMode: assignmentRule === 'ladder-range' ? 'ladder-range' : assignmentRule,
    ladderStart: Number(form.customCategoryDraft.ladderStart || 1),
    ladderEnd: Number(form.customCategoryDraft.ladderEnd || maxPlayers),
    targetPlayers: maxPlayers,
    minPlayers: 2,
    maxPlayers,
    groupCount: 2,
    qualifiersPerGroup: 4,
    allowByes: true,
    allowSpecialOverlap: ['ladies', 'veterans'].includes(assignmentRule),
    eligibility: buildCustomCategoryEligibility(assignmentRule),
    isCustom: true,
  }

  form.customCategories = [...form.customCategories, category]
  form.enabledCategories = [...form.enabledCategories, id]
  form.customCategoryDraft.name = ''
}

function removeCustomCategory(categoryId) {
  form.customCategories = form.customCategories.filter((category) => category.id !== categoryId)
  form.enabledCategories = form.enabledCategories.filter((id) => id !== categoryId)
  delete form.categoryFormatModes[categoryId]

  Object.keys(form.manualAssignments).forEach((playerId) => {
    if (form.manualAssignments[playerId] === categoryId) {
      delete form.manualAssignments[playerId]
    }
  })
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

function selectCategoryFormat(categoryId, formatId) {
  form.categoryFormatModes[categoryId] = formatId
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

function freePassCopy(categoryDraft) {
  const count = byeCount(categoryDraft)
  if (!count) {
    return 'No BYE'
  }

  return `${count} BYE${count === 1 ? '' : 's'}`
}

function formatMatchesPill(format, playerCount) {
  const count = Number(playerCount || 0)

  if (!count) {
    return 'No matches yet'
  }

  if (format.requiresGroupStage === false) {
    return '1+ match'
  }

  const groupCount = Math.max(1, Number(format.groupCount || 1))
  const expectedGroupSize = Math.ceil(count / groupCount)
  const guaranteedMatches = Math.max(1, expectedGroupSize - 1)

  return `${guaranteedMatches}+ match${guaranteedMatches === 1 ? '' : 'es'}`
}

function visibleFormatPills(format, playerCount) {
  const hiddenPills = new Set(['play everyone', 'group matches', 'small groups', 'fast draw'])
  const detailPills = (format.playerPills || []).filter(
    (pill) => !hiddenPills.has(pill.toLowerCase()),
  )

  return [formatMatchesPill(format, playerCount), ...detailPills].slice(0, 3)
}

function formatPillClass(pill) {
  const label = pill.toLowerCase()

  if (label.includes('no second')) {
    return 'tournament-create__pill--danger'
  }

  if (label.includes('lose and continue')) {
    return 'tournament-create__pill--safe'
  }

  if (label.includes('no knockout') || label.includes('no final')) {
    return 'tournament-create__pill--calm'
  }

  if (
    label.includes('final') ||
    label.includes('semis') ||
    label.includes('qf') ||
    label.includes('sf') ||
    label.includes('knockout') ||
    label.includes('best record')
  ) {
    return 'tournament-create__pill--finish'
  }

  return 'tournament-create__pill--play'
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
    categoryAssignments: finalCategoryAssignments.value,
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
            Pick the categories, choose players, check the draw, then create the tournament.
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
            <p class="t-muted">Name the event and choose the main dates.</p>
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
            <h3 class="t-section-title">Categories</h3>
            <p class="t-muted">Turn on only the categories you want in this event.</p>
          </div>
          <span
            class="tournament-create__tooltip"
            tabindex="0"
            data-tooltip="Categories decide who plays who. Ladder rank helps the app seed players fairly."
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
          <article
            v-for="category in allCategoryTemplates"
            :key="category.id"
            class="tournament-create__category-toggle"
            :class="{ 'tournament-create__category-toggle--active': form.enabledCategories.includes(category.id) }"
          >
            <button type="button" class="tournament-create__category-main" @click="toggleCategory(category.id)">
              <span>
                <strong>{{ category.name }}</strong>
                <small>{{ category.description }}</small>
              </span>
              <em>
                {{ category.isCustom ? 'Custom' : 'Default' }} -
                {{ form.enabledCategories.includes(category.id) ? 'On' : 'Off' }}
              </em>
            </button>
            <button
              v-if="category.isCustom"
              class="tournament-create__category-remove"
              type="button"
              aria-label="Remove custom category"
              @click="removeCustomCategory(category.id)"
            >
              Remove
            </button>
          </article>
        </div>

        <article class="tournament-create__custom-builder">
          <div>
            <h4>Create a Custom Division</h4>
            <p>
              Use this for Juniors, Doubles, Invitational, or any club-only event.
            </p>
          </div>
          <div class="tournament-create__custom-grid">
            <label>
              <span>Division Name</span>
              <input v-model="form.customCategoryDraft.name" placeholder="e.g. Juniors" />
            </label>
            <label>
              <span>Auto Rule</span>
              <select v-model="form.customCategoryDraft.assignmentRule">
                <option value="manual-only">Manual only</option>
                <option value="ladder-range">Ladder range</option>
                <option value="ladies">Female players</option>
                <option value="veterans">Veterans age rule</option>
              </select>
            </label>
            <label v-if="form.customCategoryDraft.assignmentRule === 'ladder-range'">
              <span>Rank Start</span>
              <input v-model.number="form.customCategoryDraft.ladderStart" min="1" type="number" />
            </label>
            <label v-if="form.customCategoryDraft.assignmentRule === 'ladder-range'">
              <span>Rank End</span>
              <input v-model.number="form.customCategoryDraft.ladderEnd" min="1" type="number" />
            </label>
            <label>
              <span>Player Limit</span>
              <input v-model.number="form.customCategoryDraft.maxPlayers" min="2" type="number" />
            </label>
            <button class="t-button t-button--primary" type="button" @click="createCustomCategory">
              Add Division
            </button>
          </div>
        </article>

        <div class="tournament-create__form-row">
          <label class="tournament-create__switch">
            <input v-model="form.allowSpecialOverlap" type="checkbox" />
            <span>
              <strong>Let eligible players enter twice</strong>
              <small>A Lady or Veteran can also play Premier, A, or B.</small>
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
            <p class="t-muted">Playing: {{ enabledCategoryNames }}. Best matches appear first.</p>
          </div>
          <div class="tournament-create__toolbar">
            <button class="t-button t-button--secondary" type="button" @click="toggleAllPlayers">
              {{ allPlayersSelected ? 'Clear Players' : 'Select All' }}
            </button>
            <button class="t-button t-button--primary" type="button" @click="autoAssign">
              Fill From Ladder
            </button>
          </div>
        </div>

        <article class="tournament-create__assignment-summary">
          <div>
            <strong>{{ assignedPlayerRows.length }} player{{ assignedPlayerRows.length === 1 ? '' : 's' }} matched</strong>
            <span>
              {{ unassignedPlayerRows.length }} selected player{{ unassignedPlayerRows.length === 1 ? '' : 's' }}
              will not play unless you add them.
            </span>
          </div>
          <button
            v-if="unassignedPlayerRows.length"
            class="t-button t-button--ghost"
            type="button"
            @click="form.showUnassignedPlayers = !form.showUnassignedPlayers"
          >
            {{ form.showUnassignedPlayers ? 'Hide Not Playing' : 'Show Not Playing' }}
          </button>
        </article>

        <div class="tournament-create__player-list">
          <div v-if="assignedPlayerRows.length" class="tournament-create__player-section-title">
            Playing in this event
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
            Not playing yet
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
            <h3 class="t-section-title">Ready to Create?</h3>
            <p class="t-muted">Pick the clearest format for each category.</p>
          </div>
          <span
            class="tournament-create__tooltip"
            tabindex="0"
            data-tooltip="Green is the easiest fit for the number of players. Other choices are allowed if the club prefers them."
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
              <span
                v-for="pill in visibleFormatPills(categoryDraft.selectedFormat, realPlayerCount(categoryDraft))"
                :key="pill"
                :class="formatPillClass(pill)"
              >
                {{ pill }}
              </span>
              <span :class="byeCount(categoryDraft) ? 'tournament-create__pill--calm' : 'tournament-create__pill--play'">
                {{ freePassCopy(categoryDraft) }}
              </span>
            </div>

            <div class="tournament-create__format-picker">
              <button
                v-for="format in categoryDraft.formatChoices"
                :key="format.id"
                class="tournament-create__format-option"
                :class="{ 'tournament-create__format-option--active': categoryDraft.selectedFormat.id === format.id }"
                type="button"
                @click="selectCategoryFormat(categoryDraft.id, format.id)"
              >
                <strong>{{ format.playerTitle }}</strong>
                <span>{{ format.playerSummary }}</span>
                <div class="tournament-create__format-pills">
                  <small
                    v-for="pill in visibleFormatPills(format, categoryDraft.assignmentPlayers.length)"
                    :key="pill"
                    :class="formatPillClass(pill)"
                  >
                    {{ pill }}
                  </small>
                </div>
                <em v-if="format.recommended">Recommended</em>
              </button>
            </div>

            <div v-if="categoryDraft.groups.length" class="tournament-create__groups-preview">
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
            <div v-else class="tournament-create__direct-preview">
              <strong>Straight knockout</strong>
              <span>
                No group stage. Lose once and you are out.
              </span>
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
            <span>Win Earns</span>
            <strong>{{ form.winPoints }}</strong>
          </div>
          <div>
            <span>Qualifiers</span>
            <strong>Per category</strong>
          </div>
          <div>
            <span>Knockout</span>
            <strong>Auto-fit</strong>
          </div>
          <div>
            <span>Tie Breaker</span>
            <strong>Points, sets, games, wins</strong>
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1.5px solid var(--tournament-line);
  border-radius: 10px;
  background: #ffffff;
  text-align: left;
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

.tournament-create__category-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
  border: 0;
  padding: 14px 16px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.tournament-create__category-main span {
  display: grid;
  gap: 2px;
}

.tournament-create__category-main strong {
  font-size: 14px;
}

.tournament-create__category-main em {
  color: var(--tournament-green-dark);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.tournament-create__category-remove {
  position: absolute;
  right: 8px;
  bottom: 7px;
  border: 0;
  border-radius: 6px;
  padding: 3px 7px;
  background: rgba(220, 53, 69, 0.08);
  color: #991b1b;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.tournament-create__custom-builder {
  display: grid;
  gap: 14px;
  border: 1px dashed rgba(29, 111, 181, 0.32);
  border-radius: 10px;
  padding: 16px;
  background: var(--tournament-blue-soft);
}

.tournament-create__custom-builder h4,
.tournament-create__custom-builder p {
  margin: 0;
}

.tournament-create__custom-builder h4 {
  color: var(--tournament-blue);
  font-size: 14px;
}

.tournament-create__custom-builder p {
  margin-top: 4px;
  color: var(--tournament-muted);
  font-size: 12px;
  line-height: 1.45;
}

.tournament-create__custom-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
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

.tournament-create__review-stats .tournament-create__pill--play,
.tournament-create__format-pills .tournament-create__pill--play {
  border: 1px solid rgba(29, 111, 181, 0.18);
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
}

.tournament-create__review-stats .tournament-create__pill--safe,
.tournament-create__format-pills .tournament-create__pill--safe {
  border: 1px solid rgba(0, 181, 26, 0.2);
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__review-stats .tournament-create__pill--finish,
.tournament-create__format-pills .tournament-create__pill--finish {
  border: 1px solid rgba(124, 58, 237, 0.18);
  background: #f3e8ff;
  color: #6d28d9;
}

.tournament-create__review-stats .tournament-create__pill--calm,
.tournament-create__format-pills .tournament-create__pill--calm {
  border: 1px solid rgba(245, 158, 11, 0.2);
  background: #fffbeb;
  color: #92400e;
}

.tournament-create__review-stats .tournament-create__pill--danger,
.tournament-create__format-pills .tournament-create__pill--danger {
  border: 1px solid rgba(220, 53, 69, 0.18);
  background: rgba(220, 53, 69, 0.07);
  color: #991b1b;
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

.tournament-create__format-picker {
  display: grid;
  gap: 8px;
}

.tournament-create__format-option {
  position: relative;
  display: grid;
  gap: 3px;
  border: 1px solid var(--tournament-line);
  border-radius: 9px;
  padding: 12px;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;
}

.tournament-create__format-option:hover {
  transform: translateY(-1px);
  border-color: rgba(0, 181, 26, 0.28);
}

.tournament-create__format-option--active {
  border-color: rgba(0, 181, 26, 0.42);
  background: var(--tournament-green-soft);
}

.tournament-create__format-option strong {
  padding-right: 94px;
  color: var(--tournament-ink);
  font-size: 12px;
}

.tournament-create__format-option span {
  color: var(--tournament-muted);
  font-size: 11px;
  line-height: 1.35;
}

.tournament-create__format-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.tournament-create__format-pills small {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
}

.tournament-create__format-option em {
  position: absolute;
  top: 8px;
  right: 10px;
  color: var(--tournament-green-dark);
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tournament-create__direct-preview {
  display: grid;
  gap: 5px;
  border-radius: 8px;
  padding: 12px;
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
}

.tournament-create__direct-preview strong {
  font-size: 13px;
}

.tournament-create__direct-preview span {
  font-size: 12px;
  line-height: 1.45;
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
  .tournament-create__custom-grid,
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
