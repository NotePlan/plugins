# Sweep

Quickly deal with overdue tasks. Reschedule/Move them all to today (or a day in the future)

## Development Guide

Set Up

1.  Make sure you have a recent version of `node` and `yarn` installed. You can use brew to install both
2.  Navigate to this folder in the Terminal and simply run `yarn`. This will install all the dependencies.
3.  Set up your editor with the correct tools. I recommend using `Visual Studio Code`
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


Building

If you followed the first few steps from the Set Up, you should already have `yarn` installed.

While navigated to this plugin's folder, you can run:

```sh
yarn run build
```
This looks for the the "build" key under "scripts" in the package.json file and runs it. Any script there can be run this way.


This will bundle and transpile the javascript files and output a single `script.js` file at the root level of this plugin folder.
This output location has been chosen to make development while testing possible.

You can also run:

```sh
yarn run watch
```

This command will keep running and compiling whenever it detects a change to a src file. This is made for easy development.

Finally, you can run `yarn run test` to run lint and typecheck your code from the command line. Generally, this should be neccesary,
but if you are having trouble setting up editor plugins (or use vim/emacs) this might the easiest thing to do.

## Flow Guide

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
let str: ?string

let err: string = str // type error

if (str != null) {
  const val: string = str // no type error
}
```

As you can see, a simple if check to verify that str is not `null` or `undefined` is enough for Flow to refine it's type.
No special syntax needed.

## Type definitions of Noteplan

Please look under `flow-typed/Noteplan.js` for all the type definitions you can use. Note that this file defines the object/values
available in Javascript, but the types of those objects are usually prefixed with a T.

For example, the `Paragraph` object is of the type `TParagraph`
