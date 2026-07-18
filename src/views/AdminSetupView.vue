<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRoute, useRouter } from 'vue-router'
import { ADMIN_SETUP_STEPS, createDefaultClubSetup } from '../config/admin'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import {
  createPrivateInvitationToken,
  normalizeClubSetup,
  validateClubSetupStep,
} from '../utils/admin/clubSetup'
import FlowIcon from '../components/friendly/FlowIcon.vue'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const form = reactive(createDefaultClubSetup())
const step = ref(1)
const pageError = ref('')
const matchTypes = ref(['singles'])
const groups = reactive({ singles: ['everyone'], doubles: ['everyone'] })
const seniorAge = reactive({ singles: 60, doubles: 60 })
const levelName = reactive({
  singles: 'Beginner & Intermediate',
  doubles: 'Beginner & Intermediate',
})
const locationConfirmed = ref(false)
const locationTimeLabel = ref('West Africa Time')
const importFile = ref(null)
const importBusy = ref(false)
const importMessage = ref('')
const fileInput = ref(null)
const qrDataUrl = ref('')
let importTimer = null

const LOCATION_OPTIONS = Object.freeze([
  { label: 'Ibadan, Oyo State', timezone: 'Africa/Lagos', timeLabel: 'West Africa Time' },
  { label: 'Lagos, Lagos State', timezone: 'Africa/Lagos', timeLabel: 'West Africa Time' },
  {
    label: 'Abuja, Federal Capital Territory',
    timezone: 'Africa/Lagos',
    timeLabel: 'West Africa Time',
  },
  { label: 'Port Harcourt, Rivers State', timezone: 'Africa/Lagos', timeLabel: 'West Africa Time' },
  { label: 'Accra, Greater Accra', timezone: 'Africa/Accra', timeLabel: 'Greenwich Mean Time' },
])
const MATCH_TYPE_OPTIONS = Object.freeze([
  {
    id: 'singles',
    icon: 'one-set',
    title: 'Singles',
    description: 'One player plays against one player.',
    badge: 'Most common',
  },
  {
    id: 'doubles',
    icon: 'users',
    title: 'Doubles',
    description: 'A team of two plays against another team of two.',
  },
])
const SCREEN_COPY = Object.freeze([
  ['About your club', 'What’s your club called?', 'This is the name your members will see.'],
  [
    'About your club',
    'Where is your club located?',
    'We’ll use this to set the correct time for matches.',
  ],
  [
    'How you play',
    'How does your club play ladder matches?',
    'Choose one or both. You can change this before finishing.',
  ],
  [
    'Who can join',
    'Who can join your ladders?',
    'Choose as many groups as your club needs. Each group creates a separate ladder.',
  ],
  [
    'Bring your club',
    'How would you like to add your members?',
    'Choose what is easiest. You can use another option later.',
  ],
  [
    'Ready to finish',
    'Your club is ready.',
    'Check this summary. Nothing becomes active until you open the club.',
  ],
])

const GROUP_OPTIONS = Object.freeze({
  singles: ['everyone', 'men', 'women', 'senior', 'level'],
  doubles: ['everyone', 'men', 'women', 'mixed', 'senior', 'level'],
})
const MEMBER_OPTIONS = Object.freeze([
  ['import-list', 'upload', 'Import a list'],
  ['email-phone', 'send', 'Invite by email or phone'],
  ['private-link', 'link', 'Share one link or QR code'],
  ['manual', 'users', 'Add one at a time'],
  ['later', 'calendar', 'Do this later'],
])

