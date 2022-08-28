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

- Clicking/tapping `Calculate` button will recalculate any Math Blocks in the currently active document, showing work on any line there are calculations.

- The `Clear` button will clear any previous calculations/comments previously placed on the page by the plugin. Note: because recalculating is not automatic (you have to click/tap Calculate), it's a good habit to click "Clear" before you change/add/remove numbers in your Math Block so that you remember to recalculate and don't end up with stale calculations.

- the `Totals` button will do the same as `Calculate` but will not show work along the way. You will only see annotated results next to "subtotal" or "total" lines. e.g.:

```math
1+2
1
subtotal  //= 4
2
total  //= 6
```

> **NOTE**
> It is generally a good idea to click "Calculate" just so you know the math parser understood your intended calculations correctly. You can then immediately click "Totals" to hide the line-by-line verifications and show the totals only.

## Basic Numbers

- Placing basic numbers on a line works like a calculator (e.g. 2 *3* 5)
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

### Assignment operations

Assignment operations store values in named variables, e.g.
    `taxRate = 10%`
    Notes:
        - Assigned numbers are tabulated when the assigned numbers are later used in a line (either alone on a line or as part of an equation), e.g.
            `taxRate` or `20 * taxRate`
        - Always use the ` = ` to assign to a variable. Text like: ` taxrate: 20% ` does not do variable assignment. 

> **NOTE**
> Variables must not contain spaces (one block of characters)

### Preset variables

If there are variables you want to use over and over again in different documents, you can save them in the "Preset Variables" field in this plugin's preferences. Those variables will then be available to you by name in any Math Block.

If, on the other hand, there are variables you want to re-use in multiple math blocks inside one particular note, you can save those variables in the frontmatter of the note indented (***with spaces (NOT TABS)***) under a heading called `mathPresets`, e.g.:

```
---
mathPresets:
  myVar: 20
  anotherOne: 50
---
note content here
```

> **Tip**: An easy way to create frontmatter is a command in @jgclark's plugin "Note Helpers":
> `/convert note to frontmatter`

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

> **NOTE:** 
> You can also assign a (sub)total to a variable (thx George), e.g.

```math
Quickbooks: 300
Windows: 500
softwareTotal = subtotal

PC: 1000
Mouse: 50
hardwareTotal = subtotal

bill = softwareTotal +  hardwareTotal //= 1850
```

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

## Time Math

You can calculate basic time math as well, e.g.:

```
3h + 20mins
4hours + 1minute
total //= 7.35 h
```

> **NOTE** 
> Notice there is no space between the number and the abbreviation. If you enter a space, calculations will not work properly.

Legal abbreviations are:

- second (s, secs, seconds)
- minute (mins, minutes) -- ***note: you cannot use "m" for minutes, because that's meters**
- hour (h, hr, hrs, hours),
- day (days)
- week (weeks)
- month (months), year (years)

> **WARNING** 
> Mixing time-math and regular math in the same Math Block will not be reliable.

## Other Unit Calculations

Like time, there are other unit calculations that [math.js](https://mathjs.org/docs/datatypes/units.html#reference) understands and therefore will work in math blocks. For instance:

```
2inches + 2feet      //= 26 inches                                                                                              
```

> **INFO** 
> Notice how the results are expressed in terms of the first item you gave -- in this case, the result is in inches, because the first item was in inches. If we wanted this same result in feet, we could do the reverse:

```
2feet + 2inches      //= 2.1666666666666665 feet     
```

So, if you want to ensure the following calculation comes out in hours vs. minutes, add a 0h in the first line (alternatively, you could add a line at the top that says "0h"):
```
initial draft session 0h + 36mins                         
session two 42mins                                        
session three 17mins                                      
total                             //= 1.5833333333333333 h
```

For the full list of units, [click here](https://mathjs.org/docs/datatypes/units.html#reference).

## Advanced Math

- Under the hood, this plugin uses math.js to evaluate the equations, so ultimately you will get all the functionality that [math.js](https://mathjs.org/examples/basic_usage.js.html) offers, including functions like:

```
['sin', 'cos', 'tan', 'exp', 'sqrt', 'ceil', 'floor', 'abs', 'acos', 'asin', 'atan', 'log', 'round'] ... that's just the beginning. There is a LOT of functionality in [math.js](https://mathjs.org/examples/basic_usage.js.html).
```

That said, getting all of it into the plugin will take some more coding, so be sure to mention on Discord which functions are highest priority for you!

## Work-in-Progress / Future Work

- +/- X%

## Acknowledgements - Special Thanks for the Ideas/Testing

- @george65
- @QualitativeEasing
