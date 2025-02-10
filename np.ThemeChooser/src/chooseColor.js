// @flow

import { showHTMLV2, type HtmlWindowOptions } from '@helpers/HTMLView'
import { clo, logDebug } from '@helpers/dev'
import { setFrontMatterVars } from '@helpers/NPFrontMatter'

const windowCustomId = 'color-picker'

export function setFrontmatterColor(color: string, key: string): void {
  logDebug(`setFrontmatterColor: Setting ${key} to ${color} in frontmatter for ${Editor.filename} (${Editor.title || ''})`)
  setFrontMatterVars(Editor, {
    [key]: color,
  })
  Editor.openNoteByFilename(Editor.filename)
}

/**
 * Pops up an HTML window to allow for color picking
 * @param {*} defaultValue - the initial color to set, otherwise the theme background color is used
 * Uses invokePluginCommandByName to set the color after it's chosen
 */
export function chooseColor(defaultValue?: string): void {
  clo(NotePlan.environment, `chooseColor: NotePlan.environment`)
  const opts: HtmlWindowOptions = {
    windowTitle: 'Select a color',
    width: 400,
    height: 180,
    makeModal: false, // modal windows cannot be closed by the plugin
    customId: windowCustomId,
    savedFilename: 'color-picker.html',
    shouldFocus: true,
    // generalCSSIn: '', // needs to be non-empty for theme gen not to happen
  }

  // if user has selected a color, use that for seeding the color picker
  clo(Editor.currentTheme, `Editor.currentTheme`)
  const currentTheme = Editor.currentTheme
  const isDark = currentTheme.values.style === 'Light' ? false : true

  const platform = NotePlan.environment.platform
  const isDesktop = platform === 'macOS'
  const selectedColor = defaultValue || currentTheme?.values?.editor?.backgroundColor || '#cdcdcd'

  const isColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(selectedColor) //TODO: do validation on the input color at some point

  const setColor = JSON.stringify(
    `
      (async function() {
        console.log('Sending to np.ThemeChooser/setFrontmatterColor: "%%KEY%%"="%%COLOR%%"');
        if ("%%KEY%%" !== "clipboard") {
          await DataStore.invokePluginCommandByName("setFrontmatterColor", "np.ThemeChooser", ["%%COLOR%%","%%KEY%%"]);
        } else {
          console.log('copying color to clipboard: %%COLOR%%');
          Clipboard.string = "%%COLOR%%";
        }
        console.log('Closing window');
        const win = NotePlan.htmlWindows.find(w=>w.customId === "${windowCustomId}");
        if (win) {
          ${isDesktop} ? win.close() : null;
        } else {
          console.log('Window not found');
        }
      })()
    `,
  )
  const html = `
        <center>
      <div style="background-color:white;">
          <table style="width: 100%;">
          <tr style="display: flex; align-items: center;">
            <td style="padding-right: 10px;">
              <select id="presetColors" onchange="updateColor(this.value)">
                <option value="">Select a Preset</option>
                <option value="#fef3c7">Yellow 100</option>
                <option value="#fde68a">Yellow 200</option>
                <option value="#fde047">Yellow 300</option>
                <option value="#facc15">Yellow 400</option>
                <option value="#eab308">Yellow 500</option>
                <option value="#ffedd5">Amber 100</option>
                <option value="#fed7aa">Amber 200</option>
                <option value="#fcd34d">Amber 300</option>
                <option value="#fbbf24">Amber 400</option>
                <option value="#f59e0b">Amber 500</option>
                <option value="#ffedd5">Orange 100</option>
                <option value="#fed7aa">Orange 200</option>
                <option value="#fdba74">Orange 300</option>
                <option value="#fb923c">Orange 400</option>
                <option value="#f97316">Orange 500</option>
                <option value="#fee2e2">Red 100</option>
                <option value="#fecaca">Red 200</option>
                <option value="#fca5a5">Red 300</option>
                <option value="#f87171">Red 400</option>
                <option value="#ef4444">Red 500</option>
                <option value="#ffe4e6">Rose 100</option>
                <option value="#fecdd3">Rose 200</option>
                <option value="#fda4af">Rose 300</option>
                <option value="#fb7185">Rose 400</option>
                <option value="#f43f5e">Rose 500</option>
                <option value="#fce7f3">Pink 100</option>
                <option value="#fbcfe8">Pink 200</option>
                <option value="#f9a8d4">Pink 300</option>
                <option value="#f472b6">Pink 400</option>
                <option value="#ec4899">Pink 500</option>
                <option value="#fae8ff">Fuchsia 100</option>
                <option value="#f5d0fe">Fuchsia 200</option>
                <option value="#f0abfc">Fuchsia 300</option>
                <option value="#e879f9">Fuchsia 400</option>
                <option value="#d946ef">Fuchsia 500</option>
                <option value="#f3e8ff">Purple 100</option>
                <option value="#e9d5ff">Purple 200</option>
                <option value="#d8b4fe">Purple 300</option>
                <option value="#c084fc">Purple 400</option>
                <option value="#a855f7">Purple 500</option>
                <option value="#ede9fe">Violet 100</option>
                <option value="#ddd6fe">Violet 200</option>
                <option value="#c4b5fd">Violet 300</option>
                <option value="#a78bfa">Violet 400</option>
                <option value="#8b5cf6">Violet 500</option>
                <option value="#e0e7ff">Indigo 100</option>
                <option value="#c7d2fe">Indigo 200</option>
                <option value="#a5b4fc">Indigo 300</option>
                <option value="#818cf8">Indigo 400</option>
                <option value="#6366f1">Indigo 500</option>
                <option value="#dbeafe">Blue 100</option>
                <option value="#bfdbfe">Blue 200</option>
                <option value="#93c5fd">Blue 300</option>
                <option value="#60a5fa">Blue 400</option>
                <option value="#3b82f6">Blue 500</option>
                <option value="#cffafe">Cyan 100</option>
                <option value="#a5f3fc">Cyan 200</option>
                <option value="#67e8f9">Cyan 300</option>
                <option value="#22d3ee">Cyan 400</option>
                <option value="#06b6d4">Cyan 500</option>
                <option value="#d1fae5">Emerald 100</option>
                <option value="#a7f3d0">Emerald 200</option>
                <option value="#6ee7b7">Emerald 300</option>
                <option value="#34d399">Emerald 400</option>
                <option value="#10b981">Emerald 500</option>
                <option value="#dcfce7">Green 100</option>
                <option value="#bbf7d0">Green 200</option>
                <option value="#86efac">Green 300</option>
                <option value="#4ade80">Green 400</option>
                <option value="#22c55e">Green 500</option>
                <option value="#ecfccb">Lime 100</option>
                <option value="#d9f99d">Lime 200</option>
                <option value="#bef264">Lime 300</option>
                <option value="#a3e635">Lime 400</option>
                <option value="#84cc16">Lime 500</option>
              </select>
            </td>
            <td style="flex-grow: 1; padding-right: 10px;">
              <input type="color" id="colorPicker" value="${selectedColor}" onchange="updateColor(this.value)" style="width: 100%;">
            </td>
            <td>
              <input id="pickedColor" name="head" value="#fde047" style='font-family:"Courier New", Courier, monospace; font-size:80%; width: 80px;' oninput="updateColor(this.value)">
            </td>
          </tr>
          <tr>
            <td colspan="3" style="padding: 10px 0;">
              <div style="display: flex; justify-content: space-between;">
                <button style="flex: 1; margin-right: 10px;" onclick="pickColor('bg-color')">Add as:<br>bg-color</button>
                <button style="flex: 1; margin-right: 10px;" onclick="pickColor('bg-color-dark')">Add as:<br>bg-color-dark</button>
                <button style="flex: 1;" onclick="pickColor('clipboard')">Copy to Clipboard</button>
              </div>
            </td>
          </tr>
          <tr>
            <td colspan="3">
              <div id="colorSample" style="display: flex; padding: 10px; background-color: ${selectedColor}; border: 1px solid #ccc;">
                <div style="flex: 1; color: #222E33;">Main Text</div>
                <div style="flex: 1; color: #C5487A;">H1 Text</div>
                <div style="flex: 1; color: #9B82C9;">H2 Text</div>
                <div style="flex: 1; color: #9B82C9;">H3 Text</div>
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
        if (/^#[0-9A-F]{6}$/i.test(color)) {
          document.getElementById('colorPicker').value = color;
          document.getElementById('pickedColor').value = color;
          document.getElementById('colorSample').style.backgroundColor = color;
          document.getElementById('presetColors').selectedIndex = 0; // Reset select
        }
        }
      const pickColor = (key) => {
        const chosenColor = document.getElementById("colorPicker").value
        console.log('Sending message to bridge. Chosen color = ' + chosenColor)
        const updatedSetColor = ${setColor}.replace(/%%COLOR%%/g, chosenColor).replace(/%%KEY%%/g, key)
        window.webkit.messageHandlers.jsBridge.postMessage({
          code: updatedSetColor,
          onHandle: "onHandleuUpdateNoteCount",
          id: "1"
        });
      };

      const addAsBgColor = () => {
        const chosenColor = document.getElementById("colorPicker").value;
        console.log('Add as bg-color:', chosenColor);
        // Add your logic to handle adding as bg-color
      };

      const addAsBgColorDark = () => {
        const chosenColor = document.getElementById("colorPicker").value;
        console.log('Add as bg-color-dark:', chosenColor);
        // Add your logic to handle adding as bg-color-dark
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
