<script setup>
import {
  computed,
  reactive,
  ref,
  watch,
} from 'vue'
import FlowIcon from '../friendly/FlowIcon.vue'
import MemberListArt from './MemberListArt.vue'
import { useAdminStore } from '../../stores/admin.js'
import {
  PLAYER_RATING_SYSTEMS,
  normalizePlayerRatingValue,
  playerRatingOptions,
  playerRatingSystem,
  playerRatingValueLabel,
} from '../../domain/playerRatings.js'
import {
  ladderRequirementsLabel,
} from '../../domain/ladderWorkspace.js'
import {
  sanitizeDirectoryId,
} from '../../utils/admin/clubSetup.js'
import {
  sanitizePlainText,
} from '../../utils/formSafety.js'

const props = defineProps({
  scenario: {
    type: String,
    required: true,
  },
  club: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'complete',
  'screen-change',
])

const adminStore = useAdminStore()

const screen = ref('start')
const selectedIds = ref(new Set())
const drafts = ref([])
const openDraftId = ref('')
const error = ref('')
const busy = ref(false)

const ratingSystems = Object.values(
  PLAYER_RATING_SYSTEMS,
)

const ntrpOptions =
  playerRatingOptions('ntrp')

const multiple = computed(
  () =>
    props.scenario ===
    'multiple-ladders',
)

const minimumSelection = computed(
  () => (multiple.value ? 2 : 1),
)

const clubName = computed(
  () => props.club?.name || 'this club',
)

const clubLevels = computed(() =>
  (
    Array.isArray(
      props.club?.setup
        ?.playerLevels?.levels,
    )
      ? props.club.setup
          .playerLevels.levels
      : []
  ).filter(
    (level) =>
      level?.active !== false,
  ),
)

const existingLadders = computed(() =>
  (
    Array.isArray(
      props.club?.setup?.ladders,
    )
      ? props.club.setup.ladders
      : []
  ).filter(
    (ladder) =>
      ladder?.enabled !== false &&
      !ladder?.archived,
  ),
)

const selectedExisting = computed(() =>
  existingLadders.value.filter(
    (ladder) =>
      selectedIds.value.has(
        ladder.id,
      ),
  ),
)

const enoughExisting = computed(
  () =>
    selectedExisting.value.length >=
    minimumSelection.value,
)

const enoughDrafts = computed(
  () =>
    drafts.value.length >=
    minimumSelection.value,
)

