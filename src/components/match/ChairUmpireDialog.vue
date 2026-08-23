<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },

  invitation: {
    type: Object,
    default: null,
  },

  candidates: {
    type: Array,
    default: () => [],
  },

  qrDataUrl: {
    type: String,
    default: '',
  },

  inviteUrl: {
    type: String,
    default: '',
  },

  currentScorerId: {
    type: String,
    default: '',
  },

  canHandoffControl: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'close',
  'invite-club-member',
  'invite-guest',
  'cancel-invitation',
  'handoff-control',
  'reclaim-control',
])

const mode = ref('choose')

const searchQuery = ref('')

const copyStatus = ref('')

const authorityAction = ref('')

const now = ref(Date.now())

let clockTimer = null

const filteredCandidates = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return props.candidates
  }

  return props.candidates.filter((candidate) =>
    [candidate.name, candidate.roleLabel].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(query),
    ),
  )
})

const waiting = computed(() => props.invitation?.status === 'waiting')

const accepted = computed(() => props.invitation?.status === 'accepted')

const expired = computed(() => {
  if (!waiting.value) {
    return false
  }

  return Number(props.invitation?.expiresAt || 0) <= now.value
})

const remainingText = computed(() => {
  if (!waiting.value || expired.value) {
    return '00:00'
  }

  const total = Math.max(
    0,
    Math.ceil((Number(props.invitation?.expiresAt || 0) - now.value) / 1000),
  )

  const minutes = Math.floor(total / 60)

  const seconds = total % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const waitingForName = computed(() => {
  if (props.invitation?.audience === 'club_member') {
    return props.invitation?.expectedName || 'Club member'
  }

  return 'Guest umpire'
})

const acceptedName = computed(() => props.invitation?.acceptedIdentity?.name || 'Chair umpire')

const acceptedScorerId =
  computed(
    () =>
      props.invitation
        ?.acceptedIdentity
        ?.userId ||
      props.invitation
        ?.acceptedIdentity
        ?.guestId ||
      '',
  )

const umpireHasControl =
  computed(
    () =>
      Boolean(
        acceptedScorerId.value &&
          props.currentScorerId ===
            acceptedScorerId.value,
      ),
  )

function beginAuthorityAction(
  action,
) {
  if (
    action === 'handoff' &&
    !props.canHandoffControl
  ) {
    return
  }

  authorityAction.value = action
}

function cancelAuthorityAction() {
  authorityAction.value = ''
}

function confirmAuthorityAction() {
  if (
    authorityAction.value ===
    'handoff'
  ) {
    emit('handoff-control')
  }

  if (
    authorityAction.value ===
    'reclaim'
  ) {
    emit('reclaim-control')
  }

  authorityAction.value = ''
}

async function copyInviteLink() {
  if (!props.inviteUrl) {
    return
  }

  copyStatus.value = ''

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.inviteUrl)

      copyStatus.value = 'Invitation link copied.'

      return
    }

    copyStatus.value = 'Select the link below to copy it.'
  } catch {
    copyStatus.value = 'Select the link below to copy it.'
  }
}

function chooseClubMember() {
  mode.value = 'club'
}

function backToChoose() {
  mode.value = 'choose'
  searchQuery.value = ''
}

watch(
  () => props.open,

  (open) => {
    if (!open) {
      mode.value = 'choose'
      searchQuery.value = ''
      copyStatus.value = ''
      authorityAction.value = ''

      if (clockTimer) {
        window.clearInterval(clockTimer)

        clockTimer = null
      }

      return
    }

    now.value = Date.now()

    if (!clockTimer) {
      clockTimer = window.setInterval(
        () => {
          now.value = Date.now()
        },

        1000,
      )
    }
  },

  {
    immediate: true,
  },
)

onBeforeUnmount(() => {
  if (clockTimer) {
    window.clearInterval(clockTimer)
  }
})
</script>

