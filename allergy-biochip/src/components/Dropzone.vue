<script setup lang="ts">
import { ref } from 'vue'
const props = defineProps<{
  isApplePlatform: boolean
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
  onFileSelected: (file: File) => void
  onPasteFromClipboard: () => void
}>()

function handleChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) props.onFileSelected(file)
}

const fileInput = ref<HTMLInputElement | null>(null)
</script>

<template>
  <div class="dropzone" @dragover="props.onDragOver" @drop="props.onDrop">
    <div class="dropzone-inner">
      <strong>Drop CSV</strong>
      <span>or</span>
      <button class="btn" @click="fileInput && fileInput.click()">Choose file</button>
      <button class="btn ghost" @click="props.onPasteFromClipboard">Paste from clipboard</button>
      <input ref="fileInput" type="file" accept=".csv,text/csv" class="hidden" @change="handleChange" />
      <div class="hint">
        <span class="hint-title">Tip:</span>
        <span class="kbd">{{ props.isApplePlatform ? '⌘' : 'Ctrl' }}</span>
        <span class="plus">+</span>
        <span class="kbd">V</span>
        <span class="hint-text">to paste CSV</span>
      </div>
    </div>
  </div>
</template>


