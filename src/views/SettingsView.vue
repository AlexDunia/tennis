<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import { isSafeImageSource, sanitizePlainText } from '../utils/formSafety'
import { parseRosterCsv } from '../utils/onboarding/parseRosterCsv'
import { validateRosterImport } from '../utils/onboarding/rosterImport'

const SETTINGS_CATEGORIES = Object.freeze([
  { id: 'club', label: 'Club', help: 'Name, place, courts, and season' },
  { id: 'members', label: 'Members', help: 'Invite, import, and roles' },
  { id: 'ladders', label: 'Ladders', help: 'Add, edit, or archive' },
  { id: 'rules', label: 'Rules & format', help: 'How ladder matches work' },
  { id: 'account', label: 'Account', help: 'Your profile and password' },
])

const MEMBER_ROLES = Object.freeze([
  { value: 'admin', label: 'Admin' },
  { value: 'co-admin', label: 'Co-admin' },
  { value: 'player', label: 'Player' },
])

const DEFAULT_RULES = Object.freeze({
  challengeRangeUp: 3,
  maxActiveChallenges: 1,
  responseHours: 48,
  completionDays: 7,
  movementSystem: 'position-swap',
  rematchCooldownDays: 7,
  matchPreset: 'time-smart',
  scoring: 'ad',
  resultConfirmation: 'both-players',
  disputeResolution: 'admin',
})

const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const activeCategory = ref('club')
const pageLoading = ref(true)
const pageError = ref('')
const savingSection = ref('')
const importInput = ref(null)
const importFileName = ref('')
const inviteReady = ref(false)
const passwordBusy = ref(false)
const passwordError = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
let memberSequence = 0

const club = reactive({
  name: '',
  logoUrl: '',
  location: '',
  courts: [''],
  seasonStart: '',
  seasonEnd: '',
})

const memberSettings = reactive({
  invitationToken: '',
  invitationCode: '',
  inviteRole: 'player',
  privateLinkEnabled: true,
  manualMembers: [],
})

const ladderDrafts = ref([])
const rules = reactive({ ...DEFAULT_RULES })
const account = reactive({ name: '', email: '', phone: '' })

const activeClubName = computed(() => adminStore.activeClub?.name || club.name || 'Your club')
const validLogoUrl = computed(() => Boolean(club.logoUrl) && isSafeImageSource(club.logoUrl))
const activeLadderCount = computed(
  () => ladderDrafts.value.filter((ladder) => ladder.enabled && !ladder.archived).length,
)
const adminMemberCount = computed(
  () => memberSettings.manualMembers.filter((member) => member.role === 'admin').length,
)
const isSaving = computed(() => Boolean(savingSection.value) || adminStore.isSaving)
const selectedInvite = computed(() => {
  const role = normalizeRole(memberSettings.inviteRole)
  const storedInvite = (adminStore.activeClub?.invitations || []).find(
    (invite) => invite.enabled !== false && invite.role === role,
  )

  if (storedInvite) return storedInvite
  if (role !== 'player' || !memberSettings.invitationToken) return null

  return {
    role: 'player',
    roleLabel: 'Player',
    token: memberSettings.invitationToken,
    code: memberSettings.invitationCode,
  }
})
const inviteLink = computed(() => {
  const secret = selectedInvite.value?.token || selectedInvite.value?.code
  if (!secret || typeof window === 'undefined') return ''
  const path = `${window.location.origin}${window.location.pathname}`
  const clubName = encodeURIComponent(activeClubName.value)
  return `${path}#/signup?club=${clubName}&invite=${encodeURIComponent(secret)}`
})
const visibleInviteCode = computed(() => selectedInvite.value?.code || selectedInvite.value?.token)

function cloneValue(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {
    // Vue store values can be proxies. JSON cloning unwraps this plain setup data.
  }
  return JSON.parse(JSON.stringify(value ?? {}))
}

function makeLocalId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  memberSequence += 1
  return `${prefix}-${Date.now()}-${memberSequence}`
}

function normalizeRole(value) {
  return MEMBER_ROLES.some((role) => role.value === value) ? value : 'player'
}

function hydrateSetup(value = {}) {
  const workspace = value.workspace || {}
  const membership = value.membership || {}

  Object.assign(club, {
    name: workspace.name || '',
    logoUrl: workspace.logoUrl || '',
    location: workspace.location || '',
    courts:
      Array.isArray(workspace.courts) && workspace.courts.length ? [...workspace.courts] : [''],
    seasonStart: workspace.seasonStart || '',
    seasonEnd: workspace.seasonEnd || '',
  })

  memberSettings.invitationToken = membership.invitationToken || ''
  memberSettings.invitationCode = membership.invitationCode || ''
  memberSettings.inviteRole = normalizeRole(membership.inviteRole)
  memberSettings.privateLinkEnabled = membership.privateLinkEnabled !== false
  memberSettings.manualMembers = Array.isArray(membership.manualMembers)
    ? membership.manualMembers.map((member) => ({
        ...member,
        id: member.id || makeLocalId('member'),
        name: member.name || '',
        contact: member.contact || member.email || member.phone || '',
        role: normalizeRole(member.role),
        source: member.source || 'manual',
        status: member.status || 'invited',
      }))
    : []
  inviteReady.value = Boolean(memberSettings.invitationToken)

  ladderDrafts.value = (Array.isArray(value.ladders) ? value.ladders : []).map((ladder) => ({
    id: ladder.id || makeLocalId('ladder'),
    name: ladder.name || '',
    matchType: ladder.matchType === 'doubles' ? 'doubles' : 'singles',
    enabled: ladder.enabled !== false && !ladder.archived,
    archived: Boolean(ladder.archived),
  }))
  if (!ladderDrafts.value.length) {
    ladderDrafts.value = [
      {
        id: 'open-singles',
        name: 'Open Singles',
        matchType: 'singles',
        enabled: true,
        archived: false,
      },
    ]
  }

  Object.assign(rules, DEFAULT_RULES, value.rules || {})
}

