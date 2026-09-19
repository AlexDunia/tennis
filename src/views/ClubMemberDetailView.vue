<script setup>
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import {
  exactClubMember,
} from '../utils/club/memberData.js'
import { isSafeImageSource } from '../utils/formSafety.js'
import {
  PLAYER_RATING_SYSTEMS,
  normalizeMemberRatings,
  normalizePlayerRatingValue,
  playerRatingOptions,
  playerRatingValueLabel,
} from '../domain/playerRatings.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const pageError = ref('')
const saving = ref(false)
const photoInput = ref(null)
const ladderBusy = ref(false)
const openLadderId = ref('')
const ladderPositionDraft = ref('')

const form = reactive({
  name: '',
  email: '',
  phone: '',
  gender: '',
  dob: '',
  clubLevelId: '',
  memberNumber: '',
  yearOfEntry: '',
  role: 'player',
  photoUrl: '',
})

const club = computed(() => adminStore.activeClub)
const memberResult = computed(() =>
  exactClubMember(club.value?.setup || {}, route.params.memberId),
)
const member = computed(() => memberResult.value.member)
const canManage = computed(() => adminStore.hasActiveClubPermission('club.manage'))
const ntrpOptions = playerRatingOptions('ntrp')
const ratingSystems = PLAYER_RATING_SYSTEMS
const memberLadders = computed(() => {
  const memberships = Array.isArray(member.value?.ladderMemberships) ? member.value.ladderMemberships : []
  const ladders = Array.isArray(club.value?.setup?.ladders) ? club.value.setup.ladders : []
  return memberships.map((membership) => {
    const ladder = ladders.find((item) =>
      (membership.ladderId && item.id === membership.ladderId) ||
      String(item.name || '').trim().toLowerCase() === String(membership.ladderName || '').trim().toLowerCase(),
    )
    if (!ladder) return null
    return { id: ladder.id, name: ladder.name, position: Number(membership.position) || null, status: ladder.status || '' }
  }).filter(Boolean)
})

const clubLevelOptions = computed(() =>
  (Array.isArray(club.value?.setup?.playerLevels?.levels)
    ? club.value.setup.playerLevels.levels
    : []
  ).filter((level) => level?.active !== false),
)
const currentUserId = computed(() =>
  sanitizeDirectoryId(authStore.user?.id || authStore.user?.playerId || authStore.user?.email),
)
const isSelf = computed(
  () =>
    Boolean(member.value?.userId) &&
    sanitizeDirectoryId(member.value.userId) === currentUserId.value,
)
const canEditPersonal = computed(() => canManage.value || isSelf.value)
function initials(name) {
  return String(name || 'Club member')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function fillForm() {
  const value = member.value
  if (!value) return

  const ratings = normalizeMemberRatings(value.ratings)

  Object.assign(form, {
    name: value.name || '',
    email: value.email || '',
    phone: value.phone || '',
    gender: value.gender || '',
    dob: value.dob || '',
    clubLevelId: sanitizeDirectoryId(value.clubLevelId || value.level),
    memberNumber: value.memberNumber || '',
    yearOfEntry: value.yearOfEntry || '',
    role: value.role || 'player',
    photoUrl: value.photoUrl || '',
  })
}

function ratingsPayload() {
  const input = { ntrp: form.ntrp, utr: form.utr, wtn: form.wtn }
  const result = {}; const now = new Date().toISOString()
  Object.entries(input).forEach(([systemId, raw]) => {
    if (raw === '' || raw === null || raw === undefined) return
    const value = normalizePlayerRatingValue(systemId, raw)
    if (value === null) throw new Error(`Check the ${ratingSystems[systemId].acronym} rating.`)
    result[systemId] = { value, source: 'admin', verified: false, updatedAt: now }
  })
  return result
}
async function saveMember() {
  if (!member.value || !canEditPersonal.value) return
  pageError.value = ''
  saving.value = true

  try {
    const email = String(form.email || '').trim().toLowerCase()
    if (form.name.trim().length < 2) throw new Error('Add the member name.')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new Error('Enter a working email address.')
    }

    const selectedClubLevel = clubLevelOptions.value.find(
      (level) => level.id === form.clubLevelId,
    )

    await adminStore.saveMemberRecord(member.value.id, {
      name: form.name.trim(),
      email,
      phone: form.phone.trim(),
      gender: form.gender,
      dob: form.dob,
      ...(canManage.value
        ? {
            clubLevelId: form.clubLevelId,
            level: selectedClubLevel?.label || '',
            ratings: ratingsPayload(),
          }
        : {}),
      memberNumber: form.memberNumber.trim(),
      yearOfEntry: String(form.yearOfEntry || '').trim(),
      photoUrl: form.photoUrl,
      ...(canManage.value ? { role: form.role } : {}),
    })
    fillForm()

    notificationStore.addToast({
      message: 'Member updated.',
      type: 'success',
    })
  } catch (error) {
    pageError.value = error?.message || 'We could not update this member.'
  } finally {
    saving.value = false
  }
}

