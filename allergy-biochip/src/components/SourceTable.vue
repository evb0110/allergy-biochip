<script setup lang="ts">
const props = defineProps<{
  preamble: string
  showSource: boolean
  headerLabels: string[]
  dataRows: string[][]
  tableData: string[][]
  isEditable: boolean
  showMapping: boolean
  cellCode: (r: number, c: number) => string
}>()

const emit = defineEmits<{
  (e: 'update-cell', payload: { ri: number, ci: number, value: string }): void
}>()

function onCellInput(ri: number, ci: number, e: Event) {
  const target = e.target as HTMLInputElement
  emit('update-cell', { ri, ci, value: target.value })
}
</script>

<template>
  <section class="source">
    <div v-if="props.preamble" class="preamble">{{ props.preamble }}</div>
    <div v-if="props.showSource" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th v-for="(h, hi) in props.headerLabels" :key="'h' + hi">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in props.dataRows" :key="'r' + ri">
            <td v-for="(cell, ci) in row" :key="'c' + ci" :class="{ 'bg-cell': props.showMapping && props.cellCode(ri, ci).trim() === 'BG' }">
              <template v-if="props.isEditable">
                <input :value="props.tableData[ri][ci]" @input="onCellInput(ri, ci, $event)" />
              </template>
              <template v-else>
                {{ cell }}<span v-if="props.showMapping && props.cellCode(ri, ci)" class="map-badge">{{ props.cellCode(ri, ci) }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>


