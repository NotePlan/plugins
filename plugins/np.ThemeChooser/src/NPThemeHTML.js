// @flow

import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'

/**
 * Pops up an HTML window to allow for color picking
 * @param {*} key
 * @param {*} defaultValue
 * Uses invokePluginCommandByName to set the color after it's chosen
 */
export function askForColor(key: string, defaultValue: string): void {
  const css = generateCSSFromTheme()
  const setColor = JSON.stringify(`
      (async function() {
        await DataStore.invokePluginCommandByName("setColor", "np.ThemeChooser", ["${key}", "%%COLOR%%"])
      })()
    `)
  const html = `<html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body>
        <style>
            ${css}
        </style>
        <center>
      <p>Choose a color for<br><b>${key}</b></p>
      <div style="background-color:white;">
          <input type="color" id="colorPicker" value="${defaultValue}" onchange="document.getElementById('pickedColor').value = this.value">
          <input id="pickedColor" name="head" disabled value="${defaultValue}" style='font-family:"Courier New", Courier, monospace; font-size:80%'>
      </div>
      <button onclick=pickColor()>Select this color</button>
      </center>
    </body>
    <script>
      const onChange = (e) => {
        console.log("onChange", e)
        document.getElementById("pickedColor").value = e.target.value
      }
      const pickColor = () => {
         window.webkit.messageHandlers.jsBridge.postMessage({
           code: ${setColor}.replace("%%COLOR%%", document.getElementById("colorPicker").value),
           onHandle: "onHandleuUpdateNoteCount",
           id: "1"
         });
       };

       function onHandleuUpdateNoteCount(re, id) {

       }
    </script>
  </html>
`
  try {
    HTMLView.showWindow(html, 'Select a color', 500, 300)
    // HTMLView.showSheet(html, 300, 150)
  } catch (error) {
    console.log(error)
  }
}
