<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { processFromData, toCSV, suggestOutputFilename } from './lib/allergenProcessor'
import Dropzone from './components/Dropzone.vue'
import ActionsBar from './components/ActionsBar.vue'
import SourceTable from './components/SourceTable.vue'
import ResultsTable from './components/ResultsTable.vue'
import { decodeCSVFromBuffer, parseCsvText } from './composables/useCsv'
import { saveCsvToFolder } from './composables/useExport'
import { useCellMap } from './composables/useCellMap'

const csvText = ref('')
const error = ref('')
const processing = ref(false)
const processed = ref<null | ReturnType<typeof processFromData>>(null)
const pasteCatcher = ref<HTMLTextAreaElement | null>(null)
const isApplePlatform = ref(false)

const hasResults = computed(() => !!processed.value)
const tableData = ref<string[][]>([])
const hasTableData = computed(() => tableData.value.length > 0)
const isEditable = ref(false)
const preamble = ref('')
const maxCols = computed(() => tableData.value.reduce((m, r) => Math.max(m, r.length), 0))
const headerLabels = computed(() => Array.from({ length: maxCols.value }, (_, i) => 'C' + (i + 1)))
const dataRows = computed(() => tableData.value)
const canClear = computed(() => hasTableData.value || hasResults.value)
const showMapping = ref(false)
const originalBuffer = ref<ArrayBuffer | null>(null)
// removed advanced settings controls
const showSource = ref(true)
const { cellCode } = useCellMap()

