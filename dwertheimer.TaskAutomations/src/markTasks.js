// @flow
import { showMessageYesNo, chooseOption } from '../../helpers/userInput'

type Direction = 'open' | 'done' | null

async function setTasks(dir) {
  const paragraphs = Editor.paragraphs
  console.log(`setTasks: ${String(paragraphs.length || 'zero')} paragraphs`)
  console.log(`setTasks; setting to: ${dir || 'null'}`)
  let find, setVal
  if (dir === 'open') {
    find = 'done'
    setVal = 'open'
  } else {
    // dir === 'done'
    find = 'open'
    setVal = 'done'
  }
  paragraphs.forEach((para, i) => {
    console.log(
      `${i}: ${para.type} ${para.content} ${
        para.type === find ? `>> SETTING TO: ${setVal}` : ''
      }`,
    )
    if (para.type === find) para.type = setVal
    Editor.updateParagraph(para)
  })
}

export default async function markTasks(
  mark: Direction,
  withConfirmation: boolean = true,
) {
  console.log(`Starting markTasks(markDone=${mark || 'null'})`)
  //   modifyExistingParagraphs()
  //   return
  let dir = null
  if (!mark) {
    dir = await chooseOption(
      `Mark all tasks in note as:`,
      [
        { label: 'Open', value: 'open' },
        { label: 'Completed', value: 'done' },
        { label: 'Cancel', value: null },
      ],
      'Cancel',
    )
  }
  if (dir === 'Cancel') {
    console.log(`User chose Cancel`)
    return
  } else {
    const message = `Confirm: Mark ALL ${
      dir === 'open' ? 'Completed' : 'Open'
    } tasks as ${dir === 'open' ? 'Open' : 'Completed'}?`
    if (withConfirmation) {
      const res = await showMessageYesNo(message)
      console.log(`User said: ${res}`)
      if (res === 'No') return
    }
  }
  await setTasks(dir)
}
