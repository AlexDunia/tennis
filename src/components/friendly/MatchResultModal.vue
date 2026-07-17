<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FlowIcon from './FlowIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  winner: { type: String, default: '' },
  currentPlayerName: { type: String, default: 'Club player' },
  opponentName: { type: String, default: 'Opponent' },
  score: { type: String, default: '0–0' },
  setScores: { type: Array, default: () => [] },
  matchFormat: { type: String, default: 'Friendly match' },
  scoringFormat: { type: String, default: 'Advantage' },
})

const emit = defineEmits(['close', 'finish'])
const shareOptionsOpen = ref(false)
const shareStatus = ref('')
const exportBusy = ref(false)
let previousBodyOverflow = ''

const currentPlayerWon = computed(() => props.winner === 'you')
const winnerName = computed(() =>
  currentPlayerWon.value ? props.currentPlayerName : props.opponentName,
)
const sentenceOpponentName = computed(() => props.opponentName.replace(/[.!?]+$/, ''))
const headline = computed(() =>
  currentPlayerWon.value ? 'You won the match.' : `${props.opponentName} wins the match.`,
)
const resultCopy = computed(() =>
  currentPlayerWon.value
    ? `A complete performance against ${sentenceOpponentName.value}. This result is ready for the record.`
    : `A completed match against ${sentenceOpponentName.value}. The final result is ready for the record.`,
)
const shareText = computed(() => {
  const result = currentPlayerWon.value
    ? `${props.currentPlayerName} defeated ${props.opponentName}`
    : `${props.opponentName} defeated ${props.currentPlayerName}`
  return `${result} · ${props.score} · ${props.matchFormat} on Gorra.`
})
const safeFileName = computed(() => {
  const name = winnerName.value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `gorra-${name || 'match'}-winner.png`
})

function closeModal() {
  shareOptionsOpen.value = false
  shareStatus.value = ''
  emit('close')
}

function handleEscape(event) {
  if (event.key === 'Escape' && props.open) closeModal()
}

watch(
  () => props.open,
  (open) => {
    if (typeof document === 'undefined') return
    if (open) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      shareStatus.value = ''
    } else document.body.style.overflow = previousBodyOverflow
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', handleEscape))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape)
  if (typeof document !== 'undefined') document.body.style.overflow = previousBodyOverflow
})

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate
    else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  lines.slice(0, maxLines).forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight))
}

function createChampionCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')

  const background = ctx.createLinearGradient(0, 0, 1080, 1350)
  background.addColorStop(0, '#06150d')
  background.addColorStop(0.58, '#0b2818')
  background.addColorStop(1, '#16482a')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 1080, 1350)

  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = '#c9f5d5'
  ctx.lineWidth = 4
  ctx.strokeRect(82, 92, 916, 1166)
  ctx.beginPath()
  ctx.moveTo(82, 675)
  ctx.lineTo(998, 675)
  ctx.moveTo(540, 92)
  ctx.lineTo(540, 1258)
  ctx.moveTo(82, 390)
  ctx.lineTo(998, 390)
  ctx.moveTo(82, 960)
  ctx.lineTo(998, 960)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = '#b9eac5'
  ctx.font = '700 30px Inter, Arial, sans-serif'
  ctx.letterSpacing = '6px'
  ctx.fillText('GORRA MATCH CENTRE', 90, 105)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#d7b66c'
  ctx.font = '800 28px Inter, Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('OFFICIAL RESULT', 990, 105)
  ctx.textAlign = 'left'

  ctx.beginPath()
  ctx.arc(540, 310, 88, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(215, 182, 108, 0.14)'
  ctx.fill()
  ctx.strokeStyle = '#d7b66c'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#d7b66c'
  ctx.font = '800 58px Inter, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('W', 540, 330)

  ctx.fillStyle = '#d7b66c'
  ctx.font = '800 25px Inter, Arial, sans-serif'
  ctx.letterSpacing = '5px'
  ctx.fillText('MATCH WINNER', 540, 445)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 76px Inter, Arial, sans-serif'
  wrapText(ctx, winnerName.value, 540, 555, 820, 84, 2)

  ctx.fillStyle = 'rgba(255,255,255,0.68)'
  ctx.font = '500 29px Inter, Arial, sans-serif'
  ctx.fillText(
    `vs ${currentPlayerWon.value ? props.opponentName : props.currentPlayerName}`,
    540,
    690,
  )

  roundedRect(ctx, 132, 765, 816, 210, 30)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#b9eac5'
  ctx.font = '700 22px Inter, Arial, sans-serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('FINAL SCORE', 540, 825)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 62px Inter, Arial, sans-serif'
  ctx.fillText(props.score, 540, 910)

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '600 25px Inter, Arial, sans-serif'
  ctx.fillText(`${props.matchFormat} · ${props.scoringFormat}`, 540, 1048)
  ctx.fillStyle = 'rgba(255,255,255,0.48)'
  ctx.font = '500 22px Inter, Arial, sans-serif'
  ctx.fillText(
    new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date()),
    540,
    1092,
  )

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 30px Inter, Arial, sans-serif'
  ctx.fillText('PLAYED. RECORDED. REMEMBERED.', 540, 1215)
  ctx.fillStyle = '#7de39a'
  ctx.font = '700 22px Inter, Arial, sans-serif'
  ctx.fillText('GORRA · CLUB TENNIS', 540, 1260)
  ctx.textAlign = 'left'
  return canvas
}

