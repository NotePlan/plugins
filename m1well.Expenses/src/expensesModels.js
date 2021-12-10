// @flow

export type Config = {
  folderPath: string,
  categories: string[],
  shortcuts: string[],
  fixedExpenses: FixedExpense[],
}

export type ExpenseRow = {
  year: number,
  month: number,
  category: string,
  text?: string,
  amount: number,
}

export type FixedExpense = {
  category: string,
  text: string,
  amount: number,
  month: number,
  active: boolean,
}
