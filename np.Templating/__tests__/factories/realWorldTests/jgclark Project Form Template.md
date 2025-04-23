---
title: jgclark Project Form
type: template-form
receivingTemplateTitle: "Project Form Processing Template"
windowTitle: "Project"
formTitle: "Create New Project"
hideDependentItems: false
allowEmptySubmit: false
width: 500
launchLink: noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=jgclark%20Project%20Form
---
```formfields
[
    {
      key: 'noteTitle',
      label: 'Project Title',
      description: 'This will be the name/title of the project.',
      type: 'input',
      compactDisplay: true,
	  required: true,
    },
    {
      key: 'startDateEntry',
      buttonText: 'Start date',
      type: 'calendarpicker',
	  visible: false,
    },
    {
      key: 'dueDateEntry',
      buttonText: 'Due date',
      type: 'calendarpicker',
	  visible: false,
    },
    {
      key: 'aim',
      label: 'Aim',
      description: 'The aim/purpose of the project.',
      type: 'input',
      compactDisplay: true,
    },
    {
      key: 'context',
      label: 'Context',
      description: 'The context of the project.',
      type: 'input',
      compactDisplay: true,
    },
    {
      key: 'team',
      label: 'Team',
      type: 'dropdown-select',
      options: ['team alpha', 'team beta', 'team charlie'],
      default: 'team beta',
      compactDisplay: true,
    },
	{
	  key: 'interval',
	  label: 'Review Interval',
	  description: 'Enter the review interval in the format: nn[bdwmqy]',
	   compactDisplay: true,
	   type: 'input',
	   validationType: 'date-interval'
	},
  ]
```
