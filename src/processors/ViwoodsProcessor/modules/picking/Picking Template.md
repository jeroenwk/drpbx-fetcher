---
created: <% tp.user.createTime %>
type: Quick Capture
total_items: <% tp.user.totalPages %>
tags:
  - picking
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

# <% tp.user.noteName %>

<%*
// Loop over pages - each page shows image + Notes section for user content
tp.user.pages.forEach((page, index) => {
-%>
<%* if (index > 0) { -%>
___

<%* } -%>
![[<% page.imagePath %>]]

> [!note] Notes
> ...
> ^<% page.pageId %>

<%* }) -%>