const editor = reactive({
  id: '',
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

function blankEditor() {
  return {
    id: '',
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
  }
}

function setScreen(value) {
  screen.value = value
  error.value = ''
  emit('screen-change', value)
}

function resetEditor(input = null) {
  const source =
    input || blankEditor()

  Object.assign(
    editor,
    blankEditor(),
    JSON.parse(
      JSON.stringify(source),
    ),
  )
}

function openExisting() {
  selectedIds.value = new Set()
  setScreen('existing')
}

function openCreate() {
  setScreen('create')

  if (!drafts.value.length) {
    addDraft()
  }
}

function addDraft() {
  if (
    !multiple.value &&
    drafts.value.length
  ) {
    openDraft(
      drafts.value[0].id,
    )

    return
  }

  resetEditor()

  editor.id =
    `draft-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`

  openDraftId.value = editor.id
}

function openDraft(id) {
  const draft =
    drafts.value.find(
      (item) => item.id === id,
    )

  if (!draft) return

  resetEditor(draft)
  openDraftId.value = id
}

function closeDraft() {
  openDraftId.value = ''
  resetEditor()
}

function removeDraft(id) {
  drafts.value =
    drafts.value.filter(
      (item) => item.id !== id,
    )

  if (openDraftId.value === id) {
    closeDraft()
  }

  if (!drafts.value.length) {
    addDraft()
  }
}

function setRatingDefaults(systemId) {
  const system =
    playerRatingSystem(systemId)

  if (!system) return

  if (system.id === 'ntrp') {
    editor.ratingMinimum = 3
    editor.ratingMaximum = 4
    return
  }

  if (system.id === 'utr') {
    editor.ratingMinimum = 4
    editor.ratingMaximum = 8
    return
  }

  editor.ratingMinimum = 10
  editor.ratingMaximum = 25
}

watch(
  () => editor.levelSystem,
  (value, previous) => {
    if (
      !value ||
      value === previous ||
      value === 'club_level'
    ) {
      return
    }

    setRatingDefaults(value)
  },
)

function toggleExisting(ladder) {
  const next =
    new Set(selectedIds.value)

  if (!multiple.value) {
    next.clear()
    next.add(ladder.id)
  } else if (next.has(ladder.id)) {
    next.delete(ladder.id)
  } else {
    next.add(ladder.id)
  }

  selectedIds.value = next
}

function normalizedSkill() {
  if (editor.skillGate === 'any') {
    return {
      mode: 'any',
    }
  }

  if (
    editor.levelSystem ===
    'club_level'
  ) {
    const allowed =
      new Set(
        clubLevels.value
          .map((level) =>
            sanitizeDirectoryId(
              level.id,
            ),
          )
          .filter(Boolean),
      )

    const levelIds = [
      ...new Set(
        editor.skillLevelIds
          .map((levelId) =>
            sanitizeDirectoryId(
              levelId,
            ),
          )
          .filter((levelId) =>
            allowed.has(levelId),
          ),
      ),
    ]

    if (!levelIds.length) {
      throw new Error(
        'Choose at least one club level.',
      )
    }

    return {
      mode: 'club_level',
      levelIds,
    }
  }

  const system =
    playerRatingSystem(
      editor.levelSystem,
    )

  if (!system) {
    throw new Error(
      'Choose how this Ladder measures player level.',
    )
  }

  const minimum =
    normalizePlayerRatingValue(
      system.id,
      editor.ratingMinimum,
    )

  const maximum =
    normalizePlayerRatingValue(
      system.id,
      editor.ratingMaximum,
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

function draftPayload() {
  const name =
    sanitizePlainText(
      editor.name,
      70,
    )

  if (name.length < 2) {
    throw new Error(
      'Enter a Ladder name.',
    )
  }

  if (
    editor.ageMode === 'range'
  ) {
    const minimum =
      Number(editor.minimumAge)

    const maximum =
      Number(editor.maximumAge)

    if (
      !Number.isInteger(minimum) ||
      !Number.isInteger(maximum) ||
      minimum < 5 ||
      maximum > 100 ||
      maximum < minimum
    ) {
      throw new Error(
        'Check the age range.',
      )
    }
  }

  return {
    id: editor.id,
    name,
    matchType:
      editor.matchType ===
      'doubles'
        ? 'doubles'
        : 'singles',
    eligibility: {
      gender: editor.gender,
      age: {
        mode: editor.ageMode,
        minimum:
          editor.minimumAge,
        maximum:
          editor.maximumAge,
      },
      skill: normalizedSkill(),
    },
    form: {
      skillGate:
        editor.skillGate,
      levelSystem:
        editor.levelSystem,
      skillLevelIds: [
        ...editor.skillLevelIds,
      ],
      ratingMinimum:
        editor.ratingMinimum,
      ratingMaximum:
        editor.ratingMaximum,
    },
  }
}

function saveDraft() {
  error.value = ''

  try {
    const next =
      draftPayload()

    const index =
      drafts.value.findIndex(
        (item) =>
          item.id === next.id,
      )

    if (index === -1) {
      drafts.value = [
        ...drafts.value,
        next,
      ]
    } else {
      const updated =
        [...drafts.value]

      updated[index] = next
      drafts.value = updated
    }

    closeDraft()
  } catch (draftError) {
    error.value =
      draftError?.message ||
      'Check this Ladder.'
  }
}

function requirements(ladder) {
  return ladderRequirementsLabel(
    ladder?.eligibility,
    clubLevels.value,
  )
}

async function useExisting() {
  if (!enoughExisting.value) return

  emit('complete', {
    ladders:
      selectedExisting.value.map(
        (ladder) => ({
          id: ladder.id,
          name: ladder.name,
          matchType:
            ladder.matchType,
          eligibility:
            JSON.parse(
              JSON.stringify(
                ladder.eligibility || {},
              ),
            ),
        }),
      ),
    origin: 'existing',
  })
}

async function useDrafts() {
  if (
    busy.value ||
    !enoughDrafts.value
  ) {
    return
  }

  busy.value = true
  error.value = ''

  try {
    const created = []

    for (const draft of drafts.value) {
      const result =
        await adminStore.createLadder({
          name: draft.name,
          matchType:
            draft.matchType,
          eligibility:
            draft.eligibility,
        })

      created.push(
        result.ladder,
      )
    }

    emit('complete', {
      ladders:
        created.map(
          (ladder) => ({
            id: ladder.id,
            name: ladder.name,
            matchType:
              ladder.matchType,
            eligibility:
              JSON.parse(
                JSON.stringify(
                  ladder.eligibility || {},
                ),
              ),
          }),
        ),
      origin: 'create',
    })
  } catch (createError) {
    error.value =
      createError?.message ||
      'Unable to create these Ladders.'
  } finally {
    busy.value = false
  }
}

function back() {
  if (
    screen.value === 'existing' ||
    screen.value === 'create'
  ) {
    setScreen('start')
    return true
  }

  return false
}

function restore(value) {
  if (
    ['start', 'existing', 'create']
      .includes(value)
  ) {
    setScreen(value)
  }
}

function chooseAnother() {
  setScreen('start')
}

defineExpose({
  back,
  restore,
  chooseAnother,
})
</script>

<template>
  <section
    class="ci-ladder-chooser"
  >
    <p
      v-if="error"
      class="ref-inline-alert"
      role="alert"
    >
      {{ error }}
    </p>

    <template v-if="screen === 'start'">
      <section
        class="ci-ladder-zero"
      >
        <MemberListArt
          :variant="
            multiple
              ? 'multiple-ladders'
              : 'one-ladder'
          "
        />

        <div
          class="ci-ladder-zero__copy"
        >
          <h1>
            {{
              multiple
                ? 'Choose the Ladders for this import'
                : 'Choose the Ladder for this import'
            }}
          </h1>

          <p>
            Before you import members, choose where they should go.
          </p>
        </div>

        <div
          class="ci-ladder-zero__actions"
        >
          <button
            class="ref-button"
            :class="{
              primary:
                existingLadders.length,
            }"
            type="button"
            :disabled="
              !existingLadders.length
            "
            @click="openExisting"
          >
            {{
              multiple
                ? 'Use existing Ladders'
                : 'Use existing Ladder'
            }}
          </button>

          <button
            class="ref-button"
            :class="{
              primary:
                !existingLadders.length,
            }"
            type="button"
            @click="openCreate"
          >
            Add Ladder
          </button>
        </div>
      </section>
    </template>

    <template
      v-else-if="
        screen === 'existing'
      "
    >
      <header
        class="ci-section-head"
      >
        <div>
          <h1>
            {{
              multiple
                ? 'Use existing Ladders'
                : 'Use an existing Ladder'
            }}
          </h1>

          <p>
            {{
              multiple
                ? 'Select two or more.'
                : 'Select one.'
            }}
          </p>
        </div>
      </header>

      <div
        class="ci-ladder-grid"
      >
        <button
          v-for="
            ladder in
            existingLadders
          "
          :key="ladder.id"
          class="ci-ladder-card"
          :class="{
            selected:
              selectedIds.has(
                ladder.id,
              ),
          }"
          type="button"
          @click="
            toggleExisting(ladder)
          "
        >
          <span>
            <strong>
              {{ ladder.name }}
            </strong>

            <small>
              {{
                requirements(
                  ladder,
                )
              }}
            </small>
          </span>

          <span
            class="ci-select-mark"
            aria-hidden="true"
          >
            <FlowIcon
              v-if="
                selectedIds.has(
                  ladder.id,
                )
              "
              name="check"
            />
          </span>
        </button>
      </div>

      <footer
        class="ci-footer"
      >
        <button
          class="ref-button primary"
          type="button"
          :disabled="
            !enoughExisting
          "
          @click="useExisting"
        >
          {{
            multiple
              ? `Use ${selectedExisting.length} Ladders`
              : 'Use selected Ladder'
          }}
        </button>
      </footer>
    </template>

    <template v-else>
      <header
        class="ci-section-head"
      >
        <div>
          <h1>
            {{
              multiple
                ? 'Add Ladders'
                : 'Add Ladder'
            }}
          </h1>

          <p v-if="multiple">
            Add at least two.
          </p>
        </div>
      </header>

      <div
        v-if="drafts.length"
        class="ci-draft-list"
      >
        <article
          v-for="
            draft in drafts
          "
          :key="draft.id"
          class="ci-draft"
        >
          <div
            class="ci-draft__bar"
          >
            <button
              class="ci-draft__summary"
              type="button"
              @click="
                openDraftId ===
                draft.id
                  ? closeDraft()
                  : openDraft(
                      draft.id,
                    )
              "
            >
              <span>
                <strong>
                  {{ draft.name }}
                </strong>

                <small>
                  {{
                    requirements(
                      draft,
                    )
                  }}
                </small>
              </span>

              <FlowIcon
                class="ci-ladder-chevron"
                :name="
                  openDraftId ===
                  draft.id
                    ? 'chevron-down'
                    : 'arrow-right'
                "
              />
            </button>

            <button
              class="ci-draft__remove"
              type="button"
              aria-label="Remove Ladder"
              @click="
                removeDraft(
                  draft.id,
                )
              "
            >
              <FlowIcon name="close" />
            </button>
          </div>

          <div
            v-if="
              openDraftId ===
              draft.id
            "
            class="ci-editor"
          >
            <label
              class="ref-form-field"
            >
              <span>Ladder name</span>

              <input
                v-model="editor.name"
                maxlength="70"
                placeholder="Men's Singles"
              />
            </label>

            <div
              class="ci-form-grid"
            >
              <div
                class="ref-form-field"
              >
                <span>Format</span>

                <div
                  class="ci-choice-line"
                >
                  <label>
                    <input
                      v-model="
                        editor.matchType
                      "
                      type="radio"
                      value="singles"
                    />
                    Singles
                  </label>

                  <label>
                    <input
                      v-model="
                        editor.matchType
                      "
                      type="radio"
                      value="doubles"
                    />
                    Doubles
                  </label>
                </div>
              </div>

              <label
                class="ref-form-field"
              >
                <span>Gender</span>

                <select
                  v-model="
                    editor.gender
                  "
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
            </div>

            <div
              class="ref-form-field"
            >
              <span>Age</span>

              <div
                class="ci-choice-line"
              >
                <label>
                  <input
                    v-model="
                      editor.ageMode
                    "
                    type="radio"
                    value="any"
                  />
                  Any age
                </label>

                <label>
                  <input
                    v-model="
                      editor.ageMode
                    "
                    type="radio"
                    value="range"
                  />
                  Set age range
                </label>
              </div>

              <div
                v-if="
                  editor.ageMode ===
                  'range'
                "
                class="ci-form-grid"
              >
                <label
                  class="ref-form-field"
                >
                  <span>From</span>

                  <input
                    v-model.number="
                      editor.minimumAge
                    "
                    type="number"
                    min="5"
                    max="100"
                  />
                </label>

                <label
                  class="ref-form-field"
                >
                  <span>To</span>

                  <input
                    v-model.number="
                      editor.maximumAge
                    "
                    type="number"
                    min="5"
                    max="100"
                  />
                </label>
              </div>
            </div>

            <div
              class="ref-form-field"
            >
              <span>
                Competition level
              </span>

              <div
                class="ci-choice-line"
              >
                <label>
                  <input
                    v-model="
                      editor.skillGate
                    "
                    type="radio"
                    value="any"
                  />
                  Any level
                </label>

                <label>
                  <input
                    v-model="
                      editor.skillGate
                    "
                    type="radio"
                    value="limited"
                  />
                  Set level
                </label>
              </div>
            </div>

            <div
              v-if="
                editor.skillGate ===
                'limited'
              "
              class="ci-rating-list"
            >
              <div
                class="ci-rating-item"
                :class="{
                  selected:
                    editor.levelSystem ===
                    'club_level',
                  dimmed:
                    editor.levelSystem &&
                    editor.levelSystem !==
                      'club_level',
                }"
              >
                <button
                  class="ci-rating-trigger"
                  type="button"
                  @click="
                    editor.levelSystem =
                      'club_level'
                  "
                >
                  <span
                    class="ci-radio"
                  ></span>

                  <span>
                    <strong>
                      Club levels
                    </strong>

                    <small>
                      {{ clubName }}'s own levels.
                    </small>
                  </span>
                </button>

                <div
                  v-if="
                    editor.levelSystem ===
                    'club_level'
                  "
                  class="ci-rating-config"
                >
                  <div
                    class="ci-level-chips"
                  >
                    <label
                      v-for="
                        level in
                        clubLevels
                      "
                      :key="level.id"
                    >
                      <input
                        v-model="
                          editor.skillLevelIds
                        "
                        type="checkbox"
                        :value="level.id"
                      />

                      <span>
                        {{ level.label }}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div
                v-for="
                  system in
                  ratingSystems
                "
                :key="system.id"
                class="ci-rating-item"
                :class="{
                  selected:
                    editor.levelSystem ===
                    system.id,
                  dimmed:
                    editor.levelSystem &&
                    editor.levelSystem !==
                      system.id,
                }"
              >
                <button
                  class="ci-rating-trigger"
                  type="button"
                  @click="
                    editor.levelSystem =
                      system.id
                  "
                >
                  <span
                    class="ci-radio"
                  ></span>

                  <span>
                    <strong>
                      {{ system.acronym }}
                      <small>
                        ({{ system.name }})
                      </small>
                    </strong>

                    <small>
                      {{
                        system.description
                      }}
                    </small>
                  </span>
                </button>

                <div
                  v-if="
                    editor.levelSystem ===
                    system.id
                  "
                  class="ci-rating-config"
                >
                  <div
                    v-if="
                      system.id ===
                      'ntrp'
                    "
                    class="ci-form-grid"
                  >
                    <label
                      class="ref-form-field"
                    >
                      <span>From</span>

                      <select
                        v-model.number="
                          editor.ratingMinimum
                        "
                      >
                        <option
                          v-for="
                            value in
                            ntrpOptions
                          "
                          :key="value"
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

                    <label
                      class="ref-form-field"
                    >
                      <span>To</span>

                      <select
                        v-model.number="
                          editor.ratingMaximum
                        "
                      >
                        <option
                          v-for="
                            value in
                            ntrpOptions
                          "
                          :key="value"
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
                    class="ci-form-grid"
                  >
                    <label
                      class="ref-form-field"
                    >
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
                          editor.ratingMinimum
                        "
                        type="number"
                        :min="
                          system.minimum
                        "
                        :max="
                          system.maximum
                        "
                        :step="
                          system.step
                        "
                      />
                    </label>

                    <label
                      class="ref-form-field"
                    >
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
                          editor.ratingMaximum
                        "
                        type="number"
                        :min="
                          system.minimum
                        "
                        :max="
                          system.maximum
                        "
                        :step="
                          system.step
                        "
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="ci-editor__actions"
            >
              <button
                class="ref-button primary"
                type="button"
                @click="saveDraft"
              >
                Done
              </button>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="
          openDraftId &&
          !drafts.some(
            (item) =>
              item.id ===
              openDraftId,
          )
        "
        class="ci-editor ci-editor--new"
      >
        <label
          class="ref-form-field"
        >
          <span>Ladder name</span>

          <input
            v-model="editor.name"
            maxlength="70"
            placeholder="Men's Singles"
          />
        </label>

        <div
          class="ci-form-grid"
        >
          <div
            class="ref-form-field"
          >
            <span>Format</span>

            <div
              class="ci-choice-line"
            >
              <label>
                <input
                  v-model="
                    editor.matchType
                  "
                  type="radio"
                  value="singles"
                />
                Singles
              </label>

              <label>
                <input
                  v-model="
                    editor.matchType
                  "
                  type="radio"
                  value="doubles"
                />
                Doubles
              </label>
            </div>
          </div>

          <label
            class="ref-form-field"
          >
            <span>Gender</span>

            <select
              v-model="
                editor.gender
              "
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
        </div>

        <div
          class="ref-form-field"
        >
          <span>Age</span>

          <div
            class="ci-choice-line"
          >
            <label>
              <input
                v-model="
                  editor.ageMode
                "
                type="radio"
                value="any"
              />
              Any age
            </label>

            <label>
              <input
                v-model="
                  editor.ageMode
                "
                type="radio"
                value="range"
              />
              Set age range
            </label>
          </div>

          <div
            v-if="
              editor.ageMode ===
              'range'
            "
            class="ci-form-grid"
          >
            <label
              class="ref-form-field"
            >
              <span>From</span>

              <input
                v-model.number="
                  editor.minimumAge
                "
                type="number"
                min="5"
                max="100"
              />
            </label>

            <label
              class="ref-form-field"
            >
              <span>To</span>

              <input
                v-model.number="
                  editor.maximumAge
                "
                type="number"
                min="5"
                max="100"
              />
            </label>
          </div>
        </div>

        <div
          class="ref-form-field"
        >
          <span>
            Competition level
          </span>

          <div
            class="ci-choice-line"
          >
            <label>
              <input
                v-model="
                  editor.skillGate
                "
                type="radio"
                value="any"
              />
              Any level
            </label>

            <label>
              <input
                v-model="
                  editor.skillGate
                "
                type="radio"
                value="limited"
              />
              Set level
            </label>
          </div>
        </div>

        <div
          v-if="
            editor.skillGate ===
            'limited'
          "
          class="ci-rating-list"
        >
          <div
            class="ci-rating-item"
            :class="{
              selected:
                editor.levelSystem ===
                'club_level',
              dimmed:
                editor.levelSystem &&
                editor.levelSystem !==
                  'club_level',
            }"
          >
            <button
              class="ci-rating-trigger"
              type="button"
              @click="
                editor.levelSystem =
                  'club_level'
              "
            >
              <span
                class="ci-radio"
              ></span>

              <span>
                <strong>
                  Club levels
                </strong>

                <small>
                  {{ clubName }}'s own levels.
                </small>
              </span>
            </button>

            <div
              v-if="
                editor.levelSystem ===
                'club_level'
              "
              class="ci-rating-config"
            >
              <div
                class="ci-level-chips"
              >
                <label
                  v-for="
                    level in
                    clubLevels
                  "
                  :key="level.id"
                >
                  <input
                    v-model="
                      editor.skillLevelIds
                    "
                    type="checkbox"
                    :value="level.id"
                  />

                  <span>
                    {{ level.label }}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div
            v-for="
              system in
              ratingSystems
            "
            :key="system.id"
            class="ci-rating-item"
            :class="{
              selected:
                editor.levelSystem ===
                system.id,
              dimmed:
                editor.levelSystem &&
                editor.levelSystem !==
                  system.id,
            }"
          >
            <button
              class="ci-rating-trigger"
              type="button"
              @click="
                editor.levelSystem =
                  system.id
              "
            >
              <span
                class="ci-radio"
              ></span>

              <span>
                <strong>
                  {{ system.acronym }}
                  <small>
                    ({{ system.name }})
                  </small>
                </strong>

                <small>
                  {{
                    system.description
                  }}
                </small>
              </span>
            </button>

            <div
              v-if="
                editor.levelSystem ===
                system.id
              "
              class="ci-rating-config"
            >
              <div
                v-if="
                  system.id ===
                  'ntrp'
                "
                class="ci-form-grid"
              >
                <label
                  class="ref-form-field"
                >
                  <span>From</span>

                  <select
                    v-model.number="
                      editor.ratingMinimum
                    "
                  >
                    <option
                      v-for="
                        value in
                        ntrpOptions
                      "
                      :key="value"
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

                <label
                  class="ref-form-field"
                >
                  <span>To</span>

                  <select
                    v-model.number="
                      editor.ratingMaximum
                    "
                  >
                    <option
                      v-for="
                        value in
                        ntrpOptions
                      "
                      :key="value"
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
                class="ci-form-grid"
              >
                <label
                  class="ref-form-field"
                >
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
                      editor.ratingMinimum
                    "
                    type="number"
                    :min="
                      system.minimum
                    "
                    :max="
                      system.maximum
                    "
                    :step="
                      system.step
                    "
                  />
                </label>

                <label
                  class="ref-form-field"
                >
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
                      editor.ratingMaximum
                    "
                    type="number"
                    :min="
                      system.minimum
                    "
                    :max="
                      system.maximum
                    "
                    :step="
                      system.step
                    "
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div
          class="ci-editor__actions"
        >
          <button
            class="ref-button primary"
            type="button"
            @click="saveDraft"
          >
            Done
          </button>
        </div>
      </div>

      <div
        v-if="
          multiple ||
          !drafts.length
        "
        class="ci-add-another"
      >
        <button
          class="ref-button"
          type="button"
          :disabled="
            Boolean(openDraftId)
          "
          @click="addDraft"
        >
          Add Ladder
        </button>
      </div>

      <footer
        class="ci-footer"
      >
        <button
          class="ref-button primary"
          type="button"
          :disabled="
            !enoughDrafts ||
            busy ||
            Boolean(openDraftId)
          "
          @click="useDrafts"
        >
          {{
            busy
              ? 'Creating...'
              : multiple
                ? `Use ${drafts.length} Ladders`
                : 'Use Ladder'
          }}
        </button>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.ci-ladder-chooser {
  width: 100%;
}

