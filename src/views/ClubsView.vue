<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRoute, useRouter } from 'vue-router'
import {
  ADMIN_SETUP_STEPS,
  LADDER_TEMPLATES,
  PLACEMENT_METHODS,
  TIMEZONE_OPTIONS,
  createDefaultClubSetup,
} from '../config/admin'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import {
  createPrivateInvitationToken,
  normalizeClubSetup,
  validateClubSetupStep,
} from '../utils/admin/clubSetup'
import { validateRosterImport } from '../utils/onboarding/rosterImport'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const ONBOARDING_STEPS = Object.freeze([
  { key: 'workspace', label: 'Club basics' },
  { key: 'members', label: 'Add members' },
  { key: 'ladders', label: 'Starting ladder' },
])

const form = reactive(createDefaultClubSetup())
const pageError = ref('')
const pageMessage = ref('')
const heading = ref(null)
const inviteCode = ref('')
const pendingInvite = ref(null)
const courtsText = ref('')
const administratorsText = ref('')
const rankingOrderText = ref('')
const memberDetail = ref('')
const importFileName = ref('')
const importFileInput = ref(null)
const qrDataUrl = ref('')
const addLadderOpen = ref(false)
const rulesEditing = ref(false)
const rulesAccepted = ref(true)
const customLadder = reactive({ name: '', matchType: 'singles' })
const manualMember = reactive({ name: '', contact: '', role: 'player' })

const FLOW_VIEWS = new Set(['start', 'join', 'join-confirm'])
const STEP_COPY = Object.freeze({
  workspace: {
    eyebrow: 'Step 1 of 3',
    title: 'What is your club called?',
    lead: 'We filled in an example. Change it if you need to.',
  },
  members: {
    eyebrow: 'Step 2 of 3',
    title: 'How do you want to add members?',
    lead: 'Pick the easiest option. You can add more people later.',
  },
  ladders: {
    eyebrow: 'Step 3 of 3',
    title: 'Which ladder do you want to start with?',
    lead: 'Open Singles is ready. You can add or change ladders in Settings.',
  },
})

const MEMBER_METHODS = Object.freeze([
  {
    id: 'private-link',
    icon: 'copy',
    title: 'Share a link or QR code',
    description: 'Send one private invite to your members.',
  },
  {
    id: 'import-list',
    icon: 'upload',
    title: 'Import a list',
    description: 'Use a CSV, Excel, or PDF member list.',
  },
  {
    id: 'email-phone',
    icon: 'send',
    title: 'Invite by email or phone',
    description: 'Add the people you want to invite.',
  },
  {
    id: 'manual',
    icon: 'users',
    title: 'Add one at a time',
    description: 'Enter a member now. You can add more later.',
  },
])

const RECOMMENDED_RULES = Object.freeze([
  'Challenge up to 3 places above you',
  'One active challenge for each player',
  '48 hours to answer a challenge',
  '7 days to finish the match',
  'Swap places when the challenger wins',
  '7 days before the same two players meet again',
  'Two tie-break sets, then a 10-point match tie-break',
  'Use advantage scoring',
  'Both players confirm the result; an admin helps if they disagree',
])

const routeView = computed(() => {
  const value = String(route.query.view || '')
  if (FLOW_VIEWS.has(value)) return value
  return ONBOARDING_STEPS.some((item) => item.key === route.query.step) ? 'wizard' : 'start'
})
const stepIndex = computed(() => {
  const index = ONBOARDING_STEPS.findIndex((item) => item.key === route.query.step)
  return index >= 0 ? index : 0
})
const activeStep = computed(() => ONBOARDING_STEPS[stepIndex.value])
const stepCopy = computed(() => STEP_COPY[activeStep.value?.key] || STEP_COPY.workspace)
const progress = computed(() => ((stepIndex.value + 1) / ONBOARDING_STEPS.length) * 100)
const activeLadders = computed(() => form.ladders.filter((ladder) => ladder.enabled))
const availableLadderTemplates = computed(() =>
  LADDER_TEMPLATES.filter(
    (template) => !form.ladders.some((ladder) => ladder.id === template.id && ladder.enabled),
  ),
)
const hasMultipleClubs = computed(() => adminStore.hasMultipleClubs)
const currentClubId = computed({
  get: () => adminStore.activeClubId || '',
  set: () => {},
})
const inviteLink = computed(() => {
  const token = form.membership.invitationToken
  const slug = form.workspace.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  if (!token) return ''
  return `${window.location.origin}${window.location.pathname}#/signup?club=${slug || 'your-club'}&invite=${encodeURIComponent(token)}`
})
const canContinue = computed(() => {
  if (adminStore.isSaving || adminStore.isLoading) return false
  if (routeView.value === 'join') return inviteCode.value.trim().length >= 4
  if (routeView.value !== 'wizard') return true
  if (activeStep.value.key === 'workspace') {
    return form.workspace.name.trim().length >= 2 && form.workspace.location.trim().length >= 2
  }
  if (activeStep.value.key === 'members') return Boolean(memberDetail.value)
  if (activeStep.value.key === 'ladders') return activeLadders.value.length > 0
  return true
})
const canSkipStep = computed(
  () => routeView.value === 'wizard' && activeStep.value?.key !== 'workspace',
)
const showActionFooter = computed(() => routeView.value !== 'start' && canContinue.value)
const primaryLabel = computed(() => {
  if (adminStore.isSaving) return 'Saving…'
  if (routeView.value === 'join') return 'Check invite code'
  if (routeView.value === 'join-confirm') return 'Join this club'
  if (routeView.value === 'wizard' && stepIndex.value === ONBOARDING_STEPS.length - 1) {
    return 'Open my club'
  }
  return 'Save and continue'
})

