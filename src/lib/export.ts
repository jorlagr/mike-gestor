import * as XLSX from 'xlsx'
import type { Movement } from './accounting'

function exportRows(movements: Movement[]) {
  return movements.map((movement) => ({
    Tipo: movement.type === 'income' ? 'INGRESO' : 'GASTO',
    Concepto: movement.concept,
    Fecha: movement.date.split('-').reverse().join('/'),
    'Importe (€)': Number(movement.amount),
  }))
}

export function downloadCsv(movements: Movement[], company: string) {
  const sheet = XLSX.utils.json_to_sheet(exportRows(movements))
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ';' })
  download(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }), `${slug(company)}-contabilidad.csv`)
}

export function downloadXlsx(movements: Movement[], company: string) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows(movements)), 'Movimientos')
  XLSX.writeFile(workbook, `${slug(company)}-contabilidad.xlsx`)
}

function slug(value: string) {
  return value.toLocaleLowerCase('es').replaceAll(' ', '-')
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}
