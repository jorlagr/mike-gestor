import { describe, expect, it } from 'vitest'
import { calculateTotals, filterMovements, sortMovements, type Movement } from './accounting'

const movements: Movement[] = [
  { id: '1', company_id: 'mike', type: 'income', concept: 'Boda', date: '2025-03-10', amount: 1250, created_at: '' },
  { id: '2', company_id: 'mike', type: 'expense', concept: 'Equipo', date: '2025-03-12', amount: 250, created_at: '' },
  { id: '3', company_id: 'mike', type: 'income', concept: 'Evento', date: '2024-12-01', amount: 500, created_at: '' },
]

describe('accounting calculations', () => {
  it('calculates income, expenses, and balance', () => {
    expect(calculateTotals(movements)).toEqual({ income: 1750, expense: 250, balance: 1500 })
  })

  it('filters by concept, month, and year together', () => {
    expect(filterMovements(movements, { search: 'BODA', month: '03', year: '2025' })).toEqual([movements[0]])
    expect(filterMovements(movements, { search: '', month: '03', year: '' })).toHaveLength(2)
    expect(filterMovements(movements, { search: '', month: '', year: '2024' })).toEqual([movements[2]])
  })

  it('sorts by date in either direction without changing the source list', () => {
    expect(sortMovements(movements).map((movement) => movement.id)).toEqual(['2', '1', '3'])
    expect(sortMovements(movements, 'asc').map((movement) => movement.id)).toEqual(['3', '1', '2'])
    expect(movements.map((movement) => movement.id)).toEqual(['1', '2', '3'])
  })
})
