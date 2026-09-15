<script setup>
import {
  computed,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
import {
  PLAYER_RATING_SYSTEMS,
  normalizePlayerRatingValue,
  playerRatingOptions,
  playerRatingSystem,
  playerRatingValueLabel,
} from '../domain/playerRatings.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { sanitizePlainText } from '../utils/formSafety.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import '../assets/ladder-workspace.css'

const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const ready = ref(false)
const error = ref('')
const saving = ref(false)

const form = reactive({
  name: '',
  matchType: 'singles',
  gender: 'any',

  ageMode: 'any',
  minimumAge: 18,
  maximumAge: 100,

  skillGate: 'any',
  levelSystem: '',
  skillLevelIds: [],

  ratingMinimum: 3,
  ratingMaximum: 4,
})

const activeClub = computed(
  () => adminStore.activeClub,
)

const clubName = computed(
  () =>
    activeClub.value?.name ||
    'Your club',
)

const clubLogo = computed(
  () =>
    activeClub.value?.setup
      ?.workspace?.logoUrl ||
    '',
)

const clubInitials = computed(() =>
  clubName.value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase(),
)

const clubLevels = computed(() =>
  (
    Array.isArray(
      activeClub.value?.setup
        ?.playerLevels?.levels,
    )
      ? activeClub.value.setup
          .playerLevels.levels
      : []
  ).filter(
    (level) =>
      level?.active !== false,
  ),
)

const ratingSystems = Object.values(
  PLAYER_RATING_SYSTEMS,
)

const ntrpOptions =
  playerRatingOptions('ntrp')

const selectedRatingSystem = computed(
  () =>
    playerRatingSystem(
      form.levelSystem,
    ),
)

const hasClubRules = computed(() =>
  Boolean(
    activeClub.value?.setup?.rules &&
      Object.keys(
        activeClub.value.setup.rules,
      ).length,
  ),
)

const ruleSourceLabel = computed(
  () =>
    hasClubRules.value
      ? `Uses ${clubName.value} defaults`
      : 'Uses GORRA defaults',
)

function cancel() {
  router.push({
    name: 'Rankings',
  })
}

function viewRules() {
  notificationStore.addToast({
    title: hasClubRules.value
      ? `${clubName.value} rules`
      : 'GORRA defaults',
    message:
      'Challenge and match rules can be reviewed or customized after the Ladder is created.',
    type: 'info',
  })
}

function setRatingDefaults(systemId) {
  const system = playerRatingSystem(
    systemId,
  )

  if (!system) return

  if (system.id === 'ntrp') {
    form.ratingMinimum = 3
    form.ratingMaximum = 4
    return
  }

  if (system.id === 'utr') {
    form.ratingMinimum = 4
    form.ratingMaximum = 8
    return
  }

  form.ratingMinimum = 10
  form.ratingMaximum = 25
}

watch(
  () => form.levelSystem,
  (systemId, previous) => {
    if (
      systemId === previous ||
      systemId === 'club_level'
    ) {
      return
    }

    setRatingDefaults(systemId)
  },
)

function normalizedSkill() {
  if (form.skillGate === 'any') {
    return {
      mode: 'any',
    }
  }

  if (
    form.levelSystem ===
    'club_level'
  ) {
    const availableLevelIds =
      new Set(
        clubLevels.value
          .map(
            (level) =>
              sanitizeDirectoryId(
                level.id,
              ),
          )
          .filter(Boolean),
      )

    const selected = [
      ...new Set(
        form.skillLevelIds
          .map(
            (levelId) =>
              sanitizeDirectoryId(
                levelId,
              ),
          )
          .filter(
            (levelId) =>
              availableLevelIds.has(
                levelId,
              ),
          ),
      ),
    ]

    if (!selected.length) {
      throw new Error(
        'Choose at least one club level.',
      )
    }

    return {
      mode: 'club_level',
      levelIds: selected,
    }
  }

  const system = playerRatingSystem(
    form.levelSystem,
  )

  if (!system) {
    throw new Error(
      'Choose how this Ladder measures player level.',
    )
  }

  const minimum =
    normalizePlayerRatingValue(
      system.id,
      form.ratingMinimum,
    )

  const maximum =
    normalizePlayerRatingValue(
      system.id,
      form.ratingMaximum,
    )

  if (
    minimum === null ||
    maximum === null
  ) {
    throw new Error(
      `Check the ${system.acronym} range.`,
    )
  }

  return {
    mode: 'rating',
    ratingSystem: system.id,
    minimum: Math.min(
      minimum,
      maximum,
    ),
    maximum: Math.max(
      minimum,
      maximum,
    ),
  }
}

async function create() {
  if (saving.value) return

  error.value = ''

  const name = sanitizePlainText(
    form.name,
    70,
  )

  if (name.length < 2) {
    error.value =
      'Enter a Ladder name.'

    return
  }

  if (
    form.ageMode === 'range'
  ) {
    const minimum = Number(
      form.minimumAge,
    )

    const maximum = Number(
      form.maximumAge,
    )

    if (
      !Number.isInteger(minimum) ||
      !Number.isInteger(maximum) ||
      minimum < 5 ||
      maximum > 100 ||
      maximum < minimum
    ) {
      error.value =
        'Check the age range.'

      return
    }
  }

  let skill

  try {
    skill = normalizedSkill()
  } catch (skillError) {
    error.value =
      skillError.message

    return
  }

  saving.value = true

  try {
    const result =
      await adminStore.createLadder({
        name,
        matchType:
          form.matchType,
        eligibility: {
          gender:
            form.gender,
          age: {
            mode:
              form.ageMode,
            minimum:
              form.minimumAge,
            maximum:
              form.maximumAge,
          },
          skill,
        },
      })

    notificationStore.addToast({
      title:
        'Ladder created',
      message:
        `${result.ladder.name} is ready for players.`,
      type: 'success',
    })

    await router.push({
      name: 'LadderSetup',
      params: {
        ladderId:
          result.ladder.id,
        step: 'members',
      },
    })
  } catch (createError) {
    error.value =
      createError?.message ||
      'Unable to create this Ladder.'
  } finally {
    saving.value = false
  }
}

useShellNestedHeader(() => ({
  label: 'Create ladder',
  backLabel:
    'Back to ladder',
  back: cancel,
  crumbs: [
    { label: 'Ladder' },
    { label: 'Create' },
  ],
}))

onMounted(async () => {
  try {
    if (!adminStore.activeClub) {
      await adminStore.loadClubs()
    }

    if (
      !adminStore.hasActiveClubPermission(
        'club.manage',
      )
    ) {
      await router.replace({
        name: 'Rankings',
      })

      return
    }
  } catch (loadError) {
    error.value =
      loadError?.message ||
      'Unable to open Ladder creation.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main
    v-if="ready"
    class="ladder-workspace-page"
  >
    <header
      class="lw-club-context"
    >
      <div
        class="lw-club-context__mark"
        aria-hidden="true"
      >
        <img
          v-if="clubLogo"
          :src="clubLogo"
          alt=""
        />

        <span v-else>
          {{ clubInitials }}
        </span>
      </div>

      <div
        class="lw-club-context__copy"
      >
        <strong>
          {{ clubName }}
        </strong>

        <p>
          Choose who can play. Members and starting positions come next.
        </p>
      </div>
    </header>

    <form
      class="lw-form"
      @submit.prevent="create"
    >
      <p
        v-if="error"
        class="lw-alert"
        role="alert"
      >
        {{ error }}
      </p>

      <section class="lw-section">
        <div
          class="lw-grid lw-grid--single"
        >
          <label class="lw-field">
            <span>
              Ladder name
            </span>

            <input
              v-model="form.name"
              maxlength="70"
              autocomplete="off"
              placeholder="MenÃ¢â‚¬â„¢s Singles"
              required
            />
          </label>

          <div class="lw-field">
            <span>Format</span>

            <div
              class="lw-choice-row"
            >
              <label
                class="lw-choice"
              >
                <input
                  v-model="form.matchType"
                  type="radio"
                  value="singles"
                />

                Singles
              </label>

              <label
                class="lw-choice"
              >
                <input
                  v-model="form.matchType"
                  type="radio"
                  value="doubles"
                />

                Doubles
              </label>
            </div>
          </div>
        </div>
      </section>

      <section class="lw-section">
        <div
          class="lw-section__heading"
        >
          <h2>
            Who can participate?
          </h2>

          <p>
            These requirements are also used when GORRA checks invites and imports.
          </p>
        </div>

        <div
          class="lw-grid lw-grid--single"
        >
          <label class="lw-field">
            <span>Gender</span>

            <select
              v-model="form.gender"
            >
              <option value="any">
                Any gender
              </option>

              <option value="men">
                Men
              </option>

              <option value="women">
                Women
              </option>
            </select>
          </label>

          <div class="lw-field">
            <span>Age</span>

            <div
              class="lw-choice-row"
            >
              <label
                class="lw-choice"
              >
                <input
                  v-model="form.ageMode"
                  type="radio"
                  value="any"
                />

                Any age
              </label>

              <label
                class="lw-choice"
              >
                <input
                  v-model="form.ageMode"
                  type="radio"
                  value="range"
                />

                Set age range
              </label>
            </div>

            <div
              v-if="
                form.ageMode ===
                'range'
              "
              class="lw-range-grid"
            >
              <label
                class="lw-field"
              >
                <span>
                  Minimum age
                </span>

                <input
                  v-model.number="
                    form.minimumAge
                  "
                  type="number"
                  min="5"
                  max="100"
                  inputmode="numeric"
                />
              </label>

              <label
                class="lw-field"
              >
                <span>
                  Maximum age
                </span>

                <input
                  v-model.number="
                    form.maximumAge
                  "
                  type="number"
                  min="5"
                  max="100"
                  inputmode="numeric"
                />
              </label>
            </div>
          </div>

          <div class="lw-field">
            <span>
              Competition level
            </span>

            <div
              class="lw-choice-row"
            >
              <label
                class="lw-choice"
              >
                <input
                  v-model="
                    form.skillGate
                  "
                  type="radio"
                  value="any"
                />

                Any level
              </label>

              <label
                class="lw-choice"
              >
                <input
                  v-model="
                    form.skillGate
                  "
                  type="radio"
                  value="limited"
                />

                Set level
              </label>
            </div>

<div
  v-if="
    form.skillGate ===
    'limited'
  "
  class="lw-rating-system-block"
>
  <span class="lw-label">
    How does this Ladder measure player level?
  </span>

  <div class="lw-rating-system-list">
    <div
      class="lw-rating-system-item"
      :class="{
        'is-selected':
          form.levelSystem ===
          'club_level',
        'is-dimmed':
          form.levelSystem &&
          form.levelSystem !==
            'club_level',
      }"
    >
      <label class="lw-rating-system-option">
        <input
          v-model="form.levelSystem"
          type="radio"
          value="club_level"
        />

        <span class="lw-rating-system-copy">
          <strong>
            Club levels
          </strong>

          <small>
            {{ clubName }}'s own levels, such as Beginner, Intermediate and Advanced.
          </small>
        </span>
      </label>

      <div
        v-if="
          form.levelSystem ===
          'club_level'
        "
        class="lw-rating-inline-config"
      >
        <div class="lw-rating-inline-config__heading">
          <strong>
            Allowed club levels
          </strong>

          <small>
            Choose one or more levels for this Ladder.
          </small>
        </div>

        <div class="lw-level-options">
          <label
            v-for="
              level in
              clubLevels
            "
            :key="level.id"
            class="lw-level-chip"
          >
            <input
              v-model="form.skillLevelIds"
              type="checkbox"
              :value="level.id"
            />

            <span>
              {{ level.label }}
            </span>
          </label>
        </div>

        <small class="lw-rating-inline-config__note">
          Players cannot change their club level from a Ladder invite.
        </small>
      </div>
    </div>

    <div
      v-for="
        system in
        ratingSystems
      "
      :key="system.id"
      class="lw-rating-system-item"
      :class="{
        'is-selected':
          form.levelSystem ===
          system.id,
        'is-dimmed':
          form.levelSystem &&
          form.levelSystem !==
            system.id,
      }"
    >
      <label class="lw-rating-system-option">
        <input
          v-model="form.levelSystem"
          type="radio"
          :value="system.id"
        />

        <span class="lw-rating-system-copy">
          <strong>
            {{ system.acronym }}

            <span class="lw-rating-system-name">
              ({{ system.name }})
            </span>
          </strong>

          <small>
            {{ system.description }}
          </small>
        </span>
      </label>

      <div
        v-if="
          form.levelSystem ===
          system.id
        "
        class="lw-rating-inline-config"
      >
        <div class="lw-rating-inline-config__heading">
          <strong>
            Accepted range
          </strong>

          <small>
            Choose the {{ system.acronym }} range allowed on this Ladder.
          </small>
        </div>

        <div
          v-if="
            system.id ===
            'ntrp'
          "
          class="lw-range-grid"
        >
          <label class="lw-field">
            <span>From</span>

            <select
              v-model.number="
                form.ratingMinimum
              "
            >
              <option
                v-for="
                  value in
                  ntrpOptions
                "
                :key="
                  `ntrp-min-${value}`
                "
                :value="value"
              >
                {{
                  playerRatingValueLabel(
                    'ntrp',
                    value,
                  )
                }}
              </option>
            </select>
          </label>

          <label class="lw-field">
            <span>To</span>

            <select
              v-model.number="
                form.ratingMaximum
              "
            >
              <option
                v-for="
                  value in
                  ntrpOptions
                "
                :key="
                  `ntrp-max-${value}`
                "
                :value="value"
              >
                {{
                  playerRatingValueLabel(
                    'ntrp',
                    value,
                  )
                }}
              </option>
            </select>
          </label>
        </div>

        <div
          v-else
          class="lw-range-grid"
        >
          <label class="lw-field">
            <span>
              {{
                system.id ===
                'wtn'
                  ? 'Lowest number'
                  : 'From'
              }}
            </span>

            <input
              v-model.number="
                form.ratingMinimum
              "
              type="number"
              :min="system.minimum"
              :max="system.maximum"
              :step="system.step"
            />
          </label>

          <label class="lw-field">
            <span>
              {{
                system.id ===
                'wtn'
                  ? 'Highest number'
                  : 'To'
              }}
            </span>

            <input
              v-model.number="
                form.ratingMaximum
              "
              type="number"
              :min="system.minimum"
              :max="system.maximum"
              :step="system.step"
            />
          </label>
        </div>

        <small
          v-if="
            system.id ===
            'wtn'
          "
          class="lw-rating-inline-config__note"
        >
          Lower WTN numbers represent stronger players.
        </small>
      </div>
    </div>
  </div>
</div>
          </div>
        </div>
      </section>

      <section class="lw-section">
        <div
          class="lw-rule-row"
        >
          <div>
            <strong>
              Competition rules
            </strong>

            <small>
              {{ ruleSourceLabel }}
            </small>
          </div>

          <div
            class="lw-inline-actions"
          >
            <button
              class="lw-text-button"
              type="button"
              @click="viewRules"
            >
              View
            </button>
          </div>
        </div>
      </section>

      <footer class="lw-footer">
        <BaseButton
          variant="secondary"
          type="button"
          :disabled="saving"
          @click="cancel"
        >
          Cancel
        </BaseButton>

        <BaseButton
          type="submit"
          :disabled="saving"
        >
          {{
            saving
              ? 'CreatingÃ¢â‚¬Â¦'
              : 'Create ladder'
          }}
        </BaseButton>
      </footer>
    </form>
  </main>
</template>
