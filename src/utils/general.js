'use strict'
const fetch = require('node-fetch')

if (!globalThis.fetch) {
  globalThis.fetch = fetch
}

module.exports = {
  quote: async (quoteParams = null, quoteConfig = null) => {
    const availableModes = [
      'today', // Zenquotes
      'random', // Zenquotes
      'author', // Zenquotes (premium account required)
      'readwise', // Readwise (account required)
    ]

    if (!quoteConfig) {
      return 'Invalid "quote configuration" in `Templates/_configuration`'
    }

    const pref_mode = quoteConfig?.mode && availableModes.includes(quoteConfig?.mode) ? quoteConfig?.mode : 'random'
    const pref_author = quoteConfig?.author // Available authors: https://premium.zenquotes.io/available-authors/
    const pref_zenquotes_key = quoteConfig?.zenquotesKey ?? '' // https://premium.zenquotes.io/
    const API = `https://zenquotes.io/api/`
    const URL =
      pref_mode === 'author' && pref_author && pref_zenquotes_key
        ? `${API}quotes/${pref_mode}/${pref_author}/${pref_zenquotes_key}`
        : `${API}${pref_mode}`

    console.log(URL)
    console.log(`Before API call: ${URL}`)
    const response = await fetch(URL)
    console.log(response.body)
    if (response != null) {
      //$FlowIgnore[incompatible-call]
      const data = JSON.parse(response)[0]
      const quoteLine = `${data.q} - *${data.a}*`
      console.log(`\t${quoteLine}`)
      return quoteLine
    } else {
      console.log(`\tError in Quote lookup to ${API}. Please check your _configuration note.`)
      return `Error in Quote lookup to ${API}. Please check your _configuration note.`
    }
  },

  weather: async (config = {}) => {},
}
