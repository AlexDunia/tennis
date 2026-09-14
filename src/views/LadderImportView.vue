<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import BaseButton from '../components/BaseButton.vue'
import { useAdminStore } from '../stores/admin.js'
import { sanitizePlainText } from '../utils/formSafety.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import '../assets/ladder-workspace.css'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 500

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()

const ready = ref(false)
const busy = ref(false)
const error = ref('')
const fileName = ref('')
const rows = ref([])

const ladderId = computed(() => String(route.params.ladderId || ''))

const ladder = computed(
  () =>
    adminStore.activeClub?.setup?.ladders?.find(
      (item) => item.id === ladderId.value && !item.archived,
    ) || null,
)

function normalizedKey(value) {
  return sanitizePlainText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function valueFor(row, aliases) {
  const keyMap = new Map(
    Object.entries(row || {}).map(([key, value]) => [
      normalizedKey(key),
      value,
    ]),
  )

  for (const alias of aliases) {
    const value = keyMap.get(normalizedKey(alias))
    if (value !== undefined && value !== null && String(value).trim()) {
      return value
    }
  }

  return ''
}

function normalizeRows(rawRows) {
  return (Array.isArray(rawRows) ? rawRows : [])
    .slice(0, MAX_ROWS)
    .map((row, index) => ({
      name: sanitizePlainText(
        valueFor(row, ['name', 'full name', 'player', 'player name']),
        100,
      ),
      email: sanitizePlainText(
        valueFor(row, ['email', 'email address']),
        254,
      ).toLowerCase(),
      phone: sanitizePlainText(
        valueFor(row, ['phone', 'phone number']),
        30,
      ),
      gender: sanitizePlainText(valueFor(row, ['gender', 'sex']), 30),
      dob: sanitizePlainText(
        valueFor(row, ['dob', 'date of birth', 'birth date']),
        10,
      ),
      level: sanitizePlainText(
        valueFor(row, ['level', 'skill', 'skill level']),
        50,
      ),
      position: Number.parseInt(
        valueFor(row, ['position', 'rank', 'ranking']) || index + 1,
        10,
      ),
    }))
    .filter(
      (row) =>
        row.name &&
        Number.isInteger(row.position) &&
        row.position >= 1,
    )
    .sort((left, right) => left.position - right.position)
}

async function readFile(file) {
  if (!file) return

  error.value = ''

  if (file.size > MAX_FILE_BYTES) {
    error.value = 'Use a file smaller than 5 MB.'
    return
  }

  const extension = file.name.split('.').pop()?.toLowerCase()

  if (!['csv', 'xlsx', 'xls'].includes(extension)) {
    error.value = 'Use a CSV or Excel file.'
    return
  }

  try {
    const buffer = await file.arrayBuffer()

    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
    })

    const firstSheet = workbook.SheetNames[0]
    if (!firstSheet) throw new Error('This file has no worksheet.')

    const rawRows = XLSX.utils.sheet_to_json(
      workbook.Sheets[firstSheet],
      {
        defval: '',
        raw: false,
      },
    )

    const normalized = normalizeRows(rawRows)

    if (!normalized.length) {
      throw new Error(
        'No usable ladder rows were found. Include a player name and position.',
      )
    }

    rows.value = normalized
    fileName.value = sanitizePlainText(file.name, 180)
  } catch (readError) {
    rows.value = []
    fileName.value = ''
    error.value = readError?.message || 'Unable to read this file.'
  }
}

async function applyImport() {
  if (busy.value || !rows.value.length) return

  busy.value = true
  error.value = ''

  try {
    await adminStore.importLadder(ladderId.value, rows.value)

    await router.push({
      name: 'LadderSetup',
      params: {
        ladderId: ladderId.value,
        step: 'order',
      },
    })
  } catch (importError) {
    error.value = importError?.message || 'Unable to import this ladder.'
  } finally {
    busy.value = false
  }
}

function cancel() {
  router.push({
    name: 'LadderSetup',
    params: {
      ladderId: ladderId.value,
      step: 'members',
    },
  })
}

useShellNestedHeader(() => ({
  label: 'Import ladder',
  backLabel: 'Back to members',
  back: cancel,
  crumbs: [
    { label: 'Ladder' },
    { label: ladder.value?.name || 'Current ladder' },
    { label: 'Import' },
  ],
}))

onMounted(async () => {
  try {
    if (!adminStore.activeClub) await adminStore.loadClubs()

    if (!adminStore.hasActiveClubPermission('club.manage')) {
      await router.replace({ name: 'Rankings' })
    }
  } catch (loadError) {
    error.value = loadError?.message || 'Unable to open ladder import.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main v-if="ready && ladder" class="ladder-workspace-page">
    <header class="ladder-workspace-page__header">
      <p class="ladder-workspace-page__eyebrow">{{ ladder.name }}</p>
      <h1>Import ladder</h1>
      <p class="ladder-workspace-page__description">
        Upload your current order. Existing people are reused by strong
        identifiers; GORRA does not merge people just because their names look
        similar.
      </p>
    </header>

    <p v-if="error" class="lw-alert" role="alert">{{ error }}</p>

    <section class="lw-section">
      <label class="lw-field">
        <span>CSV or Excel</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          @change="readFile($event.target.files?.[0])"
        />
        <small>
          Maximum 5 MB · up to 500 rows · recommended columns: Name, Email,
          Position.
        </small>
      </label>

      <p v-if="fileName" class="lw-success">
        {{ fileName }} · {{ rows.length }} rows ready
      </p>
    </section>

    <section v-if="rows.length" class="lw-section">
      <div class="lw-section__heading">
        <h2>Review</h2>
        <p>
          Importing adds/reuses people and prepares the starting order. It does
          not silently remove existing members.
        </p>
      </div>

      <div class="lw-list">
        <article
          v-for="row in rows.slice(0, 40)"
          :key="`${row.position}:${row.email}:${row.name}`"
          class="lw-list-row"
        >
          <span class="lw-order-number">{{ row.position }}</span>
          <span>
            <strong>{{ row.name }}</strong>
            <small>{{ row.email || 'No email in file' }}</small>
          </span>
        </article>
      </div>

      <small v-if="rows.length > 40">
        Showing the first 40 rows. All {{ rows.length }} rows will be imported.
      </small>
    </section>

    <footer class="lw-footer">
      <BaseButton variant="secondary" :disabled="busy" @click="cancel">
        Cancel
      </BaseButton>

      <BaseButton :disabled="busy || !rows.length" @click="applyImport">
        {{ busy ? 'Importing…' : 'Import & review order' }}
      </BaseButton>
    </footer>
  </main>
</template>
