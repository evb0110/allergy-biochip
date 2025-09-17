<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { processFromData, toCSV, suggestOutputFilename, getLayout } from './lib/allergenProcessor'

const csvText = ref('')
const error = ref('')
const processing = ref(false)
const processed = ref<null | ReturnType<typeof processFromData>>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pasteCatcher = ref<HTMLTextAreaElement | null>(null)
const isApplePlatform = ref(false)
const pasteComboLabel = computed(() => (isApplePlatform.value ? '⌘' : 'Ctrl') + '+V')

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
const layout = getLayout()
const originalBuffer = ref<ArrayBuffer | null>(null)
// removed advanced settings controls
const showSource = ref(true)
const cellMap = computed(() => {
  const m = new Map<string, string>()
  layout.forEach(a => {
    a.rows.forEach(r => {
      m.set(`${r},${a.column - 1}`,' '+a.code)
    })
  })
  for (let r = 4; r < 8; r++) m.set(`${r},11`, ' BG')
  return m
})
function cellCode(r: number, c: number) {
  return cellMap.value.get(`${r},${c}`) || ''
}

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
  const lines = text.replace(/\u0000/g,'').split(/\r?\n/).filter(l => l.trim().length > 0)
  let startIdx = detectDataStart(lines)
  const rawPreamble = startIdx > 0 ? lines.slice(0, startIdx).join(' ') : ''
  preamble.value = rawPreamble.replace(/;+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const dataLines = lines.slice(startIdx)
  const rows = dataLines.map(l => l.split(';'))
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
  } catch (_) {}

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

function downloadBlob(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function saveToFolder(csv: string, filename: string) {
  try {
    if ('showDirectoryPicker' in window) {
      const dirHandle = await (window as any).showDirectoryPicker()
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write('\uFEFF' + csv)
      await writable.close()
      return
    }
  } catch (e) {}
  downloadBlob(csv, filename)
}

async function exportCSV() {
  if (!processed.value) return
  const csv = toCSV(processed.value.results)
  const name = suggestOutputFilename()
  await saveToFolder(csv, name)
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
  } catch (_) {}
  error.value = 'Clipboard does not contain CSV text or file. Try Drop or Choose file.'
}

function countReplacementChars(s: string) {
  let c = 0
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) c++
  return c
}
function decodeCSVFromBuffer(buf: ArrayBuffer, forced: 'auto' | 'utf-8' | 'windows-1251' = 'auto') {
  try {
    if (forced !== 'auto') return new TextDecoder(forced).decode(buf)
    const utf8 = new TextDecoder('utf-8').decode(buf)
    const cp1251 = new TextDecoder('windows-1251').decode(buf)
    const badUtf = countReplacementChars(utf8)
    const bad1251 = countReplacementChars(cp1251)
    if (bad1251 < badUtf) return cp1251
    return utf8
  } catch {
    try { return new TextDecoder('utf-8').decode(buf) } catch { return '' }
  }
}