<template>
  <Transition name="umpire-dialog">
    <div v-if="open" class="umpire-dialog-backdrop" @click.self="emit('close')">
      <section
        class="umpire-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="umpire-dialog-title"
        @keydown.esc.prevent="emit('close')"
      >
        <header class="umpire-dialog__header">
          <div>
            <span> Match official </span>

            <h2 id="umpire-dialog-title">Chair umpire</h2>
          </div>

          <button
            type="button"
            class="umpire-dialog__close"
            aria-label="Close chair umpire"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7 7 17" />
            </svg>
          </button>
        </header>

        <!-- ACCEPTED CANDIDATE -->
        <template v-if="accepted">
          <div
            class="umpire-dialog__accepted"
          >
            <span
              class="umpire-dialog__accepted-mark"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24">
                <path
                  d="m7 12 3 3 7-7"
                />
              </svg>
            </span>

            <span>
              Invitation accepted
            </span>

            <strong>
              {{ acceptedName }}
            </strong>

            <p>
              They are ready to umpire this
              match.
            </p>
          </div>

          <div
            class="umpire-dialog__authority"
          >
            <strong>
              {{
                umpireHasControl
                  ? `${acceptedName} has Match Control.`
                  : 'You still control scoring.'
              }}
            </strong>

            <span>
              {{
                umpireHasControl
                  ? 'You still own the match and can take Match Control back at any time.'
                  : 'Accepting the invitation did not transfer Match Control.'
              }}
            </span>
          </div>

          <template
            v-if="!authorityAction"
          >
            <button
              v-if="!umpireHasControl"
              type="button"
              class="umpire-dialog__primary"
              :disabled="
                !canHandoffControl
              "
              @click="
                beginAuthorityAction(
                  'handoff',
                )
              "
            >
              Hand Match Control to
              {{ acceptedName }}
            </button>

            <button
              v-else
              type="button"
              class="umpire-dialog__primary"
              @click="
                beginAuthorityAction(
                  'reclaim',
                )
              "
            >
              Take back Match Control
            </button>
          </template>

          <div
            v-else
            class="umpire-dialog__handoff-confirm"
          >
            <strong>
              {{
                authorityAction ===
                'handoff'
                  ? `Give ${acceptedName} Match Control?`
                  : 'Take Match Control back?'
              }}
            </strong>

            <p>
              {{
                authorityAction ===
                'handoff'
                  ? `${acceptedName} will be able to add points, undo the last point and correct the server. You will remain the match owner.`
                  : `${acceptedName} will immediately lose scoring control. You will become the active scorer again.`
              }}
            </p>

            <div>
              <button
                type="button"
                @click="
                  cancelAuthorityAction
                "
              >
                Cancel
              </button>

              <button
                type="button"
                @click="
                  confirmAuthorityAction
                "
              >
                {{
                  authorityAction ===
                  'handoff'
                    ? 'Confirm handoff'
                    : 'Take back control'
                }}
              </button>
            </div>
          </div>

          <button
            v-if="!umpireHasControl"
            type="button"
            class="umpire-dialog__remove"
            @click="
              emit(
                'cancel-invitation',
              )
            "
          >
            Remove umpire candidate
          </button>
        </template>

        <!-- WAITING -->
        <template v-else-if="waiting && !expired">
          <p class="umpire-dialog__intro">
            Waiting for
            <strong>
              {{ waitingForName }}
            </strong>
            to accept.
          </p>

          <div class="umpire-dialog__invite-grid">
            <div class="umpire-dialog__qr">
              <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code for chair umpire invitation" />

              <span v-else> QR unavailable </span>
            </div>

            <div class="umpire-dialog__invite-copy">
              <span> Invitation expires in </span>

              <strong>
                {{ remainingText }}
              </strong>

              <button type="button" @click="copyInviteLink">Copy invitation link</button>
            </div>
          </div>

          <input
            v-if="inviteUrl"
            class="umpire-dialog__url"
            :value="inviteUrl"
            type="text"
            readonly
            aria-label="Chair umpire invitation link"
          />

          <p v-if="copyStatus" class="umpire-dialog__status" role="status">
            {{ copyStatus }}
          </p>

          <div class="umpire-dialog__authority">
            <strong> Invitation only. </strong>

            <span> This link cannot award points, undo scoring or take control of the match. </span>
          </div>

          <button type="button" class="umpire-dialog__remove" @click="emit('cancel-invitation')">
            Cancel invitation
          </button>
        </template>

        <!-- EXPIRED -->
        <template v-else-if="expired">
          <div class="umpire-dialog__ended">
            <span> Invitation expired </span>

            <strong> No umpire was added. </strong>

            <p>Choose someone again to generate a fresh, temporary invitation.</p>
          </div>

          <button type="button" class="umpire-dialog__primary" @click="emit('cancel-invitation')">
            Choose another umpire
          </button>
        </template>

        <!-- CHOOSE -->
        <template v-else>
          <template v-if="mode === 'choose'">
            <p class="umpire-dialog__intro">Who will officiate this match?</p>

            <div class="umpire-dialog__choices">
              <button type="button" @click="chooseClubMember">
                <span class="umpire-dialog__choice-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="9" cy="8" r="3" />

                    <path d="M4 19c.5-3.1 2.2-5 5-5s4.5 1.9 5 5" />

                    <path d="M16 7h4M18 5v4" />
                  </svg>
                </span>

                <span>
                  <strong> Club member </strong>

                  <small> Invite someone already connected to this club. </small>
                </span>
              </button>

              <button type="button" @click="emit('invite-guest')">
                <span class="umpire-dialog__choice-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8" r="3" />

                    <path d="M6.5 19c.7-3.2 2.5-5 5.5-5s4.8 1.8 5.5 5" />
                  </svg>
                </span>

                <span>
                  <strong> Guest umpire </strong>

                  <small> Send a temporary invitation without adding them to the club. </small>
                </span>
              </button>
            </div>
          </template>

          <!-- CLUB MEMBER LIST -->
          <template v-else>
            <button type="button" class="umpire-dialog__back" @click="backToChoose">← Back</button>

            <label class="umpire-dialog__search">
              <span> Find club member </span>

              <input
                v-model="searchQuery"
                type="search"
                autocomplete="off"
                placeholder="Search members"
              />
            </label>

            <div v-if="filteredCandidates.length" class="umpire-dialog__members">
              <button
                v-for="candidate in filteredCandidates"
                :key="candidate.id"
                type="button"
                @click="emit('invite-club-member', candidate)"
              >
                <span class="umpire-dialog__avatar">
                  {{ candidate.initials }}
                </span>

                <span>
                  <strong>
                    {{ candidate.name }}
                  </strong>

                  <small>
                    {{ candidate.roleLabel }}
                  </small>
                </span>

                <span aria-hidden="true"> › </span>
              </button>
            </div>

            <p v-else class="umpire-dialog__empty">
              No login-capable club members are available for this match.
            </p>
          </template>
        </template>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.umpire-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 130;

  padding: 18px 18px calc(18px + env(safe-area-inset-bottom));

  display: flex;
  align-items: center;
  justify-content: center;

  background: rgba(11, 31, 21, 0.22);
}