function hydrateAccount() {
  Object.assign(account, {
    name: authStore.user?.name || '',
    email: authStore.user?.email || '',
    phone: authStore.user?.phone || '',
  })
}

function cleanLadderId(value, index) {
  const safe = sanitizePlainText(value, 90)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return safe || `ladder-${index + 1}`
}

function buildSetupInput() {
  const base = cloneValue(adminStore.activeClub?.setup || adminStore.setup || {})
  const courts = club.courts
    .map((court) => sanitizePlainText(court, 60))
    .filter(Boolean)
    .slice(0, 30)
  const manualMembers = memberSettings.manualMembers.slice(0, 500).map((member) => {
    const contact = sanitizePlainText(member.contact, 160)
    return {
      ...member,
      id: sanitizePlainText(member.id, 100),
      userId: sanitizePlainText(member.userId, 100),
      name: sanitizePlainText(member.name, 100),
      email: contact.includes('@') ? contact : '',
      phone: contact && !contact.includes('@') ? contact : '',
      role: normalizeRole(member.role),
      source: member.source || 'manual',
      status: member.status || 'invited',
    }
  })
  const ladders = ladderDrafts.value.slice(0, 12).map((ladder, index) => ({
    id: cleanLadderId(ladder.id, index),
    name: sanitizePlainText(ladder.name, 70),
    matchType: ladder.matchType === 'doubles' ? 'doubles' : 'singles',
    enabled: ladder.enabled !== false && !ladder.archived,
    archived: Boolean(ladder.archived),
  }))
  const activeIds = ladders.filter((ladder) => ladder.enabled).map((ladder) => ladder.id)

  return {
    ...base,
    workspace: {
      ...(base.workspace || {}),
      name: sanitizePlainText(club.name, 100),
      logoUrl: validLogoUrl.value ? club.logoUrl.trim().slice(0, 2048) : '',
      location: sanitizePlainText(club.location, 120),
      courts,
      seasonStart: club.seasonStart,
      seasonEnd: club.seasonEnd,
    },
    membership: {
      ...(base.membership || {}),
      invitationToken: base.membership?.invitationToken || memberSettings.invitationToken,
      invitationCode: base.membership?.invitationCode || memberSettings.invitationCode,
      inviteRole: 'player',
      privateLinkEnabled: memberSettings.privateLinkEnabled,
      manualMembers,
    },
    ladders,
    primaryLadderId: activeIds.includes(base.primaryLadderId)
      ? base.primaryLadderId
      : activeIds[0] || '',
    rules: {
      ...(base.rules || {}),
      challengeRangeUp: Number(rules.challengeRangeUp),
      maxActiveChallenges: Number(rules.maxActiveChallenges),
      responseHours: Number(rules.responseHours),
      completionDays: Number(rules.completionDays),
      movementSystem: rules.movementSystem,
      rematchCooldownDays: Number(rules.rematchCooldownDays),
      matchPreset: rules.matchPreset,
      scoring: rules.scoring,
      resultConfirmation: rules.resultConfirmation,
      disputeResolution: 'admin',
    },
  }
}

function validateSection(section) {
  if (section === 'club') {
    if (sanitizePlainText(club.name, 100).length < 2) return 'Enter the club name.'
    if (sanitizePlainText(club.location, 120).length < 2) return 'Enter the club location.'
    if (club.logoUrl && !validLogoUrl.value) return 'Use a safe http or https link for the logo.'
    if (!club.courts.some((court) => sanitizePlainText(court, 60))) return 'Add at least one court.'
    if (club.seasonStart && club.seasonEnd && club.seasonStart > club.seasonEnd) {
      return 'The season end must come after the start.'
    }
  }

  if (section === 'members') {
    const blankMember = memberSettings.manualMembers.find(
      (member) => sanitizePlainText(member.name, 100).length < 2,
    )
    if (blankMember) return 'Enter a name for every member.'
  }

  if (section === 'ladders') {
    if (!activeLadderCount.value) return 'Keep at least one ladder open.'
    if (ladderDrafts.value.some((ladder) => sanitizePlainText(ladder.name, 70).length < 2)) {
      return 'Enter a name for every ladder.'
    }
  }

  if (section === 'rules') {
    const positiveFields = [
      rules.challengeRangeUp,
      rules.maxActiveChallenges,
      rules.responseHours,
      rules.completionDays,
    ]
    if (positiveFields.some((value) => !Number.isFinite(Number(value)) || Number(value) < 1)) {
      return 'Use a number above zero for each rule.'
    }
    if (
      !Number.isFinite(Number(rules.rematchCooldownDays)) ||
      Number(rules.rematchCooldownDays) < 0
    ) {
      return 'The rematch wait cannot be below zero.'
    }
  }

  return ''
}

