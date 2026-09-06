<script setup>
import { computed, onUnmounted, ref } from 'vue'
import {
  CLUB_COVER_PRESETS,
  cropClubImage,
  validateClubImageFile,
} from '../../utils/club/clubMedia.js'

const props = defineProps({
  logoUrl: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  coverPreset: { type: String, default: 'court-green' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:logoUrl',
  'update:coverUrl',
  'update:coverPreset',
])

const logoInput = ref(null)
const coverInput = ref(null)
const cropDialog = ref(null)
const cropFile = ref(null)
const cropSource = ref('')
const cropKind = ref('cover')
const focalX = ref(50)
const focalY = ref(50)
const busy = ref(false)
const error = ref('')

const cropTitle = computed(() =>
  cropKind.value === 'logo' ? 'Crop club logo' : 'Crop cover photo',
)

const cropHelp = computed(() =>
  cropKind.value === 'logo'
    ? 'The square is exactly how the logo will be stored.'
    : 'The wide frame is exactly how the club banner will be stored.',
)

const cropObjectPosition = computed(
  () => `${focalX.value}% ${focalY.value}%`,
)

function pick(kind) {
  if (props.disabled || busy.value) return
  if (kind === 'logo') logoInput.value?.click()
  else coverInput.value?.click()
}

function clearCropSource() {
  if (cropSource.value) URL.revokeObjectURL(cropSource.value)
  cropSource.value = ''
  cropFile.value = null
}

function closeCrop() {
  cropDialog.value?.close()
  clearCropSource()
  error.value = ''
}

function chooseFile(event, kind) {
  const file = event.target.files?.[0]
  event.target.value = ''

  if (!file || props.disabled || busy.value) return

  error.value = ''

  try {
    validateClubImageFile(file)
  } catch (fileError) {
    error.value = fileError?.message || 'Choose another image.'
    return
  }

  clearCropSource()

  cropKind.value = kind
  cropFile.value = file
  cropSource.value = URL.createObjectURL(file)
  focalX.value = 50
  focalY.value = 50

  cropDialog.value?.showModal()
}

async function saveCrop() {
  if (!cropFile.value || busy.value) return

  busy.value = true
  error.value = ''

  try {
    const result = await cropClubImage(cropFile.value, {
      kind: cropKind.value,
      focalX: focalX.value / 100,
      focalY: focalY.value / 100,
    })

    if (cropKind.value === 'logo') emit('update:logoUrl', result)
    else emit('update:coverUrl', result)

    closeCrop()
  } catch (cropError) {
    error.value = cropError?.message || 'We could not prepare that image.'
  } finally {
    busy.value = false
  }
}

function choosePreset(id) {
  if (props.disabled || busy.value) return
  emit('update:coverPreset', id)
  emit('update:coverUrl', '')
}

onUnmounted(clearCropSource)
</script>

<template>
  <section class="club-media-editor">
    <div class="club-media-editor__section">
      <div class="club-media-editor__heading">
        <div>
          <strong>Club logo</strong>
          <span>Square · shown on the club profile and switcher.</span>
        </div>

        <div class="club-media-editor__actions">
          <button
            class="ref-button small"
            type="button"
            :disabled="disabled || busy"
            @click="pick('logo')"
          >
            {{ logoUrl ? 'Change logo' : 'Upload logo' }}
          </button>

          <button
            v-if="logoUrl"
            class="club-media-editor__remove"
            type="button"
            :disabled="disabled || busy"
            @click="emit('update:logoUrl', '')"
          >
            Remove
          </button>
        </div>
      </div>
    </div>

    <div class="club-media-editor__section">
      <div class="club-media-editor__heading">
        <div>
          <strong>Club cover</strong>
          <span>Wide banner · choose a photo or one of Gorra’s quiet presets.</span>
        </div>

        <div class="club-media-editor__actions">
          <button
            class="ref-button small"
            type="button"
            :disabled="disabled || busy"
            @click="pick('cover')"
          >
            {{ coverUrl ? 'Change photo' : 'Upload photo' }}
          </button>

          <button
            v-if="coverUrl"
            class="club-media-editor__remove"
            type="button"
            :disabled="disabled || busy"
            @click="emit('update:coverUrl', '')"
          >
            Use preset
          </button>
        </div>
      </div>

      <div class="club-media-editor__presets" aria-label="Club cover presets">
        <button
          v-for="preset in CLUB_COVER_PRESETS"
          :key="preset.id"
          class="club-media-editor__preset"
          :class="{ active: !coverUrl && coverPreset === preset.id }"
          type="button"
          :disabled="disabled || busy"
          :aria-label="`Use ${preset.label} cover`"
          :title="preset.label"
          :style="{ background: preset.background }"
          @click="choosePreset(preset.id)"
        >
          <span v-if="!coverUrl && coverPreset === preset.id">✓</span>
        </button>
      </div>
    </div>

    <p v-if="error" class="ref-inline-alert" role="alert">{{ error }}</p>

    <input
      ref="logoInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      @change="chooseFile($event, 'logo')"
    />

    <input
      ref="coverInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      @change="chooseFile($event, 'cover')"
    />

    <dialog
      ref="cropDialog"
      class="club-media-crop"
      @close="clearCropSource"
    >
      <div class="club-media-crop__inner">
        <header class="club-media-crop__head">
          <div>
            <h2>{{ cropTitle }}</h2>
            <p>{{ cropHelp }}</p>
          </div>

          <button
            class="club-media-crop__close"
            type="button"
            aria-label="Close"
            :disabled="busy"
            @click="closeCrop"
          >
            ×
          </button>
        </header>

        <div
          class="club-media-crop__preview"
          :class="`club-media-crop__preview--${cropKind}`"
        >
          <img
            v-if="cropSource"
            :src="cropSource"
            alt=""
            :style="{ objectPosition: cropObjectPosition }"
          />
        </div>

        <div class="club-media-crop__controls">
          <label>
            <span>Horizontal focus</span>
            <input v-model.number="focalX" type="range" min="0" max="100" />
          </label>

          <label>
            <span>Vertical focus</span>
            <input v-model.number="focalY" type="range" min="0" max="100" />
          </label>
        </div>

        <footer class="club-media-crop__actions">
          <button
            class="ref-button"
            type="button"
            :disabled="busy"
            @click="closeCrop"
          >
            Cancel
          </button>

          <button
            class="ref-button primary"
            type="button"
            :disabled="busy"
            @click="saveCrop"
          >
            {{ busy ? 'Preparing…' : 'Use this crop' }}
          </button>
        </footer>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.club-media-editor {
  display: grid;
  gap: 16px;
}

.club-media-editor__section {
  padding-top: 16px;
  border-top: 1px solid rgba(44, 58, 48, 0.07);
}

.club-media-editor__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.club-media-editor__heading > div:first-child {
  min-width: 0;
}

.club-media-editor__heading strong {
  display: block;
  color: var(--g-ink, #28332c);
  font-size: 11.5px;
  font-weight: 600;
}

.club-media-editor__heading span {
  display: block;
  margin-top: 3px;
  color: var(--g-muted, #7d8780);
  font-size: 10px;
  line-height: 1.45;
}

.club-media-editor__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.club-media-editor__remove {
  min-height: 35px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: #7b8580;
  font-size: 10px;
  font-weight: 600;
}

.club-media-editor__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 13px;
}

.club-media-editor__preset {
  display: grid;
  width: 52px;
  height: 38px;
  place-items: center;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 9px;
  color: #fff;
  box-shadow: 0 0 0 1px #dce3de;
}

.club-media-editor__preset.active {
  box-shadow:
    0 0 0 1px #a7c8ad,
    0 0 0 4px rgba(8, 173, 43, 0.08);
}

.club-media-editor__preset span {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #28633a;
  font-size: 10px;
  font-weight: 700;
}

.club-media-crop {
  width: min(620px, 88vw);
  max-height: 88vh;
  padding: 0;
  border: 1px solid var(--g-line, #e4e9e5);
  border-radius: 14px;
  background: #fff;
  color: var(--g-ink, #28332c);
  box-shadow: 0 24px 72px rgba(22, 36, 27, 0.18);
}

.club-media-crop::backdrop {
  background: rgba(17, 28, 20, 0.28);
}

.club-media-crop__inner {
  padding: 22px;
}

.club-media-crop__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.club-media-crop__head h2,
.club-media-crop__head p {
  margin: 0;
}

.club-media-crop__head h2 {
  font-size: 16px;
  font-weight: 600;
}

.club-media-crop__head p {
  margin-top: 4px;
  color: var(--g-muted, #7d8780);
  font-size: 10.5px;
  line-height: 1.45;
}

.club-media-crop__close {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: #f1f4f1;
  color: #637068;
  font-size: 18px;
}

.club-media-crop__preview {
  position: relative;
  width: 100%;
  margin-top: 18px;
  overflow: hidden;
  background: #edf1ee;
}

.club-media-crop__preview--cover {
  aspect-ratio: 16 / 5;
  border-radius: 11px;
}

.club-media-crop__preview--logo {
  width: min(280px, 72vw);
  aspect-ratio: 1;
  margin-inline: auto;
  border-radius: 22px;
}

.club-media-crop__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.club-media-crop__controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}

.club-media-crop__controls label {
  display: grid;
  gap: 7px;
}

.club-media-crop__controls span {
  color: #68746c;
  font-size: 10px;
  font-weight: 600;
}

.club-media-crop__controls input {
  width: 100%;
  accent-color: var(--g-green, #08ad2b);
}

.club-media-crop__actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 20px;
}

@media (max-width: 620px) {
  .club-media-editor__heading {
    display: grid;
    gap: 10px;
  }

  .club-media-editor__actions {
    justify-content: flex-start;
  }

  .club-media-crop {
    width: 88vw;
  }

  .club-media-crop__inner {
    padding: 18px;
  }

  .club-media-crop__controls {
    grid-template-columns: 1fr;
  }

  .club-media-crop__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .club-media-crop__actions .ref-button {
    width: 100%;
  }
}
</style>

