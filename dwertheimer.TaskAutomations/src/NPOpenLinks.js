// @flow

// import { log, logError, JSP, clo } from '@helpers/dev'
import { getParagraphContainingPosition } from '@helpers/NPParagraph'
import { logDebug } from '@helpers/dev'

/**
 * Find URLs in an array of paragraphs
 * @param {Array<TParagraph>} paras
 * @author @dwertheimer
 * @returns {Array<string>} - the URL strings as an array
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
 * @author @dwertheimer
 */
export function openLinksInParagraphs(paras: Array<TParagraph>) {
  const urls = findURLs(paras)
  urls.forEach(async (url) => {
    await NotePlan.openURL(url)
  })
}

/**
 * Open URLs in Editor note which are OPEN todos
 * (Entrypoint for "/open todo links in browser" command)
 * @author @dwertheimer
 */
// eslint-disable-next-line require-await
export async function openIncompleteLinksInNote() {
  if (Editor?.note) {
    const openParas = Editor.paragraphs.filter((p) => p.type === 'open')
    openLinksInParagraphs(openParas)
  }
}

/**
 * Open URLs on selected line
 * (Entrypoint for" /open URL on this line" command)
 * @param {TParagraph} para - passed paragraph to find URL on and open it
 * @author @dwertheimer
 */
// eslint-disable-next-line require-await
export async function openURLOnLine(incomingParagraph: TParagraph | null = null) {
  if (Editor) {
    const para = incomingParagraph ?? getParagraphContainingPosition(Editor, Editor.selection?.start || 0)
    if (para) {
      openLinksInParagraphs([para])
    }
  }
}
