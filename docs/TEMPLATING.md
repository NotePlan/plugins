# NotePlan Templating

## Overview
With regards to the user submitted issue on Github, I guess this is as good as times as any to discuss what templating tooling we should be offering for NotePlan Plugins.  We are still early in the game where we can help guide and mold the future.

## Background
There are a slew of templating libraries available in the JavaScript world as it relates to templating and we could discuss the pros and cons ad naseum, but we should probably come to a consensus as to what we will be using for our various plugin offerings.

Since most of the NotePlan users won’t have a programming background, I think choosing a tool that is as user friendly as possible is important and should be one of the factors that goes into our final decision. On the other hand, we as plugin developers will be using the templating tool the most, thus we need to make sure it supports all of our current (and future) requirements.

## Core Features
While we all have our own unique requirements, there are core features which should be available in the library we settle on

- easy to read
- ability to execute javascript functions `{{ myFunction() }}` or `<% myFunction %>`
- conditional branching ( if / else)
- looping
- pipe filter
- how well does it fit into NotePlan notes (make sure nothing breaks as a markdown note)

## JavaScript Templating Libraries
I have personally used `handlebars` a lot over the years, but I could just as easily pick a tool such as `nunjucks` or `eta` as they have their own unique set of features.

The following are some of the more popular templating libraries for JavaScript and provide the most features to align with our current and future templating needs.

There are obviously pros and cons to any templating library (this topic could be discussed forever as I am sure everybody is going to have their opinion).

> 📖 Refer to References at end of document for links to each library

- ejs (see comparisons with eta)
- eta (this is the one used by Obsidian Templater Plugin, perhaps a good selection for attracting Obsidian user)
- handlebars (successor to mustache)
- swig (JavaScript port of Twig, a popular PHP templating tool used by Symphony)
- squirrelly

> _💬 Jinja (popular in the Python world) has been mentioned on a github issues and there are two similar libraries for JavaScrip, see `nunjucks` or `eta` for more context._

### Templating Libraries to Avoid
> 🛑 One thing I would like to stress, there is a popular templating library called pug (formerly jade) which should be avoided as the templates simply will not work in NotePlan notes. They are dependent on indentation style formatting (much like Python programming) and NotePlan notes fail in this regard

## Templating Tags
If we ultimately decide to use `nunjucks` or `eta`, I feel we need to make that decision sooner, rather than later, as it will require a shift from current templating tags

Current Tags:
- `{{ }}`

Alternate Tags:
- `<% %>` used by `eta`
- `{% %}` used by `nunchucks`

## References

[eta](https://eta.js.org/)

[handlebars](https://handlebarsjs.com/)

[mustache](https://mustache.github.io/)

[nunjucks](https://mozilla.github.io/nunjucks/)

[pug](https://pugjs.org/api/getting-started.html)

[swig](https://node-swig.github.io/swig-templates/)

[squirrelly](https://squirrelly.js.org/)

[eta vs Ejs](https://eta.js.org/docs/about/eta-vs-ejs)

[templater](https://github.com/SilentVoid13/Templater)
