// @flow
import { chooseOption, showMessage } from '../../helpers/userInput'
import {
  getFavoriteDefault,
  getFavoritedTitle,
  filterForFaves,
  getFaveOptionsArray,
  hasFavoriteIcon,
  removeFavoriteFromTitle,
} from './favorites'

function getConfig() {
  const config = { favoriteIcon: getFavoriteDefault(), position: 'prepend' }
  return config
}

export async function setFavorite(): Promise<void> {
  const config = getConfig()
  const note = Editor?.note
  if (note && note.title && note.type === 'Notes') {
    const isFavorite = hasFavoriteIcon(note.title, config.favoriteIcon)
    if (isFavorite) {
      await showMessage(`This file is already a Favorite! Use /unfave to remove.`)
      return
    } else {
      const newTitle = await getFavoritedTitle(note.title || '', config.position, config.favoriteIcon)
      const titlePara = note.paragraphs[0]
      titlePara.content = newTitle
      Editor.updateParagraph(titlePara)
    }
  } else {
    await showMessage('Please select a Project Note in Editor first.')
  }

  // this will be inserted at cursor position
  // Editor.insertTextAtCursor(message)
}

export async function openFavorite(): Promise<void> {
  const config = getConfig()
  const faveNotes = filterForFaves(DataStore.projectNotes, config)
  const faveOptions = getFaveOptionsArray(faveNotes)
  if (faveOptions.length === 0) {
    showMessage('No favorites found! Set a /fave document (⭐️)')
  } else {
    const filenameChosen = await chooseOption('Choose a Favorite (⭐️) Document:', faveOptions, '')
    if (filenameChosen) {
      await Editor.openNoteByFilename(filenameChosen)
    }
  }
}

export async function removeFavorite(): Promise<void> {
  const config = getConfig()

  const note = Editor?.note
  if (note && note.title && note.type === 'Notes') {
    const isFavorite = hasFavoriteIcon(note.title, config.favoriteIcon)
    if (isFavorite && note.title) {
      // remove the favorite icon
      const newTitle = removeFavoriteFromTitle(note.title, config.favoriteIcon)
      const titlePara = note.paragraphs[0]
      titlePara.content = newTitle
      Editor.updateParagraph(titlePara)
    } else {
      await showMessage(`This file is not a Favorite! Use /fave to make it one.`)
    }
  } else {
    await showMessage('Please select a Project Note in Editor first.')
  }
}
