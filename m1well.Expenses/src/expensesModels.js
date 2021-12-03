// @flow

export type Config = {
  folderPath: string,
  clusters: string[],
  shortcuts: string[],
  fixExpenses: FixExpenses[],
}

export type ExpenseRow = {
  year: number,
  month: number,
  cluster: string,
  text?: string,
  amount: number,
}

export type FixExpenses = {
  cluster: string,
  text: string,
  amount: number,
  month: number,
  active: boolean,
}
