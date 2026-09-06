<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import PersonAvatar from '../PersonAvatar.vue'
import {
  missingMatchWinner,
} from '../../services/LadderAdminService.js'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  anchorPlayer: {
    type: Object,
    default: null,
  },
  roster: {
    type: Array,
    default: () => [],
  },
  matchType: {
    type: String,
    default: 'singles',
  },
  movementPreview: {
    type: Function,
    required: true,
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'record'])

const dialog = ref(null)
const searchInput = ref(null)
const searchRole = ref('opponent')
const search = ref('')
const playedOn = ref('')
const teammateId = ref('')
const opponentOneId = ref('')
const opponentTwoId = ref('')

const sets = reactive([
  { sideA: '', sideB: '' },
  { sideA: '', sideB: '' },
])

const isDoubles = computed(() => props.matchType === 'doubles')

const selectedIds = computed(() =>
  [
    props.anchorPlayer?.id,
    teammateId.value,
    opponentOneId.value,
    opponentTwoId.value,
  ].filter(Boolean),
)

const availableSearchPlayers = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const chosen = new Set(selectedIds.value)

  return props.roster
    .filter((player) => {
      if (player.id === props.anchorPlayer?.id) return false

      const slotId =
        searchRole.value === 'teammate'
          ? teammateId.value
          : searchRole.value === 'opponent-two'
            ? opponentTwoId.value
            : opponentOneId.value

      if (chosen.has(player.id) && player.id !== slotId) return false

      if (!needle) return true

      return [player.name, player.email]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(needle),
        )
    })
    .slice(0, 8)
})

const teammate = computed(() =>
  props.roster.find((player) => player.id === teammateId.value) || null,
)

const opponentOne = computed(() =>
  props.roster.find((player) => player.id === opponentOneId.value) || null,
)

const opponentTwo = computed(() =>
  props.roster.find((player) => player.id === opponentTwoId.value) || null,
)

const sideAPlayers = computed(() =>
  isDoubles.value
    ? [props.anchorPlayer, teammate.value].filter(Boolean)
    : [props.anchorPlayer].filter(Boolean),
)

const sideBPlayers = computed(() =>
  isDoubles.value
    ? [opponentOne.value, opponentTwo.value].filter(Boolean)
    : [opponentOne.value].filter(Boolean),
)

const sideAIds = computed(() =>
  sideAPlayers.value.map((player) => player.id),
)

const sideBIds = computed(() =>
  sideBPlayers.value.map((player) => player.id),
)

const completedSets = computed(() =>
  sets.filter(
    (set) =>
      String(set.sideA).trim() !== '' &&
      String(set.sideB).trim() !== '',
  ),
)

const scoreState = computed(() =>
  missingMatchWinner(completedSets.value),
)

const preview = computed(() => {
  const participantsReady = isDoubles.value
    ? sideAIds.value.length === 2 && sideBIds.value.length === 2
    : sideAIds.value.length === 1 && sideBIds.value.length === 1

  if (!participantsReady) return null

  return props.movementPreview({
    sideAIds: sideAIds.value,
    sideBIds: sideBIds.value,
    sets: completedSets.value,
  })
})

const canRecord = computed(() => {
  if (!playedOn.value) return false

  if (isDoubles.value) {
    if (sideAIds.value.length !== 2 || sideBIds.value.length !== 2) {
      return false
    }
  } else if (
    sideAIds.value.length !== 1 ||
    sideBIds.value.length !== 1
  ) {
    return false
  }

  return Boolean(scoreState.value.winnerSide && preview.value?.valid)
})

const sideALabel = computed(() =>
  sideAPlayers.value.map((player) => player.name).join(' + '),
)

const sideBLabel = computed(() =>
  sideBPlayers.value.map((player) => player.name).join(' + '),
)

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      if (dialog.value?.open) dialog.value.close()
      return
    }

    const today = new Date()
    playedOn.value = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    teammateId.value = ''
    opponentOneId.value = ''
    opponentTwoId.value = ''
    searchRole.value = isDoubles.value ? 'teammate' : 'opponent'
    search.value = ''

    sets.splice(
      0,
      sets.length,
      { sideA: '', sideB: '' },
      { sideA: '', sideB: '' },
    )

    dialog.value?.showModal()
    await nextTick()
    searchInput.value?.focus()
  },
)

function roleTitle() {
  if (searchRole.value === 'teammate') return 'Choose teammate'
  if (searchRole.value === 'opponent-two') return 'Choose second opponent'
  return isDoubles.value ? 'Choose first opponent' : 'Choose opponent'
}