.ci-ladder-zero {
  display: grid;
  min-height: 310px;
  place-items: center;
  align-content: center;
  gap: 15px;
  padding: 34px 18px;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  text-align: center;
}

.ci-ladder-zero > :first-child {
  max-width: 170px;
}

.ci-ladder-zero__copy h1,
.ci-section-head h1 {
  margin: 0;
  color: var(--color-text);
  font-size: 20px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
}

.ci-ladder-zero__copy p,
.ci-section-head p {
  margin: 5px 0 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.ci-ladder-zero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 9px;
}

.ci-section-head {
  margin-bottom: 18px;
}

.ci-ladder-grid {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.ci-ladder-card {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    24px;
  gap: 10px;
  min-height: 94px;
  padding: 13px 14px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface);
  color: inherit;
  text-align: left;
}

.ci-ladder-card:hover {
  border-color:
    color-mix(
      in srgb,
      var(--color-primary) 24%,
      var(--color-border)
    );
}

.ci-ladder-card.selected {
  border-color:
    color-mix(
      in srgb,
      var(--color-primary) 42%,
      var(--color-border)
    );
  background:
    color-mix(
      in srgb,
      var(--color-primary) 3%,
      var(--color-surface)
    );
}

.ci-ladder-card strong,
.ci-draft__summary strong {
  display: block;
  color: var(--color-text);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}

