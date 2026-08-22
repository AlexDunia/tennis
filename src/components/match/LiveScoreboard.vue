<script setup>
import { computed } from 'vue'

const props = defineProps({
  snapshot: {
    type: Object,
    required: true,
  },

  now: {
    type: Number,
    default: () => Date.now(),
  },
})

const clockFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

const playerAName = computed(() => props.snapshot?.players?.playerA?.name || 'Player 1')

const playerBName = computed(() => props.snapshot?.players?.playerB?.name || 'Player 2')

const isCompleted = computed(() => props.snapshot?.status === 'completed')

const isFinishing = computed(() => props.snapshot?.status === 'finished')

const isLive = computed(() => props.snapshot?.status === 'live')

const statusLabel = computed(() => {
  if (isCompleted.value) {
    return 'FINAL'
  }

  if (isFinishing.value) {
    return 'MATCH COMPLETE'
  }

  return 'LIVE'
})

const matchTypeLabel = computed(() => {
  return (
    {
      friendly: 'Friendly match',
      ladder: 'Ladder match',
      tournament: 'Tournament match',
    }[props.snapshot?.matchType] || 'Tennis match'
  )
})

const pointA = computed(() => String(props.snapshot?.score?.points?.a ?? ''))

const pointB = computed(() => String(props.snapshot?.score?.points?.b ?? ''))

const heroScoreA = computed(() =>
  isCompleted.value ? Number(props.snapshot?.score?.sets?.a || 0) : pointA.value,
)

const heroScoreB = computed(() =>
  isCompleted.value ? Number(props.snapshot?.score?.sets?.b || 0) : pointB.value,
)

const scoreCaption = computed(() => {
  if (isCompleted.value) {
    return 'Sets won'
  }

  if (
    props.snapshot?.game?.isMatchTieBreak ||
    props.snapshot?.game?.standaloneTieBreak ||
    props.snapshot?.game?.inTieBreak
  ) {
    return 'Tie-break points'
  }

  return 'Game points'
})

const currentServer = computed(() => props.snapshot?.server || '')

const serverName = computed(() => {
  if (currentServer.value === 'playerA') {
    return playerAName.value
  }

  if (currentServer.value === 'playerB') {
    return playerBName.value
  }

  return ''
})

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)

  if (!parts.length) {
    return 'P'
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function pointRank(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  const traditional = {
    love: 0,
    0: 0,
    15: 1,
    30: 2,
    40: 3,
    ad: 4,
    advantage: 4,
  }

  if (Object.prototype.hasOwnProperty.call(traditional, normalized)) {
    return traditional[normalized]
  }

  const numeric = Number(normalized)

  return Number.isFinite(numeric) ? numeric : null
}

const pointLeader = computed(() => {
  if (isCompleted.value) {
    return ''
  }

  const a = pointRank(pointA.value)
  const b = pointRank(pointB.value)

  if (a === null || b === null || a === b) {
    return ''
  }

  return a > b ? 'playerA' : 'playerB'
})

const completedSets = computed(() =>
  Array.isArray(props.snapshot?.score?.setScores) ? props.snapshot.score.setScores : [],
)

const currentSetIndex = computed(() =>
  Math.max(0, Number(props.snapshot?.score?.currentSetNumber || 1) - 1),
)

const setColumns = computed(() => {
  const completedCount = completedSets.value.length

  let total

  if (isCompleted.value) {
    total = Math.max(completedCount, 1)
  } else {
    total = Math.max(completedCount + 1, currentSetIndex.value + 1, 1)
  }

  /*
   * Snapshot sanitization already limits public sets,
   * but keep the presentation boundary defensive too.
   */
  total = Math.min(total, 10)

  return Array.from({ length: total }, (_, index) => {
    const completed = completedSets.value[index]

    const current = !isCompleted.value && index === currentSetIndex.value

    return {
      index,

      completed,

      current,

      isMatchTieBreak:
        Boolean(completed?.isMatchTieBreak) ||
        Boolean(current && props.snapshot?.game?.isMatchTieBreak),
    }
  })
})

function columnHeading(column) {
  if (column.isMatchTieBreak) {
    return 'Match TB'
  }

  return `Set ${column.index + 1}`
}

function setValue(column, side) {
  const key = side === 'playerA' ? 'a' : 'b'

  if (column.completed) {
    return Number(column.completed[key] || 0)
  }

  if (!column.current) {
    return '—'
  }

  if (props.snapshot?.game?.isMatchTieBreak) {
    return key === 'a' ? pointA.value : pointB.value
  }

  return Number(props.snapshot?.score?.games?.[key] || 0)
}

const showSetTable = computed(() => !props.snapshot?.game?.standaloneTieBreak)

const tableFinalValueA = computed(() =>
  isCompleted.value ? Number(props.snapshot?.score?.sets?.a || 0) : pointA.value,
)

const tableFinalValueB = computed(() =>
  isCompleted.value ? Number(props.snapshot?.score?.sets?.b || 0) : pointB.value,
)

const tableFinalHeading = computed(() => (isCompleted.value ? 'Sets' : 'Points'))

const tableMinWidth = computed(() => {
  return `${Math.max(620, 320 + setColumns.value.length * 88)}px`
})

function timestamp(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value).getTime()

  return Number.isFinite(parsed) ? parsed : null
}

