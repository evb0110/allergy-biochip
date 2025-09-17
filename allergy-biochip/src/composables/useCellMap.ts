import { getLayout } from '../lib/allergenProcessor'

export function useCellMap() {
  const layout = getLayout()
  const map = new Map<string, string>()
  layout.forEach(a => {
    a.rows.forEach(r => {
      map.set(`${r},${a.column - 1}`, ' ' + a.code)
    })
  })
  for (let r = 4; r < 8; r++) map.set(`${r},11`, ' BG')

  const cellCode = (r: number, c: number) => map.get(`${r},${c}`) || ''
  return { cellCode }
}


