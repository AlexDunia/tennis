<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../friendly/FlowIcon.vue'
import { useAdminStore } from '../../stores/admin'
import { useNotificationStore } from '../../stores/notification'

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
})

const touched = reactive({
  name: false,
  country: false,
  city: false,
})

const submitted = ref(false)
const pageError = ref('')
const imageError = ref('')
const imageBusy = ref(false)

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

const previewInitials = computed(() => {
  const words = form.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!words.length) return 'CL'

  return words
    .map((word) => word[0])
    .join('')
    .toUpperCase()
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

  if (!formValid.value || adminStore.isSaving || imageBusy.value) {
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

async function uploadImage(event, field) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || imageBusy.value || adminStore.isSaving) return
  imageError.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    imageError.value = 'Choose a JPG, PNG or WebP image.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    imageError.value = 'Choose an image smaller than 5 MB.'
    return
  }
  imageBusy.value = true
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const limit = field === 'logoUrl' ? 320 : 1200
    const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/webp', 0.82)
    if (result.length > 1_000_000) throw new Error('Choose a smaller or simpler image.')
    form[field] = result
  } catch (error) {
    imageError.value = error?.message || 'We could not read that image. Try another file.'
  } finally {
    URL.revokeObjectURL(url)
    imageBusy.value = false
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

          <div class="club-create-media">
            <div class="club-create-logo-upload">
              <span class="club-create-logo-thumb" aria-hidden="true">
                <img v-if="form.logoUrl" :src="form.logoUrl" alt="" />
                <span v-else>{{ previewInitials }}</span>
              </span>
              <div>
                <label class="ref-button club-create-upload">
                  {{ form.logoUrl ? 'Change logo' : 'Upload logo' }}
                  <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="imageBusy || adminStore.isSaving" @change="uploadImage($event, 'logoUrl')" />
                </label>
                <button v-if="form.logoUrl" class="club-create-remove" type="button" :disabled="imageBusy || adminStore.isSaving" @click="form.logoUrl = ''">Remove</button>
                <p>Optional &middot; JPG, PNG or WebP &middot; up to 5 MB</p>
              </div>
            </div>
            <p v-if="imageError" class="ref-inline-alert" role="alert">{{ imageError }}</p>
            <p v-if="imageBusy" role="status">Preparing your image...</p>
          </div>
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
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
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
            :disabled="!formValid || adminStore.isSaving || imageBusy"
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
          <p>This updates as you type.</p>
        </header>

        <div class="club-create-preview__cover" :class="{ 'has-image': form.coverUrl }">
          <img v-if="form.coverUrl" :src="form.coverUrl" alt="Club cover preview" />
          <svg v-else class="club-create-court" viewBox="0 0 360 150" fill="none" aria-hidden="true">
            <rect x="60" y="20" width="240" height="110" rx="2" />
            <path d="M80 20v110M280 20v110M60 75h240M80 45h200M80 105h200M180 45v60" />
          </svg>
          <label class="ref-button club-create-upload club-create-cover-upload">
            {{ form.coverUrl ? 'Change cover' : 'Add cover photo' }}
            <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="imageBusy || adminStore.isSaving" @change="uploadImage($event, 'coverUrl')" />
          </label>
        </div>
        <button v-if="form.coverUrl" class="club-create-remove" type="button" :disabled="imageBusy || adminStore.isSaving" @click="form.coverUrl = ''">Remove cover photo</button>
        <div class="club-create-preview__identity">
          <span class="club-create-preview__mark" aria-hidden="true">
            <img v-if="form.logoUrl" :src="form.logoUrl" alt="" />
            <template v-else>{{ previewInitials }}</template>
          </span>

          <span class="club-create-preview__copy">
            <strong>{{ previewName }}</strong>
            <span>{{ previewLocation }}</span>
            <small>You · Admin</small>
          </span>
        </div>

        <div class="club-create-preview__counts" aria-label="New club starts empty">
          <span><strong>0</strong> members</span>
          <i aria-hidden="true"></i>
          <span><strong>0</strong> ladders</span>
          <i aria-hidden="true"></i>
          <span><strong>0</strong> tournaments</span>
        </div>


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
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.72fr);
  align-items: start;
  gap: 28px;
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