function championBlob() {
  return new Promise((resolve, reject) => {
    const canvas = createChampionCanvas()
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image export failed'))),
      'image/png',
    )
  })
}

async function saveChampionImage() {
  if (exportBusy.value) return
  exportBusy.value = true
  shareStatus.value = ''
  try {
    const blob = await championBlob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = safeFileName.value
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    shareStatus.value = 'Champion image saved to your device.'
  } catch {
    shareStatus.value = 'The image could not be saved. Please try again.'
  } finally {
    exportBusy.value = false
  }
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(shareText.value)
    shareStatus.value = 'Result copied.'
  } catch {
    const input = document.createElement('textarea')
    input.value = shareText.value
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
    shareStatus.value = 'Result copied.'
  }
}

async function shareFromDevice() {
  if (!navigator.share) {
    await copyResult()
    shareStatus.value = 'Device sharing is unavailable here. The result was copied instead.'
    return
  }
  try {
    const blob = await championBlob()
    const file = new File([blob], safeFileName.value, { type: 'image/png' })
    const data = { title: 'Gorra match result', text: shareText.value }
    if (!navigator.canShare || navigator.canShare({ files: [file] })) data.files = [file]
    await navigator.share(data)
    shareStatus.value = 'Result shared.'
  } catch (error) {
    if (error?.name !== 'AbortError') shareStatus.value = 'Sharing was not completed.'
  }
}

