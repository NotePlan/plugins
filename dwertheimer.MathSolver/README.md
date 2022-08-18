# Math Solver Noteplan Plugin

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/dwertheimer.MathSolver/CHANGELOG.md) for latest updates/changes to this plugin.

## About This Plugin 

![mathblock](https://user-images.githubusercontent.com/8949588/185295717-81264273-2a13-444f-a416-193931a41039.gif)

This Plugin allows you to write basic math with descriptive text in your NotePlan notes and calculate the values. The inspiration was the ever-useful [Soulver App](https://soulver.app/) and incorporates some great open-source code from [Lorenzo Corbella](https://github.com/LorenzoCorbella74/soulver-web).

This Plugin searches the active document looking for "math" code blocks (aka Math Blocks) -- you can have as many Math Blocks on a page as you wish. When the Calculate command is run, all the Math Blocks on the page are calculated.

## Using The Plugin

The easiest way to start using this plugin is by running the command:
    `/Insert Math Block at Cursor`
This will (as the name implies) insert a "Math Block" in your document and a "Calculate" link you can click to recalculate the Math Blocks on the page. 

## Buttons/Links

- Clicking/tapping `Calculate` button will recalculate any Math Blocks in the currently active document

- The `Clear` button will clear any previous calculations/comments previously placed on the page by the plugin. Note: because recalculating is not automatic (you have to click/tap Calculate), it's a good habit to click "Clear" before you change/add/remove numbers in your Math Block so that you remember to recalculate and don't end up with stale calculations.

## Basic Numbers
- Placing basic numbers on a line works like a calculator (e.g. 2 * 3 * 5)
- Each successive line is automatically added by default unless the line is assigned to a variable, e.g.
```math
    2
    3
    4
    total
```
...will be added together to get 9
- a number can have a lowercase "k" behind it to denote 1,000 * the number (e.g. `4k`)
- a number can have an uppercase "M" behind it to denote 1,000,000 * the number (e.g. `5M`)
- You can use percentages, e.g. `10% of 100` (which will yield 10)
- You can say `20 as a % of 1000` (the answer will be .02)
- NOTE: Math.js does not understand currencies (e.g. $4) -- use numbers only

## Variables/Named Values
- **Assignment** operations store values in named variables, e.g. 
    `taxRate = 10%`
- Assigned numbers are tabulated when the assigned numbers are later used in a line (either alone on a line or as part of an equation), e.g. 
    `taxRate` or `20 * taxRate` 
- NOTE: always use the ` = ` to assign to a variable. Text like:\n
    ` taxrate: 20% `
## (sub)Totals
Use the word "total" or "subtotal" (alone on a line) to add all the numbers on the previous lines
- `subtotal` or `total` on a line adds all preceeding non-assignment numbers/equations (Note: these words are not case sensitive -- you can use `Total` or `TOTAL` and get the same result)
- NOTE: you may have multiple subtotals which add just the previous lines. For instance:
```math
    1
    2
    subtotal // will be 3
    3
    4
    subtotal // will be 7 (only the numbers since the prev subtotal)
    total // will be 10 (all the numbers in the math block)
```
As you can see `subtotal` can be very useful for large math blocks.

## Text
Text that is not a number or an assignment to a variable will be ignored. This means you can use words to create context. For instance:
```math
Bought Groceries: 4 for bananas + 6.20 for apples
total
```
...will result in `total //= 10.2`
## Comments
- Full-line comments are lines which start with the hash (#), e.g. 
    `# this whole line will be ignored even if it has math (like 2+3)`
- You can also add comments which will be stripped out and ignored at the end of lines by using two forward slashes (//), e.g.
    `2 + 3 // the numbers will be added but this comment will be ignored`
- Any words, numbers or texts prior to a colon will be deleted, e.g.
    `6/19/2020: 2+2` (the date will be ignored)
    `Grocery list: 20` (will ignore the words "Grocery list")

## Advanced Math
- Under the hood, this plugin uses math.js to evaluate the equations, so ultimately you will get all the functionality that [math.js](https://mathjs.org/examples/basic_usage.js.html) offers, including functions like:
```
['sin', 'cos', 'tan', 'exp', 'sqrt', 'ceil', 'floor', 'abs', 'acos', 'asin', 'atan', 'log', 'round'] ... that's just the beginning. There is a LOT of functionality in [math.js](https://mathjs.org/examples/basic_usage.js.html).
```
That said, getting all of it into the plugin will take some more coding, so be sure to mention on Discord which functions are highest priority for you!

## Work-in-Progress / Future Work
- +/- X%
