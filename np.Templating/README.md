# 🧩 np.Templating templating plugin for Noteplan

## Overview
**np.Templating** is a template language plugin for NotePlan that lets you insert variables and method results into your notes. It will also let you execute custom JavaScript constructed in the templates providing a rich note taking system.

<h1 align="center">
    <img src="docs/images/npTemplating-intro.png" width="50%" height="50%" alt="np.Templating">
</h1>

## Documentation
📖 This README provides a quick overview of np.Templating, visit [np.Templating website](https://nptemplating-docs.netlify.app/) for comprehensive documention.

## Commands
All commands can be invoked using the _NotePlan Command Bar_ (`Command-J` then ` / `) which NotePlan has reserved for plugin activation. Or by selecting `🧩 np.Templating` from the **Plugins** menu)

<h1 align="center">
    <img src="docs/images/command-bar.png" alt="np.Templating Command Bar">
</h1>

<h1 align="center">
    <img src="docs/images/menu.png" alt="np.Templating Menu">
</h1>

Once the command bar is displayed, you can continue typing any of the following commands to invoke the appropriate plugin command.  In some case where specifically noted, you can alternately invoke the plugin command at the current insertion pointer within your document.

📖 Visit [np.Templating website](https://nptemplating-docs.netlify.app/) for comprehensive documention

| Command                 | Available Inline | Description                                                                                        |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| np:init                 | Yes               | Initilalizes np.Templating Settings (only use if you want to reset settings to default)           |
| np:insert               | Yes               | Insert selected template at cursor (will show list of all available templates)                    |
| np:append               | Yes               | Appends selected template at end of current note (will show list of all available templates)      |
| np:new                  | Yes               | Creates a new note from selected template and supplied note name                                  |
| np:mtn                  | Yes               | Invokes Meeting Note Generation (displays list of all `type: meeting-note`)                       |
| np:qtn                  | Yes               | Invokes Quick Note Generation (displays list of all `type: meeting-note`)                         |
| np:verse                | Yes               | Inserts random bible verse at cursor location                                                     |
| np:update               | Yes               | Invokes settings update method                                                                    |

## License

Copyright &copy; 2022 Mike Erickson
Released under the MIT license

## Credits

**Codedugeon Toolbox for NotePlan** written by **Mike Erickson**

E-Mail: [codedungeon@gmail.com](mailto:codedungeon@gmail.com)

Support: [https://github.com/NotePlan/plugins/issues](https://github.com/NotePlan/plugins/issues)

Twitter: [@codedungeon](http://twitter.com/codedungeon)

Website: [codedungeon.io](http://codedungeon.io)