const activeStep = computed(() => ADMIN_SETUP_STEPS[step.value - 1])
const progress = computed(() => ((step.value - 1) / (ADMIN_SETUP_STEPS.length - 1)) * 100)
const activeLadders = computed(() => form.ladders.filter((ladder) => ladder.enabled))
const memberTitle = computed(
  () => MEMBER_OPTIONS.find((item) => item[0] === form.membership.source)?.[2] || 'Do this later',
)
const inviteLink = computed(() => {
  const slug = form.workspace.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${window.location.origin}${window.location.pathname}#/signup?club=${slug || 'your-club'}&invite=${encodeURIComponent(form.membership.invitationToken)}`
})
const primaryActionLabel = computed(() => {
  if (adminStore.isSaving) return 'Saving…'
  if (step.value === 6) return 'Open my club'
  if (step.value === 5 && form.membership.source === 'import-list' && !importFile.value)
    return 'Choose a file'
  return 'Continue'
})

function replaceForm(value) {
  const normalized = normalizeClubSetup(value)
  Object.keys(form).forEach((key) => delete form[key])
  Object.assign(form, normalized)
}
function hydrateFlowState() {
  const enabledLadders = form.ladders.filter((ladder) => ladder.enabled)
  const savedTypes = [...new Set(enabledLadders.map((ladder) => ladder.matchType))]
  matchTypes.value = savedTypes.length ? savedTypes : ['singles']
  for (const type of ['singles', 'doubles']) {
    const savedGroups = enabledLadders
      .filter((ladder) => ladder.matchType === type)
      .map((ladder) => {
        const value = `${ladder.id} ${ladder.name}`.toLowerCase()
        if (value.includes('women')) return 'women'
        if (value.includes('men')) return 'men'
        if (value.includes('mixed')) return 'mixed'
        if (value.includes('senior')) return 'senior'
        if (value.includes('level') || value.includes('beginner') || value.includes('intermediate'))
          return 'level'
        return 'everyone'
      })
    groups[type] = [...new Set(savedGroups.length ? savedGroups : ['everyone'])]
  }
}
function routeStep() {
  const index = ADMIN_SETUP_STEPS.findIndex(
    (item) => item.key === String(route.query.step || 'name'),
  )
  return index >= 0 ? index + 1 : 1
}
function syncRoute(next) {
  const safe = Math.min(6, Math.max(1, next))
  router.replace({
    path: route.path,
    query: { ...route.query, step: ADMIN_SETUP_STEPS[safe - 1].key },
  })
}
function groupTitle(group) {
  return {
    everyone: 'Everyone',
    men: 'Men',
    women: 'Women',
    mixed: 'Mixed teams',
    senior: 'Senior players',
    level: 'Beginner or intermediate',
  }[group]
}
function groupDescription(type, group) {
  if (group === 'everyone')
    return `Creates an Open ${type === 'singles' ? 'Singles' : 'Doubles'} ladder.`
  if (group === 'senior') return 'Set the starting age below.'
  if (group === 'level') return 'Use a clear level name.'
  return `Creates a ${groupTitle(group)} ${type === 'singles' ? 'Singles' : 'Doubles'} ladder.`
}
function ladderName(type, group) {
  const suffix = type === 'singles' ? 'Singles' : 'Doubles'
  if (group === 'everyone') return `Open ${suffix}`
  if (group === 'men') return `Men's ${suffix}`
  if (group === 'women') return `Women's ${suffix}`
  if (group === 'mixed') return 'Mixed Doubles'
  if (group === 'senior') return `Senior ${seniorAge[type]}+ ${suffix}`
  return `${levelName[type] || 'Beginner & Intermediate'} ${suffix}`
}
function syncLadders() {
  form.ladders = matchTypes.value.flatMap((type) =>
    groups[type].map((group) => ({
      id: `${group}-${type}`,
      name: ladderName(type, group),
      matchType: type,
      enabled: true,
    })),
  )
  form.primaryLadderId = form.ladders[0]?.id || ''
}
function toggleMatchType(type) {
  pageError.value = ''
  if (matchTypes.value.includes(type)) {
    if (matchTypes.value.length === 1) return (pageError.value = 'Keep at least one way to play.')
    matchTypes.value = matchTypes.value.filter((item) => item !== type)
  } else matchTypes.value = [...matchTypes.value, type]
  syncLadders()
}
function toggleGroup(type, group) {
  pageError.value = ''
  if (groups[type].includes(group)) {
    if (groups[type].length === 1) return (pageError.value = 'Keep at least one group.')
    groups[type] = groups[type].filter((item) => item !== group)
  } else groups[type] = [...groups[type], group]
  syncLadders()
}
function selectLocation(option) {
  Object.assign(form.workspace, { location: option.label, timezone: option.timezone })
  locationTimeLabel.value = option.timeLabel
  locationConfirmed.value = true
}
function confirmLocation() {
  const knownLocation = LOCATION_OPTIONS.find(
    (option) => option.label.toLowerCase() === form.workspace.location.trim().toLowerCase(),
  )
  if (knownLocation) selectLocation(knownLocation)
  else locationConfirmed.value = form.workspace.location.trim().length >= 2
}
function chooseMemberMethod(method) {
  form.membership.source = method
  form.membership.privateLinkEnabled = method === 'private-link'
  form.membership.allowManualEntry = ['manual', 'later'].includes(method)
  pageError.value = ''
}
function handleFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  importFile.value = file
  importBusy.value = true
  importMessage.value = 'Reading your document…'
  importTimer = window.setTimeout(() => {
    importBusy.value = false
    importMessage.value = 'Your file is ready. Nothing will be added until you review it.'
  }, 1100)
}
async function generateQrCode() {
  if (!form.membership.invitationToken) return
  try {
    qrDataUrl.value = await QRCode.toDataURL(inviteLink.value, {
      width: 184,
      margin: 2,
      color: { dark: '#172319', light: '#ffffff' },
    })
  } catch {
    qrDataUrl.value = ''
  }
}
async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    notificationStore.addToast({ message: 'Club invitation link copied.', type: 'success' })
  } catch {
    pageError.value = 'Select the link and copy it manually.'
  }
}
async function goNext() {
  if (step.value === 1) form.workspace.name = form.workspace.name.trim()
  if (step.value === 2 && form.workspace.location.trim().length >= 2) locationConfirmed.value = true
  if (step.value === 5 && form.membership.source === 'import-list' && !importFile.value)
    return fileInput.value?.click()
  if (
    step.value === 5 &&
    form.membership.source === 'email-phone' &&
    !form.membership.inviteEmails.trim() &&
    !form.membership.invitePhones.trim()
  ) {
    pageError.value = 'Add one email address or phone number, or choose “Do this later”.'
    return
  }
  syncLadders()
  const validation = validateClubSetupStep(form, step.value)
  if (!validation.valid) return (pageError.value = validation.errors[0])
  pageError.value = ''
  form.completedStep = Math.max(form.completedStep, step.value)
  try {
    await adminStore.saveDraft(form)
    syncRoute(step.value + 1)
  } catch (error) {
    pageError.value = error?.message || 'Your answer could not be saved.'
  }
}
function goBack() {
  pageError.value = ''
  step.value > 1 ? syncRoute(step.value - 1) : router.push({ name: 'Dashboard' })
}
async function publish() {
  syncLadders()
  const validation = validateClubSetupStep(form, 6)
  if (!validation.valid) return (pageError.value = validation.errors[0])
  try {
    await adminStore.publishSetup(form)
    notificationStore.addToast({ message: `${form.workspace.name} is ready.`, type: 'success' })
    router.push({ name: 'Dashboard' })
  } catch (error) {
    pageError.value = error?.message || 'Your club could not be opened.'
  }
}
function submitStep() {
  step.value === 6 ? publish() : goNext()
}
watch(
  () => route.query.step,
  () => {
    step.value = routeStep()
    pageError.value = ''
  },
)
watch(
  [
    () => seniorAge.singles,
    () => seniorAge.doubles,
    () => levelName.singles,
    () => levelName.doubles,
  ],
  syncLadders,
)
watch(inviteLink, generateQrCode)
onMounted(async () => {
  step.value = routeStep()
  await adminStore.loadSetup()
  replaceForm(adminStore.setup)
  hydrateFlowState()
  if (!form.membership.invitationToken)
    form.membership.invitationToken = createPrivateInvitationToken()
  if (!form.workspace.administratorIds.length && authStore.user?.playerId)
    form.workspace.administratorIds = [authStore.user.playerId]
  locationConfirmed.value = Boolean(form.workspace.location)
  syncLadders()
  generateQrCode()
})
onUnmounted(() => {
  if (importTimer) window.clearTimeout(importTimer)
})
</script>

