<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { isSafeHttpUrl, sanitizePlainText } from '../../utils/formSafety'

const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const props = defineProps({
  saving: {
    type: Boolean,
    default: false,
  },
  categories: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits({
  close: null,
  save: (payload) => payload && typeof payload === 'object',
})

const mode = ref('upload')
const selectedFile = ref(null)
const previewUrl = ref('')
const fileError = ref('')
const isDragging = ref(false)
const fileInput = ref(null)
const form = reactive({
  url: '',
  caption: '',
  categoryId: '',
})

const hasValidSource = computed(() =>
  mode.value === 'link' ? isSafeHttpUrl(form.url.trim()) : Boolean(selectedFile.value),
)
const canSave = computed(() => hasValidSource.value && sanitizePlainText(form.caption, 120))

function clearPreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
}

function setMode(nextMode) {
  mode.value = nextMode
  fileError.value = ''
}

function selectFile(file) {
  fileError.value = ''

  if (!file || !ACCEPTED_TYPES.has(file.type)) {
    fileError.value = 'Choose a JPG, PNG, WEBP, or GIF image.'
    return
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    fileError.value = 'Keep the image below 1.5 MB for this local prototype.'
    return
  }

  clearPreview()
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  if (!form.caption.trim()) {
    form.caption = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  }
}

function handleFileInput(event) {
  selectFile(event.target.files?.[0])
}

function handleDrop(event) {
  isDragging.value = false
  selectFile(event.dataTransfer?.files?.[0])
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read this image.'))
    reader.readAsDataURL(file)
  })
}

async function submit() {
  if (!canSave.value || props.saving) return

  const sourceUrl =
    mode.value === 'upload' ? await readFileAsDataUrl(selectedFile.value) : form.url.trim()

  emit('save', {
    url: sourceUrl,
    thumbnailUrl: sourceUrl,
    sourceType: mode.value,
    originalFileName: selectedFile.value?.name || '',
    mimeType: selectedFile.value?.type || '',
    fileSize: selectedFile.value?.size || 0,
    caption: sanitizePlainText(form.caption, 120),
    categoryId: form.categoryId || null,
  })
}

onUnmounted(clearPreview)
</script>

<template>
  <div class="tournament-image-add" role="dialog" aria-modal="true" aria-label="Add tournament image" @click.self="emit('close')">
    <form class="t-shell-card tournament-image-add__panel" @submit.prevent="submit">
      <header>
        <div>
          <span class="t-section-kicker">Tournament gallery</span>
          <h2>Add image</h2>
          <p>Upload a file directly or use an online image link.</p>
        </div>
        <button type="button" class="tournament-image-add__close" aria-label="Close add image dialog" @click="emit('close')">x</button>
      </header>

      <div class="tournament-image-add__modes" role="tablist" aria-label="Image source">
        <button type="button" :class="{ active: mode === 'upload' }" @click="setMode('upload')">Upload image</button>
        <button type="button" :class="{ active: mode === 'link' }" @click="setMode('link')">Use link</button>
      </div>

      <div v-if="mode === 'upload'" class="tournament-image-add__upload">
        <button
          type="button"
          class="tournament-image-add__dropzone"
          :class="{ 'tournament-image-add__dropzone--active': isDragging }"
          @click="fileInput?.click()"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <img v-if="previewUrl" :src="previewUrl" alt="Selected image preview" />
          <template v-else>
            <strong>Drag and drop an image here</strong>
            <span>or click to choose a file</span>
            <small>JPG, PNG, WEBP, or GIF · maximum 1.5 MB</small>
          </template>
        </button>
        <input ref="fileInput" class="tournament-image-add__file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="handleFileInput" />
        <p v-if="selectedFile" class="tournament-image-add__file-name">{{ selectedFile.name }}</p>
        <p v-if="fileError" class="tournament-image-add__error">{{ fileError }}</p>
      </div>

      <label v-else>
        Image URL
        <input v-model="form.url" type="url" placeholder="https://images.example.com/tournament.jpg" required />
      </label>

      <label>
        Caption
        <input v-model="form.caption" type="text" maxlength="120" placeholder="Finals day celebration" required />
      </label>
      <label>
        Tournament category
        <select v-model="form.categoryId">
          <option value="">All only</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <small>Optional. Categories come from this tournament and cannot be created here.</small>
      </label>

      <footer>
        <button type="button" class="t-button t-button--secondary" @click="emit('close')">Cancel</button>
        <button type="submit" class="t-button t-button--primary" :disabled="!canSave || saving">
          {{ saving ? 'Adding image...' : 'Add image' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.tournament-image-add {
  position: fixed;
  z-index: 900;
  inset: 0;
  overflow-y: auto;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(5, 12, 8, 0.72);
}

.tournament-image-add__panel {
  display: grid;
  gap: 16px;
  width: min(600px, 100%);
  max-height: calc(100vh - 36px);
  overflow-y: auto;
  padding: 20px;
}

.tournament-image-add header,
.tournament-image-add footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tournament-image-add h2,
.tournament-image-add p {
  margin: 0;
}

.tournament-image-add p,
.tournament-image-add small {
  color: var(--tournament-muted);
  font-size: 12px;
}

.tournament-image-add label {
  display: grid;
  gap: 6px;
  color: var(--tournament-ink);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.tournament-image-add input,
.tournament-image-add select {
  min-height: 44px;
  border: 1px solid var(--tournament-line);
  border-radius: var(--app-inner-radius);
  padding: 9px 11px;
}

.tournament-image-add__modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  border-radius: var(--app-inner-radius);
  padding: 4px;
  background: var(--tournament-shell);
}

.tournament-image-add__modes button {
  min-height: 38px;
  border: 0;
  border-radius: calc(var(--app-inner-radius) - 2px);
  background: transparent;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.tournament-image-add__modes button.active {
  background: #fff;
  color: var(--tournament-green-dark);
  box-shadow: 0 3px 10px rgba(15, 34, 24, 0.07);
}

.tournament-image-add__upload {
  display: grid;
  gap: 7px;
}

.tournament-image-add__dropzone {
  overflow: hidden;
  display: grid;
  place-items: center;
  gap: 5px;
  min-height: 190px;
  border: 1px dashed rgba(0, 181, 26, 0.34);
  border-radius: var(--app-card-radius);
  padding: 18px;
  background: rgba(0, 181, 26, 0.035);
  color: var(--tournament-ink);
  text-align: center;
}

.tournament-image-add__dropzone--active {
  border-color: var(--tournament-green);
  background: rgba(0, 181, 26, 0.08);
}

.tournament-image-add__dropzone img {
  width: 100%;
  max-height: 230px;
  object-fit: contain;
}

.tournament-image-add__dropzone span,
.tournament-image-add__dropzone small {
  color: var(--tournament-muted);
}

.tournament-image-add__file-input {
  display: none;
}

.tournament-image-add__file-name {
  font-weight: var(--font-weight-bold);
}

.tournament-image-add__error {
  color: var(--tournament-red) !important;
  font-weight: var(--font-weight-bold);
}

.tournament-image-add__close {
  display: inline-grid;
  place-items: center;
  flex: 0 0 38px;
  width: 38px;
  min-height: 38px;
  border: 1px solid var(--tournament-line);
  border-radius: 50%;
  background: #fff;
  color: var(--tournament-muted);
  font-size: 22px;
  line-height: 1;
}

.tournament-image-add footer {
  justify-content: flex-end;
}
</style>
