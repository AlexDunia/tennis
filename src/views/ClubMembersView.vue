<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { CLUB_INVITE_KINDS } from '../config/admin.js'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { useAuthStore } from '../stores/auth'
import {
  collectClubMembers,
  memberDirectoryStatus,
  memberPrimaryLadder,
} from '../utils/club/memberData.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'

const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()
const authStore = useAuthStore()

const search = ref('')
const filter = ref('all')
const inviteDialog = ref(null)
const inviteEmails = ref('')
const pageError = ref('')
const inviteBusy = ref(false)

const club = computed(() => adminStore.activeClub)
const setup = computed(() => club.value?.setup || {})
const canManage = computed(() => adminStore.hasActiveClubPermission('club.manage'))
const currentUserId = computed(() =>
  sanitizeDirectoryId(
    authStore.user?.id ||
      authStore.user?.playerId ||
      authStore.user?.email ||
      '',
  ),
)

const members = computed(() => {
  const source = collectClubMembers(setup.value)
  return [...source].sort((left, right) => {
    const leftMe = left.userId && sanitizeDirectoryId(left.userId) === currentUserId.value
    const rightMe = right.userId && sanitizeDirectoryId(right.userId) === currentUserId.value
    if (leftMe !== rightMe) return leftMe ? -1 : 1
    return String(left.name || '').localeCompare(String(right.name || ''))
  })
})

