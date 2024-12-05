---
title: Sample Template
type: empty-note
tags: migrated-template
---
# Sample Template
- This section is reserved for any content type types, etc.
- The actual template contents will be everything after the first horizontal rule
- This makes it capable of documenting templates etc.
- This is just filler content so I can test to make sure the template is pulled correctly

—tag: anything that starts with two dashes (`—`) will be treated as a comment and not processed.
	- Need to create `regex` to find such lines

—name: Mike Erickson
—created: 2021-10-22 5:42:09 AM
—modified: 2021-10-22 5:41:54 AM

Or, using a frontmatter format

—-
name: Mike Erickson
phone: 714.454.4236
—-

*****
# Hello World
This is the actual template contents, everything above line in the template has been stripped
Today Date: <%= date.now() %>
