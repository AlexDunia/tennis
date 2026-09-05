<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { CLUB_INVITE_KINDS } from '../config/admin.js'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import {
  exactClubMember,
  memberPrimaryLadder,
} from '../utils/club/memberData.js'
import { isSafeImageSource } from '../utils/formSafety.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const pageError = ref('')
const saving = ref(false)
const inviteBusy = ref(false)
const photoInput = ref(null)

const form = reactive({
  name: '',
  email: '',
  phone: '',
  gender: '',
  dob: '',
  level: '',
  rating: '',
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
const currentUserId = computed(() =>
  sanitizeDirectoryId(authStore.user?.id || authStore.user?.playerId || authStore.user?.email),
)
const isSelf = computed(
  () =>
    Boolean(member.value?.userId) &&
    sanitizeDirectoryId(member.value.userId) === currentUserId.value,
)
const canEditPersonal = computed(() => canManage.value || isSelf.value)
const connected = computed(() => Boolean(sanitizeDirectoryId(member.value?.userId)))

const activeMemberInvite = computed(() =>
  (club.value?.invitations || []).find(
    (invite) =>
      invite.enabled !== false &&
      invite.kind === CLUB_INVITE_KINDS.MEMBER_RECORD &&
      invite.memberId === member.value?.id,
  ),
)

const accountInviteLink = computed(() => {
  const secret = activeMemberInvite.value?.token || activeMemberInvite.value?.code
  if (!secret || typeof window === 'undefined') return ''

  const resolved = router.resolve({
    name: 'SignUp',
    query: {
      club: club.value?.name || '',
      invite: secret,
    },
  })

  try {
    return new URL(resolved.href, window.location.origin).href
  } catch {
    return ''
  }
})

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

  Object.assign(form, {
    name: value.name || '',
    email: value.email || '',
    phone: value.phone || '',
    gender: value.gender || '',
    dob: value.dob || '',
    level: value.level || '',
    rating: value.rating || '',
    memberNumber: value.memberNumber || '',
    yearOfEntry: value.yearOfEntry || '',
    role: value.role || 'player',
    photoUrl: value.photoUrl || '',
  })
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

    await adminStore.saveMemberRecord(member.value.id, {
      name: form.name.trim(),
      email,
      phone: form.phone.trim(),
      gender: form.gender,
      dob: form.dob,
      level: form.level.trim(),
      rating: form.rating.trim(),
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

async function makeAccountInvite() {
  if (!canManage.value || connected.value || !member.value) return
  pageError.value = ''
  inviteBusy.value = true

  try {
    await adminStore.createMemberInvite(member.value.id)
    notificationStore.addToast({
      message: `Account invite ready for ${member.value.name}.`,
      type: 'success',
    })
  } catch (error) {
    pageError.value = error?.message || 'We could not make this account invite.'
  } finally {
    inviteBusy.value = false
  }
}

async function copyAccountInvite() {
  if (!accountInviteLink.value) return
  try {
    await navigator.clipboard.writeText(accountInviteLink.value)
    notificationStore.addToast({
      message: 'Account invite link copied.',
      type: 'success',
    })
  } catch {
    notificationStore.addToast({
      message: 'Copy did not work. Select the link instead.',
      type: 'error',
    })
  }
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
</script>

<template>
  <main class="gorra-club-ref ref-page ref-page-narrow">
    <button class="ref-back" type="button" @click="router.push({ name: 'ClubMembers' })">
      <FlowIcon name="arrow-right" />
      Back to members
    </button>

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
            <label class="ref-form-field">
              <span>Playing Level</span>
              <input
                v-model="form.level"
                type="text"
                maxlength="50"
                :disabled="!canEditPersonal"
              />
            </label>

            <label class="ref-form-field">
              <span>Rating</span>
              <input
                v-model="form.rating"
                type="text"
                maxlength="40"
                :disabled="!canEditPersonal"
              />
            </label>

            <div class="ref-form-field full">
              <span>Ladder position</span>
              <input :value="memberPrimaryLadder(member)" type="text" readonly />
              <small>Ladder position is club-owned and is changed from the Ladder.</small>
            </div>
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
              <small>Club role is separate from the person's Gorra account.</small>
            </label>

            <div class="ref-form-field">
              <span>Gorra account</span>
              <input
                :value="connected ? 'Connected account' : 'Club record'"
                type="text"
                readonly
              />
            </div>
          </div>
        </section>

        <section v-if="canManage && !connected" class="ref-profile-section">
          <header class="ref-profile-section-head">
            <strong>Connect their Gorra account</strong>
          </header>

          <p class="ref-inline-note">
            A member-specific invitation connects this exact club record. Gorra does not match people
            by name.
          </p>

          <div v-if="activeMemberInvite" class="ref-form-field" style="margin-top: 12px">
            <span>Account invite link</span>
            <input :value="accountInviteLink" type="text" readonly />
          </div>

          <div class="ref-form-actions">
            <button
              v-if="activeMemberInvite"
              class="ref-button"
              type="button"
              :disabled="!accountInviteLink"
              @click="copyAccountInvite"
            >
              Copy link
            </button>
            <button
              class="ref-button"
              type="button"
              :disabled="inviteBusy"
              @click="makeAccountInvite"
            >
              {{
                inviteBusy
                  ? 'Making…'
                  : activeMemberInvite
                    ? 'Make new link'
                    : 'Make account invite'
              }}
            </button>
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
