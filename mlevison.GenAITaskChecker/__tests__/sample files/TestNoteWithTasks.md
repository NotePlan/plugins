# Theme Test Note (for @jgclark themes)
# H1 colour and size
## H2 colour and size
### H3 colour and size
#### H4 colour and size
### Other things that are part of standard themes
With both **bold** and _italic_ text, and a ***combination***.
From v3.9.4 we can now have ==some nicer highlighting== or ~~strikethrough~~ around things. Even ~underlining~ _if we must_.
- #test #tags and @mentions are highlighted (very slightly differently) and have their links turned off
- here's `some inline code` and body text
* ! do
* !! something
* !!! very important
* >> working on something
* [>] ! Important Todo in the future >2021-08-04
* [>] Scheduled into the future >2031-03-02
* [x] Completed todo with #tagging and @ztag/subtag(test) @done(2021-02-13)
* [-] Cancelled todo with [How to be Generous to a Friend With Depression](https://www.stewardship.org.uk/blog/blog/post/733-how-to-be-generous-to-a-friend-with-depression?utm_source=Stewardship)
+ Checklist open
+ [>] Checklist scheduled and with a sync marker ^7qfqph
+ [x] Checklist done
+ [-] Checklist cancelled
> Every disease that submits to a cure shall be cured: but we will not call blue yellow to please those who insist on still having jaundice, nor make a midden of the world’s garden for the sake of some who cannot abide the smell of roses.’ -- C. S. Lewis (The Great Divorce)
- Bullets go like this
	- and then this
Frontmatter like fields: look like this.
---
### Markdown Links
The markdown syntax in Markdown links gets hidden, but appear when cursor is in the link: [NotePlan website](https://noteplan.co/).
### Note Links
- Standard Note links are shown without the surrounding brackets: [[Blank Header TEST]]
- Arrow note links are shown as above, but with a slightly different background colour. e.g. >Blank Header TEST<. They avoid the back-reference showing in that page's References section. (See also [How to create a link without a backlink?](https://help.noteplan.co/article/143-how-to-create-a-link-without-a-backlink#arrowlinks))
### Time Blocks
For people using the AutoTimeBlocking plugin with the default settings, this hides the tag `#🕑` which `/atb` includes on lines it creates: #🕑
### Comments
You can hide comments until you move your cursor into them, either inline like this: %%something in the middle%%, or at the end of a line like this: // something at the end
### Special highlight
Some people have a special use for a highlight that runs until the end of the line. To do this insert a Pilcrow (Alt-7) ¶ and see the effect.
### Fields and attributes
Fields: also supported, which might be useful for front matter, until fuller support for theming that emerges.
- Note: fields only apply at the start of a text line (not header, bullet etc.)
Attributes:: also can be highlighted at the start of a line.
### Tags in Template definitions
Here's a active tag: <% template tag %>  and one that is commented out: <%# commented out template tag %> .
### Code Block
```markdown
## Heading
Test code block :+\/ 
01234567890 ABCEDFGHijklmnopqrstu *with* **emphasis** and `things`.
1. list
* bullet
```
---
### More info
- [Customize Themes - NotePlan Knowledge Base](https://help.noteplan.co/article/44-customize-themes)
- [Theme Changelog - NotePlan Knowledge Base](https://help.noteplan.co/article/211-theme-changelog)
- My repo is [GitHub - jgclark/NP-themes: My NotePlan themes](https://github.com/jgclark/NP-themes)
- Brokosz has a repo at [GitHub - brokosz/NotePlan_Themes: Small collection of custom themes for NotePlan 3](https://github.com/brokosz/NotePlan_Themes)

---
## Full para breaks
Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore.

Et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
## Single newline breaks
Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore.
Et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
![📅](2023-10-26 14:00:::8A2C2207-98C9-40C1-9489-242CFFF95435:::NA:::1CB Team #meeting:::#1BADF8)
