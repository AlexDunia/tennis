<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useNotificationStore } from '../stores/notification'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()
const invitation = ref(String(route.query.invite || ''))
const selectedMethod = ref(invitation.value ? 'link' : '')
const pageError = ref('')
const isJoining = ref(false)
const qrFile = ref(null)
const fileInput = ref(null)

const methods = Object.freeze([
  {
    id: 'code',
    icon: 'one-set',
    title: 'Enter a club code',
    description: 'Use the short code your club sent you.',
  },
  {
    id: 'link',
    icon: 'link',
    title: 'Paste an invitation link',
    description: 'Use the private link from your club.',
  },
  {
    id: 'qr',
    icon: 'scan',
    title: 'Use a QR code',
    description: 'Choose a picture of the QR code.',
  },
])
const clubName = computed(() =>
  String(route.query.club || '')
    .replace(/-/g, ' ')
    .trim(),
)
const fieldLabel = computed(() =>
  selectedMethod.value === 'code' ? 'Club code' : 'Invitation link',
)
const fieldPlaceholder = computed(() =>
  selectedMethod.value === 'code' ? 'For example: GORRA-24' : 'Paste the link here',
)

function chooseMethod(method) {
  selectedMethod.value = method
  pageError.value = ''
  if (method === 'qr') fileInput.value?.click()
}
function handleQrFile(event) {
  qrFile.value = event.target.files?.[0] || null
}
async function joinClub() {
  if (!selectedMethod.value) {
    pageError.value = 'Choose how you received your invitation.'
    return
  }
  if (selectedMethod.value === 'qr' && !qrFile.value) {
    fileInput.value?.click()
    return
  }
  if (selectedMethod.value !== 'qr' && invitation.value.trim().length < 4) {
    pageError.value =
      selectedMethod.value === 'code' ? 'Enter the club code.' : 'Paste the invitation link.'
    return
  }
  isJoining.value = true
  pageError.value = ''
  window.setTimeout(async () => {
    notificationStore.addToast({
      message: clubName.value ? `You joined ${clubName.value}.` : 'You joined your club.',
      type: 'success',
    })
    await router.push({ name: 'Dashboard' })
  }, 650)
}
</script>

