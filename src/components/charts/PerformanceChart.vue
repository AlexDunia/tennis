<template>
  <div class="performance-card">
    <!-- HEADER -->
    <div class="header">
      <div>
        <h3>Performance</h3>
        <p>Match trends and performance over time</p>
      </div>

      <div class="win-rate">
        <span class="value">{{ winRate }}%</span>
        <span class="label">win rate</span>
      </div>
    </div>

    <!-- LEGEND + FILTER -->
    <div class="chart-top">
      <div class="legend">
        <span><i class="dot win"></i> Win</span>
        <span><i class="dot loss"></i> Loss</span>
        <span><i class="line"></i> Win rate</span>
      </div>

      <div class="filters">
        <button class="active">7D</button>
        <button>30D</button>
        <button>All</button>
      </div>
    </div>

    <!-- CHART -->
    <div class="chart-wrapper">
      <canvas ref="chartRef"></canvas>
    </div>

    <!-- BOTTOM STATS -->
    <div class="bottom">
      <div>
        <span class="label">Matches</span>
        <strong>7</strong>
      </div>

      <div>
        <span class="label">Current streak</span>
        <strong class="green">W3</strong>
      </div>

      <div>
        <span class="label">Form</span>
        <strong>80%</strong>
      </div>

      <div class="right">
        <span>2 upcoming</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  ScatterController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js'

Chart.register(
  LineElement,
  PointElement,
  LineController,
  ScatterController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
)

const chartRef = ref(null)

const matches = [
  { result: 'loss' },
  { result: 'win' },
  { result: 'win' },
  { result: 'loss' },
  { result: 'win' },
  { result: 'win' },
  { result: 'win' },
]

const labels = matches.map((_, i) => `M${i + 8}`)

let wins = 0
const winRateData = matches.map((m, i) => {
  if (m.result === 'win') wins++
  return Math.round((wins / (i + 1)) * 100)
})

const winPoints = matches.map((m) => (m.result === 'win' ? 95 : null))
const lossPoints = matches.map((m) => (m.result === 'loss' ? 5 : null))

const winRate = Math.round(
  (matches.filter((m) => m.result === 'win').length / matches.length) * 100,
)

onMounted(() => {
  const ctx = chartRef.value.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, 0, 240)
  gradient.addColorStop(0, 'rgba(59,130,246,0.18)')
  gradient.addColorStop(1, 'rgba(59,130,246,0)')

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: winRateData,
          borderColor: '#3b82f6',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          data: winPoints,
          backgroundColor: '#22c55e',
          pointRadius: 5,
          type: 'scatter',
        },
        {
          data: lossPoints,
          backgroundColor: '#ef4444',
          pointRadius: 5,
          type: 'scatter',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20, // 🔥 0,20,40,60,80,100
            callback: (v) => v + '%',
            color: '#374151', // darker (matches dashboard)
            font: {
              family: 'Poppins',
              size: 13,
              weight: '500', // 🔥 slightly bold
            },
          },
          grid: {
            color: '#eef2f7',
          },
        },
        x: {
          ticks: {
            color: '#374151',
            font: {
              family: 'Poppins',
              size: 13,
              weight: '500',
            },
          },
          grid: { display: false },
        },
      },
    },
  })
})
</script>

<style scoped>
.performance-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

/* HEADER */
.header {
  display: flex;
  justify-content: space-between;
}

.header h3 {
  font-size: 20px;
  font-weight: 600;
}

.header p {
  font-size: 14px;
  color: #6b7280;
}

.win-rate .value {
  font-size: 20px;
  font-weight: 700;
}

.win-rate .label {
  font-size: 12px;
  color: #6b7280;
}

/* LEGEND + FILTER */
.chart-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}

.legend span {
  margin-right: 14px;
  font-size: 13px;
  color: #6b7280;
}

/* FILTER */
.filters button {
  border: none;
  background: #f3f4f6;
  padding: 6px 12px;
  border-radius: 999px;
  margin-left: 6px;
  font-size: 12px;
}

.filters .active {
  background: #111827;
  color: white;
}

/* CHART */
.chart-wrapper {
  height: 240px;
  margin-top: 10px;
}

/* BOTTOM */
.bottom {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #eef2f7;
}

.bottom .label {
  display: block;
  font-size: 12px;
  color: #6b7280;
}

.bottom strong {
  font-size: 14px;
  font-weight: 600;
}

.green {
  color: #22c55e;
}

.bottom .right {
  display: flex;
  align-items: flex-end;
  font-size: 13px;
  color: #6b7280;
}

/* DOTS */
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}

.win {
  background: #22c55e;
}
.loss {
  background: #ef4444;
}

.line {
  width: 16px;
  height: 2px;
  background: #3b82f6;
  display: inline-block;
  margin-right: 4px;
}
</style>
