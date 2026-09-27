<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import ClubMediaEditor from '../components/club/ClubMediaEditor.vue'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { isSafeImageSource, sanitizePlainText } from '../utils/formSafety'
import { DEFAULT_CLUB_COVER_PRESET } from '../utils/club/clubMedia.js'

const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const details = reactive({ name: '', logoUrl: '', coverUrl: '', coverPreset: DEFAULT_CLUB_COVER_PRESET, location: '' })

const club = computed(() => adminStore.activeClub)
const workspace = computed(() => club.value?.setup?.workspace || {})
const clubName = computed(() => details.name || club.value?.name || 'Your club')
const hasSafeLogo = computed(() => Boolean(details.logoUrl) && isSafeImageSource(details.logoUrl))
const hasSafeCover = computed(() => Boolean(details.coverUrl) && isSafeImageSource(details.coverUrl))

function hydrate() {
  const value = workspace.value
  Object.assign(details, {
    name: value.name || club.value?.name || '',
    logoUrl: value.logoUrl || '',
    coverUrl: value.coverUrl || '',
    coverPreset: value.coverPreset || DEFAULT_CLUB_COVER_PRESET,
    location: value.location || '',
  })
}

function validate() {
  if (sanitizePlainText(details.name, 100).length < 2) return 'Enter the club name.'
  if (sanitizePlainText(details.location, 120).length < 2) return 'Enter the club location.'
  if (details.logoUrl && !hasSafeLogo.value) return 'Use a safe image for the logo.'
  if (details.coverUrl && !hasSafeCover.value) return 'Use a safe image for the club cover.'
  return ''
}

