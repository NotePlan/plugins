// @flow

import { noteHasFrontMatter } from '@helpers/NPFrontMatter'
import { logDebug, timer } from '@helpers/dev'
export type FavoritesConfig = {
  favoriteIcon: string,
  position: 'prepend' | 'append',
  favoriteIdentifier: 'Star in title' | 'Frontmatter only' | 'Star and Frontmatter (both)' | 'Star or Frontmatter (either)',
  favoriteKey: string,
}

/**
 * Get the default favorite icon
 * @returns {string} The default favorite icon
 */
export const getFavoriteDefault = (): string => '⭐️'

/**
 * Filter notes to only include favorites based on the configuration
 * @param {Array<TNote>} notes - The notes to filter
 * @param {FavoritesConfig} config - The configuration for the favorites plugin
 * @returns {Array<TNote>} The filtered favorite notes
 */
export const favoriteNotes = (notes: $ReadOnlyArray<TNote>, config: FavoritesConfig): $ReadOnlyArray<TNote> => {
  const startTime = new Date()
  const filteredNotes = notes.filter((n) => noteIsFavorite(n, config))
  logDebug('favoriteNotes', `Reduced ${notes.length} notes to ${filteredNotes.length} favorites in ${timer(startTime)}`)
  return filteredNotes
}

/**
 * Get an array of favorite note options for selection
 * @param {Array<TNote>} notes - The notes to convert to options
 * @returns {Array<{ label: string, value: string }>} The array of options
 */
export const getFaveOptionsArray = (notes: $ReadOnlyArray<TNote>): $ReadOnlyArray<{ label: string, value: string }> =>
  notes
    .filter((n) => Boolean(n.title && n.filename))
    .map((n) => {
      // $FlowIgnore
      return { label: n.title, value: n.filename }
    })

/**
 * Check if a title contains the favorite icon
 * @param {string} title - The title to check
 * @param {string} icon - The favorite icon to look for
 * @returns {boolean} True if the title contains the icon, false otherwise
 */
export const titleHasFavoriteIcon = (title: string, icon: string): boolean => title.search(icon) !== -1

/**
 * Get a new title with the favorite icon added
 * @param {string} title - The original title
 * @param {string} position - The position to add the icon ('prepend' or 'append')
 * @param {string} icon - The favorite icon to add
 * @param {string} favoriteIdentifier - The favorite identifier setting
 * @returns {string} The new title with the favorite icon
 */
export const getFavoritedTitle = (title: string, position: string, icon: string, favoriteIdentifier: string): string => {
  return favoriteIdentifier.includes('Star') ? (position === 'prepend' ? `${icon} ${title}` : `${title} ${icon}`) : title
}

/**
 * Remove the favorite icon from a title
 * @param {string} title - The title to modify
 * @param {string} icon - The favorite icon to remove
 * @param {string} favoriteIdentifier - The favorite identifier setting
 * @returns {string} The title without the favorite icon
 */
export const removeFavoriteFromTitle = (title: string, icon: string, favoriteIdentifier: string): string => {
  return favoriteIdentifier.includes('Star') ? title.replace(icon, '').trim().replace('  ', ' ') : title
}
/**
 * Determine if a note is a favorite based on the favoriteIdentifier setting
 * @param {TNote} note - The note to check
 * @param {FavoritesConfig} config - The configuration for the favorites plugin
 * @returns {boolean} true if the note is a favorite, false otherwise
 */

export function noteIsFavorite(note: CoreNoteFields, config: FavoritesConfig): boolean {
  const { favoriteIcon, favoriteIdentifier, favoriteKey } = config
  let titleIsFavorite = false,
    fmIsFavorite = false
  if (favoriteIdentifier.includes('Star')) {
    if (titleHasFavoriteIcon(note?.title || '', favoriteIcon)) {
      titleIsFavorite = true
      if (favoriteIdentifier === 'Star in title') return true
      if (favoriteIdentifier === 'Star or Frontmatter (either)') return true
    }
    if (favoriteIdentifier === 'Star in title') return titleIsFavorite // if we are only looking for a star return early
  }
  if (favoriteIdentifier.includes('Frontmatter')) {
    // do a super quick check to see if it could be a frontmatter note
    const frontmatterAttributes = note.frontmatterAttributes || {}
    const mayBeFM = Object.keys(frontmatterAttributes).length > 0
    if (!mayBeFM && favoriteIdentifier === 'Frontmatter only') return false
    // if it is not a frontmatter note, and we are only looking for frontmatter, return false
    if (frontmatterAttributes.hasOwnProperty(favoriteKey) && frontmatterAttributes[favoriteKey] !== false && !/false|no/i.test(String(frontmatterAttributes[favoriteKey]))) {
      fmIsFavorite = true
    }
    if (favoriteIdentifier === 'Frontmatter only') return fmIsFavorite // if we are only looking for a frontmatter return early
  }
  if (favoriteIdentifier.includes('either')) {
    return titleIsFavorite || fmIsFavorite
  }
  if (favoriteIdentifier.includes('both')) {
    return titleIsFavorite && fmIsFavorite
  }

  return false
}
