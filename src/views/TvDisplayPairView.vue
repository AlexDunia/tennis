<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

import { useRoute, useRouter } from 'vue-router'

import {
  claimPairingCode,
  claimPairingQrToken,
  storeDisplaySessionForThisTab,
} from '../services/tvPairingService'

import { formatPairingCode, normalizePairingCode } from '../utils/tvPairing'

const route = useRoute()
const router = useRouter()

const code = ref('')

const claiming = ref(false)

const errorMessage = ref('')

const codeInputRef = ref(null)

const normalizedCode = computed(() => normalizePairingCode(code.value))

const canSubmit = computed(() => !claiming.value && normalizedCode.value.length === 6)

function updateCode(event) {
  code.value = formatPairingCode(event.target.value)
}

async function finishClaim(result) {
  if (!result?.displaySession?.displaySessionId) {
    return false
  }

  const stored = storeDisplaySessionForThisTab(result.displaySession.displaySessionId)

  if (!stored) {
    errorMessage.value = 'This browser cannot keep the display session.'

    return false
  }

  await router.replace({
    name: 'TvDisplayLive',
  })

  return true
}

async function submitCode() {
  if (!canSubmit.value) {
    return
  }

  claiming.value = true

  errorMessage.value = ''

  try {
    const result = await claimPairingCode(normalizedCode.value)

    if (!result) {
      errorMessage.value = 'That code is invalid, expired or already used.'

      return
    }

    await finishClaim(result)
  } catch {
    errorMessage.value = 'Gorra could not pair this display.'
  } finally {
    claiming.value = false
  }
}

async function claimQrTicket(ticket) {
  claiming.value = true

  errorMessage.value = ''

  try {
    const result = await claimPairingQrToken(ticket)

    if (!result) {
      errorMessage.value = 'This QR pairing has expired or was already used.'

      await nextTick()

      codeInputRef.value?.focus()

      return
    }

    await finishClaim(result)
  } catch {
    errorMessage.value = 'Gorra could not pair this display.'
  } finally {
    claiming.value = false
  }
}

onMounted(async () => {
  /*
   * Read the QR ticket once and immediately scrub it
   * from the visible URL/history entry.
   */
  const ticket = String(route.query.ticket || '')

  if (ticket) {
    await router.replace({
      name: 'TvDisplayPair',
    })

    await claimQrTicket(ticket)

    return
  }

  await nextTick()

  codeInputRef.value?.focus()
})
</script>

<template>
  <main class="display-pair">
    <header class="display-pair__header">
      <div class="display-pair__brand" aria-label="Gorra">
        <span aria-hidden="true"></span>

        <strong> GORRA </strong>
      </div>
    </header>

    <section class="display-pair__content">
      <div class="display-pair__screen-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="14" rx="2" />

          <path d="M8 21h8M12 18v3" />
        </svg>
      </div>

      <p class="display-pair__eyebrow">Live display</p>

      <h1>Connect this screen.</h1>

      <p class="display-pair__intro">Enter the temporary code shown on Match Control.</p>

      <form class="display-pair__form" @submit.prevent="submitCode">
        <label for="display-code"> Display code </label>

        <input
          id="display-code"
          ref="codeInputRef"
          :value="code"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="7"
          placeholder="ABC 234"
          :disabled="claiming"
          @input="updateCode"
        />

        <button type="submit" :disabled="!canSubmit">
          {{ claiming ? 'Connecting…' : 'Connect display' }}
        </button>
      </form>

      <p v-if="errorMessage" class="display-pair__error" role="alert">
        {{ errorMessage }}
      </p>

      <div class="display-pair__security">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z" />

          <path d="m9.5 12 1.7 1.7 3.5-4" />
        </svg>

        <p>
          <strong> Read-only </strong>

          <span> This screen can follow the match. It cannot score, undo or control play. </span>
        </p>
      </div>
    </section>

    <footer class="display-pair__footer">Pairing codes expire automatically.</footer>
  </main>
</template>

<style scoped>
.display-pair {
  min-height: 100svh;

  display: grid;

  grid-template-rows:
    auto
    1fr
    auto;

  padding: 0 max(22px, 6vw);

  color: #173126;

  background: #f7faf7;

  font-family: inherit;

  -webkit-font-smoothing: antialiased;
}

