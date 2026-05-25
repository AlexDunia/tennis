<script setup>
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '../stores/tournament'

const router = useRouter()
const tournamentStore = useTournamentStore()

const categories = [
  { id: 'premier', name: 'Premier', description: '12 players - 6 per group' },
  { id: 'category-a', name: 'Category A', description: '10 players + 2 BYEs' },
  { id: 'category-b', name: 'Category B', description: '12 players - 6 per group' },
  { id: 'ladies', name: 'Ladies', description: '8 players + 4 BYEs' },
  { id: 'veterans', name: 'Veterans', description: '12 players - 6 per group' },
]
const steps = ['Basics', 'Categories', 'Rules']

const form = reactive({
  step: 1,
  name: '',
  description: '',
  roundRobinStart: '',
  roundRobinEnd: '',
  knockoutStart: '',
  finalDate: '',
  officials: 'Igo, Harcourt, Zino, Dogiye, David',
  enabledCategories: categories.map((category) => category.id),
  winPoints: 1,
  lossPoints: 0,
  qualifiersPerGroup: 4,
  tiebreakAt: 6,
  walkovertimeMinutes: 30,
  rescheduleNoticeHours: 24,
})

const isBasicsValid = computed(
  () =>
    form.name &&
    form.roundRobinStart &&
    form.roundRobinEnd &&
    form.knockoutStart &&
    form.finalDate,
)

function goNext() {
  if (form.step < 3) form.step += 1
}

function goBack() {
  if (form.step > 1) form.step -= 1
}

function toggleCategory(categoryId) {
  if (form.enabledCategories.includes(categoryId)) {
    form.enabledCategories = form.enabledCategories.filter((id) => id !== categoryId)
    return
  }

  form.enabledCategories = [...form.enabledCategories, categoryId]
}

async function submitTournament() {
  const tournament = await tournamentStore.createTournament({
    name: form.name,
    description: form.description,
    roundRobinStart: form.roundRobinStart,
    roundRobinEnd: form.roundRobinEnd,
    knockoutStart: form.knockoutStart,
    finalDate: form.finalDate,
    officials: form.officials
      .split(',')
      .map((official) => official.trim())
      .filter(Boolean),
    rules: {
      winPoints: Number(form.winPoints),
      lossPoints: Number(form.lossPoints),
      qualifiersPerGroup: Number(form.qualifiersPerGroup),
      tiebreakAt: Number(form.tiebreakAt),
      knockoutFormat: 'top4-crossover',
      rankingOrder: ['points', 'setDiff', 'gameDiff', 'wins', 'name'],
      walkovertimeMinutes: Number(form.walkovertimeMinutes),
      rescheduleNoticeHours: Number(form.rescheduleNoticeHours),
    },
    categories: [],
  })

  if (tournament) {
    router.push(`/tournaments/${tournament.id}`)
  }
}
</script>

