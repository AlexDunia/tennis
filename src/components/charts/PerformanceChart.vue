<script setup>
import { ref, onMounted, computed } from 'vue'
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js'

Chart.register(
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
)

const props = defineProps({
  matches: Array,
  currentPlayerId: String,
  playerName: {
    type: String,
    default: 'Henry Dunia',
  },
  playerInitials: {
    type: String,
    default: 'HD',
  },
})

const chartRef = ref(null)
let chartInstance = null

// ─── Tooltip state ──────────────────────────────────────────────────────────
const tooltipData = ref({
  visible: false,
  left: 0,
  top: 0,
  weekLabel: '',
  wins: 0,
  losses: 0,
  totalMatches: 0,
  winRate: 0,
  form: [], // bool[] all results in this week, chronological
})

// ─── Demo data ──────────────────────────────────────────────────────────────
// Generates realistic multi-match-per-day demo data spread across ~4 weeks
const safeMatches = computed(() => {
  if (props.matches?.length) return props.matches

  const results = []
  const now = Date.now()

  // Spread matches across last 4 weeks, 2–4 matches per week
  for (let week = 3; week >= 0; week--) {
    const matchesThisWeek = 2 + Math.floor(Math.random() * 3) // 2–4
    for (let m = 0; m < matchesThisWeek; m++) {
      const daysAgo = week * 7 + Math.floor(Math.random() * 5)
      const win = Math.random() > 0.4
      results.push({
        winnerId: win ? props.currentPlayerId : 'opponent',
        completedAt: new Date(now - daysAgo * 86400000),
      })
    }
  }

  // Sort oldest → newest
  return results.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
})

// ─── Group matches by ISO week (Mon–Sun) ────────────────────────────────────
function getISOWeekKey(date) {
  const d = new Date(date)
  const day = d.getDay() === 0 ? 7 : d.getDay() // Mon=1 … Sun=7
  d.setDate(d.getDate() - day + 1) // back to Monday
  return d.toISOString().slice(0, 10) // YYYY-MM-DD of that Monday
}

function formatWeekLabel(mondayStr) {
  const monday = new Date(mondayStr)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `${fmt(monday)} – ${fmt(sunday)}`
}

// ─── Weekly computed data ────────────────────────────────────────────────────
const weeklyData = computed(() => {
  const weekMap = new Map() // weekKey → { wins, losses, form[] }

  safeMatches.value.forEach((m) => {
    const key = getISOWeekKey(m.completedAt)
    const isWin = m.winnerId === props.currentPlayerId

    if (!weekMap.has(key)) {
      weekMap.set(key, { wins: 0, losses: 0, form: [] })
    }

    const entry = weekMap.get(key)
    if (isWin) entry.wins++
    else entry.losses++
    entry.form.push(isWin)
  })

  // Build chart arrays
  const labels = []
  const winRates = []
  const pointColors = []
  const meta = []

  weekMap.forEach((entry, key) => {
    const total = entry.wins + entry.losses
    const rate = Math.round((entry.wins / total) * 100)
    const label = formatWeekLabel(key)
    // Short label for x-axis — just the Mon date
    const xLabel = new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    labels.push(xLabel)
    winRates.push(rate)
    // Dot colour: green if winning week, red if losing week
    pointColors.push(entry.wins >= entry.losses ? '#22c55e' : '#ef4444')
    meta.push({
      weekLabel: label,
      wins: entry.wins,
      losses: entry.losses,
      totalMatches: total,
      winRate: rate,
      form: entry.form,
    })
  })

  return { labels, winRates, pointColors, meta }
})

// ─── Overall win rate (season total) ────────────────────────────────────────
const overallWinRate = computed(() => {
  const total = safeMatches.value.length
  if (!total) return 0
  const wins = safeMatches.value.filter((m) => m.winnerId === props.currentPlayerId).length
  return Math.round((wins / total) * 100)
})

const totalMatchCount = computed(() => safeMatches.value.length)

// ─── Current streak (across all matches, most recent first) ─────────────────
const currentStreak = computed(() => {
  const matches = [...safeMatches.value].reverse()
  let count = 0
  for (const m of matches) {
    if (m.winnerId === props.currentPlayerId) count++
    else break
  }
  return count
})

// ─── Tooltip positioning ────────────────────────────────────────────────────
const TT_W = 210
const TT_H = 210
const OFFSET = 16