async function saveClubSection(section, message = 'Changes saved.') {
  pageError.value = validateSection(section)
  if (pageError.value) return false

  savingSection.value = section
  try {
    const input = buildSetupInput()
    const saved = await adminStore.updateActiveClub(input)
    hydrateSetup(saved?.setup || saved || input)
    notificationStore.addToast({ message, type: 'success' })
    return true
  } catch (error) {
    pageError.value = error?.message || 'We could not save these changes. Try again.'
    notificationStore.addToast({ message: pageError.value, type: 'error' })
    return false
  } finally {
    savingSection.value = ''
  }
}

function setCategory(category) {
  activeCategory.value = category
  pageError.value = ''
}

function addCourt() {
  if (club.courts.length < 30) club.courts.push('')
}

function removeCourt(index) {
  if (club.courts.length === 1) {
    club.courts[0] = ''
    return
  }
  club.courts.splice(index, 1)
}

async function generateInvite() {
  pageError.value = ''
  inviteReady.value = false

  try {
    const invite = await adminStore.rotateInvite(memberSettings.inviteRole)
    if (invite.role === 'player') {
      memberSettings.invitationToken = invite.token
      memberSettings.invitationCode = invite.code
      memberSettings.privateLinkEnabled = true
    }
    inviteReady.value = true
    notificationStore.addToast({ message: 'New private invite ready.', type: 'success' })
  } catch (error) {
    pageError.value = error?.message || 'We could not make a new invite. Try again.'
    notificationStore.addToast({ message: pageError.value, type: 'error' })
  }
}

function handleInviteRoleChange() {
  pageError.value = ''
  inviteReady.value = Boolean(selectedInvite.value?.token || selectedInvite.value?.code)
}

async function copyInvite(value, label) {
  if (!inviteReady.value || !value) return
  if (!navigator.clipboard?.writeText) {
    notificationStore.addToast({
      message: 'Copy is not available here. Select the text instead.',
      type: 'info',
    })
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    notificationStore.addToast({ message: `${label} copied.`, type: 'success' })
  } catch {
    notificationStore.addToast({
      message: 'Copy did not work. Select the text instead.',
      type: 'error',
    })
  }
}

function openImportPicker() {
  importInput.value?.click()
}

async function handleImport(event) {
  const file = event.target.files?.[0]
  const result = validateRosterImport(file)
  event.target.value = ''
  if (!result.valid) {
    importFileName.value = ''
    notificationStore.addToast({ message: result.message, type: 'error' })
    return
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    importFileName.value = ''
    notificationStore.addToast({
      message: 'Use a CSV here. Excel and PDF import can be added later.',
      type: 'info',
    })
    return
  }

  try {
    const parsed = parseRosterCsv(await file.text())
    if (!parsed.valid) throw new Error(parsed.message)

    const existing = new Set(
      memberSettings.manualMembers.map((member) =>
        String(member.contact || member.email || member.phone || member.name).toLowerCase(),
      ),
    )
    const added = parsed.members.filter((member) => {
      const key = String(member.contact || member.name).toLowerCase()
      if (!key || existing.has(key)) return false
      existing.add(key)
      return true
    })
    memberSettings.manualMembers.push(
      ...added.map((member) => ({ ...member, id: makeLocalId('import-member') })),
    )
    importFileName.value = sanitizePlainText(file.name, 120)
    notificationStore.addToast({
      message: `${added.length} ${added.length === 1 ? 'member' : 'members'} added.`,
      type: 'success',
    })
  } catch (error) {
    importFileName.value = ''
    notificationStore.addToast({
      message: error?.message || 'We could not read that CSV file.',
      type: 'error',
    })
  }
}

function addMember() {
  memberSettings.manualMembers.push({
    id: makeLocalId('member'),
    userId: '',
    name: '',
    contact: '',
    role: 'player',
    source: 'manual',
    status: 'invited',
  })
}

function removeMember(index) {
  const member = memberSettings.manualMembers[index]
  if (member?.role === 'admin' && adminMemberCount.value <= 1) {
    notificationStore.addToast({ message: 'Keep at least one admin in the club.', type: 'info' })
    return
  }
  memberSettings.manualMembers.splice(index, 1)
}

function changeMemberRole(member, event) {
  const nextRole = normalizeRole(event.target.value)
  if (member.role === 'admin' && nextRole !== 'admin' && adminMemberCount.value <= 1) {
    event.target.value = member.role
    notificationStore.addToast({ message: 'Keep at least one admin in the club.', type: 'info' })
    return
  }
  member.role = nextRole
}

function addLadder() {
  if (ladderDrafts.value.length >= 12) {
    notificationStore.addToast({ message: 'A club can have up to 12 ladders.', type: 'info' })
    return
  }
  ladderDrafts.value.push({
    id: makeLocalId('ladder'),
    name: 'New ladder',
    matchType: 'singles',
    enabled: true,
    archived: false,
  })
}

function toggleLadder(ladder) {
  const isOpen = ladder.enabled && !ladder.archived
  if (isOpen && activeLadderCount.value <= 1) {
    notificationStore.addToast({ message: 'Keep at least one ladder open.', type: 'info' })
    return
  }
  ladder.enabled = !isOpen
  ladder.archived = isOpen
}

