export function decodeCSVFromBuffer(buf: ArrayBuffer, forced: 'auto' | 'utf-8' | 'windows-1251' = 'auto') {
  const countReplacementChars = (s: string) => {
    let c = 0
    for (let i = 0; i < s.length; i++) if ((s as any).charCodeAt(i) === 0xfffd) c++
    return c
  }
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

export function parseCsvText(text: string): { preamble: string, rows: string[][] } {
  const isNumericToken = (t: string) => {
    const cleaned = t.replace(',', '.').trim()
    if (!cleaned) return false
    const n = parseFloat(cleaned)
    return Number.isFinite(n)
  }
  const detectDataStart = (lines: string[]) => {
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

  const lines = text.replace(/\u0000/g, '').split(/\r?\n/).filter(l => l.trim().length > 0)
  const startIdx = detectDataStart(lines)
  const rawPreamble = startIdx > 0 ? lines.slice(0, startIdx).join(' ') : ''
  const preamble = rawPreamble.replace(/;+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const dataLines = lines.slice(startIdx)
  const rows = dataLines.map(l => l.split(';'))
  return { preamble, rows }
}