function wrapAllergen(name: string) {
  return (name || '').replace(/\//g, '/<wbr>')
}

function resetAll() {
  csvText.value = ''
  error.value = ''
  processed.value = null
  processing.value = false
  preamble.value = ''
  tableData.value = []
  isEditable.value = false
  originalBuffer.value = null
}

function parseToTable(text: string) {
  error.value = ''
  processed.value = null
  if (!text || text.trim().length === 0) {
    error.value = 'Empty input'
    tableData.value = []
    return
  }
  const { preamble: pre, rows } = parseCsvText(text)
  preamble.value = pre
  tableData.value = rows
}

function processCurrentTable() {
  error.value = ''
  processed.value = null
  const rows = tableData.value
  if (!rows.length) {
    error.value = 'CSV must contain header and 8 data rows (semicolon-delimited).'
    return
  }
  if (rows.length < 8) {
    error.value = 'CSV must contain header and 8 data rows (semicolon-delimited).'
    return
  }
  processing.value = true
  try {
    const eightRows = rows.slice(0, 8)
    const dataArray = eightRows.map(r => r.map(t => {
      const cleaned = t.replace(',', '.').trim()
      const num = parseFloat(cleaned)
      return Number.isFinite(num) ? num : NaN
    }))
    const res = processFromData(dataArray)
    processed.value = res
    isEditable.value = false
    showSource.value = false
  } catch (e: any) {
    error.value = e?.message || 'Failed to process CSV'
    processed.value = null
  } finally {
    processing.value = false
  }
}

async function onFileSelected(file: File) {
  try {
    const buf = await file.arrayBuffer()
    originalBuffer.value = buf
    const text = decodeCSVFromBuffer(buf)
    csvText.value = text
    parseToTable(text)
  } catch (e: any) {
    error.value = 'Unable to read file'
  }
}

async function onInputPaste(e: ClipboardEvent) {
  if (!e.clipboardData) return
  e.preventDefault()
  error.value = ''

  const fileList = e.clipboardData.files
  if (fileList && fileList.length) {
    const csvFile = Array.from(fileList).find(f => f.type === 'text/csv' || f.name?.toLowerCase().endsWith('.csv')) || fileList[0]
    if (csvFile) {
      await onFileSelected(csvFile)
      return
    }
  }

  const items = Array.from(e.clipboardData.items || [])
  for (const it of items) {
    if (it.kind === 'file') {
      const file = it.getAsFile()
      if (file) {
        await onFileSelected(file)
        return
      }
    }
  }

  const text = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text')
  if (text && text.includes(';')) {
    csvText.value = text
    parseToTable(text)
    return
  }

  try {
    if ('clipboard' in navigator && (navigator as any).clipboard.read) {
      const clipItems = await (navigator as any).clipboard.read()
      for (const ci of clipItems) {
        const types: string[] = (ci as any).types || []
        if (types.includes('text/csv')) {
          const blob = await ci.getType('text/csv')
          const buf = await blob.arrayBuffer()
          originalBuffer.value = buf
          const decoded = decodeCSVFromBuffer(buf)
          csvText.value = decoded
          parseToTable(decoded)
          return
        } else if (types.includes('text/plain')) {
          const blob = await ci.getType('text/plain')
          const buf = await blob.arrayBuffer()
          originalBuffer.value = buf
          const txt = decodeCSVFromBuffer(buf)
          if (txt && txt.includes(';')) {
            csvText.value = txt
            parseToTable(txt)
            return
          }
        }
      }
    }
  } catch (_) { }

  error.value = 'Clipboard does not contain CSV text or file'
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files && files.length > 0) onFileSelected(files[0])
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

// export handled by composable saveCsvToFolder

async function exportCSV() {
  if (!processed.value) return
  const csv = toCSV(processed.value.results)
  const name = suggestOutputFilename()
  await saveCsvToFolder(csv, name)
}

async function pasteFromClipboard() {
  error.value = ''
  try {
    if ('clipboard' in navigator && (navigator as any).clipboard.readText) {
      const text = await (navigator as any).clipboard.readText()
      if (text && text.includes(';')) {
        csvText.value = text
        parseToTable(text)
        return
      }
    }
    if ('clipboard' in navigator && (navigator as any).clipboard.read) {
      const items = await (navigator as any).clipboard.read()
      for (const item of items) {
        const types: string[] = (item as any).types || []
        if (types.includes('text/csv')) {
          const blob = await item.getType('text/csv')
          const buf = await blob.arrayBuffer()
          originalBuffer.value = buf
          const text = decodeCSVFromBuffer(buf)
          csvText.value = text
          parseToTable(text)
          return
        }
        if (types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          const buf = await blob.arrayBuffer()
          originalBuffer.value = buf
          const text = decodeCSVFromBuffer(buf)
          if (text && text.includes(';')) {
            csvText.value = text
            parseToTable(text)
            return
          }
        }
      }
    }
  } catch (_) { }
  error.value = 'Clipboard does not contain CSV text or file. Try Drop or Choose file.'
}

// advanced re-decode removed

let pasteListener: any
onMounted(() => {
  const ua = navigator.userAgent || ''
  const plat = navigator.platform || ''
  isApplePlatform.value = /Mac|iPhone|iPad|iPod/i.test(plat) || /Macintosh|iPhone|iPad|iPod/i.test(ua)
  pasteListener = (e: ClipboardEvent) => onInputPaste(e)
  window.addEventListener('paste', pasteListener as any)
  setTimeout(() => pasteCatcher.value?.focus(), 0)
})
onBeforeUnmount(() => {
  if (pasteListener) window.removeEventListener('paste', pasteListener as any)
})
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>Allergen Biochip Analyzer</h1>
    </header>

    <section class="uploader">
      <Dropzone
        :is-apple-platform="isApplePlatform"
        :on-drag-over="onDragOver"
        :on-drop="onDrop"
        :on-file-selected="onFileSelected"
        :on-paste-from-clipboard="pasteFromClipboard"
      />
      <ActionsBar
        :can-clear="canClear"
        :has-table-data="hasTableData"
        :is-editable="isEditable"
        :show-mapping="showMapping"
        :has-results="hasResults"
        :show-source="showSource"
        :processing="processing"
        @clear="resetAll"
        @toggle-edit="isEditable = !isEditable"
        @toggle-mapping="showMapping = !showMapping"
        @toggle-source="showSource = !showSource"
        @process="processCurrentTable"
        @export="exportCSV"
      />
      <p v-if="error" class="error">{{ error }}</p>
      <textarea ref="pasteCatcher" class="visually-hidden" aria-hidden="true" @paste="onInputPaste"></textarea>
    </section>

    <section v-if="processing" class="processing">Processing…</section>

    <SourceTable
      v-if="hasTableData"
      :preamble="preamble"
      :show-source="showSource"
      :header-labels="headerLabels"
      :data-rows="dataRows"
      :table-data="tableData"
      :is-editable="isEditable"
      :show-mapping="showMapping"
      :cell-code="cellCode"
      @update-cell="({ ri, ci, value }) => tableData[ri][ci] = value"
    />

    <ResultsTable
      v-if="hasResults"
      :rows="processed!.results"
      :wrap-allergen="wrapAllergen"
    />


  </div>
</template>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 20px 60px;
  color: var(--text);
  font-size: 19px;
}

.header h1 {
  margin: 0 0 16px 0;
  font-size: 30px;
  letter-spacing: -0.02em;
}

.header p {
  margin: 0 0 20px 0;
  color: var(--muted);
}

