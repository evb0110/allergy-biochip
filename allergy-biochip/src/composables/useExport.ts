export function downloadBlob(csv: string, filename: string) {
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

export async function saveCsvToFolder(csv: string, filename: string) {
  try {
    if ('showDirectoryPicker' in window) {
      const dirHandle = await (window as any).showDirectoryPicker()
      const fileHandle = await (dirHandle as any).getFileHandle(filename, { create: true })
      const writable = await (fileHandle as any).createWritable()
      await writable.write('\uFEFF' + csv)
      await writable.close()
      return
    }
  } catch (e) { }
  downloadBlob(csv, filename)
}