function toggleLadderEditor(ladder) {
  if (openLadderId.value === ladder.id) { openLadderId.value = ''; ladderPositionDraft.value = ''; return }
  openLadderId.value = ladder.id
  ladderPositionDraft.value = String(ladder.position || '')
}

async function saveLadderPosition(ladder) {
  if (!canManage.value || ladderBusy.value) return
  const position = Number.parseInt(ladderPositionDraft.value, 10)
  if (!Number.isInteger(position) || position < 1) { pageError.value = 'Enter a valid Ladder position.'; return }
  ladderBusy.value = true; pageError.value = ''
  try {
    await adminStore.saveMemberLadderPosition(member.value.id, ladder.id, position)
    await adminStore.loadClubs(); fillForm(); openLadderId.value = ''; ladderPositionDraft.value = ''
    notificationStore.addToast({ message: `${ladder.name} position updated.`, type: 'success' })
  } catch (error) { pageError.value = error?.message || 'We could not change this Ladder position.' }
  finally { ladderBusy.value = false }
}
function choosePhoto() {
  if (canEditPersonal.value) photoInput.value?.click()
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('We could not read that image.'))
    reader.readAsDataURL(file)
  })
}

async function changePhoto(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    pageError.value = 'Choose a JPG, PNG or WebP image.'
    return
  }

  if (file.size > 1_400_000) {
    pageError.value = 'Choose an image smaller than 1.4 MB.'
    return
  }

  try {
    const value = await readImage(file)
    if (!isSafeImageSource(value)) throw new Error('That image could not be used safely.')
    form.photoUrl = value
  } catch (error) {
    pageError.value = error?.message || 'We could not use that image.'
  }
}

watch(member, fillForm, { immediate: true })

onMounted(async () => {
  try {
    await adminStore.loadClubs()
    fillForm()
    if (memberResult.value.count !== 1) {
      pageError.value =
        memberResult.value.count > 1
          ? 'This member record is duplicated. Ask a club admin to review the data.'
          : 'This member could not be found.'
    }
  } catch (error) {
    pageError.value = error?.message || 'We could not open this member.'
  }
})
useShellNestedHeader(() => ({
  label: 'Back to members',
  backLabel: 'Back to members',
  back: () => router.push({ name: 'ClubMembers' }),
  crumbs: [
    { label: 'Club' },
    { label: 'Members' },
    { label: club.value?.name || 'Current club' },
    { label: member.value?.name || 'Member' },
  ],
}))
</script>

