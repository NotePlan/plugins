# Expenses Plugin
With this plugin you can write down and store your daily/monthly expenses.  
This is meant to be used for further analysis.


## Configuration
For a good start and to get the structure, you can just use the example config,  
which will be added to the `_configuration` on the first usage!

### Content
* `folderPath`
  * Path of the folder for the expenses Notes (if you change the path later on, then you also have to move the note(s)!)
* `clusters`
  * Clusters of your expenses, e.g. 'Living', 'Groceries', 'Insurances', 'Media'
* `shortcuts`
  * Shortcuts to skip the input of cluster and text
* `fixExpenses`
  * Fix expenses in your life e.g. the monthly flat rent, the yearly car insurance or the monthly spotify subscription (which is deactivated in the example for show reasons)

### Example
```json5
{
  expenses: {
    folderPath: 'finances',
    clusters: [
      'Living',
      'Groceries',
      'Insurances',
      'Mobility',
      'Media',
      'Fun',
    ],
    shortcuts: [
      'Mobility;Refuel',
      'Groceries;XYZ Market',
    ],
    fixExpenses: [
      {
        cluster: 'Living',
        text: 'Flat Rent',
        amount: 670,
        month: 0,
        active: true,
      },
      {
        cluster: 'Insurances',
        text: 'Car Insurance',
        amount: 399,
        month: 1,
        active: true,
      },
      {
        cluster: 'Media',
        text: 'Spotify',
        amount: 10,
        month: 0,
        active: false,
      },
    ],
  },
}
```


## Hints
* for the sake of simplicity you can't change written lines or add older entries
  * for that you have to add/change/remove the lines manually
* For reasons of space the shortcuts have to be in the format `cluster;text`
* To avoid problems with separator over different countries, only use integer values please  
  (e.g. instead of '9.99' use '10') - the plugin does a `Math.round()` anyways
* Avoid empty lines in the Note, the plugin does not recognize them


## Commands
You can enter a command in every note just by hitting the `/`

### ->> exptra <<-
Provides multiple possibilities to track your expenses

#### individual
1. opens the note `{currentYear} Expenses Tracking` (if note doesn't exist, it gets created)
2. first popup: choose a cluster from his configuration
3. second popup: enter a special text for the entry
4. third popup: enter the amount of the expenses

#### shortcuts
With this mode you can add configured shortcuts to skip the input of cluster and text  
e.g. for your weekly groceries shopping in the same market or for refuelling the car
1. opens the note `{currentYear} Expenses Tracking` (if note doesn't exist, it gets created)
2. first popup: choose a shortcut
3. second popup: enter the amount of the expenses

#### fix
With this mode you can add fix expenses each month to your Daily Expenses Note
1. opens the note `{currentYear} Expenses Tracking` (if note doesn't exist, it gets created)
2. all fix expenses from the `_configuration` which has attributes set:
   * ctive = true
   * month = current month or 0 (zero is for monthly fix expenses e.g. a flat rent)

### ->> expagg <<-
Aggregates the tracked expenses of the chosen year to a new expenses aggregated note  
You can do this every time in the year to have a new aggregated view over your expenses
1. first popup: input a year for which tracking note you want to aggregate
2. opens the note `{chosenYear} Expenses Tracking`
3. aggregates all the expenses by month and cluster
4. opens the note `{currentYear} Expenses Aggregate`
   * if note doesn't exist, it gets created
   * if it exists, it gets cleared


## Example Workflow (also for Testing)
To get a better understanding of the plugin here is an example workflow with dates ;)  
Let's say we have the fix expenses from the example above.

### Daily Input
| Date of Tracking | Commmand |
|:----------:|----------------|
| 01.01.2021 | `exptra - fix` -> to add fix expenses for January |
| 03.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','89' |
| 05.01.2021 | `exptra - individual` 'Media', 'Apple TV Movie Rent','4' |
| 11.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','105' |
| 02.01.2021 | `exptra - individual` 'Fun', 'Coffee at Starbucks with Friends','22' |
| 19.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','81' |
| 20.01.2021 | `exptra - individual` 'Groceries', 'Beverages','55' |
| 25.01.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','77' |
| 01.02.2021 | `exptra - fix` -> to add fix expenses for February |
| 04.02.2021 | `exptra - shortcuts` 'Groceries', 'XYZ Market','89' |
| ... | ... |
(for testing just change the month of the last to entries to another month ;))

### Yearly Note
This generates following Note:
```csv
2021;01;Living;Flat Rent;670
2021;01;Insurances;Car Insurance;399
2021;01;Groceries;XYZ Market;89
2021;01;Media;Apple TV Movie Rent;4
2021;01;Groceries;XYZ Market;105
2021;01;Fun;Coffee at Starbucks with Friends;22
2021;01;Groceries;XYZ Market;81
2021;01;Groceries;Beverages;55
2021;01;Groceries;XYZ Market;77
2021;02;Living;Flat Rent;670
2021;02;Groceries;XYZ Market;89
```

### Analyses
* You can put this Note then in Excel and generate e.g. a pivot table
  * to also aggregate the expenses for each month
  * to create some diagrams
* You can let the plugin aggregate the expenses by month and cluster to have a better overview
  * this generages following Note: (there you can see e.g. all Groceries in January are aggregated)
```
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
If you change something in the code, please create a new version and update the changelog file :)


## Author
Michael Wellner | [Github](https://github.com/m1well) | [Twitter](https://twitter.com/m1well) | [Homepage](https://m1well.com)
