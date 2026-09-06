<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../friendly/FlowIcon.vue'
import ClubIdentityHero from './ClubIdentityHero.vue'
import ClubMediaEditor from './ClubMediaEditor.vue'
import { useAdminStore } from '../../stores/admin'
import { useNotificationStore } from '../../stores/notification'
import { DEFAULT_CLUB_COVER_PRESET } from '../../utils/club/clubMedia.js'

const props = defineProps({
  countries: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['cancel'])

const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const form = reactive({
  name: '',
  country: '',
  city: '',
  logoUrl: '',
  coverUrl: '',
  coverPreset: DEFAULT_CLUB_COVER_PRESET,
})

const touched = reactive({
  name: false,
  country: false,
  city: false,
})

const submitted = ref(false)
const pageError = ref('')

const nameInput = ref(null)
const countryInput = ref(null)
const cityInput = ref(null)

const fieldErrors = computed(() => ({
  name: form.name.trim().length >= 2 ? '' : 'Enter your club name.',
  country: form.country.trim().length >= 2 ? '' : 'Choose a country.',
  city: form.city.trim().length >= 2 ? '' : 'Enter your city.',
}))

const formValid = computed(
  () =>
    !fieldErrors.value.name &&
    !fieldErrors.value.country &&
    !fieldErrors.value.city,
)

const previewName = computed(() => form.name.trim() || 'Your club')

const previewLocation = computed(() => {
  const value = [form.city.trim(), form.country.trim()].filter(Boolean).join(', ')
  return value || 'Location will appear here'
})

function visibleError(key) {
  return submitted.value || touched[key] ? fieldErrors.value[key] : ''
}

function markTouched(key) {
  touched[key] = true
}

async function focusFirstInvalidField() {
  await nextTick()

  if (fieldErrors.value.name) {
    nameInput.value?.focus()
    return
  }

  if (fieldErrors.value.country) {
    countryInput.value?.focus()
    return
  }

  if (fieldErrors.value.city) {
    cityInput.value?.focus()
  }
}

async function submit() {
  pageError.value = ''
  submitted.value = true

  if (!formValid.value || adminStore.isSaving) {
    await focusFirstInvalidField()
    return
  }

  try {
    const input = {
      name: form.name.trim(),
      country: form.country.trim(),
      city: form.city.trim(),
      logoUrl: form.logoUrl,
      coverUrl: form.coverUrl,
      coverPreset: form.coverPreset,
    }

    const result = await adminStore.createClub(input)

    notificationStore.addToast({
      message: `${result.club?.name || input.name} was created.`,
      type: 'success',
    })

    await router.push({ name: 'Club' })
  } catch (error) {
    pageError.value = error?.message || 'We could not create this club.'
  }
}

function cancel() {
  if (adminStore.isSaving) return
  emit('cancel')
}
</script>

<template>
  <section class="club-create-page" aria-label="Create club">
    <div class="club-create-layout">
      <form
        class="ref-form-card club-create-form"
        novalidate
        @submit.prevent="submit"
      >
        <header class="club-create-form__head">
          <h2>Club basics</h2>
          <p>Start with the details people use to recognise this club.</p>
        </header>

        <div class="club-create-form__body">
          <p
            v-if="pageError"
            class="ref-inline-alert"
            role="alert"
          >
            {{ pageError }}
          </p>

          <div class="club-create-fields">
            <label
              class="ref-form-field club-create-field club-create-field--full"
              :class="{ 'club-create-field--error': visibleError('name') }"
            >
              <span>Club name</span>
              <input
                ref="nameInput"
                v-model="form.name"
                type="text"
                maxlength="100"
                autocomplete="organization"
                placeholder="For example, Greenview Tennis Club"
                :aria-invalid="Boolean(visibleError('name'))"
                aria-describedby="club-create-name-error"
                @blur="markTouched('name')"
              />
              <small
                id="club-create-name-error"
                class="club-create-error"
                aria-live="polite"
              >
                {{ visibleError('name') }}
              </small>
            </label>

            <label
              class="ref-form-field club-create-field"
              :class="{ 'club-create-field--error': visibleError('country') }"
            >
              <span>Country</span>

              <span class="club-create-select">
                <select
                  ref="countryInput"
                  v-model="form.country"
                  :aria-invalid="Boolean(visibleError('country'))"
                  aria-describedby="club-create-country-error"
                  @blur="markTouched('country')"
                >
                  <option value="" disabled>Choose a country</option>
                  <option
                    v-for="country in props.countries"
                    :key="country"
                    :value="country"
                  >
                    {{ country }}
                  </option>
                </select>

                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m6 8 4 4 4-4" />
                </svg>
              </span>

              <small
                id="club-create-country-error"
                class="club-create-error"
                aria-live="polite"
              >
                {{ visibleError('country') }}
              </small>
            </label>

            <label
              class="ref-form-field club-create-field"
              :class="{ 'club-create-field--error': visibleError('city') }"
            >
              <span>City</span>
              <input
                ref="cityInput"
                v-model="form.city"
                type="text"
                maxlength="80"
                autocomplete="address-level2"
                placeholder="For example, Lagos"
                :aria-invalid="Boolean(visibleError('city'))"
                aria-describedby="club-create-city-error"
                @blur="markTouched('city')"
              />
              <small
                id="club-create-city-error"
                class="club-create-error"
                aria-live="polite"
              >
                {{ visibleError('city') }}
              </small>
            </label>
          </div>

          <section class="club-create-appearance">
            <header>
              <strong>Appearance</strong>
              <span>Optional. You can change this later.</span>
            </header>

            <ClubMediaEditor
              :logo-url="form.logoUrl"
              :cover-url="form.coverUrl"
              :cover-preset="form.coverPreset"
              :disabled="adminStore.isSaving"
              @update:logo-url="form.logoUrl = $event"
              @update:cover-url="form.coverUrl = $event"
              @update:cover-preset="form.coverPreset = $event"
            />
          </section>

          <div class="club-create-owner-note">
            <span class="club-create-owner-note__icon" aria-hidden="true">
              <FlowIcon name="check" />
            </span>

            <span class="club-create-owner-note__copy">
              <strong>You’ll manage this club</strong>
              <small>
                You can add members, other admins, ladders, courts and match rules after creation.
              </small>
            </span>
          </div>
        </div>

        <footer class="club-create-actions">
          <button
            class="ref-button"
            type="button"
            :disabled="adminStore.isSaving"
            @click="cancel"
          >
            Cancel
          </button>

          <button
            class="ref-button primary club-create-submit"
            type="submit"
            :disabled="!formValid || adminStore.isSaving"
          >
            <span>{{ adminStore.isSaving ? 'Creating club…' : 'Create club' }}</span>
            <FlowIcon
              v-if="!adminStore.isSaving"
              name="arrow-right"
            />
          </button>
        </footer>
      </form>

      <aside class="club-create-preview" aria-label="Club preview">
        <header class="club-create-preview__head">
          <h2>Your club</h2>
          <p>This is the profile people will recognise.</p>
        </header>

        <ClubIdentityHero
          compact
          :name="previewName"
          :location="previewLocation"
          role-label="You · Admin"
          :logo-url="form.logoUrl"
          :cover-url="form.coverUrl"
          :cover-preset="form.coverPreset"
          :member-count="0"
          :ladder-count="0"
          :tournament-count="0"
        />

        <p class="club-create-preview__note">
          Gorra creates only the club. Members, ladders, tournaments, courts and rules stay empty until you add them.
        </p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.club-create-page {
  width: 100%;
  padding: 4px 0 54px;
}

.club-create-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.28fr) minmax(300px, 0.72fr);
  align-items: start;
  gap: 30px;
}

