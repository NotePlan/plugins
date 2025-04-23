---
title: Promise test template
type: meeting-note, empty-note 
---
## progressUpdate
 <%- progressUpdate({period: 'mtd',  progressHeading: 'Billable hours month-to-date', showSparklines: true}) -%>
## matchingEvents
<%- await matchingEvents( {includeTitle:false} ) %>
## progressUpdate
<%- await progressUpdate() %>
## Remove section
<%- await DataStore.invokePluginCommandByName("Remove section from recent notes","np.Tidy",['{"sectionHeading":"Stats", "runSilently": true}']) %>
## Readwise Daily Review
<%- await DataStore.invokePluginCommandByName("Readwise Daily Review","aaronpoweruser.ReadwiseUnofficial") %>