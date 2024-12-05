// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

export type Option<T> = $ReadOnly<{
  label: string,
  value: T,
}>

/**
 * Helper function to show a simple yes/no (could be OK/Cancel, etc.) dialog using CommandBar
 * @param {string} message - text to display to user
 * @param {Array<string>} - an array of the choices to give (default: ['Yes', 'No'])
 * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
 */
export async function confirm(message: string, choicesArray: Array<string> = ['Yes', 'No']): Promise<string> {
  const answer = await CommandBar.showOptions(choicesArray, message)
  return choicesArray[answer.index]
}

/**
 * Let user pick from a nicely-indented list of available folders (or return / for root)
 * @author @jgclark
 * @param {string} message - text to display to user
 * @returns {string} - returns the user's folder choice (or / for root)
 */
export async function chooseFolder(msg: string, includeArchive: boolean = false): Promise<string> {
  let folder: string
  const folders = DataStore.folders // excludes Trash and Archive
  if (includeArchive) {
    // $FlowFixMe
    folders.push('@Archive')
  }
  if (folders.length > 0) {
    // make a slightly fancy list with indented labels, different from plain values
    const folderOptionList: Array<any> = []
    for (const f of folders) {
      if (f !== '/') {
        const folderParts = f.split('/')
        for (let i = 0; i < folderParts.length - 1; i++) {
          folderParts[i] = '     '
        }
        folderParts[folderParts.length - 1] = `📁 ${folderParts[folderParts.length - 1]}`
        const folderLabel = folderParts.join('')
        folderOptionList.push({ label: folderLabel, value: f })
      } else {
        // deal with special case for root folder
        folderOptionList.push({ label: '📁 /', value: '/' })
      }
    }
    // const re = await CommandBar.showOptions(folders, msg)
    folder = await chooseOption(msg, folderOptionList, '/')
  } else {
    // no Folders so go to root
    folder = '/'
  }
  return folder
}

/**
 * ask user to choose from a set of options (from nmn.sweep)
 * @author @nmn
 * @param {string} message - text to display to user
 * @param {Array<T>} options - array of label:value options to present to the user
 * @param {TDefault} defaultValue - default label:value to use
 * @return {TDefault} - string that the user enters. Maybe be the empty string.
 */
export async function chooseOption<T, TDefault = T>(
  message: string,
  options: $ReadOnlyArray<Option<T>>,
  defaultValue: TDefault,
): Promise<T | TDefault> {
  const { index } = await CommandBar.showOptions(
    options.map((option) => option.label),
    message,
  )
  return options[index]?.value ?? defaultValue
}

/**
 * Get the Templates folder path, if it exists
 * @author @nmn
 * @return { ?string } - folder pathname
 */
export async function getTemplateFolder(): Promise<string> {
  const configData = await getConfiguration()
  return configData.templateFolderName
}

export async function getConfiguration(): Promise<any> {
  return await DataStore.settings
}
