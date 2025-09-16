const ALLERGEN_MAPPING = [
  { position: 1, code: 'D1', name: 'Клещевой аллерген домашней пыли / Dermatophagoides pteronyssinus', rows: [0, 1, 2, 3], column: 1 },
  { position: 2, code: 'E1', name: 'Эпителий кошки', rows: [0, 1, 2, 3], column: 2 },
  { position: 3, code: 'E5', name: 'Перхоть собаки', rows: [0, 1, 2, 3], column: 3 },
  { position: 4, code: 'M6', name: 'Alternaria alternata (Плесень)', rows: [0, 1, 2, 3], column: 4 },
  { position: 5, code: 'T2', name: 'Ольха серая / Alnus incana', rows: [0, 1, 2, 3], column: 5 },
  { position: 6, code: 'T3', name: 'Береза белая / Betula verrucosa', rows: [0, 1, 2, 3], column: 6 },
  { position: 7, code: 'T4', name: 'Лещина / орешник / Corylus avellana', rows: [0, 1, 2, 3], column: 7 },
  { position: 8, code: 'T14', name: 'Тополь / Populus deltoides', rows: [0, 1, 2, 3], column: 8 },
  { position: 9, code: 'W1', name: 'Амброзия полыннолистная / Ambrosia elatior', rows: [0, 1, 2, 3], column: 9 },
  { position: 10, code: 'W6', name: 'Полынь обыкновенная / Artemisia vulgaris', rows: [0, 1, 2, 3], column: 10 },
  { position: 11, code: 'W15', name: 'Лебеда / Atriplex lentiformis', rows: [0, 1, 2, 3], column: 11 },
  { position: 12, code: 'G3', name: 'Ежа сборная / Dactylis glomerata', rows: [4, 5, 6, 7], column: 1 },
  { position: 13, code: 'G4', name: 'Овсянница луговая / Festuca elatior', rows: [4, 5, 6, 7], column: 2 },
  { position: 14, code: 'G5', name: 'Райграс пастбищный / Lolium perenne', rows: [4, 5, 6, 7], column: 3 },
  { position: 15, code: 'G6', name: 'Тимофеевка луговая / Phleum pratense', rows: [4, 5, 6, 7], column: 4 },
  { position: 16, code: 'G8', name: 'Мятлик луговой / Poa pratensis', rows: [4, 5, 6, 7], column: 5 },
  { position: 17, code: 'G13', name: 'Бухарник шерстистый / Holcus lanatus', rows: [4, 5, 6, 7], column: 6 },
  { position: 18, code: 'Bet v1', name: 'Береза, рекомбинантный компонент Bet v1', rows: [4, 5, 6, 7], column: 7 },
  { position: 19, code: 'Bet v2', name: 'Береза, рекомбинантный компонент Bet v2', rows: [4, 5, 6, 7], column: 8 },
  { position: 20, code: 'Bet v4', name: 'Береза, рекомбинантный компонент Bet v4', rows: [4, 5, 6, 7], column: 9 }
]

export function classifyConcentration(concentration: number) {
  if (concentration <= 0.35) return { level: 0, classification: 'Клинически не значимый' }
  if (concentration <= 0.5) return { level: 1, classification: 'Очень низкий' }
  if (concentration <= 1.0) return { level: 2, classification: 'Низкий' }
  if (concentration <= 5.0) return { level: 3, classification: 'Средний' }
  if (concentration <= 25.0) return { level: 4, classification: 'Высокий' }
  if (concentration <= 75.0) return { level: 5, classification: 'Очень высокий' }
  return { level: 6, classification: 'Исключительно высокий' }
}

