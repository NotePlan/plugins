// @flow

import { showHTMLV2, type HtmlWindowOptions } from '@helpers/HTMLView'
import { clo } from '@helpers/dev'

const windowCustomId = 'color-picker'

/**
 * Pops up an HTML window to allow for color picking
 * @param {*} defaultValue
 * Uses invokePluginCommandByName to set the color after it's chosen
 */
export function chooseColor(defaultValue?: string): void {
  const opts: HtmlWindowOptions = {
    windowTitle: 'Select a color',
    width: 300,
    height: 200,
    makeModal: false, // modal windows cannot be closed by the plugin
    customId: windowCustomId,
    savedFilename: 'color-picker.html',
    // generalCSSIn: '', // needs to be non-empty for theme gen not to happen
  }

  // if user has selected a color, use that for seeding the color picker
  const selectedColor = Editor.selectedText
  const isColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(selectedColor || '#222222')
  const startColor = isColor ? selectedColor : '#cdcdcd'
  //   const css = `` // generateCSSFromTheme() // not needed for this simple color picker

  const setColor = JSON.stringify(
    `
      (async function() {
        console.log('Color: %%COLOR%%');
        Clipboard.string = "%%COLOR%%";
        // Editor.pasteClipboard();
        console.log('Pasted color: %%COLOR%%');
        // await DataStore.invokePluginCommandByName("setColor", "np.ThemeChooser", ["%%COLOR%%"])
        console.log('Closing window');
        const win = NotePlan.htmlWindows.find(w=>w.customId === "${windowCustomId}")
        if (win) {
          win.close()
          console.log('Window closed');
        } else {
          console.log('Window not found')
        }
      })()
    `,
  )
  const html = `
        <center>
      <h1>Choose a color</h1>
      <div style="background-color:white;">
          <table>
          <tr>
          <td style="width: 30%;">
          <input type="color" id="colorPicker" value="#fde047" onchange="document.getElementById('pickedColor').value = this.value">
          </td>
          <td style="width: 30%;">
          <input id="pickedColor" name="head" disabled value="#fde047" style='font-family:"Courier New", Courier, monospace; font-size:80%'>
          </td>
          <td style="width: 40%;">
          <button onclick=pickColor()>Copy to Clipboard</button>
          </td>
          </tr>
                  <tr>
          <td colspan="3">
            <div style="display: flex; align-items: center;">
              <div style="color: var(--h2-color); margin-right: 10px;">Preset:</div>
              <select id="presetColors" onchange="updateColor(this.value)">
                <option value="#fde047">Yellow 300</option>
                <option value="#facc15">Yellow 400</option>
                <option value="#eab308">Yellow 500</option>
                <option value="#fcd34d">Amber 300</option>
                <option value="#fbbf24">Amber 400</option>
                <option value="#f59e0b">Amber 500</option>
                <option value="#fdba74">Orange 300</option>
                <option value="#fb923c">Orange 400</option>
                <option value="#f97316">Orange 500</option>
                <option value="#fca5a5">Red 300</option>
                <option value="#f87171">Red 400</option>
                <option value="#ef4444">Red 500</option>
                <option value="#fda4af">Rose 300</option>
                <option value="#fb7185">Rose 400</option>
                <option value="#f43f5e">Rose 500</option>
                <option value="#f9a8d4">Pink 300</option>
                <option value="#f472b6">Pink 400</option>
                <option value="#ec4899">Pink 500</option>
                <option value="#f0abfc">Fuchsia 300</option>
                <option value="#e879f9">Fuchsia 400</option>
                <option value="#d946ef">Fuchsia 500</option>
                <option value="#d8b4fe">Purple 300</option>
                <option value="#c084fc">Purple 400</option>
                <option value="#a855f7">Purple 500</option>
                <option value="#c4b5fd">Violet 300</option>
                <option value="#a78bfa">Violet 400</option>
                <option value="#8b5cf6">Violet 500</option>
                <option value="#a5b4fc">Indigo 300</option>
                <option value="#818cf8">Indigo 400</option>
                <option value="#6366f1">Indigo 500</option>
                <option value="#93c5fd">Blue 300</option>
                <option value="#60a5fa">Blue 400</option>
                <option value="#3b82f6">Blue 500</option>
                <option value="#67e8f9">Cyan 300</option>
                <option value="#22d3ee">Cyan 400</option>
                <option value="#06b6d4">Cyan 500</option>
                <option value="#6ee7b7">Emerald 300</option>
                <option value="#34d399">Emerald 400</option>
                <option value="#10b981">Emerald 500</option>
                <option value="#86efac">Green 300</option>
                <option value="#4ade80">Green 400</option>
                <option value="#22c55e">Green 500</option>
                <option value="#bef264">Lime 300</option>
                <option value="#a3e635">Lime 400</option>
                <option value="#84cc16">Lime 500</option>
              </select>
            </div>
          </td>
        </tr>
          </table>
      </div>
        <datalist id="presetColors">
    <option value="#ff0000">Red</option>
    <option value="#00ff00">Green</option>
    <option value="#0000ff">Blue</option>
    <option value="#ffff00">Yellow</option>
    <option value="#ff00ff">Magenta</option>
    <option value="#00ffff">Cyan</option>
  </datalist>
      
      </center>
    </body>
    <script>
        function updateColor(color) {
        document.getElementById('colorPicker').value = color;
        document.getElementById('pickedColor').value = color;
        }
      const onChange = (e) => {
        console.log("onChange", e)
        document.getElementById("pickedColor").value = e.target.value
      }
      const pickColor = () => {
        const chosenColor = document.getElementById("colorPicker").value
        console.log('Sending message to bridge. Chosen color = ' + chosenColor)
        const updatedSetColor = ${setColor}.replace(/%%COLOR%%/g, chosenColor)
        window.webkit.messageHandlers.jsBridge.postMessage({
          code: updatedSetColor,
          onHandle: "onHandleuUpdateNoteCount",
          id: "1"
        });
      };

       function onHandleuUpdateNoteCount(re, id) {

       }
    </script>
`
  try {
    clo(html, `chooseColor HTML`)
    showHTMLV2(html, opts)
    // HTMLView.showSheet(html, 300, 150)
  } catch (error) {
    console.log(error)
  }
}
