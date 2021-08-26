import showdown from 'showdown'

export default class CodedungeonToolbox {
  markdownToHtml(text = '') {
    const showdownConverter = new showdown.Converter()

    const html = showdownConverter.makeHtml(text)

    return html
  }
}
