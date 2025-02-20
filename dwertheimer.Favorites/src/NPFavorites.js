// @flow
import { chooseOption, showMessage } from '../../helpers/userInput'
import { favoriteNotes, getFaveOptionsArray, getFavoriteDefault, getFavoritedTitle, noteIsFavorite, removeFavoriteFromTitle, type FavoritesConfig } from './favorites'
import { setTitle } from '@helpers/note'
import { logDebug, clo, logError, JSP } from '@helpers/dev'
import { getFrontMatterAttributes, getFrontMatterNotes, updateFrontMatterVars } from '@helpers/NPFrontMatter'

export async function getConfig(): Promise<FavoritesConfig> {
  const settings = DataStore.settings
  const config = {
    favoriteIcon: getFavoriteDefault(),
    position: 'prepend',
    favoriteIdentifier: settings.favoriteIdentifier || 'Star or Frontmatter (either)',
    favoriteKey: settings.favoriteKey || 'favorite',
  }
  if (!settings.favoriteIdentifier) {
    config.favoriteIdentifier = 'Star or Frontmatter (either)'
  }
  // test favoriteKey according to: "description": "If you set the favorite notes identifer to any setting which includes frontmatter, this setting allows you to change the name of the frontmatter key used for the favorite field. Default is 'favorite' but you can change it to 'favourite' or 'fav' or whatever you want. Note: cannot include spaces, tabs, or special characters (e.g. #, @ etc.) in the key name."
  if (config.favoriteIdentifier.includes('Frontmatter')) {
    if (!config.favoriteKey || [' ', '\t', '#', '@'].some((char) => config.favoriteKey.includes(char))) {
      const originalKey = config.favoriteKey
      config.favoriteKey = 'favorite'
      DataStore.settings = config
      await showMessage(
        `Your Favorite key is set to "${originalKey}". The favorite key cannot include spaces, tabs, or special characters (e.g. #, @ etc.) in the key name. Resetting to default 'favorite'.`,
      )
    }
  }
  logDebug('NPFavorites', `Config: ${JSON.stringify(config)}`)
  return config
}

/**
 * Set the current note as a favorite based on the favoriteIdentifier setting
 * @returns {Promise<void>}
 */
export async function setFavorite(): Promise<void> {
  const config = await getConfig()
  const { favoriteKey } = config
  const note = Editor?.note
  if (note && note.title && note.type === 'Notes') {
    const isFavorite = noteIsFavorite(note, config)
    if (isFavorite) {
      await showMessage(`This file is already a Favorite! Use /unfave to remove.`)
      return
    } else {
      let newTitle = note.title
      if (config.favoriteIdentifier.includes('Star')) {
        newTitle = await getFavoritedTitle(note.title || '', config.position, config.favoriteIcon, config.favoriteIdentifier)
        logDebug('NPFavorites', `[${config.favoriteIdentifier}] Setting title to ${newTitle}`)
        setTitle(note, newTitle)
      }
      if (config.favoriteIdentifier.includes('Frontmatter')) {
        logDebug('NPFavorites', `[${config.favoriteIdentifier}] Setting frontmatter ${favoriteKey} to true`)
        const fm = getFrontMatterAttributes(note)
        if (typeof fm === 'object' && fm !== null) {
          fm[favoriteKey] = 'true'
          updateFrontMatterVars(note, fm)
        }
      }
    }
  } else {
    await showMessage('Please select a Project Note in Editor first.')
  }
}

export async function openFavorite(): Promise<void> {
  const config = await getConfig()
  const notesWithFM = getFrontMatterNotes() // not including template notes
  const notesWithStars = DataStore.projectNotes.filter((note) => note.title?.includes(config.favoriteIcon))
  const combinedNotes = [...notesWithFM, ...notesWithStars]
  const nonDuplicateNotes = combinedNotes.filter((note, index, self) => self.findIndex((t) => t.filename === note.filename) === index)
  const faveNotes = favoriteNotes(nonDuplicateNotes, config)

  const faveOptions = getFaveOptionsArray(faveNotes)
  if (faveOptions.length === 0) {
    showMessage(`No favorites found matching your setting which requires: "${config.favoriteIdentifier}"! Use the /fave document command to set a favorite.`)
  } else {
    const filenameChosen = await chooseOption('Choose a Favorite (⭐️) Document:', faveOptions, '')
    if (filenameChosen) {
      await Editor.openNoteByFilename(filenameChosen)
    }
  }
}

/**
 * Remove the favorite status from the current note based on the favoriteIdentifier setting
 * @returns {Promise<void>}
 */
export async function removeFavorite(): Promise<void> {
  try {
    const config = await getConfig()
    const { favoriteKey } = config
    const note = Editor.note
    logDebug('NPFavorites', `Removing favorite from note "${note?.title || ''}" ${note?.type || ''}`)
    if (note && note.title && note.type === 'Notes') {
      const isFavorite = noteIsFavorite(note, config)
      logDebug('NPFavorites', `Removing favorite from note "${note.title || ''}" ${isFavorite ? 'isFavorite' : 'is not a favorite'}`)
      if (isFavorite && note.title) {
        if (config.favoriteIdentifier.includes('Star')) {
          // remove the favorite icon
          const newTitle = removeFavoriteFromTitle(note.title || '', config.favoriteIcon, config.favoriteIdentifier)
          if (newTitle !== note.title) {
            setTitle(note, newTitle)
          }
        }
        if (config.favoriteIdentifier.includes('Frontmatter')) {
          const fm = { ...getFrontMatterAttributes(note) }
          if (typeof fm === 'object' && fm !== null && fm[favoriteKey]) {
            delete fm[favoriteKey]
            updateFrontMatterVars(note, fm, true)
          }
        }
      } else {
        await showMessage(`This file is not a Favorite! Use /fave to make it one.`)
      }
    } else {
      await showMessage('Please select a Project Note in Editor first.')
    }
  } catch (err) {
    logError('NPFavorites/removeFavorite()', JSP(err))
  }
}
