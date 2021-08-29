import showdown from 'showdown'
// import { parseHtml } from 'contentful-html-rich-text-converter'

export default class CodedungeonToolbox {
  markdownToHtml(text = '') {
    const showdownConverter = new showdown.Converter()

    const html = showdownConverter.makeHtml(text)

    return html
  }

  async markdownToRtf(text = '') {
    const html = '<ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul><p></p>'

    // const result = parseHtml(html)

    const result = 'DEBUG_INCOMPLETE'
    console.log(JSON.stringify(result))
  }

  async reorderList(listData = '') {
    const workingData = [...listData]

    let lineItem = 0
    for (let index = 0; index < workingData.length; index++) {
      if (workingData[index].charCodeAt(0) !== 9) {
        const startsWithIndex = new RegExp('[0-9]+.')
        if (startsWithIndex.test(workingData[index])) {
          lineItem++
          const starting = workingData[index].indexOf('.')
          if (starting >= 0) {
            const numberIndex = workingData[index].substring(0, starting)
            workingData[index] = workingData[index].replace(numberIndex, `${lineItem}`)
            console.log(workingData[index])
          }
        }
      }
    }

    console.log(workingData)
    return workingData
  }
}
