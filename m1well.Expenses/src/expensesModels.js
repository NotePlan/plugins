// @flow

export type Config = {
  useNewSettings?: boolean, // could be remove some times after all use the new settings part
  folderPath: string,
  delimiter: string,
  dateFormat: string,
  amountFormat: string,
  columnOrder: Array<string>,
  categories: Array<string>,
  shortcutExpenses: ShortcutExpense[],
  fixedExpenses: FixedExpense[],
}

export type ShortcutExpense = {
  category: string,
  text: string,
  amount?: number,
}

export type ExpenseTrackingRow = {
  date: Date,
  category: string,
  text?: string,
  amount: number,
}

export type ExpenseAggregateRow = {
  year: number,
  month: string,
  category: string,
  amount: number,
}

export type FixedExpense = {
  category: string,
  text: string,
  amount: number,
  month: number,
  active: boolean,
}