function computePos(ptX, ptY, wrapW, wrapH) {
  const goRight = ptX + OFFSET + TT_W <= wrapW
  const x = goRight ? ptX + OFFSET : ptX - OFFSET - TT_W
  let y = ptY - TT_H / 2
  if (y < 4) y = 4
  if (y + TT_H > wrapH) y = wrapH - TT_H - 4
  return { x, y }
}

// ─── Chart mount ────────────────────────────────────────────────────────────
onMounted(() => {
  const ctx = chartRef.value.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, 0, 240)
  gradient.addColorStop(0, 'rgba(59,130,246,0.20)')
  gradient.addColorStop(0.65, 'rgba(59,130,246,0.05)')
  gradient.addColorStop(1, 'rgba(59,130,246,0.00)')

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeklyData.value.labels,
      datasets: [
        {
          data: weeklyData.value.winRates,
          borderColor: '#3b82f6',
          backgroundColor: gradient,
          fill: true,
          tension: 0.45,
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: weeklyData.value.pointColors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverBorderWidth: 2.5,
          pointHoverBorderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: 'easeInOutQuart',
      },
      layout: { padding: { top: 16, right: 12, left: 4, bottom: 0 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        y: {
          min: 0,
          max: 110,
          ticks: {
            stepSize: 25,
            callback: (v) => (v <= 100 && v % 25 === 0 ? v + '%' : ''),
            color: '#9ca3af',
            font: { size: 11 },
          },
          grid: { color: 'rgba(243,244,246,0.8)', drawBorder: false },
        },
        x: {
          ticks: { color: '#9ca3af', font: { size: 11 } },
          grid: { display: false },
        },
      },
      elements: { point: { clip: false } },

      onHover: (event, elements) => {
        if (!elements.length) {
          tooltipData.value.visible = false
          return
        }

        const idx = elements[0].index
        const m = weeklyData.value.meta[idx]
        const pt = chartInstance.getDatasetMeta(0).data[idx]
        const wrapper = chartRef.value.parentElement
        const { x, y } = computePos(pt.x, pt.y, wrapper.clientWidth, wrapper.clientHeight)

        tooltipData.value = {
          visible: true,
          left: x,
          top: y,
          weekLabel: m.weekLabel,
          wins: m.wins,
          losses: m.losses,
          totalMatches: m.totalMatches,
          winRate: m.winRate,
          form: m.form,
        }
      },
    },
  })
})
</script>

<template>
  <div class="performance-card">
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="header">
      <div>
        <h3>Performance</h3>
        <p>Win rate by week</p>
      </div>
      <div class="win-rate">
        <span class="value">{{ overallWinRate }}%</span>
        <span class="label">overall</span>
      </div>
    </div>

    <!-- ── Legend + Filters ───────────────────────────────────────────────── -->
    <div class="chart-top">
      <div class="legend">
        <span><i class="dot win"></i> Win week</span>
        <span><i class="dot loss"></i> Loss week</span>
        <span><i class="line-indicator"></i> Win rate</span>
      </div>
      <div class="filters">
        <button class="active">4W</button>
        <button>8W</button>
        <button>All</button>
      </div>
    </div>

    <!-- ── Chart ───────────────────────────────────────────────────────────── -->
    <div class="chart-wrapper">
      <canvas ref="chartRef"></canvas>

      <Transition name="tt">
        <div
          v-if="tooltipData.visible"
          class="custom-tooltip"
          :style="{ left: tooltipData.left + 'px', top: tooltipData.top + 'px' }"
        >
          <!-- Avatar + name + week -->
          <div class="tt-header">
            <div class="tt-avatar">{{ playerInitials }}</div>
            <div>
              <p class="tt-name">{{ playerName }}</p>
              <p class="tt-date">{{ tooltipData.weekLabel }}</p>
            </div>
          </div>

          <hr class="tt-divider" />

          <!-- Matches played -->
          <div class="tt-row">
            <span class="tt-key">Played</span>
            <span class="tt-val"
              >{{ tooltipData.totalMatches }} match{{
                tooltipData.totalMatches !== 1 ? 'es' : ''
              }}</span
            >
          </div>

          <!-- W / L split -->
          <div class="tt-row">
            <span class="tt-key">Record</span>
            <span class="tt-val tt-record">
              <span class="rec-win">{{ tooltipData.wins }}W</span>
              <span class="rec-sep">/</span>
              <span class="rec-loss">{{ tooltipData.losses }}L</span>
            </span>
          </div>

          <!-- Win rate -->
          <div class="tt-row">
            <span class="tt-key">Win rate</span>
            <span class="tt-val">{{ tooltipData.winRate }}%</span>
          </div>

          <!-- Form strip -->
          <div class="tt-row tt-form-row">
            <span class="tt-key">Results</span>
            <span class="tt-form">
              <span
                v-for="(won, fi) in tooltipData.form"
                :key="fi"
                class="form-dot"
                :class="won ? 'form-win' : 'form-loss'"
              ></span>
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <div class="bottom">
      <div>
        <span class="label">Matches</span>
        <strong>{{ totalMatchCount }}</strong>
      </div>
      <div>
        <span class="label">Win streak</span>
        <strong class="green">W{{ currentStreak }}</strong>
      </div>
      <div>
        <span class="label">Win rate</span>
        <strong>{{ overallWinRate }}%</strong>
      </div>
      <div>
        <span class="label">Upcoming</span>
        <strong>2</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Card ───────────────────────────────────────────────────────────────── */
