# Flow Guide

This section is for those looking to understand how to use Flow types for more reliable Javascript.

You can read a [full guide for Flow](https://flow.org/en/docs/) but here are some quick tips if you're familiar with Swift:

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

## Optional Types

One of the *BIG* benefits of typeschecking Javascript is to catch mistakes where we forget to handle
the case where a value might not exist. These are very common in the Noteplan API. 
  * A `Note` may not have an actual `title`.
  * When given a choce of options, a user may select nothing!
  * etc.

So the *correct* type for cases like this would be `string | void | null` (Strings or Unefined or Null),
but since this is such a common pattern, Flow gives a simple syntax to handle these case:
`?string`. This is called an "optional string". If there is a value, it's of type string, but the value may not exist.

## Object Types

There are few different ways to define Object types.

[Read the docs](https://flow.org/en/docs/types/objects/)

### Plain Object Types

Plain objects are defined just with `{}` brackets.

e.g.
```typescript
type Person = { name: string, age: number }
```

Flow object types are exact by default. This means that a `Person` object type *cannot* have any keys
other than `name` and `string`. If you want to allow extra keys, you can add `...` at the type end of the object type:

```typescript
type Personish = { name: string, age: number, ... }
```

The `Personish` object type **must** contain `name` and `age`, but it can also contain additional 
arbitrary keys that won't have any types.

#### Combining Objects

Flow supports the Object-spread syntax to combine objects:

```typescript
type Named = {name: string}
type Aged = {age: number}
type Person = {...Named, ...Aged}
```

Object spread syntax works exact like it does for actual objects and order matters.
When there are duplicate keys, the last key wins.

Spread syntax behaves somewhat similar to a logical `AND`.

For a logical `OR`, you create a `UNION` of object types too:

```typescript
type NamedOrAged = Named | Aged
```

`NamedOrAged` may either have a `name` key, *OR* an `age` key, but NOT both.

Generally when creating unions of objects, it's useful to have at least one key that has a static string value:

```typescript
type NamedOrAged = {
   type: 'Named', 
   ...Named,
} | {
   type: 'Aged',
   ...Aged,
}
```

This pattern makes code that uses such a type easier to work with:

```js
switch (namedOrAged.type) {
  case 'Named':
    // Now we know that `namedOrAged` has a `name` key
    console.log(namedOrAged.name);
    break;
  case 'Aged': 
    // Now we know that `namedOrAged` has an `age` key
    console.log(namedOrAged.age);
    break;
  default:
    // We still need a default case to make Flow happy unless you use an enum
}
```

Generally, it's best to use plain Object types where possible, but sometimes it makes sense to use Classes.

### Classes

Javascript has `class` keyword support. And classes are slightly special in Flow as they're both a value *and* a type.
An object may be of type `Person`, but `new Person()` is also a function call.

Class types in Flow have one *big* difference when compared to plain object types. They are checked by NAME and not by STRUCTURE.

Consider this example:

```typescript
declare class PersonClass {
   name: string;
   age: number;
}

const bob = {
   name: "Bob",
   age: 30
}
```

Here, `bob` is **NOT** of the type `PersonClass` even though it has the same keys within. This is because only 
an object that is created with the `PersonClass` constructor can of be of its type.

```typescript
const actualPersonBob = new Person("Bob", 30);
```

Classes have their place, but should be used sparingly.

### Interfaces

Interfaces are the compromise between a `Class` and a plain Object Type. It's fairly similar to a Plain Object type,
but it can also be used to check class objects.

Further, classes can `implement` one or more `interfaces`:

```typescript
interface Named {name: string}
interface Aged {age: number}

class Person implements Named, Aged {
   name: string;
   age: number;
}
```

[Read More Here](https://medium.com/flow-type/sound-typing-for-this-in-flow-d62db2af969e)

### `this` type

The `this` type is only valid for `class` and `interface` types.

## When Types are REQUIRED

When you're using typechecking and value or function that is being "exported" needs explicit type annotations.

### Flow for Swift Developers

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
let str: null | void | string;

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