.club-create-form.ref-form-card {
  overflow: hidden;
  padding: 0;
  box-shadow: none;
}

.club-create-form__head {
  padding: 24px 24px 0;
}

.club-create-form__head h2,
.club-create-form__head p {
  margin: 0;
}

.club-create-form__head h2 {
  color: var(--g-ink, #28332c);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.015em;
}

.club-create-form__head p {
  margin-top: 4px;
  color: var(--g-muted, #7d8780);
  font-size: 11.5px;
  line-height: 1.5;
}

.club-create-form__body {
  padding: 22px 24px 24px;
}

.club-create-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.club-create-field--full {
  grid-column: 1 / -1;
}

.club-create-select {
  position: relative;
  display: block;
}

.club-create-select select {
  width: 100%;
  appearance: none;
  padding-right: 42px;
}

.club-create-select svg {
  position: absolute;
  top: 50%;
  right: 14px;
  width: 16px;
  transform: translateY(-50%);
  fill: none;
  stroke: #7b8680;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

.club-create-error {
  min-height: 14px;
  margin: 0;
  color: #a44740 !important;
  font-size: 9.8px !important;
  line-height: 1.35 !important;
}

.club-create-field--error :is(input, select) {
  border-color: rgba(164, 71, 64, 0.58);
  background: rgba(164, 71, 64, 0.018);
}

.club-create-appearance {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid rgba(44, 58, 48, 0.07);
}

.club-create-appearance > header {
  margin-bottom: 2px;
}

.club-create-appearance > header strong {
  display: block;
  color: var(--g-ink, #28332c);
  font-size: 12px;
  font-weight: 600;
}

.club-create-appearance > header span {
  display: block;
  margin-top: 3px;
  color: var(--g-muted, #7d8780);
  font-size: 10.2px;
}

.club-create-owner-note {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  margin-top: 22px;
  padding: 13px 14px;
  border-radius: 10px;
  background: var(--g-green-soft-2, #f7fcf8);
}

.club-create-owner-note__icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 9px;
  background: var(--g-green-soft, #eef9f0);
  color: var(--g-green-strong, #067d20);
}

.club-create-owner-note__icon :deep(.flow-icon) {
  width: 16px;
  height: 16px;
}

.club-create-owner-note__copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.club-create-owner-note__copy strong {
  color: var(--g-ink, #28332c);
  font-size: 11.5px;
  font-weight: 600;
}

.club-create-owner-note__copy small {
  color: var(--g-muted, #7d8780);
  font-size: 10.2px;
  line-height: 1.45;
}

.club-create-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px;
  border-top: 1px solid var(--g-line, #e4e9e5);
  background: #fcfdfc;
}

.club-create-actions .ref-button {
  min-height: 42px;
}

.club-create-submit {
  min-width: 132px;
}

.club-create-submit :deep(.flow-icon) {
  width: 14px;
  height: 14px;
}

.club-create-preview {
  position: sticky;
  top: calc(var(--app-header-height, 76px) + 22px);
}

.club-create-preview__head {
  margin-bottom: 12px;
}

.club-create-preview__head h2,
.club-create-preview__head p {
  margin: 0;
}

.club-create-preview__head h2 {
  color: var(--g-ink, #28332c);
  font-size: 14px;
  font-weight: 600;
}

.club-create-preview__head p {
  margin-top: 3px;
  color: var(--g-muted-2, #9aa39d);
  font-size: 10px;
}

.club-create-preview__note {
  margin: 12px 2px 0;
  color: var(--g-muted, #7d8780);
  font-size: 10px;
  line-height: 1.5;
}

@media (max-width: 980px) {
  .club-create-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .club-create-preview {
    position: static;
  }
}

@media (max-width: 620px) {
  .club-create-page {
    padding-bottom: 38px;
  }

  .club-create-fields {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .club-create-field--full {
    grid-column: auto;
  }

  .club-create-form__head {
    padding: 20px 18px 0;
  }

  .club-create-form__body {
    padding: 18px;
  }

  .club-create-actions {
    padding: 16px 18px;
  }
}

@media (max-width: 420px) {
  .club-create-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .club-create-actions .ref-button {
    width: 100%;
    min-width: 0;
  }
}
</style>

