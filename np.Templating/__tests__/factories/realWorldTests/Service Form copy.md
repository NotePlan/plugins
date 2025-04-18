---
title: Service Form
type: template-form
receivingTemplateTitle: "Service Processing Template"
windowTitle: "Service"
formTitle: "Create New Service"
hideDependentItems: false
allowEmptySubmit: false
width: 600
launchLink: noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=Service%20Form
---
```formfields
[
    {
	    key: 'serviceDate',
		buttonText: 'Service date',
		type: 'calendarpicker',
		required: true,
		visible: false,
    },
    {
		key: 'place',
		label: 'Place',
		type: 'dropdown-select',
		options: ['CCC', 'BBC', 'Other', 'Hope'],
		compactDisplay: true,
    },
    {
	    key: 'serviceTitle',
	    label: 'Service Title',
	    type: 'input',
	    compactDisplay: true,
		required: false,
    },
    {
		key: 'serviceType',
		label: 'Service Type',
		type: 'dropdown-select',
		options: ['MW', 'HC', 'AAW', 'AAHC', 'Messy', 'Special', 'other'],
		compactDisplay: true,
		required: true,
    },
    {
	    key: 'startTime',
		label: 'Start time (string)',
		type: 'input',
		compactDisplay: true,
    },
    {
		key: 'passages',
		label: 'Passage(s)',
		type: 'input',
		compactDisplay: true,
		required: false,
    },
	{
	  key: 'notes',
	  label: 'Initial notes',
	  type: 'input',
	  compactDisplay: false,
	},
]
```