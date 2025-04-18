---
title: Service Form dbw Test
type: template-form
receivingTemplateTitle: "Service Processing Template dbw Test"
windowTitle: "Service"
formTitle: "Create New Service"
hideDependentItems: false
allowEmptySubmit: false
width: 600
launchLink: noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=Service%20Form%20dbw%20Test
---
```formfields
[
    {
        key: 'serviceDate',
        buttonText: 'Service date',
        type: 'calendarpicker',
        visible: false,
    },
    {
        key: 'church',
        label: 'Church',
        type: 'dropdown-select',
        options: ['CCC', 'BBC', 'Other'],
        compactDisplay: true,
    },
]
```