.ci-ladder-card small,
.ci-draft__summary small {
  display: block;
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 10.5px;
  line-height: 1.45;
}

.ci-select-mark {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  align-self: start;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: transparent;
}

.ci-ladder-card.selected
  .ci-select-mark {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.ci-select-mark :deep(svg) {
  width: 13px;
  height: 13px;
}

.ci-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 18px;
}

.ci-draft-list {
  display: grid;
  gap: 9px;
}

.ci-draft {
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface);
}

.ci-draft__bar {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    42px;
  align-items: stretch;
}

.ci-draft__summary {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    auto;
  gap: 14px;
  align-items: center;
  min-height: 70px;
  padding:
    11px
    16px
    11px
    14px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.ci-ladder-chevron {
  width: 16px;
  height: 16px;
  margin-right: 4px;
  color: var(--color-muted);
}

.ci-draft__remove {
  display: grid;
  place-items: center;
  border: 0;
  border-left: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-muted);
}

.ci-draft__remove :deep(svg) {
  width: 15px;
  height: 15px;
}

.ci-editor {
  display: grid;
  gap: 17px;
  padding:
    16px
    14px
    18px;
  border-top: 1px solid var(--color-border);
}

.ci-editor--new {
  margin-top: 9px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
}

.ci-form-grid {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ci-choice-line {
  display: flex;
  flex-wrap: wrap;
  gap: 13px 18px;
  min-height: 40px;
  align-items: center;
}

.ci-choice-line label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--color-text-soft);
  font-size: 12px;
}

