<script setup lang="ts">
const props = defineProps<{
  canClear: boolean
  hasTableData: boolean
  isEditable: boolean
  showMapping: boolean
  hasResults: boolean
  showSource: boolean
  processing: boolean
}>()

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'toggle-edit'): void
  (e: 'toggle-mapping'): void
  (e: 'toggle-source'): void
  (e: 'process'): void
  (e: 'export'): void
}>()
</script>

<template>
  <div class="actions">
    <button v-if="props.canClear" class="btn ghost" @click="emit('clear')">Clear source and results</button>
    <button v-if="props.hasTableData" class="btn" @click="emit('toggle-edit')">
      {{ props.isEditable ? 'Done editing' : 'Edit source table' }}
    </button>
    <button v-if="props.hasTableData" class="btn" @click="emit('toggle-mapping')">
      {{ props.showMapping ? 'Hide mapping' : 'Show mapping' }}
    </button>
    <button v-if="props.hasResults && props.hasTableData" class="btn" @click="emit('toggle-source')">
      {{ props.showSource ? 'Hide source table' : 'Show source table' }}
    </button>
    <button v-if="props.hasTableData" class="btn primary" :disabled="props.processing" @click="emit('process')">
      Process data
    </button>
    <button v-if="props.hasResults" class="btn primary" :disabled="props.processing" @click="emit('export')">
      Save results to file
    </button>
  </div>
</template>


