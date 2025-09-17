<script setup lang="ts">
const props = defineProps<{
  rows: Array<any>
  wrapAllergen: (name: string) => string
}>()
</script>

<template>
  <section class="results">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Code</th>
            <th>Allergen</th>
            <th>Mean</th>
            <th>Signal-bg</th>
            <th>Conc, МЕ/мл</th>
            <th>Level</th>
            <th>Class</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in props.rows" :key="row.position">
            <td>{{ row.position }}</td>
            <td>{{ row.code }}</td>
            <td v-html="props.wrapAllergen(row.allergen)"></td>
            <td>{{ row.processedMean.toFixed(2) }}</td>
            <td>{{ row.correctedSignal.toFixed(2) }}</td>
            <td>{{ row.concentration_IU_ml.toFixed(3) }}</td>
            <td>{{ row.level }}</td>
            <td>
              <span :class="['badge', `lvl-${row.level}`]">{{ row.classification }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>