<template>
  <section class="tournament-create">
    <header class="t-hero">
      <div class="t-hero__top">
        <div>
          <span class="t-section-kicker">Tournament Wizard</span>
          <h2 class="t-hero__title">Create Tournament</h2>
          <p class="t-hero__copy">
            Set dates, choose categories, and confirm rules. The app prepares the tournament flow so
            players know exactly what happens next.
          </p>
        </div>
        <RouterLink class="t-button t-button--secondary" to="/tournaments">Back</RouterLink>
      </div>
    </header>

    <main class="t-shell-card tournament-create__workspace">
      <ol class="tournament-create__steps">
        <li
          v-for="(step, index) in steps"
          :key="step"
          :class="{
            'tournament-create__step--done': index + 1 < form.step,
            'tournament-create__step--active': index + 1 === form.step,
          }"
        >
          <span>{{ index + 1 < form.step ? '✓' : index + 1 }}</span>
          <strong>{{ step }}</strong>
        </li>
      </ol>

      <section v-if="form.step === 1" class="tournament-create__panel">
        <div>
          <h3 class="t-section-title">Tournament Basics</h3>
          <p class="t-muted">Enter the key dates and officials.</p>
        </div>
        <label>
          <span>Tournament Name *</span>
          <input v-model="form.name" placeholder="e.g. 2027 RSP Masters Tournament" required />
        </label>
        <label>
          <span>Description</span>
          <textarea v-model="form.description" rows="3" placeholder="Brief description of the tournament" />
        </label>
        <div class="tournament-create__form-row">
          <label>
            <span>Group Stage Start *</span>
            <input v-model="form.roundRobinStart" type="date" />
          </label>
          <label>
            <span>Group Stage End *</span>
            <input v-model="form.roundRobinEnd" type="date" />
          </label>
        </div>
        <div class="tournament-create__form-row">
          <label>
            <span>Knockout Start *</span>
            <input v-model="form.knockoutStart" type="date" />
          </label>
          <label>
            <span>Final Date *</span>
            <input v-model="form.finalDate" type="date" />
          </label>
        </div>
        <label>
          <span>Tournament Officials</span>
          <input v-model="form.officials" placeholder="Igo, Harcourt, Zino" />
          <small>Enter names separated by commas.</small>
        </label>
      </section>

      <section v-else-if="form.step === 2" class="tournament-create__panel">
        <div>
          <h3 class="t-section-title">Categories & Players</h3>
          <p class="t-muted">Enable categories now. Player seeding can follow current ladder order.</p>
        </div>
        <div class="tournament-create__categories">
          <button
            v-for="category in categories"
            :key="category.id"
            type="button"
            class="tournament-create__category-toggle"
            :class="{ 'tournament-create__category-toggle--active': form.enabledCategories.includes(category.id) }"
            @click="toggleCategory(category.id)"
          >
            <span>
              <strong>{{ category.name }}</strong>
              <small>{{ category.description }}</small>
            </span>
            <em>{{ form.enabledCategories.includes(category.id) ? 'Enabled' : 'Off' }}</em>
          </button>
        </div>
      </section>

      <section v-else class="tournament-create__panel">
        <div>
          <h3 class="t-section-title">Tournament Rules</h3>
          <p class="t-muted">These defaults match the RSP Masters format.</p>
        </div>
        <div class="tournament-create__form-row">
          <label>
            <span>Win Points</span>
            <input v-model.number="form.winPoints" min="0" type="number" />
          </label>
          <label>
            <span>Loss Points</span>
            <input v-model.number="form.lossPoints" min="0" type="number" />
          </label>
        </div>
        <div class="tournament-create__form-row">
          <label>
            <span>Qualifiers Per Group</span>
            <input v-model.number="form.qualifiersPerGroup" min="2" type="number" />
          </label>
          <label>
            <span>Tiebreak At Games</span>
            <input v-model.number="form.tiebreakAt" min="4" type="number" />
          </label>
        </div>
        <div class="tournament-create__form-row">
          <label>
            <span>Walkover Time (mins)</span>
            <input v-model.number="form.walkovertimeMinutes" min="1" type="number" />
          </label>
          <label>
            <span>Reschedule Notice (hrs)</span>
            <input v-model.number="form.rescheduleNoticeHours" min="1" type="number" />
          </label>
        </div>
        <div class="tournament-create__rule-note">
          <strong>Ranking Tiebreakers</strong>
          <span>Points -> Set Difference -> Game Difference -> Wins -> Name</span>
        </div>
      </section>

      <footer class="tournament-create__footer">
        <button class="t-button t-button--secondary" type="button" :disabled="form.step === 1" @click="goBack">
          Back
        </button>
        <button
          v-if="form.step < 3"
          class="t-button t-button--primary"
          type="button"
          :disabled="form.step === 1 && !isBasicsValid"
          @click="goNext"
        >
          Next
        </button>
        <button v-else class="t-button t-button--primary" type="button" @click="submitTournament">
          Create Tournament
        </button>
      </footer>
    </main>
  </section>
</template>

<style scoped>
.tournament-create__workspace {
  display: grid;
  gap: 24px;
  max-width: 760px;
  padding: 24px;
}

.tournament-create__steps {
  display: flex;
  gap: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.tournament-create__steps li {
  position: relative;
  flex: 1;
  display: grid;
  justify-items: center;
  gap: 6px;
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tournament-create__steps li::after {
  content: '';
  position: absolute;
  top: 14px;
  left: 50%;
  right: -50%;
  height: 2px;
  background: var(--tournament-line);
}

.tournament-create__steps li:last-child::after {
  display: none;
}

.tournament-create__steps span {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--tournament-line);
  color: var(--tournament-faint);
}

.tournament-create__step--done span {
  background: var(--tournament-green);
  color: #ffffff;
}

.tournament-create__step--active span {
  border: 2px solid var(--tournament-green);
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
}

.tournament-create__step--active strong {
  color: var(--tournament-green-dark);
}

.tournament-create__panel {
  display: grid;
  gap: 16px;
}

.tournament-create label {
  display: grid;
  gap: 6px;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tournament-create input,
.tournament-create textarea {
  min-height: 42px;
  border: 1.5px solid var(--tournament-line);
  border-radius: 10px;
  padding: 9px 12px;
  color: var(--tournament-ink);
  font-size: 14px;
  text-transform: none;
}

.tournament-create small {
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.tournament-create__form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.tournament-create__categories {
  display: grid;
  gap: 12px;
}

.tournament-create__category-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1.5px solid var(--tournament-line);
  border-radius: 10px;
  padding: 14px 16px;
  background: #ffffff;
  text-align: left;
}

.tournament-create__category-toggle--active {
  border-color: rgba(0, 181, 26, 0.35);
  background: var(--tournament-green-soft);
}

.tournament-create__category-toggle span {
  display: grid;
  gap: 2px;
}

.tournament-create__category-toggle strong {
  font-size: 14px;
}

.tournament-create__category-toggle em {
  color: var(--tournament-green-dark);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.tournament-create__rule-note {
  display: grid;
  gap: 4px;
  border-left: 3px solid var(--tournament-green);
  border-radius: 10px;
  padding: 12px;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 12px;
}

.tournament-create__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--tournament-line);
  padding-top: 18px;
}

@media (max-width: 640px) {
  .tournament-create__workspace {
    padding: 18px;
  }

  .tournament-create__form-row {
    grid-template-columns: 1fr;
  }

  .tournament-create__footer {
    flex-direction: column;
  }
}
</style>