.uploader,
.source {
  background: var(--surface);
}

.uploader {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-sm);
}

.dropzone {
  position: relative;
  border: 2px dashed var(--primary-300);
  background: linear-gradient(180deg, #f8fafc, #f8fafc00), #f8fafc;
  border-radius: var(--radius-lg);
  padding: 28px;
  text-align: center;
}

.dropzone-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.hidden {
  display: none;
}

.visually-hidden {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--primary-100);
  color: #3730a3;
  border: 1px solid var(--primary-300);
  padding: 9px 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.0);
  transition: background .2s ease, transform .06s ease, box-shadow .2s ease, border-color .2s ease;
}

.btn:hover {
  background: var(--primary-200);
}

.btn:active {
  transform: translateY(1px);
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25);
}

.btn.primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}

.btn.primary:hover {
  background: var(--primary-600);
}

.btn.ghost {
  background: transparent;
  color: #374151;
  border-color: var(--border);
}

.actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.error {
  color: #b91c1c;
  margin-top: 10px;
}

.processing {
  margin: 18px 0;
  color: #111827;
}

.results {
  margin-top: 18px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px;
  box-shadow: var(--shadow-sm);
}

.stat .label {
  color: #6b7280;
  font-size: 12px;
}

.stat .value {
  font-size: 18px;
  font-weight: 600;
}

.table-wrap {
  margin-top: 14px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  background: var(--surface);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 17px;
  background: #ffffff;
  font-variant-numeric: tabular-nums;
}

.table th,
.table td {
  padding: 12px 14px;
  border-bottom: 1px solid #eef2f6;
  text-align: left;
  vertical-align: top;
}

.table thead th {
  position: sticky;
  top: 0;
  background: #eef2ff;
  font-weight: 600;
  color: #1f2937;
  z-index: 1;
  border-bottom: 1px solid var(--border);
}

.table tbody tr {
  transition: background .15s ease;
}

.table tbody tr:hover {
  background: #f1f5f9;
}

.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 14px;
  border: 1px solid #e5e7eb;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.lvl-0 {
  background: #f3f4f6;
  color: #374151;
}

.lvl-1 {
  background: #ecfeff;
  color: #0e7490;
  border-color: #a5f3fc;
}

.lvl-2 {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.lvl-3 {
  background: #fef9c3;
  color: #854d0e;
  border-color: #fde68a;
}

.lvl-4 {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fecaca;
}

.lvl-5 {
  background: #ffe4e6;
  color: #9f1239;
  border-color: #fecdd3;
}

.lvl-6 {
  background: #f3e8ff;
  color: #6b21a8;
  border-color: #e9d5ff;
}

.footer {
  margin-top: 18px;
  color: #6b7280;
  font-size: 12px;
}

.source .table input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 17px;
}

.preamble {
  margin-top: 10px;
  margin-bottom: 10px;
  color: #334155;
  font-size: 17px;
  border: 1px solid #e2e8f0;
  padding: 10px 12px;
  border-radius: 8px;
}

.map-badge {
  margin-left: 6px;
  font-size: 13px;
  padding: 2px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  color: #334155;
  background: #f1f5f9;
}

.bg-cell {
  background: #fff7ed;
}

.source .table td {
  white-space: nowrap;
}

.map-badge {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
}

/* Results table enhancements */
.results .table tbody tr:nth-child(even) {
  background: #fcfcfd;
}

/* Ensure hover wins over zebra background */
.results .table tbody tr:hover {
  background: #e7ecff;
}

.results .table tbody tr:nth-child(even):hover {
  background: #e7ecff;
}

.results .table th:nth-child(3),
.results .table td:nth-child(3) {
  max-width: 300px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.results .table th:nth-child(3) {
  max-width: 300px;
}

/* Right-align numeric columns for readability */
.results .table th:nth-child(4),
.results .table th:nth-child(5),
.results .table th:nth-child(6),
.results .table td:nth-child(4),
.results .table td:nth-child(5),
.results .table td:nth-child(6) {
  text-align: right;
}

.btn {
  font-size: 17px;
}

.kbd {
  font-size: 15px;
}

.controls {
  margin-top: 10px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.adv-inline {
  display: inline-flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.controls .row {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.controls select,
.controls input[type="number"] {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 8px;
}

/* advanced settings removed */

.hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  color: #64748b;
}

.hint-title {
  font-weight: 600;
  color: #475569;
}

.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-bottom-width: 2px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #0f172a;
}

.plus {
  color: #64748b;
}

.hint-text {
  color: #475569;
}
</style>
