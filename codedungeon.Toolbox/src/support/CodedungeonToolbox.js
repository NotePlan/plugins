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
    console.log(listData)
    return listData
  }
}
