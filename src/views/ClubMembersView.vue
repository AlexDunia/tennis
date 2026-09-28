<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { CLUB_INVITE_KINDS } from '../config/admin.js'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import { useAuthStore } from '../stores/auth'
import { memberRatingValue } from '../domain/playerRatings.js'
import {
  collectClubMembers,
  memberDirectoryStatus,
  memberPrimaryLadder,
} from '../utils/club/memberData.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()
const authStore = useAuthStore()

const search = ref('')
const filter = ref('all')
const sortKey = ref('name')
const sortDirection = ref('asc')
const filterOpen = ref(false)
const addOpen = ref(false)
const inviteDialog = ref(null)
const inviteEmails = ref('')
const pageError = ref('')
const inviteBusy = ref(false)
const actionMember = ref(null)
const detailMember = ref(null)
const removeDialog = ref(null)
const memberPendingRemoval = ref(null)
const removalBusy = ref(false)

const club = computed(() => adminStore.activeClub)
const setup = computed(() => club.value?.setup || {})
const canManage = computed(() => adminStore.hasActiveClubPermission('club.manage'))
const currentUserId = computed(() =>
  sanitizeDirectoryId(authStore.user?.id || authStore.user?.playerId || authStore.user?.email || ''),
)
const members = computed(() => collectClubMembers(setup.value))
const referenceMembers = Object.freeze([
  { id: 'aisha-mohammed', name: 'Aisha Mohammed', email: 'aisha@gorra.example', ladder: "Women's Singles", position: 1, memberNumber: 'GTC-003', wins: 10, losses: 2, activity: 'Match scheduled', activityMeta: 'Tomorrow · 5:30 PM', utr: 9.15 },
  { id: 'chinedu-okafor', name: 'Chinedu Okafor', email: 'chinedu@gorra.example', ladder: 'Open Singles', position: 1, memberNumber: 'GTC-001', wins: 8, losses: 3, activity: 'Won vs Tunde', activityMeta: '2 days ago', utr: 9.8 },
  { id: 'tunde-adebayo', name: 'Tunde Adebayo', email: 'tunde@gorra.example', ladder: 'Open Singles', position: 2, memberNumber: 'GTC-002', wins: 6, losses: 4, activity: 'Lost vs Chinedu', activityMeta: '2 days ago', utr: 9.35 },
  { id: 'femi-balogun', name: 'Femi Balogun', email: 'femi@gorra.example', ladder: "Men's Singles", position: 1, memberNumber: 'GTC-004', wins: 7, losses: 5, activity: 'Won vs Obinna', activityMeta: '5 days ago', utr: 8.9 },
  { id: 'zainab-lawal', name: 'Zainab Lawal', email: 'zainab@gorra.example', ladder: "Women's Singles", position: 2, memberNumber: 'GTC-005', wins: 5, losses: 3, activity: 'Ready to challenge', activityMeta: 'No active match', utr: 8.7 },
])
const directoryMembers = computed(() => members.value.length ? members.value : referenceMembers)

const filterOptions = computed(() => [
  { value: 'all', label: 'All members', count: directoryMembers.value.length },
  {
    value: 'needs',
    label: 'Needs attention',
    count: directoryMembers.value.filter((member) => statusFor(member).key === 'needs').length,
  },
  {
    value: 'ranked',
    label: 'On a ladder',
    count: directoryMembers.value.filter((member) => displayLadder(member) !== '—').length,
  },
  {
    value: 'connected',
    label: 'Connected',
    count: directoryMembers.value.filter((member) => statusFor(member).key === 'connected').length,
  },
])

const activeFilterLabel = computed(
  () => filterOptions.value.find((option) => option.value === filter.value)?.label || '',
)

const visibleMembers = computed(() => {
  const query = search.value.trim().toLowerCase()
  const rows = directoryMembers.value.filter((member) => {
    const status = statusFor(member)
    if (filter.value === 'needs' && status.key !== 'needs') return false
    if (filter.value === 'ranked' && displayLadder(member) === '—') return false
    if (filter.value === 'connected' && status.key !== 'connected') return false
    if (!query) return true

    return [member.name, member.email, member.phone, member.memberNumber, displayLadder(member), status.label]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })

  return [...rows].sort((left, right) => {
    const comparison = compareMembers(left, right, sortKey.value)
    return sortDirection.value === 'asc' ? comparison : -comparison
  })
})

const genericInvite = computed(() =>
  (club.value?.invitations || []).find(
    (invite) => invite.enabled !== false && invite.kind === CLUB_INVITE_KINDS.GENERIC && invite.role === 'player',
  ),
)