<template>
  <main class="gorra-club-ref ref-page ref-page-narrow">

    <template v-if="member">
      <section class="ref-member-detail-hero">
        <button
          class="ref-member-photo"
          type="button"
          :disabled="!canEditPersonal"
          :aria-label="canEditPersonal ? 'Change member photo' : undefined"
          @click="choosePhoto"
        >
          <img v-if="form.photoUrl" :src="form.photoUrl" alt="" />
          <span v-else>{{ initials(member.name) }}</span>
        </button>
        <input
          ref="photoInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          @change="changePhoto"
        />

        <div class="ref-member-detail-title">
          <h1>{{ member.name }}</h1>
          <p>
            {{
              member.role === 'admin'
                ? 'Admin'
                : member.role === 'co-admin'
                  ? 'Co-admin'
                  : 'Member'
            }}
            · {{ club?.name }}
          </p>
        </div>
      </section>

      <p v-if="pageError" class="ref-inline-alert" role="alert">{{ pageError }}</p>

      <form class="ref-form-card" @submit.prevent="saveMember">
        <section class="ref-profile-section">
          <header class="ref-profile-section-head">
            <strong>About them</strong>
          </header>

          <div class="ref-form-grid">
            <label class="ref-form-field full">
              <span>Full name</span>
              <input
                v-model="form.name"
                type="text"
                maxlength="100"
                :disabled="!canEditPersonal"
                required
              />
            </label>

            <label class="ref-form-field">
              <span>Email</span>
              <input
                v-model="form.email"
                type="email"
                maxlength="254"
                :disabled="!canEditPersonal"
              />
            </label>

            <label class="ref-form-field">
              <span>Phone</span>
              <input
                v-model="form.phone"
                type="tel"
                maxlength="30"
                :disabled="!canEditPersonal"
              />
            </label>

            <label class="ref-form-field">
              <span>Gender</span>
              <select v-model="form.gender" :disabled="!canEditPersonal">
                <option value="">Not added</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>

            <label class="ref-form-field">
              <span>Date of birth</span>
              <input v-model="form.dob" type="date" :disabled="!canEditPersonal" />
            </label>
          </div>
        </section>

        <section class="ref-profile-section">
          <header class="ref-profile-section-head">
            <strong>Their tennis</strong>
          </header>

          <div class="ref-form-grid">
            <label class="ref-form-field full">
              <span>Club playing level</span>
              <select v-model="form.clubLevelId" :disabled="!canManage"><option value="">Not set</option><option v-for="level in clubLevelOptions" :key="level.id" :value="level.id">{{ level.label }}</option></select>
              <small>{{ canManage ? 'Used when a Ladder or competition requires a club level.' : 'Set by a club admin.' }}</small>
            </label>
            <div class="ref-member-ratings full" v-if="canManage"><div class="ref-member-ratings__head"><strong>Tennis ratings</strong><small>Add only ratings this player actually uses.</small></div><label class="ref-form-field"><span>NTRP <small>National Tennis Rating Program</small></span><select v-model.number="form.ntrp"><option value="">Not set</option><option v-for="value in ntrpOptions" :key="value" :value="value">{{ playerRatingValueLabel('ntrp', value) }}</option></select></label><label class="ref-form-field"><span>UTR <small>Universal Tennis Rating</small></span><input v-model="form.utr" type="number" min="1" max="16.5" step="0.01" placeholder="Not set" /></label><label class="ref-form-field"><span>WTN <small>World Tennis Number</small></span><input v-model="form.wtn" type="number" min="1" max="40" step="0.1" placeholder="Not set" /></label></div>
            <div class="ref-member-ladders full"><div class="ref-member-ladders__head"><strong>Ladders</strong><small>Adjust this player's position without leaving Members.</small></div><div v-if="memberLadders.length" class="ref-member-ladders__list"><article v-for="ladder in memberLadders" :key="ladder.id" class="ref-member-ladder-item"><button class="ref-member-ladder-toggle" type="button" @click="toggleLadderEditor(ladder)"><span><strong>{{ ladder.name }}</strong><small>Position #{{ ladder.position }}</small></span><FlowIcon name="arrow-right" :class="{ open: openLadderId === ladder.id }" /></button><div v-if="openLadderId === ladder.id" class="ref-member-ladder-editor"><label class="ref-form-field"><span>Position</span><input v-model="ladderPositionDraft" type="number" min="1" inputmode="numeric" /></label><button class="ref-button primary" type="button" :disabled="ladderBusy" @click="saveLadderPosition(ladder)">{{ ladderBusy ? 'Saving...' : 'Save position' }}</button></div></article></div><div v-else class="ref-member-ladders__empty">Not on a Ladder yet.</div></div>
          </div>
        </section>

        <section class="ref-profile-section">
          <header class="ref-profile-section-head">
            <strong>At this club</strong>
          </header>

          <div class="ref-form-grid">
            <label class="ref-form-field">
              <span>Member / Reference Number</span>
              <input
                v-model="form.memberNumber"
                type="text"
                maxlength="80"
                :disabled="!canEditPersonal"
              />
            </label>

            <label class="ref-form-field">
              <span>Year of Entry</span>
              <input
                v-model="form.yearOfEntry"
                type="number"
                min="1900"
                :max="new Date().getFullYear() + 1"
                :disabled="!canEditPersonal"
              />
            </label>

            <label class="ref-form-field">
              <span>Role</span>
              <select v-model="form.role" :disabled="!canManage">
                <option value="player">Member</option>
                <option value="co-admin">Co-admin</option>
                <option value="admin">Admin</option>
              </select>
              <small>Controls what this person can manage in this club.</small>
            </label>

          </div>
        </section>

        <footer v-if="canEditPersonal" class="ref-form-actions">
          <button
            class="ref-button"
            type="button"
            @click="router.push({ name: 'ClubMembers' })"
          >
            Cancel
          </button>
          <button class="ref-button primary" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save member' }}
          </button>
        </footer>
      </form>
    </template>

    <p v-else-if="pageError" class="ref-inline-alert" role="alert">{{ pageError }}</p>
  </main>
</template>
