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

> [!note] Attendees
> ...
> ^<% tp.user.blockIds.attendees %>

> [!note] Agenda
> ...
> ^<% tp.user.blockIds.agenda %>

## Meeting Notes

<%*
// Loop over pages - each page shows image + Notes section for user content
tp.user.pages.forEach((page, index) => {
-%>
<%* if (index > 0) { -%>
___

<%* } -%>
### Page <% page.pageNumber %>

![[<% page.imagePath %>]]

> [!note] Notes
> ...
> ^<% page.pageId %>

<%* }) -%>

> [!todo] Action Items
> ...
> ^<% tp.user.blockIds.actionItems %>

> [!note] Summary
> ...
> ^<% tp.user.blockIds.summary %>
