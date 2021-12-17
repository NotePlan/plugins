# Plugin groupTasks
*by Nikolaus Hueck*

I like to add hashtags to my tasks so that I can find them in review mode through multiple notes.
This plugin groups all open tasks of the current note by their hashtags to help me to get a quicker overview.
The plugin can also delete blank lines between the tasks and task headings that are no longer used.


### Example:

> * task a #hashtag1
> * task b #hashtag2
> * task c #hashtag1
> * task d #hashtag3
> * task e 
> * task f #hashtag1
> * task g #hashtag1
> * task h #hashtag3

becomes

> #### Hashtag1
> * task a #hashtag1
> * task c #hashtag1
> * task f #hashtag1
> * task g #hashtag1
> #### Hashtag2
> * task b #hashtag2
> #### Hashtag3
> * task d #hashtag3
> * task h #hashtag3
> #### NoTag
> * task e 


You can configure certain aspects of "groupTasks" in the _configuration note in the template folder
(this relies on the configuration module by Naman Goel & Jonathan Clark as in the nmn.Template plugin)

groupTasks:
- allTasksHeading: A level 2 heading above the new list (defaults to "Tasks")
- noHashtagName: Heading for all tasks without a hashtag
- deleteEmptyLines: should empty lines between tasks be deleted (defaults to true)
- taggedTasksHeadingsLevel: level of new headings built from the tags (defaults to 4)
- deleteEmptyTasksHeadings: should old and "empty" headings be deleted? (defaults to true)