export function calculateMeanWithPercentageDeviations(values: number[]) {
  if (!values.length) return { mean: 0, usedValues: [] as number[], iterations: 0 }
  let D = 20
  const d = 10
  let iterations = 0
  while (D <= 100) {
    iterations++
    const initialMean = values.reduce((s, v) => s + v, 0) / values.length
    const thresholdRemoval = initialMean * (D / 100)
    const candidates: number[] = []
    const nonCandidates: number[] = []
    values.forEach(v => {
      if (Math.abs(v - initialMean) > thresholdRemoval) candidates.push(v)
      else nonCandidates.push(v)
    })
    const thresholdSave = initialMean * (d / 100)
    const rescued: number[] = []
    const toRemove: number[] = []
    candidates.forEach(c => {
      let rescuedFlag = false
      for (const n of nonCandidates) {
        if (Math.abs(c - n) < thresholdSave) {
          rescuedFlag = true
          break
        }
      }
      if (rescuedFlag) rescued.push(c)
      else toRemove.push(c)
    })
    const remaining = [...nonCandidates, ...rescued]
    if (remaining.length > 0) {
      const finalMean = remaining.reduce((s, v) => s + v, 0) / remaining.length
      return { mean: finalMean, usedValues: remaining, iterations }
    }
    D += 10
  }
  const fallbackMean = values.reduce((s, v) => s + v, 0) / values.length
  return { mean: fallbackMean, usedValues: values, iterations }
}

export function parseCSVData(csvContent: string) {
  const lines = csvContent.trim().split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) throw new Error('CSV must contain a header and at least 1 data row')
  const dataLines = lines.slice(1)
  const dataArray: number[][] = []
  for (let i = 0; i < Math.min(8, dataLines.length); i++) {
    const line = dataLines[i]
    const tokens = line.split(';')
    const values = tokens.map(t => {
      const cleaned = t.replace(',', '.').trim()
      const num = parseFloat(cleaned)
      return Number.isFinite(num) ? num : NaN
    })
    dataArray.push(values)
  }
  if (dataArray.length !== 8) throw new Error(`Expected 8 data rows, got ${dataArray.length}`)
  return dataArray
}

export function calculateBackground(dataArray: number[][]) {
  const values: number[] = []
  for (let row = 4; row < 8; row++) {
    const v = dataArray[row]?.[11]
    if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
  }
  if (!values.length) return { value: 0, values: [] as number[] }
  const res = calculateMeanWithPercentageDeviations(values)
  return { value: res.mean, values }
}

export function processAll(csvContent: string) {
  const dataArray = parseCSVData(csvContent)
  return processFromData(dataArray)
}

export function processFromData(dataArray: number[][]) {
  const background = calculateBackground(dataArray)
  const results = ALLERGEN_MAPPING.map(allergen => {
    const vals: number[] = []
    allergen.rows.forEach(r => {
      const v = dataArray[r]?.[allergen.column]
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v)
    })
    if (!vals.length) return null
    const r = calculateMeanWithPercentageDeviations(vals)
    const correctedSignal = Math.max(0, r.mean - background.value)
    const concentration = correctedSignal * (0.35 / 90)
    const cls = classifyConcentration(concentration)
    return {
      position: allergen.position,
      allergen: allergen.name,
      code: allergen.code,
      rawValues: vals,
      processedMean: r.mean,
      correctedSignal,
      concentration_IU_ml: concentration,
      units: 'МЕ/мл',
      level: cls.level,
      classification: cls.classification
    }
  }).filter(Boolean) as any[]
  const stats = {
    total: results.length,
    significant: results.filter(r => r.concentration_IU_ml > 0.35).length,
    high: results.filter(r => r.level >= 5).length,
    maxConcentration: Math.max(...results.map(r => r.concentration_IU_ml)),
    background: background.value
  }
  return { dataArray, background, results, stats }
}

export function toCSV(results: any[]) {
  const header = 'Position,Allergen,Code,Raw_Values,Processed_Mean,Corrected_Signal,Concentration_IU_ml,Units,Level,Classification\n'
  const rows = results.map(r => {
    const raw = r.rawValues.join(';')
    const processed = r.processedMean.toFixed(8)
    const corrected = r.correctedSignal.toFixed(8)
    const conc = r.concentration_IU_ml.toFixed(6)
    return `${r.position},"${r.allergen}",${r.code},"${raw}",${processed},${corrected},${conc},${r.units},${r.level},${r.classification}`
  })
  return header + rows.join('\n')
}

export function suggestOutputFilename() {
  const ts = new Date().toISOString().split('T')[0]
  return `allergen_results_${ts}.csv`
}

export function getLayout() {
  return ALLERGEN_MAPPING.map(a => ({ position: a.position, code: a.code, rows: a.rows, column: a.column }))
}

