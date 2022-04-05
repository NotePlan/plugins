// @flow

import Fuse from 'fuse.js'
import { clo, log } from '../../../helpers/dev'

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

export function buildIndex(data, options): Fuse.FuseIndex | null {
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

export function searchIndex(data, pattern: string, config) {
  const { options, index } = config
  const fuse = new Fuse(data, options, index)
  return fuse.search(pattern)
}
