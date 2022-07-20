// @flow

/**
 * Modern case insensitive sorting function
 * More details at https://stackoverflow.com/a/49004987/3238281
 * @param {string} a
 * @param {string} b
 */
export function caseInsensitiveCompare(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

/**
 * Function to sort a list of object by an array of fields (of property names)
 * put a - in front of the field name to sort descending
 * @author @dwertheimer
 * @example const sortedHomes = sortListBy([{state:"CA",price:1000}],['state', '-price']); //the - in front of name is DESC
 * @param {Array<mixed>} list - items
 * @param {Array<string> | string} objectPropertySortOrder - field names to sort by -- either a single string or an array of strings/sort-order
 * @return the sorted task list
 */
export function sortListBy<T>(list: Array<T>, objectPropertySortOrder: Array<string> | string): Array<T> {
  const sortBy = typeof objectPropertySortOrder === 'string' ? [objectPropertySortOrder] : objectPropertySortOrder
  list.sort(fieldSorter(sortBy))
  return list
}

/**
 * Multi-level object property sorting callback function (for use in sort())
 * undefined values are treated as the lowest value (i.e. sorted to the bottom)
 * @author @dwertheimer
 * @example const sortedHomes = homes.sort(fieldSorter(['state', '-price'])); //the - in front of name is DESC
 * @param {Array<string>} field list - property array, e.g. ['date', 'title']
 * @returns {function} callback function for sort()
 */

export const fieldSorter =
  (fields: Array<string>): function =>
  (a, b) =>
    fields
      .map((_field) => {
        let field = _field
        let dir = 1
        const isDesc = field[0] === '-'
        if (isDesc) {
          dir = -1
          field = field.substring(1)
        }
        const aValue = firstValue(a[field])
        const bValue = firstValue(b[field])
        if (aValue === bValue) return 0
        if (aValue === undefined) return isDesc ? -dir : dir
        if (bValue === undefined) return isDesc ? dir : -dir
        return aValue > bValue ? dir : -dir
      })
      .reduce((p, n) => (p ? p : n), 0)

/**
 * Sometimes you you want to sort on the value of a field that is an array
 * So in that case, grab the first item in that array to sort
 * Helper function for fieldSorter fields. If the value is an array,
 * return the first value
 * if it's not an array, just return the value, and if it's a string, lowercase value.
 * @author @dwertheimer
 * @param {any} val
 * @returns
 */
export const firstValue = (val: any): string => {
  const retVal = Array.isArray(val) ? val[0] : val
  return typeof retVal === 'string' ? retVal.toLowerCase() : retVal
}
