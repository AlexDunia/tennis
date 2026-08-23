<script setup>
import {
  onMounted,
  ref,
} from 'vue'

import {
  useRoute,
  useRouter,
} from 'vue-router'

import {
  claimPairingCode,
  claimPairingQrToken,
  clearDisplaySessionForThisTab,
  getReadableDisplaySession,
  readDisplaySessionForThisTab,
  storeDisplaySessionForThisTab,
} from '../services/tvPairingService'

import {
  formatPairingCode,
  normalizePairingCode,
} from '../utils/tvPairing'

const route =
  useRoute()

const router =
  useRouter()

const pairingCode =
  ref('')

const claiming =
  ref(false)

const message =
  ref('')

const codeInput =
  ref(null)

function updatePairingCode(
  event,
) {
  pairingCode.value =
    formatPairingCode(
      event.target.value,
    )
}

async function finishClaim(
  result,
) {
  if (
    !result?.displaySession
      ?.displaySessionId
  ) {
    return false
  }

  const stored =
    storeDisplaySessionForThisTab(
      result.displaySession
        .displaySessionId,
    )

  if (!stored) {
    message.value =
      'This browser could not keep the display session.'

    return false
  }

  await router.replace({
    name: 'TvDisplayLive',
  })

  return true
}

async function claimCode() {
  if (claiming.value) {
    return
  }

  const normalized =
    normalizePairingCode(
      pairingCode.value,
    )

  if (
    normalized.length !== 6
  ) {
    message.value =
      'Enter the full pairing code.'

    return
  }

  claiming.value =
    true

  message.value =
    ''

  try {
    const result =
      await claimPairingCode(
        normalized,
      )

    if (
      !(await finishClaim(
        result,
      ))
    ) {
      message.value =
        'This pairing code is unavailable or has expired.'
    }
  } finally {
    claiming.value =
      false
  }
}

async function claimQrTicket(
  ticket,
) {
  if (
    claiming.value ||
    !ticket
  ) {
    return
  }

  /*
   * Remove the QR credential from the
   * browser URL immediately.
   *
   * We already hold the value in memory.
   */
  await router.replace({
    name: 'TvDisplayPairing',
  })

  claiming.value =
    true

  message.value =
    'Connecting display…'

  try {
    const result =
      await claimPairingQrToken(
        ticket,
      )

    if (
      !(await finishClaim(
        result,
      ))
    ) {
      message.value =
        'This display invitation is unavailable or has expired.'
    }
  } finally {
    claiming.value =
      false
  }
}

onMounted(async () => {
  /*
   * A previously paired tab may refresh.
   */
  const existingId =
    readDisplaySessionForThisTab()

  if (existingId) {
    const existing =
      getReadableDisplaySession(
        existingId,
      )

    if (existing) {
      await router.replace({
        name: 'TvDisplayLive',
      })

      return
    }

    clearDisplaySessionForThisTab()
  }

  const ticket =
    String(
      route.query.ticket || '',
    )

  if (ticket) {
    await claimQrTicket(
      ticket,
    )

    return
  }

  codeInput.value?.focus()
})
</script>

<template>
  <main class="display-pairing">
    <section
      class="display-pairing__card"
      aria-labelledby="display-pairing-title"
    >
      <header>
        <strong>GORRA</strong>

        <span>
          Live display
        </span>
      </header>

      <div
        class="display-pairing__intro"
      >
        <p>Pair this display</p>

        <h1
          id="display-pairing-title"
        >
          Enter the code shown on
          Match Control
        </h1>

        <p>
          This display will receive
          read-only live scores.
        </p>
      </div>

      <form
        class="display-pairing__form"
        @submit.prevent="claimCode"
      >
        <label>
          <span>
            Pairing code
          </span>

          <input
            ref="codeInput"
            :value="pairingCode"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            maxlength="7"
            placeholder="ABC 234"
            @input="
              updatePairingCode
            "
          />
        </label>

        <button
          type="submit"
          :disabled="
            claiming ||
            normalizePairingCode(
              pairingCode,
            ).length !== 6
          "
        >
          {{
            claiming
              ? 'Connecting…'
              : 'Pair display'
          }}
        </button>
      </form>

      <p
        v-if="message"
        class="display-pairing__message"
        role="status"
      >
        {{ message }}
      </p>

      <div
        class="display-pairing__security"
      >
        <strong>
          Read only
        </strong>

        <span>
          This display can show the
          live match. It cannot add a
          point, undo scoring, change
          the server or take Match
          Control.
        </span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.display-pairing {
  min-height: 100svh;

  display: grid;
  place-items: center;

  padding: 24px;

  color: #173126;

  background: #f7faf7;
}