const elapsedSeconds = computed(() => {
  const start = timestamp(props.snapshot?.startedAt)

  if (!start) {
    return 0
  }

  const completedAt = timestamp(props.snapshot?.updatedAt)

  const end = isCompleted.value && completedAt ? completedAt : props.now

  return Math.max(0, Math.floor((end - start) / 1000))
})

const elapsedText = computed(() => {
  const total = elapsedSeconds.value

  const hours = Math.floor(total / 3600)

  const minutes = Math.floor((total % 3600) / 60)

  const seconds = total % 60

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
})

const clockText = computed(() => {
  if (!clockFormatter) {
    return ''
  }

  return clockFormatter.format(new Date(props.now))
})

const winnerName = computed(() => {
  const side = props.snapshot?.winnerSide

  if (['you', 'playerA'].includes(side)) {
    return playerAName.value
  }

  if (['opponent', 'playerB'].includes(side)) {
    return playerBName.value
  }

  return ''
})

const setScoreSummary = computed(() => {
  return completedSets.value
    .map((set) => {
      const separator = set.isMatchTieBreak ? '–' : '–'

      return `${set.a}${separator}${set.b}`
    })
    .join(', ')
})

const finalScoreText = computed(() => props.snapshot?.finalScore || setScoreSummary.value)

const scoreAriaLabel = computed(() => {
  if (isCompleted.value) {
    return `${playerAName.value} ${heroScoreA.value} sets, ${playerBName.value} ${heroScoreB.value} sets`
  }

  return `${playerAName.value} ${pointA.value}, ${playerBName.value} ${pointB.value}`
})
</script>

