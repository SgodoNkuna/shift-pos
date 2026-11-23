import { describe, test, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildXlsxBuffer, reportFileName } from './xlsx'
import { prototypeNight } from '../domain/fixtures'

describe('shift spreadsheet', () => {
  test('has the 7 sheets, the right totals and the Super Cheese difference', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await buildXlsxBuffer(prototypeNight(), { a: 'Employee A', b: 'Employee B', boss: 'Ta Vuyo' }))
    expect(wb.worksheets.map(w => w.name)).toEqual(['Summary', 'Items', 'Sales lines', 'Stock in', 'Stock out', 'Expenses', 'Flags'])
    const sum = wb.getWorksheet('Summary')!
    const find = (label: string) => { let v: unknown; sum.eachRow(r => { if (r.getCell(1).value === label) v = r.getCell(2).value }); return v }
    expect(find('Total sales (R)')).toBe(370)
    expect(find('Expected cash (R)')).toBe(350)
    expect(find('Opened by')).toBe('Employee A')
    const items = wb.getWorksheet('Items')!
    let diff: unknown
    items.eachRow(r => { if (r.getCell(2).value === 'Super Cheese') diff = r.getCell(11).value })
    expect(diff).toBe(-1)
    expect(wb.getWorksheet('Stock out')!.getRow(2).getCell(5).value).toBe('approved')
  })
  test('file name says shift kind and date', () => {
    expect(reportFileName(prototypeNight(), 'pdf')).toBe('Night-2026-11-28.pdf')
  })
})
