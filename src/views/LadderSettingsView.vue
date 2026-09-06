<script setup>
import {
  computed,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MatchFormatEditor from '../components/match/MatchFormatEditor.vue'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import {
  createStandardMatchRulesSnapshot,
  validateMatchRulesSnapshot,
} from '../domain/matchRules.js'
import {
  ladderMatchConfig,
  resolveLadderConfigFromSetup,
} from '../config/ladder.js'
import { ladderRulesToMatchRulesSnapshot } from '../domain/ruleAdapters/ladderMatchRules.js'
import { formatMatchRulesSummary } from '../utils/matchRulesSummary.js'
import { sanitizePlainText } from '../utils/formSafety.js'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const ready = ref(false)
const pageError = ref('')
const saving = ref(false)
const formatDialog = ref(null)
const formatDraft = ref(createStandardMatchRulesSnapshot())

const form = reactive({
  name: '',
  matchType: 'singles',
  challengeRangeUp: 3,
  allowDownwardChallenges: false,
  maxActiveChallenges: 1,
  responseHours: 48,
  completionDays: 7,
  rematchCooldownDays: 7,
  movementSystem: 'position-swap',
  matchRulesSnapshot: createStandardMatchRulesSnapshot(),
})

const activeClub = computed(() => adminStore.activeClub)
const ladderId = computed(() => String(route.params.ladderId || ''))

const ladder = computed(() =>
  activeClub.value?.setup?.ladders?.find(
    (item) =>
      item.id === ladderId.value &&
      item.enabled !== false &&
      !item.archived,
  ) || null,
)

const resolvedConfig = computed(() =>
  resolveLadderConfigFromSetup(
    activeClub.value?.setup || {},
    ladderId.value,
  ),
)

const matchSummary = computed(() =>
  formatMatchRulesSummary(form.matchRulesSnapshot),
)

const standardClubSnapshot = computed(() =>
  createStandardMatchRulesSnapshot({
    match: {
      mode: 'sets',
      setsToWin: 2,
    },
    set: {
      gamesToWin: 6,
      winBy: 2,
      tiedAtTarget: {
        mode: 'tiebreak',
        tiebreak: {
          pointsToWin: 7,
          winBy: 2,
        },
      },
    },
    game: {
      mode: 'traditional',
      deuce: 'advantage',
    },
    decidingSet: {
      mode: 'normal_set',
    },
  }),
)

const timeSmartSnapshot = computed(() =>
  createStandardMatchRulesSnapshot({
    match: {
      mode: 'sets',
      setsToWin: 2,
    },
    set: {
      gamesToWin: 6,
      winBy: 2,
      tiedAtTarget: {
        mode: 'tiebreak',
        tiebreak: {
          pointsToWin: 7,
          winBy: 2,
        },
      },
    },
    game: {
      mode: 'traditional',
      deuce: 'advantage',
    },
    decidingSet: {
      mode: 'match_tiebreak',
      pointsToWin: 10,
      winBy: 2,
    },
  }),
)

const clubDoublesSnapshot = computed(() =>
  createStandardMatchRulesSnapshot({
    match: {
      mode: 'sets',
      setsToWin: 2,
    },
    set: {
      gamesToWin: 6,
      winBy: 2,
      tiedAtTarget: {
        mode: 'tiebreak',
        tiebreak: {
          pointsToWin: 7,
          winBy: 2,
        },
      },
    },
    game: {
      mode: 'traditional',
      deuce: 'no_ad',
    },
    decidingSet: {
      mode: 'match_tiebreak',
      pointsToWin: 10,
      winBy: 2,
    },
  }),
)

const formatPresets = computed(() => {
  const presets = [
    {
      id: 'standard',
      title: 'Standard club',
      copy: 'Best of 3 tie-break sets · Advantage',
      snapshot: standardClubSnapshot.value,
    },
    {
      id: 'time-smart',
      title: 'Time-smart',
      copy: 'Two tie-break sets · 10-point decider',
      snapshot: timeSmartSnapshot.value,
    },
  ]

  if (form.matchType === 'doubles') {
    presets.unshift({
      id: 'club-doubles',
      title: 'Club doubles',
      copy: 'Two tie-break sets · 10-point decider · No-Ad',
      snapshot: clubDoublesSnapshot.value,
    })
  }

  return presets
})

const activePresetId = computed(() => {
  const current = JSON.stringify(form.matchRulesSnapshot)

  return (
    formatPresets.value.find(
      (preset) =>
        JSON.stringify(preset.snapshot) === current,
    )?.id || ''
  )
})

const movementOptions = Object.freeze([
  {
    id: 'position-swap',
    title: 'Swap places',
    copy: 'If a lower player wins, the two players swap positions.',
  },
  {
    id: 'leapfrog',
    title: 'Take their place',
    copy: 'The winner takes the challenged position. Players between them move down one.',
  },
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function initialMatchSnapshot() {
  const config = resolvedConfig.value
  const result = ladderRulesToMatchRulesSnapshot({
    rulesSnapshot:
      ladder.value?.rules?.matchRulesSnapshot,
    ladderConfigSnapshot: config,
    matchConfig: ladderMatchConfig(config),
  })

  return result.ok
    ? clone(result.snapshot)
    : createStandardMatchRulesSnapshot()
}

function hydrate() {
  if (!ladder.value) return

  const config = resolvedConfig.value

  Object.assign(form, {
    name: ladder.value.name || '',
    matchType:
      ladder.value.matchType === 'doubles'
        ? 'doubles'
        : 'singles',
    challengeRangeUp:
      Number(config.challengeRangeUp) || 3,
    allowDownwardChallenges:
      Boolean(config.allowDownwardChallenges),
    maxActiveChallenges:
      Number(config.maxActiveChallenges) || 1,
    responseHours:
      Number(config.responseHours) || 48,
    completionDays:
      Number(config.completionDays) || 7,
    rematchCooldownDays:
      Math.max(
        0,
        Number(config.rematchCooldownDays) || 0,
      ),
    movementSystem:
      ['position-swap', 'leapfrog'].includes(
        config.movementSystem,
      )
        ? config.movementSystem
        : 'position-swap',
    matchRulesSnapshot: initialMatchSnapshot(),
  })
}

function formatLegacyProjection(snapshot) {
  const decidingIsMatchTiebreak =
    snapshot?.decidingSet?.mode ===
    'match_tiebreak'

  const noAd =
    snapshot?.game?.mode === 'traditional' &&
    snapshot?.game?.deuce === 'no_ad'

  return {
    matchPreset: decidingIsMatchTiebreak
      ? 'time-smart'
      : 'standard-club',
    scoring: noAd ? 'noad' : 'ad',
  }
}

function validateForm() {
  const name = sanitizePlainText(form.name, 70)

  if (name.length < 2) {
    return 'Enter a ladder name.'
  }

  const positive = [
    form.challengeRangeUp,
    form.maxActiveChallenges,
    form.responseHours,
    form.completionDays,
  ]

  if (
    positive.some(
      (value) =>
        !Number.isFinite(Number(value)) ||
        Number(value) < 1,
    )
  ) {
    return 'Use a number above zero for each challenge rule.'
  }

  if (
    Number(form.challengeRangeUp) > 20 ||
    Number(form.maxActiveChallenges) > 5 ||
    Number(form.responseHours) > 168 ||
    Number(form.completionDays) > 30
  ) {
    return 'One of the challenge rules is outside the allowed range.'
  }

  if (
    !Number.isFinite(
      Number(form.rematchCooldownDays),
    ) ||
    Number(form.rematchCooldownDays) < 0 ||
    Number(form.rematchCooldownDays) > 90
  ) {
    return 'The rematch wait must be between 0 and 90 days.'
  }

  const validation = validateMatchRulesSnapshot(
    form.matchRulesSnapshot,
  )

  if (!validation.valid) {
    return (
      validation.errors[0]?.message ||
      'Check the match format.'
    )
  }

  return ''
}

async function save() {
  if (saving.value || !ladder.value) return

  pageError.value = validateForm()

  if (pageError.value) {
    notificationStore.addToast({
      title: 'Check ladder settings',
      message: pageError.value,
      type: 'warning',
    })
    return
  }

  saving.value = true

  try {
    const currentSetup =
      activeClub.value?.setup || {}

    const legacyProjection =
      formatLegacyProjection(
        form.matchRulesSnapshot,
      )

    const nextRules = {
      ...(ladder.value.rules || {}),
      challengeRangeUp: Number(
        form.challengeRangeUp,
      ),
      allowDownwardChallenges:
        Boolean(
          form.allowDownwardChallenges,
        ),
      maxActiveChallenges: Number(
        form.maxActiveChallenges,
      ),
      responseHours: Number(
        form.responseHours,
      ),
      completionDays: Number(
        form.completionDays,
      ),
      rematchCooldownDays: Number(
        form.rematchCooldownDays,
      ),
      movementSystem:
        form.movementSystem,
      resultConfirmation:
        ladder.value.rules
          ?.resultConfirmation ||
        currentSetup.rules
          ?.resultConfirmation ||
        'both-players',
      repeatedDeclineLimit:
        ladder.value.rules
          ?.repeatedDeclineLimit ??
        currentSetup.rules
          ?.repeatedDeclineLimit ??
        3,
      inactivityDays:
        ladder.value.rules
          ?.inactivityDays ??
        currentSetup.rules
          ?.inactivityDays ??
        30,
      noShowPolicy:
        ladder.value.rules
          ?.noShowPolicy ||
        currentSetup.rules
          ?.noShowPolicy ||
        'walkover-after-review',
      matchRulesSnapshot: clone(
        form.matchRulesSnapshot,
      ),
      ...legacyProjection,
    }

    const nextLadders =
      currentSetup.ladders.map(
        (item) =>
          item.id === ladder.value.id
            ? {
                ...item,
                name: sanitizePlainText(
                  form.name,
                  70,
                ),
                matchType:
                  form.matchType ===
                  'doubles'
                    ? 'doubles'
                    : 'singles',
                rules: nextRules,
              }
            : item,
      )

    await adminStore.updateActiveClub({
      ladders: nextLadders,
      primaryLadderId:
        currentSetup.primaryLadderId,
    })

    pageError.value = ''

    notificationStore.addToast({
      title: 'Ladder settings saved',
      message: `${sanitizePlainText(form.name, 70)} now uses these challenge and match rules.`,
      type: 'success',
    })
  } catch (error) {
    pageError.value =
      error?.message ||
      'We could not save this ladder.'

    notificationStore.addToast({
      title: 'Could not save ladder',
      message: pageError.value,
      type: 'error',
    })
  } finally {
    saving.value = false
  }
}

function applyPreset(preset) {
  form.matchRulesSnapshot = clone(
    preset.snapshot,
  )

  notificationStore.addToast({
    title: 'Match format ready',
    message: `${preset.title} selected. Save the ladder when you are done.`,
    type: 'info',
  })
}

async function openFormatEditor() {
  formatDraft.value = clone(
    form.matchRulesSnapshot,
  )
  formatDialog.value?.showModal()
  await nextTick()
}

function useCustomFormat(snapshot) {
  const validation =
    validateMatchRulesSnapshot(snapshot)

  if (!validation.valid) return

  form.matchRulesSnapshot = clone(snapshot)
  formatDialog.value?.close()

  notificationStore.addToast({
    title: 'Match format ready',
    message:
      'Your custom tennis format is ready. Save the ladder when you are done.',
    type: 'info',
  })
}

function closeFormatEditor() {
  formatDialog.value?.close()
}

useShellNestedHeader(() => ({
  label: 'Ladder settings',
  backLabel: 'Back to ladder',
  back: () =>
    router.push({ name: 'Rankings' }),
  crumbs: [
    { label: 'Ladder' },
    {
      label:
        ladder.value?.name ||
        'Current ladder',
    },
    { label: 'Settings' },
  ],
}))

watch(
  ladder,
  (value) => {
    if (!ready.value || !value) return
    hydrate()
  },
)

onMounted(async () => {
  try {
    if (!adminStore.activeClub) {
      await adminStore.loadClubs()
    }

    if (!ladder.value) {
      pageError.value =
        'This ladder could not be found.'
      return
    }

    hydrate()
  } catch (error) {
    pageError.value =
      error?.message ||
      'We could not open these ladder settings.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main class="ladder-settings">
    <section
      v-if="!ready"
      class="ladder-settings__loading"
      aria-label="Loading ladder settings"
    >
      <span></span>
      <span></span>
      <span></span>
    </section>

    <section
      v-else-if="!ladder"
      class="ladder-settings__empty"
    >
      <h1>Ladder not found</h1>
      <p>{{ pageError }}</p>
      <button
        class="ls-button ls-button--primary"
        type="button"
        @click="router.push({ name: 'Rankings' })"
      >
        Open ladder
      </button>
    </section>

    <form
      v-else
      class="ladder-settings__form"
      @submit.prevent="save"
    >
      <header class="ladder-settings__intro">
        <div>
          <p>THIS LADDER ONLY</p>
          <h1>{{ ladder.name }}</h1>
          <span>
            Changes here do not change your other ladders.
          </span>
        </div>
      </header>

      <p
        v-if="pageError"
        class="ladder-settings__alert"
        role="alert"
      >
        {{ pageError }}
      </p>

      <section
        class="ls-section"
        aria-labelledby="ladder-basics-title"
      >
        <header>
          <span class="ls-section__number">1</span>
          <div>
            <h2 id="ladder-basics-title">
              Ladder basics
            </h2>
            <p>
              The name and type members see.
            </p>
          </div>
        </header>

        <div class="ls-card ls-grid ls-grid--two">
          <label class="ls-field">
            <span>Ladder name</span>
            <input
              v-model="form.name"
              type="text"
              maxlength="70"
              autocomplete="off"
            />
          </label>

          <label class="ls-field">
            <span>Match type</span>
            <select v-model="form.matchType">
              <option value="singles">
                Singles
              </option>
              <option value="doubles">
                Doubles
              </option>
            </select>
          </label>
        </div>
      </section>

      <section
        class="ls-section"
        aria-labelledby="challenge-rules-title"
      >
        <header>
          <span class="ls-section__number">2</span>
          <div>
            <h2 id="challenge-rules-title">
              Who can challenge whom
            </h2>
            <p>
              Keep the challenge window easy to understand.
            </p>
          </div>
        </header>

        <div class="ls-card ls-grid ls-grid--two">
          <label class="ls-field">
            <span>Positions above</span>
            <span class="ls-number-field">
              <input
                v-model.number="
                  form.challengeRangeUp
                "
                type="number"
                min="1"
                max="20"
                inputmode="numeric"
              />
              <small>places</small>
            </span>
            <small>
              Example: 2 means #6 can challenge #5 and #4.
            </small>
          </label>

          <label class="ls-field">
            <span>Active challenges</span>
            <span class="ls-number-field">
              <input
                v-model.number="
                  form.maxActiveChallenges
                "
                type="number"
                min="1"
                max="5"
                inputmode="numeric"
              />
              <small>per player</small>
            </span>
          </label>

          <label class="ls-field">
            <span>Time to answer</span>
            <span class="ls-number-field">
              <input
                v-model.number="
                  form.responseHours
                "
                type="number"
                min="1"
                max="168"
                inputmode="numeric"
              />
              <small>hours</small>
            </span>
          </label>

          <label class="ls-field">
            <span>Time to play</span>
            <span class="ls-number-field">
              <input
                v-model.number="
                  form.completionDays
                "
                type="number"
                min="1"
                max="30"
                inputmode="numeric"
              />
              <small>days</small>
            </span>
          </label>

          <label
            class="ls-toggle ls-field--wide"
          >
            <input
              v-model="
                form.allowDownwardChallenges
              "
              type="checkbox"
            />
            <span>
              <strong>
                Allow challenges below
              </strong>
              <small>
                Leave this off for a traditional upward challenge ladder.
              </small>
            </span>
          </label>

          <label
            class="ls-field ls-field--wide"
          >
            <span>Wait before a rematch</span>
            <span class="ls-number-field">
              <input
                v-model.number="
                  form.rematchCooldownDays
                "
                type="number"
                min="0"
                max="90"
                inputmode="numeric"
              />
              <small>days</small>
            </span>
          </label>
        </div>
      </section>

      <section
        class="ls-section"
        aria-labelledby="movement-title"
      >
        <header>
          <span class="ls-section__number">3</span>
          <div>
            <h2 id="movement-title">
              How the ladder moves
            </h2>
            <p>
              What a successful challenge does to the standings.
            </p>
          </div>
        </header>

        <div
          class="ls-choice-grid"
          role="radiogroup"
          aria-label="Ranking movement"
        >
          <label
            v-for="option in movementOptions"
            :key="option.id"
            class="ls-choice"
            :class="{
              'ls-choice--active':
                form.movementSystem ===
                option.id,
            }"
          >
            <input
              v-model="form.movementSystem"
              type="radio"
              name="movement-system"
              :value="option.id"
            />

            <span>
              <strong>{{ option.title }}</strong>
              <small>{{ option.copy }}</small>
            </span>
          </label>
        </div>

        <p class="ls-quiet-note">
          Points ranking is not offered until Gorra has a real points formula. We do not guess.
        </p>
      </section>

      <section
        class="ls-section"
        aria-labelledby="scoring-title"
      >
        <header>
          <span class="ls-section__number">4</span>
          <div>
            <h2 id="scoring-title">
              How matches are scored
            </h2>
            <p>
              This becomes the default for challenges on this ladder.
            </p>
          </div>
        </header>

        <div class="ls-format-presets">
          <button
            v-for="preset in formatPresets"
            :key="preset.id"
            type="button"
            class="ls-format-preset"
            :class="{
              'ls-format-preset--active':
                activePresetId === preset.id,
            }"
            @click="applyPreset(preset)"
          >
            <span
              class="ls-format-preset__check"
              aria-hidden="true"
            >
              {{
                activePresetId ===
                preset.id
                  ? '✓'
                  : ''
              }}
            </span>
            <strong>{{ preset.title }}</strong>
            <small>{{ preset.copy }}</small>
          </button>
        </div>

        <div class="ls-card ls-format-summary">
          <div class="ls-format-summary__head">
            <div>
              <span>Current format</span>
              <strong>
                {{ matchSummary.match }}
              </strong>
            </div>

            <button
              class="ls-button"
              type="button"
              @click="openFormatEditor"
            >
              Customize
            </button>
          </div>

          <dl>
            <div
              v-for="row in matchSummary.rows"
              :key="row.key"
            >
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>

          <p>
            A match can still use a one-time admin override. That changes only that match, not this ladder.
          </p>
        </div>
      </section>

      <footer class="ladder-settings__actions">
        <button
          class="ls-button"
          type="button"
          :disabled="saving"
          @click="
            router.push({ name: 'Rankings' })
          "
        >
          Cancel
        </button>

        <button
          class="ls-button ls-button--primary"
          type="submit"
          :disabled="saving"
        >
          {{
            saving
              ? 'Saving…'
              : 'Save ladder settings'
          }}
        </button>
      </footer>
    </form>

    <dialog
      ref="formatDialog"
      class="ls-format-dialog"
      @cancel.prevent="closeFormatEditor"
    >
      <div class="ls-format-dialog__shell">
        <button
          class="ls-format-dialog__close"
          type="button"
          aria-label="Close match format"
          @click="closeFormatEditor"
        >
          ×
        </button>

        <MatchFormatEditor
          :model-value="formatDraft"
          :editable="true"
          :show-save="true"
          :allow-standalone-tiebreak="false"
          save-label="Use this format"
          @update:model-value="
            formatDraft = $event
          "
          @save="useCustomFormat"
        />
      </div>
    </dialog>
  </main>
</template>

<style scoped>
.ladder-settings {
  width: 100%;
  padding: 2px 0 44px;
  color: var(--color-text);
}

.ladder-settings__form {
  display: grid;
  gap: 34px;
}

.ladder-settings__intro {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
}

.ladder-settings__intro p,
.ladder-settings__intro h1,
.ladder-settings__intro span {
  margin: 0;
}

.ladder-settings__intro p {
  margin-bottom: 5px;
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.ladder-settings__intro h1 {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.025em;
}

.ladder-settings__intro span {
  display: block;
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 11px;
}

.ladder-settings__alert {
  margin: -16px 0 0;
  padding: 10px 12px;
  border: 1px solid rgba(164, 71, 64, 0.14);
  border-radius: 9px;
  background: rgba(164, 71, 64, 0.045);
  color: #92504b;
  font-size: 10.5px;
}

.ls-section {
  display: grid;
  gap: 13px;
}

.ls-section > header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
}

.ls-section__number {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: 700;
}

.ls-section h2,
.ls-section p {
  margin: 0;
}

.ls-section h2 {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.ls-section > header p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 10.5px;
  line-height: 1.45;
}

.ls-card {
  padding: 17px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.ls-grid {
  display: grid;
  gap: 14px;
}

.ls-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ls-field {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.ls-field--wide {
  grid-column: 1 / -1;
}

.ls-field > span:first-child {
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: 600;
}

.ls-field > small,
.ls-toggle small {
  color: var(--color-muted);
  font-size: 9.5px;
  line-height: 1.45;
}

.ls-field input,
.ls-field select {
  width: 100%;
  min-height: 44px;
  padding: 0 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 12px;
}

.ls-field input:focus,
.ls-field select:focus {
  border-color: rgba(8, 173, 43, 0.4);
  outline: 0;
  box-shadow: 0 0 0 2px rgba(8, 173, 43, 0.07);
}

.ls-number-field {
  position: relative;
  display: block;
}

.ls-number-field input {
  padding-right: 76px;
  font-size: 16px;
}

.ls-number-field > small {
  position: absolute;
  top: 50%;
  right: 11px;
  color: var(--color-muted);
  font-size: 9px;
  transform: translateY(-50%);
  pointer-events: none;
}

.ls-toggle {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: #fbfcfb;
}

.ls-toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.ls-toggle > span {
  display: grid;
  gap: 2px;
}

.ls-toggle strong {
  font-size: 10.8px;
  font-weight: 600;
}

.ls-choice-grid,
.ls-format-presets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.ls-choice {
  position: relative;
  display: flex;
  min-height: 84px;
  align-items: flex-start;
  gap: 9px;
  padding: 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  cursor: pointer;
}

.ls-choice--active {
  border-color: rgba(8, 173, 43, 0.4);
  background: rgba(8, 173, 43, 0.045);
}

.ls-choice input {
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  accent-color: var(--color-primary);
}

.ls-choice > span {
  display: grid;
  gap: 4px;
}

.ls-choice strong,
.ls-format-preset strong {
  font-size: 11px;
  font-weight: 650;
}

.ls-choice small,
.ls-format-preset small {
  color: var(--color-muted);
  font-size: 9.5px;
  line-height: 1.45;
}

.ls-quiet-note {
  color: var(--color-muted);
  font-size: 9.5px;
  line-height: 1.45;
}

.ls-format-presets {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ls-format-preset {
  position: relative;
  display: grid;
  min-height: 94px;
  align-content: center;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
}

.ls-format-preset--active {
  border-color: rgba(8, 173, 43, 0.42);
  background: rgba(8, 173, 43, 0.045);
}

.ls-format-preset__check {
  position: absolute;
  top: 9px;
  right: 9px;
  display: grid;
  width: 19px;
  height: 19px;
  place-items: center;
  border-radius: 50%;
  background: rgba(8, 173, 43, 0.1);
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: 700;
}

.ls-format-summary {
  display: grid;
  gap: 13px;
}

.ls-format-summary__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.ls-format-summary__head > div {
  display: grid;
  gap: 3px;
}

.ls-format-summary__head span {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: 600;
}

.ls-format-summary__head strong {
  font-size: 12px;
  font-weight: 650;
}

.ls-format-summary dl {
  display: grid;
  margin: 0;
  border-top: 1px solid var(--color-border);
}

.ls-format-summary dl > div {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--color-border);
}

.ls-format-summary dt {
  color: var(--color-muted);
  font-size: 9.5px;
}

.ls-format-summary dd {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: 600;
}

.ls-format-summary > p {
  color: var(--color-muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.ls-button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 10.5px;
  font-weight: 650;
}

.ls-button--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.ls-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ladder-settings__actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.ls-format-dialog {
  width: min(790px, 90vw);
  max-height: 90vh;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg);
  box-shadow: 0 28px 80px rgba(17, 35, 23, 0.2);
}

.ls-format-dialog::backdrop {
  background: rgba(15, 34, 24, 0.32);
}

.ls-format-dialog__shell {
  position: relative;
  max-height: 90vh;
  overflow-y: auto;
  padding: 22px;
}

.ls-format-dialog__close {
  position: sticky;
  z-index: 4;
  top: 0;
  float: right;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: #fff;
  color: var(--color-text-soft);
  font-size: 18px;
}

.ladder-settings__loading {
  display: grid;
  gap: 12px;
}

.ladder-settings__loading span {
  min-height: 70px;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
}

.ladder-settings__empty {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
}

.ladder-settings__empty h1,
.ladder-settings__empty p {
  margin: 0;
}

.ladder-settings__empty h1 {
  font-size: 17px;
}

.ladder-settings__empty p {
  color: var(--color-muted);
  font-size: 11px;
}

@media (max-width: 767px) {
  .ladder-settings {
    width: 100%;
    padding-bottom: 32px;
  }

  .ladder-settings__form {
    gap: 30px;
  }

  .ladder-settings__intro h1 {
    font-size: 19px;
  }

  .ls-grid--two,
  .ls-choice-grid,
  .ls-format-presets {
    grid-template-columns: 1fr;
  }

  .ls-card {
    padding: 14px;
  }

  .ls-field input,
  .ls-field select {
    font-size: 16px;
  }

  .ls-format-summary dl > div {
    grid-template-columns: 82px minmax(0, 1fr);
  }

  .ladder-settings__actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .ladder-settings__actions .ls-button {
    width: 100%;
  }

  .ladder-settings__actions .ls-button--primary {
    grid-row: 1;
  }

  .ls-format-dialog {
    width: 85vw;
  }

  .ls-format-dialog__shell {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ls-choice,
  .ls-format-preset,
  .ls-button {
    transition: none;
  }
}
</style>