<template>
  <section
    class="live-scoreboard"
    :class="{
      'live-scoreboard--completed': isCompleted,
    }"
  >
    <header class="live-scoreboard__header">
      <div class="live-scoreboard__header-inner">
        <div class="live-scoreboard__brand" aria-label="Gorra">
          <span class="live-scoreboard__brand-ball" aria-hidden="true"></span>

          <strong>GORRA</strong>
        </div>

        <div class="live-scoreboard__identity">
          <span>Live scoreboard</span>

          <span
            class="live-scoreboard__status"
            :class="{
              'live-scoreboard__status--final': !isLive,
            }"
            role="status"
            aria-live="polite"
          >
            <i v-if="isLive" aria-hidden="true"></i>

            {{ statusLabel }}
          </span>
        </div>

        <div class="live-scoreboard__time">
          <div>
            <span>Match time</span>

            <time>
              {{ elapsedText }}
            </time>
          </div>

          <time class="live-scoreboard__clock">
            {{ clockText }}
          </time>
        </div>
      </div>
    </header>

    <main class="live-scoreboard__main">
      <h1 class="sr-only">
        Live scoreboard:
        {{ playerAName }} versus
        {{ playerBName }}
      </h1>

      <div class="live-scoreboard__match-type">
        <span>
          {{ matchTypeLabel }}
        </span>

        <i aria-hidden="true">•</i>

        <span>
          {{ snapshot.display?.matchFormat || 'Tennis match' }}
        </span>
      </div>

      <section class="live-scoreboard__hero" :aria-label="scoreAriaLabel">
        <article
          class="live-scoreboard__player"
          :class="{
            'live-scoreboard__player--serving': !isCompleted && currentServer === 'playerA',
          }"
        >
          <div class="live-scoreboard__avatar">
            <span aria-hidden="true">
              {{ initials(playerAName) }}
            </span>

            <span
              v-if="!isCompleted && currentServer === 'playerA'"
              class="live-scoreboard__serve-ball"
              aria-hidden="true"
            >
              <svg viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14.5" fill="#f2e94e" />

                <path d="M5.2 8.3c5.5 1.5 8.9 5.1 10.1 10.4 1.1 4.8 3.6 7.6 8.4 9.1" />

                <path d="M26.8 5.7c-5.2 1.8-8.3 5.4-9.2 10.7-.8 4.8-3.2 7.8-7.8 9.6" />
              </svg>
            </span>
          </div>

          <h2>
            {{ playerAName }}
          </h2>

          <span v-if="!isCompleted && currentServer === 'playerA'" class="sr-only">
            {{ playerAName }} is serving.
          </span>
        </article>

        <div class="live-scoreboard__score">
          <span class="live-scoreboard__score-context">
            {{
              isCompleted
                ? 'Final score'
                : props.snapshot?.game?.isMatchTieBreak
                  ? 'Deciding match tie-break'
                  : props.snapshot?.game?.inTieBreak
                    ? 'Tie-break'
                    : 'Current game'
            }}
          </span>

          <div class="live-scoreboard__scoreline">
            <strong
              :class="{
                'is-leading': pointLeader === 'playerA',
              }"
            >
              {{ heroScoreA }}
            </strong>

            <span aria-hidden="true"> – </span>

            <strong
              :class="{
                'is-leading': pointLeader === 'playerB',
              }"
            >
              {{ heroScoreB }}
            </strong>
          </div>

          <span class="live-scoreboard__score-caption">
            {{ scoreCaption }}
          </span>
        </div>

        <article
          class="live-scoreboard__player"
          :class="{
            'live-scoreboard__player--serving': !isCompleted && currentServer === 'playerB',
          }"
        >
          <div class="live-scoreboard__avatar">
            <span aria-hidden="true">
              {{ initials(playerBName) }}
            </span>

            <span
              v-if="!isCompleted && currentServer === 'playerB'"
              class="live-scoreboard__serve-ball"
              aria-hidden="true"
            >
              <svg viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14.5" fill="#f2e94e" />

                <path d="M5.2 8.3c5.5 1.5 8.9 5.1 10.1 10.4 1.1 4.8 3.6 7.6 8.4 9.1" />

                <path d="M26.8 5.7c-5.2 1.8-8.3 5.4-9.2 10.7-.8 4.8-3.2 7.8-7.8 9.6" />
              </svg>
            </span>
          </div>

          <h2>
            {{ playerBName }}
          </h2>

          <span v-if="!isCompleted && currentServer === 'playerB'" class="sr-only">
            {{ playerBName }} is serving.
          </span>
        </article>
      </section>

      <section v-if="isCompleted" class="live-scoreboard__completed" aria-live="polite">
        <span>Match complete</span>

        <strong v-if="winnerName"> {{ winnerName }} wins </strong>

        <p v-if="finalScoreText">
          {{ finalScoreText }}
        </p>
      </section>

      <div v-if="showSetTable" class="live-scoreboard__table-shell">
        <table
          class="live-scoreboard__table"
          :style="{
            minWidth: tableMinWidth,
          }"
        >
          <caption class="sr-only">
            Set-by-set match score
          </caption>

          <thead>
            <tr>
              <th scope="col" class="player-column">Player</th>

              <th
                v-for="column in setColumns"
                :key="`heading-${column.index}`"
                scope="col"
                :class="{
                  'current-column': column.current,
                }"
              >
                {{ columnHeading(column) }}
              </th>

              <th scope="col" class="points-column">
                {{ tableFinalHeading }}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <th scope="row">
                {{ playerAName }}
              </th>

              <td
                v-for="column in setColumns"
                :key="`a-${column.index}`"
                :class="{
                  'current-column': column.current,
                }"
              >
                {{ setValue(column, 'playerA') }}
              </td>

              <td class="live-scoreboard__table-point">
                {{ tableFinalValueA }}
              </td>
            </tr>

            <tr>
              <th scope="row">
                {{ playerBName }}
              </th>

              <td
                v-for="column in setColumns"
                :key="`b-${column.index}`"
                :class="{
                  'current-column': column.current,
                }"
              >
                {{ setValue(column, 'playerB') }}
              </td>

              <td class="live-scoreboard__table-point">
                {{ tableFinalValueB }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section v-else class="live-scoreboard__tiebreak-summary" aria-label="Match tie-break">
        <span> Match tie-break </span>

        <strong>
          {{ pointA }} –
          {{ pointB }}
        </strong>
      </section>

      <div class="live-scoreboard__meta">
        <span>
          {{ snapshot.display?.matchFormat || 'Tennis match' }}
        </span>

        <span v-if="snapshot.display?.scoringFormat">
          {{ snapshot.display.scoringFormat }}
        </span>

        <span v-if="serverName"> {{ serverName }} serving </span>

        <span>
          Match time
          {{ elapsedText }}
        </span>
      </div>
    </main>

    <footer class="live-scoreboard__footer">
      <span>
        Powered by
        <strong>GORRA</strong>
      </span>

      <span> Read-only live display </span>
    </footer>
  </section>
</template>

<style scoped>
.live-scoreboard {
  --board-green-950: #032f24;
  --board-green-900: #064735;
  --board-green-800: #07563e;
  --board-leader: #b8df63;
  --board-panel: #17181c;
  --board-panel-head: #111216;
  --board-line: rgba(255, 255, 255, 0.1);
  --board-text: #f7f7f5;
  --board-muted: #a4aaa6;

  min-height: 100svh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 50% 18%, rgba(31, 123, 77, 0.25), transparent 40%),
    var(--board-green-950);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
}

