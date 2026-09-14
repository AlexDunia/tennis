<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
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
  skillLevels: '',
})

const activeClub = computed(() => adminStore.activeClub)
const clubName = computed(() => activeClub.value?.name || 'Your club')

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
      'Challenge and match rules can be reviewed or customized after the ladder is created. Creation stays focused on who may participate.',
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

  const levels =
    form.skillMode === 'set'
      ? form.skillLevels
          .split(',')
          .map((value) => sanitizePlainText(value, 50))
          .filter(Boolean)
      : []

  if (form.skillMode === 'set' && !levels.length) {
    error.value = 'Add at least one skill level.'
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
          levels,
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
    <header class="ladder-workspace-page__header">
      <p class="ladder-workspace-page__eyebrow">{{ clubName }}</p>
      <h1>Create ladder</h1>
      <p class="ladder-workspace-page__description">
        Decide who this ladder is for. Members and starting positions come next.
      </p>
    </header>

    <form class="lw-form" @submit.prevent="create">
      <p v-if="error" class="lw-alert" role="alert">{{ error }}</p>

      <section class="lw-section">
        <div class="lw-grid">
          <label class="lw-field lw-field--full">
            <span>Ladder name</span>
            <input
              v-model="form.name"
              maxlength="70"
              autocomplete="off"
              placeholder="Men’s Singles"
              required
            />
          </label>

          <div class="lw-field lw-field--full">
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
          <p>The invite link will use these requirements automatically.</p>
        </div>

        <div class="lw-grid">
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
          </div>

          <template v-if="form.ageMode === 'range'">
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
          </template>

          <div class="lw-field lw-field--full">
            <span>Skill level</span>
            <div class="lw-choice-row">
              <label class="lw-choice">
                <input v-model="form.skillMode" type="radio" value="any" />
                Any level
              </label>
              <label class="lw-choice">
                <input v-model="form.skillMode" type="radio" value="set" />
                Set level
              </label>
            </div>
          </div>

          <label
            v-if="form.skillMode === 'set'"
            class="lw-field lw-field--full"
          >
            <span>Allowed levels</span>
            <input
              v-model="form.skillLevels"
              maxlength="300"
              autocomplete="off"
              placeholder="Intermediate, Advanced"
            />
            <small>
              Use the same level names your club already uses. Separate multiple
              levels with commas.
            </small>
          </label>
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