function saveAccount() {
  const name = sanitizePlainText(account.name, 100)
  const email = sanitizePlainText(account.email, 160).toLowerCase()
  const phone = sanitizePlainText(account.phone, 40)

  if (name.length < 2) {
    pageError.value = 'Enter your name.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    pageError.value = 'Enter a working email address.'
    return
  }

  authStore.user = { ...authStore.user, name, email, phone }
  Object.assign(account, { name, email, phone })
  pageError.value = ''
  notificationStore.addToast({ message: 'Profile saved.', type: 'success' })
}

async function updatePassword() {
  passwordError.value = ''
  if (!currentPassword.value) passwordError.value = 'Enter your current password.'
  else if (newPassword.value.length < 10 || !/\d/.test(newPassword.value)) {
    passwordError.value = 'Use at least 10 characters and one number.'
  } else if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'The new passwords do not match.'
  }
  if (passwordError.value) return

  passwordBusy.value = true
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  await new Promise((resolve) => window.setTimeout(resolve, 300))
  passwordBusy.value = false
  notificationStore.addToast({ message: 'Password updated.', type: 'success' })
}

async function logout() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  authStore.logout()
  await router.replace({ name: 'SignIn' })
}

onMounted(async () => {
  try {
    await adminStore.loadClubs()
    const setup = adminStore.activeClub?.setup
    if (!setup) throw new Error('Choose a club before opening settings.')
    hydrateSetup(setup)
    hydrateAccount()
  } catch (error) {
    pageError.value = error?.message || 'We could not load the club settings.'
  } finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-title">
    <header class="settings-page__header">
      <p class="settings-page__eyebrow">{{ activeClubName }}</p>
      <h1 id="settings-title">Settings</h1>
      <p>Keep your club and account details up to date.</p>
    </header>

    <p v-if="pageError" class="settings-alert" role="alert">{{ pageError }}</p>

    <div class="settings-shell">
      <nav class="settings-nav" aria-label="Settings categories">
        <button
          v-for="category in SETTINGS_CATEGORIES"
          :key="category.id"
          type="button"
          :class="[
            'settings-nav__item',
            { 'settings-nav__item--active': activeCategory === category.id },
          ]"
          :aria-current="activeCategory === category.id ? 'page' : undefined"
          @click="setCategory(category.id)"
        >
          <span>{{ category.label }}</span>
          <small>{{ category.help }}</small>
        </button>
      </nav>

      <main class="settings-panel">
        <div v-if="pageLoading" class="settings-loading" aria-live="polite">
          <span class="settings-loading__line settings-loading__line--short"></span>
          <span class="settings-loading__line"></span>
          <span class="settings-loading__card"></span>
          <span class="visually-hidden">Loading settings</span>
        </div>

        <form
          v-else-if="activeCategory === 'club'"
          class="settings-section"
          @submit.prevent="saveClubSection('club')"
        >
          <header class="settings-section__header">
            <div>
              <p class="settings-section__eyebrow">Club</p>
              <h2>Club details</h2>
              <p>This is what members see around Gorra.</p>
            </div>
          </header>

          <div class="settings-card">
            <div class="settings-grid settings-grid--two">
              <label class="settings-field settings-field--wide">
                <span>Club name</span>
                <input
                  v-model="club.name"
                  type="text"
                  maxlength="100"
                  autocomplete="organization"
                  required
                />
              </label>

              <label class="settings-field settings-field--wide">
                <span>Logo link</span>
                <input
                  v-model.trim="club.logoUrl"
                  type="url"
                  maxlength="2048"
                  inputmode="url"
                  placeholder="https://"
                />
                <small>Use a secure link to your club logo.</small>
              </label>

              <div v-if="validLogoUrl" class="logo-preview settings-field--wide">
                <img :src="club.logoUrl" :alt="`${club.name || 'Club'} logo`" />
                <span>Logo preview</span>
              </div>

              <label class="settings-field settings-field--wide">
                <span>Location</span>
                <input
                  v-model="club.location"
                  type="text"
                  maxlength="120"
                  autocomplete="address-level2"
                  required
                />
              </label>

              <label class="settings-field">
                <span>Season starts</span>
                <input v-model="club.seasonStart" type="date" />
              </label>

              <label class="settings-field">
                <span>Season ends</span>
                <input v-model="club.seasonEnd" type="date" />
              </label>
            </div>

            <div class="settings-divider"></div>

            <div class="settings-subhead">
              <div>
                <h3>Courts</h3>
                <p>Add the courts members can use.</p>
              </div>
              <button
                class="settings-button settings-button--quiet"
                type="button"
                @click="addCourt"
              >
                Add court
              </button>
            </div>

            <div class="court-list">
              <div v-for="(_, index) in club.courts" :key="index" class="court-row">
                <label :for="`court-${index}`" class="visually-hidden">Court {{ index + 1 }}</label>
                <input
                  :id="`court-${index}`"
                  v-model="club.courts[index]"
                  type="text"
                  maxlength="60"
                  :placeholder="`Court ${index + 1}`"
                />
                <button
                  class="settings-icon-button"
                  type="button"
                  :aria-label="`Remove court ${index + 1}`"
                  @click="removeCourt(index)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <footer class="settings-actions">
            <button
              class="settings-button settings-button--primary"
              type="submit"
              :disabled="isSaving"
            >
              {{ savingSection === 'club' ? 'Saving…' : 'Save changes' }}
            </button>
          </footer>
        </form>

        <form
          v-else-if="activeCategory === 'members'"
          class="settings-section"
          @submit.prevent="saveClubSection('members')"
        >
          <header class="settings-section__header">
            <div>
              <p class="settings-section__eyebrow">Members</p>
              <h2>Invite and manage members</h2>
              <p>Share one link, import a list, or add people here.</p>
            </div>
          </header>

          <div class="settings-card invite-card">
            <div class="settings-subhead">
              <div>
                <h3>Club invite</h3>
                <p>Anyone with this invite can ask to join.</p>
              </div>
              <button
                class="settings-button settings-button--quiet"
                type="button"
                :disabled="isSaving"
                @click="generateInvite"
              >
                {{ selectedInvite ? 'Make a new link' : 'Make invite link' }}
              </button>
            </div>

            <div v-if="selectedInvite" class="invite-values">
              <label class="settings-field">
                <span>People join as</span>
                <select v-model="memberSettings.inviteRole" @change="handleInviteRoleChange">
                  <option value="player">Player</option>
                  <option value="co-admin">Co-admin</option>
                  <option value="admin">Admin</option>
                </select>
                <small>Each role has its own private invite.</small>
              </label>
              <label class="settings-field">
                <span>Invite code</span>
                <div class="copy-field">
                  <input :value="visibleInviteCode" type="text" readonly aria-label="Invite code" />
                  <button
                    type="button"
                    :disabled="!inviteReady"
                    @click="copyInvite(visibleInviteCode, 'Invite code')"
                  >
                    Copy
                  </button>
                </div>
              </label>
              <label class="settings-field">
                <span>Invite link</span>
                <div class="copy-field">
                  <input :value="inviteLink" type="text" readonly aria-label="Invite link" />
                  <button
                    type="button"
                    :disabled="!inviteReady"
                    @click="copyInvite(inviteLink, 'Invite link')"
                  >
                    Copy
                  </button>
                </div>
              </label>
              <p class="invite-note">Making a new link turns off the old one.</p>
            </div>
            <p v-else class="settings-empty">
              Make a private link when you are ready to invite members.
            </p>
          </div>

          <div class="settings-card">
            <div class="settings-subhead">
              <div>
                <h3>Import a list</h3>
                <p>Choose a CSV with name, email, phone, or role columns.</p>
              </div>
              <button
                class="settings-button settings-button--quiet"
                type="button"
                @click="openImportPicker"
              >
                Choose file
              </button>
              <input
                ref="importInput"
                class="visually-hidden"
                type="file"
                accept=".csv,text/csv"
                @change="handleImport"
              />
            </div>
            <p v-if="importFileName" class="import-ready" aria-live="polite">
              Members from <strong>{{ importFileName }}</strong> are in the list below.
            </p>
          </div>

          <div class="settings-card">
            <div class="settings-subhead">
              <div>
                <h3>Member list</h3>
                <p>Change names and club roles.</p>
              </div>
              <button
                class="settings-button settings-button--quiet"
                type="button"
                @click="addMember"
              >
                Add member
              </button>
            </div>

            <div v-if="memberSettings.manualMembers.length" class="member-list">
              <div
                v-for="(member, index) in memberSettings.manualMembers"
                :key="member.id"
                class="member-row"
              >
                <label class="settings-field">
                  <span>Name</span>
                  <input
                    v-model="member.name"
                    type="text"
                    maxlength="100"
                    autocomplete="off"
                    required
                  />
                </label>
                <label class="settings-field">
                  <span>Email or phone</span>
                  <input v-model="member.contact" type="text" maxlength="160" autocomplete="off" />
                </label>
                <label class="settings-field">
                  <span>Role</span>
                  <select :value="member.role" @change="changeMemberRole(member, $event)">
                    <option v-for="role in MEMBER_ROLES" :key="role.value" :value="role.value">
                      {{ role.label }}
                    </option>
                  </select>
                </label>
                <button
                  class="settings-icon-button member-row__remove"
                  type="button"
                  :aria-label="`Remove ${member.name || 'member'}`"
                  @click="removeMember(index)"
                >
                  Remove
                </button>
              </div>
            </div>
            <p v-else class="settings-empty">No one has been added here yet.</p>
          </div>

          <footer class="settings-actions">
            <button
              class="settings-button settings-button--primary"
              type="submit"
              :disabled="isSaving"
            >
              {{ savingSection === 'members' ? 'Saving…' : 'Save changes' }}
            </button>
          </footer>
        </form>

        <form
          v-else-if="activeCategory === 'ladders'"
          class="settings-section"
          @submit.prevent="saveClubSection('ladders')"
        >
          <header class="settings-section__header">
            <div>
              <p class="settings-section__eyebrow">Ladders</p>
              <h2>Club ladders</h2>
              <p>Add a ladder or update one you already use.</p>
            </div>
            <button class="settings-button settings-button--quiet" type="button" @click="addLadder">
              Add ladder
            </button>
          </header>

          <div class="ladder-list">
            <article
              v-for="ladder in ladderDrafts"
              :key="ladder.id"
              :class="[
                'settings-card',
                'ladder-row',
                { 'ladder-row--archived': ladder.archived || !ladder.enabled },
              ]"
            >
              <div class="ladder-row__mark" aria-hidden="true"></div>
              <label class="settings-field">
                <span>Ladder name</span>
                <input v-model="ladder.name" type="text" maxlength="70" required />
              </label>
              <label class="settings-field">
                <span>Match type</span>
                <select v-model="ladder.matchType" :disabled="ladder.archived || !ladder.enabled">
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                </select>
              </label>
              <button
                class="settings-button settings-button--quiet ladder-row__action"
                type="button"
                @click="toggleLadder(ladder)"
              >
                {{ ladder.enabled && !ladder.archived ? 'Archive' : 'Open again' }}
              </button>
            </article>
          </div>

          <footer class="settings-actions">
            <button
              class="settings-button settings-button--primary"
              type="submit"
              :disabled="isSaving"
            >
              {{ savingSection === 'ladders' ? 'Saving…' : 'Save changes' }}
            </button>
          </footer>
        </form>

        <form
          v-else-if="activeCategory === 'rules'"
          class="settings-section"
          @submit.prevent="saveClubSection('rules')"
        >
          <header class="settings-section__header">
            <div>
              <p class="settings-section__eyebrow">Rules & format</p>
              <h2>How ladder matches work</h2>
              <p>These rules apply to challenges in this club.</p>
            </div>
          </header>

          <div class="settings-card">
            <div class="settings-grid settings-grid--two">
              <label class="settings-field">
                <span>Challenge positions above</span>
                <input
                  v-model.number="rules.challengeRangeUp"
                  type="number"
                  min="1"
                  max="20"
                  required
                />
                <small>A player can challenge this many places up.</small>
              </label>
              <label class="settings-field">
                <span>Active challenges per player</span>
                <input
                  v-model.number="rules.maxActiveChallenges"
                  type="number"
                  min="1"
                  max="5"
                  required
                />
              </label>
              <label class="settings-field">
                <span>Time to answer</span>
                <div class="number-suffix">
                  <input
                    v-model.number="rules.responseHours"
                    type="number"
                    min="1"
                    max="168"
                    required
                  /><span>hours</span>
                </div>
              </label>
              <label class="settings-field">
                <span>Time to finish</span>
                <div class="number-suffix">
                  <input
                    v-model.number="rules.completionDays"
                    type="number"
                    min="1"
                    max="30"
                    required
                  /><span>days</span>
                </div>
              </label>
              <label class="settings-field">
                <span>Ranking movement</span>
                <select v-model="rules.movementSystem">
                  <option value="position-swap">Players swap positions</option>
                  <option value="leapfrog">Winner moves to the challenged place</option>
                </select>
              </label>
              <label class="settings-field">
                <span>Wait before a rematch</span>
                <div class="number-suffix">
                  <input
                    v-model.number="rules.rematchCooldownDays"
                    type="number"
                    min="0"
                    max="90"
                    required
                  /><span>days</span>
                </div>
              </label>
            </div>
          </div>

          <div class="settings-card">
            <div class="settings-subhead">
              <div>
                <h3>Match format</h3>
                <p>Time-Smart is the recommended club format.</p>
              </div>
            </div>
            <div class="settings-grid settings-grid--two">
              <label class="settings-field">
                <span>Format</span>
                <select v-model="rules.matchPreset">
                  <option value="time-smart">Time-Smart Club Match</option>
                  <option value="standard-club">Standard Club Match</option>
                </select>
                <small v-if="rules.matchPreset === 'time-smart'"
                  >Two tie-break sets, then a 10-point match tie-break.</small
                >
                <small v-else>Best of three tie-break sets.</small>
              </label>
              <label class="settings-field">
                <span>Point scoring</span>
                <select v-model="rules.scoring">
                  <option value="ad">Advantage scoring</option>
                  <option value="noad">No-ad scoring</option>
                </select>
              </label>
              <label class="settings-field settings-field--wide">
                <span>Result confirmation</span>
                <select v-model="rules.resultConfirmation">
                  <option value="both-players">Both players confirm</option>
                  <option value="admin-only">A club admin confirms</option>
                </select>
                <small>A club admin settles any disagreement.</small>
              </label>
            </div>
          </div>

          <footer class="settings-actions">
            <button
              class="settings-button settings-button--primary"
              type="submit"
              :disabled="isSaving"
            >
              {{ savingSection === 'rules' ? 'Saving…' : 'Save changes' }}
            </button>
          </footer>
        </form>

        <div v-else class="settings-section">
          <header class="settings-section__header">
            <div>
              <p class="settings-section__eyebrow">Account</p>
              <h2>Your account</h2>
              <p>Update your own details or sign out.</p>
            </div>
          </header>

          <form class="settings-card" @submit.prevent="saveAccount">
            <div class="settings-subhead">
              <div>
                <h3>Profile</h3>
                <p>This information belongs to your Gorra account.</p>
              </div>
            </div>
            <div class="settings-grid settings-grid--two">
              <label class="settings-field settings-field--wide"
                ><span>Name</span
                ><input
                  v-model="account.name"
                  type="text"
                  maxlength="100"
                  autocomplete="name"
                  required
              /></label>
              <label class="settings-field"
                ><span>Email</span
                ><input
                  v-model="account.email"
                  type="email"
                  maxlength="160"
                  autocomplete="email"
                  required
              /></label>
              <label class="settings-field"
                ><span>Phone</span
                ><input v-model="account.phone" type="tel" maxlength="40" autocomplete="tel"
              /></label>
            </div>
            <div class="card-actions">
              <button class="settings-button settings-button--primary" type="submit">
                Save profile
              </button>
            </div>
          </form>

          <form class="settings-card" @submit.prevent="updatePassword">
            <div class="settings-subhead">
              <div>
                <h3>Password</h3>
                <p>Choose a password you do not use anywhere else.</p>
              </div>
            </div>
            <p v-if="passwordError" class="field-error" role="alert">{{ passwordError }}</p>
            <div class="settings-grid settings-grid--two">
              <label class="settings-field settings-field--wide"
                ><span>Current password</span
                ><input
                  v-model="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  required
              /></label>
              <label class="settings-field"
                ><span>New password</span
                ><input
                  v-model="newPassword"
                  type="password"
                  minlength="10"
                  autocomplete="new-password"
                  required
                /><small>Use at least 10 characters and one number.</small></label
              >
              <label class="settings-field"
                ><span>Enter it again</span
                ><input
                  v-model="confirmPassword"
                  type="password"
                  minlength="10"
                  autocomplete="new-password"
                  required
              /></label>
            </div>
            <div class="card-actions">
              <button
                class="settings-button settings-button--primary"
                type="submit"
                :disabled="passwordBusy"
              >
                {{ passwordBusy ? 'Updating…' : 'Update password' }}
              </button>
            </div>
          </form>

          <section class="settings-card signout-card">
            <div>
              <h3>Sign out</h3>
              <p>Sign out of Gorra on this device.</p>
            </div>
            <button class="settings-button settings-button--danger" type="button" @click="logout">
              Sign out
            </button>
          </section>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  width: min(1100px, 100%);
  margin: 0 auto;
  color: var(--color-text);
}
.settings-page__header {
  margin-bottom: 28px;
}
.settings-page__header h1 {
  margin: 4px 0 7px;
  font-size: clamp(28px, 4vw, 38px);
}
.settings-page__header > p:last-child,
.settings-section__header p,
.settings-subhead p,
.signout-card p {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: var(--font-weight-regular);
}
.settings-page__eyebrow,
.settings-section__eyebrow {
  margin: 0;
  color: var(--color-primary-strong);
  font-size: 10px !important;
  font-weight: var(--font-weight-semibold) !important;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
.settings-alert,
.field-error {
  margin: 0 0 18px;
  padding: 12px 14px;
  border: 1px solid #f0c8c8;
  border-radius: var(--app-inner-radius);
  background: #fff6f6;
  color: #8b2d2d;
  font-size: 12px;
}
.settings-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  align-items: start;
  gap: 34px;
}
.settings-nav {
  position: sticky;
  top: 92px;
  display: grid;
  gap: 5px;
  padding: 7px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
}
.settings-nav__item {
  display: grid;
  min-height: 58px;
  justify-items: start;
  gap: 2px;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--app-inner-radius);
  background: transparent;
  color: var(--color-text-soft);
  text-align: left;
}
.settings-nav__item:hover {
  background: var(--color-surface-soft);
}
.settings-nav__item--active {
  background: #eef7f0;
  color: var(--color-primary-strong);
  box-shadow: inset 2px 0 var(--color-primary);
}
.settings-nav__item span {
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}
.settings-nav__item small {
  color: var(--color-muted);
  font-size: 10.5px;
  font-weight: var(--font-weight-regular);
}
.settings-panel {
  min-width: 0;
}
.settings-section {
  display: grid;
  gap: 18px;
  animation: settings-rise 220ms var(--motion-curve) both;
}
.settings-section__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
}
.settings-section__header h2 {
  margin: 5px 0 6px;
  font-size: clamp(21px, 3vw, 26px);
}
.settings-card {
  padding: 22px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: 0 13px 34px rgba(15, 34, 24, 0.04);
}
.settings-grid {
  display: grid;
  gap: 18px;
}
.settings-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.settings-field {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}
.settings-field--wide {
  grid-column: 1 / -1;
}
.settings-field input,
.settings-field select,
.court-row input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: var(--app-hairline);
  border-radius: var(--app-inner-radius);
  background: #fff;
  color: var(--color-text);
  font-size: 13px;
}
.settings-field input[readonly] {
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
}
.settings-field small {
  color: var(--color-muted);
  font-size: 10.5px;
  font-weight: var(--font-weight-regular);
  line-height: 1.45;
}
.settings-subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}
.settings-subhead h3,
.signout-card h3 {
  margin: 0 0 3px;
  font-size: 14px;
}
.settings-divider {
  height: 1px;
  margin: 22px 0;
  background: var(--color-border);
}
.settings-button {
  min-height: 40px;
  padding: 0 15px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}
