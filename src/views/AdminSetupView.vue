<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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
import { validateRosterImport } from '../utils/onboarding/rosterImport'
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
const stepHeading = ref(null)
const lastSavedLabel = ref('')
const memberMethodTouched = ref(false)
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
const importProgress = ref(0)
const fileInput = ref(null)
const qrDataUrl = ref('')
const memberModalOpen = ref(false)
const memberModal = ref(null)
const memberModalError = ref('')
const manualMember = reactive({ name: '', contact: '' })
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
  {
    id: 'import-list',
    icon: 'upload',
    title: 'Import a list',
    description: 'Upload Excel, CSV, or PDF.',
  },
  {
    id: 'email-phone',
    icon: 'send',
    title: 'Invite by email or phone',
    description: 'Send private invitations directly.',
  },
  {
    id: 'private-link',
    icon: 'link',
    title: 'Share one link or QR code',
    description: 'Let members join in their own time.',
  },
  {
    id: 'manual',
    icon: 'users',
    title: 'Add one at a time',
    description: 'Enter each member yourself.',
  },
  {
    id: 'later',
    icon: 'calendar',
    title: 'Do this later',
    description: 'Open the club without adding anyone.',
  },
])

const activeStep = computed(() => ADMIN_SETUP_STEPS[step.value - 1])
const progress = computed(() => (step.value / ADMIN_SETUP_STEPS.length) * 100)
const activeLadders = computed(() => form.ladders.filter((ladder) => ladder.enabled))
const memberTitle = computed(
  () => MEMBER_OPTIONS.find((item) => item.id === form.membership.source)?.title || 'Do this later',
)
const selectedMemberOption = computed(
  () => MEMBER_OPTIONS.find((item) => item.id === form.membership.source) || MEMBER_OPTIONS[4],
)
const importFileSize = computed(() => {
  if (!importFile.value) return ''
  const megabytes = importFile.value.size / 1024 / 1024
  return megabytes >= 1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.max(1, Math.round(importFile.value.size / 1024))} KB`
})
const canContinue = computed(() => {
  if (adminStore.isSaving || adminStore.isLoading) return false
  if (step.value === 1) return form.workspace.name.trim().length >= 2
  if (step.value === 2) return form.workspace.location.trim().length >= 2
  if (step.value === 3) return matchTypes.value.length > 0
  if (step.value === 4) return matchTypes.value.every((type) => groups[type]?.length > 0)
  if (step.value === 5) {
    if (!memberMethodTouched.value) return false
    if (form.membership.source === 'import-list') return Boolean(importFile.value)
    if (form.membership.source === 'email-phone') {
      return Boolean(form.membership.inviteEmails.trim() || form.membership.invitePhones.trim())
    }
    if (form.membership.source === 'private-link') {
      return form.membership.invitationToken.length >= 24
    }
    if (form.membership.source === 'manual') return manualMember.name.trim().length >= 2
  }
  return true
})
const memberModalAction = computed(
  () =>
    ({
      'import-list': importFile.value ? 'Use this file' : 'Choose a file',
      'email-phone': 'Save invitations',
      'private-link': 'Done',
      manual: 'Add members later',
      later: 'I will do this later',
    })[form.membership.source] || 'Done',
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
function groupIcon(group) {
  if (group === 'senior') return 'calendar'
  if (group === 'level') return 'ladder'
  return 'users'
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
function handleLocationInput() {
  locationConfirmed.value = false
  pageError.value = ''
}
function chooseMemberMethod(method) {
  memberMethodTouched.value = true
  form.membership.source = method
  form.membership.privateLinkEnabled = method === 'private-link'
  form.membership.allowManualEntry = ['manual', 'later'].includes(method)
  pageError.value = ''
  memberModalError.value = ''
  memberModalOpen.value = true
}
function processImportFile(file) {
  const validation = validateRosterImport(file)
  if (!validation.valid) {
    memberModalError.value = validation.message
    return
  }
  memberModalError.value = ''
  if (importTimer) window.clearInterval(importTimer)
  importFile.value = file
  importBusy.value = true
  importProgress.value = 16
  importMessage.value = `Preparing ${file.name}…`
  importTimer = window.setInterval(() => {
    importProgress.value = Math.min(100, importProgress.value + 14)
    if (importProgress.value === 100) {
      window.clearInterval(importTimer)
      importTimer = null
      importBusy.value = false
      importMessage.value = 'Ready for review. Nothing has been added yet.'
    }
  }, 140)
}
function handleFile(event) {
  processImportFile(event.target.files?.[0])
}
function handleFileDrop(event) {
  processImportFile(event.dataTransfer?.files?.[0])
}
function closeMemberModal() {
  memberModalOpen.value = false
  memberModalError.value = ''
}
function confirmMemberModal() {
  const method = form.membership.source
  if (method === 'import-list' && !importFile.value) {
    fileInput.value?.click()
    return
  }
  if (
    method === 'email-phone' &&
    !form.membership.inviteEmails.trim() &&
    !form.membership.invitePhones.trim()
  ) {
    memberModalError.value = 'Add at least one email address or phone number.'
    return
  }
  if (method === 'manual' && manualMember.name.trim().length < 2) {
    memberModalError.value = 'Enter the member’s name.'
    return
  }
  if (method === 'manual') {
    notificationStore.addToast({
      message: `${manualMember.name.trim()} is ready to add.`,
      type: 'success',
    })
  }
  closeMemberModal()
}
function handlePageKeydown(event) {
  if (event.key === 'Escape' && memberModalOpen.value) closeMemberModal()
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
async function shareInviteLink() {
  if (!navigator.share) {
    await copyInviteLink()
    return
  }
  try {
    await navigator.share({
      title: `Join ${form.workspace.name || 'my tennis club'}`,
      text: 'Use this private invitation to join our club on Gorra.',
      url: inviteLink.value,
    })
  } catch (error) {
    if (error?.name !== 'AbortError') {
      notificationStore.addToast({
        message: 'Sharing is not available here. The link is ready to copy.',
        type: 'info',
      })
    }
  }
}
function downloadQrCode() {
  if (!qrDataUrl.value) return
  const download = document.createElement('a')
  const clubSlug =
    form.workspace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'gorra-club'
  download.href = qrDataUrl.value
  download.download = `${clubSlug}-invitation-qr.png`
  download.click()
  notificationStore.addToast({ message: 'QR code downloaded.', type: 'success' })
}
async function goNext() {
  if (!canContinue.value) {
    pageError.value = 'Complete this step before continuing.'
    return
  }
  if (step.value === 1) form.workspace.name = form.workspace.name.trim()
  if (step.value === 2 && form.workspace.location.trim().length >= 2) locationConfirmed.value = true
  if (step.value === 5 && form.membership.source === 'import-list' && !importFile.value) {
    memberModalOpen.value = true
    return
  }
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
    lastSavedLabel.value = 'Draft saved on this device'
    syncRoute(step.value + 1)
  } catch (error) {
    pageError.value = error?.message || 'Your answer could not be saved.'
  }
}
function goBack() {
  pageError.value = ''
  step.value > 1 ? syncRoute(step.value - 1) : router.push({ name: 'SignUp' })
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
  async () => {
    step.value = routeStep()
    pageError.value = ''
    await nextTick()
    stepHeading.value?.focus()
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
watch(memberModalOpen, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) {
    await nextTick()
    memberModal.value?.focus()
  }
})
onMounted(async () => {
  window.addEventListener('keydown', handlePageKeydown)
  step.value = routeStep()
  try {
    await adminStore.loadSetup()
    replaceForm(adminStore.setup)
  } catch (error) {
    pageError.value = error?.message || 'Your saved setup could not be loaded.'
  }
  memberMethodTouched.value = form.completedStep >= 5
  hydrateFlowState()
  if (!form.membership.invitationToken)
    form.membership.invitationToken = createPrivateInvitationToken()
  if (!form.workspace.administratorIds.length && authStore.user?.playerId)
    form.workspace.administratorIds = [authStore.user.playerId]
  locationConfirmed.value = Boolean(form.workspace.location)
  syncLadders()
  generateQrCode()
  await nextTick()
  stepHeading.value?.focus()
})
onUnmounted(() => {
  window.removeEventListener('keydown', handlePageKeydown)
  document.body.style.overflow = ''
  if (importTimer) window.clearInterval(importTimer)
})
</script>

<template>
  <main class="admin-onboarding">
    <div class="flow-atmosphere" aria-hidden="true">
      <span class="flow-atmosphere__court"></span>
      <span class="flow-atmosphere__ball"></span>
      <span class="flow-atmosphere__glow"></span>
    </div>
    <header class="flow-header">
      <button class="flow-back" type="button" aria-label="Go back" @click="goBack">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <strong>{{ activeStep.label }}</strong>
      <span>{{ step }} of 6</span>
    </header>
    <progress :value="progress" max="100" :aria-label="`Step ${step} of 6`"></progress>
    <form class="flow-screen" :aria-busy="adminStore.isSaving" @submit.prevent="submitStep">
      <Transition name="setup-step" mode="out-in">
        <section :key="step" class="step-panel">
          <div class="flow-intro">
            <p class="eyebrow">{{ SCREEN_COPY[step - 1][0] }}</p>
            <h1 ref="stepHeading" tabindex="-1">{{ SCREEN_COPY[step - 1][1] }}</h1>
            <p class="lead">{{ SCREEN_COPY[step - 1][2] }}</p>
          </div>
          <p v-if="pageError" class="flow-alert" role="alert">{{ pageError }}</p>
          <div class="flow-answer">
            <label v-if="step === 1" class="answer-field">
              <span>Club name</span>
              <input
                v-model="form.workspace.name"
                placeholder="For example: Greenview Tennis Club"
                autocomplete="organization"
                maxlength="100"
                required
                autofocus
                @input="pageError = ''"
              />
            </label>
            <div v-else-if="step === 2" class="location-answer">
              <label class="location-label" for="club-location">Town or city</label>
              <input
                id="club-location"
                v-model="form.workspace.location"
                list="club-locations"
                placeholder="Start typing your town or city"
                aria-label="Town or city"
                autocomplete="address-level2"
                maxlength="120"
                required
                @input="handleLocationInput"
                @change="confirmLocation"
              />
              <datalist id="club-locations">
                <option
                  v-for="item in LOCATION_OPTIONS"
                  :key="item.label"
                  :value="item.label"
                ></option>
              </datalist>
              <button class="location-action" type="button" @click="confirmLocation">
                <FlowIcon name="check" /> Use this location
              </button>
              <p v-if="locationConfirmed" class="location-confirmation">
                <FlowIcon name="check" /> Time set automatically to {{ locationTimeLabel }}.
              </p>
            </div>
            <div v-else-if="step === 3" class="choices two">
              <button
                v-for="item in MATCH_TYPE_OPTIONS"
                :key="item.id"
                type="button"
                :class="{ selected: matchTypes.includes(item.id) }"
                :aria-pressed="matchTypes.includes(item.id)"
                @click="toggleMatchType(item.id)"
              >
                <span class="choice-icon"><FlowIcon :name="item.icon" /></span>
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
                    :aria-pressed="groups[type].includes(item)"
                    @click="toggleGroup(type, item)"
                  >
                    <span class="choice-icon"><FlowIcon :name="groupIcon(item)" /></span>
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
                  :key="item.id"
                  type="button"
                  :class="{ selected: form.membership.source === item.id }"
                  :aria-pressed="form.membership.source === item.id"
                  @click="chooseMemberMethod(item.id)"
                >
                  <span class="choice-icon"><FlowIcon :name="item.icon" /></span>
                  <span>
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.description }}</small>
                  </span>
                  <b>{{ form.membership.source === item.id ? '✓' : '›' }}</b>
                </button>
              </div>
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
          </div>
        </section>
      </Transition>
      <footer class="actions">
        <p class="save-state" aria-live="polite">
          <span aria-hidden="true"></span>
          {{ lastSavedLabel || 'Your answers stay on this device' }}
        </p>
        <button class="primary" type="submit" :disabled="!canContinue">
          <i v-if="adminStore.isSaving" class="button-spinner" aria-hidden="true"></i>
          {{ primaryActionLabel }}
          <FlowIcon v-if="!adminStore.isSaving" name="arrow-right" />
        </button>
      </footer>
    </form>

    <Teleport to="body">
      <Transition name="member-modal">
        <div
          v-if="memberModalOpen"
          class="member-modal-backdrop"
          @mousedown.self="closeMemberModal"
        >
          <section
            ref="memberModal"
            class="member-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
            tabindex="-1"
          >
            <header class="member-modal__header">
              <span class="member-modal__icon">
                <FlowIcon :name="selectedMemberOption.icon" />
              </span>
              <div>
                <p class="member-modal__eyebrow">Add members</p>
                <h2 id="member-modal-title">{{ selectedMemberOption.title }}</h2>
                <p>{{ selectedMemberOption.description }}</p>
              </div>
              <button
                class="member-modal__close"
                type="button"
                aria-label="Close"
                @click="closeMemberModal"
              >
                <FlowIcon name="close" />
              </button>
            </header>

            <p v-if="memberModalError" class="flow-alert" role="alert">
              {{ memberModalError }}
            </p>

            <div class="member-modal__body">
              <template v-if="form.membership.source === 'import-list'">
                <input
                  ref="fileInput"
                  class="visually-hidden"
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  @change="handleFile"
                />
                <button
                  class="upload-zone"
                  type="button"
                  @click="fileInput?.click()"
                  @dragover.prevent
                  @drop.prevent="handleFileDrop"
                >
                  <span class="upload-zone__icon"><FlowIcon name="upload" /></span>
                  <strong>{{
                    importFile ? 'Choose a different file' : 'Choose a file to upload'
                  }}</strong>
                  <small>Excel, CSV, or PDF · up to 10 MB</small>
                  <span>Browse files</span>
                </button>
                <div v-if="importFile" class="upload-file">
                  <span class="upload-file__icon"><FlowIcon name="check" /></span>
                  <div>
                    <strong>{{ importFile.name }}</strong>
                    <small>{{ importFileSize }} · {{ importMessage }}</small>
                  </div>
                  <b>{{ importProgress }}%</b>
                  <progress :value="importProgress" max="100"></progress>
                </div>
                <p class="privacy-note">
                  <FlowIcon name="check" /> You will review everything before members are added.
                </p>
              </template>

              <div v-else-if="form.membership.source === 'email-phone'" class="modal-fields">
                <label>
                  <span>Email addresses</span>
                  <textarea
                    v-model="form.membership.inviteEmails"
                    placeholder="name@example.com"
                  ></textarea>
                  <small>Separate several addresses with commas.</small>
                </label>
                <label>
                  <span>Phone numbers</span>
                  <textarea
                    v-model="form.membership.invitePhones"
                    placeholder="+234 800 000 0000"
                  ></textarea>
                  <small>Separate several numbers with commas.</small>
                </label>
              </div>

              <div v-else-if="form.membership.source === 'private-link'" class="modal-invite">
                <div class="qr-stage">
                  <img v-if="qrDataUrl" :src="qrDataUrl" alt="Club invitation QR code" />
                  <span class="qr-stage__ball" aria-hidden="true"></span>
                </div>
                <h3>Scan to join</h3>
                <p>Point a phone camera at the QR code, or share the private invitation below.</p>
                <output aria-label="Private invitation link">{{ inviteLink }}</output>
                <div class="share-actions" aria-label="Invitation actions">
                  <button class="share-action" type="button" @click="copyInviteLink">
                    <span class="share-action__icon"><FlowIcon name="copy" /></span>
                    <small>Copy link</small>
                  </button>
                  <button class="share-action" type="button" @click="shareInviteLink">
                    <span class="share-action__icon"><FlowIcon name="share" /></span>
                    <small>Share</small>
                  </button>
                  <button class="share-action" type="button" @click="downloadQrCode">
                    <span class="share-action__icon"><FlowIcon name="download" /></span>
                    <small>Download QR</small>
                  </button>
                </div>
                <p class="invite-privacy">
                  Only people with this invitation can use it to ask to join.
                </p>
              </div>

              <div v-else-if="form.membership.source === 'manual'" class="modal-fields">
                <label>
                  <span>Member name</span>
                  <input v-model="manualMember.name" placeholder="Full name" />
                </label>
                <label>
                  <span>Email or phone <small>Optional</small></span>
                  <input
                    v-model="manualMember.contact"
                    placeholder="How should the club contact them?"
                  />
                </label>
                <p class="privacy-note">
                  <FlowIcon name="users" /> You can add more members after the club opens.
                </p>
              </div>

              <div v-else class="later-note">
                <span><FlowIcon name="calendar" /></span>
                <div>
                  <strong>That is completely fine.</strong>
                  <p>Your club can open now. Add members whenever you are ready.</p>
                </div>
              </div>
            </div>

            <footer v-if="form.membership.source !== 'private-link'" class="member-modal__actions">
              <button type="button" @click="closeMemberModal">Cancel</button>
              <button class="primary" type="button" @click="confirmMemberModal">
                {{ memberModalAction }}
              </button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
<style scoped>
.admin-onboarding {
  position: relative;
  width: 100%;
  min-height: 100svh;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 34px) clamp(20px, 3.5vw, 40px) 44px;
  color: var(--color-text, #172319);
  background:
    radial-gradient(circle at 8% 10%, rgba(214, 238, 99, 0.1), transparent 28rem),
    linear-gradient(145deg, #f8faf7 0%, #fff 48%, #f5f8f5 100%);
  font-family: inherit;
}
.flow-atmosphere {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.flow-atmosphere__court {
  position: absolute;
  right: -13vw;
  top: -18vh;
  width: 48vw;
  height: 82vh;
  border: 1px solid rgba(26, 105, 52, 0.06);
  transform: rotate(-11deg);
}
.flow-atmosphere__court::before,
.flow-atmosphere__court::after {
  position: absolute;
  background: rgba(26, 105, 52, 0.05);
  content: '';
}
.flow-atmosphere__court::before {
  top: 50%;
  right: 0;
  left: 0;
  height: 1px;
}
.flow-atmosphere__court::after {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}
.flow-atmosphere__ball {
  position: absolute;
  right: 7vw;
  top: 17vh;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d9ee68;
  box-shadow: 0 8px 22px rgba(74, 106, 20, 0.24);
  animation: setup-ball-float 5.5s ease-in-out infinite;
}
.flow-atmosphere__glow {
  position: absolute;
  left: -12rem;
  bottom: -12rem;
  width: 34rem;
  height: 34rem;
  border-radius: 50%;
  background: rgba(35, 136, 70, 0.035);
  filter: blur(2px);
}
.flow-header,
progress {
  width: min(100%, var(--flow-content-width));
  margin-inline: auto;
}
.flow-screen {
  width: min(100%, var(--flow-content-width));
  margin-inline: auto;
}
.flow-header {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 52px;
  gap: 12px;
  padding-bottom: 14px;
  color: #657066;
  font-size: 0.78rem;
  font-weight: var(--font-weight-medium, 500);
  letter-spacing: 0.02em;
  position: relative;
}
.flow-header strong {
  color: var(--color-text-soft, #425044);
  font-size: 0.9rem;
  font-weight: var(--font-weight-semibold, 600);
}
.flow-header > span {
  opacity: 0.78;
}
.flow-back {
  display: grid;
  width: 44px;
  min-height: 44px;
  padding: 0;
  place-items: center;
  border: var(--app-hairline);
  border-radius: var(--app-inner-radius, 12px);
  background: var(--color-surface, #fff);
  box-shadow: var(--flow-shadow-quiet);
  color: var(--color-text-soft, #425044);
}
.flow-back svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
progress {
  display: block;
  height: 3px;
  margin-bottom: 0;
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
  transition: width 420ms var(--motion-curve);
}
progress::-moz-progress-bar {
  background: #287a45;
}
.flow-screen {
  display: grid;
  gap: 0;
  padding-top: clamp(30px, 7vw, 58px);
}
.step-panel {
  min-width: 0;
}
.flow-intro h1:focus {
  outline: none;
}
.setup-step-enter-active,
.setup-step-leave-active {
  transition:
    opacity 190ms ease,
    transform 240ms var(--motion-curve);
}
.setup-step-enter-from {
  opacity: 0;
  transform: translateY(11px);
}
.setup-step-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.flow-intro {
  display: grid;
  max-width: 760px;
  gap: 7px;
}
.flow-answer {
  width: 100%;
  margin-top: var(--flow-section-space);
}
.answer-field {
  display: grid;
  gap: var(--flow-control-space);
  color: var(--color-text-soft, #425044);
  font-size: 12.5px;
  font-weight: var(--font-weight-medium, 500);
}
.eyebrow {
  margin: 0;
  color: #647067;
  font-size: 10px;
  font-weight: var(--font-weight-semibold, 600);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  max-width: 760px;
  margin: 0;
  font-size: clamp(22px, 5vw, 30px);
  font-weight: var(--font-weight-bold, 700);
  line-height: 1.2;
  letter-spacing: -0.025em;
}
.lead {
  max-width: 68ch;
  margin: 0;
  color: #5e6860;
  font-size: 13px;
  font-weight: var(--font-weight-regular, 400);
  line-height: 1.65;
}
.flow-alert {
  margin: 18px 0 0;
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
  border: var(--app-hairline);
  border-radius: 14px;
  color: inherit;
  background: #fff;
  font: inherit;
  font-size: 1.05rem;
  font-weight: var(--font-weight-regular, 400);
  box-shadow: inset 0 1px 0 rgba(15, 34, 24, 0.015);
}
input::placeholder,
textarea::placeholder {
  color: var(--color-muted, #6d7a70);
  opacity: 0.62;
}
textarea {
  min-height: 130px;
  resize: vertical;
}
input:focus,
textarea:focus,
button:focus-visible {
  outline: 2px solid rgba(40, 122, 69, 0.14);
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
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 90px;
  column-gap: 15px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius, 16px);
  box-shadow: var(--flow-shadow-quiet);
  color: var(--color-text-soft, #425044);
  text-align: left;
  transition:
    transform 180ms var(--motion-curve),
    box-shadow 180ms var(--motion-curve),
    border-color 180ms ease,
    background 180ms ease;
}
.choices > button:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-primary, #287a45) 24%, var(--color-border));
  box-shadow: var(--flow-shadow-hover);
}
.choices > button.selected {
  border-color: color-mix(in srgb, var(--color-primary, #287a45) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary, #287a45) 2.5%, #fff);
  box-shadow: var(--flow-shadow-quiet);
}
.choices > button.selected .choice-icon {
  animation: selected-icon-settle 320ms var(--motion-spring);
}
.choices > button.selected b {
  animation: check-pop 260ms var(--motion-spring);
}
.choices > button:active {
  transform: translateY(0) scale(0.985);
}
.choice-icon {
  display: grid !important;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 13px;
  background: var(--color-surface-soft, #f4f7f5);
  color: var(--color-primary-strong, #287a45);
}
.choice-icon .flow-icon {
  width: 22px;
  height: 22px;
}
.choices span {
  display: grid;
  gap: 5px;
}
.choices strong,
.choices em {
  font-style: normal;
  font-size: 14.5px;
  font-weight: var(--font-weight-semibold, 600);
  letter-spacing: -0.008em;
  line-height: 1.35;
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
  font-size: 12px;
  font-weight: var(--font-weight-regular, 400);
  line-height: 1.55;
}
.choices b {
  color: #287a45;
  font-size: 18px;
  font-weight: var(--font-weight-semibold, 600);
  opacity: 0.68;
}
.location-answer {
  display: grid;
}
.location-label {
  margin-bottom: var(--flow-control-space);
  color: var(--color-text-soft, #425044);
  font-size: 12.5px;
  font-weight: var(--font-weight-medium, 500);
}
.location-action {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
}
.location-action .flow-icon,
.location-confirmation .flow-icon,
.privacy-note .flow-icon {
  width: 17px;
  height: 17px;
}
.location-confirmation {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
  color: #59635b;
  font-size: 12.5px;
  font-weight: var(--font-weight-regular, 400);
}
.group {
  display: grid;
  gap: 16px;
  padding-block: 8px 28px;
}
.group .choices {
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  border: var(--app-hairline);
  border-radius: 16px;
  background: #fff;
  color: #59635b;
  font-weight: var(--font-weight-regular, 400);
  box-shadow: var(--flow-shadow-quiet);
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
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: var(--flow-section-space);
  padding-top: 20px;
  border-top: 1px solid #dfe4df;
}
.save-state {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #7a857c;
  font-size: 10.5px;
  font-weight: 400;
}
.save-state span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #62a778;
  box-shadow: 0 0 0 4px rgba(50, 135, 78, 0.08);
}
.button-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.38);
  border-top-color: #fff;
  border-radius: 50%;
  animation: button-spin 700ms linear infinite;
}
.actions .primary .flow-icon {
  width: 17px;
  height: 17px;
}
.actions .primary:disabled {
  cursor: not-allowed;
  opacity: 0.46;
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
.member-modal-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(10, 18, 12, 0.38);
  backdrop-filter: blur(8px);
}
.member-modal {
  width: min(100%, 720px);
  max-height: min(88svh, 820px);
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 32px 90px rgba(8, 23, 13, 0.2);
  transform-origin: 50% 120%;
}
.member-modal__header {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 11px;
  padding: 28px 70px 22px;
  border-bottom: var(--app-hairline);
  text-align: center;
}
.member-modal__icon {
  position: relative;
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(145deg, #082d1a 0%, #176a3a 100%);
  box-shadow: 0 10px 24px rgba(8, 56, 29, 0.13);
  color: #fff;
}
.member-modal__icon::after {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 9px;
  height: 9px;
  border: 2px solid rgba(8, 45, 26, 0.16);
  border-radius: 50%;
  background: #d7ee64;
  box-shadow: 0 3px 8px rgba(67, 91, 18, 0.2);
  content: '';
}
.member-modal__icon .flow-icon {
  width: 23px;
  height: 23px;
}
.member-modal__eyebrow {
  margin: 0 0 5px !important;
  color: var(--color-primary-strong, #287a45);
  font-size: 10px;
  font-weight: var(--font-weight-semibold, 600);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.82;
}
.member-modal__header h2 {
  margin: 0;
  color: var(--color-text-soft, #425044);
  font-size: 20px;
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: -0.02em;
  line-height: 1.25;
}
.member-modal__header p:last-child {
  margin: 5px 0 0;
  color: var(--color-muted, #687269);
  font-size: 12.5px;
  font-weight: var(--font-weight-regular, 400);
  line-height: 1.55;
}
.member-modal__close {
  position: absolute;
  top: 22px;
  right: 22px;
  display: grid;
  width: 44px;
  min-height: 44px;
  padding: 0;
  place-items: center;
  border: var(--app-hairline);
  border-radius: 12px;
  background: #fff;
  color: var(--color-muted, #687269);
}
.member-modal__close .flow-icon {
  width: 19px;
  height: 19px;
}
.member-modal > .flow-alert {
  margin: 18px 24px 0;
}
.member-modal__body {
  padding: 24px;
}
.upload-zone {
  display: grid;
  width: 100%;
  min-height: 238px;
  align-content: center;
  justify-items: center;
  gap: 7px;
  padding: 28px;
  border: 1px dashed color-mix(in srgb, var(--color-primary, #287a45) 30%, #cdd5cd);
  border-radius: var(--app-card-radius, 16px);
  background: color-mix(in srgb, var(--color-primary, #287a45) 1.8%, #fff);
  text-align: center;
}
.upload-zone:hover {
  border-color: color-mix(in srgb, var(--color-primary, #287a45) 45%, #cdd5cd);
  background: color-mix(in srgb, var(--color-primary, #287a45) 3%, #fff);
}
.upload-zone__icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 6px;
  place-items: center;
  border-radius: 15px;
  background: #eef6f0;
  color: var(--color-primary-strong, #287a45);
}
.upload-zone__icon .flow-icon {
  width: 25px;
  height: 25px;
}
.upload-zone strong {
  font-size: 15px;
  font-weight: var(--font-weight-semibold, 600);
}
.upload-zone small {
  color: var(--color-muted, #687269);
  font-size: 12px;
  font-weight: var(--font-weight-regular, 400);
}
.upload-zone > span:last-child {
  margin-top: 8px;
  color: var(--color-primary-strong, #287a45);
  font-size: 12.5px;
  font-weight: var(--font-weight-semibold, 600);
}
.upload-file {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 14px;
  border: var(--app-hairline);
  border-radius: 14px;
  background: var(--color-surface-soft, #f4f7f5);
}
.upload-file__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  background: #e6f4e9;
  color: var(--color-primary-strong, #287a45);
}
.upload-file strong,
.upload-file small {
  display: block;
}
.upload-file strong {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: var(--font-weight-semibold, 600);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-file small {
  margin-top: 3px;
  color: var(--color-muted, #687269);
  font-size: 10.5px;
  font-weight: var(--font-weight-regular, 400);
}
.upload-file b {
  color: var(--color-muted, #687269);
  font-size: 11px;
  font-weight: var(--font-weight-medium, 500);
}
.upload-file progress {
  grid-column: 2 / -1;
  height: 3px;
}
.privacy-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
  color: var(--color-muted, #687269);
  font-size: 11.5px;
  font-weight: var(--font-weight-regular, 400);
}
.modal-fields {
  display: grid;
  gap: 18px;
}
.modal-fields label {
  display: grid;
  gap: 8px;
  color: var(--color-text-soft, #425044);
  font-size: 12.5px;
  font-weight: var(--font-weight-semibold, 600);
}
.modal-fields label > span small,
.modal-fields label > small {
  color: var(--color-muted, #687269);
  font-size: 10.5px;
  font-weight: var(--font-weight-regular, 400);
}
.modal-invite {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 2px 18px 12px;
  text-align: center;
}
.qr-stage {
  position: relative;
  width: 220px;
  margin-bottom: 4px;
  padding: 13px;
  border: var(--app-hairline);
  border-radius: 18px;
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
}
.qr-stage img {
  display: block;
  width: 100%;
  border-radius: 10px;
}
.qr-stage__ball {
  position: absolute;
  right: -6px;
  bottom: 24px;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #d7ee64;
  box-shadow: 0 5px 12px rgba(54, 81, 14, 0.2);
}
.modal-invite h3 {
  margin: 0;
  color: var(--color-text, #172319);
  font-size: 18px;
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: -0.02em;
}
.modal-invite p {
  max-width: 48ch;
  margin: 0;
  color: var(--color-muted, #687269);
  font-size: 12.5px;
  font-weight: var(--font-weight-regular, 400);
  line-height: 1.55;
}
.modal-invite output {
  display: block;
  width: min(100%, 500px);
  margin-top: 4px;
  padding: 12px;
  overflow-wrap: anywhere;
  border: var(--app-hairline);
  border-radius: 11px;
  background: var(--color-surface-soft, #f4f7f5);
  color: var(--color-text-soft, #425044);
  font-size: 10.5px;
}
.share-actions {
  display: grid;
  grid-template-columns: repeat(3, 88px);
  justify-content: center;
  gap: clamp(14px, 4vw, 30px);
  margin-top: 14px;
}
.share-action {
  display: grid;
  min-height: auto;
  justify-items: center;
  gap: 9px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.share-action:hover {
  transform: translateY(-1px);
}
.share-action__icon {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #082d1a 0%, #176a3a 100%);
  box-shadow: 0 10px 24px rgba(8, 56, 29, 0.13);
  color: #fff;
  transition:
    transform 180ms var(--motion-curve),
    box-shadow 180ms ease;
}
.share-action:hover .share-action__icon {
  transform: rotate(-3deg) scale(1.025);
  box-shadow: 0 13px 28px rgba(8, 56, 29, 0.16);
}
.share-action__icon .flow-icon {
  width: 21px;
  height: 21px;
}
.share-action small {
  color: var(--color-text-soft, #425044);
  font-size: 11px;
  font-weight: var(--font-weight-medium, 500);
  line-height: 1.35;
  text-align: center;
}
.modal-invite .invite-privacy {
  margin-top: 8px;
  color: var(--color-muted, #687269);
  font-size: 10.5px;
  opacity: 0.78;
}
.later-note {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  min-height: 132px;
  padding: 22px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius, 16px);
  background: var(--color-surface-soft, #f4f7f5);
}
.later-note > span {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: #fff;
  color: var(--color-primary-strong, #287a45);
}
.later-note strong {
  font-size: 14px;
  font-weight: var(--font-weight-semibold, 600);
}
.later-note p {
  margin: 5px 0 0;
  color: var(--color-muted, #687269);
  font-size: 12px;
  font-weight: var(--font-weight-regular, 400);
}
.member-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 18px 24px 22px;
  border-top: var(--app-hairline);
  background: rgba(250, 251, 249, 0.82);
}
.member-modal__actions .primary {
  min-width: 150px;
  border-color: #287a45;
  color: #fff;
  background: #287a45;
}
.member-modal-enter-active,
.member-modal-leave-active {
  transition: opacity 220ms ease;
}
.member-modal-enter-active .member-modal {
  animation: tennis-swing-in 460ms var(--motion-curve) both;
}
.member-modal-enter-active .member-modal__icon {
  animation: racket-icon-settle 520ms 70ms var(--motion-curve) both;
}
.member-modal-enter-active .member-modal__icon::after {
  animation: tennis-ball-arc 560ms 90ms var(--motion-curve) both;
}
.member-modal-enter-active .member-modal__body > * {
  animation: modal-content-rise 300ms 130ms var(--motion-curve) both;
}
.member-modal-leave-active .member-modal {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}
.member-modal-enter-from,
.member-modal-leave-to {
  opacity: 0;
}
.member-modal-leave-to .member-modal {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
}
@keyframes tennis-swing-in {
  0% {
    opacity: 0;
    transform: translateY(18px) rotate(-1.35deg) scale(0.982);
  }
  56% {
    opacity: 1;
    transform: translateY(-3px) rotate(0.32deg) scale(1.002);
  }
  78% {
    transform: translateY(1px) rotate(-0.1deg) scale(1);
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotate(0) scale(1);
  }
}
@keyframes racket-icon-settle {
  0% {
    opacity: 0;
    transform: rotate(-13deg) scale(0.9);
  }
  62% {
    opacity: 1;
    transform: rotate(3deg) scale(1.025);
  }
  100% {
    opacity: 1;
    transform: rotate(0) scale(1);
  }
}
@keyframes tennis-ball-arc {
  0% {
    opacity: 0;
    transform: translate(-20px, 15px) scale(0.55);
  }
  58% {
    opacity: 1;
    transform: translate(3px, -3px) scale(1.08);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}
@keyframes modal-content-rise {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
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
@keyframes setup-ball-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(-28px, 38px, 0);
  }
}
@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes selected-icon-settle {
  0% {
    transform: scale(0.88) rotate(-5deg);
  }
  70% {
    transform: scale(1.05) rotate(1deg);
  }
  100% {
    transform: none;
  }
}
@keyframes check-pop {
  from {
    opacity: 0;
    transform: scale(0.55);
  }
  to {
    opacity: 0.68;
    transform: scale(1);
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
  .group .choices,
  .detail.two {
    grid-template-columns: 1fr;
  }
  .detail.invite {
    grid-template-columns: 1fr;
  }
  .invite img {
    width: 132px;
  }
  .member-modal-backdrop {
    align-items: end;
    padding: 12px;
  }
  .member-modal {
    width: 100%;
    max-height: 92svh;
    border-radius: 20px 20px 14px 14px;
  }
  .member-modal__header {
    gap: 10px;
    padding: 22px 58px 18px;
  }
  .member-modal__body {
    padding: 18px;
  }
  .qr-stage {
    width: 196px;
  }
  .member-modal__actions {
    position: sticky;
    bottom: 0;
    padding: 14px 18px 18px;
  }
  .member-modal-leave-to .member-modal {
    transform: translateY(28px);
  }
}
@media (max-width: 480px) {
  h1 {
    font-size: 24px;
  }
  .choices > button {
    min-height: 84px;
    padding: 15px;
  }
  .actions {
    position: sticky;
    bottom: 0;
    padding: 14px 0;
    background: var(--color-bg, #fff);
  }
  .save-state {
    display: none;
  }
  .actions button {
    min-width: 0;
    flex: 1;
  }
  .member-modal__actions button {
    min-width: 0;
    flex: 1;
  }
  .modal-invite {
    padding-inline: 0;
  }
  .share-actions {
    grid-template-columns: repeat(3, 76px);
    gap: 8px;
  }
  .share-action__icon {
    width: 52px;
    height: 52px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .flow-atmosphere__ball,
  .button-spinner,
  .choices > button.selected .choice-icon,
  *,
  *::after {
    scroll-behavior: auto !important;
    animation: none !important;
    transition: none !important;
  }
}
</style>
