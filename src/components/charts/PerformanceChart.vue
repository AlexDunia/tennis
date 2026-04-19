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
})

// 4. COMPUTED DATA
const chartData = computed(() => {
  let momentum = 0

  const labels = []
  const data = []

  props.matches.forEach((match, index) => {
    if (!match.winnerId) return

    const isWin = match.winnerId === match.playerA?.id // adjust later if needed

    momentum += isWin ? 1 : -1

    labels.push(`Match ${index + 1}`)
    data.push(momentum)
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
        pointRadius: 0,
      },
    ],
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
      padding: 10,
      titleColor: '#fff',
      bodyColor: '#fff',
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#6d7a70' },
    },
    y: {
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
  height: 220px;
}
</style>
