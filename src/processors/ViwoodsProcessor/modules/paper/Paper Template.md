---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
total_pages: <% tp.user.totalPages %>
tags:
  - scribbling
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

<%*
// Loop over pages - each page shows image + Notes section for user content
tp.user.pages.forEach((page, index) => {
-%>
<%* if (index > 0) { -%>
___

<%* } -%>
![[<% page.imagePath %>]]

> [!note] Page <% page.pageNumber %>
> ...
> ^<% page.pageId %>

<%* }) -%>
<%*
// Note-level audio files appear at the end (not repeated on each page)
if (tp.user.audioFiles && tp.user.audioFiles.length > 0) {
-%>

## Audio Recordings

<%* tp.user.audioFiles.forEach(audio => { -%>
![[<% audio.path %>]]
<%* }) -%>
<%* } -%>