.display-pairing__card {
  width: min(100%, 480px);

  padding: 24px;

  border:
    1px solid
    rgba(7, 63, 48, 0.09);

  border-radius: 16px;

  background: #fff;

  box-shadow:
    0 8px 28px
    rgba(7, 45, 28, 0.05);
}

.display-pairing__card
  > header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 16px;
}

.display-pairing__card
  > header strong {
  color: #073f30;

  font-size: 16px;

  letter-spacing: 0.08em;
}

.display-pairing__card
  > header span {
  color: #74837b;

  font-size: 10px;
}

.display-pairing__intro {
  margin-top: 38px;
}

.display-pairing__intro
  > p:first-child {
  margin: 0;

  color: #087a35;

  font-size: 9px;
  font-weight: 700;

  letter-spacing: 0.08em;

  text-transform: uppercase;
}

.display-pairing h1 {
  margin: 8px 0 0;

  color: #10291e;

  font-size:
    clamp(
      25px,
      5vw,
      36px
    );

  line-height: 1.08;

  letter-spacing: -0.04em;
}

.display-pairing__intro
  > p:last-child {
  margin: 12px 0 0;

  color: #687970;

  font-size: 11px;

  line-height: 1.55;
}

.display-pairing__form {
  margin-top: 25px;

  display: grid;

  gap: 10px;
}

.display-pairing__form
  label {
  display: grid;

  gap: 7px;
}

.display-pairing__form
  label > span {
  color: #617269;

  font-size: 10px;
}

.display-pairing__form
  input {
  min-height: 58px;

  width: 100%;

  padding: 0 14px;

  border:
    1px solid
    rgba(7, 63, 48, 0.14);

  border-radius: 10px;

  color: #073f30;

  background: #fff;

  font: inherit;

  font-size: 24px;
  font-weight: 700;

  letter-spacing: 0.16em;

  text-transform: uppercase;
}

.display-pairing__form
  button {
  min-height: 48px;

  border: 0;

  border-radius: 9px;

  color: #fff;

  background: #008f15;

  font: inherit;

  font-size: 11px;
  font-weight: 650;

  cursor: pointer;
}

.display-pairing__form
  button:disabled {
  cursor: not-allowed;

  opacity: 0.4;
}

.display-pairing__message {
  margin: 12px 0 0;

  color: #66786e;

  font-size: 10px;
}

.display-pairing__security {
  margin-top: 19px;

  padding: 12px;

  border-radius: 9px;

  background: #f4f8f5;
}

.display-pairing__security
  strong,
.display-pairing__security
  span {
  display: block;
}

.display-pairing__security
  strong {
  color: #173126;

  font-size: 10px;
}

.display-pairing__security
  span {
  margin-top: 4px;

  color: #687970;

  font-size: 9px;

  line-height: 1.55;
}

.display-pairing input:focus-visible,
.display-pairing button:focus-visible {
  outline:
    3px solid
    rgba(0, 181, 26, 0.18);

  outline-offset: 2px;
}

@media (max-width: 420px) {
  .display-pairing {
    padding: 12px;
  }

  .display-pairing__card {
    padding: 18px;
  }
}
</style>
