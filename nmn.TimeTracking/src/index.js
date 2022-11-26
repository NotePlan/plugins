// @flow

import { keys } from 'lodash-es'
import { getCodeBlocks } from '../../helpers/codeBlocks'

type TData = $ReadOnly<{
  [string]: $ReadOnlyArray<
    $ReadOnly<{
      type: 'START' | 'STOP',
      time: Date,
    }>,
  >,
}>

export function objectKey<Obj: { ... }>(object: Obj): Array<$Keys<Obj>> {
  return keys(object)
}

function getOrMadeDataFile() {
  let dataFile = DataStore.projectNotes.find((n) => n.filename === '_time_tracking/data.md' || n.filename === '_time_tracking/data.txt')
  if (dataFile == null) {
    DataStore.newNote('data', '_time_tracking')
    dataFile = DataStore.projectNotes.find((n) => n.filename === '_time_tracking/data.md' || n.filename === '_time_tracking/data.txt')
  }
  return dataFile
}

// eslint-disable-next-line no-unused-vars
function getConfig(): ?TData {
  const configFile = getOrMadeDataFile()
  if (configFile == null) {
    return null
  }
  const codeBlocks = getCodeBlocks(configFile)
  try {
    const data = JSON.parse(codeBlocks[0].code)
    return data
  } catch {
    return null
  }
}

// eslint-disable-next-line no-unused-vars
function setConfig(data: TData): null | void {
  const configFile = getOrMadeDataFile()
  if (configFile == null) {
    return null
  }
  configFile.content = `${configFile.paragraphs[0].content}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`
}
