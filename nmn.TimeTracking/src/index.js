// @flow

import { getCodeBlocks } from '../../helpers/codeBlocks'

type TData = $ReadOnly<{
  [string]: $ReadOnlyArray<
    $ReadOnly<{
      type: 'START' | 'STOP',
      time: Date,
    }>,
  >,
}>

function getOrMadeDataFile() {
  let dataFile = DataStore.projectNotes.find(
    (n) => n.filename === '_time_tracking/data.md' || n.filename === '_time_tracking/data.txt',
  )
  if (dataFile == null) {
    DataStore.newNote('data', '_time_tracking')
    dataFile = DataStore.projectNotes.find(
      (n) => n.filename === '_time_tracking/data.md' || n.filename === '_time_tracking/data.txt',
    )
  }
  return dataFile
}

function getConfig(): ?TData {
  let configFile = getOrMadeDataFile()
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

function setConfig(data: TData): null | void {
  let configFile = getOrMadeDataFile()
  if (configFile == null) {
    return null
  }
  configFile.content = configFile.paragraphs[0].content + '\n\n```json\n' + JSON.stringify(data, null, 2) + '\n```\n'
}
