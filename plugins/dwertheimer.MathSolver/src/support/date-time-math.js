
// import {getTimeBlockString} from '@helpers/timeblocks'

export function checkForTime(strToBeParsed, currentData) {
    const reHasTime = /([0-2]\d:[0-5]\d(:\d{0,2})?)/
    if (reHasTime.test(strToBeParsed)) {
      const pdt = Calendar.parseDateText(strToBeParsed)
      strToBeParsed = strToBeParsed.replace(pdt.text).trim()
    }
    return ({currentData,strToBeParsed})
  }

