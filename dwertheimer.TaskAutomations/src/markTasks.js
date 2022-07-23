// @flow
import { showMessageYesNo, chooseOption } from '../../helpers/userInput'
import {logDebug} from '@helpers/dev'

type Direction = 'open' | 'done' | null

async function setTasks(dir) {
  const paragraphs = Editor.paragraphs
  logDebug(`setTasks: ${String(paragraphs.length || 'zero')} paragraphs`)
  logDebug(`setTasks; setting to: ${dir || 'null'}`)
  let find, setVal
  if (dir === 'open' || dir === 'openToday') {
    find = 'done'
    setVal = 'open'
  } else {
    // dir === 'done'
    find = 'open'
    setVal = 'done'
  }
  paragraphs.forEach((para, i) => {
    logDebug(`${i}: ${para.type} ${para.content} ${para.type === find ? `>> SETTING TO: ${setVal}` : ''}`)
    if (para.type === find) {
      para.type = setVal
    }
    if (dir === 'openToday' && para.type === 'open') {
      para.content = para.content.replace(/ *>today/gm, '').replace(/ *\@done\(.*\)/gm, '')
      para.content = para.content + ' >today'
    }
    Editor.updateParagraph(para)
  })
}

export default async function markTasks(mark: Direction, withConfirmation: boolean = true) {
  logDebug(`Starting markTasks(markDone=${mark || 'null'})`)
  //   modifyExistingParagraphs()
  //   return
  let dir = null
  if (!mark) {
    dir = await chooseOption(
      `Mark all tasks in note as:`,
      [
        { label: 'Open', value: 'open' },
        { label: 'Open + tagged ">today"', value: 'openToday' },
        { label: 'Completed', value: 'done' },
        { label: 'Cancel', value: null },
      ],
      'Cancel',
    )
  }
  if (dir === 'Cancel') {
    // logDebug(`User chose Cancel`)
    return
  } else {
    const isOpenType = dir === 'open' || dir === 'openToday'
    const message = `Confirm: Mark ALL ${isOpenType ? 'Completed' : 'Open'} tasks as ${isOpenType ? (dir === 'openToday' ? 'Open+>today' : 'Open') : 'Completed'}?`
    if (withConfirmation) {
      const res = await showMessageYesNo(message)
      // logDebug(`User said: ${res}`)
      if (res === 'No') return
    }
  }
  await setTasks(dir)
}
