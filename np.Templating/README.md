<h1 align="center">
    <img src="docs/images/Templating-logo-2.png" alt="Templating Command Bar">
</h1>

# 🧩 Templating plugin for Noteplan

**Templating** is a template language plugin for NotePlan that lets you insert variables and method results into your notes. It will also let you execute custom JavaScript constructed in the templates providing a rich note taking system.

## Documentation
📖 This README provides a quick overview of Templating, visit [Templating website](https://noteplan.co/templates/docs) for comprehensive documention.

> **NOTE:** Start Here: [Templating Documentation](https://noteplan.co/templates/docs)

## Commands
All commands can be invoked using the _NotePlan Command Bar_ (`Command-J` then ` / `) which NotePlan has reserved for plugin activation. Or by selecting `🧩 Templating` from the **Plugins** menu)

<h1 align="center">
    <img src="docs/images/command-bar-templating.png" alt="Templating Command Bar">
</h1>

Once the command bar is displayed, you can continue typing any of the following commands to invoke the appropriate plugin command.  In some case where specifically noted, you can alternately invoke the plugin command at the current insertion pointer within your document.

📖 Visit [Templating website](https://noteplan.co/templates/docs) for comprehensive documention

| Command                 | Available Inline | Description                                                                                        |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| np:append               | Yes               | Appends selected template at end of current note (will show list of all available templates)      |
| np:insert               | Yes               | Insert selected template at cursor (will show list of all available templates)                    |
| np:invoke               | Yes               | Invoke Template Command, using `location` key in template to determine injected template          |
|                         |                   | contents into current                                                                             |
| np:new                  | Yes               | Creates a new note from selected template and supplied note name                                  |
| np:qtn                  | Yes               | Invokes Quick Note Generation (displays list of all `type: quick-note`)                           |
| np:update               | Yes               | Invokes settings update method                                                                    |
| np:version              | Yes               | Displays current Templating version                                                            |

## License

Copyright &copy; 2022 Mike Erickson
Released under the MIT license

## Credits

**Codedugeon Toolbox for NotePlan** written by **Mike Erickson**

E-Mail: [codedungeon@gmail.com](mailto:codedungeon@gmail.com)

Support: [https://github.com/NotePlan/plugins/issues](https://github.com/NotePlan/plugins/issues)

Twitter: [@codedungeon](http://twitter.com/codedungeon)

Website: [codedungeon.io](http://codedungeon.io)