<template>
  <main class="join-onboarding">
    <header class="join-header">
      <span class="brand-mark" aria-hidden="true">G</span>
      <span>Join your club</span>
    </header>
    <section class="join-screen">
      <p class="eyebrow">One quick step</p>
      <h1>{{ clubName ? `Join ${clubName}.` : 'How did your club invite you?' }}</h1>
      <p class="lead">Choose the invitation you have. You only need to do this once.</p>
      <p v-if="pageError" class="join-alert" role="alert">{{ pageError }}</p>

      <div class="join-choices" role="group" aria-label="Invitation type">
        <button
          v-for="method in methods"
          :key="method.id"
          type="button"
          :class="{ selected: selectedMethod === method.id }"
          :aria-pressed="selectedMethod === method.id"
          @click="chooseMethod(method.id)"
        >
          <FlowIcon :name="method.icon" />
          <span
            ><strong>{{ method.title }}</strong
            ><small>{{ method.description }}</small></span
          >
          <b aria-hidden="true">{{ selectedMethod === method.id ? '✓' : '' }}</b>
        </button>
      </div>

      <label v-if="selectedMethod && selectedMethod !== `qr`" class="join-field">
        <span>{{ fieldLabel }}</span>
        <input v-model="invitation" :placeholder="fieldPlaceholder" autocomplete="off" />
      </label>
      <div v-if="selectedMethod === `qr`" class="qr-file">
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept="image/*"
          @change="handleQrFile"
        />
        <p>{{ qrFile ? qrFile.name : 'Choose a clear picture of the club QR code.' }}</p>
        <button type="button" @click="fileInput?.click()">
          {{ qrFile ? 'Choose another picture' : 'Choose QR picture' }}
        </button>
      </div>

      <footer class="join-actions">
        <button type="button" @click="router.push({ name: `SignUp` })">Back</button>
        <button class="primary" type="button" :disabled="isJoining" @click="joinClub">
          {{ isJoining ? 'Joining…' : 'Join my club' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.join-onboarding {
  min-height: 100svh;
  padding: clamp(20px, 4vw, 48px);
  color: #172319;
  background: #f7f8f4;
}
.join-header,
.join-screen {
  width: min(100%, 820px);
  margin-inline: auto;
}
.join-header {
  display: flex;
  align-items: center;
  gap: 11px;
  color: #536057;
  font-size: 0.9rem;
  font-weight: var(--font-weight-medium);
}
.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50% 50% 50% 12%;
  color: #fff;
  background: #287a45;
  font-family: Georgia, serif;
  font-size: 1.3rem;
  font-style: italic;
}
.join-screen {
  display: grid;
  gap: 20px;
  padding-top: clamp(54px, 10vh, 100px);
}
.eyebrow {
  margin: 0;
  color: #647067;
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  max-width: 720px;
  margin: -4px 0 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: var(--font-weight-bold);
  line-height: 1.04;
  letter-spacing: -0.04em;
}
.lead {
  max-width: 620px;
  margin: -6px 0 18px;
  color: #5e6860;
  font-size: clamp(1rem, 2vw, 1.15rem);
  font-weight: var(--font-weight-regular);
  line-height: 1.65;
}
.join-alert {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid #e6b9b9;
  border-radius: 12px;
  color: #8b2525;
  background: #fff5f5;
  font-weight: var(--font-weight-medium);
}
.join-choices {
  display: grid;
  gap: 12px;
}
.join-choices button {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  min-height: 92px;
  gap: 16px;
  padding: 18px;
  border: 1px solid #cbd3cb;
  border-radius: 14px;
  color: inherit;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.join-choices button.selected {
  border-color: #287a45;
  background: #f0f8f2;
  box-shadow: 0 0 0 1px #287a45;
}
.join-choices svg {
  width: 26px;
  height: 26px;
  color: #526057;
}
.join-choices span {
  display: grid;
  gap: 5px;
}
.join-choices strong {
  font-size: 1rem;
  font-weight: var(--font-weight-semibold);
}
.join-choices small {
  color: #687269;
  font-size: 0.92rem;
  font-weight: var(--font-weight-regular);
  line-height: 1.45;
}
.join-choices b {
  color: #287a45;
  font-size: 1.25rem;
  font-weight: var(--font-weight-semibold);
}
.join-field {
  display: grid;
  gap: 8px;
  font-weight: var(--font-weight-medium);
}
.join-field input {
  width: 100%;
  min-height: 58px;
  padding: 14px 16px;
  border: 1px solid #cdd5cd;
  border-radius: 14px;
  color: inherit;
  background: #fff;
  font: inherit;
  font-size: 1.05rem;
}
.qr-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border: 1px solid #d7ddd7;
  border-radius: 14px;
  background: #fff;
}
.qr-file p {
  margin: 0;
  color: #59635b;
  font-weight: var(--font-weight-regular);
  overflow-wrap: anywhere;
}
button {
  min-height: 52px;
  padding: 12px 18px;
  border: 1px solid #cbd3cb;
  border-radius: 13px;
  color: inherit;
  background: #fff;
  font: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}
button:focus-visible,
input:focus {
  outline: 3px solid rgba(40, 122, 69, 0.24);
  outline-offset: 2px;
  border-color: #287a45;
}
.join-actions {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: clamp(24px, 6vh, 54px);
  padding-top: 20px;
  border-top: 1px solid #dfe4df;
}
.join-actions .primary {
  min-width: 180px;
  border-color: #287a45;
  color: #fff;
  background: #287a45;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@media (max-width: 600px) {
  .join-onboarding {
    padding: 18px;
  }
  .join-screen {
    padding-top: 48px;
  }
  .qr-file {
    align-items: stretch;
    flex-direction: column;
  }
  .join-actions {
    position: sticky;
    bottom: 0;
    padding: 14px 0;
    background: #f7f8f4;
  }
  .join-actions button {
    flex: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
