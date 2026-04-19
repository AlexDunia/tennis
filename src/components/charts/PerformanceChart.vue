<script setup>
// 1. IMPORTS
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { computed } from 'vue'

// 2. REGISTER
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

// 3. PROPS
const props = defineProps({
  matches: {
    type: Array,
    required: true,
  },
  currentPlayerId: {
    type: String,
    required: true,
  },
})

// 4. COMPUTED DATA
const chartData = computed(() => {
  let momentum = 0

  const labels = []
  const data = []
  const meta = []

  props.matches.forEach((match, index) => {
    if (!match.winnerId) return

    const isPlayerA = match.playerA?.id === props.currentPlayerId

    const isWin =
      (isPlayerA && match.winnerId === match.playerA?.id) ||
      (!isPlayerA && match.winnerId === match.playerB?.id)

    momentum += isWin ? 1 : -1

    labels.push(`Match ${index + 1}`)
    data.push(momentum)

    meta.push({
      opponent: isPlayerA ? match.defenderName : match.challengerName,
      result: isWin ? 'Win' : 'Loss',
      score: match.score || '—',
    })
  })

  return {
    labels,
    datasets: [
      {
        data,
        tension: 0.4,
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(0, 181, 26, 0.08)',
        borderColor: '#00b51a',
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: data.map((val) => (val >= 0 ? '#00b51a' : '#ff7f32')),
      },
    ],
    meta,
  }
})

// 5. OPTIONS
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f1419',
      padding: 12,
      displayColors: false,
      callbacks: {
        title: (items) => {
          const index = items[0].dataIndex
          return chartData.value.meta[index].opponent
        },
        label: (item) => {
          const meta = chartData.value.meta[item.dataIndex]
          return [`Result: ${meta.result}`, `Score: ${meta.score}`]
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#6d7a70' },
    },
    y: {
      suggestedMin: -3,
      suggestedMax: 3,
      grid: {
        color: 'rgba(0,0,0,0.05)',
      },
      ticks: { color: '#6d7a70' },
    },
  },
}
</script>

<template>
  <div class="chart">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.chart {
  height: 240px;
}

canvas {
  cursor: crosshair;
}
</style>