.ci-choice-line input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--color-primary);
}

.ci-rating-list {
  border-top: 1px solid var(--color-border);
}

.ci-rating-item {
  border-bottom: 1px solid var(--color-border);
}

.ci-rating-item.dimmed
  > .ci-rating-trigger {
  opacity: 0.55;
}

.ci-rating-item.dimmed
  > .ci-rating-trigger:hover {
  opacity: 0.82;
}

.ci-rating-trigger {
  display: grid;
  width: 100%;
  grid-template-columns:
    18px
    minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  min-height: 60px;
  padding: 12px 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.ci-radio {
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border: 1.5px solid #98a39b;
  border-radius: 50%;
  background: #fff;
}

.ci-rating-item.selected
  .ci-radio {
  border-color: var(--color-primary);
  background: var(--color-primary);
  box-shadow:
    inset 0 0 0 4px #fff;
}

.ci-rating-trigger strong {
  display: block;
  color: var(--color-text);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.ci-rating-trigger strong small {
  display: inline;
  color: var(--color-muted);
  font-weight: var(--font-weight-medium);
}

.ci-rating-trigger > span > small {
  display: block;
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.45;
}

.ci-rating-config {
  padding:
    0
    0
    14px
    28px;
}

.ci-level-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.ci-level-chips label {
  position: relative;
}

.ci-level-chips input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.ci-level-chips span {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  padding: 0 11px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-soft);
  font-size: 11px;
  cursor: pointer;
}

.ci-level-chips
  input:checked + span {
  border-color:
    color-mix(
      in srgb,
      var(--color-primary) 36%,
      var(--color-border)
    );
  background:
    color-mix(
      in srgb,
      var(--color-primary) 7%,
      #fff
    );
  color: var(--color-primary-strong);
}

.ci-editor__actions,
.ci-add-another {
  display: flex;
  justify-content: flex-end;
}

.ci-add-another {
  margin-top: 10px;
}

@media (max-width: 760px) {
  .ci-ladder-grid,
  .ci-form-grid {
    grid-template-columns: 1fr;
  }

  .ci-footer {
    position: sticky;
    z-index: 4;
    bottom: 0;
    padding:
      12px 0
      calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-border);
    background:
      color-mix(
        in srgb,
        var(--color-surface) 96%,
        transparent
      );
  }

  .ci-footer .ref-button {
    width: 100%;
  }
}
</style>
