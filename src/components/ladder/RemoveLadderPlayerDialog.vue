<script setup>
import { ref, watch } from 'vue'
import PersonAvatar from '../PersonAvatar.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  player: { type: Object, default: null },
  ladderName: { type: String, default: 'this ladder' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'confirm'])
const dialog = ref(null)

watch(
  () => props.open,
  (open) => {
    if (open) dialog.value?.showModal()
    else if (dialog.value?.open) dialog.value.close()
  },
)

function close() {
  if (!props.busy) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="remove-ladder-player-dialog"
    @cancel.prevent="close"
    @close="emit('close')"
  >
    <section>
      <header>
        <PersonAvatar
          v-if="player"
          :name="player.name"
          :image="player.imageUrl"
          :size="42"
        />

        <div>
          <h2>Remove from this ladder?</h2>
          <p>
            {{ player?.name }} will leave {{ ladderName }}.
          </p>
        </div>
      </header>

      <p class="remove-ladder-player-dialog__note">
        They will still be a member of the club. Previous match and ladder activity stays available.
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
          class="ref-button danger"
          type="button"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? 'Removing…' : 'Remove from ladder' }}
        </button>
      </footer>
    </section>
  </dialog>
</template>

<style scoped>
.remove-ladder-player-dialog {
  width: min(420px, 85vw);
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(19, 34, 24, 0.18);
}

.remove-ladder-player-dialog::backdrop {
  background: rgba(18, 30, 22, 0.28);
}

.remove-ladder-player-dialog > section {
  display: grid;
  gap: 16px;
  padding: 20px;
}

.remove-ladder-player-dialog header {
  display: flex;
  align-items: center;
  gap: 11px;
}

.remove-ladder-player-dialog h2,
.remove-ladder-player-dialog p {
  margin: 0;
}

.remove-ladder-player-dialog h2 {
  font-size: 15px;
  font-weight: 600;
}

.remove-ladder-player-dialog header p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 10px;
}

.remove-ladder-player-dialog__note {
  color: #707c74;
  font-size: 10.5px;
  line-height: 1.5;
}

.remove-ladder-player-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.ref-button.danger {
  border-color: rgba(164, 71, 64, 0.18);
  background: #a44740;
  color: #fff;
}

@media (max-width: 620px) {
  .remove-ladder-player-dialog {
    width: 85vw;
  }

  .remove-ladder-player-dialog footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .remove-ladder-player-dialog footer .ref-button {
    width: 100%;
  }
}
</style>

