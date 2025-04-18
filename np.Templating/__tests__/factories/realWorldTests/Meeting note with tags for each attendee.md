---
title: Meeting note with tags for each attendee
type: ignore
append: <current>
documentation: https://help.noteplan.co/article/134-meeting-notes
source: "@oliverandrich [Discord](https://discord.com/channels/763107030223290449/963950027946999828/1058743809174937630)"
note: dbw was trying to trap for not running in a meeting note, but that didn't work - this is a wip
---
<%
function globalExists(varName) {
  // Calling eval by another name causes evalled code to run in a
  // subscope of the global scope, rather than the local scope.
  const globalEval = eval;
  try {
    globalEval(varName);
    return true;
  } catch (e) {
 console.log(e)
    return false;
  }
}
if (!data.eventAttendees)  { await CommandBar.prompt("Error","You need to invoke this template from a meeting in the calendar.")
return }
const attendeeNames = eventAttendees.match(/\[(.+?)\]\(mailto:(.+?)\)/gi)
const attendeeTags = (attendeeNames || [])
  .map(s => {
    return s.replace(/\[(.+?)\]\(mailto:.+?@(.+?)\)/, (m, nameGroup, emailGroup) => {
      const name = nameGroup
        .replace(/Sternwald/g, "")
        .split(",")
        .reverse()
        .map((s) => s.replace(/\s+/g, ""))
        .join("")
        .split(".").map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("")

      let company = emailGroup
        .split(".")
        .reverse()[1]
        .toLowerCase()

      company = company.charAt(0).toUpperCase() + company.slice(1)
      if (company !== "") { company = company + "/"}

      return ["@", company, name].join("")
    })
  })

const attendeeTagsString = [...new Set(attendeeTags)].sort().join(", ")

const teamsMeetingLinkCandidates = eventNotes
  .match(/<(https:\/\/teams\.microsoft\.com.*?meetup-join.*?)>/gi)
const teamsMeetingLink = (teamsMeetingLinkCandidates || [])
  .map(s => s.replace(/<(https:\/\/teams\.microsoft\.com.*?meetup-join.*?)>/, (m, g) => g))
  .join("")
const teamsMeetingString = teamsMeetingLink !== "" ? "  -  🧑🏻‍💻[Teams Meeting](" + teamsMeetingLink + ")" : ""

const zoomMeetingLinkCandidates = eventNotes
  .match(/(https:\/\/.*?\.zoom\.us\/.*)/gi)
const zoomMeetingLink = (zoomMeetingLinkCandidates || [])
  .map(s => s.replace(/(https:\/\/.*?\.zoom\.us\/.*)/, (m, g) => g))
  .join("")
const zoomMeetingString = zoomMeetingLink !== "" ? "  -  🧑🏻‍💻[Zoom Meeting](" + zoomMeetingLink + ")" : ""
-%>
### 👉 <%- eventTitle %>
*<%- eventDate('D.M.YYYY  h:mm') %>-<%- eventEndDate('H:mm') %>*<%- teamsMeetingString %><%- zoomMeetingString %>
<%- attendeeTagsString %>

