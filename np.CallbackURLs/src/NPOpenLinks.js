// @flow

// import { log, logError, JSP, clo } from '@helpers/dev'
import { getParagraphContainingPosition } from '@helpers/NPParagraph'
import { logDebug, logError, clo, JSP } from '@helpers/dev'
import { findURLsInText } from '@helpers/urls'

/**
 * Find Links in Paragraphs Array and open in Browser
 * @param {*} paras
 * @author @dwertheimer
 */
export function openLinksInParagraphs(paras: Array<TParagraph>) {
  const rawText = paras.map((p) => p.content).join('\n')
  const urls = findURLsInText(rawText)
  urls.forEach(async (urlObj) => {
    await NotePlan.openURL(urlObj.url)
  })
}

/**
 * Open URLs in Editor note which are OPEN todos
 * (Entrypoint for "/open todo links in browser" command)
 * @author @dwertheimer
 */
// eslint-disable-next-line require-await
export async function openIncompleteLinksInNote() {
  logDebug('openIncompleteLinksInNote running')
  if (Editor?.note) {
    const openParas = Editor.paragraphs.filter((p) => p.type === 'open' || p.type === 'checklist')
    logDebug(`openIncompleteLinksInNote: ${openParas.length} open paragraphs found (that could have links)`)
    openLinksInParagraphs(openParas)
  } else {
    logError('openIncompleteLinksInNote: Editor.note is null')
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
