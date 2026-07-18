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
      <button
        class="join-back"
        type="button"
        aria-label="Go back"
        @click="router.push({ name: 'SignUp' })"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <strong>Join your club</strong>
    </header>
    <section class="join-screen">
      <div class="join-intro">
        <p class="eyebrow">One quick step</p>
        <h1>{{ clubName ? `Join ${clubName}.` : 'How did your club invite you?' }}</h1>
        <p class="lead">Choose the invitation you have. You only need to do this once.</p>
      </div>
      <p v-if="pageError" class="join-alert" role="alert">{{ pageError }}</p>

      <div class="join-answer">
        <div class="join-choices" role="group" aria-label="Invitation type">
          <button
            v-for="method in methods"
            :key="method.id"
            type="button"
            :class="{ selected: selectedMethod === method.id }"
            :aria-pressed="selectedMethod === method.id"
            @click="chooseMethod(method.id)"
          >
            <span class="choice-icon"><FlowIcon :name="method.icon" /></span>
            <span
              ><strong>{{ method.title }}</strong
              ><small>{{ method.description }}</small></span
            >
            <b aria-hidden="true">{{ selectedMethod === method.id ? '✓' : '›' }}</b>
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
      </div>

      <footer class="join-actions">
        <button class="primary" type="button" :disabled="isJoining" @click="joinClub">
          {{ isJoining ? 'Joining…' : 'Join my club' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.join-onboarding {
  width: min(1140px, 100%);
  min-height: 100svh;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 34px) clamp(20px, 3.5vw, 40px) 44px;
  color: #172319;
  background: var(--color-bg, #fff);
  font-family: inherit;
}
.join-screen {
  width: min(100%, var(--flow-content-width));
  margin-inline: auto;
}
.join-header {
  width: min(100%, var(--flow-content-width));
  margin-inline: auto;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  min-height: 52px;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: var(--app-hairline);
  color: #536057;
  font-size: 14px;
  font-weight: var(--font-weight-medium);
}
.join-header strong {
  font-weight: var(--font-weight-semibold);
}
.join-back {
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
.join-back svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.join-screen {
  display: grid;
  gap: 0;
  padding-top: clamp(30px, 7vw, 58px);
}
.join-intro {
  display: grid;
  max-width: 760px;
  gap: 7px;
}
.join-answer {
  display: grid;
  gap: 22px;
  margin-top: var(--flow-section-space);
}
.eyebrow {
  margin: 0;
  color: #647067;
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  max-width: 760px;
  margin: 0;
  font-size: clamp(22px, 5vw, 30px);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  letter-spacing: -0.025em;
}
.lead {
  max-width: 68ch;
  margin: 0;
  color: #5e6860;
  font-size: 13px;
  font-weight: var(--font-weight-regular);
  line-height: 1.65;
}
.join-alert {
  margin: 18px 0 0;
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
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 90px;
  column-gap: 15px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius, 16px);
  color: var(--color-text-soft, #425044);
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
  text-align: left;
  cursor: pointer;
  transition:
    transform 180ms var(--motion-curve),
    box-shadow 180ms var(--motion-curve),
    border-color 180ms ease,
    background 180ms ease;
}
.join-choices button:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-primary, #287a45) 24%, var(--color-border));
  box-shadow: var(--flow-shadow-hover);
}
.join-choices button.selected {
  border-color: color-mix(in srgb, var(--color-primary, #287a45) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary, #287a45) 2.5%, #fff);
  box-shadow: var(--flow-shadow-quiet);
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
.join-choices span {
  display: grid;
  gap: 5px;
}
.join-choices strong {
  font-size: 14.5px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.008em;
  line-height: 1.35;
}
.join-choices small {
  color: #687269;
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 1.55;
}
.join-choices b {
  color: #287a45;
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  opacity: 0.68;
}
.join-field {
  display: grid;
  gap: var(--flow-control-space);
  color: var(--color-text-soft, #425044);
  font-size: 12.5px;
  font-weight: var(--font-weight-medium);
}
.join-field input {
  width: 100%;
  min-height: 58px;
  padding: 14px 16px;
  border: var(--app-hairline);
  border-radius: 14px;
  color: inherit;
  background: #fff;
  font: inherit;
  font-size: 1.05rem;
  box-shadow: inset 0 1px 0 rgba(15, 34, 24, 0.015);
}
.join-field input::placeholder {
  color: var(--color-muted, #6d7a70);
  opacity: 0.62;
}
.qr-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
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
  outline: 2px solid rgba(40, 122, 69, 0.14);
  outline-offset: 2px;
  border-color: #287a45;
}
.join-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  margin-top: var(--flow-section-space);
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
    background: var(--color-bg, #fff);
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