.live-scoreboard__header {
  flex: 0 0 auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(2, 43, 31, 0.72);
}

.live-scoreboard__header-inner {
  width: min(92%, 1600px);
  min-height: 76px;
  margin-inline: auto;
  display: grid;
  grid-template-columns:
    minmax(170px, 1fr)
    auto
    minmax(170px, 1fr);
  align-items: center;
  gap: 24px;
}

.live-scoreboard__brand {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 8px;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: 0.075em;
}

.live-scoreboard__brand-ball {
  position: relative;
  width: 21px;
  height: 21px;
  overflow: hidden;
  border: 1.7px solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
}

.live-scoreboard__brand-ball::before,
.live-scoreboard__brand-ball::after {
  content: '';
  position: absolute;
  top: -3px;
  width: 19px;
  height: 26px;
  border: 1.4px solid rgba(255, 255, 255, 0.82);
  border-radius: 50%;
}

.live-scoreboard__brand-ball::before {
  left: -12px;
}

.live-scoreboard__brand-ball::after {
  right: -12px;
}

.live-scoreboard__identity {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 700;
}

.live-scoreboard__status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--board-leader);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.live-scoreboard__status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px rgba(184, 223, 99, 0.08);
}

.live-scoreboard__status--final {
  color: rgba(255, 255, 255, 0.72);
}

.live-scoreboard__time {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 20px;
  font-variant-numeric: tabular-nums;
}

.live-scoreboard__time > div {
  text-align: right;
}

