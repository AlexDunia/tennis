<script setup>
import QRCode from 'qrcode'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  getOrCreateLadderPlayerAccess,
  rotateLadderPlayerAccess,
} from '../../services/LadderPlayerAccessService.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  clubId: { type: String, default: '' },
  clubName: { type: String, default: 'Club' },
  ladder: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const router = useRouter()
const access = ref(null)
const qrDataUrl = ref('')
const copyMessage = ref('')
const rotateConfirmationOpen = ref(false)

const ladderId = computed(() => String(props.ladder?.id || '').trim())
const ladderName = computed(() => props.ladder?.name || 'this Ladder')
const clubName = computed(() => props.clubName || 'Club')
const playerAccessUrl = computed(() => {
  if (!access.value?.token) return ''
  const href = router.resolve({
    name: 'LadderPlayerAccess',
    params: { token: access.value.token },
  }).href
  return new URL(href, window.location.origin).toString()
})

async function createQr() {
  qrDataUrl.value = ''
  if (!playerAccessUrl.value) return
  try {
    qrDataUrl.value = await QRCode.toDataURL(playerAccessUrl.value, {
      width: 260,
      margin: 2,
      color: { dark: '#172319', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch {
    qrDataUrl.value = ''
  }
}

async function loadAccess() {
  copyMessage.value = ''
  rotateConfirmationOpen.value = false
  if (!props.open || !props.clubId || !ladderId.value) {
    access.value = null
    qrDataUrl.value = ''
    return
  }
  access.value = getOrCreateLadderPlayerAccess({
    clubId: props.clubId,
    ladderId: ladderId.value,
  })
  await createQr()
}

async function copyLink() {
  if (!playerAccessUrl.value) return
  try {
    await navigator.clipboard.writeText(playerAccessUrl.value)
    copyMessage.value = 'Link copied.'
  } catch {
    copyMessage.value = 'Select the link below to copy it.'
  }
}

async function confirmRotation() {
  access.value = rotateLadderPlayerAccess({
    clubId: props.clubId,
    ladderId: ladderId.value,
  })
  rotateConfirmationOpen.value = false
  copyMessage.value = access.value ? 'New player access code created.' : 'Unable to create a new code.'
  await createQr()
}

watch(
  () => [props.open, props.clubId, ladderId.value],
  () => { loadAccess() },
  { immediate: true },
)
</script>

<template>
  <div v-if="open" class="player-access-dialog" role="presentation" @click.self="emit('close')">
    <section class="player-access-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="player-access-title">
      <header>
        <div>
          <p class="player-access-dialog__eyebrow">Player access</p>
          <h2 id="player-access-title">Scan this code to open {{ ladderName }}</h2>
          <p>{{ clubName }}</p>
        </div>
        <button type="button" class="player-access-dialog__close" aria-label="Close player access" @click="emit('close')">×</button>
      </header>

      <div class="player-access-dialog__qr">
        <img v-if="qrDataUrl" :src="qrDataUrl" :alt="`Player access QR code for ${ladderName}`" />
        <p v-else>Preparing player access code…</p>
      </div>

      <p class="player-access-dialog__notice">Players sign in before they can use this link. It does not grant Club or scoring permissions.</p>

      <label class="player-access-dialog__link">
        <span>Player link</span>
        <input :value="playerAccessUrl" readonly aria-label="Player access link" @focus="$event.target.select()" />
      </label>
      <p v-if="copyMessage" class="player-access-dialog__message" role="status">{{ copyMessage }}</p>

      <div class="player-access-dialog__actions">
        <button type="button" class="button-primary" :disabled="!playerAccessUrl" @click="copyLink">Copy link</button>
        <button type="button" @click="rotateConfirmationOpen = true">New code</button>
        <button type="button" @click="emit('close')">Close</button>
      </div>

      <section v-if="rotateConfirmationOpen" class="player-access-dialog__confirm" aria-live="polite">
        <strong>Make a new player access code?</strong>
        <p>The old QR/link will stop resolving in this local prototype.</p>
        <div>
          <button type="button" class="button-primary" @click="confirmRotation">Make new code</button>
          <button type="button" @click="rotateConfirmationOpen = false">Keep current code</button>
        </div>
      </section>
    </section>
  </div>
</template>

<style scoped>
.player-access-dialog { position: fixed; z-index: 1200; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(12, 21, 14, .48); }
.player-access-dialog__panel { width: min(100%, 480px); display: grid; gap: 16px; padding: 24px; border: 1px solid var(--color-border); border-radius: var(--app-card-radius); background: var(--color-surface); box-shadow: 0 20px 56px rgba(0, 0, 0, .2); }
.player-access-dialog__panel header { display: flex; justify-content: space-between; gap: 20px; }
.player-access-dialog__panel h2, .player-access-dialog__panel p { margin: 0; }
.player-access-dialog__eyebrow, .player-access-dialog__link span { color: var(--color-muted); font-size: 11px; font-weight: var(--font-weight-semibold); letter-spacing: .06em; text-transform: uppercase; }
.player-access-dialog__panel header p:last-child { margin-top: 5px; color: var(--color-muted); font-size: 13px; }
.player-access-dialog__close { width: 34px; height: 34px; border: 0; border-radius: 50%; background: var(--color-surface-soft); color: var(--color-text); font-size: 26px; line-height: 1; }
.player-access-dialog__qr { display: grid; min-height: 264px; place-items: center; padding: 10px; border-radius: var(--app-inner-radius); background: #fff; }
.player-access-dialog__qr img { display: block; width: 260px; max-width: 100%; height: auto; }
.player-access-dialog__qr p { color: #526055; font-size: 13px; }
.player-access-dialog__notice { color: var(--color-muted); font-size: 12px; line-height: 1.55; }
.player-access-dialog__link { display: grid; gap: 7px; }
.player-access-dialog__link input { width: 100%; min-height: 42px; padding: 9px 10px; border: 1px solid var(--color-border); border-radius: var(--app-inner-radius); background: var(--color-surface-soft); color: var(--color-text); font-size: 12px; }
.player-access-dialog__message { color: var(--color-primary-strong); font-size: 12px; }
.player-access-dialog__actions, .player-access-dialog__confirm > div { display: flex; flex-wrap: wrap; gap: 9px; }
.player-access-dialog__actions button, .player-access-dialog__confirm button { min-height: 40px; padding: 8px 13px; }
.player-access-dialog__confirm { display: grid; gap: 8px; padding: 14px; border: 1px solid rgba(173, 126, 24, .35); border-radius: var(--app-inner-radius); background: rgba(255, 211, 61, .08); }
.player-access-dialog__confirm p { color: var(--color-muted); font-size: 12px; line-height: 1.45; }
@media (max-width: 520px) { .player-access-dialog__panel { padding: 18px; } .player-access-dialog__actions button { flex: 1 1 100%; } }
</style>