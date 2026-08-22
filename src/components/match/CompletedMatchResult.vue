<script setup>
import { computed, ref, watch } from 'vue'
import {
  createResultShareImage,
  resultShareFilename,
  resultShareText,
} from '../../utils/resultShareCard'
const props = defineProps({
  result: {
    type: Object,
    required: true,
  },

  currentPlayerId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['done', 'report-issue'])

const issueOpen = ref(false)
const issueMessage = ref('')

const shareOpen = ref(false)

const shareWorking = ref(false)

const shareMessage = ref('')

const playerA = computed(() => {
  return (
    props.result?.players?.playerA || {
      id: props.result?.ownerId || '',
      name: 'Player 1',
    }
  )
})

const playerB = computed(() => {
  return (
    props.result?.players?.playerB || {
      id: props.result?.opponentId || '',
      name: props.result?.opponentName || 'Opponent',
    }
  )
})

const winner = computed(() => {
  if (props.result?.winnerId === playerB.value.id) {
    return playerB.value
  }

  return playerA.value
})

const currentPlayerWon = computed(() =>
  Boolean(props.currentPlayerId && props.result?.winnerId === props.currentPlayerId),
)

const headline = computed(() => {
  if (currentPlayerWon.value) {
    return 'You won'
  }

  return `${winner.value.name} won`
})

const setScores = computed(() =>
  Array.isArray(props.result?.setScores) ? props.result.setScores : [],
)

const currentIssue = computed(() => {
  const issues = Array.isArray(props.result?.issues) ? props.result.issues : []

  return (
    issues.find((issue) => issue.reportedBy === props.currentPlayerId && issue.status === 'open') ||
    null
  )
})

const canSubmitIssue = computed(() => {
  const length = issueMessage.value.trim().length

  return !currentIssue.value && length >= 6 && length <= 280
})

const durationLabel = computed(() => {
  const started = new Date(props.result?.startedAt || 0).getTime()

  const completed = new Date(props.result?.completedAt || 0).getTime()

  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return '—'
  }

  const seconds = Math.floor((completed - started) / 1000)

  const hours = Math.floor(seconds / 3600)

  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${Math.max(minutes, 1)} min`
})

const completedLabel = computed(() => {
  const value = new Date(props.result?.completedAt || '')

  if (Number.isNaN(value.getTime())) {
    return 'Completed'
  }

  return value.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
})

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function openShare() {
  shareMessage.value = ''
  shareOpen.value = true
}

function closeShare() {
  if (shareWorking.value) {
    return
  }

  shareOpen.value = false
  shareMessage.value = ''
}

async function createShareFile() {
  const blob = await createResultShareImage({
    result: props.result,

    currentPlayerId: props.currentPlayerId,
  })

  return new File(
    [blob],

    resultShareFilename(props.result),

    {
      type: 'image/png',
    },
  )
}

async function shareResultImage() {
  if (shareWorking.value) {
    return
  }

  shareWorking.value = true
  shareMessage.value = ''

  try {
    const file = await createShareFile()

    const shareData = {
      files: [file],

      title: 'My Gorra match result',

      text: resultShareText(props.result),
    }

    if (navigator.share && navigator.canShare?.(shareData)) {
      await navigator.share(shareData)

      shareMessage.value = 'Share sheet opened.'

      return
    }

    /*
     * Desktop/fallback:
     * save the generated PNG instead.
     */
    downloadShareFile(file)

    shareMessage.value = 'Image saved to your downloads.'
  } catch (error) {
    /*
     * AbortError normally means the user simply
     * closed the native share sheet.
     */
    if (error?.name === 'AbortError') {
      return
    }

    shareMessage.value = 'Gorra could not share this image.'
  } finally {
    shareWorking.value = false
  }
}

function downloadShareFile(file) {
  const objectUrl = URL.createObjectURL(file)

  const anchor = document.createElement('a')

  anchor.href = objectUrl

  anchor.download = file.name

  anchor.rel = 'noopener'

  anchor.click()

  /*
   * Keep the object URL alive long enough for
   * slower mobile browsers to begin the download.
   */
  window.setTimeout(
    () => {
      URL.revokeObjectURL(objectUrl)
    },

    1500,
  )
}

async function saveResultImage() {
  if (shareWorking.value) {
    return
  }

  shareWorking.value = true
  shareMessage.value = ''

  try {
    const file = await createShareFile()

    /*
     * Mobile browsers cannot silently write into
     * Photos/Gallery.
     *
     * When file sharing is supported we hand the PNG
     * to the native OS sheet, where the user can choose
     * Save Image / Photos / Gallery.
     */
    if (
      navigator.share &&
      navigator.canShare?.({
        files: [file],
      })
    ) {
      await navigator.share({
        files: [file],

        title: 'Save Gorra result',
      })

      shareMessage.value = 'Choose Save Image or Gallery from your device.'

      return
    }

    downloadShareFile(file)

    shareMessage.value = 'Image saved to your downloads.'
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    shareMessage.value = 'Gorra could not save this image.'
  } finally {
    shareWorking.value = false
  }
}

async function shareResultText() {
  if (shareWorking.value) {
    return
  }

  shareWorking.value = true
  shareMessage.value = ''

  const text = resultShareText(props.result)

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Gorra match result',

        text,
      })

      return
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)

      shareMessage.value = 'Result copied.'

      return
    }

    shareMessage.value = 'Sharing is not available in this browser.'
  } catch (error) {
    if (error?.name !== 'AbortError') {
      shareMessage.value = 'Gorra could not share this result.'
    }
  } finally {
    shareWorking.value = false
  }
}

function openIssueForm() {
  if (currentIssue.value) {
    return
  }

  issueOpen.value = true
}

function closeIssueForm() {
  issueOpen.value = false
  issueMessage.value = ''
}

function submitIssue() {
  if (!canSubmitIssue.value) {
    return
  }

  emit('report-issue', issueMessage.value.trim())
}

watch(currentIssue, (issue) => {
  if (!issue) {
    return
  }

  issueOpen.value = false
  issueMessage.value = ''
})
</script>

<template>
  <section class="completed-result" aria-labelledby="completed-result-title">
    <div class="completed-result__shell">
      <header class="completed-result__top">
        <span class="completed-result__status">
          <i aria-hidden="true"></i>
          Match complete
        </span>

        <span class="completed-result__time">
          {{ completedLabel }}
        </span>
      </header>

      <div class="completed-result__hero">
        <div class="completed-result__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 4h8v4c0 3-1.8 5.5-4 6.5C9.8 13.5 8 11 8 8V4Z" />

            <path
              d="M8 6H5v1c0 2.2 1.4 3.7 3.4 4.1M16 6h3v1c0 2.2-1.4 3.7-3.4 4.1M12 14.5V18M9 20h6"
            />
          </svg>
        </div>

        <span class="completed-result__eyebrow"> Final result </span>

        <h1 id="completed-result-title">
          {{ headline }}
        </h1>

        <p>
          {{ result.matchFormatLabel || 'Friendly match' }}
          ·
          {{ result.scoringFormat || 'Advantage' }}
        </p>
      </div>

      <article class="completed-result__score" aria-label="Final match score">
        <div class="completed-player">
          <span class="completed-player__avatar">
            {{ initials(playerA.name) }}
          </span>

          <strong>
            {{ playerA.name }}
          </strong>

          <small v-if="result.winnerId === playerA.id"> Winner </small>
        </div>

        <div class="completed-result__final">
          <span>Final score</span>

          <strong>
            {{ result.score || '0–0' }}
          </strong>
        </div>

        <div class="completed-player">
          <span class="completed-player__avatar">
            {{ initials(playerB.name) }}
          </span>

          <strong>
            {{ playerB.name }}
          </strong>

          <small v-if="result.winnerId === playerB.id"> Winner </small>
        </div>
      </article>

      <section v-if="setScores.length" class="completed-result__sets" aria-label="Set scores">
        <header>
          <span>Set-by-set</span>

          <strong>
            {{ setScores.length === 1 ? '1 completed set' : `${setScores.length} completed sets` }}
          </strong>
        </header>

        <div v-for="(set, index) in setScores" :key="`result-set-${index}`" class="completed-set">
          <span>
            {{ set.isMatchTieBreak ? 'Match tie-break' : `Set ${index + 1}` }}
          </span>

          <strong> {{ set.a }}–{{ set.b }} </strong>
        </div>
      </section>

      <section class="completed-result__facts" aria-label="Match details">
        <div>
          <span>Duration</span>

          <strong>
            {{ durationLabel }}
          </strong>
        </div>

        <div>
          <span>Points played</span>

          <strong>
            {{ result.liveState?.pointsPlayed || 0 }}
          </strong>
        </div>

        <div>
          <span>Result status</span>

          <strong>
            {{ currentIssue ? 'Review requested' : 'Recorded' }}
          </strong>
        </div>
      </section>

      <section class="completed-result__integrity">
        <div>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 5.5 5.6v5.7c0 4.1 2.8 7.8 6.5 9.7 3.7-1.9 6.5-5.6 6.5-9.7V5.6L12 3Z" />

            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <p>
          <strong> The completed score is preserved. </strong>

          <span>
            If something is wrong, report it for review instead of reopening the finished match.
          </span>
        </p>
      </section>

      <div v-if="currentIssue" class="completed-result__issue-state" role="status">
        <span> Review requested </span>

        <strong> Your result has not been changed. </strong>

        <p>
          {{ currentIssue.message }}
        </p>
      </div>

      <Transition name="result-panel">
        <form
          v-if="issueOpen && !currentIssue"
          class="completed-result__issue-form"
          @submit.prevent="submitIssue"
        >
          <header>
            <div>
              <span>Result review</span>

              <strong> What looks wrong? </strong>
            </div>

            <button type="button" aria-label="Close result review" @click="closeIssueForm">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
            </button>
          </header>

          <p>This creates a review request. It does not edit the recorded match.</p>

          <label>
            <span>What should be checked?</span>

            <textarea
              v-model="issueMessage"
              maxlength="280"
              rows="4"
              placeholder="Example: The final set score looks incorrect."
            ></textarea>

            <small> {{ issueMessage.length }}/280 </small>
          </label>

          <button type="submit" class="completed-result__submit" :disabled="!canSubmitIssue">
            Submit for review
          </button>
        </form>
      </Transition>

      <footer class="completed-result__actions">
        <Transition name="share-backdrop">
          <div v-if="shareOpen" class="result-share-backdrop" @click.self="closeShare">
            <section
              class="result-share-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="result-share-title"
            >
              <header class="result-share-sheet__header">
                <div>
                  <span> Your match </span>

                  <h2 id="result-share-title">Share this result</h2>
                </div>

                <button
                  type="button"
                  class="result-share-sheet__close"
                  :disabled="shareWorking"
                  aria-label="Close share options"
                  @click="closeShare"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7 7 17" />
                  </svg>
                </button>
              </header>

              <div class="result-share-preview">
                <div class="result-share-preview__badge">
                  {{ currentPlayerWon ? 'Match won' : 'Match complete' }}
                </div>

                <strong>
                  {{ headline }}
                </strong>

                <p>
                  {{ playerA.name }}
                  <span>vs</span>
                  {{ playerB.name }}
                </p>

                <div>
                  {{ result.score || '0–0' }}
                </div>

                <small> Gorra </small>
              </div>

              <div class="result-share-options">
                <button type="button" :disabled="shareWorking" @click="shareResultImage">
                  <span class="result-share-options__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" />

                      <path d="M5 13v6h14v-6" />
                    </svg>
                  </span>

                  <span>
                    <strong> Share image </strong>

                    <small> Send your Gorra match card </small>
                  </span>
                </button>

                <button type="button" :disabled="shareWorking" @click="saveResultImage">
                  <span class="result-share-options__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />

                      <path d="M5 19h14" />
                    </svg>
                  </span>

                  <span>
                    <strong> Save to gallery </strong>

                    <small> Save the victory card as a PNG </small>
                  </span>
                </button>

                <button type="button" :disabled="shareWorking" @click="shareResultText">
                  <span class="result-share-options__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6h12M6 11h12M6 16h8" />
                    </svg>
                  </span>

                  <span>
                    <strong> Share result </strong>

                    <small> Share the score as text </small>
                  </span>
                </button>
              </div>

              <p v-if="shareMessage" class="result-share-sheet__message" role="status">
                {{ shareMessage }}
              </p>

              <p class="result-share-sheet__privacy">
                Only the public match summary is included. Private match and review data stays in
                Gorra.
              </p>
            </section>
          </div>
        </Transition>

        <button type="button" class="completed-result__secondary" @click="openShare">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="18" cy="5" r="2.5" />

            <circle cx="6" cy="12" r="2.5" />

            <circle cx="18" cy="19" r="2.5" />

            <path d="m8.2 10.8 7.5-4.3M8.2 13.2l7.5 4.3" />
          </svg>

          <span> Share </span>
        </button>
        <button
          type="button"
          class="completed-result__secondary"
          :disabled="Boolean(currentIssue)"
          @click="openIssueForm"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8v5M12 17h.01M4.7 19h14.6L12 5 4.7 19Z" />
          </svg>

          <span>
            {{ currentIssue ? 'Issue reported' : 'Report an issue' }}
          </span>
        </button>

        <button type="button" class="completed-result__primary" @click="emit('done')">
          Return to dashboard
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.completed-result {
  --result-green: #00b51a;
  --result-green-strong: #008f15;
  --result-dark-green: #073f30;
  --result-text: #16211b;
  --result-secondary: #66736b;
  --result-muted: #8a958e;
  --result-line: rgba(7, 63, 48, 0.09);
  --result-soft: #f6f9f7;
  --result-soft-green: #eef9f1;
  --result-white: #ffffff;

  min-height: 100dvh;

  padding: 28px 18px calc(112px + env(safe-area-inset-bottom));

  color: var(--result-text);
  background: var(--result-white);
}

.completed-result__shell {
  width: min(100%, 820px);
  margin: 0 auto;
}

.completed-result__top {
  min-height: 40px;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.completed-result__status {
  display: inline-flex;
  align-items: center;
  gap: 7px;

  color: var(--result-dark-green);

  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.completed-result__status i {
  width: 7px;
  height: 7px;

  border-radius: 50%;

  background: var(--result-green);

  box-shadow: 0 0 0 4px rgba(0, 181, 26, 0.08);
}

.completed-result__time {
  color: var(--result-muted);

  font-size: 10px;
}

.completed-result__hero {
  padding: 34px 12px 30px;

  text-align: center;
}

.completed-result__mark {
  width: 50px;
  height: 50px;

  margin: 0 auto 14px;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--result-green-strong);
  background: var(--result-soft-green);
}

.completed-result__mark svg {
  width: 24px;
  height: 24px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.completed-result__eyebrow {
  color: var(--result-green-strong);

  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.completed-result__hero h1 {
  margin: 5px 0 0;

  color: var(--result-dark-green);

  font-size: clamp(30px, 6vw, 48px);

  font-weight: 600;
  line-height: 1.06;
  letter-spacing: -0.03em;
}

.completed-result__hero p {
  margin: 9px 0 0;

  color: var(--result-secondary);

  font-size: 12px;
}

.completed-result__score {
  min-height: 172px;
  padding: 22px;

  border: 0.5px solid var(--result-line);

  border-radius: 10px;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(180px, 0.8fr)
    minmax(0, 1fr);

  align-items: center;
  gap: 22px;

  box-shadow:
    0 1px 2px rgba(13, 45, 26, 0.02),
    0 8px 22px rgba(13, 45, 26, 0.025);
}

.completed-player {
  min-width: 0;

  display: flex;
  flex-direction: column;
  align-items: center;

  text-align: center;
}

.completed-player__avatar {
  width: 50px;
  height: 50px;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--result-dark-green);
  background: var(--result-soft-green);

  font-size: 13px;
  font-weight: 600;
}

.completed-player strong {
  max-width: 100%;

  margin-top: 8px;

  overflow: hidden;

  color: var(--result-text);

  font-size: 13px;
  font-weight: 600;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.completed-player small {
  margin-top: 3px;

  color: var(--result-green-strong);

  font-size: 9px;
  font-weight: 600;
}

.completed-result__final {
  text-align: center;
}

.completed-result__final span,
.completed-result__final strong {
  display: block;
}

.completed-result__final span {
  color: var(--result-muted);

  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.completed-result__final strong {
  margin-top: 7px;

  color: var(--result-dark-green);

  font-size: clamp(24px, 5vw, 38px);

  font-weight: 600;
  letter-spacing: -0.03em;
}

.completed-result__sets {
  margin-top: 14px;

  overflow: hidden;

  border: 0.5px solid var(--result-line);

  border-radius: 10px;
}

.completed-result__sets > header {
  min-height: 55px;
  padding: 11px 14px;

  border-bottom: 0.5px solid var(--result-line);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.completed-result__sets header span {
  color: var(--result-dark-green);

  font-size: 11px;
  font-weight: 600;
}

.completed-result__sets header strong {
  color: var(--result-muted);

  font-size: 9px;
  font-weight: 500;
}

.completed-set {
  min-height: 48px;
  padding: 10px 14px;

  border-bottom: 0.5px solid var(--result-line);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.completed-set:last-child {
  border-bottom: 0;
}

.completed-set span {
  color: var(--result-secondary);

  font-size: 11px;
}

.completed-set strong {
  color: var(--result-dark-green);

  font-size: 16px;
  font-weight: 600;
}

.completed-result__facts {
  margin-top: 14px;

  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));

  gap: 8px;
}

.completed-result__facts > div {
  min-height: 66px;
  padding: 11px 12px;

  border: 0.5px solid var(--result-line);

  border-radius: 9px;

  background: #fbfdfb;
}

.completed-result__facts span,
.completed-result__facts strong {
  display: block;
}

.completed-result__facts span {
  color: var(--result-muted);

  font-size: 9px;
  font-weight: 500;
}

.completed-result__facts strong {
  margin-top: 4px;

  color: var(--result-dark-green);

  font-size: 12px;
  font-weight: 600;
}

.completed-result__integrity {
  margin-top: 14px;
  padding: 13px;

  border-radius: 9px;

  display: flex;
  align-items: flex-start;
  gap: 10px;

  background: var(--result-soft);
}

.completed-result__integrity > div {
  width: 32px;
  height: 32px;

  flex: 0 0 auto;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--result-green-strong);
  background: var(--result-white);
}

.completed-result__integrity svg {
  width: 17px;
  height: 17px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.completed-result__integrity p {
  margin: 0;
}

.completed-result__integrity strong,
.completed-result__integrity span {
  display: block;
}

.completed-result__integrity strong {
  color: var(--result-dark-green);

  font-size: 11px;
  font-weight: 600;
}

.completed-result__integrity span {
  margin-top: 2px;

  color: var(--result-secondary);

  font-size: 10px;
  line-height: 1.45;
}

.completed-result__issue-state,
.completed-result__issue-form {
  margin-top: 12px;

  border: 0.5px solid var(--result-line);

  border-radius: 10px;
}

.completed-result__issue-state {
  padding: 13px 14px;

  background: #fbfdfb;
}

.completed-result__issue-state span,
.completed-result__issue-state strong {
  display: block;
}

.completed-result__issue-state span {
  color: var(--result-green-strong);

  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.completed-result__issue-state strong {
  margin-top: 3px;

  color: var(--result-dark-green);

  font-size: 12px;
}

.completed-result__issue-state p {
  margin: 7px 0 0;

  color: var(--result-secondary);

  font-size: 10px;
}

.completed-result__issue-form {
  padding: 14px;

  background: var(--result-white);

  box-shadow: 0 8px 22px rgba(13, 45, 26, 0.03);
}

.completed-result__issue-form header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.completed-result__issue-form header span,
.completed-result__issue-form header strong {
  display: block;
}

.completed-result__issue-form header span {
  color: var(--result-green-strong);

  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.completed-result__issue-form header strong {
  margin-top: 2px;

  color: var(--result-dark-green);

  font-size: 13px;
}

.completed-result__issue-form header button {
  width: 32px;
  height: 32px;

  border: 0.5px solid var(--result-line);

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--result-secondary);
  background: var(--result-white);
}

.completed-result__issue-form header svg {
  width: 14px;
  height: 14px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.completed-result__issue-form > p {
  margin: 10px 0;

  color: var(--result-secondary);

  font-size: 10px;
  line-height: 1.45;
}

.completed-result__issue-form label span {
  display: block;

  margin-bottom: 5px;

  color: var(--result-dark-green);

  font-size: 10px;
  font-weight: 600;
}

.completed-result__issue-form textarea {
  width: 100%;
  min-height: 92px;

  padding: 10px 11px;

  resize: vertical;

  border: 0.5px solid rgba(7, 63, 48, 0.14);

  border-radius: 8px;

  outline: none;

  color: var(--result-text);
  background: var(--result-white);

  font: inherit;
  font-size: 11px;
  line-height: 1.5;
}

.completed-result__issue-form textarea:focus {
  border-color: rgba(0, 181, 26, 0.45);

  box-shadow: 0 0 0 3px rgba(0, 181, 26, 0.06);
}

.completed-result__issue-form label small {
  display: block;

  margin-top: 4px;

  color: var(--result-muted);

  font-size: 9px;

  text-align: right;
}

.completed-result__submit {
  min-height: 42px;
  margin-top: 10px;
  padding: 0 14px;

  border: 0;
  border-radius: 8px;

  color: #ffffff;
  background: var(--result-dark-green);

  font-size: 11px;
  font-weight: 600;
}

.completed-result__submit:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.result-share-backdrop {
  position: fixed;

  inset: 0;

  z-index: 80;

  padding: 18px 18px calc(18px + env(safe-area-inset-bottom));

  display: flex;
  align-items: flex-end;
  justify-content: center;

  background: rgba(10, 28, 19, 0.2);

  backdrop-filter: blur(3px);
}

.result-share-sheet {
  width: min(100%, 540px);

  max-height: min(760px, calc(100vh - 36px));

  overflow-y: auto;

  padding: 16px;

  border: 0.5px solid rgba(7, 63, 48, 0.08);

  border-radius: 18px;

  color: var(--result-text);

  background: var(--result-white);

  box-shadow: 0 18px 50px rgba(7, 30, 19, 0.12);
}

.result-share-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.result-share-sheet__header span {
  color: var(--result-green-strong);

  font-size: 9px;
  font-weight: 600;

  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.result-share-sheet__header h2 {
  margin: 3px 0 0;

  color: var(--result-dark-green);

  font-size: 18px;
  font-weight: 600;
}

.result-share-sheet__close {
  width: 38px;
  height: 38px;

  flex: 0 0 auto;

  border: 0.5px solid var(--result-line);

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--result-secondary);

  background: var(--result-white);
}

.result-share-sheet__close svg {
  width: 15px;
  height: 15px;

  fill: none;

  stroke: currentColor;

  stroke-width: 1.7;

  stroke-linecap: round;
}

.result-share-preview {
  min-height: 205px;

  margin-top: 14px;

  padding: 20px 18px;

  border: 0.5px solid var(--result-line);

  border-radius: 13px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  text-align: center;

  background: var(--result-soft);
}

.result-share-preview__badge {
  padding: 5px 9px;

  border-radius: 999px;

  color: var(--result-green-strong);

  background: var(--result-soft-green);

  font-size: 8px;
  font-weight: 600;

  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.result-share-preview > strong {
  margin-top: 10px;

  color: var(--result-dark-green);

  font-size: 20px;
  font-weight: 600;
}

.result-share-preview > p {
  margin: 7px 0 0;

  color: var(--result-secondary);

  font-size: 10px;
}

.result-share-preview > p span {
  margin: 0 5px;

  color: var(--result-muted);
}

.result-share-preview > div:not(.result-share-preview__badge) {
  margin-top: 12px;

  color: var(--result-dark-green);

  font-size: 31px;
  font-weight: 600;
}

.result-share-preview > small {
  margin-top: 13px;

  color: var(--result-muted);

  font-size: 9px;
  font-weight: 600;

  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.result-share-options {
  margin-top: 12px;

  display: grid;
  gap: 7px;
}

.result-share-options > button {
  width: 100%;

  min-height: 61px;

  padding: 9px 11px;

  border: 0.5px solid var(--result-line);

  border-radius: 10px;

  display: flex;
  align-items: center;
  gap: 11px;

  color: var(--result-text);

  background: var(--result-white);

  text-align: left;

  transition:
    background-color 120ms ease,
    transform 90ms ease;
}

.result-share-options > button:not(:disabled):hover {
  background: var(--result-soft);
}

.result-share-options > button:not(:disabled):active {
  transform: scale(0.985);
}

.result-share-options > button:disabled {
  cursor: wait;
  opacity: 0.48;
}

.result-share-options__icon {
  width: 38px;
  height: 38px;

  flex: 0 0 auto;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--result-green-strong);

  background: var(--result-soft-green);
}

.result-share-options__icon svg {
  width: 17px;
  height: 17px;

  fill: none;

  stroke: currentColor;

  stroke-width: 1.65;

  stroke-linecap: round;
  stroke-linejoin: round;
}

.result-share-options strong,
.result-share-options small {
  display: block;
}

.result-share-options strong {
  color: var(--result-dark-green);

  font-size: 11px;
  font-weight: 600;
}

.result-share-options small {
  margin-top: 2px;

  color: var(--result-secondary);

  font-size: 9px;
}

.result-share-sheet__message {
  margin: 10px 0 0;

  padding: 9px 10px;

  border-radius: 8px;

  color: var(--result-dark-green);

  background: var(--result-soft-green);

  font-size: 9px;
}

.result-share-sheet__privacy {
  margin: 11px 2px 0;

  color: var(--result-muted);

  font-size: 8px;
  line-height: 1.45;

  text-align: center;
}

.share-backdrop-enter-active,
.share-backdrop-leave-active {
  transition: opacity 170ms ease;
}

.share-backdrop-enter-active .result-share-sheet,
.share-backdrop-leave-active .result-share-sheet {
  transition:
    transform 210ms cubic-bezier(0.22, 0.8, 0.22, 1),
    opacity 170ms ease;
}

.share-backdrop-enter-from,
.share-backdrop-leave-to {
  opacity: 0;
}

.share-backdrop-enter-from .result-share-sheet,
.share-backdrop-leave-to .result-share-sheet {
  opacity: 0;

  transform: translateY(14px) scale(0.99);
}

.completed-result__actions {
  width: 100%;

  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;

  z-index: 30;

  padding: 12px 18px calc(12px + env(safe-area-inset-bottom));

  border-top: 0.5px solid var(--result-line);

  display: flex;
  justify-content: center;
  gap: 9px;

  background: rgba(255, 255, 255, 0.985);
}

.completed-result__primary,
.completed-result__secondary {
  min-height: 46px;

  border-radius: 8px;

  font-size: 11px;
  font-weight: 600;
}

.completed-result__primary {
  width: min(300px, 46vw);
  padding: 0 18px;

  border: 0;

  color: #ffffff;
  background: var(--result-dark-green);
}

.completed-result__secondary {
  width: min(220px, 42vw);
  padding: 0 14px;

  border: 0.5px solid var(--result-line);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  color: var(--result-dark-green);
  background: var(--result-white);
}

.completed-result__secondary svg {
  width: 16px;
  height: 16px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.completed-result__secondary:disabled {
  cursor: default;
  opacity: 0.55;
}

.result-panel-enter-active,
.result-panel-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.result-panel-enter-from,
.result-panel-leave-to {
  opacity: 0;

  transform: translateY(-5px);
}

@media (max-width: 640px) {
  .result-share-backdrop {
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
  }

  .result-share-sheet {
    padding: 14px;

    border-radius: 16px;
  }

  .completed-result__actions {
    flex-wrap: wrap;
  }

  .completed-result__primary {
    flex-basis: 100%;
  }
  .completed-result {
    padding-top: 18px;
  }

  .completed-result__score {
    min-height: 152px;

    padding: 18px 10px;

    grid-template-columns:
      minmax(0, 1fr)
      minmax(115px, 0.8fr)
      minmax(0, 1fr);

    gap: 7px;
  }

  .completed-player__avatar {
    width: 42px;
    height: 42px;

    font-size: 11px;
  }

  .completed-player strong {
    font-size: 11px;
  }

  .completed-result__final strong {
    font-size: 24px;
  }

  .completed-result__facts {
    grid-template-columns: 1fr;
  }

  .completed-result__facts > div {
    min-height: 54px;
  }

  .result-share-backdrop {
    position: fixed;

    inset: 0;

    z-index: 80;

    padding: 18px 18px calc(18px + env(safe-area-inset-bottom));

    display: flex;
    align-items: flex-end;
    justify-content: center;

    background: rgba(10, 28, 19, 0.2);

    backdrop-filter: blur(3px);
  }

  .result-share-sheet {
    width: min(100%, 540px);

    max-height: min(760px, calc(100vh - 36px));

    overflow-y: auto;

    padding: 16px;

    border: 0.5px solid rgba(7, 63, 48, 0.08);

    border-radius: 18px;

    color: var(--result-text);

    background: var(--result-white);

    box-shadow: 0 18px 50px rgba(7, 30, 19, 0.12);
  }

  .result-share-sheet__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .result-share-sheet__header span {
    color: var(--result-green-strong);

    font-size: 9px;
    font-weight: 600;

    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .result-share-sheet__header h2 {
    margin: 3px 0 0;

    color: var(--result-dark-green);

    font-size: 18px;
    font-weight: 600;
  }

  .result-share-sheet__close {
    width: 38px;
    height: 38px;

    flex: 0 0 auto;

    border: 0.5px solid var(--result-line);

    border-radius: 50%;

    display: grid;
    place-items: center;

    color: var(--result-secondary);

    background: var(--result-white);
  }

  .result-share-sheet__close svg {
    width: 15px;
    height: 15px;

    fill: none;

    stroke: currentColor;

    stroke-width: 1.7;

    stroke-linecap: round;
  }

  .result-share-preview {
    min-height: 205px;

    margin-top: 14px;

    padding: 20px 18px;

    border: 0.5px solid var(--result-line);

    border-radius: 13px;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    text-align: center;

    background: var(--result-soft);
  }

  .result-share-preview__badge {
    padding: 5px 9px;

    border-radius: 999px;

    color: var(--result-green-strong);

    background: var(--result-soft-green);

    font-size: 8px;
    font-weight: 600;

    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .result-share-preview > strong {
    margin-top: 10px;

    color: var(--result-dark-green);

    font-size: 20px;
    font-weight: 600;
  }

  .result-share-preview > p {
    margin: 7px 0 0;

    color: var(--result-secondary);

    font-size: 10px;
  }

  .result-share-preview > p span {
    margin: 0 5px;

    color: var(--result-muted);
  }

  .result-share-preview > div:not(.result-share-preview__badge) {
    margin-top: 12px;

    color: var(--result-dark-green);

    font-size: 31px;
    font-weight: 600;
  }

  .result-share-preview > small {
    margin-top: 13px;

    color: var(--result-muted);

    font-size: 9px;
    font-weight: 600;

    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .result-share-options {
    margin-top: 12px;

    display: grid;
    gap: 7px;
  }

  .result-share-options > button {
    width: 100%;

    min-height: 61px;

    padding: 9px 11px;

    border: 0.5px solid var(--result-line);

    border-radius: 10px;

    display: flex;
    align-items: center;
    gap: 11px;

    color: var(--result-text);

    background: var(--result-white);

    text-align: left;

    transition:
      background-color 120ms ease,
      transform 90ms ease;
  }

  .result-share-options > button:not(:disabled):hover {
    background: var(--result-soft);
  }

  .result-share-options > button:not(:disabled):active {
    transform: scale(0.985);
  }

  .result-share-options > button:disabled {
    cursor: wait;
    opacity: 0.48;
  }

  .result-share-options__icon {
    width: 38px;
    height: 38px;

    flex: 0 0 auto;

    border-radius: 50%;

    display: grid;
    place-items: center;

    color: var(--result-green-strong);

    background: var(--result-soft-green);
  }

  .result-share-options__icon svg {
    width: 17px;
    height: 17px;

    fill: none;

    stroke: currentColor;

    stroke-width: 1.65;

    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .result-share-options strong,
  .result-share-options small {
    display: block;
  }

  .result-share-options strong {
    color: var(--result-dark-green);

    font-size: 11px;
    font-weight: 600;
  }

  .result-share-options small {
    margin-top: 2px;

    color: var(--result-secondary);

    font-size: 9px;
  }

  .result-share-sheet__message {
    margin: 10px 0 0;

    padding: 9px 10px;

    border-radius: 8px;

    color: var(--result-dark-green);

    background: var(--result-soft-green);

    font-size: 9px;
  }

  .result-share-sheet__privacy {
    margin: 11px 2px 0;

    color: var(--result-muted);

    font-size: 8px;
    line-height: 1.45;

    text-align: center;
  }

  .share-backdrop-enter-active,
  .share-backdrop-leave-active {
    transition: opacity 170ms ease;
  }

  .share-backdrop-enter-active .result-share-sheet,
  .share-backdrop-leave-active .result-share-sheet {
    transition:
      transform 210ms cubic-bezier(0.22, 0.8, 0.22, 1),
      opacity 170ms ease;
  }

  .share-backdrop-enter-from,
  .share-backdrop-leave-to {
    opacity: 0;
  }

  .share-backdrop-enter-from .result-share-sheet,
  .share-backdrop-leave-to .result-share-sheet {
    opacity: 0;

    transform: translateY(14px) scale(0.99);
  }

  .completed-result__actions {
    padding-left: 7.5vw;
    padding-right: 7.5vw;
  }

  .completed-result__primary,
  .completed-result__secondary {
    flex: 1;
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .completed-result *,
  .completed-result *::before,
  .completed-result *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