.display-pair__header {
  min-height: 76px;

  border-bottom: 1px solid rgba(7, 63, 48, 0.08);

  display: flex;
  align-items: center;
}

.display-pair__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  color: #073f30;

  font-size: 20px;
  font-weight: 800;

  letter-spacing: 0.075em;
}

.display-pair__brand > span {
  width: 19px;
  height: 19px;

  border: 1.5px solid #087a35;

  border-radius: 50%;
}

.display-pair__content {
  width: min(480px, 100%);

  margin: auto;

  padding: 40px 0;

  text-align: center;
}

.display-pair__screen-icon {
  width: 58px;
  height: 58px;

  margin: 0 auto 21px;

  border: 1px solid rgba(8, 122, 53, 0.13);

  border-radius: 17px;

  display: grid;
  place-items: center;

  color: #087a35;

  background: #eef7f0;
}

.display-pair__screen-icon svg {
  width: 25px;
  height: 25px;

  fill: none;

  stroke: currentColor;

  stroke-width: 1.6;

  stroke-linecap: round;
  stroke-linejoin: round;
}

.display-pair__eyebrow {
  margin: 0;

  color: #087a35;

  font-size: 9px;
  font-weight: 750;

  letter-spacing: 0.1em;

  text-transform: uppercase;
}

.display-pair h1 {
  margin: 8px 0 0;

  color: #10291e;

  font-size: clamp(30px, 6vw, 44px);

  font-weight: 680;

  letter-spacing: -0.04em;
}

.display-pair__intro {
  margin: 10px auto 0;

  color: #66786e;

  font-size: 13px;

  line-height: 1.55;
}

.display-pair__form {
  margin-top: 28px;

  display: grid;

  gap: 10px;

  text-align: left;
}

.display-pair__form label {
  color: #55685d;

  font-size: 10px;
  font-weight: 650;
}

.display-pair__form input {
  width: 100%;

  height: 72px;

  padding: 0 16px;

  border: 1px solid rgba(7, 63, 48, 0.16);

  border-radius: 12px;

  color: #073f30;

  background: #fff;

  font: inherit;

  font-size: 31px;
  font-weight: 720;

  letter-spacing: 0.16em;

  text-align: center;

  text-transform: uppercase;

  outline: none;
}

.display-pair__form input:focus {
  border-color: #087a35;

  box-shadow: 0 0 0 3px rgba(8, 122, 53, 0.1);
}

.display-pair__form button {
  min-height: 50px;

  border: 0;

  border-radius: 10px;

  color: #fff;

  background: #008f15;

  font: inherit;

  font-size: 12px;
  font-weight: 680;

  cursor: pointer;

  touch-action: manipulation;
}

.display-pair__form button:disabled {
  cursor: not-allowed;

  opacity: 0.42;
}

.display-pair__form button:focus-visible {
  outline: 3px solid rgba(8, 122, 53, 0.2);

  outline-offset: 3px;
}

.display-pair__error {
  margin: 11px 0 0;

  color: #9f3b32;

  font-size: 10px;
}

.display-pair__security {
  margin-top: 20px;

  padding: 12px 13px;

  border: 1px solid rgba(7, 63, 48, 0.08);

  border-radius: 10px;

  display: flex;
  align-items: flex-start;
  gap: 10px;

  text-align: left;

  background: #fff;
}

.display-pair__security svg {
  width: 19px;
  height: 19px;

  flex: 0 0 auto;

  fill: none;

  stroke: #087a35;

  stroke-width: 1.7;

  stroke-linecap: round;
  stroke-linejoin: round;
}

.display-pair__security p {
  margin: 0;
}

.display-pair__security strong,
.display-pair__security span {
  display: block;
}

.display-pair__security strong {
  color: #173126;

  font-size: 10px;
}

.display-pair__security span {
  margin-top: 2px;

  color: #708078;

  font-size: 9px;

  line-height: 1.5;
}

.display-pair__footer {
  min-height: 48px;

  border-top: 1px solid rgba(7, 63, 48, 0.07);

  display: flex;
  align-items: center;

  color: #849088;

  font-size: 9px;
}

@media (max-width: 400px) {
  .display-pair {
    padding: 0 14px;
  }

  .display-pair__content {
    padding: 28px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
