<script setup>
import {
  computed,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { sanitizePlainText } from '../utils/formSafety.js'
import { formatAppDateRange } from '../utils/dateFormat.js'
import { useAdminStore } from '../stores/admin.js'
import { useTournamentStore } from '../stores/tournament.js'
import { useNotificationStore } from '../stores/notification.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const tournamentStore = useTournamentStore()
const notificationStore = useNotificationStore()

const ready = ref(false)
const pageError = ref('')
const saving = ref(false)

const form = reactive({
  name: '',
  description: '',
  signupOpen: '',
  signupClose: '',
})

const tournamentId = computed(
  () => String(route.params.tournamentId || ''),
)

const tournament = computed(() =>
  tournamentStore.activeTournament?.id ===
  tournamentId.value
    ? tournamentStore.activeTournament
    : tournamentStore.tournaments.find(
        (item) =>
          item.id === tournamentId.value,
      ) || null,
)

const registrationEditable = computed(
  () =>
    Boolean(
      tournament.value?.rules
        ?.registrationStage,
    ),
)

const hasStartedCompetition = computed(
  () =>
    !tournament.value?.rules
      ?.registrationStage,
)

const eventCount = computed(
  () =>
    (
      tournament.value?.categories ||
      tournament.value?.events ||
      []
    ).length,
)

const dateLabel = computed(() =>
  tournament.value
    ? formatAppDateRange(
        tournament.value.startDate,
        tournament.value.endDate,
        {
          fallback:
            'Dates are not set',
        },
      )
    : '',
)

const venueLabel = computed(
  () =>
    tournament.value?.venue?.name ||
    tournament.value?.location ||
    'Venue not set',
)

function hydrate() {
  if (!tournament.value) return

  Object.assign(form, {
    name:
      tournament.value.name || '',
    description:
      tournament.value.description ||
      '',
    signupOpen:
      tournament.value.signupOpen ||
      '',
    signupClose:
      tournament.value.signupClose ||
      '',
  })
}

function validate() {
  const name = sanitizePlainText(
    form.name,
    100,
  )

  if (name.length < 2) {
    return 'Enter a tournament name.'
  }

  if (
    registrationEditable.value &&
    form.signupOpen &&
    form.signupClose &&
    form.signupOpen > form.signupClose
  ) {
    return 'Registration must close after it opens.'
  }

  if (
    registrationEditable.value &&
    tournament.value?.startDate &&
    form.signupClose &&
    form.signupClose >
      tournament.value.startDate
  ) {
    return 'Registration must close before the tournament starts.'
  }

  return ''
}

async function save() {
  if (
    saving.value ||
    !tournament.value
  ) {
    return
  }

  pageError.value = validate()

  if (pageError.value) {
    notificationStore.addToast({
      title: 'Check tournament settings',
      message: pageError.value,
      type: 'warning',
    })
    return
  }

  saving.value = true

  try {
    const payload = {
      name: sanitizePlainText(
        form.name,
        100,
      ),
      description: sanitizePlainText(
        form.description,
        800,
      ),
    }

    if (registrationEditable.value) {
      payload.signupOpen =
        form.signupOpen || null
      payload.signupClose =
        form.signupClose || null
    }

    const saved =
      await tournamentStore.updateTournament(
        tournament.value.id,
        payload,
      )

    if (!saved) {
      throw new Error(
        tournamentStore.error ||
          'Unable to save tournament settings.',
      )
    }

    hydrate()

    notificationStore.addToast({
      title: 'Tournament settings saved',
      message: `${saved.name} is up to date.`,
      type: 'success',
    })
  } catch (error) {
    pageError.value =
      error?.message ||
      'We could not save this tournament.'

    notificationStore.addToast({
      title: 'Could not save tournament',
      message: pageError.value,
      type: 'error',
    })
  } finally {
    saving.value = false
  }
}

useShellNestedHeader(() => ({
  label: 'Tournament settings',
  backLabel: 'Back to tournament',
  back: () =>
    router.push({
      name: 'TournamentOverview',
      params: {
        tournamentId:
          tournamentId.value,
      },
    }),
  crumbs: [
    { label: 'Tournaments' },
    {
      label:
        tournament.value?.name ||
        'Tournament',
    },
    { label: 'Settings' },
  ],
}))

watch(tournament, (value) => {
  if (ready.value && value) hydrate()
})

onMounted(async () => {
  try {
    if (!adminStore.activeClub) {
      await adminStore.loadClubs()
    }

    await tournamentStore.fetchTournament(
      tournamentId.value,
    )

    if (!tournament.value) {
      pageError.value =
        'This tournament could not be found.'
      return
    }

    hydrate()
  } catch (error) {
    pageError.value =
      error?.message ||
      'We could not open these tournament settings.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main class="tournament-settings">
    <section
      v-if="!ready"
      class="ts-loading"
      aria-label="Loading tournament settings"
    >
      <span></span>
      <span></span>
      <span></span>
    </section>

    <section
      v-else-if="!tournament"
      class="ts-empty"
    >
      <h1>Tournament not found</h1>
      <p>{{ pageError }}</p>
      <button
        class="ts-button ts-button--primary"
        type="button"
        @click="
          router.push({
            name: 'Tournaments',
          })
        "
      >
        Open tournaments
      </button>
    </section>

    <form
      v-else
      class="ts-form"
      @submit.prevent="save"
    >
      <header class="ts-intro">
        <p>THIS TOURNAMENT ONLY</p>
        <h1>{{ tournament.name }}</h1>
        <span>
          Change the tournament itself without changing your other events.
        </span>
      </header>

      <p
        v-if="pageError"
        class="ts-alert"
        role="alert"
      >
        {{ pageError }}
      </p>

      <section class="ts-section">
        <header>
          <span class="ts-section__number">1</span>
          <div>
            <h2>Tournament details</h2>
            <p>
              The name and description members see.
            </p>
          </div>
        </header>

        <div class="ts-card ts-grid">
          <label class="ts-field">
            <span>Name</span>
            <input
              v-model="form.name"
              type="text"
              maxlength="100"
              autocomplete="off"
            />
          </label>

          <label class="ts-field">
            <span>Description</span>
            <textarea
              v-model="form.description"
              rows="4"
              maxlength="800"
              placeholder="A short description of this tournament"
            ></textarea>
          </label>
        </div>
      </section>

      <section class="ts-section">
        <header>
          <span class="ts-section__number">2</span>
          <div>
            <h2>Dates and registration</h2>
            <p>
              Gorra keeps competition dates visible while protecting an event that has already started.
            </p>
          </div>
        </header>

        <div class="ts-card">
          <dl class="ts-facts">
            <div>
              <dt>Tournament</dt>
              <dd>{{ dateLabel }}</dd>
            </div>

            <div>
              <dt>Venue</dt>
              <dd>{{ venueLabel }}</dd>
            </div>

            <div>
              <dt>Events</dt>
              <dd>
                {{ eventCount }}
                {{
                  eventCount === 1
                    ? 'event'
                    : 'events'
                }}
              </dd>
            </div>
          </dl>

          <template
            v-if="registrationEditable"
          >
            <div class="ts-divider"></div>

            <div
              class="ts-grid ts-grid--two"
            >
              <label class="ts-field">
                <span>
                  Registration opens
                </span>
                <input
                  v-model="form.signupOpen"
                  type="date"
                />
              </label>

              <label class="ts-field">
                <span>
                  Registration closes
                </span>
                <input
                  v-model="
                    form.signupClose
                  "
                  type="date"
                  :max="
                    tournament.startDate ||
                    undefined
                  "
                />
              </label>
            </div>
          </template>

          <p
            v-else
            class="ts-lock-note"
          >
            Registration and competition dates stay locked here after the draw has started, so existing fixtures are not silently moved.
          </p>
        </div>
      </section>

      <section class="ts-section">
        <header>
          <span class="ts-section__number">3</span>
          <div>
            <h2>Competition setup</h2>
            <p>
              Event formats, draws and scoring stay attached to the tournament that created them.
            </p>
          </div>
        </header>

        <div class="ts-card ts-structure">
          <span
            class="ts-structure__icon"
            aria-hidden="true"
          >
            ✓
          </span>

          <div>
            <strong>
              {{
                hasStartedCompetition
                  ? 'Competition structure is protected'
                  : 'Competition structure is ready'
              }}
            </strong>
            <p>
              Gorra will not change divisions, generated fixtures or match scoring from this general settings page.
            </p>
          </div>
        </div>
      </section>

      <footer class="ts-actions">
        <button
          class="ts-button"
          type="button"
          :disabled="saving"
          @click="
            router.push({
              name:
                'TournamentOverview',
              params: {
                tournamentId:
                  tournament.id,
              },
            })
          "
        >
          Cancel
        </button>

        <button
          class="ts-button ts-button--primary"
          type="submit"
          :disabled="saving"
        >
          {{
            saving
              ? 'Saving…'
              : 'Save tournament settings'
          }}
        </button>
      </footer>
    </form>
  </main>
</template>

<style scoped>
.tournament-settings {
  width: 100%;
  padding: 2px 0 44px;
  color: var(--color-text);
}

.ts-form {
  display: grid;
  gap: 34px;
}

.ts-intro p,
.ts-intro h1,
.ts-intro span,
.ts-section h2,
.ts-section p {
  margin: 0;
}

.ts-intro p {
  margin-bottom: 5px;
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.ts-intro h1 {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.025em;
}

.ts-intro span {
  display: block;
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 11px;
}

.ts-alert {
  margin: -16px 0 0;
  padding: 10px 12px;
  border: 1px solid rgba(164, 71, 64, 0.14);
  border-radius: 9px;
  background: rgba(164, 71, 64, 0.045);
  color: #92504b;
  font-size: 10.5px;
}

.ts-section {
  display: grid;
  gap: 13px;
}

.ts-section > header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
}

.ts-section__number {
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

.ts-section h2 {
  font-size: 15px;
  font-weight: 650;
}

.ts-section > header p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 10.5px;
  line-height: 1.45;
}

.ts-card {
  padding: 17px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.ts-grid {
  display: grid;
  gap: 14px;
}

.ts-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ts-field {
  display: grid;
  gap: 6px;
}

.ts-field > span {
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: 600;
}

.ts-field input,
.ts-field textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 12px;
}

.ts-field textarea {
  min-height: 102px;
  resize: vertical;
  line-height: 1.5;
}

.ts-field input:focus,
.ts-field textarea:focus {
  border-color: rgba(8, 173, 43, 0.4);
  outline: 0;
  box-shadow: 0 0 0 2px rgba(8, 173, 43, 0.07);
}

.ts-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.ts-facts > div {
  display: grid;
  gap: 3px;
  padding: 11px;
  border-radius: 9px;
  background: var(--color-surface-soft);
}

.ts-facts dt {
  color: var(--color-muted);
  font-size: 9px;
}

.ts-facts dd {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 10.5px;
  font-weight: 600;
}

.ts-divider {
  height: 1px;
  margin: 16px 0;
  background: var(--color-border);
}

.ts-lock-note {
  margin-top: 14px !important;
  color: var(--color-muted);
  font-size: 9.8px;
  line-height: 1.5;
}

.ts-structure {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: start;
  gap: 11px;
}

.ts-structure__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: rgba(8, 173, 43, 0.08);
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: 700;
}

.ts-structure strong {
  font-size: 11.5px;
  font-weight: 650;
}

.ts-structure p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 9.8px;
  line-height: 1.5;
}

.ts-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.ts-button {
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

.ts-button--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.ts-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ts-loading {
  display: grid;
  gap: 12px;
}

.ts-loading span {
  min-height: 70px;
  border-radius: var(--app-card-radius);
  background: var(--color-surface-soft);
}

.ts-empty {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
}

.ts-empty h1,
.ts-empty p {
  margin: 0;
}

.ts-empty h1 {
  font-size: 17px;
}

.ts-empty p {
  color: var(--color-muted);
  font-size: 11px;
}

@media (max-width: 767px) {
  .tournament-settings {
    width: 100%;
    padding-bottom: 32px;
  }

  .ts-form {
    gap: 30px;
  }

  .ts-intro h1 {
    font-size: 19px;
  }

  .ts-grid--two,
  .ts-facts {
    grid-template-columns: 1fr;
  }

  .ts-card {
    padding: 14px;
  }

  .ts-field input,
  .ts-field textarea {
    font-size: 16px;
  }

  .ts-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .ts-actions .ts-button {
    width: 100%;
  }

  .ts-actions .ts-button--primary {
    grid-row: 1;
  }
}
</style>

