<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { useAdminStore } from '../stores/admin'
import { useMatchStore } from '../stores/match'
import { useTournamentStore } from '../stores/tournament'
import { subscribeToClubCalendarChanges } from '../utils/clubCalendarSync.js'
const router = useRouter()
const adminStore = useAdminStore()
const matchStore = useMatchStore()
const tournamentStore = useTournamentStore()

const loading = ref(true)
const error = ref('')
const today = new Date()
const visibleMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selectedDate = ref(dateKey(today))

const club = computed(() => adminStore.activeClub)
const activeClubId = computed(() => club.value?.id || '')
const tournamentById = computed(() => new Map(tournamentStore.tournaments.map((item) => [item.id, item])))

const events = computed(() =>
  matchStore.matches
    .filter((match) => {
      if (!scheduleKey(match) || ['completed', 'walkover', 'cancelled'].includes(match.status)) return false
      const tournament = tournamentById.value.get(match.tournamentId)
      return match.clubId === activeClubId.value || tournament?.clubId === activeClubId.value
    })
    .map((match) => ({
      id: match.id,
      match,
      key: scheduleKey(match),
      kind: match.type === 'tournament' ? 'Tournament' : 'Ladder',
      title:
        match.type === 'tournament'
          ? tournamentById.value.get(match.tournamentId)?.name || 'Tournament match'
          : match.ladderName || 'Ladder match',
      players: `${match.challengerName || match.player1Name || 'TBD'} vs ${match.defenderName || match.player2Name || 'TBD'}`,
    }))
    .sort((left, right) => new Date(eventMoment(left.match)).getTime() - new Date(eventMoment(right.match)).getTime()),
)

const eventsByDate = computed(() => {
  const groups = new Map()
  events.value.forEach((event) => groups.set(event.key, [...(groups.get(event.key) || []), event]))
  return groups
})

const monthLabel = computed(() =>
  visibleMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
)

const calendarDays = computed(() => {
  const year = visibleMonth.value.getFullYear()
  const month = visibleMonth.value.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(year, month, index - firstWeekday + 1)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: key === dateKey(today),
      isSelected: key === selectedDate.value,
      events: eventsByDate.value.get(key) || [],
    }
  })
})

const selectedEvents = computed(() => eventsByDate.value.get(selectedDate.value) || [])
const selectedDateLabel = computed(() =>
  dateFromKey(selectedDate.value).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }),
)

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dateFromKey(key) {
  const [year, month, day] = String(key || '').split('-').map(Number)
  return new Date(year || today.getFullYear(), (month || 1) - 1, day || 1)
}

function scheduleKey(match) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(match.scheduledDate || ''))) return match.scheduledDate
  return dateKey(match.scheduledAt)
}

function eventMoment(match) {
  if (match.scheduledAt) return match.scheduledAt
  if (match.scheduledDate && match.scheduledTime) return `${match.scheduledDate}T${match.scheduledTime}`
  return `${match.scheduledDate || ''}T00:00:00`
}