.settings-button--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}
.settings-button--quiet {
  background: #fff;
  color: var(--color-text-soft);
}
.settings-button--danger {
  border-color: #efcaca;
  background: #fff;
  color: #9c3232;
}
.settings-button:disabled {
  opacity: 0.55;
}
.settings-icon-button {
  min-height: 38px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 11px;
}
.settings-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}
.settings-actions .settings-button {
  min-width: 132px;
}
.court-list {
  display: grid;
  gap: 9px;
}
.court-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.logo-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: var(--app-hairline);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 11px;
}
.logo-preview img {
  width: 44px;
  height: 44px;
  object-fit: contain;
  border-radius: 8px;
  background: #fff;
}
.invite-card {
  border-color: color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  background: linear-gradient(145deg, #fff 55%, #f3faf4);
}
.invite-values {
  display: grid;
  gap: 14px;
}
.copy-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
}
.copy-field input {
  border-radius: var(--app-inner-radius) 0 0 var(--app-inner-radius);
}
.copy-field button {
  min-height: 44px;
  padding-inline: 14px;
  border: 1px solid var(--color-border);
  border-left: 0;
  border-radius: 0 var(--app-inner-radius) var(--app-inner-radius) 0;
  background: #fff;
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}
.invite-note,
.settings-empty,
.import-ready {
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: 11.5px;
}
.import-ready {
  padding: 11px 12px;
  border-radius: var(--app-inner-radius);
  background: #eef7f0;
  color: var(--color-text-soft);
}
.member-list,
.ladder-list {
  display: grid;
  gap: 10px;
}
.member-row {
  display: grid;
  grid-template-columns: 1fr 1fr 130px auto;
  align-items: end;
  gap: 10px;
  padding: 14px 0;
  border-top: var(--app-hairline);
}
.member-row:first-child {
  border-top: 0;
  padding-top: 0;
}
.member-row__remove {
  margin-bottom: 3px;
}
.ladder-row {
  position: relative;
  display: grid;
  grid-template-columns: 6px minmax(0, 1fr) 170px auto;
  align-items: end;
  gap: 15px;
  overflow: hidden;
}
.ladder-row__mark {
  align-self: stretch;
  border-radius: 999px;
  background: var(--color-primary);
}
.ladder-row--archived {
  background: var(--color-surface-soft);
  opacity: 0.72;
}
.ladder-row--archived .ladder-row__mark {
  background: var(--color-muted);
}
.ladder-row__action {
  margin-bottom: 2px;
}
.number-suffix {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}
.number-suffix input {
  border-radius: var(--app-inner-radius) 0 0 var(--app-inner-radius);
}
.number-suffix span {
  display: grid;
  min-height: 44px;
  place-items: center;
  padding: 0 12px;
  border: var(--app-hairline);
  border-left: 0;
  border-radius: 0 var(--app-inner-radius) var(--app-inner-radius) 0;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 10.5px;
  font-weight: var(--font-weight-regular);
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
.signout-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}
.settings-loading {
  display: grid;
  gap: 13px;
}
.settings-loading__line,
.settings-loading__card {
  display: block;
  border-radius: 9px;
  background: linear-gradient(90deg, #f0f3f0 20%, #fafbfa 50%, #f0f3f0 80%);
  background-size: 220% 100%;
  animation: settings-shimmer 1.25s linear infinite;
}
.settings-loading__line {
  width: 60%;
  height: 18px;
}
.settings-loading__line--short {
  width: 22%;
  height: 10px;
}
.settings-loading__card {
  height: 260px;
  margin-top: 10px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@keyframes settings-rise {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes settings-shimmer {
  to {
    background-position: -220% 0;
  }
}
@media (max-width: 880px) {
  .settings-shell {
    grid-template-columns: 1fr;
    gap: 22px;
  }
  .settings-nav {
    position: static;
    grid-template-columns: repeat(5, minmax(120px, 1fr));
    overflow-x: auto;
  }
  .settings-nav__item small {
    display: none;
  }
  .settings-nav__item {
    min-height: 44px;
    justify-items: center;
  }
  .settings-nav__item--active {
    box-shadow: inset 0 -2px var(--color-primary);
  }
  .member-row {
    grid-template-columns: 1fr 1fr;
  }
  .member-row__remove {
    justify-self: start;
  }
  .ladder-row {
    grid-template-columns: 6px minmax(0, 1fr) 150px;
  }
  .ladder-row__action {
    grid-column: 2 / -1;
    justify-self: start;
  }
}
@media (max-width: 620px) {
  .settings-page__header {
    margin-bottom: 20px;
  }
  .settings-section__header {
    align-items: start;
    flex-direction: column;
  }
  .settings-card {
    padding: 17px;
  }
  .settings-grid--two,
  .member-row {
    grid-template-columns: 1fr;
  }
  .settings-field--wide {
    grid-column: auto;
  }
  .ladder-row {
    grid-template-columns: 5px minmax(0, 1fr);
  }
  .ladder-row .settings-field {
    grid-column: 2;
  }
  .ladder-row__mark {
    grid-row: 1 / 4;
  }
  .ladder-row__action {
    grid-column: 2;
  }
  .settings-subhead {
    align-items: start;
  }
  .settings-subhead .settings-button {
    flex: none;
  }
  .signout-card {
    align-items: start;
    flex-direction: column;
  }
}
@media (prefers-reduced-motion: reduce) {
  .settings-section,
  .settings-loading__line,
  .settings-loading__card {
    animation: none;
  }
}
</style>
