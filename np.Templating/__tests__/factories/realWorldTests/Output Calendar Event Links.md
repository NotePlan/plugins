---
title: Output Calendar Event Links
type: ignore
---
 <% const titles = new Set(); let linksText = ''; if (Editor.type === "Calendar" && Editor.title) { const allDaysEvents = await Calendar.eventsToday(); for (const event of allDaysEvents) { if (event.calendarItemLink && event.calendarItemLink.split(":::").length >= 5) { const date = event.date.toLocaleTimeString(); const foundParas = await DataStore.search(event.calendarItemLink.split(":::")[1]); if (foundParas.length) { foundParas.forEach((n) => { titles.add(`${date}: [[${n.note?.title || ''}]]`); }) } } } linksText = Array.from(titles).join("\n"); } -%> 
 <%- linksText %>