<script setup>
import { computed, onMounted, ref } from 'vue'

import { useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'

import { usePlayerStore } from '../stores/player'

import {
  acceptChairUmpireAsClubMember,
  acceptChairUmpireAsGuest,
  declineChairUmpireInvitation,
  getChairUmpireInvitationByToken,
} from '../services/chairUmpireService'

import {
  chairUmpireInvitationCanBeAccepted,
  sanitizeChairUmpireName,
  validChairUmpireName,
} from '../utils/chairUmpire'

const props = defineProps({
  token: {
    type: String,
    required: true,
  },

  audience: {
    type: String,
    required: true,
  },
})

const router = useRouter()

const authStore = useAuthStore()

const playerStore = usePlayerStore()

const invitation = ref(null)

const guestName = ref('')

const actionPending = ref(false)

const actionError = ref('')

const accepted = ref(false)

const declined = ref(false)

/*
 * Membership.userId represents the account identity.
 *
 * Prefer auth user id when it exists.
 *
 * Current mock accounts may only expose playerId,
 * so that remains the development fallback.
 */
const currentIdentity = computed(() => ({
  id: authStore.user?.id || authStore.user?.playerId || playerStore.currentPlayer?.id || '',

  name: authStore.user?.name || playerStore.currentPlayer?.name || 'Club member',
}))

const invitationAvailable = computed(() => chairUmpireInvitationCanBeAccepted(invitation.value))

const audienceMatches = computed(() => invitation.value?.audience === props.audience)

const correctClubMember = computed(() => {
  if (props.audience !== 'club_member') {
    return true
  }

  return String(invitation.value?.expectedUserId || '') === String(currentIdentity.value.id || '')
})

const canAccept = computed(() => {
  if (actionPending.value || !invitationAvailable.value || !audienceMatches.value) {
    return false
  }

  if (props.audience === 'club_member') {
    return correctClubMember.value && Boolean(currentIdentity.value.id)
  }

  return validChairUmpireName(guestName.value)
})

const playerA = computed(() => invitation.value?.matchSummary?.playerAName || 'Player 1')

const playerB = computed(() => invitation.value?.matchSummary?.playerBName || 'Player 2')

async function acceptInvitation() {
  if (!canAccept.value) {
    return
  }

  actionPending.value = true

  actionError.value = ''

  try {
    const result =
      props.audience === 'club_member'
        ? acceptChairUmpireAsClubMember({
            token: props.token,

            actorId: currentIdentity.value.id,

            actorName: currentIdentity.value.name,
          })
        : acceptChairUmpireAsGuest({
            token: props.token,

            name: sanitizeChairUmpireName(guestName.value),
          })

    if (!result) {
      actionError.value = 'This invitation could not be accepted.'

      return
    }

    invitation.value = result

    accepted.value = true
  } finally {
    actionPending.value = false
  }
}

function declineInvitation() {
  if (!invitationAvailable.value || actionPending.value) {
    return
  }

  actionPending.value = true

  actionError.value = ''

  try {
    const success = declineChairUmpireInvitation({
      token: props.token,

      actorId: props.audience === 'club_member' ? currentIdentity.value.id : '',
    })

    if (!success) {
      actionError.value = 'This invitation could not be declined.'

      return
    }

    declined.value = true
  } finally {
    actionPending.value = false
  }
}

async function goHome() {
  await router.replace({
    name: authStore.isAuthenticated ? 'Dashboard' : 'Home',
  })
}

onMounted(async () => {
  if (props.audience === 'club_member' && !playerStore.players.length) {
    try {
      await playerStore.loadPlayers()
    } catch {
      /*
       * Account identity remains enough
       * to validate the invitation.
       */
    }
  }

  invitation.value = getChairUmpireInvitationByToken(props.token)
})
</script>

<template>
  <main class="umpire-invite">
    <header class="umpire-invite__header">
      <strong>GORRA</strong>

      <span> Chair umpire invitation </span>
    </header>

    <section class="umpire-invite__card">
      <template v-if="accepted">
        <div class="umpire-invite__success">
          <span class="umpire-invite__success-mark" aria-hidden="true"> ✓ </span>

          <p>Invitation accepted</p>

          <h1>You're ready to umpire.</h1>

          <strong>
            {{ playerA }}
            <span>vs</span>
            {{ playerB }}
          </strong>

          <div class="umpire-invite__authority">
            <strong> No scoring control yet </strong>

            <span>
              The match owner still controls scoring. Gorra will require a separate handoff before
              you can change the score.
            </span>
          </div>
        </div>
      </template>

      <template v-else-if="declined">
        <p class="umpire-invite__eyebrow">Invitation declined</p>

        <h1>No changes were made.</h1>

        <p class="umpire-invite__copy">You have not been given any permissions for this match.</p>
      </template>

      <template v-else-if="!invitation || !audienceMatches || !invitationAvailable">
        <p class="umpire-invite__eyebrow">Chair umpire</p>

        <h1>This invitation is no longer available.</h1>

        <p class="umpire-invite__copy">
          It may have expired, been cancelled or already been used. Ask the match owner for another
          invitation.
        </p>
      </template>

      <template v-else-if="audience === 'club_member' && !correctClubMember">
        <p class="umpire-invite__eyebrow">Chair umpire</p>

        <h1>This invitation belongs to another club member.</h1>

        <p class="umpire-invite__copy">
          Sign in with the Gorra account that received this invitation.
        </p>
      </template>

      <template v-else>
        <p class="umpire-invite__eyebrow">
          {{
            invitation.createdByName
              ? `${invitation.createdByName} invited you`
              : 'You have been invited'
          }}
        </p>

        <h1>Chair umpire this match?</h1>

        <p class="umpire-invite__match">
          <strong>
            {{ playerA }}
          </strong>

          <span>vs</span>

          <strong>
            {{ playerB }}
          </strong>
        </p>

        <p class="umpire-invite__copy">
          Accepting tells the match owner that you're ready to officiate. It does not give you Match
          Control yet.
        </p>

        <label v-if="audience === 'guest'" class="umpire-invite__name">
          <span> Your name </span>

          <input
            v-model="guestName"
            type="text"
            maxlength="60"
            autocomplete="name"
            placeholder="Enter your name"
          />
        </label>

        <p v-if="actionError" class="umpire-invite__error" role="alert">
          {{ actionError }}
        </p>

        <div class="umpire-invite__actions">
          <button
            type="button"
            class="secondary"
            :disabled="actionPending"
            @click="declineInvitation"
          >
            Decline
          </button>

          <button type="button" class="primary" :disabled="!canAccept" @click="acceptInvitation">
            {{ actionPending ? 'Please wait…' : 'Accept invitation' }}
          </button>
        </div>
      </template>

      <button v-if="accepted || declined" type="button" class="umpire-invite__done" @click="goHome">
        Done
      </button>
    </section>

    <footer class="umpire-invite__footer">Umpire invitation only · no scoring authority</footer>
  </main>
</template>

<style scoped>
.umpire-invite {
  min-height: 100svh;

  display: grid;

  grid-template-rows:
    auto
    1fr
    auto;

  padding: 0 max(18px, 6vw);

  color: #173126;

  background: #f7faf7;

  font-family: inherit;
}

.umpire-invite__header {
  min-height: 72px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 20px;

  border-bottom: 1px solid rgba(7, 63, 48, 0.08);
}

.umpire-invite__header strong {
  color: #073f30;

  font-size: 19px;
  font-weight: 800;

  letter-spacing: 0.075em;
}

.umpire-invite__header span {
  color: #74837b;

  font-size: 10px;
}

.umpire-invite__card {
  width: min(100%, 520px);

  margin: auto;

  padding: 28px 24px;

  border: 1px solid rgba(7, 63, 48, 0.09);

  border-radius: 18px;

  background: #fff;

  box-shadow: 0 7px 26px rgba(7, 45, 28, 0.05);
}

.umpire-invite__eyebrow {
  margin: 0;

  color: #087a35;

  font-size: 10px;
  font-weight: 700;

  letter-spacing: 0.09em;

  text-transform: uppercase;
}

.umpire-invite h1 {
  margin: 8px 0 0;

  color: #10291e;

  font-size: clamp(27px, 5vw, 38px);

  font-weight: 680;

  letter-spacing: -0.04em;

  line-height: 1.08;
}

.umpire-invite__match {
  margin: 18px 0 0;

  display: flex;
  align-items: center;
  flex-wrap: wrap;

  gap: 7px;

  color: #173126;

  font-size: 13px;
}

.umpire-invite__match span {
  color: #8b968f;
}

.umpire-invite__copy {
  margin: 13px 0 0;

  color: #687970;

  font-size: 12px;

  line-height: 1.6;
}

.umpire-invite__name {
  margin-top: 19px;

  display: grid;

  gap: 7px;

  color: #617269;

  font-size: 10px;
}

.umpire-invite__name input {
  width: 100%;

  min-height: 48px;

  padding: 0 12px;

  border: 1px solid rgba(7, 63, 48, 0.13);

  border-radius: 9px;

  color: #173126;

  background: #fff;

  font: inherit;
  font-size: 16px;
}

.umpire-invite__actions {
  margin-top: 20px;

  display: grid;

  grid-template-columns:
    1fr
    1.35fr;

  gap: 8px;
}

.umpire-invite__actions button,
.umpire-invite__done {
  min-height: 48px;

  border-radius: 9px;

  font: inherit;

  font-size: 11px;
  font-weight: 650;

  cursor: pointer;
}

.umpire-invite__actions .secondary {
  border: 1px solid rgba(7, 63, 48, 0.11);

  color: #596c61;

  background: #fff;
}

.umpire-invite__actions .primary {
  border: 0;

  color: #fff;

  background: #008f15;
}

.umpire-invite__actions button:disabled {
  cursor: not-allowed;

  opacity: 0.42;
}

.umpire-invite__error {
  margin: 11px 0 0;

  color: #963d34;

  font-size: 10px;
}

.umpire-invite__success {
  text-align: center;
}

.umpire-invite__success-mark {
  width: 48px;
  height: 48px;

  margin: 0 auto;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: #087a35;

  background: #e8f6eb;

  font-size: 20px;
}

.umpire-invite__success > p {
  margin: 13px 0 0;

  color: #087a35;

  font-size: 9px;
  font-weight: 700;

  letter-spacing: 0.09em;

  text-transform: uppercase;
}

.umpire-invite__success > strong {
  display: block;

  margin-top: 15px;

  color: #173126;

  font-size: 13px;
}

.umpire-invite__success > strong span {
  margin: 0 5px;

  color: #87938c;
}

.umpire-invite__authority {
  margin-top: 14px;

  padding: 12px;

  border-radius: 9px;

  background: #f5f8f6;
}

.umpire-invite__authority strong,
.umpire-invite__authority span {
  display: block;
}

.umpire-invite__authority strong {
  color: #173126;

  font-size: 10px;
}

.umpire-invite__authority span {
  margin-top: 4px;

  color: #65766c;

  font-size: 10px;

  line-height: 1.55;
}

.umpire-invite__done {
  width: 100%;

  margin-top: 17px;

  border: 1px solid rgba(7, 63, 48, 0.1);

  color: #173126;

  background: #fff;
}

.umpire-invite__footer {
  min-height: 48px;

  border-top: 1px solid rgba(7, 63, 48, 0.07);

  display: flex;
  align-items: center;

  color: #87928c;

  font-size: 9px;
}

.umpire-invite button:focus-visible,
.umpire-invite input:focus-visible {
  outline: 3px solid rgba(0, 181, 26, 0.18);

  outline-offset: 2px;
}

@media (max-width: 420px) {
  .umpire-invite {
    padding: 0 12px;
  }

  .umpire-invite__header span {
    display: none;
  }

  .umpire-invite__card {
    padding: 22px 16px;
  }

  .umpire-invite__actions {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