.club-create-owner-note {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  margin-top: 20px;
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
  line-height: 1.35;
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
  padding: 22px;
  border: 1px solid var(--g-line, #e4e9e5);
  border-radius: 12px;
  background: #fff;
}

.club-create-preview__head h2,
.club-create-preview__head p {
  margin: 0;
}

.club-create-preview__head h2 {
  color: var(--g-ink, #28332c);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.club-create-preview__head p {
  margin-top: 3px;
  color: var(--g-muted-2, #9aa39d);
  font-size: 10px;
  line-height: 1.4;
}

.club-create-preview__identity {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  margin-top: 20px;
}

.club-create-preview__mark {
  display: grid;
  width: 60px;
  height: 60px;
  place-items: center;
  border-radius: 15px;
  background: #eef4ef;
  color: #338047;
  font-size: 13px;
  font-weight: 600;
}

.club-create-preview__copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.club-create-preview__copy strong {
  overflow: hidden;
  color: var(--g-ink, #28332c);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-create-preview__copy > span {
  overflow: hidden;
  color: var(--g-muted, #7d8780);
  font-size: 10.8px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-create-preview__copy small {
  color: var(--g-green-strong, #067d20);
  font-size: 9.8px;
  font-weight: 600;
  line-height: 1.35;
}

.club-create-preview__counts {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--g-line, #e4e9e5);
  color: #7a847d;
  font-size: 9.8px;
  line-height: 1.4;
  white-space: nowrap;
}

.club-create-preview__counts strong {
  color: #536058;
  font-weight: 600;
}

.club-create-preview__counts i {
  width: 3px;
  height: 3px;
  flex: 0 0 3px;
  border-radius: 50%;
  background: #c1c8c3;
}

.club-create-preview__note {
  margin: 15px 0 0;
  color: var(--g-muted, #7d8780);
  font-size: 10.5px;
  line-height: 1.55;
}

@media (max-width: 980px) {
  .club-create-layout {
    grid-template-columns: 1fr;
    gap: 22px;
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

  .club-create-preview {
    padding: 18px;
  }

  .club-create-preview__counts {
    flex-wrap: wrap;
    white-space: normal;
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

@media (prefers-reduced-motion: reduce) {
  .club-create-page *,
  .club-create-page *::before,
  .club-create-page *::after {
    scroll-behavior: auto !important;
  }
}
.club-create-media { margin-bottom: 24px; }
.club-create-logo-upload { display: flex; align-items: center; gap: 14px; }
.club-create-logo-upload p { margin: 7px 0 0; color: var(--g-muted); font-size: 10px; }
.club-create-logo-thumb { display: grid; place-items: center; width: 64px; height: 64px; flex: 0 0 64px; border: 1px solid var(--g-line); border-radius: 12px; background: var(--g-green-soft); color: var(--g-green-strong); font-size: 14px; }
.club-create-logo-thumb img, .club-create-preview__mark img { width: 100%; height: 100%; object-fit: contain; border-radius: inherit; }
.club-create-upload { position: relative; overflow: hidden; cursor: pointer; }
.club-create-upload input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.club-create-upload:focus-within { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.club-create-upload:has(input:disabled) { opacity: .55; cursor: wait; }
.club-create-remove { padding: 8px; border: 0; background: transparent; color: var(--g-muted); font: inherit; font-size: 10px; cursor: pointer; }
.club-create-select { position: relative; display: block; }
.club-create-select select { width: 100%; padding-right: 38px !important; appearance: none; background-image: none !important; }
.club-create-select svg { position: absolute; right: 14px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%); fill: none; stroke: var(--color-muted); stroke-width: 1.5; pointer-events: none; }
.club-create-preview__cover { position: relative; height: 160px; margin: 18px -22px 0; background: var(--g-green-soft, #eef9f0); overflow: hidden; }
.club-create-preview__cover > img { width: 100%; height: 100%; object-fit: cover; }
.club-create-court { width: 100%; height: 100%; stroke: var(--g-green-strong, #067d20); stroke-width: 1; opacity: .22; }
.club-create-cover-upload { position: absolute; right: 12px; bottom: 12px; background: var(--color-surface) !important; min-height: 32px; font-size: 10px; box-shadow: var(--flow-shadow-quiet); }
@media (max-width: 620px) { .club-create-preview__cover { margin-inline: -18px; } }
</style>
