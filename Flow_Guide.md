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