function isNumericToken(t: string) {
  const cleaned = t.replace(',', '.').trim()
  if (!cleaned) return false
  const n = parseFloat(cleaned)
  return Number.isFinite(n)
}
function detectDataStart(lines: string[]) {
  const minCols = 12
  const needRows = 8
  for (let i = 0; i < lines.length; i++) {
    let ok = true
    for (let r = 0; r < needRows; r++) {
      const line = lines[i + r]
      if (!line) { ok = false; break }
      const tokens = line.split(';')
      const numeric = tokens.filter(isNumericToken).length
      if (tokens.length < minCols || numeric < Math.floor(tokens.length * 0.6)) { ok = false; break }
    }
    if (ok) return i
  }
  return 0
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
      <div class="dropzone" @dragover="onDragOver" @drop="onDrop">
        <div class="dropzone-inner">
          <strong>Drop CSV</strong>
          <span>or</span>
          <button class="btn" @click="fileInput && fileInput.click()">Choose file</button>
          <button class="btn ghost" @click="pasteFromClipboard">Paste from clipboard</button>
          <input ref="fileInput" type="file" accept=".csv,text/csv" class="hidden" @change="(e:any)=>{ if(e.target.files?.[0]) onFileSelected(e.target.files[0]) }" />
          <div class="hint">
            <span class="hint-title">Tip:</span>
            <span class="kbd">{{ isApplePlatform ? '⌘' : 'Ctrl' }}</span>
            <span class="plus">+</span>
            <span class="kbd">V</span>
            <span class="hint-text">to paste CSV</span>
          </div>
          <textarea ref="pasteCatcher" class="visually-hidden" aria-hidden="true" @paste="onInputPaste"></textarea>
        </div>
      </div>
      <div class="actions">
        <button v-if="canClear" class="btn ghost" @click="resetAll">Clear source and results</button>
        <button v-if="hasTableData" class="btn" @click="isEditable = !isEditable">{{ isEditable ? 'Done editing' : 'Edit source table' }}</button>
        <button v-if="hasTableData" class="btn" @click="showMapping = !showMapping">{{ showMapping ? 'Hide mapping' : 'Show mapping' }}</button>
        <button v-if="hasResults && hasTableData" class="btn" @click="showSource = !showSource">{{ showSource ? 'Hide source table' : 'Show source table' }}</button>
        <button v-if="hasTableData" class="btn primary" :disabled="processing" @click="processCurrentTable">Process data</button>
        <button v-if="hasResults" class="btn primary" :disabled="processing" @click="exportCSV">Save results to file</button>
        
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-if="processing" class="processing">Processing…</section>

    <section v-if="hasTableData" class="source">
      <div v-if="preamble" class="preamble">{{ preamble }}</div>
      <div v-if="showSource" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th v-for="(h, hi) in headerLabels" :key="'h'+hi">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in dataRows" :key="'r'+ri">
              <td v-for="(cell, ci) in row" :key="'c'+ci" :class="{'bg-cell': showMapping && cellCode(ri,ci).trim()==='BG'}">
                <template v-if="isEditable">
                  <input v-model="tableData[ri][ci]" />
                </template>
                <template v-else>
                  {{ cell }}<span v-if="showMapping && cellCode(ri,ci)" class="map-badge">{{ cellCode(ri,ci) }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="hasResults" class="results">
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
            <tr v-for="row in processed!.results" :key="row.position">
              <td>{{ row.position }}</td>
              <td>{{ row.code }}</td>
              <td v-html="wrapAllergen(row.allergen)"></td>
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

    
  </div>
</template>

<style scoped>
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
.uploader, .source {
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
.hidden { display: none; }
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
  box-shadow: 0 0 0 0 rgba(79,70,229,0.0);
  transition: background .2s ease, transform .06s ease, box-shadow .2s ease, border-color .2s ease;
}
.btn:hover { background: var(--primary-200); }
.btn:active { transform: translateY(1px); }
.btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(79,70,229,0.25); }
.btn.primary { background: var(--primary); color: #fff; border-color: var(--primary); box-shadow: var(--shadow-md); }
.btn.primary:hover { background: var(--primary-600); }
.btn.ghost { background: transparent; color: #374151; border-color: var(--border); }
.actions { margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap; }
.error { color: #b91c1c; margin-top: 10px; }
.processing { margin: 18px 0; color: #111827; }
.results { margin-top: 18px; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px; box-shadow: var(--shadow-sm); }
.stat .label { color: #6b7280; font-size: 12px; }
.stat .value { font-size: 18px; font-weight: 600; }
.table-wrap { margin-top: 14px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); background: var(--surface); }
.table { width: 100%; border-collapse: collapse; font-size: 17px; background: #ffffff; font-variant-numeric: tabular-nums; }
.table th, .table td { padding: 12px 14px; border-bottom: 1px solid #eef2f6; text-align: left; vertical-align: top; }
.table thead th { position: sticky; top: 0; background: #eef2ff; font-weight: 600; color: #1f2937; z-index: 1; border-bottom: 1px solid var(--border); }
.table tbody tr { transition: background .15s ease; }
.table tbody tr:hover { background: #f1f5f9; }
.badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 14px; border: 1px solid #e5e7eb; font-weight: 600; letter-spacing: 0.01em; white-space: nowrap; }
.lvl-0 { background: #f3f4f6; color: #374151; }
.lvl-1 { background: #ecfeff; color: #0e7490; border-color: #a5f3fc; }
.lvl-2 { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.lvl-3 { background: #fef9c3; color: #854d0e; border-color: #fde68a; }
.lvl-4 { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
.lvl-5 { background: #ffe4e6; color: #9f1239; border-color: #fecdd3; }
.lvl-6 { background: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }
.footer { margin-top: 18px; color: #6b7280; font-size: 12px; }

.source .table input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 17px;
}
.preamble { margin-top: 10px; margin-bottom: 10px; color: #334155; font-size: 17px; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 8px; }
.map-badge { margin-left: 6px; font-size: 13px; padding: 2px 6px; border: 1px solid #e5e7eb; border-radius: 999px; color: #334155; background: #f1f5f9; }
.bg-cell { background: #fff7ed; }
.source .table td { white-space: nowrap; }
.map-badge { white-space: nowrap; display: inline-flex; align-items: center; }

/* Results table enhancements */
.results .table tbody tr:nth-child(even) { background: #fcfcfd; }
.results .table th:nth-child(3),
.results .table td:nth-child(3) { max-width: 300px; white-space: normal; overflow-wrap: anywhere; }
.results .table th:nth-child(3) { max-width: 300px; }
/* Right-align numeric columns for readability */
.results .table th:nth-child(4),
.results .table th:nth-child(5),
.results .table th:nth-child(6),
.results .table td:nth-child(4),
.results .table td:nth-child(5),
.results .table td:nth-child(6) { text-align: right; }

.btn { font-size: 17px; }
.kbd { font-size: 15px; }
.controls { margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
.adv-inline { display: inline-flex; gap: 16px; flex-wrap: wrap; align-items: center; }
.controls .row { display: inline-flex; gap: 8px; align-items: center; }
.controls select, .controls input[type="number"] { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 8px; }
/* advanced settings removed */

.hint { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; color: #64748b; }
.hint-title { font-weight: 600; color: #475569; }
.kbd { display: inline-flex; align-items: center; justify-content: center; padding: 2px 6px; border: 1px solid #cbd5e1; background: #f8fafc; border-bottom-width: 2px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #0f172a; }
.plus { color: #64748b; }
.hint-text { color: #475569; }
</style>
