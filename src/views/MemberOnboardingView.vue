<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useNotificationStore } from '../stores/notification'
import {
  clubNameFromSlug,
  searchClubDirectory,
  validateInvitationInput,
  validateQrImage,
} from '../utils/onboarding/clubInvitation'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()

const invitation = ref(String(route.query.invite || ''))
const selectedMethod = ref(invitation.value ? 'link' : 'search')
const searchQuery = ref(clubNameFromSlug(route.query.club))
const selectedClub = ref(null)
const qrFile = ref(null)
const qrFileName = ref('')
const fileInput = ref(null)
const pageError = ref('')
const searchTouched = ref(Boolean(searchQuery.value))
const status = ref('idle')
let joinTimer = null

const methods = Object.freeze([
  {
    id: 'search',
    icon: 'home',
    title: 'Find my club',
    description: 'Search by club name or location.',
  },
  {
    id: 'code',
    icon: 'one-set',
    title: 'Enter a club code',
    description: 'Use the short code your club sent.',
  },
  {
    id: 'link',
    icon: 'link',
    title: 'Use an invite link',
    description: 'Paste your private Gorra invitation.',
  },
  {
    id: 'qr',
    icon: 'scan',
    title: 'Scan a QR code',
    description: 'Choose a clear picture of the code.',
  },
])

const clubName = computed(() => selectedClub.value?.name || clubNameFromSlug(route.query.club))
const searchResults = computed(() => searchClubDirectory(searchQuery.value))
const invitationValidation = computed(() => validateInvitationInput(invitation.value))
const isComplete = computed(() => ['joined', 'pending'].includes(status.value))
const canContinue = computed(() => {
  if (status.value === 'joining') return false
  if (selectedMethod.value === 'search') return Boolean(selectedClub.value)
  if (selectedMethod.value === 'qr') return Boolean(qrFile.value)
  return invitationValidation.value.valid
})
const fieldLabel = computed(() =>
  selectedMethod.value === 'code' ? 'Club code' : 'Invitation link',
)
const fieldPlaceholder = computed(() =>
  selectedMethod.value === 'code' ? 'GORRA-24CLUB' : 'Paste your private invitation',
)
const actionLabel = computed(() => {
  if (status.value === 'joining') return 'Checking your invitation...'
  if (selectedMethod.value === 'search' && selectedClub.value?.access === 'approval') {
    return 'Request to join'
  }
  return 'Join my club'
})

function resetResult() {
  status.value = 'idle'
  pageError.value = ''
}

function chooseMethod(method) {
  selectedMethod.value = method
  resetResult()
  if (method !== 'search') selectedClub.value = null
  if (method === 'qr') fileInput.value?.click()
}

function updateSearch() {
  searchTouched.value = true
  selectedClub.value = null
  resetResult()
}

function chooseClub(club) {
  selectedClub.value = club
  pageError.value = ''
}

function handleQrFile(event) {
  const file = event.target.files?.[0] || null
  const validation = validateQrImage(file)
  if (!validation.valid) {
    qrFile.value = null
    qrFileName.value = ''
    pageError.value = validation.message
    event.target.value = ''
    return
  }
  qrFile.value = file
  qrFileName.value = validation.safeName
  pageError.value = ''
}

function validateStep() {
  if (selectedMethod.value === 'search' && !selectedClub.value) {
    return 'Choose the club you want to join.'
  }
  if (selectedMethod.value === 'qr') return validateQrImage(qrFile.value).message || ''
  const validation = validateInvitationInput(invitation.value)
  return validation.valid ? '' : validation.message
}

function joinClub() {
  if (status.value === 'joining') return
  const validationMessage = validateStep()
  if (validationMessage) {
    pageError.value = validationMessage
    return
  }

  pageError.value = ''
  status.value = 'joining'
  if (joinTimer) window.clearTimeout(joinTimer)
  joinTimer = window.setTimeout(() => {
    const needsApproval =
      selectedMethod.value === 'search' && selectedClub.value?.access === 'approval'
    status.value = needsApproval ? 'pending' : 'joined'
    notificationStore.addToast({
      message: needsApproval
        ? `Your request to join ${clubName.value} is ready for review.`
        : `Welcome to ${clubName.value || 'your club'}.`,
      type: 'success',
    })
    joinTimer = null
  }, 720)
}

function finish() {
  router.push({ name: 'Dashboard' })
}

onUnmounted(() => {
  if (joinTimer) window.clearTimeout(joinTimer)
})
</script>