.umpire-dialog {
  width: min(100%, 500px);

  max-height: min(760px, calc(100svh - 36px));

  overflow-y: auto;

  padding: 18px;

  border: 1px solid rgba(7, 63, 48, 0.09);

  border-radius: 18px;

  color: #173126;

  background: #fff;

  box-shadow: 0 18px 50px rgba(7, 30, 19, 0.12);
}

.umpire-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.umpire-dialog__header > div > span {
  color: #087a35;

  font-size: 9px;
  font-weight: 700;

  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.umpire-dialog__header h2 {
  margin: 4px 0 0;

  color: #073f30;

  font-size: 20px;
  font-weight: 650;

  letter-spacing: -0.025em;
}

.umpire-dialog__close {
  width: 44px;
  height: 44px;

  flex: 0 0 auto;

  border: 1px solid rgba(7, 63, 48, 0.1);

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: #63756a;

  background: #fff;
}

.umpire-dialog__close svg {
  width: 16px;
  height: 16px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.umpire-dialog__intro {
  margin: 17px 0 0;

  color: #66786e;

  font-size: 11px;
  line-height: 1.55;
}

.umpire-dialog__intro strong {
  color: #173126;
}

.umpire-dialog__choices {
  margin-top: 15px;

  display: grid;
  gap: 8px;
}

.umpire-dialog__choices > button {
  min-height: 76px;

  padding: 12px;

  border: 1px solid rgba(7, 63, 48, 0.1);

  border-radius: 11px;

  display: flex;
  align-items: center;
  gap: 12px;

  color: #173126;

  background: #fff;

  text-align: left;

  cursor: pointer;
}

.umpire-dialog__choice-icon {
  width: 42px;
  height: 42px;

  flex: 0 0 auto;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: #087a35;

  background: #eef7f0;
}

.umpire-dialog__choice-icon svg {
  width: 20px;
  height: 20px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.umpire-dialog__choices strong,
.umpire-dialog__choices small {
  display: block;
}

.umpire-dialog__choices strong {
  font-size: 11px;
}

.umpire-dialog__choices small {
  margin-top: 3px;

  color: #708078;

  font-size: 9px;
  line-height: 1.45;
}

.umpire-dialog__back {
  margin-top: 15px;

  border: 0;

  color: #537065;

  background: transparent;

  font: inherit;
  font-size: 10px;

  cursor: pointer;
}

.umpire-dialog__search {
  display: grid;
  gap: 5px;

  margin-top: 12px;

  color: #62736a;

  font-size: 9px;
}

.umpire-dialog__search input {
  width: 100%;

  min-height: 44px;

  padding: 0 12px;

  border: 1px solid rgba(7, 63, 48, 0.13);

  border-radius: 9px;

  color: #173126;

  background: #fff;

  font: inherit;
  font-size: 16px;
}

.umpire-dialog__members {
  margin-top: 9px;

  display: grid;
  gap: 6px;
}

.umpire-dialog__members button {
  min-height: 58px;

  padding: 8px 10px;

  border: 1px solid rgba(7, 63, 48, 0.08);

  border-radius: 9px;

  display: grid;

  grid-template-columns:
    38px
    minmax(0, 1fr)
    auto;

  align-items: center;

  gap: 10px;

  color: #173126;

  background: #fff;

  text-align: left;

  cursor: pointer;
}

.umpire-dialog__avatar {
  width: 38px;
  height: 38px;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: #073f30;

  background: #eaf5ec;

  font-size: 10px;
  font-weight: 700;
}

.umpire-dialog__members strong,
.umpire-dialog__members small {
  display: block;
}

.umpire-dialog__members strong {
  font-size: 10px;
}

.umpire-dialog__members small {
  margin-top: 2px;

  color: #78867e;

  font-size: 8px;
}

.umpire-dialog__empty {
  margin: 17px 0 0;

  color: #78877f;

  font-size: 10px;
  line-height: 1.5;
}

.umpire-dialog__invite-grid {
  margin-top: 18px;

  display: grid;

  grid-template-columns:
    150px
    minmax(0, 1fr);

  gap: 18px;

  align-items: center;
}

.umpire-dialog__qr {
  width: 150px;

  aspect-ratio: 1;

  padding: 8px;

  border: 1px solid rgba(7, 63, 48, 0.09);

  border-radius: 12px;

  display: grid;
  place-items: center;

  color: #829087;

  background: #fff;

  font-size: 9px;
}

.umpire-dialog__qr img {
  width: 100%;
  height: 100%;

  display: block;
}

.umpire-dialog__invite-copy > span {
  display: block;

  color: #78877f;

  font-size: 8px;
}

.umpire-dialog__invite-copy > strong {
  display: block;

  margin-top: 4px;

  color: #073f30;

  font-size: 29px;
  font-weight: 700;

  font-variant-numeric: tabular-nums;
}

.umpire-dialog__invite-copy button {
  min-height: 42px;

  margin-top: 12px;

  padding: 0 12px;

  border: 0;

  border-radius: 8px;

  color: #fff;

  background: #008f15;

  font: inherit;
  font-size: 9px;
  font-weight: 650;

  cursor: pointer;
}

.umpire-dialog__url {
  width: 100%;

  min-height: 40px;

  margin-top: 11px;

  padding: 0 10px;

  border: 1px solid rgba(7, 63, 48, 0.09);

  border-radius: 8px;

  color: #708078;

  background: #f8faf8;

  font: inherit;
  font-size: 9px;
}

.umpire-dialog__status {
  margin: 7px 0 0;

  color: #087a35;

  font-size: 9px;
}

.umpire-dialog__authority {
  margin-top: 14px;

  padding: 11px 12px;

  border-radius: 9px;

  background: #f4f8f5;
}

.umpire-dialog__authority strong,
.umpire-dialog__authority span {
  display: block;
}

.umpire-dialog__authority strong {
  color: #173126;

  font-size: 9px;
}

.umpire-dialog__authority span {
  margin-top: 3px;

  color: #708078;

  font-size: 8px;
  line-height: 1.5;
}

.umpire-dialog__accepted,
.umpire-dialog__ended {
  margin-top: 20px;

  padding: 22px 16px;

  border-radius: 11px;

  text-align: center;

  background: #f7faf7;
}

.umpire-dialog__accepted-mark {
  width: 44px;
  height: 44px;

  margin: 0 auto 10px;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: #087a35;

  background: #e8f6eb;
}

.umpire-dialog__accepted-mark svg {
  width: 21px;
  height: 21px;

  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.umpire-dialog__accepted > span:not(.umpire-dialog__accepted-mark),
.umpire-dialog__ended > span {
  color: #087a35;

  font-size: 8px;
  font-weight: 700;

  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.umpire-dialog__accepted strong,
.umpire-dialog__ended strong {
  display: block;

  margin-top: 5px;

  color: #173126;

  font-size: 17px;
}

.umpire-dialog__accepted p,
.umpire-dialog__ended p {
  margin: 5px auto 0;

  max-width: 300px;

  color: #708078;

  font-size: 9px;
  line-height: 1.5;
}

.umpire-dialog__remove,
.umpire-dialog__primary {
  width: 100%;

  min-height: 46px;

  margin-top: 13px;

  border-radius: 9px;

  font: inherit;
  font-size: 10px;
  font-weight: 650;

  cursor: pointer;
}

.umpire-dialog__remove {
  border: 1px solid rgba(130, 55, 48, 0.14);

  color: #8c3932;

  background: #fffafa;
}

.umpire-dialog__primary {
  border: 0;

  color: #fff;

  background: #008f15;
}

.umpire-dialog button:focus-visible,
.umpire-dialog input:focus-visible {
  outline: 3px solid rgba(0, 181, 26, 0.18);

  outline-offset: 2px;
}

.umpire-dialog__handoff-confirm {
  margin-top: 13px;
  padding: 13px;
  border: 1px solid rgba(7, 63, 48, 0.09);
  border-radius: 10px;
  background: #f7faf7;
}

.umpire-dialog__handoff-confirm > strong {
  display: block;
  color: #173126;
  font-size: 10px;
}

.umpire-dialog__handoff-confirm > p {
  margin: 5px 0 0;
  color: #708078;
  font-size: 9px;
  line-height: 1.55;
}

.umpire-dialog__handoff-confirm > div {
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: 7px;
  margin-top: 12px;
}

.umpire-dialog__handoff-confirm button {
  min-height: 43px;
  border-radius: 8px;
  font: inherit;
  font-size: 9px;
  font-weight: 650;
  cursor: pointer;
}

.umpire-dialog__handoff-confirm button:first-child {
  border: 1px solid rgba(7, 63, 48, 0.1);
  color: #596c61;
  background: #fff;
}

.umpire-dialog__handoff-confirm button:last-child {
  border: 0;
  color: #fff;
  background: #008f15;
}

.umpire-dialog__primary:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

@media (max-width: 440px) {
  .umpire-dialog-backdrop {
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
  }

  .umpire-dialog {
    padding: 15px;

    border-radius: 16px;
  }

  .umpire-dialog__invite-grid {
    grid-template-columns: 1fr;

    justify-items: center;
  }

  .umpire-dialog__invite-copy {
    width: 100%;

    text-align: center;
  }
}

.umpire-dialog-enter-active,
.umpire-dialog-leave-active {
  transition: opacity 160ms ease;
}

.umpire-dialog-enter-active .umpire-dialog,
.umpire-dialog-leave-active .umpire-dialog {
  transition:
    opacity 170ms ease,
    transform 210ms cubic-bezier(0.22, 0.8, 0.22, 1);
}

.umpire-dialog-enter-from,
.umpire-dialog-leave-to {
  opacity: 0;
}

.umpire-dialog-enter-from .umpire-dialog,
.umpire-dialog-leave-to .umpire-dialog {
  opacity: 0;

  transform: translateY(12px) scale(0.99);
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