function eventTime(event) {
  const match = event.match
  if (match.scheduledTime) {
    const date = new Date(`${event.key}T${match.scheduledTime}`)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  if (match.scheduledAt) {
    return new Date(match.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return 'Time to be confirmed'
}

function changeMonth(amount) {
  const next = new Date(visibleMonth.value.getFullYear(), visibleMonth.value.getMonth() + amount, 1)
  visibleMonth.value = next
  selectedDate.value = dateKey(next)
}

function openMatch(event) {
  router.push({ name: 'MatchDetails', params: { matchId: event.id } })
}

let refreshPromise = null
let stopCalendarSync = () => {}

function refreshCalendarData() {
  if (refreshPromise) return refreshPromise
  refreshPromise = Promise.all([
    matchStore.loadMatches(),
    tournamentStore.fetchTournaments(),
  ]).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

onMounted(async () => {
  try {
    await adminStore.loadClubs()
    if (!adminStore.activeClub) return
    await refreshCalendarData()
    stopCalendarSync = subscribeToClubCalendarChanges(() => void refreshCalendarData())
  } catch (cause) {
    error.value = cause?.message || 'We could not load the club calendar.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => stopCalendarSync())

useShellNestedHeader(() => ({
  label: 'Club calendar',
  backLabel: 'Back to club',
  back: () => router.push({ name: 'Club' }),
  crumbs: [{ label: 'Club' }, { label: 'Calendar' }, { label: club.value?.name || 'Current club' }],
}))
</script>

<template>
  <main class="club-calendar gorra-club-ref ref-page" aria-labelledby="club-calendar-title">
    <button class="club-calendar__back" type="button" @click="router.push({ name: 'Club' })">
      <FlowIcon name="arrow-right" aria-hidden="true" />
      Back to club
    </button>

    <header class="club-calendar__hero">
      <div>
        <h1 id="club-calendar-title">Club calendar</h1>
        <p>One club-wide view of scheduled Ladder and Tournament matches.</p>
      </div>
      <span v-if="club" class="club-calendar__club">{{ club.name }}</span>
    </header>

    <p v-if="error" class="club-calendar__alert" role="alert">{{ error }}</p>

    <section v-if="!loading && club" class="club-calendar__layout">
      <section class="club-calendar__month" aria-label="Club calendar month">
        <header class="club-calendar__month-head">
          <button type="button" aria-label="Previous month" @click="changeMonth(-1)">
            <FlowIcon name="arrow-right" aria-hidden="true" />
          </button>
          <h2>{{ monthLabel }}</h2>
          <button type="button" aria-label="Next month" @click="changeMonth(1)">
            <FlowIcon name="arrow-right" aria-hidden="true" />
          </button>
        </header>

        <div class="club-calendar__weekdays" aria-hidden="true">
          <span v-for="weekday in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="weekday">{{ weekday }}</span>
        </div>

        <div class="club-calendar__grid">
          <button
            v-for="day in calendarDays"
            :key="day.key"
            class="club-calendar__day"
            :class="{ 'is-outside': !day.inMonth, 'is-today': day.isToday, 'is-selected': day.isSelected }"
            type="button"
            :aria-label="`${day.key}${day.events.length ? `, ${day.events.length} scheduled matches` : ''}`"
            @click="selectedDate = day.key"
          >
            <span>{{ day.day }}</span>
            <small v-if="day.events.length">{{ day.events.length }} match{{ day.events.length === 1 ? '' : 'es' }}</small>
            <i v-if="day.events.length" aria-hidden="true"></i>
          </button>
        </div>
      </section>

      <aside class="club-calendar__agenda" aria-live="polite">
        <header>
          <p>Schedule</p>
          <h2>{{ selectedDateLabel }}</h2>
        </header>

        <div v-if="selectedEvents.length" class="club-calendar__event-list">
          <button v-for="event in selectedEvents" :key="event.id" type="button" @click="openMatch(event)">
            <span class="club-calendar__event-time">{{ eventTime(event) }}</span>
            <span class="club-calendar__event-copy">
              <small>{{ event.kind }}</small>
              <strong>{{ event.title }}</strong>
              <span>{{ event.players }}</span>
              <em v-if="event.match.court">{{ event.match.court }}</em>
            </span>
            <FlowIcon name="arrow-right" aria-hidden="true" />
          </button>
        </div>

        <p v-else class="club-calendar__empty">No club matches are scheduled for this day.</p>
      </aside>
    </section>

    <section v-else-if="!loading" class="club-calendar__empty-state">
      <h2>No active club</h2>
      <p>Choose a club to see its calendar.</p>
      <button class="ref-button primary" type="button" @click="router.push({ name: 'Clubs' })">Open your clubs</button>
    </section>

    <div v-else class="club-calendar__loading" aria-live="polite">
      <span></span><span></span>
      <span class="visually-hidden">Loading club calendar</span>
    </div>
  </main>
</template>

<style scoped>
.club-calendar { width: 100%; padding-top: 4px; padding-bottom: 54px; color: var(--color-text, #18221b); }
.club-calendar__back { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 26px; padding: 0; border: 0; background: transparent; color: var(--color-text-soft, #526057); font: inherit; font-size: 12px; font-weight: var(--font-weight-semibold, 600); }
.club-calendar__back :deep(.flow-icon) { width: 15px; height: 15px; transform: rotate(180deg); }
.club-calendar__hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 26px; border-bottom: 1px solid var(--color-border, #e1e7e2); }
.club-calendar__hero h1 { margin: 0; color: var(--color-text, #18221b); font-size: clamp(27px, 4vw, 34px); letter-spacing: -.045em; line-height: 1.08; }
.club-calendar__hero p { margin: 7px 0 0; color: var(--color-muted, #728077); font-size: 13px; line-height: 1.55; }
.club-calendar__club { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-primary-strong, #087c29); font-size: 11px; font-weight: var(--font-weight-semibold, 600); }
.club-calendar__layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(290px, 360px); gap: 20px; margin-top: 24px; align-items: start; }
.club-calendar__month, .club-calendar__agenda { padding: 22px; border: 1px solid var(--color-border, #e1e7e2); border-radius: 16px; background: var(--color-surface, #fff); box-shadow: 0 8px 24px rgba(18, 38, 24, .035); }
.club-calendar__month-head { display: grid; grid-template-columns: 36px 1fr 36px; align-items: center; gap: 10px; margin-bottom: 20px; }
.club-calendar__month-head h2 { margin: 0; text-align: center; font-size: 16px; letter-spacing: -.02em; }
.club-calendar__month-head button { display: grid; width: 36px; height: 36px; place-items: center; padding: 0; border: 1px solid var(--color-border, #e1e7e2); border-radius: 9px; background: #fff; color: var(--color-text-soft, #526057); }
.club-calendar__month-head button:first-child :deep(.flow-icon) { transform: rotate(180deg); }
.club-calendar__month-head :deep(.flow-icon) { width: 15px; height: 15px; }
.club-calendar__weekdays, .club-calendar__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.club-calendar__weekdays { gap: 4px; margin-bottom: 5px; color: var(--color-muted, #728077); font-size: 9px; font-weight: var(--font-weight-semibold, 600); letter-spacing: .04em; text-align: center; text-transform: uppercase; }
.club-calendar__grid { gap: 4px; }
.club-calendar__day { position: relative; display: grid; min-height: 78px; align-content: start; gap: 4px; padding: 9px; overflow: hidden; border: 1px solid transparent; border-radius: 9px; background: #f8faf8; color: var(--color-text, #18221b); text-align: left; }
.club-calendar__day > span { font-size: 12px; font-weight: var(--font-weight-semibold, 600); }
.club-calendar__day small { overflow: hidden; color: var(--color-primary-strong, #087c29); font-size: 9px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.club-calendar__day i { position: absolute; right: 8px; bottom: 8px; width: 5px; height: 5px; border-radius: 50%; background: var(--color-primary, #10a34a); }
.club-calendar__day:hover, .club-calendar__day.is-selected { border-color: rgba(8, 124, 41, .34); background: #eef7f0; }
.club-calendar__day.is-today > span { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: #163d2b; color: #fff; }
.club-calendar__day.is-outside { color: #a3ada5; background: transparent; }
.club-calendar__day.is-outside small, .club-calendar__day.is-outside i { display: none; }
.club-calendar__agenda header { padding-bottom: 17px; border-bottom: 1px solid var(--color-border, #e1e7e2); }
.club-calendar__agenda header p { margin: 0; color: var(--color-primary-strong, #087c29); font-size: 10px; font-weight: var(--font-weight-semibold, 600); letter-spacing: .1em; text-transform: uppercase; }
.club-calendar__agenda header h2 { margin: 5px 0 0; font-size: 16px; letter-spacing: -.02em; }
.club-calendar__event-list { display: grid; gap: 8px; margin-top: 15px; }
.club-calendar__event-list button { display: grid; grid-template-columns: 54px minmax(0, 1fr) 16px; align-items: center; gap: 9px; padding: 11px 8px; border: 0; border-radius: 9px; background: transparent; color: inherit; text-align: left; }
.club-calendar__event-list button:hover { background: #f2f7f3; }
.club-calendar__event-time { color: var(--color-primary-strong, #087c29); font-size: 10px; font-weight: var(--font-weight-semibold, 600); }
.club-calendar__event-copy { display: grid; min-width: 0; gap: 2px; }
.club-calendar__event-copy small { color: var(--color-muted, #728077); font-size: 9px; font-weight: var(--font-weight-semibold, 600); letter-spacing: .06em; text-transform: uppercase; }
.club-calendar__event-copy strong, .club-calendar__event-copy span, .club-calendar__event-copy em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.club-calendar__event-copy strong { color: var(--color-text, #18221b); font-size: 12px; font-weight: var(--font-weight-semibold, 600); }
.club-calendar__event-copy span, .club-calendar__event-copy em { color: var(--color-muted, #728077); font-size: 10px; font-style: normal; }
.club-calendar__event-list :deep(.flow-icon) { width: 15px; height: 15px; color: var(--color-muted, #728077); }
.club-calendar__empty { margin: 18px 0 0; color: var(--color-muted, #728077); font-size: 12px; line-height: 1.55; }
.club-calendar__alert { margin: 20px 0 0; padding: 11px 13px; border: 1px solid #f0cccc; border-radius: 10px; background: #fff7f7; color: #9a3030; font-size: 12px; }
.club-calendar__empty-state { display: grid; justify-items: start; gap: 9px; margin-top: 25px; padding: 24px; border: 1px solid var(--color-border, #e1e7e2); border-radius: 16px; background: #fff; }
.club-calendar__empty-state h2, .club-calendar__empty-state p { margin: 0; }
.club-calendar__empty-state h2 { font-size: 18px; }
.club-calendar__empty-state p { color: var(--color-muted, #728077); font-size: 13px; }
.club-calendar__empty-state .ref-button { margin-top: 8px; }
.club-calendar__loading { display: grid; gap: 18px; margin-top: 25px; }
.club-calendar__loading span:not(.visually-hidden) { display: block; height: 380px; border-radius: 16px; background: linear-gradient(90deg, #f0f3f0 20%, #fafbfa 50%, #f0f3f0 80%); background-size: 220% 100%; animation: club-calendar-shimmer 1.25s linear infinite; }
.club-calendar__loading span:nth-child(2) { height: 180px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes club-calendar-shimmer { to { background-position: -220% 0; } }
@media (max-width: 800px) { .club-calendar__layout { grid-template-columns: 1fr; } .club-calendar__agenda { order: -1; } }
@media (max-width: 560px) { .club-calendar { padding-bottom: 32px; } .club-calendar__hero { align-items: flex-start; flex-direction: column; gap: 10px; } .club-calendar__month, .club-calendar__agenda { padding: 17px; } .club-calendar__day { min-height: 58px; padding: 7px; } .club-calendar__day small { display: none; } .club-calendar__weekdays { font-size: 8px; } }
</style>