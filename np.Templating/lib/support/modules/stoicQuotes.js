/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { stoicQuotes } from './data/stoicQuotes'

/**
 * Get a random stoic quote
 * @returns {string} A random stoic quote with author attribution
 */
export function getStoicQuote() {
  const quote = stoicQuotes[Math.floor(Math.random() * stoicQuotes.length)]
  return `"${quote.text}" - ${quote.author}`
}
