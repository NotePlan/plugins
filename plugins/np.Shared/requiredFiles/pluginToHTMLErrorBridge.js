/**
 * This is a bridge to route JS errors from the HTML window back to the NP console.log for debugging
 * You should load this file first before any other JS so you can catch errors in other JS files
 * @param {string} msg
 * @param {string} url
 * @param {number} line
 * @param {number} column
 * @param {Error} error
 */
window.onerror = (msg, url, line, column, error) => {
  const message = {
    message: msg,
    url: url,
    line: line,
    column: column,
    error: JSON.stringify(error),
  }

  if (window.webkit) {
    window.webkit.messageHandlers.error.postMessage(message)
  } else {
    console.log('JS Error:', message)
  }
}