<template>
  <main class="member-onboarding">
    <div class="member-onboarding__court" aria-hidden="true">
      <span class="court-line court-line--one"></span>
      <span class="court-line court-line--two"></span>
      <span class="court-ball"></span>
    </div>

    <header class="join-header">
      <button
        class="join-back"
        type="button"
        aria-label="Back to role selection"
        @click="router.push({ name: 'SignUp' })"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <a class="join-brand" href="#/" aria-label="Gorra home"><span>G</span> GORRA</a>
      <div class="join-security"><FlowIcon name="check" /> Invitation protected</div>
    </header>

    <section v-if="!isComplete" class="join-shell">
      <aside class="join-story" aria-hidden="true">
        <p>YOUR CLUB, WAITING</p>
        <h2>Find your people. Step onto the court.</h2>
        <div class="join-story__players">
          <span>AO</span><span>KM</span><span>TI</span><b>+81</b>
        </div>
        <small>Players across Ibadan are already organizing matches on Gorra.</small>
      </aside>

      <form class="join-card" @submit.prevent="joinClub">
        <div class="join-intro">
          <p class="eyebrow">Join a club</p>
          <h1>{{ clubName ? `Join ${clubName}` : 'Find your tennis club' }}</h1>
          <p class="lead">
            Search for your club or use the private invitation from your club admin.
          </p>
        </div>

        <div class="method-tabs" role="radiogroup" aria-label="How would you like to join?">
          <button
            v-for="method in methods"
            :key="method.id"
            type="button"
            role="radio"
            :aria-checked="selectedMethod === method.id"
            :class="{ selected: selectedMethod === method.id }"
            @click="chooseMethod(method.id)"
          >
            <FlowIcon :name="method.icon" />
            <span
              ><strong>{{ method.title }}</strong
              ><small>{{ method.description }}</small></span
            >
            <i aria-hidden="true"><FlowIcon name="check" /></i>
          </button>
        </div>

        <Transition name="answer" mode="out-in">
          <div :key="selectedMethod" class="join-answer">
            <template v-if="selectedMethod === 'search'">
              <label class="join-field">
                <span>Club name or location</span>
                <div class="join-input-wrap">
                  <FlowIcon name="home" />
                  <input
                    v-model="searchQuery"
                    type="search"
                    placeholder="Try Greenview or Ibadan"
                    maxlength="80"
                    autocomplete="off"
                    @input="updateSearch"
                  />
                </div>
              </label>
              <div v-if="searchResults.length" class="club-results" aria-live="polite">
                <button
                  v-for="club in searchResults"
                  :key="club.id"
                  type="button"
                  :class="{ selected: selectedClub?.id === club.id }"
                  :aria-pressed="selectedClub?.id === club.id"
                  @click="chooseClub(club)"
                >
                  <span class="club-monogram">{{ club.name.slice(0, 2).toUpperCase() }}</span>
                  <span class="club-copy">
                    <strong>{{ club.name }}</strong>
                    <small>{{ club.location }} · {{ club.members }} members</small>
                    <em>{{ club.ladders.slice(0, 2).join(' · ') }}</em>
                  </span>
                  <span class="club-access">{{
                    club.access === 'approval' ? 'Approval' : 'Open'
                  }}</span>
                </button>
              </div>
              <div v-else-if="searchTouched && searchQuery.trim().length >= 2" class="join-empty">
                <FlowIcon name="home" />
                <strong>No club found yet</strong>
                <p>Check the spelling or ask your admin for a link, code, or QR invitation.</p>
              </div>
            </template>

            <label v-else-if="selectedMethod !== 'qr'" class="join-field">
              <span>{{ fieldLabel }}</span>
              <div class="join-input-wrap">
                <FlowIcon :name="selectedMethod === 'code' ? 'one-set' : 'link'" />
                <input
                  v-model="invitation"
                  :placeholder="fieldPlaceholder"
                  :maxlength="selectedMethod === 'code' ? 18 : 2048"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  @input="resetResult"
                />
              </div>
              <small>We verify invitations before connecting them to your account.</small>
            </label>

            <div v-else class="qr-drop">
              <input
                ref="fileInput"
                class="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                @change="handleQrFile"
              />
              <span class="qr-drop__icon"><FlowIcon :name="qrFile ? 'check' : 'scan'" /></span>
              <strong>{{ qrFile ? qrFileName : 'Choose your QR code image' }}</strong>
              <small>PNG, JPG, or WebP · maximum 5 MB</small>
              <button type="button" @click="fileInput?.click()">
                {{ qrFile ? 'Choose another' : 'Browse image' }}
              </button>
            </div>
          </div>
        </Transition>

        <p v-if="pageError" class="join-alert" role="alert">{{ pageError }}</p>

        <footer class="join-actions">
          <p><FlowIcon name="check" /> Your details stay private until you join.</p>
          <button class="primary" type="submit" :disabled="!canContinue">
            <span v-if="status === 'joining'" class="join-spinner" aria-hidden="true"></span>
            {{ actionLabel }}
            <FlowIcon v-if="status !== 'joining'" name="arrow-right" />
          </button>
        </footer>
      </form>
    </section>

    <section v-else class="join-complete" aria-live="polite">
      <span class="join-complete__mark"
        ><FlowIcon :name="status === 'joined' ? 'check' : 'calendar'"
      /></span>
      <p class="eyebrow">{{ status === 'joined' ? 'You are in' : 'Request sent' }}</p>
      <h1>
        {{
          status === 'joined'
            ? `Welcome to ${clubName || 'your club'}`
            : `${clubName || 'Your club'} will review your request`
        }}
      </h1>
      <p>
        {{
          status === 'joined'
            ? 'Your club, ladders, and next available matches are ready.'
            : 'We will let you know as soon as a club admin approves your membership.'
        }}
      </p>
      <button class="primary" type="button" @click="finish">
        Go to my dashboard <FlowIcon name="arrow-right" />
      </button>
    </section>
  </main>
