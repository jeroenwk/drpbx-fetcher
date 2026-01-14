---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
tags:
  - journal
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

## Related Notes

<% tp.user.relatedNotesContent %>

## Tasks & Notes

> [!note] Tasks & Notes
> ...
> ^tasks-notes-<% tp.user.dateSlug %>

<% tp.user.pageImages %>
