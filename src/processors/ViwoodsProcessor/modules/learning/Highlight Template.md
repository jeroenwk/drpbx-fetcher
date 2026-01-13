---
created: <% tp.user.dateHighlighted %>
location: "<% tp.user.location %>"
page: <% tp.user.pageNumber %>/<% tp.user.totalPages %>
source: "<% tp.user.bookName %>"
tags:
  - highlight
  - book
  - <% tp.user.bookSlug %>
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

## <% tp.user.bookName %>

**Location:** <% tp.user.location %>
**Page:** <% tp.user.pageNumber %>/<% tp.user.totalPages %>
**Date highlighted:** <% tp.user.dateHighlighted %>
**Source:** <% tp.user.sourceInfo %>

---

> <% tp.user.highlightText %>

### Notes

*Add your thoughts here*
