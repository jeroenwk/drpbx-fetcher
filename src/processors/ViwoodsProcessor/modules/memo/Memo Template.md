---
created: <% tp.user.created %>
modified: <% tp.user.modified %>
type: <% tp.user.memoType %>
<% tp.user.reminderLine %>
tags:
  - memo<% tp.user.todoTag %>
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

## Content

![[<% tp.user.memoImagePath %>]]

<% tp.user.memoContent %>

## Notes

*Add your notes here*
