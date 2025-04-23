---
title: Flower Crop Template
Folder: <Spring Creek Bloom>
type: ignore 
separator: ---
---
<%- separator %>
title: <%- prompt('noteTitle', 'Flower name') %>
triggers: onEditorWillSave => jgclark.RepeatExtensions.onEditorWillSave
Current Weather: <%- web.weather() %>
Air_Quality:
Flower_Provider: <%- prompt('Flower_Provider','Where did you buy them?',['Johnny','Reuse from last season','I do not know']) %>
Growth_Duration: <%- prompt('Growth_Duration',"What is the growth duration from today? (x[dwM])") %>
Bed_Location: <%- prompt('Bed_Location','Where is it located in your beautiful garden?') %>
Initial_Seeding: <%- prompt('Initial_Seeding', 'Enter seeding date YYYY-MM-DD') %>
Initial_Watering: <%- prompt('Initial_Watering', 'Enter initial watering date YYYY-MM-DD') %>
Watering_Interval: <%- prompt('Watering_Interval', 'Enter watering interval  (x[dwm])') %>
Initial_Weeding: <%- prompt('Initial_Weeding', 'Enter initial weeding date YYYY-MM-DD') %>
Weeding_Interval: <%- prompt('Weeding_Interval', 'Enter weeding interval (x[dwm])') %>
<%- separator %>

## Note


## Related Resources


## Action Items
- [x] <%- noteTitle %> Next watering ><%- Initial_Watering %> @repeat(<%- Watering_Interval %>) @done(<%- Initial_Watering %> 01:00 AM)
- [x] <%- noteTitle %> Next weeding ><%- Initial_Weeding %>  @repeat(<%- Weeding_Interval %>) @done(<%- Initial_Weeding %> 01:00 AM)
* Harvest <%- noteTitle %> ><%- date.now('YYYY-MM-DD', `+${Growth_Duration}`) %>

#project 
