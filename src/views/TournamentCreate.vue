<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
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
const route = useRoute()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

const steps = ['Basics', 'Categories', 'Players', 'Review']
const stepKeys = ['basics', 'categories', 'players', 'review']

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
    assignmentRule: 'ladder-range',
    gender: 'any',
    veteranOnly: false,
    allowOverlap: true,
    ladderStart: 1,
    ladderEnd: 12,
    maxPlayers: 12,
  },
  editingCustomCategoryId: '',
  selectedPlayerIds: [],
  manualAssignments: {},
  manualExclusions: {},
  playerSearch: '',
  activePlayerView: 'playing',
  activePlayerCategoryId: '',
  activeReviewCategoryId: '',
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
const customBuilderRef = ref(null)

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
const assignmentResult = computed(() =>
  assignPlayersToCategories({
    players: selectedPlayers.value,
    categories: enabledCategoryTemplates.value,
    allowSpecialOverlap: form.allowSpecialOverlap,
    veteranAge: Number(form.veteranAge),
    manualAssignments: form.manualAssignments,
    manualExclusions: form.manualExclusions,
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

const safePlayerSearch = computed(() => sanitizeSearchTerm(form.playerSearch))
const activePlayerCategory = computed(
  () =>
    enabledCategoryTemplates.value.find((category) => category.id === form.activePlayerCategoryId) ||
    enabledCategoryTemplates.value[0] ||
    null,
)
const activePlayerCategoryDraft = computed(
  () =>
    categoryDrafts.value.find((draft) => draft.id === activePlayerCategory.value?.id) ||
    null,
)
const activeCategoryPlayerIds = computed(
  () =>
    new Set(
      (activePlayerCategoryDraft.value?.assignmentPlayers || []).map((player) => player.playerId),
    ),
)
const activeCategoryPlayerRows = computed(() => {
  const playerById = new Map(activePlayers.value.map((player) => [player.id, player]))

  return (activePlayerCategoryDraft.value?.assignmentPlayers || [])
    .map((assignedPlayer) => {
      const player = playerById.get(assignedPlayer.playerId)

      if (!player) {
        return null
      }

      const otherCategoryNames = assignedCategoryIds(player)
        .filter((categoryId) => categoryId !== activePlayerCategory.value?.id)
        .map((categoryId) => categoryNameById(categoryId))

      return {
        player,
        source: assignedPlayer.assignmentSource || 'auto',
        otherCategoryNames,
      }
    })
    .filter(Boolean)
})
const activeCategoryAddedRows = computed(() =>
  activeCategoryPlayerRows.value.filter((row) => row.source === 'manual'),
)
const activeCategoryRemovedRows = computed(() => {
  if (!activePlayerCategory.value) {
    return []
  }

  const playerById = new Map(activePlayers.value.map((player) => [player.id, player]))

  return Object.keys(form.manualExclusions)
    .filter((playerId) => getExcludedCategoryIds(playerId).includes(activePlayerCategory.value.id))
    .map((playerId) => playerById.get(playerId))
    .filter(Boolean)
    .map((player) => ({
      player,
      assignmentLabel: assignedCategoryNames(player),
      otherCategoryNames: assignedCategoryIds(player)
        .filter((categoryId) => categoryId !== activePlayerCategory.value?.id)
        .map((categoryId) => categoryNameById(categoryId)),
    }))
})
const activePlayerViewRows = computed(() => {
  if (form.activePlayerView === 'added') {
    return activeCategoryAddedRows.value
  }

  if (form.activePlayerView === 'removed') {
    return activeCategoryRemovedRows.value
  }

  return activeCategoryPlayerRows.value
})
const availablePlayerRows = computed(() =>
  activePlayers.value
    .filter((player) => !activeCategoryPlayerIds.value.has(player.id))
    .map((player) => ({
      player,
      assignmentLabel: assignedCategoryNames(player),
      isSelected: selectedPlayerIdSet.value.has(player.id),
    }))
    .filter((row) => matchesPlayerSearch(row)),
)
const activeCategoryManualAddCount = computed(() =>
  activePlayerCategory.value ? countCategoryLookup(form.manualAssignments, activePlayerCategory.value.id) : 0,
)
const activeCategoryManualRemoveCount = computed(() =>
  activePlayerCategory.value ? countCategoryLookup(form.manualExclusions, activePlayerCategory.value.id) : 0,
)
const todayInputValue = formatDateInput(new Date())
const activeReviewCategoryDraft = computed(
  () =>
    categoryDrafts.value.find((draft) => draft.id === form.activeReviewCategoryId) ||
    categoryDrafts.value[0] ||
    null,
)
const enabledCategoryCount = computed(() => enabledCategoryTemplates.value.length)
const excludedCategoryCount = computed(() => allCategoryTemplates.value.length - enabledCategoryCount.value)
const activeCategoryPlayerTotal = computed(() =>
  enabledCategoryTemplates.value.reduce(
    (total, category) => total + previewCategoryCount(category.id),
    0,
  ),
)
const roundRobinStartMin = computed(() => todayInputValue)
const roundRobinEndMin = computed(() => form.roundRobinStart || todayInputValue)
const knockoutStartMin = computed(() => form.roundRobinEnd || form.roundRobinStart || todayInputValue)
const finalDateMin = computed(
  () => form.knockoutStart || form.roundRobinEnd || form.roundRobinStart || todayInputValue,
)
const areDatesAligned = computed(
  () =>
    isDateOnOrAfter(form.roundRobinStart, roundRobinStartMin.value) &&
    isDateOnOrAfter(form.roundRobinEnd, roundRobinEndMin.value) &&
    isDateOnOrAfter(form.knockoutStart, knockoutStartMin.value) &&
    isDateOnOrAfter(form.finalDate, finalDateMin.value),
)

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isDateOnOrAfter(value, minimum) {
  return Boolean(value && minimum && value >= minimum)
}

function clampDateField(field, minimum) {
  if (form[field] && form[field] < minimum) {
    form[field] = minimum
  }
}

function normalizeTournamentDates() {
  clampDateField('roundRobinStart', roundRobinStartMin.value)
  clampDateField('roundRobinEnd', roundRobinEndMin.value)
  clampDateField('knockoutStart', knockoutStartMin.value)
  clampDateField('finalDate', finalDateMin.value)
}

function isCategoryEnabled(categoryId) {
  return form.enabledCategories.includes(categoryId)
}

function playerInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function previewCategoryCount(categoryId) {
  const draft = categoryDrafts.value.find((categoryDraft) => categoryDraft.id === categoryId)
  return draft ? realPlayerCount(draft) : 0
}

function countCategoryLookup(lookup, categoryId) {
  return Object.values(lookup).filter((value) => {
    const categoryIds = Array.isArray(value) ? value : value ? [value] : []
    return categoryIds.includes(categoryId)
  }).length
}

function categoryEditLabel(categoryId) {
  const added = countCategoryLookup(form.manualAssignments, categoryId)
  const removed = countCategoryLookup(form.manualExclusions, categoryId)

  if (!added && !removed) {
    return ''
  }

  if (added && removed) {
    return `${added} added, ${removed} removed`
  }

  return added ? `${added} added` : `${removed} removed`
}

function categorySourceLabel(categoryId) {
  const category = allCategoryTemplates.value.find((template) => template.id === categoryId)
  const hasEdits =
    countCategoryLookup(form.manualAssignments, categoryId) ||
    countCategoryLookup(form.manualExclusions, categoryId)

  if (hasEdits) {
    return 'Edited by admin'
  }

  if (!category) {
    return 'Category'
  }

  if (category.assignmentMode === 'manual-only') {
    return 'Manual category'
  }

  return 'Easy auto fill'
}

function sanitizeSearchTerm(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function handlePlayerSearchInput(event) {
  form.playerSearch = sanitizeSearchTerm(event.target.value)
}

function matchesPlayerSearch(row) {
  const term = safePlayerSearch.value.trim().toLowerCase()
  if (!term) {
    return true
  }

  const player = row.player
  const searchableText = [
    player.name,
    player.rank,
    player.category,
    player.gender,
    player.isVeteran ? 'veteran' : '',
    row.assignmentLabel,
  ]
    .join(' ')
    .toLowerCase()

  return searchableText.includes(term)
}

const isBasicsValid = computed(
  () =>
    form.name &&
    form.roundRobinStart &&
    form.roundRobinEnd &&
    form.knockoutStart &&
    form.finalDate &&
    areDatesAligned.value,
)
const isCategoriesStepValid = computed(() => enabledCategoryTemplates.value.length > 0)
const isPlayersStepValid = computed(
  () => isCategoriesStepValid.value && form.selectedPlayerIds.length > 0,
)
const canGenerate = computed(
  () =>
    isBasicsValid.value &&
    isCategoriesStepValid.value &&
    isPlayersStepValid.value &&
    setupValidation.value.canGenerate,
)

function syncRouteStep(stepNumber) {
  const step = stepKeys[stepNumber - 1] || 'basics'
  router.replace({
    path: route.path,
    query: {
      ...route.query,
      step,
    },
  })
}

function goNext() {
  if (form.step === 2 && !isCategoriesStepValid.value) {
    notificationStore.addToast({
      message: 'Choose or create at least one category before continuing.',
      type: 'warning',
      duration: 2200,
    })
    return
  }

  if (form.step < steps.length) {
    syncRouteStep(form.step + 1)
  }
}

function goBack() {
  if (form.step > 1) {
    syncRouteStep(form.step - 1)
    return
  }

  router.push('/tournaments')
}

function toggleCategory(categoryId) {
  const category = allCategoryTemplates.value.find((template) => template.id === categoryId)

  if (form.enabledCategories.includes(categoryId)) {
    form.enabledCategories = form.enabledCategories.filter((id) => id !== categoryId)
    if (category) {
      notificationStore.addToast({
        message: `${category.name} removed from this tournament.`,
        type: 'info',
        duration: 1600,
      })
    }
    return
  }

  form.enabledCategories = [...form.enabledCategories, categoryId]
  if (category) {
    notificationStore.addToast({
      message: `${category.name} included in this tournament.`,
      type: 'success',
      duration: 1600,
    })
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function buildCustomCategoryDescription() {
  return `Custom rule: ${customCategoryRuleSummary()}`
}

function resetCustomCategoryDraft() {
  form.customCategoryDraft = {
    name: '',
    assignmentRule: 'ladder-range',
    gender: 'any',
    veteranOnly: false,
    allowOverlap: true,
    ladderStart: 1,
    ladderEnd: 12,
    maxPlayers: 12,
  }
  form.editingCustomCategoryId = ''
}

function customCategoryRuleSummary(draft = form.customCategoryDraft) {
  const genderLabel = {
    any: 'Any gender',
    female: 'Ladies only',
    male: 'Men only',
  }[draft.gender] || 'Any gender'
  const fillLabel = draft.assignmentRule === 'ladder-range'
    ? `Ranks ${Number(draft.ladderStart || 1)}-${Number(draft.ladderEnd || draft.maxPlayers || 12)}`
    : draft.assignmentRule === 'eligibility'
      ? 'Fill by rule'
      : 'Admin picks players'
  const ageLabel = draft.veteranOnly ? 'Veterans only' : 'Any age'

  return `${genderLabel} - ${ageLabel} - ${fillLabel} - Limit ${Number(draft.maxPlayers || 12)}`
}

function buildCustomCategoryEligibility() {
  return {
    gender: form.customCategoryDraft.gender || 'any',
    veteranOnly: Boolean(form.customCategoryDraft.veteranOnly),
  }
}

function buildCustomCategoryFromDraft(id, options = {}) {
  const name = form.customCategoryDraft.name.trim()
  const assignmentRule = form.customCategoryDraft.assignmentRule
  const maxPlayers = Number(form.customCategoryDraft.maxPlayers || 12)
  const assignmentMode = assignmentRule === 'ladder-range'
    ? 'ladder-range'
    : assignmentRule === 'eligibility'
      ? 'eligibility'
      : 'manual-only'

  return {
    ...(options.existingCategory || {}),
    id,
    name,
    description: buildCustomCategoryDescription(),
    assignmentMode,
    ladderStart: Number(form.customCategoryDraft.ladderStart || 1),
    ladderEnd: Number(form.customCategoryDraft.ladderEnd || maxPlayers),
    targetPlayers: maxPlayers,
    minPlayers: 2,
    maxPlayers,
    groupCount: 2,
    qualifiersPerGroup: 4,
    allowByes: true,
    allowSpecialOverlap: Boolean(form.customCategoryDraft.allowOverlap),
    eligibility: buildCustomCategoryEligibility(),
    isCustom: true,
  }
}

function saveCustomCategory() {
  const name = form.customCategoryDraft.name.trim()
  if (!name) {
    notificationStore.addToast({
      message: 'Name the custom category before saving it.',
      type: 'warning',
      duration: 1800,
    })
    return
  }

  if (form.editingCustomCategoryId) {
    const existingCategory = form.customCategories.find(
      (category) => category.id === form.editingCustomCategoryId,
    )

    if (!existingCategory) {
      resetCustomCategoryDraft()
      return
    }

    const category = buildCustomCategoryFromDraft(existingCategory.id, { existingCategory })
    form.customCategories = form.customCategories.map((customCategory) =>
      customCategory.id === category.id ? category : customCategory,
    )
    notificationStore.addToast({
      message: `${category.name} division updated.`,
      type: 'success',
      duration: 1800,
    })
    resetCustomCategoryDraft()
    return
  }

  const id = `custom-${slugify(name)}-${Date.now()}`
  const category = buildCustomCategoryFromDraft(id)

  form.customCategories = [...form.customCategories, category]
  form.enabledCategories = [...form.enabledCategories, id]
  form.activePlayerCategoryId = id
  resetCustomCategoryDraft()
  notificationStore.addToast({
    message: `${category.name} division added.`,
    type: 'success',
    duration: 1800,
  })
}

async function editCustomCategory(categoryId) {
  const category = form.customCategories.find((customCategory) => customCategory.id === categoryId)

  if (!category) {
    return
  }

  form.editingCustomCategoryId = category.id
  form.customCategoryDraft = {
    name: category.name,
    assignmentRule:
      category.assignmentMode === 'ladder-range'
        ? 'ladder-range'
        : category.assignmentMode === 'eligibility'
          ? 'eligibility'
          : 'manual-only',
    gender: category.eligibility?.gender || 'any',
    veteranOnly: Boolean(category.eligibility?.veteranOnly),
    allowOverlap: Boolean(category.allowSpecialOverlap),
    ladderStart: Number(category.ladderStart || 1),
    ladderEnd: Number(category.ladderEnd || category.maxPlayers || 12),
    maxPlayers: Number(category.maxPlayers || category.targetPlayers || 12),
  }

  await nextTick()
  if (customBuilderRef.value) {
    customBuilderRef.value.open = true
    customBuilderRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function removeCustomCategory(categoryId) {
  const category = form.customCategories.find((customCategory) => customCategory.id === categoryId)
  if (form.editingCustomCategoryId === categoryId) {
    resetCustomCategoryDraft()
  }

  form.customCategories = form.customCategories.filter((category) => category.id !== categoryId)
  form.enabledCategories = form.enabledCategories.filter((id) => id !== categoryId)
  delete form.categoryFormatModes[categoryId]

  Object.keys(form.manualAssignments).forEach((playerId) => {
    const nextCategoryIds = getManualCategoryIds(playerId).filter((id) => id !== categoryId)

    if (nextCategoryIds.length) {
      form.manualAssignments[playerId] = nextCategoryIds
    } else {
      delete form.manualAssignments[playerId]
    }
  })
  Object.keys(form.manualExclusions).forEach((playerId) => {
    const nextCategoryIds = getExcludedCategoryIds(playerId).filter((id) => id !== categoryId)

    if (nextCategoryIds.length) {
      form.manualExclusions[playerId] = nextCategoryIds
    } else {
      delete form.manualExclusions[playerId]
    }
  })

  if (category) {
    notificationStore.addToast({
      message: `${category.name} division removed.`,
      type: 'info',
      duration: 1800,
    })
  }
}

function togglePlayer(playerId) {
  if (selectedPlayerIdSet.value.has(playerId)) {
    form.selectedPlayerIds = form.selectedPlayerIds.filter((id) => id !== playerId)
    delete form.manualAssignments[playerId]
    delete form.manualExclusions[playerId]
    return
  }

  form.selectedPlayerIds = [...form.selectedPlayerIds, playerId]
}

function getManualCategoryIds(playerId) {
  const value = form.manualAssignments[playerId]

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  return value ? [value] : []
}

function getExcludedCategoryIds(playerId) {
  const value = form.manualExclusions[playerId]

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  return value ? [value] : []
}

function removeCategoryIdFromLookup(lookup, playerId, categoryId) {
  const value = lookup[playerId]
  const categoryIds = Array.isArray(value) ? value : value ? [value] : []
  const nextCategoryIds = categoryIds.filter((id) => id !== categoryId)

  if (nextCategoryIds.length) {
    lookup[playerId] = nextCategoryIds
  } else {
    delete lookup[playerId]
  }
}

function removeCategoryIdFromAllLookups(categoryId) {
  Object.keys(form.manualAssignments).forEach((playerId) => {
    removeCategoryIdFromLookup(form.manualAssignments, playerId, categoryId)
  })
  Object.keys(form.manualExclusions).forEach((playerId) => {
    removeCategoryIdFromLookup(form.manualExclusions, playerId, categoryId)
  })
}

function selectPlayerCategory(categoryId) {
  form.activePlayerCategoryId = categoryId
  form.playerSearch = ''
  form.activePlayerView = 'playing'
}

function categoryNameById(categoryId) {
  return allCategoryTemplates.value.find((category) => category.id === categoryId)?.name || categoryId
}

function isManualCategorySelected(playerId, categoryId) {
  return getManualCategoryIds(playerId).includes(categoryId)
}

function addManualAssignment(playerId, categoryId) {
  if (!categoryId || isManualCategorySelected(playerId, categoryId)) {
    return
  }

  if (!selectedPlayerIdSet.value.has(playerId)) {
    form.selectedPlayerIds = [...form.selectedPlayerIds, playerId]
  }

  const nextCategoryIds = [...getManualCategoryIds(playerId), categoryId]
  removeCategoryIdFromLookup(form.manualExclusions, playerId, categoryId)
  form.manualAssignments[playerId] = nextCategoryIds

  notificationStore.addToast({
    message: `${categoryNameById(categoryId)} added for this player.`,
    type: 'success',
    duration: 1500,
  })
}

function addPlayerToActiveCategory(playerId) {
  if (!activePlayerCategory.value) {
    return
  }

  addManualAssignment(playerId, activePlayerCategory.value.id)
}

function removeManualAssignment(playerId, categoryId) {
  const nextCategoryIds = getManualCategoryIds(playerId).filter((id) => id !== categoryId)

  if (nextCategoryIds.length) {
    form.manualAssignments[playerId] = nextCategoryIds
  } else {
    delete form.manualAssignments[playerId]
  }

  notificationStore.addToast({
    message: `${categoryNameById(categoryId)} removed for this player.`,
    type: 'info',
    duration: 1400,
  })
}

function removeAssignedCategory(playerId, categoryId, options = {}) {
  if (isManualCategorySelected(playerId, categoryId)) {
    removeCategoryIdFromLookup(form.manualAssignments, playerId, categoryId)
    if (!options.silent) {
      notificationStore.addToast({
        message: `${categoryNameById(categoryId)} removed for this player.`,
        type: 'info',
        duration: 1400,
      })
    }
    return
  }

  if (getExcludedCategoryIds(playerId).includes(categoryId)) {
    return
  }

  form.manualExclusions[playerId] = [...getExcludedCategoryIds(playerId), categoryId]

  if (!options.silent) {
    notificationStore.addToast({
      message: `${categoryNameById(categoryId)} removed from this player.`,
      type: 'info',
      duration: 1500,
    })
  }
}

function removePlayerFromActiveCategory(playerId) {
  if (!activePlayerCategory.value) {
    return
  }

  removeAssignedCategory(playerId, activePlayerCategory.value.id)
}

function restorePlayerToActiveCategory(playerId) {
  if (!activePlayerCategory.value) {
    return
  }

  removeCategoryIdFromLookup(form.manualExclusions, playerId, activePlayerCategory.value.id)

  if (!selectedPlayerIdSet.value.has(playerId)) {
    form.selectedPlayerIds = [...form.selectedPlayerIds, playerId]
  }

  notificationStore.addToast({
    message: `${categoryNameById(activePlayerCategory.value.id)} restored for this player.`,
    type: 'success',
    duration: 1500,
  })
}

function resetActiveCategoryToAuto() {
  if (!activePlayerCategory.value) {
    return
  }

  const categoryId = activePlayerCategory.value.id
  removeCategoryIdFromAllLookups(categoryId)
  notificationStore.addToast({
    message: `${activePlayerCategory.value.name} reset to its rule.`,
    type: 'success',
    duration: 1600,
  })
}

function clearActiveCategoryPlayers() {
  if (!activePlayerCategory.value || !activeCategoryPlayerRows.value.length) {
    return
  }

  const categoryId = activePlayerCategory.value.id
  activeCategoryPlayerRows.value.forEach((row) => {
    removeAssignedCategory(row.player.id, categoryId, { silent: true })
  })

  notificationStore.addToast({
    message: `${activePlayerCategory.value.name} cleared for manual picking.`,
    type: 'info',
    duration: 1700,
  })
}

function selectCategoryFormat(categoryId, formatId) {
  form.categoryFormatModes[categoryId] = formatId
  const category = categoryDrafts.value.find((draft) => draft.id === categoryId)
  const format = category?.formatChoices.find((choice) => choice.id === formatId)

  if (category && format) {
    notificationStore.addToast({
      message: `${category.name}: ${format.name} selected.`,
      type: 'success',
      duration: 1800,
    })
  }
}

function selectReviewCategory(categoryId) {
  form.activeReviewCategoryId = categoryId
}

function assignedCategoryIds(player) {
  return assignmentResult.value.assignments
    .filter((assignment) =>
      assignment.players.some((assignedPlayer) => assignedPlayer.playerId === player.id),
    )
    .map((assignment) => assignment.category.id)
}

function assignedCategoryNames(player) {
  const names = assignedCategoryIds(player).map((categoryId) => categoryNameById(categoryId))

  return names.length ? names.join(', ') : 'Not assigned'
}

function realPlayerCount(categoryDraft) {
  return categoryDraft.players.filter((player) => !player.isBye).length
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

watch(
  () => route.query.step,
  (step) => {
    const nextStep = String(step || 'basics')
    const index = stepKeys.indexOf(nextStep)
    form.step = index >= 0 ? index + 1 : 1
  },
  { immediate: true },
)

watch(
  () => [form.roundRobinStart, form.roundRobinEnd, form.knockoutStart, form.finalDate],
  () => normalizeTournamentDates(),
)

watch(
  () => categoryDrafts.value.map((draft) => draft.id),
  (categoryIds) => {
    if (!categoryIds.length) {
      form.activeReviewCategoryId = ''
      return
    }

    if (!categoryIds.includes(form.activeReviewCategoryId)) {
      form.activeReviewCategoryId = categoryIds[0]
    }
  },
  { immediate: true },
)

watch(
  () => enabledCategoryTemplates.value.map((category) => category.id),
  (categoryIds) => {
    if (!categoryIds.length) {
      form.activePlayerCategoryId = ''
      return
    }

    if (!categoryIds.includes(form.activePlayerCategoryId)) {
      form.activePlayerCategoryId = categoryIds[0]
    }
  },
  { immediate: true },
)

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
  <section
    class="tournament-create"
    :class="{ 'tournament-create--with-side-rail': form.step === 3 || form.step === 4 }"
  >
    <aside v-if="form.step === 3" class="tournament-create__side-rail" aria-label="Choose category to edit">
      <button class="tournament-create__side-back" type="button" @click="router.push('/tournaments')">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Back to tournaments
      </button>
      <button
        v-for="category in enabledCategoryTemplates"
        :key="category.id"
        class="tournament-create__assignment-tab"
        :class="{ 'tournament-create__assignment-tab--active': activePlayerCategory?.id === category.id }"
        type="button"
        @click="selectPlayerCategory(category.id)"
      >
        <span>
          <strong>{{ category.name }}</strong>
          <small>{{ categorySourceLabel(category.id) }}</small>
        </span>
        <i v-if="categoryEditLabel(category.id)">{{ categoryEditLabel(category.id) }}</i>
      </button>
    </aside>

    <aside v-else-if="form.step === 4" class="tournament-create__side-rail" aria-label="Review categories">
      <button class="tournament-create__side-back" type="button" @click="router.push('/tournaments')">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Back to tournaments
      </button>
      <button
        v-for="categoryDraft in categoryDrafts"
        :key="categoryDraft.id"
        class="tournament-create__category-tab"
        :class="{ 'tournament-create__category-tab--active': activeReviewCategoryDraft?.id === categoryDraft.id }"
        type="button"
        @click="selectReviewCategory(categoryDraft.id)"
      >
        <span>{{ categoryDraft.name }}</span>
        <strong>{{ realPlayerCount(categoryDraft) }} players</strong>
      </button>
    </aside>

    <main class="tournament-create__workspace">
      <section v-if="form.step === 1" class="tournament-create__panel tournament-create__panel--animated">
        <div>
            <h3 class="t-section-title">Tournament Basics</h3>
            <p class="t-muted">Name the event and choose the main dates.</p>
        </div>
        <article class="tournament-create__date-note">
          <strong>Future dates only</strong>
          <span>Start from today or later. Each stage must happen after the one before it.</span>
        </article>
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
            <input v-model="form.roundRobinStart" :min="roundRobinStartMin" type="date" />
          </label>
          <label>
              <span>Group Stage End *</span>
            <input v-model="form.roundRobinEnd" :min="roundRobinEndMin" type="date" />
          </label>
        </div>
        <div class="tournament-create__form-row">
          <label>
              <span>Knockout Start *</span>
            <input v-model="form.knockoutStart" :min="knockoutStartMin" type="date" />
          </label>
          <label>
            <span>Final Date *</span>
            <input v-model="form.finalDate" :min="finalDateMin" type="date" />
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
            <h3 class="t-section-title">Pick Categories To Run</h3>
            <p class="t-muted">The RSP default is already selected. Use each switch to include or exclude a division.</p>
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
            <strong>RSP Masters default is on</strong>
            <p>Premier, Category A, Category B, Ladies, and Veterans are included. You can still adjust them below.</p>
          </div>
        </article>

        <div class="tournament-create__category-stats" aria-label="Category selection summary">
          <div>
            <strong class="tournament-create__stat-number tournament-create__stat-number--green">
              {{ enabledCategoryCount }}
            </strong>
            <span>categories active</span>
          </div>
          <div>
            <strong class="tournament-create__stat-number">{{ activeCategoryPlayerTotal }}</strong>
            <span>category entries</span>
          </div>
          <div>
            <strong class="tournament-create__stat-number">{{ excludedCategoryCount }}</strong>
            <span>excluded</span>
          </div>
        </div>

        <div class="tournament-create__section-label">All categories</div>

        <article v-if="!isCategoriesStepValid" class="tournament-create__category-required">
          <strong>Pick at least one category</strong>
          <span>Select a default division below, or create a custom one for this tournament.</span>
        </article>

        <div class="tournament-create__categories">
          <article
            v-for="category in allCategoryTemplates"
            :key="category.id"
            class="tournament-create__category-card"
            :class="{ 'tournament-create__category-card--off': !isCategoryEnabled(category.id) }"
          >
            <div class="tournament-create__category-top">
              <div>
                <h4>{{ category.name }}</h4>
                <span v-if="category.isCustom" class="tournament-create__custom-badge">Custom</span>
              </div>
              <button
                class="tournament-create__toggle-control"
                type="button"
                :aria-pressed="isCategoryEnabled(category.id)"
                :aria-label="`${isCategoryEnabled(category.id) ? 'Exclude' : 'Include'} ${category.name}`"
                @click="toggleCategory(category.id)"
              >
                <span class="tournament-create__toggle-pill" aria-hidden="true"></span>
              </button>
            </div>
            <p>{{ category.description }}</p>
            <div class="tournament-create__category-footer">
              <div>
                <strong>{{ previewCategoryCount(category.id) }}</strong>
                <span>players</span>
              </div>
              <em>
                {{ isCategoryEnabled(category.id) ? 'Playing' : 'Excluded' }}
              </em>
            </div>
            <div v-if="category.isCustom" class="tournament-create__category-card-actions">
              <button
                class="tournament-create__category-edit"
                type="button"
                aria-label="Edit custom category"
                @click="editCustomCategory(category.id)"
              >
                Edit
              </button>
              <button
                class="tournament-create__category-remove"
                type="button"
                aria-label="Remove custom category"
                @click="removeCustomCategory(category.id)"
              >
                Delete
              </button>
            </div>
          </article>
        </div>

        <details ref="customBuilderRef" class="tournament-create__custom-builder">
          <summary>
            <span>
              <strong>{{ form.editingCustomCategoryId ? 'Edit custom division' : 'Create a custom category' }}</strong>
              <small>
                {{
                  form.editingCustomCategoryId
                    ? 'Update this division rule and save it.'
                    : 'Create the division here. Add or remove names in the Players step.'
                }}
              </small>
            </span>
            <em class="tournament-create__custom-builder-action">
              <span aria-hidden="true">+</span>
              {{ form.editingCustomCategoryId ? 'Editing' : 'Add division' }}
            </em>
          </summary>
          <div class="tournament-create__custom-grid">
            <label>
              <span>Category Name</span>
              <input v-model="form.customCategoryDraft.name" placeholder="e.g. Senior Ladies" />
            </label>
            <label>
              <span>Who Can Enter</span>
              <select v-model="form.customCategoryDraft.gender">
                <option value="any">Any gender</option>
                <option value="female">Ladies only</option>
                <option value="male">Men only</option>
              </select>
            </label>
            <label>
              <span>Fill Method</span>
              <select v-model="form.customCategoryDraft.assignmentRule">
                <option value="manual-only">Admin picks players</option>
                <option value="eligibility">Fill by rule</option>
                <option value="ladder-range">Fill by rank</option>
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
            <label class="tournament-create__switch">
              <input v-model="form.customCategoryDraft.veteranOnly" type="checkbox" />
              <span>
                <strong>Veterans only</strong>
                <small>Uses the Veterans Age below.</small>
              </span>
            </label>
            <label class="tournament-create__switch">
              <input v-model="form.customCategoryDraft.allowOverlap" type="checkbox" />
              <span>
                <strong>Can play twice</strong>
                <small>Player may also stay in Premier, A, or B.</small>
              </span>
            </label>
            <div class="tournament-create__rule-preview">
              <strong>Rule Preview</strong>
              <span>{{ customCategoryRuleSummary() }}</span>
            </div>
            <button
              class="t-button t-button--primary tournament-create__create-category-button"
              type="button"
              @click="saveCustomCategory"
            >
              {{ form.editingCustomCategoryId ? 'Save Division' : 'Create Division' }}
            </button>
            <button
              v-if="form.editingCustomCategoryId"
              class="t-button t-button--ghost tournament-create__cancel-edit-button"
              type="button"
              @click="resetCustomCategoryDraft"
            >
              Cancel Edit
            </button>
          </div>
        </details>

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
            <p class="t-muted">The app fills each division by rank or rule. Pick a division, then adjust the list when needed.</p>
          </div>
        </div>

        <div v-if="setupBlockers.length" class="tournament-create__blockers">
          <strong>What is stopping generation</strong>
          <span v-for="blocker in setupBlockers" :key="blocker.message">{{ blocker.message }}</span>
        </div>

        <section class="tournament-create__assignment-studio">
          <article v-if="activePlayerCategory" class="tournament-create__category-editor">
            <header class="tournament-create__category-editor-head">
              <div>
                <span>Now editing</span>
                <h4>{{ activePlayerCategory.name }}</h4>
                <p>{{ activePlayerCategory.description }}</p>
              </div>
              <div class="tournament-create__category-kpis" aria-label="Category player summary">
                <span>
                  <strong>{{ activeCategoryPlayerRows.length }}</strong>
                  Playing here
                </span>
              </div>
            </header>

            <div class="tournament-create__category-actions">
              <button class="t-button t-button--secondary" type="button" @click="resetActiveCategoryToAuto">
                {{ activePlayerCategory.assignmentMode === 'manual-only' ? 'Clear picks' : 'Use easy auto fill' }}
              </button>
              <button
                class="t-button t-button--ghost"
                :disabled="!activeCategoryPlayerRows.length"
                type="button"
                @click="clearActiveCategoryPlayers"
              >
                Empty category
              </button>
              <button
                class="tournament-create__view-tab"
                :class="{ 'tournament-create__view-tab--active': form.activePlayerView === 'playing' }"
                type="button"
                @click="form.activePlayerView = 'playing'"
              >
                Playing
                <strong>{{ activeCategoryPlayerRows.length }}</strong>
              </button>
              <button
                class="tournament-create__view-tab"
                :class="{ 'tournament-create__view-tab--active': form.activePlayerView === 'added' }"
                type="button"
                @click="form.activePlayerView = 'added'"
              >
                Added
                <strong>{{ activeCategoryManualAddCount }}</strong>
              </button>
              <button
                class="tournament-create__view-tab"
                :class="{ 'tournament-create__view-tab--active': form.activePlayerView === 'removed' }"
                type="button"
                @click="form.activePlayerView = 'removed'"
              >
                Removed
                <strong>{{ activeCategoryManualRemoveCount }}</strong>
              </button>
            </div>

            <section class="tournament-create__category-members">
              <header>
                <div>
                  <h5>
                    {{
                      form.activePlayerView === 'removed'
                        ? `Removed from ${activePlayerCategory.name}`
                        : form.activePlayerView === 'added'
                          ? `Added to ${activePlayerCategory.name}`
                          : `Playing in ${activePlayerCategory.name}`
                    }}
                  </h5>
                  <p>
                    {{
                      form.activePlayerView === 'removed'
                        ? 'Restore anyone you removed by mistake.'
                        : form.activePlayerView === 'added'
                          ? 'These players were added by hand.'
                          : 'Ranks and rule matches are filled for you. Remove only from this division when needed.'
                    }}
                  </p>
                </div>
              </header>

              <div v-if="activePlayerViewRows.length" class="tournament-create__member-list">
                <article
                  v-for="row in activePlayerViewRows"
                  :key="row.player.id"
                  class="tournament-create__member-row"
                >
                  <span class="tournament-create__member-rank">#{{ row.player.rank }}</span>
                  <div class="tournament-create__member-person">
                    <img
                      v-if="row.player.imageUrl"
                      :alt="row.player.name"
                      :src="row.player.imageUrl"
                    />
                    <span v-else class="tournament-create__player-avatar">
                      {{ playerInitials(row.player.name) }}
                    </span>
                    <div>
                      <strong>{{ row.player.name }}</strong>
                      <small>
                        {{ row.player.gender || 'unknown' }}
                        <template v-if="row.player.isVeteran"> / veteran</template>
                      </small>
                    </div>
                  </div>
                  <div class="tournament-create__member-tags">
                    <em
                      v-if="form.activePlayerView !== 'removed'"
                      :class="{ 'tournament-create__source-pill--manual': row.source === 'manual' }"
                    >
                      {{ row.source === 'manual' ? 'Added by hand' : 'Filled by rank/rule' }}
                    </em>
                    <em v-else class="tournament-create__source-pill--removed">Removed</em>
                    <span v-for="categoryName in row.otherCategoryNames" :key="categoryName">
                      {{ categoryName }}
                    </span>
                    <span v-if="form.activePlayerView === 'removed'">{{ row.assignmentLabel }}</span>
                  </div>
                  <button
                    v-if="form.activePlayerView === 'removed'"
                    class="tournament-create__mini-action tournament-create__mini-action--add"
                    type="button"
                    @click="restorePlayerToActiveCategory(row.player.id)"
                  >
                    Restore
                  </button>
                  <button
                    v-else
                    class="tournament-create__mini-action"
                    type="button"
                    @click="removePlayerFromActiveCategory(row.player.id)"
                  >
                    Remove
                  </button>
                </article>
              </div>

              <article v-else class="tournament-create__empty-results">
                <strong>No {{ form.activePlayerView }} players here yet</strong>
                <span>
                  {{
                    form.activePlayerView === 'removed'
                      ? 'Removed players will appear here so you can restore them.'
                      : 'Search below to add players, or use easy auto fill.'
                  }}
                </span>
              </article>
            </section>

            <section class="tournament-create__add-panel">
              <header>
                <div>
                  <h5>Add player manually</h5>
                  <p>Search the member list and add players to {{ activePlayerCategory.name }}.</p>
                </div>
                <label class="tournament-create__search">
                  <span>Search members</span>
                  <input
                    :value="form.playerSearch"
                    autocomplete="off"
                    inputmode="search"
                    maxlength="40"
                    placeholder="Name, rank, gender, category"
                    type="search"
                    @input="handlePlayerSearchInput"
                  />
                </label>
              </header>

              <div v-if="availablePlayerRows.length" class="tournament-create__available-list">
                <article
                  v-for="row in availablePlayerRows"
                  :key="row.player.id"
                  class="tournament-create__member-row tournament-create__member-row--available"
                >
                  <span class="tournament-create__member-rank">#{{ row.player.rank }}</span>
                  <div class="tournament-create__member-person">
                    <img
                      v-if="row.player.imageUrl"
                      :alt="row.player.name"
                      :src="row.player.imageUrl"
                    />
                    <span v-else class="tournament-create__player-avatar">
                      {{ playerInitials(row.player.name) }}
                    </span>
                    <div>
                      <strong>{{ row.player.name }}</strong>
                      <small>{{ row.assignmentLabel }}</small>
                    </div>
                  </div>
                  <span class="tournament-create__member-note">
                    {{ row.isSelected ? 'In tournament' : 'Not selected yet' }}
                  </span>
                  <button class="tournament-create__mini-action tournament-create__mini-action--add" type="button" @click="addPlayerToActiveCategory(row.player.id)">
                    Add
                  </button>
                </article>
              </div>

              <article v-else class="tournament-create__empty-results">
                <strong>No available players found</strong>
                <span>Clear the search or pick another category.</span>
              </article>
            </section>
          </article>
        </section>
      </section>

      <section v-else class="tournament-create__panel tournament-create__panel--animated">
        <div class="t-section-header">
          <div>
            <h3 class="t-section-title">Ready to Create?</h3>
            <p class="t-muted">Pick the clearest format for one category at a time.</p>
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

        <div class="tournament-create__review-layout">
          <article
            v-if="activeReviewCategoryDraft"
            class="tournament-create__review-card tournament-create__review-card--focused"
          >
            <header>
              <div>
                <h4>{{ activeReviewCategoryDraft.name }}</h4>
                <p>{{ activeReviewCategoryDraft.description }}</p>
              </div>
              <span class="tournament-create__player-count-badge">
                <strong>{{ realPlayerCount(activeReviewCategoryDraft) }}</strong>
                <small>players</small>
              </span>
            </header>

            <div class="tournament-create__format-picker">
              <button
                v-for="format in activeReviewCategoryDraft.formatChoices"
                :key="format.id"
                class="tournament-create__format-option"
                :class="{
                  'tournament-create__format-option--active': activeReviewCategoryDraft.selectedFormat.id === format.id,
                }"
                :aria-pressed="activeReviewCategoryDraft.selectedFormat.id === format.id"
                type="button"
                @click="selectCategoryFormat(activeReviewCategoryDraft.id, format.id)"
              >
                <span class="tournament-create__format-radio" aria-hidden="true">
                  <span></span>
                </span>
                <span
                  v-if="activeReviewCategoryDraft.selectedFormat.id === format.id"
                  class="tournament-create__format-check"
                  aria-hidden="true"
                >
                  &#10003;
                </span>
                <strong>{{ format.playerTitle }}</strong>
                <span>{{ format.playerSummary }}</span>
                <div class="tournament-create__format-pills">
                  <small
                    v-for="pill in visibleFormatPills(format, activeReviewCategoryDraft.assignmentPlayers.length)"
                    :key="pill"
                    :class="formatPillClass(pill)"
                  >
                    {{ pill }}
                  </small>
                </div>
                <em v-if="format.recommended">Recommended</em>
              </button>
            </div>

            <div v-if="activeReviewCategoryDraft.groups.length" class="tournament-create__groups-preview">
              <div v-for="group in activeReviewCategoryDraft.groups" :key="group.id">
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
              v-if="categoryWarnings(activeReviewCategoryDraft).length || categoryBlockers(activeReviewCategoryDraft).length"
              class="tournament-create__review-alerts"
            >
              <span
                v-for="blocker in categoryBlockers(activeReviewCategoryDraft)"
                :key="blocker.message"
                class="tournament-create__review-alert tournament-create__review-alert--blocker"
              >
                {{ blocker.message }}
              </span>
              <span
                v-for="warning in categoryWarnings(activeReviewCategoryDraft)"
                :key="warning.message"
                class="tournament-create__review-alert"
              >
                {{ warning.message }}
              </span>
            </div>

            <article class="tournament-create__seeding-note">
              <strong>Group order</strong>
              <span>Players are seeded by ladder rank after every add or remove. Manual adds do not take the first slot.</span>
            </article>
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
        <button class="t-button t-button--secondary" type="button" @click="goBack">
          {{ form.step === 1 ? 'Cancel' : 'Previous' }}
        </button>
        <button
          v-if="form.step < steps.length"
          class="t-button t-button--primary"
          type="button"
          :disabled="
            (form.step === 1 && !isBasicsValid) ||
            (form.step === 2 && !isCategoriesStepValid) ||
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
  gap: 18px;
  width: 100%;
  max-width: none;
  margin: 0;
  border: 1px solid var(--tournament-line);
  border-radius: 14px;
  padding: 24px;
  background: #ffffff;
  box-shadow: var(--tournament-card-shadow);
}

.tournament-create--with-side-rail .tournament-create__workspace {
  width: calc(100% - 250px);
  margin-left: 250px;
}

.tournament-create__side-rail {
  position: fixed;
  top: 116px;
  bottom: 24px;
  left: 18px;
  z-index: 35;
  display: grid;
  align-content: start;
  gap: 10px;
  width: 214px;
  overflow-y: auto;
  padding-right: 2px;
}

.tournament-create__side-back {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  border: 1px solid rgba(29, 111, 181, 0.12);
  border-radius: 12px;
  padding: 10px;
  background: #e8f4ff;
  color: #123f66;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
}

.tournament-create__side-back span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #ffffff;
  color: #1d6fb5;
}

.tournament-create__side-back svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
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

.tournament-create__date-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(0, 181, 26, 0.18);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--tournament-green-soft);
}

.tournament-create__date-note strong {
  color: var(--tournament-green-dark);
  font-size: 13px;
}

.tournament-create__date-note span {
  color: var(--tournament-muted);
  font-size: 12px;
  line-height: 1.45;
}

.tournament-create__template-note {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(0, 181, 26, 0.22);
  border-radius: 14px;
  padding: 15px 18px;
  background: var(--tournament-green-soft);
}

.tournament-create__template-note p {
  margin: 2px 0 0;
  color: var(--tournament-muted);
  font-size: 12px;
}

.tournament-create__category-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 2px;
}

.tournament-create__category-stats div {
  border: 1px solid var(--tournament-line);
  border-radius: 12px;
  padding: 16px 18px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
}

.tournament-create__stat-number {
  display: block;
  color: var(--tournament-ink);
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
}

.tournament-create__stat-number--green {
  color: var(--tournament-green-dark);
}

.tournament-create__category-stats span {
  display: block;
  margin-top: 4px;
  color: var(--tournament-faint);
  font-size: 12px;
  font-weight: 700;
}

.tournament-create__section-label {
  margin-top: 4px;
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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

.tournament-create__categories {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.tournament-create__category-card {
  position: relative;
  display: grid;
  gap: 16px;
  border: 1px solid rgba(0, 181, 26, 0.24);
  border-radius: 12px;
  padding: 20px;
  background: #ffffff;
  text-align: left;
  user-select: none;
  transition:
    transform 0.16s ease,
    opacity 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.tournament-create__category-card:hover,
.tournament-create__review-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.075);
}

.tournament-create__category-card:hover {
  border-color: rgba(0, 181, 26, 0.58);
}

.tournament-create__category-card--off {
  border-color: var(--tournament-line);
  background: #fbfcfb;
  opacity: 0.76;
}

.tournament-create__category-card--off:hover {
  opacity: 1;
  border-color: rgba(123, 135, 148, 0.34);
}

.tournament-create__category-top,
.tournament-create__category-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tournament-create__category-top h4 {
  margin: 0;
  color: var(--tournament-ink);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.2;
}

.tournament-create__category-card--off h4 {
  color: var(--tournament-faint);
}

.tournament-create__toggle-control {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.tournament-create__custom-badge {
  display: inline-flex;
  width: fit-content;
  margin-top: 5px;
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
  font-size: 10px;
  font-weight: 900;
}

.tournament-create__toggle-pill {
  position: relative;
  flex-shrink: 0;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: var(--tournament-green);
  transition: background 0.18s ease;
}

.tournament-create__toggle-pill::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 21px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  transition: left 0.18s ease;
}

.tournament-create__category-card--off .tournament-create__toggle-pill {
  background: #cdd2c5;
}

.tournament-create__category-card--off .tournament-create__toggle-pill::after {
  left: 3px;
}

.tournament-create__category-card p {
  min-height: 40px;
  margin: 0;
  color: var(--tournament-muted);
  font-size: 13px;
  line-height: 1.5;
}

.tournament-create__category-card--off p {
  color: var(--tournament-faint);
}

.tournament-create__category-footer {
  align-items: center;
  border-top: 1px solid var(--tournament-line);
  padding-top: 14px;
}

.tournament-create__category-footer div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.tournament-create__category-footer strong {
  color: var(--tournament-ink);
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.tournament-create__category-card--off .tournament-create__category-footer strong {
  color: var(--tournament-faint);
}

.tournament-create__category-footer span {
  color: var(--tournament-faint);
  font-size: 11.5px;
  font-weight: 700;
}

.tournament-create__category-footer em {
  border-radius: 999px;
  padding: 5px 12px;
  background: #bbf7d0;
  color: var(--tournament-green-dark);
  font-size: 11.5px;
  font-style: normal;
  font-weight: 900;
}

.tournament-create__category-card--off .tournament-create__category-footer em {
  background: #e0e2db;
  color: #98a48c;
}

.tournament-create__category-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tournament-create__category-edit,
.tournament-create__category-remove {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.tournament-create__category-edit {
  border-color: rgba(29, 111, 181, 0.16);
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
}

.tournament-create__category-remove {
  border-color: rgba(220, 53, 69, 0.12);
  background: rgba(220, 53, 69, 0.08);
  color: #991b1b;
}

.tournament-create__custom-builder {
  display: grid;
  gap: 14px;
  border: 1.5px solid rgba(29, 111, 181, 0.34);
  border-radius: 10px;
  padding: 0;
  background: var(--tournament-blue-soft);
  box-shadow: 0 12px 26px rgba(29, 111, 181, 0.08);
}

.tournament-create__custom-builder summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 76px;
  padding: 16px 18px;
  cursor: pointer;
  list-style: none;
  transition:
    background 0.16s ease,
    border-color 0.16s ease;
}

.tournament-create__custom-builder summary:hover {
  background: rgba(255, 255, 255, 0.44);
}

.tournament-create__custom-builder summary::-webkit-details-marker {
  display: none;
}

.tournament-create__custom-builder summary > span {
  display: grid;
  gap: 4px;
}

.tournament-create__custom-builder summary > span strong {
  color: var(--tournament-blue);
  font-size: 14px;
}

.tournament-create__custom-builder summary > span small {
  color: var(--tournament-muted);
  font-size: 12px;
  line-height: 1.45;
}

.tournament-create__custom-builder-action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 10px 14px;
  background: var(--tournament-blue);
  color: #ffffff;
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
  box-shadow: 0 10px 18px rgba(29, 111, 181, 0.18);
}

.tournament-create__custom-builder-action span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  color: var(--tournament-blue);
  font-size: 15px;
  line-height: 1;
}

.tournament-create__custom-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
  padding: 0 16px 16px;
}

.tournament-create__rule-preview {
  display: grid;
  grid-column: span 2;
  gap: 4px;
  border: 1px solid rgba(29, 111, 181, 0.18);
  border-radius: 10px;
  padding: 10px 12px;
  background: #ffffff;
}

.tournament-create__rule-preview strong {
  color: var(--tournament-blue);
  font-size: 12px;
}

.tournament-create__rule-preview span {
  color: var(--tournament-muted);
  font-size: 12px;
  line-height: 1.35;
}

.tournament-create__create-category-button {
  justify-self: end;
  min-width: 156px;
}

.tournament-create__cancel-edit-button {
  justify-self: start;
}

.tournament-create__category-required {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(220, 53, 69, 0.22);
  border-radius: 10px;
  padding: 12px 14px;
  background: #fff1f2;
}

.tournament-create__category-required strong {
  flex-shrink: 0;
  color: #991b1b;
  font-size: 13px;
}

.tournament-create__category-required span {
  color: #7f1d1d;
  font-size: 12px;
  line-height: 1.4;
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

.tournament-create__assignment-studio {
  display: block;
}

.tournament-create__category-editor {
  border: 1.5px dashed rgba(0, 181, 26, 0.58);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(0, 181, 26, 0.07);
}

.tournament-create__assignment-tab {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  padding: 11px;
  background: #ffffff;
  color: var(--tournament-muted);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;
}

.tournament-create__assignment-tab:hover {
  transform: translateX(2px);
  border-color: rgba(0, 181, 26, 0.28);
}

.tournament-create__assignment-tab span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.tournament-create__assignment-tab span strong {
  overflow: hidden;
  color: var(--tournament-ink);
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-create__assignment-tab span small {
  color: var(--tournament-faint);
  font-size: 10.5px;
  font-weight: 800;
}

.tournament-create__assignment-tab em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #f1f3ef;
  color: var(--tournament-muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}

.tournament-create__assignment-tab i {
  grid-column: 1 / -1;
  width: fit-content;
  border-radius: 999px;
  padding: 3px 8px;
  background: #fffbeb;
  color: #92400e;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.tournament-create__assignment-tab--active {
  border-style: dashed;
  border-color: rgba(0, 181, 26, 0.58);
  background: var(--tournament-green-soft);
}

.tournament-create__assignment-tab--active span strong {
  color: var(--tournament-green-dark);
}

.tournament-create__category-editor {
  overflow: hidden;
}

.tournament-create__category-editor-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  border-bottom: 1px solid var(--tournament-line);
  padding: 18px;
  background: #fbfcfb;
}

.tournament-create__category-editor-head > div:first-child {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.tournament-create__category-editor-head span {
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tournament-create__category-editor-head h4,
.tournament-create__category-editor-head p,
.tournament-create__category-members h5,
.tournament-create__category-members p,
.tournament-create__add-panel h5,
.tournament-create__add-panel p {
  margin: 0;
}

.tournament-create__category-editor-head h4 {
  color: var(--tournament-ink);
  font-size: 21px;
  font-weight: 900;
}

.tournament-create__category-editor-head p,
.tournament-create__category-members p,
.tournament-create__add-panel p {
  color: var(--tournament-muted);
  font-size: 12px;
  line-height: 1.4;
}

.tournament-create__category-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.tournament-create__category-kpis span {
  display: grid;
  min-width: 68px;
  border: 1px solid rgba(0, 181, 26, 0.16);
  border-radius: 10px;
  padding: 8px 10px;
  background: #ffffff;
  color: var(--tournament-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  text-align: center;
  text-transform: none;
}

.tournament-create__category-kpis strong {
  color: var(--tournament-green-dark);
  font-size: 18px;
  line-height: 1;
}

.tournament-create__category-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--tournament-line);
  padding: 12px 18px;
  background: #ffffff;
}

.tournament-create__view-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--tournament-line);
  border-radius: 8px;
  padding: 8px 10px;
  background: #ffffff;
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.tournament-create__view-tab strong {
  min-width: 22px;
  border-radius: 999px;
  padding: 2px 6px;
  background: #f1f3ef;
  color: var(--tournament-muted);
  font-size: 10px;
  line-height: 1.3;
  text-align: center;
}

.tournament-create__view-tab--active {
  border-color: rgba(0, 181, 26, 0.42);
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__view-tab--active strong {
  background: #ffffff;
  color: var(--tournament-green-dark);
}

.tournament-create__category-members,
.tournament-create__add-panel {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.tournament-create__category-members {
  border-bottom: 1px solid var(--tournament-line);
}

.tournament-create__category-members header,
.tournament-create__add-panel header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: end;
}

.tournament-create__category-members h5,
.tournament-create__add-panel h5 {
  color: var(--tournament-ink);
  font-size: 15px;
  font-weight: 900;
}

.tournament-create__member-list,
.tournament-create__available-list {
  display: grid;
  gap: 8px;
  max-height: 340px;
  overflow: auto;
  padding-right: 4px;
}

.tournament-create__member-row {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) minmax(100px, 0.45fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}

.tournament-create__member-row:hover {
  border-color: rgba(0, 181, 26, 0.24);
  background: #fbfffc;
}

.tournament-create__member-row--available {
  background: #fcfcfb;
}

.tournament-create__member-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  border-radius: 8px;
  background: #f1f3ef;
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 900;
}

.tournament-create__member-person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.tournament-create__member-person img {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}

.tournament-create__member-person div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.tournament-create__member-person strong {
  overflow: hidden;
  color: var(--tournament-ink);
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-create__member-person small,
.tournament-create__member-note {
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 700;
}

.tournament-create__member-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.tournament-create__member-tags em,
.tournament-create__member-tags span {
  width: fit-content;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.tournament-create__member-tags em {
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
}

.tournament-create__member-tags .tournament-create__source-pill--manual {
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__member-tags .tournament-create__source-pill--removed {
  background: rgba(220, 53, 69, 0.08);
  color: #991b1b;
}

.tournament-create__member-tags span {
  background: #f1f3ef;
  color: var(--tournament-muted);
}

.tournament-create__mini-action {
  min-width: 0;
  border: 1px solid rgba(220, 53, 69, 0.2);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(220, 53, 69, 0.06);
  color: #991b1b;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.16s ease,
    transform 0.16s ease;
}

.tournament-create__mini-action:hover {
  transform: translateY(-1px);
  background: rgba(220, 53, 69, 0.1);
}

.tournament-create__mini-action--add {
  border-color: rgba(0, 181, 26, 0.22);
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__mini-action--add:hover {
  background: rgba(0, 181, 26, 0.14);
}

.tournament-create__player-board {
  overflow: hidden;
  border: 1px solid var(--tournament-line);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
}

.tournament-create__player-board-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--tournament-line);
  padding: 14px 16px;
  background: #fbfcfb;
}

.tournament-create__player-board-top div:first-child {
  display: grid;
  gap: 3px;
}

.tournament-create__player-board-top span {
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 600;
}

.tournament-create__player-board-top strong {
  color: var(--tournament-ink);
  font-size: 15px;
  font-weight: 800;
}

.tournament-create__player-controlbar {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(320px, 1.2fr);
  gap: 12px;
  align-items: end;
  border-bottom: 1px solid var(--tournament-line);
  padding: 14px 16px;
  background: #ffffff;
}

.tournament-create__search {
  min-width: 0;
}

.tournament-create__filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.tournament-create__filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--tournament-line);
  border-radius: 999px;
  padding: 7px 8px 7px 11px;
  background: #ffffff;
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
  transform 0.16s ease;
}

.tournament-create__filter-tab span {
  min-width: 0;
}

.tournament-create__filter-tab strong {
  min-width: 22px;
  border-radius: 999px;
  padding: 2px 6px;
  background: #f1f3ef;
  color: var(--tournament-muted);
  font-size: 10px;
  line-height: 1.3;
  text-align: center;
}

.tournament-create__filter-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(0, 181, 26, 0.24);
}

.tournament-create__filter-tab--active {
  border-color: rgba(0, 181, 26, 0.36);
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__filter-tab--active strong {
  background: #ffffff;
  color: var(--tournament-green-dark);
}

.tournament-create__player-table {
  max-height: 560px;
  overflow: auto;
}

.tournament-create__player-table-head,
.tournament-create__player-table-row {
  display: grid;
  grid-template-columns: 88px minmax(220px, 1.05fr) 112px minmax(170px, 0.75fr) minmax(230px, 0.95fr);
  align-items: center;
  gap: 12px;
}

.tournament-create__player-table-head {
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid var(--tournament-line);
  padding: 9px 16px;
  background: #f8faf8;
  color: var(--tournament-faint);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tournament-create__player-table-row {
  min-height: 64px;
  border-bottom: 1px solid var(--tournament-line);
  padding: 10px 16px;
  background: #ffffff;
  transition:
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.tournament-create__player-table-row:hover {
  background: #fbfffc;
}

.tournament-create__player-table-row--selected {
  background: rgba(0, 181, 26, 0.035);
}

.tournament-create__player-table-row--quiet {
  background: #fcfcfb;
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

.tournament-create__player-person {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.tournament-create__player-person img,
.tournament-create__player-avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
}

.tournament-create__player-person img {
  object-fit: cover;
}

.tournament-create__player-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
  font-size: 11px;
  font-weight: 900;
}

.tournament-create__player-person div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.tournament-create__player-person strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-create__player-person strong {
  color: var(--tournament-ink);
  font-size: 13px;
  font-weight: 800;
}

.tournament-create__player-person small {
  color: var(--tournament-muted);
  font-size: 11px;
}

.tournament-create__status-pill {
  width: fit-content;
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 10.5px;
  font-weight: 900;
}

.tournament-create__status-pill--muted {
  background: #f1f3ef;
  color: var(--tournament-muted);
}

.tournament-create__assigned {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
  color: var(--tournament-green-dark);
  font-size: 11.5px;
  font-weight: 800;
}

.tournament-create__assigned button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(0, 181, 26, 0.18);
  border-radius: 999px;
  padding: 4px 7px;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 10.5px;
  font-weight: 900;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.tournament-create__assigned button:hover {
  border-color: rgba(220, 53, 69, 0.22);
  background: rgba(220, 53, 69, 0.07);
  color: #991b1b;
}

.tournament-create__assigned button span {
  font-size: 11px;
  line-height: 1;
}

.tournament-create__assigned > span {
  color: var(--tournament-faint);
  font-size: 11.5px;
}

.tournament-create__manual-pick {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.tournament-create__manual-pick select {
  width: 100%;
  min-height: 36px;
}

.tournament-create__empty-results {
  display: grid;
  gap: 4px;
  border: 1px dashed rgba(29, 111, 181, 0.22);
  border-radius: 10px;
  padding: 18px;
  background: var(--tournament-blue-soft);
  text-align: center;
}

.tournament-create__empty-results strong {
  color: var(--tournament-blue);
  font-size: 13px;
}

.tournament-create__empty-results span {
  color: var(--tournament-muted);
  font-size: 12px;
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
  padding: 18px;
  background: #ffffff;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.tournament-create__review-card--focused {
  min-width: 0;
}

.tournament-create__review-card header {
  display: flex;
  align-items: center;
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

.tournament-create__player-count-badge {
  flex-shrink: 0;
  display: grid;
  min-width: 84px;
  border: 1px solid rgba(0, 181, 26, 0.22);
  border-radius: 10px;
  padding: 9px 12px;
  background: var(--tournament-green-soft);
  text-align: center;
}

.tournament-create__player-count-badge strong {
  color: var(--tournament-green-dark);
  font-size: 22px;
  line-height: 1;
}

.tournament-create__player-count-badge small {
  color: var(--tournament-green-dark);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.tournament-create__review-alert {
  border-radius: 999px;
  padding: 4px 8px;
  background: var(--tournament-shell);
  color: var(--tournament-muted);
  font-size: 11px;
  font-weight: 800;
}

.tournament-create__format-pills .tournament-create__pill--play {
  border: 1px solid rgba(29, 111, 181, 0.18);
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
}

.tournament-create__format-pills .tournament-create__pill--safe {
  border: 1px solid rgba(0, 181, 26, 0.2);
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__format-pills .tournament-create__pill--finish {
  border: 1px solid rgba(124, 58, 237, 0.18);
  background: #f3e8ff;
  color: #6d28d9;
}

.tournament-create__format-pills .tournament-create__pill--calm {
  border: 1px solid rgba(245, 158, 11, 0.2);
  background: #fffbeb;
  color: #92400e;
}

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

.tournament-create__review-layout {
  display: block;
}

.tournament-create__category-tabs {
  display: grid;
  gap: 8px;
}

.tournament-create__category-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  padding: 12px;
  background: #ffffff;
  color: var(--tournament-muted);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;
}

.tournament-create__category-tab:hover {
  transform: translateX(2px);
  border-color: rgba(0, 181, 26, 0.26);
}

.tournament-create__category-tab span {
  color: var(--tournament-ink);
  font-size: 13px;
  font-weight: 900;
}

.tournament-create__category-tab strong {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 8px;
  background: var(--tournament-shell);
  color: var(--tournament-muted);
  font-size: 10px;
  font-weight: 900;
}

.tournament-create__category-tab--active {
  border-style: dashed;
  border-color: rgba(0, 181, 26, 0.58);
  background: var(--tournament-green-soft);
}

.tournament-create__category-tab--active strong {
  background: #ffffff;
  color: var(--tournament-green-dark);
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
  padding: 13px 42px 13px 42px;
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
  border-color: rgba(0, 181, 26, 0.58);
  background: var(--tournament-green-soft);
  box-shadow: 0 10px 22px rgba(0, 181, 26, 0.08);
}

.tournament-create__format-option strong {
  padding-right: 100px;
  color: var(--tournament-ink);
  font-size: 13px;
}

.tournament-create__format-option > span:not(.tournament-create__format-radio):not(.tournament-create__format-check) {
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

.tournament-create__format-radio {
  position: absolute;
  top: 14px;
  left: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--tournament-line);
  border-radius: 50%;
  background: #ffffff;
}

.tournament-create__format-radio span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
}

.tournament-create__format-option--active .tournament-create__format-radio {
  border-color: var(--tournament-green);
}

.tournament-create__format-option--active .tournament-create__format-radio span {
  background: var(--tournament-green);
}

.tournament-create__format-check {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--tournament-green);
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
}

.tournament-create__format-option em {
  position: absolute;
  bottom: 12px;
  right: 12px;
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

.tournament-create__seeding-note {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(29, 111, 181, 0.16);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--tournament-blue-soft);
}

.tournament-create__seeding-note strong {
  flex-shrink: 0;
  color: var(--tournament-blue);
  font-size: 12px;
}

.tournament-create__seeding-note span {
  color: var(--tournament-muted);
  font-size: 12px;
  line-height: 1.4;
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
  .tournament-create__category-stats,
  .tournament-create__form-row,
  .tournament-create__custom-grid,
  .tournament-create__player-controlbar,
  .tournament-create__groups-preview,
  .tournament-create__rules {
    grid-template-columns: 1fr;
  }

  .tournament-create--with-side-rail .tournament-create__workspace {
    width: 100%;
    margin-left: 0;
  }

  .tournament-create__side-rail {
    position: static;
    width: 100%;
    margin-bottom: 14px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
    padding-right: 0;
  }

  .tournament-create__rule-preview {
    grid-column: auto;
  }

  .tournament-create__member-row {
    grid-template-columns: 48px minmax(0, 1fr) auto;
  }

  .tournament-create__member-tags,
  .tournament-create__member-note {
    grid-column: 2 / -1;
  }

  .tournament-create__player-table {
    overflow-x: auto;
  }

  .tournament-create__player-table-head,
  .tournament-create__player-table-row {
    min-width: 900px;
  }
}

@media (max-width: 640px) {
  .tournament-create__workspace {
    padding: 18px;
  }

  .tournament-create__side-rail {
    grid-template-columns: 1fr;
  }

  .tournament-create__category-editor-head,
  .tournament-create__category-members header,
  .tournament-create__add-panel header {
    flex-direction: column;
    align-items: stretch;
  }

  .tournament-create__category-kpis {
    justify-content: stretch;
  }

  .tournament-create__category-kpis span {
    flex: 1;
  }

  .tournament-create__footer,
  .t-section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .tournament-create__toolbar {
    width: 100%;
  }

  .tournament-create__toolbar .t-button,
  .tournament-create__filter-tab {
    flex: 1;
  }
}
</style>