<template>
  <main class="admin-onboarding">
    <header class="flow-header">{{ activeStep.label }} · {{ step }} of 6</header>
    <progress :value="progress" max="100"></progress>
    <form class="flow-screen" @submit.prevent="submitStep">
      <p class="eyebrow">{{ SCREEN_COPY[step - 1][0] }}</p>
      <h1>{{ SCREEN_COPY[step - 1][1] }}</h1>
      <p class="lead">{{ SCREEN_COPY[step - 1][2] }}</p>
      <p v-if="pageError" class="flow-alert" role="alert">{{ pageError }}</p>
      <label v-if="step === 1" class="answer-field">
        <span>Club name</span>
        <input v-model="form.workspace.name" placeholder="For example: Riverside Tennis Club" />
      </label>
      <div v-else-if="step === 2">
        <input
          v-model="form.workspace.location"
          list="club-locations"
          placeholder="Start typing your town or city"
          aria-label="Town or city"
          @input="locationConfirmed = false"
          @change="confirmLocation"
        />
        <datalist id="club-locations">
          <option v-for="item in LOCATION_OPTIONS" :key="item.label" :value="item.label"></option>
        </datalist>
        <button type="button" @click="confirmLocation">Use this location</button>
        <p v-if="locationConfirmed">Time set automatically to {{ locationTimeLabel }}.</p>
      </div>
      <div v-else-if="step === 3" class="choices two">
        <button
          v-for="item in MATCH_TYPE_OPTIONS"
          :key="item.id"
          type="button"
          :class="{ selected: matchTypes.includes(item.id) }"
          @click="toggleMatchType(item.id)"
        >
          <FlowIcon :name="item.icon" />
          <span
            ><em v-if="item.badge">{{ item.badge }}</em
            ><strong>{{ item.title }}</strong
            ><small>{{ item.description }}</small></span
          >
          <b>{{ matchTypes.includes(item.id) ? '✓' : '' }}</b>
        </button>
      </div>
      <div v-else-if="step === 4">
        <section v-for="type in matchTypes" :key="type" class="group">
          <h2>{{ type === 'singles' ? 'Singles ladder' : 'Doubles ladder' }}</h2>
          <div class="choices">
            <button
              v-for="item in GROUP_OPTIONS[type]"
              :key="item"
              type="button"
              :class="{ selected: groups[type].includes(item) }"
              @click="toggleGroup(type, item)"
            >
              <span
                ><strong>{{ groupTitle(item) }}</strong
                ><small>{{ groupDescription(type, item) }}</small></span
              >
              <b>{{ groups[type].includes(item) ? '✓' : '' }}</b>
            </button>
          </div>
          <label v-if="groups[type].includes(`senior`)"
            >Starting age
            <input v-model.number="seniorAge[type]" type="number" min="40" max="100" />
          </label>
          <label v-if="groups[type].includes(`level`)"
            >Level name
            <input v-model="levelName[type]" />
          </label>
        </section>
      </div>
      <div v-else-if="step === 5">
        <div class="choices">
          <button
            v-for="item in MEMBER_OPTIONS"
            :key="item[0]"
            type="button"
            :class="{ selected: form.membership.source === item[0] }"
            @click="chooseMemberMethod(item[0])"
          >
            <FlowIcon :name="item[1]" /><strong>{{ item[2] }}</strong>
            <b>{{ form.membership.source === item[0] ? '✓' : '' }}</b>
          </button>
        </div>
        <div v-if="form.membership.source === `import-list`" class="detail">
          <input ref="fileInput" type="file" @change="handleFile" />
          <p v-if="importBusy" class="loading">{{ importMessage }}</p>
          <p v-else>
            {{ importMessage || 'GORRA will organise the file and let you check it first.' }}
          </p>
        </div>
        <div v-else-if="form.membership.source === `email-phone`" class="detail two">
          <textarea
            v-model="form.membership.inviteEmails"
            aria-label="Member email addresses"
            placeholder="Email addresses"
          ></textarea>
          <textarea
            v-model="form.membership.invitePhones"
            aria-label="Member phone numbers"
            placeholder="Phone numbers"
          ></textarea>
        </div>
        <div v-else-if="form.membership.source === `private-link`" class="detail invite">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="Club invitation QR code" />
          <div>
            <p>{{ inviteLink }}</p>
            <button type="button" @click="copyInviteLink">Copy invitation link</button>
          </div>
        </div>
        <p v-else class="detail">{{ memberTitle }}. You can change this after the club opens.</p>
      </div>
      <div v-else class="review">
        <h2>{{ form.workspace.name }}</h2>
        <p>{{ form.workspace.location }}</p>
        <h3>Ladders</h3>
        <ul>
          <li v-for="ladder in activeLadders" :key="ladder.id">{{ ladder.name }}</li>
        </ul>
        <h3>Members</h3>
        <p>{{ memberTitle }}</p>
        <button type="button" @click="syncRoute(1)">Go back and change something</button>
      </div>
      <footer class="actions">
        <button type="button" @click="goBack">Back</button>
        <button class="primary" type="submit" :disabled="adminStore.isSaving">
          {{ primaryActionLabel }}
        </button>
      </footer>
    </form>
  </main>