async function save() {
  if (saving.value) return
  error.value = validate()
  if (error.value) return
  saving.value = true
  try {
    const saved = await adminStore.updateActiveClub({
      workspace: {
        ...workspace.value,
        name: sanitizePlainText(details.name, 100),
        logoUrl: hasSafeLogo.value ? details.logoUrl.trim() : '',
        coverUrl: hasSafeCover.value ? details.coverUrl.trim() : '',
        coverPreset: details.coverPreset || DEFAULT_CLUB_COVER_PRESET,
        location: sanitizePlainText(details.location, 120)
      },
    })
    if (saved?.setup?.workspace) hydrate()
    notificationStore.addToast({ message: 'Club details saved.', type: 'success' })
  } catch (cause) {
    error.value = cause?.message || 'We could not save the club details. Try again.'
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push({ name: 'Club' })
}

onMounted(async () => {
  try {
    await adminStore.loadClubs()
    if (!adminStore.activeClub) throw new Error('Choose a club before editing its details.')
    hydrate()
  } catch (cause) {
    error.value = cause?.message || 'We could not load the club details.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="club-details" aria-labelledby="club-details-title">
    <button class="club-details__back" type="button" @click="goBack">
      <FlowIcon name="arrow-right" aria-hidden="true" />
      Back to club
    </button>

    <header class="club-details__hero">
      <h1 id="club-details-title">Club details</h1>
      <p>Update the essential details members see about {{ clubName }}.</p>
    </header>

    <p v-if="error" class="club-details__alert" role="alert">{{ error }}</p>

    <div v-if="loading" class="club-details__loading" aria-live="polite">
      <span></span><span></span><span></span>
      <span class="visually-hidden">Loading club details</span>
    </div>

    <form v-else class="club-details__form" @submit.prevent="save">
      <section class="club-details__card">
        <div class="club-details__grid">
          <label class="club-details__field club-details__field--wide">
            <span>Club name</span>
            <input v-model="details.name" type="text" maxlength="100" autocomplete="organization" required />
          </label>
          <label class="club-details__field club-details__field--wide">
            <span>Location</span>
            <input v-model="details.location" type="text" maxlength="120" autocomplete="address-level2" placeholder="City, venue, or neighbourhood" required />
          </label>
        </div>
      </section>
      <section class="club-details__card">
        <header class="club-details__section-head">
          <div>
            <p>Club appearance</p>
            <h2>Logo and cover</h2>
          </div>
        </header>

        <ClubMediaEditor
          :logo-url="details.logoUrl"
          :cover-url="details.coverUrl"
          :cover-preset="details.coverPreset"
          :disabled="saving"
          @update:logo-url="details.logoUrl = $event"
          @update:cover-url="details.coverUrl = $event"
          @update:cover-preset="details.coverPreset = $event"
        />
      </section>


      <footer class="club-details__footer">
        <p>Member access, ladders, tournaments, and match rules are managed where they are used.</p>
        <div>
          <button class="club-details__secondary" type="button" :disabled="saving" @click="goBack">Cancel</button>
          <button class="club-details__primary" type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save changes' }}</button>
        </div>
      </footer>
    </form>
  </main>
</template>

<style scoped>
.club-details { width: 100%; margin: 0; padding: 4px 0 48px; color: var(--color-text, #18221b); }
.club-details__back { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 26px; padding: 0; border: 0; background: transparent; color: var(--color-text-soft, #526057); font: inherit; font-size: 12px; font-weight: var(--font-weight-semibold, 600); }
.club-details__back :deep(.flow-icon) { width: 15px; height: 15px; transform: rotate(180deg); }
.club-details__hero { display: block; padding-bottom: 26px; border-bottom: 1px solid var(--color-border, #e1e7e2); }
.club-details__eyebrow, .club-details__section-head p { margin: 0; color: var(--color-primary-strong, #087c29); font-size: 10px; font-weight: var(--font-weight-semibold, 600); letter-spacing: .1em; text-transform: uppercase; }
.club-details__hero h1 { margin: 0 0 7px; color: var(--color-text, #18221b); font-size: clamp(27px, 4vw, 34px); line-height: 1.08; letter-spacing: -.045em; }
.club-details__hero > p { max-width: 530px; margin: 0; color: var(--color-muted, #728077); font-size: 13px; line-height: 1.55; }
.club-details__identity { display: flex; align-items: center; gap: 11px; min-width: 210px; padding: 11px 13px; border: 1px solid var(--color-border, #e1e7e2); border-radius: 13px; background: var(--color-surface, #fff); }
.club-details__identity img, .club-details__identity > span { display: grid; width: 42px; height: 42px; flex: 0 0 42px; place-items: center; overflow: hidden; border-radius: 10px; background: #e9f5eb; color: var(--color-primary-strong, #087c29); font-size: 12px; font-weight: 700; object-fit: contain; }
.club-details__identity strong, .club-details__identity small { display: block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.club-details__identity strong { color: var(--color-text, #18221b); font-size: 12px; font-weight: var(--font-weight-semibold, 600); }
.club-details__identity small { margin-top: 2px; color: var(--color-muted, #728077); font-size: 10px; }
.club-details__form { display: grid; gap: 16px; margin-top: 24px; }
.club-details__card { padding: 24px; border: 1px solid var(--color-border, #e1e7e2); border-radius: 16px; background: var(--color-surface, #fff); box-shadow: 0 8px 24px rgba(18, 38, 24, .035); }
.club-details__section-head, .club-details__court-label, .club-details__footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.club-details__section-head { margin-bottom: 20px; }
.club-details__section-head h2 { margin: 4px 0 0; color: var(--color-text, #18221b); font-size: 17px; letter-spacing: -.02em; }
.club-details__count { padding: 5px 8px; border-radius: 6px; background: #eef7f0; color: var(--color-primary-strong, #087c29); font-size: 10px; font-weight: var(--font-weight-semibold, 600); }
.club-details__grid, .club-details__dates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px; }
.club-details__field { display: grid; gap: 7px; min-width: 0; color: var(--color-text-soft, #526057); font-size: 12px; font-weight: var(--font-weight-semibold, 600); }
.club-details__field--wide { grid-column: 1 / -1; }
.club-details__field input, .club-details__court-row input { width: 100%; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--color-border, #e1e7e2); border-radius: 9px; outline: none; background: #fff; color: var(--color-text, #18221b); font: inherit; font-size: 13px; }
.club-details__field input:focus, .club-details__court-row input:focus { border-color: var(--color-primary, #10a34a); box-shadow: 0 0 0 3px rgba(16, 163, 74, .11); }
.club-details__field small { color: var(--color-muted, #728077); font-size: 10.5px; font-weight: var(--font-weight-regular, 400); line-height: 1.45; }
.club-details__courts { margin-top: 23px; padding-top: 21px; border-top: 1px solid var(--color-border, #e1e7e2); }
.club-details__court-label { align-items: flex-start; margin-bottom: 14px; }
.club-details__court-label h3 { margin: 0 0 3px; color: var(--color-text, #18221b); font-size: 13px; }
.club-details__court-label p, .club-details__footer p { margin: 0; color: var(--color-muted, #728077); font-size: 11px; line-height: 1.5; }
.club-details__court-list { display: grid; gap: 8px; }
.club-details__court-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.club-details__secondary, .club-details__primary, .club-details__remove { min-height: 40px; border-radius: 9px; font: inherit; font-size: 12px; font-weight: var(--font-weight-semibold, 600); }
.club-details__secondary { padding: 0 13px; border: 1px solid var(--color-border, #e1e7e2); background: #fff; color: var(--color-text-soft, #526057); }
.club-details__primary { min-width: 130px; padding: 0 17px; border: 1px solid var(--color-primary, #10a34a); background: var(--color-primary, #10a34a); color: #fff; }
.club-details__remove { padding: 0 8px; border: 0; background: transparent; color: var(--color-muted, #728077); }
.club-details__secondary:hover, .club-details__remove:hover { background: var(--color-surface-soft, #f4f7f4); color: var(--color-text, #18221b); }
.club-details__primary:hover { filter: brightness(.94); }
.club-details__secondary:disabled, .club-details__primary:disabled { cursor: not-allowed; opacity: .6; }
.club-details__footer { align-items: flex-start; padding: 4px 0; }
.club-details__footer > p { max-width: 420px; }
.club-details__footer > div { display: flex; gap: 8px; }
.club-details__alert { margin: 20px 0 0; padding: 11px 13px; border: 1px solid #f0cccc; border-radius: 10px; background: #fff7f7; color: #9a3030; font-size: 12px; }
.club-details__loading { display: grid; gap: 12px; margin-top: 25px; }
.club-details__loading span:not(.visually-hidden) { display: block; height: 58px; border-radius: 15px; background: linear-gradient(90deg, #f0f3f0 20%, #fafbfa 50%, #f0f3f0 80%); background-size: 220% 100%; animation: club-details-shimmer 1.25s linear infinite; }
.club-details__loading span:nth-child(2) { height: 220px; }
.club-details__loading span:nth-child(3) { height: 178px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes club-details-shimmer { to { background-position: -220% 0; } }
@media (max-width: 650px) { .club-details { padding-bottom: 32px; } .club-details__hero { align-items: flex-start; flex-direction: column; gap: 19px; } .club-details__identity { width: 100%; box-sizing: border-box; } .club-details__grid, .club-details__dates { grid-template-columns: 1fr; } .club-details__card { padding: 18px; } .club-details__footer { align-items: stretch; flex-direction: column; } .club-details__footer > div { width: 100%; } .club-details__footer button { flex: 1; } }
@media (max-width: 420px) { .club-details__court-label { align-items: stretch; flex-direction: column; } .club-details__court-label .club-details__secondary { width: 100%; } }
</style>