function choosePlayer(player) {
  if (!player) return

  if (searchRole.value === 'teammate') {
    teammateId.value = player.id
    searchRole.value = 'opponent'
  } else if (searchRole.value === 'opponent-two') {
    opponentTwoId.value = player.id
  } else {
    opponentOneId.value = player.id
    if (isDoubles.value) searchRole.value = 'opponent-two'
  }

  search.value = ''
}

function clearSlot(role) {
  if (role === 'teammate') teammateId.value = ''
  if (role === 'opponent') opponentOneId.value = ''
  if (role === 'opponent-two') opponentTwoId.value = ''
  searchRole.value = role
  search.value = ''
  nextTick(() => searchInput.value?.focus())
}

function addSet() {
  if (sets.length >= 5) return
  sets.push({ sideA: '', sideB: '' })
}

function removeSet(index) {
  if (sets.length <= 1) return
  sets.splice(index, 1)
}

function close() {
  if (props.busy) return
  emit('close')
}

function record() {
  if (!canRecord.value || props.busy) return

  emit('record', {
    matchType: isDoubles.value ? 'doubles' : 'singles',
    sideAIds: sideAIds.value,
    sideBIds: sideBIds.value,
    playedOn: playedOn.value,
    sets: completedSets.value.map((set) => ({
      sideA: Number(set.sideA),
      sideB: Number(set.sideB),
    })),
  })
}
</script>

<template>
  <dialog
    ref="dialog"
    class="missing-match-dialog"
    @cancel.prevent="close"
    @close="emit('close')"
  >
    <form class="missing-match-dialog__inner" @submit.prevent="record">
      <header class="missing-match-dialog__head">
        <div>
          <h2>Record missing match</h2>
          <p>
            Add a result that was played outside Gorra.
          </p>
        </div>

        <button
          class="missing-match-dialog__close"
          type="button"
          aria-label="Close"
          :disabled="busy"
          @click="close"
        >
          ×
        </button>
      </header>

      <section class="missing-match-dialog__matchup">
        <div class="missing-match-side">
          <div class="missing-match-side__avatars">
            <PersonAvatar
              v-for="player in sideAPlayers"
              :key="player.id"
              :name="player.name"
              :image="player.imageUrl"
              :size="42"
            />
          </div>

          <strong>{{ sideALabel || 'Side A' }}</strong>
          <small>{{ isDoubles ? 'Team A' : 'Player' }}</small>
        </div>

        <span class="missing-match-dialog__vs">vs</span>

        <div class="missing-match-side missing-match-side--empty">
          <div
            v-if="sideBPlayers.length"
            class="missing-match-side__avatars"
          >
            <PersonAvatar
              v-for="player in sideBPlayers"
              :key="player.id"
              :name="player.name"
              :image="player.imageUrl"
              :size="42"
            />
          </div>

          <span
            v-else
            class="missing-match-side__placeholder"
            aria-hidden="true"
          >
            ?
          </span>

          <strong>{{ sideBLabel || 'Choose opponent' }}</strong>
          <small>{{ isDoubles ? 'Team B' : 'Opponent' }}</small>
        </div>
      </section>

      <section class="missing-match-dialog__people">
        <div
          v-if="isDoubles"
          class="missing-match-dialog__chosen"
        >
          <button
            type="button"
            :class="{ complete: teammate }"
            @click="clearSlot('teammate')"
          >
            <span>Teammate</span>
            <strong>{{ teammate?.name || 'Choose' }}</strong>
          </button>

          <button
            type="button"
            :class="{ complete: opponentOne }"
            @click="clearSlot('opponent')"
          >
            <span>Opponent 1</span>
            <strong>{{ opponentOne?.name || 'Choose' }}</strong>
          </button>

          <button
            type="button"
            :class="{ complete: opponentTwo }"
            @click="clearSlot('opponent-two')"
          >
            <span>Opponent 2</span>
            <strong>{{ opponentTwo?.name || 'Choose' }}</strong>
          </button>
        </div>

        <div
          v-else-if="opponentOne"
          class="missing-match-dialog__selected-opponent"
        >
          <PersonAvatar
            :name="opponentOne.name"
            :image="opponentOne.imageUrl"
            :size="34"
          />

          <span>
            <small>Opponent</small>
            <strong>{{ opponentOne.name }}</strong>
          </span>

          <button
            type="button"
            @click="clearSlot('opponent')"
          >
            Change
          </button>
        </div>

        <div
          v-if="
            (!isDoubles && !opponentOne) ||
            (isDoubles &&
              (!teammate || !opponentOne || !opponentTwo))
          "
          class="missing-match-search"
        >
          <label>
            <span>{{ roleTitle() }}</span>
            <input
              ref="searchInput"
              v-model="search"
              type="search"
              autocomplete="off"
              placeholder="Search name or email"
            />
          </label>

          <div class="missing-match-search__results">
            <button
              v-for="player in availableSearchPlayers"
              :key="player.id"
              type="button"
              @click="choosePlayer(player)"
            >
              <PersonAvatar
                :name="player.name"
                :image="player.imageUrl"
                :size="34"
              />

              <span>
                <strong>{{ player.name }}</strong>
                <small>
                  #{{ player.rank || player.ladderRank || '—' }}
                </small>
              </span>
            </button>

            <p v-if="!availableSearchPlayers.length">
              No player matches that search.
            </p>
          </div>
        </div>
      </section>

      <label class="missing-match-dialog__date">
        <span>Played</span>
        <input v-model="playedOn" type="date" />
      </label>

      <section class="missing-match-dialog__score">
        <header>
          <div>
            <strong>Score</strong>
            <span>Enter the games for each completed set.</span>
          </div>
        </header>

        <div class="missing-match-dialog__score-head">
          <span>Set</span>

          <span>
            <PersonAvatar
              v-if="anchorPlayer"
              :name="anchorPlayer.name"
              :image="anchorPlayer.imageUrl"
              :size="24"
            />
            {{ isDoubles ? 'Team A' : anchorPlayer?.name?.split(' ')[0] }}
          </span>

          <span>
            <PersonAvatar
              v-if="opponentOne"
              :name="opponentOne.name"
              :image="opponentOne.imageUrl"
              :size="24"
            />
            {{ isDoubles ? 'Team B' : opponentOne?.name?.split(' ')[0] || 'Opponent' }}
          </span>
        </div>

        <div
          v-for="(set, index) in sets"
          :key="index"
          class="missing-match-set"
        >
          <span>Set {{ index + 1 }}</span>

          <input
            v-model="set.sideA"
            type="number"
            inputmode="numeric"
            min="0"
            max="99"
            aria-label="Side A games"
          />

          <input
            v-model="set.sideB"
            type="number"
            inputmode="numeric"
            min="0"
            max="99"
            aria-label="Side B games"
          />

          <button
            v-if="sets.length > 1"
            type="button"
            aria-label="Remove set"
            @click="removeSet(index)"
          >
            ×
          </button>
        </div>

        <button
          v-if="sets.length < 5"
          class="missing-match-dialog__add-set"
          type="button"
          @click="addSet"
        >
          + Add set
        </button>
      </section>

      <section
        v-if="preview"
        class="missing-match-dialog__impact"
        :class="{ ready: preview.valid }"
        aria-live="polite"
      >
        <strong v-if="scoreState.winnerSide">
          {{
            scoreState.winnerSide === 'A'
              ? sideALabel
              : sideBLabel
          }}
          won
          {{ preview.score }}
        </strong>

        <span>{{ preview.message }}</span>
      </section>

      <footer>
        <button
          class="ref-button"
          type="button"
          :disabled="busy"
          @click="close"
        >
          Cancel
        </button>

        <button
          class="ref-button primary"
          type="submit"
          :disabled="!canRecord || busy"
        >
          {{ busy ? 'Recording…' : 'Record match' }}
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.missing-match-dialog {
  width: min(620px, 85vw);
  max-height: 90vh;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 26px 80px rgba(19, 34, 24, 0.2);
}

