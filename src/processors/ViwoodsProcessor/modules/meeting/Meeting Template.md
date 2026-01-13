---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
meeting_date: <% tp.user.meetingDate %>
total_pages: <% tp.user.totalPages %>
tags:
  - meeting
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

## Attendees

*Add attendees here*

## Agenda

*Add agenda items here*

## Meeting Notes

<% tp.user.screenshotSections %>

## Action Items

- [ ] *Add action items here*

## Summary

*Add meeting summary here*