.performance-card {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-strong);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.header h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
.header p {
  font-size: 13px;
  color: var(--color-text-soft);
  margin: 4px 0 0;
}
.win-rate {
  text-align: right;
}
.win-rate .value {
  font-size: 20px;
  font-weight: 700;
  display: block;
}
.win-rate .label {
  font-size: 12px;
  color: var(--color-text-soft);
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
.chart-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}
.legend {
  display: flex;
  gap: 14px;
}
.legend span {
  font-size: 12px;
  color: var(--color-muted);
  display: flex;
  align-items: center;
  gap: 5px;
}
.filters {
  background: var(--color-surface-soft);
  padding: 4px;
  border-radius: 999px;
}
.filters button {
  border: none;
  background: transparent;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-muted);
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}
.filters button.active {
  background: white;
  color: var(--color-text);
  box-shadow: var(--shadow-soft);
}

/* ── Chart wrapper ───────────────────────────────────────────────────────── */
.chart-wrapper {
  height: 240px;
  margin-top: 12px;
  position: relative;
  overflow: hidden;
  border-radius: 10px;
}
.chart-wrapper canvas {
  cursor: crosshair;
  width: 100%;
  height: 100%;
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */
.custom-tooltip {
  position: absolute;
  pointer-events: none;
  background: #1f2937;
  border-radius: 12px;
  padding: 12px 14px;
  min-width: 210px;
  z-index: 20;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 14px 30px -4px rgba(0, 0, 0, 0.45);
}

/* Transition */
.tt-enter-active,
.tt-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.tt-enter-from,
.tt-leave-to {
  opacity: 0;
  transform: translateY(5px) scale(0.97);
}

/* Header */
.tt-header {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}
.tt-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}
.tt-name {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  margin: 0;
}
.tt-date {
  font-size: 10px;
  color: #9ca3af;
  margin: 2px 0 0;
  line-height: 1.3;
}

.tt-divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 8px 0;
}

/* Rows */
.tt-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 5px 0;
}
.tt-key {
  font-size: 12px;
  color: #9ca3af;
}
.tt-val {
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}

/* W / L record */
.tt-record {
  display: flex;
  align-items: center;
  gap: 4px;
}
.rec-win {
  color: #4ade80;
  font-weight: 600;
}
.rec-sep {
  color: #4b5563;
  font-size: 11px;
}
.rec-loss {
  color: #f87171;
  font-weight: 600;
}

/* Form strip */
.tt-form-row {
  margin-top: 7px;
}
.tt-form {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  max-width: 130px;
  justify-content: flex-end;
}
.form-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.form-win {
  background: #22c55e;
}
.form-loss {
  background: #ef4444;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.bottom {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
}
.bottom .label {
  font-size: 12px;
  color: var(--color-muted);
  display: block;
}
.bottom strong {
  font-size: 14px;
  font-weight: 600;
}
.green {
  color: var(--color-success, #22c55e);
}

/* ── Legend shapes ───────────────────────────────────────────────────────── */
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.win {
  background: #22c55e;
}
.loss {
  background: #ef4444;
}
.line-indicator {
  width: 16px;
  height: 2.5px;
  background: #3b82f6;
  display: inline-block;
  border-radius: 2px;
}
</style>
