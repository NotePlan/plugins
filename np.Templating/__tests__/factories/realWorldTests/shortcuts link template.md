---
title: Append Shortcut Link to Selected Lines
type: ignore
shortcutName: My Shortcut Name
appendLinkToLine: yes
openLinkAutomatically: yes
shortcutInstructions: https://support.apple.com/en-am/guide/shortcuts/apd624386f42/7.0/ios/17.0
invokeUsing: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=np%3Aappend&arg0=Append%20Shortcut%20Link%20to%20Selected%20Lines
---
```templatejs
	 let shortcutTemplate = `shortcuts://run-shortcut?name={shortcutName}&input=text&text={text}`
    const beginningOfShortcut = shortcutTemplate.split('{')[0]
    shortcutTemplate = shortcutTemplate.replace('{shortcutName}', encodeURIComponent(shortcutName))
    const selectedParas = Editor.selectedParagraphs.filter(p=>p.content.trim() !== "")
    for (const para of selectedParas) {
      if (!para.content.includes(beginningOfShortcut)) {
        const shortcut = shortcutTemplate.replace('{text}', encodeURIComponent(para.content))
		 if (appendLinkToLine === 'yes') {
        	para.content = `${para.content} [⏱](${shortcut}￼)`
        	Editor.updateParagraph(para)
		 }
		 if (openLinkAutomatically === 'yes') NotePlan.openURL(shortcut)
      }
    }
```