const genericInviteLink = computed(() => {
  const secret = genericInvite.value?.token || genericInvite.value?.code
  if (!secret || typeof window === 'undefined') return ''

  const resolved = router.resolve({
    name: 'SignUp',
    query: { club: club.value?.name || '', invite: secret },
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

function memberUtr(member) {
  const referenceValue = Number(member.utr)
  if (Number.isFinite(referenceValue)) return referenceValue.toFixed(2)
  const value = memberRatingValue(member, 'utr')
  return value === null ? '—' : value.toFixed(2)
}

function displayLadder(member) {
  const ladder = String(member.ladder || '').trim()
  const position = Number(member.position)
  if (ladder && Number.isInteger(position) && position > 0) return `${ladder} · #${position}`
  return memberPrimaryLadder(member)
}

function recordScore(member) {
  const wins = Number(member.wins)
  const losses = Number(member.losses)
  return Number.isFinite(wins) && Number.isFinite(losses) ? wins - losses : -Infinity
}

function memberRecord(member) {
  const wins = Number(member.wins)
  const losses = Number(member.losses)
  return Number.isFinite(wins) && Number.isFinite(losses) ? `${wins}–${losses}` : '—'
}

function memberActivity(member) {
  const status = statusFor(member)
  const activity = String(member.recentActivity || member.activity || '').trim()
  const meta = String(member.recentActivityMeta || member.activityMeta || '').trim()
  if (activity) return { label: activity, meta: meta || member.memberNumber || 'Club activity', type: '' }
  if (status.key === 'needs') {
    return { label: 'Needs attention', meta: `Missing ${status.missing.join(', ')}`, type: 'issue' }
  }
  return {
    label: status.key === 'connected' ? 'Connected account' : 'Club record',
    meta: member.memberNumber || 'No recent activity',
    type: status.key === 'connected' ? 'win' : '',
  }
}

function compareMembers(left, right, key) {
  if (key === 'record') return recordScore(left) - recordScore(right)
  if (key === 'utr') return (memberRatingValue(left, 'utr') ?? -1) - (memberRatingValue(right, 'utr') ?? -1)
  if (key === 'activity') return memberActivity(left).label.localeCompare(memberActivity(right).label)
  if (key === 'ladder') return displayLadder(left).localeCompare(displayLadder(right))
  return String(left.name || '').localeCompare(String(right.name || ''))
}

function setSort(key) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDirection.value = 'asc'
  }
}

function closeMenus() {
  filterOpen.value = false
  addOpen.value = false
  actionMember.value = null
}

function chooseFilter(value) {
  filter.value = value
  filterOpen.value = false
}

function openMemberActions(member) {
  const wasOpen = actionMember.value?.id === member.id
  closeMenus()
  if (wasOpen) return
  actionMember.value = member
}
function viewMember(member) {
  actionMember.value = null
  detailMember.value = member
}

function closeMemberDrawer() {
  detailMember.value = null
}

function editMember(member) {
  actionMember.value = null
  router.push({ name: 'ClubMemberDetail', params: { memberId: member.id } })
}

function requestMemberRemoval(member) {
  actionMember.value = null
  memberPendingRemoval.value = member
  nextTick(() => removeDialog.value?.showModal())
}

function closeRemovalDialog() {
  removeDialog.value?.close()
  memberPendingRemoval.value = null
}

async function removeMemberFromClub() {
  if (!memberPendingRemoval.value || removalBusy.value) return
  removalBusy.value = true
  pageError.value = ''
  try {
    const name = memberPendingRemoval.value.name || 'Member'
    await adminStore.removeMemberRecord(memberPendingRemoval.value.id)
    if (detailMember.value?.id === memberPendingRemoval.value.id) closeMemberDrawer()
    notificationStore.addToast({ message: `${name} was removed from this club.`, type: 'success' })
    closeRemovalDialog()
  } catch (error) {
    pageError.value = error?.message || 'We could not remove this member.'
  } finally {
    removalBusy.value = false
  }
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
  closeMenus()
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
    notificationStore.addToast({ message: 'New club invite ready.', type: 'success' })
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
    notificationStore.addToast({ message: 'Club invite link copied.', type: 'success' })
  } catch {
    notificationStore.addToast({ message: 'Copy did not work. Select the link instead.', type: 'error' })
  }
}

function validInviteEmails() {
  return String(inviteEmails.value || '')
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    .slice(0, 20)
}

function openEmailApp() {
  if (!genericInviteLink.value) return
  const recipients = validInviteEmails()
  const subject = `Join ${club.value?.name || 'our tennis club'} on Gorra`
  const body = `Use this private club invitation to join ${club.value?.name || 'our club'} on Gorra:\n\n${genericInviteLink.value}`
  window.location.href = `mailto:${encodeURIComponent(recipients.join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function handleKeydown(event) {
  if (event.key === 'Escape') closeMenus()
}

onMounted(async () => {
  document.addEventListener('click', closeMenus)
  document.addEventListener('keydown', handleKeydown)
  try {
    await adminStore.loadClubs()
    if (route.query.invite === '1' && canManage.value) await openInvitePeople()
  } catch (error) {
    pageError.value = error?.message || 'We could not load the member directory.'
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenus)
  document.removeEventListener('keydown', handleKeydown)
})

useShellNestedHeader(() => ({
  label: 'Back to club',
  backLabel: 'Back to club',
  back: () => router.push({ name: 'Club' }),
  crumbs: [{ label: 'Club' }, { label: 'Members' }, { label: club.value?.name || 'Current club' }],
}))
</script>

<template>
  <main class="members-screen" @click.stop>
    <header class="page-head">
      <div class="page-title" :aria-label="`All members of ${club?.name || 'this club'}`">
        <div class="page-title-row">
          <h1>Members</h1>
          <span class="page-count">{{ directoryMembers.length }}</span>
        </div>
        <p>Everyone in your active club.</p>
      </div>

      <div v-if="canManage" class="primary-action">
        <div class="club-invite-menu">
          <button
            class="ref-button primary"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="addOpen"
            @click.stop="addOpen = !addOpen; filterOpen = false"
          >
            Add member

          </button>

          <div
            v-if="addOpen"
            class="club-invite-menu__panel"
            role="menu"
            @click.stop
          >
            <button type="button" role="menuitem" @click="openInvitePeople">
              <FlowIcon name="send" aria-hidden="true" />
              <span><strong>Invite people</strong><small>Send a club invitation</small></span>
            </button>

            <button
              type="button"
              role="menuitem"
              aria-label="Bring your data to Gorra"
              @click="closeMenus(); router.push({ name: 'ClubMemberImport' })"
            >
              <FlowIcon name="upload" aria-hidden="true" />
              <span><strong>Import members</strong><small>Bring in an existing list</small></span>
            </button>

            <button
              type="button"
              role="menuitem"
              aria-label="Add someone manually"
              @click="closeMenus(); router.push({ name: 'ClubMemberManual' })"
            >
              <FlowIcon name="plus" aria-hidden="true" />
              <span><strong>Add manually</strong><small>Create one member record</small></span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <p v-if="pageError" class="inline-alert" role="alert">{{ pageError }}</p>

    <section class="members-surface" aria-label="Club member directory">
      <div class="table-toolbar">
        <label class="search">
          <FlowIcon name="search" />
          <input v-model="search" type="search" autocomplete="off" placeholder="Search members" aria-label="Search name or email" />
          <button v-if="search" class="search-clear" type="button" aria-label="Clear member search" @click="search = ''"><FlowIcon name="close" /></button>
          <span v-else aria-hidden="true"></span>
        </label>

        <span v-if="filter !== 'all'" class="active-filter show">
          {{ activeFilterLabel }}
          <button type="button" aria-label="Clear member filter" @click="filter = 'all'">×</button>
        </span>

        <div class="filter-wrap">
          <button class="toolbar-action" type="button" aria-haspopup="menu" :aria-expanded="filterOpen" @click.stop="filterOpen = !filterOpen; addOpen = false">
            <FlowIcon name="sliders" /><span>Filter</span>
          </button>
          <div v-if="filterOpen" class="filter-menu open" role="menu">
            <div class="filter-label">Show</div>
            <button v-for="option in filterOptions" :key="option.value" class="filter-option" :class="{ active: filter === option.value }" type="button" role="menuitemradio" :aria-checked="filter === option.value" :aria-label="option.value === 'needs' ? 'Needs information' : option.value === 'connected' ? 'Connected accounts' : option.label" @click="chooseFilter(option.value)">
              {{ option.label }}<span>{{ option.count }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="table-head" aria-label="Member table headings">
        <button class="th sortable" :class="{ 'active-sort': sortKey === 'name' }" type="button" @click="setSort('name')">Member <svg class="sort-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3-3 3 3M9 7l-3 3-3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
        <button class="th sortable" :class="{ 'active-sort': sortKey === 'ladder' }" type="button" @click="setSort('ladder')">Ladder <svg class="sort-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3-3 3 3M9 7l-3 3-3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
        <button class="th sortable" :class="{ 'active-sort': sortKey === 'record' }" type="button" @click="setSort('record')">Record <svg class="sort-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3-3 3 3M9 7l-3 3-3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
        <button class="th sortable" :class="{ 'active-sort': sortKey === 'activity' }" type="button" @click="setSort('activity')">Recent activity <svg class="sort-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3-3 3 3M9 7l-3 3-3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
        <button class="th sortable" :class="{ 'active-sort': sortKey === 'utr' }" type="button" @click="setSort('utr')">UTR <svg class="sort-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3-3 3 3M9 7l-3 3-3-3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
        <span aria-hidden="true"></span>
      </div>

      <div v-if="visibleMembers.length" class="rows">
        <div
          v-for="member in visibleMembers"
          :key="member.id"
          class="member-row-wrap"
          :class="{ 'member-row-wrap--actions-open': actionMember?.id === member.id }"
        >
          <button class="member-row" type="button" @click="openMemberActions(member)">
          <span class="cell member-cell">
            <span class="avatar" aria-hidden="true"><img v-if="member.photoUrl" :src="member.photoUrl" alt="" /><span v-else>{{ initials(member.name) }}</span></span>
            <span class="member-copy"><strong>{{ member.name || 'Club member' }}</strong><small :class="{ issue: !member.email }">{{ member.email || 'Email missing' }}</small></span>
          </span>
          <span class="cell ladder-cell"><strong>{{ displayLadder(member) }}</strong><small>{{ member.memberNumber || statusFor(member).label }}</small></span>
          <span class="cell record">{{ memberRecord(member) }}</span>
          <span class="cell activity-cell"><strong :class="memberActivity(member).type">{{ memberActivity(member).label }}</strong><small>{{ memberActivity(member).meta }}</small></span>
          <span class="cell rating">{{ memberUtr(member) }}<small>UTR</small></span>
          <span class="cell menu-cell"><span class="row-menu-trigger" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></span></span>
          </button>

          <div
            v-if="actionMember?.id === member.id"
            class="row-actions open"
            role="menu"
            :aria-label="`Actions for ${member.name || 'member'}`"
            @click.stop
          >
            <button type="button" role="menuitem" @click="viewMember(member)">View member</button>
            <button v-if="canManage" type="button" role="menuitem" @click="editMember(member)">Edit details</button>
            <button v-if="canManage" class="danger" type="button" role="menuitem" @click="requestMemberRemoval(member)">Remove from club</button>
          </div>
        </div>
      </div>


      <p v-else class="empty" aria-label="You currently have no active members. People added to this club will appear here.">No members found.</p>

      <footer class="table-footer">
        <span>{{ visibleMembers.length }} member{{ visibleMembers.length === 1 ? '' : 's' }}</span>
        <div class="pagination" aria-label="Member page 1"><button type="button" disabled aria-label="Previous page">‹</button><button class="active" type="button" aria-current="page">1</button><button type="button" disabled aria-label="Next page">›</button></div>
      </footer>
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
          <textarea v-model="inviteEmails" rows="3" placeholder="one@example.com, two@example.com"></textarea>
        </div>
        <div class="ref-form-field" style="margin-top: 14px">
          <span>Club invite link</span>
          <input :value="genericInviteLink" readonly aria-label="Club invite link" />
        </div>
        <div class="ref-form-actions">
          <button class="ref-button" type="button" :disabled="inviteBusy" @click="makeNewInvite">{{ inviteBusy ? 'Making…' : 'Make new link' }}</button>
          <button class="ref-button" type="button" :disabled="!genericInviteLink" @click="copyInvite">Copy link</button>
          <button class="ref-button primary" type="button" :disabled="!genericInviteLink" @click="openEmailApp">Open email</button>
        </div>
      </div>
    </dialog>

    <div class="drawer-backdrop" :class="{ open: detailMember }" :aria-hidden="!detailMember" @click="closeMemberDrawer"></div>
    <aside class="detail-panel" :class="{ open: detailMember }" :aria-hidden="!detailMember" aria-label="Member profile">
      <div v-if="detailMember" class="detail-scroll">
        <header class="detail-top">
          <span class="detail-top-label">Member profile</span>
          <button class="detail-close" type="button" aria-label="Close member profile" @click="closeMemberDrawer"><FlowIcon name="close" /></button>
        </header>
        <div class="detail-body">
          <section class="detail-hero">
            <span class="detail-avatar" aria-hidden="true"><img v-if="detailMember.photoUrl" :src="detailMember.photoUrl" alt="" /><span v-else>{{ initials(detailMember.name) }}</span></span>
            <div class="detail-identity">
              <div class="detail-name-row"><h2>{{ detailMember.name || 'Club member' }}</h2></div>
              <p>{{ detailMember.email || 'No email address added' }}</p>
            </div>
          </section>

          <section class="detail-section">
            <h3 class="detail-section-title">Member details</h3>
            <dl class="detail-card">
              <div class="detail-row"><dt>Member number</dt><dd>{{ detailMember.memberNumber || 'Not assigned' }}</dd></div>
              <div class="detail-row"><dt>Email</dt><dd>{{ detailMember.email || 'Not provided' }}</dd></div>
              <div class="detail-row"><dt>Phone</dt><dd>{{ detailMember.phone || 'Not provided' }}</dd></div>
              <div class="detail-row"><dt>Level</dt><dd>{{ detailMember.level || 'Not provided' }}</dd></div>
              <div class="detail-row"><dt>Joined</dt><dd>{{ detailMember.yearOfEntry || 'Not provided' }}</dd></div>
              <div class="detail-row bio-row"><dt>Bio</dt><dd>{{ detailMember.bio || 'No biography has been added yet.' }}</dd></div>
            </dl>
          </section>

          <section class="detail-section">
            <h3 class="detail-section-title">Ratings</h3>
            <div class="rating-list">
              <div class="rating-line"><span>UTR</span><strong>{{ memberUtr(detailMember) }}</strong></div>
              <div class="rating-line"><span>Record</span><strong>{{ memberRecord(detailMember) }}</strong></div>
            </div>
          </section>

          <section class="detail-section">
            <h3 class="detail-section-title">Ladder</h3>
            <div class="ladder-list"><div class="ladder-item"><strong>{{ displayLadder(detailMember) }}</strong><span>{{ memberActivity(detailMember).label }}</span></div></div>
          </section>
        </div>
      </div>
    </aside>

    <dialog ref="removeDialog" class="remove-member-dialog" @close="memberPendingRemoval = null">
      <div class="remove-member-dialog__body">
        <h2>Remove member?</h2>
        <p>Remove <strong>{{ memberPendingRemoval?.name || 'this member' }}</strong> from {{ club?.name || 'this club' }}? Their club record and active membership will be removed.</p>
        <div class="remove-member-dialog__actions">
          <button type="button" :disabled="removalBusy" @click="closeRemovalDialog">Cancel</button>
          <button class="danger" type="button" :disabled="removalBusy" @click="removeMemberFromClub">{{ removalBusy ? 'Removing…' : 'Remove member' }}</button>
        </div>
      </div>
    </dialog>
  </main>
</template>

<style scoped>
.members-screen{
  --color-bg:#ffffff;
  --color-surface:#ffffff;
  --color-surface-soft:#f4f7f5;
  --color-surface-muted:#fbfcfd;

  --color-primary:#00b51a;
  --color-primary-strong:#008f15;
  --color-primary-dark:#163d2b;

  --color-text:#162218;
  --color-text-soft:#425044;
  --color-muted:#6d7a70;

  --color-border:#e3e9e4;
  --color-border-strong:#d2dbd4;

  --color-danger:#a0443c;

  --app-card-radius:10px;
  --app-inner-radius:7px;
  --app-control-height:44px;
  --app-control-radius:9px;

  --flow-shadow-quiet:0 8px 24px rgba(15,34,24,.025);
  --flow-shadow-hover:0 11px 28px rgba(15,34,24,.045);

  --motion-short:110ms;
  --motion-curve:cubic-bezier(.22,1,.32,1);
  --focus-ring:rgba(0,181,26,.22);

  --sidebar-w:220px;
  --header-h:78px;

  font-family:Inter,'Avenir Next','Segoe UI',sans-serif;
}

*{box-sizing:border-box}

html{
  min-width:0;
  overflow-x:hidden;
  text-size-adjust:100%;
  -webkit-text-size-adjust:100%;
}

body{
  overflow-x:hidden;
}

img,svg{max-width:100%}

button,input,a{
  -webkit-tap-highlight-color:transparent;
}

button,a{
  touch-action:manipulation;
}

.member-copy,
.ladder-cell,
.activity-cell,
.detail-identity,
.detail-row dd,
.detail-row dt{
  min-width:0;
}

.member-copy small,
.ladder-cell strong,
.ladder-cell small,
.activity-cell strong,
.activity-cell small,
.detail-row dd,
.detail-row dt{
  overflow-wrap:anywhere;
  word-break:break-word;
}

.members-screen{
  margin:0;
  min-height:100%;
  background:var(--color-bg);
  color:var(--color-text);
  -webkit-font-smoothing:antialiased;
}

.members-screen{min-height:100vh}

button,input{
  font:inherit;
  color:inherit;
}

button{cursor:pointer}

.page-title h1,
.member-copy strong,
.detail-hero h2{
  letter-spacing:-0.018em;
}

.member-copy strong,
.ladder-cell strong,
.activity-cell strong,
.record,
.rating{
  line-height:1.25;
}

.member-copy small,
.ladder-cell small,
.activity-cell small,
.page-title p{
  line-height:1.45;
}

button,
.member-row,
.toolbar-action,
.add-button,
.row-menu-trigger{
  transition:
    transform var(--motion-short) var(--motion-curve),
    background var(--motion-short) var(--motion-curve),
    border-color var(--motion-short) var(--motion-curve),
    color var(--motion-short) var(--motion-curve),
    box-shadow var(--motion-short) var(--motion-curve);
}

button:active:not(:disabled){
  transform:scale(.97);
}

button:focus-visible,
input:focus-visible{
  outline:none;
  box-shadow:0 0 0 2px var(--focus-ring);
}

/* APP SHELL */
.sidebar{
  position:fixed;
  inset:0 auto 0 0;
  z-index:30;
  width:var(--sidebar-w);
  min-height:100vh;
  padding:20px 16px;
  background:#fff;
  border-right:1px solid #edf0ed;
}

.brand{
  height:44px;
  margin-bottom:18px;
  padding:0 4px;
  display:flex;
  align-items:center;
  gap:10px;
  color:#26332b;
  font-size:23px;
  font-weight:750;
  letter-spacing:-.045em;
}

.brand-mark{
  position:relative;
  width:30px;
  height:30px;
  overflow:hidden;
  border-radius:50%;
  background:#b5d10a;
  transform:rotate(-22deg);
}

.brand-mark::before,.brand-mark::after{
  content:"";
  position:absolute;
  height:6px;
  border-radius:999px;
  background:#fff;
  transform:rotate(28deg);
}

.brand-mark::before{width:25px;left:7px;top:7px}
.brand-mark::after{width:22px;left:1px;top:18px}

.club-switcher{
  margin-bottom:22px;
  padding:12px 13px;
  border:.5px solid var(--color-border);
  border-radius:10px;
  background:#fff;
}

.club-switcher small{
  display:block;
  color:#8a948d;
  font-size:9px;
  font-weight:650;
  letter-spacing:.07em;
  text-transform:uppercase;
}

.club-switcher strong{
  display:block;
  margin-top:3px;
  color:#2b372f;
  font-size:11px;
  font-weight:650;
}

.nav{display:grid;gap:5px}

.nav button{
  width:100%;
  min-height:48px;
  padding:0 13px;
  border:0;
  border-radius:10px;
  background:transparent;
  color:#59655d;
  display:flex;
  align-items:center;
  gap:11px;
  text-align:left;
  font-size:11.5px;
  font-weight:600;
}

.nav button:hover{background:#f4f6f4}
.nav button.active{
  background:var(--color-primary-dark);
  color:#fff;
  box-shadow:0 5px 14px rgba(22,61,43,.11);
}

.nav svg{
  width:19px;height:19px;
  fill:none;stroke:currentColor;stroke-width:1.7;
  stroke-linecap:round;stroke-linejoin:round;
}

.app-header{
  position:fixed;
  inset:0 0 auto var(--sidebar-w);
  z-index:20;
  height:var(--header-h);
  background:rgba(255,255,255,.97);
  border-bottom:1px solid #edf0ed;
  backdrop-filter:blur(10px);
}

.header-inner{
  width:min(92%,1240px);
  height:100%;
  margin:auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
}

.header-copy small{
  display:block;
  margin-bottom:3px;
  color:#939c96;
  font-size:9px;
}

.header-copy strong{
  display:block;
  color:#253129;
  font-size:17px;
  font-weight:650;
  letter-spacing:-.025em;
}

.account{
  display:flex;
  align-items:center;
  gap:9px;
  padding:4px 10px 4px 4px;
  border:.5px solid var(--color-border);
  border-radius:999px;
  background:#fff;
}

.account-avatar{
  width:34px;height:34px;
  border-radius:50%;
  display:grid;place-items:center;
  background:var(--color-surface-soft);
  color:var(--color-primary-strong);
  font-size:10px;
  font-weight:700;
}

.account strong{display:block;font-size:10px}
.account small{display:block;color:#939b95;font-size:8px}

.main{
  min-height:100vh;
  margin-left:var(--sidebar-w);
  padding-top:var(--header-h);
  background:#fff;
}

.content{
  width:min(92%,1240px);
  margin:0 auto;
  padding:56px 0 96px;
}

/* PAGE */
.page-head{
  margin-bottom:40px;
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:22px;
}

.page-title{
  display:grid;
  gap:5px;
}

.page-title-row{
  display:flex;
  align-items:baseline;
  gap:10px;
}

.page-title h1{
  margin:0;
  color:var(--color-text);
  font-size:27px;
  line-height:1.18;
  font-weight:650;
  letter-spacing:-.02em;
}

.page-count{
  color:var(--muted-2);
  font-size:13px;
  font-weight:650;
}

.page-title p{
  margin:0;
  color:var(--color-muted);
  font-size:12px;
  line-height:1.55;
}

.primary-action{
  position:relative;
  flex:0 0 auto;
}

.add-button{
  min-height:38px;
  padding:0 13px;
  border:1px solid var(--color-primary);
  border-radius:var(--app-inner-radius);
  background:var(--color-primary);
  color:#fff;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  font-size:11.5px;
  font-weight:650;
}

.add-button:hover{background:#126b41}

.add-button svg{
  width:15px;height:15px;
  fill:none;stroke:currentColor;stroke-width:1.8;
  stroke-linecap:round;stroke-linejoin:round;
}

.add-menu{
  position:absolute;
  top:46px;
  right:0;
  z-index:50;
  width:220px;
  padding:6px;
  border:.5px solid var(--color-border);
  border-radius:10px;
  background:#fff;
  box-shadow:0 16px 42px rgba(22,39,27,.12);
  opacity:0;
  transform:translateY(-4px);
  pointer-events:none;
  transition:.14s ease;
}

.add-menu.open{
  opacity:1;
  transform:translateY(0);
  pointer-events:auto;
}

.add-menu button{
  width:100%;
  min-height:39px;
  padding:0 10px;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#4c5850;
  display:flex;
  align-items:center;
  gap:9px;
  text-align:left;
  font-size:10.5px;
  font-weight:600;
}

.add-menu button:hover{background:var(--color-surface-soft)}

.add-menu svg{
  width:15px;height:15px;
  fill:none;stroke:#7f8a82;stroke-width:1.8;
  stroke-linecap:round;stroke-linejoin:round;
}

/* TABLE AREA */
.members-surface{
  display:grid;
  gap:18px;
}

/* Toolbar feels like Play cards */
.table-toolbar{
  min-height:50px;
  padding:0 4px;
  display:flex;
  align-items:center;
  gap:10px;
}

.search{
  width:min(100%,430px);
  min-width:240px;
  min-height:var(--app-control-height);
  padding:0 12px;
  border:.5px solid transparent;
  border-radius:var(--app-control-radius);
  background:rgba(244,247,245,.58);
  display:flex;
  align-items:center;
  gap:9px;
  transition:
    background var(--motion-short) var(--motion-curve),
    border-color var(--motion-short) var(--motion-curve),
    box-shadow var(--motion-short) var(--motion-curve);
}

.search:hover{
  background:rgba(244,247,245,.76);
}

.search:focus-within{
  border-color:rgba(0,181,26,.22);
  background:rgba(244,247,245,.82);
  box-shadow:0 0 0 3px rgba(0,181,26,.055);
}

.search svg{
  width:15px;height:15px;
  flex:none;
  fill:none;stroke:#879188;stroke-width:1.8;
}

.search input{
  width:100%;
  min-width:0;
  height:40px;
  border:0;
  outline:0;
  background:transparent;
  color:var(--color-text);
  font-size:12px;
}

.search-clear{
  width:28px;height:28px;
  padding:0;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#959e98;
  font-size:17px;
}

.search-clear:hover{background:#e8ece8}

.toolbar-action{
  min-height:var(--app-control-height);
  padding:0 14px;
  border:.5px solid var(--color-border);
  border-radius:var(--app-control-radius);
  background:#fff;
  color:#5f6b63;
  display:inline-flex;
  align-items:center;
  gap:7px;
  font-size:11px;
  font-weight:600;
}

.toolbar-action:hover{background:var(--color-surface-soft)}

.toolbar-action svg{
  width:15px;height:15px;
  fill:none;stroke:currentColor;stroke-width:1.8;
  stroke-linecap:round;stroke-linejoin:round;
}

.filter-wrap{position:relative}

.filter-menu{
  position:absolute;
  top:46px;
  right:0;
  z-index:60;
  width:220px;
  padding:6px;
  border:.5px solid var(--color-border);
  border-radius:10px;
  background:#fff;
  box-shadow:0 16px 42px rgba(22,39,27,.12);
  opacity:0;
  transform:translateY(-4px);
  pointer-events:none;
  transition:.14s ease;
}

.filter-menu.open{
  opacity:1;
  transform:translateY(0);
  pointer-events:auto;
}

.filter-label{
  padding:8px 9px 6px;
  color:#98a099;
  font-size:8px;
  font-weight:700;
  letter-spacing:.07em;
  text-transform:uppercase;
}

.filter-option{
  width:100%;
  min-height:38px;
  padding:0 9px;
  border:0;
  border-radius:7px;
  background:transparent;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  color:#4c5850;
  font-size:10.5px;
  font-weight:600;
  text-align:left;
}

.filter-option:hover{background:var(--color-surface-soft)}
.filter-option.active{color:var(--color-primary)}

.filter-count{
  color:#9ba39d;
  font-size:9px;
}

.active-filter{
  display:none;
  align-items:center;
  gap:5px;
  min-height:30px;
  padding:0 8px;
  border-radius:7px;
  background:var(--color-surface-soft);
  color:var(--color-primary-strong);
  font-size:9px;
  font-weight:600;
}

.active-filter.show{display:inline-flex}

.active-filter button{
  width:18px;height:18px;
  padding:0;
  border:0;
  background:transparent;
  color:inherit;
  font-size:13px;
}

/* Header is separated from rows like Play section headings */
.table-head{
  min-height:46px;
  padding:0 18px;
  border:.5px solid rgba(231,236,232,.92);
  border-radius:var(--app-card-radius);
  background:rgba(244,247,245,.34);
  box-shadow:0 1px 2px rgba(15,34,24,.012);
  display:grid;
  grid-template-columns:
    minmax(250px,1.65fr)
    minmax(185px,1.05fr)
    minmax(105px,.52fr)
    minmax(190px,1.05fr)
    minmax(90px,.46fr)
    34px;
  align-items:center;
  color:#78857c;
}

.th{
  height:40px;
  padding:0 10px;
  border:0;
  background:transparent;
  color:inherit;
  display:flex;
  align-items:center;
  gap:5px;
  text-align:left;
  font-size:9.5px;
  font-weight:700;
  letter-spacing:.06em;
  text-transform:uppercase;
}

.th:first-child{padding-left:0}

.table-head > .th:not(:first-child){
  position:relative;
}

.table-head > .th:not(:first-child)::before{
  content:'';
  position:absolute;
  left:0;
  top:13px;
  bottom:13px;
  width:.5px;
  background:rgba(215,223,216,.42);
}

.th.sortable:hover{color:var(--color-text)}
.th.active-sort{color:var(--color-primary)}

.sort-icon{
  width:10px;height:10px;
  opacity:0;
}

.th.sortable:hover .sort-icon,
.th.active-sort .sort-icon{
  opacity:1;
}

/* Rows = Play cards */
.rows{
  display:grid;
  gap:13px;
  margin-top:2px;
}

.member-row-wrap{
  position:relative;
  z-index:0;
}

.member-row-wrap--actions-open{z-index:20}
.member-row{
  width:100%;
  min-height:88px;
  padding:0 20px;
  border:.5px solid var(--color-border);
  border-radius:var(--app-card-radius);
  background:#fff;
  box-shadow:var(--flow-shadow-quiet);
  display:grid;
  grid-template-columns:
    minmax(250px,1.65fr)
    minmax(185px,1.05fr)
    minmax(105px,.52fr)
    minmax(190px,1.05fr)
    minmax(90px,.46fr)
    34px;
  align-items:center;
  text-align:left;
  transition:
    background .12s ease,
    border-color .12s ease,
    transform .12s ease,
    box-shadow .12s ease;
}

.member-row:hover{
  background:#fbfdfb;
  border-color:var(--color-border-strong);
  box-shadow:var(--flow-shadow-hover);
  transform:translateY(-.5px);
}

.cell{
  min-width:0;
  padding:20px 12px;
}

.cell:first-child{padding-left:0}

.member-cell{
  display:flex;
  align-items:center;
  gap:12px;
}

.avatar{
  width:44px;
  height:44px;
  flex:none;
  border-radius:50%;
  background:var(--color-surface-soft);
  color:var(--color-primary-strong);
  display:grid;
  place-items:center;
  font-size:10px;
  font-weight:700;
}

.member-copy{min-width:0}

.member-copy strong{
  display:block;
  overflow:hidden;
  color:var(--color-text);
  font-size:13.5px;
  font-weight:650;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.member-copy small{
  display:block;
  overflow:hidden;
  margin-top:5px;
  color:var(--color-muted);
  font-size:10.5px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.member-copy small.issue{
  color:var(--color-danger);
}

.ladder-cell strong,
.activity-cell strong{
  display:block;
  overflow:hidden;
  color:#465149;
  font-size:11px;
  font-weight:600;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.ladder-cell small,
.activity-cell small{
  display:block;
  overflow:hidden;
  margin-top:5px;
  color:var(--color-muted);
  font-size:10px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.activity-cell strong.win{color:var(--color-primary)}
.activity-cell strong.issue{color:var(--color-danger)}

.record{
  color:#344039;
  font-size:12px;
  font-weight:650;
  font-variant-numeric:tabular-nums;
  text-align:center;
}

.rating{
  color:#344039;
  font-size:12px;
  font-weight:650;
  font-variant-numeric:tabular-nums;
  text-align:right;
}

.rating small{
  display:block;
  margin-top:4px;
  color:var(--color-muted);
  font-size:8.5px;
  font-weight:600;
}

.row-menu-trigger{
  width:30px;height:30px;
  padding:0;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#929a94;
  display:grid;
  place-items:center;
  opacity:.45;
}

.member-row:hover .row-menu-trigger{opacity:1}
.row-menu-trigger:hover{background:var(--color-surface-soft);color:#58645d}

.row-menu-trigger svg{
  width:16px;height:16px;
  fill:currentColor;
}

.table-footer{
  min-height:56px;
  padding:6px 4px 0;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
}

.result-count{
  color:var(--color-muted);
  font-size:10px;
}

.pagination{
  display:flex;
  align-items:center;
  gap:4px;
}

.page-btn{
  width:30px;height:30px;
  padding:0;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#7b867e;
  display:grid;
  place-items:center;
  font-size:10px;
}

.page-btn:hover{background:var(--color-surface-soft)}
.page-btn.active{
  background:var(--color-surface-soft);
  color:var(--color-primary-strong);
  font-weight:700;
}

.empty{
  padding:44px 20px;
  border:.5px solid var(--color-border);
  border-radius:10px;
  color:var(--color-muted);
  text-align:center;
  font-size:11px;
}

/* ROW ACTIONS */
.row-actions{
  position:absolute;
  z-index:20;
  top:calc(100% + 8px);
  right:12px;
  width:170px;
  padding:6px;
  border:.5px solid var(--color-border);
  border-radius:9px;
  background:#fff;
  box-shadow:0 14px 35px rgba(22,39,27,.12);
  display:none;
}

.row-actions.open{display:block}

.row-actions button{
  width:100%;
  min-height:36px;
  padding:0 9px;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#4f5b53;
  text-align:left;
  font-size:10px;
  font-weight:600;
}

.row-actions button:hover{background:var(--color-surface-soft)}
.row-actions button.danger{color:var(--color-danger)}
/* MEMBER DETAIL */
.drawer-backdrop{
  position:fixed;
  inset:0;
  z-index:78;
  background:rgba(21,34,25,.14);
  opacity:0;
  pointer-events:none;
  transition:opacity var(--motion-short) var(--motion-curve);
}

.drawer-backdrop.open{
  opacity:1;
  pointer-events:auto;
}

.detail-panel{
  position:fixed;
  inset:0 0 0 auto;
  z-index:80;
  width:min(440px,100%);
  height:100dvh;
  padding:0;
  overflow:hidden;
  background:#fbfdfb;
  box-shadow:-20px 0 60px rgba(21,39,27,.12);
  transform:translateX(102%);
  transition:transform 180ms var(--motion-curve);
}

.detail-panel.open{transform:translateX(0)}

.detail-scroll{
  height:100%;
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-width:thin;
  scrollbar-color:#d9e0da transparent;
}

.detail-scroll::-webkit-scrollbar{width:7px}
.detail-scroll::-webkit-scrollbar-thumb{
  border-radius:999px;
  background:#d9e0da;
}

.detail-top{
  position:sticky;
  top:0;
  z-index:3;
  min-height:68px;
  padding:15px 22px 12px;
  border-bottom:.5px solid rgba(215,223,216,.7);
  background:rgba(241,248,243,.62);
  backdrop-filter:blur(14px);
  display:flex;
  align-items:center;
  justify-content:space-between;
}

.detail-top-label{
  color:#66736a;
  font-size:11px;
  font-weight:600;
  letter-spacing:.01em;
}

.detail-close{
  width:34px;
  height:34px;
  padding:0;
  border:.5px solid rgba(0,181,26,.10);
  border-radius:var(--app-inner-radius);
  background:rgba(0,181,26,.065);
  color:var(--color-primary-strong);
  display:grid;
  place-items:center;
  font-size:18px;
}

.detail-close:hover{
  border-color:rgba(0,181,26,.18);
  background:rgba(0,181,26,.10);
}

.detail-body{
  padding:18px 28px 52px;
}

.detail-hero{
  display:grid;
  grid-template-columns:56px minmax(0,1fr);
  gap:13px;
  align-items:center;
  padding:10px 0 28px;
}

.detail-avatar{
  width:56px;
  height:56px;
  border-radius:50%;
  background:var(--color-surface-soft);
  color:var(--color-primary-strong);
  display:grid;
  place-items:center;
  font-size:12px;
  font-weight:750;
}

.detail-identity{
  min-width:0;
}

.detail-name-row{
  display:flex;
  min-width:0;
  align-items:center;
  gap:7px;
}

.detail-name-row h2{
  min-width:0;
  overflow:hidden;
  margin:0;
  color:var(--color-text);
  font-size:21px;
  font-weight:620;
  letter-spacing:-.02em;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.detail-edit{
  width:31px;
  height:31px;
  flex:0 0 auto;
  padding:0;
  border:.5px solid rgba(0,181,26,.08);
  border-radius:var(--app-inner-radius);
  background:rgba(0,181,26,.045);
  color:var(--color-primary-strong);
  display:grid;
  place-items:center;
}

.detail-edit:hover{
  border-color:rgba(0,181,26,.16);
  background:rgba(0,181,26,.085);
}

.detail-edit svg{
  width:15px;
  height:15px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.7;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.detail-hero p{
  margin:6px 0 0;
  color:var(--color-muted);
  font-size:10.5px;
  font-weight:450;
}

.detail-section{
  margin-top:34px;
}

.detail-section:first-of-type{
  margin-top:12px;
}

.detail-section-head{
  margin-bottom:14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

.detail-section-title{
  margin:0;
  color:#4e5d53;
  font-size:12px;
  font-weight:600;
  letter-spacing:-.005em;
}

.detail-card{
  overflow:hidden;
  border:.5px solid rgba(215,223,216,.78);
  border-radius:var(--app-card-radius);
  background:rgba(241,248,243,.52);
  box-shadow:0 7px 20px rgba(15,34,24,.018);
}

.detail-row{
  min-height:60px;
  padding:14px 16px;
  display:grid;
  grid-template-columns:minmax(100px,.72fr) minmax(0,1.28fr);
  gap:14px;
  align-items:start;
}

.detail-row + .detail-row{
  border-top:.5px solid rgba(215,223,216,.52);
}

.detail-row dt{
  margin:0;
  color:#89948c;
  font-size:10px;
  font-weight:450;
  line-height:1.5;
}

.detail-row dd{
  margin:0;
  color:#3d4941;
  font-size:11.5px;
  font-weight:560;
  line-height:1.5;
  text-align:right;
  overflow-wrap:anywhere;
}

.detail-row.bio-row{
  grid-template-columns:1fr;
  gap:7px;
}

.detail-card .detail-row{
  transition:
    background var(--motion-short) var(--motion-curve);
}

.detail-card .detail-row:hover{
  background:rgba(0,181,26,.025);
}

.detail-row.bio-row dd{
  color:#56635b;
  font-size:11px;
  font-weight:500;
  line-height:1.72;
  text-align:left;
}

.rating-list{
  display:grid;
  gap:8px;
}

.rating-line{
  min-height:50px;
  padding:0 14px;
  border:.5px solid rgba(215,223,216,.70);
  border-radius:var(--app-inner-radius);
  background:rgba(241,248,243,.46);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
}

.rating-line span{
  color:#77847b;
  font-size:10px;
}

.rating-line strong{
  color:#39463e;
  font-size:11.5px;
  font-weight:580;
}

.ladder-list{
  display:grid;
  gap:9px;
}

.ladder-item{
  padding:14px 15px;
  border:.5px solid rgba(215,223,216,.72);
  border-radius:var(--app-inner-radius);
  background:rgba(241,248,243,.42);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
}

.ladder-item strong{
  color:#3f4c43;
  font-size:11.5px;
  font-weight:570;
}

.ladder-item span{
  color:var(--color-primary-strong);
  font-size:10px;
  font-weight:560;
}

@media(max-width:800px){
  .drawer-backdrop{
    background:rgba(21,34,25,.22);
  }

  .detail-panel{
    width:100%;
    top:auto;
    bottom:0;
    height:min(86dvh,780px);
    border-radius:16px 16px 0 0;
    transform:translateY(104%);
  }

  .detail-panel.open{
    transform:translateY(0);
  }

  .detail-top{
    padding:16px 7% 12px;
  }

  .detail-top::before{
    content:'';
    position:absolute;
    top:7px;
    left:50%;
    width:38px;
    height:3px;
    border-radius:999px;
    background:#dfe5e0;
    transform:translateX(-50%);
  }

  .detail-body{
    width:86%;
    margin:0 auto;
    padding:14px 0 calc(44px + env(safe-area-inset-bottom,0px));
  }

  .detail-hero{
    grid-template-columns:52px minmax(0,1fr);
    padding-top:10px;
  }

  .detail-avatar{
    width:52px;
    height:52px;
  }

  .detail-name-row h2{
    font-size:18px;
  }

  .detail-row{
    min-height:58px;
    padding:13px 14px;
  }
}


/* MEMBER EDIT — restrained refinement of the existing GORRA form */
.member-edit-screen{
  display:none;
}

.member-edit-screen.open{
  display:block;
}

.members-screen.hidden{
  display:none;
}

.member-edit-wrap{
  width:min(86%,820px);
  margin:0 auto;
  padding:48px 0 110px;
}

.member-edit-hero{
  margin-bottom:28px;
  display:flex;
  align-items:center;
  gap:15px;
}

.member-edit-avatar{
  width:58px;
  height:58px;
  flex:0 0 58px;
  border-radius:16px;
  background:#edf3ee;
  color:#4b7355;
  display:grid;
  place-items:center;
  font-size:14px;
  font-weight:600;
}

.member-edit-title{
  min-width:0;
}

.member-edit-title h1{
  margin:0;
  color:var(--color-text);
  font-size:22px;
  font-weight:620;
  line-height:1.2;
  letter-spacing:-.02em;
}

.member-edit-title p{
  margin:5px 0 0;
  color:var(--color-muted);
  font-size:11px;
}

.member-edit-form{
  padding:26px;
  border:.5px solid var(--color-border);
  border-radius:12px;
  background:#fff;
  box-shadow:0 8px 24px rgba(15,34,24,.018);
}

.member-edit-section + .member-edit-section{
  margin-top:34px;
  padding-top:30px;
  border-top:.5px solid rgba(45,58,49,.065);
}

.member-edit-section-head{
  margin-bottom:20px;
}

.member-edit-section-head strong{
  color:#3f4b43;
  font-size:13px;
  font-weight:600;
}

.member-edit-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  column-gap:18px;
  row-gap:22px;
}

.member-edit-field{
  min-width:0;
  display:grid;
  gap:7px;
  align-content:start;
}

.member-edit-field.full{
  grid-column:1 / -1;
}

.member-edit-field > span{
  color:#59645d;
  font-size:10.5px;
  font-weight:560;
}

.member-edit-field > small{
  color:#879188;
  font-size:9.5px;
  line-height:1.45;
}

.member-edit-field input,
.member-edit-field select,
.member-edit-field textarea{
  width:100%;
  min-width:0;
  min-height:44px;
  padding:0 12px;
  border:.5px solid #dce3dd;
  border-radius:9px;
  background:#fff;
  color:#39463e;
  font-size:12px;
  font-weight:450;
  outline:none;
}

.member-edit-field textarea{
  min-height:112px;
  padding:11px 12px;
  resize:vertical;
}

.member-edit-field input:focus,
.member-edit-field select:focus,
.member-edit-field textarea:focus{
  border-color:rgba(0,181,26,.3);
  box-shadow:0 0 0 3px rgba(0,181,26,.055);
}

.member-edit-subsection{
  grid-column:1 / -1;
  margin-top:2px;
}

.member-edit-subsection + .member-edit-subsection{
  margin-top:8px;
  padding-top:22px;
  border-top:.5px solid rgba(45,58,49,.05);
}

.member-edit-subhead{
  margin-bottom:14px;
}

.member-edit-subhead strong{
  display:block;
  color:#4b584f;
  font-size:11.5px;
  font-weight:580;
}

.member-edit-subhead small{
  display:block;
  margin-top:3px;
  color:#8d9690;
  font-size:9.5px;
}

.member-edit-ratings{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
}

.member-edit-ladders{
  display:grid;
  gap:9px;
}

.member-edit-ladder{
  padding:13px 14px;
  border:.5px solid rgba(215,223,216,.68);
  border-radius:9px;
  background:rgba(241,248,243,.34);
  display:grid;
  grid-template-columns:minmax(0,1fr) 120px;
  gap:16px;
  align-items:center;
}

.member-edit-ladder-copy strong{
  display:block;
  color:#3f4b43;
  font-size:11px;
  font-weight:570;
}

.member-edit-ladder-copy small{
  display:block;
  margin-top:3px;
  color:#879188;
  font-size:9.5px;
}

.member-edit-actions{
  margin-top:28px;
  padding-top:20px;
  border-top:.5px solid rgba(45,58,49,.065);
  display:flex;
  justify-content:flex-end;
  gap:8px;
}

.member-edit-btn{
  min-height:38px;
  padding:0 13px;
  border:.5px solid var(--color-border);
  border-radius:8px;
  background:#fff;
  color:#58645d;
  font-size:11px;
  font-weight:580;
}

.member-edit-btn.primary{
  border-color:var(--color-primary);
  background:var(--color-primary);
  color:#fff;
}

.member-edit-btn.primary:hover{
  background:var(--color-primary-strong);
}

@media(max-width:720px){
  .member-edit-wrap{
    width:86%;
    padding-top:38px;
  }

  .member-edit-form{
    padding:21px;
  }

  .member-edit-grid{
    grid-template-columns:1fr;
    row-gap:19px;
  }

  .member-edit-field.full,
  .member-edit-subsection{
    grid-column:auto;
  }

  .member-edit-ratings{
    grid-template-columns:1fr;
  }

  .member-edit-ladder{
    grid-template-columns:1fr;
    gap:12px;
  }
}

@media(max-width:359px){
  .member-edit-wrap{
    width:88%;
  }

  .member-edit-form{
    padding:17px;
  }

  .member-edit-hero{
    align-items:flex-start;
  }

  .member-edit-avatar{
    width:50px;
    height:50px;
    flex-basis:50px;
  }

  .member-edit-title h1{
    font-size:19px;
  }

  .member-edit-actions{
    display:grid;
    grid-template-columns:1fr 1fr;
  }

  .member-edit-btn{
    width:100%;
  }
}

@media(max-width:259px){
  .member-edit-wrap{
    width:92%;
    padding-top:24px;
  }

  .member-edit-hero{
    display:grid;
    grid-template-columns:1fr;
    text-align:center;
  }

  .member-edit-avatar{
    margin:0 auto;
  }

  .member-edit-form{
    padding:13px;
  }

  .member-edit-section + .member-edit-section{
    margin-top:28px;
    padding-top:24px;
  }

  .member-edit-actions{
    grid-template-columns:1fr;
  }
}

/* DIALOG */
dialog{
  width:min(470px,calc(100% - 28px));
  padding:0;
  border:0;
  border-radius:13px;
  background:#fff;
  box-shadow:0 24px 70px rgba(17,34,22,.18);
}

dialog::backdrop{background:rgba(18,28,21,.3)}

.dialog-inner{padding:21px}

.dialog-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:15px;
}

.dialog-head h2{
  margin:0;
  color:var(--color-text);
  font-size:17px;
  font-weight:600;
}

.dialog-head p{
  margin:5px 0 0;
  color:var(--color-muted);
  font-size:12px;
}

.dialog-close{
  width:30px;height:30px;
  padding:0;
  border:.5px solid var(--color-border);
  border-radius:8px;
  background:#fff;
  color:#69746c;
  font-size:18px;
}

.field{
  display:grid;
  gap:6px;
  margin-top:17px;
}

.field span{
  color:#5f6b63;
  font-size:11px;
  font-weight:600;
}

.field input{
  width:100%;
  min-height:42px;
  padding:0 10px;
  border:.5px solid var(--color-border);
  border-radius:8px;
  background:#fff;
  outline:0;
  font-size:11px;
}

.field input:focus{
  border-color:var(--color-primary-strong);
  outline:2px solid rgba(22,117,72,.1);
  outline-offset:1px;
}

.dialog-actions{
  margin-top:20px;
  display:flex;
  justify-content:flex-end;
  gap:9px;
}

.btn{
  min-height:36px;
  padding:0 13px;
  border:1px solid #d8e0da;
  border-radius:8px;
  background:#fff;
  color:#58645d;
  font-size:11px;
  font-weight:600;
}

.btn.primary{
  border-color:var(--color-primary-strong);
  background:var(--color-primary);
  color:#fff;
}

.toast{
  position:fixed;
  right:22px;
  bottom:22px;
  z-index:100;
  min-width:230px;
  padding:11px 13px;
  border-radius:9px;
  background:var(--color-primary-dark);
  color:#fff;
  box-shadow:0 15px 38px rgba(20,46,29,.16);
  opacity:0;
  transform:translateY(8px);
  pointer-events:none;
  transition:.18s ease;
}

.toast.show{opacity:1;transform:translateY(0)}
.toast strong{display:block;font-size:10.5px}
.toast span{display:block;margin-top:2px;color:#dbe8dd;font-size:9px}



/* EXTREME RESPONSIVE HARDENING */
@media(max-width:680px){
  .content{width:88%;padding-top:40px}
  .page-head{gap:16px}
  .table-toolbar{align-items:stretch}
  .search{min-width:0}
  .filter-menu,.add-menu{max-width:calc(100vw - 24px)}
}

@media(max-width:430px){
  .header-inner,.content{width:86%}
  .content{
    padding-top:36px;
    padding-bottom:calc(112px + env(safe-area-inset-bottom,0px));
  }

  .page-head{margin-bottom:26px}
  .page-title h1{font-size:23px}
  .page-title p{display:none}

  .add-button{
    min-width:40px;
    padding:0 11px;
    font-size:0;
  }

  .add-button svg{width:17px;height:17px}

  .table-toolbar{
    min-height:0;
    padding:0;
    gap:8px;
    flex-wrap:wrap;
  }

  .search{flex:1 1 100%;width:100%;min-height:42px}
  .toolbar-action{min-height:40px}
  .active-filter.show{min-height:28px}

  .member-row{
    padding:16px 15px;
    border-radius:9px;
  }

  .member-copy strong{font-size:13.5px}
  .member-copy small{font-size:9.75px}

  .ladder-cell strong,
  .activity-cell strong{font-size:10.25px}

  .record,.rating{font-size:11.5px}

  .detail-panel{height:min(90dvh,820px)}
  .detail-body{width:86%}
}

@media(max-width:359px){
  .header-inner,.content{width:88%}
  .header-inner{justify-content:center}
  .header-copy{width:100%}
  .header-copy strong{font-size:14px}
  .account{display:none}

  .page-head{align-items:center}
  .page-title h1{font-size:21px}
  .page-title-row{gap:7px}

  .table-toolbar{
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
  }

  .search{grid-column:1 / -1}
  .active-filter.show{grid-column:1;justify-self:start}
  .filter-wrap{grid-column:2;justify-self:end}

  .member-row{
    grid-template-columns:38px minmax(0,1fr) auto;
    padding:15px 13px 14px;
    column-gap:9px;
  }

  .avatar{width:38px;height:38px}
  .member-copy strong{font-size:13px}

  .cell:nth-child(2){margin-top:11px;padding-top:10px}
  .cell:nth-child(4),
  .cell:nth-child(3){margin-top:10px}

  .detail-top{padding-left:6%;padding-right:6%}
  .detail-body{width:88%}

  .detail-hero{
    grid-template-columns:48px minmax(0,1fr);
    gap:10px;
  }

  .detail-avatar{width:48px;height:48px}
  .detail-name-row h2{font-size:17px}
  .detail-section{margin-top:28px}

  .detail-row{grid-template-columns:1fr;gap:5px}
  .detail-row dd{text-align:left}

  .rating-line,
  .ladder-item{
    align-items:flex-start;
    flex-direction:column;
    gap:4px;
  }
}

@media(max-width:319px){
  .header-inner,.content{width:90%}

  .content{
    padding-top:32px;
    padding-bottom:calc(104px + env(safe-area-inset-bottom,0px));
  }

  .page-head{margin-bottom:22px}
  .page-title h1{font-size:19px}
  .page-count{display:none}

  .table-toolbar{gap:7px}

  .search{
    min-height:40px;
    padding:0 9px;
  }

  .search input{font-size:11px}
  .toolbar-action{min-height:38px;padding:0 10px}

  .member-row{
    position:relative;
    display:block;
    padding:14px 13px;
  }

  .cell{
    display:block !important;
    position:static !important;
    width:100% !important;
    margin:0 !important;
    padding:0 !important;
    text-align:left !important;
  }

  .cell + .cell{margin-top:11px !important}

  .member-cell{
    display:flex !important;
    align-items:flex-start;
  }

  .cell:nth-child(2){
    padding-top:10px !important;
    border-top:.5px solid rgba(227,233,228,.7);
  }

  .ladder-cell strong,
  .ladder-cell small{display:inline}

  .ladder-cell small::before{content:' · '}

  .record::before{
    content:'Record  ';
    color:var(--color-muted);
    font-size:9px;
    font-weight:600;
  }

  .rating{
    margin-top:9px !important;
  }

  .rating small{
    display:inline;
    margin:0 0 0 4px;
  }

  .row-menu-trigger{
    position:absolute;
    right:9px;
    top:9px;
    opacity:.45;
  }

  .table-footer{min-height:48px}
  .pagination{gap:2px}
  .page-btn{width:28px;height:28px}

  .detail-panel{height:92dvh}
  .detail-top{min-height:58px}

  .detail-body{
    width:90%;
    padding-top:10px;
  }

  .detail-hero{
    grid-template-columns:1fr;
    gap:10px;
    text-align:center;
  }

  .detail-avatar{margin:0 auto}

  .detail-name-row{
    justify-content:center;
    flex-wrap:wrap;
  }

  .detail-hero p{text-align:center}
  .detail-section-title{font-size:11px}
  .detail-card{border-radius:9px}
}

@media(max-width:259px){
  .members-screen{--header-h:52px}

  body{font-size:12px}

  .app-header{height:var(--header-h)}
  .header-inner,.content{width:92%}
  .header-copy strong{font-size:12px}

  .main{padding-top:var(--header-h)}

  .content{
    padding-top:22px;
    padding-bottom:calc(78px + env(safe-area-inset-bottom,0px));
  }

  .page-head{margin-bottom:18px}
  .page-title h1{font-size:17px}

  .add-button{
    min-width:36px;
    min-height:36px;
    padding:0;
  }

  .table-toolbar{display:block}
  .search{width:100%;min-height:38px}

  .filter-wrap{
    margin-top:8px;
    display:flex;
    justify-content:flex-end;
  }

  .toolbar-action{min-height:34px;font-size:10px}
  .active-filter.show{margin-top:8px}

  .rows{gap:10px}

  .member-row{
    padding:12px;
    border-radius:8px;
  }

  .avatar{
    width:34px;
    height:34px;
    font-size:8px;
  }

  .member-copy strong{
    padding-right:24px;
    font-size:12px;
    white-space:normal;
  }

  .member-copy small{
    font-size:9px;
    white-space:normal;
  }

  .ladder-cell strong,
  .activity-cell strong,
  .record,
  .rating{font-size:10px}

  .ladder-cell small,
  .activity-cell small{font-size:8.5px}

  .table-footer{
    display:block;
    padding:8px 0;
    text-align:center;
  }

  .pagination{
    margin-top:7px;
    justify-content:center;
  }

  .result-count{font-size:9px}

  .detail-panel{
    height:100dvh;
    border-radius:0;
  }

  .detail-top{
    min-height:52px;
    padding:10px 5%;
  }

  .detail-top::before{display:none}
  .detail-top-label{font-size:10px}
  .detail-close{width:30px;height:30px}

  .detail-body{
    width:92%;
    padding:8px 0 24px;
  }

  .detail-avatar{width:44px;height:44px}

  .detail-name-row h2{
    font-size:15px;
    white-space:normal;
  }

  .detail-edit{width:30px;height:30px}
  .detail-section{margin-top:24px}
  .detail-section-title{font-size:10.5px}

  .detail-row{
    min-height:0;
    padding:10px 11px;
  }

  .detail-row dt{font-size:9px}
  .detail-row dd{font-size:10px}

  .rating-line,
  .ladder-item{padding:10px 11px}

  .mobile-bottom-nav{
    min-height:calc(50px + env(safe-area-inset-bottom,0px));
    padding:2px 2% env(safe-area-inset-bottom,0px);
  }

  .mobile-bottom-nav__item{
    min-height:46px;
    padding:4px 2px;
  }

  .mobile-bottom-nav__item svg{
    width:18px;
    height:18px;
  }

  .mobile-bottom-nav__item span{
    position:absolute;
    width:1px;
    height:1px;
    overflow:hidden;
    clip:rect(0 0 0 0);
    white-space:nowrap;
  }
}

@media(max-width:210px){
  .header-inner,
  .content,
  .detail-body{width:94%}

  .page-head{gap:8px}
  .page-title h1{font-size:16px}
  .member-row{padding:10px}
  .member-cell{gap:8px}
  .avatar{width:31px;height:31px}
  .member-copy strong{font-size:11px}
  .detail-hero{padding-bottom:18px}
  .detail-section{margin-top:20px}

  .detail-card,
  .rating-line,
  .ladder-item{border-radius:7px}
}

@media(prefers-reduced-motion:reduce){
  *,
  *::before,
  *::after{
    scroll-behavior:auto !important;
    animation-duration:.001ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.001ms !important;
  }
}


/* GORRA MOBILE FOOTER */
.mobile-bottom-nav{
  display:none;
}

@media(max-width:800px){
  body.editing-member .mobile-bottom-nav{
    display:none;
  }

  .mobile-bottom-nav{
    position:fixed;
    inset:auto 0 0;
    z-index:70;
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    min-height:calc(64px + env(safe-area-inset-bottom,0px));
    padding:3px 7.5vw env(safe-area-inset-bottom,0px);
    border-top:1px solid var(--color-border);
    background:rgba(255,255,255,.98);
    box-shadow:0 -5px 18px rgba(15,34,24,.04);
    backdrop-filter:blur(14px);
    -webkit-backdrop-filter:blur(14px);
    overflow:hidden;
  }

  .mobile-bottom-nav__item{
    position:relative;
    display:flex;
    min-width:0;
    min-height:58px;
    align-items:center;
    justify-content:center;
    flex-direction:column;
    gap:3px;
    padding:6px 3px 5px;
    border:0;
    border-radius:0;
    background:transparent;
    color:var(--color-muted);
    text-align:center;
    text-decoration:none;
  }

  .mobile-bottom-nav__item svg{
    width:21px;
    height:21px;
    fill:none;
    stroke:currentColor;
    stroke-width:1.7;
    stroke-linecap:round;
    stroke-linejoin:round;
  }

  .mobile-bottom-nav__item span{
    width:100%;
    overflow:visible;
    font-size:10.5px;
    line-height:1.1;
    text-overflow:clip;
    white-space:nowrap;
  }

  .mobile-bottom-nav__item.active{
    color:var(--color-primary-strong);
  }
}

/* RESPONSIVE */
@media(max-width:1000px){
  .members-screen{--sidebar-w:76px}

  .sidebar{padding:18px 10px}
  .brand{justify-content:center}
  .brand span:last-child,
  .club-switcher small,
  .club-switcher strong,
  .nav button span{display:none}

  .club-switcher{
    min-height:46px;
    padding:7px;
    display:grid;
    place-items:center;
  }

  .club-switcher::before{
    content:"GT";
    width:32px;height:32px;
    border-radius:50%;
    background:var(--color-surface-soft);
    color:var(--color-primary-strong);
    display:grid;
    place-items:center;
    font-size:9px;
    font-weight:700;
  }

  .nav button{justify-content:center;padding:0}

  .table-head,
  .member-row{
    grid-template-columns:
      minmax(210px,1.5fr)
      minmax(160px,1fr)
      minmax(90px,.48fr)
      minmax(155px,.9fr)
      minmax(74px,.42fr)
      34px;
  }
}

@media(max-width:800px){
  .members-screen{--sidebar-w:0px;--header-h:76px}

  .sidebar{display:none}
  .app-header{left:0}

  .main{
    padding-bottom:calc(64px + env(safe-area-inset-bottom,0px));
  }

  .header-inner,
  .content{
    width:86%;
    max-width:none;
  }

  .header-copy small{display:none}
  .account div:not(.account-avatar){display:none}
  .account{padding:3px}

  .content{
    padding-top:46px;
    padding-bottom:calc(112px + env(safe-area-inset-bottom,0px));
  }

  .page-head{
    margin-bottom:30px;
    align-items:center;
  }

  .page-title h1{font-size:24px}
  .page-title p{font-size:11.5px}

  .table-toolbar{
    flex-wrap:nowrap;
    gap:10px;
  }

  .search{
    order:0;
    width:auto;
    min-width:0;
    flex:1;
  }

  .toolbar-action{
    flex:0 0 auto;
  }

  .table-head{display:none}

  .rows{
    gap:14px;
  }

  .member-row{
    position:relative;
    min-height:0;
    padding:18px 18px 16px;
    border:.5px solid var(--color-border);
    border-radius:var(--app-card-radius);
    background:#fff;
    box-shadow:var(--flow-shadow-quiet);
    display:grid;
    grid-template-columns:44px minmax(0,1fr) auto;
    grid-template-rows:auto auto auto;
    column-gap:12px;
    row-gap:0;
    align-items:start;
  }

  .member-row:hover{
    background:#fbfdfb;
    border-color:var(--color-border-strong);
    box-shadow:var(--flow-shadow-hover);
    transform:translateY(-.5px);
  }

  .member-row:focus-visible{
    border-color:rgba(0,181,26,.26);
    box-shadow:0 0 0 2px rgba(0,181,26,.10), var(--flow-shadow-quiet);
    outline:none;
  }

  .cell{
    min-width:0;
    padding:0;
  }

  /* MEMBER: avatar + name + email */
  .cell:nth-child(1){
    grid-column:1/3;
    grid-row:1;
    padding-right:12px;
  }

  .avatar{
    width:40px;
    height:40px;
    font-size:9.5px;
  }

  .member-cell{
    align-items:flex-start;
    gap:12px;
  }

  .member-copy strong{
    font-size:14px;
    line-height:1.25;
  }

  .member-copy small{
    margin-top:4px;
    font-size:10px;
    line-height:1.35;
  }

  /* UTR: top-right, compact */
  .cell:nth-child(5){
    grid-column:3;
    grid-row:1;
    align-self:start;
    padding-top:1px;
    text-align:right;
  }

  .rating{
    font-size:12.5px;
    line-height:1.1;
  }

  .rating small{
    margin-top:3px;
    font-size:7.5px;
    letter-spacing:.03em;
  }

  /* Ladder + member number now live on one single line */
  .cell:nth-child(2){
    grid-column:2/4;
    grid-row:2;
    margin-top:13px;
    padding-top:12px;
    border-top:.5px solid rgba(231,236,232,.7);
    display:flex;
    align-items:center;
    gap:7px;
  }

  .ladder-cell strong,
  .ladder-cell small{
    display:inline;
    margin:0;
    white-space:normal;
  }

  .ladder-cell strong{
    font-size:10.5px;
    font-weight:600;
  }

  .ladder-cell small{
    font-size:9px;
    color:var(--color-muted);
  }

  .ladder-cell small::before{
    content:'·';
    margin-right:7px;
    color:#b0b8b2;
  }

  /* Recent activity on lower left */
  .cell:nth-child(4){
    grid-column:2;
    grid-row:3;
    margin-top:12px;
    align-self:center;
  }

  .activity-cell strong{
    font-size:10.5px;
    line-height:1.25;
  }

  .activity-cell small{
    display:none;
  }

  /* Record on lower right */
  .cell:nth-child(3){
    grid-column:3;
    grid-row:3;
    margin-top:12px;
    align-self:center;
    text-align:right;
    font-size:12px;
  }

  /* Menu stays unobtrusive, bottom-right beside record */
  .cell:nth-child(6){
    position:absolute;
    right:9px;
    bottom:6px;
    width:28px;
    height:28px;
  }

  .row-menu-trigger{
    width:28px;
    height:28px;
    opacity:.42;
  }

  .table-footer{
    min-height:52px;
  }
}

@media(max-width:520px){
  .header-inner,
  .content{width:86%}

  .page-title p{display:none}
  .page-count{display:none}

  .page-head{
    align-items:flex-start;
    margin-bottom:26px;
  }

  .table-toolbar{
    gap:8px;
  }

  .toolbar-action{
    min-width:44px;
    padding:0 10px;
  }

  .toolbar-action span{display:none}

  .member-row{
    padding:16px 15px 15px;
  }

  .detail-grid{grid-template-columns:1fr}
}
.add-menu,
.filter-menu,
.row-actions{
  max-width:calc(100vw - 16px);
}


/* LOW-POWER / LONG-LIST SAFETY */
.member-row{
  content-visibility:auto;
  contain-intrinsic-size:84px;
}

@media(max-width:359px){
  .app-header,
  .detail-top,
  .mobile-bottom-nav{
    backdrop-filter:none;
    -webkit-backdrop-filter:none;
  }

  .member-row{
    box-shadow:0 3px 10px rgba(15,34,24,.018);
  }

  .member-row:hover{
    transform:none;
  }
}

@media(max-width:259px){
  .member-row,
  .table-toolbar,
  .detail-card,
  .rating-line,
  .ladder-item{
    box-shadow:none;
  }
}
</style>
<style>
.layout.layout--club-theme .content:has(.members-screen) { padding: 56px 0 96px; }
@media (max-width: 767px) { .layout.layout--club-theme .content:has(.members-screen) { width: var(--app-shell-content-width); max-width: none; padding-top: 46px; padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px)); } }
</style>
<style scoped>
.members-screen .primary-action { margin-left: auto; }
.members-screen .club-invite-menu {
  position: relative;
}
.members-screen .club-invite-menu > .ref-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.members-screen .club-invite-menu__panel {
  position: absolute;
  z-index: 50;
  top: calc(100% + 10px);
  right: 0;
  display: grid;
  width: 260px;
  padding: 7px;
  border: 1px solid var(--g-line, #e4e9e5);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 14px 32px rgba(13, 38, 23, 0.16);
}
.members-screen .club-invite-menu__panel button {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #2f4035;
  text-align: left;
}
.members-screen .club-invite-menu__panel button:hover {
  background: #f1f6f2;
}
.members-screen .club-invite-menu__panel span {
  display: grid;
  gap: 2px;
}
.members-screen .club-invite-menu__panel strong {
  font-size: 12px;
  font-weight: var(--font-weight-semibold, 600);
}
.members-screen .club-invite-menu__panel small {
  color: var(--g-muted, #778079);
  font-size: 10px;
}
.members-screen .club-invite-menu__panel :deep(.flow-icon) {
  width: 16px;
  height: 16px;
  color: #078c2f;
}
.members-screen .add-menu { left: auto; right: 0; transform-origin: top right; }
.members-screen .search { gap: 7px; }
.members-screen .table-head > .th {
  justify-content: flex-start;
}
.members-screen .member-row {
  border-color: rgba(175, 190, 180, .28);
  transition: box-shadow 140ms cubic-bezier(.22, 1, .32, 1);
}
.members-screen .member-row:hover {
  background: #fff;
  border-color: rgba(175, 190, 180, .28);
  box-shadow: 0 2px 7px rgba(15, 34, 24, .01);
  transform: none;
}
</style>
<style>
/* Members hero: compact route spacing while preserving the shared shell. */
.layout.layout--club-theme .content:has(.members-screen) {
  padding-top: 48px;
  padding-bottom: 72px;
}
</style>
<style scoped>
.members-screen .page-head {
  margin-bottom: 32px;
}
.members-screen .page-title {
  gap: var(--space-heading-copy);
}
.members-screen .page-title h1 {
  color: #1e2b22;
  font-family: var(--font-family-display);
  font-size: var(--type-page-title);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--type-tracking-heading);
  line-height: var(--type-line-heading);
}
.members-screen .page-count {
  color: #067d20;
  font-family: var(--font-family-data);
  font-size: var(--type-meta);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0;
}
.members-screen .page-title p {
  color: var(--color-text-soft);
  font-size: var(--type-page-description);
  line-height: var(--type-line-body);
}
.members-screen .add-button {
  min-height: var(--app-button-height);
  padding-inline: var(--space-4);
  border-color: #08ad2b;
  border-radius: var(--app-control-radius);
  background: #08ad2b;
  box-shadow: var(--shadow-xs);
  font-size: var(--app-control-font-size);
  font-weight: var(--font-weight-semibold);
}
.members-screen .add-button:hover {
  background: #067d20;
  box-shadow: var(--shadow-xs);
}

@media (min-width: 769px) {
  .members-screen .member-row {
    min-height: 96px;
    padding-block: 18px;
  }
}

.members-screen .member-row:not(:last-child) {
  margin-bottom: 4px;
}

.members-screen .member-copy strong,
.members-screen .ladder-cell strong,
.members-screen .activity-cell strong,
.members-screen .record,
.members-screen .rating {
  font-weight: 500;
}

.members-screen .detail-avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.members-screen .remove-member-dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid rgba(175, 190, 180, .34);
  border-radius: var(--app-card-radius);
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 34, 24, .12);
}
.members-screen .remove-member-dialog::backdrop { background: rgba(21, 34, 25, .18); }
.members-screen .remove-member-dialog__body { padding: 24px; }
.members-screen .remove-member-dialog h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -.015em;
}
.members-screen .remove-member-dialog p {
  margin: 9px 0 0;
  color: var(--color-text-soft);
  font-size: 12px;
  line-height: 1.55;
}
.members-screen .remove-member-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 22px;
}
.members-screen .remove-member-dialog__actions button {
  min-height: 38px;
  padding: 0 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: #fff;
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: 550;
}
.members-screen .remove-member-dialog__actions button:hover { background: var(--color-surface-soft); }
.members-screen .remove-member-dialog__actions .danger {
  border-color: #9c403a;
  background: #9c403a;
  color: #fff;
}
.members-screen .remove-member-dialog__actions .danger:hover { background: #81342f; }
.members-screen .remove-member-dialog__actions button:disabled { cursor: not-allowed; opacity: .58; }

@media (min-width: 1051px) {
  .members-screen .table-head,
  .members-screen .member-row {
    grid-template-columns:
      minmax(250px, 1.65fr)
      minmax(185px, 1.05fr)
      minmax(105px, .52fr)
      minmax(190px, 1.05fr)
      minmax(90px, .46fr)
      34px;
  }

  .members-screen .table-head { padding-inline: 20px; }
  .members-screen .member-row { padding-inline: 20px; }
  .members-screen .table-head > .th,
  .members-screen .member-row > .cell { min-width: 0; }
  .members-screen .table-head > .th:nth-child(3),
  .members-screen .member-row > .cell:nth-child(3) { justify-self: stretch; text-align: center; }
  .members-screen .table-head > .th:nth-child(5),
  .members-screen .member-row > .cell:nth-child(5) { justify-self: stretch; text-align: right; }
}</style>