# m1well.Expense Noteplan Plugin

With this plugin you can write down and store your daily/monthly expenses with an ease.
This is meant to be used for further analysis.

## Configuration
Please use the new Plugin's settings section in the Plugin Preferences pane.

These are the different settings:
* `folderPath`
  * Path of the folder for the expenses Notes (if you change the path later on, then you also have to move the note(s)!)
* `delimiter`
  * Chose a delimiter (if none is set - default is `;` - currently allowed are `;`, `%`, `TAB`)
  * the `TAB` gets rendered by the original tab `\t`
* `dateFormat`
  * choose custom date format like `yyyy-MM-dd` or `yyyy-MM` if you don't care about the days
  * ATTENTION: don't use your chosen delimiter here in the date format
  * ATTENTION: please don't change this after first tracking
* `amountFormat`
  * choose either `full` to have always 2 fraction digits with localized separator and exact amount, or `short` to have no fraction digits and rounded amount
  * ATTENTION: please don't change this after first tracking
* `columnOrder`
  * choose column order - e.g. `['date', 'category', 'text', 'amount']`
  * ATTENTION: please don't change this after first tracking
* `categories`
  * Categories of your expenses, e.g. 'Living', 'Groceries', 'Insurances', 'Media'
* `shortcutExpenses` (JSON format)
  * Shortcuts to skip the input of category and text
* `fixedExpenses` (JSON format)
  * Fixed expenses in your life e.g. the monthly flat rent, the yearly car insurance or the monthly spotify subscription (which is deactivated in the example for show reasons)


## Hints
* for the sake of simplicity you can't change written lines or add older entries
  * for that you have to add/change/remove the lines manually
* Avoid empty lines in the Note, the plugin does not recognize them

## Commands
Using the NotePlan Plugin Shortcut `/`

### ->> `/exp:tra` <<-
Provides multiple possibilities to track your expenses.  
here you can choose if you want to track individual, shortcuts or fixed expenses.  
but you can also call a direct command (see the 3 below).

### ->> `/exp:ind` <<- (Individual tracking)
1. opens the note `{currentYear} Expenses Tracking` (if note doesn't exist, it gets created)
2. first popup: choose a category from his configuration
3. second popup: enter a special text for the entry
4. third popup: enter the amount of the expenses

### ->> `/exp:sho` <<- (Shortcuts tracking)
With this mode you can add configured shortcut expenses to skip the input of category and text
e.g. for your weekly groceries shopping in the same market or for refuelling the car

1. opens the note `{currentYear} Expenses Tracking` (if note doesn't exist, it gets created)
2. first popup: choose a shortcut
3. second popup: enter the amount of the expenses (doesn't appear if you configured an amount to this shortcut)

### ->> `/exp:fix` <<- (Fixed tracking)
With this mode you can add fixed expenses each month to your Daily Expenses Note

1. opens the note `{currentYear} Expenses Tracking` (if note doesn't exist, it gets created)
2. all fixed expenses from the `_configuration` which has attributes set:
   * active = true
   * month = current month or 0 (zero is for monthly fixed expenses e.g. a flat rent)
   
### ->> `/exp:agg` <<-
Aggregates the tracked expenses of the chosen year to a new expenses aggregated note
You can do this every time in the year to have a new aggregated view over your expenses

1. first popup: input a year for which tracking note you want to aggregate
2. opens the note `{chosenYear} Expenses Tracking`
3. aggregates all the expenses by month and category
4. opens the note `{currentYear} Expenses Aggregate`
   * if note doesn't exist, it gets created
   * if it exists, it gets cleared

## Example Workflow (also for Testing)
To get a better understanding of the plugin here is an example workflow with dates.
Let's say we have the fixed expenses from the example above.

### Daily Input
| Date of Tracking | Commmand |
|:----------:|----------------|
| 01.01.2021 | `exptra - fixed` -> to add fixed expenses for January |
| 03.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','89' |
| 05.01.2021 | `exptra - individual` 'Media', 'Apple TV Movie Rent','4' |
| 11.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','105' |
| 12.01.2021 | `exptra - individual` 'Fun', 'Coffee at Starbucks with Friends','22' |
| 19.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','81' |
| 20.01.2021 | `exptra - individual` 'Groceries', 'Beverages','55' |
| 25.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','77' |
| 01.02.2021 | `exptra - fixed` -> to add fixed expenses for February |
| 04.02.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','89' |
| ... | ... |

### Yearly Note
This generates following Note (with default delimiter `;`) and date format `yyyy-MM-dd`:

```csv
2021-01-01;Living;Flat Rent;670
2021-01-01;Insurances;Car Insurance;399
2021-01-03;Groceries;XYZ Market;89
2021-01-05;Media;Apple TV Movie Rent;4
2021-01-11;Groceries;XYZ Market;105
2021-01-12;Fun;Coffee at Starbucks with Friends;22
2021-01-19;Groceries;XYZ Market;81
2021-01-20;Groceries;Beverages;55
2021-01-25;Groceries;XYZ Market;77
2021-02-01;Living;Flat Rent;670
2021-02-04;Groceries;XYZ Market;89
...
```

same with date format `yyyy-MM`

```csv
2021-01;Living;Flat Rent;670
2021-01;Insurances;Car Insurance;399
2021-01;Groceries;XYZ Market;89
2021-01;Media;Apple TV Movie Rent;4
2021-01;Groceries;XYZ Market;105
2021-01;Fun;Coffee at Starbucks with Friends;22
2021-01;Groceries;XYZ Market;81
2021-01;Groceries;Beverages;55
2021-01;Groceries;XYZ Market;77
2021-02;Living;Flat Rent;670
2021-02;Groceries;XYZ Market;89
...
```

### Analyses
* You can put this Note then in Excel and generate e.g. a pivot table
  * to also aggregate the expenses for each month
  * to create some diagrams
* You can let the plugin aggregate the expenses by month and category to have a better overview
  * this generages following Note: (there you can see e.g. all Groceries in January are aggregated)
  * with default delimiter `;`

```text
2021;01;Living;670
2021;01;Insurances;399
2021;01;Groceries;407
2021;01;Media;4
2021;01;Fun;22
2021;02;Living;670
2021;02;Groceries;89
```

## Changelog
Here you can find the [Changelog](./CHANGELOG.md)
If you change something in the code, please create a new version and update the changelog file

## Author
Michael Wellner | [Github](https://github.com/m1well) | [Twitter](https://twitter.com/m1well) | [Homepage](https://m1well.com)
