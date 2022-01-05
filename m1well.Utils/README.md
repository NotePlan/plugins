# m1well.Utils NotePlan Plugin
This is a small collection of very useful functions I currently use nearly every day.  
**Future of this plugin:**  
If the core team provides kind of a "api styled" plugin, then it is of course absolutely ok for me to outsource these functions there and remove this plugin  
But currently I don't see any possibility for something like this and I still want to share these useful functions with you

## Commands
Using the NotePlan Plugin Shortcut `/`

### ->> `/util:repeater` <<-
"Repeat task(s) just by selecting them in whatever note you want with a lot of functionalities"  

**ATTENTION:**
- Currently it isn't possible to programatically create future daily notes (it is - but it is not that safe)
- so before you use the repeater, make sure you have the required notes
- how to create them - see my thoughts on `## Future Daily Notes`

**HOW TO:**
1. select one ore more lines you want to repeat (they doesn't have to be tasks, they are automatically converted to tasks for the repeats)
2. choose a future start date (or leave it empty for using tomorrow)
3. choose any option you want:
   - Day -> repeat task every day
   - Week -> repeat task every week (every seven days)
   - 2 Weeks -> repeat task every 2 weeks (every fourteen days)
   - Month -> repeat task every month
   - 2 Months -> repeat task every 2 months
   - Quarter-year -> repeat task every quarter-year (every three months)
   - Half-year -> repeat task every half-year (every six months)
   - Year -> repeat task every year
   - Special -> described down below
4. special options:
   - Every special weekday -> e.g. every monday or every saturday
   - Every nth day of month -> e.g. every first day of month, or 5. day of month, or last day of month, etc.
5. choose repetitions -> how often should the task repeat incl. the first occurrence

**ADVANTAGES:**
- the `@repeat` is now at the first occurence, so if you want to delete all repetitions, you just have to delete this first one
- the last `@repeat` is BOLD, so that you are reminded to eventually create new repetitions again: example: @repeat(**!!15/15!!**)

### ->> `/util:sorter` <<-
"Sort selected lines by type and by prio ("inline sort" - so they stay at the same position in the note)"  

**ATTENTION:**
- To sort the tasks inline obviously I have to remove them
- If there are tasks with repeats, then you get asked if you want to remove - just click "No" please 
- Also depending on this question: if there are one or more `@repeat` in your selection, please select the WHOLE lines, because the question for deleting repeats "breaks" something if you don't select the whole upper line
- **I do not guarantee for disappeared repeats!**  

**SORT CRITERIA:**
1. open
2. scheduled
3. cancelled
4. done
5. list
6. text
and each of them also sorts itself by prio with the `!!!`, `!!` and `!`

### ->> `/util:autoArchiveNotes` <<-
"Provides possibility to auto archive notes with a specific tag and a given lifetime (moves note to @Archive)"  

**ATTENTION:**
- the lifetime thing works with the `createdDate` of the file (there is no other hidden feature)
- since NotePlan is file based you have to be careful now of course
- if you do a backup on your own, you have to look if it overwrites the `createdDate`

**HOW TO:**
1. configure `autoArchiveTag` and `autoArchiveLifeInDays`
2. add this configured tag to notes which you want to automatically archive
3. call this function wherever you want
4. all notes with this specific tag and the achieved lifetime are moved to the `@Archive` folder

### ->> `/util:cleanUpEmptyLinesInFuture` <<-
"Remove empty lines in future daily notes"  
This is just a possibility to remove empty lines in future notes.  
Because I just quickly create tasks in the future, (by hand or with my own custom BulletJournal plugin) it can also happen that there is an empty line (mostly at the end of the note).  
And this function removes all empty lines in the future to have clean notes.  

**HOW TO:**
1. Provide a future date to which the daily notes get cleaned up

## Future Daily Notes
Because it is currently not possible to create future daily notes programatically safe, i have discovered another way.  
But this only works on Mac, not on iPhone/iPad, because you need a commandline.  
Here are the steps:
1. open terminal window on NotePlan root folder
2. create empty calendar notes for the future (e.g. for 2 years from now = 730 days):  
   `for i in {0..730}; do dd=$(date -v "+${i}d" '+%Y%m%d'); touch ./Calendar/${dd}.md; done`  
   -> content of existing notes in the future doesn't change!
3. if you want to use the repeater to add tasks for more years in the future, then obviously you have to create more notes
4. if you are done with your repeats, you can remove the empty notes with `find ./Calendar -type f -empty -delete`
5. I also recommend having always empty notes for at least 2 years, to add some repeats for the next months, without thinking of the future notes

## Changelog
Here you can find the [Changelog](./CHANGELOG.md)
If you change something in the code, please create a new version and update the changelog file

## Author
Michael Wellner | [Github](https://github.com/m1well) | [Twitter](https://twitter.com/m1well) | [Homepage](https://m1well.com)
