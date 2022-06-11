// @flow

import Fuse from 'fuse.js'
import { clo, log } from '../../../helpers/dev'
import T from 'lodash/fp/T'

export function searchTest() {
  const list = [
    {
      title: "Old Man's War",
      author: 'John Scalzi',
    },
    {
      title: 'The Lock Artist',
      author: 'Steve',
    },
    {
      title: 'Artist for Life',
      author: 'Michelangelo',
    },
  ]
  const options = {
    includeScore: true,
    useExtendedSearch: true,
    keys: ['title'],
  }

  const fuse = new Fuse(list, options)

  // Search for items that include "Man" and "Old",
  // OR end with "Artist"
  const result = fuse.search("'Man 'Old | Artist$")
  clo(result, 'searchTest result')
}

export function removeExtendedSearchTags(origText: string): string {
  // {s:search, r:replacement}
  const replacements = [{ d: 'leading apostrophe', s: /^'(.*)$/gm, r: '$1' }]
  let clean = origText
  replacements.forEach((x) => {
    clean = clean.replace(x.s, x.r)
  })
  return clean
}

export function buildIndex(data: $ReadOnlyArray<mixed>, options: { +keys?: $ReadOnlyArray<string>, ... }): Fuse.FuseIndex<mixed> | null {
  // Create the Fuse index
  if (options?.keys) {
    const index = Fuse.createIndex(options.keys, data)
    // log('buildIndex index document length:', `${index?.docs?.length || 'ERROR'}`)
    return index
  } else {
    log('fuse-helpers.buildIndex', 'options.keys is undefined')
    return null
  }
  //   clo(myIndex, `buildIndex: myIndex`)
}

/**
 * Search version with pre-existing index
 * @param {*} data
 * @param {*} pattern
 * @param {*} config
 * @returns
 */
export function searchIndex(data: $ReadOnlyArray<mixed>, pattern: string, config: { options?: { ... }, index?: number, ... }): Fuse.FuseResult<any> {
  const { options, index } = config
  const fuse = new Fuse(data, options, index)
  return fuse.search(pattern)
}

/**
 * Search version without index (index is created automatically)
 * @param {*} data
 * @param {*} pattern
 * @param {*} options
 * @returns
 */
export function search(data: Array<{ [string]: mixed }>, pattern: string, options: { ... }): Fuse.result<any> {
  const fuse = new Fuse(data, options)
  return fuse.search(pattern)
}

// {
//   value: 'A',
//   type: 'term',
//   position: {
//     start: 0,
//     end: 0,
//   },
// },
// {
//   value: 'B',
//   type: 'term',
//   position: {
//     start: 6,
//     end: 6,
//   },
// },
// {
//   value: 'AND',
//   type: 'operator',
//   operation: 'AND',
//   position: {
//     start: 2,
//     end: 4,
//   },
// },

type TEachRPN =
  | {
      value: string,
      type: 'term',
      position: { start: number, end: number },
    }
  | {
      value: string,
      type: 'operator',
      operation: 'AND' | 'OR',
      position: { start: number, end: number },
    }

/**
 * Create the specific Fuse search object from an RPN array from 'bqpjs
 * @param {*} rpn
 * @returns {object}
 */
export function createFuseSearchObjectFromRPN(_rpn: Array<TEachRPN>): any {
  let rpn = [..._rpn]
  let obje = []
  let arr = []
  if (rpn.length) {
    if (rpn[rpn.length - 1]?.type !== 'operator') {
      rpn.push({ type: 'operator', value: 'OR' })
    }
    for (const item of rpn) {
      if (item.type === 'operator') {
        const lastTwo = arr.slice(-2)
        arr = arr.slice(0, -2)
        const op = getFuseOperator(item.value)
        if (op && op[0] === '$') {
          arr.push({ [op]: lastTwo })
        } else {
          //TODO: handle non AND/OR operators (NOT and ! etc)
        }
      } else {
        arr.push({ content: item.value }) //Note need to read whether quoted and exact match it
      }
    }
  }
  if (arr.length === 1) return arr[0]
  const obj = populateObjectFromArray(arr)
  return obj
}

/**
 * Take in the array of nested search items from createFuseSearchObjectFromRPN and turn into an object
 * @param {*} array
 * @returns
 */
export function populateObjectFromArray(array: Array<any>): { [string]: Array<string> } {
  var output = {}
  if (array.length === 1) return array[0]
  array.forEach((item, index) => {
    if (!item) return
    if (Array.isArray(item)) {
      output[index] = populateObjectFromArray(item)
    } else {
      const keys = Object.keys(item)
      if (keys.length === 1) {
        output[keys[0]] = item[keys[0]]
      } else {
        output[index] = item
      }
    }
  })
  return output
}

export function getFuseOperator(label: string): string | null {
  let retVal = null
  switch (label) {
    case 'AND':
      retVal = '$and'
    case 'OR':
      retVal = '$or'
    default:
      break
  }
  return retVal
}
