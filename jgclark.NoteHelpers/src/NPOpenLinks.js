// @flow

// import { log, logError, JSP, clo } from '@helpers/dev'
import { getParagraphContainingPosition } from '@helpers/NPParagraph'

/**
 * Find URLs in an array of paragraphs
 * @param {Array<TParagraph>} paras
 * @returns
 */
export function findURLs(paras: Array<TParagraph>): Array<string> {
  const reURL = /(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])/gim
  let urls = []
  paras.forEach((para) => {
    const matches = para.content.match(reURL)
    if (matches) {
      urls = [...urls, ...matches]
    }
  })
  return urls
}

/**
 * Find Links in Paragraphs Array and open in Browser
 * @param {*} paras
 */
export function openLinksInNote(paras: Array<TParagraph>) {
  const urls = findURLs(paras)
  urls.forEach(async (url) => {
    await NotePlan.openURL(url)
  })
}

/**
 * Open URLs in Editor note which are OPEN todos
 * (Entrypoint for "/open todo links in browser" command)
 */
// eslint-disable-next-line require-await
export async function openIncompleteLinksInNote() {
  if (Editor?.note) {
    const openParas = Editor.note.paragraphs.filter((p) => p.type === 'open')
    openLinksInNote(openParas)
  }
}

/**
 * Open URLs on selected line
 * (Entrypoint for" /open URL on this line" command)
 */
// eslint-disable-next-line require-await
export async function openURLOnLine() {
  const para = getParagraphContainingPosition(Editor.note, Editor.selection?.start || 0)
  if (para) {
    openLinksInNote([para])
  }
}