</template>

<style scoped>
.member-onboarding {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  color: #152118;
  background:
    radial-gradient(circle at 12% 12%, rgba(216, 239, 100, 0.16), transparent 24rem),
    linear-gradient(135deg, #f6f9f5 0%, #ffffff 46%, #f3f8f4 100%);
}
.member-onboarding__court {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.55;
}
.court-line {
  position: absolute;
  border: 1px solid rgba(31, 106, 55, 0.08);
  transform: rotate(-11deg);
}
.court-line--one {
  width: 46vw;
  height: 82vh;
  right: -12vw;
  top: -18vh;
}
.court-line--two {
  width: 28vw;
  height: 58vh;
  left: -8vw;
  bottom: -22vh;
}
.court-ball {
  position: absolute;
  right: 7vw;
  top: 18vh;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #d8ee64;
  box-shadow: 0 8px 24px rgba(87, 117, 24, 0.3);
  animation: ball-float 5s ease-in-out infinite;
}
.join-header {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  width: min(1180px, calc(100% - 40px));
  min-height: 82px;
  margin: 0 auto;
  border-bottom: 1px solid rgba(33, 58, 40, 0.09);
}
.join-back {
  display: grid;
  width: 42px;
  min-height: 42px;
  padding: 0;
  place-items: center;
  border: 1px solid #dce5dd;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: #425044;
}
.join-back svg {
  width: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.join-brand {
  justify-self: center;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #142019;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-decoration: none;
}
.join-brand span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50% 50% 50% 10px;
  background: #087524;
  color: #fff;
  font-family: Georgia, serif;
  font-size: 17px;
  font-style: italic;
  transform: rotate(-5deg);
}
.join-security {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6c786e;
  font-size: 11px;
  font-weight: 500;
}
.join-security .flow-icon {
  width: 15px;
  color: #16813c;
}
.join-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(240px, 330px) minmax(0, 720px);
  gap: clamp(34px, 6vw, 86px);
  width: min(1120px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(44px, 7vw, 86px) 0 70px;
}
.join-story {
  align-self: center;
  padding: 16px 0;
}
.join-story > p {
  margin: 0 0 14px;
  color: #5f6e63;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.13em;
}
.join-story h2 {
  margin: 0;
  font-size: clamp(30px, 3.3vw, 46px);
  line-height: 1.06;
  letter-spacing: -0.045em;
}
.join-story__players {
  display: flex;
  align-items: center;
  margin: 30px 0 15px;
}
.join-story__players span,
.join-story__players b {
  display: grid;
  width: 40px;
  height: 40px;
  margin-left: -8px;
  place-items: center;
  border: 3px solid #f6f9f5;
  border-radius: 50%;
  background: #183d27;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
}
.join-story__players span:first-child {
  margin-left: 0;
  background: #be6c38;
}
.join-story__players span:nth-child(2) {
  background: #24665b;
}
.join-story__players b {
  background: #e8f2e9;
  color: #356044;
}
.join-story small {
  display: block;
  max-width: 30ch;
  color: #67736a;
  font-size: 12px;
  line-height: 1.6;
}
.join-card {
  padding: clamp(24px, 4vw, 42px);
  border: 1px solid rgba(31, 72, 43, 0.1);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 32px 90px rgba(20, 55, 31, 0.09);
  backdrop-filter: blur(18px);
  animation: card-arrive 520ms var(--motion-curve) both;
}
.join-intro {
  display: grid;
  gap: 7px;
}
.eyebrow {
  margin: 0;
  color: #328150;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: clamp(27px, 4vw, 38px);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.035em;
}
.lead {
  max-width: 58ch;
  margin: 0;
  color: #657168;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.65;
}
.method-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 28px;
}
.method-tabs button {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 11px;
  min-height: 72px;
  padding: 13px;
  border: 1px solid #e0e8e1;
  border-radius: 14px;
  background: #fff;
  color: #445047;
  text-align: left;
  white-space: normal;
  box-shadow: 0 8px 22px rgba(15, 34, 24, 0.025);
}
.method-tabs button:hover {
  transform: translateY(-2px);
  border-color: #b9cfbf;
  box-shadow: 0 12px 26px rgba(15, 34, 24, 0.06);
}
.method-tabs button > .flow-icon {
  width: 19px;
  color: #29804a;
}
.method-tabs strong,
.method-tabs small {
  display: block;
}
.method-tabs strong {
  font-size: 12.5px;
  font-weight: 600;
}
.method-tabs small {
  margin-top: 3px;
  color: #778279;
  font-size: 10.5px;
  font-weight: 400;
  line-height: 1.35;
}
.method-tabs i {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border: 1px solid #d5dfd7;
  border-radius: 50%;
  color: transparent;
  transition: 0.18s ease;
}
.method-tabs i .flow-icon {
  width: 11px;
}
.method-tabs button.selected {
  border-color: rgba(28, 132, 63, 0.4);
  background: #f5fbf6;
  box-shadow: 0 12px 28px rgba(24, 103, 52, 0.07);
}
.method-tabs button.selected i {
  border-color: #228146;
  background: #228146;
  color: #fff;
  transform: scale(1.06);
}
.join-answer {
  margin-top: 24px;
}
.join-field {
  display: grid;
  gap: 8px;
  color: #4d5b50;
  font-size: 11.5px;
  font-weight: 500;
}
.join-field > small {
  color: #7a867d;
  font-size: 10.5px;
  font-weight: 400;
}
.join-input-wrap {
  position: relative;
}
.join-input-wrap > .flow-icon {
  position: absolute;
  z-index: 1;
  left: 15px;
  top: 50%;
  width: 18px;
  color: #6f7d72;
  transform: translateY(-50%);
}
.join-input-wrap input {
  width: 100%;
  min-height: 56px;
  padding: 14px 16px 14px 45px;
  border: 1px solid #d9e2db;
  border-radius: 13px;
  background: #fff;
  color: #172319;
  font-size: 14px;
  font-weight: 400;
}
.club-results {
  display: grid;
  gap: 9px;
  margin-top: 12px;
}
.club-results > button {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 78px;
  padding: 12px;
  border: 1px solid #e1e8e2;
  border-radius: 14px;
  background: #fff;
  color: #334038;
  text-align: left;
  white-space: normal;
}
.club-results > button:hover {
  transform: translateY(-1px);
  border-color: #bdd2c2;
}
.club-results > button.selected {
  border-color: #3b945b;
  background: #f5fbf6;
  box-shadow: 0 10px 25px rgba(30, 115, 58, 0.08);
}
.club-monogram {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: #153b25;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
}
.club-copy strong,
.club-copy small,
.club-copy em {
  display: block;
}
.club-copy strong {
  font-size: 12.5px;
  font-weight: 600;
}
.club-copy small {
  margin-top: 2px;
  color: #768178;
  font-size: 10.5px;
  font-weight: 400;
}
.club-copy em {
  margin-top: 5px;
  color: #348052;
  font-size: 9.5px;
  font-style: normal;
  font-weight: 500;
}
.club-access {
  padding: 4px 7px;
  border-radius: 999px;
  background: #edf6ef;
  color: #337149;
  font-size: 9px;
  font-weight: 600;
}
.join-empty {
  display: grid;
  justify-items: center;
  gap: 7px;
  margin-top: 12px;
  padding: 22px;
  border: 1px dashed #ced9d0;
  border-radius: 14px;
  color: #748077;
  text-align: center;
}
.join-empty .flow-icon {
  width: 23px;
  color: #44825b;
}
.join-empty strong {
  color: #3e4c42;
  font-size: 12.5px;
}
.join-empty p {
  max-width: 46ch;
  margin: 0;
  font-size: 10.5px;
  line-height: 1.5;
}
.qr-drop {
  display: grid;
  min-height: 220px;
  align-content: center;
  justify-items: center;
  gap: 7px;
  padding: 24px;
  border: 1px dashed #bed0c2;
  border-radius: 16px;
  background: #f9fcf9;
  text-align: center;
}
.qr-drop__icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 15px;
  background: #eaf5ec;
  color: #287d47;
}
.qr-drop strong {
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.qr-drop small {
  color: #78847b;
  font-size: 10.5px;
}
.qr-drop button {
  min-height: 40px;
  margin-top: 8px;
  border: 1px solid #d2ddd4;
  border-radius: 10px;
  background: #fff;
  color: #326847;
  font-size: 11.5px;
  font-weight: 600;
}
.join-alert {
  margin: 16px 0 0;
  padding: 11px 13px;
  border: 1px solid #edc7c7;
  border-radius: 11px;
  background: #fff6f6;
  color: #8e3030;
  font-size: 11.5px;
  font-weight: 500;
}
.join-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 26px;
  padding-top: 19px;
  border-top: 1px solid #e5eae6;
}
.join-actions p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #7a857c;
  font-size: 10px;
}
.join-actions p .flow-icon {
  width: 13px;
  color: #338353;
}
.primary {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 12px 19px;
  border: 1px solid #16743a;
  border-radius: 12px;
  background: linear-gradient(135deg, #145f32, #218a49);
  box-shadow: 0 12px 24px rgba(23, 113, 56, 0.18);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px rgba(23, 113, 56, 0.24);
}
.primary:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  box-shadow: none;
}
.primary .flow-icon {
  width: 17px;
}
.join-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}
.join-complete {
  position: relative;
  z-index: 2;
  display: grid;
  width: min(600px, calc(100% - 40px));
  min-height: calc(100svh - 82px);
  align-content: center;
  justify-items: center;
  gap: 10px;
  margin: 0 auto;
  padding: 50px 0 100px;
  text-align: center;
  animation: card-arrive 520ms var(--motion-curve) both;
}
.join-complete__mark {
  display: grid;
  width: 76px;
  height: 76px;
  margin-bottom: 13px;
  place-items: center;
  border-radius: 24px;
  background: linear-gradient(145deg, #123c24, #23884a);
  box-shadow: 0 22px 50px rgba(22, 103, 51, 0.2);
  color: #fff;
}
.join-complete__mark .flow-icon {
  width: 32px;
  height: 32px;
}
.join-complete > p:not(.eyebrow) {
  max-width: 50ch;
  margin: 0 0 18px;
  color: #68756b;
  font-size: 13px;
  line-height: 1.65;
}
.answer-enter-active,
.answer-leave-active {
  transition:
    opacity 170ms ease,
    transform 170ms var(--motion-curve);
}
.answer-enter-from {
  opacity: 0;
  transform: translateY(7px);
}
.answer-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@keyframes card-arrive {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.992);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes ball-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(-26px, 36px, 0);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 840px) {
  .join-shell {
    grid-template-columns: 1fr;
    width: min(720px, calc(100% - 32px));
    padding-top: 36px;
  }
  .join-story {
    display: none;
  }
}
@media (max-width: 580px) {
  .join-header {
    width: calc(100% - 28px);
    min-height: 70px;
    grid-template-columns: 42px 1fr 42px;
  }
  .join-security {
    display: none;
  }
  .join-shell {
    width: 100%;
    padding: 0;
  }
  .join-card {
    min-height: calc(100svh - 70px);
    padding: 28px 18px 110px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    backdrop-filter: none;
  }
  .method-tabs {
    grid-template-columns: 1fr;
  }
  .join-actions {
    position: fixed;
    z-index: 3;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 13px 18px max(14px, env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(16px);
  }
  .join-actions p {
    display: none;
  }
  .join-actions .primary {
    width: 100%;
  }
  .club-results > button {
    grid-template-columns: 42px minmax(0, 1fr);
  }
  .club-access {
    grid-column: 2;
    width: fit-content;
  }
}
@media (prefers-reduced-motion: reduce) {
  .join-card,
  .join-complete,
  .court-ball,
  .join-spinner {
    animation: none;
  }
  .answer-enter-active,
  .answer-leave-active {
    transition: none;
  }
}
</style>