function replaceForm(value) {
  const normalized = normalizeClubSetup(value)
  Object.keys(form).forEach((key) => delete form[key])
  Object.assign(form, normalized)
  courtsText.value = form.workspace.courts.join(', ')
  administratorsText.value = form.workspace.administratorIds.join(', ')
  rankingOrderText.value = form.placement.rankingOrder.join('\n')
  if (!Array.isArray(form.membership.manualMembers)) form.membership.manualMembers = []
  memberDetail.value = MEMBER_METHODS.some((method) => method.id === form.membership.source)
    ? form.membership.source
    : 'private-link'
}

function applyQuickDefaults() {
  const year = new Date().getFullYear()
  form.workspace.name ||= 'Greenview Tennis Club'
  form.workspace.location ||= 'Ibadan, Oyo State'
  form.workspace.courts = form.workspace.courts.length
    ? form.workspace.courts
    : ['Court 1', 'Court 2']
  form.workspace.seasonStart ||= `${year}-01-01`
  form.workspace.seasonEnd ||= `${year}-12-31`
  form.membership.source ||= 'private-link'
  form.membership.inviteEmails ||= 'member@greenview.club'
  courtsText.value = form.workspace.courts.join(', ')
}

function syncTextFields() {
  form.workspace.courts = courtsText.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  form.workspace.administratorIds = administratorsText.value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  form.placement.rankingOrder = rankingOrderText.value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function setQuery(query) {
  pageError.value = ''
  pageMessage.value = ''
  router.replace({ path: route.path, query })
}

async function focusHeading() {
  await nextTick()
  heading.value?.focus()
}

async function showStart() {
  pendingInvite.value = null
  inviteCode.value = ''
  setQuery({ view: 'start' })
}

function showJoin() {
  pendingInvite.value = null
  setQuery({ view: 'join' })
}

async function startCreate() {
  try {
    await adminStore.startFreshSetup()
    replaceForm(adminStore.setup)
    if (!form.membership.invitationToken) {
      form.membership.invitationToken = createPrivateInvitationToken()
    }
    applyQuickDefaults()
    setQuery({ step: ONBOARDING_STEPS[0].key })
  } catch (error) {
    pageError.value = error?.message || 'We could not start the club setup.'
  }
}

async function previewJoin() {
  pageError.value = ''
  try {
    pendingInvite.value = await adminStore.previewInvite(inviteCode.value)
    setQuery({ view: 'join-confirm' })
  } catch (error) {
    pageError.value = error?.message || 'We could not find that invite code.'
  }
}

async function confirmJoin() {
  pageError.value = ''
  try {
    const joined = await adminStore.joinClub(inviteCode.value)
    notificationStore.addToast({
      message: `You joined ${joined.clubName || pendingInvite.value?.clubName}.`,
      type: 'success',
    })
    await router.push({ name: 'Dashboard' })
  } catch (error) {
    pageError.value = error?.message || 'We could not join this club.'
  }
}

async function switchClub(event) {
  const clubId = event.target.value
  if (!clubId || clubId === adminStore.activeClubId) return
  try {
    await adminStore.switchClub(clubId)
    notificationStore.addToast({
      message: `${adminStore.activeClub?.name || 'Your club'} is now open.`,
      type: 'success',
    })
    await router.push({ name: 'Dashboard' })
  } catch (error) {
    pageError.value = error?.message || 'We could not switch clubs.'
  }
}

function chooseMemberMethod(method) {
  form.membership.source = method
  memberDetail.value = method
  pageError.value = ''
}

function chooseImportFile(event) {
  const file = event.target.files?.[0]
  const result = validateRosterImport(file)
  if (!result.valid) {
    pageError.value = result.message
    importFileName.value = ''
    return
  }
  pageError.value = ''
  importFileName.value = file.name
  form.membership.source = 'import-list'
  form.membership.importFileName = file.name
}

function addManualMember() {
  if (manualMember.name.trim().length < 2) {
    pageError.value = 'Enter the member name.'
    return
  }
  form.membership.manualMembers.push({
    id: `member-${Date.now().toString(36)}`,
    name: manualMember.name.trim(),
    contact: manualMember.contact.trim(),
    role: manualMember.role,
  })
  Object.assign(manualMember, { name: '', contact: '', role: 'player' })
  pageMessage.value = 'Member added to this setup.'
  pageError.value = ''
}

function addLadder(template) {
  const existing = form.ladders.find((ladder) => ladder.id === template.id)
  if (existing) existing.enabled = true
  else form.ladders.push({ ...template, enabled: true })
  form.primaryLadderId ||= template.id
  addLadderOpen.value = false
}

function addCustomLadder() {
  const name = customLadder.name.trim()
  if (name.length < 2) {
    pageError.value = 'Enter a name for the ladder.'
    return
  }
  const id = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`
  form.ladders.push({ id, name, matchType: customLadder.matchType, enabled: true })
  form.primaryLadderId ||= id
  Object.assign(customLadder, { name: '', matchType: 'singles' })
  addLadderOpen.value = false
  pageError.value = ''
}

function archiveLadder(ladder) {
  if (activeLadders.value.length === 1) {
    pageError.value = 'Keep at least one ladder.'
    return
  }
  ladder.enabled = false
  if (form.primaryLadderId === ladder.id) form.primaryLadderId = activeLadders.value[0]?.id || ''
}

function applyRecommendedRules() {
  const defaults = createDefaultClubSetup().rules
  Object.assign(form.rules, defaults)
  rulesAccepted.value = true
  rulesEditing.value = false
  pageMessage.value = 'Recommended rules are ready.'
  pageError.value = ''
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    notificationStore.addToast({ message: 'Invite link copied.', type: 'success' })
  } catch {
    pageError.value = 'Select the invite link and copy it.'
  }
}

async function generateQrCode() {
  if (!inviteLink.value) {
    qrDataUrl.value = ''
    return
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(inviteLink.value, {
      width: 176,
      margin: 2,
      color: { dark: '#172319', light: '#ffffff' },
    })
  } catch {
    qrDataUrl.value = ''
  }
}

async function saveStep() {
  syncTextFields()
  const stepNumber = stepIndex.value + 1
  const validation = validateClubSetupStep(form, stepNumber)
  if (!validation.valid) {
    pageError.value = validation.errors[0]
    return false
  }
  form.completedStep = Math.max(form.completedStep, stepNumber)
  await adminStore.saveDraft(form)
  replaceForm(adminStore.setup)
  pageMessage.value = 'Saved on this device.'
  return true
}

async function continueFlow() {
  if (!canContinue.value) {
    pageError.value = 'Finish this step before you continue.'
    return
  }
  if (routeView.value === 'join') return previewJoin()
  if (routeView.value === 'join-confirm') return confirmJoin()
  if (routeView.value !== 'wizard') return

  try {
    const saved = await saveStep()
    if (!saved) return
    if (stepIndex.value === ONBOARDING_STEPS.length - 1) {
      form.completedStep = ADMIN_SETUP_STEPS.length
      await adminStore.publishSetup(form)
      notificationStore.addToast({
        message: `${form.workspace.name} is ready.`,
        type: 'success',
      })
      await router.push({ name: 'Dashboard' })
      return
    }
    setQuery({ step: ONBOARDING_STEPS[stepIndex.value + 1].key })
  } catch (error) {
    pageError.value = error?.message || 'We could not save this step.'
  }
}

function goBack() {
  pageError.value = ''
  if (routeView.value === 'start') {
    router.push(adminStore.isConfigured ? { name: 'Dashboard' } : { name: 'SignUp' })
    return
  }
  if (routeView.value === 'join') return showStart()
  if (routeView.value === 'join-confirm') return showJoin()
  if (stepIndex.value === 0) {
    setQuery({ view: 'start' })
    return
  }
  setQuery({ step: ONBOARDING_STEPS[stepIndex.value - 1].key })
}

watch(() => route.fullPath, focusHeading)

async function skipStep() {
  if (!canSkipStep.value) return
  if (activeStep.value.key === 'members') form.membership.source = 'later'
  await continueFlow()
}
watch(inviteLink, generateQrCode)

onMounted(async () => {
  try {
    await adminStore.loadClubs()
    await adminStore.loadSetup()
    replaceForm(adminStore.setup)
    if (!form.membership.invitationToken) {
      form.membership.invitationToken = createPrivateInvitationToken()
    }
    if (routeView.value === 'wizard') applyQuickDefaults()
    if (route.query.invite) {
      inviteCode.value = String(route.query.invite).slice(0, 128)
      await previewJoin()
    }
    await generateQrCode()
    await focusHeading()
  } catch (error) {
    pageError.value = error?.message || 'We could not load your clubs.'
  }
})
</script>

<template>
  <main class="clubs-flow">
    <div class="flow-atmosphere" aria-hidden="true">
      <span class="flow-atmosphere__court"></span>
      <span class="flow-atmosphere__ball"></span>
    </div>

    <header class="flow-header">
      <button class="flow-back" type="button" aria-label="Go back" @click="goBack">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <strong>{{ routeView === 'wizard' ? activeStep.label : 'Clubs' }}</strong>
      <span v-if="routeView === 'wizard'">{{ stepIndex + 1 }} of 3</span>
    </header>

    <progress
      v-if="routeView === 'wizard'"
      :value="progress"
      max="100"
      :aria-label="`Step ${stepIndex + 1} of 3`"
    ></progress>

    <section v-if="routeView === 'start'" class="flow-screen start-screen">
      <label v-if="hasMultipleClubs" class="club-switcher">
        <span>Open a club</span>
        <select :value="currentClubId" @change="switchClub">
          <option v-for="club in adminStore.clubOptions" :key="club.id" :value="club.id">
            {{ club.name }}
          </option>
        </select>
      </label>

      <div class="flow-intro">
        <p class="eyebrow">Clubs</p>
        <h1 ref="heading" tabindex="-1">What would you like to do?</h1>
      </div>
      <p v-if="pageError" class="flow-alert" role="alert">{{ pageError }}</p>
      <div class="flow-answer choices two start-choices">
        <button type="button" @click="startCreate">
          <span class="choice-icon"><FlowIcon name="plus" /></span>
          <span><strong>Create a new club</strong><small>Set up a club you run.</small></span>
          <FlowIcon name="arrow-right" />
        </button>
        <button type="button" @click="showJoin">
          <span class="choice-icon"><FlowIcon name="login" /></span>
          <span
            ><strong>Join an existing club</strong
            ><small>Got an invite code? Use it here.</small></span
          >
          <FlowIcon name="arrow-right" />
        </button>
      </div>
    </section>

    <form
      v-else
      class="flow-screen"
      :aria-busy="adminStore.isSaving || adminStore.isLoading"
      @submit.prevent="continueFlow"
    >
      <Transition name="setup-step" mode="out-in">
        <section :key="`${routeView}-${activeStep?.key || ''}`" class="step-panel">
          <template v-if="routeView === 'join'">
            <div class="flow-intro">
              <p class="eyebrow">Join a club</p>
              <h1 ref="heading" tabindex="-1">Enter your invite code.</h1>
              <p class="lead">Paste the code your club sent you.</p>
            </div>
            <div class="flow-answer">
              <label class="answer-field">
                <span>Invite code</span>
                <input
                  v-model="inviteCode"
                  autocomplete="one-time-code"
                  maxlength="128"
                  placeholder="For example: GREENVIEW-ADMIN"
                  autofocus
                  @input="pageError = ''"
                />
              </label>
            </div>
          </template>

          <template v-else-if="routeView === 'join-confirm'">
            <div class="flow-intro">
              <p class="eyebrow">Check this club</p>
              <h1 ref="heading" tabindex="-1">You’re joining {{ pendingInvite?.clubName }}.</h1>
              <p class="lead">Your role will be {{ pendingInvite?.roleLabel }}.</p>
            </div>
            <div class="flow-answer confirmation-card">
              <span class="choice-icon"><FlowIcon name="home" /></span>
              <div>
                <strong>{{ pendingInvite?.clubName }}</strong>
                <small>{{
                  pendingInvite?.location || 'Your club will share its details with you.'
                }}</small>
              </div>
              <FlowIcon name="check" />
            </div>
          </template>

          <template v-else-if="routeView === 'intro'">
            <div class="flow-intro intro-screen">
              <p class="eyebrow">Create a club</p>
              <h1 ref="heading" tabindex="-1">Let’s set up the club you run.</h1>
              <p class="lead">
                We’ll ask about your club, members, ladders, and rules. It takes about 3 minutes.
                You can change anything later.
              </p>
            </div>
            <div class="flow-answer heads-up-card" aria-label="What you will set up">
              <span><FlowIcon name="home" /><small>Club</small></span>
              <span><FlowIcon name="users" /><small>Members</small></span>
              <span><FlowIcon name="ladder" /><small>Ladders</small></span>
              <span><FlowIcon name="sliders" /><small>Rules</small></span>
            </div>
          </template>

          <template v-else>
            <div class="flow-intro">
              <p class="eyebrow">{{ stepCopy.eyebrow }}</p>
              <h1 ref="heading" tabindex="-1">{{ stepCopy.title }}</h1>
              <p class="lead">{{ stepCopy.lead }}</p>
            </div>

            <div v-if="activeStep.key === 'workspace'" class="flow-answer form-grid">
              <label class="answer-field field-wide">
                <span>Club name</span>
                <input
                  v-model="form.workspace.name"
                  autocomplete="organization"
                  maxlength="100"
                  placeholder="For example: Greenview Tennis Club"
                />
              </label>
              <label class="answer-field field-wide">
                <span>Town or city</span>
                <input
                  v-model="form.workspace.location"
                  autocomplete="address-level2"
                  maxlength="120"
                  placeholder="Ibadan, Oyo State"
                />
              </label>
            </div>

            <div v-else-if="activeStep.key === 'members'" class="flow-answer members-step">
              <div class="secondary-heading">
                <h2>Choose one way to begin</h2>
                <p>Your choice is ready. You can change it later.</p>
              </div>
              <div class="choices member-methods">
                <button
                  v-for="method in MEMBER_METHODS"
                  :key="method.id"
                  type="button"
                  :class="{ selected: memberDetail === method.id }"
                  :aria-pressed="memberDetail === method.id"
                  @click="chooseMemberMethod(method.id)"
                >
                  <span class="choice-icon"><FlowIcon :name="method.icon" /></span>
                  <span
                    ><strong>{{ method.title }}</strong
                    ><small>{{ method.description }}</small></span
                  >
                  <FlowIcon name="arrow-right" />
                </button>
              </div>

              <section v-if="memberDetail === 'private-link'" class="invite-fast-path">
                <div class="invite-fast-path__copy">
                  <p class="eyebrow">Your private invite</p>
                  <h2>Share one link or QR code</h2>
                  <p>Members can open it and join in their own time.</p>
                  <output>{{ inviteLink }}</output>
                  <button class="primary small-primary" type="button" @click="copyInviteLink">
                    <FlowIcon name="copy" /> Copy invite link
                  </button>
                </div>
                <img v-if="qrDataUrl" :src="qrDataUrl" alt="Club invitation QR code" />
              </section>
              <section v-else-if="memberDetail === 'import-list'" class="detail-panel">
                <input
                  ref="importFileInput"
                  class="visually-hidden"
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  @change="chooseImportFile"
                />
                <button type="button" @click="importFileInput?.click()">
                  <FlowIcon name="upload" /> {{ importFileName || 'Choose a member list' }}
                </button>
                <p>We’ll check the file before anyone is added.</p>
              </section>
              <section v-else-if="memberDetail === 'email-phone'" class="detail-panel form-grid">
                <label class="answer-field">
                  <span>Email addresses</span>
                  <textarea
                    v-model="form.membership.inviteEmails"
                    rows="3"
                    placeholder="one@example.com, two@example.com"
                  ></textarea>
                </label>
                <label class="answer-field">
                  <span>Phone numbers</span>
                  <textarea
                    v-model="form.membership.invitePhones"
                    rows="3"
                    placeholder="+234 800 000 0000"
                  ></textarea>
                </label>
              </section>
              <section v-else-if="memberDetail === 'manual'" class="detail-panel form-grid">
                <label class="answer-field">
                  <span>Member name</span>
                  <input v-model="manualMember.name" maxlength="100" />
                </label>
                <label class="answer-field">
                  <span>Email or phone</span>
                  <input v-model="manualMember.contact" maxlength="160" />
                </label>
                <label class="answer-field">
                  <span>Role</span>
                  <select v-model="manualMember.role">
                    <option value="player">Player</option>
                    <option value="co-admin">Co-admin</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button type="button" @click="addManualMember">
                  <FlowIcon name="plus" /> Add member
                </button>
                <ul v-if="form.membership.manualMembers.length" class="member-preview field-wide">
                  <li v-for="member in form.membership.manualMembers" :key="member.id">
                    <span
                      ><strong>{{ member.name }}</strong
                      ><small>{{ member.contact }}</small></span
                    >
                    <em>{{ member.role }}</em>
                  </li>
                </ul>
              </section>
            </div>

            <div v-else-if="activeStep.key === 'ladders'" class="flow-answer ladder-step">
              <div class="ladder-list">
                <article v-for="ladder in activeLadders" :key="ladder.id">
                  <span class="choice-icon"><FlowIcon name="ladder" /></span>
                  <span
                    ><strong>{{ ladder.name }}</strong
                    ><small>{{
                      ladder.matchType === 'doubles' ? 'Doubles' : 'Singles'
                    }}</small></span
                  >
                  <button type="button" @click="archiveLadder(ladder)">Remove</button>
                </article>
              </div>
              <button class="add-another" type="button" @click="addLadderOpen = !addLadderOpen">
                <FlowIcon name="plus" /> Add another ladder
              </button>
              <section v-if="addLadderOpen" class="detail-panel add-ladder-panel">
                <button
                  v-for="template in availableLadderTemplates"
                  :key="template.id"
                  type="button"
                  @click="addLadder(template)"
                >
                  {{ template.name }}
                </button>
                <div class="custom-ladder">
                  <label class="answer-field">
                    <span>Custom ladder name</span>
                    <input v-model="customLadder.name" maxlength="70" />
                  </label>
                  <label class="answer-field">
                    <span>Match type</span>
                    <select v-model="customLadder.matchType">
                      <option value="singles">Singles</option>
                      <option value="doubles">Doubles</option>
                    </select>
                  </label>
                  <button type="button" @click="addCustomLadder">Add this ladder</button>
                </div>
              </section>
            </div>

            <div v-else-if="activeStep.key === 'placement'" class="flow-answer placement-step">
              <div class="choices placement-methods">
                <button
                  v-for="method in PLACEMENT_METHODS"
                  :key="method.id"
                  type="button"
                  :class="{ selected: form.placement.method === method.id }"
                  :aria-pressed="form.placement.method === method.id"
                  @click="form.placement.method = method.id"
                >
                  <span class="choice-icon"><FlowIcon name="ladder" /></span>
                  <span>
                    <em v-if="method.id === 'bottom-provisional'">Recommended</em>
                    <strong>{{ method.label }}</strong>
                    <small>{{ method.description }}</small>
                  </span>
                  <b>{{ form.placement.method === method.id ? '✓' : '' }}</b>
                </button>
              </div>
              <label
                v-if="['import', 'manual', 'club-level'].includes(form.placement.method)"
                class="answer-field ranking-order"
              >
                <span>Starting order <small>Optional for now</small></span>
                <textarea
                  v-model="rankingOrderText"
                  rows="6"
                  placeholder="Put one player on each line, highest first"
                ></textarea>
              </label>
            </div>

            <div v-else-if="activeStep.key === 'rules'" class="flow-answer rules-step">
              <section class="recommended-rules">
                <div>
                  <p class="eyebrow">Recommended Gorra rules</p>
                  <h2>Ready for adult club play</h2>
                </div>
                <ul>
                  <li v-for="rule in RECOMMENDED_RULES" :key="rule">
                    <FlowIcon name="check" /> {{ rule }}
                  </li>
                </ul>
                <div class="rule-actions">
                  <button
                    class="primary small-primary"
                    type="button"
                    @click="applyRecommendedRules"
                  >
                    <FlowIcon name="check" /> Use recommended rules
                  </button>
                  <button type="button" @click="rulesEditing = !rulesEditing">
                    <FlowIcon name="sliders" /> {{ rulesEditing ? 'Hide changes' : 'Edit rules' }}
                  </button>
                </div>
              </section>

              <section v-if="rulesEditing" class="detail-panel form-grid rule-fields">
                <label class="answer-field">
                  <span>Places a player can challenge above</span>
                  <input
                    v-model.number="form.rules.challengeRangeUp"
                    type="number"
                    min="1"
                    max="20"
                  />
                </label>
                <label class="answer-field">
                  <span>Active challenges for each player</span>
                  <input
                    v-model.number="form.rules.maxActiveChallenges"
                    type="number"
                    min="1"
                    max="5"
                  />
                </label>
                <label class="answer-field">
                  <span>Hours to answer</span>
                  <input
                    v-model.number="form.rules.responseHours"
                    type="number"
                    min="1"
                    max="168"
                  />
                </label>
                <label class="answer-field">
                  <span>Days to finish the match</span>
                  <input
                    v-model.number="form.rules.completionDays"
                    type="number"
                    min="1"
                    max="30"
                  />
                </label>
                <label class="answer-field">
                  <span>Days before a rematch</span>
                  <input
                    v-model.number="form.rules.rematchCooldownDays"
                    type="number"
                    min="0"
                    max="90"
                  />
                </label>
                <label class="answer-field">
                  <span>How positions move</span>
                  <select v-model="form.rules.movementSystem">
                    <option value="position-swap">Players swap positions</option>
                    <option value="leapfrog">Winner takes the challenged position</option>
                  </select>
                </label>
                <label class="answer-field">
                  <span>Match format</span>
                  <select v-model="form.rules.matchPreset">
                    <option value="time-smart">Time-Smart Club Match</option>
                    <option value="standard-club">Standard Club Match</option>
                  </select>
                </label>
                <label class="answer-field">
                  <span>Game scoring</span>
                  <select v-model="form.rules.scoring">
                    <option value="ad">Advantage scoring</option>
                    <option value="noad">No-ad scoring</option>
                  </select>
                </label>
                <label class="answer-field field-wide">
                  <span>Result confirmation</span>
                  <select v-model="form.rules.resultConfirmation">
                    <option value="both-players">
                      Both players confirm; admin helps with disagreements
                    </option>
                  </select>
                </label>
              </section>
            </div>
          </template>

          <p v-if="pageError" class="flow-alert" role="alert">{{ pageError }}</p>
          <p v-if="pageMessage" class="flow-message" role="status">{{ pageMessage }}</p>

          <Transition name="action-footer">
            <footer v-if="showActionFooter" class="actions">
              <p class="save-state"><span></span>{{ pageMessage || 'Ready when you are' }}</p>
              <div class="action-buttons">
                <button
                  v-if="canSkipStep"
                  class="skip-action"
                  type="button"
                  :disabled="adminStore.isSaving"
                  @click="skipStep"
                >
                  Skip for now
                </button>
                <button class="primary" type="submit" :disabled="!canContinue">
                  {{ primaryLabel }} <FlowIcon name="arrow-right" />
                </button>
              </div>
            </footer>
          </Transition>
        </section>
      </Transition>
    </form>
  </main>
</template>

<style scoped>
.clubs-flow {
  --flow-width: 920px;
  position: relative;
  width: 100%;
  min-height: 100svh;
  padding: clamp(18px, 3vw, 34px) clamp(20px, 3.5vw, 40px) 48px;
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 10%, rgba(214, 238, 99, 0.1), transparent 28rem),
    linear-gradient(145deg, #f8faf7 0%, #fff 48%, #f5f8f5 100%);
  color: var(--color-text, #172319);
}
.flow-atmosphere {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.flow-atmosphere__court {
  position: absolute;
  top: -18vh;
  right: -13vw;
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
  top: 17vh;
  right: 7vw;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d9ee68;
  box-shadow: 0 8px 22px rgba(74, 106, 20, 0.24);
  animation: setup-ball-float 5.5s ease-in-out infinite;
}
.flow-header,
.flow-screen,
progress {
  position: relative;
  z-index: 1;
  width: min(100%, var(--flow-width));
  margin-inline: auto;
}
.flow-header {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  color: #657066;
  font-size: 0.78rem;
  font-weight: var(--font-weight-medium, 500);
}
.flow-header strong {
  color: var(--color-text-soft, #425044);
  font-size: 0.9rem;
  font-weight: var(--font-weight-semibold, 600);
}
.flow-back {
  display: grid;
  width: 44px;
  min-height: 44px;
  padding: 0;
  place-items: center;
  border: var(--app-hairline);
  border-radius: var(--app-inner-radius, 12px);
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
  color: #425044;
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
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: #dfe4dd;
}
progress::-webkit-progress-bar {
  background: #dfe4dd;
}
progress::-webkit-progress-value,
progress::-moz-progress-bar {
  background: #287a45;
}
.flow-screen {
  padding-top: clamp(32px, 6vw, 58px);
}
.start-screen {
  padding-top: clamp(48px, 9vw, 100px);
}
.step-panel {
  min-width: 0;
  padding-bottom: 104px;
}
.flow-intro {
  display: grid;
  max-width: 760px;
  gap: 7px;
}
.flow-intro h1:focus {
  outline: none;
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
  font-size: clamp(25px, 5vw, 34px);
  font-weight: var(--font-weight-bold, 700);
  line-height: 1.18;
  letter-spacing: -0.028em;
}
.lead {
  max-width: 68ch;
  margin: 0;
  color: #5e6860;
  font-size: 13px;
  font-weight: var(--font-weight-regular, 400);
  line-height: 1.65;
}
.flow-answer {
  width: 100%;
  margin-top: clamp(24px, 4vw, 36px);
}
.choices {
  display: grid;
  gap: 12px;
}
.choices.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.choices > button,
.confirmation-card,
.ladder-list article {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  min-height: 90px;
  align-items: center;
  gap: 15px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius, 16px);
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
  color: #425044;
  text-align: left;
  transition:
    transform 180ms var(--motion-curve),
    box-shadow 180ms var(--motion-curve),
    border-color 180ms ease,
    background 180ms ease;
}
.choices > button:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #287a45 24%, var(--color-border));
  box-shadow: var(--flow-shadow-hover);
}
.choices > button.selected {
  border-color: color-mix(in srgb, #287a45 34%, var(--color-border));
  background: color-mix(in srgb, #287a45 2.5%, #fff);
}
.choices > button > .flow-icon,
.confirmation-card > .flow-icon {
  width: 18px;
  height: 18px;
  color: #287a45;
}
.choice-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 13px;
  background: #edf5ef;
  color: #287a45;
}
.choice-icon .flow-icon {
  width: 22px;
  height: 22px;
}
.choices span,
.confirmation-card div,
.ladder-list article > span:nth-child(2) {
  display: grid;
  gap: 5px;
}
.choices strong,
.confirmation-card strong,
.ladder-list strong {
  font-size: 14.5px;
  font-weight: var(--font-weight-semibold, 600);
  line-height: 1.35;
}
.choices small,
.confirmation-card small,
.ladder-list small {
  color: #687269;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.55;
}
.choices em {
  width: fit-content;
  padding: 3px 7px;
  border-radius: 999px;
  background: #e9f5ec;
  color: #287a45;
  font-size: 0.72rem;
  font-style: normal;
}
.club-switcher {
  display: grid;
  max-width: 360px;
  gap: 7px;
  margin-bottom: 34px;
  color: #59635b;
  font-size: 12px;
  font-weight: 600;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.field-wide {
  grid-column: 1 / -1;
}
.answer-field {
  display: grid;
  align-content: start;
  gap: 8px;
  color: #425044;
  font-size: 12.5px;
  font-weight: var(--font-weight-medium, 500);
}
.answer-field span small,
.answer-field > small {
  color: #778079;
  font-weight: 400;
}
input,
textarea,
select {
  width: 100%;
  min-height: 54px;
  padding: 13px 15px;
  border: var(--app-hairline);
  border-radius: 13px;
  background: #fff;
  color: inherit;
  font: inherit;
  font-size: 0.95rem;
}
textarea {
  min-height: 96px;
  resize: vertical;
}
input:focus,
textarea:focus,
select:focus,
button:focus-visible {
  border-color: #287a45;
  outline: 2px solid rgba(40, 122, 69, 0.14);
  outline-offset: 2px;
}
button {
  min-height: 48px;
  padding: 11px 17px;
  border: 1px solid #cbd3cb;
  border-radius: 13px;
  background: #fff;
  color: inherit;
  font: inherit;
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
.notification-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: 14px;
}
.notification-fields legend {
  padding: 0 7px;
  color: #425044;
  font-size: 12.5px;
  font-weight: 600;
}
.notification-fields label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #59635b;
  font-size: 12px;
}
.notification-fields input {
  width: 17px;
  min-height: 17px;
  accent-color: #287a45;
}
.heads-up-card {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-width: 760px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
}
.heads-up-card span {
  display: grid;
  min-height: 90px;
  place-items: center;
  gap: 8px;
  padding: 14px;
  border-radius: 13px;
  background: #f4f7f5;
  color: #287a45;
}
.heads-up-card small {
  color: #59635b;
  font-size: 11px;
  font-weight: 600;
}
.invite-fast-path,
.recommended-rules {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 22px;
  padding: clamp(20px, 4vw, 30px);
  border: 1px solid rgba(40, 122, 69, 0.18);
  border-radius: var(--app-card-radius);
  background: linear-gradient(145deg, #f7fbf8, #fff);
  box-shadow: var(--flow-shadow-quiet);
}
.invite-fast-path__copy {
  min-width: 0;
}
.invite-fast-path h2,
.recommended-rules h2,
.secondary-heading h2 {
  margin: 4px 0 7px;
  font-size: 19px;
  letter-spacing: -0.02em;
}
.invite-fast-path p:not(.eyebrow),
.secondary-heading p,
.detail-panel p {
  margin: 0;
  color: #687269;
  font-size: 12px;
  line-height: 1.55;
}
.invite-fast-path output {
  display: block;
  max-width: 560px;
  margin: 16px 0 12px;
  padding: 11px 12px;
  overflow-wrap: anywhere;
  border: var(--app-hairline);
  border-radius: 11px;
  background: #fff;
  color: #59635b;
  font-size: 10.5px;
}
.invite-fast-path img {
  width: 154px;
  align-self: center;
  border: var(--app-hairline);
  border-radius: 14px;
}
.primary,
.small-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-color: #287a45;
  background: #287a45;
  color: #fff;
}
.small-primary {
  width: fit-content;
  min-height: 44px;
}
.small-primary .flow-icon,
.actions .flow-icon {
  width: 17px;
  height: 17px;
}
.secondary-heading {
  margin: 30px 0 14px;
}
.member-methods {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.member-methods > button {
  grid-template-columns: 42px minmax(0, 1fr) auto;
  min-height: 106px;
  padding: 15px;
}
.detail-panel {
  margin-top: 16px;
  padding: 20px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
}
.detail-panel > button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.member-preview {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.member-preview li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 11px;
  background: #f4f7f5;
}
.member-preview strong,
.member-preview small {
  display: block;
}
.member-preview small {
  margin-top: 2px;
  color: #687269;
  font-size: 11px;
}
.member-preview em {
  color: #287a45;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
}
.ladder-list {
  display: grid;
  gap: 12px;
}
.ladder-list article button {
  min-height: 40px;
  padding: 8px 12px;
  color: #7d4d4d;
  font-size: 11px;
}
.add-another {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
.add-another .flow-icon {
  width: 17px;
  height: 17px;
}
.add-ladder-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.custom-ladder {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px auto;
  width: 100%;
  align-items: end;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: var(--app-hairline);
}
.placement-methods {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.placement-methods > button {
  min-height: 112px;
}
.ranking-order {
  max-width: 620px;
  margin-top: 18px;
}
.recommended-rules {
  grid-template-columns: 1fr;
}
.recommended-rules ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.recommended-rules li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #59635b;
  font-size: 12px;
  line-height: 1.5;
}
.recommended-rules li .flow-icon {
  width: 16px;
  height: 16px;
  margin-top: 1px;
  color: #287a45;
}
.rule-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.rule-actions button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.flow-alert,
.flow-message {
  margin: 18px 0 0;
  padding: 13px 15px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.5;
}
.flow-alert {
  border: 1px solid #e6b9b9;
  background: #fff5f5;
  color: #8b2525;
}
.flow-message {
  border: 1px solid #cce4d2;
  background: #f2faf4;
  color: #29633b;
}
.actions {
  position: fixed;
  z-index: 60;
  bottom: 0;
  right: 0;
  left: 0;
  display: flex;
  width: 100vw;
  max-width: none;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: clamp(28px, 5vw, 42px);
  margin-right: 0;
  margin-bottom: 0;
  margin-left: 0;
  padding: 16px max(18px, calc((100vw - var(--flow-width)) / 2));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-right: 0;
  border-left: 0;
  border-radius: 0;
  background: #0d4b32;
  box-shadow: 0 -12px 34px rgba(8, 51, 33, 0.14);
}
.action-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}
.actions .primary {
  min-width: 180px;
  border-color: #d9ee68;
  background: #d9ee68;
  color: #153a27;
  box-shadow: 0 8px 20px rgba(5, 30, 19, 0.18);
}
.skip-action {
  border-color: rgba(255, 255, 255, 0.24);
  background: transparent;
  color: #fff;
}
.save-state {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: rgba(255, 255, 255, 0.76);
  font-size: 10.5px;
}
.save-state span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d9ee68;
  box-shadow: 0 0 0 4px rgba(217, 238, 104, 0.12);
}
.action-footer-enter-active,
.action-footer-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms var(--motion-curve);
}
.action-footer-enter-from,
.action-footer-leave-to {
  opacity: 0;
  transform: translateY(12px);
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
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
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
@media (max-width: 760px) {
  .clubs-flow {
    padding: 18px;
  }
  .choices.two,
  .form-grid,
  .member-methods,
  .placement-methods,
  .recommended-rules ul {
    grid-template-columns: 1fr;
  }
  .field-wide {
    grid-column: auto;
  }
  .heads-up-card {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .invite-fast-path {
    grid-template-columns: 1fr;
  }
  .invite-fast-path img {
    width: 138px;
  }
  .custom-ladder {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .start-screen {
    padding-top: 34px;
  }
  .choices > button {
    min-height: 84px;
    padding: 15px;
  }
  .actions {
    bottom: 0;
    right: 0;
    left: 0;
    align-items: stretch;
    flex-direction: column;
    padding: 13px;
    border-radius: 0;
    background: rgba(13, 75, 50, 0.98);
    backdrop-filter: blur(10px);
  }
  .step-panel {
    padding-bottom: 144px;
  }
  .save-state {
    display: none;
  }
  .action-buttons,
  .actions .primary,
  .skip-action {
    width: 100%;
  }
  .action-buttons {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .flow-atmosphere__ball,
  .setup-step-enter-active,
  .setup-step-leave-active,
  .action-footer-enter-active,
  .choices > button {
    animation: none !important;
    transition: none !important;
  }
}
</style>