.live-scoreboard__time span {
  display: block;
  color: rgba(255, 255, 255, 0.56);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.live-scoreboard__time time {
  display: block;
  margin-top: 3px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.live-scoreboard__clock {
  margin: 0 !important;
  color: rgba(255, 255, 255, 0.78) !important;
}

.live-scoreboard__main {
  width: min(88%, 1500px);
  flex: 1;
  min-height: 0;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 28px 0 22px;
}

.live-scoreboard__match-type {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 34px;
  padding: 7px 17px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(31, 124, 76, 0.28);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.live-scoreboard__match-type i {
  color: var(--board-leader);
  font-style: normal;
}

.live-scoreboard__hero {
  display: grid;
  grid-template-columns:
    minmax(180px, 1fr)
    minmax(330px, 1.45fr)
    minmax(180px, 1fr);
  align-items: center;
  gap: clamp(24px, 4vw, 64px);
  margin: 27px 0 31px;
}

.live-scoreboard__player {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.live-scoreboard__avatar {
  position: relative;
  width: clamp(82px, 7vw, 112px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1.5px solid rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.035);
  font-size: clamp(25px, 2.5vw, 38px);
  font-weight: 650;
  letter-spacing: 0.02em;
}

.live-scoreboard__player h2 {
  max-width: 290px;
  margin: 13px 0 0;
  overflow-wrap: anywhere;
  color: #fff;
  font-size: clamp(18px, 1.8vw, 26px);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.08;
}

.live-scoreboard__serve-ball {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 3px solid var(--board-green-950);
  border-radius: 50%;
  background: var(--board-green-950);
}

.live-scoreboard__serve-ball svg {
  width: 100%;
  height: 100%;
  display: block;
}

.live-scoreboard__serve-ball path {
  fill: none;
  stroke: #fffde8;
  stroke-width: 2.1;
  stroke-linecap: round;
}

.live-scoreboard__score {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.live-scoreboard__score-context {
  color: rgba(255, 255, 255, 0.64);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.live-scoreboard__scoreline {
  min-height: 138px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(18px, 2vw, 30px);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.live-scoreboard__scoreline strong {
  color: #fff;
  font-size: clamp(82px, 9vw, 145px);
  font-weight: 800;
  letter-spacing: -0.065em;
  line-height: 1;
}

.live-scoreboard__scoreline strong.is-leading {
  color: var(--board-leader);
}

.live-scoreboard__scoreline > span {
  padding-bottom: 0.08em;
  color: rgba(255, 255, 255, 0.78);
  font-size: clamp(40px, 4vw, 66px);
  font-weight: 400;
}

.live-scoreboard__score-caption {
  min-width: 170px;
  padding: 7px 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  color: var(--board-leader);
  background: rgba(2, 54, 39, 0.16);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.live-scoreboard__completed {
  margin: -7px auto 22px;
  text-align: center;
}

.live-scoreboard__completed > span {
  color: var(--board-leader);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.live-scoreboard__completed strong {
  display: block;
  margin-top: 4px;
  font-size: 17px;
  font-weight: 700;
}

.live-scoreboard__completed p {
  margin: 4px 0 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
}

.live-scoreboard__table-shell {
  width: 100%;
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: var(--board-panel);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.09);
  -webkit-overflow-scrolling: touch;
}

.live-scoreboard__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--board-text);
  font-variant-numeric: tabular-nums;
}

.live-scoreboard__table th,
.live-scoreboard__table td {
  border-left: 1px solid var(--board-line);
}

.live-scoreboard__table th:first-child,
.live-scoreboard__table td:first-child {
  border-left: 0;
}

.live-scoreboard__table thead th {
  height: 50px;
  padding: 0 12px;
  color: rgba(255, 255, 255, 0.84);
  background: var(--board-panel-head);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.055em;
  text-align: center;
  text-transform: uppercase;
}

.live-scoreboard__table thead .player-column {
  width: 25%;
  min-width: 180px;
  padding-inline: 23px;
  text-align: left;
}

.live-scoreboard__table thead .points-column {
  width: 13%;
  min-width: 90px;
}

.live-scoreboard__table tbody tr {
  height: 70px;
  border-top: 1px solid var(--board-line);
}

.live-scoreboard__table tbody th {
  padding: 0 23px;
  color: #fff;
  font-size: 14px;
  font-weight: 650;
  text-align: left;
  overflow-wrap: anywhere;
}

.live-scoreboard__table tbody td {
  padding: 0 9px;
  color: #fff;
  font-size: 21px;
  font-weight: 700;
  text-align: center;
}

.live-scoreboard__table .current-column {
  background: rgba(255, 255, 255, 0.025);
}

.live-scoreboard__table-point {
  color: var(--board-leader) !important;
  font-size: 26px !important;
}

.live-scoreboard__tiebreak-summary {
  min-height: 126px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: var(--board-panel);
}

.live-scoreboard__tiebreak-summary span {
  color: var(--board-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.live-scoreboard__tiebreak-summary strong {
  color: #fff;
  font-size: 38px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.live-scoreboard__meta {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px 17px;
  margin-top: 17px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 10px;
  font-weight: 550;
}

.live-scoreboard__meta span + span::before {
  content: '•';
  margin-right: 17px;
  color: rgba(184, 223, 99, 0.7);
}

.live-scoreboard__footer {
  width: min(88%, 1500px);
  min-height: 47px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.46);
  font-size: 9px;
}

.live-scoreboard__footer strong {
  color: rgba(255, 255, 255, 0.75);
}

.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  margin: -1px !important;
  padding: 0 !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

@media (max-width: 900px) {
  .live-scoreboard__header-inner {
    width: 90%;
    grid-template-columns: 1fr auto;
  }

  .live-scoreboard__identity {
    display: none;
  }

  .live-scoreboard__main {
    width: 90%;
    justify-content: flex-start;
    padding-top: 24px;
  }

  .live-scoreboard__hero {
    grid-template-columns:
      1fr
      1fr;
    grid-template-areas:
      'player-a player-b'
      'score score';
    gap: 18px 24px;
  }

  .live-scoreboard__player:first-child {
    grid-area: player-a;
  }

  .live-scoreboard__score {
    grid-area: score;
  }

  .live-scoreboard__player:last-child {
    grid-area: player-b;
  }

  .live-scoreboard__scoreline {
    min-height: 112px;
  }

  .live-scoreboard__scoreline strong {
    font-size: clamp(72px, 18vw, 112px);
  }

  .live-scoreboard__footer {
    width: 90%;
  }
}

@media (max-width: 560px) {
  .live-scoreboard__header-inner {
    width: calc(100% - 28px);
    min-height: 62px;
  }

  .live-scoreboard__brand {
    font-size: 17px;
  }

  .live-scoreboard__brand-ball {
    width: 17px;
    height: 17px;
  }

  .live-scoreboard__time {
    gap: 11px;
  }

  .live-scoreboard__time > div {
    display: none;
  }

  .live-scoreboard__main {
    width: calc(100% - 28px);
    padding-top: 19px;
  }

  .live-scoreboard__match-type {
    max-width: 100%;
    overflow: hidden;
    font-size: 8.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .live-scoreboard__hero {
    margin: 23px 0 25px;
  }

  .live-scoreboard__avatar {
    width: 67px;
    font-size: 21px;
  }

  .live-scoreboard__serve-ball {
    width: 24px;
    height: 24px;
    border-width: 2px;
  }

  .live-scoreboard__player h2 {
    margin-top: 9px;
    font-size: 15px;
  }

  .live-scoreboard__score-context {
    font-size: 8px;
  }

  .live-scoreboard__scoreline {
    min-height: 88px;
    gap: 14px;
  }

  .live-scoreboard__scoreline strong {
    font-size: clamp(61px, 22vw, 86px);
  }

  .live-scoreboard__scoreline > span {
    font-size: 31px;
  }

  .live-scoreboard__score-caption {
    min-width: 138px;
    padding: 6px 13px;
    font-size: 7px;
  }

  .live-scoreboard__meta {
    justify-content: flex-start;
    line-height: 1.55;
  }

  .live-scoreboard__meta span + span::before {
    display: none;
  }

  .live-scoreboard__footer {
    width: calc(100% - 28px);
  }

  .live-scoreboard__footer span:last-child {
    display: none;
  }
}

@media (max-width: 350px) {
  .live-scoreboard__header-inner,
  .live-scoreboard__main,
  .live-scoreboard__footer {
    width: calc(100% - 20px);
  }

  .live-scoreboard__clock {
    font-size: 11px !important;
  }

  .live-scoreboard__hero {
    gap: 15px 12px;
  }

  .live-scoreboard__avatar {
    width: 58px;
    font-size: 18px;
  }

  .live-scoreboard__player h2 {
    font-size: 13px;
  }

  .live-scoreboard__scoreline strong {
    font-size: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}
</style>
