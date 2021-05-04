## Setup

- have [`node.js`](https://nodejs.dev/download) installed
- have [`yarn`](https://yarnpkg.com/getting-started/install) installed
- run the following in the terminal

```sh
$ yarn
$ yarn build
```

## Building
- If a plugin is kept in a single file with no external dependencies then `yarn build` can be used to compile the plugin to JS
- If a plugin has external dependencies or requires any other files then use `yarn build:with-deps` to compile the plugin to JS

However the plugin is compiled the final build will be located in the `dist` directory


## Notes
any function that is specified in the `jsFunction` field in the `plugin.json` file needs to be defined in the global scope.

```ts
global.myFunction = function() {
  ...
}
