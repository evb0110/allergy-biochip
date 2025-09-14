<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { processAll, toCSV, suggestOutputFilename } from './lib/allergenProcessor'

const csvText = ref('')
const error = ref('')
const processing = ref(false)
const processed = ref<null | ReturnType<typeof processAll>>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pasteCatcher = ref<HTMLTextAreaElement | null>(null)
const isApplePlatform = ref(false)
const pasteComboLabel = computed(() => (isApplePlatform.value ? '⌘' : 'Ctrl') + '+V')

const hasResults = computed(() => !!processed.value)

function resetAll() {
  csvText.value = ''
  error.value = ''
  processed.value = null
  processing.value = false
}

async function handleText(text: string) {
  error.value = ''
  if (!text || text.trim().length === 0) {
    error.value = 'Empty input'
    return
  }
  processing.value = true
  try {
    const res = processAll(text)
    processed.value = res
  } catch (e: any) {
    error.value = e?.message || 'Failed to process CSV'
    processed.value = null
  } finally {
    processing.value = false
  }
}

async function onFileSelected(file: File) {
  try {
    const text = await file.text()
    csvText.value = text
    await handleText(text)
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
    await handleText(text)
    return
  }

  try {
    if ('clipboard' in navigator && (navigator as any).clipboard.read) {
      const clipItems = await (navigator as any).clipboard.read()
      for (const ci of clipItems) {
        const types: string[] = (ci as any).types || []
        if (types.includes('text/csv')) {
          const blob = await ci.getType('text/csv')
          const textCsv = await blob.text()
          if (textCsv) {
            csvText.value = textCsv
            await handleText(textCsv)
            return
          }
        } else if (types.includes('text/plain')) {
          const blob = await ci.getType('text/plain')
          const txt = await blob.text()
          if (txt && txt.includes(';')) {
            csvText.value = txt
            await handleText(txt)
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
        await handleText(text)
        return
      }
    }
    if ('clipboard' in navigator && (navigator as any).clipboard.read) {
      const items = await (navigator as any).clipboard.read()
      for (const item of items) {
        const types: string[] = (item as any).types || []
        if (types.includes('text/csv')) {
          const blob = await item.getType('text/csv')
          const text = await blob.text()
          csvText.value = text
          await handleText(text)
          return
        }
        if (types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          const text = await blob.text()
          if (text && text.includes(';')) {
            csvText.value = text
            await handleText(text)
            return
          }
        }
      }
    }
  } catch (_) {}
  error.value = 'Clipboard does not contain CSV text or file. Try Drop or Choose file.'
}

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
      <p>Paste or drop the raw CSV. Processing runs automatically.</p>
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
        <button class="btn ghost" @click="resetAll">Clear</button>
        <button class="btn primary" :disabled="!hasResults || processing" @click="exportCSV">Save results</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-if="processing" class="processing">Processing…</section>

    <section v-if="hasResults" class="results">
      <div class="stats">
        <div class="stat">
          <div class="label">Background</div>
          <div class="value">{{ processed!.background.value.toFixed(2) }}</div>
        </div>
        <div class="stat">
          <div class="label">Total</div>
          <div class="value">{{ processed!.stats.total }}</div>
        </div>
        <div class="stat">
          <div class="label">Significant</div>
          <div class="value">{{ processed!.stats.significant }}</div>
        </div>
        <div class="stat">
          <div class="label">Max, МЕ/мл</div>
          <div class="value">{{ processed!.stats.maxConcentration.toFixed(2) }}</div>
        </div>
      </div>

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
              <td>{{ row.allergen }}</td>
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

    <footer class="footer">
      <span>CSV must contain header and 8 data rows (semicolon-delimited).</span>
    </footer>
  </div>
</template>

<style scoped>
.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 20px 40px;
  color: #0b1220;
}
.header h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
}
.header p {
  margin: 0 0 20px 0;
  color: #4b5563;
}
.uploader {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.dropzone {
  border: 2px dashed #c7d2fe;
  background: #f8fafc;
  border-radius: 12px;
  padding: 24px;
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
  background: #eef2ff;
  color: #3730a3;
  border: 1px solid #c7d2fe;
  padding: 8px 14px;
  border-radius: 10px;
  cursor: pointer;
}
.btn:hover { background: #e0e7ff; }
.btn.primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.btn.primary:hover { background: #4338ca; }
.btn.ghost { background: transparent; color: #374151; border-color: #e5e7eb; }
.actions { margin-top: 12px; display: flex; gap: 10px; }
.error { color: #b91c1c; margin-top: 10px; }
.processing { margin: 18px 0; color: #111827; }
.results { margin-top: 18px; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
.stat { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
.stat .label { color: #6b7280; font-size: 12px; }
.stat .value { font-size: 18px; font-weight: 600; }
.table-wrap { margin-top: 14px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 12px; }
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th, .table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: left; vertical-align: top; }
.table thead th { background: #f9fafb; font-weight: 600; color: #374151; }
.badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #e5e7eb; }
.lvl-0 { background: #f3f4f6; color: #374151; }
.lvl-1 { background: #ecfeff; color: #0e7490; border-color: #a5f3fc; }
.lvl-2 { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.lvl-3 { background: #fef9c3; color: #854d0e; border-color: #fde68a; }
.lvl-4 { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
.lvl-5 { background: #ffe4e6; color: #9f1239; border-color: #fecdd3; }
.lvl-6 { background: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }
.footer { margin-top: 18px; color: #6b7280; font-size: 12px; }

.hint { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; color: #64748b; }
.hint-title { font-weight: 600; color: #475569; }
.kbd { display: inline-flex; align-items: center; justify-content: center; padding: 2px 6px; border: 1px solid #cbd5e1; background: #f8fafc; border-bottom-width: 2px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #0f172a; }
.plus { color: #64748b; }
.hint-text { color: #475569; }
</style>
