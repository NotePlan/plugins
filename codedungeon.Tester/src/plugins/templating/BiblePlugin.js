/* eslint-disable no-case-declarations */
// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// References:
// - https://labs.bible.org/api_web_service

const BIBLE_FORMATTING_OPTIONS = ['full', 'para', 'plain']

const BIBLE_RESPONSE_TYPES = ['text', 'json']

const getFormatting = (formatting: string = '') => {
  return BIBLE_FORMATTING_OPTIONS.indexOf(formatting) !== -1 ? formatting : 'para'
}

const getResponseType = (type: string = 'text') => {
  return BIBLE_RESPONSE_TYPES.indexOf(type) !== -1 ? type : 'text'
}

const formatData = (obj: any) => {
  return JSON.stringify(obj, null, '\t')
    .replace(/\\/g, ' ')
    .replace(/, /g, ',\n   ')
    .replace(/"{/g, '{\n  ')
    .replace(/}"/g, '\n}')
    .replace(/ ",/g, '",')
    .replace(/ ":/g, '":')
    .replace('[{', '\n[\n  {')
    .replace('}]', '\n  }\n]')
    .replace(']"', ']"')
    .replace(/]"/g, ']\n"')
}

// $FlowFixMe
const formatResponse = (response: any, type: string = 'text', formatting = ''): string => {
  switch (type) {
    case '':
    case 'plain':
      return response.replace(/<b>/gi, '').replace(/<\/b>/gi, '')
    case 'text':
      return response.replace(/<b>/gi, '**').replace(/<\/b>/gi, '**')
    case 'json':
      if (formatting === 'raw') {
        // eslint-disable-next-line prefer-template
        return '```\n' + formatData(response) + '\n```'
      }
      const data = JSON.parse(response)[0]
      const result = `**${data.bookname} ${data.chapter}:${data.verse}** ${data.text}`
      return result.replace(/<b>/gi, '**').replace(/<\/b>/gi, '**')
  }
}

const BiblePlugin = {
  baseURL: 'https://labs.bible.org/api/?',

  async verse(verse: string, type: string = 'text', formatting: string = ''): Promise<string> {
    const formattedVerse = verse.replace(' ', '%20')
    const url: string = `${BiblePlugin.baseURL}passage=${formattedVerse}&type=${getResponseType(type)}&formatting=${getFormatting(formatting)}`

    try {
      // $FlowFixMe
      const response: any = await fetch(url)
      return formatResponse(response, type, formatting)
    } catch (error) {
      return 'An error occured accessing ${url}'
    }
  },

  async votd(type: string = 'text', formatting: string = ''): Promise<string> {
    const url: string = `${BiblePlugin.baseURL}passage=votd&type=${type}&formatting=${getFormatting(formatting)}`
    try {
      // $FlowFixMe
      const response: any = await fetch(url)
      return formatResponse(response, type, formatting)
    } catch (error) {
      return 'An error occured accessing ${url}'
    }
  },

  async random(type: string = 'text', formatting: string = ''): Promise<string> {
    const url: string = `${BiblePlugin.baseURL}passage=random&type=${getResponseType(type)}&formatting=${getFormatting(formatting)}`
    try {
      // $FlowFixMe
      const response: any = await fetch(url)
      return formatResponse(response, type, formatting)
    } catch (error) {
      return 'An error occured accessing ${url}'
    }
  },
}

module.exports = BiblePlugin
