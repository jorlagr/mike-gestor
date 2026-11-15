export type MovementType = 'income' | 'expense'

export interface Movement {
  id: string
  company_id: string
  type: MovementType
  concept: string
  date: string
  amount: number
  created_at: string
}

export interface Totals {
  income: number
  expense: number
  balance: number
}

export function sortMovements(movements: Movement[], direction: 'asc' | 'desc' = 'desc'): Movement[] {
  return [...movements].sort((a, b) => {
    const dateOrder = direction === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    return dateOrder || b.created_at.localeCompare(a.created_at)
  })
}

export function calculateTotals(movements: Pick<Movement, 'type' | 'amount'>[]): Totals {
  const totals = movements.reduce(
    (result, movement) => {
      if (movement.type === 'income') result.income += Number(movement.amount)
      else result.expense += Number(movement.amount)
      return result
    },
    { income: 0, expense: 0, balance: 0 },
  )
  totals.balance = totals.income - totals.expense
  return totals
}

export function filterMovements(
  movements: Movement[],
  options: { search: string; month: string; year: string },
): Movement[] {
  const search = options.search.trim().toLocaleLowerCase('es')
  return movements.filter((movement) => {
    const matchesSearch = !search || movement.concept.toLocaleLowerCase('es').includes(search)
    const matchesMonth = !options.month || movement.date.slice(5, 7) === options.month
    const matchesYear = !options.year || movement.date.slice(0, 4) === options.year
    return matchesSearch && matchesMonth && matchesYear
  })
}
