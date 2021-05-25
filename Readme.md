# NotePlan Plugins

This is the initial repository for [NotePlan app](https://noteplan.co/) plugins, available from release v3.0.22 (Mac & iOS).

The plugins work through [Command Bar Plugins](https://help.noteplan.co/article/65-commandbar-plugins)
for example:
![](https://d33v4339jhl8k0.cloudfront.net/docs/assets/6081f7f4c9133261f23f4b41/images/608c5886f8c0ef2d98df845c/file-fLVrMGjoZr.png)

If you are a user and have plugin ideas, [submit them here](https://feedback.noteplan.co/plugins-scripting) or ask in the [NotePlan Discord community](https://discord.gg/D4268MT)'s `#plugin-ideas` channel.

If you are a developer and want to contribute and build your plugins, see the [plugin writing documentation](https://help.noteplan.co/article/67-create-command-bar-plugins) and discuss this with other developers on [Discord](https://discord.gg/D4268MT) `#plugin-dev` channel.

# Contributing

## Development Guide

Set Up

1.  Make sure you have a recent version of `node` and `npm` installed. `brew install node` should do the trick.
2.  Run `npm install`. This will install all the dependencies.

## Editor Setup

### Visual Studio Code (recommended)

1. Install extensions for the following tools:
   1. `flow` "Flow Language Support" by flowtype
   2. `eslint` "ESLint" by Dirk Baeumer
   3. `prettier` "Prettier - Code formatter" by Prettier
2. Update Settings:
3. Set `prettier` to be the default formatter for js files.
   - You can open the Command Bar using `CMD+SHIFT+P` and then search for `Format Document`.
   - When you do this, you may get asked for a formatter of choice. Choose "Prettier"
   - If it asks you if this should be your default for all JS files, choose Yes.
4. Restart the editor to ensure the plug-ins are working.
   - You should see type errors when you make those
   - You should see lint errors when you format code wrong
   - You should see your code get autoformatted when you save
5. Make sure to open this folder directly in VSCode and not the entire repo as the ESLint plug-in can be annoying about that

### Sublime Text 3 and 4

1. Install the following extensions using Package Control
   1. `SublimeLinter` This allows various linters to work
   2. `SublimeLinter-eslint`
   3. `SublimeLinter-flow`
   4. `jsPrettier`
   5. `Babel` Syntax definitions for ES6 Javascript and React JSX extensions
2. Configure your packages:
   1. Open a `.js` file
   2. From the View menu, select Syntax → Open all with current extension as… → Babel → JavaScript (Babel)
   3. Open the package settings for `jsPrettier` and add `"auto_format_on_save": true,`

## Working with multiple files

Noteplan plugins need to be packaged as a single Javascript file, but that's not always a nice way to work.
So we use tools to package up multiple files into one.

After making any changes, you can simply run `npm run build`.

Even better, you can run `npm run watch` and it will automatically watch the source files for changes and continuously
compile the final plugin file.

If you don't have an editor set up to lint on the fly for you, run `npm run test` and it will give a list of problems
to fix.

# Flow Guide

This section is for those looking to understand how to use Flow types for more reliable Javascript.

You can read a full guide for Flow on `flow.org` but here are some quick tips if you're familiar with Swift:

1. Type annotations work very similarly by putting `: type` after variables and arguments
2. Function return types also use `:` and not `=>` like Swift
3. For all the primitive types in Javascript, you must use lowercase for the tyeps:
   - `string` not `String`
   - `number` not `Number` or `Int` or `Float` (Javascript only has a single number type)
   - `boolean` not `Boolean`
   - `null` for null types
   - `void` for undefined
4. All other types are generally capitalized - `TParagraph`, `Date` etc.
5. Union Types:
   - Think about how Swift allows you to create tagged values with Enums.
   - Flow just lets you make a union of multiple types: `string | number` is a type that takes both types
   - When dealing with a union type, you can use a `typeof` as the condition of an `if` statement and
     flow will know the more accurate type within the if statement.
   - Flow also support regular enums `enum SomeEnum {A, B, C}` but without attached data
   - If you need attached data you can use a union of object types, but that's an advanced topic.
6. Flow also has support for optional types, but the `?` comes before the type.
   - `String?` in Swift would translate to `?string` in Flow
   - This is just an alias for `string | null | void`
7. The return type of `async` function must always be a `Promise<SOMETYPE>`. The type argument for the `Promise<>` depends on you.

### Some quick examples:

Dealing with an optional string:

```swift
let str: String?

let err: String = str // type error

if let str = str {
    let val: String = str // no type error
}
```

translates to:

```typescript
let str: ?string;

let err: string = str; // type error

if (str != null) {
	const val: string = str; // no type error
}
```

As you can see, a simple if check to verify that str is not `null` or `undefined` is enough for Flow to refine it's type.
No special syntax needed.

## Type definitions of Noteplan

Please look under `flow-typed/Noteplan.js` for all the type definitions you can use. Note that this file defines the object/values
available in Javascript, but the types of those objects are usually prefixed with a T.

For example, the `Paragraph` object is of the type `TParagraph`
