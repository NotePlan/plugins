## Setup

- have [`node.js`](https://nodejs.dev/download) installed
- have [`yarn`](https://yarnpkg.com/getting-started/install) installed
- run the following in the terminal

```sh
$ yarn
$ yarn build
```

- Final plugin will be in the `dist` directory which can be copied to the `Plugins` directory for NotePlan


## Notes
any function that is specified in the `jsFunction` field in the `plugin.json` file needs to be defined in the global scope.

```ts
global.myFunction = function() {
  ...
}
