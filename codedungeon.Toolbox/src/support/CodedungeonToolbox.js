/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import showdown from 'showdown'

const removeAttributes = (str = '', attrs = []) => {
  if (str.length === 0) {
    return ''
  }

  const reg = /<\s*(\w+).*?>/gm
  const reg2 = /\s*(\w+)=\"[^\"]+\"/gm

  str = str.replace(reg, (match, i) => {
    const result = match.replace(reg2, (match_, i) => {
      const matchFound = reg2.exec(match_)
      if (matchFound) {
        return attrs.indexOf(matchFound[1]) >= 0 ? match_ : ''
      }
      return ''
    })
    return result
  })
  return str
}

function convertHtmlToRtf(html) {}

export default class CodedungeonToolbox {
  markdownToHtml(text = '', options = { removeAttributes: true }) {
    const showdownConverter = new showdown.Converter()

    let html = showdownConverter.makeHtml(text)
    if (options?.removeAttributes && options.removeAttributes) {
      html = removeAttributes(html, [])
    }
    return html
  }

  async markdownToRtf(markdownText = '') {
    if (!(typeof markdownText === 'string' && markdownText)) {
      return null
    }

    let html = await this.markdownToHtml(markdownText)
    html = html.replace(/\n/g, '<br />')
    html = html
      .replace(/^\s{8}|\s+$/gm, '')
      .replace(/^\s+/, '')
      .replace(/[ ]{4}/g, '  ')

    let richText = html

    // Singleton tags
    richText = richText.replace(
      /<(?:hr)(?:\s+[^>]*)?\s*[\/]?>/gi,
      '{\\pard \\brdrb \\brdrs \\brdrw10 \\brsp20 \\par}\n{\\pard\\par}\n',
    )
    richText = richText.replace(/<(?:br)(?:\s+[^>]*)?\s*[\/]?>/gi, '{\\pard\\par}\n')

    // Empty tags
    richText = richText.replace(/<(?:p|div|section|article)(?:\s+[^>]*)?\s*[\/]>/gi, '{\\pard\\par}\n')
    richText = richText.replace(/<(?:[^>]+)\/>/g, '')

    // Hyperlinks
    richText = richText.replace(
      /<a(?:\s+[^>]*)?(?:\s+href=(["'])(?:javascript:void\(0?\);?|#|return false;?|void\(0?\);?|)\1)(?:\s+[^>]*)?>/gi,
      '{{{\n',
    )
    const tmpRichText = richText
    richText = richText.replace(
      /<a(?:\s+[^>]*)?(?:\s+href=(["'])(.+)\1)(?:\s+[^>]*)?>/gi,
      '{\\field{\\*\\fldinst{HYPERLINK\n "$2"\n}}{\\fldrslt{\\ul\\cf1\n',
    )
    const hasHyperlinks = richText !== tmpRichText
    richText = richText.replace(/<a(?:\s+[^>]*)?>/gi, '{{{\n')
    richText = richText.replace(/<\/a(?:\s+[^>]*)?>/gi, '\n}}}')

    // Start tags
    richText = richText.replace(/<(?:b|strong)(?:\s+[^>]*)?>/gi, '{\\b\n')
    richText = richText.replace(/<(?:i|em)(?:\s+[^>]*)?>/gi, '{\\i\n')
    richText = richText.replace(/<(?:u|ins)(?:\s+[^>]*)?>/gi, '{\\ul\n')
    richText = richText.replace(/<(?:strike|del)(?:\s+[^>]*)?>/gi, '{\\strike\n')
    richText = richText.replace(/<sup(?:\s+[^>]*)?>/gi, '{\\super\n')
    richText = richText.replace(/<sub(?:\s+[^>]*)?>/gi, '{\\sub\n')
    richText = richText.replace(/<(?:p|div|section|article)(?:\s+[^>]*)?>/gi, '{\\pard\n')

    // End tags
    richText = richText.replace(/<\/(?:p|div|section|article)(?:\s+[^>]*)?>/gi, '\n\\par}\n')
    richText = richText.replace(/<\/(?:b|strong|i|em|u|ins|strike|del|sup|sub)(?:\s+[^>]*)?>/gi, '\n}')

    // Strip any other remaining HTML tags [but leave their contents]
    richText = richText.replace(/<(?:[^>]+)>/g, '')

    // Prefix and suffix the rich text with the necessary syntax
    /* eslint-disable prefer-template*/
    richText =
      '{\\rtf1\\ansi\n' + (hasHyperlinks ? '{\\colortbl\n;\n\\red0\\green0\\blue255;\n}\n' : '') + richText + '\n}'

    return richText
  }

  async reorderList(listData = '') {
    const workingData = [...listData]

    let lineItem = 0
    for (let index = 0; index < workingData.length; index++) {
      if (workingData[index].charCodeAt(0) !== 9) {
        const startsWithIndex = new RegExp('[0-9]+.')
        if (startsWithIndex.test(workingData[index])) {
          const starting = workingData[index].indexOf('.')
          if (starting >= 0) {
            lineItem++
            const numberIndex = workingData[index].substring(0, starting)
            workingData[index] = workingData[index].replace(numberIndex, `${lineItem}`)
          }
        }
      }
    }

    return workingData
  }
}