.missing-match-dialog::backdrop {
  background: rgba(18, 30, 22, 0.28);
}

.missing-match-dialog__inner {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.missing-match-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.missing-match-dialog__head h2,
.missing-match-dialog__head p {
  margin: 0;
}

.missing-match-dialog__head h2 {
  font-size: 16px;
  font-weight: 600;
}

.missing-match-dialog__head p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 10.5px;
}

.missing-match-dialog__close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: #f1f4f1;
  color: #66726a;
  font-size: 18px;
}

.missing-match-dialog__matchup {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: 12px;
  background: #f7faf7;
}

.missing-match-side {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 4px;
  text-align: center;
}

.missing-match-side__avatars {
  display: flex;
  align-items: center;
  justify-content: center;
}

.missing-match-side__avatars :deep(.person-avatar) + :deep(.person-avatar) {
  margin-left: -10px;
}

.missing-match-side strong {
  max-width: 100%;
  overflow: hidden;
  color: #465149;
  font-size: 10.8px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.missing-match-side small {
  color: #929b95;
  font-size: 8.8px;
}

.missing-match-side__placeholder {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px dashed #cfd8d1;
  border-radius: 50%;
  color: #9aa39d;
  font-size: 14px;
}

.missing-match-dialog__vs {
  color: #98a19b;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.missing-match-dialog__people {
  display: grid;
  gap: 12px;
}

.missing-match-dialog__chosen {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.missing-match-dialog__chosen button {
  display: grid;
  gap: 2px;
  min-height: 54px;
  padding: 9px 10px;
  border: 1px solid #e2e7e3;
  border-radius: 9px;
  background: #fff;
  text-align: left;
}

.missing-match-dialog__chosen button.complete {
  border-color: rgba(8, 173, 43, 0.22);
  background: #f7fcf8;
}

.missing-match-dialog__chosen span,
.missing-match-dialog__selected-opponent small {
  color: #929b95;
  font-size: 8.8px;
}

.missing-match-dialog__chosen strong,
.missing-match-dialog__selected-opponent strong {
  overflow: hidden;
  color: #4f5b53;
  font-size: 10.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.missing-match-dialog__selected-opponent {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e2e7e3;
  border-radius: 9px;
}

.missing-match-dialog__selected-opponent > span {
  display: grid;
  gap: 2px;
}

.missing-match-dialog__selected-opponent > button {
  min-height: 32px;
  border: 0;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 9.5px;
  font-weight: 600;
}

.missing-match-search label {
  display: grid;
  gap: 6px;
}

.missing-match-search label span,
.missing-match-dialog__date > span {
  color: #5f6b63;
  font-size: 10px;
  font-weight: 600;
}

.missing-match-search input,
.missing-match-dialog__date input {
  width: 100%;
  min-height: 44px;
  padding: 0 11px;
  border: 1px solid #dfe5e0;
  border-radius: 9px;
  color: #465149;
  font-size: 16px;
}

.missing-match-search__results {
  display: grid;
  max-height: 190px;
  margin-top: 7px;
  overflow-y: auto;
  border: 1px solid #e5e9e6;
  border-radius: 9px;
}

.missing-match-search__results button {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 0;
  border-top: 1px solid #eef1ee;
  background: #fff;
  text-align: left;
}

.missing-match-search__results button:first-child {
  border-top: 0;
}

.missing-match-search__results button:hover {
  background: #f8faf8;
}

.missing-match-search__results button > span {
  display: grid;
  gap: 2px;
}

.missing-match-search__results strong {
  font-size: 10.5px;
  font-weight: 600;
}

.missing-match-search__results small {
  color: #909a93;
  font-size: 9px;
}

.missing-match-search__results p {
  margin: 0;
  padding: 13px;
  color: #8b958e;
  font-size: 10px;
}

.missing-match-dialog__date {
  display: grid;
  gap: 6px;
}

.missing-match-dialog__score {
  display: grid;
  gap: 9px;
}

.missing-match-dialog__score > header strong {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
}

.missing-match-dialog__score > header span {
  display: block;
  margin-top: 2px;
  color: #8b958e;
  font-size: 9.5px;
}

.missing-match-dialog__score-head,
.missing-match-set {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
}

.missing-match-dialog__score-head {
  color: #89938c;
  font-size: 8.8px;
}

.missing-match-dialog__score-head > span:nth-child(2),
.missing-match-dialog__score-head > span:nth-child(3) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.missing-match-set > span {
  color: #7c8780;
  font-size: 9.5px;
  font-weight: 600;
}

.missing-match-set input {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 0 8px;
  border: 1px solid #dfe5e0;
  border-radius: 8px;
  color: #39463d;
  font-size: 16px;
  text-align: center;
}

.missing-match-set button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: #f2f4f2;
  color: #7d8780;
}

.missing-match-dialog__add-set {
  width: fit-content;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 9.8px;
  font-weight: 600;
}

.missing-match-dialog__impact {
  display: grid;
  gap: 3px;
  padding: 12px;
  border-radius: 10px;
  background: #f5f8f5;
}

.missing-match-dialog__impact.ready {
  background: #f3faf4;
}

.missing-match-dialog__impact strong {
  color: #465149;
  font-size: 10.8px;
  font-weight: 600;
}

.missing-match-dialog__impact span {
  color: #77827a;
  font-size: 9.8px;
  line-height: 1.45;
}

.missing-match-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

@media (max-width: 620px) {
  .missing-match-dialog {
    width: 85vw;
  }

  .missing-match-dialog__inner {
    padding: 17px;
  }

  .missing-match-dialog__chosen {
    grid-template-columns: 1fr;
  }

  .missing-match-dialog__matchup {
    gap: 8px;
    padding: 12px 8px;
  }

  .missing-match-dialog__score-head,
  .missing-match-set {
    grid-template-columns: 42px minmax(0, 1fr) minmax(0, 1fr) 24px;
    gap: 6px;
  }

  .missing-match-dialog footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .missing-match-dialog footer .ref-button {
    width: 100%;
  }
}
</style>