</template>
<style scoped>
.admin-onboarding {
  min-height: 100svh;
  padding: clamp(20px, 4vw, 48px);
  color: var(--color-text, #172319);
  background: #f7f8f4;
}
.flow-header,
.flow-screen,
progress {
  width: min(100%, 860px);
  margin-inline: auto;
}
.flow-header {
  margin-bottom: 12px;
  color: #657066;
  font-size: 0.875rem;
  font-weight: var(--font-weight-medium, 500);
  letter-spacing: 0.02em;
}
progress {
  display: block;
  height: 4px;
  margin-bottom: clamp(44px, 8vh, 84px);
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: #dfe4dd;
}
progress::-webkit-progress-bar {
  background: #dfe4dd;
}
progress::-webkit-progress-value {
  background: #287a45;
}
progress::-moz-progress-bar {
  background: #287a45;
}
.flow-screen {
  display: grid;
  gap: 20px;
}
.answer-field {
  display: grid;
  gap: 8px;
  font-weight: var(--font-weight-medium, 500);
}
.eyebrow {
  margin: 0;
  color: #647067;
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold, 600);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  max-width: 720px;
  margin: -4px 0 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: var(--font-weight-bold, 700);
  line-height: 1.04;
  letter-spacing: -0.04em;
}
.lead {
  max-width: 650px;
  margin: -6px 0 18px;
  color: #5e6860;
  font-size: clamp(1rem, 2vw, 1.15rem);
  font-weight: var(--font-weight-regular, 400);
  line-height: 1.65;
}
.flow-alert {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid #e6b9b9;
  border-radius: 12px;
  color: #8b2525;
  background: #fff5f5;
  font-weight: var(--font-weight-medium, 500);
}
input,
textarea {
  width: 100%;
  min-height: 58px;
  padding: 14px 16px;
  border: 1px solid #cdd5cd;
  border-radius: 14px;
  color: inherit;
  background: #fff;
  font: inherit;
  font-size: 1.05rem;
  font-weight: var(--font-weight-regular, 400);
}
textarea {
  min-height: 130px;
  resize: vertical;
}
input:focus,
textarea:focus,
button:focus-visible {
  outline: 3px solid rgba(40, 122, 69, 0.24);
  outline-offset: 2px;
  border-color: #287a45;
}
button {
  min-height: 52px;
  padding: 12px 18px;
  border: 1px solid #cbd3cb;
  border-radius: 13px;
  color: inherit;
  background: #fff;
  font: inherit;
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
}
button:disabled {
  cursor: wait;
  opacity: 0.62;
}
.choices {
  display: grid;
  gap: 12px;
}
.choices.two,
.detail.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.choices > button {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  min-height: 92px;
  gap: 16px;
  padding: 18px;
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}
.choices > button:hover {
  transform: translateY(-1px);
  border-color: #92a396;
}
.choices > button.selected {
  border-color: #287a45;
  background: #f0f8f2;
  box-shadow: 0 0 0 1px #287a45;
}
.choices svg {
  width: 26px;
  height: 26px;
  color: #526057;
}
.choices span {
  display: grid;
  gap: 5px;
}
.choices strong,
.choices em {
  font-style: normal;
  font-weight: var(--font-weight-semibold, 600);
}
.choices em {
  width: fit-content;
  padding: 3px 7px;
  border-radius: 999px;
  color: #287a45;
  background: #e9f5ec;
  font-size: 0.72rem;
}
.choices small {
  color: #687269;
  font-size: 0.92rem;
  font-weight: var(--font-weight-regular, 400);
  line-height: 1.45;
}
.choices b {
  color: #287a45;
  font-size: 1.25rem;
  font-weight: var(--font-weight-semibold, 600);
}
.group {
  display: grid;
  gap: 14px;
  padding-block: 8px 28px;
}
.group + .group {
  border-top: 1px solid #dfe4df;
  padding-top: 28px;
}
.group h2,
.review h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: var(--font-weight-bold, 700);
}
.group label {
  display: grid;
  max-width: 440px;
  gap: 8px;
  font-weight: var(--font-weight-medium, 500);
}
.detail,
.review {
  display: grid;
  gap: 14px;
  margin-top: 18px;
  padding: clamp(18px, 3vw, 26px);
  border: 1px solid #d7ddd7;
  border-radius: 16px;
  background: #fff;
  color: #59635b;
  font-weight: var(--font-weight-regular, 400);
}
.detail p,
.review p {
  margin: 0;
  line-height: 1.6;
}
.detail.invite {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}
.invite img {
  width: 148px;
  border-radius: 10px;
}
.invite div {
  min-width: 0;
}
.invite div p {
  overflow-wrap: anywhere;
  margin-bottom: 12px;
}
.review h3 {
  margin: 8px 0 -6px;
  color: #667068;
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold, 600);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.review ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}
.actions {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: clamp(24px, 6vh, 54px);
  padding-top: 20px;
  border-top: 1px solid #dfe4df;
}
.actions button {
  min-width: 116px;
}
.actions .primary {
  min-width: 180px;
  border-color: #287a45;
  color: #fff;
  background: #287a45;
}
.loading {
  position: relative;
  overflow: hidden;
}
.loading::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 20%,
    rgba(255, 255, 255, 0.85) 50%,
    transparent 80%
  );
  animation: shimmer 1.25s infinite;
  content: '';
}
@keyframes shimmer {
  to {
    transform: translateX(100%);
  }
}
@media (max-width: 700px) {
  .admin-onboarding {
    padding: 18px;
  }
  progress {
    margin-bottom: 38px;
  }
  .choices.two,
  .detail.two {
    grid-template-columns: 1fr;
  }
  .detail.invite {
    grid-template-columns: 1fr;
  }
  .invite img {
    width: 132px;
  }
}
@media (max-width: 480px) {
  h1 {
    font-size: 2rem;
  }
  .choices > button {
    min-height: 84px;
    padding: 15px;
  }
  .actions {
    position: sticky;
    bottom: 0;
    padding: 14px 0;
    background: #f7f8f4;
  }
  .actions button {
    min-width: 0;
    flex: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::after {
    scroll-behavior: auto !important;
    animation: none !important;
    transition: none !important;
  }
}
</style>
