<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
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
  skillMode: 'any',
  skillLevelIds: [],
})

const activeClub = computed(() => adminStore.activeClub)
const clubName = computed(() => activeClub.value?.name || 'Your club')
const clubLogo = computed(
  () => activeClub.value?.setup?.workspace?.logoUrl || '',
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
  (Array.isArray(activeClub.value?.setup?.playerLevels?.levels)
    ? activeClub.value.setup.playerLevels.levels
    : []
  ).filter((level) => level?.active !== false),
)

const hasClubRules = computed(() =>
  Boolean(
    activeClub.value?.setup?.rules &&
      Object.keys(activeClub.value.setup.rules).length,
  ),
)

const ruleSourceLabel = computed(() =>
  hasClubRules.value
    ? `Uses ${clubName.value} defaults`
    : 'Uses GORRA defaults',
)

function cancel() {
  router.push({ name: 'Rankings' })
}

function viewRules() {
  notificationStore.addToast({
    title: hasClubRules.value ? `${clubName.value} rules` : 'GORRA defaults',
    message:
      'Challenge and match rules can be reviewed or customized after the ladder is created.',
    type: 'info',
  })
}

async function create() {
  if (saving.value) return

  error.value = ''
  const name = sanitizePlainText(form.name, 70)

  if (name.length < 2) {
    error.value = 'Enter a ladder name.'
    return
  }

  if (form.ageMode === 'range') {
    const minimum = Number(form.minimumAge)
    const maximum = Number(form.maximumAge)

    if (
      !Number.isInteger(minimum) ||
      !Number.isInteger(maximum) ||
      minimum < 5 ||
      maximum > 100 ||
      maximum < minimum
    ) {
      error.value = 'Check the age range.'
      return
    }
  }

  const availableLevelIds = new Set(
    clubLevels.value
      .map((level) => sanitizeDirectoryId(level.id))
      .filter(Boolean),
  )

  const selectedLevelIds =
    form.skillMode === 'club_level'
      ? [
          ...new Set(
            form.skillLevelIds
              .map((levelId) => sanitizeDirectoryId(levelId))
              .filter((levelId) => availableLevelIds.has(levelId)),
          ),
        ]
      : []

  if (form.skillMode === 'club_level' && !selectedLevelIds.length) {
    error.value = 'Choose at least one player level.'
    return
  }

  saving.value = true

  try {
    const result = await adminStore.createLadder({
      name,
      matchType: form.matchType,
      eligibility: {
        gender: form.gender,
        age: {
          mode: form.ageMode,
          minimum: form.minimumAge,
          maximum: form.maximumAge,
        },
        skill: {
          mode: form.skillMode,
          levelIds: selectedLevelIds,
        },
      },
    })

    notificationStore.addToast({
      title: 'Ladder created',
      message: `${result.ladder.name} is ready for members.`,
      type: 'success',
    })

    await router.push({
      name: 'LadderSetup',
      params: {
        ladderId: result.ladder.id,
        step: 'members',
      },
    })
  } catch (createError) {
    error.value = createError?.message || 'Unable to create this ladder.'
  } finally {
    saving.value = false
  }
}

useShellNestedHeader(() => ({
  label: 'Create ladder',
  backLabel: 'Back to ladder',
  back: cancel,
  crumbs: [{ label: 'Ladder' }, { label: 'Create' }],
}))

onMounted(async () => {
  try {
    if (!adminStore.activeClub) await adminStore.loadClubs()

    if (!adminStore.hasActiveClubPermission('club.manage')) {
      await router.replace({ name: 'Rankings' })
      return
    }
  } catch (loadError) {
    error.value = loadError?.message || 'Unable to open ladder creation.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main v-if="ready" class="ladder-workspace-page">
    <header class="lw-club-context">
      <div class="lw-club-context__mark" aria-hidden="true">
        <img v-if="clubLogo" :src="clubLogo" alt="" />
        <span v-else>{{ clubInitials }}</span>
      </div>

      <div class="lw-club-context__copy">
        <strong>{{ clubName }}</strong>
        <p>Choose who can play. Members and starting positions come next.</p>
      </div>
    </header>

    <form class="lw-form" @submit.prevent="create">
      <p v-if="error" class="lw-alert" role="alert">{{ error }}</p>

      <section class="lw-section">
        <div class="lw-grid lw-grid--single">
          <label class="lw-field">
            <span>Ladder name</span>
            <input
              v-model="form.name"
              maxlength="70"
              autocomplete="off"
              placeholder="Men’s Singles"
              required
            />
          </label>

          <div class="lw-field">
            <span>Format</span>
            <div class="lw-choice-row">
              <label class="lw-choice">
                <input v-model="form.matchType" type="radio" value="singles" />
                Singles
              </label>
              <label class="lw-choice">
                <input v-model="form.matchType" type="radio" value="doubles" />
                Doubles
              </label>
            </div>
          </div>
        </div>
      </section>

      <section class="lw-section">
        <div class="lw-section__heading">
          <h2>Who can participate?</h2>
          <p>These requirements are also used on the ladder invite link.</p>
        </div>

        <div class="lw-grid lw-grid--single">
          <label class="lw-field">
            <span>Gender</span>
            <select v-model="form.gender">
              <option value="any">Any gender</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
          </label>

          <div class="lw-field">
            <span>Age</span>
            <div class="lw-choice-row">
              <label class="lw-choice">
                <input v-model="form.ageMode" type="radio" value="any" />
                Any age
              </label>
              <label class="lw-choice">
                <input v-model="form.ageMode" type="radio" value="range" />
                Set age range
              </label>
            </div>

            <div v-if="form.ageMode === 'range'" class="lw-range-grid">
              <label class="lw-field">
                <span>Minimum age</span>
                <input
                  v-model.number="form.minimumAge"
                  type="number"
                  min="5"
                  max="100"
                  inputmode="numeric"
                />
              </label>

              <label class="lw-field">
                <span>Maximum age</span>
                <input
                  v-model.number="form.maximumAge"
                  type="number"
                  min="5"
                  max="100"
                  inputmode="numeric"
                />
              </label>
            </div>
          </div>

          <div class="lw-field">
            <span>Skill level</span>

            <div class="lw-choice-row">
              <label class="lw-choice">
                <input v-model="form.skillMode" type="radio" value="any" />
                Any level
              </label>

              <label class="lw-choice">
                <input
                  v-model="form.skillMode"
                  type="radio"
                  value="club_level"
                />
                Set level
              </label>
            </div>

            <div
              v-if="form.skillMode === 'club_level'"
              class="lw-level-block"
            >
              <span class="lw-label">Allowed levels</span>

              <div class="lw-level-options">
                <label
                  v-for="level in clubLevels"
                  :key="level.id"
                  class="lw-level-chip"
                >
                  <input
                    v-model="form.skillLevelIds"
                    type="checkbox"
                    :value="level.id"
                  />
                  <span>{{ level.label }}</span>
                </label>
              </div>

              <small>
                Levels are set by {{ clubName }}. Members cannot change their own
                club level from a ladder invite.
              </small>
            </div>
          </div>
        </div>
      </section>

      <section class="lw-section">
        <div class="lw-rule-row">
          <div>
            <strong>Competition rules</strong>
            <small>{{ ruleSourceLabel }}</small>
          </div>

          <div class="lw-inline-actions">
            <button class="lw-text-button" type="button" @click="viewRules">
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

        <BaseButton type="submit" :disabled="saving">
          {{ saving ? 'Creating…' : 'Create ladder' }}
        </BaseButton>
      </footer>
    </form>
  </main>
</template>