function shareTo(network) {
  const text = encodeURIComponent(shareText.value)
  const url =
    network === 'whatsapp'
      ? `https://wa.me/?text=${text}`
      : `https://twitter.com/intent/tweet?text=${text}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="result-modal">
      <div v-if="open" class="result-overlay" role="presentation" @click.self="closeModal">
        <section
          class="result-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-modal-title"
        >
          <div class="result-modal__court" aria-hidden="true"></div>
          <header class="result-modal__topbar">
            <span>Gorra Match Centre</span><strong>Official result</strong>
            <button type="button" aria-label="Close result" @click="closeModal">
              <FlowIcon name="close" />
            </button>
          </header>

          <div class="result-modal__hero">
            <span class="result-modal__crest"><FlowIcon name="trophy" /></span>
            <p>{{ currentPlayerWon ? 'Match winner' : 'Match complete' }}</p>
            <h2 id="result-modal-title">{{ headline }}</h2>
            <span>{{ resultCopy }}</span>
          </div>

          <div class="result-scoreboard">
            <div class="result-scoreboard__players">
              <div :class="{ 'is-winner': currentPlayerWon }">
                <span>{{ currentPlayerName }}</span
                ><small>{{ currentPlayerWon ? 'Winner' : 'Player' }}</small>
              </div>
              <strong>vs</strong>
              <div :class="{ 'is-winner': !currentPlayerWon }">
                <span>{{ opponentName }}</span
                ><small>{{ !currentPlayerWon ? 'Winner' : 'Player' }}</small>
              </div>
            </div>
            <div class="result-scoreboard__final">
              <span>Final score</span><strong>{{ score }}</strong>
            </div>
            <div v-if="setScores.length" class="result-scoreboard__sets" aria-label="Set scores">
              <span v-for="(set, index) in setScores" :key="index">
                <small>Set {{ index + 1 }}</small
                ><strong>{{ set.a }}–{{ set.b }}</strong>
              </span>
            </div>
            <p>{{ matchFormat }} · {{ scoringFormat }}</p>
          </div>

          <div class="result-modal__actions">
            <button
              type="button"
              class="result-action result-action--primary"
              :aria-expanded="shareOptionsOpen"
              @click="shareOptionsOpen = !shareOptionsOpen"
            >
              <FlowIcon name="share" /><span>Share result</span>
            </button>
            <button
              type="button"
              class="result-action"
              :disabled="exportBusy"
              @click="saveChampionImage"
            >
              <FlowIcon name="download" /><span>{{
                exportBusy ? 'Preparing image…' : 'Save to gallery'
              }}</span>
            </button>
          </div>

          <Transition name="share-options">
            <div v-if="shareOptionsOpen" class="share-options" aria-label="Share options">
              <button type="button" @click="shareFromDevice">
                <FlowIcon name="share" /><span
                  ><strong>Device share</strong><small>Apps on this device</small></span
                >
              </button>
              <button type="button" @click="shareTo('whatsapp')">
                <span class="share-options__mark">W</span
                ><span><strong>WhatsApp</strong><small>Share with contacts</small></span>
              </button>
              <button type="button" @click="shareTo('x')">
                <span class="share-options__mark">X</span
                ><span><strong>X</strong><small>Post your result</small></span>
              </button>
              <button type="button" @click="copyResult">
                <FlowIcon name="link" /><span
                  ><strong>Copy result</strong><small>Paste it anywhere</small></span
                >
              </button>
            </div>
          </Transition>

          <p v-if="shareStatus" class="result-modal__status" role="status">{{ shareStatus }}</p>
          <button type="button" class="result-modal__finish" @click="emit('finish')">
            Save result and return to dashboard
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.result-overlay {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow-y: auto;
  background: rgba(2, 10, 6, 0.78);
  backdrop-filter: blur(14px);
}
.result-modal {
  position: relative;
  isolation: isolate;
  width: min(760px, 100%);
  max-height: calc(100svh - 48px);
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: #07170e;
  color: #fff;
  box-shadow: 0 34px 100px rgba(0, 0, 0, 0.48);
}
.result-modal__court {
  position: absolute;
  z-index: -1;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background:
    linear-gradient(rgba(7, 23, 14, 0.35), rgba(7, 23, 14, 0.96)),
    linear-gradient(135deg, #0b2a19, #123e25);
}
.result-modal__court::before,
.result-modal__court::after {
  content: '';
  position: absolute;
  inset: 80px 54px 120px;
  border: 1px solid rgba(201, 245, 213, 0.08);
}
.result-modal__court::after {
  inset: 50% 54px auto;
  border-width: 1px 0 0;
}
.result-modal__topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 42px;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 10px 14px 10px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.62);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.result-modal__topbar strong {
  color: #d7b66c;
}
.result-modal__topbar button {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}
.result-modal__hero {
  display: grid;
  justify-items: center;
  padding: 34px 34px 24px;
  text-align: center;
}
.result-modal__crest {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  border: 1px solid rgba(215, 182, 108, 0.56);
  border-radius: 50%;
  background: rgba(215, 182, 108, 0.1);
  color: #d7b66c;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.24);
}
.result-modal__crest :deep(.flow-icon) {
  width: 34px;
  height: 34px;
}
.result-modal__hero p {
  margin: 20px 0 0;
  color: #d7b66c;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.result-modal__hero h2 {
  margin: 7px 0 0;
  font-size: clamp(30px, 6vw, 46px);
  letter-spacing: -0.04em;
  line-height: 1.08;
}
.result-modal__hero > span:last-child {
  max-width: 520px;
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  line-height: 1.55;
}
.result-scoreboard {
  display: grid;
  gap: 16px;
  margin: 0 24px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.065);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.04);
}
.result-scoreboard__players {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}
.result-scoreboard__players > div {
  display: grid;
  gap: 4px;
  color: rgba(255, 255, 255, 0.62);
}
.result-scoreboard__players > div:last-child {
  text-align: right;
}
.result-scoreboard__players > div.is-winner {
  color: #fff;
}
.result-scoreboard__players span {
  overflow: hidden;
  font-size: 14px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-scoreboard__players small {
  color: #7de39a;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.result-scoreboard__players > strong {
  color: rgba(255, 255, 255, 0.36);
  font-size: 10px;
  text-align: center;
  text-transform: uppercase;
}
.result-scoreboard__final {
  display: grid;
  justify-items: center;
  gap: 5px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.2);
}
.result-scoreboard__final span {
  color: rgba(255, 255, 255, 0.48);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.result-scoreboard__final strong {
  font-size: clamp(22px, 5vw, 32px);
  letter-spacing: -0.025em;
}
.result-scoreboard__sets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.result-scoreboard__sets > span {
  display: grid;
  min-width: 78px;
  justify-items: center;
  gap: 2px;
  padding: 8px 11px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.055);
}
.result-scoreboard__sets small {
  color: rgba(255, 255, 255, 0.42);
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
}
.result-scoreboard__sets strong {
  font-size: 13px;
}
.result-scoreboard > p {
  margin: 0;
  color: rgba(255, 255, 255, 0.48);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}
.result-modal__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 20px 24px 0;
}
.result-action {
  display: inline-flex;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  font-size: 12px;
  font-weight: 850;
}
.result-action--primary {
  border-color: #41cf6d;
  background: #35b95d;
  box-shadow: 0 12px 32px rgba(31, 156, 73, 0.23);
}
.result-action:disabled {
  opacity: 0.55;
}
.share-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 24px 0;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.2);
}
.share-options button {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 58px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.055);
  color: #fff;
  padding: 9px 11px;
  text-align: left;
}
.share-options button:hover {
  background: rgba(255, 255, 255, 0.1);
}
.share-options button > span:last-child {
  display: grid;
  gap: 2px;
}
.share-options strong {
  font-size: 11px;
}
.share-options small {
  color: rgba(255, 255, 255, 0.48);
  font-size: 9px;
}
.share-options__mark {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: rgba(125, 227, 154, 0.12);
  color: #7de39a;
  font-size: 12px;
  font-weight: 900;
}
.result-modal__status {
  margin: 12px 24px 0;
  color: #b9eac5;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}
.result-modal__finish {
  display: block;
  margin: 16px auto 24px;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.56);
  font-size: 10px;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.result-modal-enter-active,
.result-modal-leave-active {
  transition: opacity 220ms ease;
}
.result-modal-enter-active .result-modal,
.result-modal-leave-active .result-modal {
  transition:
    opacity 220ms ease,
    transform 260ms cubic-bezier(0.2, 0.75, 0.25, 1);
}
.result-modal-enter-from,
.result-modal-leave-to,
.result-modal-enter-from .result-modal,
.result-modal-leave-to .result-modal {
  opacity: 0;
}
.result-modal-enter-from .result-modal {
  transform: translateY(12px) scale(0.985);
}
.share-options-enter-active,
.share-options-leave-active {
  overflow: hidden;
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    max-height 220ms ease;
}
.share-options-enter-from,
.share-options-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-5px);
}
.share-options-enter-to,
.share-options-leave-from {
  max-height: 180px;
}
@media (max-width: 560px) {
  .result-overlay {
    align-items: end;
    padding: 0;
  }
  .result-modal {
    width: 100%;
    max-height: 94svh;
    border-width: 1px 0 0;
    border-radius: 24px 24px 0 0;
  }
  .result-modal__topbar {
    padding-left: 18px;
  }
  .result-modal__hero {
    padding: 26px 20px 20px;
  }
  .result-modal__crest {
    width: 66px;
    height: 66px;
  }
  .result-scoreboard,
  .share-options {
    margin-inline: 14px;
  }
  .result-scoreboard {
    padding: 16px;
  }
  .result-modal__actions {
    grid-template-columns: 1fr;
    padding: 16px 14px 0;
  }
  .share-options {
    grid-template-columns: 1fr;
  }
  .result-modal__status {
    margin-inline: 14px;
  }
}
</style>
