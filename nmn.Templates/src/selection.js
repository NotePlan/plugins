// @flow

/**
 * returns raw content of the current selected paragraphs
 * @author @m1well
 *
 * @returns {Promise<string>} selected paragraphs joined by linebreaks
 */
export const selection = async (): Promise<string> => {
  return Editor.selectedParagraphs.map(para => para.rawContent).join('\n')
}
