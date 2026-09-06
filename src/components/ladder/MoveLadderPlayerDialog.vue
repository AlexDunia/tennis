<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import PersonAvatar from '../PersonAvatar.vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  player: {
    type: Object,
    default: null,
  },
  roster: {
    type: Array,
    default: () => [],
  },
  preview: {
    type: Function,
    required: true,
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

const dialog = ref(null)
const input = ref(null)
const targetRank = ref('')

const currentRank = computed(
  () => Number(props.player?.rank || props.player?.ladderRank || 0),
)

const movePreview = computed(() => {
  const rank = Number(targetRank.value)

  if (
    !props.player ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > props.roster.length
  ) {
    return null
  }

  return props.preview(rank)
})

const occupant = computed(() => {
  const rank = Number(targetRank.value)
  if (!Number.isInteger(rank) || rank < 1) return null
  return props.roster.find(
    (player) =>
      Number(player.rank || player.ladderRank) === rank,
  )
})

const valid = computed(
  () =>
    Boolean(movePreview.value) &&
    movePreview.value.fromRank !== movePreview.value.toRank,
)

watch(
  () => props.open,
  async (open) => {
    if (open) {
      targetRank.value = ''
      dialog.value?.showModal()
      await nextTick()
      input.value?.focus()
      return
    }

    if (dialog.value?.open) dialog.value.close()
  },
)

function close() {
  if (props.busy) return
  emit('close')
}

function confirm() {
  if (!valid.value || props.busy) return
  emit('confirm', Number(targetRank.value))
}
</script>

<template>
  <dialog
    ref="dialog"
    class="move-player-dialog"
    @cancel.prevent="close"
    @close="emit('close')"
  >
    <form class="move-player-dialog__inner" @submit.prevent="confirm">
      <header>
        <div>
          <h2>Move {{ player?.name?.split(' ')[0] || 'player' }}</h2>
          <p>
            {{ player?.name || 'This player' }} is #{{ currentRank }} right now.
          </p>
        </div>

        <button
          class="move-player-dialog__close"
          type="button"
          aria-label="Close"
          :disabled="busy"
          @click="close"
        >
          ×
        </button>
      </header>

      <div class="move-player-dialog__current">
        <PersonAvatar
          v-if="player"
          :name="player.name"
          :image="player.imageUrl"
          :size="42"
        />
        <span>
          <strong>{{ player?.name }}</strong>
          <small>#{{ currentRank }} now</small>
        </span>
      </div>

      <label class="move-player-dialog__field">
        <span>Move to</span>

        <span class="move-player-dialog__number">
          <b>#</b>
          <input
            ref="input"
            v-model="targetRank"
            type="number"
            inputmode="numeric"
            min="1"
            :max="roster.length"
            :placeholder="`1–${roster.length}`"
          />
        </span>
      </label>

      <section
        v-if="movePreview"
        class="move-player-dialog__preview"
        aria-live="polite"
      >
        <div v-if="occupant && occupant.id !== player?.id">
          <PersonAvatar
            :name="occupant.name"
            :image="occupant.imageUrl"
            :size="34"
          />
          <span>
            <strong>#{{ targetRank }} is {{ occupant.name }}</strong>
            <small>
              Players between the two positions will shift one place.
            </small>
          </span>
        </div>

        <p>{{ movePreview.message }}</p>
      </section>

      <p
        v-else-if="targetRank"
        class="move-player-dialog__error"
        role="alert"
      >
        Choose a number from 1 to {{ roster.length }}.
      </p>

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
          :disabled="!valid || busy"
        >
          {{
            busy
              ? 'Moving…'
              : valid
                ? `Move to #${targetRank}`
                : 'Move player'
          }}
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.move-player-dialog {
  width: min(440px, 85vw);
  max-height: 88vh;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(20, 35, 25, 0.18);
}

.move-player-dialog::backdrop {
  background: rgba(18, 30, 22, 0.28);
}

.move-player-dialog__inner {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.move-player-dialog header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.move-player-dialog h2,
.move-player-dialog p {
  margin: 0;
}

.move-player-dialog h2 {
  font-size: 16px;
  font-weight: 600;
}

.move-player-dialog header p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 10.5px;
}

.move-player-dialog__close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f4f1;
  color: #657168;
  font-size: 18px;
}

.move-player-dialog__current,
.move-player-dialog__preview > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.move-player-dialog__current > span,
.move-player-dialog__preview > div > span {
  display: grid;
  gap: 2px;
}

.move-player-dialog__current strong,
.move-player-dialog__preview strong {
  font-size: 11.5px;
  font-weight: 600;
}

.move-player-dialog__current small,
.move-player-dialog__preview small {
  color: var(--color-muted);
  font-size: 9.8px;
}

.move-player-dialog__field {
  display: grid;
  gap: 6px;
}

.move-player-dialog__field > span:first-child {
  color: #5f6b63;
  font-size: 10px;
  font-weight: 600;
}

.move-player-dialog__number {
  position: relative;
  display: block;
}

.move-player-dialog__number b {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  color: #78837c;
  font-size: 12px;
}

.move-player-dialog__number input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px 0 28px;
  border: 1px solid #dfe5e0;
  border-radius: 9px;
  color: #354139;
  font-size: 16px;
}

.move-player-dialog__preview {
  display: grid;
  gap: 9px;
  padding: 12px;
  border-radius: 10px;
  background: #f7faf7;
}

.move-player-dialog__preview p {
  color: #6c786f;
  font-size: 10px;
  line-height: 1.45;
}

.move-player-dialog__error {
  color: #a44740;
  font-size: 10px;
}

.move-player-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding-top: 2px;
}

@media (max-width: 620px) {
  .move-player-dialog {
    width: 85vw;
  }

  .move-player-dialog footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .move-player-dialog footer .ref-button {
    width: 100%;
  }
}
</style>

