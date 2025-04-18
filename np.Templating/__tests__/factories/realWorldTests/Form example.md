---
title: (old, not used) Form example (aka front end)
type: form
runTemplateOnSubmit: "Form example processing template"
---
```templatejs
const formFields = [
  {
    type: 'heading',
    label: "Tag/Mention section",
  },
  {
    type: 'separator',
  },
  {
    key: "textExample",
    label: "This is just some explanatory text",
    type: 'text',
	 textType: "description",
  },
  {
    key: "newTaskSectionHeading",
    label: "Section heading to add/move new tasks under",
    description: "When moving an item to a different calendar note, or adding a new item, this sets the Section heading to add it under. (Don't include leading #s.) If the heading isn't present, it will be added at the top of the note. If this is left empty, then new tasks will appear at the top of the note.",
    type: 'input',
    default: "Tasks",
    compactDisplay: true,
  },
  {
    key: "readOnlyExample",
    label: "This is a read-only field",
    description: "This displays an input box but is read-only",
    type: 'input-readonly',
    value: "Tasks",
    compactDisplay: true,
  },
  {
    key: "newTaskSectionHeadingLevel",
    label: "Heading level for new Headings",
    description: "Heading level (1-5) to use when adding new headings in notes.",
    type: 'number',
    default: "2",
    compactDisplay: true,
  },
  {
    key: "rescheduleNotMove",
    label: "Reschedule items in place, rather than move?",
    description: "When updating the due date on an open item in a calendar note, if set this will update its scheduled date in its current note, rather than move it.",
    type: 'switch',
    default: false,
    compactDisplay: true,
  },
  {
    key: "overdueSortOrder",
    label: "Sort order for Overdue tasks",
    description: "The order to show the Overdue tasks: 'priority' shows the higher priority (from `>>`, `!!!`, `!!` and `!` markers), 'earliest' by earliest modified date of the note, or 'most recent' changed note.",
    type: 'combo',
    options: ["priority", "earliest", "most recent"],
    default: "priority",
    compactDisplay: true,
  }
  {
    key: "dependencyExample",
    label: "Show dependent items?",
    description: "Turning this on shows dependent items.",
    type: 'switch',
    default: false,
    compactDisplay: true,
  },
  {
    key: "dependentItem",
    label: "This field is dependent on the one above.",
    type: 'input',
	 dependsOnKey: 'dependencyExample',
    default: "Should be disabled by default",
    compactDisplay: true,
  },
]
```