const visibleMembers = computed(() => {
  const query = search.value.trim().toLowerCase()

  return members.value.filter((member) => {
    const status = memberDirectoryStatus(member)
    if (filter.value === 'needs' && status.key !== 'needs') return false
    if (filter.value === 'connected' && status.key !== 'connected') return false

    if (!query) return true
    return [member.name, member.email, member.phone, member.memberNumber]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
})

const genericInvite = computed(() =>
  (club.value?.invitations || []).find(
    (invite) =>
      invite.enabled !== false &&
      invite.kind === CLUB_INVITE_KINDS.GENERIC &&
      invite.role === 'player',
  ),
)

const genericInviteLink = computed(() => {
  const secret = genericInvite.value?.token || genericInvite.value?.code
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

function statusFor(member) {
  return memberDirectoryStatus(member)
}

function isCurrentUser(member) {
  return Boolean(
    member.userId &&
      currentUserId.value &&
      sanitizeDirectoryId(member.userId) === currentUserId.value,
  )
}

function openMember(member) {
  router.push({
    name: 'ClubMemberDetail',
    params: { memberId: member.id },
  })
}

function scrollToAddPeople() {
  document.querySelector('#member-add-people')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

async function ensureGenericInvite() {
  if (genericInvite.value) return genericInvite.value
  inviteBusy.value = true
  try {
    return await adminStore.rotateInvite('player')
  } finally {
    inviteBusy.value = false
  }
}

async function openInvitePeople() {
  pageError.value = ''

  try {
    await ensureGenericInvite()
    await nextTick()
    inviteDialog.value?.showModal()
  } catch (error) {
    pageError.value = error?.message || 'We could not make the club invite.'
  }
}

function closeInvitePeople() {
  inviteDialog.value?.close()
}

async function makeNewInvite() {
  inviteBusy.value = true
  pageError.value = ''
  try {
    await adminStore.rotateInvite('player')
    notificationStore.addToast({
      message: 'New club invite ready.',
      type: 'success',
    })
  } catch (error) {
    pageError.value = error?.message || 'We could not make a new club invite.'
  } finally {
    inviteBusy.value = false
  }
}

async function copyInvite() {
  if (!genericInviteLink.value) return
  try {
    await navigator.clipboard.writeText(genericInviteLink.value)
    notificationStore.addToast({
      message: 'Club invite link copied.',
      type: 'success',
    })
  } catch {
    notificationStore.addToast({
      message: 'Copy did not work. Select the link instead.',
      type: 'error',
    })
  }
}

function validInviteEmails() {
  return String(inviteEmails.value || '')
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    .slice(0, 20)
}

function openEmailApp() {
  const recipients = validInviteEmails()
  if (!genericInviteLink.value) return

  const subject = `Join ${club.value?.name || 'our tennis club'} on Gorra`
  const body = `Use this private club invitation to join ${club.value?.name || 'our club'} on Gorra:\n\n${genericInviteLink.value}`

  const mailto = `mailto:${encodeURIComponent(recipients.join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = mailto
}

onMounted(async () => {
  pageError.value = ''
  try {
    await adminStore.loadClubs()
  } catch (error) {
    pageError.value = error?.message || 'We could not load the member directory.'
  }
})
</script>

<template>
  <main class="gorra-club-ref ref-page ref-members-page">
    <button class="ref-back" type="button" @click="router.push({ name: 'Club' })">
      <FlowIcon name="arrow-right" />
      Back to club
    </button>

    <header class="ref-members-head">
      <div class="ref-members-head-copy">
        <h1>All members of {{ club?.name || 'this club' }}</h1>
      </div>

      <button
        v-if="canManage"
        class="ref-button"
        type="button"
        @click="scrollToAddPeople"
      >
        <FlowIcon name="plus" />
        Add people
      </button>
    </header>

    <p v-if="pageError" class="ref-inline-alert" role="alert">{{ pageError }}</p>

    <section class="ref-member-list-shell" aria-label="Club member directory">
      <div class="ref-member-toolbar">
        <label class="ref-search">
          <FlowIcon name="search" />
          <input
            v-model="search"
            type="search"
            autocomplete="off"
            placeholder="Search name or email"
            aria-label="Search club members"
          />
          <button
            v-if="search"
            class="ref-search-clear"
            type="button"
            aria-label="Clear member search"
            @click="search = ''"
          >
            <FlowIcon name="close" />
          </button>
          <span v-else></span>
        </label>

        <select v-model="filter" class="ref-member-filter" aria-label="Filter members">
          <option value="all">All members</option>
          <option value="needs">Needs information</option>
          <option value="connected">Connected accounts</option>
        </select>
      </div>

      <div class="ref-member-columns" aria-hidden="true">
        <span>Player name</span>
        <span>Email</span>
        <span>Ladder position</span>
        <span>Role</span>
      </div>

      <div v-if="visibleMembers.length">
        <button
          v-for="member in visibleMembers"
          :key="member.id"
          class="ref-member-row"
          :class="{
            you: isCurrentUser(member),
            needs: statusFor(member).key === 'needs',
          }"
          type="button"
          @click="openMember(member)"
        >
          <span class="ref-member-avatar" aria-hidden="true">
            <img v-if="member.photoUrl" :src="member.photoUrl" alt="" />
            <span v-else>{{ initials(member.name) }}</span>
          </span>

          <span class="ref-member-name">
            <strong>{{ member.name || 'Club member' }}</strong>
            <span class="ref-member-meta">
              <span v-if="isCurrentUser(member)">You</span>
              <span v-if="statusFor(member).key === 'needs'">
                Needs {{ statusFor(member).missing.length }}
                {{ statusFor(member).missing.length === 1 ? 'detail' : 'details' }}
              </span>
            </span>
          </span>

          <span class="ref-member-contact">
            <strong>{{ member.email || 'No email' }}</strong>
            <span>{{ member.userId ? 'Connected account' : 'Club record' }}</span>
          </span>

          <span class="ref-member-ladder">{{ memberPrimaryLadder(member) }}</span>

          <span class="ref-member-role">
            {{
              member.role === 'admin'
                ? 'Admin'
                : member.role === 'co-admin'
                  ? 'Co-admin'
                  : 'Member'
            }}
          </span>
        </button>
      </div>

      <p v-else class="ref-member-empty">
        {{ members.length ? 'No members match this search.' : 'No members have been added yet.' }}
      </p>
    </section>

    <section
      v-if="canManage"
      id="member-add-people"
      class="ref-add-people"
      aria-labelledby="add-people-title"
    >
      <header class="ref-section-heading">
        <h2 id="add-people-title">Add people</h2>
        <p>Choose the quickest way to bring someone into this club.</p>
      </header>

      <div class="ref-choice-stack">
        <button class="ref-choice-row" type="button" @click="openInvitePeople">
          <span class="ref-feature-icon" aria-hidden="true">
            <FlowIcon name="send" />
          </span>
          <span class="ref-choice-row-copy">
            <strong>Invite people</strong>
            <span>Send an email or copy one club invite link.</span>
          </span>
          <FlowIcon name="arrow-right" />
        </button>

        <button
          class="ref-choice-row"
          type="button"
          @click="router.push({ name: 'ClubMemberImport' })"
        >
          <span class="ref-feature-icon" aria-hidden="true">
            <FlowIcon name="upload" />
          </span>
          <span class="ref-choice-row-copy">
            <strong>Bring your data to Gorra</strong>
            <span>Upload the member or ladder list your club already uses.</span>
          </span>
          <FlowIcon name="arrow-right" />
        </button>

        <button
          class="ref-choice-row"
          type="button"
          @click="router.push({ name: 'ClubMemberManual' })"
        >
          <span class="ref-feature-icon" aria-hidden="true">
            <FlowIcon name="plus" />
          </span>
          <span class="ref-choice-row-copy">
            <strong>Add someone manually</strong>
            <span>Enter the details yourself when needed.</span>
          </span>
          <FlowIcon name="arrow-right" />
        </button>
      </div>
    </section>

    <dialog ref="inviteDialog" class="ref-dialog" @close="inviteEmails = ''">
      <div class="ref-dialog-inner">
        <header class="ref-dialog-head">
          <div>
            <h2>Invite people</h2>
            <p>Share one club invitation. It creates membership only; it does not claim an existing member record.</p>
          </div>
          <button class="ref-dialog-close" type="button" aria-label="Close" @click="closeInvitePeople">
            <FlowIcon name="close" />
          </button>
        </header>

        <div class="ref-form-field">
          <span>Email addresses <small>(optional)</small></span>
          <textarea
            v-model="inviteEmails"
            rows="3"
            placeholder="one@example.com, two@example.com"
          ></textarea>
        </div>

        <div class="ref-form-field" style="margin-top: 14px">
          <span>Club invite link</span>
          <input :value="genericInviteLink" readonly aria-label="Club invite link" />
        </div>

        <div class="ref-form-actions">
          <button class="ref-button" type="button" :disabled="inviteBusy" @click="makeNewInvite">
            {{ inviteBusy ? 'Making…' : 'Make new link' }}
          </button>
          <button class="ref-button" type="button" :disabled="!genericInviteLink" @click="copyInvite">
            Copy link
          </button>
          <button
            class="ref-button primary"
            type="button"
            :disabled="!genericInviteLink"
            @click="openEmailApp"
          >
            Open email
          </button>
        </div>
      </div>
    </dialog>
  </main>
</template>
