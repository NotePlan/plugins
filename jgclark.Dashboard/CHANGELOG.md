# What's changed in 🎛 Dashboard plugin?
For more details see the [plugin's README](https://github.com/NotePlan/plugins/tree/main/jgclark.Dashboard/).
 
## [0.2.0] 2023-02-18 @dwertheimer

### In np.Shared
- created new shared file (pluginToHTMLCommsBridge.js) with all the bi-directional comms infrastructure that any plugin can use
### Here at jgClark.Dashboard
Plugin-side:
- added new file to receive the messages from the HTML window (pluginToHTMLBridge.js)
- added onMessageFromHTMLView command in plugin.json/index.js and new file  (to receive messages from the HTML window)
- changed where it writes the html temp file to the actual plugin directory so it can load the external JS files from the path supplied
HTMLView (browser) side:
- commented out makeCommandCall in the HTML builder -- you should now use sendToPlugin(args) command instead
- added code to import np.Shared/pluginToHTMLCommsBridge
- created JS file (commsSwitchboard.js) that the HTML window will use to process info it receives


## [0.1.0]
- first release
